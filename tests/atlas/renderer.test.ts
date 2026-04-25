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
    pipelineDetail: "Delivering the ATLAS desktop shell",
    pipelinePercent: 85,
    updatedAt: "2026-04-21T12:00:00.000Z",
    buildSessionId: "desktop-session-7",
    buildTimestamp: "2026-04-21T12:05:00.000Z",
    homeReadinessHeading: "Ready to resume",
    homeReadinessDetail: "One or more roles can continue from their recorded state.",
    homePrimaryActionLabel: "Resume session flow",
    focusedSessionRole: "Athena",
    missingFocusedSnapshot: false,
    sessions: [
      buildSession(),
      buildSession({
        role: "Prometheus",
        name: "Prometheus",
        lane: null,
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
        needsInput: true,
        isPaused: false,
        canArchive: true,
      }),
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
        historyLength: 4,
        currentBranch: null,
        pullRequests: ["https://example.com/pr/2", "https://example.com/pr/3"],
        pullRequestCount: 2,
        touchedFiles: [
          "src/atlas/server.ts",
          "src/atlas/routes/sessions.ts",
          "tests/atlas/server.test.ts",
        ],
        touchedFileCount: 3,
        logExcerpt: ["session archived cleanly"],
        logSource: "live_worker_hermes.log",
        logUpdatedAt: "2026-04-21T11:31:00.000Z",
        freshnessAt: "2026-04-21T11:31:00.000Z",
        needsInput: false,
        isResumable: false,
        isPaused: false,
        canArchive: true,
      }),
    ],
    ...overrides,
  };
}

describe("atlas renderer", () => {
  it("renders the home surface as a single workspace with inline focused session detail", () => {
    const html = renderAtlasHomeHtml(buildPageData());

    assert.match(html, /<title>ATLAS Home<\/title>/);
    assert.match(html, /aria-label="ATLAS desktop surface"/);
    assert.match(html, /aria-label="ATLAS session sidebar"/);
    assert.match(html, /aria-label="ATLAS work canvas"/);
    assert.match(html, /aria-label="Chat-first workspace"/);
    assert.match(html, /What should ATLAS do next\?/);
    assert.match(html, /Focused session detail/);
    assert.match(html, /Worker identity/);
    assert.match(html, /Validating contract/);
    assert.match(html, /live_worker_athena\.log/);
    assert.match(html, /focused panel refreshed/);
    assert.match(html, /https:\/\/example\.com\/pr\/1/);
    assert.match(html, /src\/atlas\/renderer\.ts/);
    assert.match(html, /data-role="session-rail"/);
    assert.match(html, /data-role="focused-session-panel"/);
    assert.match(html, /data-role="focused-session-identity"/);
    assert.match(html, /data-role="focused-session-stage-detail"/);
    assert.match(html, /data-role="focused-session-prs"/);
    assert.match(html, /data-role="focused-session-files"/);
    assert.match(html, /data-role="focused-session-freshness"/);
    assert.match(html, /data-role="focused-session-log"/);
    assert.match(html, /data-view="home"/);
    assert.match(html, /data-role="product-composer-input"/);
    assert.match(html, /bridge\?\.getSnapshot/);
    assert.match(html, /window\.fetch\(snapshotPath \+ "\?" \+ params\.toString\(\)/);
    assert.match(html, /\/api\/atlas\/snapshot/);
    assert.match(html, /window\.setInterval/);
    assert.match(html, /setProductDraft/);
    assert.match(html, /setProductComposerFocus/);
    assert.match(html, /submitClarification/);
    assert.doesNotMatch(html, /hero-panel|metric-card|dashboard|window-controls|traffic-light/i);
  });

  it("renders the sessions surface with runtime status, focused detail, and lifecycle actions", () => {
    const html = renderAtlasSessionsHtml(buildPageData({ title: "ATLAS Sessions" }));

    assert.match(html, /<title>ATLAS Sessions<\/title>/);
    assert.match(html, /aria-label="ATLAS desktop sidebar"/);
    assert.match(html, /Runtime status/);
    assert.match(html, /data-role="runtime-stage-label"/);
    assert.match(html, /Workers Running/);
    assert.match(html, /Trust-first work ledger/);
    assert.match(html, /Focused session detail/);
    assert.match(html, /Readable log excerpt/);
    assert.match(html, /feat\/atlas-home/);
    assert.match(html, />3 tracked sessions</);
    assert.match(html, />2 resumable</);
    assert.match(html, />1 needing input</);
    assert.match(html, />0 paused lanes</);
    assert.match(html, />Pause lane</);
    assert.match(html, />Archive session</);
    assert.match(html, /method="post" action="\/lifecycle"/);
    assert.match(html, /data-role="runtime-count-total"/);
    assert.match(html, /data-role="runtime-progress-bar"/);
    assert.match(html, /data-role="session-rail"/);
    assert.match(html, /data-role="focused-session-pr-count"/);
    assert.match(html, /data-role="focused-session-log-freshness"/);
    assert.doesNotMatch(html, /hero-panel|BOX Mission Control|dashboard|window-controls|traffic-light/i);
  });

  it("[NEGATIVE] escapes dynamic values and keeps empty workspace states stable", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      title: "ATLAS Sessions",
      repoLabel: "<unsafe repo>",
      sessions: [],
      focusedSessionRole: null,
    }));
    const homeHtml = renderAtlasHomeHtml(buildPageData({
      sessions: [],
      focusedSessionRole: null,
    }));

    assert.match(html, /&lt;unsafe repo&gt;/);
    assert.doesNotMatch(html, /<unsafe repo>/);
    assert.match(html, /No session state is available yet\./);
    assert.match(homeHtml, /Where should we start\?/);
    assert.match(homeHtml, /No live session focus yet/);
    assert.match(homeHtml, /data-has-live-sessions="false"/);
    assert.doesNotMatch(homeHtml, /dashboard|window-controls|traffic-light/i);
  });

  it("shows degraded composer continuity when the saved focus has no live snapshot yet", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      title: "ATLAS Sessions",
      missingFocusedSnapshot: true,
    }));

    assert.match(html, /Start the next session while the old focus recovers/);
    assert.match(html, /The previous focus is missing its next live snapshot, but you can still write the next outcome here and keep the workspace moving\./);
    assert.match(html, /data-missing-focused-snapshot="true"/);
    assert.match(html, />Clear focus</);
  });
});
