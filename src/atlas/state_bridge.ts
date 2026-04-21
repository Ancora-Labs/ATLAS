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

function normalizeHistoryEntry(entry: unknown): BoxTargetSessionHistoryEntry | null {
  if (!entry || typeof entry !== "object") return null;
  return entry as BoxTargetSessionHistoryEntry;
}

function getSessionHistory(session: BoxTargetSessionRecord): BoxTargetSessionHistoryEntry[] {
  const history = Array.isArray(session.history)
    ? session.history
    : (Array.isArray(session.activityLog) ? session.activityLog : []);
  return history.map(normalizeHistoryEntry).filter((entry): entry is BoxTargetSessionHistoryEntry => entry !== null);
}

function isAtlasSessionStatus(value: string): value is AtlasSessionStatus {
  return ["idle", "working", "blocked", "error", "done", "offline", "partial"].includes(value);
}

function normalizeRawStatus(status: unknown): AtlasSessionStatus {
  const normalized = String(status || "idle").trim().toLowerCase();
  return isAtlasSessionStatus(normalized) ? normalized : "idle";
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

function isResumable(status: AtlasSessionStatus, lastTask: string): boolean {
  if (status === "done" || status === "offline") return false;
  if (status === "working" || status === "blocked" || status === "error" || status === "partial") return true;
  return lastTask.trim().length > 0;
}

export function bridgeBoxTargetSessionState(
  workerSessions: Record<string, unknown>,
  thinkingMap: Record<string, string> = {},
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
    const { readiness, readinessLabel } = getAtlasSessionReadiness(status, lastTask);

    cleaned[roleKey] = {
      role,
      name: role,
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
    };
  }

  return cleaned;
}
