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
  const now = Date.now();
  const pipelineUpdatedAt = new Date(now - 60_000).toISOString();
  const workerActiveAt = new Date(now - 50_000).toISOString();
  const stateDir = path.join(tempRoot, "state");
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
    stage: "workers_running",
    stageLabel: "Workers Running",
    percent: 82,
    detail: "ATLAS is coordinating the current repo session.",
    steps: [],
    updatedAt: pipelineUpdatedAt,
    startedAt: "cycle-1",
  }), "utf8");
  await fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({
    schemaVersion: 1,
    updatedAt: pipelineUpdatedAt,
    latestCycleId: "cycle-1",
    cycles: {
      "cycle-1": {
        cycleId: "cycle-1",
        updatedAt: pipelineUpdatedAt,
        status: "in_progress",
        workerSessions,
        workerActivity: {
          "quality-worker": [
            {
              at: workerActiveAt,
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
  it("returns the blank new-session workspace when no session is selected", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {
        "quality-worker": {
            role: "quality-worker",
            status: "working",
            lastTask: "Validate the ATLAS route coverage",
            lastActiveAt: new Date(Date.now() - 50_000).toISOString(),
            workerIdentityLabel: "Route quality worker",
            currentStage: "snapshot_refresh",
            currentStageLabel: "Refreshing detail",
            latestMeaningfulAction: "Published the refreshed home detail contract",
            latestMeaningfulActionAt: new Date(Date.now() - 30_000).toISOString(),
            currentBranch: "feat/home-detail",
            createdPRs: ["https://example.com/pr/home"],
            filesTouched: ["src/atlas/routes/home.ts"],
          resolvedRole: "quality-worker",
          logicalRole: "quality-worker",
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
      const documentMarkup = res.body.split("<script>")[0] || res.body;

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
      assert.match(documentMarkup, /<title>ATLAS Workspace<\/title>/);
      assert.match(documentMarkup, /data-main-pane-mode="new-session"/);
      assert.match(documentMarkup, /data-role="brand-reset"/);
      assert.match(documentMarkup, /data-role="new-session-link"/);
      assert.match(documentMarkup, /data-role="session-rail"/);
      assert.match(documentMarkup, /href="\/" data-role="brand-reset"/);
      assert.match(documentMarkup, /href="\/"[\s\S]*?data-role="new-session-link"/);
      assert.match(documentMarkup, /href="\/\?focusRole=quality-worker"[\s\S]*?data-session-role="quality-worker"/);
      assert.match(documentMarkup, /data-role="new-session-view"/);
      assert.match(documentMarkup, /Start a new session from a clean workspace/);
      assert.match(documentMarkup, /What should ATLAS do next\?/);
      assert.match(documentMarkup, /data-role="product-composer-input"/);
      assert.match(documentMarkup, /data-session-role="quality-worker"/);
      assert.match(documentMarkup, /Quality lane/);
      assert.match(documentMarkup, /data-role="session-row-status-light"/);
      assert.doesNotMatch(documentMarkup, /data-role="selected-session-view"/);
      assert.doesNotMatch(documentMarkup, /dashboard|window-controls|traffic-light/i);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns the selected session detail when the request focuses a live session", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {
        "quality-worker": {
            role: "quality-worker",
            status: "working",
            lastTask: "Validate the ATLAS route coverage",
            lastActiveAt: new Date(Date.now() - 50_000).toISOString(),
            workerIdentityLabel: "Route quality worker",
            currentStage: "snapshot_refresh",
            currentStageLabel: "Refreshing detail",
            latestMeaningfulAction: "Published the refreshed home detail contract",
            latestMeaningfulActionAt: new Date(Date.now() - 30_000).toISOString(),
            currentBranch: "feat/home-detail",
            createdPRs: ["https://example.com/pr/home"],
            filesTouched: ["src/atlas/routes/home.ts"],
          resolvedRole: "quality-worker",
          logicalRole: "quality-worker",
        },
      });
      const req = createRequest("GET", "/?focusRole=quality-worker");
      const res = createResponseCapture();

      await handleAtlasHomeRequest(req, res, {
        stateDir,
        targetRepo: "Ancora-Labs/Box",
        hostLabel: "Windows 11 workstation",
        shellCommand: ".\\ATLAS.cmd",
      });
      const documentMarkup = res.body.split("<script>")[0] || res.body;

      assert.equal(res.statusCode, 200);
      assert.match(documentMarkup, /data-main-pane-mode="selected-session"/);
      assert.match(documentMarkup, /data-role="selected-session-view"/);
      assert.match(documentMarkup, /data-role="selected-session-status-light"/);
      assert.match(documentMarkup, /live-status-active[\s\S]*?data-role="selected-session-status-light"/);
      assert.match(documentMarkup, /Route quality worker/);
      assert.match(documentMarkup, /Refreshing detail/);
      assert.match(documentMarkup, /feat\/home-detail/);
      assert.match(documentMarkup, /https:\/\/example\.com\/pr\/home/);
      assert.match(documentMarkup, /ready for snapshot refresh/);
      assert.match(documentMarkup, /New Session/);
      assert.match(documentMarkup, /href="\/"[\s\S]*?data-role="new-session-link"/);
      assert.match(documentMarkup, /data-role="selected-session-actions"[\s\S]*?<a class="action-button primary" href="\/">New Session<\/a>/);
      assert.doesNotMatch(documentMarkup, /data-role="product-composer-input"/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("falls back to the blank workspace instead of stale detail when the root route restores a missing focus", async () => {
    const tempRoot = await createTempRoot();

    try {
      const stateDir = await writeStateFixture(tempRoot, {
        "quality-worker": {
          role: "quality-worker",
          status: "working",
          lastTask: "Validate the ATLAS route coverage",
          lastActiveAt: "2026-04-22T08:14:00.000Z",
        },
      });
      const req = createRequest("GET", "/?focusRole=missing-worker");
      const res = createResponseCapture();

      await handleAtlasHomeRequest(req, res, {
        stateDir,
        targetRepo: "Ancora-Labs/Box",
        hostLabel: "Windows 11 workstation",
        shellCommand: ".\\ATLAS.cmd",
      });
      const documentMarkup = res.body.split("<script>")[0] || res.body;

      assert.equal(res.statusCode, 200);
      assert.match(documentMarkup, /data-main-pane-mode="new-session"/);
      assert.match(documentMarkup, /data-role="new-session-view"/);
       assert.match(documentMarkup, /The selected session is waiting for its next live update/);
       assert.match(documentMarkup, /Selected detail unavailable/);
       assert.doesNotMatch(documentMarkup, /data-role="selected-session-view"/);
       assert.doesNotMatch(documentMarkup, /missing-worker/);
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
      const documentMarkup = res.body.split("<script>")[0] || res.body;

      assert.equal(res.statusCode, 200);
      assert.match(documentMarkup, /data-main-pane-mode="new-session"/);
      assert.match(documentMarkup, /data-role="new-session-view"/);
      assert.match(documentMarkup, /Where should ATLAS start\?/);
      assert.match(documentMarkup, /No session state is available yet\./);
      assert.doesNotMatch(documentMarkup, /data-role="selected-session-view"/);
      assert.doesNotMatch(documentMarkup, /dashboard-card|metric-card|window-controls|traffic-light/i);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
