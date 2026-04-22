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
    homeReadinessHeading: "Ready to resume",
    homeReadinessDetail: "One or more roles can continue from their recorded state.",
    homePrimaryActionLabel: "Resume session flow",
    sessions: [
      {
        role: "Athena",
        name: "Athena",
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
      },
      {
        role: "Prometheus",
        name: "Prometheus",
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
      },
      {
        role: "Hermes",
        name: "Hermes",
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
      },
    ],
    ...overrides,
  };
}

describe("atlas renderer", () => {
  it("renders the home surface with title, navigation, readiness copy, and resume CTA behavior", () => {
    const html = renderAtlasHomeHtml(buildPageData());

    assert.match(html, /<title>ATLAS Home<\/title>/);
    assert.match(html, /ATLAS Desktop Session Control/);
    assert.match(html, /<a class="nav-link" href="\/" aria-current="page">/);
    assert.match(html, /<a class="nav-link" href="\/sessions">/);
    assert.match(html, /Windows-first product shell/);
    assert.match(html, /<code>\.\\ATLAS\.cmd<\/code>/);
    assert.match(html, /<span>Total sessions<\/span>\s*<strong>3<\/strong>/);
    assert.match(html, /<span>Active sessions<\/span>\s*<strong>1<\/strong>/);
    assert.match(html, /<span>Needs input<\/span>\s*<strong>1<\/strong>/);
    assert.match(html, /<span>Completed<\/span>\s*<strong>1<\/strong>/);
    assert.match(html, />Resume session flow</);
    assert.match(html, />Ready to resume</);
    assert.match(html, /One or more roles can continue from their recorded state\./);
    assert.doesNotMatch(html, /BOX Mission Control|dashboard/i);
  });

  it("renders the sessions surface with product-language status chips and active navigation", () => {
    const html = renderAtlasSessionsHtml(buildPageData({ title: "ATLAS Sessions" }));

    assert.match(html, /<title>ATLAS Sessions<\/title>/);
    assert.match(html, /<a class="nav-link" href="\/">/);
    assert.match(html, /<a class="nav-link" href="\/sessions" aria-current="page">/);
    assert.match(html, />Worker sessions</);
    assert.match(html, />3 tracked roles</);
    assert.match(html, />Athena</);
    assert.match(html, />Prometheus</);
    assert.match(html, />Hermes</);
    assert.match(html, />In progress · In progress</);
    assert.match(html, />Needs attention · Needs your input</);
    assert.match(html, />Completed · Completed</);
    assert.match(html, />feat\/atlas-home</);
    assert.match(html, />No branch recorded</);
    assert.match(html, />2026-04-21 12:00 UTC</);
  });

  it("[NEGATIVE] escapes session content, falls back to empty-state output, and keeps the start CTA deterministic", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      title: "ATLAS Sessions",
      sessions: [],
      repoLabel: "<unsafe repo>",
      shellCommand: "<script>alert(1)</script>",
    }));
    const homeHtml = renderAtlasHomeHtml(buildPageData({
      sessions: [],
      homeReadinessHeading: "Ready to start",
      homeReadinessDetail: "No resumable session is active yet. Open Sessions to begin the next role handoff.",
      homePrimaryActionLabel: "Open sessions",
    }));

    assert.match(html, /&lt;unsafe repo&gt;/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /No session state is available yet/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(homeHtml, />Open sessions</);
    assert.match(homeHtml, />Ready to start</);
    assert.match(homeHtml, /No resumable session is active yet\./);
  });
});
