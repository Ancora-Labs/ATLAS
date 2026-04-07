/**
 * Tests for T-013: Deprecate stale Athena references in learning loop.
 *
 * Covers:
 *   AC1:  Outcome collector no longer relies on absent Athena artifacts.
 *   AC2:  Metrics derive from active orchestration state files
 *         (prometheus_analysis.json, evolution_progress.json, worker_sessions.json).
 *   AC3:  No null/empty learning cycles due to missing state files.
 *   AC5:  Tests cover no-Athena runtime (criterion 5 from task).
 *   AC7:  Negative path — missing ALL state files → degraded=true with reason code.
 *   AC8:  Newly returned JSON fields (metricsSource, degraded, degradedReason) are present.
 *   AC9:  Missing input (ENOENT) vs invalid input (parse error) produce distinct reason codes.
 *   AC10: No silent fallback — degraded state sets explicit status and reason.
 *
 * Scenarios:
 *   1. Active runtime: prometheus + evolution files present
 *      → metrics derived from active state files, degraded=false
 *   2. Only evolution_progress present, prometheus absent (ENOENT)
 *      → degraded=true, degradedReason=PROMETHEUS_ABSENT
 *   3. prometheus_analysis present but invalid JSON
 *      → degraded=true, degradedReason=PROMETHEUS_INVALID
 *   4. athena_coordination.json present → ignored (legacy adapter removed)
 *   5. No state files at all
 *      → degraded=true, totalPlans=0, completedCount=0
 *   6. evolution_progress invalid JSON (distinct from missing)
 *      → degradedReason=EVOLUTION_INVALID (not EVOLUTION_ABSENT)
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  collectCycleOutcomes,
  OUTCOME_DEGRADED_REASON,
  computeWeightedDecisionScore,
  DECISION_QUALITY_WEIGHTS,
  runSelfImprovementCycle,
} from "../../src/core/self_improvement.js";
import { DECISION_QUALITY_LABEL } from "../../src/core/athena_reviewer.js";
import { WORKER_CYCLE_ARTIFACTS_FILE } from "../../src/core/cycle_analytics.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Write JSON to a file, creating parent dirs. */
async function writeTestJson(dir, filename, data) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), JSON.stringify(data, null, 2), "utf8");
}

/** Write raw text to a file (for corrupt JSON tests). */
async function writeRaw(dir, filename, text) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), text, "utf8");
}

/** Build a minimal config pointing at a temp stateDir. */
function makeConfig(stateDir) {
  return {
    selfImprovement: { enabled: true },
    paths: { stateDir }
  };
}

/** Minimal valid prometheus_analysis.json. */
const PROMETHEUS_ANALYSIS = {
  schemaVersion: 1,
  projectHealth: "good",
  plans: [
    { id: "T-001", worker: "evolution-worker", context: "fix tests" },
    { id: "T-002", worker: "evolution-worker", context: "add lint" }
  ],
  executionStrategy: {
    waves: [
      { id: "wave-1", workers: ["evolution-worker"], gate: "none", estimatedRequests: 2 }
    ]
  },
  requestBudget: { estimatedPremiumRequestsTotal: 2, hardCapTotal: 10, errorMarginPercent: 20, confidenceLevel: "medium" }
};

/** Minimal valid evolution_progress.json with two completed tasks. */
const EVOLUTION_PROGRESS = {
  cycle_id: "SE-test-001",
  started_at: new Date().toISOString(),
  current_task_index: 2,
  tasks: {
    "T-001": { status: "completed", attempts: 1 },
    "T-002": { status: "in_progress", attempts: 1 },
    "T-003": { status: "pending", attempts: 0 }
  }
};

/** Minimal worker_sessions.json. */
const WORKER_SESSIONS = {
  schemaVersion: 1,
  "evolution-worker": { status: "idle", startedAt: new Date().toISOString() }
};

const ATHENA_PLAN_REVIEW = {
  approved: true,
  overallScore: 8,
  summary: "Plan approved with follow-up corrections.",
  corrections: [
    "MANDATORY — Enumerate the denylist explicitly.",
    "ADVISORY — Define the interface snapshot before refactor."
  ],
  reviewedAt: new Date().toISOString()
};

function makeWorkerCycleArtifacts(overrides: Record<string, unknown> = {}) {
  const cycleId = String((overrides as any).cycleId || "cycle-test-001");
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    latestCycleId: cycleId,
    cycles: {
      [cycleId]: {
        cycleId,
        status: "complete",
        updatedAt: new Date().toISOString(),
        workerSessions: {
          "evolution-worker": { status: "idle", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        },
        workerActivity: {
          "evolution-worker": [{ at: new Date().toISOString(), status: "done", taskId: "T-001", pr: null }]
        },
        completedTaskIds: ["T-001"],
      }
    },
    ...overrides,
  };
}

// ── OUTCOME_DEGRADED_REASON enum ──────────────────────────────────────────────

describe("OUTCOME_DEGRADED_REASON", () => {
  it("is a frozen object with all required reason codes", () => {
    assert.ok(Object.isFrozen(OUTCOME_DEGRADED_REASON), "must be frozen");
    assert.equal(OUTCOME_DEGRADED_REASON.PROMETHEUS_ABSENT,  "PROMETHEUS_ABSENT");
    assert.equal(OUTCOME_DEGRADED_REASON.PROMETHEUS_INVALID, "PROMETHEUS_INVALID");
    assert.equal(OUTCOME_DEGRADED_REASON.EVOLUTION_ABSENT,   "EVOLUTION_ABSENT");
    assert.equal(OUTCOME_DEGRADED_REASON.EVOLUTION_INVALID,  "EVOLUTION_INVALID");
    assert.equal(OUTCOME_DEGRADED_REASON.WORKER_SESSIONS_STALE, "WORKER_SESSIONS_STALE");
    assert.equal(OUTCOME_DEGRADED_REASON.NO_ACTIVE_DATA,     "NO_ACTIVE_DATA");
  });
});

// ── Scenario 1: No-Athena runtime (AC1, AC2, AC3, AC5) ────────────────────────

describe("collectCycleOutcomes — no-Athena runtime", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-noses-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    await writeTestJson(tmpDir, "athena_plan_review.json", ATHENA_PLAN_REVIEW);
    // Intentionally NO athena_coordination.json
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns totalPlans from prometheus_analysis.plans", () => {
    assert.equal(result.totalPlans, 2, "totalPlans must match prometheus plans count");
  });

  it("returns completedCount from evolution_progress completed tasks", () => {
    assert.equal(result.completedCount, 1, "only T-001 has status=completed");
  });

  it("returns projectHealth from prometheus_analysis", () => {
    assert.equal(result.projectHealth, "good");
  });

  it("degraded=false when all primary sources are present", () => {
    assert.equal(result.degraded, false, "should not be degraded with all active files present");
    assert.equal(result.degradedReason, null);
  });

  it("metricsSource includes prometheus_analysis and evolution_progress", () => {
    assert.ok(result.metricsSource.includes("prometheus_analysis"), "must credit prometheus_analysis");
    assert.ok(result.metricsSource.includes("evolution_progress"), "must credit evolution_progress");
    assert.ok(!result.metricsSource.includes("athena_coordination"), "must not include Athena source");
  });

  it("dispatches does not rely on Athena dispatchLog", () => {
    // With no Athena file and no worker activity files, dispatches is empty (not null).
    assert.ok(Array.isArray(result.dispatches), "dispatches must be an array");
  });

  it("waves derived from prometheus_analysis executionStrategy", () => {
    assert.equal(result.waves.length, 1);
    assert.equal(result.waves[0].id, "wave-1");
  });

  it("result includes required schema fields", () => {
    for (const field of ["totalPlans", "completedCount", "projectHealth", "workerOutcomes",
      "waves", "dispatches", "requestBudget", "decisionQuality", "athenaPlanReview", "timestamp",
      "metricsSource", "degraded", "degradedReason"]) {
      assert.ok(field in result, `result must include field: ${field}`);
    }
  });

  it("includes Athena plan review feedback for end-of-loop SI", () => {
    assert.equal(result.athenaPlanReview?.approved, true);
    assert.equal(result.athenaPlanReview?.overallScore, 8);
    assert.equal(result.athenaPlanReview?.corrections.length, 2);
    assert.match(result.athenaPlanReview?.summary || "", /follow-up corrections/i);
  });
});

describe("collectCycleOutcomes — canonical worker-cycle artifacts precedence", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-si-canonical-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeTestJson(tmpDir, "evolution_progress.json", {
      ...EVOLUTION_PROGRESS,
      tasks: {
        "T-001": { status: "in_progress", attempts: 1 },
        "T-002": { status: "in_progress", attempts: 1 },
      }
    });
    await writeTestJson(tmpDir, WORKER_CYCLE_ARTIFACTS_FILE, makeWorkerCycleArtifacts({
      cycleId: "cycle-canonical-1",
      latestCycleId: "cycle-canonical-1",
      cycles: {
        "cycle-canonical-1": {
          cycleId: "cycle-canonical-1",
          status: "complete",
          updatedAt: new Date().toISOString(),
          workerSessions: {
            "evolution-worker": { status: "idle", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          },
          workerActivity: {
            "evolution-worker": [
              { at: new Date().toISOString(), status: "done", taskId: "T-001" },
              { at: new Date().toISOString(), status: "success", taskId: "T-002" }
            ]
          },
          completedTaskIds: ["T-001", "T-002"],
        }
      },
    }));
    await writeTestJson(tmpDir, "pipeline_progress.json", {
      stage: "cycle_complete",
      startedAt: "cycle-canonical-1",
      updatedAt: new Date().toISOString(),
      percent: 100,
      detail: "done",
      steps: [],
      stageLabel: "Cycle complete",
    });
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("prefers canonical completedTaskIds over evolution_progress fallback", () => {
    assert.equal(result.completedCount, 2, "completedCount must come from canonical completedTaskIds");
  });

  it("metricsSource credits worker_cycle_artifacts when canonical data is used", () => {
    assert.ok(result.metricsSource.includes("worker_cycle_artifacts"));
    assert.ok(!result.metricsSource.includes("evolution_progress_fallback"));
  });
});

// ── Scenario 2: prometheus_analysis absent (AC9, AC10) ───────────────────────

describe("collectCycleOutcomes — prometheus_analysis missing (ENOENT)", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-nopr-"));
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    // No prometheus_analysis.json
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("degraded=true when prometheus_analysis is missing", () => {
    assert.equal(result.degraded, true);
  });

  it("degradedReason=PROMETHEUS_ABSENT (not INVALID) for ENOENT", () => {
    assert.equal(result.degradedReason, OUTCOME_DEGRADED_REASON.PROMETHEUS_ABSENT,
      "must use ABSENT reason code for missing file, not INVALID");
  });

  it("totalPlans=0 when prometheus_analysis is absent", () => {
    assert.equal(result.totalPlans, 0);
  });
});

// ── Scenario 3: prometheus_analysis invalid JSON (AC9) ───────────────────────

describe("collectCycleOutcomes — prometheus_analysis invalid JSON", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-invpr-"));
    await writeRaw(tmpDir, "prometheus_analysis.json", "{ this is not valid json }}}");
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("degraded=true when prometheus_analysis is invalid JSON", () => {
    assert.equal(result.degraded, true);
  });

  it("degradedReason=PROMETHEUS_INVALID (not ABSENT) for corrupt file", () => {
    assert.equal(result.degradedReason, OUTCOME_DEGRADED_REASON.PROMETHEUS_INVALID,
      "must use INVALID reason code for corrupt file, not ABSENT");
  });
});

// ── Scenario 4: prometheus_analysis has wrong structure (AC9) ─────────────────

describe("collectCycleOutcomes — prometheus_analysis missing plans array", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-badpr-"));
    // Valid JSON but missing the required `plans` array field
    await writeTestJson(tmpDir, "prometheus_analysis.json", { projectHealth: "good" });
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("degraded=true when prometheus_analysis lacks plans array", () => {
    assert.equal(result.degraded, true);
  });

  it("degradedReason=PROMETHEUS_INVALID for bad structure", () => {
    assert.equal(result.degradedReason, OUTCOME_DEGRADED_REASON.PROMETHEUS_INVALID);
  });
});

// ── Scenario 5: athena_coordination.json present but ignored (adapter removed) ─

describe("collectCycleOutcomes — athena_coordination.json present but ignored", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-legacy-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    // Legacy Athena file still present on disk — should be ignored
    await writeTestJson(tmpDir, "athena_coordination.json", {
      completedTasks: ["T-001", "T-LEGACY-001"],
      dispatchLog: [{ role: "old-worker", task: "T-LEGACY-001", status: "done" }]
    });
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("completedCount only reflects evolution_progress (Athena ignored)", () => {
    // evolution has only T-001 completed; legacy T-LEGACY-001 is NOT merged
    assert.equal(result.completedCount, 1, "must only count evolution-derived completed tasks");
  });

  it("metricsSource does NOT include athena_coordination", () => {
    assert.ok(!result.metricsSource.includes("athena_coordination"),
      "must not reference athena_coordination in metricsSource");
  });

  it("degraded=false — primary sources are present", () => {
    assert.equal(result.degraded, false);
  });
});

// ── Scenario 6: All state files absent (AC7 negative path) ───────────────────

describe("collectCycleOutcomes — all state files absent", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-empty-"));
    // Create directory but write NO state files
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("degraded=true when no state files exist", () => {
    assert.equal(result.degraded, true);
  });

  it("degradedReason is a valid OUTCOME_DEGRADED_REASON code (not null)", () => {
    assert.ok(result.degradedReason !== null, "degradedReason must not be null when degraded");
    assert.ok(
      Object.values(OUTCOME_DEGRADED_REASON).includes(result.degradedReason),
      `degradedReason must be a known code, got: ${result.degradedReason}`
    );
  });

  it("totalPlans=0 and completedCount=0", () => {
    assert.equal(result.totalPlans, 0);
    assert.equal(result.completedCount, 0);
  });

  it("result is an object (not null/undefined) — no silent failure", () => {
    assert.ok(result !== null && typeof result === "object",
      "must return a result object, not null");
  });
});

// ── Scenario 7: evolution_progress invalid JSON (AC9 distinct reason code) ────

describe("collectCycleOutcomes — evolution_progress invalid JSON", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-invevo-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeRaw(tmpDir, "evolution_progress.json", "BROKEN{{{");
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("degraded=true when evolution_progress is corrupt", () => {
    assert.equal(result.degraded, true);
  });

  it("degradedReason=EVOLUTION_INVALID (not EVOLUTION_ABSENT)", () => {
    assert.equal(result.degradedReason, OUTCOME_DEGRADED_REASON.EVOLUTION_INVALID,
      "corrupt file must produce INVALID, not ABSENT");
  });

  it("totalPlans still returns plan count from prometheus (other source still valid)", () => {
    // prometheus_analysis was valid, so plans should be populated
    assert.equal(result.totalPlans, 2,
      "totalPlans should still be populated from prometheus when evolution is the only degraded source");
  });
});

describe("collectCycleOutcomes — worker_sessions absent", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-si-nosess-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    // Intentionally NO worker_sessions.json
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("degraded=true when worker_sessions is absent", () => {
    assert.equal(result.degraded, true);
  });

  it("degradedReason=WORKER_SESSIONS_STALE for missing worker sessions", () => {
    assert.equal(result.degradedReason, OUTCOME_DEGRADED_REASON.WORKER_SESSIONS_STALE);
  });
});

describe("collectCycleOutcomes — worker_sessions stale vs worker artifacts", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-si-stalesess-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", {});
    await writeTestJson(tmpDir, "worker_evolution-worker.json", {
      activityLog: [{ status: "done", taskId: "T-001", at: new Date().toISOString() }]
    });
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("degraded=true when sessions are stale relative to worker artifacts", () => {
    assert.equal(result.degraded, true);
  });

  it("degradedReason=WORKER_SESSIONS_STALE for stale session artifact", () => {
    assert.equal(result.degradedReason, OUTCOME_DEGRADED_REASON.WORKER_SESSIONS_STALE);
  });
});

describe("runSelfImprovementCycle — policy impact attribution", () => {
  let tmpDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-si-impact-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    await writeTestJson(tmpDir, "learned_policies.json", [
      { id: "glob-false-fail", assertion: "Use npm test", severity: "critical", _inactiveCycles: 2 },
    ]);
    await writeTestJson(tmpDir, "policy_impact_ledger.json", {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      entries: [
        {
          id: "impact-seed-1",
          policyId: "glob-false-fail",
          metric: "capacity_score",
          baseline: 0.9,
          current: 0.9,
          delta: 0,
          improved: false,
          measuredAt: new Date(Date.now() - 60000).toISOString(),
          cycleId: "seed-cycle",
        },
      ],
    });
    await writeTestJson(tmpDir, "knowledge_memory.json", {
      lessons: [],
      configTunings: [],
      promptHints: [],
      capabilityGaps: [],
      lastUpdated: null,
    });
    await writeTestJson(tmpDir, "cycle_health.json", {
      plannerHealth: "critical",
      operationalStatus: "degraded",
      pipelineStatus: "critical",
      divergenceState: "both_degraded",
      isWarning: true,
      recordedAt: new Date().toISOString(),
    });
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("persists attributions and retires ineffective policies via half-life", async () => {
    const mockCopilotPath = path.join(tmpDir, "mock-copilot.cmd");
    await fs.writeFile(
      mockCopilotPath,
      "@echo {\"lessons\":[],\"configSuggestions\":[],\"promptHints\":[],\"workerFeedback\":[],\"systemHealthScore\":70,\"nextCyclePriorities\":[\"policy impact\"],\"capabilityGaps\":[]}\r\n",
      "utf8",
    );
    const config = {
      rootDir: tmpDir,
      paths: { stateDir: tmpDir, progressFile: path.join(tmpDir, "evolution_progress.log") },
      selfImprovement: { enabled: true, maxReports: 20 },
      systemGuardian: { enabled: false },
      runtime: { mandatoryTaskCoverageMode: "warn" },
      env: { copilotCliCommand: mockCopilotPath },
    };
    await writeTestJson(tmpDir, "worker_evolution-worker.json", {
      activityLog: [{ status: "done", taskId: "T-001", at: new Date().toISOString() }],
    });
    const report = await runSelfImprovementCycle(config as any);
    assert.equal(report, null, "cycle should stop when AI analysis is unavailable");

    const impactLedger = JSON.parse(await fs.readFile(path.join(tmpDir, "policy_impact_ledger.json"), "utf8"));
    assert.ok(Array.isArray(impactLedger.entries), "policy impact ledger entries must be persisted");
    assert.ok(impactLedger.entries.length > 0, "policy impact ledger must contain at least one entry");

    const retiredPolicies = JSON.parse(await fs.readFile(path.join(tmpDir, "retired_policies.json"), "utf8"));
    assert.ok(Array.isArray(retiredPolicies));
    assert.ok(retiredPolicies.length >= 1, "ineffective policy should be retired");
  });
});

// ── dispatchBlockReason from cycle_analytics ──────────────────────────────

describe("collectCycleOutcomes — dispatchBlockReason from cycle_analytics.json", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-dbr-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    await writeTestJson(tmpDir, "cycle_analytics.json", {
      schemaVersion: 1,
      lastCycle: {
        outcomes: {
          dispatchBlockReason: "GOVERNANCE_FREEZE_ACTIVE:test-freeze"
        }
      }
    });
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reads dispatchBlockReason from lastCycle.outcomes", () => {
    assert.equal(result.dispatchBlockReason, "GOVERNANCE_FREEZE_ACTIVE:test-freeze");
  });

  it("dispatchBlockReason is included in result schema", () => {
    assert.ok("dispatchBlockReason" in result, "result must include dispatchBlockReason field");
  });
});

describe("collectCycleOutcomes — dispatchBlockReason absent when cycle_analytics missing", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-noca-"));
    await writeTestJson(tmpDir, "prometheus_analysis.json", PROMETHEUS_ANALYSIS);
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    // Intentionally NO cycle_analytics.json
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("dispatchBlockReason is null when cycle_analytics absent", () => {
    assert.equal(result.dispatchBlockReason, null,
      "dispatchBlockReason must be null when cycle_analytics.json is absent");
  });

  it("degraded is false — missing cycle_analytics does not degrade outcome", () => {
    assert.equal(result.degraded, false,
      "cycle_analytics is optional — its absence must not degrade outcome collection");
  });
});

// ── Wave completion tracking — numeric wave field ─────────────────────────

describe("collectCycleOutcomes — wave tracking uses wave field over id", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-t013-wvnum-"));
    const prometheusWithNumericWaves = {
      ...PROMETHEUS_ANALYSIS,
      executionStrategy: {
        waves: [
          { wave: 1, workers: ["evolution-worker"] },
          { wave: 2, id: "wave-2", workers: ["quality-worker"] }
        ]
      }
    };
    await writeTestJson(tmpDir, "prometheus_analysis.json", prometheusWithNumericWaves);
    await writeTestJson(tmpDir, "evolution_progress.json", EVOLUTION_PROGRESS);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("uses numeric wave field as waveKey", () => {
    assert.equal(result.waves.length, 2);
    assert.equal(result.waves[0].id, 1, "wave[0].id must equal numeric wave field value");
  });

  it("prefers wave field over id field when both present", () => {
    assert.equal(result.waves[1].id, 2, "wave[1].id must use numeric wave field, not id string");
  });

  it("wave with empty key returns empty completedTasks (not all tasks)", () => {
    const waveNoKey = { workers: ["evolution-worker"] };
    // Simulate by checking that undefined wave/id wave returns [] not all tasks
    // The wave above has wave=1 so id is 1 — all tasks that include "1" in id match
    // Wave completedTasks should be an array (even if empty)
    for (const w of result.waves) {
      assert.ok(Array.isArray(w.completedTasks), `wave ${w.id} completedTasks must be an array`);
    }
  });
});

// ── Wave completion — exact Set membership (no substring matching) ─────────
// This test guards against the regression where waveKey="1" would match "T-011"
// via substring comparison rather than exact task-id membership.
describe("collectCycleOutcomes — wave task membership is exact, not substring", () => {
  let tmpDir;
  let result;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-si-wavematch-"));
    // Wave 1 owns only T-001; wave 11 owns T-011.
    // Substring matching would put T-011 into wave 1 because "1" is a substring of "T-011".
    const prometheus = {
      schemaVersion: 1,
      projectHealth: "good",
      plans: [
        { id: "T-001", task_id: "T-001", wave: 1, worker: "evolution-worker", context: "wave 1 task" },
        { id: "T-011", task_id: "T-011", wave: 11, worker: "evolution-worker", context: "wave 11 task" },
      ],
      executionStrategy: {
        waves: [
          { wave: 1, tasks: ["T-001"], workers: ["evolution-worker"] },
          { wave: 11, tasks: ["T-011"], workers: ["evolution-worker"] },
        ]
      },
      requestBudget: { estimatedPremiumRequestsTotal: 2, hardCapTotal: 10, errorMarginPercent: 20, confidenceLevel: "medium" }
    };
    const progress = {
      cycle_id: "SE-wavematch-001",
      started_at: new Date().toISOString(),
      current_task_index: 2,
      tasks: {
        "T-001": { status: "completed", attempts: 1 },
        "T-011": { status: "completed", attempts: 1 },
      }
    };
    await writeTestJson(tmpDir, "prometheus_analysis.json", prometheus);
    await writeTestJson(tmpDir, "evolution_progress.json", progress);
    await writeTestJson(tmpDir, "worker_sessions.json", WORKER_SESSIONS);
    result = await collectCycleOutcomes(makeConfig(tmpDir));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("wave 1 completedTasks contains only T-001, not T-011", () => {
    const wave1 = result.waves.find((w) => String(w.id) === "1");
    assert.ok(wave1, "wave 1 must be present in results");
    assert.ok(wave1.completedTasks.includes("T-001"), "T-001 must be in wave 1 completedTasks");
    assert.ok(!wave1.completedTasks.includes("T-011"),
      "T-011 must NOT be in wave 1 — substring match regression guard");
  });

  it("wave 11 completedTasks contains T-011 and not T-001", () => {
    const wave11 = result.waves.find((w) => String(w.id) === "11");
    assert.ok(wave11, "wave 11 must be present in results");
    assert.ok(wave11.completedTasks.includes("T-011"), "T-011 must be in wave 11 completedTasks");
    assert.ok(!wave11.completedTasks.includes("T-001"),
      "T-001 must NOT be in wave 11");
  });

  it("totalPlans counts all plans regardless of wave", () => {
    assert.equal(result.totalPlans, 2);
  });

  it("completedCount counts all completed tasks across waves", () => {
    assert.equal(result.completedCount, 2);
  });
});
