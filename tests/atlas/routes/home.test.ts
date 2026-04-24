import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import { handleAtlasHomeRequest } from "../../../src/atlas/routes/home.ts";

interface ResponseCapture {
  readonly headersSent: boolean;
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-home-route-"));
}

function createRequest(method = "GET"): IncomingMessage {
  return { method } as IncomingMessage;
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

async function writeStateFixture(
  tempRoot: string,
  workerSessions: Record<string, unknown>,
): Promise<string> {
  const stateDir = path.join(tempRoot, "state");
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
    stage: "workers_running",
    stageLabel: "Workers Running",
    percent: 82,
    detail: "ATLAS is coordinating the current repo session.",
    steps: [],
    updatedAt: "2026-04-22T08:15:00.000Z",
    startedAt: "cycle-1",
  }), "utf8");
  await fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({
    schemaVersion: 1,
    updatedAt: "2026-04-22T08:15:00.000Z",
    latestCycleId: "cycle-1",
    cycles: {
      "cycle-1": {
        cycleId: "cycle-1",
        updatedAt: "2026-04-22T08:15:00.000Z",
        status: "in_progress",
        workerSessions,
        workerActivity: {},
        completedTaskIds: [],
      },
    },
  }), "utf8");
  return stateDir;
}

describe("atlas home route", () => {
  it("returns ATLAS product HTML with desktop continuity, delivery focus, and repo state", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {
        "quality-worker": {
          role: "quality-worker",
          status: "working",
          lastTask: "Validate the ATLAS route coverage",
          lastActiveAt: "2026-04-22T08:14:00.000Z",
        },
        "governance-worker": {
          role: "governance-worker",
          status: "done",
          lastTask: "Approve the current change set",
          lastActiveAt: "2026-04-22T08:10:00.000Z",
        },
      });
      const req = createRequest();
      const res = createResponseCapture();

      await handleAtlasHomeRequest(req, res, {
        stateDir,
        targetRepo: "Ancora-Labs/Box",
        hostLabel: "Windows 11 workstation",
        shellCommand: ".\\ATLAS.cmd",
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
      assert.match(res.body, /<title>ATLAS Home<\/title>/);
      assert.match(res.body, /Native desktop workspace/);
      assert.match(res.body, /Desktop continuity/);
      assert.match(res.body, /ATLAS keeps the live delivery state in the desktop window\./);
      assert.match(res.body, /Active delivery focus/);
      assert.match(res.body, /Repo state/);
      assert.match(res.body, />Ready to resume</);
      assert.match(res.body, />Resume session flow</);
      assert.match(res.body, />Stop runtime</);
      assert.match(res.body, /Tracked sessions/);
      assert.match(res.body, />Ancora-Labs\/Box</);
      assert.doesNotMatch(res.body, /quality-worker|governance-worker/);
      assert.doesNotMatch(res.body, /hero-panel|metric-card|BOX Mission Control|dashboard/i);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] falls back to start readiness when no session can be resumed", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {
        "quality-worker": {
          role: "quality-worker",
          status: "done",
          lastTask: "Closed the verification pass",
          lastActiveAt: "2026-04-22T08:05:00.000Z",
        },
        "integration-worker": {
          role: "integration-worker",
          status: "offline",
          lastTask: "Paused external checks",
          lastActiveAt: "2026-04-22T08:00:00.000Z",
        },
      });
      const req = createRequest();
      const res = createResponseCapture();

      await handleAtlasHomeRequest(req, res, {
        stateDir,
        targetRepo: "Ancora-Labs/Box",
      });

      assert.equal(res.statusCode, 200);
      assert.match(res.body, />Ready to start</);
      assert.match(res.body, />Open sessions</);
      assert.match(res.body, /No resumable session is active yet/);
      assert.match(res.body, /Desktop continuity/);
      assert.doesNotMatch(res.body, /quality-worker|integration-worker/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
