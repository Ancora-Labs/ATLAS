import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluatePreDispatchGovernanceGate, BLOCK_REASON, GATE_PRECEDENCE } from "../../src/core/orchestrator.js";

describe("orchestrator governance gate dry-run parity", () => {
  it("returns non-blocked gate decision in clear-state dry-run", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-gate-dryrun-"));
    try {
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: false, manualOverrideActive: false },
      };
      const result = await evaluatePreDispatchGovernanceGate(config, [], "dry-run-clear");
      assert.equal(result.blocked, false);
      assert.equal(result.reason, null);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("negative path: reports freeze block in dry-run", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-gate-dryrun-freeze-"));
    try {
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: true, manualOverrideActive: true },
      };
      const result = await evaluatePreDispatchGovernanceGate(config, [], "dry-run-freeze");
      assert.equal(result.blocked, true);
      assert.ok(String(result.reason || "").startsWith(BLOCK_REASON.GOVERNANCE_FREEZE_ACTIVE));
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("blocks dispatch when FORCE_CHECKPOINT_VALIDATION is active for SLO_CASCADING_BREACH", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-gate-force-checkpoint-"));
    try {
      await fs.writeFile(
        path.join(stateDir, "guardrail_force_checkpoint.json"),
        JSON.stringify({
          schemaVersion: 1,
          enabled: true,
          action: "force_checkpoint_validation",
          actionId: "act-1",
          scenarioId: "SLO_CASCADING_BREACH",
          reasonCode: "AUTO_APPLIED",
          appliedAt: new Date().toISOString(),
          revertedAt: null,
        }),
        "utf8",
      );
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: false, manualOverrideActive: false },
      };
      const result = await evaluatePreDispatchGovernanceGate(config, [], "force-checkpoint-block");
      assert.equal(result.blocked, true);
      assert.ok(String(result.reason || "").startsWith(`${BLOCK_REASON.GUARDRAIL_FORCE_CHECKPOINT_ACTIVE}:`));
      assert.equal(result.gateIndex, GATE_PRECEDENCE.FORCE_CHECKPOINT);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("override path: allows dispatch and records override audit when force-checkpoint override is active", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-gate-force-checkpoint-override-"));
    try {
      await fs.writeFile(
        path.join(stateDir, "guardrail_force_checkpoint.json"),
        JSON.stringify({
          schemaVersion: 1,
          enabled: true,
          action: "force_checkpoint_validation",
          actionId: "act-2",
          scenarioId: "SLO_CASCADING_BREACH",
          reasonCode: "AUTO_APPLIED",
          appliedAt: new Date().toISOString(),
          revertedAt: null,
          overrideActive: true,
          overrideReason: "incident approved",
          overrideBy: "ops-user",
        }),
        "utf8",
      );
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: false, manualOverrideActive: false },
      };
      const result = await evaluatePreDispatchGovernanceGate(config, [], "force-checkpoint-override");
      assert.equal(result.blocked, false);
      assert.equal(result.reason, null);

      const auditLog = await fs.readFile(path.join(stateDir, "governance_gate_audit.jsonl"), "utf8");
      assert.ok(auditLog.includes("\"kind\":\"force_checkpoint_override\""));
      assert.ok(auditLog.includes("\"scenarioId\":\"SLO_CASCADING_BREACH\""));
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});

describe("orchestrator governance gate — specialization admission", () => {
  it("does not block when no plans are provided (gate skipped)", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-gate-spec-"));
    try {
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: false, manualOverrideActive: false },
      };
      const result = await evaluatePreDispatchGovernanceGate(config, [], "spec-no-plans");
      assert.equal(result.blocked, false);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("uses bounded fallback and does not block when consecutiveBlockCycles meets max", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-gate-spec-bypass-"));
    try {
      // Write gate state at max to trigger bounded fallback.
      const { SPECIALIZATION_ADMISSION_MAX_BLOCK_CYCLES } = await import("../../src/core/capability_pool.js");
      await fs.writeFile(
        path.join(stateDir, "specialization_gate_state.json"),
        JSON.stringify({ consecutiveBlockCycles: SPECIALIZATION_ADMISSION_MAX_BLOCK_CYCLES }),
        "utf8"
      );
      const config = {
        paths: { stateDir },
        env: { targetRepo: "CanerDoqdu/Box" },
        canary: { enabled: false },
        systemGuardian: { enabled: false },
        governanceFreeze: { enabled: false, manualOverrideActive: false },
        // Set target requiring 100% specialists — no plan can meet this, but bounded fallback should allow.
        workerPool: { specializationTargets: { minSpecializedShare: 1.0 } },
      };
      // Provide a plan that would normally trigger the specialization gate.
      const plans = [{
        id: "T-spec-bypass",
        task: "fix-bug",
        role: "Evolution Worker",
        files: [],
        verification_commands: ["npm test"],
        acceptance_criteria: ["bug is fixed"],
        dependsOn: [],
      }];
      const result = await evaluatePreDispatchGovernanceGate(config, plans, "spec-bypass-test");
      // Should be non-blocked due to bounded fallback.
      assert.equal(result.blocked, false);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("BLOCK_REASON.SPECIALIZATION_ADMISSION_GATE is a stable non-empty string", () => {
    assert.equal(typeof BLOCK_REASON.SPECIALIZATION_ADMISSION_GATE, "string");
    assert.ok((BLOCK_REASON.SPECIALIZATION_ADMISSION_GATE as string).length > 0);
  });

  it("GATE_PRECEDENCE.SPECIALIZATION_ADMISSION is greater than ROLLING_COMPLETION_YIELD", () => {
    assert.ok(GATE_PRECEDENCE.SPECIALIZATION_ADMISSION > GATE_PRECEDENCE.ROLLING_COMPLETION_YIELD);
  });
});


