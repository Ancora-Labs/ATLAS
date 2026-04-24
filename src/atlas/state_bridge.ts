import fs from "node:fs/promises";
import path from "node:path";

import { getPausedLanes } from "../core/medic_agent.js";
import { getLaneForWorkerName, normalizeWorkerName } from "../core/role_registry.js";
import { READ_JSON_REASON, readJsonSafe } from "../core/fs_utils.js";
import { listOpenTargetSessions } from "../core/target_session_state.js";

export interface BoxTargetSessionHistoryEntry {
  at?: string;
  from?: string;
  role?: string;
  status?: string;
  task?: string;
}

export interface BoxTargetSessionRecord {
  role?: string;
  status?: string;
  lastTask?: string;
  lastActiveAt?: string | null;
  history?: BoxTargetSessionHistoryEntry[];
  activityLog?: BoxTargetSessionHistoryEntry[];
  _activityLog?: BoxTargetSessionHistoryEntry[];
  currentBranch?: string | null;
  createdPRs?: string[];
  filesTouched?: string[];
  [key: string]: unknown;
}

export type AtlasSessionStatus =
  | "idle"
  | "working"
  | "blocked"
  | "error"
  | "done"
  | "offline"
  | "partial";

export type AtlasSessionReadiness =
  | "ready"
  | "in_progress"
  | "action_needed"
  | "completed"
  | "unavailable";

export interface AtlasSessionDto {
  role: string;
  name: string;
  lane: string | null;
  status: AtlasSessionStatus;
  statusLabel: string;
  readiness: AtlasSessionReadiness;
  readinessLabel: string;
  lastTask: string;
  lastActiveAt: string | null;
  historyLength: number;
  lastThinking: string;
  currentBranch: string | null;
  pullRequestCount: number;
  touchedFileCount: number;
  needsInput: boolean;
  isResumable: boolean;
  isPaused: boolean;
  canArchive: boolean;
}

export interface AtlasArchivedSessionDto extends AtlasSessionDto {
  archivePath: string;
  archiveRoleKey: string;
}

export interface AtlasSessionReadModel {
  openSessions: Record<string, AtlasSessionDto>;
  archivedSessions: AtlasArchivedSessionDto[];
}

export interface AtlasSessionSnapshotContinuity {
  hasLiveSessions: boolean;
  missingFocusedSnapshot: boolean;
}

const SESSION_STATUS_PRIORITY: Record<AtlasSessionStatus, number> = {
  blocked: 0,
  error: 1,
  working: 2,
  partial: 3,
  idle: 4,
  offline: 5,
  done: 6,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function getAtlasSessionDisplayName(role: string): string {
  const normalizedRole = normalizeWorkerName(role);
  if (normalizedRole === "atlas") return "ATLAS control";
  if (normalizedRole.endsWith("-worker")) {
    const lane = getLaneForWorkerName(normalizedRole, normalizedRole.replace(/-worker$/, ""));
    return `${toTitleCase(lane)} lane`;
  }
  return toTitleCase(role);
}

const STATUS_LABELS: Record<AtlasSessionStatus, string> = {
  idle: "Ready",
  working: "In progress",
  blocked: "Needs attention",
  error: "Needs attention",
  done: "Completed",
  offline: "Stopped",
  partial: "Ready",
};

const TERMINAL_HISTORY_STATUSES = new Set<AtlasSessionStatus>(["blocked", "done", "error", "partial"]);
const SYSTEM_HISTORY_ACTORS = new Set(["athena", "orchestrator"]);
const INTERNAL_SESSION_STAGE_TO_STATUS: Record<string, AtlasSessionStatus> = {
  blocked: "blocked",
  complete: "done",
  completed: "done",
  done: "done",
  error: "error",
  failed: "error",
  idle: "idle",
  in_progress: "working",
  needs_input: "blocked",
  offline: "offline",
  partial: "partial",
  pending: "idle",
  queued: "idle",
  ready: "idle",
  recovered: "partial",
  running: "working",
  skipped: "done",
  success: "done",
  working: "working",
};

function normalizeHistoryEntry(entry: unknown): BoxTargetSessionHistoryEntry | null {
  if (!entry || typeof entry !== "object") return null;
  return entry as BoxTargetSessionHistoryEntry;
}

function getSessionHistory(session: BoxTargetSessionRecord): BoxTargetSessionHistoryEntry[] {
  const history = Array.isArray(session.history)
    ? session.history
    : (Array.isArray(session.activityLog)
        ? session.activityLog
        : (Array.isArray(session._activityLog) ? session._activityLog : []));
  return history.map(normalizeHistoryEntry).filter((entry): entry is BoxTargetSessionHistoryEntry => entry !== null);
}

function isAtlasSessionStatus(value: string): value is AtlasSessionStatus {
  return ["idle", "working", "blocked", "error", "done", "offline", "partial"].includes(value);
}

function normalizeRawStatus(status: unknown): AtlasSessionStatus {
  const normalized = String(status || "idle").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isAtlasSessionStatus(normalized)) return normalized;
  return INTERNAL_SESSION_STAGE_TO_STATUS[normalized] || "idle";
}

function resolveSessionLane(role: string): string | null {
  const normalizedRole = normalizeWorkerName(role);
  if (!normalizedRole || normalizedRole === "atlas") return null;
  const fallbackLane = normalizedRole.endsWith("-worker")
    ? normalizedRole.replace(/-worker$/, "")
    : "";
  const lane = String(getLaneForWorkerName(normalizedRole, fallbackLane) || "").trim();
  return lane || null;
}

function resolveSessionRoleKey(rawSession: unknown, fallbackKey: string): string {
  if (isRecord(rawSession)) {
    const role = String(rawSession.role || "").trim();
    if (role) return role;
  }
  return fallbackKey;
}

function extractSessionRecordMap(raw: unknown, fallbackPrefix: string): Record<string, unknown> {
  if (Array.isArray(raw)) {
    const extracted: Record<string, unknown> = {};
    raw.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      const roleKey = resolveSessionRoleKey(entry, `${fallbackPrefix}-${index + 1}`);
      extracted[roleKey] = entry;
    });
    return extracted;
  }

  if (!isRecord(raw)) return {};

  const candidate = isRecord(raw.sessions) ? raw.sessions : raw;
  if (!isRecord(candidate)) return {};

  const looksLikeSingleSession = ["role", "status", "lastTask", "lastActiveAt"].some((key) => key in candidate);
  if (looksLikeSingleSession) {
    const roleKey = resolveSessionRoleKey(candidate, fallbackPrefix);
    return { [roleKey]: candidate };
  }

  const extracted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (!isRecord(value)) continue;
    extracted[resolveSessionRoleKey(value, key)] = value;
  }
  return extracted;
}

async function readLegacyOpenSessionRecords(stateDir: string): Promise<Record<string, unknown>> {
  const openSessionsPath = path.join(stateDir, "open_target_sessions.json");
  const openSessionsResult = await readJsonSafe(openSessionsPath);
  if (!openSessionsResult.ok) {
    if (openSessionsResult.reason === READ_JSON_REASON.INVALID) {
      console.error(`[atlas] failed to read open session state: ${String(openSessionsResult.error?.message || openSessionsResult.error)}`);
    }
    return {};
  }
  return extractSessionRecordMap(openSessionsResult.data, "atlas-session");
}

async function readCanonicalOpenSessionRecords(stateDir: string): Promise<Record<string, unknown>> {
  try {
    return await listOpenTargetSessions({ stateDir });
  } catch (error) {
    console.error(`[atlas] failed to read canonical open sessions: ${String((error as Error)?.message || error)}`);
    return {};
  }
}

async function collectArchiveJsonFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nestedPaths = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return collectArchiveJsonFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    }));
    return nestedPaths.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[atlas] failed to enumerate archived sessions: ${String((error as Error)?.message || error)}`);
    }
    return [];
  }
}

async function readArchivedSessionRecords(stateDir: string): Promise<AtlasArchivedSessionDto[]> {
  const archiveDir = path.join(stateDir, "archive");
  const archiveFiles = await collectArchiveJsonFiles(archiveDir);
  const archivedSessions: AtlasArchivedSessionDto[] = [];

  for (const archivePath of archiveFiles.sort()) {
    const archiveResult = await readJsonSafe(archivePath);
    if (!archiveResult.ok) {
      console.error(`[atlas] failed to read archived session snapshot: ${archivePath} (${String(archiveResult.error?.message || archiveResult.error)})`);
      continue;
    }

    const bridgedSessions = bridgeBoxTargetSessionState(
      extractSessionRecordMap(archiveResult.data, path.basename(archivePath, path.extname(archivePath))),
    );

    for (const [archiveRoleKey, session] of Object.entries(bridgedSessions)) {
      archivedSessions.push({
        ...session,
        archivePath,
        archiveRoleKey,
      });
    }
  }

  return archivedSessions;
}

function resolveEffectiveStatus(
  rawStatus: AtlasSessionStatus,
  history: BoxTargetSessionHistoryEntry[],
): AtlasSessionStatus {
  if (rawStatus !== "working") return rawStatus;

  const lastRelevantEntry = [...history].reverse().find((entry) => {
    const actor = String(entry.from || entry.role || "").trim().toLowerCase();
    return !SYSTEM_HISTORY_ACTORS.has(actor);
  });

  const historyStatus = normalizeRawStatus(lastRelevantEntry?.status);
  return TERMINAL_HISTORY_STATUSES.has(historyStatus) ? historyStatus : rawStatus;
}

export function getAtlasSessionStatusLabel(status: AtlasSessionStatus): string {
  return STATUS_LABELS[status];
}

function compareNullableTimestampsDescending(left: string | null, right: string | null): number {
  const leftValue = left ? Date.parse(left) : Number.NaN;
  const rightValue = right ? Date.parse(right) : Number.NaN;

  if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
    return rightValue - leftValue;
  }
  if (Number.isFinite(leftValue)) return -1;
  if (Number.isFinite(rightValue)) return 1;
  return 0;
}

export function compareAtlasSessionsForDesktop(left: AtlasSessionDto, right: AtlasSessionDto): number {
  const leftIsAtlas = normalizeWorkerName(left.role) === "atlas" ? 0 : 1;
  const rightIsAtlas = normalizeWorkerName(right.role) === "atlas" ? 0 : 1;
  if (leftIsAtlas !== rightIsAtlas) {
    return leftIsAtlas - rightIsAtlas;
  }

  if (left.needsInput !== right.needsInput) {
    return left.needsInput ? -1 : 1;
  }

  const leftPriority = SESSION_STATUS_PRIORITY[left.status];
  const rightPriority = SESSION_STATUS_PRIORITY[right.status];
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  if (left.isResumable !== right.isResumable) {
    return left.isResumable ? -1 : 1;
  }

  const timestampOrder = compareNullableTimestampsDescending(left.lastActiveAt, right.lastActiveAt);
  if (timestampOrder !== 0) {
    return timestampOrder;
  }

  const nameOrder = left.name.localeCompare(right.name);
  if (nameOrder !== 0) {
    return nameOrder;
  }

  return left.role.localeCompare(right.role);
}

export function getAtlasSessionReadiness(
  status: AtlasSessionStatus,
  lastTask: string,
): { readiness: AtlasSessionReadiness; readinessLabel: string } {
  switch (status) {
    case "working":
      return { readiness: "in_progress", readinessLabel: "In progress" };
    case "blocked":
    case "error":
      return { readiness: "action_needed", readinessLabel: "Needs your input" };
    case "done":
      return { readiness: "completed", readinessLabel: "Completed" };
    case "offline":
      return { readiness: "unavailable", readinessLabel: "Unavailable" };
    case "partial":
      return { readiness: "ready", readinessLabel: "Ready to continue" };
    case "idle":
    default:
      return {
        readiness: "ready",
        readinessLabel: lastTask.trim() ? "Ready to continue" : "Ready to start",
      };
  }
}

export function resolveAtlasSessionSnapshotContinuity(
  sessions: AtlasSessionDto[],
  focusedSessionRole: string | null,
  missingFocusedSnapshotHint = false,
): AtlasSessionSnapshotContinuity {
  if (missingFocusedSnapshotHint) {
    return {
      hasLiveSessions: sessions.length > 0,
      missingFocusedSnapshot: true,
    };
  }

  const normalizedFocus = String(focusedSessionRole || "").trim();
  if (!normalizedFocus) {
    return {
      hasLiveSessions: sessions.length > 0,
      missingFocusedSnapshot: false,
    };
  }

  return {
    hasLiveSessions: sessions.length > 0,
    missingFocusedSnapshot: !sessions.some((session) => session.role === normalizedFocus),
  };
}

function isResumable(status: AtlasSessionStatus, lastTask: string): boolean {
  if (status === "done" || status === "offline") return false;
  if (status === "working" || status === "blocked" || status === "error" || status === "partial") return true;
  return lastTask.trim().length > 0;
}

export function bridgeBoxTargetSessionState(
  workerSessions: Record<string, unknown>,
  thinkingMap: Record<string, string> = {},
  pausedLanes: Record<string, unknown> = {},
): Record<string, AtlasSessionDto> {
  const cleaned: Record<string, AtlasSessionDto> = {};

  for (const [roleKey, rawSession] of Object.entries(workerSessions || {})) {
    if (roleKey === "schemaVersion") continue;
    if (!rawSession || typeof rawSession !== "object" || Array.isArray(rawSession)) continue;

    const session = rawSession as BoxTargetSessionRecord;
    const history = getSessionHistory(session);
    const rawStatus = normalizeRawStatus(session.status);
    const status = resolveEffectiveStatus(rawStatus, history);
    const lastTask = String(session.lastTask || "").trim();
    const role = String(session.role || roleKey).trim() || roleKey;
    const lane = resolveSessionLane(role);
    const { readiness, readinessLabel } = getAtlasSessionReadiness(status, lastTask);

    cleaned[roleKey] = {
      role,
      name: getAtlasSessionDisplayName(role),
      lane,
      status,
      statusLabel: getAtlasSessionStatusLabel(status),
      readiness,
      readinessLabel,
      lastTask,
      lastActiveAt: typeof session.lastActiveAt === "string" ? session.lastActiveAt : null,
      historyLength: history.length,
      lastThinking: String(thinkingMap[roleKey] || ""),
      currentBranch: typeof session.currentBranch === "string" ? session.currentBranch : null,
      pullRequestCount: Array.isArray(session.createdPRs) ? session.createdPRs.filter(Boolean).length : 0,
      touchedFileCount: Array.isArray(session.filesTouched) ? session.filesTouched.filter(Boolean).length : 0,
      needsInput: readiness === "action_needed",
      isResumable: isResumable(status, lastTask),
      isPaused: Boolean(lane && pausedLanes[lane]),
      canArchive: normalizeWorkerName(role) !== "atlas" && status !== "working",
    };
  }

  return cleaned;
}

export interface AtlasSessionStateBridgeOptions {
  stateDir: string;
  thinkingMap?: Record<string, string>;
}

export async function readAtlasSessionReadModel(
  options: AtlasSessionStateBridgeOptions,
): Promise<AtlasSessionReadModel> {
  let pausedLanes: Record<string, unknown> = {};
  try {
    pausedLanes = await getPausedLanes(options.stateDir);
  } catch (error) {
    console.error(`[atlas] failed to read paused lanes: ${String((error as Error)?.message || error)}`);
  }

  const canonicalOpenSessions = await readCanonicalOpenSessionRecords(options.stateDir);
  const fallbackOpenSessions = Object.keys(canonicalOpenSessions).length > 0
    ? {}
    : await readLegacyOpenSessionRecords(options.stateDir);

  return {
    openSessions: bridgeBoxTargetSessionState(
      Object.keys(canonicalOpenSessions).length > 0 ? canonicalOpenSessions : fallbackOpenSessions,
      options.thinkingMap,
      pausedLanes,
    ),
    archivedSessions: await readArchivedSessionRecords(options.stateDir),
  };
}

export async function listAtlasSessions(
  options: AtlasSessionStateBridgeOptions,
): Promise<Record<string, AtlasSessionDto>> {
  const sessionReadModel = await readAtlasSessionReadModel(options);
  return sessionReadModel.openSessions;
}
