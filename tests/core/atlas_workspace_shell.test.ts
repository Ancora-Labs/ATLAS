import assert from "node:assert/strict";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import { getAtlasClarificationPacketPath } from "../../src/atlas/clarification.ts";
import { type AtlasPageData, renderAtlasHomeHtml, renderAtlasSessionsHtml } from "../../src/atlas/renderer.ts";
import { handleAtlasOnboardingRequest } from "../../src/atlas/routes/onboarding.ts";
import type { AtlasSessionDto } from "../../src/atlas/state_bridge.ts";
import { readOpenTargetSessionState } from "../../src/core/target_session_state.ts";

interface ResponseCapture {
  readonly headersSent: boolean;
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

function buildSession(overrides: Partial<AtlasSessionDto> = {}): AtlasSessionDto {
  return {
    role: "quality-worker",
    name: "Quality lane",
    lane: "quality",
    resolvedRole: null,
    logicalRole: null,
    workerIdentityLabel: "Quality worker",
    status: "working",
    statusLabel: "In progress",
    readiness: "in_progress",
    readinessLabel: "In progress",
    currentStage: "snapshot_refresh",
    currentStageLabel: "Refreshing snapshot",
    lastTask: "Refresh the desktop workspace shell",
    lastActiveAt: "2026-04-25T09:00:00.000Z",
    latestMeaningfulAction: "Refreshed the desktop workspace shell",
    latestMeaningfulActionAt: "2026-04-25T09:00:00.000Z",
    recentActions: [{
      at: "2026-04-25T09:00:00.000Z",
      actor: "quality-worker",
      status: "working",
      statusLabel: "In progress",
      summary: "Refreshed the desktop workspace shell",
    }],
    historyLength: 2,
    lastThinking: "",
    currentBranch: "feat/atlas-workspace",
    pullRequests: ["https://example.com/pr/workspace"],
    pullRequestCount: 1,
    touchedFiles: ["src/atlas/renderer.ts"],
    touchedFileCount: 1,
    logExcerpt: ["workspace shell ready"],
    logSource: "live_worker_quality-worker.log",
    logUpdatedAt: "2026-04-25T09:01:00.000Z",
    freshnessAt: "2026-04-25T09:01:00.000Z",
    freshnessLabel: "Live snapshot ready",
    logStateLabel: "Readable log ready",
    needsInput: false,
    isResumable: true,
    isPaused: false,
    canArchive: false,
    ...overrides,
  };
}

function buildPageData(overrides: Partial<AtlasPageData> = {}): AtlasPageData {
  return {
    title: "ATLAS Home",
    repoLabel: "Ancora-Labs/ATLAS",
    hostLabel: "Windows host",
    shellCommand: ".\\ATLAS.cmd",
    pipelineStageLabel: "Workers Running",
    pipelineDetail: "Serving the ATLAS desktop workspace",
    pipelinePercent: 88,
    updatedAt: "2026-04-25T09:02:00.000Z",
    buildSessionId: "desktop-session-42",
    buildTimestamp: "2026-04-25T09:03:00.000Z",
    homeReadinessHeading: "Ready to resume",
    homeReadinessDetail: "Pick a tracked session from the left rail or write a new objective to start the next flow.",
    homePrimaryActionLabel: "Resume active session",
    sessionStartStatusLabel: "Session brief recorded",
    sessionStartStatusDetail: "The latest desktop brief is recorded and the workspace is continuing with live session state.",
    sessionStartUpdatedAt: "2026-04-25T09:01:30.000Z",
    continuityStatusLabel: "Live snapshot ready",
    continuityStatusDetail: "Focused detail, worker freshness, and readable logs are flowing from the latest desktop snapshot.",
    focusedSessionRole: "quality-worker",
    missingFocusedSnapshot: false,
    sessions: [buildSession()],
    ...overrides,
  };
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

function createJsonRequest(body: string, method = "POST"): IncomingMessage {
  return {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    setEncoding() {},
    on(event, handler) {
      if (event === "data") {
        handler(body);
      }
      if (event === "end") {
        handler();
      }
      return this;
    },
  } as unknown as IncomingMessage;
}

function createTempRoot(): Promise<string> {
  return fsPromises.mkdtemp(path.join(os.tmpdir(), "atlas-workspace-shell-"));
}

describe("atlas workspace shell", () => {
  it("renders one desktop workspace shell for both home and sessions aliases", () => {
    const homeHtml = renderAtlasHomeHtml(buildPageData());
    const sessionsHtml = renderAtlasSessionsHtml(buildPageData({ title: "ATLAS Sessions" }));

    for (const html of [homeHtml, sessionsHtml]) {
      assert.match(html, /aria-label="ATLAS desktop surface"/);
      assert.match(html, /aria-label="ATLAS desktop sidebar"/);
      assert.match(html, /aria-label="Chat-first workspace"/);
      assert.match(html, /data-role="session-rail"/);
      assert.match(html, /data-role="focused-session-panel"/);
      assert.match(html, /data-role="product-composer-input"/);
      assert.match(html, /Session brief recorded/);
      assert.match(html, /Live snapshot ready/);
      assert.match(html, /href="\/\?focusRole=quality-worker"/);
      assert.doesNotMatch(html, /href="\/sessions/);
    }
  });

  it("starts a desktop session directly through the onboarding compatibility endpoint", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      const request = createJsonRequest(JSON.stringify({
        objective: "Start the next ATLAS delivery session from the desktop workspace.",
      }));
      const response = createResponseCapture();

      await handleAtlasOnboardingRequest(request, response, {
        stateDir,
        sessionId: "desktop-session-42",
        targetRepo: "Ancora-Labs/ATLAS",
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, /"ready":true/);
      assert.match(response.body, /"started":true/);
      assert.match(response.body, /Start the next ATLAS delivery session from the desktop workspace\./);

      const packetPath = getAtlasClarificationPacketPath(stateDir, "desktop-session-42");
      const packet = JSON.parse(fs.readFileSync(packetPath, "utf8")) as {
        objective: string;
        summary: string;
        executionNotes: string[];
      };
      assert.equal(packet.objective, "Start the next ATLAS delivery session from the desktop workspace.");
      assert.equal(packet.summary, "Start the next ATLAS delivery session from the desktop workspace.");
      assert.deepEqual(packet.executionNotes, ["Desktop session started directly from the ATLAS workspace composer."]);
    } finally {
      await fsPromises.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] falls back to legacy worker sessions when canonical cycle artifacts are sparse", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      await fsPromises.mkdir(stateDir, { recursive: true });
      await fsPromises.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
        stage: "workers_running",
        stageLabel: "Workers Running",
        percent: 65,
        detail: "Recovering workspace continuity",
        steps: [],
        updatedAt: "2026-04-25T09:00:00.000Z",
        startedAt: "cycle-9",
      }), "utf8");
      await fsPromises.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({
        schemaVersion: 1,
        updatedAt: "2026-04-25T09:00:00.000Z",
        latestCycleId: "cycle-9",
        cycles: {
          "cycle-9": {
            cycleId: "cycle-9",
            updatedAt: "2026-04-25T09:00:00.000Z",
            status: "in_progress",
            workerSessions: {},
            workerActivity: {},
            completedTaskIds: [],
          },
        },
      }), "utf8");
      await fsPromises.writeFile(path.join(stateDir, "worker_sessions.json"), JSON.stringify({
        "quality-worker": {
          role: "quality-worker",
          status: "working",
          lastTask: "Recover the focused session detail",
          lastActiveAt: "2026-04-25T08:59:00.000Z",
        },
      }), "utf8");

      const state = await readOpenTargetSessionState({ stateDir });

      assert.equal(state.source, "legacy");
      assert.equal(state.canonicalSessionsAvailable, true);
      assert.deepEqual(Object.keys(state.sessions), ["quality-worker"]);
      assert.equal((state.sessions["quality-worker"] as { status?: string }).status, "working");
    } finally {
      await fsPromises.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
