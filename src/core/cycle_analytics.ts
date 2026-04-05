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
import { readJson, writeJson } from "./fs_utils.js";
import { warn, emitEvent } from "./logger.js";
import { EVENTS, EVENT_DOMAIN } from "./event_schema.js";
import { SLO_TIMESTAMP_CONTRACT, SLO_METRIC } from "./slo_checker.js";
import { hasVerificationReportEvidence } from "./verification_gate.js";
import { hasFiniteAthenaOverallScore } from "./athena_reviewer.js";
import { hasPrometheusRuntimeContractSignals } from "./prometheus.js";
import { getLaneForWorkerName, isSpecialistLane } from "./role_registry.js";
import { isAnalyticsCompletedWorkerStatus } from "./worker_runner.js";

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

// ── Enums ──────────────────────────────────────────────────────────────────────

/** Pipeline phase at the time analytics were generated. */
export const CYCLE_PHASE = Object.freeze({
  COMPLETED: "completed",
  FAILED: "failed",
  INCOMPLETE: "incomplete",
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
});

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
      "structuralAnalytics",
      "laneTelemetry",
      "stageTransitions",
      "dropReasons",
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
    if (/CLEAN_TREE_STATUS\s*=\s*clean\b/i.test(evidence)) count += 1;
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
    if (reason) count += 1;
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
    return reason.length > 0;
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
  const passed = prometheusPass && athenaPass && workerPass && dispatchReasonPass;
  return {
    checkedAt: new Date().toISOString(),
    passed,
    criteria: {
      prometheusGeneratedAtAndKeyFindings: { pass: prometheusPass },
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
  const fields = [
    "failureClassificationsApplied",
    "rerouteReasonsApplied",
    "benchmarkAdjustmentsApplied",
    "policyOverridesApplied",
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
 *                                                   Shape: { athenaAutoApproved: number|null, athenaFullReview: number|null }.
 *                                                   fastPathRate is derived from these two values.
 *                                                   null when not tracked by the caller.
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
    systemHealthScore: null,   // populated externally if self-improvement ran
    sloBreachCount: Array.isArray(sloRecord?.sloBreaches) ? sloRecord.sloBreaches.length : 0,
    sloStatus: sloRecord?.status ?? "unknown",
  };

  if (sloRecord === null) {
    // Already noted in missingData above; no silent zero-fill for latency fields
    missingData.push(
      { field: "kpis.decisionLatencyMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
      { field: "kpis.dispatchLatencyMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
      { field: "kpis.verificationCompletionMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
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
  const confidence = computeConfidence(canonicalEvents, sloRecord, pipelineProgress);
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
  const rawAutoApproved = (fastPathCounts && typeof fastPathCounts.athenaAutoApproved === "number") ? fastPathCounts.athenaAutoApproved : null;
  const rawFullReview   = (fastPathCounts && typeof fastPathCounts.athenaFullReview   === "number") ? fastPathCounts.athenaFullReview   : null;
  const totalReviews = (rawAutoApproved !== null && rawFullReview !== null)
    ? rawAutoApproved + rawFullReview
    : null;
  const fastPathCountsRecord = {
    athenaAutoApproved: rawAutoApproved,
    athenaFullReview:   rawFullReview,
    fastPathRate:       safeRatio(rawAutoApproved, totalReviews),
  };

  if (fastPathCounts === null || fastPathCounts === undefined) {
    missingData.push({
      field: "fastPathCounts",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }

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
    structuralAnalytics,
    laneTelemetry,
    optimizerUsage: optimizerUsage ?? null,
    interventionImpactCounters: buildInterventionImpactCounters(optimizerUsage),
    parserBaselineRecovery: parserBaselineRecovery ?? null,
    stageTransitions: Array.isArray(stageTransitions) ? stageTransitions : [],
    dropReasons:      Array.isArray(dropReasons) ? dropReasons : [],
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

  const history = Array.isArray(existing.history) ? existing.history : [];
  history.unshift(record);
  if (history.length > maxEntries) {
    history.length = maxEntries;
  }

  try {
    await writeJson(filePath, {
      schemaVersion: CYCLE_ANALYTICS_SCHEMA.schemaVersion,
      lastCycle: record,
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
    "pending", "in-progress", "implemented", "failed", "retired",
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

