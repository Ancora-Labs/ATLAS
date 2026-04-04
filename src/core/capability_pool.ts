/**
 * capability_pool.js — Capability-based worker pool abstraction.
 *
 * Instead of routing all work to a single `evolution-worker`, this module
 * maps task requirements to worker capabilities and selects the best-fit worker.
 *
 * Capability tags are defined in verification_profiles.js (LANES) and can be
 * extended via box.config.json.
 *
 * Integration: called by orchestrator before worker dispatch to select the
 * optimal worker for each plan.
 */

import { LANE_WORKER_NAMES, WORKER_CAPABILITIES, getLaneForWorkerName } from "./role_registry.js";

/**
 * Per-lane outcome accumulator.  Populated by callers (e.g. orchestrator or
 * evolution_executor) after each worker completes.  All fields are non-negative
 * integers / floats so arithmetic scoring never throws.
 */
export interface LaneOutcome {
  successes: number;
  failures:  number;
  totalMs:   number;
  lastUpdated: string; // ISO-8601
}

export type LanePerformanceLedger = Record<string, LaneOutcome>;

export interface LaneTelemetrySignal {
  completionRate: number;
  roi: number;
}

export type LaneTelemetrySignalMap = Record<string, LaneTelemetrySignal>;

/**
 * Record a single worker outcome for a lane.
 * Returns a **new** ledger object — the input is never mutated.
 *
 * @param ledger — current ledger (may be empty `{}`)
 * @param lane   — lane name (e.g. "quality", "implementation")
 * @param outcome — { success, durationMs? }
 */
export function recordLaneOutcome(
  ledger: LanePerformanceLedger,
  lane: string,
  outcome: { success: boolean; durationMs?: number }
): LanePerformanceLedger {
  const existing: LaneOutcome = ledger[lane] ?? { successes: 0, failures: 0, totalMs: 0, lastUpdated: "" };
  return {
    ...ledger,
    [lane]: {
      successes:   existing.successes + (outcome.success ? 1 : 0),
      failures:    existing.failures  + (outcome.success ? 0 : 1),
      totalMs:     existing.totalMs   + Math.max(0, outcome.durationMs ?? 0),
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Compute a 0–1 performance score for a lane.
 *
 * Formula: Laplace-smoothed success rate = (successes + 1) / (total + 2).
 * This means an unseen lane scores 0.5, a perfect lane scores close to 1,
 * and a consistently failing lane scores close to 0.
 *
 * The score is intentionally smooth so it acts as a soft nudge, not a hard
 * override — diversity controls remain authoritative over lane selection.
 *
 * @param ledger — accumulated lane outcomes
 * @param lane   — lane name to score
 * @returns      — value in [0, 1]
 */
export function getLaneScore(ledger: LanePerformanceLedger, lane: string): number {
  if (!ledger || !lane) return 0.5;
  const entry = ledger[lane];
  if (!entry) return 0.5; // no data → neutral score
  const total = entry.successes + entry.failures;
  if (total === 0) return 0.5;
  return (entry.successes + 1) / (total + 2);
}

/**
 * Default worker capabilities mapping.
 * Maps capability tags to preferred worker roles.
 */
const DEFAULT_CAPABILITY_MAP = Object.freeze({
  "planner-improvement":  { lane: "quality",         fallback: "evolution-worker" },
  "runtime-refactor":     { lane: "implementation",  fallback: "evolution-worker" },
  "test-infra":           { lane: "quality",         fallback: "evolution-worker" },
  "state-governance":     { lane: "governance",      fallback: "evolution-worker" },
  "integration":          { lane: "integration",     fallback: "evolution-worker" },
  "infrastructure":       { lane: "infrastructure",  fallback: "evolution-worker" },
  "observation":          { lane: "observation",     fallback: "evolution-worker" },
});

export const DEFAULT_SPECIALIZATION_TARGETS = Object.freeze({
  minSpecializedShare: 0.35,
});

export function computeAdaptiveSpecializedShareTarget(
  baseShare: number,
  lanePerformance?: LanePerformanceLedger,
): number {
  const safeBase = Number.isFinite(baseShare) ? Math.max(0, Math.min(1, baseShare)) : DEFAULT_SPECIALIZATION_TARGETS.minSpecializedShare;
  const entries = Object.values(lanePerformance || {});
  if (entries.length === 0) return safeBase;
  const avgScore = entries.reduce((sum, entry) => {
    const total = Number(entry?.successes || 0) + Number(entry?.failures || 0);
    if (!Number.isFinite(total) || total <= 0) return sum + 0.5;
    return sum + ((Number(entry?.successes || 0) + 1) / (total + 2));
  }, 0) / entries.length;
  return Math.round(Math.max(0.15, Math.min(0.9, safeBase + ((avgScore - 0.5) * 0.2))) * 1000) / 1000;
}

/**
 * @typedef {object} WorkerSelection
 * @property {string} role — selected worker role name
 * @property {string} lane — capability lane
 * @property {string} reason — why this worker was selected
 * @property {boolean} isFallback — true if using fallback worker
 * @property {number} performanceScore — Laplace-smoothed success rate (0–1); 0.5 when no data
 */
export interface WorkerSelection {
  role: string;
  lane: string;
  reason: string;
  isFallback: boolean;
  performanceScore: number;
}

/**
 * Infer capability tag from plan content.
 *
 * @param {object} plan — plan object with task, taskKind, role fields
 * @returns {string} capability tag
 */
export function inferCapabilityTag(plan) {
  if (!plan) return "runtime-refactor";

  const task = String(plan.task || "").toLowerCase();
  const kind = String(plan.taskKind || plan.kind || "").toLowerCase();
  const role = String(plan.role || "").toLowerCase();

  // Direct role match
  if (role.includes("governance") || role.includes("policy")) return "state-governance";
  if (role.includes("test") || role.includes("quality")) return "test-infra";
  if (role.includes("planner") || role.includes("prometheus")) return "planner-improvement";
  if (role.includes("infra") || role.includes("docker") || role.includes("ci")) return "infrastructure";
  if (role.includes("integration") || role.includes("wiring")) return "integration";
  if (role.includes("observ") || role.includes("monitor") || role.includes("dashboard")) return "observation";

  // Task content heuristics
  if (/test|spec|assert|coverage/.test(task)) return "test-infra";
  if (/governance|policy|freeze|canary/.test(task)) return "state-governance";
  if (/prometheus|plan|hypothesis|strategy/.test(task)) return "planner-improvement";
  if (/docker|ci|deploy|infra/.test(task)) return "infrastructure";
  if (/dashboard|metric|monitor|alert/.test(task)) return "observation";
  if (/wire|connect|integrate|import/.test(task)) return "integration";

  // Kind-based fallback
  if (kind === "governance") return "state-governance";
  if (kind === "test") return "test-infra";

  return "runtime-refactor";
}

/**
 * Select the best worker for a plan based on capability matching.
 *
 * When `lanePerformance` is provided, the returned `performanceScore` reflects
 * the lane's historical success rate.  If the primary lane has a score below
 * `LOW_PERFORMANCE_THRESHOLD` the selection falls back to the evolution-worker
 * while preserving the original lane label for diversity accounting.
 *
 * Diversity controls (`enforceLaneDiversity`, `diversityIndex`) are not
 * affected — they operate on the final assignment set after all selections.
 *
 * @param {object} plan — plan object
 * @param {object} [config] — BOX config for custom mappings
 * @param {LanePerformanceLedger} [lanePerformance] — optional historical lane outcomes
 * @returns {WorkerSelection}
 */
export function selectWorkerForPlan(plan, config?, lanePerformance?: LanePerformanceLedger) {
  const capTag = inferCapabilityTag(plan);
  const customMap = config?.workerPool?.capabilityMap;
  const mapping = customMap?.[capTag] || DEFAULT_CAPABILITY_MAP[capTag] || { lane: "implementation", fallback: "evolution-worker" };

  const score = getLaneScore(lanePerformance ?? {}, mapping.lane);

  // Resolve to the canonical lane worker name; fall back to configured fallback if lane is unknown.
  // When performance data indicates a consistently degraded lane (score < 0.25), route to the
  // fallback worker instead so throughput is not stuck behind a broken specialised lane.
  // The lane label is preserved in the selection so diversity accounting still counts it.
  const LOW_PERFORMANCE_THRESHOLD = 0.25;
  const laneWorkerName = LANE_WORKER_NAMES[mapping.lane] || mapping.fallback;
  const performanceDegraded = score < LOW_PERFORMANCE_THRESHOLD;
  const selectedRole = performanceDegraded ? mapping.fallback : laneWorkerName;
  const isFallback = !LANE_WORKER_NAMES[mapping.lane] || performanceDegraded;

  return {
    role: selectedRole,
    lane: mapping.lane,
    reason: performanceDegraded
      ? `Capability "${capTag}" → lane "${mapping.lane}" → performance score ${score.toFixed(2)} below threshold; falling back to "${selectedRole}"`
      : `Capability "${capTag}" → lane "${mapping.lane}" → worker "${selectedRole}"`,
    isFallback,
    performanceScore: score,
  };
}

/**
 * Options for {@link assignWorkersToPlans}.
 *
 * @property diversityThreshold — minimum number of distinct lanes required in the
 *   result.  When the computed `activeLaneCount` is below this value, `diversityCheck`
 *   in the return value will have `meetsMinimum: false`.  Defaults to 2.
 *   Set to 0 or 1 to disable the threshold check entirely.
 */
export interface AssignWorkersOptions {
  diversityThreshold?: number;
}

/**
 * Assign workers to all plans using capability matching.
 *
 * @param {object[]} plans — array of plan objects
 * @param {object} [config]
 * @param {LanePerformanceLedger} [lanePerformance] — optional historical lane outcomes
 * @param {AssignWorkersOptions} [opts] — optional diversity enforcement options
 * @returns {{ assignments: Array<{ plan: object, selection: WorkerSelection }>, diversityIndex: number, diversityCheck: object }}
 */
export function assignWorkersToPlans(
  plans,
  config?,
  lanePerformance?: LanePerformanceLedger,
  opts: AssignWorkersOptions = {}
) {
  if (!Array.isArray(plans)) {
    return {
      assignments: [],
      diversityIndex: 0,
      diversityCheck: { meetsMinimum: true, activeLaneCount: 0, warning: "" },
      specializationUtilization: {
        specializedCount: 0,
        total: 0,
        specializedShare: 0,
        minSpecializedShare: DEFAULT_SPECIALIZATION_TARGETS.minSpecializedShare,
        specializationTargetsMet: true,
      },
    };
  }

  const assignments = plans.map(plan => ({
    plan,
    selection: selectWorkerForPlan(plan, config, lanePerformance)
  }));

  // Compute diversity index: 1 - (maxWorkerShare)
  // Lower share of a single worker = higher diversity
  const roleCounts = new Map();
  const laneCounts = new Map();
  for (const a of assignments) {
    const role = a.selection.role;
    const lane = a.selection.lane;
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    laneCounts.set(lane, (laneCounts.get(lane) || 0) + 1);
  }
  const maxShare = assignments.length > 0
    ? Math.max(...roleCounts.values()) / assignments.length
    : 1;
  const diversityIndex = Math.round((1 - maxShare) * 100) / 100;
  const activeLaneCount = laneCounts.size;
  const specializedCount = assignments.filter(a => String(a.selection?.role || "") !== "Evolution Worker").length;
  const specializedShare = assignments.length > 0
    ? Math.round((specializedCount / assignments.length) * 1000) / 1000
    : 0;
  const configuredMinSpecializedShare = Number(config?.workerPool?.specializationTargets?.minSpecializedShare ?? DEFAULT_SPECIALIZATION_TARGETS.minSpecializedShare);
  const adaptiveMinSpecializedShare = computeAdaptiveSpecializedShareTarget(configuredMinSpecializedShare, lanePerformance);
  const specializationTargetsMet = assignments.length === 0 ? true : specializedShare >= adaptiveMinSpecializedShare;

  const pool = { assignments, diversityIndex, activeLaneCount, laneCounts: Object.fromEntries(laneCounts) };

  // Enforce diversity threshold: default 2 lanes minimum.
  // Returns meetsMinimum=false with a warning when the threshold is not met so
  // callers (orchestrator, buildRoleExecutionBatches) can gate or log accordingly.
  const minLanes = opts.diversityThreshold ?? 2;
  const diversityCheck = enforceLaneDiversity(pool, { minLanes });

  return {
    ...pool,
    diversityCheck,
    specializationUtilization: {
      specializedCount,
      total: assignments.length,
      specializedShare,
      minSpecializedShare: configuredMinSpecializedShare,
      adaptiveMinSpecializedShare,
      specializationTargetsMet,
    },
  };
}

/**
 * Enforce minimum lane diversity for high-leverage cycles (Packet 6).
 * Returns adjusted assignments that ensure at least minLanes distinct lanes.
 *
 * @param {{ assignments: Array, diversityIndex: number, activeLaneCount: number }} pool
 * @param {{ minLanes?: number }} opts
 * @returns {{ meetsMinimum: boolean, activeLaneCount: number, warning: string }}
 */
export function enforceLaneDiversity(pool, opts: any = {}) {
  const minLanes = opts.minLanes != null ? opts.minLanes : 2;
  const laneCount = pool.activeLaneCount || 0;
  if (laneCount >= minLanes) {
    return { meetsMinimum: true, activeLaneCount: laneCount, warning: "" };
  }
  return {
    meetsMinimum: false,
    activeLaneCount: laneCount,
    warning: `Only ${laneCount} lane(s) active, minimum is ${minLanes}. Worker topology may be monocultural.`,
  };
}

/**
 * Worker dispatch distribution metrics (Packet 12).
 * Tracks how work is distributed across workers and lanes over time.
 *
 * @param {{ assignments: Array<{ plan: object, selection: WorkerSelection }> }} pool
 * @returns {{ roleDistribution: Record<string, number>, laneDistribution: Record<string, number>, concentrationRatio: number, diversityScore: number }}
 */
export function computeDispatchMetrics(pool) {
  if (!pool || !Array.isArray(pool.assignments) || pool.assignments.length === 0) {
    return { roleDistribution: {}, laneDistribution: {}, concentrationRatio: 1, diversityScore: 0 };
  }

  const roleDistribution: Record<string, any> = {};
  const laneDistribution: Record<string, any> = {};

  for (const a of pool.assignments) {
    const role = a.selection?.role || "unknown";
    const lane = a.selection?.lane || "unknown";
    roleDistribution[role] = (roleDistribution[role] || 0) + 1;
    laneDistribution[lane] = (laneDistribution[lane] || 0) + 1;
  }

  const total = pool.assignments.length;
  const maxRoleCount = Math.max(...Object.values(roleDistribution));
  const concentrationRatio = Math.round((maxRoleCount / total) * 100) / 100;
  const uniqueRoles = Object.keys(roleDistribution).length;
  const diversityScore = Math.round((1 - concentrationRatio + (uniqueRoles / Math.max(total, 1))) / 2 * 100) / 100;

  return { roleDistribution, laneDistribution, concentrationRatio, diversityScore };
}

/**
 * Multi-worker chain topology for high-complexity tasks (Packet 13).
 *
 * Decomposes a high-complexity task into a sequential chain:
 *   architect → implementation → verification → (optional) learning
 *
 * Each stage produces a handoff artifact consumed by the next stage.
 *
 * @param {object} plan — the plan to decompose
 * @param {{ complexity?: string }} hints
 * @returns {{ isChained: boolean, chain: Array<{ stage: string, lane: string, task: string }> }}
 */
export function buildWorkerChain(plan, hints: any = {}) {
  const complexity = String(hints.complexity || plan.complexity || "").toLowerCase();
  const isHighComplexity = ["critical", "massive", "high"].includes(complexity);

  if (!isHighComplexity) {
    return { isChained: false, chain: [] };
  }

  const task = String(plan.task || "");

  return {
    isChained: true,
    chain: [
      {
        stage: "architect",
        lane: "quality",
        task: `[ARCHITECT] Decompose and plan implementation approach for: ${task}. Output a step-by-step implementation plan with file paths and acceptance criteria.`,
      },
      {
        stage: "implementation",
        lane: "implementation",
        task: `[IMPLEMENT] Execute the architect's plan for: ${task}. Follow the decomposed steps exactly. Output BOX_STATUS and VERIFICATION_REPORT.`,
      },
      {
        stage: "verification",
        lane: "quality",
        task: `[VERIFY] Validate the implementation of: ${task}. Run npm test, check edge cases, confirm acceptance criteria are met. Output pass/fail per criterion.`,
      },
    ],
  };
}

/**
 * Conflict descriptor for a pair of plans within the same lane that share target files.
 *
 * @typedef {object} LaneConflict
 * @property {string} lane — the shared capability lane
 * @property {string} plan1Task — task string of the first plan
 * @property {string} plan2Task — task string of the second plan
 * @property {string[]} sharedFiles — target files that both plans reference
 */

/**
 * Detect intra-lane conflicts: pairs of plans in the same capability lane
 * that reference at least one overlapping target file.
 *
 * Concurrent workers in the same lane touching the same files risk write
 * conflicts and merge failures. Callers should ensure such plans are placed
 * in separate waves or batches.
 *
 * @param {Array<{ plan: object, selection: WorkerSelection }>} assignments
 * @returns {Array<LaneConflict>}
 */
export function detectLaneConflicts(assignments) {
  if (!Array.isArray(assignments) || assignments.length < 2) return [];

  // Group plan indices by lane
  const laneMap = new Map();
  for (let i = 0; i < assignments.length; i++) {
    const lane = assignments[i]?.selection?.lane || "unknown";
    if (!laneMap.has(lane)) laneMap.set(lane, []);
    laneMap.get(lane).push(i);
  }

  const conflicts = [];

  for (const [lane, indices] of laneMap.entries()) {
    if (indices.length < 2) continue;

    // For each pair in this lane, check for file overlap
    for (let a = 0; a < indices.length - 1; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const planA = assignments[indices[a]]?.plan;
        const planB = assignments[indices[b]]?.plan;

        const filesA = new Set(
          Array.isArray(planA?.target_files) ? planA.target_files.map(String) :
          (Array.isArray(planA?.targetFiles) ? planA.targetFiles.map(String) : [])
        );
        if (filesA.size === 0) continue;

        const sharedFiles = (
          Array.isArray(planB?.target_files) ? planB.target_files.map(String) :
          (Array.isArray(planB?.targetFiles) ? planB.targetFiles.map(String) : [])
        ).filter(f => filesA.has(f));

        if (sharedFiles.length > 0) {
          conflicts.push({
            lane,
            plan1Task: String(planA?.task || "").slice(0, 80),
            plan2Task: String(planB?.task || "").slice(0, 80),
            sharedFiles,
          });
        }
      }
    }
  }

  return conflicts;
}

// ── Worker-task fit scoring ────────────────────────────────────────────────────

/**
 * Score a worker's fitness for a given plan on a 0–1 scale.
 *
 * Scoring components:
 *   1. Capability match (50%): 1.0 if the inferred capability tag is in the
 *      worker's declared capability list, 0 otherwise.
 *   2. Lane performance (40%): Laplace-smoothed historical success rate for
 *      the worker's primary lane (from the supplied ledger).
 *   3. Specialist bonus (10%): awarded when the worker declares exactly one
 *      capability AND that capability matches the plan's tag.
 *
 * Ties are broken deterministically by worker name (lexicographic ascending)
 * in the caller (selectWorkerByFitScore).
 *
 * @param workerName  — worker name (e.g. "quality-worker")
 * @param plan        — plan object passed to inferCapabilityTag
 * @param ledger      — optional historical lane outcomes for performance component
 * @returns score in [0, 1]
 */
export function scoreWorkerTaskFit(
  workerName: string,
  plan: object,
  ledger?: LanePerformanceLedger
): number {
  const capTag = inferCapabilityTag(plan);
  const workerCaps: readonly string[] = (WORKER_CAPABILITIES as Record<string, readonly string[]>)[workerName] ?? [];

  // Find the primary lane for this worker
  const workerLane = Object.entries(LANE_WORKER_NAMES).find(([, name]) => name === workerName)?.[0] ?? "";

  const capMatch = workerCaps.includes(capTag) ? 1.0 : 0.0;
  const laneScore = getLaneScore(ledger ?? {}, workerLane);
  const specialistBonus = workerCaps.length === 1 && capMatch > 0 ? 0.1 : 0;

  const raw = (capMatch * 0.5) + (laneScore * 0.4) + specialistBonus;
  return Math.min(1.0, Math.round(raw * 1000) / 1000);
}

/**
 * Select the best-fit worker for a plan using explicit fit scores.
 *
 * All registered workers (from LANE_WORKER_NAMES) are scored against the plan.
 * The highest-scoring worker is returned.  When two workers tie, the one that
 * sorts first alphabetically by name is chosen — guaranteeing deterministic
 * output for identical inputs.
 *
 * Falls back to "Evolution Worker" when no workers are registered.
 *
 * @param plan    — plan object to match against worker capabilities
 * @param config  — BOX config (unused currently; reserved for future custom registrations)
 * @param ledger  — optional historical lane outcomes for performance-aware scoring
 * @returns WorkerSelection extended with a `fitScore` field
 */
export function selectWorkerByFitScore(
  plan: object,
  config?: object,
  ledger?: LanePerformanceLedger
): WorkerSelection & { fitScore: number } {
  const workerNames = Object.values(LANE_WORKER_NAMES) as string[];

  const scored = workerNames
    .map(name => ({ name, score: scoreWorkerTaskFit(name, plan, ledger) }))
    // Higher score first; alphabetical name as deterministic tie-breaker
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const best = scored[0] ?? { name: "Evolution Worker", score: 0 };
  const lane = getLaneForWorkerName(best.name, "implementation");
  const capTag = inferCapabilityTag(plan);

  return {
    role: best.name,
    lane,
    reason: `fit-score: "${best.name}" scored ${best.score.toFixed(3)} for capability "${capTag}" (deterministic)`,
    isFallback: best.score === 0,
    performanceScore: getLaneScore(ledger ?? {}, lane),
    fitScore: best.score,
  };
}

export function buildLanePerformanceFromCycleTelemetry(telemetry: unknown): LanePerformanceLedger {
  if (!telemetry || typeof telemetry !== "object") return {};
  const lanePerformance: LanePerformanceLedger = {};
  for (const [lane, raw] of Object.entries(telemetry as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const successes = Number(entry.completed);
    const failures = Number(entry.failed);
    if (!Number.isFinite(successes) || !Number.isFinite(failures)) continue;
    lanePerformance[lane] = {
      successes: Math.max(0, Math.floor(successes)),
      failures: Math.max(0, Math.floor(failures)),
      totalMs: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
  return lanePerformance;
}

export function buildLaneTelemetrySignals(telemetry: unknown): LaneTelemetrySignalMap {
  if (!telemetry || typeof telemetry !== "object") return {};
  const signals: LaneTelemetrySignalMap = {};
  for (const [lane, raw] of Object.entries(telemetry as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.completionRate !== "number" || !Number.isFinite(entry.completionRate)) continue;
    if (typeof entry.roi !== "number" || !Number.isFinite(entry.roi)) continue;
    const completionRateRaw = entry.completionRate;
    const roiRaw = entry.roi;
    const completionRate = Math.max(0, Math.min(1, Math.round(completionRateRaw * 1000) / 1000));
    const roi = Math.max(0, Math.round(roiRaw * 1000) / 1000);
    signals[lane] = { completionRate, roi };
  }
  return signals;
}

/**
 * Convert a completion-yield ROI value to a Laplace-compatible lane performance
 * score in [0, 1].
 *
 * This lets callers translate tier-level ROI data (from computeRecentROIForTier)
 * into a score that can be used directly in `scoreWorkerTaskFit` performance
 * comparisons without requiring accumulated lane outcome counts.
 *
 * Mapping:
 *   roi <= 0   → 0.5  (no history, or invalid — matches getLaneScore default for unseen lanes)
 *   roi in (0, 2] → roi / 2  (linear scale; ROI=1 → 0.5, ROI=2 → 1.0)
 *   roi > 2    → 1.0  (capped at excellent)
 *
 * @param roi — completion-yield ROI (0-∞); 0 means no realized history
 * @returns score in [0, 1]
 */
export function roiToLaneScore(roi: number): number {
  if (!Number.isFinite(roi) || roi <= 0) return 0.5;
  return Math.min(1.0, Math.round((roi / 2) * 1000) / 1000);
}

export function computeSpecialistFitThreshold(
  baseThreshold: number,
  lane: string,
  telemetrySignals?: LaneTelemetrySignalMap
): number {
  const safeBase = Number.isFinite(baseThreshold) ? Math.max(0, Math.min(1, baseThreshold)) : 0.65;
  if (!lane || !telemetrySignals || !telemetrySignals[lane]) return safeBase;

  const signal = telemetrySignals[lane];
  const roiScore = roiToLaneScore(signal.roi);
  const completionScore = Math.max(0, Math.min(1, signal.completionRate));
  const blendedSignal = (roiScore * 0.6) + (completionScore * 0.4);

  // Higher historical signal lowers the threshold to encourage specialist reuse.
  const adjustment = (blendedSignal - 0.5) * 0.2;
  const adjusted = safeBase - adjustment;
  return Math.round(Math.max(0, Math.min(1, adjusted)) * 1000) / 1000;
}
