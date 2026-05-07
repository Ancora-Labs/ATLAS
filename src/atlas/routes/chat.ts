import type { IncomingMessage, ServerResponse } from "node:http";
import { File } from "node:buffer";

import {
  AtlasDesktopSessionError,
  continueAtlasDesktopSession,
  listAtlasDesktopSessions,
  MAX_ATLAS_DESKTOP_SESSIONS,
  startAtlasDesktopSession,
} from "../desktop_sessions.js";
import { queueAtlasBuildForSession } from "../build_runtime.js";
import type { AtlasSessionAttachmentInput } from "../attachments.js";
import type { AtlasClarificationRunner } from "../clarification.js";
import { hydrateAtlasGitHubAuthFromState } from "../github_auth.js";
import {
  consumeAtlasDesktopRepoContext,
  readAtlasDesktopRepoContext,
  resolveAtlasRepoContextForNewSession,
} from "../repository_context.js";

export interface AtlasChatRouteOptions {
  stateDir: string;
  targetRepo?: string;
  clarificationCommand?: string;
  clarificationRunner?: AtlasClarificationRunner;
}

interface AtlasChatPayload {
  sessionId?: string;
  message?: string;
  selectedModel?: string;
  projectName?: string;
  projectDescription?: string;
  attachments?: AtlasSessionAttachmentInput[];
}

const ATLAS_MAX_CHAT_PAYLOAD_BYTES = 32 * 1024 * 1024;
const ATLAS_MAX_CHAT_ATTACHMENTS = 8;
const ATLAS_MAX_CHAT_ATTACHMENT_BYTES = 12 * 1024 * 1024;

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += bufferChunk.byteLength;
      if (totalBytes > ATLAS_MAX_CHAT_PAYLOAD_BYTES) {
        reject(new AtlasDesktopSessionError("Chat payload exceeded 32MB.", 413, "payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(bufferChunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const buffer = await readRequestBuffer(req);
  return buffer.toString("utf8");
}

function parsePayload(body: string): AtlasChatPayload {
  try {
    return JSON.parse(body || "{}") as AtlasChatPayload;
  } catch (error) {
    throw new AtlasDesktopSessionError(
      `Chat payload is not valid JSON: ${String((error as Error)?.message || error)}`,
      400,
      "invalid_payload",
    );
  }
}

function createHeadersFromRequest(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(name, entry);
      }
      continue;
    }
    if (typeof value === "string") {
      headers.set(name, value);
    }
  }
  return headers;
}

async function parseMultipartPayload(req: IncomingMessage): Promise<AtlasChatPayload> {
  const body = await readRequestBuffer(req);
  const requestBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  let request: Request;
  try {
    request = new Request("http://127.0.0.1/api/chat/session", {
      method: "POST",
      headers: createHeadersFromRequest(req),
      body: requestBody,
    });
  } catch (error) {
    throw new AtlasDesktopSessionError(
      `Chat payload could not be prepared for multipart parsing: ${String((error as Error)?.message || error)}`,
      400,
      "invalid_payload",
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    throw new AtlasDesktopSessionError(
      `Chat payload is not valid multipart data: ${String((error as Error)?.message || error)}`,
      400,
      "invalid_payload",
    );
  }

  const attachments: AtlasSessionAttachmentInput[] = [];
  for (const entry of formData.getAll("attachments")) {
    if (!(entry instanceof File)) {
      continue;
    }
    if (attachments.length >= ATLAS_MAX_CHAT_ATTACHMENTS) {
      throw new AtlasDesktopSessionError(
        `ATLAS accepts at most ${String(ATLAS_MAX_CHAT_ATTACHMENTS)} attachments per message.`,
        413,
        "attachment_limit_reached",
      );
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    if (buffer.byteLength > ATLAS_MAX_CHAT_ATTACHMENT_BYTES) {
      throw new AtlasDesktopSessionError(
        `${entry.name || "Attachment"} exceeded the 12MB attachment limit.`,
        413,
        "attachment_too_large",
      );
    }
    if (buffer.byteLength === 0) {
      continue;
    }

    attachments.push({
      originalName: entry.name || "attachment",
      mediaType: entry.type || "application/octet-stream",
      byteSize: buffer.byteLength,
      buffer,
    });
  }

  return {
    sessionId: String(formData.get("sessionId") || "").trim() || undefined,
    message: String(formData.get("message") || "").trim(),
    selectedModel: String(formData.get("selectedModel") || "").trim() || undefined,
    projectName: String(formData.get("projectName") || "").trim() || undefined,
    projectDescription: String(formData.get("projectDescription") || "").trim() || undefined,
    attachments,
  };
}

async function readChatPayload(req: IncomingMessage): Promise<AtlasChatPayload> {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    return parseMultipartPayload(req);
  }
  const rawBody = await readRequestBody(req);
  return parsePayload(rawBody);
}

export async function handleAtlasChatRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasChatRouteOptions,
): Promise<void> {
  if (String(req.method || "POST").toUpperCase() !== "POST") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    await hydrateAtlasGitHubAuthFromState(options.stateDir);
    const payload = await readChatPayload(req);
    const message = String(payload.message || "").trim();
    const selectedModel = String(payload.selectedModel || "").trim() || null;
    const projectName = String(payload.projectName || "").trim() || null;
    const projectDescription = String(payload.projectDescription || "").trim() || null;
    const repoContext = payload.sessionId
      ? null
      : await resolveAtlasRepoContextForNewSession(options.stateDir, message, {
          projectName,
          projectDescription,
        });

    const isNewSession = !payload.sessionId;
    const session = payload.sessionId
      ? await continueAtlasDesktopSession({
          stateDir: options.stateDir,
          sessionId: String(payload.sessionId || "").trim(),
          message,
          attachments: payload.attachments || [],
          clarificationCommand: options.clarificationCommand,
          clarificationRunner: options.clarificationRunner,
        })
      : await startAtlasDesktopSession({
          stateDir: options.stateDir,
          repoContext,
          message,
          selectedModel,
          projectName,
          projectDescription,
          attachments: payload.attachments || [],
          clarificationCommand: options.clarificationCommand,
          clarificationRunner: options.clarificationRunner,
        });

    if (isNewSession) {
      await consumeAtlasDesktopRepoContext(options.stateDir);
    }

    if (session.status === "ready") {
      try {
        await queueAtlasBuildForSession({
          stateDir: options.stateDir,
          session,
        });
      } catch (error) {
        console.error(`[atlas] build queue trigger failed: ${String((error as Error)?.message || error)}`);
      }
    }

    const sessions = await listAtlasDesktopSessions(options.stateDir);
    writeJsonResponse(res, 200, {
      ok: true,
      session,
      sessions,
      repoContext: session.repoContext || await readAtlasDesktopRepoContext(options.stateDir),
      maxTrackedSessions: MAX_ATLAS_DESKTOP_SESSIONS,
    });
  } catch (error) {
    const sessionError = error instanceof AtlasDesktopSessionError
      ? error
      : (error instanceof AtlasDesktopSessionError ? error : new AtlasDesktopSessionError(
          String((error as Error)?.message || error),
          error instanceof AtlasDesktopSessionError ? error.statusCode : 500,
          error instanceof AtlasDesktopSessionError ? error.code : "chat_failed",
        ));

    console.error(`[atlas] chat route failed: ${sessionError.message}`);
    writeJsonResponse(res, sessionError.statusCode, {
      ok: false,
      error: sessionError.message,
      code: sessionError.code,
    });
  }
}
