import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { readAtlasCompletedSession } from "../completed_sessions.js";

export interface AtlasCompletedSessionFilesDeleteRouteOptions {
  stateDir: string;
}

interface AtlasCompletedSessionFilesDeletePayload {
  projectId?: string;
  sessionId?: string;
}

class AtlasCompletedSessionFilesDeleteError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "completed_session_files_delete_error") {
    super(message);
    this.name = "AtlasCompletedSessionFilesDeleteError";
    this.statusCode = statusCode;
    this.code = code;
  }
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

function parsePayload(body: string): AtlasCompletedSessionFilesDeletePayload {
  try {
    return JSON.parse(body || "{}") as AtlasCompletedSessionFilesDeletePayload;
  } catch (error) {
    throw new AtlasCompletedSessionFilesDeleteError(
      `Completed session cleanup payload is not valid JSON: ${String((error as Error)?.message || error)}`,
      400,
      "invalid_payload",
    );
  }
}

function normalizeRequiredId(value: unknown, fieldName: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new AtlasCompletedSessionFilesDeleteError(`Completed session ${fieldName} is required.`, 400, `missing_${fieldName}`);
  }
  return normalized;
}

function resolveDeletableWorkspacePath(workspacePath: string | null, projectId: string, sessionId: string): string {
  const normalizedPath = String(workspacePath || "").trim();
  if (!normalizedPath) {
    throw new AtlasCompletedSessionFilesDeleteError(
      "No preserved workspace snapshot was recorded for this completed session.",
      409,
      "workspace_snapshot_missing",
    );
  }

  const resolvedPath = path.resolve(normalizedPath);
  if (path.basename(resolvedPath) !== sessionId || path.basename(path.dirname(resolvedPath)) !== projectId) {
    throw new AtlasCompletedSessionFilesDeleteError(
      "Completed session workspace path failed safety validation.",
      409,
      "workspace_snapshot_invalid",
    );
  }

  return resolvedPath;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function handleAtlasCompletedSessionFilesDeleteRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasCompletedSessionFilesDeleteRouteOptions,
): Promise<void> {
  if (String(req.method || "POST").toUpperCase() !== "POST") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    const payload = parsePayload(await readRequestBody(req));
    const projectId = normalizeRequiredId(payload.projectId, "projectId");
    const sessionId = normalizeRequiredId(payload.sessionId, "sessionId");
    const completedSession = await readAtlasCompletedSession(options.stateDir, projectId, sessionId);
    if (!completedSession) {
      throw new AtlasCompletedSessionFilesDeleteError(
        "The selected completed session no longer exists.",
        404,
        "completed_session_not_found",
      );
    }

    const workspacePath = resolveDeletableWorkspacePath(completedSession.workspacePath, projectId, sessionId);
    const alreadyMissing = !(await pathExists(workspacePath));
    if (!alreadyMissing) {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }

    writeJsonResponse(res, 200, {
      ok: true,
      projectId,
      sessionId,
      workspacePath,
      deleted: !alreadyMissing,
      alreadyMissing,
      message: alreadyMissing
        ? "Session files were already removed from this PC. The completed session record is still available."
        : "Session files deleted from this PC. The completed session record is still available.",
    });
  } catch (error) {
    const cleanupError = error instanceof AtlasCompletedSessionFilesDeleteError
      ? error
      : new AtlasCompletedSessionFilesDeleteError(
        String((error as Error)?.message || error),
        500,
        "completed_session_files_delete_failed",
      );
    console.error(`[atlas] completed session file cleanup failed: ${cleanupError.message}`);
    writeJsonResponse(res, cleanupError.statusCode, {
      ok: false,
      error: cleanupError.message,
      code: cleanupError.code,
    });
  }
}