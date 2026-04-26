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
    role: "Athena",
    name: "Athena",
    lane: "review",
    resolvedRole: null,
    logicalRole: null,
    workerIdentityLabel: "Athena",
    status: "working",
    statusLabel: "In progress",
    readiness: "in_progress",
    readinessLabel: "In progress",
    currentStage: "validating_contract",
    currentStageLabel: "Validating contract",
    lastTask: "Validate the ATLAS contract",
    lastActiveAt: "2026-04-21T12:00:00.000Z",
    latestMeaningfulAction: "Validated the focused workspace contract",
    latestMeaningfulActionAt: "2026-04-21T12:00:00.000Z",
    recentActions: [
      {
        at: "2026-04-21T12:00:00.000Z",
        actor: "Athena",
        status: "working",
        statusLabel: "In progress",
        summary: "Validated the focused workspace contract",
      },
    ],
    historyLength: 2,
    lastThinking: "",
    currentBranch: "feat/atlas-home",
    pullRequests: ["https://example.com/pr/1"],
    pullRequestCount: 1,
    touchedFiles: ["src/atlas/renderer.ts", "tests/atlas/renderer.test.ts"],
    touchedFileCount: 2,
    logExcerpt: ["validated session snapshot", "focused panel refreshed"],
    logSource: "live_worker_athena.log",
    logUpdatedAt: "2026-04-21T12:01:00.000Z",
    freshnessAt: "2026-04-21T12:01:00.000Z",
    freshnessState: "live",
    freshnessLabel: "Live update within 5 minutes",
    freshnessPolicyDetail: "ATLAS verified a session update within the last 5 minutes.",
    logStateLabel: "Readable log ready",
    liveStatusTone: "active",
    liveStatusLabel: "Live",
    liveStatusAssistiveText: "Athena is currently running live work.",
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
    pipelinePercent: 85,
    updatedAt: "2026-04-21T12:00:00.000Z",
    buildSessionId: "desktop-session-7",
    buildTimestamp: "2026-04-21T12:05:00.000Z",
    homeReadinessHeading: "Live sessions available",
    homeReadinessDetail: "Pick a tracked session from the left rail to inspect it, or stay on the blank start screen and write the next objective.",
    homePrimaryActionLabel: "New Session",
    sessionStartStatusLabel: "Stored session brief",
    sessionStartStatusDetail: "ATLAS keeps the most recent desktop brief for recovery, but the brief is never treated as current live worker state.",
    sessionStartUpdatedAt: "2026-04-21T12:04:00.000Z",
    continuityStatusLabel: "Live detail verified",
    continuityStatusDetail: "Every visible session has a verified live update within the current freshness policy window.",
    mainPaneMode: "new-session",
    focusedSessionRole: null,
    missingFocusedSnapshot: false,
    sessions: [
      buildSession(),
      buildSession({
        role: "Prometheus",
        name: "Prometheus",
        lane: null,
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
        currentBranch: "feat/atlas-plan",
        pullRequests: [],
        pullRequestCount: 0,
        touchedFiles: ["src/atlas/routes/home.ts"],
        touchedFileCount: 1,
        logExcerpt: ["waiting on route review"],
        logSource: "live_worker_prometheus.log",
        logUpdatedAt: "2026-04-21T11:46:00.000Z",
        freshnessAt: "2026-04-21T11:46:00.000Z",
        freshnessState: "stale",
        freshnessLabel: "Live update stale",
        freshnessPolicyDetail: "The latest session update is older than 5 minutes, so ATLAS keeps it visible as stale context instead of current live state.",
        logStateLabel: "Readable log ready",
        liveStatusTone: "attention",
        liveStatusLabel: "Needs attention",
        liveStatusAssistiveText: "Prometheus needs attention before it can continue.",
        liveStatusPulse: false,
        needsInput: true,
        isPaused: false,
        canArchive: true,
      }),
    ],
    ...overrides,
  };
}

describe("atlas renderer", () => {
  it("renders the blank new-session start screen when no session is selected", () => {
    const html = renderAtlasHomeHtml(buildPageData());
    const documentMarkup = html.split("<script>")[0] || html;

    assert.match(html, /<title>ATLAS Workspace<\/title>/);
    assert.match(documentMarkup, /aria-label="ATLAS desktop surface"/);
    assert.match(documentMarkup, /data-main-pane-mode="new-session"/);
    assert.match(documentMarkup, /aria-label="ATLAS desktop sidebar"/);
    assert.match(documentMarkup, /data-role="brand-reset"/);
    assert.match(documentMarkup, /data-role="new-session-link"/);
    assert.match(documentMarkup, /data-role="session-rail"/);
    assert.match(documentMarkup, /href="\/" data-role="brand-reset"/);
    assert.match(documentMarkup, /href="\/"[\s\S]*?data-role="new-session-link"/);
    assert.match(documentMarkup, /href="\/\?focusRole=Athena"[\s\S]*?data-session-role="Athena"/);
    assert.match(documentMarkup, /href="\/\?focusRole=Prometheus"[\s\S]*?data-session-role="Prometheus"/);
    assert.match(documentMarkup, /data-role="new-session-view"/);
    assert.match(documentMarkup, /Start a new session from a clean workspace/);
    assert.match(documentMarkup, /What should ATLAS do next\?/);
    assert.match(documentMarkup, /data-role="product-composer-input"/);
    assert.match(documentMarkup, /data-role="runtime-stage-label"/);
    assert.match(documentMarkup, /data-role="session-row-status-light"/);
    assert.match(documentMarkup, /Live detail verified/);
    assert.match(html, /bridge\?\.refreshSnapshot/);
    assert.match(html, /ATLAS snapshot refresh requires the Electron desktop bridge\./);
    assert.doesNotMatch(documentMarkup, /data-role="selected-session-view"/);
    assert.doesNotMatch(documentMarkup, /dashboard|window-controls|traffic-light|hero-panel/i);
  });

  it("renders the selected session as the dominant right-hand detail view", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      mainPaneMode: "selected-session",
      focusedSessionRole: "Athena",
    }));
    const documentMarkup = html.split("<script>")[0] || html;

    assert.match(documentMarkup, /data-role="selected-session-view"/);
    assert.match(documentMarkup, /data-main-pane-mode="selected-session"/);
    assert.match(documentMarkup, /data-role="selected-session-name">Athena/);
    assert.match(documentMarkup, /data-role="selected-session-status-light"/);
    assert.match(documentMarkup, /live-status-active[\s\S]*?data-role="selected-session-status-light"/);
    assert.match(documentMarkup, /live-status-pulse/);
    assert.match(documentMarkup, /aria-label="Athena is currently running live work\."/);
    assert.match(documentMarkup, /data-role="selected-session-identity"/);
    assert.match(documentMarkup, /data-role="selected-session-stage"/);
    assert.match(documentMarkup, /data-role="selected-session-prs"/);
    assert.match(documentMarkup, /data-role="selected-session-files"/);
    assert.match(documentMarkup, /data-role="selected-session-log"/);
    assert.match(documentMarkup, /data-role="selected-session-actions"/);
    assert.match(documentMarkup, /New Session/);
    assert.match(documentMarkup, /Pause lane/);
    assert.match(documentMarkup, /feat\/atlas-home/);
    assert.match(documentMarkup, /https:\/\/example\.com\/pr\/1/);
    assert.match(documentMarkup, /focused panel refreshed/);
    assert.match(documentMarkup, /href="\/"[\s\S]*?data-role="new-session-link"/);
    assert.match(documentMarkup, /data-role="selected-session-actions"[\s\S]*?<a class="action-button primary" href="\/">New Session<\/a>/);
    assert.match(documentMarkup, /live-status-attention[\s\S]*?data-role="session-row-status-light"/);
    assert.match(documentMarkup, /aria-label="Prometheus needs attention before it can continue\."/);
    assert.doesNotMatch(documentMarkup, /data-role="product-composer-input"/);
    assert.doesNotMatch(documentMarkup, /Inline session ledger|Runtime status|dashboard/i);
  });

  it("[NEGATIVE] keeps the blank workspace stable when there are no live sessions", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      repoLabel: "<unsafe repo>",
      sessions: [],
      mainPaneMode: "new-session",
      focusedSessionRole: null,
      sessionStartStatusLabel: "Ready for first session",
      sessionStartStatusDetail: "Start a session from the blank workspace composer to seed the first live workflow.",
      continuityStatusLabel: "Waiting for live detail",
      continuityStatusDetail: "ATLAS will open selected-session detail as soon as the next tracked session snapshot is written.",
    }));
    const documentMarkup = html.split("<script>")[0] || html;

    assert.match(documentMarkup, /&lt;unsafe repo&gt;/);
    assert.doesNotMatch(documentMarkup, /<unsafe repo>/);
    assert.match(documentMarkup, /Where should ATLAS start\?/);
    assert.match(documentMarkup, /No session state is available yet\./);
    assert.match(documentMarkup, /data-role="new-session-view"/);
    assert.match(documentMarkup, /data-main-pane-mode="new-session"/);
    assert.doesNotMatch(documentMarkup, /data-role="selected-session-view"/);
  });

  it("falls back to the blank start screen when the saved focus is missing from the live snapshot", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      focusedSessionRole: null,
      mainPaneMode: "new-session",
      missingFocusedSnapshot: true,
      continuityStatusLabel: "Selected detail unavailable",
      continuityStatusDetail: "The saved focus is not present in the current live snapshot, so ATLAS falls back to the blank new-session view instead of showing stale detail.",
    }));
    const documentMarkup = html.split("<script>")[0] || html;

    assert.match(documentMarkup, /The selected session is waiting for its next live update/);
    assert.match(documentMarkup, /data-main-pane-mode="new-session"/);
    assert.match(documentMarkup, /Selected detail unavailable/);
    assert.match(documentMarkup, /falls back to the blank new-session view instead of showing stale detail/);
    assert.doesNotMatch(documentMarkup, /data-role="selected-session-view"/);
  });
});
