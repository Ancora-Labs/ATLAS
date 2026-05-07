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
import { resolveAtlasDesktopShellCommand } from "../../electron/resource_paths.js";
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
    freshnessState: "live",
    freshnessLabel: "Live update within 5 minutes",
    freshnessPolicyDetail: "ATLAS verified a session update within the last 5 minutes.",
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
    repoContext: {
      provider: "github",
      targetRepo: "Ancora-Labs/ATLAS",
      targetBaseBranch: "main",
      repoMode: "existing",
      repoCreatedByAtlas: false,
    },
    hostLabel: "Windows host",
    shellCommand: ".\\ATLAS.cmd",
    updatedAt: "2026-04-25T00:00:00.000Z",
    buildSessionId: "desktop-session-9",
    buildTimestamp: "2026-04-25T00:05:00.000Z",
    homeReadinessHeading: "Live sessions available",
    homeReadinessDetail: "Pick a tracked session from the left rail to inspect it, or stay on the blank start screen and write the next objective.",
    homePrimaryActionLabel: "New Session",
    sessionStartStatusLabel: "Stored session brief",
    sessionStartStatusDetail: "ATLAS keeps the most recent desktop brief for recovery, but the brief is never treated as current live worker state.",
    sessionStartUpdatedAt: "2026-04-25T00:04:00.000Z",
    continuityStatusLabel: "Live detail verified",
    continuityStatusDetail: "Every visible session has a verified live update within the current freshness policy window.",
    mainPaneMode: "selected-session",
    focusedSessionId: "quality-worker",
    missingFocusedSnapshot: false,
    runtimeSnapshot: null,
    githubAuth: {
      accountLogin: "dogducaner66-byte",
      githubTokenConfigured: true,
      copilotTokenConfigured: true,
      authRequired: false,
      source: "env",
    },
    copilotUsage: {
      planTier: "pro",
      planLabel: "Copilot Pro",
      modelAccess: "current",
      planDetectedBy: "field",
      source: "test-fixture",
      rawPlan: "pro",
      entitlement: null,
      usedRequests: 269,
      remainingRequests: 731,
      percentRemaining: 73.1,
    },
    authRequired: false,
    maxTrackedSessions: 3,
    activeSessionCount: 1,
    completedSessionCount: 0,
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
      assert.match(html, /Tracked session/i);
      assert.match(html, /data-role="chat-form"|data-role="project-context-row-host"/);
    }

    assert.match(homeMarkup, /premium shell regression locked/);
    assert.match(homeMarkup, /data-role="chat-form"/);
    assert.match(homeMarkup, /Workspace settings/);
    assert.match(sessionsMarkup, /data-role="chat-form"|Tracked session/);
  });

  it("keeps sparse-state rendering and portable packaging guarantees deterministic", async () => {
    const homeHtml = renderAtlasHomeHtml(buildPageData({
      sessions: [],
      focusedSessionId: null,
      homeReadinessHeading: "Ready to start",
      homeReadinessDetail: "Write one outcome in the blank start screen composer to start the next session from the main workspace.",
      homePrimaryActionLabel: "New Session",
      mainPaneMode: "new-session",
    }));
    const homeMarkup = homeHtml.split("<script>")[0] || homeHtml;
    const layout = createAtlasDesktopPackageLayout(path.join("C:", "ATLAS Release Root"));
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    assert.match(homeMarkup, /No live rows yet\./);
    assert.match(homeMarkup, /What do you want Atlas to deliver today\?/);
    assert.match(homeMarkup, /data-role="chat-form"/);
    assert.equal(layout.portableRoot, path.join("C:", "ATLAS Release Root", "dist", "ATLAS"));
    assert.equal(layout.portableExePath, path.join("C:", "ATLAS Release Root", "dist", "ATLAS", "ATLAS.exe"));
    assert.equal(
      packageJson.scripts?.["atlas:desktop:package"],
      "npm run atlas:desktop:build && node --import tsx scripts/package_atlas_desktop_folder.ts",
    );
    assert.equal(fs.existsSync(path.join(process.cwd(), "ATLAS.cmd")), false);
    assert.equal(
      resolveAtlasDesktopShellCommand({
        isPackaged: true,
        exePath: layout.portableExePath,
      }),
      path.join(".", "ATLAS.exe"),
    );
  });

  it("[NEGATIVE] reports workspace session brief failures without minting a desktop session or fake shell state", async () => {
    const tempRoot = await createTempRoot();

    try {
      const missingSessionRequest = createJsonRequest(JSON.stringify({
        objective: "Try to onboard without a desktop session.",
      }));
      const missingSessionResponse = createResponseCapture();

      await handleAtlasOnboardingRequest(missingSessionRequest, missingSessionResponse, {
        stateDir: path.join(tempRoot, "state"),
        sessionId: "desktop-session-negative",
      });

      assert.equal(missingSessionResponse.statusCode, 400);
      assert.match(missingSessionResponse.body, /"code":"missing_repo_context"/);

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
