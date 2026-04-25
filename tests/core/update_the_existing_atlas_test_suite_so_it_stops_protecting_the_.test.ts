import assert from "node:assert/strict";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import { handleAtlasOnboardingRequest } from "../../src/atlas/routes/onboarding.ts";
import {
  renderAtlasHomeHtml,
  renderAtlasSessionsHtml,
  type AtlasPageData,
} from "../../src/atlas/renderer.ts";
import { createAtlasDesktopPackageLayout } from "../../scripts/atlas_desktop_package.ts";
import type { AtlasSessionDto } from "../../src/atlas/state_bridge.ts";

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
    workerIdentityLabel: "quality-worker",
    status: "working",
    statusLabel: "In progress",
    readiness: "in_progress",
    readinessLabel: "In progress",
    currentStage: "locking_regression_baseline",
    currentStageLabel: "Locking regression baseline",
    lastTask: "Lock the premium desktop regression baseline.",
    lastActiveAt: "2026-04-25T00:00:00.000Z",
    latestMeaningfulAction: "Locked the premium desktop regression baseline.",
    latestMeaningfulActionAt: "2026-04-25T00:00:00.000Z",
    recentActions: [{
      at: "2026-04-25T00:00:00.000Z",
      actor: "quality-worker",
      status: "working",
      statusLabel: "In progress",
      summary: "Locked the premium desktop regression baseline.",
    }],
    historyLength: 2,
    lastThinking: "",
    currentBranch: "feat/premium-desktop-tests",
    pullRequests: ["https://example.com/pr/premium-desktop"],
    pullRequestCount: 1,
    touchedFiles: ["tests/atlas/renderer.test.ts"],
    touchedFileCount: 1,
    logExcerpt: ["premium shell regression locked"],
    logSource: "live_worker_quality-worker.log",
    logUpdatedAt: "2026-04-25T00:01:00.000Z",
    freshnessAt: "2026-04-25T00:01:00.000Z",
    freshnessLabel: "Live update recorded",
    logStateLabel: "Readable log ready",
    liveStatusTone: "active",
    liveStatusLabel: "Live",
    liveStatusAssistiveText: "Quality lane is currently running live work.",
    liveStatusPulse: true,
    needsInput: false,
    isResumable: true,
    isPaused: false,
    canArchive: false,
    ...overrides,
  };
}

function buildPageData(overrides: Partial<AtlasPageData> = {}): AtlasPageData {
  return {
    title: "ATLAS Workspace",
    repoLabel: "Ancora-Labs/ATLAS",
    hostLabel: "Windows host",
    shellCommand: ".\\ATLAS.cmd",
    pipelineStageLabel: "Workers Running",
    pipelineDetail: "Delivering the ATLAS desktop shell",
    pipelinePercent: 87,
    updatedAt: "2026-04-25T00:00:00.000Z",
    buildSessionId: "desktop-session-9",
    buildTimestamp: "2026-04-25T00:05:00.000Z",
    homeReadinessHeading: "Live sessions available",
    homeReadinessDetail: "Pick a tracked session from the left rail to inspect it, or stay on the blank start screen and write the next objective.",
    homePrimaryActionLabel: "New Session",
    sessionStartStatusLabel: "Session brief recorded",
    sessionStartStatusDetail: "The latest desktop brief is recorded and the workspace is continuing with live session state.",
    sessionStartUpdatedAt: "2026-04-25T00:04:00.000Z",
    continuityStatusLabel: "Live detail available",
    continuityStatusDetail: "Select any session from the left rail to open its live detail view in the main pane.",
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
  return fsPromises.mkdtemp(path.join(os.tmpdir(), "atlas-premium-desktop-"));
}

describe("update the existing atlas test suite so it stops protecting the old shell", () => {
  it("pins the premium desktop sidebar, main canvas, and composer hierarchy instead of the old dashboard shell", () => {
    const homeHtml = renderAtlasHomeHtml(buildPageData());
    const sessionsHtml = renderAtlasSessionsHtml(buildPageData());
    const homeMarkup = homeHtml.split("<script>")[0] || homeHtml;
    const sessionsMarkup = sessionsHtml.split("<script>")[0] || sessionsHtml;

    for (const html of [homeMarkup, sessionsMarkup]) {
      assert.match(html, /aria-label="ATLAS desktop surface"/);
      assert.match(html, /aria-label="ATLAS work canvas"/);
      assert.match(html, /data-role="session-rail"/);
      assert.doesNotMatch(html, /dashboard-card|hero-panel|metric-card|window-controls|traffic-light/i);
    }

    assert.match(homeMarkup, /data-role="selected-session-view"/);
    assert.match(homeMarkup, /premium shell regression locked/);
    assert.match(homeHtml, /bridge\?\.refreshSnapshot/);
    assert.match(homeHtml, /ATLAS snapshot refresh requires the Electron desktop bridge\./);
    assert.match(sessionsMarkup, /Pause lane/);
    assert.match(sessionsMarkup, /data-role="selected-session-status-light"/);
  });

  it("keeps sparse-state rendering and portable packaging guarantees deterministic", async () => {
    const homeHtml = renderAtlasHomeHtml(buildPageData({
      sessions: [],
      focusedSessionRole: null,
      homeReadinessHeading: "Ready to start",
      homeReadinessDetail: "Write one outcome in the blank start screen composer to start the next session from the main workspace.",
      homePrimaryActionLabel: "New Session",
    }));
    const homeMarkup = homeHtml.split("<script>")[0] || homeHtml;
    const layout = createAtlasDesktopPackageLayout(path.join("C:", "ATLAS Release Root"));
    const atlasCmd = fs.readFileSync(path.join(process.cwd(), "ATLAS.cmd"), "utf8");
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    assert.match(homeMarkup, /No session state is available yet\./);
    assert.match(homeMarkup, /Where should ATLAS start\?/);
    assert.match(homeMarkup, /data-has-live-sessions="false"/);
    assert.equal(layout.portableRoot, path.join("C:", "ATLAS Release Root", "dist", "ATLAS"));
    assert.equal(layout.portableExePath, path.join("C:", "ATLAS Release Root", "dist", "ATLAS", "ATLAS.exe"));
    assert.equal(packageJson.scripts?.["atlas:desktop:package"], "node --import tsx scripts/atlas_desktop_package.ts");
    assert.match(atlasCmd, /Packaging the portable Windows desktop folder/i);
  });

  it("[NEGATIVE] reports onboarding failures without minting a desktop session or fake shell state", async () => {
    const tempRoot = await createTempRoot();

    try {
      const missingSessionRequest = createJsonRequest(JSON.stringify({
        objective: "Try to onboard without a desktop session.",
      }));
      const missingSessionResponse = createResponseCapture();

      await handleAtlasOnboardingRequest(missingSessionRequest, missingSessionResponse, {
        stateDir: path.join(tempRoot, "state"),
      });

      assert.equal(missingSessionResponse.statusCode, 409);
      assert.match(missingSessionResponse.body, /"code":"desktop_session_missing"/);

      const failedRunnerRequest = createJsonRequest(JSON.stringify({
        objective: "   ",
      }));
      const failedRunnerResponse = createResponseCapture();

      await handleAtlasOnboardingRequest(failedRunnerRequest, failedRunnerResponse, {
        stateDir: path.join(tempRoot, "state"),
        sessionId: "desktop-session-negative",
        targetRepo: "Ancora-Labs/ATLAS",
      });

      assert.equal(failedRunnerResponse.statusCode, 400);
      assert.match(failedRunnerResponse.body, /"code":"missing_objective"/);
      assert.equal(
        fs.existsSync(path.join(tempRoot, "state", "atlas", "desktop_sessions", "desktop-session-negative", "clarification_packet.json")),
        false,
      );
    } finally {
      await fsPromises.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
