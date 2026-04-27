import {
  resolveAtlasSessionSnapshotContinuity,
  type AtlasSessionDto,
} from "./state_bridge.js";

export type AtlasMainPaneMode = "new-session" | "selected-session";

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
  mainPaneMode?: AtlasMainPaneMode;
  focusedSessionRole: string | null;
  missingFocusedSnapshot: boolean;
  sessions: AtlasSessionDto[];
}

interface AtlasSessionCounts {
  total: number;
  active: number;
  needsInput: number;
  completed: number;
  resumable: number;
  paused: number;
}

interface AtlasSessionLiveStatusState {
  tone: "idle" | "active" | "attention" | "complete" | "offline";
  label: string;
  assistiveText: string;
  pulse: boolean;
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

function buildSurfaceHref(focusedSessionRole: string | null): string {
  const params = new URLSearchParams();
  if (focusedSessionRole) {
    params.set("focusRole", focusedSessionRole);
  }

  const pathname = "/";
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getSelectedSession(sessions: AtlasSessionDto[], focusedSessionRole: string | null): AtlasSessionDto | null {
  if (!focusedSessionRole) {
    return null;
  }
  return sessions.find((session) => session.role === focusedSessionRole) || null;
}

function resolveMainPaneMode(
  pageData: Pick<AtlasPageData, "mainPaneMode" | "focusedSessionRole" | "sessions">,
  selectedSession: AtlasSessionDto | null = getSelectedSession(pageData.sessions, pageData.focusedSessionRole),
): AtlasMainPaneMode {
  if (pageData.mainPaneMode === "selected-session" && selectedSession) {
    return "selected-session";
  }
  return selectedSession ? "selected-session" : "new-session";
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

function getSessionActivityLabel(session: AtlasSessionDto): string {
  return session.latestMeaningfulAction || session.lastTask || "Waiting for the next product-facing task.";
}

function getSessionLiveStatus(session: AtlasSessionDto): AtlasSessionLiveStatusState {
  return {
    tone: session.liveStatusTone,
    label: session.liveStatusLabel,
    assistiveText: session.liveStatusAssistiveText,
    pulse: session.liveStatusPulse,
  };
}

function renderLiveStatus(
  session: AtlasSessionDto,
  options: {
    dataRole: string;
    compact?: boolean;
    showLabel?: boolean;
  },
): string {
  const status = getSessionLiveStatus(session);
  const classes = [
    "live-status",
    `live-status-${status.tone}`,
    status.pulse ? "live-status-pulse" : "",
    options.compact ? "live-status-compact" : "",
  ].filter(Boolean).join(" ");
  const visibleLabel = options.showLabel === false
    ? ""
    : `<span class="live-status-label">${escapeHtml(status.label)}</span>`;

  return `<span
    class="${classes}"
    data-role="${escapeHtml(options.dataRole)}"
    aria-label="${escapeHtml(status.assistiveText)}"
    aria-live="polite"
    aria-atomic="true">
    <span class="live-status-dot" aria-hidden="true"></span>
    ${visibleLabel}
    <span class="sr-only">${escapeHtml(status.assistiveText)}</span>
  </span>`;
}

function renderLifecycleForm(
  label: string,
  action: "pause" | "resume" | "archive" | "stop",
  options: {
    role?: string | null;
    returnTo: string;
    tone?: "primary" | "secondary";
  },
): string {
  return `<form class="action-form" method="post" action="/lifecycle">
    <input type="hidden" name="action" value="${escapeHtml(action)}" />
    ${options.role ? `<input type="hidden" name="role" value="${escapeHtml(options.role)}" />` : ""}
    <input type="hidden" name="returnTo" value="${escapeHtml(options.returnTo)}" />
    <button class="action-button ${options.tone || "secondary"}" type="submit">${escapeHtml(label)}</button>
  </form>`;
}

function renderLinkAction(
  label: string,
  href: string,
  tone: "primary" | "secondary" = "secondary",
  options: {
    dataRole?: string;
    focusRole?: string | null;
  } = {},
): string {
  const roleAttribute = options.dataRole
    ? ` data-role="${escapeHtml(options.dataRole)}"`
    : "";
  const focusRoleAttribute = Object.hasOwn(options, "focusRole")
    ? ` data-focus-role="${escapeHtml(options.focusRole || "")}"`
    : "";
  return `<a class="action-button ${tone}" href="${escapeHtml(href)}"${roleAttribute}${focusRoleAttribute}>${escapeHtml(label)}</a>`;
}

function renderSelectedSessionActions(session: AtlasSessionDto, focusedSessionRole: string | null): string {
  const returnTo = buildSurfaceHref(session.role);
  const actions: string[] = [
    focusedSessionRole
      ? renderLinkAction("New Session", buildSurfaceHref(null), "primary", {
          dataRole: "selected-session-new-session-link",
          focusRole: null,
        })
      : renderLinkAction("Select Session", returnTo, "primary", {
          dataRole: "selected-session-link",
          focusRole: session.role,
        }),
    renderLifecycleForm("Stop runtime", "stop", {
      returnTo,
      tone: "secondary",
    }),
  ];

  if (session.lane) {
    actions.push(session.isPaused
      ? renderLifecycleForm("Resume lane", "resume", { role: session.role, returnTo })
      : renderLifecycleForm("Pause lane", "pause", { role: session.role, returnTo }));
  }

  if (session.canArchive) {
    actions.push(renderLifecycleForm("Archive session", "archive", { role: session.role, returnTo }));
  }

  return `<div class="action-row" data-role="selected-session-actions">${actions.join("")}</div>`;
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

function resolveNewSessionContinuityDetail(pageData: AtlasPageData): string {
  const continuity = resolveAtlasSessionSnapshotContinuity(
    pageData.sessions,
    pageData.focusedSessionRole,
    pageData.missingFocusedSnapshot === true,
  );

  if (continuity.missingFocusedSnapshot || !continuity.hasLiveSessions) {
    return pageData.continuityStatusDetail;
  }

  return pageData.sessionStartStatusDetail;
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

function renderSidebarSessionRail(pageData: AtlasPageData): string {
  if (pageData.sessions.length === 0) {
    return `<div class="sidebar-empty">
      <strong>No live rows yet.</strong>
      <p class="support-copy">Launch a new Atlas session to ignite the live command stream.</p>
    </div>`;
  }

  return `<div class="session-rail" data-role="session-rail">
    ${pageData.sessions.map((session) => {
      const isSelected = session.role === pageData.focusedSessionRole;
      return `<a
        class="session-rail-link${isSelected ? " session-rail-link-selected" : ""}"
        href="${escapeHtml(buildSurfaceHref(session.role))}"
        ${isSelected ? 'aria-current="true"' : ""}
        data-role="session-rail-link"
        data-focus-role="${escapeHtml(session.role)}"
        data-session-role="${escapeHtml(session.role)}">
        <div class="session-rail-row">
          <span class="session-rail-title">
            ${renderLiveStatus(session, {
              dataRole: "session-row-status-light",
              compact: true,
            })}
            <strong>${escapeHtml(session.name)}</strong>
          </span>
          <span class="session-rail-role">${escapeHtml(session.role)}</span>
        </div>
      </a>`;
    }).join("")}
  </div>`;
}

function renderSidebar(pageData: AtlasPageData): string {
  const hasSelection = resolveMainPaneMode(pageData) === "selected-session";
  return `<aside class="desktop-sidebar" aria-label="ATLAS desktop sidebar">
    <a class="sidebar-brand" href="/" data-role="brand-reset" data-focus-role="">
      <img class="brand-mark" src="/assets/atlas-logo.png" alt="Atlas logo" />
      <span class="brand-copy">
        <strong class="brand-title">Atlas</strong>
      </span>
    </a>
    <a
      class="sidebar-new-session${hasSelection ? "" : " sidebar-new-session-active"}"
      href="/"
      data-role="new-session-link"
      data-focus-role=""
      ${hasSelection ? "" : 'aria-current="page"'}>
      <strong>${escapeHtml(pageData.homePrimaryActionLabel || "New Session")}</strong>
    </a>
    <section class="sidebar-rail-section" aria-label="Live rows">
      <div class="section-heading">
        <h2>Live Rows</h2>
        <span class="sidebar-row-count">${escapeHtml(String(pageData.sessions.length))}</span>
      </div>
      <div data-role="session-rail-host">${renderSidebarSessionRail(pageData)}</div>
    </section>
  </aside>`;
}

function renderNewSessionView(pageData: AtlasPageData, counts: AtlasSessionCounts): string {
  const continuity = resolveAtlasSessionSnapshotContinuity(
    pageData.sessions,
    pageData.focusedSessionRole,
    pageData.missingFocusedSnapshot === true,
  );

  const heading = "What do you want Atlas to deliver today?";
  const continuityDetail = resolveNewSessionContinuityDetail(pageData);

  return `<section class="main-pane main-pane-start" aria-label="New session start screen" data-role="new-session-view">
    <div class="new-session-shell" data-role="new-session-shell">
      <div class="new-session-intro">
        <h1 class="new-session-tagline" data-role="new-session-heading">${escapeHtml(heading)}</h1>
        <p class="sr-only" data-role="new-session-session-count">${escapeHtml(String(counts.total))} tracked sessions</p>
      </div>
      <section
      class="composer-shell composer-shell-chat"
      aria-label="Desktop composer"
      data-role="product-composer"
      data-surface="workspace"
      data-focused-session-role="${escapeHtml(pageData.focusedSessionRole || "")}"
      data-missing-focused-snapshot="${continuity.missingFocusedSnapshot ? "true" : "false"}"
      data-has-live-sessions="${continuity.hasLiveSessions ? "true" : "false"}">
      <form class="product-composer-form" id="atlas-product-composer-form" data-role="product-composer-form">
        <div class="composer-field composer-field-chat">
          <span class="sr-only">What should ATLAS do next?</span>
          <div class="composer-entry-shell" data-role="composer-entry-shell">
            <button class="composer-inline-button composer-attach-button" type="button" data-role="composer-attach-button" aria-label="Add files to this session">+</button>
            <textarea
              class="composer-input composer-input-chat"
              data-role="product-composer-input"
              name="objective"
              rows="1"
              placeholder="Ask anything"></textarea>
            <button class="composer-inline-button composer-submit-button" type="submit" data-role="composer-submit-button" aria-label="Start session">
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d="M4 10h9"></path>
                <path d="M10 4l6 6-6 6"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="composer-attachment-list" data-role="composer-attachments" hidden></div>
        <div class="composer-footnote" data-role="new-session-footnote">
          <span class="chip" data-role="runtime-continuity">${escapeHtml(pageData.continuityStatusLabel)}</span>
          <span class="support-copy" data-role="continuity-detail">${escapeHtml(continuityDetail)}</span>
        </div>
        <div class="composer-status">
          <p class="support-copy" data-role="product-composer-status">Loading the saved workspace draft...</p>
          <p class="support-copy" data-role="product-composer-detail">ATLAS keeps this draft in the desktop shell state so close and reopen recovery stays deliberate.</p>
          <p class="composer-error" data-role="product-composer-error"></p>
        </div>
        <div class="composer-actions">
          <button class="action-button primary" type="submit" form="atlas-product-composer-form">Start session</button>
          ${renderLifecycleForm("Stop runtime", "stop", {
            returnTo: buildSurfaceHref(pageData.focusedSessionRole),
            tone: "secondary",
          })}
        </div>
      </form>
    </section>
    </div>
  </section>`;
}

function renderSelectedSessionView(session: AtlasSessionDto, pageData: AtlasPageData): string {
  const summary = getSessionActivityLabel(session);
  const logMeta = session.logSource
    ? `${session.logSource} · ${formatTimestamp(session.logUpdatedAt)}`
    : "Waiting for a live worker log excerpt.";

  return `<section class="main-pane main-pane-detail" aria-label="Selected session detail view" data-role="selected-session-view">
    <div class="selected-session-hero">
      <header class="selected-session-header">
        <div class="selected-session-header-copy">
          <div class="eyebrow">Current session</div>
          <div class="selected-session-title-row">
            <h1 data-role="selected-session-name">${escapeHtml(session.name)}</h1>
            ${renderLiveStatus(session, {
              dataRole: "selected-session-status-light",
            })}
          </div>
          <p class="lead" data-role="selected-session-activity">${escapeHtml(summary)}</p>
          <p class="support-copy selected-session-subline">
            <span data-role="selected-session-identity">${escapeHtml(session.workerIdentityLabel)}</span>
            <span class="selected-session-divider" aria-hidden="true">·</span>
            <span data-role="selected-session-stage">${escapeHtml(session.currentStageLabel)}</span>
            <span class="selected-session-divider" aria-hidden="true">·</span>
            <span data-role="selected-session-freshness">${escapeHtml(formatTimestamp(session.freshnessAt))}</span>
          </p>
        </div>
        ${renderSelectedSessionActions(session, pageData.focusedSessionRole)}
      </header>

      <div class="selected-session-thread">
        <article class="detail-card selected-session-message selected-session-message-primary" data-role="selected-session-summary-card">
          <div class="section-heading">
            <div>
              <div class="eyebrow">Latest meaningful update</div>
              <h2>What changed most recently</h2>
            </div>
          </div>
          <p class="selected-session-primary-update" data-role="selected-session-summary">${escapeHtml(summary)}</p>
          <div class="chip-row selected-session-chip-row">
            <span class="chip" data-role="selected-session-log-state">${escapeHtml(session.logStateLabel)}</span>
            <span class="chip">${escapeHtml(session.statusLabel)}</span>
            <span class="chip">${escapeHtml(session.readinessLabel)}</span>
            <span class="chip">${escapeHtml(formatTimestamp(session.lastActiveAt))}</span>
          </div>
        </article>

        <article class="detail-card selected-session-message" data-role="selected-session-updates">
          <div class="section-heading">
            <div>
              <div class="eyebrow">Recent notes</div>
              <h2>Recent actions</h2>
            </div>
          </div>
          ${renderRecentActions(session)}
        </article>

        <article class="detail-card selected-session-message" data-role="selected-session-log-card">
          <div class="section-heading">
            <div>
              <div class="eyebrow">Readable log</div>
              <h2>Latest worker output</h2>
            </div>
          </div>
          <p class="support-copy" data-role="selected-session-log-meta">${escapeHtml(logMeta)}</p>
          <pre class="log-excerpt" data-role="selected-session-log">${escapeHtml(session.logExcerpt.join("\n") || "No live worker log lines are available yet.")}</pre>
        </article>

        <article class="detail-card selected-session-message" data-role="selected-session-context">
          <div class="section-heading">
            <div>
              <div class="eyebrow">Repo context</div>
              <h2>Branch, PRs, and files</h2>
            </div>
          </div>
          <dl class="definition-grid selected-session-context-grid">
            <div>
              <dt>Branch</dt>
              <dd data-role="selected-session-branch">${escapeHtml(session.currentBranch || "No branch recorded")}</dd>
            </div>
            <div>
              <dt>Resolved role</dt>
              <dd data-role="selected-session-resolved-role">${escapeHtml(session.resolvedRole || "Role matched the requested worker")}</dd>
            </div>
            <div>
              <dt>Logical role</dt>
              <dd data-role="selected-session-logical-role">${escapeHtml(session.logicalRole || "No logical override recorded")}</dd>
            </div>
            <div>
              <dt>Last active</dt>
              <dd data-role="selected-session-last-active">${escapeHtml(formatTimestamp(session.lastActiveAt))}</dd>
            </div>
          </dl>
          <div class="selected-session-context-stack">
            <div>
              <span class="caption">Pull request links</span>
              <div data-role="selected-session-prs">${renderTokenList(session.pullRequests, "No pull requests recorded yet.")}</div>
            </div>
            <div>
              <span class="caption">Touched files</span>
              <div data-role="selected-session-files">${renderTokenList(session.touchedFiles, "No touched files recorded yet.")}</div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>`;
}

function renderMainPane(pageData: AtlasPageData, counts: AtlasSessionCounts): string {
  const selectedSession = getSelectedSession(pageData.sessions, pageData.focusedSessionRole);
  if (resolveMainPaneMode(pageData, selectedSession) === "selected-session" && selectedSession) {
    return renderSelectedSessionView(selectedSession, pageData);
  }
  return renderNewSessionView(pageData, counts);
}

function renderComposerScript(): string {
  return `<script>
(() => {
  const bridge = window.atlasDesktop;
  const shellRoot = document.querySelector("[data-role='atlas-shell']");
  const sessionRailHost = document.querySelector("[data-role='session-rail-host']");
  const mainPaneHost = document.querySelector("[data-role='main-pane-host']");
  let form = null;
  let input = null;
  let attachmentListEl = null;
  let statusEl = null;
  let detailEl = null;
  let errorEl = null;
  let saveTimer = null;
  let refreshTimer = null;
  let refreshDebounceTimer = null;
  let refreshRequestInFlight = false;
  let latestSnapshotRequestId = 0;
  let requestedFocusRole = null;
  let detachWindowVisibleListener = null;
  let currentAttachments = [];

  if (!(shellRoot instanceof HTMLElement)
    || !(sessionRailHost instanceof HTMLElement)
    || !(mainPaneHost instanceof HTMLElement)) {
    return;
  }

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
  const buildSurfaceHref = (focusedSessionRole) => {
    const params = new URLSearchParams();
    if (focusedSessionRole) {
      params.set("focusRole", focusedSessionRole);
    }
    const pathname = "/";
    const query = params.toString();
    return query ? pathname + "?" + query : pathname;
  };
  const parseFocusRole = (value) => {
    const normalized = String(value || "").trim();
    return normalized || null;
  };
  const getFocusRoleFromLocation = () => {
    try {
      return parseFocusRole(new URL(window.location.href).searchParams.get("focusRole"));
    } catch {
      return null;
    }
  };
  const getSelectedSession = (pageData) => Array.isArray(pageData.sessions)
    ? pageData.sessions.find((session) => session.role === pageData.focusedSessionRole) || null
    : null;
  const resolveMainPaneMode = (pageData, selectedSession = getSelectedSession(pageData)) => {
    if (pageData?.mainPaneMode === "selected-session" && selectedSession) {
      return "selected-session";
    }
    return selectedSession ? "selected-session" : "new-session";
  };
  const getSessionActivityLabel = (session) => session.latestMeaningfulAction
    || session.lastTask
    || "Waiting for the next product-facing task.";
  const getSessionLiveStatus = (session) => ({
    tone: session.liveStatusTone || "idle",
    label: session.liveStatusLabel || "Ready",
    assistiveText: session.liveStatusAssistiveText || (session.name + " is ready for the next live update."),
    pulse: session.liveStatusPulse === true,
  });
  const renderLiveStatus = (session, options = {}) => {
    const status = getSessionLiveStatus(session);
    const classes = [
      "live-status",
      "live-status-" + status.tone,
      status.pulse ? "live-status-pulse" : "",
      options.compact ? "live-status-compact" : "",
    ].filter(Boolean).join(" ");
    const visibleLabel = options.showLabel === false
      ? ""
      : '<span class="live-status-label">' + escapeHtml(status.label) + "</span>";
    return '<span class="' + classes + '" data-role="' + escapeHtml(options.dataRole || "live-status") + '" aria-label="'
      + escapeHtml(status.assistiveText) + '" aria-live="polite" aria-atomic="true"><span class="live-status-dot" aria-hidden="true"></span>'
      + visibleLabel + '<span class="sr-only">' + escapeHtml(status.assistiveText) + "</span></span>";
  };
  const renderLifecycleForm = (label, action, options) => '<form class="action-form" method="post" action="/lifecycle">'
    + '<input type="hidden" name="action" value="' + escapeHtml(action) + '" />'
    + (options.role ? '<input type="hidden" name="role" value="' + escapeHtml(options.role) + '" />' : "")
    + '<input type="hidden" name="returnTo" value="' + escapeHtml(options.returnTo) + '" />'
    + '<button class="action-button ' + escapeHtml(options.tone || "secondary") + '" type="submit">'
    + escapeHtml(label) + "</button></form>";
  const renderLinkAction = (label, href, tone = "secondary", options = {}) => {
    const roleAttribute = options.dataRole
      ? ' data-role="' + escapeHtml(options.dataRole) + '"'
      : "";
    const focusRoleAttribute = Object.prototype.hasOwnProperty.call(options, "focusRole")
      ? ' data-focus-role="' + escapeHtml(options.focusRole || "") + '"'
      : "";
    return '<a class="action-button ' + escapeHtml(tone)
      + '" href="' + escapeHtml(href) + '"' + roleAttribute + focusRoleAttribute + ">"
      + escapeHtml(label) + "</a>";
  };
  const renderSelectedSessionActions = (session, focusedSessionRole) => {
    const returnTo = buildSurfaceHref(session.role);
    const actions = [
      focusedSessionRole
        ? renderLinkAction("New Session", buildSurfaceHref(null), "primary", {
            dataRole: "selected-session-new-session-link",
            focusRole: null,
          })
        : renderLinkAction("Select Session", returnTo, "primary", {
            dataRole: "selected-session-link",
            focusRole: session.role,
          }),
      renderLifecycleForm("Stop runtime", "stop", { returnTo, tone: "secondary" }),
    ];
    if (session.lane) {
      actions.push(session.isPaused
        ? renderLifecycleForm("Resume lane", "resume", { role: session.role, returnTo })
        : renderLifecycleForm("Pause lane", "pause", { role: session.role, returnTo }));
    }
    if (session.canArchive) {
      actions.push(renderLifecycleForm("Archive session", "archive", { role: session.role, returnTo }));
    }
    return '<div class="action-row" data-role="selected-session-actions">' + actions.join("") + "</div>";
  };
  const renderTokenList = (items, emptyLabel) => {
    if (!Array.isArray(items) || items.length === 0) {
      return '<p class="support-copy">' + escapeHtml(emptyLabel) + "</p>";
    }
    return '<div class="token-list">' + items.map((item) => '<span class="detail-token">' + escapeHtml(item) + "</span>").join("") + "</div>";
  };
  const normalizeAttachments = (value) => Array.isArray(value)
    ? value
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        id: String(entry.id || "").trim(),
        name: String(entry.name || "").trim(),
        sourcePath: String(entry.sourcePath || "").trim(),
        storedPath: String(entry.storedPath || "").trim(),
        sizeBytes: typeof entry.sizeBytes === "number" && Number.isFinite(entry.sizeBytes) ? entry.sizeBytes : null,
      }))
      .filter((entry) => entry.id && entry.name && entry.sourcePath && entry.storedPath)
    : [];
  const renderComposerAttachments = (attachments) => {
    currentAttachments = normalizeAttachments(attachments);
    if (!(attachmentListEl instanceof HTMLElement)) {
      return;
    }
    if (currentAttachments.length === 0) {
      attachmentListEl.innerHTML = "";
      attachmentListEl.setAttribute("hidden", "hidden");
      return;
    }
    attachmentListEl.removeAttribute("hidden");
    attachmentListEl.innerHTML = currentAttachments.map((attachment) => '<span class="composer-attachment-chip" data-role="composer-attachment-chip">'
      + '<span class="composer-attachment-name">' + escapeHtml(attachment.name) + '</span>'
      + '<button class="composer-attachment-remove" type="button" data-role="composer-attachment-remove" data-attachment-id="'
      + escapeHtml(attachment.id) + '" aria-label="Remove ' + escapeHtml(attachment.name) + '">x</button></span>').join("");
  };
  const resolveNewSessionContinuityDetail = (pageData) => {
    const sessions = Array.isArray(pageData.sessions) ? pageData.sessions : [];
    const hasLiveSessions = sessions.some((session) => session.freshnessState === "live");
    if (pageData.missingFocusedSnapshot === true || !hasLiveSessions) {
      return String(pageData.continuityStatusDetail || "");
    }
    return String(pageData.sessionStartStatusDetail || "");
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
  const renderSessionRail = (pageData) => {
    if (!Array.isArray(pageData.sessions) || pageData.sessions.length === 0) {
      return '<div class="sidebar-empty"><strong>No live rows yet.</strong><p class="support-copy">Launch a new Atlas session to ignite the live command stream.</p></div>';
    }
    return '<div class="session-rail" data-role="session-rail">'
      + pageData.sessions.map((session) => {
        const isSelected = session.role === pageData.focusedSessionRole;
        return '<a class="session-rail-link' + (isSelected ? " session-rail-link-selected" : "")
          + '" href="' + escapeHtml(buildSurfaceHref(session.role)) + '"'
          + (isSelected ? ' aria-current="true"' : "")
          + ' data-role="session-rail-link" data-focus-role="' + escapeHtml(session.role)
          + '" data-session-role="' + escapeHtml(session.role) + '">'
          + '<div class="session-rail-row"><span class="session-rail-title">'
          + renderLiveStatus(session, { dataRole: "session-row-status-light", compact: true })
          + '<strong>' + escapeHtml(session.name) + '</strong></span><span class="session-rail-role">'
          + escapeHtml(session.role) + '</span></div></a>';
      }).join("")
      + "</div>";
  };
  const renderNewSessionView = (pageData, counts) => {
    const missingFocusedSnapshot = pageData.missingFocusedSnapshot === true;
    const hasLiveSessions = Array.isArray(pageData.sessions)
      && pageData.sessions.some((session) => session.freshnessState === "live");
    const heading = "What do you want Atlas to deliver today?";
    const continuityDetail = resolveNewSessionContinuityDetail(pageData);
    return '<section class="main-pane main-pane-start" aria-label="New session start screen" data-role="new-session-view">'
      + '<div class="new-session-shell" data-role="new-session-shell"><div class="new-session-intro"><h1 class="new-session-tagline" data-role="new-session-heading">'
      + escapeHtml(heading)
      + '</h1><p class="sr-only" data-role="new-session-session-count">' + escapeHtml(String(counts.total))
      + ' tracked sessions</p></div><section class="composer-shell composer-shell-chat" aria-label="Desktop composer" data-role="product-composer" data-surface="workspace" data-focused-session-role="'
      + escapeHtml(pageData.focusedSessionRole || "") + '" data-missing-focused-snapshot="'
      + (missingFocusedSnapshot ? "true" : "false") + '" data-has-live-sessions="'
      + (hasLiveSessions ? "true" : "false")
      + '"><form class="product-composer-form" id="atlas-product-composer-form" data-role="product-composer-form"><div class="composer-field composer-field-chat"><span class="sr-only">What should ATLAS do next?</span><div class="composer-entry-shell" data-role="composer-entry-shell"><button class="composer-inline-button composer-attach-button" type="button" data-role="composer-attach-button" aria-label="Add files to this session">+</button><textarea class="composer-input composer-input-chat" data-role="product-composer-input" name="objective" rows="1" placeholder="Ask anything"></textarea><button class="composer-inline-button composer-submit-button" type="submit" data-role="composer-submit-button" aria-label="Start session"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h9"></path><path d="M10 4l6 6-6 6"></path></svg></button></div></div><div class="composer-attachment-list" data-role="composer-attachments" hidden></div><div class="composer-footnote" data-role="new-session-footnote"><span class="chip" data-role="runtime-continuity">'
      + escapeHtml(pageData.continuityStatusLabel || "Waiting for live snapshot")
      + '</span><span class="support-copy" data-role="continuity-detail">' + escapeHtml(continuityDetail)
      + '</span></div><div class="composer-status"><p class="support-copy" data-role="product-composer-status">Loading the saved workspace draft...</p><p class="support-copy" data-role="product-composer-detail">ATLAS keeps this draft in the desktop shell state so close and reopen recovery stays deliberate.</p><p class="composer-error" data-role="product-composer-error"></p></div><div class="composer-actions"><button class="action-button primary" type="submit" form="atlas-product-composer-form">Start session</button>'
      + renderLifecycleForm("Stop runtime", "stop", { returnTo: buildSurfaceHref(pageData.focusedSessionRole || null), tone: "secondary" })
      + "</div></form></section></div></section>";
  };
  const renderSelectedSessionView = (session, pageData) => {
    const summary = getSessionActivityLabel(session);
    const logMeta = session.logSource
      ? session.logSource + " · " + formatTimestamp(session.logUpdatedAt)
      : "Waiting for a live worker log excerpt.";
    return '<section class="main-pane main-pane-detail" aria-label="Selected session detail view" data-role="selected-session-view"><div class="selected-session-hero"><header class="selected-session-header"><div class="selected-session-header-copy"><div class="eyebrow">Current session</div><div class="selected-session-title-row"><h1 data-role="selected-session-name">'
      + escapeHtml(session.name) + "</h1>"
      + renderLiveStatus(session, { dataRole: "selected-session-status-light" })
      + '</div><p class="lead" data-role="selected-session-activity">' + escapeHtml(summary)
      + '</p><p class="support-copy selected-session-subline"><span data-role="selected-session-identity">'
      + escapeHtml(session.workerIdentityLabel)
      + '</span><span class="selected-session-divider" aria-hidden="true">·</span><span data-role="selected-session-stage">'
      + escapeHtml(session.currentStageLabel)
      + '</span><span class="selected-session-divider" aria-hidden="true">·</span><span data-role="selected-session-freshness">'
      + escapeHtml(formatTimestamp(session.freshnessAt))
      + "</span></p></div>"
      + renderSelectedSessionActions(session, pageData.focusedSessionRole)
      + '</header><div class="selected-session-thread"><article class="detail-card selected-session-message selected-session-message-primary" data-role="selected-session-summary-card"><div class="section-heading"><div><div class="eyebrow">Latest meaningful update</div><h2>What changed most recently</h2></div></div><p class="selected-session-primary-update" data-role="selected-session-summary">'
      + escapeHtml(summary)
      + '</p><div class="chip-row selected-session-chip-row"><span class="chip" data-role="selected-session-log-state">'
      + escapeHtml(session.logStateLabel)
      + '</span><span class="chip">' + escapeHtml(session.statusLabel)
      + '</span><span class="chip">' + escapeHtml(session.readinessLabel)
      + '</span><span class="chip">' + escapeHtml(formatTimestamp(session.lastActiveAt))
      + '</span></div></article><article class="detail-card selected-session-message" data-role="selected-session-updates"><div class="section-heading"><div><div class="eyebrow">Recent notes</div><h2>Recent actions</h2></div></div>'
      + renderRecentActions(session)
      + '</article><article class="detail-card selected-session-message" data-role="selected-session-log-card"><div class="section-heading"><div><div class="eyebrow">Readable log</div><h2>Latest worker output</h2></div></div><p class="support-copy" data-role="selected-session-log-meta">'
      + escapeHtml(logMeta)
      + '</p><pre class="log-excerpt" data-role="selected-session-log">'
      + escapeHtml(Array.isArray(session.logExcerpt) && session.logExcerpt.length > 0 ? session.logExcerpt.join("\\n") : "No live worker log lines are available yet.")
      + '</pre></article><article class="detail-card selected-session-message" data-role="selected-session-context"><div class="section-heading"><div><div class="eyebrow">Repo context</div><h2>Branch, PRs, and files</h2></div></div><dl class="definition-grid selected-session-context-grid"><div><dt>Branch</dt><dd data-role="selected-session-branch">'
      + escapeHtml(session.currentBranch || "No branch recorded")
      + '</dd></div><div><dt>Resolved role</dt><dd data-role="selected-session-resolved-role">'
      + escapeHtml(session.resolvedRole || "Role matched the requested worker")
      + '</dd></div><div><dt>Logical role</dt><dd data-role="selected-session-logical-role">'
      + escapeHtml(session.logicalRole || "No logical override recorded")
      + '</dd></div><div><dt>Last active</dt><dd data-role="selected-session-last-active">'
      + escapeHtml(formatTimestamp(session.lastActiveAt))
      + '</dd></div></dl><div class="selected-session-context-stack"><div><span class="caption">Pull request links</span><div data-role="selected-session-prs">'
      + renderTokenList(session.pullRequests, "No pull requests recorded yet.")
      + '</div></div><div><span class="caption">Touched files</span><div data-role="selected-session-files">'
      + renderTokenList(session.touchedFiles, "No touched files recorded yet.")
      + "</div></div></div></article></div></div></section>";
  };
  const renderMainPane = (pageData) => {
    const counts = countSessions(Array.isArray(pageData.sessions) ? pageData.sessions : []);
    const selectedSession = getSelectedSession(pageData);
    return resolveMainPaneMode(pageData, selectedSession) === "selected-session" && selectedSession
      ? renderSelectedSessionView(selectedSession, pageData)
      : renderNewSessionView(pageData, counts);
  };
  const queryComposerElements = () => {
    form = document.querySelector("[data-role='product-composer-form']");
    input = document.querySelector("[data-role='product-composer-input']");
    attachmentListEl = document.querySelector("[data-role='composer-attachments']");
    statusEl = document.querySelector("[data-role='product-composer-status']");
    detailEl = document.querySelector("[data-role='product-composer-detail']");
    errorEl = document.querySelector("[data-role='product-composer-error']");
  };
  const focusMainPaneHeading = () => {
    const heading = document.querySelector("[data-role='selected-session-name'], [data-role='new-session-heading']");
    if (!(heading instanceof HTMLElement)) {
      return;
    }
    heading.setAttribute("tabindex", "-1");
    heading.focus();
  };
  const setComposerStatus = (message, detail) => {
    if (statusEl instanceof HTMLElement) {
      statusEl.textContent = message;
    }
    if (detailEl instanceof HTMLElement) {
      detailEl.textContent = detail || "";
    }
  };
  const getContinuityDetail = () => {
    const composerRoot = document.querySelector("[data-role='product-composer']");
    if (!(composerRoot instanceof HTMLElement)) {
      return "Select a live session from the rail or start a new one from this workspace.";
    }
    if (composerRoot.dataset.missingFocusedSnapshot === "true") {
      return "The saved focus target is still waiting on its next live session snapshot. The desktop shell stays usable and keeps this draft in place.";
    }
    if (composerRoot.dataset.hasLiveSessions === "true") {
      return "ATLAS keeps this draft in the desktop shell state so accidental close and reopen recovery feels deliberate.";
    }
    return "No live session snapshot is available yet, but the shell still restores this draft and surface cleanly.";
  };
  const persistDraft = async (value, options = {}) => {
    if (!bridge?.setWorkspaceDraft) {
      return;
    }
    try {
      await bridge.setWorkspaceDraft(value);
      if (options.silent === true) {
        return;
      }
      if (String(value || "").trim()) {
        setComposerStatus("Saved the workspace draft for this desktop session.", getContinuityDetail());
      } else {
        setComposerStatus("The message box is empty.", getContinuityDetail());
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
    if (!bridge?.setWorkspaceComposerFocus) {
      return;
    }
    try {
      await bridge.setWorkspaceComposerFocus(focused === true);
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
      if (input instanceof HTMLTextAreaElement) {
        void persistDraft(String(input.value || ""));
      }
    }, 180);
  };
  const pickAttachments = async () => {
    if (!bridge?.pickWorkspaceAttachments) {
      setComposerStatus(
        "File attachments are unavailable in this surface.",
        "ATLAS needs the Electron desktop bridge to open the Windows file picker.",
      );
      return;
    }
    try {
      setComposerStatus("Opening the Windows file picker.", "Choose one or more files to attach to the next Atlas session.");
      const result = await bridge.pickWorkspaceAttachments();
      renderComposerAttachments(result?.attachments || []);
      if ((result?.attachments || []).length > 0) {
        setComposerStatus(
          "Attached files are ready for the next session.",
          String((result.attachments || []).length) + " file" + ((result.attachments || []).length === 1 ? " is" : "s are") + " now stored with this desktop session.",
        );
      }
    } catch (error) {
      console.error("[atlas] workspace attachment selection failed:", error);
      setComposerStatus(
        "File attachment failed.",
        String(error?.message || error || "ATLAS could not open the file picker."),
      );
    }
  };
  const removeAttachment = async (attachmentId) => {
    if (!bridge?.removeWorkspaceAttachment) {
      return;
    }
    try {
      const result = await bridge.removeWorkspaceAttachment(attachmentId);
      renderComposerAttachments(result?.attachments || []);
    } catch (error) {
      console.error("[atlas] workspace attachment removal failed:", error);
      setComposerStatus(
        "Attachment removal failed.",
        String(error?.message || error || "ATLAS could not remove the selected attachment."),
      );
    }
  };
  const attachComposerListeners = () => {
    queryComposerElements();
    if (!(form instanceof HTMLFormElement)
      || !(input instanceof HTMLTextAreaElement)
      || !(statusEl instanceof HTMLElement)
      || !(detailEl instanceof HTMLElement)
      || !(errorEl instanceof HTMLElement)
      || form.dataset.bound === "true") {
      return;
    }
    form.dataset.bound = "true";
    form.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const attachButton = event.target.closest("[data-role='composer-attach-button']");
      if (attachButton instanceof HTMLButtonElement) {
        event.preventDefault();
        void pickAttachments();
        return;
      }
      const removeButton = event.target.closest("[data-role='composer-attachment-remove']");
      if (removeButton instanceof HTMLButtonElement) {
        event.preventDefault();
        void removeAttachment(String(removeButton.dataset.attachmentId || ""));
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      errorEl.textContent = "";
      const startSession = bridge?.startSession;
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
        setComposerStatus("The composer is still waiting on a concrete message.", getContinuityDetail());
        input.focus();
        return;
      }
      setComposerStatus(
        "Submitting the session brief from the blank workspace.",
        currentAttachments.length > 0
          ? "ATLAS keeps the draft, stores the selected files with this session, and returns the shell to the same window."
          : "ATLAS keeps the draft, records the brief, and returns the shell to the same window.",
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
          String(result?.packet?.summary || "Select any tracked session from the rail as soon as live detail appears."),
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
  };
  const loadWorkspaceSessionBrief = async () => {
    queryComposerElements();
    if (!(input instanceof HTMLTextAreaElement)) {
      return;
      }
      try {
      const response = await window.fetch("/api/workspace/session-brief", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      if (payload?.ready && payload?.packet) {
        const packetSummary = String(payload.packet.summary || getContinuityDetail());
        const packetObjective = String(payload.packet.objective || "").trim();
        if (currentAttachments.length === 0 && Array.isArray(payload.packet.attachments)) {
          renderComposerAttachments(payload.packet.attachments);
        }
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
  const restoreComposerState = async () => {
    queryComposerElements();
    if (!(input instanceof HTMLTextAreaElement)
      || !(statusEl instanceof HTMLElement)
      || !(detailEl instanceof HTMLElement)) {
      return;
    }
    if (!bridge?.getWorkspaceState) {
      setComposerStatus(
        "Desktop state recovery is unavailable in this surface.",
        "The composer stays editable, but draft recovery requires the Electron desktop bridge.",
      );
      return;
    }
    try {
      const desktopState = await bridge.getWorkspaceState();
      if (desktopState.workspaceDraft) {
        input.value = desktopState.workspaceDraft;
        setComposerStatus("Restored the saved workspace draft for this desktop session.", getContinuityDetail());
      } else {
        setComposerStatus("Message box ready.", getContinuityDetail());
      }
      renderComposerAttachments(desktopState.workspaceAttachments || []);
      if (desktopState.workspaceComposerFocused) {
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
    await loadWorkspaceSessionBrief();
  };
  const renderSnapshot = async (pageData) => {
    const previousDraft = input instanceof HTMLTextAreaElement ? String(input.value || "") : "";
    const previousAttachments = currentAttachments.slice();
    const previousFocus = document.activeElement === input;
    const previousSelectionStart = input instanceof HTMLTextAreaElement ? input.selectionStart : null;
    const previousSelectionEnd = input instanceof HTMLTextAreaElement ? input.selectionEnd : null;
    const selectedSession = getSelectedSession(pageData);
    const mainPaneMode = resolveMainPaneMode(pageData, selectedSession);
    requestedFocusRole = parseFocusRole(pageData.focusedSessionRole);
    shellRoot.dataset.focusedSessionRole = String(pageData.focusedSessionRole || "");
    shellRoot.dataset.mainPaneMode = mainPaneMode;
    shellRoot.dataset.missingFocusedSnapshot = pageData.missingFocusedSnapshot ? "true" : "false";
    shellRoot.dataset.hasLiveSessions = Array.isArray(pageData.sessions)
      && pageData.sessions.some((session) => session.freshnessState === "live")
      ? "true"
      : "false";
    sessionRailHost.innerHTML = renderSessionRail(pageData);
    mainPaneHost.dataset.mainPaneMode = mainPaneMode;
    mainPaneHost.innerHTML = renderMainPane(pageData);
    attachComposerListeners();
    queryComposerElements();
    renderComposerAttachments(previousAttachments);
    if (input instanceof HTMLTextAreaElement && previousDraft.trim()) {
      input.value = previousDraft;
      if (previousFocus) {
        input.focus();
        if (typeof previousSelectionStart === "number" && typeof previousSelectionEnd === "number") {
          input.setSelectionRange(previousSelectionStart, previousSelectionEnd);
        }
      }
      setComposerStatus("Restored the in-memory workspace draft after the live refresh.", getContinuityDetail());
      return;
    }
    await restoreComposerState();
  };
  const applySnapshotPayload = async (payload, requestId) => {
    if (!payload?.ok || !payload?.pageData) {
      return false;
    }
    if (requestId < latestSnapshotRequestId) {
      return false;
    }
    await renderSnapshot(payload.pageData);
    return true;
  };
  const requestSnapshot = async () => {
    const focusedSessionRole = requestedFocusRole;
    if (bridge?.refreshSnapshot) {
      return bridge.refreshSnapshot({
        focusRole: focusedSessionRole || null,
      });
    }
    throw new Error("ATLAS snapshot refresh requires the Electron desktop bridge.");
  };
  const requestFocusedSnapshot = async (focusedSessionRole) => {
    if (bridge?.getSnapshot) {
      return bridge.getSnapshot({
        focusRole: focusedSessionRole,
      });
    }
    if (bridge?.refreshSnapshot) {
      return bridge.refreshSnapshot({
        focusRole: focusedSessionRole,
      });
    }
    throw new Error("ATLAS snapshot selection requires the Electron desktop bridge.");
  };
  const syncHistory = (focusedSessionRole, historyMode) => {
    const nextHref = buildSurfaceHref(focusedSessionRole);
    const currentHref = window.location.pathname + window.location.search;
    if (currentHref === nextHref) {
      return;
    }
    if (historyMode === "replace") {
      window.history.replaceState({ focusRole: focusedSessionRole }, "", nextHref);
      return;
    }
    window.history.pushState({ focusRole: focusedSessionRole }, "", nextHref);
  };
  const navigateMainPane = async (focusedSessionRole, options = {}) => {
    const nextFocusRole = parseFocusRole(focusedSessionRole);
    requestedFocusRole = nextFocusRole;
    const requestId = ++latestSnapshotRequestId;
    try {
      const payload = await requestFocusedSnapshot(nextFocusRole);
      const applied = await applySnapshotPayload(payload, requestId);
      if (!applied) {
        return;
      }
      syncHistory(payload.pageData.focusedSessionRole || null, options.historyMode || "push");
      if (options.focusHeading === true) {
        focusMainPaneHeading();
      }
    } catch (error) {
      console.error("[atlas] client-side workspace selection failed:", error);
      window.location.assign(buildSurfaceHref(nextFocusRole));
    }
  };
  const refreshSnapshot = async () => {
    if (refreshRequestInFlight) {
      return;
    }
    refreshRequestInFlight = true;
    const requestId = ++latestSnapshotRequestId;
    try {
      const payload = await requestSnapshot();
      await applySnapshotPayload(payload, requestId);
    } catch (error) {
      console.error("[atlas] live snapshot refresh failed:", error);
    } finally {
      refreshRequestInFlight = false;
    }
  };
  const queueResponsiveRefresh = (delay = 80) => {
    if (refreshDebounceTimer) {
      window.clearTimeout(refreshDebounceTimer);
    }
    refreshDebounceTimer = window.setTimeout(() => {
      refreshDebounceTimer = null;
      void refreshSnapshot();
    }, delay);
  };
  const startSnapshotRefresh = () => {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
    }
    refreshTimer = window.setInterval(() => {
      void refreshSnapshot();
    }, 5000);
  };
  const attachClientSideNavigation = () => {
    if (shellRoot.dataset.navigationBound === "true") {
      return;
    }
    shellRoot.dataset.navigationBound = "true";
    shellRoot.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const link = event.target.closest("a[data-focus-role]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }
      if (!bridge?.getSnapshot && !bridge?.refreshSnapshot) {
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      void navigateMainPane(parseFocusRole(link.dataset.focusRole), { historyMode: "push", focusHeading: true });
    });
    window.addEventListener("popstate", () => {
      if (!bridge?.getSnapshot && !bridge?.refreshSnapshot) {
        return;
      }
      void navigateMainPane(getFocusRoleFromLocation(), { historyMode: "replace", focusHeading: true });
    });
    window.addEventListener("focus", () => {
      queueResponsiveRefresh();
    });
    window.addEventListener("pageshow", () => {
      queueResponsiveRefresh(30);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        queueResponsiveRefresh();
      }
    });
    if (bridge?.onWindowVisible && !detachWindowVisibleListener) {
      detachWindowVisibleListener = bridge.onWindowVisible(() => {
        queueResponsiveRefresh(30);
      });
    }
  };
  const bootstrap = async () => {
    requestedFocusRole = getFocusRoleFromLocation();
    attachClientSideNavigation();
    attachComposerListeners();
    await restoreComposerState();
    await refreshSnapshot();
    startSnapshotRefresh();
  };
  window.addEventListener("beforeunload", () => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (refreshDebounceTimer) {
      window.clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = null;
    }
    if (typeof detachWindowVisibleListener === "function") {
      detachWindowVisibleListener();
      detachWindowVisibleListener = null;
    }
    if (input instanceof HTMLTextAreaElement) {
      void persistDraft(String(input.value || ""));
    }
  });
  void bootstrap();
})();
  </script>`;
}

function renderAtlasAppShell(pageData: AtlasPageData): string {
  const counts = countSessions(pageData.sessions);
  const mainPaneMode = resolveMainPaneMode(pageData);
  const continuity = resolveAtlasSessionSnapshotContinuity(
    pageData.sessions,
    pageData.focusedSessionRole,
    pageData.missingFocusedSnapshot === true,
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atlas</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #050505;
      --bg-soft: #101010;
      --panel: rgba(15, 15, 15, 0.96);
      --panel-soft: rgba(24, 24, 24, 0.96);
      --line: rgba(255, 255, 255, 0.1);
      --line-strong: rgba(255, 255, 255, 0.24);
      --text: #f4f4f4;
      --muted: #b8b8b8;
      --muted-strong: #dadada;
      --shadow: 0 24px 72px rgba(0, 0, 0, 0.34);
      --status-idle: #4dd68a;
      --status-active: #32c66f;
      --status-attention: #ff9b52;
      --status-complete: #67db96;
      --status-offline: #ff6b6b;
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 18%),
        linear-gradient(180deg, #030303 0%, var(--bg) 38%, #0a0a0a 100%);
      color: var(--text);
      font-family: "Segoe UI Variable Display", "Segoe UI", Arial, sans-serif;
    }
    a, button, textarea { font: inherit; }
    a {
      color: inherit;
      text-decoration: none;
    }
    h1,
    h2,
    h3,
    p,
    dl,
    dd,
    dt {
      margin: 0;
    }
    main {
      padding: 20px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .shell {
      display: grid;
      grid-template-columns: minmax(220px, 250px) minmax(0, 1fr);
      gap: 16px;
      min-height: calc(100vh - 40px);
    }
    .desktop-sidebar,
    .main-shell,
    .main-pane,
    .detail-card,
    .status-card,
    .composer-shell,
    .session-rail-link,
    .sidebar-new-session {
      border-radius: 12px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(20, 20, 20, 0.96), rgba(11, 11, 11, 0.98));
      box-shadow: var(--shadow);
    }
    .desktop-sidebar,
    .main-shell,
    .main-pane,
    .detail-grid,
    .definition-grid,
    .session-rail,
    .start-status-grid,
    .hero-metadata,
    .chip-row,
    .action-row,
    .composer-actions,
    .product-composer-form,
    .composer-field,
    .composer-status,
    .detail-stack {
      display: grid;
      gap: 14px;
    }
    .desktop-sidebar {
      position: sticky;
      top: 20px;
      align-self: start;
      min-height: calc(100vh - 40px);
      padding: 10px 8px;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 8px;
      border-radius: 10px;
    }
    .sidebar-brand,
    .sidebar-new-session {
      display: grid;
      gap: 4px;
      padding: 9px 10px;
      border-radius: 6px;
    }
    .sidebar-brand {
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
    }
    .brand-mark {
      width: 36px;
      height: 36px;
      display: block;
      border-radius: 11px;
      object-fit: cover;
      padding: 0;
      background: #f2f3f6;
      border: 1px solid rgba(255, 255, 255, 0.18);
      overflow: hidden;
    }
    .brand-copy {
      display: grid;
      gap: 4px;
    }
    .brand-title {
      font-size: 16px;
      letter-spacing: -0.04em;
    }
    .sidebar-new-session-active,
    .session-rail-link-selected {
      border-color: var(--line-strong);
      background: linear-gradient(180deg, rgba(28, 28, 28, 0.98), rgba(14, 14, 14, 0.98));
    }
    .sidebar-rail-section {
      min-height: 0;
      display: grid;
      gap: 8px;
      margin-top: 8px;
      align-content: start;
    }
    [data-role="session-rail-host"] {
      display: grid;
      align-content: start;
    }
    .session-rail {
      align-content: start;
      min-height: 0;
      overflow: auto;
      padding-right: 2px;
      gap: 6px;
    }
    .session-rail-link {
      display: grid;
      gap: 4px;
      padding: 8px 10px;
      min-height: 42px;
      border-radius: 6px;
    }
    .session-rail-row,
    .session-rail-title,
    .section-heading,
    .main-pane-header,
    .selected-session-header,
    .selected-session-title-row {
      display: flex;
      gap: 14px;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }
    .session-rail-title {
      justify-content: start;
      align-items: center;
      min-width: 0;
    }
    .session-rail-role,
    .meta-copy,
    .caption,
    dt,
    .eyebrow {
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .sidebar-row-count,
    .support-copy,
    dd {
      color: var(--muted-strong);
      line-height: 1.4;
    }
    .sidebar-empty {
      padding: 10px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.02);
      margin-top: 0;
      display: grid;
      gap: 4px;
    }
    .sidebar-empty strong {
      font-size: 11px;
      letter-spacing: 0.03em;
    }
    .sidebar-empty .support-copy {
      font-size: 10.5px;
      line-height: 1.35;
    }
    .sidebar-new-session {
      min-height: 40px;
      align-items: center;
      grid-auto-flow: column;
      justify-content: start;
    }
    .section-heading h2 {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: none;
    }
    .sidebar-row-count {
      font-size: 11px;
      opacity: 0.85;
    }
    .main-shell {
      min-height: calc(100vh - 40px);
      padding: 18px;
      display: grid;
    }
    .main-pane {
      padding: 28px;
      align-content: start;
    }
    .main-pane-start {
      align-content: center;
      min-height: calc(100vh - 120px);
      padding-top: 72px;
      background: transparent;
      border: 0;
      box-shadow: none;
    }
    .new-session-shell {
      width: min(920px, 100%);
      margin-inline: auto;
      display: grid;
      gap: 26px;
      align-content: start;
      justify-items: center;
    }
    .new-session-intro {
      display: grid;
      gap: 4px;
      text-align: center;
      width: 100%;
    }
    .new-session-tagline {
      font-size: clamp(18px, 2.2vw, 22px);
      letter-spacing: -0.03em;
      line-height: 1.15;
      font-weight: 600;
    }
    .main-pane-header {
      align-items: start;
    }
    .lead {
      font-size: 17px;
      line-height: 1.7;
      color: var(--muted-strong);
      max-width: 880px;
    }
    h1 {
      font-size: clamp(34px, 5vw, 54px);
      letter-spacing: -0.05em;
      line-height: 1.02;
    }
    h2,
    h3 {
      letter-spacing: -0.04em;
    }
    .chip-row,
    .action-row,
    .composer-actions {
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      justify-content: start;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .chip,
    .action-button,
    .detail-token {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.04);
    }
    .action-button {
      cursor: pointer;
      color: var(--text);
      justify-content: center;
    }
    .action-button.primary {
      background: #ffffff;
      border-color: #ffffff;
      color: #050505;
      font-weight: 600;
    }
    .action-form {
      display: inline-flex;
    }
    .start-status-grid,
    .hero-metadata {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .status-card,
    .hero-stat,
    .detail-card {
      padding: 18px;
    }
    .selected-session-hero {
      width: min(860px, 100%);
      margin-inline: auto;
      display: grid;
      gap: 18px;
    }
    .selected-session-header {
      align-items: flex-start;
    }
    .selected-session-header-copy,
    .selected-session-thread,
    .selected-session-context-stack {
      display: grid;
      gap: 14px;
    }
    .selected-session-subline {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .selected-session-divider {
      color: var(--muted);
    }
    .selected-session-message {
      border-radius: 22px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.03);
      display: grid;
      gap: 14px;
    }
    .selected-session-message-primary {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    }
    .selected-session-primary-update {
      font-size: clamp(19px, 2.3vw, 24px);
      line-height: 1.55;
      letter-spacing: -0.03em;
    }
    .selected-session-chip-row {
      padding-top: 4px;
    }
    .hero-stat {
      border-radius: 20px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.03);
      display: grid;
      gap: 8px;
    }
    .hero-stat strong {
      font-size: 20px;
      letter-spacing: -0.03em;
    }
    .detail-grid {
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      align-items: start;
    }
    .detail-card-log {
      grid-column: 1 / -1;
    }
    .definition-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 10px;
    }
    .selected-session-context-grid {
      margin-top: 0;
    }
    dd {
      margin-top: 6px;
      word-break: break-word;
    }
    .detail-stack {
      margin-top: 18px;
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
      margin-top: 8px;
    }
    .log-excerpt {
      margin: 0;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: #0c0c0c;
      color: var(--muted-strong);
      font-family: "Cascadia Code", Consolas, monospace;
      font-size: 13px;
      line-height: 1.65;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .progress-rail {
      height: 10px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.08);
      margin-top: 6px;
    }
    .progress-rail > span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #ffffff, #8d8d8d);
    }
    .composer-shell {
      padding: 22px;
      margin-top: 10px;
    }
    .composer-shell-chat {
      margin-top: 0;
      background: transparent;
      border: 0;
      box-shadow: none;
      padding: 0;
      width: min(860px, 100%);
      margin-inline: auto;
    }
    .composer-field-chat {
      gap: 10px;
      margin-top: 2px;
      width: 100%;
      margin-inline: auto;
    }
    .composer-entry-shell {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px 8px 14px;
      border-radius: 999px;
      background: #2a2b2f;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .composer-input {
      width: 100%;
      min-height: 164px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
      resize: vertical;
      line-height: 1.6;
    }
    .composer-input-chat {
      min-height: 36px;
      border-radius: 0;
      font-size: 15px;
      line-height: 1.45;
      padding: 0;
      resize: none;
      background: transparent;
      border-color: transparent;
      max-width: 100%;
      text-align: left;
    }
    .composer-input-chat:focus {
      outline: none;
    }
    .composer-input-chat::placeholder {
      font-size: 15px;
      opacity: 0.76;
    }
    .composer-inline-button {
      border: 0;
      cursor: pointer;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      transition: transform 120ms ease, opacity 120ms ease;
    }
    .composer-inline-button:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .composer-attach-button {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: transparent;
      color: var(--muted-strong);
      font-size: 28px;
      line-height: 1;
      font-weight: 300;
    }
    .composer-submit-button {
      width: 38px;
      height: 38px;
      border-radius: 999px;
      background: #ffffff;
      color: #050505;
    }
    .composer-submit-button svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 1.8;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .composer-attachment-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      width: 100%;
    }
    .composer-attachment-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 6px 10px 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      color: var(--muted-strong);
      max-width: 100%;
    }
    .composer-attachment-name {
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .composer-attachment-remove {
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      padding: 0;
      width: 18px;
      height: 18px;
      font-size: 14px;
      line-height: 1;
    }
    .shell[data-main-pane-mode="new-session"] .product-composer-form {
      width: 100%;
    }
    .composer-footnote {
      display: grid;
      gap: 8px;
    }
    .shell[data-main-pane-mode="new-session"] .composer-status,
    .shell[data-main-pane-mode="new-session"] .composer-footnote,
    .shell[data-main-pane-mode="new-session"] .composer-actions {
      display: none;
    }
    .shell[data-main-pane-mode="new-session"] .main-shell {
      background: transparent;
      border: 0;
      box-shadow: none;
      padding: 0;
    }
    .composer-entry-shell:focus-within,
    a:focus-visible,
    button:focus-visible {
      outline: 3px solid #ffffff;
      outline-offset: 2px;
    }
    .composer-error {
      min-height: 1.4em;
      color: #ffb3b3;
    }
    .live-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 28px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.04);
      color: var(--muted-strong);
    }
    .live-status-idle,
    .live-status-active,
    .live-status-complete {
      border-color: rgba(77, 214, 138, 0.26);
    }
    .live-status-attention {
      border-color: rgba(255, 155, 82, 0.3);
    }
    .live-status-offline {
      border-color: rgba(255, 107, 107, 0.34);
    }
    .live-status-compact {
      min-height: 24px;
      padding: 2px 8px;
    }
    .live-status-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--status-idle);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
    }
    .live-status-idle .live-status-dot { background: var(--status-idle); }
    .live-status-active .live-status-dot { background: var(--status-active); }
    .live-status-attention .live-status-dot { background: var(--status-attention); }
    .live-status-complete .live-status-dot { background: var(--status-complete); }
    .live-status-offline .live-status-dot { background: var(--status-offline); }
    .live-status-label {
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .live-status-pulse .live-status-dot {
      animation: atlas-live-pulse 1.8s ease-in-out infinite;
    }
    @keyframes atlas-live-pulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 rgba(50, 198, 111, 0.12);
      }
      50% {
        box-shadow: 0 0 0 6px rgba(50, 198, 111, 0.05);
      }
    }
    @media (max-width: 1120px) {
      .detail-grid,
      .start-status-grid,
      .hero-metadata {
        grid-template-columns: 1fr;
      }
      .selected-session-context-grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 960px) {
      .shell {
        grid-template-columns: 1fr;
      }
      .desktop-sidebar,
      .main-shell {
        position: static;
        min-height: auto;
      }
      .definition-grid {
        grid-template-columns: 1fr;
      }
      .chip-row,
      .action-row,
      .composer-actions {
        grid-auto-flow: row;
        grid-auto-columns: unset;
      }
    }
  </style>
</head>
  <body>
    <main>
      <section
        class="shell"
        aria-label="ATLAS desktop surface"
        data-role="atlas-shell"
        data-main-pane-mode="${escapeHtml(mainPaneMode)}"
        data-focused-session-role="${escapeHtml(pageData.focusedSessionRole || "")}"
        data-has-live-sessions="${continuity.hasLiveSessions ? "true" : "false"}"
        data-missing-focused-snapshot="${pageData.missingFocusedSnapshot ? "true" : "false"}">
        ${renderSidebar(pageData)}
        <section class="main-shell" aria-label="ATLAS work canvas">
          <div data-role="main-pane-host" data-main-pane-mode="${escapeHtml(mainPaneMode)}">${renderMainPane(pageData, counts)}</div>
        </section>
      </section>
    </main>
    ${renderComposerScript()}
  </body>
</html>`;
}

export function renderAtlasWorkspaceHtml(pageData: AtlasPageData): string {
  return renderAtlasAppShell(pageData);
}

export function renderAtlasHomeHtml(pageData: AtlasPageData): string {
  return renderAtlasWorkspaceHtml(pageData);
}

export function renderAtlasSessionsHtml(pageData: AtlasPageData): string {
  return renderAtlasWorkspaceHtml(pageData);
}
