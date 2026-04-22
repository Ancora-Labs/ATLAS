import type { IncomingMessage, ServerResponse } from "node:http";

import { AtlasLifecycleError, runAtlasLifecycleAction, type AtlasLifecycleAction } from "../lifecycle.js";

export interface AtlasLifecycleRouteOptions {
  stateDir: string;
  pathname?: string;
}

interface LifecyclePayload {
  action: AtlasLifecycleAction;
  role?: string | null;
  returnTo?: string | null;
}

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function writeHtmlError(res: ServerResponse, statusCode: number, message: string): void {
  res.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><body><h1>ATLAS lifecycle unavailable</h1><p>${message}</p></body></html>`);
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 32_768) {
        reject(new AtlasLifecycleError("Lifecycle payload exceeded 32KB.", 413, "payload_too_large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", (error) => reject(error));
  });
}

function isJsonRequest(req: IncomingMessage, pathname: string): boolean {
  const accept = String(req.headers.accept || "").toLowerCase();
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  return pathname === "/api/lifecycle"
    || accept.includes("application/json")
    || contentType.includes("application/json");
}

function parseLifecyclePayload(body: string, req: IncomingMessage): LifecyclePayload {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return JSON.parse(body || "{}") as LifecyclePayload;
  }

  const params = new URLSearchParams(body);
  return {
    action: String(params.get("action") || "") as AtlasLifecycleAction,
    role: params.get("role"),
    returnTo: params.get("returnTo"),
  };
}

export async function handleAtlasLifecycleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasLifecycleRouteOptions,
): Promise<void> {
  const pathname = String(options.pathname || req.url || "/lifecycle");
  const wantsJson = isJsonRequest(req, pathname);

  if (String(req.method || "POST").toUpperCase() !== "POST") {
    if (wantsJson) {
      writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    } else {
      writeHtmlError(res, 405, "Method Not Allowed");
    }
    return;
  }

  try {
    const body = await readRequestBody(req);
    const payload = parseLifecyclePayload(body, req);
    const result = await runAtlasLifecycleAction(options.stateDir, payload);

    if (wantsJson) {
      writeJsonResponse(res, 200, result);
      return;
    }

    res.writeHead(303, { location: result.redirectTo });
    res.end();
  } catch (error) {
    const lifecycleError = error instanceof AtlasLifecycleError
      ? error
      : new AtlasLifecycleError(String((error as Error)?.message || error), 500, "lifecycle_failed");
    console.error(`[atlas] lifecycle route failed: ${lifecycleError.message}`);

    if (wantsJson) {
      writeJsonResponse(res, lifecycleError.statusCode, {
        ok: false,
        error: lifecycleError.message,
        code: lifecycleError.code,
      });
      return;
    }

    writeHtmlError(res, lifecycleError.statusCode, lifecycleError.message);
  }
}
