import type { IncomingMessage, ServerResponse } from "node:http";

import { listAtlasCompletedSessions } from "../completed_sessions.js";
import { renderAtlasSessionsHtml } from "../renderer.js";
import { buildAtlasPageData, type AtlasHomeRouteOptions, writeAtlasHtmlResponse } from "./home.js";

export type AtlasSessionsRouteOptions = AtlasHomeRouteOptions;

function resolveCompletedSessionSelection(requestUrl: string | undefined): { projectId: string | null; sessionId: string | null } {
  try {
    const parsedUrl = new URL(String(requestUrl || "/sessions"), "http://127.0.0.1");
    const projectId = String(parsedUrl.searchParams.get("projectId") || "").trim() || null;
    const sessionId = String(parsedUrl.searchParams.get("sessionId") || "").trim() || null;
    return { projectId, sessionId };
  } catch {
    return { projectId: null, sessionId: null };
  }
}

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
    const pageData = await buildAtlasPageData(options, req.url);
    const completedSessions = await listAtlasCompletedSessions(options.stateDir);
    const requestedSelection = resolveCompletedSessionSelection(req.url);
    const completedSession = requestedSelection.projectId && requestedSelection.sessionId
      ? (completedSessions.find((record) => record.projectId === requestedSelection.projectId && record.sessionId === requestedSelection.sessionId) || null)
      : null;
    writeAtlasHtmlResponse(res, renderAtlasSessionsHtml({
      ...pageData,
      title: completedSession ? `${completedSession.title} | ATLAS` : "ATLAS Completed Sessions",
      mainPaneMode: completedSession ? "completed-session-detail" : "completed-session-list",
      completedSessionCount: completedSessions.length,
      completedSessions,
      completedSession,
      focusedCompletedSessionKey: completedSession?.key || null,
    }));
  } catch (error) {
    console.error(`[atlas] sessions route failed: ${String((error as Error)?.message || error)}`);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>ATLAS Sessions unavailable</h1><p>Review the route logs and try again.</p></body></html>");
  }
}
