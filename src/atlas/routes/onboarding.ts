import type { IncomingMessage, ServerResponse } from "node:http";

import {
  AtlasClarificationError,
  createAtlasClarificationPacket,
  readAtlasClarificationStatus,
  type AtlasClarificationRunner,
} from "../clarification.js";
import { queueAtlasBuildForSession } from "../build_runtime.js";
import {
  AtlasDesktopSessionError,
  upsertAtlasResolvedOnboardingSession,
  type AtlasDesktopSessionRecord,
} from "../desktop_sessions.js";
import { readAtlasDesktopRepoContext } from "../repository_context.js";
import type { AtlasDesktopRepoContext } from "../desktop_state.js";

type QueueOnboardingBuildForSession = (options: {
  stateDir: string;
  session: AtlasDesktopSessionRecord;
}) => Promise<unknown>;

export interface AtlasOnboardingRouteOptions {
  stateDir: string;
  sessionId: string;
  targetRepo?: string;
  clarificationCommand?: string;
  clarificationRunner?: AtlasClarificationRunner;
  queueBuildForSession?: QueueOnboardingBuildForSession;
}

interface AtlasOnboardingPayload {
  objective?: string;
}

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64_000) {
        reject(new AtlasClarificationError("Onboarding payload exceeded 64KB.", 413, "payload_too_large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function parseOnboardingPayload(body: string): AtlasOnboardingPayload {
  try {
    return JSON.parse(body || "{}") as AtlasOnboardingPayload;
  } catch (error) {
    throw new AtlasClarificationError(
      `Onboarding payload is not valid JSON: ${String((error as Error)?.message || error)}`,
      400,
      "invalid_payload",
    );
  }
}

async function resolveOnboardingRepoContext(options: AtlasOnboardingRouteOptions): Promise<AtlasDesktopRepoContext> {
  const storedRepoContext = await readAtlasDesktopRepoContext(options.stateDir);
  if (storedRepoContext) {
    return storedRepoContext;
  }

  const targetRepo = String(options.targetRepo || "").trim();
  if (!targetRepo) {
    throw new AtlasClarificationError("Select a repository context before starting Atlas.", 400, "missing_repo_context");
  }

  return {
    provider: "github",
    targetRepo,
    targetBaseBranch: null,
    repoMode: "existing",
    repoCreatedByAtlas: false,
  };
}

export async function handleAtlasOnboardingRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasOnboardingRouteOptions,
): Promise<void> {
  const method = String(req.method || "GET").toUpperCase();

  try {
    if (method === "GET") {
      const status = await readAtlasClarificationStatus(options.stateDir, options.sessionId);
      writeJsonResponse(res, 200, {
        ok: true,
        ready: status.ready,
        sessionId: options.sessionId,
        packet: status.packet,
      });
      return;
    }

    if (method !== "POST") {
      writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
      return;
    }

    const rawBody = await readRequestBody(req);
    const payload = parseOnboardingPayload(rawBody);
    const repoContext = await resolveOnboardingRepoContext(options);
    const packet = await createAtlasClarificationPacket({
      stateDir: options.stateDir,
      sessionId: options.sessionId,
      targetRepo: repoContext.targetRepo,
      repoMode: repoContext.repoMode,
      objective: String(payload.objective || "").trim(),
      command: options.clarificationCommand,
      runner: options.clarificationRunner,
    });
    const session = await upsertAtlasResolvedOnboardingSession({
      stateDir: options.stateDir,
      sessionId: options.sessionId,
      objective: String(payload.objective || "").trim(),
      repoContext,
      packet,
    });
    const queueBuild = options.queueBuildForSession || queueAtlasBuildForSession;
    const buildRequest = await queueBuild({ stateDir: options.stateDir, session });

    writeJsonResponse(res, 200, {
      ok: true,
      ready: true,
      sessionId: session.id,
      session,
      packet,
      buildRequest,
    });
  } catch (error) {
    const clarificationError = error instanceof AtlasClarificationError
      ? error
      : error instanceof AtlasDesktopSessionError
        ? new AtlasClarificationError(error.message, error.statusCode, error.code)
      : new AtlasClarificationError(
        String((error as Error)?.message || error),
        500,
        "onboarding_failed",
      );
    console.error(`[atlas] onboarding route failed: ${clarificationError.message}`);
    writeJsonResponse(res, clarificationError.statusCode, {
      ok: false,
      error: clarificationError.message,
      code: clarificationError.code,
      sessionId: options.sessionId,
    });
  }
}
