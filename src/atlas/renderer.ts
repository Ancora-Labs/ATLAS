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
  sessions: AtlasSessionDto[];
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

function normalizeStatus(status: string): string {
  return String(status || "idle").trim().toLowerCase();
}

function clampPercent(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function countSessions(sessions: AtlasSessionDto[]) {
  const statuses = sessions.map((session) => normalizeStatus(session.status));
  return {
    total: sessions.length,
    active: statuses.filter((status) => status === "working").length,
    needsInput: sessions.filter((session) => session.needsInput).length,
    completed: statuses.filter((status) => status === "done").length,
  };
}

function renderShell(pageData: AtlasPageData, activeView: "home" | "sessions", content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageData.title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0a1017;
      --panel: rgba(11, 18, 26, 0.94);
      --panel-strong: rgba(16, 26, 37, 0.98);
      --line: rgba(132, 187, 255, 0.16);
      --line-strong: rgba(132, 187, 255, 0.26);
      --text: #f3f7fb;
      --muted: #a5b5c8;
      --accent: #88baff;
      --accent-strong: #4a8fff;
      --success: #8de1b1;
      --warn: #ffc77a;
      --error: #ff9a9a;
      --surface: rgba(8, 14, 21, 0.76);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: "Segoe UI", Inter, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(74, 143, 255, 0.16), transparent 24%),
        radial-gradient(circle at top right, rgba(141, 225, 177, 0.10), transparent 20%),
        linear-gradient(180deg, #0a1017 0%, #101925 100%);
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px 18px 40px;
    }
    .window {
      border: 1px solid var(--line);
      border-radius: 22px;
      overflow: hidden;
      background: var(--panel);
      box-shadow: 0 26px 72px rgba(0, 0, 0, 0.28);
    }
    .window__titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(16, 26, 37, 0.98), rgba(11, 18, 26, 0.98));
      font-size: 13px;
    }
    .window__controls {
      display: flex;
      gap: 8px;
    }
    .window__controls span {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
      background: rgba(255, 255, 255, 0.24);
    }
    .window__controls span:nth-child(1) { background: #ff7b72; }
    .window__controls span:nth-child(2) { background: #ffd866; }
    .window__controls span:nth-child(3) { background: #8de1b1; }
    .window__title {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .window__meta {
      color: var(--muted);
      font-family: Consolas, "Cascadia Code", monospace;
    }
    .shell-nav, .command-bar, .hero__meta, .metrics, .surface-grid, .session-grid {
      display: grid;
      gap: 14px;
    }
    .window__content {
      padding: 20px;
    }
    .shell-nav {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      margin-bottom: 18px;
    }
    .shell-nav a, .hero__cta {
      text-decoration: none;
      color: inherit;
    }
    .nav-link, .metric, .panel, .session-card {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--surface);
    }
    .nav-link {
      padding: 14px 16px;
      min-height: 74px;
    }
    .nav-link[aria-current="page"] {
      border-color: var(--line-strong);
      background: rgba(74, 143, 255, 0.10);
    }
    .eyebrow, .metric span, .label, .session-meta__label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: clamp(32px, 5vw, 48px); }
    h2 { font-size: clamp(22px, 4vw, 30px); }
    h3 { font-size: 20px; }
    .hero {
      padding: 24px;
      margin-bottom: 18px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(22, 36, 52, 0.98), rgba(10, 17, 25, 0.98));
    }
    .hero p, .panel p, .session-card p, .nav-link p {
      margin-top: 10px;
      color: #d6e1ee;
      line-height: 1.5;
    }
    .hero__meta {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin: 18px 0;
    }
    .hero__meta > div, .command-bar, .metric {
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(8, 14, 21, 0.62);
    }
    .command-bar {
      grid-template-columns: auto 1fr;
      align-items: center;
      margin-top: 18px;
    }
    .command-bar code, .session-meta code {
      color: #dfe9f7;
      font-family: Consolas, "Cascadia Code", monospace;
      word-break: break-word;
    }
    .hero__actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .hero__cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      border-radius: 999px;
      font-weight: 700;
      background: var(--accent);
      color: #08111d;
    }
    .hero__link {
      display: inline-flex;
      align-items: center;
      padding: 12px 16px;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--text);
      text-decoration: none;
    }
    .metrics {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin-bottom: 18px;
    }
    .metric strong {
      display: block;
      margin-top: 10px;
      font-size: 30px;
    }
    .surface-grid {
      grid-template-columns: 1.3fr 1fr;
    }
    .panel {
      padding: 20px;
    }
    .progress {
      width: 100%;
      height: 12px;
      margin: 16px 0;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(136, 186, 255, 0.10);
    }
    .progress > span {
      display: block;
      height: 100%;
      width: ${escapeHtml(String(clampPercent(pageData.pipelinePercent)))}%;
      background: linear-gradient(90deg, var(--accent-strong), var(--success));
    }
    .session-grid {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .session-card {
      padding: 18px;
      min-height: 220px;
    }
    .session-card--action-needed { border-color: rgba(255, 199, 122, 0.36); }
    .session-card--working { border-color: rgba(136, 186, 255, 0.36); }
    .session-card--completed { border-color: rgba(141, 225, 177, 0.32); }
    .session-card--unavailable { border-color: rgba(255, 154, 154, 0.26); }
    .session-card__status {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      margin-top: 12px;
      background: rgba(255, 255, 255, 0.06);
    }
    .session-meta {
      margin-top: 16px;
      display: grid;
      gap: 12px;
    }
    .empty-state {
      padding: 18px;
      border-radius: 18px;
      border: 1px dashed var(--line-strong);
      color: var(--muted);
      background: rgba(8, 14, 21, 0.38);
    }
    @media (max-width: 860px) {
      .surface-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="window" aria-label="ATLAS shell">
      <div class="window__titlebar">
        <div class="window__title">
          <div class="window__controls" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <strong>ATLAS Desktop Session Control</strong>
          <span class="window__meta">${escapeHtml(pageData.hostLabel)}</span>
        </div>
        <span class="window__meta">${escapeHtml(pageData.repoLabel)}</span>
      </div>
      <div class="window__content">
        <nav class="shell-nav" aria-label="ATLAS surfaces">
          <a class="nav-link" href="/"${activeView === "home" ? " aria-current=\"page\"" : ""}>
            <div class="eyebrow">Surface</div>
            <h3>Home</h3>
            <p>Overview for the current single-target workspace.</p>
          </a>
          <a class="nav-link" href="/sessions"${activeView === "sessions" ? " aria-current=\"page\"" : ""}>
            <div class="eyebrow">Surface</div>
            <h3>Sessions</h3>
            <p>Inspect every worker session with its current branch and next step.</p>
          </a>
        </nav>
        ${content}
      </div>
    </section>
  </main>
</body>
</html>`;
}

function sessionTone(session: AtlasSessionDto): string {
  if (session.needsInput) return "session-card--action-needed";
  if (session.status === "working") return "session-card--working";
  if (session.status === "done") return "session-card--completed";
  if (session.status === "offline" || session.status === "error") return "session-card--unavailable";
  return "";
}

export function renderAtlasHomeHtml(pageData: AtlasPageData): string {
  const sessions = [...pageData.sessions];
  const counts = countSessions(sessions);
  const resumable = sessions.some((session) => session.isResumable);
  const primaryLabel = resumable ? "Resume session flow" : "Open sessions";

  const content = `<section class="hero">
    <div class="eyebrow">Windows-first product shell</div>
    <h1>${escapeHtml(pageData.repoLabel)}</h1>
    <p>ATLAS keeps the desktop workspace, worker roles, and current cycle aligned inside one dedicated product shell.</p>
    <div class="hero__meta">
      <div>
        <div class="label">Current cycle</div>
        <strong>${escapeHtml(pageData.pipelineStageLabel)}</strong>
      </div>
      <div>
        <div class="label">Updated</div>
        <strong>${escapeHtml(formatTimestamp(pageData.updatedAt))}</strong>
      </div>
      <div>
        <div class="label">Host shell</div>
        <strong>${escapeHtml(pageData.hostLabel)}</strong>
      </div>
    </div>
    <div class="command-bar" aria-label="Windows launcher">
      <span class="label">Launch command</span>
      <code>${escapeHtml(pageData.shellCommand)}</code>
    </div>
    <div class="hero__actions">
      <a class="hero__cta" href="/sessions">${escapeHtml(primaryLabel)}</a>
      <a class="hero__link" href="/sessions">Review active roles</a>
    </div>
  </section>
  <section class="metrics" aria-label="Session summary">
    <article class="metric">
      <span>Total sessions</span>
      <strong>${escapeHtml(String(counts.total))}</strong>
      <p>Roles tracked by the ATLAS state bridge.</p>
    </article>
    <article class="metric">
      <span>Active sessions</span>
      <strong>${escapeHtml(String(counts.active))}</strong>
      <p>Sessions that are currently moving work forward.</p>
    </article>
    <article class="metric">
      <span>Needs input</span>
      <strong>${escapeHtml(String(counts.needsInput))}</strong>
      <p>Sessions waiting for a response before they can continue.</p>
    </article>
    <article class="metric">
      <span>Completed</span>
      <strong>${escapeHtml(String(counts.completed))}</strong>
      <p>Sessions already closed in this workspace.</p>
    </article>
  </section>
  <section class="surface-grid" aria-label="ATLAS home details">
    <article class="panel">
      <div class="eyebrow">Cycle detail</div>
      <h2>${escapeHtml(pageData.pipelineStageLabel)}</h2>
      <div class="progress" aria-hidden="true"><span></span></div>
      <p>${escapeHtml(pageData.pipelineDetail)}</p>
    </article>
    <article class="panel">
      <div class="eyebrow">Session handoff</div>
      <h2>${resumable ? "Ready to resume" : "Ready to start"}</h2>
      <p>${escapeHtml(resumable
        ? "One or more roles can continue from their recorded state."
        : "No resumable session is active yet. Open Sessions to begin the next role handoff.")}</p>
    </article>
  </section>`;

  return renderShell(pageData, "home", content);
}

export function renderAtlasSessionsHtml(pageData: AtlasPageData): string {
  const sessions = [...pageData.sessions];
  const content = `<section class="hero">
    <div class="eyebrow">Session control</div>
    <h1>Worker sessions</h1>
    <p>Every role is presented with its readiness state, branch context, and last recorded task so ATLAS can stay focused on a single target.</p>
    <div class="command-bar" aria-label="Windows launcher">
      <span class="label">Launch command</span>
      <code>${escapeHtml(pageData.shellCommand)}</code>
    </div>
  </section>
  <section class="panel">
    <div class="eyebrow">Session list</div>
    <h2>${escapeHtml(String(sessions.length))} tracked role${sessions.length === 1 ? "" : "s"}</h2>
    ${sessions.length === 0
      ? `<div class="empty-state">No session state is available yet. Start ATLAS from the Windows shell to populate the first role handoff.</div>`
      : `<div class="session-grid">${sessions.map((session) => `<article class="session-card ${sessionTone(session)}">
            <div class="eyebrow">Role</div>
            <h3>${escapeHtml(session.name)}</h3>
            <div class="session-card__status">${escapeHtml(session.statusLabel)} · ${escapeHtml(session.readinessLabel)}</div>
            <div class="session-meta">
              <div>
                <div class="session-meta__label">Last task</div>
                <p>${escapeHtml(session.lastTask || "Waiting for the first task")}</p>
              </div>
              <div>
                <div class="session-meta__label">Current branch</div>
                <code>${escapeHtml(session.currentBranch || "No branch recorded")}</code>
              </div>
              <div>
                <div class="session-meta__label">Last update</div>
                <p>${escapeHtml(formatTimestamp(session.lastActiveAt))}</p>
              </div>
              <div>
                <div class="session-meta__label">Files touched / PRs</div>
                <p>${escapeHtml(String(session.touchedFileCount))} files · ${escapeHtml(String(session.pullRequestCount))} PRs</p>
              </div>
            </div>
          </article>`).join("")}</div>`}
  </section>`;

  return renderShell(pageData, "sessions", content);
}
