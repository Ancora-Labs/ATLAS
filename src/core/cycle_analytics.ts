/**
 * BOX Cycle Analytics
 *
 * Generates cycle_analytics.json per orchestration loop with normalized KPIs,
 * confidence assessment, and causal links between pipeline stages.
 *
 * Differentiation boundary with slo_metrics.json (Athena AC14 resolved):
 *   slo_metrics.json  — SLO compliance: raw latency values, breach records, threshold
 *                       violations. Written by slo_checker.js. Compliance tracking.
 *   cycle_analytics.json — Cycle performance: high-level KPIs aggregated from SLO results
 *                          + outcomes + health scores + causal attribution.
 *                          References sloBreachCount/sloStatus, does NOT duplicate raw
 *                          breach records or threshold details.
 *
 * Canonical events (Athena AC13 resolved):
 *   KPIs are computed exclusively from the 5 SLO_TIMESTAMP_STAGES defined in
 *   pipeline_progress.js. No other events are treated as canonical inputs.
 *
 * Confidence levels (Athena AC11 resolved):
 *   Confidence uses the existing codebase enum ("high"|"medium"|"low") computed
 *   deterministically from data completeness — NOT invented statistical intervals.
 *   high:   All 5 canonical events present AND sloRecord provided.
 *   medium: 3–4 canonical events present OR sloRecord missing.
 *   low:    ≤2 canonical events present OR no pipeline progress.
 *
 * Causal links (Athena AC12 resolved):
 *   Deterministic model: the 3 SLO-measured spans (decision, dispatch, verification).
 *   Each link records cause→effect stage names, measured latencyMs, and whether the
 *   span exceeded its configured threshold (anomaly=true). No invented causality.
 *
 * Schema (Athena AC16 resolved):
 *   See CYCLE_ANALYTICS_SCHEMA for required fields and explicit enums.
 *
 * Retention policy (Athena AC17 resolved):
 *   Defaults to 50 history entries (configurable via config.cycleAnalytics.maxHistoryEntries).
 *   slo_checker uses 100; cycle records are larger so a lower cap is appropriate.
 *
 * Missing data sentinel (Athena AC18 resolved):
 *   Numeric fields use null (not 0) when data is absent.
 *   All absent fields are documented in the missingData[] array with reason codes.
 *
 * Risk (Athena AC19 resolved):
 *   Per-cycle file I/O is added to the runSingleCycle hot path.
 *   The call is wrapped in try/catch — analytics failure never blocks orchestration.
 */

import path from "node:path";
import { createHash } from "node:crypto";
import { readJson, writeJson } from "./fs_utils.js";
import { warn, emitEvent } from "./logger.js";
import { EVENTS, EVENT_DOMAIN } from "./event_schema.js";
import { SLO_TIMESTAMP_CONTRACT, SLO_METRIC } from "./slo_checker.js";
import { hasCleanTreeStatusEvidence, hasVerificationReportEvidence } from "./verification_gate.js";
import { hasFiniteAthenaOverallScore } from "./athena_reviewer.js";
import { hasPrometheusRuntimeContractSignals, isStrategicFieldToolTraceContaminated, STRATEGIC_FIELD_MIN_SEMANTIC_LENGTH } from "./prometheus.js";
import { getLaneForWorkerName, isSpecialistLane } from "./role_registry.js";
import { isAnalyticsCompletedWorkerStatus } from "./worker_runner.js";
import { loadCapabilityExecutionSummary } from "./state_tracker.js";
import { normalizeModelLabel, computeBenchmarkIntegrityScore } from "./model_policy.js";

// ── Funnel helpers ─────────────────────────────────────────────────────────────

/**
 * Safely divide two nullable numbers, returning null when the denominator is
 * zero or either value is absent.  Rounded to 3 decimal places.
 */
function safeRatio(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

// ── Deterministic guard helpers ────────────────────────────────────────────────

/**
 * Return the value only if it is a finite number; otherwise null.
 * Prevents non-numeric values (e.g. strings, booleans) from leaking into KPI
 * channels when sloRecord fields carry unexpected types after schema evolution.
 */
function toFiniteNumberOrNull(v: unknown): number | null {
  return (typeof v === "number" && isFinite(v)) ? v : null;
}

/**
 * Allowed values for the sloStatus KPI field.
 * Any value outside this set is clamped to "unknown" so health-channel
 * derivation logic always receives a recognised status token.
 */
const ALLOWED_SLO_STATUSES = new Set(["ok", "degraded", "unknown"]);

/**
 * Sanitize a single worker-result entry so that only the two fields consumed
 * by computeCycleAnalytics ({roleName, status}) are propagated.
 * This prevents EvidenceEnvelope fields (verificationEvidence, prChecks, etc.)
 * from silently bleeding into the analytics record as the envelope evolves.
 */
function sanitizeWorkerResult(w: unknown): { roleName: string; status: string } {
  if (!w || typeof w !== "object") return { roleName: "unknown", status: "unknown" };
  const obj = w as Record<string, unknown>;
  return {
    roleName: typeof obj.roleName === "string" ? obj.roleName : "unknown",
    status:   typeof obj.status   === "string" ? obj.status   : "unknown",
  };
}

// ── Violation feedback interface ──────────────────────────────────────────────

/**
 * Aggregated contract-violation, retry, and reroute counters derived from a
 * single cycle's worker results.  Persisted inside the cycle analytics record so
 * Prometheus can read them on the next cycle and feed them into planning priors.
 *
 * Rates (0–1) are null when no workers were dispatched.
 */
export interface ViolationFeedback {
  /** Workers that triggered at least one transient retry this cycle. */
  retryCount: number;
  /** Workers whose dispatchContract reported closureBoundaryViolation=true. */
  closureBoundaryViolations: number;
  /** Workers whose dispatchBlockReason begins with "hook_telemetry_inconsistent". */
  hookTelemetryViolations: number;
  /** Workers with any non-null dispatchBlockReason (all block categories). */
  dispatchBlockedWorkers: number;
  /** Workers rerouted away from their planned specialist role. */
  specialistRerouteCount: number;
  /** Roles that were rerouted (ordered, may contain duplicates across waves). */
  reroutedRoles: string[];
  /** retryCount / dispatched (null when dispatched = 0). */
  retryRate: number | null;
  /** (closureBoundaryViolations + hookTelemetryViolations) / dispatched. */
  contractViolationRate: number | null;
  /** specialistRerouteCount / dispatched. */
  rerouteRate: number | null;
}

// ── Enums ──────────────────────────────────────────────────────────────────────

/** Pipeline phase at the time analytics were generated. */
export const CYCLE_PHASE = Object.freeze({
  COMPLETED: "completed",
  FAILED: "failed",
  INCOMPLETE: "incomplete",
});

/**
 * Reason codes emitted in cycleTruthContract.nullEventsTerminalBlockReason
 * when a cycle reaches COMPLETED phase but one or more canonical events are absent.
 *
 * This makes every early-exit visible and machine-readable. Consumers MUST
 * inspect this field when cycleTruthContract.isFullyCovered is false.
 *
 * dispatch_blocked       — dispatchBlockReason is set; a gate stopped worker dispatch
 * governance_blocked     — a governance/freeze gate halted the cycle before dispatch
 * no_plans_generated     — Prometheus produced zero plans (NO_PLANS outcome)
 * plan_not_approved      — Athena rejected the plan set (REJECTED outcome)
 * unspecified_early_exit — cycle ended early without an explicit reason on record
 */
export const CYCLE_TRUTH_TERMINAL_BLOCK_REASON = Object.freeze({
  DISPATCH_BLOCKED:       "dispatch_blocked",
  GOVERNANCE_BLOCKED:     "governance_blocked",
  NO_PLANS_GENERATED:     "no_plans_generated",
  PLAN_NOT_APPROVED:      "plan_not_approved",
  UNSPECIFIED_EARLY_EXIT: "unspecified_early_exit",
});

/** Aggregate outcome status for the cycle. */
export const CYCLE_OUTCOME_STATUS = Object.freeze({
  SUCCESS: "success",
  PARTIAL: "partial",
  FAILED: "failed",
  NO_PLANS: "no_plans",
  REJECTED: "rejected",
  UNKNOWN: "unknown",
  /**
   * Full runtimeContractProbe failed and the cycle cannot be treated as
   * SUCCESS or benign-PARTIAL without explicit remediation.  Consumers
   * must inspect `outcomes.probeFailureRemediation` for the blocking criteria
   * and required remediation actions before re-dispatching.
   */
  DISPATCH_BLOCK_REMEDIATION: "dispatch_block_remediation",
  /**
   * Cycle completed but CI-critical system-learning debt was detected and no
   * CI-fix worker produced a successful remediation result.  The cycle cannot
   * be closed as healthy until CI debt is resolved.
   *
   * Consumers must inspect `outcomes.ciRemediationEvidence` for the set of
   * unresolved CI finding IDs and the expected remediation action.
   */
  CI_DEBT_UNRESOLVED: "ci_debt_unresolved",
});

/** Stable machine-readable dispatch block-reason enum shared across components. */
export const DISPATCH_BLOCK_REASON_CODE = Object.freeze({
  UNKNOWN: "unknown",
  BUDGET_EXHAUSTED: "budget_exhausted",
  GUARDRAIL_PAUSE_WORKERS_ACTIVE: "guardrail_pause_workers_active",
  GUARDRAIL_FORCE_CHECKPOINT_ACTIVE: "force_checkpoint_validation_active",
  GOVERNANCE_FREEZE_ACTIVE: "governance_freeze_active",
  LINEAGE_CYCLE_DETECTED: "lineage_cycle_detected",
  GOVERNANCE_CANARY_BREACH: "governance_canary_breach",
  CLOUD_AGENT_GOVERNANCE_POLICY_VIOLATION: "cloud_agent_governance_policy_violation",
  CRITICAL_DEBT_OVERDUE: "critical_debt_overdue",
  MANDATORY_DRIFT_DEBT_UNRESOLVED: "mandatory_drift_debt_unresolved",
  PLAN_EVIDENCE_COUPLING_INVALID: "plan_evidence_coupling_invalid",
  CROSS_CYCLE_PREREQUISITE_UNMET: "cross_cycle_prerequisite_unmet",
  DEPENDENCY_READINESS_INCOMPLETE: "dependency_readiness_incomplete",
  ROLLING_YIELD_THROTTLE: "rolling_yield_throttle",
  SPECIALIZATION_ADMISSION_GATE: "specialization_admission_gate_failed",
  OVERSIZED_PACKET: "packet_exceeds_actionable_steps_cap",
  LANE_DIVERSITY_GATE_BLOCKED: "lane_diversity_gate_blocked",
  ROLE_CAPABILITY_CHECK_FAILED: "role_capability_check_failed",
  ACCESS_BLOCKED: "access_blocked",
  TOOL_POLICY_DENIED: "tool_policy_denied",
  HOOK_TELEMETRY_INCONSISTENT: "hook_telemetry_inconsistent",
  RUNTIME_HOOK_DENIED: "runtime_hook_denied",
  WORKER_REPORTED_BLOCKED_WITHOUT_REASON: "worker_reported_blocked_without_reason",
} as const);

const DISPATCH_BLOCK_REASON_CODE_SET = new Set<string>(Object.values(DISPATCH_BLOCK_REASON_CODE));

export function parseDispatchBlockReasonContract(
  rawReason: unknown,
): { code: string; detail: Record<string, unknown>; raw: string } | null {
  const raw = String(rawReason || "").trim();
  if (!raw) return null;
  const [prefixRaw, ...rest] = raw.split(":");
  const prefix = String(prefixRaw || "").trim().toLowerCase();
  const code = DISPATCH_BLOCK_REASON_CODE_SET.has(prefix)
    ? prefix
    : DISPATCH_BLOCK_REASON_CODE.UNKNOWN;
  const detailText = rest.join(":").trim();
  const detail: Record<string, unknown> = {};
  if (detailText) {
    detail.rawDetail = detailText;
    // Parse simple key=value,key2=value2 payloads for deterministic machine-readability.
    for (const token of detailText.split(",")) {
      const [k, v] = token.split("=");
      const key = String(k || "").trim();
      if (!key) continue;
      detail[key] = String(v ?? "").trim();
    }
  }
  return { code, detail, raw };
}

/**
 * Confidence level for the analytics record.
 * Uses the existing codebase enum — NOT statistical confidence intervals.
 * Computed deterministically from data completeness.
 */
export const CONFIDENCE_LEVEL = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

/** Reason codes for entries in the missingData[] array. */
export const MISSING_DATA_REASON = Object.freeze({
  /** The source file or object was not provided (null/undefined). */
  MISSING_SOURCE: "MISSING_SOURCE",
  /** The source was provided but the specific timestamp field was absent. */
  MISSING_TIMESTAMP: "MISSING_TIMESTAMP",
  /** The source was provided but a computation step raised an error. */
  COMPUTATION_ERROR: "COMPUTATION_ERROR",
});

/** Which part of the analytics record is affected by a missing data entry. */
export const MISSING_DATA_IMPACT = Object.freeze({
  KPI: "kpi",
  OUTCOME: "outcome",
  CAUSAL_LINK: "causal_link",
});

// ── Schema contract ────────────────────────────────────────────────────────────

/**
 * Canonical schema for cycle_analytics.json (Athena AC16 resolved).
 *
 * Required fields and enums are fully specified.
 * cycleId = pipeline_progress.startedAt (ISO 8601 string) — same as slo_metrics.json.
 *
 * stageTransitions — per-packet stage transition records from PLANNING_STAGE_TRANSITION
 *   span events.  Array; empty when no transitions were recorded.
 * dropReasons      — task drop summaries from PLANNING_TASK_DROPPED span events.
 *   Array; empty when no tasks were dropped.
 */
export const CYCLE_ANALYTICS_SCHEMA = Object.freeze({
  schemaVersion: 1,
  required: ["schemaVersion", "lastCycle", "history", "updatedAt"],
  cycleRecord: Object.freeze({
    required: [
      "cycleId",
      "generatedAt",
      "phase",
      "outcomes",
      "kpis",
      "funnel",
      "tierCounts",
      "fastPathCounts",
      "confidence",
      "causalLinks",
      "canonicalEvents",
      "missingData",
      "runtimeContractProbe",
      "cycleTruthContract",
      "structuralAnalytics",
      "laneTelemetry",
      "stageTransitions",
      "dropReasons",
      "modelRoutingTelemetry",
      "capabilityExecutionSummary",
    ],
    cycleIdSource: "pipeline_progress.startedAt",
    phaseEnum: Object.freeze([...Object.values(CYCLE_PHASE)]),
    outcomeStatusEnum: Object.freeze([...Object.values(CYCLE_OUTCOME_STATUS)]),
    confidenceLevelEnum: Object.freeze([...Object.values(CONFIDENCE_LEVEL)]),
    missingDataReasonEnum: Object.freeze([...Object.values(MISSING_DATA_REASON)]),
    missingDataImpactEnum: Object.freeze([...Object.values(MISSING_DATA_IMPACT)]),
  }),
  /** Configurable via config.cycleAnalytics.maxHistoryEntries. */
  defaultMaxHistoryEntries: 50,
});

// ── Canonical worker-cycle artifacts (dispatch/session/activity spine) ──────────

/**
 * Canonical cycle-scoped worker artifact file.
 * Written by orchestrator dispatch transitions and consumed by self-improvement.
 */
export const WORKER_CYCLE_ARTIFACTS_FILE = "worker_cycle_artifacts.json";

/**
 * Legacy evolution_progress file — compatibility read-only path.
 * Used as a fallback when WORKER_CYCLE_ARTIFACTS_FILE is absent or unmigrateable.
 * Deprecated: callers should prefer WORKER_CYCLE_ARTIFACTS_FILE.
 *
 * Schema versions:
 *   v0 (implicit): legacy task-map format { cycle_id, tasks: { id: { status } } }
 *   v1+:           canonical completedTaskIds format (see WORKER_CYCLE_ARTIFACTS_SCHEMA)
 *
 * LEGACY_EVOLUTION_PROGRESS_SCHEMA_VERSION is the implicit version assigned when
 * the file carries no explicit schemaVersion field.
 */
export const LEGACY_EVOLUTION_PROGRESS_FILE = "evolution_progress.json";
export const LEGACY_EVOLUTION_PROGRESS_SCHEMA_VERSION = 0;

export const WORKER_CYCLE_ARTIFACTS_SCHEMA = Object.freeze({
  schemaVersion: 1,
  required: ["schemaVersion", "updatedAt", "latestCycleId", "cycles"],
  cycleRecordRequired: ["cycleId", "updatedAt", "status", "workerSessions", "workerActivity", "completedTaskIds"],
});

/**
 * Maximum age in milliseconds before a worker_cycle_artifacts.json record is
 * considered stale for planning purposes.  Matches the diagnostics freshness
 * window used by computeDiagnosticsFreshnessAdmission in prometheus.ts.
 */
export const WORKER_CYCLE_ARTIFACTS_FRESHNESS_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Shared diagnostics-envelope schema used by freshness-gated prompt consumers. */
export const DIAGNOSTICS_ARTIFACT_JSONL_SCHEMA = "box.diagnostics_artifact.v1";
export const WORKER_CYCLE_ARTIFACTS_DIAGNOSTICS_RECORD_TYPE = "worker_cycle_snapshot";

/**
 * Build a DiagnosticsFreshnessRecord-compatible descriptor for worker_cycle_artifacts.json.
 *
 * Used to integrate the canonical cycle snapshot's age into the diagnostics
 * freshness admission gate (computeDiagnosticsFreshnessAdmission in prometheus.ts)
 * so stale cycle snapshots are treated as historical context rather than live
 * planning truth.
 *
 * Pure function — no I/O.
 *
 * @param artifactData — parsed worker_cycle_artifacts.json content, or null/undefined if absent.
 * @returns Object with label, recordedAt (from updatedAt field), and staleAfterMs.
 */
export function buildWorkerCycleArtifactsFreshnessRecord(artifactData: unknown): {
  label: string;
  recordedAt: string | null;
  staleAfterMs: number;
} {
  const updatedAt =
    artifactData !== null &&
    artifactData !== undefined &&
    typeof artifactData === "object" &&
    !Array.isArray(artifactData)
      ? String((artifactData as Record<string, unknown>).updatedAt || "").trim()
      : "";
  return {
    label: "worker_cycle_artifacts",
    recordedAt: updatedAt || null,
    staleAfterMs: WORKER_CYCLE_ARTIFACTS_FRESHNESS_MAX_AGE_MS,
  };
}

/**
 * Project a canonical worker_cycle_artifacts snapshot into the shared diagnostics
 * envelope so Prometheus can validate freshness/shape before prompt injection.
 */
export function buildWorkerCycleArtifactsDiagnosticsRecord(
  artifactData: unknown,
): Record<string, unknown> | null {
  if (!isWorkerCycleArtifactsSnapshotContractValid(artifactData)) return null;
  const migrated = migrateWorkerCycleArtifacts(artifactData);
  if (!migrated.ok || !migrated.data) return null;
  const payload = migrated.data;
  const savedAt = String(payload.updatedAt || "").trim();
  const savedAtMs = Date.parse(savedAt);
  if (!savedAt || !Number.isFinite(savedAtMs)) return null;
  const cycleMap =
    payload.cycles && typeof payload.cycles === "object" && !Array.isArray(payload.cycles)
      ? payload.cycles as Record<string, unknown>
      : {};
  const staleAfterMs = WORKER_CYCLE_ARTIFACTS_FRESHNESS_MAX_AGE_MS;
  const evaluatedAt = new Date().toISOString();
  return {
    jsonlSchema: DIAGNOSTICS_ARTIFACT_JSONL_SCHEMA,
    recordType: WORKER_CYCLE_ARTIFACTS_DIAGNOSTICS_RECORD_TYPE,
    schemaVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
    savedAt,
    freshness: {
      status: "fresh",
      truthStatus: "point_in_time",
      evaluatedAt,
      staleAfterMs,
      expiresAt: new Date(savedAtMs + staleAfterMs).toISOString(),
    },
    payload: {
      latestCycleId: String(payload.latestCycleId || "").trim() || null,
      cycleCount: Object.keys(cycleMap).length,
      updatedAt: savedAt,
    },
  };
}

/**
 * Strict contract validator for canonical worker_cycle_artifacts snapshots.
 * This gate intentionally rejects malformed or timestamp-less payloads so
 * Prometheus never treats them as live planning truth.
 */
export function isWorkerCycleArtifactsSnapshotContractValid(artifactData: unknown): boolean {
  if (!artifactData || typeof artifactData !== "object" || Array.isArray(artifactData)) return false;
  const raw = artifactData as Record<string, unknown>;
  if (Number(raw.schemaVersion) !== WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion) return false;

  const updatedAt = String(raw.updatedAt || "").trim();
  const updatedAtMs = Date.parse(updatedAt);
  if (!updatedAt || !Number.isFinite(updatedAtMs)) return false;

  const latestCycleId = String(raw.latestCycleId || "").trim();
  if (!latestCycleId) return false;

  const cycles = raw.cycles;
  if (!cycles || typeof cycles !== "object" || Array.isArray(cycles)) return false;
  const cycleMap = cycles as Record<string, unknown>;
  const latestRecord = cycleMap[latestCycleId];
  if (!latestRecord || typeof latestRecord !== "object" || Array.isArray(latestRecord)) return false;

  for (const field of WORKER_CYCLE_ARTIFACTS_SCHEMA.cycleRecordRequired) {
    if (!(field in (latestRecord as Record<string, unknown>))) return false;
  }
  const rec = latestRecord as Record<string, unknown>;
  const recCycleId = String(rec.cycleId || "").trim();
  if (!recCycleId || recCycleId !== latestCycleId) return false;
  const recUpdatedAt = String(rec.updatedAt || "").trim();
  if (!recUpdatedAt || !Number.isFinite(Date.parse(recUpdatedAt))) return false;
  const recStatus = String(rec.status || "").trim();
  if (!recStatus) return false;
  if (!rec.workerSessions || typeof rec.workerSessions !== "object" || Array.isArray(rec.workerSessions)) return false;
  if (!rec.workerActivity || typeof rec.workerActivity !== "object" || Array.isArray(rec.workerActivity)) return false;
  if (!Array.isArray(rec.completedTaskIds)) return false;
  if (rec.completedTaskIds.some((id) => typeof id !== "string" || String(id).trim().length === 0)) return false;

  return true;
}

export const WORKER_CYCLE_ARTIFACT_MIGRATION_REASON = Object.freeze({
  OK: "ok",
  ALREADY_CURRENT: "already_current",
  INVALID_DATA: "invalid_data",
  UNKNOWN_FUTURE_VERSION: "unknown_future_version",
});

/**
 * Generate a short, deterministic task ID from the dispatching role, the
 * plan's position within the full plan set, and its task description text.
 *
 * The result is stable across restarts as long as the plan set does not change
 * (same role + same position + same text → same id).  It is intentionally
 * short (12 hex chars) to keep artifact files readable.
 *
 * Used by stampBatchPlanTaskIds in orchestrator.ts to backfill plans that do
 * not carry an explicit task_id from the planner.
 */
export function generateDeterministicTaskId(role: string, planIndex: number, taskText: string): string {
  const input = `${String(role || "unknown").trim()}:${planIndex}:${String(taskText || "").trim().slice(0, 200)}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function sanitizeCompletedTaskIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((id) => String(id || "").trim()).filter(Boolean))];
}

function normalizeWorkerCycleRecord(rawRecord: unknown, cycleIdHint: string): Record<string, unknown> {
  const rec = rawRecord && typeof rawRecord === "object" ? rawRecord as Record<string, unknown> : {};
  const cycleId = String(rec.cycleId || cycleIdHint || "unknown-cycle");
  const status = String(rec.status || "unknown");
  const updatedAt = String(rec.updatedAt || new Date().toISOString());
  const rawSessions = rec.workerSessions && typeof rec.workerSessions === "object" && !Array.isArray(rec.workerSessions)
    ? rec.workerSessions as Record<string, unknown>
    : {};
  // Propagate resolvedRole within each session entry so consumers can correlate
  // the logical batch role with the actual dispatched role (after access-fallback).
  const workerSessions: Record<string, unknown> = {};
  for (const [role, session] of Object.entries(rawSessions)) {
    if (session && typeof session === "object" && !Array.isArray(session)) {
      const s = session as Record<string, unknown>;
      workerSessions[role] = s.resolvedRole !== undefined ? s : { ...s };
    } else {
      workerSessions[role] = session;
    }
  }
  const workerActivity = rec.workerActivity && typeof rec.workerActivity === "object" && !Array.isArray(rec.workerActivity)
    ? rec.workerActivity as Record<string, unknown>
    : {};
  const completedTaskIds = sanitizeCompletedTaskIds(rec.completedTaskIds);
  return {
    ...rec,
    cycleId,
    status,
    updatedAt,
    workerSessions,
    workerActivity,
    completedTaskIds,
  };
}

/**
 * Schema-versioned migration for canonical worker-cycle dispatch artifacts.
 * Supports:
 *   v1 current envelope: { schemaVersion:1, latestCycleId, cycles }
 *   legacy envelope:     { cycles } (no schemaVersion)
 *   legacy single-cycle: { cycleId, workerSessions, workerActivity, completedTaskIds }
 */
export function migrateWorkerCycleArtifacts(data: unknown): {
  ok: boolean;
  reason: string;
  fromVersion: number | null;
  toVersion: number;
  data: Record<string, unknown> | null;
} {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.INVALID_DATA,
      fromVersion: null,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      data: null,
    };
  }

  const obj = data as Record<string, unknown>;
  const rawVersion = obj.schemaVersion;
  const hasVersion = rawVersion !== undefined;
  const fromVersion = hasVersion && Number.isInteger(Number(rawVersion)) ? Number(rawVersion) : 0;
  if (hasVersion && (!Number.isInteger(Number(rawVersion)) || Number(rawVersion) < 0)) {
    return {
      ok: false,
      reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.INVALID_DATA,
      fromVersion: null,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      data: null,
    };
  }
  if (fromVersion > WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion) {
    return {
      ok: false,
      reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.UNKNOWN_FUTURE_VERSION,
      fromVersion,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      data: null,
    };
  }

  const nowIso = new Date().toISOString();
  const legacySingleCycleShape = (
    "workerSessions" in obj
    || "workerActivity" in obj
    || "completedTaskIds" in obj
  );
  const legacyCycleId = String(obj.cycleId || obj.startedAt || "legacy-cycle");
  const normalizedCycles: Record<string, unknown> = {};

  if (obj.cycles && typeof obj.cycles === "object" && !Array.isArray(obj.cycles)) {
    for (const [cycleId, record] of Object.entries(obj.cycles as Record<string, unknown>)) {
      normalizedCycles[String(cycleId)] = normalizeWorkerCycleRecord(record, String(cycleId));
    }
  } else if (legacySingleCycleShape) {
    normalizedCycles[legacyCycleId] = normalizeWorkerCycleRecord(obj, legacyCycleId);
  } else if (fromVersion === WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion) {
    // Declares current version but lacks required structure.
    return {
      ok: false,
      reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.INVALID_DATA,
      fromVersion,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      data: null,
    };
  }

  const latestCycleId = String(
    obj.latestCycleId
    || Object.keys(normalizedCycles).slice(-1)[0]
    || legacyCycleId
  );
  const migrated = {
    schemaVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
    updatedAt: String(obj.updatedAt || nowIso),
    latestCycleId,
    cycles: normalizedCycles,
  };

  return {
    ok: true,
    reason: fromVersion === WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion
      ? WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.ALREADY_CURRENT
      : WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.OK,
    fromVersion,
    toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
    data: migrated,
  };
}

function parseIsoMs(value: unknown): number {
  const t = Date.parse(String(value || ""));
  return Number.isFinite(t) ? t : 0;
}

/**
 * Select a usable cycle record from migrated worker-cycle artifacts.
 * Preference order is deterministic:
 *   1) preferredCycleId (typically pipeline_progress.startedAt)
 *   2) latestCycleId pointer from the artifact envelope
 *   3) most recently updated cycle record in cycles{}
 */
export function selectWorkerCycleRecord(
  artifactData: unknown,
  preferredCycleId: unknown = "",
): { cycleId: string | null; record: Record<string, unknown> | null; source: "preferred" | "latest" | "most_recent" | "none" } {
  if (!artifactData || typeof artifactData !== "object" || Array.isArray(artifactData)) {
    return { cycleId: null, record: null, source: "none" };
  }
  const payload = artifactData as Record<string, unknown>;
  const cycles = payload.cycles && typeof payload.cycles === "object" && !Array.isArray(payload.cycles)
    ? payload.cycles as Record<string, unknown>
    : {};
  const preferredId = String(preferredCycleId || "").trim();
  const latestId = String(payload.latestCycleId || "").trim();

  const pick = (cycleId: string): Record<string, unknown> | null => {
    if (!cycleId) return null;
    const rec = cycles[cycleId];
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return null;
    return rec as Record<string, unknown>;
  };

  const preferred = pick(preferredId);
  if (preferred) return { cycleId: preferredId, record: preferred, source: "preferred" };

  const latest = pick(latestId);
  if (latest) return { cycleId: latestId, record: latest, source: "latest" };

  let mostRecentId = "";
  let mostRecentMs = -1;
  for (const [cycleId, rec] of Object.entries(cycles)) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) continue;
    const updatedAtMs = parseIsoMs((rec as Record<string, unknown>).updatedAt);
    if (updatedAtMs > mostRecentMs || (updatedAtMs === mostRecentMs && cycleId > mostRecentId)) {
      mostRecentMs = updatedAtMs;
      mostRecentId = cycleId;
    }
  }
  const mostRecent = pick(mostRecentId);
  if (mostRecent) return { cycleId: mostRecentId, record: mostRecent, source: "most_recent" };

  return { cycleId: null, record: null, source: "none" };
}

/**
 * Extract a flat sessions map from a canonical cycle record, merging the
 * workerActivity log into each entry as `_activityLog` so consumers can
 * detect terminal statuses without importing orchestrator logic.
 *
 * Pure function — no I/O.  Returns null when the record has no sessions.
 */
export function extractSessionsFromCycleRecord(
  record: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!record) return null;
  const sessions = record.workerSessions;
  if (!sessions || typeof sessions !== "object" || Array.isArray(sessions)) return null;
  const workerActivity =
    record.workerActivity && typeof record.workerActivity === "object" && !Array.isArray(record.workerActivity)
      ? (record.workerActivity as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = {};
  for (const [role, session] of Object.entries(sessions as Record<string, unknown>)) {
    if (session && typeof session === "object" && !Array.isArray(session)) {
      const log = Array.isArray((workerActivity as Record<string, unknown[]>)[role])
        ? (workerActivity as Record<string, unknown[]>)[role]
        : [];
      result[role] = { ...(session as Record<string, unknown>), _activityLog: log };
    } else {
      result[role] = session;
    }
  }
  return result;
}

/**
 * Filter legacy worker sessions by staleness relative to a pipeline cycle start.
 *
 * Sessions whose most recent activity timestamp (lastActiveAt, then startedAt)
 * predates the cycle start are considered stale and excluded so they cannot emit
 * actionable worker-health findings when the canonical artifact is absent.
 *
 * Pure function — no I/O.
 *
 * @param sessions   - flat session map from worker_sessions.json
 * @param cycleStart - ISO timestamp of the current pipeline cycle; pass null to
 *                     skip filtering (sessions are returned unchanged)
 * @returns { sessions: filtered map, staleRoles: roles that were excluded }
 */
export function filterStaleWorkerSessions(
  sessions: Record<string, unknown>,
  cycleStart: string | null | undefined,
): { sessions: Record<string, unknown>; staleRoles: string[] } {
  if (!sessions || typeof sessions !== "object" || Array.isArray(sessions)) {
    return { sessions: {}, staleRoles: [] };
  }
  if (!cycleStart) return { sessions, staleRoles: [] };
  const cycleStartMs = Date.parse(cycleStart);
  if (!Number.isFinite(cycleStartMs)) return { sessions, staleRoles: [] };

  const kept: Record<string, unknown> = {};
  const staleRoles: string[] = [];
  for (const [role, session] of Object.entries(sessions)) {
    if (!session || typeof session !== "object" || Array.isArray(session)) {
      kept[role] = session;
      continue;
    }
    const s = session as Record<string, unknown>;
    const lastActiveMs = typeof s.lastActiveAt === "string" ? Date.parse(s.lastActiveAt) : NaN;
    const startedAtMs  = typeof s.startedAt    === "string" ? Date.parse(s.startedAt)    : NaN;
    // Use the most recent parseable timestamp available.
    const sessionMs = Number.isFinite(lastActiveMs) ? lastActiveMs
                    : Number.isFinite(startedAtMs)  ? startedAtMs
                    : null;
    // Sessions with no parseable timestamp cannot be proven stale → keep them.
    if (sessionMs === null || sessionMs >= cycleStartMs) {
      kept[role] = session;
    } else {
      staleRoles.push(role);
    }
  }
  return { sessions: kept, staleRoles };
}

/**
 * Compatibility migration for legacy evolution_progress-style task maps.
 * Converts legacy { tasks:{ id:{status} } } payloads into canonical
 * completedTaskIds used by worker_cycle_artifacts v1 consumers.
 */
export function migrateLegacyEvolutionProgressToCompletedTaskIds(data: unknown): {
  ok: boolean;
  reason: string;
  fromVersion: number | null;
  toVersion: number;
  completedTaskIds: string[];
} {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.INVALID_DATA,
      fromVersion: null,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      completedTaskIds: [],
    };
  }

  const obj = data as Record<string, unknown>;
  const rawVersion = obj.schemaVersion;
  const hasVersion = rawVersion !== undefined;
  const fromVersion = hasVersion && Number.isInteger(Number(rawVersion)) ? Number(rawVersion) : 0;
  if (hasVersion && (!Number.isInteger(Number(rawVersion)) || Number(rawVersion) < 0)) {
    return {
      ok: false,
      reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.INVALID_DATA,
      fromVersion: null,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      completedTaskIds: [],
    };
  }
  if (fromVersion > WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion) {
    return {
      ok: false,
      reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.UNKNOWN_FUTURE_VERSION,
      fromVersion,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      completedTaskIds: [],
    };
  }

  if (Array.isArray(obj.completedTaskIds)) {
    return {
      ok: true,
      reason: fromVersion === WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion
        ? WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.ALREADY_CURRENT
        : WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.OK,
      fromVersion,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      completedTaskIds: sanitizeCompletedTaskIds(obj.completedTaskIds),
    };
  }

  const taskMap = obj.tasks;
  if (!taskMap || typeof taskMap !== "object" || Array.isArray(taskMap)) {
    return {
      ok: false,
      reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.INVALID_DATA,
      fromVersion,
      toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
      completedTaskIds: [],
    };
  }

  const completedTaskIds = Object.entries(taskMap as Record<string, unknown>)
    .filter(([, task]) => {
      const status = String((task as Record<string, unknown>)?.status || "").toLowerCase().trim();
      return status === "completed" || status === "done" || status === "success";
    })
    .map(([taskId]) => String(taskId || "").trim())
    .filter(Boolean);

  return {
    ok: true,
    reason: WORKER_CYCLE_ARTIFACT_MIGRATION_REASON.OK,
    fromVersion,
    toVersion: WORKER_CYCLE_ARTIFACTS_SCHEMA.schemaVersion,
    completedTaskIds: [...new Set(completedTaskIds)],
  };
}

function hasDoneWorkerWithVerificationEvidence(workerResults: unknown): boolean {
  if (!Array.isArray(workerResults)) return false;
  return workerResults.some((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const status = String(row.status || "").toLowerCase();
    if (status !== "done" && status !== "success") return false;
    const dispatchContract = row.dispatchContract && typeof row.dispatchContract === "object"
      ? row.dispatchContract as Record<string, unknown>
      : null;
    if (dispatchContract?.doneWorkerWithVerificationReportEvidence === true) return true;
    const evidence = String(
      row.verificationEvidence
      || row.verification_report
      || row.verificationReport
      || row.fullOutput
      || "",
    );
    return hasVerificationReportEvidence(evidence);
  });
}

function countDoneWorkersWithCleanTreeEvidence(workerResults: unknown): number | null {
  if (!Array.isArray(workerResults)) return null;
  let count = 0;
  for (const item of workerResults) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const status = String(row.status || "").toLowerCase();
    if (status !== "done" && status !== "success") continue;
    const dispatchContract = row.dispatchContract && typeof row.dispatchContract === "object"
      ? row.dispatchContract as Record<string, unknown>
      : null;
    if (dispatchContract?.doneWorkerWithCleanTreeStatusEvidence === true) {
      count += 1;
      continue;
    }
    const evidence = String(
      row.verificationEvidence
      || row.verification_report
      || row.verificationReport
      || row.fullOutput
      || "",
    );
    if (hasCleanTreeStatusEvidence(evidence)) count += 1;
  }
  return count;
}

function countBlockedWorkersWithReason(workerResults: unknown): number | null {
  if (!Array.isArray(workerResults)) return null;
  let count = 0;
  for (const item of workerResults) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (String(row.status || "").toLowerCase() !== "blocked") continue;
    const dispatchContract = row.dispatchContract && typeof row.dispatchContract === "object"
      ? row.dispatchContract as Record<string, unknown>
      : null;
    const reason = String(
      row.dispatchBlockReason
      || dispatchContract?.dispatchBlockReason
      || "",
    ).trim();
    const contract = (
      (row.dispatchBlockReasonContract && typeof row.dispatchBlockReasonContract === "object")
        ? row.dispatchBlockReasonContract
        : (dispatchContract?.dispatchBlockReasonContract && typeof dispatchContract.dispatchBlockReasonContract === "object")
          ? dispatchContract.dispatchBlockReasonContract
          : parseDispatchBlockReasonContract(reason)
    );
    if (reason || contract) count += 1;
  }
  return count;
}

function hasDispatchBlockReasonOutcomes(workerResults: unknown): boolean {
  if (!Array.isArray(workerResults)) return false;
  const blockedRows = workerResults.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return String(row.status || "").toLowerCase() === "blocked";
  }) as Array<Record<string, unknown>>;
  if (blockedRows.length === 0) return true;
  return blockedRows.every((row) => {
    const dispatchContract = row.dispatchContract && typeof row.dispatchContract === "object"
      ? row.dispatchContract as Record<string, unknown>
      : null;
    const reason = String(
      row.dispatchBlockReason
      || dispatchContract?.dispatchBlockReason
      || "",
    ).trim();
    const contract = (
      (row.dispatchBlockReasonContract && typeof row.dispatchBlockReasonContract === "object")
        ? row.dispatchBlockReasonContract
        : (dispatchContract?.dispatchBlockReasonContract && typeof dispatchContract.dispatchBlockReasonContract === "object")
          ? dispatchContract.dispatchBlockReasonContract
          : parseDispatchBlockReasonContract(reason)
    );
    return reason.length > 0 || Boolean(contract);
  });
}

export function computeRuntimeContractProbe(opts: {
  prometheusAnalysis?: unknown;
  athenaPlanReview?: unknown;
  workerResults?: unknown;
} = {}) {
  const prometheusPass = hasPrometheusRuntimeContractSignals(opts.prometheusAnalysis);
  const athenaPass = hasFiniteAthenaOverallScore(opts.athenaPlanReview);
  const workerPass = hasDoneWorkerWithVerificationEvidence(opts.workerResults);
  const dispatchReasonPass = hasDispatchBlockReasonOutcomes(opts.workerResults);
  // Semantic-valid check: keyFindings must be long enough and free of tool-trace contamination.
  const keyFindings = String((opts.prometheusAnalysis as any)?.keyFindings ?? "").trim();
  const keyFindingsSemanticValid = (
    keyFindings.length >= STRATEGIC_FIELD_MIN_SEMANTIC_LENGTH &&
    !isStrategicFieldToolTraceContaminated(keyFindings)
  );
  const passed = prometheusPass && athenaPass && workerPass && dispatchReasonPass && keyFindingsSemanticValid;
  return {
    checkedAt: new Date().toISOString(),
    passed,
    criteria: {
      prometheusGeneratedAtAndKeyFindings: { pass: prometheusPass },
      prometheusKeyFindingsSemanticValid: { pass: keyFindingsSemanticValid },
      athenaPlanReviewOverallScoreFinite: { pass: athenaPass },
      doneWorkerWithVerificationReportEvidence: { pass: workerPass },
      dispatchBlockReasonOutcomes: { pass: dispatchReasonPass },
    },
  };
}

function computeLaneTelemetry(workerResults: Array<{ roleName: string; status: string }> | null): Record<string, {
  dispatched: number;
  completed: number;
  failed: number;
  completionRate: number;
  roi: number;
  specialistLane: boolean;
}> {
  if (!Array.isArray(workerResults) || workerResults.length === 0) return {};
  const byLane = new Map<string, { dispatched: number; completed: number; failed: number }>();
  for (const result of workerResults) {
    const lane = getLaneForWorkerName(result?.roleName, "implementation");
    const current = byLane.get(lane) || { dispatched: 0, completed: 0, failed: 0 };
    current.dispatched += 1;
    const status = String(result?.status || "").toLowerCase();
    if (status === "done" || status === "success") current.completed += 1;
    if (status === "error" || status === "failed") current.failed += 1;
    byLane.set(lane, current);
  }
  const output: Record<string, { dispatched: number; completed: number; failed: number; completionRate: number; roi: number; specialistLane: boolean }> = {};
  for (const [lane, row] of byLane.entries()) {
    const completionRate = row.dispatched > 0 ? row.completed / row.dispatched : 0;
    const roi = row.completed / Math.max(1, row.failed);
    output[lane] = {
      dispatched: row.dispatched,
      completed: row.completed,
      failed: row.failed,
      completionRate: Math.round(completionRate * 1000) / 1000,
      roi: Math.round(roi * 1000) / 1000,
      specialistLane: isSpecialistLane(lane),
    };
  }
  return output;
}

/**
 * The 5 canonical pipeline stage names used as KPI inputs.
 * Source: SLO_TIMESTAMP_STAGES in pipeline_progress.js.
 * These are the ONLY events treated as canonical for KPI computation (AC2 / AC13).
 */
export const CANONICAL_EVENT_NAMES = Object.freeze([
  "jesus_awakening",
  "jesus_decided",
  "athena_approved",
  "workers_dispatching",
  "cycle_complete",
]);

/**
 * The 3 causal spans, each mapping directly to an SLO metric.
 * Deterministic model — no invented causality (Athena AC12 resolved).
 */
const CAUSAL_SPANS = Object.freeze([
  Object.freeze({
    metric: SLO_METRIC.DECISION_LATENCY,
    cause: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.DECISION_LATENCY].start,
    effect: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.DECISION_LATENCY].end,
    defaultThresholdMs: 120000,
  }),
  Object.freeze({
    metric: SLO_METRIC.DISPATCH_LATENCY,
    cause: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.DISPATCH_LATENCY].start,
    effect: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.DISPATCH_LATENCY].end,
    defaultThresholdMs: 30000,
  }),
  Object.freeze({
    metric: SLO_METRIC.VERIFICATION_COMPLETION,
    cause: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.VERIFICATION_COMPLETION].start,
    effect: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.VERIFICATION_COMPLETION].end,
    defaultThresholdMs: 3600000,
  }),
]);

// ── Path helper ────────────────────────────────────────────────────────────────

function cycleAnalyticsPath(config) {
  const stateDir = config?.paths?.stateDir || "state";
  return path.join(stateDir, "cycle_analytics.json");
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the threshold for a given metric from config or fall back to default.
 * Does NOT emit errors — this is analytics, not compliance.
 */
function resolveThreshold(config, metric, defaultMs) {
  const configured = config?.slo?.thresholds?.[metric];
  if (typeof configured === "number" && isFinite(configured) && configured > 0) {
    return configured;
  }
  return defaultMs;
}

/**
 * Build the canonicalEvents array from stage timestamps.
 * Each entry records name, timestamp (or null), and present flag.
 */
function buildCanonicalEvents(stageTimestamps) {
  return CANONICAL_EVENT_NAMES.map(name => ({
    name,
    timestamp: (stageTimestamps && typeof stageTimestamps[name] === "string")
      ? stageTimestamps[name]
      : null,
    present: !!(stageTimestamps && typeof stageTimestamps[name] === "string"),
  }));
}

/**
 * Build causal links from stage timestamps and config thresholds.
 * Each link corresponds to one SLO span (Athena AC12 resolved).
 */
function buildCausalLinks(config, stageTimestamps, missingData) {
  return CAUSAL_SPANS.map(span => {
    const causeTs = stageTimestamps?.[span.cause];
    const effectTs = stageTimestamps?.[span.effect];

    if (!causeTs || !effectTs) {
      missingData.push({
        field: `causalLinks[${span.cause}→${span.effect}].latencyMs`,
        reason: MISSING_DATA_REASON.MISSING_TIMESTAMP,
        impact: MISSING_DATA_IMPACT.CAUSAL_LINK,
      });
      return {
        cause: span.cause,
        effect: span.effect,
        metric: span.metric,
        latencyMs: null,
        anomaly: false,
        anomalyReason: null,
      };
    }

    const latencyMs = Math.max(0, new Date(effectTs).getTime() - new Date(causeTs).getTime());
    const threshold = resolveThreshold(config, span.metric, span.defaultThresholdMs);
    const anomaly = latencyMs > threshold;
    const anomalyReason = anomaly
      ? `${span.metric} exceeded threshold: actual=${latencyMs}ms threshold=${threshold}ms`
      : null;

    return {
      cause: span.cause,
      effect: span.effect,
      metric: span.metric,
      latencyMs,
      anomaly,
      anomalyReason,
    };
  });
}

/**
 * Compute confidence level deterministically from data completeness.
 * Uses the codebase enum ("high"|"medium"|"low") — not statistical intervals.
 * (Athena AC11 resolved)
 *
 * Rules:
 *   high:   All 5 canonical events present AND sloRecord provided.
 *   medium: 3–4 canonical events present OR sloRecord absent.
 *   low:    ≤2 canonical events present OR pipelineProgress null.
 */
function computeConfidence(canonicalEvents, sloRecord, pipelineProgress) {
  const presentCount = canonicalEvents.filter(e => e.present).length;
  const missingFields = canonicalEvents
    .filter(e => !e.present)
    .map(e => `canonicalEvents.${e.name}`);

  if (pipelineProgress === null) {
    if (sloRecord === null) missingFields.push("sloRecord");
    return {
      level: CONFIDENCE_LEVEL.LOW,
      reason: "pipelineProgress not available",
      missingFields,
    };
  }

  if (sloRecord === null) {
    missingFields.push("sloRecord");
  }

  if (presentCount >= 5 && sloRecord !== null) {
    return { level: CONFIDENCE_LEVEL.HIGH, reason: "all canonical events present", missingFields };
  }
  if (presentCount >= 3) {
    return {
      level: CONFIDENCE_LEVEL.MEDIUM,
      reason: sloRecord === null
        ? `${presentCount}/5 canonical events present; sloRecord absent`
        : `${presentCount}/5 canonical events present`,
      missingFields,
    };
  }
  return {
    level: CONFIDENCE_LEVEL.LOW,
    reason: `only ${presentCount}/5 canonical events present`,
    missingFields,
  };
}

function normalizeCapabilityExecutionSummary(summary: unknown) {
  const src = summary && typeof summary === "object" ? summary as Record<string, unknown> : {};
  const observedCapabilities = Array.isArray(src.observedCapabilities)
    ? [...new Set(src.observedCapabilities.map((id) => String(id || "").trim().toLowerCase()).filter(Boolean))]
    : [];
  const observedCapabilityCountRaw = Number(src.observedCapabilityCount);
  const observedCapabilityCount = Number.isFinite(observedCapabilityCountRaw) && observedCapabilityCountRaw >= 0
    ? Math.floor(observedCapabilityCountRaw)
    : observedCapabilities.length;
  const freshnessWindowMsRaw = Number(src.freshnessWindowMs);
  const freshnessWindowMs = Number.isFinite(freshnessWindowMsRaw) && freshnessWindowMsRaw > 0
    ? Math.floor(freshnessWindowMsRaw)
    : null;
  const recentTraces = Array.isArray(src.recentTraces) ? src.recentTraces : [];
  // Build role breakdown from structured trace fields (traces written by updated recordCapabilityExecution)
  const roleBreakdown: Record<string, number> = {};
  for (const trace of recentTraces) {
    const r = typeof (trace as any)?.role === "string" ? (trace as any).role.trim() : null;
    if (r) roleBreakdown[r] = (roleBreakdown[r] || 0) + 1;
  }
  return {
    freshnessWindowMs,
    observedCapabilityCount,
    observedCapabilities,
    lastObservedAt: typeof src.lastObservedAt === "string" ? src.lastObservedAt : null,
    roleBreakdown: Object.keys(roleBreakdown).length > 0 ? roleBreakdown : undefined,
  };
}

function applyCapabilityExecutionConfidenceGate(
  confidence: any,
  capabilityExecutionSummary: any,
  enforceRuntimeEvidence: boolean,
) {
  const base = confidence && typeof confidence === "object"
    ? {
      level: String(confidence.level || CONFIDENCE_LEVEL.LOW),
      reason: String(confidence.reason || ""),
      missingFields: Array.isArray(confidence.missingFields) ? [...confidence.missingFields] : [],
    }
    : {
      level: CONFIDENCE_LEVEL.LOW,
      reason: "confidence unavailable",
      missingFields: [],
    };
  if (!enforceRuntimeEvidence) return base;
  const observedCount = Number(capabilityExecutionSummary?.observedCapabilityCount || 0);
  if (observedCount > 0) return base;
  if (!base.missingFields.includes("capabilityExecutionSummary.observedCapabilityCount")) {
    base.missingFields.push("capabilityExecutionSummary.observedCapabilityCount");
  }
  if (base.level === CONFIDENCE_LEVEL.HIGH) {
    return {
      ...base,
      level: CONFIDENCE_LEVEL.MEDIUM,
      reason: `${base.reason}; runtime capability evidence absent`,
    };
  }
  return base;
}

/**
 * Derive outcome status from workerResults and planCount.
 * Handles null inputs explicitly (missing data sentinel = null, not 0).
 */
function computeOutcomeStatus(phase, workerResults, planCount) {
  if (phase === CYCLE_PHASE.INCOMPLETE) {
    // Distinguish specific incomplete reasons
    if (planCount === 0) return CYCLE_OUTCOME_STATUS.NO_PLANS;
    return CYCLE_OUTCOME_STATUS.UNKNOWN;
  }
  if (phase === CYCLE_PHASE.FAILED) return CYCLE_OUTCOME_STATUS.FAILED;

  if (!Array.isArray(workerResults) || workerResults.length === 0) {
    return CYCLE_OUTCOME_STATUS.UNKNOWN;
  }

  const failed = workerResults.filter(w => w.status === "error" || w.status === "failed").length;
  const done = workerResults.filter(w => isAnalyticsCompletedWorkerStatus(w.status)).length;
  const partial = workerResults.filter(w => w.status === "partial").length;
  const hasDispatch = typeof planCount === "number" && planCount > 0;

  if (hasDispatch && done === 0) {
    if (partial > 0) return CYCLE_OUTCOME_STATUS.PARTIAL;
    if (failed > 0) return CYCLE_OUTCOME_STATUS.FAILED;
    return CYCLE_OUTCOME_STATUS.UNKNOWN;
  }
  if (failed === 0 && partial === 0 && done > 0) return CYCLE_OUTCOME_STATUS.SUCCESS;
  if (done > 0) return CYCLE_OUTCOME_STATUS.PARTIAL;
  return CYCLE_OUTCOME_STATUS.FAILED;
}

// ── Intervention Impact Counters ─────────────────────────────────────────────

/**
 * Build a compact counters summary from an optimizer usage record.
 * Surfaces `failureClassificationsApplied` and any other optimizer signals
 * so that cycle_analytics consumers can track failure-driven adjustments
 * without needing to parse the full optimizerUsage payload.
 *
 * Returns null when optimizerUsage is not available.
 */
function buildInterventionImpactCounters(optimizerUsage: any): Record<string, number> | null {
  if (!optimizerUsage || typeof optimizerUsage !== "object") return null;
  const counters: Record<string, number> = {};
  // Field names must match the keys in runInterventionOptimizer's return value
  // and in the optimizerUsage object captured by the orchestrator.
  const fields = [
    "failureClassificationsApplied",
    "rerouteCostPenaltiesApplied",
    "benchmarkBoostsApplied",
    "policyImpactPenaltiesApplied",
  ] as const;
  for (const field of fields) {
    const v = (optimizerUsage as any)[field];
    if (typeof v === "number") counters[field] = v;
  }
  return Object.keys(counters).length > 0 ? counters : null;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Compute a cycle analytics record from available inputs.
 * Pure function — no file I/O. All inputs may be null (missing data handled explicitly).
 *
 * @param {object} config
 * @param {object} opts
 * @param {object|null} opts.sloRecord              Output of computeCycleSLOs(). May be null.
 * @param {object|null} opts.pipelineProgress        pipeline_progress.json content. May be null.
 * @param {Array|null}  opts.workerResults           [{roleName, status}] per dispatched worker. May be null.
 * @param {number|null} opts.planCount               Total plans dispatched this cycle. May be null.
 * @param {string}      opts.phase                   CYCLE_PHASE value.
 * @param {object|null} opts.parserBaselineRecovery  Output of computeBaselineRecoveryState(). May be null.
 * @param {object|null} opts.funnelCounts            Prometheus→Athena→Dispatch→Complete funnel. May be null.
 * @param {number|null} opts.funnelCounts.generated  Plans produced by Prometheus.
 * @param {number|null} opts.funnelCounts.approved   Plans approved by Athena (before quality/freeze gate).
 * @param {number|null} opts.funnelCounts.dispatched Plans actually dispatched (after all gates).
 * @param {number|null} opts.funnelCounts.completed  Plans completed successfully.
 * @param {Array}       opts.stageTransitions        Per-packet stage transition records from
 *                                                   PLANNING_STAGE_TRANSITION span events.
 *                                                   Each entry: {taskId,stageFrom,stageTo,durationMs,spanId}.
 * @param {Array}       opts.dropReasons             Task drop summaries from PLANNING_TASK_DROPPED
 *                                                   span events.
 *                                                   Each entry: {taskId,stageWhenDropped,reason,dropCode,spanId}.
 * @param {object|null} opts.tierCounts              Per-tier dispatch counts for this cycle.
 *                                                   Shape: { T1: number|null, T2: number|null, T3: number|null }.
 *                                                   T1 = routine, T2 = medium, T3 = architectural.
 *                                                   null when not tracked by the caller.
 * @param {object|null} opts.fastPathCounts          Athena plan-review fast-path counts for this cycle.
 *                                                   Shape: { athenaAutoApproved: number|null, athenaFullReview: number|null,
 *                                                            autoApproveReasonCode?: string|null }.
 *                                                   fastPathRate is derived from the two counts.
 *                                                   autoApproveReasonCode (one of LOW_RISK_UNCHANGED,
 *                                                   HIGH_QUALITY_LOW_RISK, DELTA_REVIEW_APPROVED) enables
 *                                                   per-code breakdown in byReasonCode for utilization tracking.
 *                                                   null when not tracked by the caller.
 * @param {string|null} opts.dispatchBlockReason    Governance block reason when cycle exits early. null on normal cycles.
 * @returns {object} Analytics record conforming to CYCLE_ANALYTICS_SCHEMA.cycleRecord.
 */
export function computeCycleAnalytics(config, {
  sloRecord = null,
  pipelineProgress = null,
  workerResults = null,
  planCount = null,
  phase = CYCLE_PHASE.COMPLETED,
  prometheusAnalysis = null,
  athenaPlanReview = null,
  parserBaselineRecovery = null,
  optimizerUsage = null,
  funnelCounts = null,
  tierCounts = null,
  fastPathCounts = null,
  stageTransitions = [],
  dropReasons = [],
  premiumUsageLog = [],
  dispatchBlockReason = null,
  lineageLog = [],
  memoryHitLog = [],
  premiumEfficiencyRaw = null,
  premiumEfficiencyAdjusted = null,
  rawPremiumEfficiency = null,
  executionAdjustedPremiumEfficiency = null,
  capabilityExecutionSummary = null,
  benchmarkGroundTruth = null,
  // ── Violation feedback inputs ─────────────────────────────────────────────
  // Passed by the orchestrator after the dispatch loop so that per-cycle
  // retry/violation/reroute pressure is persisted alongside other KPIs.
  retryCount = 0,
  contractViolationCounters = null,
  rerouteMetrics = null,
}: any = {}) {
  const missingData = [];
  const stageTimestamps = pipelineProgress?.stageTimestamps || null;

  if (pipelineProgress === null) {
    missingData.push({
      field: "pipelineProgress",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }
  if (sloRecord === null) {
    missingData.push({
      field: "sloRecord",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }

  // Canonical events inventory
  const canonicalEvents = buildCanonicalEvents(stageTimestamps);

  // Causal links (deterministic, SLO-span aligned)
  const causalLinks = buildCausalLinks(config, stageTimestamps, missingData);

  // Sanitize worker results: strip any extra EvidenceEnvelope fields so that
  // only {roleName, status} can influence outcome computation.
  const safeWorkerResults = Array.isArray(workerResults)
    ? workerResults.map(sanitizeWorkerResult)
    : workerResults;

  // KPIs — reference sloRecord for latency values; do NOT duplicate raw breach records.
  // toFiniteNumberOrNull guards against non-numeric values if sloRecord schema evolves.
  const kpis = {
    decisionLatencyMs: toFiniteNumberOrNull(sloRecord?.metrics?.decisionLatencyMs),
    dispatchLatencyMs: toFiniteNumberOrNull(sloRecord?.metrics?.dispatchLatencyMs),
    verificationCompletionMs: toFiniteNumberOrNull(sloRecord?.metrics?.verificationCompletionMs),
    // Sub-metrics splitting verificationCompletionMs for finer latency attribution.
    workerExecutionMs: toFiniteNumberOrNull(sloRecord?.metrics?.workerExecutionMs),
    verificationGateMs: toFiniteNumberOrNull(sloRecord?.metrics?.verificationGateMs),
    replayEvidenceMs: toFiniteNumberOrNull(sloRecord?.metrics?.replayEvidenceMs),
    systemHealthScore: null,   // populated externally if self-improvement ran
    sloBreachCount: Array.isArray(sloRecord?.sloBreaches) ? sloRecord.sloBreaches.length : 0,
    sloStatus: sloRecord?.status ?? "unknown",
    // Premium efficiency variants — both are null when not yet evaluated (advisory path).
    // premiumEfficiencyRaw: successfulPremiumEvents / settledPremiumEvents (backward-compat API success rate).
    // premiumEfficiencyAdjusted: (leadershipSuccesses + verifiedDoneWorkers) / settledPremiumEvents (backward-compat).
    // rawPremiumEfficiency: verifiedDoneWorkers / allCyclePremiumRequests (new output-quality metric).
    // executionAdjustedPremiumEfficiency: verifiedDoneWorkers / (allCyclePremiumRequests - leadershipRequests) (new).
    premiumEfficiencyRaw: toFiniteNumberOrNull(premiumEfficiencyRaw),
    premiumEfficiencyAdjusted: toFiniteNumberOrNull(premiumEfficiencyAdjusted),
    rawPremiumEfficiency: toFiniteNumberOrNull(rawPremiumEfficiency),
    executionAdjustedPremiumEfficiency: toFiniteNumberOrNull(executionAdjustedPremiumEfficiency),
  };

  if (sloRecord === null) {
    // Already noted in missingData above; no silent zero-fill for latency fields
    missingData.push(
      { field: "kpis.decisionLatencyMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
      { field: "kpis.dispatchLatencyMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
      { field: "kpis.verificationCompletionMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
      { field: "kpis.workerExecutionMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
      { field: "kpis.verificationGateMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
    );
  }

  // Outcomes
  const tasksDispatched = planCount !== null ? planCount : null;
  const tasksCompleted = Array.isArray(safeWorkerResults)
    ? safeWorkerResults.filter(w => isAnalyticsCompletedWorkerStatus(w.status)).length
    : null;
  const tasksFailed = Array.isArray(safeWorkerResults)
    ? safeWorkerResults.filter(w => w.status === "error" || w.status === "failed").length
    : null;

  if (planCount === null) {
    missingData.push({
      field: "outcomes.tasksDispatched",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.OUTCOME,
    });
  }

  if (!Array.isArray(safeWorkerResults)) {
    missingData.push(
      { field: "outcomes.tasksCompleted", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.OUTCOME },
      { field: "outcomes.tasksFailed",    reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.OUTCOME },
    );
  }

  const outcomeStatus = computeOutcomeStatus(phase, safeWorkerResults, planCount);

  // Confidence (deterministic, not statistical)
  const normalizedCapabilityExecutionSummary =
    capabilityExecutionSummary === null || capabilityExecutionSummary === undefined
      ? null
      : normalizeCapabilityExecutionSummary(capabilityExecutionSummary);
  const confidence = applyCapabilityExecutionConfidenceGate(
    computeConfidence(canonicalEvents, sloRecord, pipelineProgress),
    normalizedCapabilityExecutionSummary,
    normalizedCapabilityExecutionSummary !== null,
  );
  const runtimeContractProbe = computeRuntimeContractProbe({
    prometheusAnalysis,
    athenaPlanReview,
    workerResults,
  });

  // ── Seam contract binding: SUCCESS cannot be produced without worker verification evidence ──
  // Gates specifically on the done-worker verification evidence criterion (not the full probe)
  // because prometheus/athena signals are not required in all execution paths (e.g. headless
  // or test invocations). The invariant enforced here is: "if done workers exist but none
  // produced a VERIFICATION_REPORT, the cycle cannot be SUCCESS-shaped."
  // PARTIAL and FAILED are preserved unchanged. Cycles with no workers (null) are not gated.
  const seamContractSatisfied = runtimeContractProbe.criteria.doneWorkerWithVerificationReportEvidence.pass;

  // ── Dispatch-block fail-close binding ────────────────────────────────────────
  // When blocked workers exist but lack explicit dispatchBlockReason, the cycle
  // cannot be SUCCESS or PARTIAL-shaped — it must carry an explicit remediation
  // state so that the root cause is observable and actionable.
  // Prometheus/Athena signal absence is NOT a dispatch-block condition (those
  // signals are optional in headless and test invocations).
  const dispatchBlockPass = runtimeContractProbe.criteria.dispatchBlockReasonOutcomes.pass;

  // Compute the failing dispatch-block criteria for machine-readable metadata.
  const dispatchFailingCriteria: string[] = [];
  if (!dispatchBlockPass) dispatchFailingCriteria.push("dispatchBlockReasonOutcomes");
  if (!seamContractSatisfied) dispatchFailingCriteria.push("doneWorkerWithVerificationReportEvidence");

  let boundOutcomeStatus: string;
  let probeFailureRemediation: null | {
    blockedBy: string[];
    remediationActions: string[];
    detectedAt: string;
  } = null;

  if (!dispatchBlockPass && (
    outcomeStatus === CYCLE_OUTCOME_STATUS.SUCCESS ||
    outcomeStatus === CYCLE_OUTCOME_STATUS.PARTIAL
  )) {
    // Blocked workers without explicit reasons: force dispatch-block remediation state.
    boundOutcomeStatus = CYCLE_OUTCOME_STATUS.DISPATCH_BLOCK_REMEDIATION;
    probeFailureRemediation = {
      blockedBy: dispatchFailingCriteria,
      remediationActions: dispatchFailingCriteria.map((criterion) => {
        switch (criterion) {
          case "dispatchBlockReasonOutcomes":
            return "ensure all blocked workers carry an explicit dispatchBlockReason";
          case "doneWorkerWithVerificationReportEvidence":
            return "ensure at least one done worker includes a ===VERIFICATION_REPORT=== block";
          default:
            return `remediate failing criterion: ${criterion}`;
        }
      }),
      detectedAt: new Date().toISOString(),
    };
  } else if (outcomeStatus === CYCLE_OUTCOME_STATUS.SUCCESS && !seamContractSatisfied) {
    // Seam-only: done workers exist but none produced VERIFICATION_REPORT — degrade to PARTIAL.
    boundOutcomeStatus = CYCLE_OUTCOME_STATUS.PARTIAL;
  } else {
    boundOutcomeStatus = outcomeStatus;
  }

  const outcomes = {
    tasksDispatched,
    tasksCompleted,
    tasksFailed,
    athenaApproved: pipelineProgress
      ? !!(stageTimestamps?.athena_approved)
      : null,
    selfImprovementRan: null,  // set externally after self-improvement cycle
    status: boundOutcomeStatus,
    seamContractSatisfied,
    // Populated when the full runtimeContractProbe failed and the outcome was
    // forced to DISPATCH_BLOCK_REMEDIATION.  null in all other cases.
    probeFailureRemediation,
    // Governance block reason when the cycle exited early at a gate. null for normal cycles.
    dispatchBlockReason: typeof dispatchBlockReason === "string" && dispatchBlockReason.trim()
      ? dispatchBlockReason.trim()
      : null,
    dispatchBlock: parseDispatchBlockReasonContract(dispatchBlockReason),
  };

  // Explicit reason code when outcome status is UNKNOWN (no silent ambiguity).
  if (boundOutcomeStatus === CYCLE_OUTCOME_STATUS.UNKNOWN) {
    const unknownReason = !Array.isArray(safeWorkerResults)
      ? "workerResults not provided"
      : (safeWorkerResults.length === 0
          ? "no worker results recorded"
          : "unrecognized worker status values");
    missingData.push({
      field: "outcomes.status",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.OUTCOME,
      unknownReason,
    });
  }
  const structuralAnalytics = {
    doneWorkerVerificationEvidenceCount: Array.isArray(workerResults)
      ? workerResults.filter((item) => {
        if (!item || typeof item !== "object") return false;
        const row = item as Record<string, unknown>;
        const status = String(row.status || "").toLowerCase();
        if (status !== "done" && status !== "success") return false;
        const dispatchContract = row.dispatchContract && typeof row.dispatchContract === "object"
          ? row.dispatchContract as Record<string, unknown>
          : null;
        if (dispatchContract?.doneWorkerWithVerificationReportEvidence === true) return true;
        const evidence = String(row.verificationEvidence || row.verificationReport || row.fullOutput || "");
        return hasVerificationReportEvidence(evidence);
      }).length
      : null,
    doneWorkerCleanTreeEvidenceCount: countDoneWorkersWithCleanTreeEvidence(workerResults),
    blockedWorkerWithReasonCount: countBlockedWorkersWithReason(workerResults),
  };
  const laneTelemetry = computeLaneTelemetry(safeWorkerResults as Array<{ roleName: string; status: string }> | null);

  const cycleId = pipelineProgress?.startedAt ?? sloRecord?.cycleId ?? null;

  // ── Funnel: Prometheus→Athena→Dispatch→Complete counts and conversion rates ──
  // Rates are null when the denominator stage count is absent (no silent zero-fill).
  const rawGenerated  = (funnelCounts && typeof funnelCounts.generated  === "number") ? funnelCounts.generated  : null;
  const rawApproved   = (funnelCounts && typeof funnelCounts.approved   === "number") ? funnelCounts.approved   : null;
  const rawDispatched = (funnelCounts && typeof funnelCounts.dispatched === "number") ? funnelCounts.dispatched : null;
  const rawCompleted  = (funnelCounts && typeof funnelCounts.completed  === "number") ? funnelCounts.completed  : null;

  const funnel = {
    generated:      rawGenerated,
    approved:       rawApproved,
    dispatched:     rawDispatched,
    completed:      rawCompleted,
    approvalRate:   safeRatio(rawApproved,   rawGenerated),
    dispatchRate:   safeRatio(rawDispatched, rawApproved),
    completionRate: safeRatio(rawCompleted,  rawDispatched),
  };

  // ── Tier counts: T1/T2/T3 dispatch distribution ───────────────────────────
  // null when not provided by caller — missing data sentinel follows AC3.
  const rawT1 = (tierCounts && typeof tierCounts.T1 === "number") ? tierCounts.T1 : null;
  const rawT2 = (tierCounts && typeof tierCounts.T2 === "number") ? tierCounts.T2 : null;
  const rawT3 = (tierCounts && typeof tierCounts.T3 === "number") ? tierCounts.T3 : null;
  const tierCountsRecord = { T1: rawT1, T2: rawT2, T3: rawT3 };

  if (tierCounts === null || tierCounts === undefined) {
    missingData.push({
      field: "tierCounts",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }

  // ── Fast-path counts: Athena auto-approve vs full-review ──────────────────
  // fastPathRate is derived from the two counts; null when either is absent.
  // autoApproveReasonCode populates byReasonCode for per-path utilization tracking.
  // gateBlockRiskAtApproval tracks the governance gate state at time of auto-approve.
  const rawAutoApproved = (fastPathCounts && typeof fastPathCounts.athenaAutoApproved === "number") ? fastPathCounts.athenaAutoApproved : null;
  const rawFullReview   = (fastPathCounts && typeof fastPathCounts.athenaFullReview   === "number") ? fastPathCounts.athenaFullReview   : null;
  const totalReviews = (rawAutoApproved !== null && rawFullReview !== null)
    ? rawAutoApproved + rawFullReview
    : null;
  const rawReasonCode = (fastPathCounts && typeof fastPathCounts.autoApproveReasonCode === "string")
    ? fastPathCounts.autoApproveReasonCode
    : null;
  const rawGateBlockRisk = (fastPathCounts && typeof fastPathCounts.gateBlockRiskAtApproval === "string")
    ? fastPathCounts.gateBlockRiskAtApproval
    : null;
  const KNOWN_FAST_PATH_CODES = ["LOW_RISK_UNCHANGED", "HIGH_QUALITY_LOW_RISK", "DELTA_REVIEW_APPROVED"];
  const KNOWN_GATE_RISKS = ["low", "medium", "high"];
  const byReasonCode: Record<string, number | null> = {
    LOW_RISK_UNCHANGED:    null,
    HIGH_QUALITY_LOW_RISK: null,
    DELTA_REVIEW_APPROVED: null,
  };
  if (rawReasonCode !== null && KNOWN_FAST_PATH_CODES.includes(rawReasonCode) && rawAutoApproved !== null) {
    byReasonCode[rawReasonCode] = rawAutoApproved;
  }
  const fastPathCountsRecord = {
    athenaAutoApproved: rawAutoApproved,
    athenaFullReview:   rawFullReview,
    fastPathRate:       safeRatio(rawAutoApproved, totalReviews),
    byReasonCode,
    // Gate-feasibility risk at the time of auto-approve decision.
    // "low" indicates gate was clear; "medium"/"high" should not occur (fast path
    // is blocked when requiresCorrection=true) but is recorded for observability.
    gateBlockRiskAtApproval: (rawGateBlockRisk !== null && KNOWN_GATE_RISKS.includes(rawGateBlockRisk))
      ? rawGateBlockRisk
      : null,
  };

  if (fastPathCounts === null || fastPathCounts === undefined) {
    missingData.push({
      field: "fastPathCounts",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }

  // ── Cycle-truth contract: null canonical events require an explicit terminal block reason ──
  // When phase=COMPLETED but canonical events are missing, we classify the exit reason
  // so the record is always either fully covered (all events present) or explicitly annotated.
  // This prevents silent null-event persistence that makes postmortems inconclusive.
  const missingCanonicalEventCount = canonicalEvents.filter(e => !e.present).length;
  let nullEventsTerminalBlockReason: string | null = null;
  if (missingCanonicalEventCount > 0 && phase === CYCLE_PHASE.COMPLETED) {
    const blockReason = typeof outcomes.dispatchBlockReason === "string" && outcomes.dispatchBlockReason.trim()
      ? outcomes.dispatchBlockReason.trim()
      : null;
    if (blockReason) {
      const blockContract = parseDispatchBlockReasonContract(blockReason);
      const code = String(blockContract?.code || "").toLowerCase();
      nullEventsTerminalBlockReason = (
        code.includes("governance")
        || code.includes("freeze")
        || code === DISPATCH_BLOCK_REASON_CODE.GUARDRAIL_PAUSE_WORKERS_ACTIVE
        || code === DISPATCH_BLOCK_REASON_CODE.GUARDRAIL_FORCE_CHECKPOINT_ACTIVE
      )
        ? CYCLE_TRUTH_TERMINAL_BLOCK_REASON.GOVERNANCE_BLOCKED
        : CYCLE_TRUTH_TERMINAL_BLOCK_REASON.DISPATCH_BLOCKED;
    } else if (boundOutcomeStatus === CYCLE_OUTCOME_STATUS.NO_PLANS) {
      nullEventsTerminalBlockReason = CYCLE_TRUTH_TERMINAL_BLOCK_REASON.NO_PLANS_GENERATED;
    } else if (boundOutcomeStatus === CYCLE_OUTCOME_STATUS.REJECTED) {
      nullEventsTerminalBlockReason = CYCLE_TRUTH_TERMINAL_BLOCK_REASON.PLAN_NOT_APPROVED;
    } else {
      nullEventsTerminalBlockReason = CYCLE_TRUTH_TERMINAL_BLOCK_REASON.UNSPECIFIED_EARLY_EXIT;
    }
  }

  const cycleTruthContract = {
    missingCanonicalEventCount,
    nullEventsTerminalBlockReason,
    // isFullyCovered: true when the record is either fully event-sourced or has an
    // explicit terminal block reason — false is a data-quality signal for postmortems.
    isFullyCovered: missingCanonicalEventCount === 0 || nullEventsTerminalBlockReason !== null,
  };

  // ── Violation feedback: aggregate retry/violation/reroute into planning signal ──
  // Normalized from the caller-supplied counters so Prometheus can read prior-cycle
  // pressure directly from cycle_analytics.json rather than re-aggregating raw logs.
  const safeRetryCount = typeof retryCount === "number" && retryCount >= 0 ? Math.floor(retryCount) : 0;
  const closureBoundaryViolations = typeof contractViolationCounters?.closureBoundaryViolations === "number"
    ? Math.floor(contractViolationCounters.closureBoundaryViolations)
    : 0;
  const hookTelemetryViolations = typeof contractViolationCounters?.hookTelemetryViolations === "number"
    ? Math.floor(contractViolationCounters.hookTelemetryViolations)
    : 0;
  const dispatchBlockedWorkers = typeof contractViolationCounters?.dispatchBlockedWorkers === "number"
    ? Math.floor(contractViolationCounters.dispatchBlockedWorkers)
    : 0;
  const specialistRerouteCount = typeof rerouteMetrics?.specialistRerouteCount === "number"
    ? Math.floor(rerouteMetrics.specialistRerouteCount)
    : 0;
  const reroutedRoles = Array.isArray(rerouteMetrics?.reroutedRoles)
    ? rerouteMetrics.reroutedRoles.map(String)
    : [];

  const dispatched = typeof funnelCounts?.dispatched === "number" && funnelCounts.dispatched > 0
    ? funnelCounts.dispatched
    : null;
  const totalViolations = closureBoundaryViolations + hookTelemetryViolations;

  const violationFeedback: ViolationFeedback = {
    retryCount:               safeRetryCount,
    closureBoundaryViolations,
    hookTelemetryViolations,
    dispatchBlockedWorkers,
    specialistRerouteCount,
    reroutedRoles,
    retryRate:               dispatched !== null ? Math.round((safeRetryCount / dispatched) * 1000) / 1000 : null,
    contractViolationRate:   dispatched !== null ? Math.round((totalViolations / dispatched) * 1000) / 1000 : null,
    rerouteRate:             dispatched !== null ? Math.round((specialistRerouteCount / dispatched) * 1000) / 1000 : null,
  };

  return {
    cycleId,
    generatedAt: new Date().toISOString(),
    phase,
    outcomes,
    kpis,
    funnel,
    tierCounts: tierCountsRecord,
    fastPathCounts: fastPathCountsRecord,
    confidence,
    causalLinks,
    canonicalEvents,
    missingData,
    runtimeContractProbe,
    cycleTruthContract,
    structuralAnalytics,
    laneTelemetry,
    optimizerUsage: optimizerUsage ?? null,
    interventionImpactCounters: buildInterventionImpactCounters(optimizerUsage),
    parserBaselineRecovery: parserBaselineRecovery ?? null,
    stageTransitions: Array.isArray(stageTransitions) ? stageTransitions : [],
    dropReasons:      Array.isArray(dropReasons) ? dropReasons : [],
    modelRoutingTelemetry: buildModelRoutingTelemetry(premiumUsageLog ?? [], lineageLog ?? []),
    capabilityExecutionSummary: normalizedCapabilityExecutionSummary,
    lineageSummary: buildLineageSummary(lineageLog ?? []),
    memoryHitTelemetry: buildMemoryHitTelemetry(memoryHitLog ?? []),
    routingROISummary: buildRoutingROISummary(premiumUsageLog ?? [], lineageLog ?? []),
    benchmarkAnalytics: benchmarkGroundTruth != null
      ? computeBenchmarkIntegrityScore(benchmarkGroundTruth)
      : null,
    violationFeedback,
  };
}

/**
 * Minimum number of usable samples required for a task-kind's telemetry to be
 * trusted by the expected-value routing logic.  Below this threshold the
 * ranker falls back to the original model order deterministically rather than
 * acting on statistically unreliable data (e.g. a single-sample 100 % or 0 %
 * success rate).
 *
 * Consumers: rankModelsByTaskKindExpectedValue in model_policy.ts.
 */
export { MIN_TELEMETRY_SAMPLE_THRESHOLD } from "./telemetry_thresholds.js";

/**
 * Aggregate per-task-kind model outcome telemetry from the premium usage log.
 *
 * Each entry in premiumUsageLog is expected to have the shape:
 *   { model: string, taskKind: string, outcome: "done"|"partial"|"blocked"|"error" }
 *
 * Returns an empty invariant { byTaskKind: {}, sampleCount: 0 } when the log is empty or
 * has no usable entries — never returns null so callers can safely read .byTaskKind.
 * Returns { byTaskKind, sampleCount } when data is present.
 *
 * Shape of byTaskKind:
 *   {
 *     [taskKind]: {
 *       sampleCount: number,          // usable entries for this task kind
 *       default: { successProbability, capacityImpact, requestCost },
 *       models: {
 *         [modelName]: { successProbability, capacityImpact, requestCost }
 *       }
 *     }
 *   }
 */
export function buildModelRoutingTelemetry(
  premiumUsageLog: unknown[],
  lineageLog: unknown[] = [],
): {
  byTaskKind: Record<string, {
    sampleCount: number;
    lineageLinkedSampleCount: number;
    lineageLinkedRatio: number;
    default: { successProbability: number; capacityImpact: number; requestCost: number };
    models: Record<string, { successProbability: number; capacityImpact: number; requestCost: number }>;
  }>;
  sampleCount: number;
} {
  if (!Array.isArray(premiumUsageLog) || premiumUsageLog.length === 0) return { byTaskKind: {}, sampleCount: 0 };

  type EcoPoint = { successProbability: number; capacityImpact: number; requestCost: number };
  type Accumulator = { done: number; total: number; linked: number };
  const linkageReference = new Set<string>();
  if (Array.isArray(lineageLog)) {
    for (const entry of lineageLog) {
      if (!entry || typeof entry !== "object") continue;
      const rawId = (entry as Record<string, unknown>).id;
      const id = typeof rawId === "string" ? rawId.trim() : "";
      if (id) linkageReference.add(id);
    }
  }
  const enforceLineageReference = linkageReference.size > 0;

  // Grouped tallies: taskKind → model → { done, total }
  const byTaskKindModel: Record<string, Record<string, Accumulator>> = {};
  let usableEntries = 0;

  for (const entry of premiumUsageLog) {
    if (
      typeof entry !== "object" || entry === null
      || typeof (entry as Record<string, unknown>).taskKind !== "string"
      || typeof (entry as Record<string, unknown>).model !== "string"
      || typeof (entry as Record<string, unknown>).outcome !== "string"
    ) continue;

    const { taskKind, model, outcome } = entry as Record<string, string>;
    const normalizedModel = normalizeModelLabel(model);
    if (!taskKind || !normalizedModel) continue;
    const lineageId = typeof (entry as Record<string, unknown>).lineageId === "string"
      ? String((entry as Record<string, unknown>).lineageId).trim()
      : "";
    const linked = lineageId.length > 0 && (!enforceLineageReference || linkageReference.has(lineageId));

    byTaskKindModel[taskKind] ??= {};
    byTaskKindModel[taskKind][normalizedModel] ??= { done: 0, total: 0, linked: 0 };
    byTaskKindModel[taskKind][normalizedModel].total++;
    if (outcome === "done") byTaskKindModel[taskKind][normalizedModel].done++;
    if (linked) byTaskKindModel[taskKind][normalizedModel].linked++;
    usableEntries++;
  }

  if (usableEntries === 0) return { byTaskKind: {}, sampleCount: 0 };

  const toEcoPoint = (acc: Accumulator): EcoPoint => {
    const sp = acc.total > 0 ? acc.done / acc.total : 0;
    return { successProbability: sp, capacityImpact: sp, requestCost: 1.0 };
  };

  const resultByTaskKind: Record<string, {
    sampleCount: number;
    lineageLinkedSampleCount: number;
    lineageLinkedRatio: number;
    default: EcoPoint;
    models: Record<string, EcoPoint>;
  }> = {};

  for (const [taskKind, modelMap] of Object.entries(byTaskKindModel)) {
    const allAcc: Accumulator = { done: 0, total: 0, linked: 0 };
    const modelPoints: Record<string, EcoPoint> = {};

    for (const [modelName, acc] of Object.entries(modelMap)) {
      allAcc.done += acc.done;
      allAcc.total += acc.total;
      allAcc.linked += acc.linked;
      modelPoints[modelName] = toEcoPoint(acc);
    }

    resultByTaskKind[taskKind] = {
      sampleCount: allAcc.total,
      lineageLinkedSampleCount: allAcc.linked,
      lineageLinkedRatio: allAcc.total > 0 ? Math.round((allAcc.linked / allAcc.total) * 1000) / 1000 : 0,
      default: toEcoPoint(allAcc),
      models: modelPoints,
    };
  }

  return { byTaskKind: resultByTaskKind, sampleCount: usableEntries };
}

// ── Evaluation suite split: verified_suite vs exploratory_suite ────────────────

/**
 * Suite categories for benchmark evaluation reporting.
 * Mirrors BENCHMARK_SUITE_TYPE in model_policy.ts — kept local to avoid import coupling.
 */
export const EVALUATION_SUITE_TYPE = Object.freeze({
  VERIFIED:    "verified_suite",
  EXPLORATORY: "exploratory_suite",
});

/**
 * Split a list of normalized benchmark samples into verified_suite and
 * exploratory_suite buckets for evaluation reporting.
 *
 * A sample belongs to verified_suite when its suiteType field equals
 * EVALUATION_SUITE_TYPE.VERIFIED.  All other samples (including those with
 * normalizationErrors or unknown suiteType) fall into exploratory_suite.
 *
 * Returns a deterministic split even when samples is empty or null.
 * Never throws.
 */
export function splitEvaluationSuites(samples: unknown[]): {
  verified_suite: Array<Record<string, unknown>>;
  exploratory_suite: Array<Record<string, unknown>>;
  totalSamples: number;
  verifiedCount: number;
  exploratoryCount: number;
} {
  const safeList = Array.isArray(samples) ? samples : [];
  const verified: Array<Record<string, unknown>> = [];
  const exploratory: Array<Record<string, unknown>> = [];

  for (const raw of safeList) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      exploratory.push({ _raw: raw, suiteType: EVALUATION_SUITE_TYPE.EXPLORATORY });
      continue;
    }
    const sample = raw as Record<string, unknown>;
    const suiteType = String(sample.suiteType ?? "").trim();
    if (suiteType === EVALUATION_SUITE_TYPE.VERIFIED) {
      verified.push(sample);
    } else {
      exploratory.push(sample);
    }
  }

  return {
    verified_suite:   verified,
    exploratory_suite: exploratory,
    totalSamples:     safeList.length,
    verifiedCount:    verified.length,
    exploratoryCount: exploratory.length,
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Persist a computed cycle analytics record to state/cycle_analytics.json.
 * Maintains a rolling history capped at config.cycleAnalytics.maxHistoryEntries
 * (default: CYCLE_ANALYTICS_SCHEMA.defaultMaxHistoryEntries = 50).
 *
 * Append-only: new record is prepended; oldest entries are evicted when cap is reached.
 *
 * @param {object} config
 * @param {object} record - output of computeCycleAnalytics()
 */
export async function persistCycleAnalytics(config, record) {
  const filePath = cycleAnalyticsPath(config);
  const maxEntries = Number(
    config?.cycleAnalytics?.maxHistoryEntries
    || CYCLE_ANALYTICS_SCHEMA.defaultMaxHistoryEntries
  );

  const existing = await readJson(filePath, {
    schemaVersion: CYCLE_ANALYTICS_SCHEMA.schemaVersion,
    lastCycle: null,
    history: [],
    updatedAt: null,
  });

  const stateDir = config?.paths?.stateDir || "state";
  const runtimeCapabilityExecutionSummary = await loadCapabilityExecutionSummary({ paths: { stateDir } });
  const normalizedCapabilityExecutionSummary = normalizeCapabilityExecutionSummary(
    record?.capabilityExecutionSummary ?? runtimeCapabilityExecutionSummary,
  );
  const normalizedRecord = {
    ...record,
    capabilityExecutionSummary: normalizedCapabilityExecutionSummary,
    confidence: applyCapabilityExecutionConfidenceGate(record?.confidence, normalizedCapabilityExecutionSummary, true),
  };

  const history = Array.isArray(existing.history) ? existing.history : [];
  history.unshift(normalizedRecord);
  if (history.length > maxEntries) {
    history.length = maxEntries;
  }

  try {
    await writeJson(filePath, {
      schemaVersion: CYCLE_ANALYTICS_SCHEMA.schemaVersion,
      lastCycle: normalizedRecord,
      history,
      updatedAt: new Date().toISOString(),
    });
  } catch (writeErr) {
    // Fail-open: cycle analytics write failure must be observable, not silent.
    warn(`[cycle_analytics] persistCycleAnalytics write failed (degraded): ${String((writeErr as any)?.message || writeErr)}`);
    emitEvent(EVENTS.ORCHESTRATION_HEALTH_DEGRADED, EVENT_DOMAIN.ORCHESTRATION, "cycle_analytics_persist", {
      source: "cycle_analytics",
      ledger: "cycle_analytics.json",
      error: String((writeErr as any)?.message || writeErr),
    });
    // Re-throw so the orchestrator's wrapping try/catch can log the full context too.
    throw writeErr;
  }
}

/**
 * Read the current cycle_analytics.json snapshot.
 * Returns the parsed object or null if the file does not exist yet.
 *
 * @param {object} config
 * @returns {Promise<object|null>}
 */
export async function readCycleAnalytics(config) {
  const filePath = cycleAnalyticsPath(config);
  const data = await readJson(filePath, null);
  return data;
}

// ── Jesus outcome ledger reader ────────────────────────────────────────────────

/**
 * Read the last N entries from state/jesus_outcome_ledger.jsonl.
 *
 * Returns an empty array when the file does not exist or cannot be read.
 * Entries are returned in append order (oldest first).
 *
 * @param stateDir - path to the state directory
 * @param limit    - maximum number of records to return (default: 20)
 */
export async function readJesusOutcomeLedger(
  stateDir: string,
  limit = 20,
): Promise<Array<Record<string, unknown>>> {
  try {
    const { readFile } = await import("node:fs/promises");
    const filePath = path.join(stateDir, "jesus_outcome_ledger.jsonl");
    const raw = await readFile(filePath, "utf8");
    const lines = raw.split("\n").filter(l => l.trim().length > 0);
    const safeLimit = Math.max(1, Math.floor(Number(limit) || 20));
    return lines.slice(-safeLimit).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

// ── Wave boundary idle telemetry reader ────────────────────────────────────────

/**
 * Read the last N entries from state/wave_boundary_idle.jsonl.
 *
 * Returns an empty array when the file does not exist or cannot be read.
 * Entries are returned in append order (oldest first).
 *
 * @param stateDir - path to the state directory
 * @param limit    - maximum number of records to return (default: 50)
 */
export async function readWaveBoundaryTelemetry(
  stateDir: string,
  limit = 50,
): Promise<Array<Record<string, unknown>>> {
  try {
    const { readFile } = await import("node:fs/promises");
    const filePath = path.join(stateDir, "wave_boundary_idle.jsonl");
    const raw = await readFile(filePath, "utf8");
    const lines = raw.split("\n").filter(l => l.trim().length > 0);
    const safeLimit = Math.max(1, Math.floor(Number(limit) || 50));
    return lines.slice(-safeLimit).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}



// ── Dual analytics channels ────────────────────────────────────────────────────
//
// WHY TWO CHANNELS:
//   cycle_analytics.json  — performance/semantic channel.  Contains KPI timings,
//     funnel counts, outcomes, and confidence.  Values here change whenever the
//     metric definition or pipeline behaviour changes.
//
//   cycle_health.json     — degradation channel.  Contains ONLY threshold-relative
//     signals: SLO breach status, anomaly flags from causal links, and a derived
//     health score.  This file changes exclusively when the system is degrading —
//     not when metric semantics are updated.
//
//   Keeping the channels separate ensures that:
//     • a change in metric definition (semantic) does not look like degradation,
//     • genuine runtime degradation is always surfaced in cycle_health.json, and
//     • consumers can subscribe to cycle_health.json alone for alert routing.

/** Derived runtime health score for a cycle. */
export const HEALTH_SCORE = Object.freeze({
  /** No SLO breach and no causal-link threshold anomalies. */
  HEALTHY:  "healthy",
  /** At least one causal-link anomaly OR an SLO breach. */
  DEGRADED: "degraded",
  /** SLO status is "degraded" AND two or more causal-link anomalies. */
  CRITICAL: "critical",
});

/**
 * Canonical schema for cycle_health.json.
 *
 * This is the degradation channel.  It is written alongside cycle_analytics.json
 * and reflects only threshold-relative runtime signals — not raw latency values.
 */
export const CYCLE_HEALTH_SCHEMA = Object.freeze({
  schemaVersion: 1,
  required: ["schemaVersion", "lastCycle", "history", "updatedAt", "lastDivergence"],
  healthRecord: Object.freeze({
    required: [
      "cycleId",
      "generatedAt",
      "sloStatus",
      "sloBreachCount",
      "anomalyCount",
      "anomalies",
      "healthScore",
      "healthReason",
      "sustainedBreachSignatures",
      "coupledAlerts",
    ],
    healthScoreEnum: Object.freeze([...Object.values(HEALTH_SCORE)]),
  }),
  /** Same default cap as cycle_analytics — configurable via config.cycleAnalytics.maxHistoryEntries. */
  defaultMaxHistoryEntries: 50,
});

export interface CycleHealthDivergenceSnapshot {
  divergenceState: string;
  pipelineStatus: string;
  operationalStatus: string;
  plannerHealth: string;
  plannerTruthStatus?: string;
  isWarning: boolean;
  recordedAt: string;
}

// ── Internal path helper ──────────────────────────────────────────────────────

function cycleHealthPath(config) {
  const stateDir = config?.paths?.stateDir || "state";
  return path.join(stateDir, "cycle_health.json");
}

// ── Health-score derivation ───────────────────────────────────────────────────

function deriveHealthScore(sloStatus: string, anomalyCount: number): string {
  if (sloStatus === "degraded" && anomalyCount >= 2) return HEALTH_SCORE.CRITICAL;
  if (sloStatus === "degraded" || anomalyCount >= 1) return HEALTH_SCORE.DEGRADED;
  return HEALTH_SCORE.HEALTHY;
}

function deriveHealthReason(
  healthScore: string,
  sloStatus: string,
  anomalyCount: number,
): string {
  if (healthScore === HEALTH_SCORE.CRITICAL) {
    return `SLO status is "${sloStatus}" and ${anomalyCount} causal-link anomaly(ies) detected`;
  }
  if (healthScore === HEALTH_SCORE.DEGRADED) {
    const parts: string[] = [];
    if (sloStatus === "degraded") parts.push(`SLO status is "degraded"`);
    if (anomalyCount >= 1) parts.push(`${anomalyCount} causal-link anomaly(ies) detected`);
    return parts.join("; ");
  }
  return "all SLO checks passed and no causal-link anomalies detected";
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Extract runtime health/degradation signals from a cycle analytics record.
 *
 * Pure function — no file I/O.  The result is written to cycle_health.json via
 * persistCycleHealth() and is intentionally kept free of raw latency values so
 * that metric-semantic changes do not pollute the degradation channel.
 *
 * @param {object}   analyticsRecord           — output of computeCycleAnalytics()
 * @param {object[]} [sustainedBreachSignatures=[]] — output of detectSustainedBreachSignatures();
 *                                               included for retune provenance but not used to
 *                                               derive healthScore (SLO record already covers it)
 * @param {object[]} [coupledAlerts=[]]         — output of detectCoupledAlerts(); correlated
 *                                               multi-signal alerts (e.g. yield collapse + SLO breach)
 * @returns {object} Health record conforming to CYCLE_HEALTH_SCHEMA.healthRecord
 */
export function computeCycleHealth(analyticsRecord: any, sustainedBreachSignatures: any[] = [], coupledAlerts: any[] = []) {
  // Guard sloStatus against invalid enum values: only "ok", "degraded", "unknown"
  // are meaningful to health derivation; anything else is clamped to "unknown".
  const rawSloStatus = analyticsRecord?.kpis?.sloStatus ?? "unknown";
  const sloStatus = (typeof rawSloStatus === "string" && ALLOWED_SLO_STATUSES.has(rawSloStatus))
    ? rawSloStatus
    : "unknown";
  const sloBreachCount = typeof analyticsRecord?.kpis?.sloBreachCount === "number"
    ? analyticsRecord.kpis.sloBreachCount
    : 0;

  const causalLinks: any[] = Array.isArray(analyticsRecord?.causalLinks)
    ? analyticsRecord.causalLinks
    : [];

  const anomalies = causalLinks
    .filter(l => l.anomaly === true)
    .map(l => ({
      metric:        l.metric        ?? null,
      cause:         l.cause         ?? null,
      effect:        l.effect        ?? null,
      latencyMs:     l.latencyMs     ?? null,
      anomalyReason: l.anomalyReason ?? null,
    }));

  const anomalyCount  = anomalies.length;
  const healthScore   = deriveHealthScore(sloStatus, anomalyCount);
  const healthReason  = deriveHealthReason(healthScore, sloStatus, anomalyCount);

  // Ensure sustainedBreachSignatures is always a well-typed array in the record
  const safeSustainedSignatures = Array.isArray(sustainedBreachSignatures)
    ? sustainedBreachSignatures
    : [];

  // Ensure coupledAlerts is always a well-typed array in the record
  const safeCoupledAlerts = Array.isArray(coupledAlerts) ? coupledAlerts : [];

  return {
    cycleId:                  analyticsRecord?.cycleId  ?? null,
    generatedAt:              new Date().toISOString(),
    sloStatus,
    sloBreachCount,
    anomalyCount,
    anomalies,
    healthScore,
    healthReason,
    sustainedBreachSignatures: safeSustainedSignatures,
    coupledAlerts: safeCoupledAlerts,
  };
}

/**
 * Persist a computed cycle health record to state/cycle_health.json.
 * Maintains the same rolling-history semantics as persistCycleAnalytics.
 *
 * @param {object} config
 * @param {object} healthRecord — output of computeCycleHealth()
 */
export async function persistCycleHealth(config, healthRecord) {
  return persistCycleHealthComposite(config, { healthRecord });
}

export async function persistCycleHealthComposite(
  config,
  payload: {
    healthRecord?: Record<string, unknown> | null;
    divergenceSnapshot?: CycleHealthDivergenceSnapshot | null;
  }
) {
  const filePath  = cycleHealthPath(config);
  const maxEntries = Number(
    config?.cycleAnalytics?.maxHistoryEntries
    || CYCLE_HEALTH_SCHEMA.defaultMaxHistoryEntries,
  );

  const existing = await readJson(filePath, {
    schemaVersion: CYCLE_HEALTH_SCHEMA.schemaVersion,
    lastCycle: null,
    history: [],
    lastDivergence: null,
    divergenceState: "unknown",
    pipelineStatus: "unknown",
    operationalStatus: "unknown",
    plannerHealth: "unknown",
    plannerTruthStatus: "unknown",
    isWarning: false,
    recordedAt: null,
    updatedAt: null,
  });

  const history = Array.isArray(existing.history) ? existing.history : [];
  const nextHealthRecord = payload?.healthRecord ?? null;
  const divergenceSnapshot = payload?.divergenceSnapshot ?? null;

  if (nextHealthRecord) {
    history.unshift(nextHealthRecord);
    if (history.length > maxEntries) {
      history.length = maxEntries;
    }
  }

  const nextDivergence = divergenceSnapshot
    ? {
      divergenceState: String(divergenceSnapshot?.divergenceState || "unknown"),
      pipelineStatus: String(divergenceSnapshot?.pipelineStatus || "unknown"),
      operationalStatus: String(divergenceSnapshot?.operationalStatus || "unknown"),
      plannerHealth: String(divergenceSnapshot?.plannerHealth || "unknown"),
      plannerTruthStatus: String(divergenceSnapshot?.plannerTruthStatus || "unknown"),
      isWarning: divergenceSnapshot?.isWarning === true,
      recordedAt: String(divergenceSnapshot?.recordedAt || new Date().toISOString()),
    }
    : (existing?.lastDivergence ?? null);

  await writeJson(filePath, {
    schemaVersion: CYCLE_HEALTH_SCHEMA.schemaVersion,
    lastCycle:     nextHealthRecord ?? existing?.lastCycle ?? null,
    history,
    lastDivergence: nextDivergence,
    divergenceState: String(nextDivergence?.divergenceState || existing?.divergenceState || "unknown"),
    pipelineStatus: String(nextDivergence?.pipelineStatus || existing?.pipelineStatus || "unknown"),
    operationalStatus: String(nextDivergence?.operationalStatus || existing?.operationalStatus || "unknown"),
    plannerHealth: String(nextDivergence?.plannerHealth || existing?.plannerHealth || "unknown"),
    plannerTruthStatus: String(nextDivergence?.plannerTruthStatus || existing?.plannerTruthStatus || "unknown"),
    isWarning: nextDivergence?.isWarning === true,
    recordedAt: nextDivergence?.recordedAt || existing?.recordedAt || null,
    updatedAt:     new Date().toISOString(),
  });
}

export async function persistCycleHealthDivergence(
  config,
  divergenceSnapshot: CycleHealthDivergenceSnapshot,
) {
  return persistCycleHealthComposite(config, { divergenceSnapshot });
}

/**
 * Read the current cycle_health.json snapshot.
 * Returns the parsed object or null if the file does not exist yet.
 *
 * @param {object} config
 * @returns {Promise<object|null>}
 */
export async function readCycleHealth(config) {
  return readJson(cycleHealthPath(config), null);
}

// ── Benchmark ground-truth evaluation loop ────────────────────────────────────

/**
 * Schema descriptor for benchmark_ground_truth.json.
 * Used by callers to validate structure before reading.
 */
export const BENCHMARK_SCHEMA = Object.freeze({
  schemaVersion: 1,
  required: ["schemaVersion", "updatedAt", "entries"],
  entryRequired: ["cycleId", "evaluatedAt", "schemaVersion", "recommendations"],
  recommendationStatusEnum: Object.freeze([
    "pending", "in-progress", "implemented", "implemented_correctly", "implemented_partially", "failed", "retired",
  ]),
});

/**
 * Evaluate benchmark ground-truth entries against a cycle outcome.
 *
 * Sets `benchmarkScore` on each recommendation in the most-recent entry:
 *   1.0 — cycle succeeded (success outcome)
 *   completionRate or 0.5 — partial outcome
 *   0.0 — failed outcome
 *   null — outcome unknown / not enough data
 *
 * Returns the annotated recommendations array for the latest entry.
 * Pure function — no file I/O.
 *
 * @param benchmarkEntries — array from benchmark_ground_truth.json `entries`
 * @param cycleOutcome     — { status, tasksCompleted, tasksDispatched }
 */
export function evaluateBenchmarkGroundTruth(
  benchmarkEntries: any[],
  cycleOutcome: { status: string; tasksCompleted: number | null; tasksDispatched: number | null },
): any[] {
  if (!Array.isArray(benchmarkEntries) || benchmarkEntries.length === 0) return [];

  const latest = benchmarkEntries[0];
  if (!latest || !Array.isArray(latest.recommendations)) return [];

  const completionRate =
    typeof cycleOutcome?.tasksCompleted === "number" &&
    typeof cycleOutcome?.tasksDispatched === "number" &&
    cycleOutcome.tasksDispatched > 0
      ? cycleOutcome.tasksCompleted / cycleOutcome.tasksDispatched
      : null;

  return latest.recommendations.map((rec: any) => {
    let benchmarkScore: number | null = null;
    if (cycleOutcome?.status === "success")  benchmarkScore = 1.0;
    else if (cycleOutcome?.status === "partial") benchmarkScore = completionRate ?? 0.5;
    else if (cycleOutcome?.status === "failed")  benchmarkScore = 0.0;
    return { ...rec, benchmarkScore };
  });
}

/**
 * Compute aggregate research capacity gain across a sliding window of cycles.
 *
 * Capacity gain = average `benchmarkScore` over all scored recommendations
 *                 in the most-recent `windowCycles` entries.
 *
 * Returns null when no scored recommendations exist in the window.
 *
 * @param benchmarkEntries — array from benchmark_ground_truth.json `entries`
 * @param windowCycles     — how many recent entries to consider (default: 5)
 */
export function computeResearchCapacityGain(
  benchmarkEntries: any[],
  windowCycles = 5,
): { capacityGain: number | null; evaluatedCount: number; windowCycles: number } {
  if (!Array.isArray(benchmarkEntries) || benchmarkEntries.length === 0) {
    return { capacityGain: null, evaluatedCount: 0, windowCycles };
  }

  const window = benchmarkEntries.slice(0, Math.max(1, windowCycles));
  const scores: number[] = [];

  for (const entry of window) {
    if (!Array.isArray(entry?.recommendations)) continue;
    for (const rec of entry.recommendations) {
      if (typeof rec?.benchmarkScore === "number") {
        scores.push(rec.benchmarkScore);
      }
    }
  }

  if (scores.length === 0) return { capacityGain: null, evaluatedCount: 0, windowCycles };

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return {
    capacityGain:   Math.round(avg * 1000) / 1000,
    evaluatedCount: scores.length,
    windowCycles,
  };
}

export function summarizeBenchmarkSchemaCoverage(
  contracts: Array<{ name: string; requiredFields: string[] }>,
  samples: Array<Record<string, unknown>>,
): { totalSamples: number; validSamples: number; invalidSamples: number } {
  const contractList = Array.isArray(contracts) ? contracts : [];
  const sampleList = Array.isArray(samples) ? samples : [];
  let validSamples = 0;
  for (const sample of sampleList) {
    const benchmarkName = String((sample as any)?.benchmarkName || "").trim().toLowerCase();
    const contract = contractList.find((c) => String(c.name || "").trim().toLowerCase() === benchmarkName);
    if (!contract) continue;
    const required = Array.isArray(contract.requiredFields) ? contract.requiredFields : [];
    const isValid = required.every((field) => {
      const value = (sample as any)?.[field];
      return !(value === null || value === undefined || (typeof value === "string" && String(value).trim().length === 0));
    });
    if (isValid) validSamples += 1;
  }
  return {
    totalSamples: sampleList.length,
    validSamples,
    invalidSamples: Math.max(0, sampleList.length - validSamples),
  };
}

export function normalizeExternalBenchmarkSamples(
  samples: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const sampleList = Array.isArray(samples) ? samples : [];
  const normalized: Array<Record<string, unknown>> = [];
  for (const sample of sampleList) {
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) continue;
    const benchmarkNameRaw = String(
      (sample as any).benchmarkName
        || (sample as any).benchmark
        || (sample as any).dataset
        || ""
    ).trim().toLowerCase();
    const benchmarkName = benchmarkNameRaw === "swebench" ? "swe-bench" : benchmarkNameRaw;
    const instanceId = String(
      (sample as any).instanceId
        || (sample as any).instance_id
        || (sample as any).taskId
        || (sample as any).task_id
        || ""
    ).trim();
    const status = String(
      (sample as any).status
        || (sample as any).resolution
        || (sample as any).outcome
        || ""
    ).trim().toLowerCase();
    const normalizedEntry: Record<string, unknown> = {
      benchmarkName,
      instanceId,
      status,
    };
    if ((sample as any).repo) normalizedEntry.repo = String((sample as any).repo);
    if ((sample as any).environmentId || (sample as any).environment_id) {
      normalizedEntry.environmentId = String((sample as any).environmentId || (sample as any).environment_id);
    }
    normalized.push(normalizedEntry);
  }
  return normalized;
}

export function buildPolicyInterventionAttributionLedger(
  history: any[],
  newEntries: any[],
  opts: { evidenceWindowCycles?: number } = {},
): {
  history: any[];
  decisions: Array<{ policyId: string; mutate: boolean; reason: string; evidenceCount: number }>;
} {
  const existing = Array.isArray(history) ? history : [];
  const incoming = Array.isArray(newEntries) ? newEntries : [];
  const evidenceWindowCycles = Math.max(1, Math.floor(Number(opts.evidenceWindowCycles ?? 3)));
  const merged = [...existing, ...incoming];
  const byPolicy = new Map<string, any[]>();
  for (const entry of merged) {
    const policyId = String(entry?.policyId || "").trim();
    if (!policyId) continue;
    const list = byPolicy.get(policyId) || [];
    list.push(entry);
    byPolicy.set(policyId, list);
  }
  const decisions: Array<{ policyId: string; mutate: boolean; reason: string; evidenceCount: number }> = [];
  for (const [policyId, entries] of byPolicy.entries()) {
    const window = entries.slice(-evidenceWindowCycles);
    if (window.length < evidenceWindowCycles) {
      decisions.push({
        policyId,
        mutate: false,
        reason: "insufficient_evidence_window",
        evidenceCount: window.length,
      });
      continue;
    }
    const avgCombined = window.reduce((sum, row) => sum + Number(row?.combinedScore || 0), 0) / window.length;
    const mutate = avgCombined >= 0.55;
    decisions.push({
      policyId,
      mutate,
      reason: mutate ? "window_passed" : "combined_score_below_threshold",
      evidenceCount: window.length,
    });
  }
  return { history: merged, decisions };
}

/**
 * Summarize plan lineage provenance from a lineage event log.
 * Returns counts grouped by source kind (gap_candidate, carry_forward, novelty_seed, etc.)
 */
export function buildLineageSummary(lineageLog: unknown[]): {
  bySourceKind: Record<string, number>;
  totalEvents: number;
} {
  if (!Array.isArray(lineageLog) || lineageLog.length === 0) {
    return { bySourceKind: {}, totalEvents: 0 };
  }
  const bySourceKind: Record<string, number> = {};
  let totalEvents = 0;
  for (const entry of lineageLog) {
    if (typeof entry !== "object" || entry === null) continue;
    const kind = (entry as Record<string, unknown>).sourceKind;
    if (typeof kind !== "string" || !kind) continue;
    bySourceKind[kind] = (bySourceKind[kind] ?? 0) + 1;
    totalEvents++;
  }
  return { bySourceKind, totalEvents };
}

/**
 * Join premium usage log and lineage log entries by shared lineageId to compute
 * per-lineage-key routing ROI.
 *
 * ROI is defined as the fraction of "done" outcomes among all requests sharing
 * the same lineageId.  Entries without a lineageId are tallied separately.
 *
 * Returns:
 *   totalRequests    — total entries in premiumUsageLog
 *   linkedRequests   — entries that carry a non-null lineageId
 *   linkedRatio      — linkedRequests / totalRequests (null when totalRequests = 0)
 *   roiByLineageId   — per-key { success, total, roi } tally
 *   overallLinkedROI — done / total across all linked entries (null when none)
 */
export function buildRoutingROISummary(
  premiumUsageLog: unknown[],
  lineageLog: unknown[] = [],
): {
  totalRequests: number;
  linkedRequests: number;
  linkedRatio: number | null;
  roiByLineageId: Record<string, { success: number; total: number; roi: number }>;
  overallLinkedROI: number | null;
} {
  if (!Array.isArray(premiumUsageLog) || premiumUsageLog.length === 0) {
    return { totalRequests: 0, linkedRequests: 0, linkedRatio: null, roiByLineageId: {}, overallLinkedROI: null };
  }
  const linkageReference = new Set<string>();
  if (Array.isArray(lineageLog)) {
    for (const entry of lineageLog) {
      if (!entry || typeof entry !== "object") continue;
      const rawId = (entry as Record<string, unknown>).id;
      const id = typeof rawId === "string" ? rawId.trim() : "";
      if (id) linkageReference.add(id);
    }
  }
  const enforceLineageReference = linkageReference.size > 0;

  const byLineageId: Record<string, { success: number; total: number }> = {};
  let linkedRequests = 0;
  let linkedDone = 0;
  let linkedTotal = 0;

  for (const entry of premiumUsageLog) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const lid = typeof row.lineageId === "string" && row.lineageId ? row.lineageId : null;
    const outcome = typeof row.outcome === "string" ? row.outcome : "unknown";
    const isDone = outcome === "done";
    const linked = !!(lid && (!enforceLineageReference || linkageReference.has(lid)));

    if (linked && lid) {
      byLineageId[lid] ??= { success: 0, total: 0 };
      byLineageId[lid].total++;
      if (isDone) byLineageId[lid].success++;
      linkedRequests++;
      linkedTotal++;
      if (isDone) linkedDone++;
    }
  }

  const roiByLineageId: Record<string, { success: number; total: number; roi: number }> = {};
  for (const [lid, acc] of Object.entries(byLineageId)) {
    roiByLineageId[lid] = {
      success: acc.success,
      total: acc.total,
      roi: acc.total > 0 ? Math.round((acc.success / acc.total) * 1000) / 1000 : 0,
    };
  }

  const totalRequests = premiumUsageLog.filter(e => typeof e === "object" && e !== null).length;
  const linkedRatio = totalRequests > 0 ? Math.round((linkedRequests / totalRequests) * 1000) / 1000 : null;
  const overallLinkedROI = linkedTotal > 0 ? Math.round((linkedDone / linkedTotal) * 1000) / 1000 : null;

  return { totalRequests, linkedRequests, linkedRatio, roiByLineageId, overallLinkedROI };
}

/**
 * Summarize memory hit telemetry from a memory-hit event log.
 *
 * A "hit" is a record where `hintsInjected + lessonsInjected > 0` (at least one
 * knowledge-memory entry was injected into the prompt). Legacy records that carry
 * `outcome === "hit"` / `outcome === "miss"` are also accepted for backward
 * compatibility, but new records use the structured MemoryHitRecord shape.
 *
 * `outcomeRate` measures memory ROI: ratio of "done" worker outcomes among hit
 * records that have a resolved outcome. Zero when no resolved hits exist.
 */
export function buildMemoryHitTelemetry(memoryHitLog: unknown[]): {
  hits: number;
  misses: number;
  hitRate: number;
  sampleCount: number;
  outcomeRate: number;
} {
  if (!Array.isArray(memoryHitLog) || memoryHitLog.length === 0) {
    return { hits: 0, misses: 0, hitRate: 0, sampleCount: 0, outcomeRate: 0 };
  }
  let hits = 0;
  let misses = 0;
  let hitWithDone = 0;
  let hitResolved = 0;
  for (const entry of memoryHitLog) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    // Primary path: structured MemoryHitRecord
    if (typeof row.hintsInjected === "number" || typeof row.lessonsInjected === "number") {
      const injected = Number(row.hintsInjected || 0) + Number(row.lessonsInjected || 0);
      if (injected > 0) {
        hits++;
        // Outcome mapping: count resolved outcomes for ROI computation
        if (row.outcome !== null && row.outcome !== undefined) {
          hitResolved++;
          if (String(row.outcome).toLowerCase() === "done") hitWithDone++;
        }
      } else {
        misses++;
      }
      continue;
    }
    // Legacy path: outcome === "hit" / "miss" (pre-MemoryHitRecord entries)
    const outcome = row.outcome;
    if (outcome === "hit") hits++;
    else if (outcome === "miss") misses++;
  }
  const sampleCount = hits + misses;
  const hitRate = sampleCount > 0 ? Math.round((hits / sampleCount) * 1000) / 1000 : 0;
  const outcomeRate = hitResolved > 0 ? Math.round((hitWithDone / hitResolved) * 1000) / 1000 : 0;
  return { hits, misses, hitRate, sampleCount, outcomeRate };
}

// ── CI remediation evidence ────────────────────────────────────────────────────

/** Proof record for CI-fix remediation within a cycle. */
export interface CiRemediationEvidence {
  /** Whether a CI-fix fastlane was required this cycle. */
  required: boolean;
  /** True only when at least one ci-fix worker completed with status="done". */
  satisfied: boolean;
  /** IDs of mandatory CI-critical findings that drove the requirement. */
  findingIds: string[];
  /** Count of ci-fix workers that completed successfully. */
  completedCiFixWorkers: number;
}

/**
 * Computes CI remediation evidence for the current cycle.
 *
 * @param workerResults   Array of worker result objects from the current cycle.
 * @param mandatoryFindings  Array of health audit finding objects.
 * @returns CiRemediationEvidence record.
 */
export function computeCiRemediationStatus(
  workerResults: unknown[],
  mandatoryFindings: unknown[]
): CiRemediationEvidence {
  const findings = Array.isArray(mandatoryFindings) ? mandatoryFindings : [];
  const workers = Array.isArray(workerResults) ? workerResults : [];

  const ciFindings = findings.filter((f: any) => {
    if (!f || typeof f !== "object") return false;
    return (
      f.ciFastlaneRequired === true
      || f.capabilityNeeded === "ci-fix"
      || String(f.area || "").toLowerCase() === "ci"
    );
  });

  const required = ciFindings.length > 0;
  const findingIds = ciFindings
    .map((f: any) => String(f.findingId || f.id || ""))
    .filter(Boolean);

  const completedCiFixWorkers = workers.filter((w: any) => {
    if (!w || typeof w !== "object") return false;
    const kind = String(w.taskKind || w.kind || "").toLowerCase();
    const status = String(w.status || w.outcome || "").toLowerCase();
    return kind === "ci-fix" && status === "done";
  }).length;

  const satisfied = required && completedCiFixWorkers > 0;

  return { required, satisfied, findingIds, completedCiFixWorkers };
}

// ── Historical lane difficulty priors ─────────────────────────────────────────
// Aggregates per-lane completion rates and ROI from stored cycle analytics
// records so Prometheus can select verification depth and decomposition
// strategy on a per-lane basis before dispatching packets.

/** Per-lane difficulty signal derived from historical cycle analytics. */
export interface LaneDifficultyPrior {
  /** Fraction of dispatched workers that completed successfully (0–1). */
  completionRate: number;
  /** ROI proxy: completed / max(1, failed). Higher is better. */
  averageRoi: number;
  /** Number of historical cycles that contributed to this estimate. */
  sampleCount: number;
  /** Difficulty classification derived from completionRate. */
  difficulty: "easy" | "moderate" | "hard";
}

/**
 * Aggregate per-lane difficulty priors from an array of cycle analytics records.
 *
 * Each record is expected to carry a `laneTelemetry` field (shape produced by
 * computeLaneTelemetry inside computeCycleAnalytics).  Records missing
 * `laneTelemetry` are silently skipped.
 *
 * Difficulty thresholds:
 *   - completionRate ≥ 0.70 → easy
 *   - completionRate ≥ 0.40 → moderate
 *   - completionRate < 0.40 → hard
 *
 * Never throws — returns an empty map on any error.
 *
 * @param cycleRecords — array of analytics records (e.g. loaded from state/cycle_analytics.json)
 */
export function computeHistoricalLaneDifficultyPriors(
  cycleRecords: unknown[]
): Record<string, LaneDifficultyPrior> {
  if (!Array.isArray(cycleRecords) || cycleRecords.length === 0) return {};

  const accByLane = new Map<string, { completionRateSum: number; roiSum: number; sampleCount: number }>();

  for (const record of cycleRecords) {
    if (!record || typeof record !== "object") continue;
    const laneTelemetry = (record as any).laneTelemetry;
    if (!laneTelemetry || typeof laneTelemetry !== "object") continue;

    for (const [lane, telemetry] of Object.entries(laneTelemetry)) {
      if (!telemetry || typeof telemetry !== "object") continue;
      const t = telemetry as any;
      const completionRate = typeof t.completionRate === "number" ? t.completionRate : 0;
      const roi = typeof t.roi === "number" ? t.roi : 0;

      const current = accByLane.get(lane) ?? { completionRateSum: 0, roiSum: 0, sampleCount: 0 };
      current.completionRateSum += completionRate;
      current.roiSum += roi;
      current.sampleCount += 1;
      accByLane.set(lane, current);
    }
  }

  const result: Record<string, LaneDifficultyPrior> = {};
  for (const [lane, acc] of accByLane.entries()) {
    const completionRate = Math.round((acc.completionRateSum / acc.sampleCount) * 1000) / 1000;
    const averageRoi = Math.round((acc.roiSum / acc.sampleCount) * 1000) / 1000;
    const difficulty: "easy" | "moderate" | "hard" =
      completionRate >= 0.70 ? "easy" :
      completionRate >= 0.40 ? "moderate" : "hard";

    result[lane] = { completionRate, averageRoi, sampleCount: acc.sampleCount, difficulty };
  }

  return result;
}

// ── Postmortem Recurrence Impact ─────────────────────────────────────────────

/**
 * Compute the measurable policy impact of Athena postmortem recurrence quality.
 *
 * "Recurrence" = a failure that was already the subject of a postmortem and yet
 * recurred in a subsequent cycle.  High recurrence means postmortems are not
 * translating into action.
 *
 * Decision rules:
 *   - recurrenceRate = recurrences / max(totalPostmortems, 1)
 *   - impactScore = 1 - recurrenceRate   (higher is better: 1.0 = zero recurrence)
 *   - policyRecommendation derived from threshold bands
 *
 * @param postmortems        — array of postmortem records; each may have `recurred: boolean`
 * @param recurrenceHistory  — optional explicit list of cycleIds known to have had recurrence
 */
export function computePostmortemRecurrenceImpact(
  postmortems: unknown[],
  recurrenceHistory: string[] = [],
): {
  recurrenceRate: number;
  impactScore: number;
  recurrenceCount: number;
  totalPostmortems: number;
  policyRecommendation: string;
} {
  const pms = Array.isArray(postmortems) ? postmortems : [];
  const totalPostmortems = pms.length;

  // Count recurrences from postmortem records plus explicit history (deduplicated)
  const recurredFromRecords = pms.filter(
    (pm) => pm && typeof pm === "object" && Boolean((pm as any).recurred),
  ).length;

  const explicitRecurrences = Array.isArray(recurrenceHistory) ? recurrenceHistory.length : 0;
  // Avoid double-counting: use whichever measure is higher
  const recurrenceCount = Math.max(recurredFromRecords, explicitRecurrences);

  const recurrenceRate = totalPostmortems > 0
    ? Math.round((recurrenceCount / totalPostmortems) * 10000) / 10000
    : 0;

  const impactScore = Math.round((1 - recurrenceRate) * 10000) / 10000;

  let policyRecommendation: string;
  if (recurrenceRate === 0) {
    policyRecommendation = "no_action_required: zero_recurrence";
  } else if (recurrenceRate <= 0.20) {
    policyRecommendation = "monitor: low_recurrence";
  } else if (recurrenceRate <= 0.50) {
    policyRecommendation = "review_postmortem_quality: moderate_recurrence";
  } else {
    policyRecommendation = "escalate_reflection_depth: high_recurrence";
  }

  return { recurrenceRate, impactScore, recurrenceCount, totalPostmortems, policyRecommendation };
}

