import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import { renderAtlasHomeHtml, type AtlasPageData } from "../renderer.js";
import { bridgeBoxTargetSessionState, type AtlasSessionDto } from "../state_bridge.js";
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

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`[atlas] failed to read ${path.basename(filePath)}: ${String((error as Error)?.message || error)}`);
    }
    return fallback;
  }
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
  const workerSessions = await readJsonFile<Record<string, unknown>>(
    path.join(options.stateDir, "worker_sessions.json"),
    {},
  );
  const pipelineProgress = await readPipelineProgress({ paths: { stateDir: options.stateDir } });
  const sessions = bridgeBoxTargetSessionState(workerSessions);

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
