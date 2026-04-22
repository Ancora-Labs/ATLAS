import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleAtlasHomeRequest, type AtlasHomeRouteOptions } from "./routes/home.js";
import { handleAtlasSessionsRequest } from "./routes/sessions.js";

export const ATLAS_DEFAULT_PORT = 8788;

export interface AtlasServerOptions extends Partial<AtlasHomeRouteOptions> {
  port?: number;
}

function resolveAtlasServerOptions(options: AtlasServerOptions = {}): Required<AtlasServerOptions> {
  const rawPort = Number(options.port ?? process.env.ATLAS_PORT ?? process.env.BOX_ATLAS_PORT ?? ATLAS_DEFAULT_PORT);
  return {
    port: Number.isInteger(rawPort) && rawPort > 0 ? rawPort : ATLAS_DEFAULT_PORT,
    stateDir: String(options.stateDir || path.join(process.cwd(), "state")),
    targetRepo: String(options.targetRepo || process.env.TARGET_REPO || ""),
    hostLabel: String(options.hostLabel || process.env.BOX_ATLAS_HOST_LABEL || "Windows host"),
    shellCommand: String(options.shellCommand || process.env.BOX_ATLAS_SHELL_COMMAND || ".\\ATLAS.cmd"),
  };
}

async function routeAtlasRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: Required<AtlasServerOptions>,
): Promise<void> {
  const url = new URL(req.url || "/", "http://127.0.0.1");

  try {
    if (url.pathname === "/") {
      await handleAtlasHomeRequest(req, res, options);
      return;
    }

    if (url.pathname === "/sessions") {
      await handleAtlasSessionsRequest(req, res, options);
      return;
    }

    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>ATLAS route not found</h1></body></html>");
  } catch (error) {
    console.error(`[atlas] request routing failed: ${String((error as Error)?.message || error)}`);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    }
    res.end("<!doctype html><html><body><h1>ATLAS server unavailable</h1><p>Review the server logs and try again.</p></body></html>");
  }
}

export function createAtlasServer(options: AtlasServerOptions = {}): http.Server {
  const resolvedOptions = resolveAtlasServerOptions(options);
  return http.createServer((req, res) => {
    routeAtlasRequest(req, res, resolvedOptions).catch((error) => {
      console.error(`[atlas] unhandled request failure: ${String((error as Error)?.message || error)}`);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
      }
      res.end("<!doctype html><html><body><h1>ATLAS server unavailable</h1><p>Review the server logs and try again.</p></body></html>");
    });
  });
}

export async function startAtlasServer(options: AtlasServerOptions = {}): Promise<http.Server> {
  const resolvedOptions = resolveAtlasServerOptions(options);
  const server = createAtlasServer(resolvedOptions);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(resolvedOptions.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

async function main(): Promise<void> {
  try {
    const server = await startAtlasServer();
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : ATLAS_DEFAULT_PORT;
    console.log(`[atlas] server running at http://127.0.0.1:${port}`);
  } catch (error) {
    console.error(`[atlas] failed to start server: ${String((error as Error)?.message || error)}`);
    process.exitCode = 1;
  }
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryFile === fileURLToPath(import.meta.url)) {
  main();
}
