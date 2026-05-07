import type { IncomingMessage, ServerResponse } from "node:http";

import { buildAtlasRuntimeSnapshot, readAtlasBuildRequest } from "../build_runtime.js";
import { listAtlasDesktopSessions } from "../desktop_sessions.js";

export interface AtlasRuntimeStatusRouteOptions {
  stateDir: string;
}

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

export async function handleAtlasRuntimeStatusRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasRuntimeStatusRouteOptions,
): Promise<void> {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    const requestUrl = new URL(req.url || "/api/runtime/status", "http://127.0.0.1");
    const requestedSessionId = String(requestUrl.searchParams.get("sessionId") || "").trim() || null;
    const buildRequest = await readAtlasBuildRequest(options.stateDir);
    const sessions = await listAtlasDesktopSessions(options.stateDir);
    const focusedSession = requestedSessionId
      ? (sessions.find((session) => session.id === requestedSessionId) || null)
      : (buildRequest
          ? (sessions.find((session) => session.id === buildRequest.sessionId) || null)
          : null);
    const snapshot = await buildAtlasRuntimeSnapshot({
      stateDir: options.stateDir,
      session: focusedSession,
    });

    writeJsonResponse(res, 200, {
      ok: true,
      snapshot,
    });
  } catch (error) {
    console.error(`[atlas] runtime status route failed: ${String((error as Error)?.message || error)}`);
    writeJsonResponse(res, 500, {
      ok: false,
      error: "ATLAS could not read the live build status.",
    });
  }
}