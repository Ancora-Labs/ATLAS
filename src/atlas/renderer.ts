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

function renderNavigation(view: AtlasView): string {
  return `<nav class="nav" aria-label="ATLAS pages">
    <a class="nav-link" href="/"${view === "home" ? ' aria-current="page"' : ""}>Home</a>
    <a class="nav-link" href="/sessions"${view === "sessions" ? ' aria-current="page"' : ""}>Sessions</a>
  </nav>`;
}

function renderMetricCard(label: string, value: string | number): string {
  return `<article class="metric-card" aria-label="${escapeHtml(label)}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(String(value))}</strong>
  </article>`;
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

function renderSessionActions(session: AtlasSessionDto): string {
  const actions: string[] = [];

  if (session.lane) {
    actions.push(session.isPaused
      ? renderLifecycleForm("Resume lane", "resume", { role: session.role, returnTo: "/sessions" })
      : renderLifecycleForm("Pause lane", "pause", { role: session.role, returnTo: "/sessions" }));
  }

  if (session.canArchive) {
    actions.push(renderLifecycleForm("Archive session", "archive", {
      role: session.role,
      returnTo: "/sessions",
    }));
  }

  return actions.length > 0
    ? `<div class="action-row">${actions.join("")}</div>`
    : '<p class="support-copy">No lifecycle action is available for this session yet.</p>';
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

function renderSessionCard(session: AtlasSessionDto): string {
  return `<article class="session-card" aria-label="${escapeHtml(session.name)} session">
    <div class="session-card-header">
      <div>
        <h3>${escapeHtml(session.name)}</h3>
        <p class="support-copy">${escapeHtml(session.lastTask || "Waiting for the next product-facing task.")}</p>
      </div>
      <div class="chip-row">${renderStatusTags(session)}</div>
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
    ${renderSessionActions(session)}
  </article>`;
}

function renderHomeContent(pageData: AtlasPageData, counts: AtlasSessionCounts): string {
  const sessionSummary = getSessionSummary(getPrimarySession(pageData.sessions));

  return `<section class="content-grid">
    <article class="panel hero-panel" aria-label="Desktop overview">
      <div class="eyebrow">Desktop overview</div>
      <h1>ATLAS keeps the live delivery state in the desktop window.</h1>
      <p class="lead">The packaged shell stays monochrome, desktop-first, and trustworthy: repo state, lifecycle status, and resumable work are surfaced directly without drifting back into a browser control surface.</p>
      <div class="chip-row" aria-label="Current runtime status">
        <span class="chip">Stage: ${escapeHtml(pageData.pipelineStageLabel)}</span>
        <span class="chip">Updated: ${escapeHtml(formatTimestamp(pageData.updatedAt))}</span>
        <span class="chip">Packaged: ${escapeHtml(formatTimestamp(pageData.buildTimestamp))}</span>
      </div>
      <div class="command-block">
        <span>Launch entrypoint</span>
        <code>${escapeHtml(pageData.shellCommand)}</code>
      </div>
      <div class="cta-row">
        <a class="primary-link" href="/sessions">${escapeHtml(pageData.homePrimaryActionLabel)}</a>
        ${renderLifecycleForm("Stop runtime", "stop", { returnTo: "/", tone: "secondary" })}
      </div>
    </article>

    <article class="panel" aria-label="Session readiness">
      <div class="eyebrow">Session readiness</div>
      <h2>${escapeHtml(pageData.homeReadinessHeading)}</h2>
      <p class="support-copy">${escapeHtml(pageData.homeReadinessDetail)}</p>
      <div class="progress-rail" aria-hidden="true">
        <span style="width:${escapeHtml(String(clampPercent(pageData.pipelinePercent)))}%"></span>
      </div>
      <div class="definition-stack">
        <div>
          <span class="caption">Build session</span>
          <strong>${escapeHtml(pageData.buildSessionId)}</strong>
        </div>
        <div>
          <span class="caption">Live focus</span>
          <strong>${escapeHtml(sessionSummary.heading)}</strong>
          <p class="support-copy">${escapeHtml(sessionSummary.detail)}</p>
          <code>${escapeHtml(sessionSummary.branch)}</code>
        </div>
        <div>
          <span class="caption">Lifecycle feedback</span>
          <strong>${escapeHtml(sessionSummary.status)}</strong>
        </div>
      </div>
    </article>

    <section class="panel panel-span" aria-label="Session totals">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Windows-style hierarchy</div>
          <h2>Session totals</h2>
        </div>
        <p class="support-copy">Signals that matter most stay visible first: active work, blocked handoffs, and what can be resumed immediately.</p>
      </div>
      <div class="metric-grid">
        ${renderMetricCard("Total sessions", counts.total)}
        ${renderMetricCard("Active sessions", counts.active)}
        ${renderMetricCard("Needs input", counts.needsInput)}
        ${renderMetricCard("Completed", counts.completed)}
      </div>
    </section>
  </section>`;
}

function renderSessionsContent(pageData: AtlasPageData, counts: AtlasSessionCounts): string {
  return `<section class="content-grid">
    <article class="panel hero-panel panel-span" aria-label="Session ledger">
      <div class="eyebrow">Session ledger</div>
      <h1>Session ledger stays aligned with the desktop lifecycle.</h1>
      <p class="lead">Every tracked role keeps its state, lane action, branch, and last activity visible so restore, resume, and archive decisions stay grounded in the packaged ATLAS shell.</p>
      <div class="chip-row">
        <span class="chip">${escapeHtml(String(counts.total))} tracked sessions</span>
        <span class="chip">${escapeHtml(String(counts.resumable))} resumable</span>
        <span class="chip">${escapeHtml(String(counts.needsInput))} needing input</span>
        <span class="chip">${escapeHtml(String(counts.paused))} paused lane${counts.paused === 1 ? "" : "s"}</span>
      </div>
    </article>

    <section class="panel panel-span" aria-label="Tracked sessions">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Trusted feedback</div>
          <h2>Tracked sessions</h2>
        </div>
        <p class="support-copy">Actions submit directly to the ATLAS lifecycle route so the desktop state and the session ledger stay in sync.</p>
      </div>
      ${pageData.sessions.length > 0
        ? `<div class="session-list">${pageData.sessions.map((session) => renderSessionCard(session)).join("")}</div>`
        : '<div class="empty-state"><strong>No session state is available yet.</strong><p class="support-copy">ATLAS will surface tracked work here as soon as the next session is written.</p></div>'}
    </section>
  </section>`;
}

function renderAtlasAppShell(pageData: AtlasPageData, view: AtlasView): string {
  const counts = countSessions(pageData.sessions);
  const pageTitle = view === "sessions" ? "ATLAS Sessions" : pageData.title;

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
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 20px 40px;
    }
    .shell {
      display: grid;
      gap: 18px;
    }
    .masthead,
    .content-grid,
    .metric-grid,
    .session-list,
    .definition-grid,
    .chip-row,
    .cta-row,
    .action-row {
      display: grid;
      gap: 12px;
    }
    .masthead {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      padding: 18px 20px;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: rgba(17, 17, 17, 0.92);
      box-shadow: var(--shadow);
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
    .masthead-meta {
      display: grid;
      justify-items: end;
      gap: 10px;
    }
    .repo-tag,
    .chip,
    .nav-link,
    .metric-card,
    .action-button,
    .empty-state {
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
    .content-grid {
      grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
    }
    .panel,
    .session-card {
      padding: 22px;
      border-radius: 24px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(20, 20, 20, 0.96), rgba(12, 12, 12, 0.96));
      box-shadow: var(--shadow);
    }
    .panel-span {
      grid-column: 1 / -1;
    }
    .hero-panel h1,
    .section-heading h2,
    h3 {
      margin: 0;
      letter-spacing: -0.04em;
    }
    .hero-panel h1 {
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
    .command-block,
    .definition-stack {
      display: grid;
      gap: 8px;
      margin-top: 18px;
    }
    .cta-row {
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      justify-content: start;
      margin-top: 22px;
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
      margin-bottom: 18px;
    }
    .metric-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .metric-card {
      padding: 16px;
      display: grid;
      gap: 8px;
    }
    .metric-card span {
      color: var(--muted);
      font-size: 13px;
    }
    .metric-card strong {
      font-size: 34px;
      letter-spacing: -0.05em;
    }
    .session-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .session-card-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
      flex-wrap: wrap;
    }
    .definition-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: 18px 0;
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
    .empty-state {
      padding: 20px;
    }
    @media (max-width: 960px) {
      .masthead,
      .content-grid,
      .metric-grid,
      .session-list,
      .definition-grid {
        grid-template-columns: 1fr;
      }
      .masthead-meta {
        justify-items: start;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="shell" aria-label="ATLAS desktop surface">
      <header class="masthead">
        <div class="brand-block">
          <div class="brand-mark">A</div>
          <div>
            <div class="eyebrow">Native desktop workspace</div>
            <p class="product-title">ATLAS</p>
            <p class="product-copy">${escapeHtml(pageData.hostLabel)} · ${escapeHtml(pageData.pipelineDetail)}</p>
          </div>
        </div>
        <div class="masthead-meta">
          <div class="repo-tag">${escapeHtml(pageData.repoLabel)}</div>
          <div class="meta-copy">Build session ${escapeHtml(pageData.buildSessionId)}</div>
          ${renderNavigation(view)}
        </div>
      </header>
      ${view === "home" ? renderHomeContent(pageData, counts) : renderSessionsContent(pageData, counts)}
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
