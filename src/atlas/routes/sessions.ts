import type { IncomingMessage, ServerResponse } from "node:http";

import { parseAtlasDesktopLocationFromUrl } from "../desktop_state.js";
import { renderAtlasSessionsHtml } from "../renderer.js";
import {
  buildAtlasPageData,
  respondWithClarificationGateIfNeeded,
  type AtlasHomeRouteOptions,
  writeAtlasHtmlResponse,
} from "./home.js";

export type AtlasSessionsRouteOptions = AtlasHomeRouteOptions;

export async function handleAtlasSessionsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasSessionsRouteOptions,
): Promise<void> {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>Method Not Allowed</h1></body></html>");
    return;
  }

  try {
    if (await respondWithClarificationGateIfNeeded(res, options)) {
      return;
    }

    const pageData = await buildAtlasPageData(
      options,
      parseAtlasDesktopLocationFromUrl(String(req.url || "/sessions")) || {
        surface: "sessions",
        focusedSessionRole: null,
      },
    );
    writeAtlasHtmlResponse(res, renderAtlasSessionsHtml({
      ...pageData,
      title: "ATLAS Sessions",
    }));
  } catch (error) {
    console.error(`[atlas] sessions route failed: ${String((error as Error)?.message || error)}`);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>ATLAS Sessions unavailable</h1><p>Review the route logs and try again.</p></body></html>");
  }
}
