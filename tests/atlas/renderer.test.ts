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
    focusedSessionRole: null,
    missingFocusedSnapshot: false,
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
        lane: null,
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

describe("atlas renderer", () => {
  it("renders the home surface around desktop continuity, delivery focus, and repo state", () => {
    const html = renderAtlasHomeHtml(buildPageData());

    assert.match(html, /<title>ATLAS Home<\/title>/);
    assert.match(html, /Native desktop workspace/);
    assert.match(html, /aria-label="ATLAS desktop surface"/);
    assert.match(html, /aria-label="ATLAS desktop sidebar"/);
    assert.match(html, /aria-label="ATLAS work canvas"/);
    assert.match(html, /class="workspace-shell"/);
    assert.match(html, /<a class="nav-link" href="\/" aria-current="page">Home<\/a>/);
    assert.match(html, /<a class="nav-link" href="\/sessions">Sessions<\/a>/);
    assert.match(html, /Desktop continuity/);
    assert.match(html, /ATLAS keeps the live delivery state in the desktop window\./);
    assert.match(html, /repo state, relaunch recovery, and clarification handoff stay inside the native shell/i);
    assert.match(html, /<code>\.\\ATLAS\.cmd<\/code>/);
    assert.match(html, /Build session/);
    assert.match(html, /desktop-session-7/);
    assert.match(html, /Last packaged build/);
    assert.match(html, /2026-04-21 12:05 UTC/);
    assert.match(html, /Active delivery focus/);
    assert.match(html, /Workers Running/);
    assert.match(html, /Delivering the ATLAS desktop shell/);
    assert.match(html, /Repo state/);
    assert.match(html, />Ancora-Labs\/ATLAS</);
    assert.match(html, /Tracked sessions/);
    assert.match(html, />3</);
    assert.match(html, /Desktop composer/);
    assert.match(html, /Refresh clarification/);
    assert.match(html, /class="desktop-composer"/);
    assert.match(html, /data-view="home"/);
    assert.match(html, /data-role="product-composer-input"/);
    assert.match(html, /getDesktopState/);
    assert.match(html, /setProductDraft/);
    assert.match(html, /setProductComposerFocus/);
    assert.match(html, /Restored the last clarification objective for this desktop session\./);
    assert.match(html, /payload\.packet\.objective/);
    assert.match(html, />Resume session flow</);
    assert.match(html, />Stop runtime</);
    assert.match(html, />Ready to resume</);
    assert.match(html, /Saved the workspace draft for this desktop shell\./);
    assert.match(html, /Clarification refresh failed\. The draft is still preserved in this desktop shell\./);
    assert.match(html, /outline: 3px solid #ffffff/);
    assert.match(html, /@media \(max-width: 960px\)/);
    assert.doesNotMatch(html, /hero-panel|metric-card|dashboard|window-controls|traffic-light|titlebar-buttons/i);
  });

  it("renders the sessions surface with trusted lifecycle feedback and session actions", () => {
    const html = renderAtlasSessionsHtml(buildPageData({ title: "ATLAS Sessions" }));

    assert.match(html, /<title>ATLAS Sessions<\/title>/);
    assert.match(html, /aria-label="ATLAS desktop surface"/);
    assert.match(html, /aria-label="ATLAS desktop sidebar"/);
    assert.match(html, /aria-label="ATLAS work canvas"/);
    assert.match(html, /<a class="nav-link" href="\/">Home<\/a>/);
    assert.match(html, /<a class="nav-link" href="\/sessions" aria-current="page">Sessions<\/a>/);
    assert.match(html, /Trust-first work ledger/);
    assert.match(html, /Session ledger keeps delivery trust anchored in the desktop lifecycle\./);
    assert.match(html, /Persistent left sidebar/);
    assert.match(html, />3 tracked sessions</);
    assert.match(html, />2 resumable</);
    assert.match(html, />1 needing input</);
    assert.match(html, />0 paused lanes</);
    assert.match(html, />Athena</);
    assert.match(html, />Prometheus</);
    assert.match(html, />Hermes</);
    assert.match(html, />In progress · In progress</);
    assert.match(html, />Needs attention · Needs your input</);
    assert.match(html, />Completed · Completed</);
    assert.match(html, />Pause lane</);
    assert.match(html, />Archive session</);
    assert.match(html, />Refresh clarification</);
    assert.match(html, /data-view="sessions"/);
    assert.match(html, />feat\/atlas-home</);
    assert.match(html, />No branch recorded</);
    assert.match(html, />2026-04-21 12:00 UTC</);
    assert.match(html, /method="post" action="\/lifecycle"/);
    assert.doesNotMatch(html, /hero-panel|BOX Mission Control|dashboard|window-controls|traffic-light/i);
  });

  it("[NEGATIVE] escapes dynamic values, keeps the empty state stable, and preserves the start CTA", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      title: "ATLAS Sessions",
      sessions: [],
      repoLabel: "<unsafe repo>",
    }));
    const homeHtml = renderAtlasHomeHtml(buildPageData({
      sessions: [],
      shellCommand: "<script>alert(1)</script>",
      homeReadinessHeading: "Ready to start",
      homeReadinessDetail: "No resumable session is active yet. Open Sessions to begin the next role handoff.",
      homePrimaryActionLabel: "Open sessions",
    }));

    assert.match(html, /&lt;unsafe repo&gt;/);
    assert.match(html, /No session state is available yet\./);
    assert.doesNotMatch(html, /<unsafe repo>/);
    assert.match(homeHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(homeHtml, /<script>alert\(1\)<\/script>/);
    assert.match(homeHtml, />Open sessions</);
    assert.match(homeHtml, />Ready to start</);
    assert.match(homeHtml, /No resumable session is active yet\./);
    assert.match(homeHtml, /No live session snapshot yet/);
    assert.match(homeHtml, /data-has-live-sessions="false"/);
    assert.doesNotMatch(homeHtml, /metric-card|dashboard|window-controls|traffic-light/i);
  });

  it("shows degraded composer continuity when the saved focus has no live snapshot yet", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      title: "ATLAS Sessions",
      missingFocusedSnapshot: true,
    }));

    assert.match(html, /Focus restored without a live session snapshot/);
    assert.match(html, /The saved focus target is still waiting on its next live session snapshot\./);
    assert.match(html, /data-missing-focused-snapshot="true"/);
    assert.match(html, />Clear focus</);
  });

  it("shows degraded composer continuity when the saved focus has no live snapshot yet", () => {
    const html = renderAtlasSessionsHtml(buildPageData({
      title: "ATLAS Sessions",
      missingFocusedSnapshot: true,
    }));

    assert.match(html, /Focus restored without a live session snapshot/);
    assert.match(html, /The saved focus target is still waiting on its next live session snapshot\./);
    assert.match(html, /data-missing-focused-snapshot="true"/);
    assert.match(html, />Clear focus</);
  });
});
