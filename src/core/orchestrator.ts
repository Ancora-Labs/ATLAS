/**
 * BOX Orchestrator — Athena-Gated Loop Architecture
 *
 * Flow per cycle:
 *   Jesus (orchestrator/state analyzer) → Prometheus (full scan + plan)
 *   → Athena (validate plan) → Worker(s)
 *   → back to Prometheus for next iteration
 *
 * Each agent uses exactly 1 premium request per invocation (single-prompt).
 * No autopilot. Jesus orchestrates, Prometheus plans, Athena gates.
 *
 * Startup:
 *   1. Read last checkpoint (worker_sessions.json + prometheus_analysis.json)
 *   2. If workers are active → resume monitoring, ZERO AI calls
 *   3. If no checkpoint → first run → Jesus analyzes state
 *   4. If project interrupted → Jesus decides: continue or re-plan
 */

import path from "node:path";
import fs from "node:fs/promises";
import { appendProgress, appendAlert, ALERT_SEVERITY, appendGovernanceBlockEvent, recordCapabilityExecution } from "./state_tracker.js";
import { readStopRequest, writeDaemonPid, clearDaemonPid, clearStopRequest, readReloadRequest, clearReloadRequest, createCancellationToken } from "./daemon_control.js";
import type { CancellationToken } from "./daemon_control.js";
import { loadConfig } from "../config.js";
import { runJesusCycle, appendJesusOutcomeLedger, buildJesusDecisionOutcome } from "./jesus_supervisor.js";
import { runPrometheusAnalysis, loadTopicMemory, saveTopicMemory, topicKey as prometheusTopicKey, findCanonicalTopicKey } from "./prometheus.js";
import { runAthenaPlanReview, ATHENA_PLAN_REVIEW_REASON_CODE, hasFiniteAthenaOverallScore } from "./athena_reviewer.js";
import { runWorkerConversation, isAnalyticsCompletedWorkerStatus, isTerminalWorkerStatus } from "./worker_runner.js";
import { runSelfImprovementCycle, shouldTriggerSelfImprovement } from "./self_improvement.js";
import { collectEvolutionMetrics } from "./evolution_metrics.js";
import { capturePreWorkBaseline, runProjectCompletion, isProjectAlreadyCompleted } from "./project_lifecycle.js";
import { warn, emitEvent } from "./logger.js";
import { EVENTS, EVENT_DOMAIN } from "./event_schema.js";
import { readJson, readJsonSafe, writeJson, cleanupStaleTempFiles, READ_JSON_REASON } from "./fs_utils.js";
import { updatePipelineProgress, readPipelineProgress } from "./pipeline_progress.js";
import { loadEscalationQueue, sortEscalationQueue, processEscalationQueueClosures } from "./escalation_queue.js";
import { computeCycleSLOs, persistSloMetrics, detectCoupledAlerts } from "./slo_checker.js";
import { computeCycleAnalytics, persistCycleAnalytics, computeCycleHealth, persistCycleHealthComposite, CYCLE_PHASE, computeRuntimeContractProbe, readCycleAnalytics, evaluateBenchmarkGroundTruth, WORKER_CYCLE_ARTIFACTS_FILE, migrateWorkerCycleArtifacts } from "./cycle_analytics.js";
import { computeBaselineRecoveryState, persistBaselineMetrics, PARSER_CONFIDENCE_RECOVERY_THRESHOLD } from "./parser_baseline_recovery.js";
import { computeDispatchStrictness, loadReplayRegressionState, DISPATCH_STRICTNESS } from "./parser_replay_harness.js";
import {
  addSchemaVersion,
  migrateData,
  recordMigrationTelemetry,
  STATE_FILE_TYPE,
  MIGRATION_REASON
} from "./schema_registry.js";
import { runCatastropheDetection, GUARDRAIL_ACTION, isSloCascadingBreachScenario } from "./catastrophe_detector.js";
import { executeGuardrailsForDetections, isGuardrailActive, readForceCheckpointValidationContract, autoRevertSloGuardrailIfResolved } from "./guardrail_executor.js";
import { evaluateFreezeGate, isFreezeActive } from "./governance_freeze.js";
import { detectRecurrences, buildRecurrenceEscalations } from "./recurrence_detector.js";
import { checkClosureSLA } from "./closure_validator.js";
import { appendCapacityEntry } from "./capacity_scoreboard.js";
import { computeCapabilityDelta } from "./delta_analytics.js";
import { evaluateRetune } from "./strategy_retuner.js";
import { compileLessonsToPolicies } from "./learning_policy_compiler.js";
import { assignWorkersToPlans, enforceLaneDiversity, evaluateSpecializationAdmissionGate, buildLanePerformanceFromCycleTelemetry, buildReroutePenaltyLedger, SPECIALIZATION_ADMISSION_MAX_BLOCK_CYCLES } from "./capability_pool.js";
import { runDoctor } from "./doctor.js";
import { validateAllPlans, validatePacketBatchAdmission, applyDispatchBoundaryHardCap, resolveNamedVerificationTarget } from "./plan_contract_validator.js";
import {
  resolveDependencyGraph,
  computeReadinessGate,
  GRAPH_STATUS,
  type ReadinessGateResult,
} from "./dependency_graph_resolver.js";
import { isGovernanceCanaryBreachActive } from "./governance_canary.js";
import { executeRollback, ROLLBACK_LEVEL, ROLLBACK_TRIGGER } from "./rollback_engine.js";
import { initializeAggregateLiveLog, appendAggregateLiveLogSync } from "./live_log.js";
import { buildRoleExecutionBatches, buildTokenFirstBatches, measureWaveBoundaryIdleGap, shouldPackAcrossWaveBoundary } from "./worker_batch_planner.js";
import { computeFrontier } from "./dag_scheduler.js";
import { agentFileExists, nameToSlug } from "./agent_loader.js";
import { getRoleRegistry, assertRoleCapabilityForTask, isAthenaReviewOrPostmortemTask } from "./role_registry.js";
import {
  checkArchitectureDrift,
  rankStaleRefsAsRemediationCandidates,
  type ArchitectureDriftReport,
} from "./architecture_drift.js";
import { detectLaneConflicts } from "./capability_pool.js";
import {
  loadLedgerMeta,
  addDebtEntries,
  saveLedgerFull,
  shouldBlockOnDebt,
  autoCloseVerifiedDebt,
  reconcileReplayClosureBacklog,
  MANDATORY_REPLAY_LINEAGE_IDS,
} from "./carry_forward_ledger.js";
import { reconcileBudgetEligibility, computeRollingCompletionYield, type BudgetEligibilityContract, type RollingYieldContract } from "./budget_controller.js";
import {
  runInterventionOptimizer,
  buildInterventionsFromPlan,
  buildBudgetFromConfig,
  persistOptimizerLog,
  OPTIMIZER_STATUS,
  buildPolicyImpactByInterventionId,
  OVERBUNDLE_STEPS_THRESHOLD,
} from "./intervention_optimizer.js";
import { evaluateInterventionsForCycle } from "./intervention_judge.js";
import { evaluateAutonomyBand, type CycleSample } from "./autonomy_band_monitor.js";
import { evaluateSelfDevExit } from "./self_dev_exit_monitor.js";
import { validatePlanEvidenceCoupling } from "./evidence_envelope.js";
import { runResearchScout } from "./research_scout.js";
import { runResearchSynthesizer, persistBenchmarkEntry } from "./research_synthesizer.js";
import { buildReplayClosureEvidence, CANONICAL_MAIN_BRANCH_REPLAY_COMMANDS, hasVerificationReportEvidence } from "./verification_gate.js";
import {
  classifyFailure,
  persistFailureClassification,
  loadRecentFailureClassifications,
  normalizeRoleKey,
} from "./failure_classifier.js";
import {
  readCheckpoint as readVersionedCheckpoint,
  writeCheckpoint as writeVersionedCheckpoint,
  initializeRunSegmentState,
  applyRunSegmentRollover,
  RUN_SEGMENT_BATCH_SPAN_DEFAULT,
  RUN_SEGMENT_HISTORY_MAX_DEFAULT,
  checkCancellationAtCheckpoint,
} from "./checkpoint_engine.js";
import { assessRetryExpectedROI, rankModelsByTaskKindExpectedValue } from "./model_policy.js";

/**
 * Orchestrator health status enum.
 * Written to state/orchestrator_health.json whenever status changes.
 */
export const ORCHESTRATOR_STATUS = Object.freeze({
  OPERATIONAL: "operational",
  DEGRADED: "degraded"
});

/**
 * Explicit gate-precedence mapping for evaluatePreDispatchGovernanceGate.
 *
 * Each value is the numeric order (1 = evaluated first) in which the gate fires.
 * Lower numbers take priority — a gate with precedence 1 blocks before any gate
 * with precedence 2 is evaluated. Consumers can compare result.gateIndex against
 * these values to determine which gate fired without parsing the reason string.
 *
 * Order rationale:
 *   1. BUDGET_ELIGIBILITY    — hard short-circuit; prevents expensive downstream reads
 *   2. GUARDRAIL_PAUSE       — system-level safety valve; checked before governance logic
 *   3. GOVERNANCE_FREEZE     — policy freeze overrides all planning gates
 *   4. LINEAGE_CYCLE         — structural integrity before scheduling canary/debt checks
 *   5. GOVERNANCE_CANARY     — canary breach triggers rollback; evaluated before ledger ops
 *   6. CARRY_FORWARD_DEBT    — outstanding critical debt blocks new dispatch
 *   7. MANDATORY_DRIFT_DEBT  — architecture integrity gate before plan validation
 *   8. PLAN_EVIDENCE_COUPLING — validates individual plan completeness
 *   9. DEPENDENCY_READINESS  — validates dependency confidence metadata
 *  10. ROLLING_COMPLETION_YIELD — throttles when recent yield is too low
 *  11. SPECIALIZATION_ADMISSION — specialist share below adaptive lane target
 *  12. OVERSIZED_PACKET      — per-role plan group exceeds actionable-steps cap
 */
export const GATE_PRECEDENCE = Object.freeze({
  BUDGET_ELIGIBILITY:          1,
  GUARDRAIL_PAUSE:             2,
  FORCE_CHECKPOINT:            3.5,
  GOVERNANCE_FREEZE:           3,
  LINEAGE_CYCLE:               4,
  GOVERNANCE_CANARY:           5,
  CARRY_FORWARD_DEBT:          6,
  MANDATORY_DRIFT_DEBT:        7,
  PLAN_EVIDENCE_COUPLING:      8,
  /** Confidence metadata on plans is below the minimum dispatch threshold. */
  DEPENDENCY_READINESS:        9,
  /** Rolling completion yield is below the throttle threshold — dispatch is paused to prevent waste spirals. */
  ROLLING_COMPLETION_YIELD:   10,
  /** Specialization admission gate — specialist share below adaptive lane target. */
  SPECIALIZATION_ADMISSION:   11,
  /** Oversized packet gate — per-role plan group exceeds the configured actionable-steps cap. */
  OVERSIZED_PACKET:           12,
});

/**
 * Stable block-reason prefix constants emitted by evaluatePreDispatchGovernanceGate.
 *
 * Each constant is the authoritative prefix of the reason string returned when
 * the corresponding gate fires.  Dynamic detail (counts, paths, sub-reasons) is
 * appended after a `:` separator, but the prefix is guaranteed stable across
 * releases so consumers can pattern-match on `reason.startsWith(BLOCK_REASON.X)`.
 *
 * BUDGET_EXHAUSTED intentionally mirrors the budget_controller output prefix so
 * both the controller and the gate surface the same token vocabulary.
 */
export const BLOCK_REASON = Object.freeze({
  BUDGET_EXHAUSTED:               "budget_exhausted",
  GUARDRAIL_PAUSE_WORKERS_ACTIVE: "guardrail_pause_workers_active",
  GUARDRAIL_FORCE_CHECKPOINT_ACTIVE: "force_checkpoint_validation_active",
  GOVERNANCE_FREEZE_ACTIVE:       "governance_freeze_active",
  LINEAGE_CYCLE_DETECTED:         "lineage_cycle_detected",
  GOVERNANCE_CANARY_BREACH:       "governance_canary_breach",
  CRITICAL_DEBT_OVERDUE:          "critical_debt_overdue",
  MANDATORY_DRIFT_DEBT_UNRESOLVED:"mandatory_drift_debt_unresolved",
  PLAN_EVIDENCE_COUPLING_INVALID: "plan_evidence_coupling_invalid",
  /** One or more plans carry confidence metadata below the minimum dispatch threshold. */
  DEPENDENCY_READINESS_INCOMPLETE:"dependency_readiness_incomplete",
  /** Rolling completion yield fell at or below the throttle threshold. */
  ROLLING_YIELD_THROTTLE:         "rolling_yield_throttle",
  /** Specialist share is below the adaptive lane utilization target. */
  SPECIALIZATION_ADMISSION_GATE:  "specialization_admission_gate_failed",
  /** Per-role plan group exceeds the configured actionable-steps cap — decompose before dispatch. */
  OVERSIZED_PACKET:               "packet_exceeds_actionable_steps_cap",
});

/**
 * Health divergence state enum.
 * Describes how operational health (orchestrator) and planner health (Prometheus) relate.
 *
 *   none                       — both agree on a healthy state; no warning needed
 *   planner_warning            — orchestrator is operational but planner reports needs-work
 *   planner_critical           — orchestrator is operational but planner reports critical
 *   operational_degraded_planner_ok — orchestrator is degraded but planner reports good
 *   both_degraded              — orchestrator is degraded AND planner reports needs-work/critical
 *   unknown                    — insufficient data to determine divergence
 */
export const HEALTH_DIVERGENCE_STATE = Object.freeze({
  NONE:                          "none",
  PLANNER_WARNING:               "planner_warning",
  PLANNER_CRITICAL:              "planner_critical",
  OPERATIONAL_DEGRADED_PLANNER_OK: "operational_degraded_planner_ok",
  BOTH_DEGRADED:                 "both_degraded",
  UNKNOWN:                       "unknown",
});

/**
 * Resolved pipeline status values produced by the health divergence mapping.
 * These represent the single authoritative status a consumer should act on
 * when operational and planner health must be reconciled.
 */
export const PIPELINE_HEALTH_STATUS = Object.freeze({
  HEALTHY:  "healthy",
  WARNING:  "warning",
  CRITICAL: "critical",
  UNKNOWN:  "unknown",
});

/**
 * Compare operational health (orchestrator status) with planner health (Prometheus
 * projectHealth) and return a deterministic divergence record.
 *
 * Exported so tests and downstream consumers can verify the mapping logic.
 *
 * @param {string} operationalStatus — "operational" | "degraded" | unknown string
 * @param {string} plannerHealth     — "good" | "needs-work" | "critical" | unknown string
 * @returns {{ divergenceState, pipelineStatus, operationalStatus, plannerHealth, isWarning }}
 */
export function computeHealthDivergence(operationalStatus, plannerHealth) {
  const opStatus = String(operationalStatus || "").toLowerCase().trim();
  // Normalize aliases: "healthy" → "good", "warning" → "needs-work"
  // so planner outputs using the prompt schema form are handled correctly.
  const phRaw = String(plannerHealth || "").toLowerCase().trim();
  const phStatus = phRaw === "healthy" ? "good" : phRaw === "warning" ? "needs-work" : phRaw;

  const isOperational = opStatus === ORCHESTRATOR_STATUS.OPERATIONAL;
  const isDegraded    = opStatus === ORCHESTRATOR_STATUS.DEGRADED;
  const isGood        = phStatus === "good";
  const isNeedsWork   = phStatus === "needs-work";
  const isCritical    = phStatus === "critical";

  if (!opStatus || !phStatus || (!isOperational && !isDegraded) || (!isGood && !isNeedsWork && !isCritical)) {
    return {
      divergenceState: HEALTH_DIVERGENCE_STATE.UNKNOWN,
      pipelineStatus:  PIPELINE_HEALTH_STATUS.UNKNOWN,
      operationalStatus: opStatus || "unknown",
      plannerHealth:     phStatus || "unknown",
      isWarning: false,
    };
  }

  if (isDegraded && (isNeedsWork || isCritical)) {
    return {
      divergenceState: HEALTH_DIVERGENCE_STATE.BOTH_DEGRADED,
      pipelineStatus:  PIPELINE_HEALTH_STATUS.CRITICAL,
      operationalStatus: opStatus,
      plannerHealth:     phStatus,
      isWarning: true,
    };
  }

  if (isDegraded && isGood) {
    return {
      divergenceState: HEALTH_DIVERGENCE_STATE.OPERATIONAL_DEGRADED_PLANNER_OK,
      pipelineStatus:  PIPELINE_HEALTH_STATUS.WARNING,
      operationalStatus: opStatus,
      plannerHealth:     phStatus,
      isWarning: true,
    };
  }

  if (isOperational && isCritical) {
    return {
      divergenceState: HEALTH_DIVERGENCE_STATE.PLANNER_CRITICAL,
      pipelineStatus:  PIPELINE_HEALTH_STATUS.CRITICAL,
      operationalStatus: opStatus,
      plannerHealth:     phStatus,
      isWarning: true,
    };
  }

  if (isOperational && isNeedsWork) {
    return {
      divergenceState: HEALTH_DIVERGENCE_STATE.PLANNER_WARNING,
      pipelineStatus:  PIPELINE_HEALTH_STATUS.WARNING,
      operationalStatus: opStatus,
      plannerHealth:     phStatus,
      isWarning: true,
    };
  }

  // operational + good → fully healthy
  return {
    divergenceState: HEALTH_DIVERGENCE_STATE.NONE,
    pipelineStatus:  PIPELINE_HEALTH_STATUS.HEALTHY,
    operationalStatus: opStatus,
    plannerHealth:     phStatus,
    isWarning: false,
  };
}

/** Max automatic retries when a worker hits transient API errors (circuit breaker). */
const MAX_TRANSIENT_RETRIES = 3;

type RetryTelemetryContext = {
  premiumUsageData: any[];
  benchmarkGroundTruth: any;
};

async function loadRetryTelemetryContext(config): Promise<RetryTelemetryContext> {
  const stateDir = config?.paths?.stateDir || "state";
  try {
    const [premiumUsageData, benchmarkGroundTruth] = await Promise.all([
      readJson(path.join(stateDir, "premium_usage_log.json"), []),
      readJson(path.join(stateDir, "benchmark_ground_truth.json"), null),
    ]);
    return {
      premiumUsageData: Array.isArray(premiumUsageData) ? premiumUsageData : [],
      benchmarkGroundTruth,
    };
  } catch (err) {
    warn(`[orchestrator] retry telemetry load failed: ${String(err?.message || err)}`);
    return { premiumUsageData: [], benchmarkGroundTruth: null };
  }
}

type WorkerSessionRecord = {
  status?: string;
  [key: string]: unknown;
};

type GithubPullRequestSummary = {
  number?: number;
  title?: string;
  merged_at?: string | null;
  head?: {
    ref?: string;
  };
};

type GithubBranchSummary = {
  name?: string;
};

type CriticalReadResult = {
  ok: boolean;
  reason?: string;
  data?: unknown;
  error?: {
    message?: string;
  } | null;
};

const PLAN_IMPLEMENTATION_STATUS = Object.freeze({
  IMPLEMENTED_CORRECTLY: "implemented_correctly",
  IMPLEMENTED_PARTIALLY: "implemented_partially",
  NOT_IMPLEMENTED: "not_implemented",
  UNKNOWN: "unknown",
});

function normalizePlanIdentity(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImplementationStatus(rawStatus: unknown): string {
  const status = String(rawStatus || "").toLowerCase().trim();
  if (status === PLAN_IMPLEMENTATION_STATUS.IMPLEMENTED_CORRECTLY) return status;
  if (status === PLAN_IMPLEMENTATION_STATUS.IMPLEMENTED_PARTIALLY) return status;
  if (status === PLAN_IMPLEMENTATION_STATUS.NOT_IMPLEMENTED) return status;
  return PLAN_IMPLEMENTATION_STATUS.UNKNOWN;
}

async function loadCompletedTaskIdentities(stateDir: string): Promise<Set<string>> {
  const done = new Set<string>();

  try {
    const postmortems = await readJson(path.join(stateDir, "athena_postmortems.json"), null);
    const entries = Array.isArray(postmortems?.entries)
      ? postmortems.entries
      : Array.isArray(postmortems)
        ? postmortems
        : [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      if (entry.taskCompleted !== true) continue;
      const identity = normalizePlanIdentity(entry.followUpTask || entry.expectedOutcome || entry.actualOutcome);
      if (identity) done.add(identity);
    }
  } catch {
    // Best-effort signal only.
  }

  return done;
}

function extractEvidencePaths(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .map(item => {
      const m = item.match(/(?:src|tests|scripts|docs)\/[A-Za-z0-9_./-]+/);
      return m ? m[0].replace(/[),.;:]+$/, "") : "";
    })
    .filter(Boolean);
}

type PlanNoveltyFilterResult = {
  actionablePlans: any[];
  skippedPlans: Array<{ plan: any; reason: string }>;
};

async function filterAlreadyImplementedPlans(stateDir: string, plans: any[]): Promise<PlanNoveltyFilterResult> {
  const actionablePlans: any[] = [];
  const skippedPlans: Array<{ plan: any; reason: string }> = [];
  const completedTaskIdentities = await loadCompletedTaskIdentities(stateDir);

  for (const plan of Array.isArray(plans) ? plans : []) {
    const status = normalizeImplementationStatus(plan?.implementationStatus);
    const evidencePaths = extractEvidencePaths(plan?.implementationEvidence);
    const planIdentity = normalizePlanIdentity(plan?.task || plan?.title || plan?.task_id || plan?.id);
    const matchesCompletedHistory = planIdentity && completedTaskIdentities.has(planIdentity);

    if (status === PLAN_IMPLEMENTATION_STATUS.IMPLEMENTED_CORRECTLY) {
      skippedPlans.push({
        plan,
        reason: evidencePaths.length > 0
          ? "implementationStatus=implemented_correctly with evidence"
          : "implementationStatus=implemented_correctly"
      });
      continue;
    }

    if (status === PLAN_IMPLEMENTATION_STATUS.UNKNOWN && matchesCompletedHistory) {
      skippedPlans.push({
        plan,
        reason: "task appears in completed Athena history"
      });
      continue;
    }

    actionablePlans.push(plan);
  }

  return { actionablePlans, skippedPlans };
}

function buildNoveltyReplanPrompt(basePrompt: string, skippedPlans: Array<{ plan: any; reason: string }>): string {
  const skippedList = skippedPlans
    .slice(0, 20)
    .map((item, idx) => {
      const title = String(item?.plan?.title || item?.plan?.task || item?.plan?.task_id || `plan-${idx + 1}`);
      return `${idx + 1}. ${title} [${item.reason}]`;
    })
    .join("\n");

  return [
    String(basePrompt || "Full repository self-evolution analysis").trim(),
    "",
    "ADDITIONAL ORCHESTRATOR GATE CONTEXT:",
    "The following proposed plans are already implemented correctly or already completed in system history. Do not re-propose them:",
    skippedList || "(none)",
    "",
    "MANDATORY OUTPUT UPDATE:",
    "- Return only net-new plans or delta plans for partially implemented capabilities.",
    "- For each plan include precise target files, acceptance criteria, and verification commands.",
    "- For each plan include implementationStatus and implementationEvidence.",
    "- If everything is already implemented correctly, return plans: [] and explain why.",
  ].join("\n");
}

function buildSourceLinkageReplanPrompt(basePrompt: string, topicCount: number): string {
  return [
    String(basePrompt || "Full repository self-evolution analysis").trim(),
    "",
    "ADDITIONAL ORCHESTRATOR GATE CONTEXT:",
    `Latest plan batch is blind to research context: researchContext.topicCount=${topicCount}, but no plan declared synthesis_sources and no informational_topics_consumed were emitted.`,
    "This causes low-relevance planning and backlog stagnation.",
    "",
    "MANDATORY OUTPUT UPDATE:",
    "- Every plan that uses research context MUST include synthesis_sources with one or more exact topic names from RESEARCH INTELLIGENCE.",
    "- Any topic reviewed but not converted into a plan MUST be listed in informational_topics_consumed.",
    "- Do not leave both fields empty when researchContext.topicCount > 0.",
    "- Keep plans actionable with deterministic verification commands.",
  ].join("\n");
}

/** Write orchestrator health record to state/orchestrator_health.json. Exported for downstream use. */
export async function writeOrchestratorHealth(stateDir, status, reason, details = null) {
  await writeJson(path.join(stateDir, "orchestrator_health.json"), {
    orchestratorStatus: status,
    reason,
    details: details || null,
    recordedAt: new Date().toISOString()
  });
}

/**
 * Typed envelope produced by evaluatePreDispatchGovernanceGate.
 *
 * Every field is guaranteed present on all return paths so dispatch and
 * telemetry consumers have a single, uniform surface regardless of which gate
 * fires.  Optional fields appear only when the corresponding gate activates.
 *
 * Consumed by:
 *   - Dispatch paths (runSingleCycle, runResumeDispatch) via `gateDecision.blocked`
 *   - Telemetry (emitEvent GOVERNANCE_GATE_EVALUATED) via `gateDecision.reason`
 */
export interface GovernanceBlockDecision {
  /** True when any gate blocked dispatch. False on pass-through. */
  blocked: boolean;
  /**
   * Machine-readable reason string. null when not blocked.
   * Blocked reasons are prefixed with a BLOCK_REASON constant followed by ':'
   * and dynamic detail so callers can `reason.startsWith(BLOCK_REASON.X)`.
   */
  reason: string | null;
  /** Post-block action taken (e.g. "rollback" on canary breach), undefined otherwise. */
  action: "rollback" | undefined;
  /** Explicit machine-readable dispatch block reason outcome. Mirrors `reason` when blocked, null otherwise. */
  dispatchBlockReason: string | null;
  /** Dependency graph resolution result. null when the graph was not evaluated. */
  graphResult: Record<string, unknown> | null;
  /** Dispatch cycle identifier carried through for telemetry correlation. */
  cycleId: string;
  /** Budget eligibility state at gate evaluation time. Always present for observability. */
  budgetEligibility: BudgetEligibilityContract;
  /**
   * Gate precedence index of the blocking gate (matches GATE_PRECEDENCE.*).
   * Absent (undefined) on non-blocked results.
   */
  gateIndex?: number;
  /** Rollback execution result. Present only on GOVERNANCE_CANARY_BREACH blocks. */
  rollbackResult?: Record<string, unknown>;
  /**
   * Ghost file paths from unresolved mandatory drift debt.
   * Present only on MANDATORY_DRIFT_DEBT_UNRESOLVED blocks.
   */
  mandatoryDriftPaths?: string[];
  /**
   * Readiness gate evaluation result.
   * Present only on DEPENDENCY_READINESS_INCOMPLETE blocks.
   */
  readinessResult?: ReadinessGateResult;
  /**
   * Rolling completion yield contract.
   * Present only on ROLLING_YIELD_THROTTLE blocks for observability.
   */
  rollingYieldContract?: RollingYieldContract;
}

/**
 * Evaluate pre-dispatch governance gates without starting worker execution.
 * Exported for integration tests and any callers that need the dispatch decision
 * surface without running a full orchestration cycle.
 */
export async function evaluatePreDispatchGovernanceGate(config, plans = [], cycleId = "", driftReport: ArchitectureDriftReport | null = null): Promise<GovernanceBlockDecision> {
  const stateDir = config?.paths?.stateDir || "state";

  // ── Budget reconciliation — resolved upfront so every dispatch decision
  // carries a uniform BudgetEligibilityContract regardless of which gate fires.
  const budgetEligibility = await reconcileBudgetEligibility(config);
  if (budgetEligibility.configured && budgetEligibility.reason?.startsWith("budget_read_error")) {
    warn(`[orchestrator] budget gate failed (non-fatal): ${budgetEligibility.reason}`);
  }

  // ── Budget eligibility gate (hard gate — first check) ────────────────────
  // Fires immediately after reconciliation, before all other gates so that
  // budget exhaustion short-circuits every subsequent operation (including
  // expensive canary rollback and ledger reads) with a uniform block signal.
  if (!budgetEligibility.eligible) {
    return {
      blocked: true,
      reason: budgetEligibility.reason,
      action: undefined,
      dispatchBlockReason: budgetEligibility.reason,
      graphResult: null,
      cycleId,
      budgetEligibility,
      gateIndex: GATE_PRECEDENCE.BUDGET_ELIGIBILITY,
    };
  }

  if (config?.systemGuardian?.enabled !== false) {
    try {
      const pauseActive = await isGuardrailActive(config, GUARDRAIL_ACTION.PAUSE_WORKERS);
      if (pauseActive) {
        return {
          blocked: true,
          reason: BLOCK_REASON.GUARDRAIL_PAUSE_WORKERS_ACTIVE,
          action: undefined,
          dispatchBlockReason: BLOCK_REASON.GUARDRAIL_PAUSE_WORKERS_ACTIVE,
          graphResult: null,
          cycleId,
          budgetEligibility,
          gateIndex: GATE_PRECEDENCE.GUARDRAIL_PAUSE,
        };
      }
    } catch (err) {
      warn(`[orchestrator] pre-dispatch guardrail check failed: ${String(err?.message || err)}`);
    }
  }

  try {
    const forceCheckpoint = await readForceCheckpointValidationContract(config);
    const hasSloBreachCheckpoint = forceCheckpoint.active
      && isSloCascadingBreachScenario(forceCheckpoint.scenarioId);
    if (hasSloBreachCheckpoint) {
      if (forceCheckpoint.overrideActive) {
        const auditPath = path.join(stateDir, "governance_gate_audit.jsonl");
        const entry = {
          ts: new Date().toISOString(),
          kind: "force_checkpoint_override",
          cycleId,
          scenarioId: forceCheckpoint.scenarioId,
          reason: forceCheckpoint.overrideReason || "override_active",
          by: forceCheckpoint.overrideBy || "unknown",
        };
        try {
          await fs.mkdir(path.dirname(auditPath), { recursive: true });
          await fs.appendFile(auditPath, `${JSON.stringify(entry)}\n`, "utf8");
        } catch (auditErr) {
          warn(`[orchestrator] force-checkpoint override audit write failed: ${String(auditErr?.message || auditErr)}`);
        }
      } else {
        return {
          blocked: true,
          reason: `${BLOCK_REASON.GUARDRAIL_FORCE_CHECKPOINT_ACTIVE}:${forceCheckpoint.scenarioId || "unknown_scenario"}`,
          action: undefined,
          dispatchBlockReason: `${BLOCK_REASON.GUARDRAIL_FORCE_CHECKPOINT_ACTIVE}:${forceCheckpoint.scenarioId || "unknown_scenario"}`,
          graphResult: null,
          cycleId,
          budgetEligibility,
          gateIndex: GATE_PRECEDENCE.FORCE_CHECKPOINT,
        };
      }
    }
  } catch (err) {
    warn(`[orchestrator] force-checkpoint governance gate check failed: ${String(err?.message || err)}`);
  }

  const freezeStatus = isFreezeActive(config);
  if (freezeStatus.active) {
    return {
      blocked: true,
      reason: `${BLOCK_REASON.GOVERNANCE_FREEZE_ACTIVE}:${freezeStatus.reason}`,
      action: undefined,
      dispatchBlockReason: `${BLOCK_REASON.GOVERNANCE_FREEZE_ACTIVE}:${freezeStatus.reason}`,
      graphResult: null,
      cycleId,
      budgetEligibility,
      gateIndex: GATE_PRECEDENCE.GOVERNANCE_FREEZE,
    };
  }

  const graphInput = Array.isArray(plans)
    ? plans.map((plan, index) => ({
        id: String(plan?.id || plan?.task || plan?.role || `plan-${index + 1}`),
        dependsOn: Array.isArray(plan?.dependsOn) ? plan.dependsOn : [],
        filesInScope: Array.isArray(plan?.filesInScope) ? plan.filesInScope : []
      }))
    : [];

  const graphResult = resolveDependencyGraph(graphInput);
  if (graphResult.status === GRAPH_STATUS.CYCLE_DETECTED) {
    return {
      blocked: true,
      reason: `${BLOCK_REASON.LINEAGE_CYCLE_DETECTED}:${graphResult.reasonCode}`,
      action: undefined,
      dispatchBlockReason: `${BLOCK_REASON.LINEAGE_CYCLE_DETECTED}:${graphResult.reasonCode}`,
      graphResult,
      cycleId,
      budgetEligibility,
      gateIndex: GATE_PRECEDENCE.LINEAGE_CYCLE,
    };
  }

  const canaryBreach = await isGovernanceCanaryBreachActive(config);
  if (canaryBreach.breachActive) {
    const rollbackConfig = {
      ...config,
      rollbackEngine: {
        ...(config?.rollbackEngine || {}),
        incidentLogPath: config?.rollbackEngine?.incidentLogPath || path.join(stateDir, "rollback_incidents.jsonl"),
        lockFilePath: config?.rollbackEngine?.lockFilePath || path.join(stateDir, "rollback_lock.json")
      }
    };

    const rollbackResult = await executeRollback({
      level: ROLLBACK_LEVEL.CONFIG_ONLY,
      trigger: ROLLBACK_TRIGGER.CANARY_ROLLBACK,
      evidence: {
        controlValue: config?.rollbackEngine?.controlValue || {},
        cycleId,
        breachReason: canaryBreach.reason || "GOVERNANCE_CANARY_BREACH"
      },
      config: rollbackConfig,
      stateDir
    });

    return {
      blocked: true,
      reason: `${BLOCK_REASON.GOVERNANCE_CANARY_BREACH}:${canaryBreach.reason || "GOVERNANCE_CANARY_BREACH"}`,
      action: "rollback",
      dispatchBlockReason: `${BLOCK_REASON.GOVERNANCE_CANARY_BREACH}:${canaryBreach.reason || "GOVERNANCE_CANARY_BREACH"}`,
      graphResult,
      rollbackResult,
      cycleId,
      budgetEligibility,
      gateIndex: GATE_PRECEDENCE.GOVERNANCE_CANARY,
    };
  }

  // ── Carry-forward debt gate ───────────────────────────────────────────────
  // Block dispatch when the count of critical overdue debt entries meets or
  // exceeds the configured limit (default: 3).  Fail-open on any ledger read
  // error so a corrupt/missing ledger never prevents legitimate work.
  try {
    const { entries: debtLedger, cycleCounter } = await loadLedgerMeta(config);
    const debtGate = shouldBlockOnDebt(debtLedger, cycleCounter, {
      maxCriticalOverdue: config?.carryForward?.maxCriticalOverdue,
    });
    if (debtGate.shouldBlock) {
        return {
          blocked: true,
          reason: `${BLOCK_REASON.CRITICAL_DEBT_OVERDUE}:${debtGate.reason}`,
          action: undefined,
          dispatchBlockReason: `${BLOCK_REASON.CRITICAL_DEBT_OVERDUE}:${debtGate.reason}`,
          graphResult,
          cycleId,
          budgetEligibility,
        gateIndex: GATE_PRECEDENCE.CARRY_FORWARD_DEBT,
      };
    }
  } catch (err) {
    warn(`[orchestrator] carry-forward debt gate failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Mandatory drift debt gate ─────────────────────────────────────────────
  // Block dispatch when high-priority architecture drift debt remains unresolved
  // after plan normalization. "Mandatory" drift debt = stale references to
  // src/core/ files (priority=high, confidence=0.50) that have not been remediated.
  // These indicate that the architecture doc is pointing to ghost paths in active
  // infrastructure, which can cause workers to build against non-existent files.
  //
  // Fail-open: any error processing the drift report is treated as no signal so
  // a transient scan failure never prevents legitimate work.
  // Disabled when config.runtime.disableDriftDebtGate === true.
  if (driftReport && config?.runtime?.disableDriftDebtGate !== true) {
    try {
      const driftCandidates = rankStaleRefsAsRemediationCandidates(driftReport);
      const mandatoryDebt = driftCandidates.filter(c => c.priority === "high");
      if (mandatoryDebt.length > 0) {
        const firstHint = mandatoryDebt[0].suggestedTask;
        // Collect the distinct missing file paths so callers can surface them directly.
        const mandatoryDriftPaths = [...new Set(
          mandatoryDebt.map(c => c.referencedPath).filter(Boolean) as string[]
        )];
        return {
          blocked: true,
          reason: `${BLOCK_REASON.MANDATORY_DRIFT_DEBT_UNRESOLVED}:${mandatoryDebt.length} high-priority drift debt task(s) remain — ${firstHint}`,
          action: undefined,
          dispatchBlockReason: `${BLOCK_REASON.MANDATORY_DRIFT_DEBT_UNRESOLVED}:${mandatoryDebt.length} high-priority drift debt task(s) remain — ${firstHint}`,
          graphResult,
          cycleId,
          budgetEligibility,
          mandatoryDriftPaths,
          gateIndex: GATE_PRECEDENCE.MANDATORY_DRIFT_DEBT,
        };
      }
    } catch (driftDebtErr) {
      warn(`[orchestrator] mandatory drift debt gate failed (non-fatal): ${String(driftDebtErr?.message || driftDebtErr)}`);
    }
  }

  // ── Plan evidence coupling gate ───────────────────────────────────────────
  // Each plan entering dispatch must carry at least one verification command
  // and at least one acceptance criterion — this ensures automated completion
  // signals exist before work begins.  Plans that are missing these fields are
  // either AI output gaps or legacy plans from before the coupling requirement;
  // either way, dispatching them would produce unverifiable outcomes.
  if (Array.isArray(plans) && plans.length > 0) {
    const invalidPlans: string[] = [];
    for (const plan of plans) {
      const coupling = validatePlanEvidenceCoupling(plan);
      if (!coupling.valid) {
        const planId = String((plan as any)?.task_id || (plan as any)?.id || (plan as any)?.task || "unknown");
        invalidPlans.push(`${planId}: ${coupling.errors.join("; ")}`);
      }
    }
    if (invalidPlans.length > 0) {
      return {
        blocked: true,
        reason: `${BLOCK_REASON.PLAN_EVIDENCE_COUPLING_INVALID}:${invalidPlans[0]}`,
        action: undefined,
        dispatchBlockReason: `${BLOCK_REASON.PLAN_EVIDENCE_COUPLING_INVALID}:${invalidPlans[0]}`,
        graphResult,
        cycleId,
        budgetEligibility,
        gateIndex: GATE_PRECEDENCE.PLAN_EVIDENCE_COUPLING,
      };
    }
  }

  // ── Dependency readiness gate ─────────────────────────────────────────────
  // Gate dispatch when any plan carries explicit confidence metadata below the
  // minimum threshold.  Only fires for tasks that OPT IN by declaring at least
  // one of: shapeConfidence, budgetConfidence, or dependencyConfidence.
  // Plans without confidence fields pass through (fail-open for legacy plans).
  // Threshold configurable via config.runtime.minPlanConfidence (default: 0.5).
  //
  // Fail-open: any error during readiness evaluation is logged but never blocks.
  try {
    const readinessResult = computeReadinessGate(Array.isArray(plans) ? plans : [], {
      minConfidence: config?.runtime?.minPlanConfidence,
    });
    if (!readinessResult.ready) {
      return {
        blocked: true,
        reason: `${BLOCK_REASON.DEPENDENCY_READINESS_INCOMPLETE}:${readinessResult.reason}`,
        action: undefined,
        dispatchBlockReason: `${BLOCK_REASON.DEPENDENCY_READINESS_INCOMPLETE}:${readinessResult.reason}`,
        graphResult,
        cycleId,
        budgetEligibility,
        gateIndex: GATE_PRECEDENCE.DEPENDENCY_READINESS,
        readinessResult,
      };
    }
  } catch (readinessErr) {
    warn(`[orchestrator] dependency readiness gate failed (non-fatal): ${String(readinessErr?.message || readinessErr)}`);
  }

  // ── Gate 10: Rolling completion yield throttle ────────────────────────
  // If the rolling yield of recent dispatches falls at or below the throttle
  // threshold, pause dispatch to prevent premium-request waste spirals.
  try {
    const yieldContract: RollingYieldContract = await computeRollingCompletionYield(config);
    if (yieldContract.throttled) {
      return {
        blocked: true,
        reason: `${BLOCK_REASON.ROLLING_YIELD_THROTTLE}:yield=${yieldContract.yield.toFixed(2)},window=${yieldContract.windowSize},threshold=${yieldContract.threshold}`,
        action: undefined,
        dispatchBlockReason: `${BLOCK_REASON.ROLLING_YIELD_THROTTLE}:yield=${yieldContract.yield.toFixed(2)},window=${yieldContract.windowSize},threshold=${yieldContract.threshold}`,
        graphResult,
        cycleId,
        budgetEligibility,
        gateIndex: GATE_PRECEDENCE.ROLLING_COMPLETION_YIELD,
        rollingYieldContract: yieldContract,
      };
    }
  } catch (yieldErr) {
    warn(`[orchestrator] rolling yield gate failed (non-fatal): ${String(yieldErr?.message || yieldErr)}`);
  }

  // ── Gate 11: Specialization admission gate ────────────────────────────
  // Fires when the specialist share of the current plan set falls below the
  // adaptive lane utilization target.  Bounded fallback: after
  // SPECIALIZATION_ADMISSION_MAX_BLOCK_CYCLES consecutive blocks the gate
  // allows dispatch through with a warning to prevent deadlock.
  //
  // Opt-in: only active when config.workerPool.specializationTargets.minSpecializedShare
  // is explicitly set to a positive value.  When not configured the gate is a no-op
  // so existing workflows are not disrupted.
  const configuredSpecShareTarget = Number(
    (config as any)?.workerPool?.specializationTargets?.minSpecializedShare
  );
  const specializationGateEnabled = plans.length > 0 && Number.isFinite(configuredSpecShareTarget) && configuredSpecShareTarget > 0;
  if (specializationGateEnabled) {
    try {
      const gateStatePath = path.join(stateDir, "specialization_gate_state.json");
      let consecutiveBlockCycles = 0;
      try {
        const raw = await fs.readFile(gateStatePath, "utf8");
        const parsed = JSON.parse(raw);
        consecutiveBlockCycles = Number(parsed?.consecutiveBlockCycles) || 0;
      } catch {
        // File absent or unreadable — start from 0.
      }

      // assignWorkersToPlans is synchronous; call it with current plans to get fresh utilization.
      const poolSample = assignWorkersToPlans(plans, config);

      // Read reroute history to bind admission threshold to reroute reason intensity.
      // Specialists rerouted for token-fill reasons lower the effective threshold;
      // performance-degraded reroutes raise it.  Missing file is non-fatal.
      let admissionReroutePenaltyLedger = {};
      try {
        const rerouteHistoryPath = path.join(stateDir, "reroute_history.jsonl");
        const rawHistory = await fs.readFile(rerouteHistoryPath, "utf8");
        const historyRecords = rawHistory.split("\n").filter(Boolean).flatMap(line => {
          try { return [JSON.parse(line)]; } catch { return []; }
        });
        admissionReroutePenaltyLedger = buildReroutePenaltyLedger(historyRecords);
      } catch { /* reroute_history.jsonl absent or unreadable — proceed without intensity binding */ }

      const admissionResult = evaluateSpecializationAdmissionGate(
        poolSample.specializationUtilization,
        consecutiveBlockCycles,
        SPECIALIZATION_ADMISSION_MAX_BLOCK_CYCLES,
        admissionReroutePenaltyLedger,
      );

      // Persist updated counter regardless of outcome so bypass counter resets on pass.
      const newCount = admissionResult.blocked ? admissionResult.consecutiveBlockCycles : 0;
      try {
        await fs.mkdir(path.dirname(gateStatePath), { recursive: true });
        await fs.writeFile(gateStatePath, JSON.stringify({ consecutiveBlockCycles: newCount, updatedAt: new Date().toISOString() }), "utf8");
      } catch (writeErr) {
        warn(`[orchestrator] specialization gate state write failed (non-fatal): ${String(writeErr?.message || writeErr)}`);
      }

      if (admissionResult.blocked) {
        return {
          blocked: true,
          reason: admissionResult.reason,
          action: undefined,
          dispatchBlockReason: admissionResult.reason,
          graphResult,
          cycleId,
          budgetEligibility,
          gateIndex: GATE_PRECEDENCE.SPECIALIZATION_ADMISSION,
        };
      } else if (admissionResult.reason && admissionResult.reason.includes("bypassed_fallback")) {
        warn(`[orchestrator] specialization admission gate bypassed (bounded fallback): ${admissionResult.reason}`);
      }
      // Record that specialization admission control was evaluated this cycle.
      await recordCapabilityExecution(
        config,
        "specialization-admission-control",
        `blocked=${admissionResult.blocked} reason=${String(admissionResult.reason || "pass").slice(0, 120)}`,
      );
    } catch (specErr) {
      warn(`[orchestrator] specialization admission gate failed (non-fatal): ${String(specErr?.message || specErr)}`);
    }
  }

  // ── Gate 12: Oversized packet hard admission ───────────────────────────
  // When config.planner.maxActionableStepsPerPacket is configured, block dispatch
  // if any per-role plan group exceeds the cap.  This converts the advisory
  // auto-split fallback in buildRoleExecutionBatches into an explicit hard block
  // so callers receive a deterministic reason rather than silent reshaping.
  //
  // Opt-in: only active when maxActionableStepsPerPacket is a positive integer.
  // Fail-open: gate errors are non-fatal and never block dispatch.
  {
    const rawActionableCap = Number((config as any)?.planner?.maxActionableStepsPerPacket);
    const actionableCap = Number.isFinite(rawActionableCap) && rawActionableCap > 0
      ? Math.floor(rawActionableCap)
      : OVERBUNDLE_STEPS_THRESHOLD;
    if (actionableCap > 0 && plans.length > 0) {
      try {
        const oversizeCheck = validatePacketBatchAdmission(Array.isArray(plans) ? plans : [], actionableCap);
        if (oversizeCheck.blocked) {
          const blockReason = `${BLOCK_REASON.OVERSIZED_PACKET}:${oversizeCheck.reason}`;
          return {
            blocked: true,
            reason: blockReason,
            action: undefined,
            dispatchBlockReason: blockReason,
            graphResult,
            cycleId,
            budgetEligibility,
            gateIndex: GATE_PRECEDENCE.OVERSIZED_PACKET,
          };
        }
      } catch (oversizeErr) {
        warn(`[orchestrator] oversized packet gate failed (non-fatal): ${String(oversizeErr?.message || oversizeErr)}`);
      }
    }
  }

  return {
    blocked: false,
    reason: null,
    action: undefined,
    dispatchBlockReason: null,
    graphResult,
    cycleId,
    budgetEligibility
  };
}

/**
 * Machine-readable signal written to state/auto_approve_telemetry.json when the
 * Athena plan review fast-path bypasses AI review.  Consumers (model_policy telemetry
 * readers, Prometheus postmortem analysis) can correlate auto-approved cycles with
 * realized outcomes to improve future fast-path accuracy.
 */
export const AUTO_APPROVE_DISPATCH_SIGNAL = Object.freeze({
  /** Review was skipped because the batch fingerprint matched a prior approved review. */
  LOW_RISK_UNCHANGED:    "LOW_RISK_UNCHANGED",
  /** Review was skipped because all plans cleared the high-quality deterministic threshold. */
  HIGH_QUALITY_LOW_RISK: "HIGH_QUALITY_LOW_RISK",
  /** Review was skipped because all plans in a changed batch cleared the delta-review threshold. */
  DELTA_REVIEW_APPROVED: "DELTA_REVIEW_APPROVED",
} as const);

/**
 * Append an auto-approve dispatch decision to state/auto_approve_telemetry.json.
 *
 * Called by the orchestrator dispatch path whenever Athena returns an auto-approved
 * result so that downstream telemetry consumers (model_policy ROI ledger, Prometheus)
 * can correlate fast-path approvals with realized cycle outcomes.
 *
 * Fails open: any write error is logged but never propagated so a telemetry failure
 * cannot block worker dispatch.
 *
 * @param config        — BOX config (stateDir resolved from config.paths.stateDir)
 * @param planReviewResult — Athena plan review result (autoApproved=true required)
 * @param cycleId       — dispatch cycle identifier for correlation
 */
export async function appendAutoApproveTelemetry(
  config: object,
  planReviewResult: Record<string, unknown>,
  cycleId: string
): Promise<void> {
  const stateDir = (config as any)?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, "auto_approve_telemetry.json");
  try {
    const rawResult = await readJsonSafe(filePath);
    const safeList: unknown[] = (rawResult.ok && Array.isArray(rawResult.data)) ? rawResult.data : [];
    const entry = {
      cycleId,
      signal: String((planReviewResult.autoApproveReason as any)?.code || AUTO_APPROVE_DISPATCH_SIGNAL.LOW_RISK_UNCHANGED),
      planCount: Array.isArray(planReviewResult.planReviews) ? (planReviewResult.planReviews as any[]).length : 0,
      recordedAt: new Date().toISOString(),
    };
    await writeJson(filePath, [...safeList, entry]);
  } catch (err) {
    warn(`[orchestrator] auto-approve telemetry write failed (non-fatal): ${String((err as any)?.message || err)}`);
  }
}

/**
 * Safe wrapper for updatePipelineProgress.
 *
 * Pipeline progress is observability state — a write failure must NEVER block
 * orchestration. Errors are logged explicitly (never silently dropped) so
 * the failure is observable via the progress log.
 *
 * Risk: medium — touches orchestrator transitions directly.
 */
async function safeUpdatePipelineProgress(config, stepId, detail, extra?) {
  try {
    await updatePipelineProgress(config, stepId, detail, extra);
  } catch (err) {
    warn(`[orchestrator] pipeline progress update failed (step=${stepId}): ${String(err?.message || err)}`);
  }
}

/**
 * Audit the three critical checkpoint state files using readJsonSafe.
 *
 * Critical vs non-critical classification:
 *   CRITICAL  (handled here): worker_sessions.json, jesus_directive.json, prometheus_analysis.json
 *   NON-CRITICAL (handled by readJson with fallback + box:readError event): all other reads.
 *
 * A missing file (ENOENT) is expected on first run and is NOT an error.
 * An invalid file (corrupt JSON) is always an error — sets orchestratorStatus=degraded.
 *
 * Returns: { sessions, jesusDirective, prometheusAnalysis, degraded: boolean }
 */
async function auditCriticalStateFiles(config, stateDir) {
  const criticalReads = await Promise.all([
    readJsonSafe(path.join(stateDir, "worker_sessions.json")),
    readJsonSafe(path.join(stateDir, "jesus_directive.json")),
    readJsonSafe(path.join(stateDir, "prometheus_analysis.json"))
  ]);
  const [sessionsResult, jesusDirectiveResult, prometheusAnalysisResult] = criticalReads;

  let sessions: Record<string, any> = {};
  let jesusDirective = null;
  let prometheusAnalysis = null;
  const degradedReasons = [];

  for (const [label, result, defaultFallback, fileType] of ([
    ["worker_sessions.json",    sessionsResult,          {}, STATE_FILE_TYPE.WORKER_SESSIONS],
    ["jesus_directive.json",    jesusDirectiveResult,    null, null],
    ["prometheus_analysis.json", prometheusAnalysisResult, null, STATE_FILE_TYPE.PROMETHEUS_ANALYSIS]
  ] as Array<[string, CriticalReadResult, unknown, string | null]>)) {
    if (result.ok) {
      // Successfully parsed — run schema migration if this file type is versioned
      if (fileType && result.data !== null) {
        const migrated = migrateData(result.data, fileType);
        if (!migrated.ok) {
          // Unknown future version or structural mismatch — fail closed, log telemetry
          await recordMigrationTelemetry(stateDir, {
            fileType,
            filePath: path.join(stateDir, label),
            fromVersion: migrated.fromVersion,
            toVersion: migrated.toVersion,
            success: false,
            reason: migrated.reason
          });
          if (migrated.reason === MIGRATION_REASON.UNKNOWN_FUTURE_VERSION) {
            const detail = `${label}: unknown future schemaVersion (${migrated.fromVersion}) — fail-closed`;
            degradedReasons.push(detail);
            await appendProgress(config,
              `[STARTUP] WARNING: ${label} has unknown future schemaVersion (${migrated.fromVersion}) — treating as degraded to avoid data corruption`
            );
            await appendAlert(config, {
              severity: ALERT_SEVERITY.CRITICAL,
              source: "orchestrator",
              title: `Unknown future schemaVersion in ${label}`,
              message: `reason=${migrated.reason} fromVersion=${migrated.fromVersion}`
            });
          }
          // Use default fallback for this file (do not use unmigratable data)
          if (label === "worker_sessions.json") sessions = defaultFallback;
          if (label === "prometheus_analysis.json") prometheusAnalysis = defaultFallback;
          continue;
        }
        // Record telemetry only for actual migrations performed (not ALREADY_CURRENT)
        if (migrated.reason === MIGRATION_REASON.OK) {
          await recordMigrationTelemetry(stateDir, {
            fileType,
            filePath: path.join(stateDir, label),
            fromVersion: migrated.fromVersion,
            toVersion: migrated.toVersion,
            success: true,
            reason: migrated.reason
          });
        }
        if (label === "worker_sessions.json") sessions = migrated.data;
        if (label === "prometheus_analysis.json") prometheusAnalysis = migrated.data;
        continue;
      }
    } else if (result.reason === READ_JSON_REASON.MISSING) {
      // Expected on first run — use fallback silently
    } else {
      // Invalid JSON in a critical state file — record degraded reason and emit telemetry
      const detail = `${label}: ${result.error?.message || "parse error"}`;
      degradedReasons.push(detail);
      await appendProgress(config,
        `[STARTUP] CRITICAL: corrupt state file ${label} (reason=invalid) — entering degraded mode`
      );
      await appendAlert(config, {
        severity: ALERT_SEVERITY.CRITICAL,
        source: "orchestrator",
        title: `Corrupt critical state file: ${label}`,
        message: `reason=invalid error=${result.error?.message || "parse error"}`
      });
    }
    if (label === "worker_sessions.json") sessions = result.ok ? result.data : defaultFallback;
    if (label === "jesus_directive.json") jesusDirective = result.ok ? result.data : defaultFallback;
    if (label === "prometheus_analysis.json") prometheusAnalysis = result.ok ? result.data : defaultFallback;
  }

  if (degradedReasons.length > 0) {
    await writeOrchestratorHealth(stateDir, ORCHESTRATOR_STATUS.DEGRADED, "corrupt_state_files", degradedReasons);
    await appendProgress(config, `[STARTUP] orchestratorStatus=degraded reasons: ${degradedReasons.join("; ")}`);
  } else {
    await writeOrchestratorHealth(stateDir, ORCHESTRATOR_STATUS.OPERATIONAL, null);
  }

  return { sessions, jesusDirective, prometheusAnalysis, degraded: degradedReasons.length > 0 };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Attempt to start the dashboard server alongside the daemon (non-blocking, non-fatal). */
async function tryStartDashboard() {
  try {
    const { startDashboard } = await import("../dashboard/live_dashboard.js");
    startDashboard();
  } catch (err) {
    warn(`[orchestrator] dashboard auto-start failed (non-fatal): ${String(err?.message || err)}`);
  }
}

export async function runDaemon(config) {
  const liveConfig = Object.assign({}, config);
  const pid = process.pid;
  const stateDir = liveConfig.paths?.stateDir || "state";
  await writeDaemonPid(liveConfig, pid);
  await appendProgress(liveConfig, `[BOX] Daemon started pid=${pid}`);

  await tryStartDashboard();

  process.on("SIGTERM", async () => {
    await appendProgress(liveConfig, "[BOX] SIGTERM received, stopping");
    await clearDaemonPid(liveConfig);
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await appendProgress(liveConfig, "[BOX] SIGINT received, stopping");
    await clearDaemonPid(liveConfig);
    process.exit(0);
  });

  // ── Checkpoint-based startup: clean up leftover .tmp files, then audit ──
  {
    const cleanupResult = await cleanupStaleTempFiles(stateDir);
    if (cleanupResult.removed.length > 0) {
      await appendProgress(liveConfig, `[STARTUP] Cleaned up ${cleanupResult.removed.length} stale temp file(s): ${cleanupResult.removed.join(", ")}`);
    }
    if (!cleanupResult.ok) {
      warn(`[orchestrator] stale-temp cleanup failed (non-fatal): ${String(cleanupResult.error?.message || cleanupResult.error)}`);
    }
  }

  // ── Checkpoint-based startup: audit critical state files, then resume ──
  const { sessions, jesusDirective, prometheusAnalysis } =
    await auditCriticalStateFiles(liveConfig, stateDir);

  // Reset zombie workers (stale > 2× timeout)
  const workerTimeoutMs = Number(liveConfig.runtime?.workerTimeoutMinutes || 30) * 60 * 1000;
  const staleThresholdMs = workerTimeoutMs * 2;
  const now = Date.now();
  let zombieReset = false;
  const knownRoles = Object.values(getRoleRegistry(liveConfig).workers).map((w: any) => w.name);
  for (const roleName of knownRoles) {
    const perWorkerPath = path.join(stateDir, `worker_${roleName.toLowerCase().replace(/\s+/g, "_")}.json`);
    const perWorker = await readJson(perWorkerPath, null);
    if (perWorker?.status === "working" && perWorker?.startedAt) {
      const age = now - new Date(perWorker.startedAt).getTime();
      if (age > staleThresholdMs) {
        perWorker.status = "idle";
        perWorker.startedAt = null;
        await writeJson(perWorkerPath, perWorker);
        if (sessions[roleName]) {
          sessions[roleName].status = "idle";
          sessions[roleName].startedAt = null;
        }
        zombieReset = true;
        await appendProgress(liveConfig, `[STARTUP] Reset zombie worker ${roleName} (stale ${Math.round(age / 60000)}min)`);
      }
    }
  }
  if (zombieReset) {
    await writeJson(path.join(stateDir, "worker_sessions.json"), addSchemaVersion(sessions, STATE_FILE_TYPE.WORKER_SESSIONS));
  }

  const activeWorkers = Object.entries(sessions)
    .filter(([, s]) => s?.status === "working")
    .map(([name]) => name);

  const hasCheckpoint = prometheusAnalysis?.analyzedAt || (jesusDirective && jesusDirective.decidedAt);

  if (activeWorkers.length > 0) {
    await appendProgress(liveConfig,
      `[STARTUP] Resuming — ${activeWorkers.length} workers active (${activeWorkers.join(", ")}). Waiting for them.`
    );
  } else if (!hasCheckpoint) {
    await appendProgress(liveConfig, "[STARTUP] No checkpoint found — first run, Jesus activating");
    await capturePreWorkBaseline(liveConfig);
  } else {
    await appendProgress(liveConfig, "[STARTUP] Resuming from checkpoint — entering main loop");
  }

  await mainLoop(liveConfig);
}

// Stub: checks dispatch_checkpoint.json for an in-flight dispatching state.
// Reserved for future recovery path — prefixed _wasDispatchInterrupted to satisfy
// no-unused-vars until the dispatch recovery flow calls it.
async function _wasDispatchInterrupted(_stateDir: string): Promise<boolean> {
  return false;
}

const DISPATCH_CHECKPOINT_FILE = "dispatch_checkpoint.json";

async function readDispatchCheckpoint(config) {
  try {
    return await readVersionedCheckpoint(config, { fileName: DISPATCH_CHECKPOINT_FILE });
  } catch (err) {
    warn(`[orchestrator] dispatch checkpoint read failed: ${String(err?.message || err)}`);
    return null;
  }
}

async function writeDispatchCheckpoint(config, checkpoint) {
  const persisted = await writeVersionedCheckpoint(config, checkpoint, {
    fileName: DISPATCH_CHECKPOINT_FILE,
    checkpointKind: "dispatch",
    returnEnvelope: true,
  });
  if (checkpoint && typeof checkpoint === "object") {
    Object.assign(checkpoint, persisted);
  }
  return persisted;
}

function isDispatchCheckpointResumable(checkpoint) {
  if (!checkpoint || checkpoint.status !== "dispatching") return false;
  const totalPlans = Number(checkpoint.totalPlans || 0);
  const completedPlans = Number(checkpoint.completedPlans || 0);
  return totalPlans > 0 && completedPlans < totalPlans;
}

function isDispatchCheckpointCompleteForTotal(checkpoint, totalPlans) {
  if (!checkpoint || checkpoint.status !== "complete") return false;
  if (Number(checkpoint.totalPlans || 0) !== Number(totalPlans || 0)) return false;
  return Number(checkpoint.completedPlans || 0) >= Number(totalPlans || 0);
}

async function beginDispatchCheckpoint(config, plans, actualPlanCount?: number) {
  const nowIso = new Date().toISOString();
  const checkpoint = initializeRunSegmentState({
    schemaVersion: 2,
    status: "dispatching",
    createdAt: nowIso,
    updatedAt: nowIso,
    totalPlans: Array.isArray(plans) ? plans.length : 0,
    // planCount stores actual Prometheus plan count (totalPlans stores batch count)
    planCount: Number.isFinite(actualPlanCount) ? actualPlanCount : (Array.isArray(plans) ? plans.length : 0),
    completedPlans: 0
  }, {
    spanBatches: Number(config?.runtime?.runSegmentBatchSpan || RUN_SEGMENT_BATCH_SPAN_DEFAULT),
    historyMax: Number(config?.runtime?.runSegmentHistoryMax || RUN_SEGMENT_HISTORY_MAX_DEFAULT),
  });
  await writeDispatchCheckpoint(config, checkpoint);
  return checkpoint;
}

async function updateDispatchCheckpointProgress(config, checkpoint, completedPlans) {
  if (!checkpoint) return { rolledOver: false, activeSegment: null, previousSegment: null, historySize: 0 };
  checkpoint.completedPlans = Math.max(0, Math.min(Number(completedPlans || 0), Number(checkpoint.totalPlans || 0)));
  checkpoint.updatedAt = new Date().toISOString();
  const rolloverResult = applyRunSegmentRollover(checkpoint, {
    completedBatches: checkpoint.completedPlans,
    spanBatches: Number(config?.runtime?.runSegmentBatchSpan || RUN_SEGMENT_BATCH_SPAN_DEFAULT),
    historyMax: Number(config?.runtime?.runSegmentHistoryMax || RUN_SEGMENT_HISTORY_MAX_DEFAULT),
  });
  Object.assign(checkpoint, rolloverResult.checkpoint);
  await writeDispatchCheckpoint(config, checkpoint);
  return {
    rolledOver: rolloverResult.rolledOver,
    activeSegment: rolloverResult.activeSegment || null,
    previousSegment: rolloverResult.previousSegment || null,
    historySize: Array.isArray(checkpoint.runSegmentHistory) ? checkpoint.runSegmentHistory.length : 0,
  };
}

async function completeDispatchCheckpoint(config, checkpoint) {
  if (!checkpoint) return;
  checkpoint.status = "complete";
  checkpoint.completedPlans = Number(checkpoint.totalPlans || 0);
  checkpoint.updatedAt = new Date().toISOString();
  await writeDispatchCheckpoint(config, checkpoint);
}

async function failCloseDispatchCheckpoint(config, checkpoint, detail: {
  reasonCode?: string | null;
  retryClass?: string | null;
  workerStatus?: string | null;
  batchIndex?: number | null;
  totalBatches?: number | null;
}) {
  if (!checkpoint) return;
  checkpoint.status = "failed_closed";
  checkpoint.updatedAt = new Date().toISOString();
  checkpoint.failClose = {
    failedAt: checkpoint.updatedAt,
    reasonCode: detail?.reasonCode || null,
    retryClass: detail?.retryClass || null,
    workerStatus: detail?.workerStatus || null,
    batchIndex: Number.isFinite(Number(detail?.batchIndex)) ? Number(detail?.batchIndex) : null,
    totalBatches: Number.isFinite(Number(detail?.totalBatches)) ? Number(detail?.totalBatches) : null,
  };
  await writeDispatchCheckpoint(config, checkpoint);
}

function isDispatchOutcomeSuccessful(workerResult) {
  const status = String(workerResult?.status || "").toLowerCase();
  return status === "partial" || isAnalyticsCompletedWorkerStatus(status);
}

function shouldFailCloseDispatchOutcome(workerResult) {
  const status = String(workerResult?.status || "").toLowerCase();
  if (status !== "error" && status !== "blocked") return false;
  const retryClass = String(workerResult?.retryClass || "").toLowerCase();
  const reasonCode = String(workerResult?.reasonCode || "").toUpperCase();
  return retryClass === "no_retry" || reasonCode === "WIN32_PROCESS_TERMINATED";
}

async function tryResumeDispatchFromCheckpoint(config, options: { force?: boolean } = {}) {
  const stateDir = config.paths?.stateDir || "state";
  const force = options?.force === true;
  const activeWorkers = await hasActiveWorkersAsync(config);
  if (activeWorkers) return false;

  const athenaReview = await readJson(path.join(stateDir, "athena_plan_review.json"), null);
  const prometheusAnalysis = await readJson(path.join(stateDir, "prometheus_analysis.json"), null);
  const plans = Array.isArray(athenaReview?.patchedPlans) && athenaReview.patchedPlans.length > 0
    ? athenaReview.patchedPlans
    : (Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans : []);
  if (!athenaReview?.approved || plans.length === 0) return false;
  const _normalizedPlansResume = plans.map((p: any) => {
    const resolved = resolveWorkerRole(p?.role, p?.taskKind || p?.kind || "implementation");
    return resolved !== (p?.role || "") ? { ...p, role: resolved } : p;
  });
  const _rawWorkerBatchesResume = buildRoleExecutionBatches(_normalizedPlansResume, config);
  // ── Final dispatch-boundary hard cap (resume path) ───────────────────────
  // Applied unconditionally so no resumed batch exceeds MAX_ACTIONABLE_STEPS_PER_PACKET,
  // regardless of which batching path produced it.
  const workerBatches = applyDispatchBoundaryHardCap(_rawWorkerBatchesResume as any[]) as typeof _rawWorkerBatchesResume;
  if (workerBatches.length === 0) return false;

  let checkpoint = await readDispatchCheckpoint(config);
  const checkpointMatchesTotal = Number(checkpoint?.totalPlans || 0) === workerBatches.length;

  if (!force && isDispatchCheckpointCompleteForTotal(checkpoint, workerBatches.length)) {
    return false;
  }

  if (!isDispatchCheckpointResumable(checkpoint)) {
    if (!force && checkpoint && checkpoint.status === "complete" && checkpointMatchesTotal) {
      return false;
    }
    checkpoint = await beginDispatchCheckpoint(config, workerBatches, plans.length);
  }

  const startIndex = Math.max(0, Math.min(Number(checkpoint.completedPlans || 0), workerBatches.length));
  if (startIndex >= workerBatches.length) {
    await completeDispatchCheckpoint(config, checkpoint);
    return false;
  }

  // Pre-dispatch governance gate — same checks as runSingleCycle to prevent
  // resuming into a frozen/canary-breached/guardrail-paused state.
  const resumeCycleId = `resume-${Date.now()}`;
  try {
    const gateDecision = await evaluatePreDispatchGovernanceGate(config, plans, resumeCycleId);
    emitEvent(EVENTS.GOVERNANCE_GATE_EVALUATED, EVENT_DOMAIN.GOVERNANCE, resumeCycleId, {
      blocked: gateDecision.blocked,
      reason: gateDecision.reason || null,
      inputSnapshot: { planCount: plans.length, resumedFromCheckpoint: true, startIndex }
    });
    if (gateDecision.blocked) {
      const reasonMsg = gateDecision.dispatchBlockReason || gateDecision.reason || "pre_dispatch_gate_blocked";
      await appendProgress(config,
        `[RESUME] Pre-dispatch governance gate blocked resumed dispatch — reason=${reasonMsg}`
      );
      await appendAlert(config, {
        severity: ALERT_SEVERITY.HIGH,
        source: "orchestrator",
        title: "Resumed worker dispatch blocked by pre-dispatch governance gate",
        message: `reason=${reasonMsg} action=${gateDecision.action || "none"} cycleId=${resumeCycleId}`
      });
      return true;
    }
  } catch (err) {
    warn(`[orchestrator] Pre-dispatch governance gate failed during resume (non-fatal): ${String(err?.message || err)}`);
    emitEvent(EVENTS.ORCHESTRATION_HEALTH_DEGRADED, EVENT_DOMAIN.ORCHESTRATION, resumeCycleId, {
      reason: "governance_gate_exception",
      error: String(err?.message || err),
      context: "resume_dispatch"
    });
  }

  await appendProgress(config,
    force
      ? `[RESUME] Force-resuming dispatch checkpoint: batch ${startIndex + 1}/${workerBatches.length}`
      : checkpointMatchesTotal
        ? `[RESUME] Resuming dispatch checkpoint: batch ${startIndex + 1}/${workerBatches.length}`
        : `[RESUME] Existing approved plan detected — dispatching from batch ${startIndex + 1}/${workerBatches.length} without replanning`
  );

  await safeUpdatePipelineProgress(config, "workers_dispatching", `Resuming dispatch from batch ${startIndex + 1}/${workerBatches.length}`, {
    workersTotal: workerBatches.length,
    workersDone: startIndex,
    resumedFromCheckpoint: true,
    forcedResume: force
  });

  // ── Strict wave boundary tracking (resume path) ──────────────────────────
  // Mirror the same wave-boundary gate used in the primary dispatch path.
  // Initialise from the wave of the last completed batch if we are resuming
  // mid-run, so the first crossing event accurately reflects the transition.
  let resumeCurrentWave: number | null = startIndex > 0
    ? (typeof (workerBatches[startIndex - 1] as any)?.wave === "number"
       ? (workerBatches[startIndex - 1] as any).wave : null)
    : null;
  const resumeRetryTelemetry = await loadRetryTelemetryContext(config);
  const resumeArtifactCycleId = normalizeCycleId((await readPipelineProgress(config).catch(() => null))?.startedAt || checkpoint?.createdAt);

  for (let index = startIndex; index < workerBatches.length; index += 1) {
    const stopReq = await readStopRequest(config);
    if (stopReq?.requestedAt) {
      await appendProgress(config, `[RESUME] Stop requested — checkpoint preserved at batch ${index + 1}/${workerBatches.length}`);
      return true;
    }

    const batch = workerBatches[index];

    // ── Wave boundary gate (resume) ────────────────────────────────────────
    const resumeBatchWave = typeof (batch as any).wave === "number" ? (batch as any).wave : null;
    if (resumeBatchWave !== null && resumeBatchWave !== resumeCurrentWave) {
      if (resumeCurrentWave !== null) {
        await appendProgress(config,
          `[WAVE_BOUNDARY] Wave ${resumeCurrentWave} complete — all batches succeeded. Crossing to wave ${resumeBatchWave}.`
        );
      }
      resumeCurrentWave = resumeBatchWave;
      await appendProgress(config,
        `[WAVE_BOUNDARY] Starting wave ${resumeBatchWave} — batch ${index + 1}/${workerBatches.length}`
      );
    }

    await safeUpdatePipelineProgress(config, "workers_running", `Resumed worker batch ${index + 1}/${workerBatches.length}: ${batch.role}`, {
      workersTotal: workerBatches.length,
      workersDone: index,
      currentWorker: batch.role,
      resumedFromCheckpoint: true,
      forcedResume: force
    });

    let workerResult;
    let transientRetries = 0;
    await persistWorkerDispatchArtifacts(config, {
      cycleId: resumeArtifactCycleId,
      role: String(batch?.role || ""),
      phase: "start",
      batch,
    });
    for (;;) {
      try {
        workerResult = await dispatchWorker(config, batch);
      } catch (err) {
        const msg = String(err?.message || err).slice(0, 200);
        await appendProgress(config, `[RESUME] Worker ${batch.role} failed: ${msg}`);
        warn(`[orchestrator] resumed worker dispatch error: ${msg}`);
        workerResult = { roleName: batch.role, status: "error", summary: msg };
      }

      // Auto-retry on transient API errors with escalating cooldown
      const isTransient = String(workerResult?.status || "") === "transient_error";
      const retryDecision = isTransient
        ? assessRetryExpectedROI({
            attempt: transientRetries + 1,
            maxRetries: MAX_TRANSIENT_RETRIES,
            taskKind: String((batch as any)?.taskKind || "implementation"),
            premiumUsageData: resumeRetryTelemetry.premiumUsageData,
            benchmarkGroundTruth: resumeRetryTelemetry.benchmarkGroundTruth,
            minExpectedGain: Number(config?.runtime?.retryRoiMinExpectedGain ?? 0.18),
          })
        : null;
      if (isTransient && retryDecision?.allowRetry) {
        transientRetries++;
        const cooldownMs = transientRetries * 3 * 60 * 1000; // 3min, 6min, 9min
        await appendProgress(config,
          `[RESUME] Transient API error — retry ${transientRetries}/${MAX_TRANSIENT_RETRIES}, expected_gain=${retryDecision.expectedGain.toFixed(3)} (threshold=${retryDecision.threshold.toFixed(3)}), cooling down ${Math.round(cooldownMs / 1000)}s`
        );
        await sleep(cooldownMs);
        continue;
      }
      if (isTransient && retryDecision && !retryDecision.allowRetry) {
        await appendProgress(
          config,
          `[RESUME] Transient API error — retry suppressed (low ROI): expected_gain=${retryDecision.expectedGain.toFixed(3)} threshold=${retryDecision.threshold.toFixed(3)} reason=${retryDecision.reason}`
        );
      }
      break;
    }
    await persistWorkerDispatchArtifacts(config, {
      cycleId: resumeArtifactCycleId,
      role: String(batch?.role || ""),
      phase: "complete",
      batch,
      workerResult,
    });

    if (!isDispatchOutcomeSuccessful(workerResult)) {
      if (shouldFailCloseDispatchOutcome(workerResult)) {
        await failCloseDispatchCheckpoint(config, checkpoint, {
          reasonCode: workerResult?.reasonCode || null,
          retryClass: workerResult?.retryClass || null,
          workerStatus: workerResult?.status || null,
          batchIndex: index + 1,
          totalBatches: workerBatches.length,
        });
        await appendProgress(config,
          `[RESUME][FAIL_CLOSE] Worker batch ${index + 1}/${workerBatches.length} ended with status=${workerResult?.status || "unknown"} reason_code=${workerResult?.reasonCode || "unknown"} retry_class=${workerResult?.retryClass || "none"}; checkpoint marked failed_closed (no retry)`
        );
        await safeUpdatePipelineProgress(config, "cycle_complete", `Resumed dispatch fail-closed at batch ${index + 1}/${workerBatches.length}`, {
          workersTotal: workerBatches.length,
          workersDone: index,
          resumedFromCheckpoint: true,
          forcedResume: force,
        });
        return true;
      }
      await appendProgress(config,
        `[RESUME] Worker batch ${index + 1}/${workerBatches.length} ended with status=${workerResult?.status || "unknown"}; checkpoint not advanced so it can be retried`
      );
      return true;
    }

    await waitForWorkersToFinish(config);
    const resumeCheckpointUpdate = await updateDispatchCheckpointProgress(config, checkpoint, index + 1);
    if (resumeCheckpointUpdate.rolledOver && resumeCheckpointUpdate.activeSegment && resumeCheckpointUpdate.previousSegment) {
      await appendProgress(
        config,
        `[RUN_SEGMENT] rollover complete: segment ${String((resumeCheckpointUpdate.previousSegment as any).segmentIndex)} -> ${String((resumeCheckpointUpdate.activeSegment as any).segmentIndex)}`
      );
      await safeUpdatePipelineProgress(config, "workers_running", `Run segment rollover to ${String((resumeCheckpointUpdate.activeSegment as any).segmentIndex)}`, {
        workersTotal: workerBatches.length,
        workersDone: index + 1,
        resumedFromCheckpoint: true,
        forcedResume: force,
        runSegment: resumeCheckpointUpdate.activeSegment,
        runSegmentRollover: resumeCheckpointUpdate.previousSegment,
        runSegmentHistorySize: resumeCheckpointUpdate.historySize,
      });
    }

    // Inter-batch rate-limit cooldown to avoid transient API errors
    const resumeDelay = Number(config?.runtime?.interBatchDelayMs || 90000);
    if (index + 1 < workerBatches.length && resumeDelay > 0) {
      await appendProgress(config, `[RESUME] Inter-batch cooldown ${Math.round(resumeDelay / 1000)}s to avoid rate limits`);
      await sleep(resumeDelay);
    }
  }

  await completeDispatchCheckpoint(config, checkpoint);

  await safeUpdatePipelineProgress(config, "workers_finishing", "All resumed workers finishing up", {
    workersTotal: workerBatches.length,
    workersDone: workerBatches.length,
    resumedFromCheckpoint: true,
    forcedResume: force
  });

  await appendProgress(config, `[RESUME] Resumed dispatch complete — ${workerBatches.length} batch(es) processed`);
  await safeUpdatePipelineProgress(config, "cycle_complete", `Resumed cycle complete — ${workerBatches.length} batch(es)`, {
    workersTotal: workerBatches.length,
    workersDone: workerBatches.length,
    resumedFromCheckpoint: true,
    forcedResume: force
  });

  return true;
}

export async function runOnce(config) {
  const stateDir = config.paths?.stateDir || "state";
  await fs.mkdir(stateDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(stateDir, "live_worker_jesus.log"), "[leadership_live]\n[run_once] Jesus live log ready...\n", "utf8"),
    fs.writeFile(path.join(stateDir, "live_worker_athena.log"), "[leadership_live]\n[run_once] Athena live log ready...\n", "utf8"),
    initializeAggregateLiveLog(stateDir, "run_once")
  ]);

  await runSingleCycle(config);
}

export async function runResumeDispatch(config) {
  const stateDir = config.paths?.stateDir || "state";
  await fs.mkdir(stateDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(stateDir, "live_worker_jesus.log"), "[leadership_live]\n[resume] Jesus live log ready...\n", "utf8"),
    fs.writeFile(path.join(stateDir, "live_worker_athena.log"), "[leadership_live]\n[resume] Athena live log ready...\n", "utf8"),
    initializeAggregateLiveLog(stateDir, "resume")
  ]);

  const resumed = await tryResumeDispatchFromCheckpoint(config, { force: true });
  if (!resumed) {
    throw new Error("No resumable Step-4 checkpoint found (approved Athena review + plans required)");
  }
}

export async function runRebase(_config, _opts: Record<string, unknown> = {}) {
  return { triggered: false, reason: "not applicable in athena-gated architecture" };
}

export async function processEscalationQueueClosureWorkflow(config) {
  const closure = await processEscalationQueueClosures(config);
  if (closure.resolvedCount > 0) {
    await appendProgress(
      config,
      `[LOOP] Escalation closure workflow resolved ${closure.resolvedCount} item(s): ${closure.resolvedFingerprints.join(", ")}`
    );
  }
  if (closure.replayUpdatedCount > 0) {
    await appendProgress(
      config,
      `[LOOP] Escalation replay actions updated for ${closure.replayUpdatedCount} unresolved item(s)`
    );
  }
  return closure;
}

// ── Loop intervals ────────────────────────────────────────────────────────────
const WORKERS_DONE_POLL_MS = 30 * 1000;

function roleToWorkerStateFile(role) {
  const slug = String(role || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `worker_${slug}.json`;
}

type WorkerCycleRecord = {
  cycleId: string;
  status: string;
  updatedAt: string;
  workerSessions: Record<string, any>;
  workerActivity: Record<string, any[]>;
  completedTaskIds: string[];
};

function normalizeCycleId(value: unknown): string {
  const v = String(value || "").trim();
  return v || `cycle-${Date.now()}`;
}

function extractPlanTaskIds(planLike: any): string[] {
  const plans = Array.isArray(planLike?.plans) ? planLike.plans : [planLike];
  const ids: string[] = plans
    .map((p: any) => String(p?.task_id || p?.id || "").trim())
    .filter(Boolean);
  return [...new Set<string>(ids)];
}

function toLegacySessionsBody(rawSessions: unknown): Record<string, any> {
  if (!rawSessions || typeof rawSessions !== "object" || Array.isArray(rawSessions)) return {};
  const out = { ...(rawSessions as Record<string, any>) };
  delete (out as any).schemaVersion;
  return out;
}

async function loadWorkerCycleArtifact(stateDir: string): Promise<{ payload: Record<string, any>; migrated: boolean }> {
  const artifactPath = path.join(stateDir, WORKER_CYCLE_ARTIFACTS_FILE);
  const raw = await readJsonSafe(artifactPath);
  if (!raw.ok) {
    return {
      payload: {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        latestCycleId: null,
        cycles: {},
      },
      migrated: false,
    };
  }
  const migrated = migrateWorkerCycleArtifacts(raw.data);
  if (!migrated.ok || !migrated.data) {
    warn(
      `[orchestrator] worker cycle artifact invalid; resetting canonical file: reason=${migrated.reason} fromVersion=${String(migrated.fromVersion)}`
    );
    return {
      payload: {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        latestCycleId: null,
        cycles: {},
      },
      migrated: false,
    };
  }
  return { payload: migrated.data as Record<string, any>, migrated: migrated.reason === "ok" };
}

async function persistWorkerDispatchArtifacts(config, input: {
  cycleId: string;
  role: string;
  phase: "start" | "complete" | "recovery";
  batch?: any;
  workerResult?: any;
  recoveredSignal?: string;
}) {
  const stateDir = config?.paths?.stateDir || "state";
  const nowIso = new Date().toISOString();
  const cycleId = normalizeCycleId(input.cycleId);
  const role = String(input.role || "").trim();
  if (!role) return;

  const loaded = await loadWorkerCycleArtifact(stateDir);
  const payload = loaded.payload;
  const cycles = payload.cycles && typeof payload.cycles === "object" && !Array.isArray(payload.cycles)
    ? payload.cycles as Record<string, any>
    : {};
  payload.cycles = cycles;
  payload.latestCycleId = cycleId;
  payload.updatedAt = nowIso;

  const existing = cycles[cycleId] && typeof cycles[cycleId] === "object" ? cycles[cycleId] : {};
  const cycleRecord: WorkerCycleRecord = {
    cycleId,
    status: String(existing.status || "dispatching"),
    updatedAt: nowIso,
    workerSessions: existing.workerSessions && typeof existing.workerSessions === "object" && !Array.isArray(existing.workerSessions)
      ? existing.workerSessions
      : {},
    workerActivity: existing.workerActivity && typeof existing.workerActivity === "object" && !Array.isArray(existing.workerActivity)
      ? existing.workerActivity
      : {},
    completedTaskIds: Array.isArray(existing.completedTaskIds)
      ? [...new Set<string>((existing.completedTaskIds as unknown[]).map((id) => String(id || "").trim()).filter(Boolean))]
      : [],
  };

  if (!cycleRecord.workerActivity[role]) cycleRecord.workerActivity[role] = [];
  if (!cycleRecord.workerSessions[role]) cycleRecord.workerSessions[role] = {};
  const session = cycleRecord.workerSessions[role];
  const taskIds = extractPlanTaskIds(input.batch);

  if (input.phase === "start") {
    session.status = "working";
    session.startedAt = nowIso;
    session.updatedAt = nowIso;
    cycleRecord.workerActivity[role].push({
      at: nowIso,
      status: "working",
      task: String(input.batch?.task || input.batch?.title || ""),
      taskIds,
      wave: Number.isFinite(Number(input.batch?.wave)) ? Number(input.batch.wave) : null,
    });
  } else if (input.phase === "complete") {
    const status = String(input.workerResult?.status || "unknown").toLowerCase();
    session.status = "idle";
    session.lastStatus = status;
    session.updatedAt = nowIso;
    if (!session.startedAt) session.startedAt = null;
    cycleRecord.workerActivity[role].push({
      at: nowIso,
      status,
      task: String(input.batch?.task || input.batch?.title || ""),
      taskIds,
      pr: input.workerResult?.pr || null,
      dispatchBlockReason: input.workerResult?.dispatchBlockReason || null,
      wave: Number.isFinite(Number(input.batch?.wave)) ? Number(input.batch.wave) : null,
    });
    if (status === "done" || status === "success") {
      cycleRecord.completedTaskIds = [...new Set([...cycleRecord.completedTaskIds, ...taskIds])];
    }
  } else {
    session.status = "idle";
    session.updatedAt = nowIso;
    cycleRecord.workerActivity[role].push({
      at: nowIso,
      status: "recovered",
      signal: String(input.recoveredSignal || "stale"),
      taskIds: [],
      wave: null,
    });
  }

  cycles[cycleId] = cycleRecord;
  await writeJson(path.join(stateDir, WORKER_CYCLE_ARTIFACTS_FILE), payload);

  // Compatibility snapshots for existing consumers.
  const sessionsPath = path.join(stateDir, "worker_sessions.json");
  const legacySessionsRaw = await readJson(sessionsPath, {});
  const legacySessions = toLegacySessionsBody(legacySessionsRaw);
  legacySessions[role] = cycleRecord.workerSessions[role];
  await writeJson(sessionsPath, addSchemaVersion(legacySessions, STATE_FILE_TYPE.WORKER_SESSIONS));

  const workerPath = path.join(stateDir, roleToWorkerStateFile(role));
  const existingWorkerState = await readJson(workerPath, {});
  const existingActivity = Array.isArray(existingWorkerState?.activityLog) ? existingWorkerState.activityLog : [];
  const latestEntry = cycleRecord.workerActivity[role][cycleRecord.workerActivity[role].length - 1] || null;
  const nextActivity = latestEntry ? [...existingActivity, latestEntry] : existingActivity;
  await writeJson(workerPath, {
    ...(existingWorkerState && typeof existingWorkerState === "object" ? existingWorkerState : {}),
    status: cycleRecord.workerSessions[role]?.status || "idle",
    startedAt: cycleRecord.workerSessions[role]?.startedAt || null,
    updatedAt: nowIso,
    activityLog: nextActivity.slice(-200),
  });
}

function getLastWorkerReportedStatus(session, role) {
  const history = Array.isArray(session?.history) ? session.history : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (!entry) continue;
    if (role && entry.from && entry.from !== role) continue;
    const status = String(entry.status || "").toLowerCase();
    if (status) return status;
  }
  return "";
}

async function recoverStaleWorkerSessions(config, stateDir, sessions) {
  const recoveredRoles = [];
  const recoveredSignals = new Map<string, string>();

  for (const [role, session] of Object.entries(sessions || {}) as Array<[string, WorkerSessionRecord]>) {
    if (session?.status !== "working") continue;

    const reportedStatus = getLastWorkerReportedStatus(session, role);
    if (isTerminalWorkerStatus(reportedStatus)) {
      session.status = "idle";
      recoveredRoles.push(role);
      recoveredSignals.set(role, reportedStatus || "terminal-history");
      continue;
    }
  }

  if (recoveredRoles.length === 0) return false;

  await writeJson(path.join(stateDir, "worker_sessions.json"), addSchemaVersion(sessions, STATE_FILE_TYPE.WORKER_SESSIONS));
  const pipeline = await readPipelineProgress(config).catch(() => null);
  const cycleId = normalizeCycleId(pipeline?.startedAt);

  for (const role of recoveredRoles) {
    const workerStatePath = path.join(stateDir, roleToWorkerStateFile(role));
    const workerState = await readJson(workerStatePath, null);
    if (workerState && workerState.status === "working") {
      workerState.status = "idle";
      await writeJson(workerStatePath, workerState);
    }
    await persistWorkerDispatchArtifacts(config, {
      cycleId,
      role,
      phase: "recovery",
      recoveredSignal: recoveredSignals.get(role) || "stale",
    });
  }

  await appendProgress(
    config,
    `[LOOP] Recovered stale worker states (${recoveredRoles.length}): ${recoveredRoles.join(", ")}`
  );
  warn(`[orchestrator] Recovered stale worker states: ${recoveredRoles.join(", ")}`);
  return true;
}

async function hasActiveWorkersAsync(config) {
  try {
    const stateDir = config.paths?.stateDir || "state";
    const sessions = await readJson(path.join(stateDir, "worker_sessions.json"), {});
    await recoverStaleWorkerSessions(config, stateDir, sessions);
    return (Object.values(sessions) as WorkerSessionRecord[]).some(s => s?.status === "working");
  } catch { return false; }
}

async function waitForWorkersToFinish(config) {
  while (true) {
    const stopReq = await readStopRequest(config);
    if (stopReq?.requestedAt) {
      await appendProgress(config, `[LOOP] Stop requested while waiting workers: reason=${stopReq.reason || "unknown"}`);
      return false;
    }
    const stillActive = await hasActiveWorkersAsync(config);
    if (!stillActive) {
      await appendProgress(config, "[LOOP] All workers done — cycle complete");
      return true;
    }
    await sleep(WORKERS_DONE_POLL_MS);
  }
}

// ── Post-completion cleanup ──────────────────────────────────────────────────

async function postCompletionCleanup(config) {
  const repo = config.env?.targetRepo;
  const token = config.env?.githubToken;
  if (!repo || !token) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "BOX/1.0"
  };
  const base = `https://api.github.com/repos/${repo}`;

  try {
    const prsRes = await fetch(`${base}/pulls?state=open&per_page=50`, { headers });
    if (prsRes.ok) {
      const openPrsJson = await prsRes.json();
      const openPrs = Array.isArray(openPrsJson) ? openPrsJson as GithubPullRequestSummary[] : [];
      const mergedRes = await fetch(`${base}/pulls?state=closed&per_page=50&sort=updated&direction=desc`, { headers });
      const closedJson = mergedRes.ok ? await mergedRes.json() : [];
      const closedPrs = Array.isArray(closedJson) ? closedJson as GithubPullRequestSummary[] : [];
      const mergedTitles = closedPrs
        .filter(p => p.merged_at)
        .map(p => String(p.title || "").toLowerCase().trim());

      for (const pr of openPrs) {
        const title = String(pr.title || "").toLowerCase().trim();
        const branch = String(pr.head?.ref || "");
        // Only auto-close BOX-owned PRs with an exact title match against a merged PR.
        // Fuzzy/prefix matching is intentionally removed to prevent collateral closures.
        const isBoxBranch = ["box/", "wave", "pr-", "qa/", "scan/"].some(p => branch.startsWith(p));
        const isDuplicate = isBoxBranch && mergedTitles.some(mt => mt === title);
        if (isDuplicate) {
          await fetch(`${base}/pulls/${pr.number}`, {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ state: "closed" })
          });
          await fetch(`${base}/issues/${pr.number}/comments`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ body: "Duplicate of an already-merged PR. Auto-closed by BOX post-completion cleanup." })
          });
          await appendProgress(config, `[CLEANUP] Closed duplicate PR #${pr.number}: ${pr.title}`);
        }
      }
    }

    const branchesRes = await fetch(`${base}/branches?per_page=100`, { headers });
    if (branchesRes.ok) {
      const branchesJson = await branchesRes.json();
      const branches = Array.isArray(branchesJson) ? branchesJson as GithubBranchSummary[] : [];
      const openPrBranches = new Set();
      const openPrsRes = await fetch(`${base}/pulls?state=open&per_page=100`, { headers });
      if (openPrsRes.ok) {
        const opsJson = await openPrsRes.json();
        const ops = Array.isArray(opsJson) ? opsJson as GithubPullRequestSummary[] : [];
        for (const pr of ops) {
          if (pr.head?.ref) openPrBranches.add(pr.head.ref);
        }
      }

      const boxPrefixes = ["box/", "wave", "pr-", "qa/", "scan/"];
      for (const branch of branches) {
        const name = branch.name;
        if (name === "main" || name === "master" || name === "develop") continue;
        if (!boxPrefixes.some(p => name.startsWith(p))) continue;
        if (openPrBranches.has(name)) continue;

        try {
          const deleteRes = await fetch(`${base}/git/refs/heads/${encodeURIComponent(name)}`, {
            method: "DELETE",
            headers
          });
          if (deleteRes.ok) {
            await appendProgress(config, `[CLEANUP] Deleted stale branch: ${name}`);
          }
        } catch { /* non-fatal */ }
      }
    }

    await fetch(base, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ delete_branch_on_merge: true })
    });
  } catch (err) {
    warn(`[orchestrator] post-completion cleanup error: ${String(err?.message || err)}`);
  }
}

// ── Resolve logical plan role to actual worker agent ────────────────────────

const IMPLEMENTATION_WORKER = "evolution-worker";

// Roles that have agent files but lack implementation tools (read/edit/execute).
// Implementation tasks assigned to these roles must be redirected to evolution-worker.
const ANALYSIS_ONLY_ROLES = new Set(["athena", "prometheus", "jesus"]);

const ATHENA_REVIEW_CAPABLE_ROLES = new Set(["evolution-worker", "quality-worker", "athena", "prometheus"]);

function resolveWorkerRole(logicalRole, taskKind, taskText = "") {
  const role = String(logicalRole || "").toLowerCase().trim();
  const kind = String(taskKind || "").toLowerCase();
  const isImplementation = !kind || kind === "implementation";
  const isAthenaRelated = isAthenaReviewOrPostmortemTask(kind, taskText);

  // Analysis-only roles cannot execute implementation tasks — redirect to evolution-worker
  if (isImplementation && ANALYSIS_ONLY_ROLES.has(role)) return IMPLEMENTATION_WORKER;
  if (isAthenaRelated && !ATHENA_REVIEW_CAPABLE_ROLES.has(role)) return IMPLEMENTATION_WORKER;

  // If the role has a dedicated agent file with full tools, use it as-is
  const slug = nameToSlug(role);
  if (slug && agentFileExists(slug)) return logicalRole;

  // Fallback: all implementation tasks without a matching agent go to evolution-worker
  return IMPLEMENTATION_WORKER;
}

async function resolveRoleWithAccessFallback(config, roleName) {
  const normalizedRole = String(roleName || "").toLowerCase().trim();
  const canonicalRole = nameToSlug(normalizedRole) || normalizedRole;
  if (!canonicalRole || canonicalRole === IMPLEMENTATION_WORKER) return roleName;

  const stateDir = config?.paths?.stateDir || "state";
  const queueState = await readJson(path.join(stateDir, "escalation_queue.json"), { entries: [] });
  const entries = Array.isArray(queueState?.entries) ? queueState.entries : [];
  const hasUnresolvedAccessBlocked = entries.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    if (entry.resolved === true) return false;
    const roleRaw = String(entry.role || "").toLowerCase().trim();
    const role = nameToSlug(roleRaw) || roleRaw;
    const cls = String(entry.blockingReasonClass || "").toUpperCase().trim();
    return role === canonicalRole && cls === "ACCESS_BLOCKED";
  });

  return hasUnresolvedAccessBlocked ? IMPLEMENTATION_WORKER : roleName;
}

// ── Dispatch a single worker from a Prometheus plan item ───────────────────

async function dispatchWorker(config, plan) {
  // Resolve actual worker agent: plan.role is a logical category ("orchestrator", "athena", etc.).
  // Map roles without a dedicated .agent.md to "evolution-worker" for implementation tasks.
  const logicalRole = plan.role;
  const taskKind = plan.taskKind || plan.kind || "implementation";
  const batchPlans = Array.isArray(plan?.plans) ? plan.plans : null;
  const orderedBatchLines = batchPlans
    ? batchPlans.map((item, i) => {
        const title = String(item?.task || item?.title || `Task ${i + 1}`);
        const deps = Array.isArray(item?.dependencies)
          ? item.dependencies
          : Array.isArray(item?.dependsOn)
            ? item.dependsOn
            : [];
        const files = Array.isArray(item?.target_files)
          ? item.target_files
          : Array.isArray(item?.targetFiles)
            ? item.targetFiles
            : [];
        const depText = deps.length > 0 ? ` | dependsOn=${deps.map((d) => String(d)).join(", ")}` : "";
        const fileText = files.length > 0 ? ` | files=${files.slice(0, 5).map((f) => String(f)).join(", ")}` : "";
        return `${i + 1}. ${title}${depText}${fileText}`;
      }).join("\n")
    : "";
  const task = batchPlans
    ? `Execute this bundled work package in a single worker session.\nYou MUST execute tasks in exact numeric order (1 -> N).\nDo not parallelize steps inside this batch.\nDo not skip a step; if a step is blocked, stop and report blocked with the exact blocker.\n\nOrdered steps:\n${orderedBatchLines}`
    : plan.task;
  const resolvedRoleName = resolveWorkerRole(logicalRole, taskKind, task);
  const roleName = await resolveRoleWithAccessFallback(config, resolvedRoleName);
  if (roleName !== resolvedRoleName) {
    await appendProgress(
      config,
      `[DISPATCH] Access fallback reroute: ${resolvedRoleName} -> ${roleName} (unresolved ACCESS_BLOCKED escalation)`
    );
  }
  const contextBlocks: string[] = [];
  if (batchPlans) {
    for (let i = 0; i < batchPlans.length; i += 1) {
      const item = batchPlans[i];
      const taskLine = String(item?.task || item?.title || `Task ${i + 1}`);
      const ctxLine = String(item?.context || item?.scope || "").trim();
      const deps = Array.isArray(item?.dependencies)
        ? item.dependencies
        : Array.isArray(item?.dependsOn)
          ? item.dependsOn
          : [];
      const files = Array.isArray(item?.target_files)
        ? item.target_files
        : Array.isArray(item?.targetFiles)
          ? item.targetFiles
          : [];
      const depsLine = deps.length > 0 ? `\nDepends On: ${deps.map((d) => String(d)).join(", ")}` : "";
      const filesLine = files.length > 0 ? `\nTarget Files: ${files.map((f) => String(f)).join(", ")}` : "";
      const baseLine = ctxLine
        ? `Task ${i + 1}: ${taskLine}\nContext: ${ctxLine}${depsLine}${filesLine}`
        : `Task ${i + 1}: ${taskLine}${depsLine}${filesLine}`;
      const hydrated = await hydrateDispatchContextWithCiEvidence(config, item, baseLine);
      contextBlocks.push(hydrated);
    }
  }
  const context = batchPlans
    ? contextBlocks.join("\n\n")
    : await hydrateDispatchContextWithCiEvidence(config, plan, (plan.context || ""));
  const verification = batchPlans
    ? batchPlans.map((item, i) => {
        const rule = String(item?.verification || "").trim();
        return rule ? `${i + 1}. ${rule}` : "";
      }).filter(Boolean).join("\n")
    : (plan.verification || "");

  const capabilityCheck = assertRoleCapabilityForTask(config, roleName, taskKind, task);
  if (!capabilityCheck.allowed) {
    const summary = `Dispatch blocked by role capability check: ${capabilityCheck.code} — ${capabilityCheck.message}`;
    await appendProgress(config, `[DISPATCH] ${summary}`);
    emitEvent(EVENTS.ORCHESTRATION_HEALTH_DEGRADED, EVENT_DOMAIN.ORCHESTRATION, `role-capability-${Date.now()}`, {
      reason: "role_capability_check_failed",
      roleName,
      taskKind: String(taskKind || "unknown"),
      code: capabilityCheck.code,
      message: capabilityCheck.message,
    });
    return {
      roleName,
      status: "blocked",
      pr: null,
      summary,
      filesChanged: "",
      raw: summary,
      verificationEvidence: null,
      dispatchContract: {
        doneWorkerWithVerificationReportEvidence: false,
        dispatchBlockReason: `role_capability_check_failed:${capabilityCheck.code}`,
        replayClosure: buildReplayClosureEvidence(summary),
      },
      dispatchBlockReason: `role_capability_check_failed:${capabilityCheck.code}`,
    };
  }

  if (batchPlans) {
    const headline = String(batchPlans[0]?.task || batchPlans[0]?.title || "bundled tasks");
    await appendProgress(config, `[DISPATCH] Sending ${batchPlans.length} plan(s) to ${roleName}: ${headline}`);
  } else {
    await appendProgress(config, `[DISPATCH] Sending task to ${roleName}: ${task}`);
  }

  // ── Model routing telemetry: log expected-value ranking for this taskKind ────
  // Reads previous cycle analytics and logs which model is preferred for the
  // current task kind, respecting MIN_TELEMETRY_SAMPLE_THRESHOLD.  Non-blocking —
  // routing decision is advisory only; actual model selection is in worker_runner.
  try {
    const { readCycleAnalytics } = await import("./cycle_analytics.js");
    const prevAnalytics = await readCycleAnalytics(config);
    const candidates = [
      config?.copilot?.defaultModel || "Claude Sonnet 4.6",
      config?.copilot?.strongModel,
      config?.copilot?.efficientModel,
    ].filter((m): m is string => typeof m === "string" && m.length > 0);
    if (candidates.length > 0) {
      const routing = rankModelsByTaskKindExpectedValue(taskKind, candidates, prevAnalytics);
      if (routing.usedTelemetry) {
        await appendProgress(config,
          `[DISPATCH][MODEL_ROUTING] taskKind=${taskKind} preferredModel=${routing.rankedModels[0]} (telemetry-backed)`
        );
      }
    }
  } catch { /* non-critical — routing telemetry log must never block dispatch */ }

  const result = await runWorkerConversation(config, roleName, {
    task,
    context,
    verification,
    taskKind
  });

  const workerResult = {
    roleName,
    status: result?.status || "unknown",
    pr: result?.prUrl || null,
    summary: result?.summary || "",
    filesChanged: result?.filesTouched || "",
    raw: String(result?.fullOutput || "").slice(0, 3000),
    verificationEvidence: result?.verificationEvidence || null,
    dispatchContract: result?.dispatchContract || null,
    dispatchBlockReason: result?.dispatchContract?.dispatchBlockReason || null,
  };

  // Log worker dispatch to live agents log
  appendAggregateLiveLogSync(
    config.paths.stateDir,
    `worker:${workerResult.roleName}`,
    JSON.stringify(
      {
        status: workerResult.status,
        summary: workerResult.summary,
        pr: workerResult.pr,
        filesChanged: workerResult.filesChanged,
        wave: (plan as any)?.wave ?? null
      },
      null,
      2
    )
  );

  return workerResult;
}

// ── Count completed plans from worker state files ─────────────────────────

async function countCompletedPlans(config, plans) {
  const stateDir = config.paths?.stateDir || "state";

  const checkpoint = await readDispatchCheckpoint(config);
  // Match on planCount (actual plan count) if present, fall back to legacy totalPlans comparison
  const checkpointPlanCount = Number(checkpoint?.planCount ?? checkpoint?.totalPlans ?? 0);
  if (checkpoint && checkpointPlanCount === plans.length) {
    // When all batches have completed the checkpoint status is set to "complete"
    // and completedPlans is set to totalPlans (batch count). Treat that as all plans done.
    if (checkpoint.status === "complete") {
      return {
        completed: plans.map((plan) => ({ plan, workerState: null, lastLog: null })),
        pending: []
      };
    }
    // Otherwise use the batch-progress ratio to approximate plan progress
    const batchTotal = Number(checkpoint.totalPlans || 1);
    const batchDone = Math.min(Number(checkpoint.completedPlans || 0), batchTotal);
    const completedCount = Math.round((batchDone / batchTotal) * plans.length);
    return {
      completed: plans.slice(0, completedCount).map((plan) => ({ plan, workerState: null, lastLog: null })),
      pending: plans.slice(completedCount)
    };
  }

  // Fallback: inspect individual worker state files
  const completed = [];
  const pending = [];

  for (const plan of plans) {
    const role = String(plan.role || "").toLowerCase().replace(/\s+/g, "_");
    const workerFile = path.join(stateDir, `worker_${role}.json`);
    const ws = await readJson(workerFile, null);
    if (!ws) {
      pending.push(plan);
      continue;
    }
    const lastLog = Array.isArray(ws.activityLog) ? ws.activityLog[ws.activityLog.length - 1] : null;
    // Accept both "done" and "partial" — partial means work was submitted (PR opened)
    if (lastLog?.status === "done" || lastLog?.status === "partial") {
      completed.push({ plan, workerState: ws, lastLog });
    } else {
      pending.push(plan);
    }
  }

  return { completed, pending };
}

function hasExplicitPlanDependencies(plan: any): boolean {
  const dependsOn = Array.isArray(plan?.dependsOn) ? plan.dependsOn : [];
  const dependencies = Array.isArray(plan?.dependencies) ? plan.dependencies : [];
  const waveDepends = Array.isArray(plan?.waveDepends) ? plan.waveDepends : [];
  return dependsOn.length > 0 || dependencies.length > 0 || waveDepends.length > 0;
}

function getPlanOrderedStepComplexity(plan: any): number {
  const orderedSteps = Array.isArray(plan?.orderedSteps) ? plan.orderedSteps.length
    : Array.isArray(plan?.acceptance_criteria) ? plan.acceptance_criteria.length
    : 1;
  return Math.max(1, Number.isFinite(Number(orderedSteps)) ? Number(orderedSteps) : 1);
}

function splitBatchByOrderedStepComplexity(batch: any, cap: number): any[] {
  const plans = Array.isArray(batch?.plans) ? batch.plans : [];
  if (plans.length === 0) return [batch];
  const maxSteps = Math.max(1, Math.floor(cap));
  const chunks: any[][] = [];
  let current: any[] = [];
  let currentCost = 0;

  for (const plan of plans) {
    const cost = getPlanOrderedStepComplexity(plan);
    if (cost > maxSteps) {
      return [];
    }
    if (current.length > 0 && currentCost + cost > maxSteps) {
      chunks.push(current);
      current = [plan];
      currentCost = cost;
    } else {
      current.push(plan);
      currentCost += cost;
    }
  }
  if (current.length > 0) chunks.push(current);
  if (chunks.length <= 1) return [batch];

  return chunks.map((chunk, idx) => {
    const orderedStepCount = chunk.reduce((sum, p) => sum + getPlanOrderedStepComplexity(p), 0);
    return {
      ...batch,
      plans: chunk,
      orderedStepCount,
      bundleIndex: Number(batch?.bundleIndex || 1) + idx,
      _orderedStepComplexitySplit: true,
    };
  });
}

function tightenRoleWaveBatches(workerBatches: any[], config: any): { batches: any[]; mergedCount: number } {
  if (!Array.isArray(workerBatches) || workerBatches.length <= 1) {
    return { batches: Array.isArray(workerBatches) ? workerBatches : [], mergedCount: 0 };
  }
  const enabled = config?.runtime?.tightRoleWavePacking !== false;
  if (!enabled) return { batches: workerBatches, mergedCount: 0 };

  const maxMergedPlansRaw = Number(config?.runtime?.tightRoleWavePackingMaxMergedPlans ?? 3);
  const maxMergedPlans = Number.isFinite(maxMergedPlansRaw) && maxMergedPlansRaw > 0
    ? Math.floor(maxMergedPlansRaw)
    : 3;

  const compacted: any[] = [];
  let mergedCount = 0;

  for (const batch of workerBatches) {
    const currentPlans = Array.isArray(batch?.plans) ? batch.plans : [];
    if (compacted.length === 0) {
      compacted.push(batch);
      continue;
    }

    const prev = compacted[compacted.length - 1];
    const prevPlans = Array.isArray(prev?.plans) ? prev.plans : [];
    const sameRole = String(prev?.role || "") === String(batch?.role || "");
    const sameWave = Number(prev?.wave || 1) === Number(batch?.wave || 1);
    const withinPlanCap = prevPlans.length + currentPlans.length <= maxMergedPlans;
    const dependencySafe = [...prevPlans, ...currentPlans].every((p) => !hasExplicitPlanDependencies(p));
    const tokenCap = Number(prev?.usableContextTokens || 0) || Number(batch?.usableContextTokens || 0) || 0;
    const combinedTokens = Number(prev?.estimatedTokens || 0) + Number(batch?.estimatedTokens || 0);
    const withinTokenCap = tokenCap <= 0 || combinedTokens <= tokenCap;

    if (sameRole && sameWave && withinPlanCap && dependencySafe && withinTokenCap) {
      prev.plans = [...prevPlans, ...currentPlans];
      prev.estimatedTokens = combinedTokens;
      prev.contextUtilizationPercent = tokenCap > 0 ? Math.round((combinedTokens / tokenCap) * 100) : Number(prev?.contextUtilizationPercent || 0);
      mergedCount += 1;
      continue;
    }

    compacted.push(batch);
  }

  const roleTotals = new Map<string, number>();
  for (const batch of compacted) {
    const role = String(batch?.role || "evolution-worker");
    roleTotals.set(role, (roleTotals.get(role) || 0) + 1);
  }
  const roleIndices = new Map<string, number>();
  const reindexed = compacted.map((batch, index) => {
    const role = String(batch?.role || "evolution-worker");
    const roleIndex = (roleIndices.get(role) || 0) + 1;
    roleIndices.set(role, roleIndex);
    return {
      ...batch,
      bundleIndex: index + 1,
      totalBundles: compacted.length,
      roleBatchIndex: roleIndex,
      roleBatchTotal: roleTotals.get(role) || 1,
      githubFinalizer: roleIndex === (roleTotals.get(role) || 1),
    };
  });

  return { batches: reindexed, mergedCount };
}

async function resolveAdaptivePlanCap(config: any, stateDir: string): Promise<{ cap: number; reason: string }> {
  const enabled = config?.runtime?.adaptivePlanCap?.enabled !== false;
  if (!enabled) return { cap: Number(config?.runtime?.adaptivePlanCap?.highCap ?? 6), reason: "disabled" };

  const lowCapRaw = Number(config?.runtime?.adaptivePlanCap?.lowCap ?? 4);
  const mediumCapRaw = Number(config?.runtime?.adaptivePlanCap?.mediumCap ?? 5);
  const highCapRaw = Number(config?.runtime?.adaptivePlanCap?.highCap ?? 6);
  const lowCap = Math.max(3, Math.min(6, Number.isFinite(lowCapRaw) ? Math.floor(lowCapRaw) : 4));
  const mediumCap = Math.max(lowCap, Math.min(6, Number.isFinite(mediumCapRaw) ? Math.floor(mediumCapRaw) : 5));
  const highCap = Math.max(mediumCap, Math.min(6, Number.isFinite(highCapRaw) ? Math.floor(highCapRaw) : 6));

  try {
    const autonomy = await readJson(path.join(stateDir, "autonomy_band_status.json"), null);
    const history = Array.isArray(autonomy?.history) ? autonomy.history.slice(-3) : [];
    if (history.length === 0) return { cap: lowCap, reason: "no_history" };

    const completionVals = history
      .map((h: any) => Number(h?.completionRate))
      .filter((v: number) => Number.isFinite(v));
    const premiumVals = history
      .map((h: any) => Number(h?.premiumEfficiency))
      .filter((v: number) => Number.isFinite(v));

    const completionAvg = completionVals.length > 0
      ? completionVals.reduce((sum: number, v: number) => sum + v, 0) / completionVals.length
      : 0;
    const premiumAvg = premiumVals.length > 0
      ? premiumVals.reduce((sum: number, v: number) => sum + v, 0) / premiumVals.length
      : 0;

    if (completionAvg >= 0.85 && premiumAvg >= 0.55) {
      return { cap: highCap, reason: `high_perf completionAvg=${completionAvg.toFixed(2)} premiumAvg=${premiumAvg.toFixed(2)}` };
    }
    if (completionAvg >= 0.75 && premiumAvg >= 0.40) {
      return { cap: mediumCap, reason: `mid_perf completionAvg=${completionAvg.toFixed(2)} premiumAvg=${premiumAvg.toFixed(2)}` };
    }
    return { cap: lowCap, reason: `low_perf completionAvg=${completionAvg.toFixed(2)} premiumAvg=${premiumAvg.toFixed(2)}` };
  } catch {
    return { cap: lowCap, reason: "fallback_on_read_error" };
  }
}

// ── Single full cycle: Jesus → Prometheus → Athena → Workers → Athena ──────

async function runSingleCycle(config, _token?: CancellationToken | null) {
  const stateDir = config.paths?.stateDir || "state";
  const cycleStartedAt = new Date().toISOString();
  let _cycleRequests = 0;
  let _premiumEventSeq = 0;
  const premiumEvents: Array<{
    id: number;
    agent: string;
    reason: string;
    success: boolean | null;
  }> = [];
  const leadershipBudgetRaw = Number(config?.runtime?.maxLeadershipRequestsPerCycle ?? 5);
  const leadershipBudget = Number.isFinite(leadershipBudgetRaw) && leadershipBudgetRaw >= 3
    ? Math.floor(leadershipBudgetRaw)
    : 5;
  const spendPremium = async (
    agentLabel: string,
    reason: string,
    options: { pendingOutcome?: boolean } = {},
  ) => {
    _cycleRequests += 1;
    const eventId = ++_premiumEventSeq;
    premiumEvents.push({
      id: eventId,
      agent: agentLabel,
      reason,
      success: options.pendingOutcome === true ? null : true,
    });
    await appendProgress(config, `[PREMIUM_USAGE] spent=${_cycleRequests} agent=${agentLabel} reason=${reason}`);
    return { requestCount: _cycleRequests, eventId };
  };
  const markPremiumOutcome = (eventId: number, success: boolean) => {
    const idx = premiumEvents.findIndex((row) => row.id === eventId);
    if (idx >= 0) {
      premiumEvents[idx] = { ...premiumEvents[idx], success };
    }
  };
  const canSpendLeadership = (cost = 1) => (_cycleRequests + Math.max(1, Math.floor(cost))) <= leadershipBudget;
  await appendProgress(config, `[CYCLE] ════════════════════════════════════════`);
  await appendProgress(config, `[CYCLE START] ${cycleStartedAt}`);

  // Clean up any leftover .tmp files from a previous crash before reading state.
  const cleanupResult = await cleanupStaleTempFiles(stateDir);
  if (cleanupResult.removed.length > 0) {
    await appendProgress(config, `[CYCLE] Cleaned up ${cleanupResult.removed.length} stale temp file(s): ${cleanupResult.removed.join(", ")}`);
  }
  if (!cleanupResult.ok) {
    warn(`[orchestrator] stale-temp cleanup failed (non-fatal): ${String(cleanupResult.error?.message || cleanupResult.error)}`);
  }

  // Audit critical state files at cycle start — writes orchestrator_health.json.
  // This ensures runOnce (used in tests and CLI) also surfaces corrupt state.
  await auditCriticalStateFiles(config, stateDir);

  // ── Preflight capability checks ───────────────────────────────────────────
  // Validate system readiness before spending premium requests.
  if (config.runtime?.disablePreflight !== true) {
    try {
      const doctorResult = await runDoctor(config);
      if (!doctorResult.ok) {
        const failedChecks = Object.entries(doctorResult.checks)
          .filter(([, v]) => !v).map(([k]) => k).join(", ");
        await appendProgress(config,
          `[CYCLE][PREFLIGHT] Capability checks failed: ${failedChecks}. Warnings: ${doctorResult.warnings.join("; ")}`
        );
        await appendAlert(config, {
          severity: ALERT_SEVERITY.HIGH,
          source: "orchestrator",
          title: "Preflight capability checks failed",
          message: `Failed: ${failedChecks}. ${doctorResult.warnings.join("; ")}`
        });
        // Non-blocking: log but continue (critical checks would have thrown)
      } else if (doctorResult.warnings.length > 0) {
        await appendProgress(config, `[CYCLE][PREFLIGHT] All checks passed. Warnings: ${doctorResult.warnings.join("; ")}`);
      }
    } catch (err) {
      warn(`[orchestrator] preflight check failed (non-fatal): ${String(err?.message || err)}`);
    }
  }

  // Guardrail gate: if SKIP_CYCLE is active, skip planning to avoid acting on stale state.
  // Gated by systemGuardian.enabled (rollback: set to false to retain detection without enforcement).
  if (config.systemGuardian?.enabled !== false) {
    try {
      const skipActive = await isGuardrailActive(config, GUARDRAIL_ACTION.SKIP_CYCLE);
      if (skipActive) {
        await appendProgress(config,
          "[CYCLE] SKIP_CYCLE guardrail active — skipping this planning cycle (stale state detected)"
        );
        await appendAlert(config, {
          severity: ALERT_SEVERITY.HIGH,
          source: "orchestrator",
          title: "Planning cycle skipped by SKIP_CYCLE guardrail",
          message: "SKIP_CYCLE guardrail is active — catastrophe scenario may still be present. Revert guardrail to resume."
        });
        return;
      }
    } catch (err) {
      // Non-fatal: guardrail check failure must not block the cycle
      warn(`[orchestrator] SKIP_CYCLE guardrail check failed (non-fatal): ${String(err?.message || err)}`);
    }
  }

  // Step 1: Jesus analyzes state and decides what to do (1 request)
  await appendProgress(config, "[CYCLE] ── Step 1: Jesus analyzing system state ──");
  await appendProgress(config, `[AGENT] ★ ═══[ JESUS ]═══ ★  req#${_cycleRequests + 1} this cycle`);
  const jesusPremiumEvent = await spendPremium("jesus", "cycle_directive", { pendingOutcome: true });

  // ── Closure SLA audit: flag stale escalations (advisory) ────────────────
  try {
    const escalationQ = await loadEscalationQueue(config);
    const slaViolations = checkClosureSLA(Array.isArray(escalationQ) ? escalationQ : escalationQ?.entries || []);
    if (slaViolations.length > 0) {
      await appendProgress(config, `[CLOSURE_SLA] ${slaViolations.length} escalation(s) exceed SLA: ${slaViolations.map(v => v.title).join(", ")}`);
    }
  } catch (err) {
    warn(`[orchestrator] Closure SLA check failed (non-fatal): ${String(err?.message || err)}`);
  }
  await safeUpdatePipelineProgress(config, "jesus_awakening", "Jesus starting system state analysis");
  let jesusDecision;
  try {
    await safeUpdatePipelineProgress(config, "jesus_reading", "Jesus reading system state");
    jesusDecision = await runJesusCycle(config);
  } catch (err) {
    markPremiumOutcome(jesusPremiumEvent.eventId, false);
    await appendProgress(config, `[CYCLE] Jesus failed: ${String(err?.message || err)}`);
    warn(`[orchestrator] Jesus cycle error: ${String(err?.message || err)}`);
    return;
  }

  if (!jesusDecision || jesusDecision.wait === true) {
    markPremiumOutcome(jesusPremiumEvent.eventId, true);
    await appendProgress(config, "[CYCLE] Jesus says: wait — nothing to do");
    return;
  }

  markPremiumOutcome(jesusPremiumEvent.eventId, true);
  await appendProgress(config, `[JESUS] ✓ Done — requests this cycle: ${_cycleRequests}`);

  await safeUpdatePipelineProgress(config, "jesus_decided", "Jesus decision ready", {
    jesusDecision: typeof jesusDecision === "object" ? String(jesusDecision.thinking || "").slice(0, 200) : ""
  });

  // Step 1.5: Research Scout — conditional trigger before Prometheus
  // Gate: only run Scout if synthesis is stale (>48h) AND Prometheus topic memory
  // has no more than `maxActiveResearchTopics` active (unfinished) topics.
  // This prevents Scout from piling on new topics when Prometheus hasn't acted on existing ones.
  //
  // ── WHY CONSUMPTION-TRIGGERED (not time-based) ──────────────────────────────
  // Originally Scout ran on a fixed 48h timer. This was broken in two ways:
  //
  //   1. One-way pipeline: Scout → Prometheus → Workers had no feedback loop.
  //      Prometheus consumed the synthesis, the knowledge was "spent", but Scout
  //      wouldn't run again for 48h regardless of how many cycles had passed.
  //
  //   2. BOX itself regressed this: a worker (CF-001-CF-005, PR #183) added the
  //      48h gate "to avoid piling on topics", which silently killed the loop.
  //      The system optimized itself into a dead-end pipeline.
  //
  // Decision (2026-04-04, owner: Caner): replace the time gate with a
  // consumption signal. Prometheus writes `lastConsumedAt` to research_synthesis.json
  // after injecting the data into its prompt. The scout gate reads this field:
  // if lastConsumedAt > synthesizedAt, the knowledge was used since the last scout
  // run → run Scout now so the next cycle has fresh data.
  //
  // This creates a proper feedback loop:
  //   Scout → synthesis → Prometheus (consumes, writes lastConsumedAt)
  //     → next cycle Scout gate sees consumed → Scout runs → fresh synthesis
  //
  // The 1h guard on synthesisAgeHours prevents double-running within the same
  // cycle (Scout runs at Step 1.5, Prometheus at Step 2 — both in one cycle).
  //
  // If BOX proposes reverting to a time-based gate, this comment explains why
  // that was deliberately removed. Any such change should be treated as a
  // regression unless there is explicit evidence of resource abuse.
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const stateDir = config.paths?.stateDir || "state";

    // Read synthesis state
    const synthesisPath = path.join(stateDir, "research_synthesis.json");
    let synthesisConsumedAt: Date | null = null;
    let synthJson: Record<string, unknown> | null = null;
    try {
      synthJson = await readJson(synthesisPath, null);
      if (synthJson?.lastConsumedAt) {
        synthesisConsumedAt = new Date(synthJson.lastConsumedAt as string);
      }
    } catch { /* ok — file missing means first run, treat as consumed */ }

    // Consumption-triggered scout gate:
    // Scout runs when Prometheus consumed the previous synthesis in a DIFFERENT cycle
    // from when it was produced (gap > 5 minutes rules out same-cycle consumption).
    // ALSO triggers when all synthesis topics are marked consumed in topic memory
    // (every topic either produced a plan or was marked informational by Prometheus).
    const MIN_CONSUMED_GAP_MS = 5 * 60 * 1000; // 5 minutes
    const synthesisConsumedSinceLastScout =
      synthJson === null || // first run — no synthesis exists yet
      (
        synthesisConsumedAt !== null &&
        synthJson?.synthesizedAt != null &&
        synthesisConsumedAt > new Date(synthJson.synthesizedAt as string) &&
        (synthesisConsumedAt.getTime() - new Date(synthJson.synthesizedAt as string).getTime()) > MIN_CONSUMED_GAP_MS
      );

    // Check if ALL synthesis topics are now consumed in topic memory
    let allSynthesisTopicsConsumed = false;
    let allTopicsConsumedReason = "";
    try {
      const synthTopics = Array.isArray((synthJson as any)?.topics) ? (synthJson as any).topics as Array<{ topic: string }> : [];
      if (synthTopics.length > 0) {
        const topicMem = await loadTopicMemory(stateDir);
        const existingKeys = Object.keys(topicMem.topics);
        const unconsumed = synthTopics.filter(t => {
          const key = findCanonicalTopicKey(prometheusTopicKey(String(t.topic || "")), existingKeys);
          const status = topicMem.topics[key]?.status;
          return !status || (status !== "completed" && status !== "archived");
        });
        if (unconsumed.length === 0) {
          allSynthesisTopicsConsumed = true;
          allTopicsConsumedReason = `all ${synthTopics.length} synthesis topic(s) consumed in topic memory`;
        }
      }
    } catch { /* non-fatal */ }

    const shouldRunScout = synthesisConsumedSinceLastScout || allSynthesisTopicsConsumed;

    const scoutBlockedByBudget = shouldRunScout && !canSpendLeadership(1);
    if (shouldRunScout && !scoutBlockedByBudget) {
      const scoutPremiumEvent = await spendPremium("research-scout", "consumption_triggered_refresh", { pendingOutcome: true });
      const scoutReason = synthJson === null
        ? "first-run (no synthesis exists)"
        : allSynthesisTopicsConsumed && !synthesisConsumedSinceLastScout
          ? `all-topics-consumed (${allTopicsConsumedReason})`
          : `consumption-triggered (consumed=${synthesisConsumedAt?.toISOString()}, synthesized=${synthJson.synthesizedAt})`;
      await appendProgress(config, `[CYCLE] ── Step 1.5: Research Scout (${scoutReason}) ──`);
      await appendProgress(config, `[AGENT] ↯↯↯ RESEARCH SCOUT ↯↯↯  req#${_cycleRequests + 1} this cycle`);
      try {
        const scoutResult = await runResearchScout(config);
        if (scoutResult.success && scoutResult.sourceCount > 0) {
          await appendProgress(config, `[RESEARCH_SCOUT] Collected ${scoutResult.sourceCount} sources — running synthesizer`);
          const synthesisResult = await runResearchSynthesizer(config, scoutResult);
          if (synthesisResult?.success === true && Array.isArray(synthesisResult.topics) && synthesisResult.topics.length > 0) {
            await persistBenchmarkEntry(config, String(cycleStartedAt || new Date().toISOString()), synthesisResult.topics);
            await appendProgress(config, `[RESEARCH_SCOUT] Benchmark ground-truth entry persisted - topics=${synthesisResult.topics.length}`);
          }
          markPremiumOutcome(
            scoutPremiumEvent.eventId,
            Boolean(synthesisResult?.success === true && Array.isArray(synthesisResult?.topics) && synthesisResult.topics.length > 0),
          );
          await appendProgress(config, "[RESEARCH_SCOUT] Synthesis complete — Prometheus will receive updated research context");
          await appendProgress(config, `[RESEARCH_SCOUT] ✓ Done — requests this cycle: ${_cycleRequests}`);
        } else {
          markPremiumOutcome(scoutPremiumEvent.eventId, false);
          await appendProgress(config, `[RESEARCH_SCOUT] Scout returned no sources (success=${scoutResult.success}) — skipping synthesis`);
        }
      } catch (scoutErr) {
        markPremiumOutcome(scoutPremiumEvent.eventId, false);
        warn(`[orchestrator] Research Scout failed (non-fatal): ${String((scoutErr as any)?.message || scoutErr)}`);
        await appendProgress(config, `[RESEARCH_SCOUT] Failed (non-fatal): ${String((scoutErr as any)?.message || scoutErr)}`);
      }
    } else if (scoutBlockedByBudget) {
      await appendProgress(config,
        `[CYCLE] Research Scout skipped — leadership budget reached (${_cycleRequests}/${leadershipBudget})`
      );
    } else {
      const skipReason = `synthesis not yet fully consumed (lastConsumedAt=${synthesisConsumedAt?.toISOString() ?? "none"}, synthesizedAt=${synthJson?.synthesizedAt ?? "none"}, gap must exceed ${MIN_CONSUMED_GAP_MS / 60000}m OR all synthesis topics consumed in topic memory)`;
      await appendProgress(config, `[CYCLE] Research Scout skipped — ${skipReason}`);
    }
  } catch (scoutGateErr) {
    warn(`[orchestrator] Scout gate evaluation failed (non-fatal): ${String((scoutGateErr as any)?.message || scoutGateErr)}`);
  }

  // Step 2: Prometheus plans (single-prompt, no autopilot)
  await appendProgress(config, "[CYCLE] ── Step 2: Prometheus scanning & planning ──");
  await appendProgress(config, `[AGENT] ⚡⚡ PROMETHEUS ⚡⚡  req#${_cycleRequests + 1} this cycle`);
  const primaryPrometheusPremiumEvent = await spendPremium("prometheus", "primary_planning", { pendingOutcome: true });
  await safeUpdatePipelineProgress(config, "prometheus_starting", "Prometheus starting repository scan");

  // ── Architecture drift check: run before Prometheus to surface stale refs ──
  let architectureDriftReport = null;
  try {
    const rootDir = config.paths?.repoRoot || process.cwd();
    architectureDriftReport = await checkArchitectureDrift({ rootDir });
    const unresolvedCount = (architectureDriftReport.staleCount || 0) + (architectureDriftReport.deprecatedTokenCount || 0);
    await appendProgress(config,
      `[DRIFT_CHECK] Architecture drift scan complete — staleRefs=${architectureDriftReport.staleCount} deprecatedTokens=${architectureDriftReport.deprecatedTokenCount} scannedDocs=${architectureDriftReport.scannedDocs.length}`
    );
    if (unresolvedCount > 0) {
      await appendProgress(config,
        `[DRIFT_CHECK] ${unresolvedCount} unresolved drift item(s) — injecting summary into Prometheus context`
      );
    }
  } catch (driftErr) {
    warn(`[orchestrator] Architecture drift check failed (non-fatal): ${String(driftErr?.message || driftErr)}`);
  }

  let prometheusAnalysis;
  try {
    await safeUpdatePipelineProgress(config, "prometheus_reading_repo", "Prometheus reading repository");
    prometheusAnalysis = await runPrometheusAnalysis(config, {
      prompt: jesusDecision.briefForPrometheus || jesusDecision.thinking || "Full repository analysis",
      requestedBy: "Jesus",
      driftReport: architectureDriftReport
    });
  } catch (err) {
    markPremiumOutcome(primaryPrometheusPremiumEvent.eventId, false);
    await appendProgress(config, `[CYCLE] Prometheus failed: ${String(err?.message || err)}`);
    warn(`[orchestrator] Prometheus analysis error: ${String(err?.message || err)}`);
    return;
  }

  markPremiumOutcome(primaryPrometheusPremiumEvent.eventId, true);

  if (!prometheusAnalysis || !Array.isArray(prometheusAnalysis.plans) || prometheusAnalysis.plans.length === 0) {
    await appendProgress(config, "[CYCLE] Prometheus produced no plans — cycle complete");
    await safeUpdatePipelineProgress(config, "cycle_complete", "Prometheus produced no plans — nothing to dispatch");
    return;
  }

  // ── Source-linkage quality gate (research-context blindness) ─────────────
  // When research context is injected but neither plan synthesis_sources nor
  // informational_topics_consumed are present, force one corrective Prometheus
  // re-plan (budget permitting). This prevents low-relevance, context-blind
  // plans from flowing into dispatch.
  {
    const researchTopicCount = Number((prometheusAnalysis as any)?.researchContext?.topicCount || 0);
    const sourceLinkedPlanCount = (Array.isArray((prometheusAnalysis as any)?.plans) ? (prometheusAnalysis as any).plans : [])
      .filter((p: any) => Array.isArray(p?.synthesis_sources) && p.synthesis_sources.length > 0)
      .length;
    const informationalConsumedCount = Array.isArray((prometheusAnalysis as any)?.informational_topics_consumed)
      ? (prometheusAnalysis as any).informational_topics_consumed.length
      : 0;
    const blindPlanningDetected =
      researchTopicCount > 0 &&
      sourceLinkedPlanCount === 0 &&
      informationalConsumedCount === 0;

    if (blindPlanningDetected) {
      await appendProgress(config,
        `[CYCLE] Source-linkage gate detected blind planning: researchTopics=${researchTopicCount} linkedPlans=${sourceLinkedPlanCount} informationalConsumed=${informationalConsumedCount}`
      );
      if (canSpendLeadership(1)) {
        const linkageReplanPremiumEvent = await spendPremium("prometheus", "source_linkage_replan", { pendingOutcome: true });
        try {
          const linkagePrompt = buildSourceLinkageReplanPrompt(
            jesusDecision.briefForPrometheus || jesusDecision.thinking || "Full repository analysis",
            researchTopicCount
          );
          const replannedWithLinkage = await runPrometheusAnalysis(config, {
            prompt: linkagePrompt,
            requestedBy: "OrchestratorSourceLinkageGate",
            driftReport: architectureDriftReport,
            bypassCache: true,
            bypassReason: "missing_source_linkage",
          });
          markPremiumOutcome(
            linkageReplanPremiumEvent.eventId,
            Boolean(replannedWithLinkage && Array.isArray(replannedWithLinkage.plans) && replannedWithLinkage.plans.length > 0),
          );
          const replannedSourceLinkedCount = (Array.isArray((replannedWithLinkage as any)?.plans) ? (replannedWithLinkage as any).plans : [])
            .filter((p: any) => Array.isArray(p?.synthesis_sources) && p.synthesis_sources.length > 0)
            .length;
          const replannedInformationalCount = Array.isArray((replannedWithLinkage as any)?.informational_topics_consumed)
            ? (replannedWithLinkage as any).informational_topics_consumed.length
            : 0;
          await appendProgress(config,
            `[PROMETHEUS] ↺ Source-linkage re-plan complete — linkedPlans=${replannedSourceLinkedCount} informationalConsumed=${replannedInformationalCount} req#${_cycleRequests} this cycle`
          );
          if (replannedWithLinkage && Array.isArray(replannedWithLinkage.plans) && replannedWithLinkage.plans.length > 0) {
            prometheusAnalysis = replannedWithLinkage;
          }
        } catch (err) {
          markPremiumOutcome(linkageReplanPremiumEvent.eventId, false);
          warn(`[orchestrator] Source-linkage re-plan failed (non-fatal): ${String((err as any)?.message || err)}`);
          await appendProgress(config,
            `[CYCLE] Source-linkage re-plan failed (non-fatal): ${String((err as any)?.message || err)}`
          );
        }
      } else {
        await appendProgress(config,
          `[CYCLE] Source-linkage re-plan skipped — leadership budget reached (${_cycleRequests}/${leadershipBudget})`
        );
      }
    }
  }

  // ── Parser confidence hard-stop gate ──────────────────────────────────────
  // Block dispatch when Prometheus output confidence is below threshold.
  const PARSER_CONFIDENCE_THRESHOLD = config.runtime?.parserConfidenceThreshold ?? 0.3;
  const parsedConfidence = prometheusAnalysis.parserConfidence ?? 1.0;
  if (parsedConfidence < PARSER_CONFIDENCE_THRESHOLD) {
    await appendProgress(config,
      `[CYCLE] Parser confidence too low (${parsedConfidence} < ${PARSER_CONFIDENCE_THRESHOLD}) — blocking dispatch`
    );
    await appendAlert(config, {
      severity: ALERT_SEVERITY.HIGH,
      source: "orchestrator",
      title: "Low parser confidence — dispatch blocked",
      message: `parserConfidence=${parsedConfidence} threshold=${PARSER_CONFIDENCE_THRESHOLD}. Plans not dispatched.`
    });
    await safeUpdatePipelineProgress(config, "cycle_complete", `Parser confidence too low (${parsedConfidence}) — dispatch blocked`);
    return;
  }

  // ── Baseline recovery mode ────────────────────────────────────────────────
  // When parserConfidence is below PARSER_CONFIDENCE_RECOVERY_THRESHOLD (0.9)
  // but above the hard-stop, enter advisory "baseline recovery" mode:
  //   - Persist structural/schema component metrics for trend analysis.
  //   - Emit progress + advisory alert so operators can see which components
  //     are dragging confidence below the recovery target.
  // Dispatch is NOT blocked here — the hard-stop gate above handles that.
  let baselineRecoveryRecord = null;
  if (parsedConfidence < PARSER_CONFIDENCE_RECOVERY_THRESHOLD) {
    try {
      const cycleIdForBaseline = (await readPipelineProgress(config))?.startedAt ?? null;
      baselineRecoveryRecord = computeBaselineRecoveryState(prometheusAnalysis, cycleIdForBaseline);
      await persistBaselineMetrics(config, baselineRecoveryRecord);
      const gapSummary = Object.entries(baselineRecoveryRecord.componentGap)
        .filter(([, gap]) => (gap as number) > 0)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      await appendProgress(config,
        `[CYCLE] Baseline recovery mode active — parserConfidence=${parsedConfidence} target=${PARSER_CONFIDENCE_RECOVERY_THRESHOLD}` +
        (gapSummary ? ` componentGaps=[${gapSummary}]` : "")
      );
      await appendAlert(config, {
        severity: ALERT_SEVERITY.MEDIUM,
        source: "orchestrator",
        title: "Baseline recovery mode — parser confidence below target",
        message: `parserConfidence=${parsedConfidence} target=${PARSER_CONFIDENCE_RECOVERY_THRESHOLD}. ` +
          `Component gaps: ${gapSummary || "none"}. ` +
          `Penalties: ${baselineRecoveryRecord.penalties.map(p => p.reason).join(", ") || "none"}.`
      });
    } catch (err) {
      warn(`[orchestrator] Baseline recovery metrics persist failed (non-fatal): ${String(err?.message || err)}`);
    }
  }

  // ── Dispatch strictness gate (replay harness regressions) ────────────────
  // Load the last persisted replay regression state and combine it with the
  // current baseline recovery record to determine how strictly dispatch should
  // behave.  This is fail-open: any error loading state is treated as no signal
  // (NORMAL strictness) so a missing corpus file never blocks legitimate work.
  //
  //   NORMAL   → proceed as usual
  //   ELEVATED → advisory log; dispatch continues
  //   STRICT   → warning alert; dispatch continues (caller may reduce concurrency)
  //   BLOCKED  → hard-stop: dispatch blocked, alert emitted, cycle exits
  try {
    const replayRegressionState = await loadReplayRegressionState(config);
    const strictnessResult = computeDispatchStrictness(replayRegressionState, baselineRecoveryRecord);

    if (strictnessResult.strictness !== DISPATCH_STRICTNESS.NORMAL) {
      await appendProgress(config,
        `[DISPATCH_STRICTNESS] level=${strictnessResult.strictness} regressionRate=${(strictnessResult.regressionRate * 100).toFixed(0)}% recoveryActive=${strictnessResult.recoveryActive} — ${strictnessResult.reason}`
      );
    }

    if (strictnessResult.strictness === DISPATCH_STRICTNESS.BLOCKED) {
      await appendAlert(config, {
        severity: ALERT_SEVERITY.CRITICAL,
        source: "orchestrator",
        title: "Dispatch blocked — replay harness regression rate exceeds threshold",
        message: strictnessResult.reason,
      });
      await safeUpdatePipelineProgress(config, "cycle_complete", `Dispatch blocked: ${strictnessResult.reason}`);
      return;
    }

    if (strictnessResult.strictness === DISPATCH_STRICTNESS.STRICT) {
      await appendAlert(config, {
        severity: ALERT_SEVERITY.HIGH,
        source: "orchestrator",
        title: "Strict dispatch mode — replay harness regressions detected",
        message: strictnessResult.reason,
      });
    } else if (strictnessResult.strictness === DISPATCH_STRICTNESS.ELEVATED) {
      await appendAlert(config, {
        severity: ALERT_SEVERITY.MEDIUM,
        source: "orchestrator",
        title: "Elevated dispatch mode — parser regressions or recovery active",
        message: strictnessResult.reason,
      });
    }
  } catch (err) {
    warn(`[orchestrator] Dispatch strictness gate failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Plan novelty gate ─────────────────────────────────────────────────────
  // Skip plans that Prometheus itself marked as already implemented correctly.
  // If all plans are already implemented, force one fresh re-plan with an
  // explicit "net-new or delta only" instruction and continue with that output.
  let noveltyResult = await filterAlreadyImplementedPlans(stateDir, prometheusAnalysis.plans);
  if (noveltyResult.skippedPlans.length > 0) {
    await appendProgress(
      config,
      `[CYCLE] Plan novelty gate skipped ${noveltyResult.skippedPlans.length}/${prometheusAnalysis.plans.length} already-implemented plan(s)`
    );
  }

  if (noveltyResult.actionablePlans.length === 0) {
    await appendProgress(config,
      "[CYCLE] All Prometheus plans are already implemented/completed — refreshing Scout+Synth before requesting net-new plans"
    );

    const refinedPrompt = buildNoveltyReplanPrompt(
      jesusDecision.briefForPrometheus || jesusDecision.thinking || "Full repository analysis",
      noveltyResult.skippedPlans
    );

    try {
      // Refresh research context first so Prometheus re-plans from fresh Scout output,
      // not only from existing stale synthesis.
      try {
        if (canSpendLeadership(1)) {
          const noveltyScoutPremiumEvent = await spendPremium("research-scout", "novelty_gate_refresh", { pendingOutcome: true });
          await appendProgress(config, "[CYCLE] Novelty gate triggering Research Scout refresh");
          const scoutRefresh = await runResearchScout(config);
          if (scoutRefresh.success && scoutRefresh.sourceCount > 0) {
            await appendProgress(config, `[RESEARCH_SCOUT] Refresh collected ${scoutRefresh.sourceCount} source(s) — running synthesizer`);
            const refreshSynthesisResult = await runResearchSynthesizer(config, scoutRefresh);
            if (refreshSynthesisResult?.success === true && Array.isArray(refreshSynthesisResult.topics) && refreshSynthesisResult.topics.length > 0) {
              await persistBenchmarkEntry(config, String(cycleStartedAt || new Date().toISOString()), refreshSynthesisResult.topics);
              await appendProgress(config, `[RESEARCH_SCOUT] Benchmark ground-truth entry persisted - topics=${refreshSynthesisResult.topics.length}`);
            }
            markPremiumOutcome(
              noveltyScoutPremiumEvent.eventId,
              Boolean(refreshSynthesisResult?.success === true && Array.isArray(refreshSynthesisResult?.topics) && refreshSynthesisResult.topics.length > 0),
            );
            await appendProgress(config, `[RESEARCH_SCOUT] ✓ Refresh complete — requests this cycle: ${_cycleRequests}`);
          } else {
            markPremiumOutcome(noveltyScoutPremiumEvent.eventId, false);
            await appendProgress(config, `[RESEARCH_SCOUT] Refresh produced no sources (success=${scoutRefresh.success}) — continuing with novelty re-plan`);
          }
        } else {
          await appendProgress(config, `[CYCLE] Novelty-gate Scout refresh skipped — leadership budget reached (${_cycleRequests}/${leadershipBudget})`);
        }
      } catch (refreshErr) {
        warn(`[orchestrator] Novelty gate Scout/Synth refresh failed (non-fatal): ${String((refreshErr as any)?.message || refreshErr)}`);
        await appendProgress(config,
          `[CYCLE] Scout/Synth refresh failed (non-fatal) — continuing with novelty re-plan: ${String((refreshErr as any)?.message || refreshErr)}`
        );
      }

      if (!canSpendLeadership(1)) {
        await appendProgress(config, `[CYCLE] Novelty re-plan skipped — leadership budget reached (${_cycleRequests}/${leadershipBudget})`);
        await safeUpdatePipelineProgress(config, "cycle_complete", "Novelty re-plan skipped due to leadership budget");
        return;
      }

      const noveltyReplanPremiumEvent = await spendPremium("prometheus", "novelty_replan", { pendingOutcome: true });
      const replanned = await runPrometheusAnalysis(config, {
        prompt: refinedPrompt,
        requestedBy: "OrchestratorNoveltyGate",
        driftReport: architectureDriftReport,
        bypassCache: true,
        bypassReason: "all_plans_already_implemented_or_completed"
      });

      markPremiumOutcome(
        noveltyReplanPremiumEvent.eventId,
        Boolean(replanned && Array.isArray(replanned.plans) && replanned.plans.length > 0),
      );
      await appendProgress(config, `[PROMETHEUS] ↺ Re-plan run complete — requests this cycle: ${_cycleRequests}`);

      if (!replanned || !Array.isArray(replanned.plans) || replanned.plans.length === 0) {
        await appendProgress(config, "[CYCLE] Re-plan returned no plans — cycle complete");
        await safeUpdatePipelineProgress(config, "cycle_complete", "No net-new actionable plans after novelty re-plan");
        return;
      }

      const replannedConfidence = replanned.parserConfidence ?? 1.0;
      if (replannedConfidence < PARSER_CONFIDENCE_THRESHOLD) {
        await appendProgress(config,
          `[CYCLE] Re-plan parser confidence too low (${replannedConfidence} < ${PARSER_CONFIDENCE_THRESHOLD}) — blocking dispatch`
        );
        await appendAlert(config, {
          severity: ALERT_SEVERITY.HIGH,
          source: "orchestrator",
          title: "Low parser confidence on novelty re-plan — dispatch blocked",
          message: `parserConfidence=${replannedConfidence} threshold=${PARSER_CONFIDENCE_THRESHOLD}. Re-planned plans not dispatched.`
        });
        await safeUpdatePipelineProgress(config, "cycle_complete", `Re-plan parser confidence too low (${replannedConfidence})`);
        return;
      }

      noveltyResult = await filterAlreadyImplementedPlans(stateDir, replanned.plans);
      if (noveltyResult.actionablePlans.length === 0) {
        await appendProgress(config,
          "[CYCLE] Re-plan still produced only already-implemented/completed items — cycle complete"
        );
        await safeUpdatePipelineProgress(config, "cycle_complete", "No net-new actionable plans after novelty filtering");
        return;
      }

      prometheusAnalysis = {
        ...replanned,
        plans: noveltyResult.actionablePlans,
      };
    } catch (replanErr) {
      warn(`[orchestrator] Novelty re-plan failed (non-fatal): ${String((replanErr as any)?.message || replanErr)}`);
      await appendProgress(config,
        `[CYCLE] Novelty re-plan failed — stopping cycle to avoid redispatching already-implemented plans: ${String((replanErr as any)?.message || replanErr)}`
      );
      await safeUpdatePipelineProgress(config, "cycle_complete", "Novelty re-plan failed");
      return;
    }
  } else {
    prometheusAnalysis = {
      ...prometheusAnalysis,
      plans: noveltyResult.actionablePlans,
    };
  }

  await safeUpdatePipelineProgress(config, "prometheus_done", `Prometheus complete — ${prometheusAnalysis.plans.length} plan(s)`, {
    planCount: prometheusAnalysis.plans.length
  });
  await appendProgress(config, `[PROMETHEUS] ✓ Done — ${prometheusAnalysis.plans.length} plan(s) — requests this cycle: ${_cycleRequests}`);

  // Step 3: Athena validates the plan (1 request)
  await appendProgress(config, "[CYCLE] ── Step 3: Athena reviewing plan ──");
  await appendProgress(config, `[AGENT] ◈◈◈ ATHENA ◈◈◈  req#${_cycleRequests + 1} this cycle`);
  const athenaPremiumEvent = await spendPremium("athena", "plan_review", { pendingOutcome: true });
  await safeUpdatePipelineProgress(config, "athena_reviewing", "Athena reviewing Prometheus plan");
  let planReview;
  try {
    planReview = await runAthenaPlanReview(config, prometheusAnalysis);
  } catch (err) {
    markPremiumOutcome(athenaPremiumEvent.eventId, false);
    const msg = String(err?.message || err).slice(0, 200);
    await appendProgress(config, `[CYCLE] Athena plan review threw exception: ${msg} — blocking cycle (fail-closed)`);
    warn(`[orchestrator] Athena plan review exception: ${msg}`);
    const reason = { code: ATHENA_PLAN_REVIEW_REASON_CODE.REVIEW_EXCEPTION, message: msg };
    const blocker = {
      stage: "athena_plan_review",
      code: reason.code,
      source: "orchestrator",
      retryable: false,
    };
    emitEvent(EVENTS.ORCHESTRATION_HEALTH_DEGRADED, EVENT_DOMAIN.ORCHESTRATION, `athena-review-exception-${Date.now()}`, {
      reason: "athena_plan_review_exception",
      blockerCode: blocker.code,
      blockerStage: blocker.stage,
      error: msg,
    });
    await appendAlert(config, {
      severity: ALERT_SEVERITY.CRITICAL,
      source: "orchestrator",
      title: "Athena plan review exception — cycle blocked",
      message: `code=${reason.code} message=${reason.message}`
    });
    await writeJson(path.join(stateDir, "athena_plan_rejection.json"), {
      rejectedAt: new Date().toISOString(),
      reason,
      blocker,
      corrections: [],
      summary: `Plan review exception: ${msg}`
    });
    planReview = { approved: false, reason, blocker, corrections: [] };
  }

  if (planReview?.approved === true && !hasFiniteAthenaOverallScore(planReview)) {
    const reason = {
      code: ATHENA_PLAN_REVIEW_REASON_CODE.SCORE_CONTRACT_VIOLATION,
      message: "Athena approved response missing valid overallScore (expected numeric 1-10)"
    };
    const blocker = {
      stage: "athena_plan_review",
      code: reason.code,
      source: "orchestrator",
      retryable: false,
    };
    await appendProgress(config, `[CYCLE] Athena plan review score contract violation — blocking cycle (fail-closed)`);
    await appendProgress(config, `[ATHENA][BLOCKER] code=${blocker.code} stage=${blocker.stage} retryable=${String(blocker.retryable)}`);
    planReview = { ...planReview, approved: false, reason, blocker, corrections: planReview?.corrections || [] };
  }

  if (!planReview.approved) {
    markPremiumOutcome(athenaPremiumEvent.eventId, false);
    const rejectionReason = planReview.reason || { code: "PLAN_REJECTED", message: planReview.summary || "Rejected by Athena" };
    const correctionsList = planReview.corrections || [];
    const blocker = planReview.blocker && typeof planReview.blocker === "object"
      ? planReview.blocker
      : {
        stage: "athena_plan_review",
        code: typeof rejectionReason === "object" ? (rejectionReason as Record<string, unknown>).code : String(rejectionReason),
        source: "athena_reviewer",
        retryable: false,
      };
    const blockerCode = String((blocker as Record<string, unknown>).code || "PLAN_REJECTED");
    await appendProgress(config, `[CYCLE] Athena REJECTED plan — code=${typeof rejectionReason === "object" ? rejectionReason.code : rejectionReason} blocker=${blockerCode} corrections: ${correctionsList.join("; ")}`);
    emitEvent(EVENTS.PLANNING_PLAN_REJECTED, EVENT_DOMAIN.PLANNING, `plan-reject-${Date.now()}`, {
      code: typeof rejectionReason === "object" ? (rejectionReason as Record<string, unknown>).code : String(rejectionReason),
      blockerCode,
      corrections: correctionsList,
      summary: planReview.summary || ""
    });
    // Save rejection for Prometheus to read on next cycle
    await writeJson(path.join(stateDir, "athena_plan_rejection.json"), {
      rejectedAt: new Date().toISOString(),
      reason: rejectionReason,
      blocker,
      corrections: correctionsList,
      summary: planReview.summary || ""
    });
    return;
  }

  markPremiumOutcome(athenaPremiumEvent.eventId, true);
  await safeUpdatePipelineProgress(config, "athena_approved", "Athena approved the plan");
  await appendProgress(config, `[ATHENA] ✓ Done — plan approved — requests this cycle: ${_cycleRequests}`);

  // Record that Athena's gate feasibility check was invoked this cycle.
  await recordCapabilityExecution(
    config,
    "athena-gate-pre-check",
    `gateBlockRisk=${String((planReview as any)?.gateBlockRiskAtApproval ?? (planReview as any)?.gateBlockRisk ?? "unknown")} autoApproved=${String((planReview as any)?.autoApproved ?? false)}`,
  );
  await recordCapabilityExecution(
    config,
    "athena-gate-feasibility-check",
    `gateBlockRisk=${String((planReview as any)?.gateBlockRiskAtApproval ?? (planReview as any)?.gateBlockRisk ?? "unknown")}`,
  );

  // Persist auto-approve telemetry whenever Athena's deterministic fast-path
  // fires.  This was previously defined but never called, leaving the
  // auto_approve_telemetry.json empty and breaking downstream ROI analysis.
  if (planReview.autoApproved === true) {
    const autoApproveCycleId = `cycle-${cycleStartedAt || Date.now()}`;
    await appendAutoApproveTelemetry(config, planReview as Record<string, unknown>, autoApproveCycleId);
  }

  // Step 4: Dispatch workers sequentially (1 request per worker)
  let rawPlans = Array.isArray(planReview.patchedPlans) && planReview.patchedPlans.length > 0
    ? planReview.patchedPlans
    : prometheusAnalysis.plans;

  const adaptiveCap = await resolveAdaptivePlanCap(config, stateDir);
  if (Array.isArray(rawPlans) && rawPlans.length > adaptiveCap.cap) {
    rawPlans = [...rawPlans]
      .sort((a: any, b: any) => Number(a?.priority ?? 99) - Number(b?.priority ?? 99))
      .slice(0, adaptiveCap.cap);
    await appendProgress(config,
      `[CYCLE] Adaptive plan cap applied: selected ${rawPlans.length}/${prometheusAnalysis.plans.length} plan(s) — ${adaptiveCap.reason}`
    );
  } else {
    await appendProgress(config,
      `[CYCLE] Adaptive plan cap: no trim (${Array.isArray(rawPlans) ? rawPlans.length : 0} plan(s)) — ${adaptiveCap.reason}`
    );
  }

  // ── Ensure synthesizable defaults on all plans ─────────────────────────────
  // Athena's patchedPlans come from AI output and may lack fields that
  // normalizePlanFromTask would synthesize (capacityDelta, requestROI,
  // verification_commands, acceptance_criteria, dependencies).
  // Fill only missing fields with safe defaults so downstream gates pass.
  const plans = rawPlans.map((p: any) => ({
    ...p,
    capacityDelta: Number.isFinite(Number(p.capacityDelta)) && Number(p.capacityDelta) >= -1 && Number(p.capacityDelta) <= 1
      ? Number(p.capacityDelta) : 0.1,
    requestROI: Number.isFinite(Number(p.requestROI)) && Number(p.requestROI) > 0
      ? Number(p.requestROI) : 1.0,
    verification_commands: Array.isArray(p.verification_commands) && p.verification_commands.length > 0
      ? p.verification_commands : [String(p.verification || "npm test")],
    acceptance_criteria: Array.isArray(p.acceptance_criteria) && p.acceptance_criteria.length > 0
      ? p.acceptance_criteria : [String(p.task || "Task completes successfully")],
    dependencies: Array.isArray(p.dependencies) ? p.dependencies : [],
  }));

  // Bind deterministic named verification targets before dispatch admission.
  // This prevents generic verification commands from reaching worker calls when
  // a specific target already exists in verification_commands.
  for (const plan of plans as any[]) {
    const boundTarget = resolveNamedVerificationTarget(plan);
    if (boundTarget) {
      plan.verification = boundTarget;
      plan._boundVerificationTarget = boundTarget;
    }
  }

  // Funnel tracking: capture approved count before quality/freeze gates reduce plans.
  const funnelApprovedCount: number = plans.length;

  // ── Lane performance: read previous cycle telemetry for informed dispatch ───
  // Building lanePerformance before the capability pool call lets the pool use
  // measured lane ROI (rather than static estimates) to route plans to the
  // strongest available worker lane.
  let lanePerformanceFromCycle: ReturnType<typeof buildLanePerformanceFromCycleTelemetry> = {};
  try {
    const prevAnalyticsForLane = await readCycleAnalytics(config);
    const prevLaneTelemetry = (prevAnalyticsForLane as any)?.lastCycle?.laneTelemetry;
    if (prevLaneTelemetry && typeof prevLaneTelemetry === "object") {
      lanePerformanceFromCycle = buildLanePerformanceFromCycleTelemetry(prevLaneTelemetry);
    }
  } catch { /* non-fatal: no previous cycle analytics yet */ }

  // ── Capability pool: assign workers based on task capability matching ──────
  let capabilityPoolResult = null;
  try {
    const poolResult = assignWorkersToPlans(plans, config, lanePerformanceFromCycle);
    capabilityPoolResult = poolResult;
    if (poolResult.diversityIndex > 0) {
      await appendProgress(config, `[CAPABILITY_POOL] Worker diversity index: ${poolResult.diversityIndex} (0=single-worker, 1=fully diversified)`);
    }
    if (poolResult.specializationUtilization && !poolResult.specializationUtilization.specializationTargetsMet) {
      await appendProgress(
        config,
        `[CAPABILITY_POOL] Specialist utilization below target: ${Math.round(poolResult.specializationUtilization.specializedShare * 100)}% < ${Math.round(poolResult.specializationUtilization.minSpecializedShare * 100)}%`
      );
    }
    // Apply pool assignment — update plan.role to the capability-assigned role when it improves on the default.
    // _originalRole preserves the Prometheus-suggested role for audit; _capabilityLane tracks the lane.
    for (const { plan, selection } of poolResult.assignments) {
      if (!selection.isFallback && selection.role !== plan.role) {
        plan._originalRole = plan.role;
        plan.role = selection.role;
        plan._capabilityLane = selection.lane;
      } else {
        // Always stamp lane even for fallback selections so batch planner can use it.
        plan._capabilityLane = plan._capabilityLane || selection.lane;
      }
    }

    // ── Lane conflict detection ──────────────────────────────────────────────
    // Warn when plans within the same lane target overlapping files — these
    // should ideally run in separate waves to avoid concurrent write conflicts.
    const conflicts = detectLaneConflicts(poolResult.assignments);
    if (conflicts.length > 0) {
      await appendProgress(config,
        `[CAPABILITY_POOL] ${conflicts.length} lane conflict(s) detected — conflicting plans will be separated into distinct batches`
      );
      for (const c of conflicts) {
        warn(`[orchestrator] Lane conflict: lane="${c.lane}" plans="${c.plan1Task}" ↔ "${c.plan2Task}" share files: ${c.sharedFiles.join(", ")}`);
      }
    }
  } catch (err) {
    warn(`[orchestrator] Capability pool assignment failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Plan quality gate (Packet 12): skip plans failing contract validation ──
  try {
    const contractReport = validateAllPlans(plans);
    if (contractReport.passRate < 1) {
      await appendProgress(config,
        `[PLAN_QUALITY] Contract pass rate: ${(contractReport.passRate * 100).toFixed(0)}% — ${contractReport.results.filter(r => !r.valid).length} plan(s) have violations`
      );
      // Collect indices with critical violations; sort descending to preserve splice indices
      const toRemove = contractReport.results
        .filter(r => !r.valid && r.violations.some(v => v.severity === "critical"))
        .map(r => r.planIndex)
        .sort((a, b) => b - a);
      for (const idx of toRemove) {
        const plan = plans[idx];
        warn(`[orchestrator] Plan "${String(plan?.task || "unknown").slice(0, 60)}" has critical contract violation(s) — removing from dispatch`);
        plans.splice(idx, 1);
      }
      if (plans.length === 0) {
        await appendProgress(config, "[CYCLE] All plans removed by contract quality gate — cycle complete");
        await safeUpdatePipelineProgress(config, "cycle_complete", "All plans failed contract quality gate");
        return;
      }
    }
  } catch (err) {
    warn(`[orchestrator] Plan quality gate failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Lane diversity gate (Packet 6) — hard admission control ──
  // Blocks dispatch when the active plan set spans fewer lanes than the
  // configured minimum. Only enforced when plans.length >= minLanes so
  // single-plan batches are not penalised for inherent monoculture.
  // Errors in the gate itself are fail-closed: they block dispatch.
  {
    const diversityMinLanes: number = config?.workerPool?.minLanes || 2;
    if (plans.length >= diversityMinLanes) {
      let diversityBlocked = false;
      let diversityMsg = "";
      try {
        const diversityPool = capabilityPoolResult || { activeLaneCount: plans.length, assignments: [] };
        const diversityResult = enforceLaneDiversity(diversityPool, { minLanes: diversityMinLanes });
        if (!diversityResult.meetsMinimum) {
          diversityBlocked = true;
          diversityMsg = diversityResult.warning;
        }
      } catch (err) {
        diversityBlocked = true;
        diversityMsg = `Lane diversity gate threw: ${String(err?.message || err)}`;
      }
      if (diversityBlocked) {
        await appendProgress(config, `[LANE_DIVERSITY] Hard gate: dispatch blocked — ${diversityMsg}`);
        await appendAlert(config, {
          severity: ALERT_SEVERITY.HIGH,
          source: "orchestrator",
          title: "Lane diversity gate blocked dispatch",
          message: diversityMsg,
        });
        warn(`[orchestrator] Lane diversity gate blocked dispatch: ${diversityMsg}`);
        try {
          const blockedAnalytics = computeCycleAnalytics(config, {
            phase: CYCLE_PHASE.INCOMPLETE,
            dispatchBlockReason: `lane_diversity_gate_blocked:${diversityMsg}`,
            pipelineProgress: null,
            workerResults: null,
          });
          await persistCycleAnalytics(config, blockedAnalytics);
          await appendGovernanceBlockEvent(config, {
            cycleId: String(cycleStartedAt || new Date().toISOString()),
            blockReason: `lane_diversity_gate_blocked:${diversityMsg}`,
            blockedAt: new Date().toISOString(),
            gateSource: "lane_diversity_gate",
          });
          await recordCapabilityExecution(
            config,
            "dispatch-block-reason-reporting",
            `gateSource=lane_diversity_gate reason=${diversityMsg.slice(0, 120)}`,
          );
        } catch (analyticsErr) {
          warn(`[orchestrator] Blocked-cycle analytics write failed (non-fatal): ${String(analyticsErr?.message || analyticsErr)}`);
        }
        return;
      }
    }
  }

  await appendProgress(config, `[CYCLE] ── Step 4: Dispatching ${plans.length} workers ──`);

  // Pre-dispatch governance gate: single decision source for guardrail pause,
  // governance freeze, dependency cycle detection, and governance canary breach.
  // Replaces the inline PAUSE_WORKERS check and adds canary + cycle guards.
  {
    const cycleId = `cycle-${Date.now()}`;
    try {
      const gateDecision = await evaluatePreDispatchGovernanceGate(config, plans, cycleId, architectureDriftReport);
      emitEvent(EVENTS.GOVERNANCE_GATE_EVALUATED, EVENT_DOMAIN.GOVERNANCE, cycleId, {
        blocked: gateDecision.blocked,
        reason: gateDecision.reason || null,
        inputSnapshot: { planCount: plans.length, cycleId }
      });
      if (gateDecision.blocked) {
        const reasonMsg = gateDecision.dispatchBlockReason || gateDecision.reason || "pre_dispatch_gate_blocked";
        await appendProgress(config,
          `[CYCLE] Pre-dispatch governance gate blocked dispatch — reason=${reasonMsg}`
        );
        await appendAlert(config, {
          severity: ALERT_SEVERITY.HIGH,
          source: "orchestrator",
          title: "Worker dispatch blocked by pre-dispatch governance gate",
          message: `reason=${reasonMsg} action=${gateDecision.action || "none"} cycleId=${cycleId}`
        });
        try {
          const blockedAnalytics = computeCycleAnalytics(config, {
            phase: CYCLE_PHASE.INCOMPLETE,
            dispatchBlockReason: reasonMsg,
            pipelineProgress: null,
            workerResults: null,
          });
          await persistCycleAnalytics(config, blockedAnalytics);
          await appendGovernanceBlockEvent(config, {
            cycleId: cycleId,
            blockReason: reasonMsg,
            blockedAt: new Date().toISOString(),
            gateSource: "pre_dispatch_gate",
          });
          await recordCapabilityExecution(
            config,
            "dispatch-block-reason-reporting",
            `gateSource=pre_dispatch_gate reason=${reasonMsg.slice(0, 120)}`,
          );
        } catch (analyticsErr) {
          warn(`[orchestrator] Blocked-cycle analytics write failed (non-fatal): ${String(analyticsErr?.message || analyticsErr)}`);
        }
        return;
      }
    } catch (err) {
      warn(`[orchestrator] Pre-dispatch governance gate failed (non-fatal): ${String(err?.message || err)}`);
      emitEvent(EVENTS.ORCHESTRATION_HEALTH_DEGRADED, EVENT_DOMAIN.ORCHESTRATION, cycleId, {
        reason: "governance_gate_exception",
        error: String(err?.message || err),
        context: "cycle_dispatch"
      });
    }
  }

  // Governance freeze gate (T-040): check per-plan risk before dispatching.
  // During month-12 freeze, high-risk plans (riskLevel=high|critical) are blocked
  // unless a critical incident override is attached to the plan.
  {
    const freezeStatus = isFreezeActive(config);
    if (freezeStatus.active) {
      await appendProgress(config,
        `[CYCLE] Governance freeze active (reason=${freezeStatus.reason}) — evaluating plan risk levels`
      );
    }

    const filteredPlans = [];
    for (const plan of plans) {
      const gateResult = evaluateFreezeGate(config, {
        riskLevel:       plan.riskLevel || null,
        riskScore:       typeof plan.riskScore === "number" ? plan.riskScore : 0,
        criticalOverride: plan.criticalOverride || null
      });
      if (!gateResult.allowed) {
        await appendProgress(config,
          `[CYCLE] FREEZE BLOCKED plan for ${plan.role}: ${gateResult.reason}`
        );
        warn(`[orchestrator] governance freeze blocked plan for ${plan.role}: ${gateResult.reason}`);
        // No silent fallback: write a machine-readable blocked record
        continue;
      }
      if (gateResult.overrideApproved) {
        await appendProgress(config,
          `[CYCLE] Critical override granted for ${plan.role}: incidentId=${gateResult.overrideApproved.incidentId}`
        );
      }
      filteredPlans.push(plan);
    }

    if (filteredPlans.length < plans.length) {
      const blockedCount = plans.length - filteredPlans.length;
      await appendProgress(config,
        `[CYCLE] Governance freeze blocked ${blockedCount} of ${plans.length} plan(s) — proceeding with ${filteredPlans.length} allowed plan(s)`
      );
      // Reassign plans to only allowed set; if none remain, exit cycle
      plans.splice(0, plans.length, ...filteredPlans);
      if (plans.length === 0) {
        await appendProgress(config, "[CYCLE] All plans blocked by governance freeze — cycle complete");
        await safeUpdatePipelineProgress(config, "cycle_complete", "All plans blocked by governance freeze");
        return;
      }
    }
  }

  // Funnel tracking: capture dispatched count after all quality/freeze gates.
  const funnelDispatchedCount: number = plans.length;

  // ── Optimizer budget admission gate ──────────────────────────────────────
  // The intervention optimizer ranks plans by expected value and enforces all
  // three budget constraints (total, per-wave, per-role) simultaneously.
  // Its selected[] output is the authoritative set of plans admitted to dispatch.
  // Fail-open when the optimizer cannot run (invalid budget config, empty input,
  // or any exception) so a missing budget configuration never halts work.
  let optimizerUsage: {
    policyImpactPenaltiesApplied: number;
    benchmarkBoostsApplied: number;
    benchmarkTelemetryCount: number;
    failureClassificationsApplied: number;
    rerouteCostPenaltiesApplied: number;
    overbundlePenaltiesApplied: number;
  } | null = null;

  if (config?.runtime?.disableOptimizerAdmission !== true) {
    try {
      const interventions = buildInterventionsFromPlan(plans, config);
      const budgetInput = buildBudgetFromConfig(prometheusAnalysis?.requestBudget, config);

      // ── Policy impact: load learned policies and map to intervention scores ──
      let policyImpactByInterventionId: Record<string, unknown> | undefined;
      try {
        const learnedPoliciesRaw = await readJson(path.join(stateDir, "learned_policies.json"), []);
        const learnedPolicies = Array.isArray(learnedPoliciesRaw) ? learnedPoliciesRaw : [];
        if (learnedPolicies.length > 0 && Array.isArray(prometheusAnalysis?.plans)) {
          policyImpactByInterventionId = buildPolicyImpactByInterventionId(
            prometheusAnalysis.plans,
            learnedPolicies,
          );
        }
      } catch {
        // Non-fatal: learned policies unavailable, optimizer uses static estimates
      }

      // ── Benchmark telemetry: lane-level performance from previous cycle ─────
      const benchmarkTelemetry: Array<{ interventionId: string; observedSuccessRate: number; sampleCount: number }> = [];
      try {
        const prevAnalytics = await readCycleAnalytics(config);
        const prevLaneTelemetry = prevAnalytics?.lastCycle?.laneTelemetry;
        if (prevLaneTelemetry && typeof prevLaneTelemetry === "object") {
          // Convert lane-level telemetry to per-intervention benchmark signals.
          // Each plan is matched to its lane; the lane's observed completion rate
          // becomes the benchmark for that intervention.
          for (const plan of (Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans : [])) {
            const role = String(plan?.role || "evolution-worker");
            const lane = role.replace(/[-_]worker$/i, "").toLowerCase();
            const laneSignal = prevLaneTelemetry[lane] ?? prevLaneTelemetry["implementation"];
            if (!laneSignal) continue;
            const rate = Number(laneSignal.completionRate);
            if (!Number.isFinite(rate)) continue;
            const interventionId = String(plan?.intervention_id || plan?.id || plan?.task_id || "");
            if (interventionId) {
              benchmarkTelemetry.push({
                interventionId,
                observedSuccessRate: Math.max(0, Math.min(1, rate)),
                sampleCount: Number(laneSignal.dispatched ?? 1),
              });
            }
          }
        }
      } catch {
        // Non-fatal: lane telemetry unavailable, optimizer uses static estimates
      }

      // ── Failure classifications: load from state for optimizer SP adjustment ──
      // Classifications from previous cycle failures are loaded and passed as
      // failureClassifications so the optimizer can adjust successProbability
      // for roles that have recently failed, shifting budget to healthier lanes.
      let failureClassifications: Record<string, unknown> | undefined;
      try {
        const loaded = await loadRecentFailureClassifications(stateDir, 30);
        if (Object.keys(loaded).length > 0) {
          failureClassifications = loaded;
        }
      } catch { /* non-fatal — optimizer falls back to static estimates */ }

      // ── Anti-overbundle step count map: pass per-plan step complexity ──────
      // Maps intervention ID → ordered step count so the optimizer can apply
      // an EV penalty to over-complex plans that would exceed coherence limits
      // if dispatched as a single call.
      const overbundleStepCounts: Record<string, number> = {};
      for (let idx = 0; idx < plans.length; idx++) {
        const plan = plans[idx] as any;
        const interventionId = String(plan?.id ?? plan?.task_id ?? `plan-${idx + 1}`);
        const steps = Array.isArray(plan?.orderedSteps) ? plan.orderedSteps.length
          : Array.isArray(plan?.acceptance_criteria) ? plan.acceptance_criteria.length
          : 1;
        overbundleStepCounts[interventionId] = Math.max(1, steps);
      }

      const optimizerResult = runInterventionOptimizer(interventions, budgetInput, {
        policyImpactByInterventionId,
        failureClassifications,
        benchmarkTelemetry: benchmarkTelemetry.length > 0 ? benchmarkTelemetry : undefined,
        // Pass capability pool specialization utilization so the optimizer log records
        // the active workerPool policy alongside selection decisions for alignment
        // diagnostics between scoreboard, gate, and optimizer telemetry.
        specializationContext: (capabilityPoolResult as any)?.specializationUtilization ?? null,
        overbundleStepCounts,
        rerouteReasons: await (async () => {
          // Read reroute history from previous cycle to penalize underperforming lanes.
          try {
            const { readFile } = await import("node:fs/promises");
            const rerouteHistoryPath = path.join(stateDir, "reroute_history.jsonl");
            const raw = await readFile(rerouteHistoryPath, "utf8");
            const lines = raw.split("\n").filter(l => l.trim().length > 0);
            // Use last 20 reroute records as the penalty window
            return lines.slice(-20).map(line => {
              try { return JSON.parse(line); } catch { return null; }
            }).filter(Boolean);
          } catch {
            return [];
          }
        })(),
      });

      // Capture usage counters for cycle analytics propagation
      const optimizerResultAny = optimizerResult as any;
      optimizerUsage = {
        policyImpactPenaltiesApplied: Number(optimizerResultAny.policyImpactPenaltiesApplied ?? 0),
        benchmarkBoostsApplied: Number(optimizerResultAny.benchmarkBoostsApplied ?? 0),
        benchmarkTelemetryCount: Number(optimizerResultAny.benchmarkTelemetryCount ?? 0),
        failureClassificationsApplied: Number(optimizerResultAny.failureClassificationsApplied ?? 0),
        rerouteCostPenaltiesApplied: Number(optimizerResultAny.rerouteCostPenaltiesApplied ?? 0),
        overbundlePenaltiesApplied: Number(optimizerResultAny.overbundlePenaltiesApplied ?? 0),
      };

      // Persist for observability regardless of outcome
      await persistOptimizerLog(stateDir, optimizerResult).catch(() => {});

      if (
        optimizerResult.status !== OPTIMIZER_STATUS.INVALID_INPUT &&
        optimizerResult.status !== OPTIMIZER_STATUS.EMPTY_INPUT
      ) {
        const admittedIds = new Set(optimizerResult.selected.map((i: any) => i.id));
        const admittedPlans = plans.filter((plan: any, idx: number) => {
          const interventionId = String(plan?.id ?? `plan-${idx + 1}`);
          return admittedIds.has(interventionId);
        });

        if (admittedPlans.length < plans.length) {
          const rejectedCount = plans.length - admittedPlans.length;
          await appendProgress(config,
            `[OPTIMIZER] Budget admission: ${admittedPlans.length}/${plans.length} plan(s) admitted — ${rejectedCount} rejected (status=${optimizerResult.status} reason=${optimizerResult.reasonCode})`
          );
          plans.splice(0, plans.length, ...admittedPlans);
          if (plans.length === 0) {
            await appendProgress(config, "[CYCLE] All plans rejected by optimizer budget gate — cycle complete");
            await safeUpdatePipelineProgress(config, "cycle_complete", "All plans rejected by optimizer budget gate");
            return;
          }
        } else {
          await appendProgress(config,
            `[OPTIMIZER] Budget admission: all ${plans.length} plan(s) admitted (status=${optimizerResult.status}) policyPenalties=${optimizerUsage.policyImpactPenaltiesApplied} benchmarkBoosts=${optimizerUsage.benchmarkBoostsApplied}`
          );
        }
      }
    } catch (err) {
      warn(`[orchestrator] Optimizer admission gate failed (non-fatal): ${String(err?.message || err)}`);
    }
  }

  // Normalize analysis-only roles before batch planning so plans that will
  // be redirected to evolution-worker are co-batched together instead of
  // producing one thin batch per logical role (prometheus/athena/orchestrator).
  const normalizedPlansForBatching = plans.map((p: any) => {
    const resolved = resolveWorkerRole(p?.role, p?.taskKind || p?.kind || "implementation");
    return resolved !== (p?.role || "") ? { ...p, role: resolved } : p;
  });
  const redirectedCount = normalizedPlansForBatching.filter((p: any, i: number) => p.role !== (plans as any[])[i]?.role).length;
  if (redirectedCount > 0) {
    await appendProgress(config, `[BATCH_PLANNER] Normalized ${redirectedCount} analysis-only role(s) → evolution-worker for co-batching`);
  }

  // ── Token-first batch path ──────────────────────────────────────────────────
  // Use when:
  //   (a) Athena already ran deterministic rebatch (_batchIndex present), OR
  //   (b) config.planner.tokenFirstPacking === true (explicit opt-in)
  // Falls back to role-split path otherwise (backward-compatible).
  const athenaPreBatched = normalizedPlansForBatching.length > 0 &&
    Number.isFinite(Number((normalizedPlansForBatching[0] as any)?._batchIndex));
  const tokenFirstEnabled = (config as any)?.planner?.tokenFirstPacking !== false; // default ON
  const useTokenFirst = athenaPreBatched || tokenFirstEnabled;

  // If Athena already assigned deterministic batch indexes, keep those batches
  // and worker choices as-is instead of re-packing in orchestrator.
  const _rawWorkerBatches = athenaPreBatched
    ? (() => {
        const grouped = new Map<number, any[]>();
        for (const plan of normalizedPlansForBatching as any[]) {
          const bi = Number(plan?._batchIndex);
          const idx = Number.isFinite(bi) && bi > 0 ? Math.floor(bi) : 1;
          if (!grouped.has(idx)) grouped.set(idx, []);
          grouped.get(idx)!.push(plan);
        }

        const sortedIndexes = [...grouped.keys()].sort((a, b) => a - b);
        return sortedIndexes.map((batchIndex, pos) => {
          const batchPlans = grouped.get(batchIndex) || [];
          const role = String(
            batchPlans[0]?._batchWorkerRole
            || batchPlans[0]?.role
            || "evolution-worker"
          ).trim() || "evolution-worker";
          const wave = Number(batchPlans[0]?._batchWave || batchPlans[0]?.wave || 1);
          return {
            role,
            plans: batchPlans,
            wave,
            roleBatchIndex: pos + 1,
            roleBatchTotal: sortedIndexes.length,
            bundleIndex: pos + 1,
            totalBundles: sortedIndexes.length,
            githubFinalizer: pos === sortedIndexes.length - 1,
            tokenFirstPacked: true,
            athenaBatchAssigned: true,
          };
        });
      })()
    : (useTokenFirst
      ? await (async () => {
          try {
            const { readCalibrationState } = await import("./token_calibration.js");
            const calState = await readCalibrationState(config);
            return buildTokenFirstBatches(normalizedPlansForBatching, config, { calibrationState: calState });
          } catch {
            return buildTokenFirstBatches(normalizedPlansForBatching, config);
          }
        })()
      : buildRoleExecutionBatches(normalizedPlansForBatching, config, capabilityPoolResult));

  // ── Final dispatch-boundary hard cap ─────────────────────────────────────
  // Unconditional last safeguard: applied after all three batching paths
  // (Athena-prebatched, token-first, standard role-split) so no batch descriptor
  // delivered to a worker ever exceeds MAX_ACTIONABLE_STEPS_PER_PACKET tasks,
  // regardless of config state or which path produced the batches.
  let workerBatches = applyDispatchBoundaryHardCap(_rawWorkerBatches as any[]) as typeof _rawWorkerBatches;
  const packed = tightenRoleWaveBatches(workerBatches as any[], config);
  workerBatches = packed.batches as typeof _rawWorkerBatches;
  if (packed.mergedCount > 0) {
    await appendProgress(config,
      `[BATCH_PLANNER] Tight role-wave packing merged ${packed.mergedCount} adjacent small batch(es); now ${workerBatches.length} batch(es)`
    );
  }

  // ── DAG frontier + parallelism logging ────────────────────────────────────
  // Use computeFrontier to identify which plans are immediately dispatchable
  // (no unresolved dependencies) and log the DAG-derived parallelism bound.
  // This is advisory telemetry — never blocks dispatch.
  try {
    const frontierResult = computeFrontier(
      plans as any[],
      new Set<string>(), // no tasks completed yet at dispatch time
      new Set<string>(), // no tasks failed yet
      new Set<string>(), // no tasks in progress yet
    );
    const dagBound = (_rawWorkerBatches[0] as any)?.dagParallelismBound;
    if (frontierResult.frontier.length > 0 || dagBound !== undefined) {
      await appendProgress(
        config,
        `[DAG_DISPATCH] frontier=${frontierResult.frontier.length} ready task(s) of ${plans.length} total` +
        (dagBound !== undefined ? `; dagParallelismBound=${dagBound}` : "")
      );
    }
  } catch {
    // advisory — never block dispatch on frontier computation error
  }

  // ── Specialist telemetry for Athena-preassigned batches (Task 3) ───────────
  // buildTokenFirstBatches normally stamps specialistReroutes / specialistRerouteReasons /
  // specialistUtilizationTarget on workerBatches[0].  When Athena pre-assigned the
  // batch groupings the token-first path is bypassed, so those fields are missing and
  // the scoreboard / reroute-history never gets populated.
  // Derive equivalent telemetry from the already-computed capabilityPoolResult.
  if (athenaPreBatched && capabilityPoolResult && workerBatches.length > 0) {
    const firstBatch = workerBatches[0] as any;
    const util = capabilityPoolResult.specializationUtilization;

    // Detect reroutes: plans where Athena's _batchWorkerRole differs from the
    // pool-assigned role (the pool may have re-routed a specialist to evo-worker).
    const poolRoleByPlan = new Map<unknown, string>();
    for (const { plan, selection } of (capabilityPoolResult.assignments || [])) {
      poolRoleByPlan.set(plan, String(selection?.role || "evolution-worker"));
    }
    const athenaRerouteReasons: Array<{
      role: string; lane: string; reasonCode: string;
      fillRatio: number; laneScore: number; adaptiveFillThreshold: number;
    }> = [];
    for (const [plan, poolRole] of poolRoleByPlan.entries()) {
      const athenaRole = String((plan as any)?._batchWorkerRole || (plan as any)?.role || "evolution-worker");
      if (athenaRole !== poolRole) {
        athenaRerouteReasons.push({
          role: athenaRole,
          lane: String((plan as any)?._capabilityLane || "implementation"),
          reasonCode: "below_fill_threshold",
          fillRatio: 1.0,
          laneScore: 0.5,
          adaptiveFillThreshold: 1.0,
        });
      }
    }

    firstBatch.specialistReroutes = athenaRerouteReasons.map(r => r.role);
    firstBatch.specialistRerouteReasons = athenaRerouteReasons;
    if (util) {
      const total = workerBatches.length;
      firstBatch.specialistUtilizationTarget = {
        targetMet: util.specializationTargetsMet,
        achievedSpecializedCount: Math.round(util.specializedShare * total),
        requiredSpecializedCount: Math.round(util.adaptiveMinSpecializedShare * total),
        minSpecializedShare: util.minSpecializedShare,
        adaptiveMinSpecializedShare: util.adaptiveMinSpecializedShare,
      };
    }
  }

  if (useTokenFirst) {
    const reroutes = (workerBatches as any[])?.[0]?.specialistReroutes;
    const rerouteReasons = (workerBatches as any[])?.[0]?.specialistRerouteReasons;
    const specializationTarget = (workerBatches as any[])?.[0]?.specialistUtilizationTarget;
    const rerouteMsg = Array.isArray(reroutes) && reroutes.length > 0
      ? ` | specialist→evo reroutes: ${reroutes.join(", ")}`
      : "";
    const rebalanceMsg = specializationTarget?.rebalanceApplied === true
      ? ` | specialist rebalance: +${Number(specializationTarget.rebalancedCount || 0)}`
      : "";
    await appendProgress(config,
      `[BATCH_PLANNER] Token-first packing: ${normalizedPlansForBatching.length} plan(s) → ${workerBatches.length} batch(es)${
        athenaPreBatched ? " (Athena-selected batches applied)" : ""
      }${rerouteMsg}${rebalanceMsg}`
    );
    // Emit structured reroute telemetry for each rerouted specialist so the
    // adaptive threshold cycle can observe the reason codes and lane scores.
    if (Array.isArray(rerouteReasons) && rerouteReasons.length > 0) {
      for (const reason of rerouteReasons) {
        await appendProgress(config,
          `[BATCH_PLANNER] specialist_reroute reason=${reason.reasonCode} role=${reason.role} lane=${reason.lane} fillRatio=${reason.fillRatio} laneScore=${reason.laneScore} adaptiveThreshold=${reason.adaptiveFillThreshold}`
        );
      }
      // Persist reroute reasons to reroute_history.jsonl for next-cycle optimizer EV penalty.
      try {
        const { appendFileSync } = await import("node:fs");
        const rerouteHistoryPath = path.join(stateDir, "reroute_history.jsonl");
        for (const reason of rerouteReasons) {
          appendFileSync(rerouteHistoryPath, JSON.stringify({
            recordedAt: new Date().toISOString(),
            role: reason.role,
            lane: reason.lane,
            reasonCode: reason.reasonCode,
            fillRatio: reason.fillRatio,
            laneScore: reason.laneScore,
          }) + "\n", "utf8");
          emitEvent(EVENTS.POLICY_REROUTE_PENALTY_APPLIED, EVENT_DOMAIN.POLICY, `reroute-${reason.role}-${Date.now()}`, {
            role: reason.role,
            lane: reason.lane,
            reasonCode: reason.reasonCode,
            fillRatio: reason.fillRatio,
            laneScore: reason.laneScore,
          });
        }
      } catch (err) {
        warn(`[orchestrator] reroute history persist failed (non-fatal): ${String(err?.message || err)}`);
      }
    }

    if (
      config?.runtime?.enforceSpecialistUtilizationAdmission === true
      && specializationTarget
      && specializationTarget.targetMet !== true
    ) {
      const achieved = Number(specializationTarget.achievedSpecializedCount || 0);
      const required = Number(specializationTarget.requiredSpecializedCount || 0);
      await appendProgress(
        config,
        `[BATCH_PLANNER] Specialist utilization admission blocked dispatch: achieved=${achieved} required=${required}`
      );
      return;
    }
  }

  // ── Premium request gate ───────────────────────────────────────────────────
  // Warn when batch count is unexpectedly high relative to plan count.
  // minPossibleBatches = ceil(totalEstimatedTokens / usableContextTokens); we use
  // plan count as a practical proxy. If batches > plans + 1, log a warning.
  if (workerBatches.length > normalizedPlansForBatching.length + 1) {
    await appendProgress(config,
      `[BATCH_PLANNER] WARNING: generated ${workerBatches.length} batches for ${normalizedPlansForBatching.length} plan(s) — possible over-split; check estimatedExecutionTokens`
    );
  }

  // ── Ordered-step complexity hard admission (split-or-reject) ─────────────
  // Convert overbundle from advisory telemetry into an explicit dispatch guard.
  // Any batch above OVERBUNDLE_STEPS_THRESHOLD is split deterministically by
  // ordered-step cost. If a single plan exceeds the threshold, dispatch is blocked.
  {
    const complexityAdjusted: any[] = [];
    let splitCount = 0;
    let blockedReason = "";
    for (const batch of workerBatches as any[]) {
      const stepCount = Number(batch?.orderedStepCount ?? 0);
      if (stepCount <= OVERBUNDLE_STEPS_THRESHOLD) {
        complexityAdjusted.push(batch);
        continue;
      }
      const split = splitBatchByOrderedStepComplexity(batch, OVERBUNDLE_STEPS_THRESHOLD);
      if (split.length === 0) {
        const role = String(batch?.role || "unknown");
        blockedReason = `ordered_step_complexity_unsplittable:${role}:${stepCount}>${OVERBUNDLE_STEPS_THRESHOLD}`;
        break;
      }
      if (split.length > 1) splitCount += split.length - 1;
      complexityAdjusted.push(...split);
    }
    if (blockedReason) {
      await appendProgress(config, `[BATCH_PLANNER][OVERBUNDLE] Dispatch blocked — ${blockedReason}`);
      await safeUpdatePipelineProgress(config, "cycle_complete", `Dispatch blocked by ordered-step complexity gate: ${blockedReason}`);
      return;
    }
    if (splitCount > 0) {
      workerBatches = complexityAdjusted as typeof _rawWorkerBatches;
      await appendProgress(
        config,
        `[BATCH_PLANNER][OVERBUNDLE] Complexity split applied: +${splitCount} batch(es), threshold=${OVERBUNDLE_STEPS_THRESHOLD}`
      );
    }
  }

  await safeUpdatePipelineProgress(config, "workers_dispatching", `Dispatching ${workerBatches.length} worker batch(es)`, {
    workersTotal: workerBatches.length,
    workersDone: 0
  });

  const dispatchCheckpoint = await beginDispatchCheckpoint(config, workerBatches, plans.length);
  let workersDone = 0;
  let pendingCycleHealthRecord: Record<string, unknown> | null = null;
  const allWorkerResults: Array<{
    roleName: string;
    status: string;
    verificationEvidence?: unknown;
    dispatchContract?: {
      doneWorkerWithVerificationReportEvidence?: boolean;
      doneWorkerWithCleanTreeStatusEvidence?: boolean;
      dispatchBlockReason?: string | null;
      replayClosure?: {
        contractSatisfied?: boolean;
        canonicalCommands?: string[];
        executedCommands?: string[];
        rawArtifactEvidenceLinks?: string[];
      } | null;
    } | null;
    dispatchBlockReason?: string | null;
  }> = [];
  // Collects (taskText, verificationEvidence) from successful workers for
  // carry-forward auto-close matching at end of cycle.
  const resolvedPlanItems: Array<{ taskText: string; verificationEvidence: unknown }> = [];

  // ── Strict wave boundary tracking ──────────────────────────────────────────
  // Each time the wave number changes, we log an explicit boundary event.
  // Reaching a new wave boundary in the loop guarantees all preceding wave's
  // batches completed successfully (the loop returns early on any failure),
  // giving a hard sequential barrier between waves.
  let currentDispatchWave: number | null = null;
  let waveBoundaryStartMs: number | null = null;  // ms timestamp when last wave completed
  let waveBatchCount = 0;                          // batches dispatched in current wave
  const cycleRetryTelemetry = await loadRetryTelemetryContext(config);
  const dispatchArtifactCycleId = normalizeCycleId((await readPipelineProgress(config).catch(() => null))?.startedAt || cycleStartedAt);

  for (const batch of workerBatches) {
    // ── Cooperative cancellation checkpoint ─────────────────────────────────
    // Check both the in-process token and the on-disk stop file so a stop
    // request is honoured within the current batch cycle rather than only at
    // the top of the next main-loop iteration.
    checkCancellationAtCheckpoint(_token);
    const stopReq = await readStopRequest(config);
    if (stopReq?.requestedAt) {
      _token?.cancel(`stop-requested:${stopReq.reason || "unknown"}`);
      await appendProgress(config, `[CYCLE] Stop requested — halting dispatch`);
      return;
    }

    // ── Wave boundary gate ───────────────────────────────────────────────────
    // Detect wave transitions. Arrival here proves all prior-wave batches done.
    const batchWave = typeof (batch as any).wave === "number" ? (batch as any).wave : null;
    if (batchWave !== null && batchWave !== currentDispatchWave) {
      if (currentDispatchWave !== null) {
        await appendProgress(config,
          `[WAVE_BOUNDARY] Wave ${currentDispatchWave} complete — all batches succeeded. Crossing to wave ${batchWave}.`
        );
        // ── Measure and persist wave boundary idle gap ──────────────────────
        const waveBoundaryEndMs = Date.now();
        if (waveBoundaryStartMs !== null) {
          try {
            const { appendFileSync } = await import("node:fs");
            const idleRecord = measureWaveBoundaryIdleGap(
              currentDispatchWave,
              batchWave,
              waveBoundaryStartMs,
              waveBoundaryEndMs,
              waveBatchCount,
            );
            appendFileSync(
              path.join(stateDir, "wave_boundary_idle.jsonl"),
              JSON.stringify(idleRecord) + "\n",
              "utf8",
            );
            await appendProgress(config,
              `[WAVE_BOUNDARY] Idle gap measured: waveFrom=${idleRecord.waveFrom} waveTo=${idleRecord.waveTo} idleMs=${idleRecord.idleMs} batchCount=${idleRecord.batchCount}`
            );
            // Log packing opportunity if the heuristic detects a safe co-pack
            const fromBatches = (workerBatches as any[]).filter(b => b.wave === currentDispatchWave);
            const toBatches = (workerBatches as any[]).filter(b => b.wave === batchWave);
            if (shouldPackAcrossWaveBoundary(fromBatches, toBatches)) {
              await appendProgress(config,
                `[WAVE_BOUNDARY] Packing opportunity detected: singleton wave ${currentDispatchWave} could be co-packed into wave ${batchWave} (no dependency violation)`
              );
            }
          } catch (wbErr) {
            warn(`[orchestrator] wave boundary idle persist failed (non-fatal): ${String(wbErr?.message || wbErr)}`);
          }
        }
        waveBatchCount = 0;
      }
      currentDispatchWave = batchWave;
      await appendProgress(config,
        `[WAVE_BOUNDARY] Starting wave ${batchWave} — batch ${workersDone + 1}/${workerBatches.length}`
      );
    }
    waveBatchCount += 1;

    await safeUpdatePipelineProgress(config, "workers_running", `Running worker batch ${workersDone + 1}/${workerBatches.length}: ${batch.role}`, {
      workersTotal: workerBatches.length,
      workersDone,
      currentWorker: batch.role
    });
    const workerPremiumEvent = await spendPremium(
      String(batch.role || "worker"),
      "worker_batch_dispatch",
      { pendingOutcome: true },
    );
    await appendProgress(config, `[AGENT] » WORKER · ${batch.role} · batch=${workersDone + 1}/${workerBatches.length} · req#${_cycleRequests} this cycle`);
    await persistWorkerDispatchArtifacts(config, {
      cycleId: dispatchArtifactCycleId,
      role: String(batch?.role || ""),
      phase: "start",
      batch,
    });

    let workerResult;
    let transientRetries = 0;
    for (;;) {
      try {
        workerResult = await dispatchWorker(config, batch);
      } catch (err) {
        const msg = String(err?.message || err).slice(0, 200);
        await appendProgress(config, `[CYCLE] Worker ${batch.role} failed: ${msg}`);
        warn(`[orchestrator] worker dispatch error: ${msg}`);
        workerResult = { roleName: batch.role, status: "error", summary: msg };
      }

      // Auto-retry on transient API errors with escalating cooldown
      const isTransient = String(workerResult?.status || "") === "transient_error";
      const retryDecision = isTransient
        ? assessRetryExpectedROI({
            attempt: transientRetries + 1,
            maxRetries: MAX_TRANSIENT_RETRIES,
            taskKind: String((batch as any)?.taskKind || "implementation"),
            premiumUsageData: cycleRetryTelemetry.premiumUsageData,
            benchmarkGroundTruth: cycleRetryTelemetry.benchmarkGroundTruth,
            minExpectedGain: Number(config?.runtime?.retryRoiMinExpectedGain ?? 0.18),
          })
        : null;
      if (isTransient && retryDecision?.allowRetry) {
        transientRetries++;
        const cooldownMs = transientRetries * 3 * 60 * 1000;
        await appendProgress(config,
          `[CYCLE] Transient API error — retry ${transientRetries}/${MAX_TRANSIENT_RETRIES}, expected_gain=${retryDecision.expectedGain.toFixed(3)} (threshold=${retryDecision.threshold.toFixed(3)}), cooling down ${Math.round(cooldownMs / 1000)}s`
        );
        await sleep(cooldownMs);
        continue;
      }
      if (isTransient && retryDecision && !retryDecision.allowRetry) {
        await appendProgress(
          config,
          `[CYCLE] Transient API error — retry suppressed (low ROI): expected_gain=${retryDecision.expectedGain.toFixed(3)} threshold=${retryDecision.threshold.toFixed(3)} reason=${retryDecision.reason}`
        );
        emitEvent(EVENTS.POLICY_RETRY_SUPPRESSED, EVENT_DOMAIN.POLICY, `retry-suppress-${Date.now()}`, {
          role: String(batch.role || "unknown"),
          expectedGain: retryDecision.expectedGain,
          threshold: retryDecision.threshold,
          reason: retryDecision.reason,
          attempt: transientRetries + 1,
        });
      }
      break;
    }

    await persistWorkerDispatchArtifacts(config, {
      cycleId: dispatchArtifactCycleId,
      role: String(batch?.role || ""),
      phase: "complete",
      batch,
      workerResult,
    });

    if (!isDispatchOutcomeSuccessful(workerResult)) {
      markPremiumOutcome(workerPremiumEvent.eventId, false);
      // Classify and persist the failure for use in the next cycle's optimizer input.
      try {
        const classifyResult = classifyFailure({
          workerStatus: String(workerResult?.status || "error"),
          errorMessage: String(workerResult?.summary || workerResult?.raw || "").slice(0, 500),
          blockingReasonClass: workerResult?.reasonCode || null,
          taskId: String(batch.role || ""),
        });
        if (classifyResult.ok) {
          const currentStateDir = config.paths?.stateDir || "state";
          await persistFailureClassification(currentStateDir, normalizeRoleKey(String(batch.role || "")), classifyResult.classification);
        }
      } catch { /* non-fatal — classification never blocks dispatch */ }

      if (shouldFailCloseDispatchOutcome(workerResult)) {
        await failCloseDispatchCheckpoint(config, dispatchCheckpoint, {
          reasonCode: workerResult?.reasonCode || null,
          retryClass: workerResult?.retryClass || null,
          workerStatus: workerResult?.status || null,
          batchIndex: workersDone + 1,
          totalBatches: workerBatches.length,
        });
        await appendProgress(config,
          `[CYCLE][FAIL_CLOSE] Worker batch ${workersDone + 1}/${workerBatches.length} ended with status=${workerResult?.status || "unknown"} reason_code=${workerResult?.reasonCode || "unknown"} retry_class=${workerResult?.retryClass || "none"}; checkpoint marked failed_closed (no retry)`
        );
        await safeUpdatePipelineProgress(config, "cycle_complete", `Dispatch fail-closed at batch ${workersDone + 1}/${workerBatches.length}`, {
          workersTotal: workerBatches.length,
          workersDone,
          currentWorker: batch.role,
        });
        return;
      }
      await appendProgress(config,
        `[CYCLE] Worker batch ${workersDone + 1}/${workerBatches.length} ended with status=${workerResult?.status || "unknown"}; checkpoint not advanced so it can be retried`
      );
      // Emit retry ROI signal for non-transient failures to inform next-cycle decisions.
      try {
        const nonTransientROI = assessRetryExpectedROI({
          attempt: transientRetries + 1,
          maxRetries: MAX_TRANSIENT_RETRIES,
          taskKind: String((batch as any)?.taskKind || "implementation"),
          premiumUsageData: cycleRetryTelemetry.premiumUsageData,
          benchmarkGroundTruth: cycleRetryTelemetry.benchmarkGroundTruth,
          minExpectedGain: Number(config?.runtime?.retryRoiMinExpectedGain ?? 0.18),
        });
        await appendProgress(config,
          `[RETRY_ROI] batch=${batch.role} allowRetry=${nonTransientROI.allowRetry} gain=${nonTransientROI.expectedGain.toFixed(3)} threshold=${nonTransientROI.threshold.toFixed(3)} reason=${nonTransientROI.reason}`
        );
      } catch { /* non-fatal — ROI logging must never block orchestration */ }
      return;
    }

    markPremiumOutcome(workerPremiumEvent.eventId, isAnalyticsCompletedWorkerStatus(String(workerResult?.status || "unknown")));

    workersDone += 1;
    allWorkerResults.push({
      roleName: batch.role,
      status: String(workerResult?.status || "unknown"),
      verificationEvidence: workerResult?.verificationEvidence || null,
      dispatchContract: workerResult?.dispatchContract || null,
      dispatchBlockReason: workerResult?.dispatchBlockReason || null,
    });
    // replayClosureContract is reserved for future replay-gate wiring
    const replayClosureContract: { contractSatisfied?: boolean } | undefined = undefined;
    if (workerResult?.verificationEvidence || replayClosureContract?.contractSatisfied === true) {
      const batchPlansList = Array.isArray((batch as any).plans) ? (batch as any).plans : [];
      for (const plan of batchPlansList) {
        const taskText = String((plan as any)?.task || "").trim();
        if (taskText.length >= 10) {
          resolvedPlanItems.push({
            taskText,
            verificationEvidence: {
              workerContract: workerResult.verificationEvidence,
              replayClosure: replayClosureContract,
              doneWorkerWithVerificationReportEvidence: workerResult?.dispatchContract?.doneWorkerWithVerificationReportEvidence === true,
              doneWorkerWithCleanTreeStatusEvidence: workerResult?.dispatchContract?.doneWorkerWithCleanTreeStatusEvidence === true,
              dispatchBlockReason: workerResult?.dispatchBlockReason || null,
            },
          });
        }
      }

      // ── Mark synthesis topics consumed by completed plans ──────────────────
      // When a plan with synthesis_sources completes, mark those topics as
      // "completed" in topic memory so the scout gate can detect full consumption.
      try {
        const stateDir = config.paths?.stateDir || "state";
        const batchPlans = Array.isArray((batch as any).plans) ? (batch as any).plans : [];
        const completedTopicKeys: string[] = [];
        for (const plan of batchPlans) {
          const sources = Array.isArray((plan as any).synthesis_sources) ? (plan as any).synthesis_sources as string[] : [];
          for (const s of sources) {
            completedTopicKeys.push(prometheusTopicKey(s));
          }
        }
        if (completedTopicKeys.length > 0) {
          const topicMemory = await loadTopicMemory(stateDir);
          const existingKeys = Object.keys(topicMemory.topics);
          const now = new Date().toISOString();
          let changed = false;
          for (const rawKey of completedTopicKeys) {
            const key = findCanonicalTopicKey(rawKey, existingKeys);
            if (topicMemory.topics[key] && topicMemory.topics[key].status !== "completed") {
              topicMemory.topics[key].status = "completed";
              topicMemory.topics[key].lastUpdatedAt = now;
              topicMemory.topics[key].completedSummary =
                topicMemory.topics[key].completedSummary ||
                `Completed via worker plan execution (batch role=${batch.role})`;
              topicMemory.topics[key].knowledgeFragments = [];
              changed = true;
            }
          }
          if (changed) {
            await saveTopicMemory(stateDir, topicMemory);
            await appendProgress(config,
              `[TOPIC_MEMORY] Marked ${completedTopicKeys.length} synthesis topic(s) consumed by ${batch.role} batch`
            );
          }
        }
      } catch {
        // Non-fatal — topic tracking never blocks dispatch
      }
    }

    await appendProgress(config, `[WORKER_BATCH] ✓ BATCH ${workersDone}/${workerBatches.length} DONE  role=${batch.role}  status=${workerResult?.status || "unknown"}  total_req=${_cycleRequests}`);

    // Record the timestamp when this batch completed — used as the idle-gap start
    // when the next wave boundary crossing is detected.
    waveBoundaryStartMs = Date.now();

    // ── Token calibration: record estimated vs proxy-actual tokens ──────────
    // Use worker response length as a proxy for actual token consumption.
    // Real provider-level token counts can replace this when available.
    try {
      const rawLen = String(workerResult?.raw || "").length;
      if (rawLen > 0 && Number.isFinite((batch as any).estimatedTokens) && (batch as any).estimatedTokens > 0) {
        const { recordCalibrationSample } = await import("./token_calibration.js");
        // Proxy: response chars / 4 + estimated input ≈ total session tokens
        const proxyActual = Math.ceil(rawLen / 4) + (batch as any).estimatedTokens;
        await recordCalibrationSample(
          config,
          String(batch.role || "evolution-worker"),
          (batch as any).estimatedTokens,
          proxyActual
        );
      }
    } catch {
      // Calibration is advisory — never block dispatch
    }

    const dispatchCheckpointUpdate = await updateDispatchCheckpointProgress(config, dispatchCheckpoint, workersDone);
    if (dispatchCheckpointUpdate.rolledOver && dispatchCheckpointUpdate.activeSegment && dispatchCheckpointUpdate.previousSegment) {
      await appendProgress(
        config,
        `[RUN_SEGMENT] rollover complete: segment ${String((dispatchCheckpointUpdate.previousSegment as any).segmentIndex)} -> ${String((dispatchCheckpointUpdate.activeSegment as any).segmentIndex)}`
      );
      await safeUpdatePipelineProgress(config, "workers_running", `Run segment rollover to ${String((dispatchCheckpointUpdate.activeSegment as any).segmentIndex)}`, {
        workersTotal: workerBatches.length,
        workersDone,
        currentWorker: batch.role,
        runSegment: dispatchCheckpointUpdate.activeSegment,
        runSegmentRollover: dispatchCheckpointUpdate.previousSegment,
        runSegmentHistorySize: dispatchCheckpointUpdate.historySize,
      });
    }
    await waitForWorkersToFinish(config);

    // Inter-batch rate-limit cooldown to avoid transient API errors
    const cycleDelay = Number(config?.runtime?.interBatchDelayMs || 90000);
    if (workersDone < workerBatches.length && cycleDelay > 0) {
      await appendProgress(config, `[CYCLE] Inter-batch cooldown ${Math.round(cycleDelay / 1000)}s to avoid rate limits`);
      await sleep(cycleDelay);
    }
  }

  await completeDispatchCheckpoint(config, dispatchCheckpoint);

  await safeUpdatePipelineProgress(config, "workers_finishing", "All workers finishing up", {
    workersTotal: workerBatches.length,
    workersDone: workerBatches.length
  });

  await appendProgress(config, "[CYCLE] ── All workers dispatched — cycle complete ──");
  await appendProgress(config, `[CYCLE DONE] ════════ ${_cycleRequests} premium requests | ${workerBatches.length} batch(es) | elapsed=${Math.round((Date.now() - new Date(cycleStartedAt).getTime()) / 1000)}s ════════`);
  await appendProgress(config, `[RUN] RUN DONE — ${workerBatches.length} batch(es) completed`);
  await safeUpdatePipelineProgress(config, "cycle_complete", `Cycle complete — ${workerBatches.length} worker batch(es) processed`, {
    workersTotal: workerBatches.length,
    workersDone: workerBatches.length
  });

  // ── Jesus outcome ledger — per-cycle strategy-to-outcome closure ────────────
  // Records directive hash, plan/execution counts, budget delta, and CI outcome
  // so that Jesus can observe strategy effectiveness across cycles.
  try {
    const successfulWorkerCount = allWorkerResults.filter(r => r.status === "done" || r.status === "success").length;
    const jesusOutcome = buildJesusDecisionOutcome({
      directiveHash: String((jesusDecision as any)?.githubStateHash || ""),
      plansGenerated: prometheusAnalysis?.plans?.length ?? 0,
      plansExecuted: successfulWorkerCount,
      budgetDelta: typeof (optimizerUsage as any)?.totalBudgetUsed === "number"
        ? (optimizerUsage as any).totalBudgetUsed
        : 0,
      ciOutcome: String((jesusDecision as any)?.githubCiContext?.latestMainCi?.conclusion || "unknown"),
    });
    await appendJesusOutcomeLedger(stateDir, jesusOutcome);
    await appendProgress(config,
      `[JESUS_LEDGER] Outcome recorded: plansGenerated=${jesusOutcome.plansGenerated} plansExecuted=${jesusOutcome.plansExecuted} ciOutcome=${jesusOutcome.ciOutcome}`
    );
  } catch (ledgerErr) {
    warn(`[orchestrator] jesus outcome ledger emit failed (non-fatal): ${String(ledgerErr?.message || ledgerErr)}`);
  }

  // ── SLO check: compute and persist cycle-level SLO metrics ─────────────────
  // cycle_id = pipeline_progress.startedAt (the canonical cycle identifier).
  // All latency inputs are read from pipeline_progress.json.stageTimestamps.
  // This runs after cycle_complete so all stage timestamps are present.
  try {
    const progress = await readPipelineProgress(config);
    const cycleRecord = computeCycleSLOs(
      config,
      progress.stageTimestamps || {},
      progress.startedAt || null,
      progress.completedAt || new Date().toISOString()
    );
    await persistSloMetrics(config, cycleRecord);

    if (cycleRecord.sloBreaches.length > 0) {
      const breachSummary = cycleRecord.sloBreaches
        .map(b => `${b.metric}=${b.actual}ms threshold=${b.threshold}ms severity=${b.severity}`)
        .join("; ");
      await appendProgress(config, `[SLO] Cycle SLO breaches detected: ${breachSummary}`);

      for (const breach of cycleRecord.sloBreaches) {
        await appendAlert(config, {
          severity: breach.severity === "critical" ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
          source: "slo_checker",
          title: `SLO breach: ${breach.metric}`,
          message: `actual=${breach.actual}ms threshold=${breach.threshold}ms cycleId=${cycleRecord.cycleId || "unknown"} reason=${breach.reason}`
        });
      }

      // Write degraded health when SLO breaches are detected (AC3/AC14 — must call writeOrchestratorHealth, not just appendAlert)
      if (config?.slo?.degradedOnBreach !== false) {
        await writeOrchestratorHealth(stateDir, ORCHESTRATOR_STATUS.DEGRADED, "slo_breach",
          cycleRecord.sloBreaches.map(b => `${b.metric}: actual=${b.actual}ms threshold=${b.threshold}ms severity=${b.severity}`)
        );
      }
    } else {
      await appendProgress(config, `[SLO] Cycle SLO check passed — all metrics within thresholds (cycleId=${cycleRecord.cycleId || "unknown"})`);
    }
  } catch (err) {
    // SLO check is advisory — never block orchestration
    warn(`[orchestrator] SLO check failed (non-fatal): ${String(err?.message || err)}`);
    await appendProgress(config, `[SLO] SLO check failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Premium efficiency variants: computed once, shared by analytics and band monitor ──
  // Raw variant (backward-compat): fraction of settled premium events that succeeded at the API level.
  // Execution-adjusted (backward-compat): replaces worker-slot success signals with verified-done evidence.
  // rawPremiumEfficiency (new): verifiedDoneWorkers / allCyclePremiumRequests — output-quality focused.
  // executionAdjustedPremiumEfficiency (new): same numerator, denominator excludes mandatory leadership requests.
  // All are computed here (before analytics) so both channels see identical values.
  const _LEADERSHIP_AGENTS = new Set(["jesus", "prometheus", "athena", "research-scout"]);
  const _premiumSettled = premiumEvents.filter((row) => row.success !== null);
  const _premiumSuccessful = _premiumSettled.filter((row) => row.success === true).length;
  const _premiumEfficiencyRaw: number | null = _premiumSettled.length > 0
    ? Math.max(0, Math.min(1, _premiumSuccessful / _premiumSettled.length))
    : null;
  const _verifiedDoneWorkers = allWorkerResults.filter((row: any) => {
    const status = String(row?.status || "").toLowerCase();
    if (status !== "done" && status !== "success") return false;
    const contractEvidence = row?.dispatchContract?.doneWorkerWithVerificationReportEvidence;
    if (contractEvidence === true) return true;
    return hasVerificationReportEvidence(String(row?.verificationEvidence || row?.fullOutput || ""));
  }).length;
  const _leadershipSuccesses = _premiumSettled.filter(
    (row) => _LEADERSHIP_AGENTS.has(row.agent) && row.success === true,
  ).length;
  const _premiumEfficiencyAdjusted: number | null = _premiumSettled.length > 0
    ? Math.max(0, Math.min(1, (_leadershipSuccesses + _verifiedDoneWorkers) / _premiumSettled.length))
    : null;
  // New explicit metrics — output-quality-focused, not API-success-focused.
  const _allCyclePremiumRequests = premiumEvents.length;
  const _leadershipRequests = premiumEvents.filter((row) => _LEADERSHIP_AGENTS.has(row.agent)).length;
  const _rawPremiumEfficiency: number | null = _allCyclePremiumRequests > 0
    ? Math.max(0, Math.min(1, _verifiedDoneWorkers / _allCyclePremiumRequests))
    : null;
  const _workerOnlyDenominator = _allCyclePremiumRequests - _leadershipRequests;
  const _executionAdjustedPremiumEfficiency: number | null = _workerOnlyDenominator > 0
    ? Math.max(0, Math.min(1, _verifiedDoneWorkers / _workerOnlyDenominator))
    : null;

  // ── Cycle analytics: compute and persist KPIs, confidence, and causal links ─
  // Advisory — never blocks orchestration. Runs after SLO so sloRecord is available.
  // Risk note (Athena AC19): per-cycle file I/O on hot path, wrapped in try/catch.
  try {
    const progressForAnalytics = await readPipelineProgress(config);
    // Re-read the SLO record that was just persisted to get the computed values.
    // Import here to avoid a circular reference — slo_checker has no dep on cycle_analytics.
    const { readSloMetrics } = await import("./slo_checker.js");
    const sloState = await readSloMetrics(config);
    const sloRecord = sloState?.lastCycle ?? null;

    // ── Tier counts: classify dispatched plans by riskLevel ──────────────────
    // T1 = routine (riskLevel absent or "low"), T2 = medium, T3 = architectural ("high"|"critical").
    // Computed from the plans array after all gates so counts reflect actual dispatch distribution.
    const tierCountsForAnalytics = Array.isArray(plans) && plans.length > 0
      ? (() => {
          let T1 = 0; let T2 = 0; let T3 = 0;
          for (const p of plans as any[]) {
            const risk = String(p?.riskLevel || "").toLowerCase();
            if (risk === "high" || risk === "critical") T3 += 1;
            else if (risk === "medium") T2 += 1;
            else T1 += 1;
          }
          return { T1, T2, T3 };
        })()
      : null;

    // ── Fast-path counts: Athena auto-approve vs full AI review ──────────────
    // planReview.autoApproved=true means all plans cleared the deterministic gate.
    // Counts are plan-level: all funnelApprovedCount plans are either all auto-approved or all full-reviewed.
    // autoApproveReasonCode and gateBlockRiskAtApproval are propagated so cycle_analytics
    // can reflect real dispatch feasibility (gateBlockRiskAtApproval was previously always null).
    const fastPathCountsForAnalytics = typeof funnelApprovedCount === "number" && funnelApprovedCount >= 0
      ? (planReview?.autoApproved === true
          ? {
              athenaAutoApproved: funnelApprovedCount,
              athenaFullReview: 0,
              autoApproveReasonCode: (planReview?.autoApproveReason as any)?.code ?? null,
              gateBlockRiskAtApproval: (planReview as any)?.gateBlockRiskAtApproval ?? null,
            }
          : {
              athenaAutoApproved: 0,
              athenaFullReview: funnelApprovedCount,
              autoApproveReasonCode: null,
              gateBlockRiskAtApproval: (planReview as any)?.gateBlockRiskAtApproval ?? null,
            })
      : null;

    const analyticsRecord = computeCycleAnalytics(config, {
      sloRecord,
      pipelineProgress: progressForAnalytics,
      workerResults: allWorkerResults.length > 0 ? allWorkerResults : null,
      planCount: Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans.length : null,
      phase: CYCLE_PHASE.COMPLETED,
      prometheusAnalysis,
      athenaPlanReview: planReview,
      parserBaselineRecovery: baselineRecoveryRecord ?? null,
      optimizerUsage,
      tierCounts: tierCountsForAnalytics,
      fastPathCounts: fastPathCountsForAnalytics,
      funnelCounts: {
        generated:  Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans.length : null,
        approved:   funnelApprovedCount,
        dispatched: funnelDispatchedCount,
        completed:  allWorkerResults.filter(r => isAnalyticsCompletedWorkerStatus(r.status)).length,
      },
      premiumUsageLog: await readJson(path.join(stateDir, "premium_usage_log.json"), []),
      premiumEfficiencyRaw: _premiumEfficiencyRaw,
      premiumEfficiencyAdjusted: _premiumEfficiencyAdjusted,
      rawPremiumEfficiency: _rawPremiumEfficiency,
      executionAdjustedPremiumEfficiency: _executionAdjustedPremiumEfficiency,
      memoryHitLog: await readJson(path.join(stateDir, "memory_hit_log.json"), []),
    });
    await persistCycleAnalytics(config, analyticsRecord);

    // ── Health channel: degrade signals only, separate from KPI semantics ──
    // cycle_health.json changes only when the system genuinely degrades,
    // not when metric definitions change (dual-channel contract).
    const coupledAlerts = detectCoupledAlerts(sloRecord, analyticsRecord.funnel?.completionRate ?? null);
    const healthRecord = computeCycleHealth(analyticsRecord, [], coupledAlerts);
    pendingCycleHealthRecord = healthRecord;

    await appendProgress(config, `[ANALYTICS] Cycle analytics written — confidence=${analyticsRecord.confidence.level} sloStatus=${analyticsRecord.kpis.sloStatus} phase=${analyticsRecord.phase} health=${healthRecord.healthScore}`);
  } catch (err) {
    // Analytics are advisory — never block orchestration
    warn(`[orchestrator] Cycle analytics failed (non-fatal): ${String(err?.message || err)}`);
    await appendProgress(config, `[ANALYTICS] Cycle analytics failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Intervention judge: evaluate cycle outcomes and decide promote/hold/rework/rollback ──
  // Mandatory per cycle — produces state/intervention_judge_report.json.
  // Deterministic decision layer runs first; AI (intervention-reviewer) is consulted
  // only for ambiguous cases. Hard guardrail breaches override AI recommendations.
  // Advisory — never blocks orchestration.
  try {
    if (config.runtime?.interventionJudgeEnabled === false) {
      await appendProgress(config, "[INTERVENTION_JUDGE] Skipped — interventionJudgeEnabled=false");
    } else {
      const analyticsForJudge = pendingCycleHealthRecord
        ? await readJson(path.join(stateDir, "cycle_analytics.json"), null)
        : null;
      const latestAnalytics = analyticsForJudge?.lastCycle ?? analyticsForJudge ?? null;
      const interventionJudgeReport = await evaluateInterventionsForCycle(config, {
        cycleId: String((await readPipelineProgress(config))?.startedAt || cycleStartedAt),
        plans: Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans : [],
        analyticsRecord: latestAnalytics,
        healthRecord: pendingCycleHealthRecord,
        workerResults: allWorkerResults.map(r => ({ roleName: r.roleName, status: r.status })),
        requestBudget: prometheusAnalysis?.requestBudget ?? null,
      });

      const decisions = Array.isArray(interventionJudgeReport?.decisions) ? interventionJudgeReport.decisions : [];
      const decisionSummary = decisions.map((d: any) => `${d.interventionId}=${d.decision}`).join(", ");
      await appendProgress(config, `[INTERVENTION_JUDGE] Cycle evaluation complete — ${decisions.length} decision(s): ${decisionSummary || "none"}`);

      // Action executor: convert judge decisions into deterministic runtime actions.
      // Promote/Hold/Rework are ledgered; Rollback optionally triggers rollback engine.
      const policyLedgerPath = path.join(stateDir, "intervention_policy_ledger.json");
      const policyLedger = await readJson(policyLedgerPath, {
        schemaVersion: 1,
        entries: [],
        updatedAt: null,
      });
      const existingEntries = Array.isArray(policyLedger?.entries) ? policyLedger.entries : [];
      const actionCounters = { promote: 0, hold: 0, rework: 0, rollback: 0, rollbackExecuted: 0 };

      for (const d of decisions as any[]) {
        const finalDecision = String(d?.decision || "hold").toLowerCase();
        if (finalDecision === "promote") actionCounters.promote += 1;
        else if (finalDecision === "rework") actionCounters.rework += 1;
        else if (finalDecision === "rollback") actionCounters.rollback += 1;
        else actionCounters.hold += 1;

        existingEntries.push({
          recordedAt: new Date().toISOString(),
          cycleId: String(interventionJudgeReport?.cycleId || cycleStartedAt),
          interventionId: String(d?.interventionId || "unknown"),
          decision: finalDecision,
          reason: String(d?.reason || "unknown"),
          decisionMode: String(d?.decisionMode || "unknown"),
          aiUsed: d?.aiReviewStatus === "ok",
          aiConfidence: typeof d?.aiConfidence === "number" ? d.aiConfidence : null,
        });

        if (finalDecision === "rollback" && config.runtime?.interventionJudgeExecuteRollback === true) {
          const rollbackResult = await executeRollback({
            level: ROLLBACK_LEVEL.CONFIG_ONLY,
            trigger: ROLLBACK_TRIGGER.CANARY_ROLLBACK,
            evidence: {
              controlValue: (d?.rollbackControlValue && typeof d.rollbackControlValue === "object") ? d.rollbackControlValue : {},
              reasonCode: "INTERVENTION_JUDGE_ROLLBACK",
              interventionId: String(d?.interventionId || "unknown"),
            },
            config,
            stateDir,
          });
          if (rollbackResult?.ok) {
            actionCounters.rollbackExecuted += 1;
          }
          await appendProgress(config, `[INTERVENTION_JUDGE] Rollback decision executed for ${String(d?.interventionId || "unknown")} ok=${String(Boolean(rollbackResult?.ok))} reason=${String(rollbackResult?.reason || "none")}`);
        }
      }

      if (existingEntries.length > 400) {
        existingEntries.splice(0, existingEntries.length - 400);
      }
      await writeJson(policyLedgerPath, {
        schemaVersion: 1,
        entries: existingEntries,
        updatedAt: new Date().toISOString(),
      });

      await appendProgress(
        config,
        `[INTERVENTION_EXECUTOR] promote=${actionCounters.promote} hold=${actionCounters.hold} rework=${actionCounters.rework} rollback=${actionCounters.rollback} rollbackExecuted=${actionCounters.rollbackExecuted}`
      );
    }
  } catch (err) {
    // Advisory — never blocks orchestration
    warn(`[orchestrator] Intervention judge failed (non-fatal): ${String(err?.message || err)}`);
    await appendProgress(config, `[INTERVENTION_JUDGE] Evaluation failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Autonomy band evaluation: composite score + state machine ──
  // Advisory — never blocks orchestration. Shadow-mode by default.
  try {
    if (config.runtime?.autonomyBand?.enabled !== false) {
      const { readCycleAnalytics, computeResearchCapacityGain } = await import("./cycle_analytics.js");
      const { getRecentCapacity, computeTrend } = await import("./capacity_scoreboard.js");
      const analytics = await readCycleAnalytics(config);
      const recentCap = await getRecentCapacity(config, 10);
      const capTrend = computeTrend(recentCap, "parserConfidence");
      const catastropheState = await readJson(path.join(stateDir, "catastrophe_state.json"), null);
      const benchmarkGroundTruth = await readJson(path.join(stateDir, "benchmark_ground_truth.json"), null);

      const totalWorkers = allWorkerResults?.length ?? 0;
      const completedWorkers = allWorkerResults?.filter((w: any) => isDispatchOutcomeSuccessful(w)).length ?? 0;
      const completionRate = totalWorkers > 0 ? completedWorkers / totalWorkers : null;
      const crashCount = allWorkerResults?.filter((w: any) => w.status === "crashed" || w.status === "error").length ?? 0;
      const crashRate = totalWorkers > 0 ? crashCount / totalWorkers : null;

      let benchmarkEntries = Array.isArray(benchmarkGroundTruth?.entries) ? benchmarkGroundTruth.entries : [];
      if (benchmarkEntries.length === 0) {
        const synthesisSnapshot = await readJson(path.join(stateDir, "research_synthesis.json"), null);
        const synthesisTopics = Array.isArray(synthesisSnapshot?.topics) ? synthesisSnapshot.topics : [];
        if (synthesisTopics.length > 0) {
          await persistBenchmarkEntry(config, String(cycleStartedAt || new Date().toISOString()), synthesisTopics);
          const refreshedBenchmarkGroundTruth = await readJson(path.join(stateDir, "benchmark_ground_truth.json"), null);
          benchmarkEntries = Array.isArray(refreshedBenchmarkGroundTruth?.entries) ? refreshedBenchmarkGroundTruth.entries : [];
          await appendProgress(config, `[AUTONOMY_BAND] benchmark entries seeded from synthesis - entries=${benchmarkEntries.length}`);
        }
      }
      const cycleOutcomeStatus = totalWorkers === 0
        ? "no_plans"
        : (completedWorkers >= totalWorkers && crashCount === 0 ? "success" : (completedWorkers > 0 ? "partial" : "failed"));
      const scoredRecommendations = evaluateBenchmarkGroundTruth(benchmarkEntries, {
        status: cycleOutcomeStatus,
        tasksCompleted: completedWorkers,
        tasksDispatched: totalWorkers,
      });

      if (benchmarkEntries.length > 0 && scoredRecommendations.length > 0) {
        benchmarkEntries[0] = {
          ...benchmarkEntries[0],
          recommendations: scoredRecommendations,
          evaluatedAt: new Date().toISOString(),
        };
        await writeJson(path.join(stateDir, "benchmark_ground_truth.json"), {
          schemaVersion: benchmarkGroundTruth?.schemaVersion || 1,
          updatedAt: new Date().toISOString(),
          entries: benchmarkEntries,
        });
      } else {
        await appendProgress(
          config,
          `[AUTONOMY_BAND] benchmark scoring skipped - entries=${benchmarkEntries.length} recommendations_scored=${scoredRecommendations.length}`,
        );
      }

      const benchmarkGainResult = computeResearchCapacityGain(benchmarkEntries, 5);

      const athenaRejectRate = planReview?.approved === true
        ? 0
        : (planReview?.approved === false
          ? 1
          : (typeof analytics?.athenaRejectRate === "number" ? analytics.athenaRejectRate : null));
      const parserFallbackRate = typeof prometheusAnalysis?.parserContextPenalty === "number"
        ? Math.max(0, Math.min(1, prometheusAnalysis.parserContextPenalty))
        : null;
      const contractFailRate = typeof prometheusAnalysis?._planContractPassRate === "number"
        ? Math.max(0, Math.min(1, 1 - prometheusAnalysis._planContractPassRate))
        : null;

      // Reuse pre-computed premium efficiency variants (computed before analytics call).
      const premiumEfficiency = _premiumEfficiencyRaw;
      const premiumEfficiencyAdjusted = _premiumEfficiencyAdjusted;
      const verifiedDoneWorkers = _verifiedDoneWorkers;

      await appendProgress(
        config,
        `[AUTONOMY_BAND] premium_efficiency_inputs settled=${_premiumSettled.length} success=${_premiumSuccessful} verifiedWorkerDone=${verifiedDoneWorkers} raw=${premiumEfficiency?.toFixed(3) ?? "N/A"} adjusted=${premiumEfficiencyAdjusted?.toFixed(3) ?? "N/A"} rawNew=${_rawPremiumEfficiency?.toFixed(3) ?? "N/A"} execAdj=${_executionAdjustedPremiumEfficiency?.toFixed(3) ?? "N/A"}`,
      );

      const hardGuardrailBreach = Array.isArray(catastropheState?.lastDetections)
        && catastropheState.lastDetections.length > 0;

      const sample: CycleSample = {
        cycleId: `cycle-${Date.now()}`,
        recordedAt: new Date().toISOString(),
        phase: String(analytics?.phase || CYCLE_PHASE.COMPLETED),
        completionRate,
        premiumEfficiency,
        premiumEfficiencyAdjusted,
        rawPremiumEfficiency: _rawPremiumEfficiency,
        executionAdjustedPremiumEfficiency: _executionAdjustedPremiumEfficiency,
        athenaRejectRate,
        parserFallbackRate,
        contractFailRate,
        benchmarkGain: benchmarkGainResult.capacityGain,
        crashCount,
        crashRate,
        hardGuardrailBreach,
        capacityTrend: capTrend,
      };

      const bandResult = await evaluateAutonomyBand(config, sample);
      await appendProgress(
        config,
        `[AUTONOMY_BAND] state=${bandResult.state} phase=${bandResult.executionPhase} composite=${bandResult.compositeScore?.toFixed(3) ?? "N/A"} shadow=${config.runtime?.autonomyBand?.shadowMode !== false}`,
      );

      // ── Self-dev marginal return exit policy (advisory) ──────────────────
      const exitResult = await evaluateSelfDevExit(config, bandResult);
      await appendProgress(
        config,
        `[SELF_DEV_EXIT] state=${exitResult.state} recommendation=${exitResult.recommendation} exploitationStreak=${exitResult.metrics.consecutiveExploitationCycles} noveltyYield=${exitResult.metrics.noveltyYield?.toFixed(3) ?? "N/A"} roiDelta=${exitResult.metrics.roiDelta?.toFixed(3) ?? "N/A"} benchmarkPending=${exitResult.metrics.benchmarkPendingRatio?.toFixed(3) ?? "N/A"} backlogOpen=${exitResult.metrics.backlogOpenRatio?.toFixed(3) ?? "N/A"}`,
      );
    }
  } catch (err: any) {
    warn(`[orchestrator] Autonomy band evaluation failed (non-fatal): ${String(err?.message || err)}`);
    await appendProgress(config, `[AUTONOMY_BAND] Evaluation failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Catastrophe detection: scan for systemic failure patterns each cycle ──
  // Advisory — never blocks orchestration. Failure sets explicit status=degraded.
  // Risk level: HIGH — reads orchestration state directly.
  try {
    // Build cycle data from available in-cycle metrics
    const now = Date.now();
    const jesusDirectivePath    = path.join(stateDir, "jesus_directive.json");
    const prometheusAnalysisPath = path.join(stateDir, "prometheus_analysis.json");

    const jesusDirectiveRaw     = await readJson(jesusDirectivePath, null);
    const prometheusAnalysisRaw = await readJson(prometheusAnalysisPath, null);

    const jesusDirectiveAgeMs = jesusDirectiveRaw?.decidedAt
      ? now - new Date(jesusDirectiveRaw.decidedAt).getTime()
      : 0;
    const prometheusAnalysisAgeMs = prometheusAnalysisRaw?.analyzedAt
      ? now - new Date(prometheusAnalysisRaw.analyzedAt).getTime()
      : 0;

    // Read SLO state to determine if this cycle had a breach
    const { readSloMetrics } = await import("./slo_checker.js");
    const sloState = await readSloMetrics(config);
    const hadSloBreachThisCycle = Array.isArray(sloState?.lastCycle?.sloBreaches)
      && sloState.lastCycle.sloBreaches.length > 0;

    const cycleData = {
      retryCount:              0,                          // no per-cycle retry counter yet; 0 is safe
      totalTasks:              Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans.length : 0,
      blockedTasks:            0,                          // blocking is tracked per-worker, not aggregated here
      jesusDirectiveAgeMs:     Math.max(0, jesusDirectiveAgeMs),
      prometheusAnalysisAgeMs: Math.max(0, prometheusAnalysisAgeMs),
      parseFailureCount:       0,                          // accumulated in persistent state across calls
      hadBudgetBreach:         false,                      // budget controller doesn't surface per-cycle breach yet
      hadSloBreach:            hadSloBreachThisCycle,
    };

    const catastropheOpts = config?.catastropheDetector || {};
    const catastropheResult = await runCatastropheDetection(config, cycleData, catastropheOpts);
    if (catastropheResult.detections.length > 0) {
      await appendProgress(config,
        `[CATASTROPHE] ${catastropheResult.detections.length} scenario(s) detected: ${catastropheResult.detections.map(d => d.scenarioId).join(", ")}`
      );
    } else {
      await appendProgress(config, "[CATASTROPHE] No catastrophe patterns detected this cycle");
    }
    if (!catastropheResult.ok) {
      warn(`[orchestrator] Catastrophe detection degraded: ${catastropheResult.reason || "unknown"}`);
    }

    // Execute guardrail actions for all active detections.
    // Gated by systemGuardian.enabled — set false to retain detection without enforcement (rollback path).
    if (catastropheResult.ok && catastropheResult.detections.length > 0
        && config.systemGuardian?.enabled !== false) {
      const guardResult = await executeGuardrailsForDetections(config, catastropheResult.detections);
      await appendProgress(config,
        `[GUARDRAIL] ${guardResult.results.length} action(s) applied — status=${guardResult.status} withinSla=${guardResult.withinSla} latencyMs=${guardResult.latencyMs}`
      );
      if (!guardResult.ok) {
        warn(`[orchestrator] Guardrail execution returned partial/failed status: ${guardResult.reason || "see results"}`);
      }
    }

    // Auto-revert FORCE_CHECKPOINT_VALIDATION if the SLO_CASCADING_BREACH that
    // triggered it is no longer active this cycle.  Runs unconditionally after
    // detection so a resolved breach is always cleared without operator action.
    if (config.systemGuardian?.enabled !== false) {
      const isSloBreachingNow = catastropheResult.detections.some(
        d => d.scenarioId === "SLO_CASCADING_BREACH"
      );
      const revertResult = await autoRevertSloGuardrailIfResolved(config, isSloBreachingNow);
      if (revertResult.reverted) {
        await appendProgress(config, "[GUARDRAIL] FORCE_CHECKPOINT_VALIDATION auto-reverted: SLO_CASCADING_BREACH condition resolved");
      } else if (revertResult.reason) {
        warn(`[orchestrator] SLO guardrail auto-revert failed (non-fatal): ${revertResult.reason}`);
      }
    }
  } catch (err) {
    // Advisory — never blocks orchestration
    warn(`[orchestrator] Catastrophe detection error (non-fatal): ${String(err?.message || err)}`);
    await appendProgress(config, `[CATASTROPHE] Detection error (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Recurrence detection: scan postmortems for repeated defect patterns ───
  try {
    const postmortemsRaw = await readJson(path.join(stateDir, "athena_postmortems.json"), null);
    const pmEntries = Array.isArray(postmortemsRaw?.entries) ? postmortemsRaw.entries : [];
    if (pmEntries.length > 0) {
      const recurrences = detectRecurrences(pmEntries);
      if (recurrences.length > 0) {
        const escalations = buildRecurrenceEscalations(recurrences);
        await appendProgress(config, `[RECURRENCE] ${recurrences.length} recurring pattern(s) detected: ${recurrences.map(r => r.pattern).join("; ")}`);
        for (const esc of escalations) {
          await appendAlert(config, {
            severity: esc.severity === "critical" ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
            source: "recurrence_detector",
            title: esc.title,
            message: esc.reason
          });
        }
      }
    }
  } catch (err) {
    warn(`[orchestrator] Recurrence detection failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Learning-to-policy compilation: convert lessons into enforced checks ──
  try {
    const postmortemsRaw2 = await readJson(path.join(stateDir, "athena_postmortems.json"), null);
    const pmEntries2 = Array.isArray(postmortemsRaw2?.entries) ? postmortemsRaw2.entries : [];
    if (pmEntries2.length > 0) {
      const learnedPolicyPath = path.join(stateDir, "learned_policies.json");
      const existingPolicies = await readJson(learnedPolicyPath, []);
      const existingPolicyIds = Array.isArray(existingPolicies)
        ? existingPolicies.map((policy: any) => String(policy?.id || "")).filter(Boolean)
        : [];
      const policies = compileLessonsToPolicies(pmEntries2, { existingPolicies: existingPolicyIds });
      if (policies.length > 0) {
        const mergedPolicies = [
          ...(Array.isArray(existingPolicies) ? existingPolicies : []),
          ...policies.map((policy) => ({
            ...policy,
            optimizationLoop: {
              interventionKind: policy?.interventionKind || "policy-delta",
              impactAttribution: "pending",
              retirementMode: "measured_uplift",
            },
          })),
        ];
        await writeJson(learnedPolicyPath, mergedPolicies);
        await appendProgress(config, `[POLICY_COMPILER] ${policies.length} policy optimization delta(s) compiled: ${policies.map(p => p.id).join(", ")}`);
      }
    }
  } catch (err) {
    warn(`[orchestrator] Learning policy compilation failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Carry-forward debt accumulation: register postmortem follow-ups as debt ──
  // Scans the latest postmortems for follow-up tasks and upserts them into the
  // carry-forward ledger.  Also advances the cycle counter so that SLA deadlines
  // stay anchored to a monotonic sequence across cycles.
  try {
    const postmortemsRaw3 = await readJson(path.join(stateDir, "athena_postmortems.json"), null);
    const pmEntries3 = Array.isArray(postmortemsRaw3?.entries) ? postmortemsRaw3.entries : [];
    const followUpItems = pmEntries3
      .filter(e => e.followUpNeeded && e.followUpTask)
      .map(e => ({
        followUpTask: String(e.followUpTask),
        workerName: e.workerName || undefined,
        severity: e.severity || "warning",
      }));

    const { entries: debtLedger, cycleCounter } = await loadLedgerMeta(config);
    const slaOpts = config?.carryForward?.slaMaxCycles
      ? { slaMaxCycles: config.carryForward.slaMaxCycles }
      : undefined;
    const updatedLedger = followUpItems.length > 0
      ? addDebtEntries(debtLedger, followUpItems, cycleCounter, slaOpts)
      : debtLedger;

    // Persist replay closure evidence links for this cycle.
    const replayEvidenceFile = path.join(stateDir, "carry_forward_replay_evidence.jsonl");
    const replayRecords = resolvedPlanItems
      .map((item) => {
        const envelope = item.verificationEvidence && typeof item.verificationEvidence === "object"
          ? item.verificationEvidence as Record<string, unknown>
          : null;
        const replay = envelope?.replayClosure && typeof envelope.replayClosure === "object"
          ? envelope.replayClosure as Record<string, unknown>
          : null;
        if (!replay) return null;
        return JSON.stringify({
          schemaVersion: 1,
          recordedAt: new Date().toISOString(),
          taskText: item.taskText,
          contractSatisfied: replay.contractSatisfied === true,
          canonicalCommands: Array.isArray(replay.canonicalCommands) && replay.canonicalCommands.length > 0
            ? replay.canonicalCommands
            : [...CANONICAL_MAIN_BRANCH_REPLAY_COMMANDS],
          executedCommands: Array.isArray(replay.executedCommands) ? replay.executedCommands : [],
          rawArtifactEvidenceLinks: Array.isArray(replay.rawArtifactEvidenceLinks) ? replay.rawArtifactEvidenceLinks : [],
        });
      })
      .filter(Boolean) as string[];
    if (replayRecords.length > 0) {
      await fs.appendFile(replayEvidenceFile, `${replayRecords.join("\n")}\n`, "utf8");
    }

    // Auto-close debt items verified by replay evidence contract this cycle.
    // Only items with a fingerprint match AND full replay closure evidence are closed.
    // Unresolved items remain open and continue to gate future dispatch via
    // shouldBlockOnDebt in evaluatePreDispatchGovernanceGate.
    const closedByEvidence = autoCloseVerifiedDebt(updatedLedger, resolvedPlanItems);
    if (closedByEvidence > 0) {
      await appendProgress(config,
        `[CARRY_FORWARD] ${closedByEvidence} debt item(s) auto-closed by replay closure evidence contract`
      );
    }

    const carryForwardBacklogPath = path.join(stateDir, "carry_forward_backlog.json");
    const carryForwardBacklog = await readJson(carryForwardBacklogPath, { schemaVersion: 1, items: [] });
    const reconciledBacklog = reconcileReplayClosureBacklog(carryForwardBacklog, updatedLedger);
    await writeJson(carryForwardBacklogPath, reconciledBacklog);

    const replayMandatoryItems = Array.isArray(reconciledBacklog.items)
      ? reconciledBacklog.items.filter((item: any) => MANDATORY_REPLAY_LINEAGE_IDS.includes(String(item?.id || "")))
      : [];
    const mandatoryClosedCount = replayMandatoryItems.filter((item: any) => item?.status === "closed_via_replay_contract").length;
    const mandatoryOpenCount = replayMandatoryItems.length - mandatoryClosedCount;
    const cycleId = String((await readPipelineProgress(config))?.startedAt || `cycle-${Date.now()}`);

    const seamProbe = computeRuntimeContractProbe({
      prometheusAnalysis,
      athenaPlanReview: planReview,
      workerResults: allWorkerResults,
    });
    const doneWorkerEvidenceCount = allWorkerResults.filter((row) => {
      const status = String(row?.status || "").toLowerCase();
      if (status !== "done" && status !== "success") return false;
      if (row?.dispatchContract?.doneWorkerWithVerificationReportEvidence === true) return true;
      return hasVerificationReportEvidence(String(row?.verificationEvidence || ""));
    }).length;
    const blockedDispatchRows = allWorkerResults
      .filter((row) => String(row?.status || "").toLowerCase() === "blocked");
    const blockedWithReasonCount = blockedDispatchRows
      .filter((row) => String(row?.dispatchBlockReason || row?.dispatchContract?.dispatchBlockReason || "").trim().length > 0)
      .length;
    const blockedDispatchReasons = [...new Set(
      blockedDispatchRows
        .map((row) => String(row?.dispatchBlockReason || row?.dispatchContract?.dispatchBlockReason || "").trim())
        .filter(Boolean)
    )];
    const doneWorkerCleanTreeCount = allWorkerResults.filter((row) => {
      const status = String(row?.status || "").toLowerCase();
      if (status !== "done" && status !== "success") return false;
      if (row?.dispatchContract?.doneWorkerWithCleanTreeStatusEvidence === true) return true;
      return /CLEAN_TREE_STATUS\s*=\s*clean\b/i.test(String(row?.verificationEvidence || ""));
    }).length;
    const seamChecks = {
      prometheus: {
        pass: seamProbe.criteria.prometheusGeneratedAtAndKeyFindings.pass === true,
        failReasons: seamProbe.criteria.prometheusGeneratedAtAndKeyFindings.pass === true
          ? []
          : ["prometheus_analysis missing generatedAt/keyFindings runtime-contract fields"],
      },
      athena: {
        pass: seamProbe.criteria.athenaPlanReviewOverallScoreFinite.pass === true,
        failReasons: seamProbe.criteria.athenaPlanReviewOverallScoreFinite.pass === true
          ? []
          : ["athena_plan_review.overallScore is missing or non-finite"],
      },
      worker: {
        pass: seamProbe.criteria.doneWorkerWithVerificationReportEvidence.pass === true,
        failReasons: seamProbe.criteria.doneWorkerWithVerificationReportEvidence.pass === true
          ? []
          : [`no done/success worker produced VERIFICATION_REPORT evidence (count=${doneWorkerEvidenceCount})`],
      },
      cleanTree: {
        pass: doneWorkerCleanTreeCount > 0,
        failReasons: doneWorkerCleanTreeCount > 0
          ? []
          : ["no done/success worker produced CLEAN_TREE_STATUS=clean evidence"],
      },
      dispatchBlockReason: {
        pass: seamProbe.criteria.dispatchBlockReasonOutcomes.pass === true,
        failReasons: seamProbe.criteria.dispatchBlockReasonOutcomes.pass === true
          ? []
          : [`blocked worker outcomes missing dispatchBlockReason evidence (withReason=${blockedWithReasonCount}/${blockedDispatchRows.length})`],
      },
    };
    const seamContractSatisfied = seamChecks.prometheus.pass
      && seamChecks.athena.pass
      && seamChecks.worker.pass
      && seamChecks.cleanTree.pass
      && seamChecks.dispatchBlockReason.pass;
    const seamFailReasons = [
      ...seamChecks.prometheus.failReasons,
      ...seamChecks.athena.failReasons,
      ...seamChecks.worker.failReasons,
      ...seamChecks.cleanTree.failReasons,
      ...seamChecks.dispatchBlockReason.failReasons,
    ];
    await writeJson(path.join(stateDir, "cycle_proof_evidence.json"), {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      cycleId,
      cycleCounter,
      replayClosure: {
        mandatoryLineageIds: [...MANDATORY_REPLAY_LINEAGE_IDS],
        mandatoryClosedCount,
        mandatoryOpenCount,
        contractSatisfied: mandatoryOpenCount === 0,
      },
      seams: {
        contractSatisfied: seamContractSatisfied,
        failReasons: seamFailReasons,
        checks: seamChecks,
      },
      dispatchOutcomes: {
        blockedCount: blockedDispatchRows.length,
        blockedWithReasonCount,
        blockReasons: blockedDispatchReasons,
      },
      backlogSnapshot: replayMandatoryItems.map((item: any) => ({
        id: item?.id || null,
        status: item?.status || null,
        debtId: item?.debtId || null,
        resolutionEvidence: item?.resolutionEvidence || null,
      })),
    });

    const newCycleCounter = cycleCounter + 1;
    await saveLedgerFull(config, updatedLedger, newCycleCounter);

    if (followUpItems.length > 0) {
      const added = updatedLedger.length - debtLedger.length;
      await appendProgress(config,
        `[CARRY_FORWARD] ${added} new debt item(s) registered — cycle=${cycleCounter} total_open=${updatedLedger.filter(e => !e.closedAt).length}`
      );
    }
  } catch (err) {
    warn(`[orchestrator] Carry-forward debt accumulation failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Capacity scoreboard: persist KPIs for trend analysis ──────────────────
  try {
    const firstBatchSpecialization = Array.isArray(workerBatches) && workerBatches.length > 0
      ? (workerBatches[0] as any)?.specialistUtilizationTarget
      : null;
    const firstBatchRerouteReasons = Array.isArray(workerBatches) && workerBatches.length > 0
      ? ((workerBatches[0] as any)?.specialistRerouteReasons ?? [])
      : [];
    // Read lane telemetry from the cycle analytics record computed this cycle
    // (if available) to persist lane distribution trends in the scoreboard.
    let cycleAnalyticsRecord: any = null;
    try {
      cycleAnalyticsRecord = await readCycleAnalytics(config);
    } catch { /* non-fatal */ }
    const cycleLaneTelemetry = cycleAnalyticsRecord?.lastCycle?.laneTelemetry ?? null;

    // Ensure specialization targets are persisted consistently across dispatch paths.
    // buildTokenFirstBatches stamps specialistUtilizationTarget on the first batch;
    // buildRoleExecutionBatches does not.  Fall back to capabilityPoolResult when the
    // batch-level data is absent so the Athena-prebatched and role-execution paths
    // emit the same scoreboard fields as the token-first path.
    const capPoolUtil = (capabilityPoolResult as any)?.specializationUtilization;
    const effectiveSpecTarget: {
      targetMet: boolean;
      adaptiveMinSpecializedShare: number;
      minSpecializedShare: number;
    } | null = firstBatchSpecialization ?? (capPoolUtil
      ? {
          targetMet: capPoolUtil.specializationTargetsMet === true,
          adaptiveMinSpecializedShare: Number(capPoolUtil.adaptiveMinSpecializedShare ?? capPoolUtil.minSpecializedShare ?? 0),
          minSpecializedShare: Number(capPoolUtil.minSpecializedShare ?? 0),
        }
      : null);

    await appendCapacityEntry(config, {
      parserConfidence: prometheusAnalysis?.parserConfidence ?? null,
      parserCoreConfidence: prometheusAnalysis?.parserCoreConfidence ?? null,
      parserContextPenalty: prometheusAnalysis?.parserContextPenalty ?? null,
      planCount: Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans.length : 0,
      projectHealth: prometheusAnalysis?.projectHealth ?? "unknown",
      optimizerStatus: "ok",
      budgetUsed: prometheusAnalysis?.requestBudget?.estimatedPremiumRequestsTotal ?? 0,
      budgetLimit: prometheusAnalysis?.requestBudget?.hardCapTotal ?? 0,
      workersDone: workersDone,
      specializedShareTarget: Number(effectiveSpecTarget?.adaptiveMinSpecializedShare ?? effectiveSpecTarget?.minSpecializedShare ?? 0),
      specializedShareTargetMet: effectiveSpecTarget?.targetMet === true,
      specialistRerouteCount: Array.isArray(firstBatchRerouteReasons) ? firstBatchRerouteReasons.length : 0,
      configuredMinSpecializedShare: Number(effectiveSpecTarget?.minSpecializedShare ?? 0),
      ...(Array.isArray(firstBatchRerouteReasons) && firstBatchRerouteReasons.length > 0
        ? { specialistRerouteReasons: firstBatchRerouteReasons }
        : {}),
      ...(cycleLaneTelemetry ? { laneTelemetry: cycleLaneTelemetry } : {}),
      ...(optimizerUsage ? { optimizerUsage } : {}),
    });
  } catch (err) {
    warn(`[orchestrator] Capacity scoreboard update failed (non-fatal): ${String(err?.message || err)}`);
  }

  // ── Health divergence: publish deterministic cycle health resolution ──────
  // Compares operational health (orchestrator_health.json) with planner health
  // (prometheusAnalysis.projectHealth) and resolves any disagreement into an
  // explicit warning state written to state/cycle_health.json.
  // Advisory — never blocks orchestration.
  try {
    const plannerHealth = prometheusAnalysis?.projectHealth ?? "unknown";
    const healthFile = await readJson(path.join(stateDir, "orchestrator_health.json"), null);
    const operationalStatus = healthFile?.orchestratorStatus ?? ORCHESTRATOR_STATUS.OPERATIONAL;
    const divergence = computeHealthDivergence(operationalStatus, plannerHealth);
    await persistCycleHealthComposite(config, {
      healthRecord: pendingCycleHealthRecord,
      divergenceSnapshot: {
        ...divergence,
        recordedAt: new Date().toISOString(),
      },
    });
    if (divergence.isWarning) {
      await appendProgress(config,
        `[HEALTH] Divergence detected — divergenceState=${divergence.divergenceState} pipelineStatus=${divergence.pipelineStatus} operationalStatus=${operationalStatus} plannerHealth=${plannerHealth}`
      );
      await appendAlert(config, {
        severity: divergence.pipelineStatus === PIPELINE_HEALTH_STATUS.CRITICAL ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
        source: "orchestrator",
        title: `Health divergence: ${divergence.divergenceState}`,
        message: `pipelineStatus=${divergence.pipelineStatus} operationalStatus=${operationalStatus} plannerHealth=${plannerHealth}`,
      });
    } else {
      await appendProgress(config,
        `[HEALTH] Cycle health consistent — pipelineStatus=${divergence.pipelineStatus} divergenceState=${divergence.divergenceState}`
      );
    }
  } catch (err) {
    warn(`[orchestrator] Health divergence check failed (non-fatal): ${String(err?.message || err)}`);
    if (pendingCycleHealthRecord) {
      await persistCycleHealthComposite(config, { healthRecord: pendingCycleHealthRecord }).catch(() => {});
    }
  }

  // ── Delta analytics + strategy retune (Wave 6) ───────────────────────────
  try {
    const delta = await computeCapabilityDelta(config);
    if (delta.summary.hasEnoughData) {
      await appendProgress(config, `[DELTA] Capability score=${delta.overallScore}/100 improving=[${delta.summary.improving.join(",")}] degrading=[${delta.summary.degrading.join(",")}]`);

      const retune = evaluateRetune(config, delta);
      if (retune.shouldRetune) {
        await appendProgress(config, `[RETUNE] ${retune.actions.length} retune action(s) recommended: ${retune.actions.map(a => a.parameter).join(", ")}`);
        // Write retune recommendations to state for Jesus to consider
        await writeJson(path.join(stateDir, "retune_recommendations.json"), {
          generatedAt: new Date().toISOString(),
          actions: retune.actions,
          deltaReport: delta,
        });
      }
    }
  } catch (err) {
    warn(`[orchestrator] Delta analytics/retune failed (non-fatal): ${String(err?.message || err)}`);
  }
}

// ── Main loop: Jesus → Prometheus → Athena → Worker → Athena → repeat ──────

async function mainLoop(config) {
  const stateDir = config.paths?.stateDir || "state";
  const RE_EVAL_SLEEP_MS = 2 * 60 * 1000;

  // Phase 1: wait for any active workers from previous session
  await waitForWorkersToFinish(config);

  // Mark system idle before entering the main loop.
  await safeUpdatePipelineProgress(config, "idle", "System idle — awaiting next cycle");

  // Phase 2: main cycle loop
  while (true) {
    const stopReq = await readStopRequest(config);
    if (stopReq?.requestedAt) {
      await appendProgress(config, `[BOX] Stop request detected, shutting down (reason=${stopReq.reason || "unknown"})`);
      await safeUpdatePipelineProgress(config, "idle", "System stopped");
      await clearStopRequest(config);
      await clearDaemonPid(config);
      break;
    }

    // Create a per-cycle cancellation token so deep dispatch loops can honour
    // an in-flight stop request without waiting for the next iteration boundary.
    const cycleToken = createCancellationToken();
    // Hot-reload config
    try {
      const reloadReq = await readReloadRequest(config);
      if (reloadReq?.requestedAt) {
        await clearReloadRequest(config);
        const freshConfig = await loadConfig();
        for (const key of Object.keys(freshConfig)) {
          config[key] = freshConfig[key];
        }
        await appendProgress(config, `[BOX] Hot-reload applied — config refreshed (reason=${reloadReq.reason || "cli-reload"})`);
      }
    } catch (err) {
      warn(`[orchestrator] reload error: ${String(err?.message || err)}`);
    }

    // Check escalation (workers can still escalate to Jesus)
    try {
      const escalation = await readJson(path.join(stateDir, "jesus_escalation.json"), null);
      if (escalation?.requestedAt) {
        await appendProgress(config, `[LOOP] Escalation to Jesus: ${escalation.reason || "(no reason)"}`);
        await writeJson(path.join(stateDir, "jesus_escalation.json"), {});
        // Escalation triggers a fresh full cycle
        await runSingleCycle(config, cycleToken);
        continue;
      }
    } catch { /* escalation file may not exist */ }

    // Check if there's remaining work from a previous Prometheus plan
    const prometheusAnalysis = await readJson(path.join(stateDir, "prometheus_analysis.json"), null);
    const totalPlans = Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans.length : 0;

    // Read and prioritise escalation queue before starting any new planning cycle.
    // Alerts leadership when blocked tasks require attention; does not gate planning.
    try {
      await processEscalationQueueClosureWorkflow(config);
      const escalationEntries = await loadEscalationQueue(config);
      const prioritisedEscalations = sortEscalationQueue(escalationEntries);
      if (prioritisedEscalations.length > 0) {
        const top = prioritisedEscalations[0];
        await appendProgress(config,
          `[LOOP] Escalation queue: ${prioritisedEscalations.length} unresolved — top: role=${top.role} class=${top.blockingReasonClass} attempts=${top.attempts}`
        );
        await appendAlert(config, {
          severity: ALERT_SEVERITY.HIGH,
          source: "orchestrator",
          title: `Escalation queue: ${prioritisedEscalations.length} unresolved task(s)`,
          message: prioritisedEscalations.slice(0, 3)
            .map(e => `[${e.blockingReasonClass}] ${e.role}: ${e.taskSnippet}`)
            .join(" | ")
        });
      }
    } catch (err) {
      warn(`[orchestrator] escalation queue read error (non-fatal): ${String(err?.message || err)}`);
    }

    if (totalPlans > 0) {
      const { completed, pending } = await countCompletedPlans(config, prometheusAnalysis.plans);

      if (pending.length > 0) {
        // There's remaining work — run a new full cycle
        // Jesus will see the current state and decide appropriately
        await appendProgress(config, `[LOOP] ${completed.length}/${totalPlans} plans done, ${pending.length} remaining — starting new cycle`);
        await runSingleCycle(config, cycleToken);
        await sleep(RE_EVAL_SLEEP_MS);
        continue;
      }

      // All plans done — cleanup, project completion, self-improvement
      await appendProgress(config, `[LOOP] All ${totalPlans} plans complete — running post-completion`);
      await postCompletionCleanup(config);

      const alreadyCompleted = await isProjectAlreadyCompleted(config);
      if (!alreadyCompleted) {
        try {
          await runProjectCompletion(config);
        } catch (err) {
          warn(`[orchestrator] project completion error: ${String(err?.message || err)}`);
        }
      }

      try {
        const stateDir = config.paths?.stateDir || "state";
        const siGate = await shouldTriggerSelfImprovement(config, stateDir);
        if (siGate.shouldRun) {
          await appendProgress(config, `[SELF-IMPROVEMENT] Quality gate passed: ${siGate.reason}`);
          await runSelfImprovementCycle(config);
          // Reset cycle counter
          await writeJson(path.join(stateDir, "self_improvement_state.json"), {
            lastRunAt: new Date().toISOString(),
            cyclesSinceLastRun: 0
          });
        } else {
          await appendProgress(config, `[SELF-IMPROVEMENT] Skipped (quality gate): ${siGate.reason}`);
          // Increment cycle counter
          const siState = await readJson(path.join(stateDir, "self_improvement_state.json"), {});
          await writeJson(path.join(stateDir, "self_improvement_state.json"), {
            ...siState,
            cyclesSinceLastRun: (siState.cyclesSinceLastRun || 0) + 1
          });
        }
      } catch (err) {
        warn(`[orchestrator] self-improvement error: ${String(err?.message || err)}`);
      }

      // ── Evolution metrics: persist proof-of-improvement data ──────────────
      try {
        const evoMetrics = await collectEvolutionMetrics(config);
        await appendProgress(config, `[EVOLUTION_METRICS] Collected — deterministicRate=${evoMetrics.deterministicPostmortem?.rate ?? "N/A"} premiumReqs24h=${evoMetrics.premiumRequestsPerDay}`);
      } catch (err) {
        warn(`[orchestrator] evolution metrics error (non-fatal): ${String(err?.message || err)}`);
      }

      // ── Governance canary: process running policy-rule canary experiments ──
      // Advisory — never blocks orchestration. Processes each running governance
      // canary experiment: assign cycle to cohort, record metrics, evaluate advancement.
      // On breach: status=rolled_back, breachAction=halt_new_assignments (AC4).
      try {
        const { processGovernanceCycle } = await import("./governance_canary.js");
        const cycleId = `governance-${Date.now()}`;
        const govResults = await processGovernanceCycle(config, cycleId, {});
        if (govResults.length > 0) {
          const summary = govResults.map(r => `${r.canaryId}:cohort=${r.cohort}:action=${r.action}`).join(", ");
          await appendProgress(config, `[GOVERNANCE_CANARY] Processed ${govResults.length} experiment(s): ${summary}`);
          const breaches = govResults.filter(r => r.action === "rollback");
          if (breaches.length > 0) {
            await appendProgress(config,
              `[GOVERNANCE_CANARY] BREACH detected — ${breaches.length} experiment(s) rolled back: ${breaches.map(b => `${b.canaryId}:${b.reason}`).join(", ")}`
            );
          }
        }
      } catch (err) {
        // Advisory — never blocks orchestration
        warn(`[orchestrator] governance canary processing error (non-fatal): ${String(err?.message || err)}`);
      }

      // Start a new Prometheus cycle to find new work
      await appendProgress(config, "[LOOP] Post-completion done — running Prometheus for next iteration");
      await runSingleCycle(config, cycleToken);
    } else {
      // No plans at all — first run or fresh start
      await runSingleCycle(config, cycleToken);
    }

    await safeUpdatePipelineProgress(config, "idle", "Cycle complete — waiting before next iteration");
    await sleep(RE_EVAL_SLEEP_MS);
  }
}

// ── appendCiFixContext ────────────────────────────────────────────────────────
// Appends a structured ## CI_FAILURE_CONTEXT section to baseContext for ci-fix
// tasks.  Tries GitHub Actions logs as primary source; falls back to reading
// state/evo_run_latest.log.  Returns baseContext unchanged when evidence is
// insufficient (no failed test identifiers found).
// ─────────────────────────────────────────────────────────────────────────────

const _CI_FIX_FIELD_MAX = 200;

function _truncateCiField(s: string): string {
  if (s.length <= _CI_FIX_FIELD_MAX) return s;
  return s.slice(0, _CI_FIX_FIELD_MAX) + "...";
}

function _parseGhActionsLog(logText: string): {
  failedTestIds: string[];
  errors: string[];
  stacks: string[];
} {
  const failedTestIds: string[] = [];
  const errors: string[] = [];
  const stacks: string[] = [];
  for (const line of logText.split("\n")) {
    const notOk = line.match(/not ok \d+ - (tests\/\S+)/);
    if (notOk) { failedTestIds.push(notOk[1]); continue; }
    const err = line.match(/^(\w*Error:.*)/);
    if (err) { errors.push(err[1]); continue; }
    const stack = line.match(/^\s*(at \S.*)/);
    if (stack) stacks.push(stack[1].trim());
  }
  return { failedTestIds, errors, stacks };
}

function _parseStateArtifactLog(logText: string): {
  headSha: string;
  failedTestIds: string[];
  errors: string[];
  stacks: string[];
} {
  let headSha = "";
  const failedTestIds: string[] = [];
  const errors: string[] = [];
  const stacks: string[] = [];
  for (const line of logText.split("\n")) {
    const cm = line.match(/^commit=(\S+)/);
    if (cm) { headSha = cm[1]; continue; }
    const fm = line.match(/^FAIL (tests\/\S+)/);
    if (fm) { failedTestIds.push(fm[1]); continue; }
    const em = line.match(/^(\w*Error:.*)/);
    if (em) { errors.push(em[1]); continue; }
    const sm = line.match(/^\s*(at \S.*)/);
    if (sm) stacks.push(sm[1].trim());
  }
  return { headSha, failedTestIds, errors, stacks };
}

function _buildCiContextBlock(data: {
  source: string;
  headSha: string;
  failedTestIds: string[];
  errors: string[];
  stacks: string[];
}): string {
  return [
    "## CI_FAILURE_CONTEXT",
    `commit_sha: ${data.headSha}`,
    `failed_test_identifiers: ${data.failedTestIds.map(_truncateCiField).join(", ")}`,
    `error_messages: ${data.errors.map(_truncateCiField).join("; ")}`,
    `stack_traces: ${data.stacks.map(_truncateCiField).join("; ")}`,
    `source: ${data.source}`,
  ].join("\n");
}

/**
 * Injects deterministic CI failure evidence into a worker context string for
 * ci-fix tasks.  Fetches GitHub Actions job logs for the failed run identified
 * in plan.githubCiContext.failedCiRuns[0], then falls back to reading
 * state/evo_run_latest.log when the API is unavailable.
 *
 * Returns baseContext unchanged when no actionable evidence can be extracted.
 */
export async function appendCiFixContext(
  config: any,
  plan: any,
  baseContext: string,
): Promise<string> {
  const failedCiRuns = plan?.githubCiContext?.failedCiRuns;
  if (!Array.isArray(failedCiRuns) || failedCiRuns.length === 0) return baseContext;

  const targetRepo = String(config?.env?.targetRepo ?? "");
  const githubToken = String(config?.env?.githubToken ?? "");
  const stateDir = String(config?.paths?.stateDir ?? "");

  for (const run of failedCiRuns) {
    const runId = run?.runId;
    const headSha = String(run?.headSha ?? "");

    // ── Step 1: GitHub Actions failed-job logs ───────────────────────────────
    try {
      const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
      if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

      const jobsResp = await fetch(
        `https://api.github.com/repos/${targetRepo}/actions/runs/${runId}/jobs`,
        { headers },
      );
      if (jobsResp.ok) {
        const jobsData = await jobsResp.json() as any;
        const failedJobs = Array.isArray(jobsData.jobs)
          ? jobsData.jobs.filter((j: any) => j.conclusion === "failure")
          : [];
        const logTexts: string[] = [];
        for (const job of failedJobs) {
          const logResp = await fetch(
            `https://api.github.com/repos/${targetRepo}/actions/jobs/${job.id}/logs`,
            { headers },
          );
          if (logResp.ok) logTexts.push(await logResp.text());
        }
        if (logTexts.length > 0) {
          const parsed = _parseGhActionsLog(logTexts.join("\n"));
          if (parsed.failedTestIds.length > 0) {
            const block = _buildCiContextBlock({ source: "github_actions_logs", headSha, ...parsed });
            return baseContext ? `${baseContext}\n\n${block}` : block;
          }
        }
      }
    } catch (err) {
      warn(`[orchestrator] CI evidence fetch failed for run ${String(runId)}: ${String(err?.message || err)}`);
    }

    if (stateDir) {
      // ── Step 2: Local npm_test artifacts (npm_test_full.log, npm_test_relevant.log) ─
      for (const artifactName of ["npm_test_full.log", "npm_test_relevant.log"]) {
        try {
          const logContent = await fs.readFile(path.join(stateDir, artifactName), "utf8");
          const parsed = _parseStateArtifactLog(logContent);
          if (parsed.failedTestIds.length > 0) {
            const block = _buildCiContextBlock({
              source: `local_npm_test_artifact:${artifactName}`,
              headSha: parsed.headSha || headSha,
              ...parsed,
            });
            return baseContext ? `${baseContext}\n\n${block}` : block;
          }
        } catch {
          // File missing or unreadable — continue to next artifact
        }
      }

      // ── Step 3: Latest run logs (test_run.log, build_run.log) ───────────────
      for (const runLogName of ["test_run.log", "build_run.log"]) {
        try {
          const logContent = await fs.readFile(path.join(stateDir, runLogName), "utf8");
          const parsed = _parseStateArtifactLog(logContent);
          if (parsed.failedTestIds.length > 0) {
            const block = _buildCiContextBlock({
              source: `local_run_log:${runLogName}`,
              headSha: parsed.headSha || headSha,
              ...parsed,
            });
            return baseContext ? `${baseContext}\n\n${block}` : block;
          }
        } catch {
          // File missing or unreadable — continue
        }
      }

      // ── Step 4: Fallback: evo_run_latest.log (original fallback) ────────────
      try {
        const logContent = await fs.readFile(path.join(stateDir, "evo_run_latest.log"), "utf8");
        const parsed = _parseStateArtifactLog(logContent);
        if (parsed.failedTestIds.length > 0) {
          const block = _buildCiContextBlock({
            source: "state_fallback_artifacts",
            headSha: parsed.headSha || headSha,
            ...parsed,
          });
          return baseContext ? `${baseContext}\n\n${block}` : block;
        }
      } catch (err) {
        warn(`[orchestrator] CI evidence fallback read failed: ${String(err?.message || err)}`);
      }
    }
  }

  // ── Step 5: Explicit no-data marker — ci-fix worker must know evidence is absent ─
  const noDataBlock = `## CI_FAILURE_CONTEXT\nsource: no_evidence_available\ncommit_sha: unknown\nnote: No CI failure logs could be retrieved from GitHub or local artifacts. Worker must not speculate about failure cause.`;
  return baseContext ? `${baseContext}\n\n${noDataBlock}` : noDataBlock;
}

/**
 * Dispatch-context hydrator used by both primary and resume dispatch paths.
 * Ensures CI-fix packets always carry deterministic failure evidence when present.
 */
export async function hydrateDispatchContextWithCiEvidence(
  config: any,
  plan: any,
  baseContext: string,
): Promise<string> {
  try {
    const taskKind = String(plan?.taskKind || plan?.kind || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
    const ciFixHint = `${String(plan?.task || "")} ${String(plan?.title || "")}`.toLowerCase();
    const isCiFixTask = taskKind === "ci-fix" || /\bci[-_\s]?fix\b/.test(ciFixHint);
    if (!isCiFixTask) return baseContext;
    const hydrated = await appendCiFixContext(config, plan, baseContext);
    await recordCapabilityExecution(
      config,
      "ci-failure-log-injection",
      `task=${String(plan?.task_id || plan?.task || "unknown").slice(0, 120)}`,
    );
    return hydrated;
  } catch (err) {
    warn(`[orchestrator] CI context hydration failed (non-fatal): ${String(err?.message || err)}`);
    return baseContext;
  }
}
