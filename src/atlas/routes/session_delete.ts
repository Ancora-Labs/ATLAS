import type { IncomingMessage, ServerResponse } from "node:http";

import {
  AtlasDesktopSessionError,
  deleteAtlasDesktopSession,
  MAX_ATLAS_DESKTOP_SESSIONS,
} from "../desktop_sessions.js";

export interface AtlasSessionDeleteRouteOptions {
  stateDir: string;
}

interface AtlasSessionDeletePayload {
  sessionId?: string;
}

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parsePayload(body: string): AtlasSessionDeletePayload {
  try {
    return JSON.parse(body || "{}") as AtlasSessionDeletePayload;
  } catch (error) {
    throw new AtlasDesktopSessionError(
      `Delete payload is not valid JSON: ${String((error as Error)?.message || error)}`,
      400,
      "invalid_payload",
    );
  }
}

export async function handleAtlasSessionDeleteRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasSessionDeleteRouteOptions,
): Promise<void> {
  if (String(req.method || "POST").toUpperCase() !== "POST") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    const payload = parsePayload(await readRequestBody(req));
    const result = await deleteAtlasDesktopSession({
      stateDir: options.stateDir,
      sessionId: String(payload.sessionId || "").trim(),
    });
    writeJsonResponse(res, 200, {
      ok: true,
      deletedSessionId: result.deletedSession.id,
      sessions: result.sessions,
      maxTrackedSessions: MAX_ATLAS_DESKTOP_SESSIONS,
    });
  } catch (error) {
    const sessionError = error instanceof AtlasDesktopSessionError
      ? error
      : new AtlasDesktopSessionError(String((error as Error)?.message || error), 500, "session_delete_failed");
    console.error(`[atlas] session delete failed: ${sessionError.message}`);
    writeJsonResponse(res, sessionError.statusCode, {
      ok: false,
      error: sessionError.message,
      code: sessionError.code,
    });
  }
}
