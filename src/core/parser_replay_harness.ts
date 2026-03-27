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

/** Maximum confidence delta before flagging a regression. */
export const MAX_CONFIDENCE_DELTA = -0.15;

/** Maximum corpus entries to keep. */
const MAX_CORPUS_SIZE = 50;

/**
 * @typedef {object} CorpusEntry
 * @property {string} id — unique entry identifier
 * @property {string} raw — raw planner output text (first 5000 chars)
 * @property {number} expectedPlanCount — number of plans parsed originally
 * @property {number} baselineConfidence — confidence at time of recording
 * @property {string} recordedAt — ISO timestamp
 * @property {string[]} [requiredKeys] — keys that must be present in every parsed plan
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

    // Check for omitted mandatory keys in every parsed plan
    const requiredKeys: string[] = Array.isArray(entry.requiredKeys) ? entry.requiredKeys : [];
    const omittedKeys: string[] = [];
    if (requiredKeys.length > 0 && parsedPlans.length > 0) {
      for (const key of requiredKeys) {
        const missing = parsedPlans.some(plan => !(key in (plan as object)));
        if (missing && !omittedKeys.includes(key)) {
          omittedKeys.push(key);
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
    });
  }

  return { results, regressionCount, passed: regressionCount === 0 };
}
