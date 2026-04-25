import { timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { readAtlasClarificationStatus } from "../clarification.js";
import {
  parseAtlasDesktopLocationFromUrl,
  type AtlasDesktopLocation,
  type AtlasDesktopProductSurface,
} from "../desktop_state.js";
import { renderAtlasWorkspaceHtml, type AtlasPageData } from "../renderer.js";
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
  desktopSnapshotToken?: string;
}

export const ATLAS_SNAPSHOT_PATH = "/api/atlas/snapshot";
export const ATLAS_LEGACY_SNAPSHOT_PATH = "/api/snapshot";
export const ATLAS_SNAPSHOT_TOKEN_HEADER = "x-atlas-desktop-snapshot-token";

export interface AtlasSnapshotRequestPayload {
  focusRole?: string | null;
}

export interface AtlasSnapshotResponse {
  ok: true;
  pageData: AtlasPageData;
  snapshotAt: string;
  continuitySource: "live" | "cached";
  continuityDetail: string;
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

async function deriveAtlasWorkspaceRuntimeState(
  options: AtlasHomeRouteOptions,
  sessions: AtlasSessionDto[],
  focusedSessionRole: string | null,
  missingFocusedSnapshot: boolean,
): Promise<Pick<AtlasPageData, "sessionStartStatusLabel" | "sessionStartStatusDetail" | "sessionStartUpdatedAt" | "continuityStatusLabel" | "continuityStatusDetail">> {
  const hasLiveSessions = sessions.length > 0;
  const desktopSessionId = String(options.desktopSessionId || "").trim();

  let sessionStartStatusLabel = hasLiveSessions ? "New session available" : "Ready for first session";
  let sessionStartStatusDetail = hasLiveSessions
    ? "The left rail is showing live tracked sessions, and the main pane can switch back to a blank new-session start screen at any time."
    : "Start a session from the blank workspace composer to seed the first live workflow.";
  let sessionStartUpdatedAt: string | null = null;

  if (desktopSessionId) {
    try {
      const packetStatus = await readAtlasClarificationStatus(options.stateDir, desktopSessionId);
      if (packetStatus.ready && packetStatus.packet) {
        sessionStartUpdatedAt = packetStatus.packet.createdAt;
        sessionStartStatusLabel = "Session brief recorded";
        sessionStartStatusDetail = hasLiveSessions
          ? "The latest desktop brief is recorded. Use New Session to stay on the blank start screen or select a rail row to open live detail."
          : "The brief is recorded. ATLAS is waiting for the first live session snapshot before it shows selected-session detail.";
      }
    } catch (error) {
      console.error(`[atlas] failed to read desktop session brief status: ${String((error as Error)?.message || error)}`);
      sessionStartStatusLabel = "Session brief unavailable";
      sessionStartStatusDetail = "ATLAS could not read the last desktop session brief, but the blank start screen stays available.";
    }
  }

  if (missingFocusedSnapshot) {
    return {
      sessionStartStatusLabel,
      sessionStartStatusDetail,
      sessionStartUpdatedAt,
      continuityStatusLabel: "Selected detail unavailable",
      continuityStatusDetail: "The saved focus is not present in the current live snapshot, so ATLAS falls back to the blank new-session view instead of showing stale detail.",
    };
  }

  return {
    sessionStartStatusLabel,
    sessionStartStatusDetail,
    sessionStartUpdatedAt,
    continuityStatusLabel: hasLiveSessions ? "Live detail available" : "Waiting for live detail",
    continuityStatusDetail: hasLiveSessions
      ? "Select any session from the left rail to open its live detail view in the main pane."
      : "ATLAS will open selected-session detail as soon as the next tracked session snapshot is written.",
  };
}

export function resolveAtlasDesktopPageLocation(
  requestUrl: string | undefined,
  fallbackSurface: AtlasDesktopProductSurface,
): AtlasDesktopLocation {
  void fallbackSurface;
  const fallbackPath = "/";
  return parseAtlasDesktopLocationFromUrl(String(requestUrl || fallbackPath))
    || {
      surface: "workspace",
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
        homePrimaryActionLabel: "New Session",
        homeReadinessHeading: "Live sessions available",
        homeReadinessDetail: "Pick a tracked session from the left rail to inspect it, or stay on the blank start screen and write the next objective.",
      }
    : {
        homePrimaryActionLabel: "New Session",
        homeReadinessHeading: "Ready to start",
        homeReadinessDetail: "Write one outcome in the blank start screen composer to start the next session from the main workspace.",
      };
}

export function writeAtlasHtmlResponse(res: ServerResponse, html: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

export function writeAtlasJsonResponse(res: ServerResponse, payload: unknown): void {
  res.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function isAuthorizedSnapshotToken(providedToken: string, expectedToken: string): boolean {
  const provided = Buffer.from(providedToken, "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}

function isAtlasSnapshotRequestAuthorized(
  req: IncomingMessage,
  options: AtlasHomeRouteOptions,
): boolean {
  const expectedToken = String(options.desktopSnapshotToken || "").trim();
  if (!expectedToken) {
    return true;
  }

  const headerValue = req.headers[ATLAS_SNAPSHOT_TOKEN_HEADER];
  const providedToken = Array.isArray(headerValue)
    ? String(headerValue[0] || "").trim()
    : String(headerValue || "").trim();
  if (!providedToken) {
    return false;
  }

  return isAuthorizedSnapshotToken(providedToken, expectedToken);
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
    surface: "workspace",
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
  const runtimeState = await deriveAtlasWorkspaceRuntimeState(
    options,
    sortedSessions,
    requestedFocusedSessionRole,
    missingFocusedSnapshot,
  );

  const pageData = {
    title: "ATLAS Workspace",
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
    ...runtimeState,
    ...deriveAtlasHomeReadiness(sortedSessions),
    sessions: sortedSessions,
  };
  return pageData as AtlasPageData;
}

function resolveAtlasSnapshotLocation(requestUrl: string | undefined): AtlasDesktopLocation {
  const parsedUrl = new URL(String(requestUrl || "/api/snapshot"), "http://127.0.0.1");
  const focusedSessionRole = String(parsedUrl.searchParams.get("focusRole") || "").trim() || null;
  return {
    surface: "workspace",
    focusedSessionRole,
  };
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
    const pageData = await buildAtlasPageData(options, resolveAtlasDesktopPageLocation(req.url, "workspace"));
    writeAtlasHtmlResponse(res, renderAtlasWorkspaceHtml(pageData));
  } catch (error) {
    console.error(`[atlas] home route failed: ${String((error as Error)?.message || error)}`);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>ATLAS workspace unavailable</h1><p>Review the route logs and try again.</p></body></html>");
  }
}

export async function handleAtlasSnapshotRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasHomeRouteOptions,
): Promise<void> {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
    return;
  }

  if (!isAtlasSnapshotRequestAuthorized(req, options)) {
    res.writeHead(403, {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify({ ok: false, error: "ATLAS snapshot access denied" }));
    return;
  }

  try {
    const pageData = await buildAtlasPageData(options, resolveAtlasSnapshotLocation(req.url));
    const payload: AtlasSnapshotResponse = {
      ok: true,
      pageData,
      snapshotAt: new Date().toISOString(),
      continuitySource: "live",
      continuityDetail: pageData.continuityStatusDetail,
    };
    writeAtlasJsonResponse(res, payload);
  } catch (error) {
    console.error(`[atlas] snapshot route failed: ${String((error as Error)?.message || error)}`);
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "ATLAS snapshot unavailable" }));
  }
}
