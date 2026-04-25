import {
  resolveAtlasSessionSnapshotContinuity,
  type AtlasSessionDto,
} from "./state_bridge.js";

export interface AtlasPageData {
  title: string;
  repoLabel: string;
  hostLabel: string;
  shellCommand: string;
  pipelineStageLabel: string;
  pipelineDetail: string;
  pipelinePercent: number;
  updatedAt: string | null;
  buildSessionId: string;
  buildTimestamp: string | null;
  homeReadinessHeading: string;
  homeReadinessDetail: string;
  homePrimaryActionLabel: string;
  sessionStartStatusLabel: string;
  sessionStartStatusDetail: string;
  sessionStartUpdatedAt: string | null;
  continuityStatusLabel: string;
  continuityStatusDetail: string;
  focusedSessionRole: string | null;
  missingFocusedSnapshot: boolean;
  sessions: AtlasSessionDto[];
}

type AtlasView = "home" | "sessions";

interface AtlasSessionCounts {
  total: number;
  active: number;
  needsInput: number;
  completed: number;
  resumable: number;
  paused: number;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Waiting for the next state write";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Waiting for the next state write";

  const year = timestamp.getUTCFullYear();
  const month = String(timestamp.getUTCMonth() + 1).padStart(2, "0");
  const day = String(timestamp.getUTCDate()).padStart(2, "0");
  const hour = String(timestamp.getUTCHours()).padStart(2, "0");
  const minute = String(timestamp.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

function clampPercent(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function getPrimarySession(sessions: AtlasSessionDto[]): AtlasSessionDto | null {
  return sessions.find((session) => session.status === "working")
    || sessions.find((session) => session.needsInput)
    || sessions.find((session) => session.isResumable)
    || sessions[0]
    || null;
}

function buildSurfaceHref(view: AtlasView, focusedSessionRole: string | null): string {
  void view;
  const params = new URLSearchParams();
  if (focusedSessionRole) {
    params.set("focusRole", focusedSessionRole);
  }

  const pathname = "/";
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getFocusedSession(sessions: AtlasSessionDto[], focusedSessionRole: string | null): AtlasSessionDto | null {
  if (!focusedSessionRole) {
    return null;
  }

  return sessions.find((session) => session.role === focusedSessionRole) || null;
}

function getActiveSessionFocus(pageData: AtlasPageData): AtlasSessionDto | null {
  return getFocusedSession(pageData.sessions, pageData.focusedSessionRole) || getPrimarySession(pageData.sessions);
}

function countSessions(sessions: AtlasSessionDto[]): AtlasSessionCounts {
  return sessions.reduce<AtlasSessionCounts>((counts, session) => ({
    total: counts.total + 1,
    active: counts.active + (session.status === "working" ? 1 : 0),
    needsInput: counts.needsInput + (session.needsInput ? 1 : 0),
    completed: counts.completed + (session.status === "done" ? 1 : 0),
    resumable: counts.resumable + (session.isResumable ? 1 : 0),
    paused: counts.paused + (session.isPaused ? 1 : 0),
  }), {
    total: 0,
    active: 0,
    needsInput: 0,
    completed: 0,
    resumable: 0,
    paused: 0,
  });
}

function getSessionSummary(session: AtlasSessionDto | null): { heading: string; detail: string; branch: string; status: string; } {
  if (!session) {
    return {
      heading: "Ready for the next session",
      detail: "ATLAS is ready when the next tracked session state arrives.",
      branch: "No branch recorded",
      status: "Waiting for session state",
    };
  }

  return {
    heading: session.name,
    detail: session.latestMeaningfulAction || session.lastTask || "Waiting for the next product-facing task.",
    branch: session.currentBranch || "No branch recorded",
    status: `${session.statusLabel} · ${session.readinessLabel}`,
  };
}

function getSessionActivityLabel(session: AtlasSessionDto): string {
  return session.latestMeaningfulAction || session.lastTask || "Waiting for the next product-facing task.";
}

function renderNavigation(_view: AtlasView, _focusedSessionRole: string | null): string {
  return `<div class="nav-shell" aria-label="ATLAS workspace mode">
    <span class="nav-link nav-link-static">Single workspace shell</span>
  </div>`;
}

function renderLifecycleForm(
  label: string,
  action: "pause" | "resume" | "archive" | "stop",
  options: { role?: string | null; returnTo: string; tone?: "primary" | "secondary"; },
): string {
  return `<form class="action-form" method="post" action="/lifecycle">
    <input type="hidden" name="action" value="${escapeHtml(action)}" />
    ${options.role ? `<input type="hidden" name="role" value="${escapeHtml(options.role)}" />` : ""}
    <input type="hidden" name="returnTo" value="${escapeHtml(options.returnTo)}" />
    <button class="action-button ${options.tone || "secondary"}" type="submit">${escapeHtml(label)}</button>
  </form>`;
}

function renderLinkAction(label: string, href: string): string {
  return `<a class="action-button secondary" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function renderSessionActions(session: AtlasSessionDto, focusedSessionRole: string | null): string {
  const actions: string[] = [
    session.role === focusedSessionRole
      ? renderLinkAction("Clear focus", buildSurfaceHref("sessions", null))
      : renderLinkAction("Focus session", buildSurfaceHref("sessions", session.role)),
  ];

  if (session.lane) {
    actions.push(session.isPaused
      ? renderLifecycleForm("Resume lane", "resume", { role: session.role, returnTo: buildSurfaceHref("sessions", session.role) })
      : renderLifecycleForm("Pause lane", "pause", { role: session.role, returnTo: buildSurfaceHref("sessions", session.role) }));
  }

  if (session.canArchive) {
    actions.push(renderLifecycleForm("Archive session", "archive", {
      role: session.role,
      returnTo: buildSurfaceHref("sessions", session.role),
    }));
  }

  return `<div class="action-row">${actions.join("")}</div>`;
}

function renderStatusTags(session: AtlasSessionDto): string {
  const chips = [
    `<span class="chip">${escapeHtml(session.statusLabel)} · ${escapeHtml(session.readinessLabel)}</span>`,
  ];

  if (session.isResumable) {
    chips.push('<span class="chip">Resumable</span>');
  }

  if (session.isPaused) {
    chips.push('<span class="chip">Paused lane</span>');
  }

  if (session.pullRequestCount > 0) {
    chips.push(`<span class="chip">${escapeHtml(String(session.pullRequestCount))} PR${session.pullRequestCount === 1 ? "" : "s"}</span>`);
  }

  return chips.join("");
}

function renderTokenList(
  items: string[],
  emptyLabel: string,
  itemTag = "span",
  className = "detail-token",
): string {
  if (items.length === 0) {
    return `<p class="support-copy">${escapeHtml(emptyLabel)}</p>`;
  }
  return `<div class="token-list">${items.map((item) => `<${itemTag} class="${className}">${escapeHtml(item)}</${itemTag}>`).join("")}</div>`;
}

function renderRecentActions(session: AtlasSessionDto): string {
  if (session.recentActions.length === 0) {
    return '<p class="support-copy">No meaningful worker actions have been recorded yet.</p>';
  }
  return `<ol class="detail-list">
    ${session.recentActions.map((action) => `<li>
      <strong>${escapeHtml(action.summary)}</strong>
      <span>${escapeHtml(action.statusLabel)}${action.actor ? ` · ${escapeHtml(action.actor)}` : ""}${action.at ? ` · ${escapeHtml(formatTimestamp(action.at))}` : ""}</span>
    </li>`).join("")}
  </ol>`;
}

function renderFocusedSessionDetail(
  session: AtlasSessionDto | null,
  pageData: AtlasPageData,
  view: AtlasView,
): string {
  if (!session) {
    return `<section class="canvas-section focused-session-panel" aria-label="Focused session detail" data-role="focused-session-panel" aria-live="polite">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Focused session detail</div>
          <h2 data-role="focused-session-name">Waiting for the next live detail</h2>
        </div>
      </div>
      <p class="support-copy" data-role="focused-session-activity">Focus a tracked session from the left rail or start a new one to hydrate worker detail inline.</p>
      <div class="chip-row">
        <span class="chip" data-role="focused-session-status">${escapeHtml(pageData.sessionStartStatusLabel)}</span>
        <span class="chip" data-role="focused-session-stage">${escapeHtml(pageData.continuityStatusLabel)}</span>
        <span class="chip" data-role="focused-session-freshness">Freshness ${escapeHtml(formatTimestamp(pageData.sessionStartUpdatedAt))}</span>
      </div>
      <p class="support-copy" data-role="focused-session-continuity">${escapeHtml(pageData.continuityStatusDetail)}</p>
      <details class="detail-section detail-section-log" open>
        <summary>Readable log excerpt</summary>
        <div class="log-shell">
          <p class="support-copy" data-role="focused-session-log-meta">${escapeHtml(pageData.continuityStatusLabel)}</p>
          <pre class="log-excerpt" data-role="focused-session-log">No live worker log lines are available yet.</pre>
        </div>
      </details>
    </section>`;
  }

  return `<section class="canvas-section focused-session-panel" aria-label="Focused session detail" data-role="focused-session-panel" aria-live="polite">
    <div class="section-heading">
      <div>
        <div class="eyebrow">Focused session detail</div>
        <h2 data-role="focused-session-name">${escapeHtml(session.name)}</h2>
      </div>
      ${pageData.focusedSessionRole
        ? renderLinkAction(view === "home" ? "Open detail workspace" : "Clear focus", view === "home" ? buildSurfaceHref("sessions", session.role) : buildSurfaceHref(view, null))
        : ""}
    </div>
    <p class="support-copy" data-role="focused-session-activity">${escapeHtml(getSessionActivityLabel(session))}</p>
    <div class="chip-row">
      <span class="chip" data-role="focused-session-status">${escapeHtml(session.statusLabel)} · ${escapeHtml(session.readinessLabel)}</span>
      <span class="chip" data-role="focused-session-stage">${escapeHtml(session.currentStageLabel)}</span>
      <span class="chip" data-role="focused-session-freshness">${escapeHtml(session.freshnessLabel)} · ${escapeHtml(formatTimestamp(session.freshnessAt))}</span>
      <span class="chip" data-role="focused-session-log-state">${escapeHtml(session.logStateLabel)}</span>
    </div>
    <dl class="definition-grid detail-grid">
      <div>
        <dt>Worker identity</dt>
        <dd data-role="focused-session-identity">${escapeHtml(session.workerIdentityLabel)}</dd>
      </div>
      <div>
        <dt>Current stage</dt>
        <dd data-role="focused-session-stage-detail">${escapeHtml(session.currentStageLabel)}</dd>
      </div>
      <div>
        <dt>Resolved role</dt>
        <dd data-role="focused-session-resolved-role">${escapeHtml(session.resolvedRole || "Role matched the requested worker")}</dd>
      </div>
      <div>
        <dt>Logical role</dt>
        <dd data-role="focused-session-logical-role">${escapeHtml(session.logicalRole || "No logical override recorded")}</dd>
      </div>
      <div>
        <dt>Branch</dt>
        <dd data-role="focused-session-branch">${escapeHtml(session.currentBranch || "No branch recorded")}</dd>
      </div>
      <div>
        <dt>Pull requests</dt>
        <dd data-role="focused-session-pr-count">${escapeHtml(String(session.pullRequestCount))}</dd>
      </div>
      <div>
        <dt>Last active</dt>
        <dd data-role="focused-session-last-active">${escapeHtml(formatTimestamp(session.lastActiveAt))}</dd>
      </div>
      <div>
        <dt>Log freshness</dt>
        <dd data-role="focused-session-log-freshness">${escapeHtml(formatTimestamp(session.logUpdatedAt))}</dd>
      </div>
    </dl>
    <div class="canvas-columns detail-columns">
      <details class="detail-section" open>
        <summary>Recent actions</summary>
        <div data-role="focused-session-actions">${renderRecentActions(session)}</div>
      </details>
      <details class="detail-section" open>
        <summary>Repository context</summary>
        <div class="detail-stack">
          <div>
            <span class="caption">Pull request links</span>
            <div data-role="focused-session-prs">${renderTokenList(session.pullRequests, "No pull requests recorded yet.")}</div>
          </div>
          <div>
            <span class="caption">Touched files</span>
            <div data-role="focused-session-files">${renderTokenList(session.touchedFiles, "No touched files recorded yet.")}</div>
          </div>
        </div>
      </details>
    </div>
    <details class="detail-section detail-section-log" open>
      <summary>Readable log excerpt</summary>
      <div class="log-shell">
        <p class="support-copy" data-role="focused-session-log-meta">${escapeHtml(session.logSource ? `${session.logSource} · ${formatTimestamp(session.logUpdatedAt)}` : "Waiting for a live worker log excerpt.")}</p>
        <pre class="log-excerpt" data-role="focused-session-log">${escapeHtml(session.logExcerpt.join("\n") || "No live worker log lines are available yet.")}</pre>
      </div>
    </details>
  </section>`;
}

function renderFocusedSessionHost(
  session: AtlasSessionDto | null,
  pageData: AtlasPageData,
  view: AtlasView,
): string {
  return `<div data-role="focused-session-panel-host">${renderFocusedSessionDetail(session, pageData, view)}</div>`;
}

function renderSessionCard(session: AtlasSessionDto, focusedSessionRole: string | null): string {
  const isFocused = session.role === focusedSessionRole;
  const laneLabel = session.lane ? `${session.lane} lane` : "Shared lane";
  return `<article class="session-row${isFocused ? " session-row-focused" : ""}" aria-label="${escapeHtml(session.name)} session"${isFocused ? ' data-focus-state="focused"' : ""}>
    <div class="session-row-header">
      <div class="session-row-copy">
        <div class="eyebrow">${escapeHtml(laneLabel)}</div>
        <h3>${escapeHtml(session.name)}</h3>
        <p class="support-copy">${escapeHtml(getSessionActivityLabel(session))}</p>
      </div>
      <div class="chip-row">${renderStatusTags(session)}${isFocused ? '<span class="chip">Focused workspace</span>' : ""}</div>
    </div>
    <dl class="definition-grid">
      <div>
        <dt>Role</dt>
        <dd>${escapeHtml(session.role)}</dd>
      </div>
      <div>
        <dt>Branch</dt>
        <dd>${escapeHtml(session.currentBranch || "No branch recorded")}</dd>
      </div>
      <div>
        <dt>Last active</dt>
        <dd>${escapeHtml(formatTimestamp(session.lastActiveAt))}</dd>
      </div>
      <div>
        <dt>Files touched</dt>
        <dd>${escapeHtml(String(session.touchedFileCount))}</dd>
      </div>
    </dl>
    ${renderSessionActions(session, focusedSessionRole)}
  </article>`;
}

function renderSidebarSessionRail(pageData: AtlasPageData, _view: AtlasView): string {
  if (pageData.sessions.length === 0) {
    return `<div class="sidebar-empty">
      <strong>No session state is available yet.</strong>
      <p class="support-copy">ATLAS will surface tracked work here as soon as the next session is written.</p>
    </div>`;
  }

  return `<div class="session-rail" data-role="session-rail">
    ${pageData.sessions.map((session) => {
      const isSelected = session.role === pageData.focusedSessionRole || (!pageData.focusedSessionRole && session === pageData.sessions[0]);
      const containerTag = "a";
      const hrefAttribute = ` href="${escapeHtml(buildSurfaceHref("sessions", session.role))}"`;
      const currentAttribute = isSelected ? ' aria-current="true"' : "";
      return `<${containerTag} class="session-rail-link${isSelected ? " session-rail-link-selected" : ""}"${hrefAttribute}${currentAttribute}>
        <span class="session-rail-copy">
          <strong>${escapeHtml(session.name)}</strong>
          <span>${escapeHtml(session.statusLabel)} · ${escapeHtml(session.readinessLabel)}</span>
        </span>
        <span class="session-rail-meta">${escapeHtml(session.currentBranch || "No branch")}</span>
      </${containerTag}>`;
    }).join("")}
  </div>`;
}

function renderSidebar(pageData: AtlasPageData, view: AtlasView, counts: AtlasSessionCounts, activeSession: AtlasSessionDto | null): string {
  const sessionSummary = getSessionSummary(activeSession);
  return `<aside class="desktop-sidebar" aria-label="ATLAS desktop sidebar">
    <div class="sidebar-top">
      <div class="brand-block">
        <div class="brand-mark">A</div>
        <div>
          <div class="eyebrow">Native desktop workspace</div>
          <p class="product-title">ATLAS</p>
          <p class="product-copy">${escapeHtml(pageData.hostLabel)} · ${escapeHtml(pageData.pipelineDetail)}</p>
        </div>
      </div>
      <div class="repo-tag">${escapeHtml(pageData.repoLabel)}</div>
      ${renderNavigation(view, pageData.focusedSessionRole)}
    </div>

    <section class="sidebar-section" aria-label="Runtime status">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Runtime status</div>
          <h2 data-role="runtime-stage-label">${escapeHtml(pageData.pipelineStageLabel)}</h2>
        </div>
        <span class="meta-copy" data-role="runtime-updated-at">${escapeHtml(formatTimestamp(pageData.updatedAt))}</span>
      </div>
      <p class="support-copy" data-role="runtime-detail">${escapeHtml(pageData.homeReadinessHeading)} · ${escapeHtml(pageData.homeReadinessDetail)}</p>
      <p class="support-copy" data-role="session-start-detail">${escapeHtml(pageData.sessionStartStatusLabel)} · ${escapeHtml(pageData.sessionStartStatusDetail)}</p>
      <p class="support-copy" data-role="continuity-detail">${escapeHtml(pageData.continuityStatusLabel)} · ${escapeHtml(pageData.continuityStatusDetail)}</p>
      <div class="progress-rail" aria-hidden="true">
        <span data-role="runtime-progress-bar" style="width:${escapeHtml(String(clampPercent(pageData.pipelinePercent)))}%"></span>
      </div>
      <div class="chip-row" aria-label="Current runtime status">
        <span class="chip" data-role="runtime-readiness">${escapeHtml(pageData.homeReadinessHeading)}</span>
        <span class="chip" data-role="runtime-session-start">${escapeHtml(pageData.sessionStartStatusLabel)}</span>
        <span class="chip" data-role="runtime-continuity">${escapeHtml(pageData.continuityStatusLabel)}</span>
        <span class="chip" data-role="runtime-count-total">${escapeHtml(String(counts.total))} tracked sessions</span>
        <span class="chip" data-role="runtime-count-needs-input">${escapeHtml(String(counts.needsInput))} needing input</span>
        <span class="chip" data-role="runtime-count-paused">${escapeHtml(String(counts.paused))} paused lane${counts.paused === 1 ? "" : "s"}</span>
      </div>
    </section>

    <section class="sidebar-section" aria-label="Session focus">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Session focus</div>
          <h2>${escapeHtml(sessionSummary.heading)}</h2>
        </div>
        ${activeSession && (pageData.focusedSessionRole || pageData.missingFocusedSnapshot)
          ? renderLinkAction("Clear focus", buildSurfaceHref(view, null))
          : ""}
      </div>
      <p class="support-copy">${escapeHtml(sessionSummary.detail)}</p>
      <div class="definition-stack">
        <div>
          <span class="caption">Branch</span>
          <code>${escapeHtml(sessionSummary.branch)}</code>
        </div>
        <div>
          <span class="caption">Status</span>
          <strong>${escapeHtml(sessionSummary.status)}</strong>
        </div>
      </div>
    </section>

    <section class="sidebar-section sidebar-section-fill" aria-label="Tracked sessions rail">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Tracked sessions</div>
          <h2>Persistent left sidebar</h2>
        </div>
        <span class="meta-copy">${escapeHtml(String(counts.resumable))} resumable</span>
      </div>
      ${renderSidebarSessionRail(pageData, view)}
    </section>
  </aside>`;
}

function renderWorkspaceCanvas(pageData: AtlasPageData, counts: AtlasSessionCounts, activeSession: AtlasSessionDto | null): string {
  const hasSessions = counts.total > 0;
  return `<section class="workspace-canvas" aria-label="Chat-first workspace">
    <section class="canvas-section canvas-hero">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Desktop workspace</div>
          <h1>${escapeHtml(hasSessions ? "What should ATLAS do next?" : "Where should we start?")}</h1>
        </div>
        <p class="support-copy">${escapeHtml(hasSessions
          ? "The left rail, central composer, and inline detail pane stay live in one workspace."
          : "Start the first session from the central composer and ATLAS will hydrate the detail pane inline.")}</p>
      </div>
      <div class="chip-row">
        <span class="chip">${escapeHtml(String(counts.total))} tracked sessions</span>
        <span class="chip">${escapeHtml(String(counts.resumable))} resumable</span>
        <span class="chip">${escapeHtml(String(counts.needsInput))} needing input</span>
        <span class="chip">${escapeHtml(String(counts.paused))} paused lane${counts.paused === 1 ? "" : "s"}</span>
      </div>
    </section>

    ${renderFocusedSessionHost(activeSession, pageData, "home")}

    <section class="canvas-section" aria-label="Tracked sessions">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Tracked sessions</div>
          <h2>Inline session ledger</h2>
        </div>
        <p class="support-copy">Focus stays inline, so lifecycle actions, freshness, and readable logs update without switching product modes.</p>
      </div>
      ${pageData.sessions.length > 0
        ? `<div class="session-list" data-role="session-list">${pageData.sessions.map((session) => renderSessionCard(session, pageData.focusedSessionRole)).join("")}</div>`
        : '<div class="empty-state"><strong>No session state is available yet.</strong><p class="support-copy">ATLAS will surface tracked work here as soon as the next session is written.</p></div>'}
    </section>
  </section>`;
}

function renderComposer(view: AtlasView, pageData: AtlasPageData, activeSession: AtlasSessionDto | null): string {
  const continuity = resolveAtlasSessionSnapshotContinuity(
    pageData.sessions,
    pageData.focusedSessionRole,
    pageData.missingFocusedSnapshot === true,
  );
  const returnTo = buildSurfaceHref(view, pageData.focusedSessionRole);
  const composerHeading = continuity.missingFocusedSnapshot
    ? "Start the next session while the old focus recovers"
    : (!continuity.hasLiveSessions ? "Start a new session" : "Start the next session");
  const composerDetail = continuity.missingFocusedSnapshot
    ? "The previous focus is missing its next live snapshot, but you can still write the next outcome here and keep the workspace moving."
    : (!continuity.hasLiveSessions
        ? "There is no live session yet. Write one outcome here to start from the main workspace instead of a separate onboarding screen."
        : (activeSession
            ? `Write the next outcome here, then use the left rail to inspect ${activeSession.name} or any other tracked session.`
            : pageData.homeReadinessDetail));

  const actions = [
    renderLifecycleForm("Stop runtime", "stop", {
      returnTo,
      tone: "secondary",
    }),
  ];

  if (activeSession) {
    actions.push(activeSession.role === pageData.focusedSessionRole
      ? renderLinkAction("Clear focus", buildSurfaceHref(view, null))
      : renderLinkAction("Focus session", buildSurfaceHref(view, activeSession.role)));

    if (activeSession.lane) {
      actions.push(activeSession.isPaused
        ? renderLifecycleForm("Resume lane", "resume", { role: activeSession.role, returnTo })
        : renderLifecycleForm("Pause lane", "pause", { role: activeSession.role, returnTo }));
    }

    if (activeSession.canArchive) {
      actions.push(renderLifecycleForm("Archive session", "archive", { role: activeSession.role, returnTo }));
    }
  }

  if (pageData.missingFocusedSnapshot) {
    actions.push(renderLinkAction("Clear focus", buildSurfaceHref(view, null)));
  }

  return `<section
    class="desktop-composer"
    aria-label="Desktop composer"
    data-role="product-composer"
    data-view="${escapeHtml(view)}"
    data-focused-session-role="${escapeHtml(pageData.focusedSessionRole || "")}"
    data-missing-focused-snapshot="${continuity.missingFocusedSnapshot ? "true" : "false"}"
    data-has-live-sessions="${continuity.hasLiveSessions ? "true" : "false"}">
    <div class="composer-copy">
      <div class="eyebrow">Desktop composer</div>
      <h2>${escapeHtml(composerHeading)}</h2>
      <p class="support-copy">${escapeHtml(composerDetail)}</p>
    </div>
    <div class="composer-body">
      <form class="product-composer-form" id="atlas-product-composer-form" data-role="product-composer-form">
        <label class="composer-field">
          <span class="caption">Message ATLAS</span>
          <textarea
            class="composer-input"
            data-role="product-composer-input"
            name="objective"
            rows="4"
            placeholder="Describe the next delivery outcome. Submitting here records the brief in the main workspace and keeps session detail in the left rail."></textarea>
        </label>
        <div class="composer-status">
          <p class="support-copy" data-role="product-composer-status">Loading the saved workspace draft...</p>
          <p class="support-copy" data-role="product-composer-detail">ATLAS keeps this draft in the desktop shell state so accidental close and reopen recovery feels deliberate.</p>
          <p class="composer-error" data-role="product-composer-error"></p>
        </div>
      </form>
      <div class="composer-actions">
        <button class="action-button primary" type="submit" form="atlas-product-composer-form">${escapeHtml(view === "sessions" && activeSession ? "Update session brief" : "Start session")}</button>
        ${actions.join("")}
      </div>
    </div>
  </section>`;
}

function renderComposerScript(): string {
  return `<script>
(() => {
  const bridge = window.atlasDesktop;
  const composerRoot = document.querySelector("[data-role='product-composer']");
  const form = document.querySelector("[data-role='product-composer-form']");
  const input = document.querySelector("[data-role='product-composer-input']");
  const statusEl = document.querySelector("[data-role='product-composer-status']");
  const detailEl = document.querySelector("[data-role='product-composer-detail']");
  const errorEl = document.querySelector("[data-role='product-composer-error']");

  if (!(composerRoot instanceof HTMLElement)
    || !(form instanceof HTMLFormElement)
    || !(input instanceof HTMLTextAreaElement)
    || !(statusEl instanceof HTMLElement)
    || !(detailEl instanceof HTMLElement)
    || !(errorEl instanceof HTMLElement)) {
    return;
  }

  const continuityDetail = composerRoot.dataset.missingFocusedSnapshot === "true"
    ? "The saved focus target is still waiting on its next live session snapshot. The desktop shell stays usable and keeps this draft in place."
    : (composerRoot.dataset.hasLiveSessions === "true"
        ? "ATLAS keeps this draft in the desktop shell state so accidental close and reopen recovery feels deliberate."
        : "No live session snapshot is available yet, but the shell still restores this draft and surface cleanly.");
  let saveTimer = null;
  let refreshTimer = null;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  const clampPercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, numeric));
  };
  const formatTimestamp = (value) => {
    if (!value) return "Waiting for the next state write";
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return "Waiting for the next state write";
    const year = timestamp.getUTCFullYear();
    const month = String(timestamp.getUTCMonth() + 1).padStart(2, "0");
    const day = String(timestamp.getUTCDate()).padStart(2, "0");
    const hour = String(timestamp.getUTCHours()).padStart(2, "0");
    const minute = String(timestamp.getUTCMinutes()).padStart(2, "0");
    return year + "-" + month + "-" + day + " " + hour + ":" + minute + " UTC";
  };
  const countSessions = (sessions) => sessions.reduce((counts, session) => ({
    total: counts.total + 1,
    needsInput: counts.needsInput + (session.needsInput ? 1 : 0),
    resumable: counts.resumable + (session.isResumable ? 1 : 0),
    paused: counts.paused + (session.isPaused ? 1 : 0),
  }), {
    total: 0,
    needsInput: 0,
    resumable: 0,
    paused: 0,
  });
  const getPrimarySession = (sessions) => sessions.find((session) => session.status === "working")
    || sessions.find((session) => session.needsInput)
    || sessions.find((session) => session.isResumable)
    || sessions[0]
    || null;
  const getActiveSession = (pageData) => pageData.sessions.find((session) => session.role === pageData.focusedSessionRole)
    || getPrimarySession(pageData.sessions);
  const buildSurfaceHref = (_view, focusedSessionRole) => {
    const params = new URLSearchParams();
    if (focusedSessionRole) {
      params.set("focusRole", focusedSessionRole);
    }
    const pathname = "/";
    const query = params.toString();
    return query ? pathname + "?" + query : pathname;
  };
  const renderSessionRail = (pageData) => pageData.sessions.map((session, index) => {
    const isSelected = session.role === pageData.focusedSessionRole || (!pageData.focusedSessionRole && index === 0);
    return '<a class="session-rail-link' + (isSelected ? " session-rail-link-selected" : "") + '" href="'
      + escapeHtml(buildSurfaceHref("sessions", session.role)) + '"' + (isSelected ? ' aria-current="true"' : "") + '>'
      + '<span class="session-rail-copy"><strong>' + escapeHtml(session.name) + '</strong><span>'
      + escapeHtml(session.statusLabel) + " · " + escapeHtml(session.readinessLabel) + "</span></span>"
      + '<span class="session-rail-meta">' + escapeHtml(session.currentBranch || "No branch") + "</span></a>";
  }).join("");
  const renderTokenList = (items, emptyLabel) => {
    if (!Array.isArray(items) || items.length === 0) {
      return '<p class="support-copy">' + escapeHtml(emptyLabel) + "</p>";
    }
    return '<div class="token-list">' + items.map((item) => '<span class="detail-token">' + escapeHtml(item) + "</span>").join("") + "</div>";
  };
  const renderRecentActions = (session) => {
    if (!Array.isArray(session?.recentActions) || session.recentActions.length === 0) {
      return '<p class="support-copy">No meaningful worker actions have been recorded yet.</p>';
    }
    return '<ol class="detail-list">' + session.recentActions.map((action) => '<li><strong>'
      + escapeHtml(action.summary)
      + '</strong><span>' + escapeHtml(action.statusLabel)
      + (action.actor ? " · " + escapeHtml(action.actor) : "")
      + (action.at ? " · " + escapeHtml(formatTimestamp(action.at)) : "")
      + "</span></li>").join("") + "</ol>";
  };
  const renderFocusedSessionPanel = (session, pageData) => {
    if (!session) {
      return '<section class="canvas-section focused-session-panel" aria-label="Focused session detail" data-role="focused-session-panel" aria-live="polite">'
        + '<div class="section-heading"><div><div class="eyebrow">Focused session detail</div><h2 data-role="focused-session-name">Waiting for the next live detail</h2></div></div>'
        + '<p class="support-copy" data-role="focused-session-activity">Focus a tracked session from the left rail or start a new one to hydrate worker detail inline.</p>'
        + '<div class="chip-row"><span class="chip" data-role="focused-session-status">' + escapeHtml(pageData.sessionStartStatusLabel || "Ready to start") + '</span>'
        + '<span class="chip" data-role="focused-session-stage">' + escapeHtml(pageData.continuityStatusLabel || "Waiting for live snapshot") + '</span>'
        + '<span class="chip" data-role="focused-session-freshness">Freshness ' + escapeHtml(formatTimestamp(pageData.sessionStartUpdatedAt || null)) + '</span></div>'
        + '<p class="support-copy" data-role="focused-session-continuity">' + escapeHtml(pageData.continuityStatusDetail || "") + '</p>'
        + '<details class="detail-section detail-section-log" open><summary>Readable log excerpt</summary><div class="log-shell"><p class="support-copy" data-role="focused-session-log-meta">'
        + escapeHtml(pageData.continuityStatusLabel || "Waiting for live snapshot")
        + '</p><pre class="log-excerpt" data-role="focused-session-log">No live worker log lines are available yet.</pre></div></details></section>';
    }
    const actionHref = buildSurfaceHref("home", null);
    const actionLabel = "Clear focus";
    const logMeta = session.logSource
      ? session.logSource + " · " + formatTimestamp(session.logUpdatedAt)
      : "Waiting for a live worker log excerpt.";
    return '<section class="canvas-section focused-session-panel" aria-label="Focused session detail" data-role="focused-session-panel" aria-live="polite">'
      + '<div class="section-heading"><div><div class="eyebrow">Focused session detail</div><h2 data-role="focused-session-name">'
      + escapeHtml(session.name)
      + '</h2></div>'
      + (pageData.focusedSessionRole ? '<a class="action-button secondary" href="' + escapeHtml(actionHref) + '">' + escapeHtml(actionLabel) + '</a>' : "")
      + '</div><p class="support-copy" data-role="focused-session-activity">' + escapeHtml(session.latestMeaningfulAction || session.lastTask || "Waiting for the next product-facing task.") + '</p>'
      + '<div class="chip-row"><span class="chip" data-role="focused-session-status">' + escapeHtml(session.statusLabel) + " · " + escapeHtml(session.readinessLabel) + '</span>'
      + '<span class="chip" data-role="focused-session-stage">' + escapeHtml(session.currentStageLabel) + '</span>'
      + '<span class="chip" data-role="focused-session-freshness">' + escapeHtml(session.freshnessLabel || "Waiting for live snapshot") + ' · ' + escapeHtml(formatTimestamp(session.freshnessAt)) + '</span>'
      + '<span class="chip" data-role="focused-session-log-state">' + escapeHtml(session.logStateLabel || "Waiting for live log") + '</span></div>'
      + '<dl class="definition-grid detail-grid">'
      + '<div><dt>Worker identity</dt><dd data-role="focused-session-identity">' + escapeHtml(session.workerIdentityLabel) + '</dd></div>'
      + '<div><dt>Current stage</dt><dd data-role="focused-session-stage-detail">' + escapeHtml(session.currentStageLabel) + '</dd></div>'
      + '<div><dt>Resolved role</dt><dd data-role="focused-session-resolved-role">' + escapeHtml(session.resolvedRole || "Role matched the requested worker") + '</dd></div>'
      + '<div><dt>Logical role</dt><dd data-role="focused-session-logical-role">' + escapeHtml(session.logicalRole || "No logical override recorded") + '</dd></div>'
      + '<div><dt>Branch</dt><dd data-role="focused-session-branch">' + escapeHtml(session.currentBranch || "No branch recorded") + '</dd></div>'
      + '<div><dt>Pull requests</dt><dd data-role="focused-session-pr-count">' + escapeHtml(String(session.pullRequestCount || 0)) + '</dd></div>'
      + '<div><dt>Last active</dt><dd data-role="focused-session-last-active">' + escapeHtml(formatTimestamp(session.lastActiveAt)) + '</dd></div>'
      + '<div><dt>Log freshness</dt><dd data-role="focused-session-log-freshness">' + escapeHtml(formatTimestamp(session.logUpdatedAt)) + '</dd></div>'
      + '</dl><div class="canvas-columns detail-columns">'
      + '<details class="detail-section" open><summary>Recent actions</summary><div data-role="focused-session-actions">' + renderRecentActions(session) + '</div></details>'
      + '<details class="detail-section" open><summary>Repository context</summary><div class="detail-stack"><div><span class="caption">Pull request links</span><div data-role="focused-session-prs">'
      + renderTokenList(session.pullRequests, "No pull requests recorded yet.")
      + '</div></div><div><span class="caption">Touched files</span><div data-role="focused-session-files">'
      + renderTokenList(session.touchedFiles, "No touched files recorded yet.")
      + '</div></div></div></details></div>'
      + '<details class="detail-section detail-section-log" open><summary>Readable log excerpt</summary><div class="log-shell"><p class="support-copy" data-role="focused-session-log-meta">'
      + escapeHtml(logMeta)
      + '</p><pre class="log-excerpt" data-role="focused-session-log">'
      + escapeHtml((Array.isArray(session.logExcerpt) && session.logExcerpt.length > 0 ? session.logExcerpt.join("\n") : "No live worker log lines are available yet."))
      + "</pre></div></details></section>";
  };
  const applySnapshot = (payload) => {
    if (!payload?.ok || !payload?.pageData) {
      return;
    }
    const pageData = payload.pageData;
    const continuitySource = payload.continuitySource === "cached" ? "cached" : "live";
    const resolvedContinuityLabel = continuitySource === "cached"
      ? "Cached snapshot in use"
      : String(pageData.continuityStatusLabel || "Waiting for live snapshot");
    const resolvedContinuityDetail = continuitySource === "cached"
      ? String(payload.continuityDetail || "ATLAS is temporarily showing the last successful desktop snapshot while the next live refresh recovers.")
      : String(pageData.continuityStatusDetail || "");
    const counts = countSessions(Array.isArray(pageData.sessions) ? pageData.sessions : []);
    const activeSession = getActiveSession(pageData);
    composerRoot.dataset.focusedSessionRole = String(pageData.focusedSessionRole || "");
    composerRoot.dataset.missingFocusedSnapshot = pageData.missingFocusedSnapshot ? "true" : "false";
    composerRoot.dataset.hasLiveSessions = pageData.sessions?.length > 0 ? "true" : "false";
    const runtimeStageEl = document.querySelector("[data-role='runtime-stage-label']");
    const runtimeUpdatedAtEl = document.querySelector("[data-role='runtime-updated-at']");
    const runtimeDetailEl = document.querySelector("[data-role='runtime-detail']");
    const sessionStartDetailEl = document.querySelector("[data-role='session-start-detail']");
    const continuityDetailEl = document.querySelector("[data-role='continuity-detail']");
    const runtimeProgressBarEl = document.querySelector("[data-role='runtime-progress-bar']");
    const runtimeReadinessEl = document.querySelector("[data-role='runtime-readiness']");
    const runtimeSessionStartEl = document.querySelector("[data-role='runtime-session-start']");
    const runtimeContinuityEl = document.querySelector("[data-role='runtime-continuity']");
    const runtimeTotalEl = document.querySelector("[data-role='runtime-count-total']");
    const runtimeNeedsInputEl = document.querySelector("[data-role='runtime-count-needs-input']");
    const runtimePausedEl = document.querySelector("[data-role='runtime-count-paused']");
    const sessionRailEl = document.querySelector("[data-role='session-rail']");
    const focusedPanelHostEl = document.querySelector("[data-role='focused-session-panel-host']");
    if (runtimeStageEl instanceof HTMLElement) runtimeStageEl.textContent = String(pageData.pipelineStageLabel || "Idle");
    if (runtimeUpdatedAtEl instanceof HTMLElement) runtimeUpdatedAtEl.textContent = formatTimestamp(pageData.updatedAt || null);
    if (runtimeDetailEl instanceof HTMLElement) runtimeDetailEl.textContent = String(pageData.homeReadinessHeading || "Ready") + " · " + String(pageData.homeReadinessDetail || "");
    if (sessionStartDetailEl instanceof HTMLElement) sessionStartDetailEl.textContent = String(pageData.sessionStartStatusLabel || "Ready to start") + " · " + String(pageData.sessionStartStatusDetail || "");
    if (continuityDetailEl instanceof HTMLElement) continuityDetailEl.textContent = resolvedContinuityLabel + " · " + resolvedContinuityDetail;
    if (runtimeProgressBarEl instanceof HTMLElement) runtimeProgressBarEl.style.width = String(clampPercent(pageData.pipelinePercent)) + "%";
    if (runtimeReadinessEl instanceof HTMLElement) runtimeReadinessEl.textContent = String(pageData.homeReadinessHeading || "Ready");
    if (runtimeSessionStartEl instanceof HTMLElement) runtimeSessionStartEl.textContent = String(pageData.sessionStartStatusLabel || "Ready to start");
    if (runtimeContinuityEl instanceof HTMLElement) runtimeContinuityEl.textContent = resolvedContinuityLabel;
    if (runtimeTotalEl instanceof HTMLElement) runtimeTotalEl.textContent = String(counts.total) + " tracked sessions";
    if (runtimeNeedsInputEl instanceof HTMLElement) runtimeNeedsInputEl.textContent = String(counts.needsInput) + " needing input";
    if (runtimePausedEl instanceof HTMLElement) runtimePausedEl.textContent = String(counts.paused) + " paused lane" + (counts.paused === 1 ? "" : "s");
    if (sessionRailEl instanceof HTMLElement) sessionRailEl.innerHTML = renderSessionRail(pageData);
    if (focusedPanelHostEl instanceof HTMLElement) focusedPanelHostEl.innerHTML = renderFocusedSessionPanel(activeSession, pageData);
  };
  const requestSnapshot = async () => {
    const focusedSessionRole = String(composerRoot.dataset.focusedSessionRole || "");
    if (bridge?.refreshSnapshot) {
      return bridge.refreshSnapshot({
        view: "home",
        focusRole: focusedSessionRole || null,
      });
    }
    throw new Error("ATLAS snapshot refresh requires the Electron desktop bridge.");
  };
  const refreshSnapshot = async () => {
    try {
      applySnapshot(await requestSnapshot());
    } catch (error) {
      console.error("[atlas] live snapshot refresh failed:", error);
    }
  };
  const startSnapshotRefresh = () => {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
    }
    refreshTimer = window.setInterval(() => {
      void refreshSnapshot();
    }, 15000);
  };

  const setComposerStatus = (message, detail) => {
    statusEl.textContent = message;
    detailEl.textContent = detail || continuityDetail;
  };

  const persistDraft = async (value, options = {}) => {
    if (!bridge?.setProductDraft) {
      return;
    }
    try {
      await bridge.setProductDraft(value);
      if (options.silent === true) {
        return;
      }
      if (String(value || "").trim()) {
        setComposerStatus("Saved the workspace draft for this session shell.", continuityDetail);
      } else {
        setComposerStatus("The message box is empty.", continuityDetail);
      }
    } catch (error) {
      console.error("[atlas] product draft save failed:", error);
      setComposerStatus(
        "Draft save failed. Keep the text here and retry when the desktop bridge is responsive again.",
        String(error?.message || error || ""),
      );
    }
  };

  const persistComposerFocus = async (focused) => {
    if (!bridge?.setProductComposerFocus) {
      return;
    }
    try {
      await bridge.setProductComposerFocus(focused === true);
    } catch (error) {
      console.error("[atlas] product composer focus save failed:", error);
    }
  };

  const queueDraftSave = () => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      void persistDraft(String(input.value || ""));
    }, 180);
  };

  const loadClarificationStatus = async () => {
    try {
      const response = await window.fetch("/api/onboarding/status", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      if (payload?.ready && payload?.packet) {
        const packetSummary = String(payload.packet.summary || continuityDetail);
        const packetObjective = String(payload.packet.objective || "").trim();
        if (!String(input.value || "").trim() && packetObjective) {
          input.value = packetObjective;
          await persistDraft(packetObjective, { silent: true });
          setComposerStatus("Restored the last session brief for this desktop shell.", packetSummary);
          return;
        }
        if (payload.packet.summary) {
          setComposerStatus("Restored the desktop workspace with the latest session brief.", packetSummary);
        }
      }
    } catch (error) {
      console.error("[atlas] product composer status load failed:", error);
    }
  };

  const bootstrapComposer = async () => {
    if (!bridge?.getDesktopState) {
      setComposerStatus(
        "Desktop state recovery is unavailable in this surface.",
        "The composer stays editable, but draft recovery requires the Electron desktop bridge.",
      );
      return;
    }

    try {
      const desktopState = await bridge.getDesktopState();
      if (desktopState.productDraft) {
        input.value = desktopState.productDraft;
        setComposerStatus("Restored the saved workspace draft for this desktop session.", continuityDetail);
      } else {
        setComposerStatus("Message box ready.", continuityDetail);
      }

      if (desktopState.productComposerFocused) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    } catch (error) {
      console.error("[atlas] product composer bootstrap failed:", error);
      setComposerStatus(
        "Desktop state recovery failed.",
        "ATLAS could not read the saved shell state, but the workspace remains available.",
      );
    }

    await loadClarificationStatus();
    await refreshSnapshot();
    startSnapshotRefresh();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    errorEl.textContent = "";

    const startSession = bridge?.startSession || bridge?.submitClarification;
    if (!startSession) {
      errorEl.textContent = "ATLAS could not reach the session bridge for this desktop shell.";
      setComposerStatus(
        "Session start is unavailable.",
        "The product composer can keep text locally, but submitting the brief needs the Electron desktop bridge.",
      );
      return;
    }

    const objective = String(input.value || "").trim();
    if (!objective) {
      errorEl.textContent = "Describe the next delivery outcome before starting the session.";
      setComposerStatus("The composer is still waiting on a concrete message.", continuityDetail);
      input.focus();
      return;
    }

    setComposerStatus(
      "Submitting the session brief from the main workspace.",
      "ATLAS keeps the draft, records the brief, and reopens the workspace in the same window.",
    );
    void persistComposerFocus(true);
    void startSession(objective).then((result) => {
      if (!result.ok) {
        errorEl.textContent = result.error || "ATLAS could not start the session brief.";
        setComposerStatus(
          "Session start failed. The draft is still preserved in this desktop shell.",
          "Review the error, keep editing, and retry after the provider is available.",
        );
        return;
      }

      setComposerStatus(
        "Session brief recorded in the main workspace.",
        String(result?.packet?.summary || "Open any tracked session from the left rail to inspect its detail view."),
      );
      window.location.assign("/");
    }).catch((error) => {
      console.error("[atlas] product composer submit failed:", error);
      errorEl.textContent = String(error?.message || error || "ATLAS could not start the session brief.");
      setComposerStatus(
        "Session start failed. The draft is still preserved in this desktop shell.",
        "Review the shell logs, keep the draft, and retry when the desktop bridge is responsive.",
      );
    });
  });

  input.addEventListener("input", () => {
    errorEl.textContent = "";
    queueDraftSave();
  });
  input.addEventListener("focus", () => {
    void persistComposerFocus(true);
  });
  input.addEventListener("blur", () => {
    void persistComposerFocus(false);
    void persistDraft(String(input.value || ""));
  });
  window.addEventListener("beforeunload", () => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
    void persistDraft(String(input.value || ""));
  });

  void bootstrapComposer();
})();
  </script>`;
}

function renderAtlasAppShell(pageData: AtlasPageData, view: AtlasView): string {
  const counts = countSessions(pageData.sessions);
  const pageTitle = view === "sessions" ? "ATLAS Sessions" : pageData.title;
  const activeSession = getActiveSessionFocus(pageData);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070707;
      --bg-soft: #111111;
      --panel: #141414;
      --panel-strong: #1a1a1a;
      --line: rgba(255, 255, 255, 0.12);
      --line-strong: rgba(255, 255, 255, 0.28);
      --text: #f5f5f5;
      --muted: #bbbbbb;
      --muted-strong: #d4d4d4;
      --shadow: 0 24px 72px rgba(0, 0, 0, 0.34);
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 16%),
        linear-gradient(180deg, #020202 0%, var(--bg) 36%, #0b0b0b 100%);
      color: var(--text);
      font-family: "Segoe UI Variable Display", "Segoe UI", Arial, sans-serif;
    }
    a, button { font: inherit; }
    a { color: inherit; text-decoration: none; }
    code {
      display: inline-block;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: #0d0d0d;
      color: var(--muted-strong);
      font-family: "Cascadia Code", Consolas, monospace;
      word-break: break-word;
    }
    a:focus-visible,
    button:focus-visible {
      outline: 3px solid #ffffff;
      outline-offset: 2px;
    }
    main {
      padding: 20px;
    }
    .shell {
      display: grid;
      grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
      gap: 20px;
      min-height: calc(100vh - 40px);
    }
    .desktop-sidebar,
    .workspace-shell,
    .workspace-canvas,
    .session-list,
    .definition-grid,
    .chip-row,
    .cta-row,
    .action-row,
    .canvas-columns,
    .stats-grid,
    .composer-actions {
      display: grid;
      gap: 12px;
    }
    .desktop-sidebar,
    .workspace-shell,
    .canvas-section,
    .desktop-composer,
    .session-row {
      border-radius: 24px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(20, 20, 20, 0.96), rgba(12, 12, 12, 0.96));
      box-shadow: var(--shadow);
    }
    .desktop-sidebar {
      position: sticky;
      top: 20px;
      align-self: start;
      min-height: calc(100vh - 40px);
      padding: 18px;
      grid-template-rows: auto auto auto minmax(0, 1fr);
    }
    .workspace-shell {
      min-height: calc(100vh - 40px);
      padding: 18px;
      grid-template-rows: minmax(0, 1fr) auto;
    }
      .workspace-canvas {
        align-content: start;
        gap: 16px;
      }
    .canvas-section {
      padding: 22px;
    }
    .home-stage {
      width: min(760px, 100%);
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 12px;
      margin-top: 0;
    }
    .home-stage-copy {
      display: grid;
      gap: 12px;
    }
    .home-stage-support {
      max-width: 620px;
      font-size: 16px;
    }
    .canvas-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }
    .brand-block {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .brand-mark {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      border: 1px solid var(--line-strong);
      background: #ffffff;
      color: #050505;
      font-weight: 700;
      letter-spacing: 0.06em;
    }
    .eyebrow,
    .caption,
    .meta-copy,
    dt {
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .product-title {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.04em;
    }
    .product-copy,
    .support-copy,
    dd {
      margin: 0;
      color: var(--muted-strong);
      line-height: 1.6;
    }
    .product-copy { max-width: 720px; }
    .repo-tag,
    .chip,
    .nav-link,
    .action-button,
    .empty-state,
    .sidebar-empty,
    .session-rail-link,
    .stat-pill {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
    }
    .repo-tag,
    .nav-link,
    .chip,
    .action-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 10px 14px;
    }
    .nav {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .nav-link[aria-current="page"] {
      background: #ffffff;
      color: #050505;
      border-color: #ffffff;
      font-weight: 600;
    }
    .sidebar-top,
    .sidebar-section {
      display: grid;
      gap: 14px;
    }
    .sidebar-section {
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);
    }
    .sidebar-section-fill {
      align-content: start;
    }
    .session-row-focused,
    .session-rail-link-selected {
      border-color: rgba(255, 255, 255, 0.42);
      background: linear-gradient(180deg, rgba(28, 28, 28, 0.98), rgba(14, 14, 14, 0.98));
    }
    h1,
    .section-heading h2,
    h3 {
      margin: 0;
      letter-spacing: -0.04em;
    }
    h1 {
      font-size: clamp(34px, 5vw, 56px);
      line-height: 1.02;
      max-width: 860px;
    }
    .lead {
      margin: 14px 0 0;
      max-width: 760px;
      color: var(--muted-strong);
      font-size: 17px;
      line-height: 1.7;
    }
    .chip-row {
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      align-items: start;
      justify-content: start;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .definition-stack {
      display: grid;
      gap: 8px;
    }
    .cta-row {
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      justify-content: start;
    }
    .primary-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 14px;
      background: #ffffff;
      color: #050505;
      font-weight: 600;
    }
    .action-form { display: inline-flex; }
    .action-button {
      cursor: pointer;
      color: var(--text);
    }
    .action-button.primary {
      background: #ffffff;
      color: #050505;
      border-color: #ffffff;
      font-weight: 600;
    }
    .progress-rail {
      height: 10px;
      margin-top: 18px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.06);
    }
    .progress-rail > span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #ffffff, #8d8d8d);
    }
    .section-heading {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: end;
      flex-wrap: wrap;
    }
    .session-list {
      gap: 14px;
    }
    .session-row {
      padding: 18px;
    }
    .session-row-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
      flex-wrap: wrap;
    }
     .definition-grid {
       grid-template-columns: repeat(2, minmax(0, 1fr));
       margin: 16px 0 0;
     }
     .detail-grid,
     .detail-columns {
       margin-top: 18px;
     }
     dd {
       margin-top: 6px;
       font-size: 15px;
       word-break: break-word;
     }
     .detail-stack,
     .log-shell {
       display: grid;
       gap: 12px;
     }
     .detail-list {
       margin: 0;
       padding-left: 18px;
       display: grid;
       gap: 10px;
     }
     .detail-list li {
       display: grid;
       gap: 4px;
     }
     .token-list {
       display: flex;
       flex-wrap: wrap;
       gap: 8px;
       margin-top: 6px;
     }
     .detail-token {
       display: inline-flex;
       align-items: center;
       min-height: 32px;
       padding: 6px 10px;
       border-radius: 12px;
       border: 1px solid var(--line);
       background: rgba(255, 255, 255, 0.04);
       font-size: 13px;
       color: var(--muted-strong);
       word-break: break-word;
     }
     .detail-section {
       padding: 16px;
       border-radius: 18px;
       border: 1px solid rgba(255, 255, 255, 0.08);
       background: rgba(255, 255, 255, 0.02);
     }
     .detail-section > summary {
       cursor: pointer;
       font-weight: 600;
       list-style: none;
     }
     .detail-section > summary::-webkit-details-marker {
       display: none;
     }
     .detail-section[open] > summary {
       margin-bottom: 12px;
     }
     .log-excerpt {
       margin: 0;
       padding: 14px;
       border-radius: 16px;
       border: 1px solid var(--line);
       background: #0d0d0d;
       color: var(--muted-strong);
       font-family: "Cascadia Code", Consolas, monospace;
       font-size: 13px;
       line-height: 1.65;
       white-space: pre-wrap;
       word-break: break-word;
     }
     .action-row {
       grid-auto-flow: column;
       grid-auto-columns: max-content;
       justify-content: start;
       align-items: start;
    }
    .empty-state,
    .sidebar-empty {
      padding: 20px;
    }
    .session-rail {
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .session-rail-link {
      display: grid;
      gap: 6px;
      padding: 12px;
    }
    .session-rail-copy {
      display: grid;
      gap: 2px;
    }
    .session-rail-copy span,
    .session-rail-meta,
    .meta-copy {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .stat-pill {
      padding: 14px;
      display: grid;
      gap: 6px;
    }
    .stat-pill > span {
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .stat-pill strong {
      font-size: 24px;
      letter-spacing: -0.04em;
    }
     .desktop-composer {
       position: sticky;
       bottom: 18px;
       padding: 18px;
       display: grid;
       grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
       gap: 18px;
       align-items: start;
       background: linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(12, 12, 12, 0.98));
     }
      .composer-body,
      .product-composer-form,
      .composer-status,
     .composer-field {
       display: grid;
       gap: 10px;
     }
      .composer-input {
       width: 100%;
       min-height: 112px;
       padding: 14px;
       border-radius: 16px;
       border: 1px solid var(--line);
       background: rgba(255, 255, 255, 0.03);
       color: var(--text);
       resize: vertical;
       font: inherit;
       line-height: 1.6;
     }
     .composer-input:focus-visible {
       outline: 3px solid #ffffff;
       outline-offset: 2px;
     }
     .composer-error {
       margin: 0;
       min-height: 1.4em;
       color: #ffb0b0;
     }
     .composer-actions {
       grid-auto-flow: column;
       grid-auto-columns: max-content;
       align-items: center;
       justify-content: start;
     }
    @media (max-width: 960px) {
      .shell,
      .canvas-columns,
      .stats-grid,
      .desktop-composer,
      .composer-actions,
      .definition-grid {
        grid-template-columns: 1fr;
      }
      .desktop-sidebar,
      .workspace-shell,
      .desktop-composer {
        position: static;
        min-height: auto;
      }
    }
  </style>
</head>
  <body>
    <main>
      <section class="shell" aria-label="ATLAS desktop surface">
        ${renderSidebar(pageData, view, counts, activeSession)}
        <section class="workspace-shell" aria-label="ATLAS work canvas">
          ${renderWorkspaceCanvas(pageData, counts, activeSession)}
          ${renderComposer(view, pageData, activeSession)}
        </section>
      </section>
    </main>
    ${renderComposerScript()}
  </body>
</html>`;
}

export function renderAtlasHomeHtml(pageData: AtlasPageData): string {
  return renderAtlasAppShell(pageData, "home");
}

export function renderAtlasSessionsHtml(pageData: AtlasPageData): string {
  return renderAtlasAppShell(pageData, "sessions");
}
