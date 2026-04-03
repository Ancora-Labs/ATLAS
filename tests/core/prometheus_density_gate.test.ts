import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoBundleThinRelatedPackets } from "../../src/core/worker_batch_planner.js";
import { validatePlanContract, PACKET_VIOLATION_CODE, PLAN_VIOLATION_SEVERITY } from "../../src/core/plan_contract_validator.js";

describe("prometheus density admission contract", () => {
  it("auto-bundles thin related packets into a denser packet", () => {
    const thinA = {
      task: "Fix flaky ci task",
      role: "evolution-worker",
      wave: 1,
      target_files: ["src/core/orchestrator.ts"],
      acceptance_criteria: ["ci pass"],
      estimatedExecutionTokens: 1000,
      verification_commands: ["npm test -- tests/core/orchestrator_ci_context.test.ts"],
    };
    const thinB = {
      task: "Wire ci context fallback",
      role: "evolution-worker",
      wave: 1,
      target_files: ["src/core/orchestrator.ts", "src/core/worker_runner.ts"],
      acceptance_criteria: ["context injected"],
      estimatedExecutionTokens: 1200,
      verification_commands: ["npm test -- tests/core/orchestrator_ci_context.test.ts"],
    };
    const result = autoBundleThinRelatedPackets([thinA, thinB], {
      minTargetFiles: 2,
      minAcceptanceCriteria: 2,
      minTaskChars: 120,
      minExecutionTokens: 8000,
    });
    assert.equal(result.bundledCount, 1);
    assert.equal(result.plans.length, 1);
    assert.equal(result.plans[0]._autoBundledThinPacket, true);
    assert.equal(result.plans[0]._autoBundledFromCount, 2);
    assert.ok(Array.isArray(result.plans[0].target_files));
    assert.ok(result.plans[0].target_files.length >= 2);
  });

  it("negative path: unrelated thin packets are not bundled", () => {
    const thinA = {
      task: "a",
      role: "evolution-worker",
      wave: 1,
      target_files: ["src/core/a.ts"],
      acceptance_criteria: ["x"],
      estimatedExecutionTokens: 1000,
    };
    const thinB = {
      task: "b",
      role: "evolution-worker",
      wave: 1,
      target_files: ["src/core/b.ts"],
      acceptance_criteria: ["y"],
      estimatedExecutionTokens: 1200,
    };
    const result = autoBundleThinRelatedPackets([thinA, thinB], {
      minTargetFiles: 2,
      minAcceptanceCriteria: 2,
      minTaskChars: 120,
      minExecutionTokens: 8000,
    });
    assert.equal(result.bundledCount, 0);
    assert.equal(result.plans.length, 2);
  });

  it("remaining thin packet can be rejected deterministically by plan contract", () => {
    const plan = {
      task: "thin packet that should be rejected",
      role: "evolution-worker",
      wave: 1,
      verification: "tests/core/prometheus_density_gate.test.ts — test: rejects thin packet",
      dependencies: [],
      acceptance_criteria: ["one"],
      capacityDelta: 0.1,
      requestROI: 1.1,
      _thinPacketRejected: true,
      _thinPacketReason: "thin_packet_rejected: too small after bundling",
    };
    const result = validatePlanContract(plan);
    const violation = result.violations.find((v) => v.code === PACKET_VIOLATION_CODE.THIN_PACKET_REJECTED);
    assert.ok(violation);
    assert.equal(violation?.severity, PLAN_VIOLATION_SEVERITY.CRITICAL);
  });
});

