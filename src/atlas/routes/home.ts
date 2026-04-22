import type { IncomingMessage, ServerResponse } from "node:http";

import { renderAtlasHomeHtml, type AtlasPageData } from "../renderer.js";
import { listAtlasSessions, type AtlasSessionDto } from "../state_bridge.js";
import { readPipelineProgress } from "../../core/pipeline_progress.js";

export interface AtlasHomeRouteOptions {
  stateDir: string;
  targetRepo?: string;
  hostLabel?: string;
  shellCommand?: string;
}

function normalizeRepoLabel(targetRepo?: string): string {
  const repo = String(targetRepo || "").trim();
  return repo || "Target repo not configured";
}

function sortSessions(sessions: AtlasSessionDto[]): AtlasSessionDto[] {
  return [...sessions].sort((left, right) => {
    const leftIsAtlas = left.name === "Atlas" ? 0 : 1;
    const rightIsAtlas = right.name === "Atlas" ? 0 : 1;
    if (leftIsAtlas !== rightIsAtlas) {
      return leftIsAtlas - rightIsAtlas;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function buildAtlasPageData(options: AtlasHomeRouteOptions): Promise<AtlasPageData> {
  const pipelineProgress = await readPipelineProgress({ paths: { stateDir: options.stateDir } });
  const sessions = await listAtlasSessions({ stateDir: options.stateDir });

  return {
    title: "ATLAS Home",
    repoLabel: normalizeRepoLabel(options.targetRepo),
    hostLabel: String(options.hostLabel || "Windows host").trim() || "Windows host",
    shellCommand: String(options.shellCommand || ".\\ATLAS.cmd").trim() || ".\\ATLAS.cmd",
    pipelineStageLabel: String(pipelineProgress?.stageLabel || "Idle"),
    pipelineDetail: String(pipelineProgress?.detail || "System ready"),
    pipelinePercent: Number(pipelineProgress?.percent || 0),
    updatedAt: typeof pipelineProgress?.updatedAt === "string" ? pipelineProgress.updatedAt : null,
    sessions: sortSessions(Object.values(sessions)),
  };
}

export async function handleAtlasHomeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasHomeRouteOptions,
): Promise<void> {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>Method Not Allowed</h1></body></html>");
    return;
  }

  try {
    const pageData = await buildAtlasPageData(options);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderAtlasHomeHtml(pageData));
  } catch (error) {
    console.error(`[atlas] home route failed: ${String((error as Error)?.message || error)}`);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>ATLAS Home unavailable</h1><p>Review the route logs and try again.</p></body></html>");
  }
}
