import path from "node:path";
import crypto from "node:crypto";
import { readJsonSafe, READ_JSON_REASON, writeJsonAtomic } from "./fs_utils.js";

export const CHECKPOINT_SCHEMA_VERSION = 2;
export const CHECKPOINT_FORMAT = "resumable_v2";
export const CHECKPOINT_INTEGRITY_ALGORITHM = "sha256";

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
