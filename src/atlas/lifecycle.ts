import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../config.js";
import { readDaemonPid, clearDaemonPid, clearStopRequest, isDaemonProcess, requestDaemonStop } from "../core/daemon_control.js";
import { writeJson, readJsonSafe, READ_JSON_REASON } from "../core/fs_utils.js";
import { pauseLane, resumeLane } from "../core/medic_agent.js";
import { runResumeDispatch } from "../core/orchestrator.js";
import { readPipelineProgress } from "../core/pipeline_progress.js";
import { getLaneForWorkerName, normalizeWorkerName } from "../core/role_registry.js";
import { readOpenTargetSessionState } from "../core/target_session_state.js";
import { WORKER_CYCLE_ARTIFACTS_FILE, migrateWorkerCycleArtifacts, selectWorkerCycleRecord } from "../core/cycle_analytics.js";

export type AtlasLifecycleAction = "pause" | "resume" | "stop" | "archive";

export interface AtlasLifecycleRequest {
  action: AtlasLifecycleAction;
  role?: string | null;
  returnTo?: string | null;
}

export interface AtlasLifecycleResult {
  ok: true;
  action: AtlasLifecycleAction;
  scope: "runtime" | "session";
  role: string | null;
  lane: string | null;
  message: string;
  redirectTo: string;
}

interface SessionMatch {
  key: string;
  role: string;
  session: Record<string, unknown>;
}

interface SessionContainerUpdate {
  nextValue: unknown;
  changed: boolean;
}

export class AtlasLifecycleError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "atlas_lifecycle_error") {
    super(message);
    this.name = "AtlasLifecycleError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeReturnTo(value: string | null | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/sessions";
  return trimmed;
}

function resolveLifecycleLane(role: string): string | null {
  const normalizedRole = normalizeWorkerName(role);
  if (!normalizedRole || normalizedRole === "atlas") return null;
  const fallbackLane = normalizedRole.endsWith("-worker")
    ? normalizedRole.replace(/-worker$/, "")
    : "";
  const lane = String(getLaneForWorkerName(normalizedRole, fallbackLane) || "").trim();
  return lane || null;
}

function normalizeSessionStatus(status: unknown): string {
  return String(status || "idle").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function sanitizeFileToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "session";
}

function findMatchingSession(sessions: Record<string, unknown>, requestedRole: string): SessionMatch | null {
  const requested = normalizeWorkerName(requestedRole);
  for (const [key, rawSession] of Object.entries(sessions)) {
    if (!isRecord(rawSession)) continue;
    const role = String(rawSession.role || key).trim() || key;
    if (normalizeWorkerName(role) !== requested) continue;
    return {
      key,
      role,
      session: rawSession,
    };
  }
  return null;
}

function deleteRoleFromSessionContainer(raw: unknown, requestedRole: string): SessionContainerUpdate {
  if (!isRecord(raw)) return { nextValue: raw, changed: false };

  const container = isRecord(raw.workerSessions)
    ? raw.workerSessions
    : (isRecord(raw.data)
        ? raw.data
        : (isRecord(raw.sessions) ? raw.sessions : raw));

  let changed = false;
  for (const [key, value] of Object.entries(container)) {
    if (!isRecord(value) && typeof value !== "object") continue;
    const role = isRecord(value)
      ? String(value.role || key).trim() || key
      : key;
    if (normalizeWorkerName(role) !== normalizeWorkerName(requestedRole)) continue;
    delete container[key];
    changed = true;
  }

  return {
    nextValue: raw,
    changed,
  };
}

async function removeSessionFromFile(filePath: string, role: string): Promise<boolean> {
  const result = await readJsonSafe(filePath);
  if (!result.ok) {
    if (result.reason === READ_JSON_REASON.MISSING) return false;
    throw new AtlasLifecycleError(`Failed to read session state: ${filePath}`, 500, "session_state_read_failed");
  }

  const updated = deleteRoleFromSessionContainer(result.data, role);
  if (!updated.changed) return false;
  await writeJson(filePath, updated.nextValue);
  return true;
}

async function removeSessionFromCanonicalArtifacts(stateDir: string, role: string): Promise<boolean> {
  const artifactsPath = path.join(stateDir, WORKER_CYCLE_ARTIFACTS_FILE);
  const artifactsResult = await readJsonSafe(artifactsPath);
  if (!artifactsResult.ok) {
    if (artifactsResult.reason === READ_JSON_REASON.MISSING) return false;
    throw new AtlasLifecycleError("Failed to read canonical worker sessions.", 500, "canonical_sessions_read_failed");
  }

  const migrated = migrateWorkerCycleArtifacts(artifactsResult.data);
  if (!migrated.ok || !migrated.data) {
    throw new AtlasLifecycleError("Failed to migrate canonical worker sessions.", 500, "canonical_sessions_migrate_failed");
  }

  let preferredCycleId: string | undefined;
  try {
    const progress = await readPipelineProgress({ paths: { stateDir } });
    preferredCycleId = typeof progress?.startedAt === "string" ? progress.startedAt : undefined;
  } catch (error) {
    console.error(`[atlas] failed to read pipeline progress during archive: ${String((error as Error)?.message || error)}`);
  }

  const selected = selectWorkerCycleRecord(migrated.data, preferredCycleId);
  if (!selected.cycleId || !selected.record || !isRecord(selected.record.workerSessions)) {
    return false;
  }

  const workerSessions = selected.record.workerSessions;
  let matchedKey: string | null = null;
  for (const [key, rawSession] of Object.entries(workerSessions)) {
    const sessionRole = isRecord(rawSession)
      ? String(rawSession.role || key).trim() || key
      : key;
    if (normalizeWorkerName(sessionRole) === normalizeWorkerName(role)) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) return false;

  delete workerSessions[matchedKey];
  if (isRecord(selected.record.workerActivity)) {
    delete selected.record.workerActivity[matchedKey];
  }
  selected.record.updatedAt = new Date().toISOString();
  migrated.data.updatedAt = selected.record.updatedAt;
  migrated.data.latestCycleId = selected.cycleId;
  await writeJson(artifactsPath, migrated.data);
  return true;
}

async function writeArchiveSnapshot(stateDir: string, match: SessionMatch): Promise<string> {
  const archivedAt = new Date().toISOString();
  const archiveDir = path.join(stateDir, "archive", archivedAt.slice(0, 10));
  const fileName = `${sanitizeFileToken(match.role)}-${archivedAt.replace(/[:.]/g, "-")}.json`;
  const archivePath = path.join(archiveDir, fileName);
  await writeJson(archivePath, {
    ...match.session,
    role: match.role,
    archivedAt,
    archivedBy: "atlas",
  });
  return archivePath;
}

async function archiveSession(stateDir: string, role: string): Promise<{ lane: string | null; archivePath: string }> {
  const openState = await readOpenTargetSessionState({ stateDir });
  const match = findMatchingSession(openState.sessions, role);
  if (!match) {
    throw new AtlasLifecycleError(`No open session exists for "${role}".`, 404, "session_not_found");
  }

  if (normalizeWorkerName(match.role) === "atlas") {
    throw new AtlasLifecycleError("ATLAS control cannot be archived.", 409, "atlas_session_archive_forbidden");
  }

  const normalizedStatus = normalizeSessionStatus(match.session.status);
  if (normalizedStatus === "working" || normalizedStatus === "in_progress" || normalizedStatus === "running") {
    throw new AtlasLifecycleError(`"${match.role}" is still active and cannot be archived yet.`, 409, "session_archive_active");
  }

  const archivePath = await writeArchiveSnapshot(stateDir, match);
  const lane = resolveLifecycleLane(match.role);
  if (lane) {
    await resumeLane(stateDir, lane);
  }

  await removeSessionFromCanonicalArtifacts(stateDir, match.role);
  await removeSessionFromFile(path.join(stateDir, "worker_sessions.json"), match.role);
  await removeSessionFromFile(path.join(stateDir, "open_target_sessions.json"), match.role);

  return {
    lane,
    archivePath,
  };
}

async function stopRuntime(): Promise<{ message: string }> {
  const config = await loadConfig();
  const daemonPidState = await readDaemonPid(config);
  const daemonPid = Number(daemonPidState?.pid || 0);
  if (!daemonPid || !isDaemonProcess(daemonPid)) {
    await clearDaemonPid(config);
    await clearStopRequest(config);
    return { message: "BOX runtime was not running." };
  }

  await requestDaemonStop(config, "atlas-stop");
  return { message: `Stop requested for BOX runtime pid=${daemonPid}.` };
}

async function resumeRuntime(): Promise<{ message: string }> {
  const config = await loadConfig();
  await runResumeDispatch(config);
  return { message: "BOX runtime resume dispatched from ATLAS." };
}

export async function runAtlasLifecycleAction(
  stateDir: string,
  request: AtlasLifecycleRequest,
): Promise<AtlasLifecycleResult> {
  const action = String(request.action || "").trim().toLowerCase() as AtlasLifecycleAction;
  const role = String(request.role || "").trim() || null;
  const redirectTo = normalizeReturnTo(request.returnTo);

  if (!["pause", "resume", "stop", "archive"].includes(action)) {
    throw new AtlasLifecycleError(`Unsupported lifecycle action "${String(request.action || "")}".`, 400, "unsupported_action");
  }

  if (action === "stop") {
    const stopped = await stopRuntime();
    return {
      ok: true,
      action,
      scope: "runtime",
      role: null,
      lane: null,
      message: stopped.message,
      redirectTo,
    };
  }

  if (action === "resume" && !role) {
    const resumed = await resumeRuntime();
    return {
      ok: true,
      action,
      scope: "runtime",
      role: null,
      lane: null,
      message: resumed.message,
      redirectTo,
    };
  }

  if (!role) {
    throw new AtlasLifecycleError(`Lifecycle action "${action}" requires a role.`, 400, "missing_role");
  }

  const lane = resolveLifecycleLane(role);
  if (action === "pause" || (action === "resume" && role)) {
    if (!lane) {
      throw new AtlasLifecycleError(`"${role}" does not map to a controllable lane.`, 409, "lane_not_controllable");
    }
    if (action === "pause") {
      await pauseLane(stateDir, lane, `atlas:${normalizeWorkerName(role)}`);
      return {
        ok: true,
        action,
        scope: "session",
        role,
        lane,
        message: `Paused the ${lane} lane for "${role}".`,
        redirectTo,
      };
    }

    await resumeLane(stateDir, lane);
    return {
      ok: true,
      action,
      scope: "session",
      role,
      lane,
      message: `Resumed the ${lane} lane for "${role}".`,
      redirectTo,
    };
  }

  const archived = await archiveSession(stateDir, role);
  return {
    ok: true,
    action,
    scope: "session",
    role,
    lane: archived.lane,
    message: `Archived "${role}" to ${archived.archivePath}.`,
    redirectTo,
  };
}

async function main(): Promise<void> {
  const [actionArg, roleArg, returnToArg] = process.argv.slice(2);
  if (!actionArg) {
    throw new AtlasLifecycleError("Usage: atlas lifecycle <pause|resume|stop|archive> [role] [returnTo]", 400, "usage");
  }

  const config = await loadConfig();
  const result = await runAtlasLifecycleAction(String(config.paths?.stateDir || "state"), {
    action: actionArg as AtlasLifecycleAction,
    role: roleArg || null,
    returnTo: returnToArg || "/sessions",
  });
  console.log(result.message);
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryFile === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[atlas] lifecycle failed: ${String((error as Error)?.message || error)}`);
    process.exitCode = 1;
  });
}
