import type { IncomingMessage, ServerResponse } from "node:http";

import { resolveAtlasGitHubBootstrap, saveAtlasGitHubAuth, type SaveAtlasGitHubAuthPayload } from "../github_auth.js";

export interface AtlasAuthRouteOptions {
  stateDir: string;
}

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readAuthPayload(req: IncomingMessage): Promise<SaveAtlasGitHubAuthPayload> {
  const rawBody = await readRequestBody(req);
  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as SaveAtlasGitHubAuthPayload;
  } catch (error) {
    throw new Error(`Auth payload is not valid JSON: ${String((error as Error)?.message || error)}`, { cause: error });
  }
}

export async function handleAtlasAuthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasAuthRouteOptions,
): Promise<void> {
  const method = String(req.method || "GET").toUpperCase();

  try {
    if (method === "GET") {
      const bootstrap = await resolveAtlasGitHubBootstrap(options.stateDir);
      writeJsonResponse(res, 200, {
        ok: true,
        auth: bootstrap.auth,
        copilotUsage: bootstrap.copilotUsage,
        authRequired: bootstrap.authRequired,
      });
      return;
    }

    if (method !== "POST") {
      writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
      return;
    }

    const payload = await readAuthPayload(req);
    const bootstrap = await saveAtlasGitHubAuth(options.stateDir, payload);
    writeJsonResponse(res, 200, {
      ok: true,
      auth: bootstrap.auth,
      copilotUsage: bootstrap.copilotUsage,
      authRequired: bootstrap.authRequired,
    });
  } catch (error) {
    console.error(`[atlas] auth route failed: ${String((error as Error)?.message || error)}`);
    writeJsonResponse(res, 400, {
      ok: false,
      error: String((error as Error)?.message || error) || "ATLAS could not update the GitHub credentials.",
    });
  }
}