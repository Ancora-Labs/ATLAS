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
