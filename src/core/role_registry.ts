/**
 * Canonical lane-to-worker name mapping.
 * Each capability lane has a dedicated worker identity.
 * "implementation" maps to the base evolution-worker.
 * All other lanes get specialized workers that share the same agent tooling.
 */
export const LANE_WORKER_NAMES: Readonly<Record<string, string>> = Object.freeze({
  implementation:  "evolution-worker",
  quality:         "quality-worker",
  governance:      "governance-worker",
  infrastructure:  "infrastructure-worker",
  integration:     "integration-worker",
  observation:     "observation-worker",
});

/**
 * Per-worker capability declarations.
 * Maps worker name → ordered list of capability tags it handles best.
 * Used by scoreWorkerTaskFit() in capability_pool to produce a numeric fit score.
 *
 * Workers may declare multiple capabilities when they handle adjacent task types.
 * Single-capability workers receive a specialist bonus in fit scoring.
 */
export const WORKER_CAPABILITIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "evolution-worker":      Object.freeze(["runtime-refactor", "integration", "planner-improvement"]),
  "quality-worker":        Object.freeze(["test-infra", "planner-improvement"]),
  "governance-worker":     Object.freeze(["state-governance"]),
  "infrastructure-worker": Object.freeze(["infrastructure"]),
  "integration-worker":    Object.freeze(["integration", "runtime-refactor"]),
  "observation-worker":    Object.freeze(["observation"]),
});

export function normalizeWorkerName(name: unknown): string {
  const raw = String(name || "").trim().toLowerCase();
  if (!raw) return "evolution-worker";
  if (raw === "evolution worker" || raw === "evolution-worker") return "evolution-worker";
  return raw.replace(/\s+/g, "-");
}

export function isSpecialistWorkerName(name: unknown): boolean {
  return normalizeWorkerName(name) !== "evolution-worker";
}

export function normalizeTaskKindLabel(taskKind: unknown): string {
  return String(taskKind || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
}

export function getLaneForWorkerName(name: unknown, fallback = "implementation"): string {
  const normalized = normalizeWorkerName(name);
  for (const [lane, worker] of Object.entries(LANE_WORKER_NAMES)) {
    if (normalizeWorkerName(worker) === normalized) return lane;
  }
  return fallback;
}

/**
 * Normalize a plan role string to a registered executable worker name.
 *
 * Maps raw plan role strings (from Prometheus output) to the canonical worker
 * names in LANE_WORKER_NAMES. Unrecognized role strings fall back to
 * "evolution-worker" (the base implementation worker) so budget accounting
 * always resolves to a real worker identity.
 *
 * Examples:
 *   "Evolution Worker"  → "evolution-worker"  (via normalizeWorkerName + LANE match)
 *   "quality-worker"    → "quality-worker"
 *   "King David"        → "evolution-worker"   (unregistered → fallback)
 *   "governance"        → "governance-worker"  (lane key → worker name)
 *
 * @param role - raw role string from a Prometheus plan item
 * @returns registered worker name from LANE_WORKER_NAMES or "evolution-worker"
 */
export function normalizePlanRoleToWorkerName(role: unknown): string {
  const normalized = normalizeWorkerName(role);
  // Check if it directly matches a registered worker name
  const registeredWorkers = Object.values(LANE_WORKER_NAMES).map(w => normalizeWorkerName(w));
  if (registeredWorkers.includes(normalized)) return normalized;
  // Check if it matches a lane key (e.g., "governance" → "governance-worker")
  const laneKey = String(role || "").trim().toLowerCase();
  if (laneKey in LANE_WORKER_NAMES) return normalizeWorkerName(LANE_WORKER_NAMES[laneKey]);
  // Unregistered role: fall back to evolution-worker
  return "evolution-worker";
}

export function getSpecialistLaneNames(): string[] {
  return Object.keys(LANE_WORKER_NAMES).filter((lane) => lane !== "implementation");
}

export function isSpecialistLane(lane: unknown): boolean {
  const normalized = String(lane || "").trim().toLowerCase();
  return normalized.length > 0 && normalized !== "implementation" && normalized in LANE_WORKER_NAMES;
}

// ── Task-Lane Classification ───────────────────────────────────────────────────

/**
 * Deterministic task-lane kinds.
 *
 * WORKFLOW — scripted, tool-executable, deterministic sequences (CI, infra, pipelines).
 *            These tasks have fixed steps, known acceptance criteria, and run without
 *            AI deliberation beyond initial dispatch.
 *
 * AGENT    — tasks requiring AI reasoning, code generation, research, or review.
 *            These tasks benefit from full specialist worker attention and should
 *            not be short-circuited to workflow-style execution.
 */
export const TASK_LANE_KIND = Object.freeze({
  WORKFLOW: "workflow",
  AGENT:    "agent",
} as const);

export type TaskLaneKind = typeof TASK_LANE_KIND[keyof typeof TASK_LANE_KIND];

/**
 * Task-kind tokens that signal workflow-lane tasks (scripted, tool-executable).
 * Any plan whose taskKind normalized form matches one of these tokens is routed
 * to the WORKFLOW lane.
 */
export const WORKFLOW_TASK_KIND_TOKENS: ReadonlySet<string> = new Set([
  "ci",
  "ci-fix",
  "ci-repair",
  "infra",
  "infrastructure",
  "pipeline",
  "deploy",
  "release",
  "migration",
  "scaffold",
  "debt",
  "architecture-drift",
]);

/**
 * Task-text patterns that signal workflow tasks even when taskKind is absent.
 * Matched case-insensitively against the plan's task field.
 */
const WORKFLOW_TASK_TEXT_PATTERN =
  /\b(ci[- ]fix|ci[- ]repair|deploy|pipeline|release|scaffold|migration|infra(structure)?|docker|architecture[- ]drift)\b/i;

/**
 * Classify a plan as WORKFLOW or AGENT lane.
 *
 * Rules (in order, first match wins):
 *   1. If plan.taskLane is explicitly set and is a valid TASK_LANE_KIND, use it.
 *   2. If plan.taskKind normalized matches any WORKFLOW_TASK_KIND_TOKENS, → WORKFLOW.
 *   3. If plan.task matches WORKFLOW_TASK_TEXT_PATTERN, → WORKFLOW.
 *   4. Default: AGENT.
 *
 * @param plan — plan object (any shape; robust to missing fields)
 * @returns "workflow" | "agent"
 */
export function classifyTaskLaneKind(plan: unknown): TaskLaneKind {
  if (!plan || typeof plan !== "object") return TASK_LANE_KIND.AGENT;
  const p = plan as Record<string, unknown>;

  // 1. Explicit override
  const explicitLane = String(p.taskLane || "").trim().toLowerCase();
  if (explicitLane === TASK_LANE_KIND.WORKFLOW) return TASK_LANE_KIND.WORKFLOW;
  if (explicitLane === TASK_LANE_KIND.AGENT)    return TASK_LANE_KIND.AGENT;

  // 2. taskKind token match
  const taskKind = normalizeTaskKindLabel(p.taskKind);
  if (taskKind && WORKFLOW_TASK_KIND_TOKENS.has(taskKind)) return TASK_LANE_KIND.WORKFLOW;

  // 3. Task text pattern
  const taskText = String(p.task || "");
  if (WORKFLOW_TASK_TEXT_PATTERN.test(taskText)) return TASK_LANE_KIND.WORKFLOW;

  return TASK_LANE_KIND.AGENT;
}

const ATHENA_REVIEW_KIND_TOKENS = Object.freeze([
  "athena",
  "review",
  "postmortem",
  "post-mortem",
  "retrospective",
]);

const ATHENA_REVIEW_TEXT_PATTERN = /\b(athena|review|post[- ]?mortem|retrospective)\b/i;

export function isAthenaReviewOrPostmortemTask(taskKind: unknown, taskText: unknown = ""): boolean {
  const normalizedKind = normalizeTaskKindLabel(taskKind);
  if (normalizedKind && ATHENA_REVIEW_KIND_TOKENS.some((token) => normalizedKind.includes(token))) return true;
  return ATHENA_REVIEW_TEXT_PATTERN.test(String(taskText || ""));
}

export function getRoleRegistry(config) {
  const fallback = {
    ceoSupervisor: { id: "ceo-supervisor", name: "Jesus", model: "gpt-5.3-codex" },
    planner: { id: "planner", name: "Prometheus", model: "gpt-5.3-codex" },
    reviewer: { id: "reviewer", name: "Athena", model: "gpt-5.3-codex" },
    workers: {
      evolution:      { id: "worker-evolution",      name: "evolution-worker",      model: "gpt-5.3-codex", lane: "implementation" },
      quality:        { id: "worker-quality",         name: "quality-worker",        model: "gpt-5.3-codex", lane: "quality" },
      governance:     { id: "worker-governance",      name: "governance-worker",     model: "gpt-5.3-codex", lane: "governance" },
      infrastructure: { id: "worker-infrastructure",  name: "infrastructure-worker", model: "gpt-5.3-codex", lane: "infrastructure" },
      integration:    { id: "worker-integration",     name: "integration-worker",    model: "gpt-5.3-codex", lane: "integration" },
      observation:    { id: "worker-observation",     name: "observation-worker",    model: "gpt-5.3-codex", lane: "observation" },
    }
  };

  return {
    ...fallback,
    ...(config?.roleRegistry || {}),
    workers: {
      ...fallback.workers,
      ...(config?.roleRegistry?.workers || {})
    }
  };
}

export function assertRoleCapabilityForTask(config, roleName: unknown, taskKind: unknown, taskText: unknown = "") {
  const registry = getRoleRegistry(config);
  const normalizedRole = normalizeWorkerName(roleName);
  const workers = Object.values(registry?.workers || {}) as Array<{ name?: string }>;
  const registeredWorkerNames = new Set(workers.map((worker) => normalizeWorkerName(worker?.name)));
  const registeredLeadershipNames = new Set([
    normalizeWorkerName(registry?.reviewer?.name || "Athena"),
    normalizeWorkerName(registry?.planner?.name || "Prometheus"),
    normalizeWorkerName(registry?.ceoSupervisor?.name || "Jesus"),
    "athena",
    "prometheus",
    "jesus",
  ]);

  const roleKnown = registeredWorkerNames.has(normalizedRole) || registeredLeadershipNames.has(normalizedRole);
  if (!roleKnown) {
    return {
      allowed: false,
      code: "ROLE_NOT_REGISTERED",
      message: `Role '${String(roleName || "unknown")}' is not present in role registry`,
      athenaRelated: false,
      requiresFileShellTools: false,
    };
  }

  const athenaRelated = isAthenaReviewOrPostmortemTask(taskKind, taskText);
  if (!athenaRelated) {
    return {
      allowed: true,
      code: "OK",
      message: "Role capability check passed",
      athenaRelated: false,
      requiresFileShellTools: false,
    };
  }

  const rolesWithAthenaReviewCapability = new Set([
    "evolution-worker",
    "quality-worker",
    "athena",
    "prometheus",
  ]);
  const hasCapability = rolesWithAthenaReviewCapability.has(normalizedRole);
  if (!hasCapability) {
    return {
      allowed: false,
      code: "ROLE_CAPABILITY_MISMATCH",
      message: `Role '${String(roleName || "unknown")}' lacks athena-review/postmortem capability`,
      athenaRelated: true,
      requiresFileShellTools: true,
    };
  }

  return {
    allowed: true,
    code: "OK",
    message: "Role capability check passed",
    athenaRelated: true,
    requiresFileShellTools: true,
  };
}
