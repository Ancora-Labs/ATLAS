import path from "node:path";
import crypto from "node:crypto";
import { readJsonSafe, READ_JSON_REASON, writeJsonAtomic } from "./fs_utils.js";
import type { CancellationToken } from "./daemon_control.js";

export const CHECKPOINT_SCHEMA_VERSION = 2;
export const CHECKPOINT_FORMAT = "resumable_v2";
export const CHECKPOINT_INTEGRITY_ALGORITHM = "sha256";
export const RUN_SEGMENT_BATCH_SPAN_DEFAULT = 5;
export const RUN_SEGMENT_HISTORY_MAX_DEFAULT = 20;

const CHECKPOINT_META_KEYS = new Set([
  "schemaVersion",
  "checkpointFormat",
  "checkpointKind",
  "checkpointVersion",
  "replayCompatibility",
  "integrity",
]);

function extractPayloadFields(checkpoint) {
  const input = checkpoint && typeof checkpoint === "object" ? checkpoint : {};
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (CHECKPOINT_META_KEYS.has(key)) continue;
    payload[key] = value;
  }
  return payload;
}

function computeCheckpointIntegrity(payload) {
  return crypto.createHash(CHECKPOINT_INTEGRITY_ALGORITHM).update(JSON.stringify(payload)).digest("hex");
}

function resolveSegmentBounds(segmentIndex: number, spanBatches: number, totalBatches: number) {
  const safeSpan = Math.max(1, Math.floor(Number(spanBatches) || RUN_SEGMENT_BATCH_SPAN_DEFAULT));
  const safeTotal = Math.max(0, Math.floor(Number(totalBatches) || 0));
  const idx = Math.max(1, Math.floor(Number(segmentIndex) || 1));
  const startBatch = ((idx - 1) * safeSpan) + 1;
  const endBatch = Math.min(safeTotal > 0 ? safeTotal : startBatch + safeSpan - 1, idx * safeSpan);
  return { segmentIndex: idx, spanBatches: safeSpan, startBatch, endBatch };
}

export function initializeRunSegmentState(checkpoint, opts: { spanBatches?: number; historyMax?: number } = {}) {
  const target = checkpoint && typeof checkpoint === "object" ? checkpoint : {};
  const totalBatches = Math.max(0, Math.floor(Number((target as any).totalPlans || 0)));
  const spanBatches = Math.max(1, Math.floor(Number(opts.spanBatches) || RUN_SEGMENT_BATCH_SPAN_DEFAULT));
  const historyMax = Math.max(1, Math.floor(Number(opts.historyMax) || RUN_SEGMENT_HISTORY_MAX_DEFAULT));
  const initialized = {
    ...target,
    runSegment: {
      ...resolveSegmentBounds(1, spanBatches, totalBatches),
      startedAt: String((target as any)?.createdAt || new Date().toISOString()),
      rolloverAt: null,
    },
    runSegmentHistory: [],
    runSegmentHistoryMax: historyMax,
  };
  return initialized;
}

export function applyRunSegmentRollover(
  checkpoint,
  opts: { completedBatches: number; spanBatches?: number; historyMax?: number } = { completedBatches: 0 },
): {
  checkpoint: any;
  rolledOver: boolean;
  previousSegment?: Record<string, unknown> | null;
  activeSegment?: Record<string, unknown> | null;
} {
  const target = checkpoint && typeof checkpoint === "object" ? checkpoint : {};
  const totalBatches = Math.max(0, Math.floor(Number((target as any).totalPlans || 0)));
  const spanBatches = Math.max(
    1,
    Math.floor(
      Number(opts.spanBatches || (target as any)?.runSegment?.spanBatches || RUN_SEGMENT_BATCH_SPAN_DEFAULT),
    ),
  );
  const historyMax = Math.max(
    1,
    Math.floor(
      Number(opts.historyMax || (target as any)?.runSegmentHistoryMax || RUN_SEGMENT_HISTORY_MAX_DEFAULT),
    ),
  );
  const completedBatches = Math.max(0, Math.floor(Number(opts.completedBatches || 0)));
  const currentIndex = Math.max(1, Math.floor(Number((target as any)?.runSegment?.segmentIndex || 1)));
  const nextIndex = Math.max(1, Math.floor(completedBatches / spanBatches) + 1);
  const effectiveNextIndex = totalBatches > 0 ? Math.min(nextIndex, Math.ceil(totalBatches / spanBatches)) : nextIndex;
  const previousHistory = Array.isArray((target as any).runSegmentHistory) ? (target as any).runSegmentHistory : [];

  const base = {
    ...target,
    runSegmentHistoryMax: historyMax,
  };
  if (effectiveNextIndex <= currentIndex) {
    if (!(base as any).runSegment) {
      (base as any).runSegment = {
        ...resolveSegmentBounds(currentIndex, spanBatches, totalBatches),
        startedAt: new Date().toISOString(),
        rolloverAt: null,
      };
    }
    return { checkpoint: base, rolledOver: false, previousSegment: null, activeSegment: (base as any).runSegment || null };
  }

  const nowIso = new Date().toISOString();
  const previousSegment = {
    ...resolveSegmentBounds(currentIndex, spanBatches, totalBatches),
    completedBatches: Math.min(completedBatches, totalBatches || completedBatches),
    rolloverAt: nowIso,
  };
  const runSegmentHistory = [...previousHistory, previousSegment].slice(-historyMax);
  const activeSegment = {
    ...resolveSegmentBounds(effectiveNextIndex, spanBatches, totalBatches),
    startedAt: nowIso,
    rolloverAt: null,
  };
  const next = {
    ...base,
    runSegmentHistory,
    runSegment: activeSegment,
  };
  return { checkpoint: next, rolledOver: true, previousSegment, activeSegment };
}

export function createVersionedCheckpointEnvelope(checkpoint, previousCheckpoint = null, checkpointKind = "dispatch") {
  const payload = extractPayloadFields(checkpoint);
  const previous = previousCheckpoint && typeof previousCheckpoint === "object" ? previousCheckpoint : null;
  const nowIso = new Date().toISOString();
  const createdAt = String(payload.createdAt || (previous as any)?.createdAt || nowIso);
  const nextVersion = Math.max(
    1,
    Number((previous as any)?.checkpointVersion || checkpoint?.checkpointVersion || 0) + 1
  );
  const normalizedPayload = {
    ...payload,
    createdAt,
    updatedAt: nowIso,
  };
  const integrityHash = computeCheckpointIntegrity(normalizedPayload);
  return {
    ...normalizedPayload,
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    checkpointFormat: CHECKPOINT_FORMAT,
    checkpointKind: String(checkpointKind || "dispatch"),
    checkpointVersion: nextVersion,
    replayCompatibility: {
      replayContractVersion: 1,
      legacySchemaVersion: 1,
      resumable: true,
    },
    integrity: {
      algorithm: CHECKPOINT_INTEGRITY_ALGORITHM,
      hash: integrityHash,
    },
  };
}

export function validateCheckpointEnvelope(checkpoint) {
  if (!checkpoint || typeof checkpoint !== "object") {
    return { ok: false, reason: "checkpoint_not_object" };
  }
  const schemaVersion = Number(checkpoint.schemaVersion || 0);
  if (schemaVersion < CHECKPOINT_SCHEMA_VERSION) {
    return { ok: true, reason: "legacy_schema" };
  }
  const payload = extractPayloadFields(checkpoint);
  const expectedHash = computeCheckpointIntegrity(payload);
  const actualHash = String(checkpoint?.integrity?.hash || "");
  if (!actualHash || actualHash !== expectedHash) {
    return { ok: false, reason: "checkpoint_integrity_mismatch" };
  }
  return { ok: true, reason: "ok" };
}

export async function readCheckpoint(config, opts = {}) {
  const stateDir = config?.paths?.stateDir || "state";
  const options = opts as { fileName?: string };
  const fileName = String(options.fileName || "dispatch_checkpoint.json");
  const filePath = path.join(stateDir, fileName);
  const raw = await readJsonSafe(filePath);
  if (!raw.ok) {
    if (raw.reason === READ_JSON_REASON.MISSING) return null;
    throw raw.error || new Error(`checkpoint_read_failed:${raw.reason}`);
  }
  const validation = validateCheckpointEnvelope(raw.data);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  return raw.data;
}

export async function writeCheckpoint(config, checkpoint, opts = {}) {
  if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
    throw new Error("checkpoint must be a non-null object");
  }
  const stateDir = config?.paths?.stateDir || "state";
  const options = opts as { fileName?: string; checkpointKind?: string; returnEnvelope?: boolean };
  const fileName = options.fileName
    ? String(options.fileName)
    : `checkpoint-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const checkpointKind = String(options.checkpointKind || "dispatch");
  const filePath = path.join(stateDir, fileName);
  const previousCheckpoint = options.fileName
    ? await readCheckpoint(config, { fileName }).catch(() => null)
    : null;
  const envelope = createVersionedCheckpointEnvelope(checkpoint, previousCheckpoint, checkpointKind);
  await writeJsonAtomic(filePath, envelope);
  return options.returnEnvelope ? envelope : filePath;
}

/**
 * Cooperative cancellation checkpoint for use inside checkpoint-writing flows.
 *
 * Throws CancelledError if the provided token is already cancelled; otherwise
 * returns immediately.  Safe to call with null/undefined — treated as no-op so
 * callers that have not opted into cancellation are unaffected.
 *
 * @param token — CancellationToken from createCancellationToken(), or null/undefined
 */
export function checkCancellationAtCheckpoint(token?: CancellationToken | null): void {
  token?.throwIfCancelled();
}
