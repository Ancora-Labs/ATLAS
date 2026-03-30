import { getRoleRegistry } from "./role_registry.js";
import { enforceModelPolicy } from "./model_policy.js";
import { resolveDependencyGraph, GRAPH_STATUS } from "./dependency_graph_resolver.js";
import { enforceLaneDiversity, selectWorkerByFitScore, LanePerformanceLedger } from "./capability_pool.js";

const CHARS_PER_TOKEN = 4;
const DEFAULT_CONTEXT_WINDOW_TOKENS = 100000;
const DEFAULT_CONTEXT_RESERVE_TOKENS = 12000;

/**
 * Maximum number of plans per batch when any plan in the batch carries explicit
 * dependency declarations (dependsOn / dependencies fields).  Dependency-linked
 * plans must be kept small so a worker can reason about the full dependency chain
 * without hitting context limits or missing inter-plan ordering constraints.
 *
 * Configurable via config.runtime.maxPlansPerDependencyBatch (default: 6).
 */
export const MAX_PLANS_PER_DEPENDENCY_BATCH = 6;
const SPLIT_CONFLICTING_PLANS_DEFAULT = false;
const KNOWN_MODEL_CONTEXT_WINDOWS = [
  { pattern: /gpt\s*[- ]?5\.[123]\s*[- ]?codex/i, tokens: 400000 },
  { pattern: /claude\s+sonnet\s+4\.6/i, tokens: 160000 },
  { pattern: /claude\s+sonnet/i, tokens: 160000 },
];

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeDependencyBatchLimit(value, fallback = MAX_PLANS_PER_DEPENDENCY_BATCH) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

function shouldSplitConflictingPlansAcrossBatches(config: any): boolean {
  const configured = (config as any)?.planner?.splitConflictingPlansAcrossBatches;
  if (configured === undefined || configured === null) return SPLIT_CONFLICTING_PLANS_DEFAULT;
  return configured === true;
}

function hasExplicitDependencies(plan) {
  return (
    (Array.isArray(plan?.dependsOn) && plan.dependsOn.length > 0)
    || (Array.isArray(plan?.dependencies) && plan.dependencies.length > 0)
  );
}

function slugify(text) {
  return String(text || "worker")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "worker";
}

function aggregateTaskHints(plans = []) {
  const complexities = plans.map((plan) => String(plan?.riskLevel || plan?.complexity || "").toLowerCase());
  const hasCritical = complexities.some((value) => value === "critical");
  const hasHigh = complexities.some((value) => value === "high");

  return {
    estimatedLines: Math.ceil(estimateBatchTokens(plans) * 2.5),
    estimatedDurationMinutes: Math.max(20, plans.length * 20),
    complexity: hasCritical ? "critical" : hasHigh ? "high" : "medium"
  };
}

function getRegisteredWorkerModel(config, roleName) {
  const registry = getRoleRegistry(config);
  const workers = registry?.workers || {};
  for (const worker of Object.values(workers) as Array<{ name?: string; model?: string }>) {
    if (worker?.name === roleName && worker?.model) return worker.model;
  }
  return null;
}

function collectCandidateModels(config, roleName, taskKind, taskHints) {
  const requestedModels = [
    ...(Array.isArray(config?.copilot?.preferredModelsByTaskKind?.[taskKind])
      ? config.copilot.preferredModelsByTaskKind[taskKind]
      : []),
    ...(Array.isArray(config?.copilot?.preferredModelsByRole?.[roleName])
      ? config.copilot.preferredModelsByRole[roleName]
      : []),
    getRegisteredWorkerModel(config, roleName),
    config?.copilot?.defaultModel || "Claude Sonnet 4.6"
  ].filter(Boolean);

  const fallbackModel = config?.copilot?.defaultModel || "Claude Sonnet 4.6";
  const seen = new Set();
  const resolved = [];

  for (const requestedModel of requestedModels) {
    const policy = enforceModelPolicy(requestedModel, taskHints, fallbackModel);
    const model = String(policy.model || fallbackModel).trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    resolved.push(model);
  }

  if (resolved.length === 0) resolved.push(fallbackModel);
  return resolved;
}

function resolveConfiguredContextWindow(config, modelName) {
  const configured = config?.copilot?.modelContextWindows;
  if (!configured || typeof configured !== "object") return null;

  if (configured[modelName] != null) {
    return normalizePositiveNumber(configured[modelName], null);
  }

  const target = String(modelName || "").toLowerCase();
  for (const [name, value] of Object.entries(configured)) {
    if (String(name).toLowerCase() === target) {
      return normalizePositiveNumber(value, null);
    }
  }

  return null;
}

export function getModelContextWindowTokens(config, modelName) {
  const configured = resolveConfiguredContextWindow(config, modelName);
  if (configured) return configured;

  const model = String(modelName || "");
  for (const entry of KNOWN_MODEL_CONTEXT_WINDOWS) {
    if (entry.pattern.test(model)) return entry.tokens;
  }

  return normalizePositiveNumber(config?.runtime?.workerContextTokenLimit, DEFAULT_CONTEXT_WINDOW_TOKENS);
}

export function getUsableModelContextTokens(config, modelName) {
  const windowTokens = getModelContextWindowTokens(config, modelName);
  const reserveTokens = normalizeNonNegativeNumber(
    config?.copilot?.modelContextReserveTokens,
    DEFAULT_CONTEXT_RESERVE_TOKENS
  );
  return Math.max(1, windowTokens - reserveTokens);
}

export function estimatePlanTokens(plan) {
  const payload = [
    plan?.task,
    plan?.context,
    plan?.scope,
    plan?.verification,
    plan?.before_state,
    plan?.after_state,
    plan?.beforeState,
    plan?.afterState,
    plan?.description,
    plan?.premortem ? JSON.stringify(plan.premortem) : "",
    Array.isArray(plan?.target_files) ? plan.target_files.join("\n") : "",
    Array.isArray(plan?.acceptance_criteria) ? plan.acceptance_criteria.join("\n") : "",
    JSON.stringify(Array.isArray(plan?.dependencies) ? plan.dependencies : []),
  ].filter(Boolean).join("\n");

  // Base: payload text / 4 chars per token + per-plan overhead (prompt framing, formatting)
  const payloadTokens = Math.ceil(payload.length / CHARS_PER_TOKEN);
  // Estimate worker reasoning overhead: more complex tasks need more reasoning tokens
  const fileCount = Array.isArray(plan?.target_files) ? plan.target_files.length : 0;
  const riskMultiplier = String(plan?.riskLevel || "").toLowerCase() === "high" ? 1.5
    : String(plan?.riskLevel || "").toLowerCase() === "medium" ? 1.2
    : 1.0;
  const baseOverhead = 300;
  const fileReadOverhead = fileCount * 150; // estimated tokens per file the worker will read
  const reasoningOverhead = Math.ceil(payloadTokens * 0.3 * riskMultiplier); // model reasoning space

  return Math.max(1, payloadTokens + baseOverhead + fileReadOverhead + reasoningOverhead);
}

/**
 * Estimate the total token budget a plan will consume during worker execution,
 * including prompt framing, file reads, and model reasoning. Used by the batch
 * planner to pack tasks into model context windows.
 */
export function estimatePlanExecutionTokens(plan) {
  return estimatePlanTokens(plan);
}

export function estimateBatchTokens(plans = []) {
  return plans.reduce((sum, plan) => sum + estimatePlanTokens(plan), 0);
}

export function packPlansIntoContextBatches(plans = [], usableTokens) {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  const maxTokens = Math.max(1, normalizePositiveNumber(usableTokens, 1));
  const batches = [];
  let currentPlans = [];
  let currentTokens = 0;

  for (const plan of plans) {
    const planTokens = estimatePlanTokens(plan);
    const shouldSplit = currentPlans.length > 0 && currentTokens + planTokens > maxTokens;

    if (shouldSplit) {
      batches.push({ plans: currentPlans, estimatedTokens: currentTokens });
      currentPlans = [plan];
      currentTokens = planTokens;
      continue;
    }

    currentPlans.push(plan);
    currentTokens += planTokens;
  }

  if (currentPlans.length > 0) {
    batches.push({ plans: currentPlans, estimatedTokens: currentTokens });
  }

  return batches;
}

function chooseModelForRolePlans(config, roleName, plans, taskKind) {
  const taskHints = aggregateTaskHints(plans);
  const candidates = collectCandidateModels(config, roleName, taskKind, taskHints);
  let best = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const model = candidates[index];
    const contextWindowTokens = getModelContextWindowTokens(config, model);
    const usableContextTokens = getUsableModelContextTokens(config, model);
    const batches = packPlansIntoContextBatches(plans, usableContextTokens);

    const score = {
      batchCount: batches.length,
      preferenceIndex: index,
      contextWindowTokens,
    };

    if (!best
      || score.batchCount < best.score.batchCount
      || (score.batchCount === best.score.batchCount && score.preferenceIndex < best.score.preferenceIndex)
      || (score.batchCount === best.score.batchCount
        && score.preferenceIndex === best.score.preferenceIndex
        && score.contextWindowTokens > best.score.contextWindowTokens)) {
      best = {
        model,
        contextWindowTokens,
        usableContextTokens,
        batches,
        score,
      };
    }
  }

  return best;
}

function buildSharedBranchName(roleName, plans) {
  const roleSlug = slugify(roleName);
  const firstTask = slugify(plans?.[0]?.task || plans?.[0]?.title || "batch").slice(0, 24);
  return `box/${roleSlug}-${firstTask || "batch"}`;
}

/**
 * Default maximum number of tasks per micro-wave when splitting large waves.
 * Keeps each dependency layer small so workers can reason without context overload.
 * Configurable via config.planner.maxTasksPerMicrowave.
 */
export const MICROWAVE_MAX_TASKS_DEFAULT = 3;

/**
 * Deterministically split plans into micro-waves of at most maxTasksPerWave tasks
 * per dependency layer, with critical-path ordering within each split wave.
 *
 * Algorithm:
 *  1. Group plans by their wave number.
 *  2. For each wave group larger than maxTasksPerWave, sort by intra-wave critical-path
 *     priority: tasks depended on by other tasks in the same wave are placed first.
 *  3. Slice sorted tasks into chunks of maxTasksPerWave and assign new sequential wave numbers.
 *  4. Waves that already fit within the limit are preserved as-is (only their wave number
 *     is resequenced to remain contiguous after earlier waves are split).
 *
 * @param plans - normalized plan objects (must have .wave and .dependencies fields)
 * @param maxTasksPerWave - max tasks per micro-wave (default MICROWAVE_MAX_TASKS_DEFAULT)
 * @returns new plans array with resequenced wave numbers; original objects are not mutated
 */
export function splitWavesIntoMicrowaves(
  plans: any[],
  maxTasksPerWave: number = MICROWAVE_MAX_TASKS_DEFAULT
): any[] {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  const maxTasks = Math.max(1, Math.floor(maxTasksPerWave));

  // Group plans by their declared wave number
  const waveMap = new Map<number, any[]>();
  for (const plan of plans) {
    const wave = Number.isFinite(Number(plan.wave)) ? Number(plan.wave) : 1;
    if (!waveMap.has(wave)) waveMap.set(wave, []);
    waveMap.get(wave)!.push(plan);
  }

  const sortedWaveKeys = [...waveMap.keys()].sort((a, b) => a - b);
  const result: any[] = [];
  let nextWaveNum = 1;

  for (const waveKey of sortedWaveKeys) {
    const wavePlans = waveMap.get(waveKey)!;

    // Compute intra-wave dependent count for each task (critical-path ordering).
    // Only considers tasks within the same wave — cross-wave dependencies are excluded
    // to prevent inflating scores of tasks whose dependents belong to a later wave.
    const idToDepCount = new Map<string, number>();
    const waveTaskIds = new Set<string>();
    for (const plan of wavePlans) {
      const id = String(plan.task_id || plan.id || plan.task || "");
      if (id) { idToDepCount.set(id, 0); waveTaskIds.add(id); }
    }
    for (const plan of wavePlans) {
      const deps = Array.isArray(plan.dependencies) ? plan.dependencies : [];
      for (const dep of deps) {
        const depStr = String(dep || "");
        // Only count intra-wave dependencies (cross-wave deps do not affect ordering here)
        if (waveTaskIds.has(depStr)) {
          idToDepCount.set(depStr, (idToDepCount.get(depStr) ?? 0) + 1);
        }
      }
    }

    // Sort: tasks with more intra-wave dependents (critical path) go first
    const sorted = [...wavePlans].sort((a: any, b: any) => {
      const idA = String(a.task_id || a.id || a.task || "");
      const idB = String(b.task_id || b.id || b.task || "");
      return (idToDepCount.get(idB) ?? 0) - (idToDepCount.get(idA) ?? 0);
    });

    // Slice into micro-waves of maxTasks, reassigning wave numbers sequentially
    for (let i = 0; i < sorted.length; i += maxTasks) {
      const chunk = sorted.slice(i, i + maxTasks);
      for (const plan of chunk) {
        result.push({ ...plan, wave: nextWaveNum });
      }
      nextWaveNum++;
    }
  }

  return result;
}

export function computeCriticalPathScores(
  tasks: Array<{ id: string; dependsOn: string[] }>
): Map<string, number> {
  // Build reverse adjacency: id → ids of tasks that directly depend on it
  const dependentsOf = new Map<string, string[]>();
  for (const task of tasks) {
    if (!dependentsOf.has(task.id)) dependentsOf.set(task.id, []);
    for (const depId of (task.dependsOn || [])) {
      if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
      dependentsOf.get(depId)!.push(task.id);
    }
  }

  const memo = new Map<string, number>();

  function downstreamDepth(id: string, visiting: Set<string>): number {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard — DAG assumption; should not trigger
    const deps = dependentsOf.get(id) || [];
    if (deps.length === 0) { memo.set(id, 0); return 0; }
    const next = new Set([...visiting, id]);
    const maxChild = deps.reduce((m, d) => Math.max(m, downstreamDepth(d, next)), 0);
    const score = 1 + maxChild;
    memo.set(id, score);
    return score;
  }

  for (const task of tasks) downstreamDepth(task.id, new Set());
  return memo;
}

export function buildRoleExecutionBatches(plans = [], config, capabilityPoolResult = null) {
  // ── Micro-wave splitting ──────────────────────────────────────────────────
  // When config.planner.maxTasksPerMicrowave is set to a positive integer,
  // large waves are split into micro-waves of at most that many tasks.
  // Critical-path tasks within each wave are placed first so the longest tail
  // of dependent work is unblocked as early as possible.
  //
  // This is opt-in: if maxTasksPerMicrowave is absent/falsy, no splitting
  // occurs and the function behaves identically to the previous version
  // (backward-compatible).
  const rawMicrowaveMax = (config as any)?.planner?.maxTasksPerMicrowave;
  const microwaveMax = Number.isFinite(Number(rawMicrowaveMax)) && Number(rawMicrowaveMax) > 0
    ? Math.floor(Number(rawMicrowaveMax))
    : 0; // 0 = disabled
  let inputPlans = microwaveMax > 0
    ? splitWavesIntoMicrowaves(plans as any[], microwaveMax)
    : (plans as any[]);
  const enforceDependencyAwareWaves = (config as any)?.planner?.requireDependencyAwareWaves !== false;
  const splitConflictingPlansAcrossBatches = shouldSplitConflictingPlansAcrossBatches(config);

  if (enforceDependencyAwareWaves) {
    const hasDependenciesDeclared = (inputPlans as any[]).some((plan) => hasExplicitDependencies(plan));
    if (!hasDependenciesDeclared) {
      inputPlans = (inputPlans as any[]).map((plan) => {
        if (plan && typeof plan === "object") {
          const mutable = plan as any;
          const explicitWave = Number(mutable.wave);
          if (!Number.isFinite(explicitWave) || explicitWave <= 0) {
            mutable.wave = 1;
          }
          if (!Array.isArray(mutable.waveDepends)) {
            mutable.waveDepends = [];
          }
          return mutable;
        }

        const explicitWave = Number(plan?.wave);
        const normalizedWave = Number.isFinite(explicitWave) && explicitWave > 0 ? explicitWave : 1;
        const waveDepends = Array.isArray(plan?.waveDepends) ? plan.waveDepends : [];
        return { ...plan, wave: normalizedWave, waveDepends };
      });
    }
  }

  // ── Dependency graph resolution ───────────────────────────────────────────
  // When any plan carries explicit dependency or file-scope hints, resolve the
  // full dependency graph to (a) assign accurate wave numbers and (b) detect
  // file-conflict pairs that lane detection may not cover (e.g. when no
  // capabilityPoolResult is available).
  // Graph resolution is advisory — a failure never blocks scheduling.
  const graphWaveByPlanId = new Map<string, number>();
  const graphConflictList: Array<[string, string]> = [];
  // Critical-path scores computed from the dependency graph.
  // Within the same wave, tasks with higher scores are dispatched first so the
  // longest tail of blocked downstream work is unblocked as early as possible.
  const criticalPathScoreByPlanId = new Map<string, number>();

  const hasGraphHints = (inputPlans as any[]).some(p =>
    (Array.isArray(p.filesInScope)   && p.filesInScope.length   > 0) ||
    (Array.isArray(p.dependsOn)      && p.dependsOn.length      > 0) ||
    (Array.isArray(p.dependencies)   && p.dependencies.length   > 0)
  );

  if (hasGraphHints) {
    try {
      const graphTasks = (inputPlans as any[]).map(p => ({
        id:          String(p.task_id || p.task || p.role || ""),
        dependsOn:   Array.isArray(p.dependsOn)    ? p.dependsOn
                   : Array.isArray(p.dependencies) ? p.dependencies
                   : [],
        filesInScope: Array.isArray(p.filesInScope) ? p.filesInScope : [],
      }));
      const graph = resolveDependencyGraph(graphTasks);
      if (graph.status === GRAPH_STATUS.OK) {
        for (const wave of (graph.waves || [])) {
          for (const id of wave.taskIds) {
            graphWaveByPlanId.set(id, wave.wave);
          }
        }
        for (const cp of (graph.conflictPairs || [])) {
          graphConflictList.push([cp.taskA, cp.taskB]);
        }
      }
      // Compute critical-path scores for within-wave ordering.
      // Runs unconditionally so scores are available even when graph.status
      // is not OK (e.g. cycle detected) — the scores still reflect declared deps.
      const scores = computeCriticalPathScores(graphTasks);
      for (const [id, score] of scores) criticalPathScoreByPlanId.set(id, score);
    } catch {
      // advisory — never block scheduling on graph resolution error
    }
  }

  function resolvePlanWave(plan: any) {
    const explicitWave = Number(plan?.wave);
    if (Number.isFinite(explicitWave) && explicitWave > 0) {
      return explicitWave;
    }

    const planId = String(plan?.task_id || plan?.task || plan?.role || "");
    if (enforceDependencyAwareWaves) {
      const graphWave = graphWaveByPlanId.get(planId);
      if (Number.isFinite(Number(graphWave)) && Number(graphWave) > 0) {
        return Number(graphWave);
      }
    }
    return 1;
  }

  const sortedPlans = [...(inputPlans as any[])].sort((a, b) => {
    const idA   = String(a?.task_id || a?.task || a?.role || "");
    const idB   = String(b?.task_id || b?.task || b?.role || "");
    // Use graph-derived wave when the plan lacks an explicit wave field
    const waveA = resolvePlanWave(a);
    const waveB = resolvePlanWave(b);
    const waveDelta = waveA - waveB;
    if (waveDelta !== 0) return waveDelta;
    // Within the same wave, dispatch critical-path tasks first.
    // Higher critical-path score means more downstream work is blocked on this
    // task — running it earlier maximises throughput across the wave.
    const scoreA = criticalPathScoreByPlanId.get(idA) ?? 0;
    const scoreB = criticalPathScoreByPlanId.get(idB) ?? 0;
    const scoreDelta = scoreB - scoreA; // descending: higher score → earlier dispatch
    if (scoreDelta !== 0) return scoreDelta;
    return Number(a?.priority || 0) - Number(b?.priority || 0);
  });

  // ── Conflict-aware lane separation ────────────────────────────────────────
  // If the capability pool detected intra-lane file conflicts, plans that
  // share target files within the same lane must not be co-batched.
  // Build a conflict adjacency set: "planIndex_a:planIndex_b" → true
  const conflictedPairs = new Set();
  if (splitConflictingPlansAcrossBatches && capabilityPoolResult?.assignments) {
    const assignments = capabilityPoolResult.assignments;
    const laneMap = new Map();
    for (let i = 0; i < assignments.length; i++) {
      const lane = assignments[i]?.selection?.lane || "unknown";
      if (!laneMap.has(lane)) laneMap.set(lane, []);
      laneMap.get(lane).push(i);
    }
    for (const indices of laneMap.values()) {
      for (let a = 0; a < indices.length - 1; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          const planA = assignments[indices[a]]?.plan;
          const planB = assignments[indices[b]]?.plan;
          const filesA = new Set(
            Array.isArray(planA?.target_files) ? planA.target_files.map(String) :
            (Array.isArray(planA?.targetFiles) ? planA.targetFiles.map(String) : [])
          );
          if (filesA.size === 0) continue;
          const hasOverlap = (
            Array.isArray(planB?.target_files) ? planB.target_files.map(String) :
            (Array.isArray(planB?.targetFiles) ? planB.targetFiles.map(String) : [])
          ).some(f => filesA.has(f));
          if (hasOverlap) {
            // Record original-array indices so we can match back to sortedPlans
            conflictedPairs.add(`${indices[a]}:${indices[b]}`);
            conflictedPairs.add(`${indices[b]}:${indices[a]}`);
          }
        }
      }
    }
  }

  // Build a lookup from plan object identity → original assignment index
  const planToAssignmentIndex = new Map();
  if (splitConflictingPlansAcrossBatches && capabilityPoolResult?.assignments) {
    capabilityPoolResult.assignments.forEach((a, i) => {
      if (a?.plan) planToAssignmentIndex.set(a.plan, i);
    });
  }

  // Build a plan-ID-based conflict set from the dependency graph resolution.
  // This supplements lane-based conflicts and covers cases where capabilityPoolResult is absent.
  const graphConflictIdPairs = new Set<string>();
  if (splitConflictingPlansAcrossBatches) {
    for (const [taskA, taskB] of graphConflictList) {
      graphConflictIdPairs.add(`${taskA}:${taskB}`);
      graphConflictIdPairs.add(`${taskB}:${taskA}`);
    }
  }

  /**
   * Determine whether two plan objects are in conflict via either:
   *  (a) lane-based file overlap detected by the capability pool, or
   *  (b) file-scope conflict detected by the dependency graph resolver.
   */
  function arePlansConflicting(planA: any, planB: any) {
    if (!splitConflictingPlansAcrossBatches) return false;
    const idxA = planToAssignmentIndex.get(planA) ?? -1;
    const idxB = planToAssignmentIndex.get(planB) ?? -1;
    // Lane-based conflict (assignment index pair)
    if (idxA !== -1 && idxB !== -1 && conflictedPairs.has(`${idxA}:${idxB}`)) return true;
    // Graph-based conflict (plan ID pair)
    if (graphConflictIdPairs.size > 0) {
      const planAId = String((planA as any)?.task_id || (planA as any)?.task || (planA as any)?.role || "");
      const planBId = String((planB as any)?.task_id || (planB as any)?.task || (planB as any)?.role || "");
      if (planAId && planBId && graphConflictIdPairs.has(`${planAId}:${planBId}`)) return true;
    }
    return false;
  }

  const roleBuckets = new Map();
  for (const plan of sortedPlans) {
    const roleName = String(plan?.role || "Evolution Worker");
    if (!roleBuckets.has(roleName)) roleBuckets.set(roleName, []);
    roleBuckets.get(roleName).push(plan);
  }

  const flattened = [];
  for (const [roleName, rolePlans] of roleBuckets.entries()) {
    const taskKind = String(rolePlans[0]?.taskKind || rolePlans[0]?.kind || "implementation");
    const sharedBranch = buildSharedBranchName(roleName, rolePlans);

    // ── Conflict-aware sub-grouping within a role bucket ──────────────────
    // Default behavior keeps potentially conflicting plans in the same role
    // batch so the worker can execute them in deterministic order. When
    // planner.splitConflictingPlansAcrossBatches=true, fallback to greedy
    // conflict coloring to isolate conflicting plans into separate sub-groups.
    const subGroups: Array<typeof rolePlans> = [];
    if (splitConflictingPlansAcrossBatches) {
      for (let i = 0; i < rolePlans.length; i++) {
        const plan = rolePlans[i];

        // Find the first group that has no conflict with this plan
        let placed = false;
        for (let g = 0; g < subGroups.length; g++) {
          const hasConflict = subGroups[g].some((existing) => arePlansConflicting(plan, existing));
          if (!hasConflict) {
            subGroups[g].push(plan);
            placed = true;
            break;
          }
        }
        if (!placed) {
          subGroups.push([plan]);
        }
      }
    } else {
      subGroups.push(rolePlans);
    }

    // ── Wave-boundary enforcement ─────────────────────────────────────────
    // Plans from different waves must NOT be co-batched into the same context
    // batch delivered to a worker. Wave N+1 tasks have data dependencies on
    // ALL wave N completions across all workers; co-batching would allow a
    // worker to start wave N+1 work before wave N is globally complete.
    //
    // For each sub-group, split by wave number first, then pack each wave
    // slice into context batches independently using the critical-path-sized
    // model selection.
    for (const subGroupPlans of subGroups) {
      const plansByWave = new Map<number, typeof subGroupPlans>();
      for (const plan of subGroupPlans) {
        const waveNum = resolvePlanWave(plan);
        if (!plansByWave.has(waveNum)) plansByWave.set(waveNum, []);
        plansByWave.get(waveNum)!.push(plan);
      }

      const sortedWaves = [...plansByWave.keys()].sort((a, b) => a - b);
      for (const waveNum of sortedWaves) {
        const wavePlans = plansByWave.get(waveNum)!;
        const selection = chooseModelForRolePlans(config, roleName, wavePlans, taskKind);

        // ── Dependency-sensitive batch splitting ──────────────────────────
        // When any plan in a model-selected batch carries explicit dependency
        // declarations, split oversized batches to MAX_PLANS_PER_DEPENDENCY_BATCH
        // plans each.  This prevents a worker from receiving a large context
        // bundle where dependency ordering can be silently ignored.
        const maxDepBatch = normalizeDependencyBatchLimit(
          (config as any)?.runtime?.maxPlansPerDependencyBatch,
          MAX_PLANS_PER_DEPENDENCY_BATCH
        );
        const splitBatches: Array<{ plans: unknown[]; estimatedTokens: number }> = [];
        for (const batch of selection.batches) {
          const batchPlans = batch.plans as any[];
          const hasDeps = batchPlans.some((p) => hasExplicitDependencies(p));
          if (hasDeps && batchPlans.length > maxDepBatch) {
            // Chunk into groups of maxDepBatch; distribute estimated tokens proportionally
            for (let offset = 0; offset < batchPlans.length; offset += maxDepBatch) {
              const chunk = batchPlans.slice(offset, offset + maxDepBatch);
              splitBatches.push({
                plans: chunk,
                estimatedTokens: Math.round(batch.estimatedTokens * chunk.length / batchPlans.length),
              });
            }
          } else {
            splitBatches.push(batch);
          }
        }

        const compactedBatches: Array<{ plans: unknown[]; estimatedTokens: number }> = [];
        for (const batch of splitBatches) {
          const currentPlans = batch.plans as any[];
          if (compactedBatches.length === 0) {
            compactedBatches.push(batch);
            continue;
          }

          // Best-fit packing: try to fit into the existing batch with the most
          // remaining capacity (fewest wasted tokens). This maximizes context
          // utilization per worker invocation.
          let bestFitIndex = -1;
          let bestFitRemaining = Infinity;
          for (let ci = 0; ci < compactedBatches.length; ci++) {
            const candidate = compactedBatches[ci];
            const candidatePlans = candidate.plans as any[];
            const mergedPlans = [...candidatePlans, ...currentPlans];
            const mergedTokens = estimateBatchTokens(mergedPlans);
            const mergedHasDeps = mergedPlans.some((p) => hasExplicitDependencies(p));
            const withinDepLimit = !mergedHasDeps || mergedPlans.length <= maxDepBatch;
            const withinContextLimit = mergedTokens <= selection.usableContextTokens;

            if (withinDepLimit && withinContextLimit) {
              const remaining = selection.usableContextTokens - mergedTokens;
              if (remaining < bestFitRemaining) {
                bestFitIndex = ci;
                bestFitRemaining = remaining;
              }
            }
          }

          if (bestFitIndex >= 0) {
            const target = compactedBatches[bestFitIndex];
            const merged = [...(target.plans as any[]), ...currentPlans];
            target.plans = merged;
            target.estimatedTokens = estimateBatchTokens(merged);
          } else {
            compactedBatches.push(batch);
          }
        }

        compactedBatches.forEach((batch, index) => {
          const utilization = selection.usableContextTokens > 0
            ? Math.round((batch.estimatedTokens / selection.usableContextTokens) * 100)
            : 0;
          flattened.push({
            role: roleName,
            plans: batch.plans,
            model: selection.model,
            contextWindowTokens: selection.contextWindowTokens,
            usableContextTokens: selection.usableContextTokens,
            estimatedTokens: batch.estimatedTokens,
            contextUtilizationPercent: utilization,
            taskKind,
            sharedBranch,
            wave: waveNum,
            roleBatchIndex: index + 1,
            roleBatchTotal: compactedBatches.length,
            githubFinalizer: index === compactedBatches.length - 1,
          });
        });
      }
    }
  }

  // ── Lane diversity enforcement ───────────────────────────────────────────────
  // When a capabilityPoolResult is available (computed by capability_pool before
  // dispatch), enforce the minimum lane diversity threshold.  A violation is
  // advisory — it does NOT block scheduling — but it is surfaced on every batch
  // descriptor so the orchestrator or cycle-analytics can observe and react.
  //
  // Configurable via config.runtime.minDiversityLanes (default: 2).
  const minDiversityLanes = Number(
    (config as any)?.runtime?.minDiversityLanes ?? 2
  );
  const diversityCheck = capabilityPoolResult
    ? enforceLaneDiversity(capabilityPoolResult, { minLanes: minDiversityLanes })
    : { meetsMinimum: true, activeLaneCount: 0, warning: "" };

  const diversityViolation = !diversityCheck.meetsMinimum
    ? { activeLaneCount: diversityCheck.activeLaneCount, minRequired: minDiversityLanes, warning: diversityCheck.warning }
    : null;

  // Sort by wave so that sequential dispatch (orchestrator's for-loop) respects the
  // global wave boundary across roles.  Without this, role-grouped insertion order
  // produces [A-wave1, A-wave2, B-wave1, B-wave2] — causing wave-2 work to start
  // before all wave-1 work is globally complete.
  flattened.sort((a, b) => (a.wave as number) - (b.wave as number));

  return flattened.map((batch, index) => ({
    ...batch,
    bundleIndex: index + 1,
    totalBundles: flattened.length,
    diversityViolation,
  }));
}

/**
 * Build execution batches using fit-score-based worker assignment.
 *
 * Alternative entry point to buildRoleExecutionBatches for callers that want
 * worker-task fit scoring (selectWorkerByFitScore) rather than relying solely on
 * the plan's `role` field.
 *
 * Each plan is assigned the highest-scoring worker (deterministic tie-breaking)
 * and its `role` field is set accordingly before delegating to
 * buildRoleExecutionBatches.
 *
 * @param plans          — plan objects to assign and batch
 * @param config         — BOX config
 * @param lanePerformance — optional historical lane outcomes for fit scoring
 * @returns same shape as buildRoleExecutionBatches
 */
export function buildFitScoredBatches(
  plans: any[],
  config?: object,
  lanePerformance?: LanePerformanceLedger
) {
  if (!Array.isArray(plans) || plans.length === 0) {
    return buildRoleExecutionBatches([], config);
  }

  const assignedPlans = plans.map(plan => {
    const selection = selectWorkerByFitScore(plan, config, lanePerformance);
    return { ...plan, role: selection.role };
  });

  return buildRoleExecutionBatches(assignedPlans, config);
}
