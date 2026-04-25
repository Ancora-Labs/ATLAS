import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  renderAtlasHomeHtml,
  renderAtlasSessionsHtml,
  type AtlasPageData,
} from "../../src/atlas/renderer.ts";
import type { AtlasSessionDto } from "../../src/atlas/state_bridge.ts";

function buildSession(overrides: Partial<AtlasSessionDto> = {}): AtlasSessionDto {
  return {
    role: "Prometheus",
    name: "Prometheus",
    lane: "planning",
    resolvedRole: null,
    logicalRole: null,
    workerIdentityLabel: "Prometheus",
    status: "blocked",
    statusLabel: "Needs attention",
    readiness: "action_needed",
    readinessLabel: "Needs your input",
    currentStage: "waiting_review",
    currentStageLabel: "Waiting for review",
    lastTask: "Waiting for route review",
    lastActiveAt: "2026-04-21T11:45:00.000Z",
    latestMeaningfulAction: "Waiting for route review",
    latestMeaningfulActionAt: "2026-04-21T11:45:00.000Z",
    recentActions: [{
      at: "2026-04-21T11:45:00.000Z",
      actor: "Prometheus",
      status: "blocked",
      statusLabel: "Needs attention",
      summary: "Waiting for route review",
    }],
    historyLength: 3,
    lastThinking: "",
    currentBranch: "feat/atlas-plan",
    pullRequests: [],
    pullRequestCount: 0,
    touchedFiles: ["src/atlas/routes/sessions.ts"],
    touchedFileCount: 1,
    logExcerpt: ["waiting on route review"],
    logSource: "live_worker_prometheus.log",
    logUpdatedAt: "2026-04-21T11:46:00.000Z",
    freshnessAt: "2026-04-21T11:46:00.000Z",
    freshnessLabel: "Live update recorded",
    logStateLabel: "Readable log ready",
    liveStatusTone: "attention",
    liveStatusLabel: "Needs attention",
    liveStatusAssistiveText: "Prometheus needs attention before it can continue.",
    liveStatusPulse: false,
    needsInput: true,
    isResumable: true,
    isPaused: false,
    canArchive: true,
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
    pipelinePercent: 85,
    updatedAt: "2026-04-21T12:00:00.000Z",
    buildSessionId: "desktop-session-7",
    buildTimestamp: "2026-04-21T12:05:00.000Z",
    homeReadinessHeading: "Live sessions available",
    homeReadinessDetail: "Pick a tracked session from the left rail to inspect it, or stay on the blank start screen and write the next objective.",
    homePrimaryActionLabel: "New Session",
    sessionStartStatusLabel: "Session brief recorded",
    sessionStartStatusDetail: "The latest desktop brief is recorded and the workspace is continuing with live session state.",
    sessionStartUpdatedAt: "2026-04-21T12:04:00.000Z",
    continuityStatusLabel: "Live detail available",
    continuityStatusDetail: "Select any session from the left rail to open its live detail view in the main pane.",
    focusedSessionRole: "Prometheus",
    missingFocusedSnapshot: false,
    sessions: [
      buildSession({
        role: "Athena",
        name: "Athena",
        lane: "review",
        status: "working",
        statusLabel: "In progress",
        readiness: "in_progress",
        readinessLabel: "In progress",
        currentStage: "validating_contract",
        currentStageLabel: "Validating contract",
        lastTask: "Validate the ATLAS contract",
        lastActiveAt: "2026-04-21T12:00:00.000Z",
        latestMeaningfulAction: "Validated the ATLAS contract",
        latestMeaningfulActionAt: "2026-04-21T12:00:00.000Z",
        recentActions: [{
          at: "2026-04-21T12:00:00.000Z",
          actor: "Athena",
          status: "working",
          statusLabel: "In progress",
          summary: "Validated the ATLAS contract",
        }],
        currentBranch: "feat/atlas-home",
        pullRequests: ["https://example.com/pr/1"],
        pullRequestCount: 1,
        touchedFiles: ["src/atlas/renderer.ts"],
        touchedFileCount: 1,
        logExcerpt: ["validated home shell"],
        logSource: "live_worker_athena.log",
        logUpdatedAt: "2026-04-21T12:01:00.000Z",
        freshnessAt: "2026-04-21T12:01:00.000Z",
        needsInput: false,
        canArchive: false,
      }),
      buildSession(),
      buildSession({
        role: "Hermes",
        name: "Hermes",
        lane: null,
        status: "done",
        statusLabel: "Completed",
        readiness: "completed",
        readinessLabel: "Completed",
        currentStage: "done",
        currentStageLabel: "Completed",
        lastTask: "Closed the last session",
        lastActiveAt: "2026-04-21T11:30:00.000Z",
        latestMeaningfulAction: "Closed the last session",
        latestMeaningfulActionAt: "2026-04-21T11:30:00.000Z",
        recentActions: [{
          at: "2026-04-21T11:30:00.000Z",
          actor: "Hermes",
          status: "done",
          statusLabel: "Completed",
          summary: "Closed the last session",
        }],
        currentBranch: null,
        pullRequests: ["https://example.com/pr/2"],
        pullRequestCount: 1,
        touchedFiles: ["src/atlas/server.ts"],
        touchedFileCount: 1,
        logExcerpt: ["session closed cleanly"],
        logSource: "live_worker_hermes.log",
        logUpdatedAt: "2026-04-21T11:31:00.000Z",
        freshnessAt: "2026-04-21T11:31:00.000Z",
        needsInput: false,
        isResumable: false,
      }),
    ],
    ...overrides,
  };
}

describe("atlas desktop shell refactor", () => {
  it("renders home inside one desktop shell with a persistent sidebar and inline focused detail", () => {
    const html = renderAtlasHomeHtml(buildPageData());
    const documentMarkup = html.split("<script>")[0] || html;

    assert.match(documentMarkup, /aria-label="ATLAS desktop sidebar"/);
    assert.match(documentMarkup, /aria-label="ATLAS work canvas"/);
    assert.match(documentMarkup, /data-role="selected-session-view"/);
    assert.match(documentMarkup, /Worker identity|data-role="selected-session-identity"/);
    assert.match(documentMarkup, /Latest worker output/);
    assert.match(documentMarkup, /Prometheus/);
    assert.match(documentMarkup, /data-role="session-rail"/);
    assert.match(documentMarkup, /position: sticky/);
    assert.doesNotMatch(documentMarkup, /hero-panel|metric-card|dashboard/i);
  });

  it("renders sessions inside the same shell while preserving focus-aware lifecycle actions", () => {
    const html = renderAtlasSessionsHtml(buildPageData());
    const documentMarkup = html.split("<script>")[0] || html;

    assert.match(documentMarkup, /<title>ATLAS Workspace<\/title>/);
    assert.match(documentMarkup, /data-role="selected-session-view"/);
    assert.match(documentMarkup, /method="post" action="\/lifecycle"/);
    assert.match(documentMarkup, /Archive session/);
    assert.match(documentMarkup, /Pause lane/);
    assert.match(documentMarkup, /Athena/);
    assert.match(documentMarkup, /Prometheus/);
    assert.match(documentMarkup, /Hermes/);
    assert.doesNotMatch(documentMarkup, /data-role="product-composer-input"/);
    assert.doesNotMatch(documentMarkup, /hero-panel|metric-card|dashboard/i);
  });

  it("[NEGATIVE] keeps the shell stable with no live sessions and escapes unsafe content", () => {
    const html = renderAtlasHomeHtml(buildPageData({
      sessions: [],
      repoLabel: "<unsafe repo>",
      shellCommand: "<script>alert(1)</script>",
      focusedSessionRole: null,
      homeReadinessHeading: "Ready to start",
      homeReadinessDetail: "Write one outcome in the blank start screen composer to start the next session from the main workspace.",
      homePrimaryActionLabel: "New Session",
    }));
    const documentMarkup = html.split("<script>")[0] || html;

    assert.match(documentMarkup, /No session state is available yet\./);
    assert.match(documentMarkup, /Where should ATLAS start\?/);
    assert.match(documentMarkup, /data-role="product-composer-input"/);
    assert.doesNotMatch(documentMarkup, /<unsafe repo>|<script>alert\(1\)<\/script>/);
  });
});
