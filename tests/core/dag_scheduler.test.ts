import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeNextWaves, computeFrontier, microBatch, computeCriticalPathLength, computeWaveParallelismBound } from "../../src/core/dag_scheduler.js";

describe("dag_scheduler", () => {
  describe("computeNextWaves", () => {
    it("returns all_done for empty plans", () => {
      const result = computeNextWaves([]);
      assert.equal(result.status, "all_done");
      assert.equal(result.readyWaves.length, 0);
    });

    it("produces waves for independent plans", () => {
      const plans = [
        { task: "A", role: "wA", dependencies: [] },
        { task: "B", role: "wB", dependencies: [] },
      ];
      const result = computeNextWaves(plans);
      assert.equal(result.status, "ok");
      assert.ok(result.readyWaves.length >= 1);
      // Both independent tasks should be in wave 1
      const allTasks = result.readyWaves.flat().map(p => p.task);
      assert.ok(allTasks.includes("A"));
      assert.ok(allTasks.includes("B"));
    });

    it("excludes completed tasks", () => {
      const plans = [
        { task: "A", role: "wA", dependencies: [] },
        { task: "B", role: "wB", dependencies: [] },
      ];
      const result = computeNextWaves(plans, new Set(["A"]));
      assert.equal(result.status, "ok");
      const allTasks = result.readyWaves.flat().map(p => p.task);
      assert.ok(!allTasks.includes("A"));
      assert.ok(allTasks.includes("B"));
    });

    it("returns all_done when all tasks completed", () => {
      const plans = [{ task: "A", role: "wA", dependencies: [] }];
      const result = computeNextWaves(plans, new Set(["A"]));
      assert.equal(result.status, "all_done");
    });

    it("blocks plans with failed dependencies", () => {
      const plans = [
        { task: "A", role: "wA", dependencies: [] },
        { task: "B", role: "wB", dependencies: ["A"] },
      ];
      const result = computeNextWaves(plans, new Set(), new Set(["A"]));
      assert.ok(result.blocked.length > 0);
      assert.ok(result.blocked.some(p => p.task === "B"));
    });

    it("produces sequential waves for chained dependencies", () => {
      const plans = [
        { task: "A", role: "wA", dependencies: [] },
        { task: "B", role: "wB", dependencies: ["A"] },
      ];
      const result = computeNextWaves(plans);
      assert.equal(result.status, "ok");
      // A should be in wave 1, B should be in wave 2 (or only A in wave 1)
      const wave1Tasks = result.readyWaves[0]?.map(p => p.task) || [];
      assert.ok(wave1Tasks.includes("A"));
    });

    it("returns deadlocked when no tasks are schedulable", () => {
      const plans = [
        { task: "B", role: "wB", dependencies: ["A"] }, // A doesn't exist in plans
      ];
      const result = computeNextWaves(plans, new Set(), new Set(["A"]));
      // B depends on failed A → blocked
      assert.ok(result.blocked.length > 0 || result.status === "deadlocked");
    });
  });

  describe("computeFrontier (Packet 6)", () => {
    it("returns all independent tasks as frontier", () => {
      const plans = [
        { task: "A", dependencies: [] },
        { task: "B", dependencies: [] },
        { task: "C", dependencies: ["A"] },
      ];
      const result = computeFrontier(plans, new Set(), new Set(), new Set());
      const tasks = result.frontier.map(p => p.task);
      assert.ok(tasks.includes("A"));
      assert.ok(tasks.includes("B"));
      assert.ok(!tasks.includes("C"));
    });

    it("promotes task once dependencies completed", () => {
      const plans = [
        { task: "A", dependencies: [] },
        { task: "B", dependencies: ["A"] },
      ];
      const result = computeFrontier(plans, new Set(["A"]), new Set(), new Set());
      assert.ok(result.frontier.some(p => p.task === "B"));
    });

    it("excludes in-progress tasks", () => {
      const plans = [
        { task: "A", dependencies: [] },
        { task: "B", dependencies: [] },
      ];
      const result = computeFrontier(plans, new Set(), new Set(), new Set(["A"]));
      assert.ok(!result.frontier.some(p => p.task === "A"));
      assert.ok(result.frontier.some(p => p.task === "B"));
    });

    it("returns empty if all completed", () => {
      const plans = [{ task: "A", dependencies: [] }];
      const result = computeFrontier(plans, new Set(["A"]), new Set(), new Set());
      assert.equal(result.frontier.length, 0);
      assert.equal(result.status, "all_done");
    });
  });

  describe("microBatch (Packet 6)", () => {
    it("splits frontier into bounded batches", () => {
      const items = [{ task: "A" }, { task: "B" }, { task: "C" }, { task: "D" }, { task: "E" }];
      const batches = microBatch(items, { maxConcurrent: 2 });
      assert.equal(batches.length, 3);
      assert.equal(batches[0].length, 2);
      assert.equal(batches[2].length, 1);
    });

    it("returns single batch when under limit", () => {
      const items = [{ task: "A" }];
      const batches = microBatch(items, { maxConcurrent: 5 });
      assert.equal(batches.length, 1);
    });

    it("uses default maxConcurrent of 3 when no graph info provided", () => {
      const items = Array.from({ length: 7 }, (_, i) => ({ task: `T${i}` }));
      const batches = microBatch(items);
      assert.equal(batches[0].length, 3);
    });

    it("derives concurrency from criticalPathLength when provided", () => {
      // 6 tasks, critical path length 3 → bound = ceil(6/3) = 2
      const items = Array.from({ length: 6 }, (_, i) => ({ task: `T${i}` }));
      const batches = microBatch(items, { criticalPathLength: 3 });
      assert.equal(batches[0].length, 2);
      assert.equal(batches.length, 3);
    });

    it("explicit maxConcurrent takes precedence over criticalPathLength", () => {
      const items = Array.from({ length: 6 }, (_, i) => ({ task: `T${i}` }));
      // criticalPathLength would give 2, but maxConcurrent=4 wins
      const batches = microBatch(items, { maxConcurrent: 4, criticalPathLength: 3 });
      assert.equal(batches[0].length, 4);
    });
  });
});

describe("dag_scheduler — critical path utilities", () => {
  it("computeCriticalPathLength returns 1 for empty graph", () => {
    assert.equal(computeCriticalPathLength({}), 1);
    assert.equal(computeCriticalPathLength({ waves: [] }), 1);
  });

  it("computeCriticalPathLength returns max wave number", () => {
    const graph = { waves: [{ wave: 1, taskIds: ["A"] }, { wave: 2, taskIds: ["B"] }, { wave: 3, taskIds: ["C"] }] };
    assert.equal(computeCriticalPathLength(graph), 3);
  });

  it("computeWaveParallelismBound distributes tasks evenly across stages", () => {
    // 9 tasks, critical path 3 → ceil(9/3) = 3
    assert.equal(computeWaveParallelismBound(9, 3), 3);
    // 10 tasks, critical path 1 → ceil(10/1) = 10 → clamped to max 8
    assert.equal(computeWaveParallelismBound(10, 1), 8);
    // 1 task → bound = 1
    assert.equal(computeWaveParallelismBound(1, 5), 1);
  });

  it("computeWaveParallelismBound respects min/max opts", () => {
    assert.equal(computeWaveParallelismBound(2, 10, { min: 1, max: 4 }), 1);
    assert.equal(computeWaveParallelismBound(100, 1, { min: 1, max: 4 }), 4);
  });

  it("computeWaveParallelismBound returns min for invalid inputs", () => {
    assert.equal(computeWaveParallelismBound(0, 3), 1);
    assert.equal(computeWaveParallelismBound(5, 0), 1);
  });
});
