import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  autoRevertStaleSloGuardrail,
  hasFreshSloBreachEvidenceForForceCheckpoint,
  readForceCheckpointValidationContract,
} from "../../src/core/guardrail_executor.js";

function makeForceCheckpointPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    enabled: true,
    action: "force_checkpoint_validation",
    actionId: "guardrail-test-1",
    scenarioId: "SLO_CASCADING_BREACH",
    reasonCode: "AUTO_APPLIED",
    appliedAt: "2026-04-25T10:00:00.000Z",
    revertedAt: null,
    ...overrides,
  };
}

function makeSloMetricsPayload(lastCycle: any) {
  return {
    schemaVersion: 1,
    lastCycle,
    history: [],
    updatedAt: lastCycle?.completedAt || null,
  };
}

async function writeStateFiles(stateDir: string, opts: {
  guardrail?: any | null;
  slo?: any | null;
}) {
  if (opts.guardrail !== undefined) {
    if (opts.guardrail === null) {
      await fs.rm(path.join(stateDir, "guardrail_force_checkpoint.json"), { force: true });
    } else {
      await fs.writeFile(path.join(stateDir, "guardrail_force_checkpoint.json"), JSON.stringify(opts.guardrail), "utf8");
    }
  }
  if (opts.slo !== undefined) {
    if (opts.slo === null) {
      await fs.rm(path.join(stateDir, "slo_metrics.json"), { force: true });
    } else {
      await fs.writeFile(path.join(stateDir, "slo_metrics.json"), JSON.stringify(opts.slo), "utf8");
    }
  }
}

describe("hasFreshSloBreachEvidenceForForceCheckpoint", () => {
  it("returns false when guardrail is not active", () => {
    const guardrail = makeForceCheckpointPayload({ enabled: false, revertedAt: "2026-04-25T11:00:00.000Z" });
    const slo = makeSloMetricsPayload({
      completedAt: "2026-04-25T12:00:00.000Z",
      sloBreaches: [{ metric: "verificationCompletionMs", severity: "critical" }],
    });
    assert.equal(hasFreshSloBreachEvidenceForForceCheckpoint(guardrail, slo), false);
  });

  it("returns false when no SLO cycle has completed after the guardrail was applied", () => {
    const guardrail = makeForceCheckpointPayload({ appliedAt: "2026-04-25T10:00:00.000Z" });
    const slo = makeSloMetricsPayload({
      completedAt: "2026-04-25T09:00:00.000Z",
      sloBreaches: [{ metric: "verificationCompletionMs", severity: "critical" }],
    });
    assert.equal(hasFreshSloBreachEvidenceForForceCheckpoint(guardrail, slo), false);
  });

  it("returns true when a post-guardrail SLO cycle still records breaches", () => {
    const guardrail = makeForceCheckpointPayload({ appliedAt: "2026-04-25T10:00:00.000Z" });
    const slo = makeSloMetricsPayload({
      completedAt: "2026-04-25T11:00:00.000Z",
      sloBreaches: [{ metric: "verificationCompletionMs", severity: "critical" }],
    });
    assert.equal(hasFreshSloBreachEvidenceForForceCheckpoint(guardrail, slo), true);
  });

  it("returns false when a post-guardrail SLO cycle has no breaches", () => {
    const guardrail = makeForceCheckpointPayload({ appliedAt: "2026-04-25T10:00:00.000Z" });
    const slo = makeSloMetricsPayload({
      completedAt: "2026-04-25T11:00:00.000Z",
      sloBreaches: [],
    });
    assert.equal(hasFreshSloBreachEvidenceForForceCheckpoint(guardrail, slo), false);
  });
});

describe("autoRevertStaleSloGuardrail", () => {
  it("reverts a stuck guardrail when the triggering SLO cycle predates the guardrail itself", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-stale-guardrail-"));
    try {
      const config = { paths: { stateDir } };
      await writeStateFiles(stateDir, {
        guardrail: makeForceCheckpointPayload({ appliedAt: "2026-04-25T10:11:45.487Z" }),
        slo: makeSloMetricsPayload({
          completedAt: "2026-04-25T10:11:45.208Z",
          sloBreaches: [{ metric: "verificationCompletionMs", severity: "critical" }],
        }),
      });

      const result = await autoRevertStaleSloGuardrail(config);
      assert.equal(result.reverted, true);

      const after = await readForceCheckpointValidationContract(config);
      assert.equal(after.active, false);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("does not revert while a post-guardrail SLO cycle still records a breach", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-stale-guardrail-"));
    try {
      const config = { paths: { stateDir } };
      await writeStateFiles(stateDir, {
        guardrail: makeForceCheckpointPayload({ appliedAt: "2026-04-25T10:00:00.000Z" }),
        slo: makeSloMetricsPayload({
          completedAt: "2026-04-25T11:00:00.000Z",
          sloBreaches: [{ metric: "verificationCompletionMs", severity: "critical" }],
        }),
      });

      const result = await autoRevertStaleSloGuardrail(config);
      assert.equal(result.reverted, false);
      assert.equal(result.reason, "fresh_slo_breach_evidence_present");

      const after = await readForceCheckpointValidationContract(config);
      assert.equal(after.active, true);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("is a noop when the guardrail is already inactive", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-stale-guardrail-"));
    try {
      const config = { paths: { stateDir } };
      await writeStateFiles(stateDir, {
        guardrail: makeForceCheckpointPayload({ enabled: false, revertedAt: "2026-04-25T11:00:00.000Z" }),
        slo: null,
      });

      const result = await autoRevertStaleSloGuardrail(config);
      assert.equal(result.reverted, false);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});
