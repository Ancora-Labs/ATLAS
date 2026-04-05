/**
 * autonomy_band_monitor.ts — Stabil Otonomi Bandı State Machine
 *
 * "Bitti" diye binary bir an yok; "kontrol bandına girdi" diye bir eşik var.
 *
 * Sistemin otonom olarak stabil çalışıp çalışmadığını ölçer.
 * Premium efficiency %100 olsa bile sistem kötü olabilir çünkü az iş yapıp
 * az hata üreterek de %100 görünür. Bu yüzden bileşik skor kullanılır.
 *
 * ── State Machine ────────────────────────────────────────────────────────────
 *   BOOTSTRAPPING → STABILIZING → IN_BAND → REGRESSED
 *
 *   BOOTSTRAPPING: < minBootstrapCycles cycles completed (default 10)
 *   STABILIZING:   minBootstrapCycles to stabilizingWindow cycles (default 30)
 *   IN_BAND:       all thresholds simultaneously met for stabilizingWindow
 *   REGRESSED:     any hard guardrail breach triggers immediate regression
 *
 * ── Composite Score (0.0 - 1.0) ─────────────────────────────────────────────
 *   0.30 × completion_rate         tamamlanan / toplam görev
 *   0.15 × premium_efficiency      value / cost
 *   0.25 × quality_score           athena + parser fallback + contract pass birleşik kalitesi
 *   0.15 × capacity_trend          kapasite büyüme trendi (normalized 0-1)
 *   0.15 × stability_score         1 - crash_rate son N cycle
 *
 * ── IN_BAND Koşulları (tümleri aynı anda sağlanmalı) ────────────────────────
 *   Bileşik skor ≥ 0.72 (son 30 cycle ortalaması)
 *   Son 50 cycle'da hard guardrail ihlali ≤ 2
 *   Completion rate ≥ 0.75
 *   Premium efficiency ≥ 0.60
 *   Athena reject rate ≤ 0.15
 *   Benchmark gain ≥ 0.10
 *   Completion variance ≤ 0.05
 *   Phase = completed (opsiyonel flag ile)
 *
 * ── REGRESSED Tetikleyicileri (herhangi biri yeterli) ────────────────────────
 *   Son 10 cycle'da 3+ crash
 *   Completion rate < 0.40 (10 cycle pencere)
 *   Hard guardrail ihlali (anında)
 *   Athena reject rate > 0.40 (5 cycle pencere)
 *
 * ── Deterministic Contract ───────────────────────────────────────────────────
 *   Deterministic karar katmanı her zaman karar sahibidir.
 *   AI agent (intervention-reviewer) sadece danışman, band kararını override edemez.
 *   Hard guardrail ihlali varsa AI oy kullanamaz.
 *   Phase-1 -> exploitation geçişi sadece deterministic kapı koşulları ile olur.
 *
 * Risk: LOW — advisory module, never blocks orchestration.
 */

import path from "node:path";
import { readJson, writeJson } from "./fs_utils.js";

// ── Band States ──────────────────────────────────────────────────────────────

export const BAND_STATE = Object.freeze({
  BOOTSTRAPPING: "BOOTSTRAPPING",
  STABILIZING:   "STABILIZING",
  IN_BAND:       "IN_BAND",
  REGRESSED:     "REGRESSED",
});

// ── Schema version ───────────────────────────────────────────────────────────

export const AUTONOMY_BAND_SCHEMA_VERSION = 1;

// ── Default thresholds ───────────────────────────────────────────────────────

export interface Thresholds {
  minBootstrapCycles: number;
  stabilizingWindow: number;
  hardGuardrailWindow: number;
  compositeScoreMin: number;
  completionRateMin: number;
  premiumEfficiencyMin: number;
  athenaRejectRateMax: number;
  hardGuardrailBreachMax: number;
  inBandMinBenchmarkGain: number;
  inBandMaxCompletionVariance: number;
  inBandRequireCompletedPhase: boolean;
  regressCrashWindow: number;
  regressCrashThreshold: number;
  regressCompletionWindow: number;
  regressCompletionMin: number;
  regressAthenaRejectWindow: number;
  regressAthenaRejectMax: number;
  exploitationWindow: number;
  exploitationMinBenchmarkGain: number;
  exploitationMaxCompletionVariance: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = Object.freeze({
  minBootstrapCycles:         10,
  stabilizingWindow:          30,
  hardGuardrailWindow:        50,

  // IN_BAND entry
  compositeScoreMin:          0.72,
  completionRateMin:          0.75,
  premiumEfficiencyMin:       0.60,
  athenaRejectRateMax:        0.15,
  hardGuardrailBreachMax:     2,
  inBandMinBenchmarkGain:     0.10,
  inBandMaxCompletionVariance: 0.05,
  inBandRequireCompletedPhase: true,

  // REGRESSED triggers
  regressCrashWindow:         10,
  regressCrashThreshold:      3,
  regressCompletionWindow:    10,
  regressCompletionMin:       0.40,
  regressAthenaRejectWindow:  5,
  regressAthenaRejectMax:     0.40,

  // Phase-1 -> exploitation deterministic gate
  exploitationWindow:          10,
  exploitationMinBenchmarkGain: 0.15,
  exploitationMaxCompletionVariance: 0.04,
});

// ── Composite Score Weights ──────────────────────────────────────────────────

export const SCORE_WEIGHTS = Object.freeze({
  completion:        0.30,
  premiumEfficiency: 0.15,
  quality:           0.25,
  capacityTrend:     0.15,
  stability:         0.15,
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface CycleSample {
  cycleId: string;
  recordedAt: string;
  phase: string;
  completionRate: number | null;
  premiumEfficiency: number | null;
  athenaRejectRate: number | null;
  parserFallbackRate: number | null;
  contractFailRate: number | null;
  benchmarkGain: number | null;
  crashCount: number;
  crashRate: number | null;
  hardGuardrailBreach: boolean;
  capacityTrend: string;  // "improving" | "stable" | "degrading" | "insufficient_data"
}

export interface BandStatus {
  schemaVersion: number;
  state: string;
  previousState: string | null;
  stateChangedAt: string | null;
  updatedAt: string;
  cycleCount: number;
  compositeScore: number | null;
  compositeScoreWindow: number[];
  dimensions: {
    completion: number | null;
    premiumEfficiency: number | null;
    quality: number | null;
    capacityTrend: number | null;
    stability: number | null;
  };
  thresholdChecks: {
    compositeScoreMet: boolean;
    completionRateMet: boolean;
    premiumEfficiencyMet: boolean;
    athenaRejectRateMet: boolean;
    hardGuardrailBreachMet: boolean;
    benchmarkGainMet: boolean;
    completionVarianceMet: boolean;
    completedPhaseMet: boolean;
    allMet: boolean;
  };
  regressionChecks: {
    crashBreach: boolean;
    completionBreach: boolean;
    hardGuardrailBreach: boolean;
    athenaRejectBreach: boolean;
    anyBreach: boolean;
  };
  shadowMode: boolean;
  executionPhase: string;
  executionGate: {
    exploitationReady: boolean;
    reason: string;
  };
  history: CycleSample[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toFinite(value: unknown, fallback: number | null = null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number | null): number | null {
  if (value === null) return null;
  return Math.max(0, Math.min(1, value));
}

function windowAvg(values: (number | null)[], windowSize: number): number | null {
  const recent = values.slice(-windowSize).filter((v): v is number => v !== null);
  if (recent.length === 0) return null;
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function windowVariance(values: (number | null)[], windowSize: number): number | null {
  const recent = values.slice(-windowSize).filter((v): v is number => v !== null);
  if (recent.length < 2) return null;
  const avg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const variance = recent.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / recent.length;
  return variance;
}

function mergeQualitySignals(signals: {
  athenaQuality: number | null;
  parserQuality: number | null;
  contractQuality: number | null;
}): number | null {
  const weights = {
    athenaQuality: 0.50,
    parserQuality: 0.25,
    contractQuality: 0.25,
  } as const;

  const entries = Object.entries(signals)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => ({ key, value: value as number }));

  if (entries.length === 0) return null;
  const activeWeight = entries.reduce((sum, e) => sum + weights[e.key as keyof typeof weights], 0);
  if (activeWeight <= 0) return null;

  const blended = entries.reduce((sum, e) => {
    const normalizedWeight = weights[e.key as keyof typeof weights] / activeWeight;
    return sum + (normalizedWeight * Math.max(0, Math.min(1, e.value)));
  }, 0);
  return Math.round(blended * 1000) / 1000;
}

function capacityTrendToScore(trend: string): number {
  switch (trend) {
    case "improving":         return 1.0;
    case "stable":            return 0.6;
    case "degrading":         return 0.1;
    case "insufficient_data": return 0.5;  // neutral — no penalty, no reward
    default:                  return 0.5;
  }
}

// ── File path ────────────────────────────────────────────────────────────────

function bandStatusPath(config: Record<string, unknown>): string {
  const paths = config?.paths as Record<string, unknown> | undefined;
  const stateDir = (paths?.stateDir as string) || "state";
  return path.join(stateDir, "autonomy_band_status.json");
}

// ── Composite Score ──────────────────────────────────────────────────────────

/**
 * Compute autonomy composite score from individual dimension values.
 * Each dimension is 0-1. Null dimensions are excluded and their weight
 * is redistributed proportionally among present dimensions.
 */
export function computeCompositeScore(dimensions: {
  completion: number | null;
  premiumEfficiency: number | null;
  quality: number | null;
  capacityTrend: number | null;
  stability: number | null;
}): number | null {
  const entries: [string, number][] = [];
  const weights = SCORE_WEIGHTS as Record<string, number>;

  for (const [key, value] of Object.entries(dimensions)) {
    if (value !== null && Number.isFinite(value)) {
      entries.push([key, value]);
    }
  }

  if (entries.length === 0) return null;

  // Redistribute weights proportionally among present dimensions
  const totalActiveWeight = entries.reduce((sum, [key]) => sum + (weights[key] || 0), 0);
  if (totalActiveWeight === 0) return null;

  let score = 0;
  for (const [key, value] of entries) {
    const normalizedWeight = (weights[key] || 0) / totalActiveWeight;
    score += normalizedWeight * Math.max(0, Math.min(1, value));
  }

  return Math.round(score * 1000) / 1000;
}

// ── Threshold evaluation ─────────────────────────────────────────────────────

export function evaluateInBandThresholds(
  history: CycleSample[],
  thresholds: Thresholds,
): BandStatus["thresholdChecks"] {
  const window = history.slice(-thresholds.stabilizingWindow);

  const compositeScores = window.map(s => {
    const dims = sampleToDimensions(s);
    return computeCompositeScore(dims);
  });
  const avgComposite = windowAvg(compositeScores, thresholds.stabilizingWindow);
  const compositeScoreMet = avgComposite !== null && avgComposite >= thresholds.compositeScoreMin;

  const completionRates = window.map(s => s.completionRate);
  const avgCompletion = windowAvg(completionRates, thresholds.stabilizingWindow);
  const completionRateMet = avgCompletion !== null && avgCompletion >= thresholds.completionRateMin;

  const efficiencies = window.map(s => s.premiumEfficiency);
  const avgEfficiency = windowAvg(efficiencies, thresholds.stabilizingWindow);
  const premiumEfficiencyMet = avgEfficiency !== null && avgEfficiency >= thresholds.premiumEfficiencyMin;

  const rejectRates = window.map(s => s.athenaRejectRate);
  const avgReject = windowAvg(rejectRates, thresholds.stabilizingWindow);
  const athenaRejectRateMet = avgReject !== null && avgReject <= thresholds.athenaRejectRateMax;

  const guardrailWindow = history.slice(-thresholds.hardGuardrailWindow);
  const breachCount = guardrailWindow.filter(s => s.hardGuardrailBreach).length;
  const hardGuardrailBreachMet = breachCount <= thresholds.hardGuardrailBreachMax;

  const benchmarkGainAvg = windowAvg(window.map(s => s.benchmarkGain), thresholds.stabilizingWindow);
  const benchmarkGainMet = benchmarkGainAvg !== null && benchmarkGainAvg >= thresholds.inBandMinBenchmarkGain;

  const completionVariance = windowVariance(window.map(s => s.completionRate), thresholds.stabilizingWindow);
  const completionVarianceMet = completionVariance !== null
    ? completionVariance <= thresholds.inBandMaxCompletionVariance
    : false;

  const completedPhaseMet = thresholds.inBandRequireCompletedPhase
    ? window.every((s) => String(s.phase || "").toLowerCase() === "completed")
    : true;

  const allMet = compositeScoreMet && completionRateMet && premiumEfficiencyMet
    && athenaRejectRateMet && hardGuardrailBreachMet && benchmarkGainMet
    && completionVarianceMet && completedPhaseMet;

  return {
    compositeScoreMet,
    completionRateMet,
    premiumEfficiencyMet,
    athenaRejectRateMet,
    hardGuardrailBreachMet,
    benchmarkGainMet,
    completionVarianceMet,
    completedPhaseMet,
    allMet,
  };
}

export function evaluateRegressionTriggers(
  history: CycleSample[],
  thresholds: Thresholds,
): BandStatus["regressionChecks"] {
  // Crash breach: 3+ crashes in last 10 cycles
  const crashWindow = history.slice(-thresholds.regressCrashWindow);
  const totalCrashes = crashWindow.reduce((sum, s) => sum + (s.crashCount || 0), 0);
  const crashBreach = totalCrashes >= thresholds.regressCrashThreshold;

  // Completion breach: avg < 0.40 in last 10 cycles
  const completionWindow = history.slice(-thresholds.regressCompletionWindow);
  const avgCompletion = windowAvg(completionWindow.map(s => s.completionRate), thresholds.regressCompletionWindow);
  const completionBreach = avgCompletion !== null && avgCompletion < thresholds.regressCompletionMin;

  // Hard guardrail breach: any in last cycle
  const lastSample = history.length > 0 ? history[history.length - 1] : null;
  const hardGuardrailBreach = lastSample?.hardGuardrailBreach === true;

  // Athena reject breach: avg > 0.40 in last 5 cycles
  const athenaWindow = history.slice(-thresholds.regressAthenaRejectWindow);
  const avgReject = windowAvg(athenaWindow.map(s => s.athenaRejectRate), thresholds.regressAthenaRejectWindow);
  const athenaRejectBreach = avgReject !== null && avgReject > thresholds.regressAthenaRejectMax;

  const anyBreach = crashBreach || completionBreach || hardGuardrailBreach || athenaRejectBreach;

  return {
    crashBreach,
    completionBreach,
    hardGuardrailBreach,
    athenaRejectBreach,
    anyBreach,
  };
}

// ── Dimension extraction from sample ─────────────────────────────────────────

function sampleToDimensions(sample: CycleSample) {
  const athenaQuality = sample.athenaRejectRate !== null ? clamp01(1 - sample.athenaRejectRate) : null;
  const parserQuality = sample.parserFallbackRate !== null ? clamp01(1 - sample.parserFallbackRate) : null;
  const contractQuality = sample.contractFailRate !== null ? clamp01(1 - sample.contractFailRate) : null;
  return {
    completion: clamp01(toFinite(sample.completionRate)),
    premiumEfficiency: clamp01(toFinite(sample.premiumEfficiency)),
    quality: mergeQualitySignals({ athenaQuality, parserQuality, contractQuality }),
    capacityTrend: capacityTrendToScore(sample.capacityTrend),
    stability: sample.crashRate !== null ? clamp01(1 - sample.crashRate) : null,
  };
}

function computeExecutionPhase(
  state: string,
  history: CycleSample[],
  thresholds: Thresholds,
): { phase: string; exploitationReady: boolean; reason: string } {
  if (state !== BAND_STATE.IN_BAND) {
    return {
      phase: "PHASE_1_STABILIZATION",
      exploitationReady: false,
      reason: "band_not_reached",
    };
  }

  const window = history.slice(-thresholds.exploitationWindow);
  if (window.length < thresholds.exploitationWindow) {
    return {
      phase: "PHASE_1_STABILIZATION",
      exploitationReady: false,
      reason: "insufficient_exploitation_window",
    };
  }

  const benchmarkGain = windowAvg(window.map((s) => s.benchmarkGain), thresholds.exploitationWindow);
  const completionVar = windowVariance(window.map((s) => s.completionRate), thresholds.exploitationWindow);
  const phaseCompleted = window.every((s) => String(s.phase || "").toLowerCase() === "completed");

  if (benchmarkGain === null || benchmarkGain < thresholds.exploitationMinBenchmarkGain) {
    return {
      phase: "PHASE_1_STABILIZATION",
      exploitationReady: false,
      reason: "benchmark_gain_gate",
    };
  }
  if (completionVar === null || completionVar > thresholds.exploitationMaxCompletionVariance) {
    return {
      phase: "PHASE_1_STABILIZATION",
      exploitationReady: false,
      reason: "completion_variance_gate",
    };
  }
  if (thresholds.inBandRequireCompletedPhase && !phaseCompleted) {
    return {
      phase: "PHASE_1_STABILIZATION",
      exploitationReady: false,
      reason: "phase_completed_gate",
    };
  }

  return {
    phase: "EXPLOITATION",
    exploitationReady: true,
    reason: "all_exploitation_gates_met",
  };
}

// ── State transition ─────────────────────────────────────────────────────────

/**
 * Compute the next band state given history and thresholds.
 * Purely deterministic — no AI involvement.
 */
export function computeNextState(
  currentState: string,
  history: CycleSample[],
  thresholds: Thresholds,
): { nextState: string; reason: string } {
  const cycleCount = history.length;

  // REGRESSED check: any regression trigger overrides everything
  const regressionChecks = evaluateRegressionTriggers(history, thresholds);
  if (regressionChecks.anyBreach) {
    const triggers: string[] = [];
    if (regressionChecks.crashBreach) triggers.push("crash_breach");
    if (regressionChecks.completionBreach) triggers.push("completion_breach");
    if (regressionChecks.hardGuardrailBreach) triggers.push("hard_guardrail_breach");
    if (regressionChecks.athenaRejectBreach) triggers.push("athena_reject_breach");
    return {
      nextState: BAND_STATE.REGRESSED,
      reason: `regression_trigger:${triggers.join("+")}`,
    };
  }

  // BOOTSTRAPPING: not enough cycles
  if (cycleCount < thresholds.minBootstrapCycles) {
    return {
      nextState: BAND_STATE.BOOTSTRAPPING,
      reason: `cycle_count=${cycleCount}<${thresholds.minBootstrapCycles}`,
    };
  }

  // Check IN_BAND thresholds
  const inBandChecks = evaluateInBandThresholds(history, thresholds);

  if (inBandChecks.allMet) {
    return {
      nextState: BAND_STATE.IN_BAND,
      reason: "all_thresholds_met",
    };
  }

  // If currently IN_BAND but thresholds no longer met, go to STABILIZING (not REGRESSED)
  // REGRESSED is only reached by hard regression triggers above
  if (currentState === BAND_STATE.IN_BAND) {
    const failedChecks: string[] = [];
    if (!inBandChecks.compositeScoreMet) failedChecks.push("composite_score");
    if (!inBandChecks.completionRateMet) failedChecks.push("completion_rate");
    if (!inBandChecks.premiumEfficiencyMet) failedChecks.push("premium_efficiency");
    if (!inBandChecks.athenaRejectRateMet) failedChecks.push("athena_reject_rate");
    if (!inBandChecks.hardGuardrailBreachMet) failedChecks.push("hard_guardrail_breach");
    return {
      nextState: BAND_STATE.STABILIZING,
      reason: `threshold_drift:${failedChecks.join("+")}`,
    };
  }

  // STABILIZING: enough cycles but thresholds not yet met
  return {
    nextState: BAND_STATE.STABILIZING,
    reason: `thresholds_not_met:cycleCount=${cycleCount}`,
  };
}

// ── Read/Write ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 100;

export async function readBandStatus(config: Record<string, unknown>): Promise<BandStatus> {
  const data = await readJson(bandStatusPath(config), null);
  if (data && data.schemaVersion === AUTONOMY_BAND_SCHEMA_VERSION) {
    return data as BandStatus;
  }
  return createInitialStatus();
}

export async function writeBandStatus(config: Record<string, unknown>, status: BandStatus): Promise<void> {
  await writeJson(bandStatusPath(config), status);
}

function createInitialStatus(): BandStatus {
  return {
    schemaVersion: AUTONOMY_BAND_SCHEMA_VERSION,
    state: BAND_STATE.BOOTSTRAPPING,
    previousState: null,
    stateChangedAt: null,
    updatedAt: new Date().toISOString(),
    cycleCount: 0,
    compositeScore: null,
    compositeScoreWindow: [],
    dimensions: {
      completion: null,
      premiumEfficiency: null,
      quality: null,
      capacityTrend: null,
      stability: null,
    },
    thresholdChecks: {
      compositeScoreMet: false,
      completionRateMet: false,
      premiumEfficiencyMet: false,
      athenaRejectRateMet: false,
      hardGuardrailBreachMet: false,
      benchmarkGainMet: false,
      completionVarianceMet: false,
      completedPhaseMet: false,
      allMet: false,
    },
    regressionChecks: {
      crashBreach: false,
      completionBreach: false,
      hardGuardrailBreach: false,
      athenaRejectBreach: false,
      anyBreach: false,
    },
    shadowMode: true,
    executionPhase: "PHASE_1_STABILIZATION",
    executionGate: {
      exploitationReady: false,
      reason: "initial_state",
    },
    history: [],
  };
}

// ── Main entry point: evaluate autonomy band for current cycle ──────────────

/**
 * Record a cycle sample and re-evaluate the autonomy band state machine.
 *
 * Called once per cycle from orchestrator cycle close.
 * Deterministic — no AI calls.
 * Advisory — never blocks orchestration.
 *
 * @returns Updated BandStatus with new state, score, and check results.
 */
export async function evaluateAutonomyBand(
  config: Record<string, unknown>,
  sample: CycleSample,
): Promise<BandStatus> {
  const thresholds = resolveThresholds(config);
  const status = await readBandStatus(config);

  // Append sample to history
  status.history.push(sample);
  if (status.history.length > MAX_HISTORY) {
    status.history.splice(0, status.history.length - MAX_HISTORY);
  }

  // Compute dimensions from latest sample
  const dimensions = sampleToDimensions(sample);
  status.dimensions = dimensions;

  // Compute composite score
  const compositeScore = computeCompositeScore(dimensions);
  status.compositeScore = compositeScore;

  // Track score window for trend visibility
  if (compositeScore !== null) {
    status.compositeScoreWindow.push(compositeScore);
    if (status.compositeScoreWindow.length > thresholds.stabilizingWindow) {
      status.compositeScoreWindow.splice(0, status.compositeScoreWindow.length - thresholds.stabilizingWindow);
    }
  }

  // Run threshold evaluations
  status.thresholdChecks = evaluateInBandThresholds(status.history, thresholds);
  status.regressionChecks = evaluateRegressionTriggers(status.history, thresholds);

  // Compute next state
  const { nextState, reason: _reason } = computeNextState(status.state, status.history, thresholds);
  const previousState = status.state;
  if (nextState !== previousState) {
    status.previousState = previousState;
    status.stateChangedAt = new Date().toISOString();
  }
  status.state = nextState;
  status.cycleCount = status.history.length;
  status.updatedAt = new Date().toISOString();

  const executionGate = computeExecutionPhase(status.state, status.history, thresholds);
  status.executionPhase = executionGate.phase;
  status.executionGate = {
    exploitationReady: executionGate.exploitationReady,
    reason: executionGate.reason,
  };

  // Shadow mode from config
  const rt = config?.runtime as Record<string, unknown> | undefined;
  const ab = rt?.autonomyBand as Record<string, unknown> | undefined;
  status.shadowMode = ab?.shadowMode !== false;

  await writeBandStatus(config, status);

  return status;
}

// ── Config resolution ────────────────────────────────────────────────────────

function resolveThresholds(config: Record<string, unknown>): Thresholds {
  const runtime = config?.runtime as Record<string, unknown> | undefined;
  const autonomyBand = runtime?.autonomyBand as Record<string, unknown> | undefined;
  const bandConfig = autonomyBand?.thresholds as Record<string, unknown> | undefined;
  if (!bandConfig || typeof bandConfig !== "object") return DEFAULT_THRESHOLDS;

  return {
    minBootstrapCycles:     safeInt(bandConfig.minBootstrapCycles,     DEFAULT_THRESHOLDS.minBootstrapCycles),
    stabilizingWindow:      safeInt(bandConfig.stabilizingWindow,      DEFAULT_THRESHOLDS.stabilizingWindow),
    hardGuardrailWindow:    safeInt(bandConfig.hardGuardrailWindow,    DEFAULT_THRESHOLDS.hardGuardrailWindow),
    compositeScoreMin:      safeFloat(bandConfig.compositeScoreMin,    DEFAULT_THRESHOLDS.compositeScoreMin),
    completionRateMin:      safeFloat(bandConfig.completionRateMin,    DEFAULT_THRESHOLDS.completionRateMin),
    premiumEfficiencyMin:   safeFloat(bandConfig.premiumEfficiencyMin, DEFAULT_THRESHOLDS.premiumEfficiencyMin),
    athenaRejectRateMax:    safeFloat(bandConfig.athenaRejectRateMax,  DEFAULT_THRESHOLDS.athenaRejectRateMax),
    hardGuardrailBreachMax: safeInt(bandConfig.hardGuardrailBreachMax, DEFAULT_THRESHOLDS.hardGuardrailBreachMax),
    inBandMinBenchmarkGain: safeFloat(bandConfig.inBandMinBenchmarkGain, DEFAULT_THRESHOLDS.inBandMinBenchmarkGain),
    inBandMaxCompletionVariance: safeFloat(bandConfig.inBandMaxCompletionVariance, DEFAULT_THRESHOLDS.inBandMaxCompletionVariance),
    inBandRequireCompletedPhase: typeof bandConfig.inBandRequireCompletedPhase === "boolean"
      ? bandConfig.inBandRequireCompletedPhase
      : DEFAULT_THRESHOLDS.inBandRequireCompletedPhase,
    regressCrashWindow:     safeInt(bandConfig.regressCrashWindow,     DEFAULT_THRESHOLDS.regressCrashWindow),
    regressCrashThreshold:  safeInt(bandConfig.regressCrashThreshold,  DEFAULT_THRESHOLDS.regressCrashThreshold),
    regressCompletionWindow:   safeInt(bandConfig.regressCompletionWindow,   DEFAULT_THRESHOLDS.regressCompletionWindow),
    regressCompletionMin:      safeFloat(bandConfig.regressCompletionMin,    DEFAULT_THRESHOLDS.regressCompletionMin),
    regressAthenaRejectWindow: safeInt(bandConfig.regressAthenaRejectWindow, DEFAULT_THRESHOLDS.regressAthenaRejectWindow),
    regressAthenaRejectMax:    safeFloat(bandConfig.regressAthenaRejectMax,  DEFAULT_THRESHOLDS.regressAthenaRejectMax),
    exploitationWindow: safeInt(bandConfig.exploitationWindow, DEFAULT_THRESHOLDS.exploitationWindow),
    exploitationMinBenchmarkGain: safeFloat(bandConfig.exploitationMinBenchmarkGain, DEFAULT_THRESHOLDS.exploitationMinBenchmarkGain),
    exploitationMaxCompletionVariance: safeFloat(bandConfig.exploitationMaxCompletionVariance, DEFAULT_THRESHOLDS.exploitationMaxCompletionVariance),
  };
}

function safeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function safeFloat(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}
