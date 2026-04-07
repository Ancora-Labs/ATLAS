/**
 * self_dev_exit_monitor.ts — Self-Dev Marginal Return Exit Policy
 *
 * "Bitti" diye binary bir an yok; "artık kazanım platoya girdi" diye bir eşik var.
 *
 * Sistemin self-improvement döngüsünden ne zaman "mezun" olabileceğini ölçer.
 * Autonomy Band IN_BAND'a girmek yeterli değildir — sistem stabil olabilir ama
 * her cycle daha fazla öğrenmeye devam ediyor olabilir.  Bu modül şunu sorar:
 *   "Son N cycle'da improvement artık anlamlı mı, yoksa plato mu oluştu?"
 *
 * ── State Machine ────────────────────────────────────────────────────────────
 *   BOOTSTRAPPING → MONITORING → PLATEAU_DETECTED
 *
 *   BOOTSTRAPPING:    < minBootstrapCycles band samples collected
 *   MONITORING:       enough data, plateau signals not all met
 *   PLATEAU_DETECTED: all three plateau signals simultaneously true
 *
 *   PLATEAU_DETECTED → MONITORING: signals no longer all met (re-improvement)
 *
 * ── Three Plateau Signals (tümleri aynı anda sağlanmalı) ────────────────────
 *
 *   1. gainPlateau:
 *      benchmarkGain average over last measurementWindow cycles is split into
 *      two equal halves (early / late).  If |lateAvg - earlyAvg| < gainDeltaThreshold,
 *      benchmark gain is no longer progressing → gain plateau met.
 *
 *   2. efficiencyPlateau:
 *      Same delta test on premiumEfficiency over the same window.
 *      If |lateAvg - earlyAvg| < efficiencyDeltaThreshold → efficiency plateau met.
 *
 *   3. inBandHeld:
 *      System must have been continuously IN_BAND for at least minInBandCycles
 *      consecutive cycles.  Resets to 0 on any non-IN_BAND cycle.
 *      Prevents graduation during a temporary performance spike.
 *
 * ── Recommendation ───────────────────────────────────────────────────────────
 *   HOLD:     keep self-improvement cycles running
 *   GRADUATE: marginal returns plateaued — system is ready for target-execution mode
 *
 * ── Deterministic Contract ───────────────────────────────────────────────────
 *   Fully deterministic.  No AI calls.
 *   Advisory only — never blocks orchestration.
 *   Reads from BandStatus.history (CycleSample[]) produced by autonomy_band_monitor.
 *   Writes own state to state/self_dev_exit_status.json.
 *
 * Risk: LOW — advisory module, never blocks orchestration.
 */

import path from "node:path";
import { readJson, writeJson } from "./fs_utils.js";
import type { BandStatus } from "./autonomy_band_monitor.js";

// ── Exit States ──────────────────────────────────────────────────────────────

export const EXIT_STATE = Object.freeze({
  BOOTSTRAPPING:    "BOOTSTRAPPING",
  MONITORING:       "MONITORING",
  PLATEAU_DETECTED: "PLATEAU_DETECTED",
});

// ── Schema version ───────────────────────────────────────────────────────────

export const SELF_DEV_EXIT_SCHEMA_VERSION = 1;

// ── Default thresholds ───────────────────────────────────────────────────────

export interface ExitThresholds {
  /**
   * Minimum number of band history samples before exit checks are evaluated.
   * Mirrors autonomy_band_monitor.minBootstrapCycles in purpose.
   * Default: 20 — need meaningful history before signalling graduation.
   */
  minBootstrapCycles: number;
  /** Full window size for rolling metrics computed from state artifacts. */
  measurementWindow: number;
  /** Delta Capacity threshold across early/late halves. */
  capacityDeltaThreshold: number;
  /**
   * Required consecutive cycles where executionGate.exploitationReady=true.
   */
  minExploitationCycles: number;
  /**
   * Active topic ratio threshold (active / (active + completed)).
   * Lower values imply novelty yield is flattening.
   */
  noveltyYieldMax: number;
  /**
   * Delta threshold for ROI success rate across early vs late halves.
   */
  roiDeltaThreshold: number;
  /** Minimum ROI success rate floor for graduation readiness. */
  minRoiSuccessRate: number;
  /** Maximum pending benchmark recommendation ratio. */
  maxPendingBenchmarkRatio: number;
  /** Fresh benchmark entries younger than this are ignored in pending ratio. */
  benchmarkPendingGraceHours: number;
  /** Maximum open carry-forward backlog ratio. */
  maxOpenBacklogRatio: number;
}

export const DEFAULT_EXIT_THRESHOLDS: ExitThresholds = Object.freeze({
  minBootstrapCycles:      20,
  measurementWindow:       20,
  capacityDeltaThreshold:  0.02,
  minExploitationCycles:   8,
  noveltyYieldMax:         0.25,
  roiDeltaThreshold:       0.10,
  minRoiSuccessRate:       0.55,
  maxPendingBenchmarkRatio: 0.40,
  benchmarkPendingGraceHours: 6,
  maxOpenBacklogRatio:     0.25,
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExitChecks {
  capacityPlateauMet:     boolean;
  exploitationHeldMet:   boolean;
  noveltyYieldMet:       boolean;
  roiPlateauMet:         boolean;
  regressionCleanMet:    boolean;
  stabilityMet:          boolean;
  coreStopMet:           boolean;
  benchmarkGapClosedMet: boolean;
  backlogQualityMet:     boolean;
  allMet:                boolean;
}

export interface ExitMetrics {
  capacityEarlyAvg:                number | null;
  capacityLateAvg:                 number | null;
  capacityDelta:                   number | null;
  consecutiveExploitationCycles: number;
  noveltyYield:                 number | null;
  roiEarlyAvg:                  number | null;
  roiLateAvg:                   number | null;
  roiDelta:                     number | null;
  roiSuccessRate:               number | null;
  benchmarkPendingRatio:        number | null;
  backlogOpenRatio:             number | null;
  regressionClean:              boolean;
}

export interface ExitStatus {
  schemaVersion:          number;
  state:                  string;
  previousState:          string | null;
  stateChangedAt:         string | null;
  updatedAt:              string;
  /** Total number of times evaluateSelfDevExit has been called. */
  cyclesEvaluated:        number;
  checks:                 ExitChecks;
  metrics:                ExitMetrics;
  recommendation:         "HOLD" | "GRADUATE";
  recommendationReason:   string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function halfAvg(values: (number | null)[], start: number, end: number): number | null {
  const slice = values.slice(start, end).filter((v): v is number => v !== null && Number.isFinite(v));
  if (slice.length === 0) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function absDelta(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.abs(b - a);
}

// ── Plateau checks ───────────────────────────────────────────────────────────

/**
 * Evaluate all three plateau signals from the last measurementWindow CycleSamples.
 * Pure function — no side effects.
 */
export interface ExitSignalInputs {
  capacityEarlyAvg: number | null;
  capacityLateAvg: number | null;
  capacityDelta: number | null;
  consecutiveExploitationCycles: number;
  noveltyYield: number | null;
  roiEarlyAvg: number | null;
  roiLateAvg: number | null;
  roiDelta: number | null;
  roiSuccessRate: number | null;
  benchmarkPendingRatio: number | null;
  backlogOpenRatio: number | null;
  regressionClean: boolean;
}

export function evaluateExitChecks(
  inputs: ExitSignalInputs,
  thresholds: ExitThresholds,
): { checks: ExitChecks; metrics: ExitMetrics } {
  const capacityPlateauMet =
    inputs.capacityDelta !== null &&
    inputs.capacityDelta <= thresholds.capacityDeltaThreshold;
  const exploitationHeldMet = inputs.consecutiveExploitationCycles >= thresholds.minExploitationCycles;
  const noveltyYieldMet = inputs.noveltyYield !== null && inputs.noveltyYield <= thresholds.noveltyYieldMax;
  const roiPlateauMet =
    inputs.roiDelta !== null &&
    inputs.roiDelta <= thresholds.roiDeltaThreshold &&
    inputs.roiSuccessRate !== null &&
    inputs.roiSuccessRate >= thresholds.minRoiSuccessRate;
  const regressionCleanMet = inputs.regressionClean;
  const stabilityMet = exploitationHeldMet && regressionCleanMet;
  const coreStopMet = capacityPlateauMet && roiPlateauMet && noveltyYieldMet && stabilityMet;
  const benchmarkGapClosedMet =
    inputs.benchmarkPendingRatio !== null &&
    inputs.benchmarkPendingRatio <= thresholds.maxPendingBenchmarkRatio;
  const backlogQualityMet =
    inputs.backlogOpenRatio !== null &&
    inputs.backlogOpenRatio <= thresholds.maxOpenBacklogRatio;
  const allMet = coreStopMet && benchmarkGapClosedMet && backlogQualityMet;

  return {
    checks: {
      capacityPlateauMet,
      exploitationHeldMet,
      noveltyYieldMet,
      roiPlateauMet,
      regressionCleanMet,
      stabilityMet,
      coreStopMet,
      benchmarkGapClosedMet,
      backlogQualityMet,
      allMet,
    },
    metrics: {
      capacityEarlyAvg:                inputs.capacityEarlyAvg,
      capacityLateAvg:                 inputs.capacityLateAvg,
      capacityDelta:                   inputs.capacityDelta,
      consecutiveExploitationCycles: inputs.consecutiveExploitationCycles,
      noveltyYield:                  inputs.noveltyYield,
      roiEarlyAvg:                   inputs.roiEarlyAvg,
      roiLateAvg:                    inputs.roiLateAvg,
      roiDelta:                      inputs.roiDelta,
      roiSuccessRate:                inputs.roiSuccessRate,
      benchmarkPendingRatio:         inputs.benchmarkPendingRatio,
      backlogOpenRatio:              inputs.backlogOpenRatio,
      regressionClean:               inputs.regressionClean,
    },
  };
}

/**
 * Compute next exit state given current state and check results.
 * Pure function — deterministic.
 */
export function computeExitNextState(
  currentState: string,
  checks: ExitChecks,
  cyclesEvaluated: number,
  thresholds: ExitThresholds,
): { nextState: string; reason: string } {
  if (cyclesEvaluated < thresholds.minBootstrapCycles) {
    return {
      nextState: EXIT_STATE.BOOTSTRAPPING,
      reason:    `cycles_evaluated=${cyclesEvaluated}<${thresholds.minBootstrapCycles}`,
    };
  }

  if (checks.allMet) {
    return {
      nextState: EXIT_STATE.PLATEAU_DETECTED,
      reason:    "all_plateau_signals_met",
    };
  }

  // If we were PLATEAU_DETECTED but signals no longer hold, revert to MONITORING
  const failedSignals: string[] = [];
  if (!checks.capacityPlateauMet)    failedSignals.push("capacity_not_plateaued");
  if (!checks.noveltyYieldMet)       failedSignals.push("novelty_yield_still_high");
  if (!checks.roiPlateauMet)         failedSignals.push("roi_not_plateaued_or_below_floor");
  if (!checks.stabilityMet)          failedSignals.push("stability_not_satisfied");
  if (!checks.benchmarkGapClosedMet) failedSignals.push("benchmark_gap_not_closed");
  if (!checks.backlogQualityMet)     failedSignals.push("backlog_quality_insufficient");

  return {
    nextState: EXIT_STATE.MONITORING,
    reason:    `not_all_signals_met:${failedSignals.join("+")}`,
  };
}

// ── File path ────────────────────────────────────────────────────────────────

function exitStatusPath(config: Record<string, unknown>): string {
  const paths = config?.paths as Record<string, unknown> | undefined;
  const stateDir = (paths?.stateDir as string) || "state";
  return path.join(stateDir, "self_dev_exit_status.json");
}

// ── Read / Write ─────────────────────────────────────────────────────────────

export async function readExitStatus(config: Record<string, unknown>): Promise<ExitStatus> {
  const data = await readJson(exitStatusPath(config), null);
  if (data && data.schemaVersion === SELF_DEV_EXIT_SCHEMA_VERSION) {
    return data as ExitStatus;
  }
  return createInitialExitStatus();
}

export async function writeExitStatus(config: Record<string, unknown>, status: ExitStatus): Promise<void> {
  await writeJson(exitStatusPath(config), status);
}

function createInitialExitStatus(): ExitStatus {
  return {
    schemaVersion:        SELF_DEV_EXIT_SCHEMA_VERSION,
    state:                EXIT_STATE.BOOTSTRAPPING,
    previousState:        null,
    stateChangedAt:       null,
    updatedAt:            new Date().toISOString(),
    cyclesEvaluated:      0,
    checks: {
      capacityPlateauMet:     false,
      exploitationHeldMet:   false,
      noveltyYieldMet:       false,
      roiPlateauMet:         false,
      regressionCleanMet:    false,
      stabilityMet:          false,
      coreStopMet:           false,
      benchmarkGapClosedMet: false,
      backlogQualityMet:     false,
      allMet:                false,
    },
    metrics: {
      capacityEarlyAvg:                null,
      capacityLateAvg:                 null,
      capacityDelta:                   null,
      consecutiveExploitationCycles: 0,
      noveltyYield:                 null,
      roiEarlyAvg:                  null,
      roiLateAvg:                   null,
      roiDelta:                     null,
      roiSuccessRate:               null,
      benchmarkPendingRatio:        null,
      backlogOpenRatio:             null,
      regressionClean:              false,
    },
    recommendation:       "HOLD",
    recommendationReason: "initial_state",
  };
}

// ── Config resolution ────────────────────────────────────────────────────────

function safeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function safeFloat(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function resolveExitThresholds(config: Record<string, unknown>): ExitThresholds {
  const runtime     = config?.runtime as Record<string, unknown> | undefined;
  const exitConfig  = runtime?.selfDevExit as Record<string, unknown> | undefined;
  if (!exitConfig || typeof exitConfig !== "object") return DEFAULT_EXIT_THRESHOLDS;

  return {
    minBootstrapCycles:        safeInt(exitConfig.minBootstrapCycles,        DEFAULT_EXIT_THRESHOLDS.minBootstrapCycles),
    measurementWindow:         safeInt(exitConfig.measurementWindow,         DEFAULT_EXIT_THRESHOLDS.measurementWindow),
    capacityDeltaThreshold:    safeFloat(exitConfig.capacityDeltaThreshold,   DEFAULT_EXIT_THRESHOLDS.capacityDeltaThreshold),
    minExploitationCycles:     safeInt(exitConfig.minExploitationCycles,     DEFAULT_EXIT_THRESHOLDS.minExploitationCycles),
    noveltyYieldMax:           safeFloat(exitConfig.noveltyYieldMax,         DEFAULT_EXIT_THRESHOLDS.noveltyYieldMax),
    roiDeltaThreshold:         safeFloat(exitConfig.roiDeltaThreshold,       DEFAULT_EXIT_THRESHOLDS.roiDeltaThreshold),
    minRoiSuccessRate:         safeFloat(exitConfig.minRoiSuccessRate,       DEFAULT_EXIT_THRESHOLDS.minRoiSuccessRate),
    maxPendingBenchmarkRatio:  safeFloat(exitConfig.maxPendingBenchmarkRatio, DEFAULT_EXIT_THRESHOLDS.maxPendingBenchmarkRatio),
    benchmarkPendingGraceHours: safeFloat(exitConfig.benchmarkPendingGraceHours, DEFAULT_EXIT_THRESHOLDS.benchmarkPendingGraceHours),
    maxOpenBacklogRatio:       safeFloat(exitConfig.maxOpenBacklogRatio,     DEFAULT_EXIT_THRESHOLDS.maxOpenBacklogRatio),
  };
}

function stateDir(config: Record<string, unknown>): string {
  const paths = config?.paths as Record<string, unknown> | undefined;
  return (paths?.stateDir as string) || "state";
}

type JsonMap = Record<string, unknown>;

function toArray(value: unknown): JsonMap[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is JsonMap => v !== null && typeof v === "object");
}

function toFinite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readCapacityDeltaFromBandHistory(
  history: Array<Record<string, unknown>>,
  windowSize: number,
): { capacityEarlyAvg: number | null; capacityLateAvg: number | null; capacityDelta: number | null } {
  const window = history.slice(-windowSize);
  const values = window.map((sample) => {
    const completion = toFinite(sample.completionRate);
    const gain = toFinite(sample.benchmarkGain);
    if (completion === null && gain === null) return null;
    if (completion !== null && gain !== null) return (completion + gain) / 2;
    return completion ?? gain;
  });
  const half = Math.floor(values.length / 2);
  const capacityEarlyAvg = halfAvg(values, 0, half);
  const capacityLateAvg = halfAvg(values, half, values.length);
  const capacityDelta = absDelta(capacityEarlyAvg, capacityLateAvg);
  return { capacityEarlyAvg, capacityLateAvg, capacityDelta };
}

function isSuccessOutcome(value: unknown): boolean {
  const key = String(value || "").toLowerCase().trim();
  return key === "done" || key === "success" || key === "merged";
}

function isResolvedStatus(value: unknown): boolean {
  const key = String(value || "").toLowerCase().trim();
  if (!key) return false;
  return (
    key === "done" ||
    key === "success" ||
    key === "merged" ||
    key === "completed" ||
    key === "complete" ||
    key === "resolved" ||
    key === "closed" ||
    key === "retired" ||
    key === "implemented" ||
    key === "implemented_correctly"
  );
}

async function readNoveltyYield(config: Record<string, unknown>, windowSize: number): Promise<number | null> {
  const data = await readJson(path.join(stateDir(config), "prometheus_topic_memory.json"), null);
  if (!data || typeof data !== "object") return null;
  const topics = (data as JsonMap).topics;
  if (!topics || typeof topics !== "object") return null;
  const rows = Object.values(topics as JsonMap)
    .filter((v): v is JsonMap => v !== null && typeof v === "object")
    .map((row) => {
      const updatedAt = String(row.lastUpdatedAt || row.firstSeenAt || "").trim();
      const ts = Date.parse(updatedAt);
      return {
        status: String(row.status || "").toLowerCase().trim(),
        ts: Number.isFinite(ts) ? ts : null,
      };
    })
    .sort((a, b) => {
      const at = a.ts ?? -1;
      const bt = b.ts ?? -1;
      return bt - at;
    });

  const bounded = Number.isFinite(windowSize) && windowSize > 0
    ? rows.slice(0, Math.floor(windowSize))
    : rows;

  let active = 0;
  let completed = 0;
  for (const row of bounded) {
    if (row.status === "active") active += 1;
    if (isResolvedStatus(row.status)) completed += 1;
  }
  const total = active + completed;
  if (total === 0) return null;
  return active / total;
}

async function readRoiSeries(config: Record<string, unknown>, windowSize: number): Promise<{
  roiEarlyAvg: number | null;
  roiLateAvg: number | null;
  roiDelta: number | null;
  roiSuccessRate: number | null;
}> {
  const data = await readJson(path.join(stateDir(config), "premium_usage_log.json"), []);
  const rows = toArray(data)
    .filter((row) => typeof row.completedAt === "string");
  const values = rows
    .slice(-windowSize)
    .map((row) => (isSuccessOutcome(row.outcome) ? 1 : 0));
  if (values.length === 0) {
    return { roiEarlyAvg: null, roiLateAvg: null, roiDelta: null, roiSuccessRate: null };
  }
  const nullableValues = values.map((v) => Number(v));
  const half = Math.floor(nullableValues.length / 2);
  const roiEarlyAvg = halfAvg(nullableValues, 0, half);
  const roiLateAvg = halfAvg(nullableValues, half, nullableValues.length);
  const roiDelta = absDelta(roiEarlyAvg, roiLateAvg);
  const roiSuccessRate = nullableValues.reduce((sum, v) => sum + v, 0) / nullableValues.length;
  return { roiEarlyAvg, roiLateAvg, roiDelta, roiSuccessRate };
}

async function readBenchmarkPendingRatio(
  config: Record<string, unknown>,
  thresholds: ExitThresholds,
): Promise<number | null> {
  const data = await readJson(path.join(stateDir(config), "benchmark_ground_truth.json"), null);
  if (!data || typeof data !== "object") return null;
  const entries = toArray((data as JsonMap).entries);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => {
    const at = Date.parse(String(a.evaluatedAt || a.createdAt || ""));
    const bt = Date.parse(String(b.evaluatedAt || b.createdAt || ""));
    const av = Number.isFinite(at) ? at : -1;
    const bv = Number.isFinite(bt) ? bt : -1;
    return bv - av;
  });

  const nowMs = Date.now();
  const graceMs = Math.max(0, thresholds.benchmarkPendingGraceHours) * 60 * 60 * 1000;
  const matureEntries = sorted.filter((entry) => {
    const ts = Date.parse(String(entry.evaluatedAt || entry.createdAt || ""));
    if (!Number.isFinite(ts)) return true;
    return (nowMs - ts) >= graceMs;
  });
  const candidateEntries = matureEntries.length > 0 ? matureEntries : [];

  const recs = candidateEntries.flatMap((entry) => toArray(entry.recommendations));
  if (recs.length === 0) return 0;
  const unresolved = recs.filter((r) => !isResolvedStatus(r.implementationStatus)).length;
  return unresolved / recs.length;
}

async function readBacklogOpenRatio(config: Record<string, unknown>): Promise<number | null> {
  const data = await readJson(path.join(stateDir(config), "carry_forward_backlog.json"), null);
  if (!data || typeof data !== "object") return null;
  const items = toArray((data as JsonMap).items);
  if (items.length === 0) return 0;
  const open = items.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    if (!status) return true;
    return !(status.startsWith("closed") || status === "done" || status === "resolved" || status === "completed" || status === "retired");
  }).length;
  return open / items.length;
}

async function readCycleAnalyticsRegressionClean(config: Record<string, unknown>): Promise<boolean | null> {
  const data = await readJson(path.join(stateDir(config), "cycle_analytics.json"), null);
  if (!data || typeof data !== "object") return null;
  const lastCycle = (data as JsonMap).lastCycle;
  if (!lastCycle || typeof lastCycle !== "object") return null;
  const outcomes = (lastCycle as JsonMap).outcomes as JsonMap | undefined;
  const runtimeProbe = (lastCycle as JsonMap).runtimeContractProbe as JsonMap | undefined;
  const status = String(outcomes?.status || "").toLowerCase();
  const tasksFailed = Number(outcomes?.tasksFailed);
  const probePassed = runtimeProbe?.passed === true;
  const blockedStatus = status === "failed" || status === "rejected" || status === "dispatch_block_remediation";
  const failedCount = Number.isFinite(tasksFailed) ? tasksFailed : 0;
  return !blockedStatus && failedCount === 0 && probePassed;
}

function normalizeExitStatus(status: ExitStatus): ExitStatus {
  const initial = createInitialExitStatus();
  return {
    ...initial,
    ...status,
    checks: {
      ...initial.checks,
      ...(status.checks || {}),
    },
    metrics: {
      ...initial.metrics,
      ...(status.metrics || {}),
    },
  };
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Evaluate the self-dev marginal return exit policy for the current cycle.
 *
 * Called once per cycle from the orchestrator, right after evaluateAutonomyBand.
 * Receives the freshly-written BandStatus so it can read its history without a
 * second file I/O for the autonomy_band_status.json.
 *
 * Deterministic — no AI calls.
 * Advisory — never blocks orchestration.
 *
 * @param config     — full BOX config object
 * @param bandStatus — result of evaluateAutonomyBand from the same cycle
 * @returns          Updated ExitStatus with recommendation and signal details
 */
export async function evaluateSelfDevExit(
  config: Record<string, unknown>,
  bandStatus: BandStatus,
): Promise<ExitStatus> {
  const thresholds = resolveExitThresholds(config);
  const status     = normalizeExitStatus(await readExitStatus(config));

  status.cyclesEvaluated += 1;

  // Track sustained exploitation readiness.
  if (bandStatus.executionGate?.exploitationReady === true) {
    status.metrics.consecutiveExploitationCycles = (status.metrics.consecutiveExploitationCycles ?? 0) + 1;
  } else {
    status.metrics.consecutiveExploitationCycles = 0;
  }

  const [noveltyYield, roi, benchmarkPendingRatio, backlogOpenRatio, analyticsRegressionClean] = await Promise.all([
    readNoveltyYield(config, thresholds.measurementWindow),
    readRoiSeries(config, thresholds.measurementWindow),
    readBenchmarkPendingRatio(config, thresholds),
    readBacklogOpenRatio(config),
    readCycleAnalyticsRegressionClean(config),
  ]);

  const regressionClean =
    bandStatus.regressionChecks?.anyBreach === false &&
    (analyticsRegressionClean !== false);
  const capacity = readCapacityDeltaFromBandHistory(
    Array.isArray(bandStatus.history) ? (bandStatus.history as unknown as Array<Record<string, unknown>>) : [],
    thresholds.measurementWindow,
  );

  const { checks, metrics } = evaluateExitChecks(
    {
      capacityEarlyAvg: capacity.capacityEarlyAvg,
      capacityLateAvg: capacity.capacityLateAvg,
      capacityDelta: capacity.capacityDelta,
      consecutiveExploitationCycles: status.metrics.consecutiveExploitationCycles,
      noveltyYield,
      roiEarlyAvg: roi.roiEarlyAvg,
      roiLateAvg: roi.roiLateAvg,
      roiDelta: roi.roiDelta,
      roiSuccessRate: roi.roiSuccessRate,
      benchmarkPendingRatio,
      backlogOpenRatio,
      regressionClean,
    },
    thresholds,
  );
  status.checks  = checks;
  status.metrics = metrics;

  // Compute next state
  const { nextState, reason } = computeExitNextState(
    status.state,
    checks,
    status.cyclesEvaluated,
    thresholds,
  );

  const previousState = status.state;
  if (nextState !== previousState) {
    status.previousState  = previousState;
    status.stateChangedAt = new Date().toISOString();
  }
  status.state     = nextState;
  status.updatedAt = new Date().toISOString();

  // Advisory recommendation
  if (nextState === EXIT_STATE.PLATEAU_DETECTED) {
    status.recommendation       = "GRADUATE";
    status.recommendationReason = "all_plateau_signals_confirmed";
  } else {
    status.recommendation       = "HOLD";
    status.recommendationReason = reason;
  }

  await writeExitStatus(config, status);

  return status;
}
