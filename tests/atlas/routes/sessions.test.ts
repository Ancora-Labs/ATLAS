import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import { handleAtlasSessionsRequest } from "../../../src/atlas/routes/sessions.ts";

interface ResponseCapture {
  readonly headersSent: boolean;
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-sessions-route-"));
}

function createRequest(method = "GET", url = "/sessions"): IncomingMessage {
  return { method, url } as IncomingMessage;
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
    percent: 84,
    detail: "ATLAS is reviewing session readiness.",
    steps: [],
    updatedAt: "2026-04-22T08:25:00.000Z",
    startedAt: "cycle-1",
  }), "utf8");
  await fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({
    schemaVersion: 1,
    updatedAt: "2026-04-22T08:25:00.000Z",
    latestCycleId: "cycle-1",
    cycles: {
      "cycle-1": {
        cycleId: "cycle-1",
        updatedAt: "2026-04-22T08:25:00.000Z",
        status: "in_progress",
        workerSessions,
        workerActivity: {},
        completedTaskIds: [],
      },
    },
  }), "utf8");
  return stateDir;
}

describe("atlas sessions route", () => {
  it("returns a trust-first work ledger with readiness derived from worker state", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {
        Atlas: {
          role: "Atlas",
          status: "idle",
          lastTask: "",
          lastActiveAt: "2026-04-22T08:10:00.000Z",
        },
        "quality-worker": {
          role: "quality-worker",
          status: "blocked",
          lastTask: "Waiting for review feedback",
          lastActiveAt: "2026-04-22T08:24:00.000Z",
        },
        "integration-worker": {
          role: "integration-worker",
          status: "partial",
          lastTask: "Resume the standalone server patch",
          lastActiveAt: "2026-04-22T08:20:00.000Z",
          createdPRs: ["https://example.com/pr/1"],
          filesTouched: ["src/atlas/server.ts"],
        },
      });
      const req = createRequest();
      const res = createResponseCapture();

      await handleAtlasSessionsRequest(req, res, {
        stateDir,
        targetRepo: "Ancora-Labs/Box",
        shellCommand: ".\\ATLAS.cmd",
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
      assert.match(res.body, /<title>ATLAS Sessions<\/title>/);
      assert.match(res.body, /Trust-first work ledger/);
      assert.match(res.body, />Tracked sessions</);
      assert.match(res.body, /Session ledger keeps delivery trust anchored in the desktop lifecycle\./);
      assert.match(res.body, />ATLAS control</);
      assert.match(res.body, />Quality lane</);
      assert.match(res.body, />Integration lane</);
      assert.match(res.body, />3 tracked sessions</);
      assert.match(res.body, />2 resumable</);
      assert.match(res.body, />Needs attention · Needs your input</);
      assert.match(res.body, />Ready · Ready to continue</);
      assert.match(res.body, />Pause lane</);
      assert.match(res.body, />Archive session</);
      assert.match(res.body, /method="post" action="\/lifecycle"/);
      assert.doesNotMatch(res.body, /hero-panel|BOX Mission Control|dashboard/i);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] rejects unsupported request methods before rendering session output", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {});
      const req = createRequest("POST");
      const res = createResponseCapture();

      await handleAtlasSessionsRequest(req, res, { stateDir });

      assert.equal(res.statusCode, 405);
      assert.match(res.body, /Method Not Allowed/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("keeps the sessions surface stable when the restored focused role has no live snapshot", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {
        Atlas: {
          role: "Atlas",
          status: "idle",
          lastTask: "",
          lastActiveAt: "2026-04-22T08:10:00.000Z",
        },
        "quality-worker": {
          role: "quality-worker",
          status: "working",
          lastTask: "Validate the product shell recovery flow",
          lastActiveAt: "2026-04-22T08:24:00.000Z",
        },
      });
      const req = createRequest("GET", "/sessions?focusRole=missing-worker");
      const res = createResponseCapture();

      await handleAtlasSessionsRequest(req, res, {
        stateDir,
        targetRepo: "Ancora-Labs/Box",
        shellCommand: ".\\ATLAS.cmd",
      });

      assert.equal(res.statusCode, 200);
      assert.match(res.body, /Focus restored without a live session snapshot/);
      assert.match(res.body, /The saved focus target is still waiting on its next live session snapshot\./);
      assert.match(res.body, />Clear focus</);
      assert.doesNotMatch(res.body, /missing-worker/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
