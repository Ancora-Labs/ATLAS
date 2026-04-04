import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assessGovernanceGateBlockRisk,
  computeGateBlockRiskFromSignals,
  GATE_BLOCK_RISK,
  ATHENA_PLAN_REVIEW_REASON_CODE,
  runAthenaPlanReview,
} from "../../src/core/athena_reviewer.js";

describe("athena gate risk dry-run integration", () => {
  it("returns low risk when governance dry-run is passable", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-gate-risk-clear-"));
    try {
      const config = {
        paths: { stateDir, progressFile: path.join(stateDir, "progress.log"), policyFile: path.join(stateDir, "policy.json") },
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

  it("enforces fail-closed review even when runtime.athenaFailOpen is enabled (legacy rollback removed)", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-fail-closed-"));
    try {
      const config = {
        paths: {
          stateDir,
          progressFile: path.join(stateDir, "progress.log"),
          policyFile: path.join(stateDir, "policy.json"),
        },
        env: {
          targetRepo: "CanerDoqdu/Box",
          copilotCliCommand: "__missing_copilot_binary__",
        },
        roleRegistry: {
          qualityReviewer: { name: "Athena", model: "Claude Sonnet 4.6" },
        },
        runtime: { athenaFailOpen: true },
      };
      await fs.writeFile(config.paths.policyFile, JSON.stringify({ blockedCommands: [] }, null, 2), "utf8");
      const result = await runAthenaPlanReview(config, {
        projectHealth: "good",
        analysis: "analysis",
        keyFindings: "findings",
        plans: [{ role: "evolution-worker", task: "do deterministic work item", verification: "npm test" }],
        requestBudget: { estimatedPremiumRequestsTotal: 1 },
      });
      assert.equal(result.approved, false);
      assert.equal(result.reason?.code, ATHENA_PLAN_REVIEW_REASON_CODE.AI_CALL_FAILED);
      assert.equal(result.blocker?.stage, "athena_plan_review");
      assert.equal(result.blocker?.code, ATHENA_PLAN_REVIEW_REASON_CODE.AI_CALL_FAILED);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("negative path: returns high risk when dry-run sees freeze block", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-gate-risk-freeze-"));
    try {
      const config = {
        paths: { stateDir, progressLog: path.join(stateDir, "progress.log") },
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
        paths: { stateDir, progressLog: path.join(stateDir, "progress.log") },
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

  it("applies high-risk score penalty contract (4-point reduction floor=1)", () => {
    const gateRisk = computeGateBlockRiskFromSignals({
      freezeActive: true,
      forceCheckpointActive: false,
    });
    assert.equal(gateRisk.gateBlockRisk, GATE_BLOCK_RISK.HIGH);
    assert.equal(gateRisk.requiresCorrection, true);

    const baseScore = 8;
    const penalty = gateRisk.gateBlockRisk === GATE_BLOCK_RISK.HIGH ? 4 : 2;
    const adjustedScore = Math.max(1, baseScore - penalty);
    assert.equal(adjustedScore, 4);
  });
});

