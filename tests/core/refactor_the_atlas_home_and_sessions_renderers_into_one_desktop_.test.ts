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
    freshnessLabel: "Live snapshot ready",
    logStateLabel: "Readable log ready",
    needsInput: true,
    isResumable: true,
    isPaused: false,
    canArchive: true,
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
    sessionStartStatusLabel: "Session brief recorded",
    sessionStartStatusDetail: "The latest desktop brief is recorded and the workspace is continuing with live session state.",
    sessionStartUpdatedAt: "2026-04-21T12:04:00.000Z",
    continuityStatusLabel: "Live snapshot ready",
    continuityStatusDetail: "Focused detail, worker freshness, and readable logs are flowing from the latest desktop snapshot.",
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

    assert.match(html, /aria-label="ATLAS desktop sidebar"/);
    assert.match(html, /aria-label="ATLAS work canvas"/);
    assert.match(html, /aria-label="Desktop composer"/);
    assert.match(html, /Focused session detail/);
    assert.match(html, /Worker identity/);
    assert.match(html, /Readable log excerpt/);
    assert.match(html, /What should ATLAS do next\?/);
    assert.match(html, /data-role="session-rail"/);
    assert.match(html, /position: sticky/);
    assert.doesNotMatch(html, /hero-panel|metric-card|dashboard/i);
  });

  it("renders sessions inside the same shell while preserving focus-aware lifecycle actions", () => {
    const html = renderAtlasSessionsHtml(buildPageData({ title: "ATLAS Sessions" }));

    assert.match(html, /<title>ATLAS Sessions<\/title>/);
    assert.match(html, /Desktop workspace/);
    assert.match(html, /Focused session detail/);
    assert.match(html, /method="post" action="\/lifecycle"/);
    assert.match(html, /Archive session/);
    assert.match(html, /Pause lane/);
    assert.match(html, /Athena/);
    assert.match(html, /Prometheus/);
    assert.match(html, /Hermes/);
    assert.match(html, /aria-label="Desktop composer"/);
    assert.doesNotMatch(html, /hero-panel|metric-card|dashboard/i);
  });

  it("[NEGATIVE] keeps the shell stable with no live sessions and escapes unsafe content", () => {
    const html = renderAtlasHomeHtml(buildPageData({
      sessions: [],
      repoLabel: "<unsafe repo>",
      shellCommand: "<script>alert(1)</script>",
      focusedSessionRole: null,
      homeReadinessHeading: "Ready to start",
      homeReadinessDetail: "No resumable session is active yet. Open Sessions to begin the next role handoff.",
      homePrimaryActionLabel: "Open sessions",
    }));

    assert.match(html, /No session state is available yet\./);
    assert.match(html, /Start session/);
    assert.match(html, /Waiting for the next live detail/);
    assert.doesNotMatch(html, /<unsafe repo>|<script>alert\(1\)<\/script>/);
  });
});
