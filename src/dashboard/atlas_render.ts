import { SYSTEM_STATUS_REASON_CODE } from "../core/pipeline_progress.js";

interface AtlasSessionCard {
  name?: string;
  status?: string;
  statusLabel?: string;
  readiness?: string;
  readinessLabel?: string;
  lastTask?: string;
  lastActiveAt?: string | null;
}

export interface AtlasSessionSummary {
  projectLabel?: string;
  targetRepo?: string;
  systemStatus?: string;
  systemStatusText?: string;
  degradedReason?: string | null;
  statusFreshnessAt?: string | null;
  pipelineStageLabel?: string;
  pipelineDetail?: string;
  pipelinePercent?: number;
  sessions?: AtlasSessionCard[];
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "Waiting for the next update";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Waiting for the next update";
  return timestamp.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeStatusNote(reason: string | null | undefined): string | null {
  switch (reason) {
    case SYSTEM_STATUS_REASON_CODE.FALLBACK_HEURISTIC:
      return "Live status is catching up to the latest cycle data.";
    case SYSTEM_STATUS_REASON_CODE.MISSING_PIPELINE_STATE:
      return "Cycle data is not available yet, so ATLAS is waiting for the first write.";
    case SYSTEM_STATUS_REASON_CODE.DAEMON_OFFLINE:
      return "The delivery engine is offline. Start the system to resume work.";
    case SYSTEM_STATUS_REASON_CODE.HEALTH_FILE_DEGRADED:
      return "Delivery health needs attention before the next cycle can proceed.";
    default:
      return null;
  }
}

function normalizeStatus(status: string | null | undefined): string {
  return String(status || "idle").trim().toLowerCase();
}

function healthBadgeLabel(systemStatus: string): string {
  switch (systemStatus) {
    case "working":
      return "Working";
    case "degraded":
    case "blocked":
    case "error":
      return "Needs attention";
    case "offline":
      return "Stopped";
    default:
      return "Ready";
  }
}

function needsInput(status: string): boolean {
  return status === "blocked" || status === "error";
}

function isCompleted(status: string): boolean {
  return status === "done";
}

function isResumableSession(session: AtlasSessionCard): boolean {
  const status = normalizeStatus(session?.status);
  const lastTask = String(session?.lastTask || "").trim();
  if (status === "done" || status === "offline") return false;
  if (status === "working" || status === "blocked" || status === "error") return true;
  return lastTask.length > 0;
}

export function renderAtlasHtml(sessionSummary: AtlasSessionSummary): string {
  const sessions = Array.isArray(sessionSummary.sessions) ? sessionSummary.sessions : [];
  const normalizedStatuses = sessions.map((session) => normalizeStatus(session?.status));
  const totalSessions = sessions.length;
  const activeSessions = normalizedStatuses.filter((status) => status === "working").length;
  const sessionsNeedingInput = normalizedStatuses.filter((status) => needsInput(status)).length;
  const recentlyCompleted = normalizedStatuses.filter((status) => isCompleted(status)).length;
  const hasResumableSession = sessions.some((session) => isResumableSession(session));
  const primaryActionLabel = hasResumableSession ? "Continue last session" : "Open sessions";
  const note = describeStatusNote(sessionSummary.degradedReason || null);
  const updatedLabel = formatTimestamp(sessionSummary.statusFreshnessAt || null);
  const healthLabel = healthBadgeLabel(normalizeStatus(sessionSummary.systemStatus));
  const pipelinePercent = Math.max(0, Math.min(100, Number(sessionSummary.pipelinePercent || 0)));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ATLAS</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #09131a;
      --panel: rgba(13, 27, 35, 0.9);
      --panel-strong: rgba(17, 36, 46, 0.96);
      --line: rgba(121, 212, 193, 0.16);
      --text: #ecfffb;
      --muted: #9cbfba;
      --accent: #79d4c1;
      --attention: #ffb56b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(121, 212, 193, 0.16), transparent 25%),
        radial-gradient(circle at top right, rgba(103, 151, 255, 0.14), transparent 24%),
        linear-gradient(180deg, #09131a 0%, #101c24 100%);
    }
    main {
      max-width: 1080px;
      margin: 0 auto;
      padding: 28px 20px 40px;
    }
    .hero, .panel, .metric {
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--panel);
    }
    .hero, .panel { padding: 22px; }
    .hero {
      background: linear-gradient(135deg, rgba(20, 49, 58, 0.98), rgba(11, 23, 30, 0.98));
      margin-bottom: 18px;
    }
    .primary-nav, .hero__top, .hero__meta, .summary-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .primary-nav {
      margin-bottom: 18px;
      padding: 12px 16px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(13, 27, 35, 0.88);
    }
    .eyebrow, .nav-link, .metric span, .hero__meta span, .hero__action {
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .nav-link, .hero__action {
      text-decoration: none;
      border-bottom: 1px solid transparent;
    }
    .nav-link:hover, .hero__action:hover {
      color: var(--text);
      border-color: var(--accent);
    }
    h1, h2, p { margin: 0; }
    h1 { font-size: clamp(32px, 6vw, 52px); }
    h2 { font-size: clamp(22px, 4vw, 30px); }
    .hero p, .panel p {
      margin-top: 12px;
      color: #d3eee8;
      line-height: 1.5;
    }
    .hero__badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(121, 212, 193, 0.08);
      border: 1px solid rgba(121, 212, 193, 0.18);
    }
    .hero__note {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(255, 181, 107, 0.22);
      background: rgba(255, 181, 107, 0.08);
      color: #ffe5c2;
    }
    .hero__actions {
      margin-top: 18px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .hero__cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      border-radius: 999px;
      background: var(--accent);
      color: #082226;
      font-weight: 700;
      text-decoration: none;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin: 18px 0;
    }
    .metric {
      padding: 16px;
      background: var(--panel-strong);
      min-height: 128px;
    }
    .metric strong {
      display: block;
      margin: 12px 0 8px;
      font-size: 30px;
    }
    .progress {
      width: 100%;
      height: 12px;
      margin-top: 16px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(121, 212, 193, 0.08);
    }
    .progress > span {
      display: block;
      height: 100%;
      width: ${escapeHtml(pipelinePercent)}%;
      background: linear-gradient(90deg, var(--accent), #a6ece0);
    }
  </style>
</head>
<body>
  <main>
    <nav class="primary-nav" aria-label="Primary">
      <a class="nav-link" href="/atlas" aria-current="page">Home</a>
      <a class="nav-link" href="#sessions">Sessions</a>
      <a class="nav-link" href="#new-session">New Session</a>
      <a class="nav-link" href="#settings">Settings</a>
    </nav>

    <section class="hero" id="home">
      <div class="hero__top">
        <div>
          <div class="eyebrow">ATLAS</div>
          <h1>${escapeHtml(sessionSummary.projectLabel || "ATLAS")}</h1>
        </div>
        <div class="hero__badge">
          <span>Health</span>
          <strong>${escapeHtml(healthLabel)}</strong>
        </div>
      </div>
      <p>${escapeHtml(sessionSummary.systemStatusText || "System ready")} · ${escapeHtml(sessionSummary.targetRepo || "Target repo not configured")}</p>
      <div class="hero__meta">
        <div class="hero__badge">
          <span>Updated</span>
          <strong>${escapeHtml(updatedLabel)}</strong>
        </div>
        <div class="hero__badge">
          <span>Current cycle</span>
          <strong>${escapeHtml(sessionSummary.pipelineStageLabel || "Idle")}</strong>
        </div>
      </div>
      ${note ? `<div class="hero__note">${escapeHtml(note)}</div>` : ""}
      <div class="hero__actions">
        <a class="hero__cta" href="#sessions">${escapeHtml(primaryActionLabel)}</a>
        <a class="hero__action" href="/">Open operations dashboard</a>
      </div>
    </section>

    <section class="metrics" aria-label="Session summary" id="sessions">
      <article class="metric">
        <span>Total sessions</span>
        <strong>${escapeHtml(String(totalSessions))}</strong>
        <p>All tracked delivery sessions.</p>
      </article>
      <article class="metric">
        <span>Active sessions</span>
        <strong>${escapeHtml(String(activeSessions))}</strong>
        <p>Sessions currently moving work forward.</p>
      </article>
      <article class="metric">
        <span>Sessions needing input</span>
        <strong>${escapeHtml(String(sessionsNeedingInput))}</strong>
        <p>Sessions waiting on review or clarification.</p>
      </article>
      <article class="metric">
        <span>Recently completed</span>
        <strong>${escapeHtml(String(recentlyCompleted))}</strong>
        <p>Sessions closed in the latest cycle.</p>
      </article>
    </section>

    <section class="panel" aria-labelledby="atlas-cycle-heading">
      <div class="summary-row">
        <div>
          <div class="eyebrow">Cycle summary</div>
          <h2 id="atlas-cycle-heading">${escapeHtml(sessionSummary.pipelineStageLabel || "Idle")}</h2>
        </div>
        <div class="eyebrow">${escapeHtml(sessionSummary.targetRepo || "Target repo not configured")}</div>
      </div>
      <div class="progress" aria-hidden="true"><span></span></div>
      <p>${escapeHtml(sessionSummary.pipelineDetail || "Waiting for the next cycle update")}</p>
    </section>
  </main>
</body>
</html>`;
}
