import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  autoResolveBenchmarkRecommendations,
  isResumePreferredTimeoutOutcome,
  promotePrometheusAnalysisFromWorkerEvidence,
  rebatchOversizedAthenaPlanGroupsForAdmission,
  resolveInterBatchCooldownDecision,
  shouldBypassLaneDiversityHardGate,
  shouldBypassSpecializationAdmissionGate,
  recoverStaleWorkerSessions,
  shouldRecoverWorkingSessionAfterDaemonRestart,
} from "../../src/core/orchestrator.js";

describe("orchestrator runtime contracts - timeout recovery", () => {
  it("marks PROCESS_TIMEOUT cooldown errors as resume-preferred", () => {
    assert.equal(
      isResumePreferredTimeoutOutcome({
        status: "error",
        reasonCode: "PROCESS_TIMEOUT",
        retryClass: "cooldown",
      }),
      true,
    );
  });

  it("ignores non-timeout outcomes", () => {
    assert.equal(
      isResumePreferredTimeoutOutcome({
        status: "transient_error",
        reasonCode: "TRANSIENT_API_ERROR",
        retryClass: "cooldown",
      }),
      false,
    );
    assert.equal(
      isResumePreferredTimeoutOutcome({
        status: "error",
        reasonCode: "UNKNOWN_EXIT",
        retryClass: "cooldown",
      }),
      false,
    );
  });
});

describe("orchestrator runtime contracts - lane diversity hard gate bypass", () => {
  it("bypasses the hard gate when same-lane conflicts will be serialized into batches", () => {
    const result = shouldBypassLaneDiversityHardGate({
      plans: [
        { task: "Eliminate thin-packet rejection churn", _capabilityLane: "implementation" },
        { task: "Create shared context bus artifact", _capabilityLane: "implementation" },
      ],
      minLanes: 2,
      capabilityPoolResult: { activeLaneCount: 1 },
      laneConflicts: [{ lane: "implementation", sharedFiles: ["src/core/prometheus.ts"] }],
    });

    assert.equal(result.bypass, true);
    assert.equal(result.reason, "same_lane_conflicts_will_serialize_into_distinct_batches");
  });

  it("does not bypass the hard gate for plain monoculture without conflict serialization", () => {
    const result = shouldBypassLaneDiversityHardGate({
      plans: [
        { task: "Task A", _capabilityLane: "implementation" },
        { task: "Task B", _capabilityLane: "implementation" },
      ],
      minLanes: 2,
      capabilityPoolResult: { activeLaneCount: 1 },
      laneConflicts: [],
    });

    assert.equal(result.bypass, false);
    assert.equal(result.reason, null);
  });
});

describe("orchestrator runtime contracts - specialization admission bypass", () => {
  it("bypasses specialization when serialized same-lane topology makes specialist share infeasible", () => {
    const result = shouldBypassSpecializationAdmissionGate({
      laneDiversityBypassReason: "same_lane_conflicts_will_serialize_into_distinct_batches",
      capabilityPoolResult: {
        activeLaneCount: 1,
        specializationUtilization: {
          specializedShare: 0,
          specializedDeficit: 3,
        },
      },
    });

    assert.equal(result.bypass, true);
    assert.equal(result.reason, "serialized_same_lane_batch_topology_makes_specialization_target_infeasible");
  });

  it("does not bypass specialization without a connected lane-diversity serialization signal", () => {
    const result = shouldBypassSpecializationAdmissionGate({
      laneDiversityBypassReason: null,
      capabilityPoolResult: {
        activeLaneCount: 1,
        specializationUtilization: {
          specializedShare: 0,
          specializedDeficit: 3,
        },
      },
    });

    assert.equal(result.bypass, false);
    assert.equal(result.reason, null);
  });
});

describe("orchestrator runtime contracts - oversized Athena admission rebatch", () => {
  it("splits an oversized Athena batch into admission-safe sub-batches", () => {
    const plans = [
      { role: "evolution-worker", _batchIndex: 1, _batchWorkerRole: "evolution-worker", _batchWave: 1, acceptance_criteria: ["a1", "a2", "a3", "a4"] },
      { role: "evolution-worker", _batchIndex: 1, _batchWorkerRole: "evolution-worker", _batchWave: 1, acceptance_criteria: ["b1", "b2", "b3"] },
      { role: "evolution-worker", _batchIndex: 1, _batchWorkerRole: "evolution-worker", _batchWave: 1, acceptance_criteria: ["c1", "c2", "c3", "c4"] },
      { role: "quality-worker", _batchIndex: 2, _batchWorkerRole: "quality-worker", _batchWave: 2, acceptance_criteria: ["q1"] },
    ];

    const result = rebatchOversizedAthenaPlanGroupsForAdmission(plans, 9);

    assert.equal(result.rewrote, true);
    assert.equal(result.splitGroups, 1);
    assert.equal(result.batchCount, 3);
    assert.deepEqual(plans.map((plan) => plan._batchIndex), [1, 1, 2, 3]);
    assert.deepEqual(plans.map((plan) => plan._batchTotal), [3, 3, 3, 3]);
  });

  it("returns a deterministic block reason when a single Athena plan is unsplittable", () => {
    const plans = [
      { role: "evolution-worker", _batchIndex: 1, _batchWorkerRole: "evolution-worker", _batchWave: 1, acceptance_criteria: Array.from({ length: 10 }, (_, i) => `step-${i}`) },
    ];

    const result = rebatchOversizedAthenaPlanGroupsForAdmission(plans, 9);

    assert.equal(result.rewrote, false);
    assert.match(String(result.blockedReason || ""), /ordered_step_complexity_unsplittable/);
  });
});

describe("orchestrator runtime contracts - Prometheus evidence promotion", () => {
  it("promotes matched plans to implemented_correctly with runtime evidence", () => {
    const analysis = {
      plans: [
        {
          task: "Fix timeout recovery flow",
          implementationStatus: "not_implemented",
          implementationEvidence: [],
        },
      ],
    };

    const rows = [
      {
        roleName: "evolution-worker",
        status: "done",
        planTasks: ["Fix timeout recovery flow"],
        filesTouched: ["src/core/orchestrator.ts"],
        verificationEvidence: "VERIFICATION_REPORT: BUILD=pass; TESTS=pass",
        dispatchContract: {
          doneWorkerWithVerificationReportEvidence: true,
          doneWorkerWithCleanTreeStatusEvidence: true,
        },
      },
    ];

    const result = promotePrometheusAnalysisFromWorkerEvidence(
      analysis,
      rows,
      "2026-04-09T12:00:00.000Z",
    );

    assert.equal(result.promotedCount > 0, true);
    assert.equal(result.analysis.plans[0].implementationStatus, "implemented_correctly");
    assert.ok(result.analysis.plans[0].implementationEvidence.includes("src/core/orchestrator.ts"));
  });

  it("leaves unrelated plans unchanged", () => {
    const analysis = {
      plans: [
        {
          task: "Unrelated task",
          implementationStatus: "not_implemented",
          implementationEvidence: [],
        },
      ],
    };

    const result = promotePrometheusAnalysisFromWorkerEvidence(
      analysis,
      [{ status: "done", planTasks: ["Different task"], filesTouched: [] }],
      "2026-04-09T12:00:00.000Z",
    );

    assert.equal(result.promotedCount, 0);
    assert.equal(result.analysis.plans[0].implementationStatus, "not_implemented");
  });
});

describe("orchestrator runtime contracts - benchmark auto-resolution", () => {
  it("uses runtime evidence strength for linked topic promotion", () => {
    const result = autoResolveBenchmarkRecommendations(
      [{
        recommendations: [
          {
            topic: "Worker lifecycle safety",
            implementationStatus: "pending",
            evidence: "",
          },
        ],
      }],
      {
        verifiedDoneWorkers: 1,
        workerBatches: [{ plans: [{ synthesis_sources: ["Worker lifecycle safety"] }] }],
        workerResults: [{
          roleName: "evolution-worker",
          status: "done",
          synthesisSources: ["Worker lifecycle safety"],
          filesTouched: ["src/core/worker_runner.ts"],
          verificationEvidence: "VERIFICATION_REPORT: TESTS=pass",
          dispatchContract: { doneWorkerWithVerificationReportEvidence: true },
        }],
        atIso: "2026-04-09T12:00:00.000Z",
      },
    );

    assert.equal(result.resolvedCount, 1);
    assert.equal(result.entries[0].recommendations[0].implementationStatus, "implemented_correctly");
  });

  it("uses partial fallback when only generic verified completion exists", () => {
    const result = autoResolveBenchmarkRecommendations(
      [{
        recommendations: [
          {
            topic: "Reflection memory",
            implementationStatus: "pending",
            evidence: "",
          },
        ],
      }],
      {
        verifiedDoneWorkers: 1,
        workerBatches: [],
        workerResults: [],
        atIso: "2026-04-09T12:00:00.000Z",
      },
    );

    assert.equal(result.resolvedCount, 1);
    assert.equal(result.entries[0].recommendations[0].implementationStatus, "implemented_partially");
  });
});

describe("orchestrator runtime contracts - startup stale worker recovery", () => {
  it("recovers working sessions left behind by a daemon restart", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-daemon-restart-"));

    try {
      await fs.writeFile(
        path.join(tmpDir, "daemon.pid.json"),
        JSON.stringify({ pid: 12345, startedAt: "2026-04-09T12:41:34.037Z" }, null, 2),
        "utf8",
      );

      const sessions = {
        "evolution-worker": {
          status: "working",
          startedAt: "2026-04-09T12:15:26.307Z",
          updatedAt: "2026-04-09T12:15:26.307Z",
        },
      };

      const recovered = await recoverStaleWorkerSessions(
        {
          paths: {
            stateDir: tmpDir,
            progressFile: path.join(tmpDir, "progress.txt"),
          },
        },
        tmpDir,
        sessions,
      );

      assert.equal(recovered, true);
      assert.equal(sessions["evolution-worker"].status, "idle");

      const persisted = JSON.parse(await fs.readFile(path.join(tmpDir, "worker_sessions.json"), "utf8"));
      assert.equal(persisted["evolution-worker"].status, "idle");

      const progress = await fs.readFile(path.join(tmpDir, "progress.txt"), "utf8");
      assert.match(progress, /Recovered stale worker states \(1\): evolution-worker/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("keeps genuinely live working sessions active after restart time", () => {
    assert.equal(
      shouldRecoverWorkingSessionAfterDaemonRestart(
        {
          status: "working",
          startedAt: "2026-04-09T12:45:00.000Z",
          updatedAt: "2026-04-09T12:46:00.000Z",
        },
        "2026-04-09T12:41:34.037Z",
      ),
      false,
    );
  });
});

describe("orchestrator runtime contracts - adaptive inter-batch cooldown", () => {
  it("uses the fast path after a clean successful batch when more work remains", () => {
    const result = resolveInterBatchCooldownDecision({
      runtime: {
        interBatchDelayMs: 90000,
        interBatchSuccessDelayMs: 15000,
      },
    }, {
      remainingBatches: 2,
      workerStatus: "done",
      transientRetries: 0,
    });

    assert.equal(result.cooldownMs, 15000);
    assert.equal(result.reason, "successful_batch_fast_path");
  });

  it("keeps the full cooldown after transient retry pressure", () => {
    const result = resolveInterBatchCooldownDecision({
      runtime: {
        interBatchDelayMs: 90000,
        interBatchSuccessDelayMs: 15000,
      },
    }, {
      remainingBatches: 1,
      workerStatus: "done",
      transientRetries: 1,
    });

    assert.equal(result.cooldownMs, 90000);
    assert.equal(result.reason, "transient_retry_recovery");
  });

  it("returns zero cooldown when no batches remain", () => {
    const result = resolveInterBatchCooldownDecision({
      runtime: {
        interBatchDelayMs: 90000,
      },
    }, {
      remainingBatches: 0,
      workerStatus: "done",
      transientRetries: 0,
    });

    assert.equal(result.cooldownMs, 0);
    assert.equal(result.reason, "no_remaining_batches");
  });
});

// ── extractSessionsFromCycleRecord — canonical session loading behavior ────────

import {
  extractSessionsFromCycleRecord,
  migrateWorkerCycleArtifacts,
  selectWorkerCycleRecord,
} from "../../src/core/cycle_analytics.js";

describe("orchestrator — canonical session loading behavior (extractSessionsFromCycleRecord)", () => {
  it("returns null for missing canonical artifacts (signals legacy fallback required)", () => {
    const sessions = extractSessionsFromCycleRecord(null);
    assert.equal(sessions, null);
  });

  it("returns null for canonical record without workerSessions key", () => {
    assert.equal(extractSessionsFromCycleRecord({ cycleId: "c1", status: "active" }), null);
  });

  it("returns sessions from a valid canonical record", () => {
    const record = {
      workerSessions: {
        coder: { status: "working", startedAt: new Date().toISOString() },
      },
      workerActivity: {},
    };
    const sessions = extractSessionsFromCycleRecord(record);
    assert.ok(sessions, "sessions must not be null for valid record");
    assert.ok("coder" in sessions, "coder session must be present");
  });

  it("full canonical path: migrate → select → extract yields sessions consistent with recoverStaleWorkerSessions input", () => {
    const cycleId = new Date().toISOString();
    const rawArtifacts = {
      schemaVersion: 1,
      updatedAt: cycleId,
      latestCycleId: cycleId,
      cycles: {
        [cycleId]: {
          cycleId,
          status: "active",
          updatedAt: cycleId,
          workerSessions: {
            coder: { status: "working", startedAt: cycleId },
          },
          workerActivity: { coder: [] },
          completedTaskIds: [],
        },
      },
    };
    const migrated = migrateWorkerCycleArtifacts(rawArtifacts);
    assert.ok(migrated.ok && migrated.data, "migration must succeed for valid artifacts");
    const { record } = selectWorkerCycleRecord(migrated.data!, cycleId);
    const sessions = extractSessionsFromCycleRecord(record);
    assert.ok(sessions, "canonical path must yield sessions");
    assert.ok("coder" in sessions!, "coder must be present after full canonical path");
    const coderSessions = sessions!.coder as any;
    assert.equal(coderSessions.status, "working");
    assert.ok(Array.isArray(coderSessions._activityLog), "_activityLog must be present");

    // Verify the extracted sessions can feed recoverStaleWorkerSessions (structural compatibility).
    const recovered = recoverStaleWorkerSessions(sessions!);
    assert.ok(typeof recovered === "object" && recovered !== null, "recovered must be an object");
  });
});