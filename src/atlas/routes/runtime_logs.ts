import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { readAtlasBuildRequest, resolveAtlasProjectBindingForSession, type AtlasResolvedProjectBinding } from "../build_runtime.js";
import { listAtlasDesktopSessions } from "../desktop_sessions.js";
import { resolveAtlasRuntimeStateDir } from "../runtime_state_root.js";

export interface AtlasRuntimeLogsRouteOptions {
  stateDir: string;
}

interface AtlasRuntimeLogGroup {
  label: string;
  source: string;
  updatedAt: string | null;
  content: string;
}

interface AtlasProjectSessionLogCandidate {
  sessionId: string;
  sessionPath: string;
  progressLogPath: string;
  updatedAt: string | null;
  repoFullName: string | null;
  objective: string | null;
  atlasDesktopSessionId: string | null;
}

interface AtlasResolvedProjectSessionLog {
  candidate: AtlasProjectSessionLogCandidate;
  group: AtlasRuntimeLogGroup;
}

const ATLAS_RAW_LOG_LINE_LIMIT = 320;

function getCurrentWorkspaceProjectSessionId(): string | null {
  const candidate = path.basename(process.cwd());
  return candidate.startsWith("sess_") ? candidate : null;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function shouldUseGlobalRuntimeFallback(requestedSessionId: string | null, focusedSessionId: string | null): boolean {
  return !requestedSessionId && !focusedSessionId;
}

function shouldUseHeuristicProjectLogMatch(requestedSessionId: string | null, focusedSessionId: string | null): boolean {
  return !requestedSessionId && !focusedSessionId;
}

function trimRawLogContent(raw: string): string {
  const lines = raw.replace(/\u0000/g, "").split(/\r?\n/);
  return lines.slice(-ATLAS_RAW_LOG_LINE_LIMIT).join("\n").trim();
}

function normalizeSearchText(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function extractAtlasDesktopSessionIdFromNotes(notes: unknown): string | null {
  if (!Array.isArray(notes)) {
    return null;
  }

  for (const note of notes) {
    const match = /^ATLAS desktop session id:\s*(.+)$/i.exec(String(note || "").trim());
    if (match?.[1]) {
      return match[1].trim() || null;
    }
  }

  return null;
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function resolveProjectLogRoots(stateDir: string): Promise<string[]> {
  const roots = new Set<string>([path.join(stateDir, "projects")]);
  let currentDir = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    const parentDir = path.dirname(currentDir);
    if (!parentDir || parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
    const siblingBoxProjectsRoot = path.join(currentDir, "Box", "state", "projects");
    if (await pathExists(siblingBoxProjectsRoot)) {
      roots.add(siblingBoxProjectsRoot);
    }
  }
  return [...roots];
}

async function readRuntimeLogGroup(
  stateDir: string,
  label: string,
  candidates: string[],
): Promise<AtlasRuntimeLogGroup | null> {
  for (const candidate of candidates) {
    const logPath = path.isAbsolute(candidate) ? candidate : path.join(stateDir, candidate);
    try {
      const stats = await fs.stat(logPath);
      if (!stats.isFile()) {
        continue;
      }
      const raw = await fs.readFile(logPath, "utf8");
      const content = trimRawLogContent(raw);
      if (!content) {
        continue;
      }
      return {
        label,
        source: path.relative(stateDir, logPath) || path.basename(logPath),
        updatedAt: stats.mtime.toISOString(),
        content,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`[atlas] runtime logs route failed to read ${logPath}: ${String((error as Error)?.message || error)}`);
      }
    }
  }
  return null;
}

async function readProjectSessionLogGroup(stateDir: string, candidate: AtlasProjectSessionLogCandidate): Promise<AtlasRuntimeLogGroup | null> {
  try {
    const stats = await fs.stat(candidate.progressLogPath);
    if (!stats.isFile()) {
      return null;
    }

    const raw = await fs.readFile(candidate.progressLogPath, "utf8");
    const trimmed = trimRawLogContent(raw);
    return {
      label: "Session progress",
      source: path.relative(stateDir, candidate.progressLogPath) || path.basename(candidate.progressLogPath),
      updatedAt: stats.mtime.toISOString(),
      content: trimmed || "session_progress.log exists for this session, but it is still empty.",
    };
  } catch {
    return null;
  }
}

function buildProjectSessionLogCandidateFromBinding(
  runtimeStateDir: string,
  binding: AtlasResolvedProjectBinding,
  repoFullName: string | null,
  objective: string | null,
): AtlasProjectSessionLogCandidate {
  const sessionPath = path.join(runtimeStateDir, "projects", binding.projectId, binding.projectSessionId);
  return {
    sessionId: binding.projectSessionId,
    sessionPath,
    progressLogPath: path.join(sessionPath, "session_progress.log"),
    updatedAt: binding.updatedAt,
    repoFullName,
    objective,
    atlasDesktopSessionId: null,
  };
}

function buildMissingProjectSessionLogGroup(runtimeStateDir: string, candidate: AtlasProjectSessionLogCandidate): AtlasRuntimeLogGroup {
  return {
    label: "Session progress",
    source: path.relative(runtimeStateDir, candidate.progressLogPath) || path.basename(candidate.progressLogPath),
    updatedAt: candidate.updatedAt,
    content: "No session_progress.log has been written for this mission yet.",
  };
}

async function collectProjectSessionLogCandidates(stateDir: string): Promise<AtlasProjectSessionLogCandidate[]> {
  const candidates: AtlasProjectSessionLogCandidate[] = [];

  for (const projectsRoot of await resolveProjectLogRoots(stateDir)) {
    const projectEntries = await fs.readdir(projectsRoot, { withFileTypes: true }).catch(() => []);

    for (const projectEntry of projectEntries) {
      if (!projectEntry.isDirectory()) {
        continue;
      }

      const projectDir = path.join(projectsRoot, projectEntry.name);
      const sessionEntries = await fs.readdir(projectDir, { withFileTypes: true }).catch(() => []);
      for (const sessionEntry of sessionEntries) {
        if (!sessionEntry.isDirectory() || !sessionEntry.name.startsWith("sess_")) {
          continue;
        }

        const sessionPath = path.join(projectDir, sessionEntry.name);
        const progressLogPath = path.join(sessionPath, "session_progress.log");
        const progressStats = await fs.stat(progressLogPath).catch(() => null);
        if (!progressStats?.isFile()) {
          continue;
        }

        const targetSession = await readJsonObject(path.join(sessionPath, "target_session.json"));
        const objective = targetSession && typeof targetSession.objective === "object" && targetSession.objective && !Array.isArray(targetSession.objective)
          ? String((targetSession.objective as Record<string, unknown>).summary || "").trim() || null
          : null;
        const repoFullName = targetSession && typeof targetSession.repo === "object" && targetSession.repo && !Array.isArray(targetSession.repo)
          ? String((targetSession.repo as Record<string, unknown>).repoFullName || "").trim() || null
          : null;
        const atlasDesktopSessionId = extractAtlasDesktopSessionIdFromNotes(
          targetSession && typeof targetSession.hints === "object" && targetSession.hints && !Array.isArray(targetSession.hints)
            ? (targetSession.hints as Record<string, unknown>).notes
            : null,
        );

        candidates.push({
          sessionId: sessionEntry.name,
          sessionPath,
          progressLogPath,
          updatedAt: progressStats.mtime.toISOString(),
          repoFullName,
          objective,
          atlasDesktopSessionId,
        });
      }
    }
  }

  return candidates;
}

function scoreProjectSessionCandidate(
  candidate: AtlasProjectSessionLogCandidate,
  focusedSessionId: string | null,
  focusedSessionRepo: string | null,
  focusedObjective: string | null,
  requestedAt: string | null,
): number {
  let score = 0;
  let hasIdentitySignal = false;
  const workspaceProjectSessionId = getCurrentWorkspaceProjectSessionId();

  if (workspaceProjectSessionId && candidate.sessionId === workspaceProjectSessionId) {
    score += 100;
    hasIdentitySignal = true;
  }

  if (focusedSessionId && candidate.atlasDesktopSessionId === focusedSessionId) {
    score += 100;
    hasIdentitySignal = true;
  }

  const normalizedCandidateRepo = normalizeSearchText(candidate.repoFullName);
  const normalizedFocusedRepo = normalizeSearchText(focusedSessionRepo);
  if (normalizedCandidateRepo && normalizedCandidateRepo === normalizedFocusedRepo) {
    score += 12;
    hasIdentitySignal = true;
  }

  const normalizedCandidateObjective = normalizeSearchText(candidate.objective);
  const normalizedFocusedObjective = normalizeSearchText(focusedObjective);
  if (normalizedCandidateObjective && normalizedFocusedObjective) {
    if (normalizedCandidateObjective.includes(normalizedFocusedObjective) || normalizedFocusedObjective.includes(normalizedCandidateObjective)) {
      score += 6;
      hasIdentitySignal = true;
    }
  }

  if (hasIdentitySignal) {
    const requestedAtMs = requestedAt ? Date.parse(requestedAt) : Number.NaN;
    const updatedAtMs = candidate.updatedAt ? Date.parse(candidate.updatedAt) : Number.NaN;
    if (Number.isFinite(requestedAtMs) && Number.isFinite(updatedAtMs)) {
      const diffMs = Math.abs(updatedAtMs - requestedAtMs);
      if (diffMs <= 30 * 60 * 1000) {
        score += 3;
      } else if (diffMs <= 6 * 60 * 60 * 1000) {
        score += 1;
      }
    }
  }

  return score;
}

async function resolveFocusedProjectSessionLogGroup(
  stateDir: string,
  focusedSessionId: string | null,
  focusedSessionRepo: string | null,
  focusedObjective: string | null,
  requestedAt: string | null,
): Promise<AtlasResolvedProjectSessionLog | null> {
  const candidates = await collectProjectSessionLogCandidates(stateDir);
  if (candidates.length === 0) {
    return null;
  }

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreProjectSessionCandidate(candidate, focusedSessionId, focusedSessionRepo, focusedObjective, requestedAt),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return Date.parse(right.candidate.updatedAt || "") - Date.parse(left.candidate.updatedAt || "");
    });

  const winner = ranked[0]?.candidate || null;
  if (!winner) {
    return null;
  }

  const group = await readProjectSessionLogGroup(stateDir, winner);
  return group ? { candidate: winner, group } : null;
}

export async function handleAtlasRuntimeLogsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasRuntimeLogsRouteOptions,
): Promise<void> {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    const requestUrl = new URL(req.url || "/api/runtime/logs", "http://127.0.0.1");
    const requestedSessionId = String(requestUrl.searchParams.get("sessionId") || "").trim() || null;
    const buildRequest = await readAtlasBuildRequest(options.stateDir);
    const sessions = await listAtlasDesktopSessions(options.stateDir);
    const focusedSession = requestedSessionId
      ? (sessions.find((session) => session.id === requestedSessionId) || null)
      : (buildRequest
          ? (sessions.find((session) => session.id === buildRequest.sessionId) || null)
          : null);
    const runtimeStateDir = await resolveAtlasRuntimeStateDir(options.stateDir);
    const focusedBinding = focusedSession
      ? await resolveAtlasProjectBindingForSession(options.stateDir, focusedSession, buildRequest, {
          allowHeuristicMatch: false,
        })
      : null;
    const directProjectLogCandidate = focusedBinding
      ? buildProjectSessionLogCandidateFromBinding(
          runtimeStateDir,
          focusedBinding,
          focusedSession?.repoContext?.targetRepo || buildRequest?.targetRepo || null,
          focusedSession?.objective || buildRequest?.objective || null,
        )
      : null;
    const directProjectLogGroup = directProjectLogCandidate
      ? (await readProjectSessionLogGroup(runtimeStateDir, directProjectLogCandidate)
        || buildMissingProjectSessionLogGroup(runtimeStateDir, directProjectLogCandidate))
      : null;
    const resolvedProjectLog = directProjectLogGroup
      ? {
          candidate: directProjectLogCandidate,
          group: directProjectLogGroup,
        }
      : (shouldUseHeuristicProjectLogMatch(requestedSessionId, focusedSession?.id || null)
          ? await resolveFocusedProjectSessionLogGroup(
              options.stateDir,
              focusedSession?.id || buildRequest?.sessionId || null,
              focusedSession?.repoContext?.targetRepo || buildRequest?.targetRepo || null,
              focusedSession?.objective || buildRequest?.objective || null,
              buildRequest?.requestedAt || null,
            )
          : null);
    const fallbackRuntimeGroup = resolvedProjectLog || !shouldUseGlobalRuntimeFallback(requestedSessionId, focusedSession?.id || null)
      ? null
      : await readRuntimeLogGroup(options.stateDir, "Runtime stream", ["live_agents.log"]);
    const logGroups = [resolvedProjectLog?.group || null, fallbackRuntimeGroup]
      .filter((entry): entry is AtlasRuntimeLogGroup => entry !== null);

    writeJsonResponse(res, 200, {
      ok: true,
      sessionId: focusedSession?.id || buildRequest?.sessionId || null,
      sessionTitle: focusedSession?.title || buildRequest?.title || "Live build mission",
      projectSessionId: resolvedProjectLog?.candidate.sessionId || null,
      groups: logGroups,
    });
  } catch (error) {
    console.error(`[atlas] runtime logs route failed: ${String((error as Error)?.message || error)}`);
    writeJsonResponse(res, 500, {
      ok: false,
      error: "ATLAS could not read the raw runtime logs.",
    });
  }
}