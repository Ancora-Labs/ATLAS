import path from "node:path";

import { WORKER_CYCLE_ARTIFACTS_FILE, extractSessionsFromCycleRecord, filterStaleWorkerSessions, migrateWorkerCycleArtifacts, selectWorkerCycleRecord } from "./cycle_analytics.js";
import { READ_JSON_REASON, readJsonSafe } from "./fs_utils.js";
import { readPipelineProgress } from "./pipeline_progress.js";

export interface OpenTargetSessionState {
  sessions: Record<string, unknown>;
  source: "canonical" | "legacy" | "empty";
  cycleId: string | null;
  canonicalSessionsAvailable: boolean;
  legacySessionsAvailable: boolean;
  workerSessionSourceConflict: boolean;
  conflictReason: string | null;
  staleSessionsFiltered: number;
  filteredStaleRoles: string[];
}

export interface TargetSessionStateOptions {
  stateDir: string;
}

async function readPreferredCycleId(stateDir: string): Promise<string | null> {
  try {
    const progress = await readPipelineProgress({ paths: { stateDir } });
    return progress?.startedAt ?? null;
  } catch (error) {
    console.error(`[target_session_state] failed to read pipeline progress: ${String((error as Error)?.message || error)}`);
    return null;
  }
}

export async function readOpenTargetSessionState(
  options: TargetSessionStateOptions,
): Promise<OpenTargetSessionState> {
  const artifactsPath = path.join(options.stateDir, WORKER_CYCLE_ARTIFACTS_FILE);
  const legacyPath = path.join(options.stateDir, "worker_sessions.json");
  const [artifactsRaw, legacyRaw] = await Promise.all([
    readJsonSafe(artifactsPath),
    readJsonSafe(legacyPath),
  ]);

  const legacySessions = legacyRaw.ok && legacyRaw.data && typeof legacyRaw.data === "object" && !Array.isArray(legacyRaw.data)
    ? legacyRaw.data as Record<string, unknown>
    : null;
  const legacyAvailable = legacySessions !== null && Object.keys(legacySessions).length > 0;

  if (artifactsRaw.ok && artifactsRaw.data && typeof artifactsRaw.data === "object") {
    const migrated = migrateWorkerCycleArtifacts(artifactsRaw.data);
    if (migrated.ok && migrated.data) {
      const preferredCycleId = await readPreferredCycleId(options.stateDir);
      const { cycleId, record } = selectWorkerCycleRecord(migrated.data, preferredCycleId ?? undefined);
      const canonicalSessions = extractSessionsFromCycleRecord(record);
      if (canonicalSessions && Object.keys(canonicalSessions).length > 0) {
        const canonicalActive = Object.values(canonicalSessions).filter(
          (session) => session && typeof session === "object" && (session as Record<string, unknown>).status === "working",
        ).length;
        const legacyActive = legacySessions
          ? Object.values(legacySessions).filter(
              (session) => session && typeof session === "object" && (session as Record<string, unknown>).status === "working",
            ).length
          : 0;
        const workerSessionSourceConflict = legacyAvailable && canonicalActive !== legacyActive;
        return {
          sessions: canonicalSessions,
          source: "canonical",
          cycleId,
          canonicalSessionsAvailable: true,
          legacySessionsAvailable: legacyAvailable,
          workerSessionSourceConflict,
          conflictReason: workerSessionSourceConflict
            ? `canonical_active=${canonicalActive} vs legacy_active=${legacyActive}`
            : null,
          staleSessionsFiltered: 0,
          filteredStaleRoles: [],
        };
      }
    }
  }

  if (artifactsRaw.reason === READ_JSON_REASON.MISSING && legacySessions && Object.keys(legacySessions).length > 0) {
    const preferredCycleId = await readPreferredCycleId(options.stateDir);
    const { sessions, staleRoles } = filterStaleWorkerSessions(legacySessions, preferredCycleId);
    return {
      sessions,
      source: "legacy",
      cycleId: null,
      canonicalSessionsAvailable: false,
      legacySessionsAvailable: true,
      workerSessionSourceConflict: false,
      conflictReason: null,
      staleSessionsFiltered: staleRoles.length,
      filteredStaleRoles: staleRoles,
    };
  }

  return {
    sessions: {},
    source: "empty",
    cycleId: null,
    canonicalSessionsAvailable: false,
    legacySessionsAvailable: legacyAvailable,
    workerSessionSourceConflict: false,
    conflictReason: null,
    staleSessionsFiltered: 0,
    filteredStaleRoles: [],
  };
}

export async function listOpenTargetSessions(
  options: TargetSessionStateOptions,
): Promise<Record<string, unknown>> {
  const { sessions } = await readOpenTargetSessionState(options);
  return sessions;
}
