import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRoleExecutionBatches } from "../../src/core/worker_batch_planner.js";

function buildPlan(index) {
  return {
    role: "Evolution Worker",
    task: `Task ${index + 1} ${"x".repeat(80)}`,
    context: `Context ${index + 1}`,
    verification: `Verify ${index + 1}`,
    wave: 1,
    priority: index,
    taskKind: "implementation"
  };
}

describe("worker_batch_planner", () => {
  it("selects the model that minimizes batches and assigns GitHub closure to the final batch", () => {
    const config = {
      copilot: {
        defaultModel: "GPT-5.3-Codex",
        preferredModelsByTaskKind: {
          implementation: ["Claude Sonnet 4.6", "GPT-5.3-Codex"]
        },
        preferredModelsByRole: {
          "Evolution Worker": ["Claude Sonnet 4.6", "GPT-5.3-Codex"]
        },
        modelContextWindows: {
          "Claude Sonnet 4.6": 1700,
          "GPT-5.3-Codex": 1100
        },
        modelContextReserveTokens: 0
      },
      runtime: {
        workerContextTokenLimit: 1100
      },
      roleRegistry: {
        workers: {
          evolution: {
            name: "Evolution Worker",
            model: "GPT-5.3-Codex"
          }
        }
      }
    };

    const plans = Array.from({ length: 9 }, (_, index) => buildPlan(index));
    const batches = buildRoleExecutionBatches(plans, config);

    assert.equal(batches.length, 2);
    assert.equal(batches[0].model, "Claude Sonnet 4.6");
    assert.equal(batches[1].model, "Claude Sonnet 4.6");
    assert.equal(batches[0].plans.length, 5);
    assert.equal(batches[1].plans.length, 4);
    assert.equal(batches[0].githubFinalizer, false);
    assert.equal(batches[1].githubFinalizer, true);
    assert.equal(batches[0].roleBatchIndex, 1);
    assert.equal(batches[1].roleBatchIndex, 2);
    assert.equal(batches[0].roleBatchTotal, 2);
    assert.equal(batches[1].roleBatchTotal, 2);
    assert.equal(batches[0].sharedBranch, batches[1].sharedBranch);
  });

  it("produces the same result when capabilityPoolResult is null (backward-compatible)", () => {
    const config = { copilot: { defaultModel: "Claude Sonnet 4.6", modelContextReserveTokens: 0 } };
    const plans = [buildPlan(0), buildPlan(1), buildPlan(2)];
    const withNull = buildRoleExecutionBatches(plans, config, null);
    const withoutArg = buildRoleExecutionBatches(plans, config);
    assert.equal(withNull.length, withoutArg.length);
    assert.equal(withNull[0].plans.length, withoutArg[0].plans.length);
  });

  it("separates conflicting plans in the same lane into distinct batches", () => {
    const config = { copilot: { defaultModel: "Claude Sonnet 4.6", modelContextReserveTokens: 0 } };
    const planA = { role: "Evolution Worker", task: "Refactor orchestrator", target_files: ["src/core/orchestrator.ts"], wave: 1 };
    const planB = { role: "Evolution Worker", task: "Add log to orchestrator", target_files: ["src/core/orchestrator.ts"], wave: 1 };
    const planC = { role: "Evolution Worker", task: "Update prometheus", target_files: ["src/core/prometheus.ts"], wave: 1 };

    // Simulate capability pool result with lane assignments and a file conflict between A and B
    const capabilityPoolResult = {
      assignments: [
        { plan: planA, selection: { role: "Evolution Worker", lane: "implementation", isFallback: false } },
        { plan: planB, selection: { role: "Evolution Worker", lane: "implementation", isFallback: false } },
        { plan: planC, selection: { role: "Evolution Worker", lane: "implementation", isFallback: false } },
      ],
      diversityIndex: 0,
      activeLaneCount: 1,
    };

    const batches = buildRoleExecutionBatches([planA, planB, planC], config, capabilityPoolResult);

    // planA and planB share a file so they must NOT appear in the same batch
    const allBatchPlanSets = batches.map(b => b.plans);
    const conflictCoexists = allBatchPlanSets.some(batchPlans => batchPlans.includes(planA) && batchPlans.includes(planB));
    assert.equal(conflictCoexists, false, "conflicting plans should be in different batches");

    // planC (no conflict) should appear alongside exactly one of the two conflicting plans
    const planCBatch = allBatchPlanSets.find(bp => bp.includes(planC));
    assert.ok(planCBatch, "planC should be in some batch");
  });
});