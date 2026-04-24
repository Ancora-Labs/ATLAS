import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  renderAtlasHomeHtml,
  renderAtlasSessionsHtml,
  type AtlasPageData,
} from "../../src/atlas/renderer.ts";

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
    focusedSessionRole: "Prometheus",
    sessions: [
      {
        role: "Athena",
        name: "Athena",
        lane: "review",
        status: "working",
        statusLabel: "In progress",
        readiness: "in_progress",
        readinessLabel: "In progress",
        lastTask: "Validate the ATLAS contract",
        lastActiveAt: "2026-04-21T12:00:00.000Z",
        historyLength: 2,
        lastThinking: "",
        currentBranch: "feat/atlas-home",
        pullRequestCount: 1,
        touchedFileCount: 3,
        needsInput: false,
        isResumable: true,
        isPaused: false,
        canArchive: false,
      },
      {
        role: "Prometheus",
        name: "Prometheus",
        lane: "planning",
        status: "blocked",
        statusLabel: "Needs attention",
        readiness: "action_needed",
        readinessLabel: "Needs your input",
        lastTask: "Waiting for route review",
        lastActiveAt: "2026-04-21T11:45:00.000Z",
        historyLength: 3,
        lastThinking: "",
        currentBranch: "feat/atlas-plan",
        pullRequestCount: 0,
        touchedFileCount: 1,
        needsInput: true,
        isResumable: true,
        isPaused: false,
        canArchive: true,
      },
      {
        role: "Hermes",
        name: "Hermes",
        lane: null,
        status: "done",
        statusLabel: "Completed",
        readiness: "completed",
        readinessLabel: "Completed",
        lastTask: "Closed the last session",
        lastActiveAt: "2026-04-21T11:30:00.000Z",
        historyLength: 4,
        lastThinking: "",
        currentBranch: null,
        pullRequestCount: 2,
        touchedFileCount: 7,
        needsInput: false,
        isResumable: false,
        isPaused: false,
        canArchive: true,
      },
    ],
    ...overrides,
  };
}

describe("atlas desktop shell refactor", () => {
  it("renders home inside one desktop shell with a persistent sidebar and bottom composer", () => {
    const html = renderAtlasHomeHtml(buildPageData());

    assert.match(html, /aria-label="ATLAS desktop sidebar"/);
    assert.match(html, /aria-label="ATLAS work canvas"/);
    assert.match(html, /aria-label="Desktop composer"/);
    assert.match(html, /Runtime status/);
    assert.match(html, /Session focus/);
    assert.match(html, /Persistent left sidebar/);
    assert.match(html, /Desktop continuity/);
    assert.match(html, /Active delivery focus/);
    assert.match(html, /Repo state/);
    assert.match(html, /ATLAS keeps the live delivery state in the desktop window\./);
    assert.match(html, /monochrome, desktop-first, and trustworthy/i);
    assert.match(html, /Resume session flow/);
    assert.match(html, /Stop runtime/);
    assert.match(html, /position: sticky/);
    assert.match(html, /grid-template-columns: minmax\(280px, 340px\) minmax\(0, 1fr\)/);
    assert.doesNotMatch(html, /hero-panel|metric-card|dashboard/i);
  });

  it("renders sessions inside the same shell while preserving focus-aware lifecycle actions", () => {
    const html = renderAtlasSessionsHtml(buildPageData({ title: "ATLAS Sessions" }));

    assert.match(html, /<title>ATLAS Sessions<\/title>/);
    assert.match(html, /Trust-first work ledger/);
    assert.match(html, /Session ledger stays aligned with the desktop lifecycle\./);
    assert.match(html, /Focused workspace/);
    assert.match(html, /Keep focus on home/);
    assert.match(html, /method="post" action="\/lifecycle"/);
    assert.match(html, /Focus session|Clear focus/);
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
    assert.match(html, /Open sessions/);
    assert.match(html, /Ready to start/);
    assert.match(html, /&lt;unsafe repo&gt;/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<unsafe repo>|<script>alert\(1\)<\/script>/);
  });
});
