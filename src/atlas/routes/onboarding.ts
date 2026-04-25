import type { IncomingMessage, ServerResponse } from "node:http";

import {
  AtlasClarificationError,
  createAtlasSessionStartPacket,
  readAtlasClarificationStatus,
  type AtlasClarificationRunner,
} from "../clarification.js";

export interface AtlasOnboardingRouteOptions {
  stateDir: string;
  sessionId?: string;
  targetRepo?: string;
  clarificationCommand?: string;
  clarificationRunner?: AtlasClarificationRunner;
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

export async function handleAtlasOnboardingRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasOnboardingRouteOptions,
): Promise<void> {
  const method = String(req.method || "GET").toUpperCase();
  const sessionId = String(options.sessionId || "").trim();

  try {
    if (method === "GET") {
      if (!sessionId) {
        writeJsonResponse(res, 200, {
          ok: true,
          ready: false,
          sessionId: null,
          packet: null,
          code: "desktop_session_missing",
        });
        return;
      }

      const status = await readAtlasClarificationStatus(options.stateDir, sessionId);
      writeJsonResponse(res, 200, {
        ok: true,
        ready: true,
        sessionId,
        packet: status.packet,
        started: status.ready,
      });
      return;
    }

    if (method !== "POST") {
      writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
      return;
    }

    if (!sessionId) {
      writeJsonResponse(res, 409, {
        ok: false,
        error: "ATLAS onboarding is not bound to a desktop session.",
        code: "desktop_session_missing",
        sessionId: null,
      });
      return;
    }

    const rawBody = await readRequestBody(req);
    const payload = parseOnboardingPayload(rawBody);
      const packet = await createAtlasSessionStartPacket({
        stateDir: options.stateDir,
        sessionId,
        targetRepo: String(options.targetRepo || "").trim(),
        objective: String(payload.objective || "").trim(),
      });

      writeJsonResponse(res, 200, {
        ok: true,
        ready: true,
        sessionId,
        packet,
        started: true,
      });
  } catch (error) {
    const clarificationError = error instanceof AtlasClarificationError
      ? error
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
      sessionId: sessionId || null,
    });
  }
}
