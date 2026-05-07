import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AtlasCompletedSessionRecord } from "../../src/atlas/completed_sessions.js";
import type { AtlasRuntimeSnapshot } from "../../src/atlas/build_runtime.js";
import type { AtlasDesktopSessionRecord } from "../../src/atlas/desktop_sessions.js";
import type { AtlasPageData } from "../../src/atlas/renderer.js";
import { renderAtlasWorkspaceHtml, resolvePreferredAtlasSessionId } from "../../src/atlas/renderer.js";

function buildSession(overrides: Partial<AtlasDesktopSessionRecord> = {}): AtlasDesktopSessionRecord {
  return {
    id: "atlas-session-1",
    title: "Outdoor Turkish web site",
    objective: "Plan a premium, mobile-first Turkish outdoor e-commerce website.",
    summary: "Plan a premium, mobile-first Turkish outdoor e-commerce website with core shopping pages.",
    projectId: "target_outdoor_turkish_web_site",
    projectSessionId: "sess_20260429194707_b7887c",
    projectWorkspacePath: "C:/workspace/target_outdoor_turkish_web_site/sess_20260429194707_b7887c",
    projectName: "Outdoor Turkish web site",
    projectDescription: "Outdoor web site",
    repoContext: {
      provider: "github",
      targetRepo: "dogducaner66-byte/outdoor-turkish-web-site",
      targetBaseBranch: "main",
      repoMode: "existing",
      repoCreatedByAtlas: true,
    },
    status: "ready",
    openQuestions: [],
    executionNotes: [],
    attachments: [],
    attachmentPlans: [],
    clarificationAnswers: [],
    pendingQuestionIndex: null,
    pendingQuestion: null,
    messages: [],
    createdAt: "2026-04-29T19:47:07.769Z",
    updatedAt: "2026-04-29T20:23:47.516Z",
    ...overrides,
  };
}

function buildRuntimeSnapshot(overrides: Partial<AtlasRuntimeSnapshot> = {}): AtlasRuntimeSnapshot {
  return {
    mission: {
      sessionId: "atlas-session-1",
      desktopSessionId: "atlas-session-1",
      projectSessionId: "sess_20260429194707_b7887c",
      title: "Outdoor Turkish web site",
      objective: "Plan a premium, mobile-first Turkish outdoor e-commerce website.",
      summary: "Plan a premium, mobile-first Turkish outdoor e-commerce website with core shopping pages.",
      requestedAt: "2026-04-29T20:23:47.516Z",
    },
    request: {
      state: "running",
      stateLabel: "Build running",
      triggerMode: "resume",
      triggerLabel: "ATLAS injected the session brief and started the full BOX runtime for this mission.",
      runnerPid: 12345,
      lastError: null,
    },
    pipeline: {
      stage: "workers_running",
      stageLabel: "Workers running",
      percent: 62,
      detail: "ATLAS is monitoring the live build flow.",
      loopCount: 3,
      updatedAt: "2026-04-30T10:40:00.000Z",
      startedAt: "2026-04-30T10:35:00.000Z",
      completedAt: null,
    },
    agents: [],
    defaultAgentId: "jesus",
    sessionPremiumRequests: 2,
    updatedAt: "2026-04-30T10:40:00.000Z",
    ...overrides,
  };
}

function buildPageData(runtimeSnapshot: AtlasRuntimeSnapshot | null): AtlasPageData {
  const session = buildSession();
  return {
    title: "ATLAS",
    repoLabel: "dogducaner66-byte/outdoor-turkish-web-site",
    repoContext: session.repoContext,
    hostLabel: "Local desktop",
    shellCommand: "ATLAS.exe",
    updatedAt: session.updatedAt,
    buildSessionId: session.id,
    buildTimestamp: session.updatedAt,
    homeReadinessHeading: "Ready",
    homeReadinessDetail: "Ready to continue.",
    homePrimaryActionLabel: "Resume",
    sessionStartStatusLabel: "Tracked sessions available",
    sessionStartStatusDetail: "Continue any tracked session from the left rail.",
    sessionStartUpdatedAt: session.updatedAt,
    continuityStatusLabel: "Monitoring live build",
    continuityStatusDetail: "ATLAS is monitoring the current session.",
    mainPaneMode: "selected-session",
    focusedSessionId: session.id,
    missingFocusedSnapshot: false,
    runtimeSnapshot,
    githubAuth: {
      accountLogin: null,
      githubTokenConfigured: false,
      copilotTokenConfigured: false,
      authRequired: false,
      source: "none",
    },
    copilotUsage: null,
    authRequired: false,
    maxTrackedSessions: 6,
    activeSessionCount: 1,
    sessionRuntimeStatuses: {
      [session.id]: { state: "active", label: "Active", tone: "active" },
    },
    completedSessionCount: 0,
    sessions: [session],
    completedSessions: [],
    completedSession: null,
    focusedCompletedSessionKey: null,
  };
}

function buildCompletedSession(overrides: Partial<AtlasCompletedSessionRecord> = {}): AtlasCompletedSessionRecord {
  return {
    key: "target_outdoor_turkish_web_site:sess_20260429194707_b7887c",
    projectId: "target_outdoor_turkish_web_site",
    sessionId: "sess_20260429194707_b7887c",
    title: "Outdoor Turkish web site",
    finalStatus: "completed",
    repoUrl: "https://github.com/acme/outdoor-site",
    objective: "Ship a premium outdoor storefront.",
    workspacePath: "C:/workspace/target_outdoor_turkish_web_site/sess_20260429194707_b7887c",
    archivedAt: "2026-05-01T12:00:00.000Z",
    completionReason: "Completed delivery",
    completionSummary: "Finished storefront is ready.",
    unresolvedItems: [],
    presentation: null,
    ...overrides,
  };
}

function extractStyle(html: string): string {
  const match = /<style>([\s\S]*?)<\/style>/.exec(html);
  assert.ok(match, "renderer output should include a style block");
  return match[1] || "";
}

function extractClientScript(html: string): string {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1] || "");
  const clientScript = scripts.find((script) => script.includes("redirectToSession"));
  assert.ok(clientScript, "renderer output should include the ATLAS client script");
  return clientScript;
}

describe("atlas renderer layout regression", () => {
  it("prefers a returned session id only when it still exists in the live rail response", () => {
    assert.equal(resolvePreferredAtlasSessionId("atlas-session-1", [buildSession()]), "atlas-session-1");
    assert.equal(
      resolvePreferredAtlasSessionId("stale-session", [buildSession(), buildSession({ id: "atlas-session-2" })]),
      "atlas-session-1",
    );
    assert.equal(resolvePreferredAtlasSessionId("atlas-session-1", []), "atlas-session-1");
    assert.equal(resolvePreferredAtlasSessionId(null, [buildSession({ id: "atlas-session-2" })]), "atlas-session-2");
  });

  it("keeps only the top session title while moving build status into the pipeline card", () => {
    const html = renderAtlasWorkspaceHtml(buildPageData(buildRuntimeSnapshot()));
    const markup = html.split("<script")[0] || html;

    assert.match(markup, /data-role="conversation-title"/);
    assert.doesNotMatch(markup, /data-role="conversation-summary"/);
    assert.doesNotMatch(markup, /data-role="conversation-repo"/);
    assert.doesNotMatch(markup, /data-role="build-mission-title"/);
    assert.doesNotMatch(markup, /data-role="build-mission-summary"/);
    assert.match(markup, /data-role="build-request-state"/);
    assert.match(markup, /data-role="build-request-copy"/);
    assert.match(markup, />Active</);
    assert.match(markup, /data-role="delete-session-button"/);
    assert.equal((markup.match(/<button[^>]+data-role="delete-session-button"/g) || []).length, 1);
    const buildControlMarkup = /data-role="build-control-host"[\s\S]*?<\/section>/.exec(markup)?.[0] || "";
    assert.doesNotMatch(buildControlMarkup, /<button[^>]+data-role="delete-session-button"/);
    assert.match(markup, /data-role="build-loop-count">3</);
    assert.match(markup, /data-role="build-session-premium-count">2</);
  });

  it("[NEGATIVE] preserves the queued build status copy even when no runtime snapshot is available", () => {
    const html = renderAtlasWorkspaceHtml(buildPageData(null));
    const markup = html.split("<script")[0] || html;

    assert.doesNotMatch(markup, /data-role="build-mission-title"/);
    assert.match(markup, />Queued</);
    assert.match(markup, /ATLAS is preparing the live runtime bridge for this session\./);
    assert.match(markup, /data-role="build-loop-count">0</);
    assert.match(markup, /data-role="build-session-premium-count">0</);
  });

  it("allows queued build sessions to resume without showing Stop as the primary recovery action", () => {
    const html = renderAtlasWorkspaceHtml(buildPageData(buildRuntimeSnapshot({
      request: {
        ...buildRuntimeSnapshot().request,
        state: "queued",
        stateLabel: "Queued",
        runnerPid: null,
      },
    })));
    const markup = html.split("<script")[0] || html;

    assert.match(markup, /data-build-action="resume-build" data-session-id="atlas-session-1" data-i18n="resumeLabel" >Resume<\/button>/);
    assert.match(markup, /data-build-action="stop-build" data-session-id="atlas-session-1" data-i18n="stopLabel" disabled>Stop<\/button>/);
  });

  it("renders unfinished onboarding sessions with the idle status tone instead of marking them active", () => {
    const html = renderAtlasWorkspaceHtml({
      ...buildPageData(null),
      sessions: [buildSession({ status: "active", projectId: null, projectSessionId: null, projectWorkspacePath: null })],
      focusedSessionId: "atlas-session-1",
      mainPaneMode: "selected-session",
      activeSessionCount: 0,
      sessionRuntimeStatuses: {},
    });
    const markup = html.split("<script")[0] || html;

    assert.match(markup, /status-pill-idle/);
    assert.match(markup, />Onboarding</);
  });

  it("keeps the generated client script parseable so session rail clicks are wired", () => {
    const html = renderAtlasWorkspaceHtml(buildPageData(buildRuntimeSnapshot()));
    const clientScript = extractClientScript(html);

    assert.doesNotThrow(() => new Function(clientScript));
    assert.match(clientScript, /replace\(\/\^https\?:\\\/\\\/github\\\.com\\\/\/i, ''\)/);
    assert.match(clientScript, /redirectToSession\(trigger\.getAttribute\('data-session-id'\)\)/);
    assert.match(clientScript, /stopRuntimePolling\(\);\s*stopRuntimeLogPolling\(\);/);
    assert.match(clientScript, /querySelectorAll\('\.sidebar-new-session\[data-action="new-session"\]'\)/);
    assert.match(clientScript, /setLoadingOverlay\(true, t\('newSessionTransitionHeading'\), t\('newSessionTransitionDetail'\)\);/);
  });

  it("keeps build control rerenders bound to the selected session id and exposes loading labels", () => {
    const html = renderAtlasWorkspaceHtml(buildPageData(buildRuntimeSnapshot()));
    const clientScript = extractClientScript(html);

    assert.match(clientScript, /controlHost\.outerHTML = renderBuildControlsHtml\(snapshot, selectedSessionId\);/);
    assert.doesNotMatch(clientScript, /renderBuildControlsHtml\(selectedSessionId, snapshot\)/);
    assert.match(clientScript, /resumePendingLabel: 'Resuming\.\.\.'/);
    assert.match(clientScript, /stopPendingLabel: 'Stopping\.\.\.'/);
  });

  it("uses dark-theme send button tokens with a black icon color", () => {
    const html = renderAtlasWorkspaceHtml(buildPageData(null));
    const css = extractStyle(html);
    const afterStyle = html.slice(html.indexOf("</style>") + "</style>".length);

    assert.match(css, /:root\[data-theme="graphite"\],[\s\S]*:root\[data-theme="smoke"\] \{[\s\S]*--composer-send-color: #08090d;/);
    assert.match(css, /\.composer-submit-button \{[\s\S]*background: var\(--composer-send-bg\);[\s\S]*color: var\(--composer-send-color\);/);
    assert.match(css, /\.composer-entry-shell \{[\s\S]*grid-template-columns: 32px minmax\(0, 1fr\) 42px;[\s\S]*padding: 10px 12px;/);
    assert.match(css, /\.composer-card-home \.composer-entry-shell \{[\s\S]*grid-template-columns: 32px minmax\(0, 1fr\) 40px;[\s\S]*padding: 10px 14px 10px 12px;/);
    assert.match(css, /\.composer-attach-button \{[\s\S]*grid-column: 1;/);
    assert.match(css, /\.composer-input \{[\s\S]*grid-column: 2;[\s\S]*min-width: 0;/);
    assert.match(css, /\.composer-submit-button \{[\s\S]*grid-column: 3;/);
    assert.match(css, /\.composer-inline-button,[\s\S]*\.composer-submit-button \{[\s\S]*padding: 0;[\s\S]*box-sizing: border-box;[\s\S]*appearance: none;[\s\S]*line-height: 1;/);
    assert.match(css, /\.composer-submit-button \{[\s\S]*place-self: center;[\s\S]*transform: none;/);
    assert.match(css, /\.composer-submit-icon \{[\s\S]*display: inline-flex;[\s\S]*overflow: visible;/);
    assert.match(css, /\.composer-submit-icon svg \{[\s\S]*width: 14px;[\s\S]*height: 14px;/);
    assert.match(html, /<span class="composer-submit-icon" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M4\.25 3\.75L10\.5 8L4\.25 12\.25"/);
    assert.doesNotMatch(afterStyle, /--composer-send-bg|--composer-send-color/);
  });

  it("relaxes the desktop shell into tablet and mobile responsive layouts", () => {
    const css = extractStyle(renderAtlasWorkspaceHtml(buildPageData(null)));

    assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.shell \{[\s\S]*max-height: none;[\s\S]*\.main-shell > \[data-role="main-host"\],[\s\S]*height: auto;/);
    assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.new-session-heading \{[\s\S]*white-space: normal;[\s\S]*max-width: min\(22ch, 100%\);/);
    assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.conversation-thread \{[\s\S]*max-height: min\(54vh, 520px\);/);
    assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.desktop-sidebar \{[\s\S]*grid-template-columns: 1fr;[\s\S]*\.new-session-shell \{[\s\S]*text-align: left;/);
    assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.composer-input \{[\s\S]*font-size: 16px;/);
  });

  it("centers completed session archive layouts instead of leaving them flush to the main pane edge", () => {
    const completedSession = buildCompletedSession();
    const html = renderAtlasWorkspaceHtml({
      ...buildPageData(null),
      mainPaneMode: "completed-session-list",
      completedSessionCount: 1,
      completedSessions: [completedSession],
      completedSession: null,
      focusedCompletedSessionKey: null,
    });
    const css = extractStyle(html);

    assert.match(html, /class="history-shell history-shell-list"/);
    assert.match(css, /\.history-shell \{[\s\S]*width: min\(1160px, 100%\);[\s\S]*margin: 0 auto;/);
  });

  it("uses a narrower centered shell for completed session detail pages", () => {
    const completedSession = buildCompletedSession();
    const html = renderAtlasWorkspaceHtml({
      ...buildPageData(null),
      mainPaneMode: "completed-session-detail",
      completedSessionCount: 1,
      completedSessions: [completedSession],
      completedSession,
      focusedCompletedSessionKey: completedSession.key,
    });
    const css = extractStyle(html);

    assert.match(html, /class="history-shell history-shell-detail"/);
    assert.match(css, /\.history-shell-detail \{[\s\S]*width: min\(1040px, 100%\);/);
  });

  it("shows the custom schema as the default model picker selection when Atlas uses per-agent models", () => {
    const html = renderAtlasWorkspaceHtml({
      ...buildPageData(null),
      copilotUsage: {
        planTier: "pro",
        planLabel: "Copilot Pro",
        modelAccess: "current",
        planDetectedBy: "entitlement",
        source: "copilot_internal/user",
        rawPlan: null,
        entitlement: 300,
        usedRequests: 12,
        remainingRequests: 288,
        percentRemaining: 96,
        currentSelectionMode: "schema",
        currentSelectionSource: "custom_schema",
        currentSelectionModel: null,
      },
    });

    assert.match(html, /Use current custom schema/);
    assert.match(html, /Without an override, Atlas keeps the current custom per-agent schema\./);
  });
});