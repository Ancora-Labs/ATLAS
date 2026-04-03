import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assessGovernanceGateBlockRisk, GATE_BLOCK_RISK } from "../../src/core/athena_reviewer.js";

describe("athena gate risk dry-run integration", () => {
  it("returns low risk when governance dry-run is passable", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-gate-risk-clear-"));
    try {
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: false, manualOverrideActive: false },
      };
      const result = await assessGovernanceGateBlockRisk(config);
      assert.equal(result.gateBlockRisk, GATE_BLOCK_RISK.LOW);
      assert.equal(result.requiresCorrection, false);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("negative path: returns high risk when dry-run sees freeze block", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-gate-risk-freeze-"));
    try {
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: true, manualOverrideActive: true },
      };
      const result = await assessGovernanceGateBlockRisk(config);
      assert.equal(result.gateBlockRisk, GATE_BLOCK_RISK.HIGH);
      assert.equal(result.requiresCorrection, true);
      assert.ok(result.activeGateSignals.includes("governance_freeze_active"));
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("returns high risk when force-checkpoint validation is active for SLO cascading breach", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-gate-risk-force-checkpoint-"));
    try {
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: false, manualOverrideActive: false },
      };
      await fs.writeFile(
        path.join(stateDir, "guardrail_force_checkpoint.json"),
        JSON.stringify({
          enabled: true,
          revertedAt: null,
          scenarioId: "SLO_CASCADING_BREACH",
          overrideActive: false,
        }),
        "utf8",
      );
      const result = await assessGovernanceGateBlockRisk(config);
      assert.equal(result.gateBlockRisk, GATE_BLOCK_RISK.HIGH);
      assert.equal(result.requiresCorrection, true);
      assert.ok(result.activeGateSignals.includes("force_checkpoint_validation_active"));
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});

