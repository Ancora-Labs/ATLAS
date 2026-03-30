import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRoleRegistry, LANE_WORKER_NAMES, WORKER_CAPABILITIES } from "../../src/core/role_registry.js";

describe("role_registry", () => {
  it("returns fallback registry when config is missing", () => {
    const registry = getRoleRegistry(undefined);
    assert.equal(registry.ceoSupervisor.name, "Jesus");
    assert.equal(registry.planner.name, "Prometheus");
    assert.equal(registry.workers.evolution.name, "Evolution Worker");
  });

  it("negative path: merges custom workers without dropping fallback evolution worker", () => {
    const registry = getRoleRegistry({
      roleRegistry: {
        workers: { backend: { id: "worker-backend", name: "Backend Worker", model: "x" } }
      }
    });
    assert.equal(registry.workers.backend.name, "Backend Worker");
    assert.equal(registry.workers.evolution.name, "Evolution Worker");
  });

  it("all six lane workers are registered", () => {
    const registry = getRoleRegistry(undefined);
    const lanes = ["implementation", "quality", "governance", "infrastructure", "integration", "observation"];
    const registeredLanes = Object.values(registry.workers).map((w: any) => w.lane);
    for (const lane of lanes) {
      assert.ok(registeredLanes.includes(lane), `Missing lane worker for: ${lane}`);
    }
  });

  it("LANE_WORKER_NAMES covers all six lanes", () => {
    const expected = ["implementation", "quality", "governance", "infrastructure", "integration", "observation"];
    for (const lane of expected) {
      assert.ok(LANE_WORKER_NAMES[lane], `LANE_WORKER_NAMES missing entry for lane: ${lane}`);
    }
  });

  it("implementation lane maps to Evolution Worker", () => {
    assert.equal(LANE_WORKER_NAMES["implementation"], "Evolution Worker");
  });

  it("non-implementation lanes map to hyphenated worker names", () => {
    assert.equal(LANE_WORKER_NAMES["quality"], "quality-worker");
    assert.equal(LANE_WORKER_NAMES["governance"], "governance-worker");
    assert.equal(LANE_WORKER_NAMES["infrastructure"], "infrastructure-worker");
    assert.equal(LANE_WORKER_NAMES["integration"], "integration-worker");
    assert.equal(LANE_WORKER_NAMES["observation"], "observation-worker");
  });
});

describe("WORKER_CAPABILITIES", () => {
  it("is frozen (immutable)", () => {
    assert.ok(Object.isFrozen(WORKER_CAPABILITIES));
  });

  it("has entries for all six lane workers", () => {
    const expected = Object.values(LANE_WORKER_NAMES);
    for (const workerName of expected) {
      assert.ok(workerName in WORKER_CAPABILITIES, `Missing WORKER_CAPABILITIES entry for: ${workerName}`);
    }
  });

  it("each worker declares at least one capability", () => {
    for (const [worker, caps] of Object.entries(WORKER_CAPABILITIES)) {
      assert.ok(Array.isArray(caps) && caps.length > 0, `${worker} must declare at least one capability`);
    }
  });

  it("governance-worker is the only worker declaring state-governance", () => {
    const declaring = Object.entries(WORKER_CAPABILITIES)
      .filter(([, caps]) => (caps as readonly string[]).includes("state-governance"))
      .map(([name]) => name);
    assert.deepEqual(declaring, ["governance-worker"]);
  });

  it("negative path: unknown worker name returns undefined (no throw)", () => {
    const caps = (WORKER_CAPABILITIES as any)["nonexistent-worker"];
    assert.equal(caps, undefined);
  });
});
