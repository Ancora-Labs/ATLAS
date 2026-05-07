import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  BLOCK_REASON,
  evaluateFreshCycleGovernanceHold,
  persistFreshCycleGovernanceHold,
} from "../../src/core/orchestrator.js";
import { PLATFORM_MODE } from "../../src/core/mode_state.js";

function createConfig(stateDir: string) {
  return {
    paths: { stateDir },
    platformModeState: { currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY },
    activeTargetSession: {
      projectId: "target_atlas",
      sessionId: "sess_governance_hold",
    },
  };
}

function createPlans() {
  return [
    {
      task_id: "plan-1",
      task: "Stabilize dispatch checkpoint reuse",
      role: "integration-worker",
      wave: 1,
    },
    {
      task_id: "plan-2",
      task: "Persist active governance block state",
      role: "quality-worker",
      wave: 1,
    },
  ];
}

async function writeForceCheckpointState(stateDir: string, enabled: boolean) {
  await fs.writeFile(
    path.join(stateDir, "guardrail_force_checkpoint.json"),
    JSON.stringify({
      enabled,
      revertedAt: enabled ? null : new Date().toISOString(),
      scenarioId: "SLO_CASCADING_BREACH",
    }),
    "utf8",
  );
}

describe("fresh-cycle governance hold", () => {
  it("holds a fresh cycle when the same approved plan set is still blocked by an active force-checkpoint guardrail", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-fresh-cycle-hold-"));
    try {
      const config = createConfig(stateDir);
      const plans = createPlans();
      const reason = `${BLOCK_REASON.GUARDRAIL_FORCE_CHECKPOINT_ACTIVE}:SLO_CASCADING_BREACH`;

      await writeForceCheckpointState(stateDir, true);
      await persistFreshCycleGovernanceHold(config, plans, reason, "pre_dispatch_gate");

      const result = await evaluateFreshCycleGovernanceHold(config, plans);
      assert.equal(result.blocked, true);
      assert.equal(result.reason, reason);
      assert.equal(result.gateSource, "pre_dispatch_gate");
      assert.ok(result.blockedAt);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("does not hold a fresh cycle once the force-checkpoint guardrail is no longer active", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-fresh-cycle-hold-"));
    try {
      const config = createConfig(stateDir);
      const plans = createPlans();
      const reason = `${BLOCK_REASON.GUARDRAIL_FORCE_CHECKPOINT_ACTIVE}:SLO_CASCADING_BREACH`;

      await writeForceCheckpointState(stateDir, true);
      await persistFreshCycleGovernanceHold(config, plans, reason, "pre_dispatch_gate");
      await writeForceCheckpointState(stateDir, false);

      const result = await evaluateFreshCycleGovernanceHold(config, plans);
      assert.equal(result.blocked, false);
      assert.equal(result.reason, null);
      assert.equal(result.gateSource, null);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("does not hold a fresh cycle when the approved plan set has changed", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-fresh-cycle-hold-"));
    try {
      const config = createConfig(stateDir);
      const plans = createPlans();
      const reason = `${BLOCK_REASON.GUARDRAIL_FORCE_CHECKPOINT_ACTIVE}:SLO_CASCADING_BREACH`;

      await writeForceCheckpointState(stateDir, true);
      await persistFreshCycleGovernanceHold(config, plans, reason, "pre_dispatch_gate");

      const nextPlans = [...plans, {
        task_id: "plan-3",
        task: "Introduce new approved work",
        role: "evolution-worker",
        wave: 2,
      }];
      const result = await evaluateFreshCycleGovernanceHold(config, nextPlans);
      assert.equal(result.blocked, false);
      assert.equal(result.reason, null);
      assert.equal(result.gateSource, null);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});