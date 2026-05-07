import fs from "node:fs/promises";
import path from "node:path";

import { resolveAtlasRuntimeStateDir } from "./runtime_state_root.js";

export interface AtlasCompletedSessionRecord {
  key: string;
  projectId: string;
  sessionId: string;
  title: string;
  finalStatus: string;
  repoUrl: string | null;
  objective: string | null;
  workspacePath: string | null;
  archivedAt: string | null;
  completionReason: string | null;
  completionSummary: string | null;
  unresolvedItems: string[];
  workspaceSnapshotAvailable: boolean;
  presentation: AtlasCompletedSessionPresentation | null;
}

export interface AtlasCompletedSessionPresentation {
  status: string | null;
  locationType: string | null;
  primaryLocation: string | null;
  openTarget: string | null;
  userMessage: string | null;
  thinkingSummary: string | null;
  resolutionSource: string | null;
  executionMode: string | null;
  finalTarget: string | null;
  autoOpenStatus: string | null;
  autoOpenReason: string | null;
}

interface RawCompletedSessionRecord {
  projectId?: unknown;
  sessionId?: unknown;
  finalStatus?: unknown;
  repoUrl?: unknown;
  objective?: unknown;
  workspacePath?: unknown;
  archivedAt?: unknown;
  completionReason?: unknown;
  completionSummary?: unknown;
  unresolvedItems?: unknown;
  presentation?: unknown;
  delivery?: unknown;
  presentationAutoOpen?: unknown;
  autoOpen?: unknown;
}

interface RawTargetCompletionRecord {
  status?: unknown;
  projectId?: unknown;
  sessionId?: unknown;
  objectiveSummary?: unknown;
  summary?: unknown;
  evaluatedAt?: unknown;
  blockers?: unknown;
  pendingHumanInputs?: unknown;
  delivery?: unknown;
  autoOpen?: unknown;
}

const COMPLETED_SESSION_LOG_FILES = ["completed_with_handoff_sessions.jsonl", "completed_sessions.jsonl"];

function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function deriveServedPreviewUrl(execution: Record<string, unknown> | null): string | null {
  if (!execution) {
    return null;
  }

  const mode = normalizeOptionalString(execution.mode);
  if (mode !== "serve_and_open") {
    return null;
  }

  const preferredPort = Number(execution.preferredPort);
  if (!Number.isInteger(preferredPort) || preferredPort <= 0) {
    return null;
  }

  const target = normalizeOptionalString(execution.target);
  const staticRoot = normalizeOptionalString(execution.staticRoot);
  if (!target || !staticRoot) {
    return `http://localhost:${String(preferredPort)}/`;
  }

  const relativeTarget = path.relative(staticRoot, target);
  const normalizedRelativeTarget = relativeTarget.replace(/\\/g, "/");
  if (!normalizedRelativeTarget || normalizedRelativeTarget.startsWith("..")) {
    return `http://localhost:${String(preferredPort)}/`;
  }

  const browserPath = normalizedRelativeTarget.startsWith("/")
    ? normalizedRelativeTarget
    : `/${normalizedRelativeTarget}`;
  return `http://localhost:${String(preferredPort)}${browserPath}`;
}

function normalizeCompletedSessionPresentation(
  rawRecord: RawCompletedSessionRecord,
  fallback: { repoUrl: string | null; completionSummary: string | null },
): AtlasCompletedSessionPresentation | null {
  const rawPresentation = normalizeRecord(rawRecord.presentation) || normalizeRecord(rawRecord.delivery);
  const rawAutoOpen = normalizeRecord(rawRecord.presentationAutoOpen) || normalizeRecord(rawRecord.autoOpen);
  const rawExecution = normalizeRecord(rawPresentation?.execution);
  const rawAutoExecution = normalizeRecord(rawAutoOpen?.execution);
  const servedPreviewUrl = deriveServedPreviewUrl(rawAutoExecution) || deriveServedPreviewUrl(rawExecution);

  if (!rawPresentation && !fallback.repoUrl) {
    return null;
  }

  if (!rawPresentation) {
    return {
      status: "documented",
      locationType: "repository",
      primaryLocation: fallback.repoUrl,
      openTarget: fallback.repoUrl,
      userMessage: fallback.completionSummary || "Completed target is available from the archived repository record.",
      thinkingSummary: null,
      resolutionSource: "completion_archive_fallback",
      executionMode: fallback.repoUrl ? "open_url" : "document_only",
      finalTarget: fallback.repoUrl,
      autoOpenStatus: null,
      autoOpenReason: null,
    };
  }

  const finalTarget = normalizeOptionalString(rawAutoExecution?.finalTarget)
    || servedPreviewUrl
    || normalizeOptionalString(rawExecution?.target)
    || normalizeOptionalString(rawPresentation.openTarget)
    || normalizeOptionalString(rawPresentation.primaryLocation);
  const autoOpenStatus = rawAutoOpen
    ? rawAutoOpen.opened === true
      ? "opened"
      : rawAutoOpen.attempted === true
        ? "attempted"
        : "skipped"
    : null;

  return {
    status: normalizeOptionalString(rawPresentation.status),
    locationType: normalizeOptionalString(rawPresentation.locationType),
    primaryLocation: normalizeOptionalString(rawPresentation.primaryLocation),
    openTarget: servedPreviewUrl || normalizeOptionalString(rawPresentation.openTarget),
    userMessage: normalizeOptionalString(rawPresentation.userMessage)
      || normalizeOptionalString(rawPresentation.summary)
      || fallback.completionSummary,
    thinkingSummary: normalizeOptionalString(rawPresentation.thinkingSummary),
    resolutionSource: normalizeOptionalString(rawPresentation.resolutionSource),
    executionMode: normalizeOptionalString(rawExecution?.mode),
    finalTarget,
    autoOpenStatus,
    autoOpenReason: normalizeOptionalString(rawAutoOpen?.reason),
  };
}

function getRepoName(repoUrl: string | null): string | null {
  if (!repoUrl) return null;
  const trimmedUrl = repoUrl.replace(/\/$/, "");
  const lastSlashIndex = trimmedUrl.lastIndexOf("/");
  const repoName = lastSlashIndex >= 0 ? trimmedUrl.slice(lastSlashIndex + 1) : trimmedUrl;
  const normalizedRepoName = repoName.replace(/\.git$/i, "").trim();
  return normalizedRepoName || null;
}

function buildCompletedSessionTitle(record: {
  projectId: string;
  sessionId: string;
  repoUrl: string | null;
  objective: string | null;
}): string {
  const sessionSuffix = record.sessionId.slice(-6);
  const repoName = getRepoName(record.repoUrl);
  if (repoName) return `${repoName} / ${sessionSuffix}`;

  const objective = String(record.objective || "").trim().replace(/\s+/g, " ");
  if (objective) {
    return objective.length > 84 ? `${objective.slice(0, 81).trimEnd()}...` : objective;
  }

  if (record.projectId) {
    return `${record.projectId} / ${sessionSuffix}`;
  }

  return record.sessionId || "Completed session";
}

function parseTimestamp(value: string | null): number {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

async function pathExists(targetPath: string | null): Promise<boolean> {
  if (!targetPath) {
    return false;
  }
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function shouldReplaceCompletedRecord(
  existing: AtlasCompletedSessionRecord | undefined,
  candidate: AtlasCompletedSessionRecord,
): boolean {
  if (!existing) return true;

  const existingTimestamp = parseTimestamp(existing.archivedAt);
  const candidateTimestamp = parseTimestamp(candidate.archivedAt);
  if (Number.isFinite(candidateTimestamp) && !Number.isFinite(existingTimestamp)) return true;
  if (Number.isFinite(candidateTimestamp) && Number.isFinite(existingTimestamp) && candidateTimestamp > existingTimestamp) return true;
  return false;
}

function normalizeCompletedSessionRecord(rawRecord: RawCompletedSessionRecord): AtlasCompletedSessionRecord | null {
  const projectId = normalizeOptionalString(rawRecord.projectId);
  const sessionId = normalizeOptionalString(rawRecord.sessionId);
  if (!projectId || !sessionId) {
    return null;
  }

  const repoUrl = normalizeOptionalString(rawRecord.repoUrl);
  const objective = normalizeOptionalString(rawRecord.objective);
  const completionSummary = normalizeOptionalString(rawRecord.completionSummary);
  return {
    key: `${projectId}:${sessionId}`,
    projectId,
    sessionId,
    title: buildCompletedSessionTitle({ projectId, sessionId, repoUrl, objective }),
    finalStatus: normalizeOptionalString(rawRecord.finalStatus) || "completed",
    repoUrl,
    objective,
    workspacePath: normalizeOptionalString(rawRecord.workspacePath),
    archivedAt: normalizeOptionalString(rawRecord.archivedAt),
    completionReason: normalizeOptionalString(rawRecord.completionReason),
    completionSummary,
    unresolvedItems: normalizeStringArray(rawRecord.unresolvedItems),
    workspaceSnapshotAvailable: false,
    presentation: normalizeCompletedSessionPresentation(rawRecord, { repoUrl, completionSummary }),
  };
}

function normalizeTargetCompletionRecord(rawRecord: RawTargetCompletionRecord): AtlasCompletedSessionRecord | null {
  const completionStatus = normalizeOptionalString(rawRecord.status)?.toLowerCase();
  if (completionStatus && !["completed", "fulfilled", "success", "closed"].includes(completionStatus)) {
    return null;
  }

  const projectId = normalizeOptionalString(rawRecord.projectId);
  const sessionId = normalizeOptionalString(rawRecord.sessionId);
  const delivery = normalizeRecord(rawRecord.delivery);
  if (!projectId || !sessionId || !delivery) {
    return null;
  }

  const repoUrl = normalizeOptionalString(delivery.repoWebUrl);
  const objective = normalizeOptionalString(rawRecord.objectiveSummary);
  const completionSummary = normalizeOptionalString(delivery.userMessage)
    || normalizeOptionalString(rawRecord.summary)
    || objective;

  return {
    key: `${projectId}:${sessionId}`,
    projectId,
    sessionId,
    title: buildCompletedSessionTitle({ projectId, sessionId, repoUrl, objective }),
    finalStatus: "completed",
    repoUrl,
    objective,
    workspacePath: normalizeOptionalString(delivery.workspacePath),
    archivedAt: normalizeOptionalString(rawRecord.evaluatedAt),
    completionReason: "target_completion_projection",
    completionSummary,
    unresolvedItems: [
      ...normalizeStringArray(rawRecord.blockers),
      ...normalizeStringArray(rawRecord.pendingHumanInputs),
    ],
    workspaceSnapshotAvailable: false,
    presentation: normalizeCompletedSessionPresentation({
      repoUrl,
      completionSummary,
      presentation: delivery,
      presentationAutoOpen: rawRecord.autoOpen,
    }, { repoUrl, completionSummary }),
  };
}

async function readCompletedSessionLog(logPath: string): Promise<AtlasCompletedSessionRecord[]> {
  try {
    const raw = await fs.readFile(logPath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return normalizeCompletedSessionRecord(JSON.parse(line) as RawCompletedSessionRecord);
        } catch (error) {
          console.error(`[atlas] failed to parse completed session record: ${String((error as Error)?.message || error)}`);
          return null;
        }
      })
      .filter((record): record is AtlasCompletedSessionRecord => Boolean(record));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[atlas] failed to read completed session log: ${logPath} (${String((error as Error)?.message || error)})`);
    }
    return [];
  }
}

async function collectTargetCompletionPaths(projectsRoot: string): Promise<string[]> {
  try {
    const projectEntries = await fs.readdir(projectsRoot, { withFileTypes: true });
    const collected: string[] = [];
    for (const projectEntry of projectEntries) {
      if (!projectEntry.isDirectory()) continue;
      const projectPath = path.join(projectsRoot, projectEntry.name);
      const sessionEntries = await fs.readdir(projectPath, { withFileTypes: true }).catch(() => []);
      for (const sessionEntry of sessionEntries) {
        if (!sessionEntry.isDirectory()) continue;
        collected.push(path.join(projectPath, sessionEntry.name, "target_completion.json"));
      }
    }
    return collected;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[atlas] failed to enumerate target completion records: ${String((error as Error)?.message || error)}`);
    }
    return [];
  }
}

async function readProjectedCompletedSessions(runtimeStateDir: string): Promise<AtlasCompletedSessionRecord[]> {
  const projectsRoot = path.join(runtimeStateDir, "projects");
  const completionPaths = await collectTargetCompletionPaths(projectsRoot);
  const records = await Promise.all(completionPaths.map(async (completionPath) => {
    try {
      const rawRecord = await fs.readFile(completionPath, "utf8");
      return normalizeTargetCompletionRecord(JSON.parse(rawRecord) as RawTargetCompletionRecord);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`[atlas] failed to read target completion projection: ${completionPath} (${String((error as Error)?.message || error)})`);
      }
      return null;
    }
  }));
  return records.filter((record): record is AtlasCompletedSessionRecord => Boolean(record));
}

export async function listAtlasCompletedSessions(stateDir: string): Promise<AtlasCompletedSessionRecord[]> {
  const runtimeStateDir = await resolveAtlasRuntimeStateDir(stateDir);
  const archiveDir = path.join(runtimeStateDir, "archive");
  const dedupedRecords = new Map<string, AtlasCompletedSessionRecord>();

  for (const fileName of COMPLETED_SESSION_LOG_FILES) {
    const records = await readCompletedSessionLog(path.join(archiveDir, fileName));
    for (const record of records) {
      if (shouldReplaceCompletedRecord(dedupedRecords.get(record.key), record)) {
        dedupedRecords.set(record.key, record);
      }
    }
  }

  for (const record of await readProjectedCompletedSessions(runtimeStateDir)) {
    if (!dedupedRecords.has(record.key)) {
      dedupedRecords.set(record.key, record);
    }
  }

  const sortedRecords = [...dedupedRecords.values()].sort((left, right) => {
    const rightTimestamp = parseTimestamp(right.archivedAt);
    const leftTimestamp = parseTimestamp(left.archivedAt);
    if (Number.isFinite(rightTimestamp) && Number.isFinite(leftTimestamp) && rightTimestamp !== leftTimestamp) {
      return rightTimestamp - leftTimestamp;
    }
    if (Number.isFinite(rightTimestamp) && !Number.isFinite(leftTimestamp)) return -1;
    if (Number.isFinite(leftTimestamp) && !Number.isFinite(rightTimestamp)) return 1;
    return left.title.localeCompare(right.title);
  });

  return Promise.all(sortedRecords.map(async (record) => ({
    ...record,
    workspaceSnapshotAvailable: await pathExists(record.workspacePath),
  })));
}

export async function readAtlasCompletedSession(
  stateDir: string,
  projectId: string,
  sessionId: string,
): Promise<AtlasCompletedSessionRecord | null> {
  const normalizedProjectId = String(projectId || "").trim();
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedProjectId || !normalizedSessionId) {
    return null;
  }

  const completedSessions = await listAtlasCompletedSessions(stateDir);
  return completedSessions.find((record) => record.projectId === normalizedProjectId && record.sessionId === normalizedSessionId) || null;
}