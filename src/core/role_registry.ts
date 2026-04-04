/**
 * Canonical lane-to-worker name mapping.
 * Each capability lane has a dedicated worker identity.
 * "implementation" maps to the base evolution-worker.
 * All other lanes get specialized workers that share the same agent tooling.
 */
export const LANE_WORKER_NAMES: Readonly<Record<string, string>> = Object.freeze({
  implementation:  "Evolution Worker",
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
  "Evolution Worker":      Object.freeze(["runtime-refactor", "integration", "planner-improvement"]),
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
      evolution:      { id: "worker-evolution",      name: "Evolution Worker",      model: "gpt-5.3-codex", lane: "implementation" },
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
