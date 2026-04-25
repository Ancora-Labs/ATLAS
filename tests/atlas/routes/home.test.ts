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

function createRequest(method = "GET", url = "/"): IncomingMessage {
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
        workerActivity: {
          "quality-worker": [
            {
              at: "2026-04-22T08:14:00.000Z",
              from: "quality-worker",
              status: "working",
              task: "Validated the home route detail contract",
            },
          ],
        },
        completedTaskIds: [],
      },
    },
  }), "utf8");
  await fs.writeFile(path.join(stateDir, "live_worker_quality-worker.log"), [
    "[leadership_live]",
    "validated route detail",
    "ready for snapshot refresh",
  ].join("\n"), "utf8");
  return stateDir;
}

describe("atlas home route", () => {
  it("returns single-workspace home HTML with inline worker detail and readable log context", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {
        "quality-worker": {
          role: "quality-worker",
          status: "working",
          lastTask: "Validate the ATLAS route coverage",
          lastActiveAt: "2026-04-22T08:14:00.000Z",
          workerIdentityLabel: "Route quality worker",
          currentStage: "snapshot_refresh",
          currentStageLabel: "Refreshing detail",
          latestMeaningfulAction: "Published the refreshed home detail contract",
          latestMeaningfulActionAt: "2026-04-22T08:14:30.000Z",
          currentBranch: "feat/home-detail",
          createdPRs: ["https://example.com/pr/home"],
          filesTouched: ["src/atlas/routes/home.ts"],
          resolvedRole: "quality-worker",
          logicalRole: "quality-worker",
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
      assert.match(res.body, /aria-label="ATLAS desktop surface"/);
      assert.match(res.body, /aria-label="ATLAS session sidebar"/);
      assert.match(res.body, /aria-label="ATLAS work canvas"/);
      assert.match(res.body, /What should ATLAS do next\?/);
      assert.match(res.body, /Focused session detail/);
      assert.match(res.body, /quality-worker/);
      assert.match(res.body, /Route quality worker/);
      assert.match(res.body, /Refreshing detail/);
      assert.match(res.body, /feat\/home-detail/);
      assert.match(res.body, /https:\/\/example\.com\/pr\/home/);
      assert.match(res.body, /src\/atlas\/routes\/home\.ts/);
      assert.match(res.body, /ready for snapshot refresh/);
      assert.match(res.body, /bridge\?\.refreshSnapshot/);
      assert.match(res.body, /ATLAS snapshot refresh requires the Electron desktop bridge\./);
      assert.match(res.body, /data-role="product-composer-input"/);
      assert.doesNotMatch(res.body, /hero-panel|metric-card|BOX Mission Control|dashboard|window-controls|traffic-light/i);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] keeps the home workspace stable when no session can be resumed", async () => {
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
      assert.match(res.body, /What should ATLAS do next\?/);
      assert.match(res.body, /Focused session detail/);
      assert.match(res.body, /Readable log excerpt/);
      assert.match(res.body, /data-role="product-composer-input"/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] keeps the premium desktop shell stable when state files are missing", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = path.join(tempRoot, "state");
      await fs.mkdir(stateDir, { recursive: true });
      const req = createRequest();
      const res = createResponseCapture();

      await handleAtlasHomeRequest(req, res, {
        stateDir,
        targetRepo: "Ancora-Labs/ATLAS",
        hostLabel: "Windows 11 workstation",
        shellCommand: ".\\ATLAS.cmd",
      });

      assert.equal(res.statusCode, 200);
      assert.match(res.body, /aria-label="ATLAS desktop surface"/);
      assert.match(res.body, /aria-label="ATLAS session sidebar"/);
      assert.match(res.body, /aria-label="ATLAS work canvas"/);
      assert.match(res.body, /No session state is available yet\./);
      assert.match(res.body, /No live session focus yet/);
      assert.doesNotMatch(res.body, /dashboard-card|metric-card|window-controls|traffic-light/i);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
