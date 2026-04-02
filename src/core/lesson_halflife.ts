/**
 * lesson_halflife.js — Time-decayed relevance scoring for postmortem lessons.
 *
 * Older lessons naturally lose relevance as the codebase evolves.
 * This module computes a relevance weight for each lesson based on its age,
 * so that Athena can prioritize recent learnings over stale ones.
 *
 * Formula: weight = 2^(-ageInDays / halfLifeDays)
 *   - age = 0     → weight = 1.0
 *   - age = half   → weight = 0.5
 *   - age = 2×half → weight = 0.25
 */

/** Default half-life in days. */
export const DEFAULT_HALF_LIFE_DAYS = 14;

/**
 * Compute the relevance weight of a lesson.
 *
 * @param {string|Date} reviewedAt — ISO timestamp of when the lesson was recorded
 * @param {{ halfLifeDays?: number, now?: number }} opts
 * @returns {number} weight in [0, 1]
 */
export function computeLessonWeight(reviewedAt, opts: any = {}) {
  if (!reviewedAt) return 0;

  const halfLife = opts.halfLifeDays || DEFAULT_HALF_LIFE_DAYS;
  const now = opts.now || Date.now();
  const ageMs = now - new Date(reviewedAt).getTime();
  if (ageMs <= 0) return 1.0;

  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  return Math.pow(2, -ageDays / halfLife);
}

/**
 * Rank postmortem lessons by time-decayed relevance.
 * Returns the top N lessons sorted by weight descending.
 *
 * @param {object[]} postmortems
 * @param {{ halfLifeDays?: number, now?: number, limit?: number }} opts
 * @returns {{ lesson: string, weight: number, reviewedAt: string }[]}
 */
export function rankLessonsByRelevance(postmortems, opts: any = {}) {
  if (!Array.isArray(postmortems)) return [];

  const limit = opts.limit || 10;
  const scored = [];

  for (const pm of postmortems) {
    const lesson = pm?.lessonLearned;
    if (!lesson || String(lesson).trim().length < 5) continue;

    const weight = computeLessonWeight(pm.reviewedAt, opts);
    scored.push({
      lesson: String(lesson).trim(),
      weight: Math.round(weight * 1000) / 1000,
      reviewedAt: pm.reviewedAt || ""
    });
  }

  scored.sort((a, b) => b.weight - a.weight);
  return scored.slice(0, limit);
}

// ── Curriculum-based learning promotion ───────────────────────────────────────

/**
 * Multiplier applied to lesson weight when the lesson overlaps with an active
 * research topic.  A boost > 1.0 accelerates research-confirmed lessons past
 * the promotion threshold faster than time-decayed-only scoring.
 */
export const CURRICULUM_WEIGHT_BOOST = 1.5;

/**
 * Minimum weight (after optional research-topic boost) for a lesson to be
 * promoted into the active curriculum for policy compilation.
 */
export const CURRICULUM_PROMOTION_THRESHOLD = 0.4;

/**
 * Compute a curriculum-adjusted weight for a lesson.
 *
 * If the lesson text overlaps with one of the provided research topic names
 * (case-insensitive substring match), the base weight is multiplied by
 * CURRICULUM_WEIGHT_BOOST, capped at 1.0.
 *
 * @param {string}   lessonText    — the lesson text
 * @param {number}   baseWeight    — weight from computeLessonWeight()
 * @param {string[]} researchTopics — active research topic names
 * @param {{ boost?: number }} opts
 * @returns {number} adjusted weight in [0, 1]
 */
export function computeCurriculumWeight(
  lessonText: string,
  baseWeight: number,
  researchTopics: string[],
  opts: { boost?: number } = {},
): number {
  if (!lessonText || typeof baseWeight !== "number") return baseWeight ?? 0;
  const boost = typeof opts.boost === "number" && opts.boost > 0 ? opts.boost : CURRICULUM_WEIGHT_BOOST;
  if (!Array.isArray(researchTopics) || researchTopics.length === 0) return baseWeight;

  const lessonLower = String(lessonText).toLowerCase();
  const isResearchBacked = researchTopics.some(topic => {
    const topicLower = String(topic || "").toLowerCase().trim();
    if (!topicLower) return false;
    return lessonLower.includes(topicLower) || topicLower.includes(lessonLower.slice(0, 40));
  });

  return isResearchBacked ? Math.min(1.0, baseWeight * boost) : baseWeight;
}

/**
 * Select lessons that have graduated to the active curriculum.
 *
 * A lesson is promoted when its curriculum-adjusted weight (base × optional
 * research-topic boost) meets or exceeds CURRICULUM_PROMOTION_THRESHOLD.
 * Returned items are sorted by weight descending and capped at `opts.limit`.
 *
 * @param {object[]} postmortems    — postmortem entries with lessonLearned and reviewedAt
 * @param {string[]} researchTopics — active research topic names for weight boost
 * @param {{ halfLifeDays?: number, now?: number, limit?: number, threshold?: number }} opts
 * @returns {{ lesson: string, weight: number, reviewedAt: string, researchBacked: boolean }[]}
 */
export function selectCurriculumItems(
  postmortems: any[],
  researchTopics: string[],
  opts: { halfLifeDays?: number; now?: number; limit?: number; threshold?: number } = {},
): Array<{ lesson: string; weight: number; reviewedAt: string; researchBacked: boolean }> {
  if (!Array.isArray(postmortems)) return [];

  const limit = opts.limit || 10;
  const threshold = typeof opts.threshold === "number" ? opts.threshold : CURRICULUM_PROMOTION_THRESHOLD;
  const items: Array<{ lesson: string; weight: number; reviewedAt: string; researchBacked: boolean }> = [];

  for (const pm of postmortems) {
    const lesson = pm?.lessonLearned;
    if (!lesson || String(lesson).trim().length < 5) continue;

    const baseWeight = computeLessonWeight(pm.reviewedAt, opts);
    const currWeight = computeCurriculumWeight(String(lesson), baseWeight, researchTopics || [], {});
    if (currWeight < threshold) continue;

    items.push({
      lesson: String(lesson).trim(),
      weight: Math.round(currWeight * 1000) / 1000,
      reviewedAt: pm.reviewedAt || "",
      researchBacked: currWeight > baseWeight,
    });
  }

  items.sort((a, b) => b.weight - a.weight);
  return items.slice(0, limit);
}
