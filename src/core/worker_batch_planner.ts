import { getRoleRegistry } from "./role_registry.js";
import { enforceModelPolicy } from "./model_policy.js";

const CHARS_PER_TOKEN = 4;
const DEFAULT_CONTEXT_WINDOW_TOKENS = 100000;
const DEFAULT_CONTEXT_RESERVE_TOKENS = 12000;
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
    Array.isArray(plan?.target_files) ? plan.target_files.join("\n") : "",
    Array.isArray(plan?.acceptance_criteria) ? plan.acceptance_criteria.join("\n") : "",
    JSON.stringify(Array.isArray(plan?.dependencies) ? plan.dependencies : []),
  ].filter(Boolean).join("\n");

  return Math.max(1, Math.ceil(payload.length / CHARS_PER_TOKEN) + 300);
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

export function buildRoleExecutionBatches(plans = [], config, capabilityPoolResult = null) {
  const sortedPlans = [...plans].sort((a, b) => {
    const waveDelta = Number(a?.wave || 0) - Number(b?.wave || 0);
    if (waveDelta !== 0) return waveDelta;
    return Number(a?.priority || 0) - Number(b?.priority || 0);
  });

  // ── Conflict-aware lane separation ────────────────────────────────────────
  // If the capability pool detected intra-lane file conflicts, plans that
  // share target files within the same lane must not be co-batched.
  // Build a conflict adjacency set: "planIndex_a:planIndex_b" → true
  const conflictedPairs = new Set();
  if (capabilityPoolResult?.assignments) {
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
  if (capabilityPoolResult?.assignments) {
    capabilityPoolResult.assignments.forEach((a, i) => {
      if (a?.plan) planToAssignmentIndex.set(a.plan, i);
    });
  }

  /**
   * Determine whether two plans (identified by their assignment indices) are
   * in conflict (same lane, overlapping target files).
   */
  function arePlanIndexesConflicting(idxA, idxB) {
    if (idxA === -1 || idxB === -1) return false;
    return conflictedPairs.has(`${idxA}:${idxB}`);
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
    // Greedily pack plans into sub-groups such that no two conflicting plans
    // share a sub-group.  This is a greedy graph-coloring approach: each
    // sub-group is a color, and conflicts are edges.
    const subGroups: Array<typeof rolePlans> = [];
    const assignedGroup = new Array(rolePlans.length).fill(-1);

    for (let i = 0; i < rolePlans.length; i++) {
      const plan = rolePlans[i];
      const planIdx = planToAssignmentIndex.get(plan) ?? -1;

      // Find the first group that has no conflict with this plan
      let placed = false;
      for (let g = 0; g < subGroups.length; g++) {
        const hasConflict = subGroups[g].some((existing) => {
          const existingIdx = planToAssignmentIndex.get(existing) ?? -1;
          return arePlanIndexesConflicting(planIdx, existingIdx);
        });
        if (!hasConflict) {
          subGroups[g].push(plan);
          assignedGroup[i] = g;
          placed = true;
          break;
        }
      }
      if (!placed) {
        subGroups.push([plan]);
        assignedGroup[i] = subGroups.length - 1;
      }
    }

    // For each sub-group, choose model and pack into context batches
    for (const subGroupPlans of subGroups) {
      const selection = chooseModelForRolePlans(config, roleName, subGroupPlans, taskKind);

      selection.batches.forEach((batch, index) => {
        flattened.push({
          role: roleName,
          plans: batch.plans,
          model: selection.model,
          contextWindowTokens: selection.contextWindowTokens,
          usableContextTokens: selection.usableContextTokens,
          estimatedTokens: batch.estimatedTokens,
          taskKind,
          sharedBranch,
          roleBatchIndex: index + 1,
          roleBatchTotal: selection.batches.length,
          githubFinalizer: index === selection.batches.length - 1,
        });
      });
    }
  }

  return flattened.map((batch, index) => ({
    ...batch,
    bundleIndex: index + 1,
    totalBundles: flattened.length,
  }));
}