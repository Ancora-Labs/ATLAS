import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import { handleAtlasLifecycleRequest } from "../../../src/atlas/routes/lifecycle.ts";
import { listAtlasSessions } from "../../../src/atlas/state_bridge.ts";

interface ResponseCapture {
  readonly headersSent: boolean;
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-lifecycle-route-"));
}

function createRequest(
  body: string,
  pathname = "/api/lifecycle",
  headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  },
): IncomingMessage {
  const stream = Readable.from([body]);
  return Object.assign(stream, {
    method: "POST",
    url: pathname,
    headers,
  }) as IncomingMessage;
}

function createResponseCapture(): ServerResponse<IncomingMessage> & ResponseCapture {
  let headersSent = false;
  let statusCode = 0;
  let body = "";
  const headers: Record<string, string> = {};

  return {
    get headersSent() {
      return headersSent;
    },
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get body() {
      return body;
    },
    writeHead(code: number, nextHeaders?: Record<string, string>) {
      statusCode = code;
      for (const [key, value] of Object.entries(nextHeaders || {})) {
        headers[key.toLowerCase()] = String(value);
      }
      return this;
    },
    end(chunk?: string | Buffer) {
      headersSent = true;
      body += chunk ? String(chunk) : "";
      return this;
    },
  } as ServerResponse<IncomingMessage> & ResponseCapture;
}

async function writeStateFixture(tempRoot: string): Promise<string> {
  const stateDir = path.join(tempRoot, "state");
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
    stage: "workers_running",
    stageLabel: "Workers Running",
    percent: 80,
    detail: "ATLAS is managing lifecycle controls.",
    steps: [],
    updatedAt: "2026-04-22T09:00:00.000Z",
    startedAt: "cycle-1",
  }), "utf8");
  await fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({
    schemaVersion: 1,
    updatedAt: "2026-04-22T09:00:00.000Z",
    latestCycleId: "cycle-1",
    cycles: {
      "cycle-1": {
        cycleId: "cycle-1",
        updatedAt: "2026-04-22T09:00:00.000Z",
        status: "in_progress",
        workerSessions: {
          "integration-worker": {
            role: "integration-worker",
            status: "partial",
            lastTask: "Resume ATLAS lifecycle wiring",
            lastActiveAt: "2026-04-22T08:55:00.000Z",
          },
          "quality-worker": {
            role: "quality-worker",
            status: "working",
            lastTask: "Verify archive safety",
            lastActiveAt: "2026-04-22T08:58:00.000Z",
          },
        },
        workerActivity: {},
        completedTaskIds: [],
      },
    },
  }), "utf8");
  return stateDir;
}

describe("atlas lifecycle route", () => {
  it("accepts JSON pause actions and writes the lane pause contract", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot);
      const req = createRequest(JSON.stringify({
        action: "pause",
        role: "integration-worker",
        returnTo: "/sessions",
      }));
      const res = createResponseCapture();

      await handleAtlasLifecycleRequest(req, res, { stateDir, pathname: "/api/lifecycle" });

      assert.equal(res.statusCode, 200);
      const payload = JSON.parse(res.body) as { ok: boolean; lane: string; message: string };
      assert.equal(payload.ok, true);
      assert.equal(payload.lane, "integration");
      assert.match(payload.message, /Paused the integration lane/i);

      const pausedLanes = JSON.parse(await fs.readFile(path.join(stateDir, "medic_paused_lanes.json"), "utf8")) as Record<string, unknown>;
      assert.ok(pausedLanes.integration);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("archives an inactive session through the API contract and removes it from open state", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot);
      const req = createRequest(JSON.stringify({
        action: "archive",
        role: "integration-worker",
        returnTo: "/sessions",
      }));
      const res = createResponseCapture();

      await handleAtlasLifecycleRequest(req, res, { stateDir, pathname: "/api/lifecycle" });

      assert.equal(res.statusCode, 200);
      const payload = JSON.parse(res.body) as { ok: boolean; message: string };
      assert.equal(payload.ok, true);
      assert.match(payload.message, /Archived "integration-worker"/);

      const sessions = await listAtlasSessions({ stateDir });
      assert.equal(sessions["integration-worker"], undefined);

      const archiveRoot = path.join(stateDir, "archive");
      const archiveDates = await fs.readdir(archiveRoot);
      assert.equal(archiveDates.length, 1);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] rejects archive requests for active sessions with a deterministic error contract", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot);
      const req = createRequest(JSON.stringify({
        action: "archive",
        role: "quality-worker",
      }));
      const res = createResponseCapture();

      await handleAtlasLifecycleRequest(req, res, { stateDir, pathname: "/api/lifecycle" });

      assert.equal(res.statusCode, 409);
      const payload = JSON.parse(res.body) as { ok: boolean; code: string; error: string };
      assert.equal(payload.ok, false);
      assert.equal(payload.code, "session_archive_active");
      assert.match(payload.error, /cannot be archived yet/i);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
