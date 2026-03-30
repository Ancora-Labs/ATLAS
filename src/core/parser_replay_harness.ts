/**
 * parser_replay_harness.js — Parser confidence regression testing (Packet 10).
 *
 * Replays historical planner outputs through the current parser/normalizer
 * and compares confidence scores against recorded baselines. If confidence
 * degrades beyond a threshold, the test fails — preventing parser regressions.
 *
 * Corpus: state/parser_replay_corpus.json — array of { raw, expectedPlans, baselineConfidence }
 */

import path from "node:path";
import { readJson, writeJson } from "./fs_utils.js";
import type { BaselineRecoveryRecord } from "./parser_baseline_recovery.js";

/** Maximum confidence delta before flagging a regression. */
export const MAX_CONFIDENCE_DELTA = -0.15;

/** Maximum corpus entries to keep. */
const MAX_CORPUS_SIZE = 50;

/**
 * Parse modes supported by the replay harness.
 *
 * - json-direct:      parser returns a fully-structured JSON object with a `plans` array.
 * - fallback:         parser degraded gracefully; may return fewer plans or lower confidence.
 * - batch-normalized: parser merged multiple batch outputs into a single flat `plans` array.
 *
 * The `parseMode` field on a corpus entry is informational — required-key omission is treated
 * as a hard regression in ALL modes.
 */
export type ParseMode = "json-direct" | "fallback" | "batch-normalized";

/**
 * @typedef {object} CorpusEntry
 * @property {string} id — unique entry identifier
 * @property {string} raw — raw planner output text (first 5000 chars)
 * @property {number} expectedPlanCount — number of plans parsed originally
 * @property {number} baselineConfidence — confidence at time of recording
 * @property {string} recordedAt — ISO timestamp
 * @property {string[]} [requiredKeys] — keys that must be present in every parsed plan
 * @property {ParseMode} [parseMode] — which parse mode was active when the baseline was recorded
 */

/**
 * @typedef {object} ReplayResult
 * @property {string} id — corpus entry ID
 * @property {number} baselineConfidence
 * @property {number} currentConfidence
 * @property {number} delta — currentConfidence - baselineConfidence
 * @property {boolean} regressed — true if delta < MAX_CONFIDENCE_DELTA or required keys are missing
 * @property {number} baselinePlanCount
 * @property {number} currentPlanCount
 * @property {string[]} omittedKeys — required keys missing from any parsed plan
 * @property {ParseMode|undefined} parseMode — mode recorded on the corpus entry
 */

/**
 * Load the parser replay corpus from state.
 *
 * @param {object} config
 * @returns {Promise<CorpusEntry[]>}
 */
export async function loadCorpus(config) {
  const stateDir = config?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, "parser_replay_corpus.json");
  const data = await readJson(filePath, []);
  return Array.isArray(data) ? data : [];
}

/**
 * Append a new entry to the corpus.
 *
 * @param {object} config
 * @param {CorpusEntry} entry
 */
export async function appendCorpusEntry(config, entry) {
  const stateDir = config?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, "parser_replay_corpus.json");
  const corpus = await loadCorpus(config);
  corpus.push({
    ...entry,
    recordedAt: entry.recordedAt || new Date().toISOString(),
  });
  // Keep bounded
  const trimmed = corpus.length > MAX_CORPUS_SIZE ? corpus.slice(-MAX_CORPUS_SIZE) : corpus;
  await writeJson(filePath, trimmed);
}

/**
 * Replay all corpus entries through a parser function and check for regressions.
 *
 * @param {CorpusEntry[]} corpus
 * @param {(raw: string) => { plans: object[], confidence: number }} parserFn — the current parser
 * @returns {{ results: ReplayResult[], regressionCount: number, passed: boolean }}
 */
export function replayCorpus(corpus, parserFn) {
  if (!Array.isArray(corpus) || corpus.length === 0 || typeof parserFn !== "function") {
    return { results: [], regressionCount: 0, passed: true };
  }

  const results = [];
  let regressionCount = 0;

  for (const entry of corpus) {
    let currentConfidence: number;
    let currentPlanCount: number;
    let parsedPlans: object[];

    try {
      const parsed = parserFn(entry.raw);
      currentConfidence = parsed.confidence ?? 0;
      parsedPlans = Array.isArray(parsed.plans) ? parsed.plans : [];
      currentPlanCount = parsedPlans.length;
    } catch {
      currentConfidence = 0;
      currentPlanCount = 0;
      parsedPlans = [];
    }

    const delta = currentConfidence - (entry.baselineConfidence || 0);
    const confidenceRegressed = delta < MAX_CONFIDENCE_DELTA;

    // Hard regression check: required keys must be present in every parsed plan,
    // across all parse modes (json-direct, fallback, batch-normalized).
    // If the parser returned no plans but plans were expected and requiredKeys are
    // declared, all required keys are treated as omitted — this covers the fallback
    // mode case where an empty plans array silently hides missing-key regressions.
    const requiredKeys: string[] = Array.isArray(entry.requiredKeys) ? entry.requiredKeys : [];
    const omittedKeys: string[] = [];
    if (requiredKeys.length > 0) {
      if (parsedPlans.length === 0 && (entry.expectedPlanCount || 0) > 0) {
        // No plans returned but plans were expected — all required keys are absent.
        for (const key of requiredKeys) {
          omittedKeys.push(key);
        }
      } else {
        for (const key of requiredKeys) {
          const missing = parsedPlans.some(plan => !(key in (plan as object)));
          if (missing && !omittedKeys.includes(key)) {
            omittedKeys.push(key);
          }
        }
      }
    }

    const regressed = confidenceRegressed || omittedKeys.length > 0;
    if (regressed) regressionCount++;

    results.push({
      id: entry.id,
      baselineConfidence: entry.baselineConfidence || 0,
      currentConfidence,
      delta: Math.round(delta * 1000) / 1000,
      regressed,
      baselinePlanCount: entry.expectedPlanCount || 0,
      currentPlanCount,
      omittedKeys,
      parseMode: entry.parseMode,
    });
  }

  return { results, regressionCount, passed: regressionCount === 0 };
}

// ── Dispatch Strictness ───────────────────────────────────────────────────────

/**
 * Dispatch strictness levels derived from replay harness regressions combined
 * with parser baseline recovery state.
 *
 *   NORMAL   — zero regressions and parser healthy: standard dispatch.
 *   ELEVATED — ≤20% corpus regression rate OR baseline recovery active with
 *              confidence ≥ 0.7: advisory warning, dispatch continues.
 *   STRICT   — 20–50% corpus regression rate OR baseline recovery active with
 *              confidence < 0.7 OR baseline recovery active with severe
 *              component degradation (maxComponentGap ≥ 0.4): alert emitted,
 *              dispatch continues with reduced concurrency allowed by the caller.
 *   BLOCKED  — >50% corpus regression rate: dispatch blocked, human review required.
 */
export const DISPATCH_STRICTNESS = Object.freeze({
  NORMAL:   "normal",
  ELEVATED: "elevated",
  STRICT:   "strict",
  BLOCKED:  "blocked",
} as const);

export type DispatchStrictnessLevel = typeof DISPATCH_STRICTNESS[keyof typeof DISPATCH_STRICTNESS];

/** Input snapshot from a previous replayCorpus() call (or null if unavailable). */
export interface ReplayRegressionState {
  regressionCount: number;
  totalCount:      number;
  passed:          boolean;
  computedAt:      string;
}

/**
 * Result of computeDispatchStrictness().
 *
 * @property strictness      — resolved strictness level
 * @property regressionRate  — regressionCount / totalCount (0 when no corpus)
 * @property regressionCount — raw count from replay state
 * @property totalCount      — corpus size at last replay run
 * @property recoveryActive  — true when baseline recovery is currently active
 * @property penaltyCount    — number of component penalties from the baseline record (0 when absent)
 * @property maxComponentGap — worst single-component gap from the baseline record (0 when absent)
 * @property reason          — human-readable explanation of the resolved level
 */
export interface DispatchStrictnessResult {
  strictness:      DispatchStrictnessLevel;
  regressionRate:  number;
  regressionCount: number;
  totalCount:      number;
  recoveryActive:  boolean;
  penaltyCount:    number;
  maxComponentGap: number;
  reason:          string;
}

/**
 * Compute the dispatch strictness level from replay harness regression data
 * and the current parser baseline recovery record.
 *
 * Pure function — no I/O.  Safe to call with null/undefined inputs; both
 * signals are optional and the function degrades gracefully when either is
 * absent.
 *
 * @param replayState           — output of a previous replayCorpus() call persisted
 *                                via persistReplayRegressionState(), or null/undefined
 *                                if no corpus run has been recorded yet.
 * @param baselineRecoveryRecord — output of computeBaselineRecoveryState(), or
 *                                 null/undefined when the parser is healthy.
 * @returns DispatchStrictnessResult
 */
export function computeDispatchStrictness(
  replayState:            ReplayRegressionState | null | undefined,
  baselineRecoveryRecord: BaselineRecoveryRecord | null | undefined
): DispatchStrictnessResult {
  const totalCount      = typeof replayState?.totalCount === "number" ? replayState.totalCount : 0;
  const regressionCount = typeof replayState?.regressionCount === "number" ? replayState.regressionCount : 0;
  const regressionRate  = totalCount > 0 ? regressionCount / totalCount : 0;
  const recoveryActive  = baselineRecoveryRecord?.recoveryActive === true;
  const parserConfidence: number =
    typeof baselineRecoveryRecord?.parserConfidence === "number"
      ? baselineRecoveryRecord.parserConfidence
      : 1.0;

  // Extract component penalty data for richer strictness decisions.
  const penalties = Array.isArray(baselineRecoveryRecord?.penalties)
    ? baselineRecoveryRecord!.penalties
    : [];
  const penaltyCount = penalties.length;

  const cgap = baselineRecoveryRecord?.componentGap;
  const maxComponentGap: number = cgap
    ? Math.max(
        typeof cgap.plansShape      === "number" ? cgap.plansShape      : 0,
        typeof cgap.healthField     === "number" ? cgap.healthField     : 0,
        typeof cgap.requestBudget   === "number" ? cgap.requestBudget   : 0,
        typeof cgap.dependencyGraph === "number" ? cgap.dependencyGraph : 0,
      )
    : 0;

  // Hard block: >50% of the replay corpus has regressed.
  if (regressionRate > 0.5) {
    return {
      strictness:      DISPATCH_STRICTNESS.BLOCKED,
      regressionRate,
      regressionCount,
      totalCount,
      recoveryActive,
      penaltyCount,
      maxComponentGap,
      reason: `Replay regression rate ${(regressionRate * 100).toFixed(0)}% exceeds 50% — dispatch blocked pending human review`,
    };
  }

  // Strict: 20–50% regression OR deep recovery (confidence < 0.7) OR severe component degradation.
  // A maxComponentGap >= 0.4 (component confidence ≤ 0.6) is treated as severe even when the
  // aggregate parserConfidence is still above 0.7, because a single deeply-degraded component
  // is a reliable precursor to plan quality failures.
  const hasDeepComponentDegradation = recoveryActive && maxComponentGap >= 0.4;
  if (regressionRate > 0.2 || (recoveryActive && parserConfidence < 0.7) || hasDeepComponentDegradation) {
    let strictReason: string;
    if (regressionRate > 0.2) {
      strictReason = `Replay regression rate ${(regressionRate * 100).toFixed(0)}% exceeds 20%`;
    } else if (parserConfidence < 0.7) {
      strictReason = `Baseline recovery active with deep confidence degradation (confidence=${parserConfidence})`;
    } else {
      strictReason = `Baseline recovery active with severe component degradation (maxComponentGap=${maxComponentGap})`;
    }
    return {
      strictness:      DISPATCH_STRICTNESS.STRICT,
      regressionRate,
      regressionCount,
      totalCount,
      recoveryActive,
      penaltyCount,
      maxComponentGap,
      reason: strictReason,
    };
  }

  // Elevated: any regression present OR recovery active (shallow).
  // When recovery is active, include penalty count in the reason for operator visibility.
  if (regressionRate > 0 || recoveryActive) {
    let elevatedReason: string;
    if (regressionRate > 0) {
      elevatedReason = `Replay corpus has ${regressionCount} regression(s) (${(regressionRate * 100).toFixed(0)}% rate)`;
    } else if (penaltyCount > 0) {
      elevatedReason = `Baseline recovery mode active (confidence=${parserConfidence}, penalties=${penaltyCount})`;
    } else {
      elevatedReason = `Baseline recovery mode active (confidence=${parserConfidence})`;
    }
    return {
      strictness:      DISPATCH_STRICTNESS.ELEVATED,
      regressionRate,
      regressionCount,
      totalCount,
      recoveryActive,
      penaltyCount,
      maxComponentGap,
      reason: elevatedReason,
    };
  }

  return {
    strictness:      DISPATCH_STRICTNESS.NORMAL,
    regressionRate:  0,
    regressionCount: 0,
    totalCount,
    recoveryActive:  false,
    penaltyCount:    0,
    maxComponentGap: 0,
    reason:          "No replay regressions and parser confidence healthy",
  };
}

// ── Replay regression state persistence ──────────────────────────────────────

const REGRESSION_STATE_FILE = "parser_replay_regression_state.json";

/**
 * Persist a snapshot of the most recent replayCorpus() result so the
 * orchestrator can load it at dispatch time without re-running the corpus.
 *
 * Never throws — I/O errors propagate to the caller.
 *
 * @param config — BOX config object
 * @param replayResult — output of replayCorpus()
 */
export async function persistReplayRegressionState(
  config: object,
  replayResult: { regressionCount: number; results: unknown[]; passed: boolean }
): Promise<void> {
  const stateDir = (config as any)?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, REGRESSION_STATE_FILE);
  const state: ReplayRegressionState = {
    regressionCount: replayResult.regressionCount,
    totalCount:      Array.isArray(replayResult.results) ? replayResult.results.length : 0,
    passed:          replayResult.passed,
    computedAt:      new Date().toISOString(),
  };
  await writeJson(filePath, state);
}

/**
 * Load the last persisted replay regression state from state/.
 * Returns null when the file does not exist (no corpus run recorded yet).
 *
 * @param config — BOX config object
 */
export async function loadReplayRegressionState(
  config: object
): Promise<ReplayRegressionState | null> {
  const stateDir = (config as any)?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, REGRESSION_STATE_FILE);
  return readJson(filePath, null);
}
