import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { readAtlasClarificationStatus } from "../clarification.js";
import {
  parseAtlasDesktopLocationFromUrl,
  type AtlasDesktopLocation,
  type AtlasDesktopProductSurface,
} from "../desktop_state.js";
import { renderAtlasHomeHtml, type AtlasPageData } from "../renderer.js";
import {
  compareAtlasSessionsForDesktop,
  listAtlasSessions,
  type AtlasSessionDto,
} from "../state_bridge.js";
import { readPipelineProgress } from "../../core/pipeline_progress.js";
import { normalizeWorkerName } from "../../core/role_registry.js";

export interface AtlasHomeRouteOptions {
  stateDir: string;
  targetRepo?: string;
  hostLabel?: string;
  shellCommand?: string;
  desktopSessionId?: string;
}

interface AtlasDesktopBuildInfo {
  sessionId?: unknown;
  builtAt?: unknown;
}

function normalizeRepoLabel(targetRepo?: string): string {
  const repo = String(targetRepo || "").trim();
  return repo || "Target repo not configured";
}

function sortSessions(sessions: AtlasSessionDto[]): AtlasSessionDto[] {
  return [...sessions].sort(compareAtlasSessionsForDesktop);
}

export function resolveAtlasDesktopPageLocation(
  requestUrl: string | undefined,
  fallbackSurface: AtlasDesktopProductSurface,
): AtlasDesktopLocation {
  const fallbackPath = fallbackSurface === "sessions" ? "/sessions" : "/";
  return parseAtlasDesktopLocationFromUrl(String(requestUrl || fallbackPath))
    || {
      surface: fallbackSurface,
      focusedSessionRole: null,
    };
}

function resolveFocusedSessionRole(
  sessions: AtlasSessionDto[],
  requestedRole: string | null,
): string | null {
  const normalizedRequestedRole = normalizeWorkerName(String(requestedRole || ""));
  if (!normalizedRequestedRole) {
    return null;
  }

  const match = sessions.find((session) => normalizeWorkerName(session.role) === normalizedRequestedRole);
  return match?.role || null;
}

export function deriveAtlasHomeReadiness(
  sessions: AtlasSessionDto[],
): Pick<AtlasPageData, "homePrimaryActionLabel" | "homeReadinessHeading" | "homeReadinessDetail"> {
  const hasResumableSessions = sessions.some((session) => session.isResumable);
  return hasResumableSessions
    ? {
        homePrimaryActionLabel: "Resume session flow",
        homeReadinessHeading: "Ready to resume",
        homeReadinessDetail: "One or more roles can continue from their recorded state.",
      }
    : {
        homePrimaryActionLabel: "Open sessions",
        homeReadinessHeading: "Ready to start",
        homeReadinessDetail: "No resumable session is active yet. Open Sessions to begin the next role handoff.",
      };
}

export function writeAtlasHtmlResponse(res: ServerResponse, html: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

export function renderClarificationRequiredHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ATLAS Home</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #080808;
      --panel: #151515;
      --line: rgba(255, 255, 255, 0.12);
      --text: #f5f5f5;
      --muted: #c6c6c6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #020202 0%, var(--bg) 100%);
      color: var(--text);
      font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
      padding: 24px;
    }
    main {
      width: min(760px, 100%);
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--panel);
    }
    h1, p { margin: 0; }
    p { margin-top: 14px; color: var(--muted); line-height: 1.7; }
  </style>
</head>
<body>
  <main aria-label="ATLAS clarification gate">
    <p>Desktop onboarding</p>
    <h1>Finish clarification in the ATLAS desktop window.</h1>
    <p>The main home surface opens after the first clarification packet is recorded for this desktop session.</p>
  </main>
</body>
</html>`;
}

export async function respondWithClarificationGateIfNeeded(
  res: ServerResponse,
  options: AtlasHomeRouteOptions,
): Promise<boolean> {
  const desktopSessionId = String(options.desktopSessionId || "").trim();
  if (!desktopSessionId) {
    return false;
  }

  const clarificationStatus = await readAtlasClarificationStatus(options.stateDir, desktopSessionId);
  if (clarificationStatus.ready) {
    return false;
  }

  res.writeHead(412, { "content-type": "text/html; charset=utf-8" });
  res.end(renderClarificationRequiredHtml());
  return true;
}

async function readDesktopBuildInfo(): Promise<{ sessionId: string; builtAt: string | null; }> {
  const buildInfoPath = path.join(process.cwd(), "desktop-build-info.json");
  try {
    const raw = await fs.readFile(buildInfoPath, "utf8");
    const parsed = JSON.parse(raw) as AtlasDesktopBuildInfo;
    return {
      sessionId: String(parsed?.sessionId || "unknown-session").trim() || "unknown-session",
      builtAt: typeof parsed?.builtAt === "string" && parsed.builtAt.trim() ? parsed.builtAt.trim() : null,
    };
  } catch (error) {
    console.error(`[atlas] failed to read desktop build info: ${String((error as Error)?.message || error)}`);
    return {
      sessionId: "unknown-session",
      builtAt: null,
    };
  }
}

export async function buildAtlasPageData(
  options: AtlasHomeRouteOptions,
  location: AtlasDesktopLocation = {
    surface: "home",
    focusedSessionRole: null,
  },
): Promise<AtlasPageData> {
  const pipelineProgress = await readPipelineProgress({ paths: { stateDir: options.stateDir } });
  const sessions = await listAtlasSessions({ stateDir: options.stateDir });
  const sortedSessions = sortSessions(Object.values(sessions));
  const buildInfo = await readDesktopBuildInfo();
  const requestedFocusedSessionRole = String(location.focusedSessionRole || "").trim() || null;
  const focusedSessionRole = resolveFocusedSessionRole(sortedSessions, requestedFocusedSessionRole);
  const missingFocusedSnapshot = Boolean(requestedFocusedSessionRole && !focusedSessionRole);

  const pageData = {
    title: "ATLAS Home",
    repoLabel: normalizeRepoLabel(options.targetRepo),
    hostLabel: String(options.hostLabel || "Windows host").trim() || "Windows host",
    shellCommand: String(options.shellCommand || ".\\ATLAS.cmd").trim() || ".\\ATLAS.cmd",
    pipelineStageLabel: String(pipelineProgress?.stageLabel || "Idle"),
    pipelineDetail: String(pipelineProgress?.detail || "System ready"),
    pipelinePercent: Number(pipelineProgress?.percent || 0),
    updatedAt: typeof pipelineProgress?.updatedAt === "string" ? pipelineProgress.updatedAt : null,
    buildSessionId: buildInfo.sessionId,
    buildTimestamp: buildInfo.builtAt,
    focusedSessionRole,
    missingFocusedSnapshot,
    ...deriveAtlasHomeReadiness(sortedSessions),
    sessions: sortedSessions,
  };
  return pageData as AtlasPageData;
}

export async function handleAtlasHomeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasHomeRouteOptions,
): Promise<void> {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>Method Not Allowed</h1></body></html>");
    return;
  }

  try {
    if (await respondWithClarificationGateIfNeeded(res, options)) {
      return;
    }

    const pageData = await buildAtlasPageData(options, resolveAtlasDesktopPageLocation(req.url, "home"));
    writeAtlasHtmlResponse(res, renderAtlasHomeHtml(pageData));
  } catch (error) {
    console.error(`[atlas] home route failed: ${String((error as Error)?.message || error)}`);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>ATLAS Home unavailable</h1><p>Review the route logs and try again.</p></body></html>");
  }
}
