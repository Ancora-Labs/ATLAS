import type { AtlasSessionDto } from "./state_bridge.js";

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
  focusedSessionRole: string | null;
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
  const params = new URLSearchParams();
  if (focusedSessionRole) {
    params.set("focusRole", focusedSessionRole);
  }

  const pathname = view === "sessions" ? "/sessions" : "/";
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
      heading: "No live session focus yet",
      detail: "ATLAS is ready to open the next tracked session when state arrives.",
      branch: "No branch recorded",
      status: "Waiting for session state",
    };
  }

  return {
    heading: session.name,
    detail: session.lastTask || "Waiting for the next product-facing task.",
    branch: session.currentBranch || "No branch recorded",
    status: `${session.statusLabel} · ${session.readinessLabel}`,
  };
}

function getSessionActivityLabel(session: AtlasSessionDto): string {
  return session.lastTask || "Waiting for the next product-facing task.";
}

function renderNavigation(view: AtlasView, focusedSessionRole: string | null): string {
  return `<nav class="nav" aria-label="ATLAS pages">
    <a class="nav-link" href="${escapeHtml(buildSurfaceHref("home", focusedSessionRole))}"${view === "home" ? ' aria-current="page"' : ""}>Home</a>
    <a class="nav-link" href="${escapeHtml(buildSurfaceHref("sessions", focusedSessionRole))}"${view === "sessions" ? ' aria-current="page"' : ""}>Sessions</a>
  </nav>`;
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

function renderSidebarSessionRail(pageData: AtlasPageData, view: AtlasView): string {
  if (pageData.sessions.length === 0) {
    return `<div class="sidebar-empty">
      <strong>No session state is available yet.</strong>
      <p class="support-copy">ATLAS will surface tracked work here as soon as the next session is written.</p>
    </div>`;
  }

  return `<div class="session-rail">
    ${pageData.sessions.map((session) => {
      const isSelected = session.role === pageData.focusedSessionRole || (!pageData.focusedSessionRole && session === pageData.sessions[0]);
      const containerTag = view === "sessions" ? "a" : "div";
      const hrefAttribute = view === "sessions" ? ` href="${escapeHtml(buildSurfaceHref("sessions", session.role))}"` : "";
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
          <h2>${escapeHtml(pageData.pipelineStageLabel)}</h2>
        </div>
        <span class="meta-copy">${escapeHtml(formatTimestamp(pageData.updatedAt))}</span>
      </div>
      <p class="support-copy">${escapeHtml(pageData.homeReadinessHeading)} · ${escapeHtml(pageData.homeReadinessDetail)}</p>
      <div class="progress-rail" aria-hidden="true">
        <span style="width:${escapeHtml(String(clampPercent(pageData.pipelinePercent)))}%"></span>
      </div>
      <div class="chip-row" aria-label="Current runtime status">
        <span class="chip">${escapeHtml(pageData.homeReadinessHeading)}</span>
        <span class="chip">${escapeHtml(String(counts.total))} tracked sessions</span>
        <span class="chip">${escapeHtml(String(counts.needsInput))} needing input</span>
        <span class="chip">${escapeHtml(String(counts.paused))} paused lane${counts.paused === 1 ? "" : "s"}</span>
      </div>
    </section>

    <section class="sidebar-section" aria-label="Session focus">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Session focus</div>
          <h2>${escapeHtml(sessionSummary.heading)}</h2>
        </div>
        ${activeSession && pageData.focusedSessionRole
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

function renderHomeCanvas(pageData: AtlasPageData, counts: AtlasSessionCounts, activeSession: AtlasSessionDto | null): string {
  const sessionSummary = getSessionSummary(activeSession);
  return `<section class="workspace-canvas" aria-label="Desktop continuity">
    <section class="canvas-section canvas-hero">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Desktop continuity</div>
          <h1>ATLAS keeps the live delivery state in the desktop window.</h1>
        </div>
        <p class="support-copy">The packaged shell stays monochrome, desktop-first, and trustworthy while repo state, relaunch recovery, and clarification handoff stay inside the native shell.</p>
      </div>
      <dl class="definition-grid">
        <div>
          <dt>Build session</dt>
          <dd>${escapeHtml(pageData.buildSessionId)}</dd>
        </div>
        <div>
          <dt>Last packaged build</dt>
          <dd>${escapeHtml(formatTimestamp(pageData.buildTimestamp))}</dd>
        </div>
        <div>
          <dt>Launch entrypoint</dt>
          <dd><code>${escapeHtml(pageData.shellCommand)}</code></dd>
        </div>
        <div>
          <dt>Last state write</dt>
          <dd>${escapeHtml(formatTimestamp(pageData.updatedAt))}</dd>
        </div>
      </dl>
    </section>

    <section class="canvas-columns">
      <section class="canvas-section" aria-label="Active delivery focus">
        <div class="eyebrow">Active delivery focus</div>
        <h2>${escapeHtml(pageData.pipelineStageLabel)}</h2>
        <p class="lead">${escapeHtml(pageData.pipelineDetail)}</p>
        <div class="definition-stack">
          <div>
            <span class="caption">Live focus</span>
            <strong>${escapeHtml(sessionSummary.heading)}</strong>
            <p class="support-copy">${escapeHtml(sessionSummary.detail)}</p>
            <code>${escapeHtml(sessionSummary.branch)}</code>
          </div>
          <div>
            <span class="caption">Next handoff</span>
            <strong>${escapeHtml(pageData.homePrimaryActionLabel)}</strong>
            <p class="support-copy">${escapeHtml(pageData.homeReadinessDetail)}</p>
          </div>
        </div>
      </section>

      <section class="canvas-section" aria-label="Repo state">
        <div class="eyebrow">Repo state</div>
        <h2>${escapeHtml(pageData.repoLabel)}</h2>
        <p class="lead">${escapeHtml(pageData.hostLabel)}</p>
        <p class="support-copy">${escapeHtml(pageData.homeReadinessDetail)}</p>
        <div class="stats-grid">
          <div class="stat-pill"><span>Total sessions</span><strong>${escapeHtml(String(counts.total))}</strong></div>
          <div class="stat-pill"><span>Active sessions</span><strong>${escapeHtml(String(counts.active))}</strong></div>
          <div class="stat-pill"><span>Needs input</span><strong>${escapeHtml(String(counts.needsInput))}</strong></div>
          <div class="stat-pill"><span>Completed</span><strong>${escapeHtml(String(counts.completed))}</strong></div>
          <div class="stat-pill"><span>Resumable</span><strong>${escapeHtml(String(counts.resumable))}</strong></div>
          <div class="stat-pill"><span>Paused lanes</span><strong>${escapeHtml(String(counts.paused))}</strong></div>
        </div>
      </section>
    </section>
  </section>`;
}

function renderSessionsCanvas(pageData: AtlasPageData, counts: AtlasSessionCounts, activeSession: AtlasSessionDto | null): string {
  return `<section class="workspace-canvas" aria-label="Session ledger">
    <section class="canvas-section canvas-hero">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Trust-first work ledger</div>
          <h1>Session ledger keeps delivery trust anchored in the desktop lifecycle.</h1>
        </div>
        <p class="support-copy">Session ledger stays aligned with the desktop lifecycle.</p>
      </div>
      <div class="chip-row">
        <span class="chip">${escapeHtml(String(counts.total))} tracked sessions</span>
        <span class="chip">${escapeHtml(String(counts.resumable))} resumable</span>
        <span class="chip">${escapeHtml(String(counts.needsInput))} needing input</span>
        <span class="chip">${escapeHtml(String(counts.paused))} paused lane${counts.paused === 1 ? "" : "s"}</span>
      </div>
    </section>

    ${activeSession
      ? `<section class="canvas-section" aria-label="Focused workspace context">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Focused workspace</div>
          <h2>${escapeHtml(activeSession.name)}</h2>
        </div>
        ${pageData.focusedSessionRole ? `<a class="primary-link" href="${escapeHtml(buildSurfaceHref("home", activeSession.role))}">Keep focus on home</a>` : ""}
      </div>
      <p class="support-copy">${escapeHtml(getSessionActivityLabel(activeSession))}</p>
      <dl class="definition-grid">
        <div>
          <dt>Branch</dt>
          <dd>${escapeHtml(activeSession.currentBranch || "No branch recorded")}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>${escapeHtml(`${activeSession.statusLabel} · ${activeSession.readinessLabel}`)}</dd>
        </div>
      </dl>
    </section>`
      : ""}

    <section class="canvas-section" aria-label="Tracked sessions">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Trusted feedback</div>
          <h2>Tracked sessions</h2>
        </div>
        <p class="support-copy">Actions submit directly to the ATLAS lifecycle route so the desktop state, focused context, and session ledger stay in sync.</p>
      </div>
      ${pageData.sessions.length > 0
        ? `<div class="session-list">${pageData.sessions.map((session) => renderSessionCard(session, pageData.focusedSessionRole)).join("")}</div>`
        : '<div class="empty-state"><strong>No session state is available yet.</strong><p class="support-copy">ATLAS will surface tracked work here as soon as the next session is written.</p></div>'}
    </section>
  </section>`;
}

function renderComposer(view: AtlasView, pageData: AtlasPageData, activeSession: AtlasSessionDto | null): string {
  const primaryHref = view === "sessions" && activeSession
    ? buildSurfaceHref("home", activeSession.role)
    : buildSurfaceHref("sessions", pageData.focusedSessionRole);
  const primaryLabel = view === "sessions" && activeSession
    ? "Keep focus on home"
    : pageData.homePrimaryActionLabel;
  const returnTo = buildSurfaceHref(view, pageData.focusedSessionRole);

  const actions = [
    `<a class="primary-link" href="${escapeHtml(primaryHref)}">${escapeHtml(primaryLabel)}</a>`,
    renderLifecycleForm("Stop runtime", "stop", {
      returnTo,
      tone: "secondary",
    }),
  ];

  if (activeSession) {
    if (view === "sessions") {
      actions.push(activeSession.role === pageData.focusedSessionRole
        ? renderLinkAction("Clear focus", buildSurfaceHref(view, null))
        : renderLinkAction("Focus session", buildSurfaceHref("sessions", activeSession.role)));

      if (activeSession.lane) {
        actions.push(activeSession.isPaused
          ? renderLifecycleForm("Resume lane", "resume", { role: activeSession.role, returnTo })
          : renderLifecycleForm("Pause lane", "pause", { role: activeSession.role, returnTo }));
      }

      if (activeSession.canArchive) {
        actions.push(renderLifecycleForm("Archive session", "archive", { role: activeSession.role, returnTo }));
      }
    }
  }

  return `<section class="desktop-composer" aria-label="Desktop composer">
    <div class="composer-copy">
      <div class="eyebrow">Desktop composer</div>
      <h2>${escapeHtml(activeSession?.name || pageData.pipelineStageLabel)}</h2>
      <p class="support-copy">${escapeHtml(activeSession ? getSessionActivityLabel(activeSession) : pageData.homeReadinessDetail)}</p>
    </div>
    <div class="composer-actions">${actions.join("")}</div>
  </section>`;
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
    dd {
      margin-top: 6px;
      font-size: 15px;
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
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: center;
      background: linear-gradient(180deg, rgba(24, 24, 24, 0.98), rgba(12, 12, 12, 0.98));
    }
    .composer-actions {
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      align-items: center;
      justify-content: end;
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
        ${view === "home" ? renderHomeCanvas(pageData, counts, activeSession) : renderSessionsCanvas(pageData, counts, activeSession)}
        ${renderComposer(view, pageData, activeSession)}
      </section>
    </section>
  </main>
</body>
</html>`;
}

export function renderAtlasHomeHtml(pageData: AtlasPageData): string {
  return renderAtlasAppShell(pageData, "home");
}

export function renderAtlasSessionsHtml(pageData: AtlasPageData): string {
  return renderAtlasAppShell(pageData, "sessions");
}
