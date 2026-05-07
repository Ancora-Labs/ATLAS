import type { IncomingMessage, ServerResponse } from "node:http";

import { hydrateAtlasGitHubAuthFromState } from "../github_auth.js";
import {
  clearAtlasDesktopRepoContext,
  listAtlasGitHubRepositories,
  readAtlasDesktopRepoContext,
  selectAtlasExistingRepoContext,
} from "../repository_context.js";

export interface AtlasRepositoriesRouteOptions {
  stateDir: string;
}

interface AtlasRepositorySelectionPayload {
  repoFullName?: string;
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

async function readSelectionPayload(req: IncomingMessage): Promise<AtlasRepositorySelectionPayload> {
  const rawBody = await readRequestBody(req);
  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as AtlasRepositorySelectionPayload;
  } catch (error) {
    throw new Error(`Repository payload is not valid JSON: ${String((error as Error)?.message || error)}`, { cause: error });
  }
}

export async function handleAtlasRepositoryListRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasRepositoriesRouteOptions,
): Promise<void> {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    await hydrateAtlasGitHubAuthFromState(options.stateDir);
    const requestUrl = new URL(req.url || "/api/repositories", "http://127.0.0.1");
    const query = String(requestUrl.searchParams.get("q") || "").trim();
    const [repositories, repoContext] = await Promise.all([
      listAtlasGitHubRepositories({ query }),
      readAtlasDesktopRepoContext(options.stateDir),
    ]);
    writeJsonResponse(res, 200, {
      ok: true,
      repoContext,
      repositories,
    });
  } catch (error) {
    console.error(`[atlas] repositories route failed: ${String((error as Error)?.message || error)}`);
    writeJsonResponse(res, 500, {
      ok: false,
      error: String((error as Error)?.message || error) || "ATLAS could not list GitHub repositories.",
    });
  }
}

export async function handleAtlasRepositorySelectRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasRepositoriesRouteOptions,
): Promise<void> {
  if (String(req.method || "POST").toUpperCase() !== "POST") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    await hydrateAtlasGitHubAuthFromState(options.stateDir);
    const payload = await readSelectionPayload(req);
    const repoContext = await selectAtlasExistingRepoContext(options.stateDir, String(payload.repoFullName || "").trim());
    writeJsonResponse(res, 200, {
      ok: true,
      repoContext,
    });
  } catch (error) {
    console.error(`[atlas] repository select failed: ${String((error as Error)?.message || error)}`);
    writeJsonResponse(res, 400, {
      ok: false,
      error: String((error as Error)?.message || error) || "ATLAS could not select that repository.",
    });
  }
}

export async function handleAtlasRepositoryClearRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasRepositoriesRouteOptions,
): Promise<void> {
  if (String(req.method || "POST").toUpperCase() !== "POST") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    await hydrateAtlasGitHubAuthFromState(options.stateDir);
    await clearAtlasDesktopRepoContext(options.stateDir);
    writeJsonResponse(res, 200, {
      ok: true,
      repoContext: null,
    });
  } catch (error) {
    console.error(`[atlas] repository clear failed: ${String((error as Error)?.message || error)}`);
    writeJsonResponse(res, 500, {
      ok: false,
      error: String((error as Error)?.message || error) || "ATLAS could not clear the repository context.",
    });
  }
}