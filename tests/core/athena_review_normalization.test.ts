import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAthenaReviewPayload,
  MANDATORY_ACTIONABLE_PACKET_FIELDS,
  PREMORTEM_RISK_LEVEL,
  validatePatchedPlan,
  normalizePatchedPlansForDispatch,
  revalidatePatchedPlansAfterNormalization,
  PATCHED_PLAN_REVALIDATION_REASON,
  correctBoundedPacketDefects,
  PACKET_DEFECT_CODE,
  buildQualityLaneVerdict,
  buildGovernanceLaneVerdict,
  mergeLaneVerdicts,
  LANE_MERGE_POLICY,
  computeGateBlockRiskFromSignals,
  GATE_BLOCK_RISK,
  runAthenaPostmortem,
  buildPatchedPlanCorrectionTracking,
  PATCHED_PLAN_MUTATION_KIND,
} from "../../src/core/athena_reviewer.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE_PLANS = [
  {
    role: "evolution-worker",
    task: "Add deterministic dispatch verification coverage",
    verification: "npm test",
    target_files: ["src/core/orchestrator.js", "tests/core/orchestrator.test.ts"],
    acceptance_criteria: ["dispatch path is covered"],
    riskLevel: "low",
  },
  {
    role: "evolution-worker",
    task: "Strengthen scheduler contract validation",
    verification: "node --test tests/core/scheduler.test.ts",
    target_files: ["src/core/scheduler.js"],
    acceptance_criteria: ["invalid contract blocks execution"],
    riskLevel: PREMORTEM_RISK_LEVEL.HIGH,
    premortem: {
      riskLevel: "high",
      scenario: "Scheduler contract refactor could silently accept malformed work packets during dispatch.",
      failurePaths: ["Invalid packets bypass validation"],
      mitigations: ["Keep validator checks explicit"],
      detectionSignals: ["Contract tests begin failing"],
      guardrails: ["Reject malformed packets before dispatch"],
      rollbackPlan: "Revert scheduler validation changes"
    }
  }
];

describe("normalizeAthenaReviewPayload", () => {
  it("synthesizes reviewer contract fields when Athena omits them", () => {
    const normalized = normalizeAthenaReviewPayload({
      summary: "Approved. Plan is measurable and ready for execution."
    }, BASE_PLANS);

    assert.equal(normalized.payload.approved, true);
    assert.deepEqual(normalized.payload.corrections, []);
    assert.equal(normalized.payload.planReviews.length, BASE_PLANS.length);
    assert.ok(normalized.synthesizedFields.includes("approved"));
    assert.ok(normalized.synthesizedFields.includes("corrections"));
    assert.ok(normalized.synthesizedFields.includes("planReviews"));
  });

  it("derives corrections from plan review issues and stays fail-closed", () => {
    const normalized = normalizeAthenaReviewPayload({
      planReviews: [
        {
          planIndex: 0,
          role: "evolution-worker",
          measurable: false,
          successCriteriaClear: true,
          verificationConcrete: true,
          scopeDefined: true,
          preMortemComplete: true,
          issues: ["task is still vague"],
          suggestion: "name the exact contract"
        }
      ],
      summary: "Plan still needs work."
    }, BASE_PLANS);

    assert.equal(normalized.payload.approved, false);
    assert.equal(normalized.payload.corrections.length, 1);
    assert.match(normalized.payload.corrections[0], /task is still vague/i);
    assert.ok(normalized.synthesizedFields.includes("approved"));
    assert.ok(normalized.synthesizedFields.includes("corrections"));
  });

  it("accepts nested decision payloads and normalizes alias fields", () => {
    const normalized = normalizeAthenaReviewPayload({
      decision: {
        status: "approved",
        plan_reviews: [
          {
            role: "evolution-worker",
            issues: []
          }
        ],
        reason: "All critical gates passed."
      }
    }, BASE_PLANS);

    assert.equal(normalized.payload.approved, true);
    assert.equal(normalized.payload.planReviews.length, 1);
    assert.equal(normalized.payload.summary, "All critical gates passed.");
    assert.ok(normalized.synthesizedFields.includes("approved"));
    assert.ok(normalized.synthesizedFields.includes("corrections"));
    assert.ok(normalized.synthesizedFields.includes("planReviews"));
  });

  it("fails closed when reviewer status is blocked, even if summary text sounds positive", () => {
    const normalized = normalizeAthenaReviewPayload({
      status: "blocked",
      planReviews: [
        {
          planIndex: 0,
          role: "evolution-worker",
          measurable: true,
          issues: []
        }
      ],
      summary: "Looks good overall."
    }, BASE_PLANS);

    assert.equal(normalized.payload.approved, false);
    assert.deepEqual(normalized.payload.corrections, []);
  });

  // ── MANDATORY_ACTIONABLE_PACKET_FIELDS ────────────────────────────────────

  it("exports MANDATORY_ACTIONABLE_PACKET_FIELDS as a frozen array with approved and planReviews", () => {
    assert.ok(Object.isFrozen(MANDATORY_ACTIONABLE_PACKET_FIELDS), "must be frozen");
    assert.ok(MANDATORY_ACTIONABLE_PACKET_FIELDS.includes("approved"));
    assert.ok(MANDATORY_ACTIONABLE_PACKET_FIELDS.includes("planReviews"));
  });

  // ── missingFields tracking ────────────────────────────────────────────────

  it("populates missingFields when both approved and planReviews are absent from the AI response", () => {
    const normalized = normalizeAthenaReviewPayload({
      summary: "Everything looks good."
    }, BASE_PLANS);

    assert.ok(Array.isArray(normalized.missingFields), "missingFields must be an array");
    assert.ok(normalized.missingFields.includes("approved"), "approved must be in missingFields when only summary is present");
    assert.ok(normalized.missingFields.includes("planReviews"), "planReviews must be in missingFields when absent");
  });

  it("does NOT populate missingFields when an explicit boolean approved is provided", () => {
    const normalized = normalizeAthenaReviewPayload({
      approved: true,
      planReviews: [{ planIndex: 0, role: "evolution-worker", issues: [] }]
    }, BASE_PLANS);

    assert.ok(!normalized.missingFields.includes("approved"), "approved must NOT be in missingFields when explicit boolean is given");
    assert.ok(!normalized.missingFields.includes("planReviews"), "planReviews must NOT be in missingFields when array is provided");
  });

  it("does NOT add approved to missingFields when an unambiguous status alias is used", () => {
    const normalized = normalizeAthenaReviewPayload({
      status: "approved",
      planReviews: [{ planIndex: 0, role: "evolution-worker", issues: [] }]
    }, BASE_PLANS);

    assert.ok(!normalized.missingFields.includes("approved"),
      "approved must NOT be in missingFields when status='approved' alias is provided");
  });

  it("does NOT add approved to missingFields when status is a rejection alias", () => {
    const normalized = normalizeAthenaReviewPayload({
      status: "rejected",
      planReviews: [{ planIndex: 0, role: "evolution-worker", issues: [] }]
    }, BASE_PLANS);

    assert.ok(!normalized.missingFields.includes("approved"),
      "approved must NOT be in missingFields when status='rejected' alias is provided");
  });

  it("does NOT add planReviews to missingFields when plan_reviews alias is used", () => {
    const normalized = normalizeAthenaReviewPayload({
      approved: false,
      plan_reviews: [{ planIndex: 0, role: "evolution-worker", issues: ["vague task"] }]
    }, BASE_PLANS);

    assert.ok(!normalized.missingFields.includes("planReviews"),
      "planReviews must NOT be in missingFields when plan_reviews alias is present");
  });

  it("only adds to missingFields the fields that are genuinely absent — not those aliased", () => {
    // planReviews provided as alias (plan_reviews) but approved truly missing (only in summary text)
    const normalized = normalizeAthenaReviewPayload({
      plan_reviews: [{ planIndex: 0, role: "evolution-worker", issues: [] }],
      summary: "Looks good — approved."
    }, BASE_PLANS);

    assert.ok(normalized.missingFields.includes("approved"),
      "approved must be in missingFields when only inferred from summary text");
    assert.ok(!normalized.missingFields.includes("planReviews"),
      "planReviews must NOT be in missingFields when plan_reviews alias is present");
  });
});

describe("computeGateBlockRiskFromSignals", () => {
  it("returns high risk when freeze is active", () => {
    const result = computeGateBlockRiskFromSignals({ freezeActive: true });
    assert.equal(result.gateBlockRisk, GATE_BLOCK_RISK.HIGH);
    assert.equal(result.requiresCorrection, true);
    assert.ok(result.activeGateSignals.includes("governance_freeze_active"));
  });

  it("returns high risk when canary breach is active", () => {
    const result = computeGateBlockRiskFromSignals({ canaryBreachActive: true });
    assert.equal(result.gateBlockRisk, GATE_BLOCK_RISK.HIGH);
    assert.equal(result.requiresCorrection, true);
    assert.ok(result.activeGateSignals.includes("governance_canary_breach"));
  });

  it("returns medium risk when only critical debt gate is blocking", () => {
    const result = computeGateBlockRiskFromSignals({ criticalDebtBlocked: true });
    assert.equal(result.gateBlockRisk, GATE_BLOCK_RISK.MEDIUM);
    assert.equal(result.requiresCorrection, true);
    assert.ok(result.activeGateSignals.includes("critical_debt_overdue"));
  });

  it("returns high risk when force-checkpoint validation is active", () => {
    const result = computeGateBlockRiskFromSignals({ forceCheckpointActive: true });
    assert.equal(result.gateBlockRisk, GATE_BLOCK_RISK.HIGH);
    assert.equal(result.requiresCorrection, true);
    assert.ok(result.activeGateSignals.includes("force_checkpoint_validation_active"));
  });

  it("returns low risk when no gate blockers are active", () => {
    const result = computeGateBlockRiskFromSignals({});
    assert.equal(result.gateBlockRisk, GATE_BLOCK_RISK.LOW);
    assert.equal(result.requiresCorrection, false);
    assert.equal(result.activeGateSignals.length, 0);
  });
});

describe("runAthenaPostmortem — recurrence weighted intervention metadata", () => {
  it("writes recurrence-weighted closure fields to persisted postmortem", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-postmortem-meta-"));
    try {
      const config = {
        paths: { stateDir, progressFile: path.join(stateDir, "progress.log"), policyFile: path.join(stateDir, "policy.json") },
        env: { targetRepo: "CanerDoqdu/Box", copilotCliCommand: "__missing_copilot_binary__" },
        roleRegistry: { qualityReviewer: { name: "Athena", model: "GPT-5.3-Codex" } },
        athena: { forceAiPostmortem: false },
      };
      const workerResult = {
        roleName: "quality-worker",
        status: "done",
        summary: "All checks passed cleanly for deterministic lane update.",
        verificationPassed: true,
        verificationEvidence: { lint: "pass", tests: "pass", build: "pass" },
        preReviewIssues: [],
      };
      const originalPlan = {
        task: "Harden postmortem closure tracking",
        riskLevel: "low",
      };
      const result: any = await runAthenaPostmortem(config as any, workerResult as any, originalPlan as any);
      assert.ok(typeof result.recurrenceWeightedPriority === "number");
      assert.ok(typeof result.interventionId === "string");
      assert.ok(["open", "closed"].includes(String(result.interventionClosureStatus)));
      assert.ok("interventionDuplicateSuppressed" in result);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});

// ── Task 3: Patched-plan validation gate ──────────────────────────────────────

describe("validatePatchedPlan (Task 3)", () => {
  it("passes a well-formed patched plan", () => {
    const result = validatePatchedPlan({
      target_files: ["src/core/orchestrator.ts"],
      scope: "src/core/",
      acceptance_criteria: ["CI passes", "Tests green"],
    });
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 0);
  });

  it("fails when target_files is missing", () => {
    const result = validatePatchedPlan({ scope: "src/core/", acceptance_criteria: ["test passes"] });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => /target_files/i.test(i)));
  });

  it("fails when target_files is an empty array", () => {
    const result = validatePatchedPlan({ target_files: [], scope: "src/", acceptance_criteria: ["test passes"] });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => /target_files/i.test(i)));
  });

  it("fails when target_files contains '...' placeholder", () => {
    const result = validatePatchedPlan({
      target_files: ["src/core/foo.ts", "..."],
      scope: "src/core/",
      acceptance_criteria: ["test passes"],
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => /placeholder/i.test(i)));
  });

  it("fails when target_files contains '<placeholder>' style", () => {
    const result = validatePatchedPlan({
      target_files: ["<path/to/file.ts>"],
      scope: "src/",
      acceptance_criteria: ["test passes"],
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => /placeholder/i.test(i)));
  });

  it("fails when target_files contains 'path/to/' generic prefix", () => {
    const result = validatePatchedPlan({
      target_files: ["path/to/module.ts"],
      scope: "src/",
      acceptance_criteria: ["passes"],
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => /placeholder/i.test(i)));
  });

  it("fails when scope is missing", () => {
    const result = validatePatchedPlan({ target_files: ["src/core/foo.ts"], acceptance_criteria: ["test"] });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => /scope/i.test(i)));
  });

  it("fails when acceptance_criteria is empty", () => {
    const result = validatePatchedPlan({ target_files: ["src/core/foo.ts"], scope: "src/core/", acceptance_criteria: [] });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => /acceptance_criteria/i.test(i)));
  });

  it("negative path: non-object plan is invalid", () => {
    const result = validatePatchedPlan("not an object");
    assert.equal(result.valid, false);
    assert.ok(result.issues.length > 0);
  });

  it("accepts targetFiles alias for target_files", () => {
    const result = validatePatchedPlan({
      targetFiles: ["src/core/foo.ts"],
      scope: "src/core/",
      acceptance_criteria: ["passes"],
    });
    assert.equal(result.valid, true);
  });
});

// ── Task 2: normalizePatchedPlansForDispatch — handoff normalization ───────────

describe("normalizePatchedPlansForDispatch", () => {
  it("returns empty array for non-array input", () => {
    assert.deepEqual(normalizePatchedPlansForDispatch(null as any), []);
    assert.deepEqual(normalizePatchedPlansForDispatch(undefined as any), []);
  });

  it("ensures dependencies is an array when missing", () => {
    const result = normalizePatchedPlansForDispatch([
      { task: "do something", role: "evolution-worker", wave: 1, target_files: ["src/x.ts"], scope: "src/", acceptance_criteria: ["test passes"] }
    ]);
    assert.ok(Array.isArray(result[0].dependencies), "dependencies must be an array");
    assert.deepEqual(result[0].dependencies, []);
  });

  it("preserves existing dependencies array without modification", () => {
    const result = normalizePatchedPlansForDispatch([
      { task: "do something", role: "evolution-worker", wave: 1, dependencies: ["T-001"], target_files: ["src/x.ts"], scope: "src/", acceptance_criteria: ["test passes"] }
    ]);
    assert.deepEqual(result[0].dependencies, ["T-001"]);
  });

  it("sets role to evolution-worker when missing or empty", () => {
    const missing = normalizePatchedPlansForDispatch([
      { task: "x", wave: 1, target_files: ["src/x.ts"], scope: "src/", acceptance_criteria: ["done"] }
    ]);
    assert.equal(missing[0].role, "evolution-worker");

    const empty = normalizePatchedPlansForDispatch([
      { task: "x", role: "", wave: 1, target_files: ["src/x.ts"], scope: "src/", acceptance_criteria: ["done"] }
    ]);
    assert.equal(empty[0].role, "evolution-worker");
  });

  it("preserves explicit role when provided", () => {
    const result = normalizePatchedPlansForDispatch([
      { task: "x", role: "athena", wave: 1, target_files: ["src/x.ts"], scope: "src/", acceptance_criteria: ["done"] }
    ]);
    assert.equal(result[0].role, "athena");
  });

  it("normalizes wave to 1 when invalid or missing", () => {
    const noWave = normalizePatchedPlansForDispatch([
      { task: "x", role: "evolution-worker", target_files: ["src/x.ts"], scope: "src/", acceptance_criteria: ["done"] }
    ]);
    assert.equal(noWave[0].wave, 1);

    const zeroWave = normalizePatchedPlansForDispatch([
      { task: "x", role: "evolution-worker", wave: 0, target_files: ["src/x.ts"], scope: "src/", acceptance_criteria: ["done"] }
    ]);
    assert.equal(zeroWave[0].wave, 1);
  });

  it("preserves valid wave value", () => {
    const result = normalizePatchedPlansForDispatch([
      { task: "x", role: "evolution-worker", wave: 3, target_files: ["src/x.ts"], scope: "src/", acceptance_criteria: ["done"] }
    ]);
    assert.equal(result[0].wave, 3);
  });

  it("normalises targetFiles alias to target_files", () => {
    const result = normalizePatchedPlansForDispatch([
      { task: "x", role: "evolution-worker", wave: 1, targetFiles: ["src/y.ts"], scope: "src/", acceptance_criteria: ["done"] }
    ]);
    assert.deepEqual(result[0].target_files, ["src/y.ts"]);
  });

  it("is idempotent — applying twice produces the same result", () => {
    const input = [
      { task: "fix", role: "evolution-worker", wave: 2, target_files: ["src/a.ts"], scope: "src/", acceptance_criteria: ["done"], dependencies: ["T-1"] }
    ];
    const once = normalizePatchedPlansForDispatch(input);
    const twice = normalizePatchedPlansForDispatch(once);
    assert.deepEqual(once[0].dependencies, twice[0].dependencies);
    assert.equal(once[0].role, twice[0].role);
    assert.equal(once[0].wave, twice[0].wave);
  });

  it("negative path: non-object entries are passed through without throwing", () => {
    assert.doesNotThrow(() => {
      const result = normalizePatchedPlansForDispatch([null, undefined, "string"] as any[]);
      assert.ok(Array.isArray(result));
    });
  });
});

// ── Task 3: revalidatePatchedPlansAfterNormalization ─────────────────────────

describe("revalidatePatchedPlansAfterNormalization (Task 3)", () => {
  it("returns valid=true and code=OK for empty plans array", () => {
    const result = revalidatePatchedPlansAfterNormalization([]);
    assert.equal(result.valid, true);
    assert.equal(result.code, PATCHED_PLAN_REVALIDATION_REASON.OK);
    assert.deepEqual(result.violations, []);
  });

  it("passes a fully valid normalized plan", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "Implement deterministic dispatch verification",
        role: "evolution-worker",
        wave: 1,
        target_files: ["src/core/orchestrator.ts"],
        scope: "src/core/",
        acceptance_criteria: ["Verification passes"],
        verification: "npm test",
        dependencies: [],
      }
    ]);
    assert.equal(result.valid, true);
    assert.equal(result.code, PATCHED_PLAN_REVALIDATION_REASON.OK);
    assert.deepEqual(result.violations, []);
  });

  it("fails when task is missing or too short", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "bad",
        role: "evolution-worker",
        wave: 1,
        target_files: ["src/core/foo.ts"],
        scope: "src/",
        acceptance_criteria: ["done"],
      }
    ]);
    assert.equal(result.valid, false);
    assert.equal(result.code, PATCHED_PLAN_REVALIDATION_REASON.FAILED);
    assert.ok(result.violations.some(v => /task.*short/i.test(v)));
  });

  it("fails when target_files is empty after normalization", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "Fix the scheduler contract validation",
        role: "evolution-worker",
        wave: 1,
        target_files: [],
        scope: "src/core/",
        acceptance_criteria: ["Validation passes"],
      }
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => /target_files.*empty/i.test(v)));
  });

  it("fails when scope is empty after normalization", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "Fix the scheduler contract",
        role: "evolution-worker",
        wave: 1,
        target_files: ["src/core/foo.ts"],
        scope: "",
        acceptance_criteria: ["passes"],
      }
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => /scope.*empty/i.test(v)));
  });

  it("fails when acceptance_criteria is empty after normalization", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "Fix the scheduler contract",
        role: "evolution-worker",
        wave: 1,
        target_files: ["src/core/foo.ts"],
        scope: "src/core/",
        acceptance_criteria: [],
      }
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => /acceptance_criteria.*empty/i.test(v)));
  });

  it("fails when verification field is a forbidden command (shell glob)", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "Fix the scheduler contract validation",
        role: "evolution-worker",
        wave: 1,
        target_files: ["src/core/foo.ts"],
        scope: "src/core/",
        acceptance_criteria: ["CI passes"],
        verification: "node --test tests/**/*.test.ts",
      }
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => /forbidden command/i.test(v)));
  });

  it("fails when verification field is a bash script invocation", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "Fix the scheduler contract validation",
        role: "evolution-worker",
        wave: 1,
        target_files: ["src/core/foo.ts"],
        scope: "src/core/",
        acceptance_criteria: ["CI passes"],
        verification: "bash scripts/run_tests.sh",
      }
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => /forbidden command/i.test(v)));
  });

  it("collects violations from multiple failing plans", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "ok",  // too short
        role: "evolution-worker",
        wave: 1,
        target_files: ["src/a.ts"],
        scope: "src/",
        acceptance_criteria: ["done"],
      },
      {
        task: "Another valid task description",
        role: "evolution-worker",
        wave: 1,
        target_files: [],  // empty
        scope: "src/",
        acceptance_criteria: ["done"],
      }
    ]);
    assert.equal(result.valid, false);
    assert.equal(result.violations.length, 2, "each failing plan must produce one violation entry");
  });

  it("exports PATCHED_PLAN_REVALIDATION_REASON with OK and FAILED codes", () => {
    assert.equal(PATCHED_PLAN_REVALIDATION_REASON.OK, "OK");
    assert.equal(PATCHED_PLAN_REVALIDATION_REASON.FAILED, "PATCHED_PLAN_CONTRACT_FAILED");
  });

  it("negative path: non-object plan entry is flagged as violation", () => {
    const result = revalidatePatchedPlansAfterNormalization(["not-an-object"] as any[]);
    assert.equal(result.valid, false);
    assert.ok(result.violations.some(v => /not an object/i.test(v)));
  });

  it("passes when verification field is absent (optional field)", () => {
    const result = revalidatePatchedPlansAfterNormalization([
      {
        task: "Implement deterministic plan dispatch",
        role: "evolution-worker",
        wave: 2,
        target_files: ["src/core/orchestrator.ts"],
        scope: "src/core/",
        acceptance_criteria: ["Dispatch succeeds"],
        dependencies: ["T-001"],
        // verification is intentionally absent
      }
    ]);
    assert.equal(result.valid, true, "absent verification field must not cause a violation");
  });
});

// ── correctBoundedPacketDefects ───────────────────────────────────────────────

const LOW_RISK_PLANS_ONLY = [
  {
    role: "evolution-worker",
    task: "Add deterministic dispatch verification coverage",
    verification: "npm test",
    target_files: ["src/core/orchestrator.js"],
    acceptance_criteria: ["dispatch path is covered"],
    riskLevel: "low",
  },
];

describe("correctBoundedPacketDefects", () => {
  it("exports PACKET_DEFECT_CODE with expected codes", () => {
    assert.ok(Object.isFrozen(PACKET_DEFECT_CODE), "PACKET_DEFECT_CODE must be frozen");
    assert.equal(PACKET_DEFECT_CODE.MISSING_APPROVED_REVIEWSPASSED, "MISSING_APPROVED_REVIEWSPASSED");
    assert.equal(PACKET_DEFECT_CODE.MISSING_PLAN_REVIEWS_LOWRISK, "MISSING_PLAN_REVIEWS_LOWRISK");
  });

  it("corrects missing approved when all explicit planReviews are issue-free (MISSING_APPROVED_REVIEWSPASSED)", () => {
    const normalized = normalizeAthenaReviewPayload({
      planReviews: [
        { planIndex: 0, role: "evolution-worker", measurable: true, issues: [] },
      ],
      summary: "Plans reviewed and ready.",
    }, LOW_RISK_PLANS_ONLY);

    assert.ok(normalized.missingFields.includes("approved"),
      "pre-condition: approved must be in missingFields when only inferred from reviews");

    const correction = correctBoundedPacketDefects(normalized, LOW_RISK_PLANS_ONLY);

    assert.equal(correction.corrected, true, "defect must be corrected");
    assert.ok(correction.correctedFields.includes("approved"), "approved must be in correctedFields");
    assert.ok(correction.defectCodes.includes(PACKET_DEFECT_CODE.MISSING_APPROVED_REVIEWSPASSED));
    assert.equal(correction.updatedPayload.approved, true, "corrected payload must have approved=true");
    assert.ok(!correction.updatedMissingFields.includes("approved"),
      "approved must be removed from updatedMissingFields after correction");
  });

  it("does NOT correct approved when planReviews have issues (ambiguous — cannot auto-approve)", () => {
    const normalized = normalizeAthenaReviewPayload({
      planReviews: [
        { planIndex: 0, role: "evolution-worker", measurable: false, issues: ["task description is vague"] },
      ],
      summary: "Issues found.",
    }, LOW_RISK_PLANS_ONLY);

    const correction = correctBoundedPacketDefects(normalized, LOW_RISK_PLANS_ONLY);

    assert.equal(correction.corrected, false,
      "approved must not be auto-corrected when planReviews contain issues");
    assert.ok(!correction.correctedFields.includes("approved"));
  });

  it("does NOT correct approved when planReviews is an empty array (no evidence to back approval)", () => {
    const normalized = normalizeAthenaReviewPayload({
      planReviews: [],
      summary: "No reviews provided.",
    }, LOW_RISK_PLANS_ONLY);

    const correction = correctBoundedPacketDefects(normalized, LOW_RISK_PLANS_ONLY);

    // planReviews present (empty array) but no reviews → cannot auto-approve from zero evidence
    assert.ok(!correction.correctedFields.includes("approved"),
      "approved must not be auto-corrected from an empty planReviews array");
  });

  it("corrects missing planReviews when approved is explicit and all plans are low-risk (MISSING_PLAN_REVIEWS_LOWRISK)", () => {
    const normalized = normalizeAthenaReviewPayload({
      approved: true,
      summary: "All plans look good.",
    }, LOW_RISK_PLANS_ONLY);

    assert.ok(normalized.missingFields.includes("planReviews"),
      "pre-condition: planReviews must be in missingFields when absent from AI response");

    const correction = correctBoundedPacketDefects(normalized, LOW_RISK_PLANS_ONLY);

    assert.equal(correction.corrected, true, "defect must be corrected for low-risk plans");
    assert.ok(correction.correctedFields.includes("planReviews"), "planReviews must be in correctedFields");
    assert.ok(correction.defectCodes.includes(PACKET_DEFECT_CODE.MISSING_PLAN_REVIEWS_LOWRISK));
    assert.ok(!correction.updatedMissingFields.includes("planReviews"),
      "planReviews must be removed from updatedMissingFields after correction");
  });

  it("does NOT correct planReviews when any plan has riskLevel=high (high-risk requires explicit AI reviews)", () => {
    // BASE_PLANS contains a high-risk plan
    const normalized = normalizeAthenaReviewPayload({
      approved: true,
      summary: "Plans approved.",
    }, BASE_PLANS);

    const correction = correctBoundedPacketDefects(normalized, BASE_PLANS);

    assert.equal(correction.correctedFields.includes("planReviews"), false,
      "planReviews must not be auto-corrected when any plan has riskLevel=high");
  });

  it("negative path: returns corrected=false when both approved and planReviews are missing", () => {
    const normalized = normalizeAthenaReviewPayload({
      summary: "Everything looks great.",
    }, LOW_RISK_PLANS_ONLY);

    assert.ok(normalized.missingFields.includes("approved"), "pre-condition");
    assert.ok(normalized.missingFields.includes("planReviews"), "pre-condition");

    const correction = correctBoundedPacketDefects(normalized, LOW_RISK_PLANS_ONLY);

    assert.equal(correction.corrected, false,
      "both fields missing is a structural failure — not a bounded defect, must not be auto-corrected");
    assert.deepEqual(correction.correctedFields, []);
    assert.deepEqual(correction.defectCodes, []);
    assert.ok(correction.updatedMissingFields.includes("approved"));
    assert.ok(correction.updatedMissingFields.includes("planReviews"));
  });

  it("updatedMissingFields only removes corrected fields, leaving others intact", () => {
    const normalized = normalizeAthenaReviewPayload({
      planReviews: [{ planIndex: 0, role: "evolution-worker", measurable: true, issues: [] }],
      summary: "Looks good.",
    }, LOW_RISK_PLANS_ONLY);

    const correction = correctBoundedPacketDefects(normalized, LOW_RISK_PLANS_ONLY);

    if (correction.corrected) {
      for (const f of correction.correctedFields) {
        assert.ok(!correction.updatedMissingFields.includes(f),
          `corrected field '${f}' must not remain in updatedMissingFields`);
      }
    }
  });
});

describe("buildPatchedPlanCorrectionTracking", () => {
  it("emits ABSENT_PLAN_RECONSTRUCTED mutation and preserves legacy correction string", () => {
    const tracking = buildPatchedPlanCorrectionTracking(
      [],
      [{
        role: "quality-worker",
        task: "Reconstructed plan",
        acceptance_criteria: ["build passes"],
      }] as any[]
    );

    assert.equal(tracking.mutationEvents.length, 1);
    assert.equal(tracking.mutationEvents[0].kind, PATCHED_PLAN_MUTATION_KIND.ABSENT_PLAN_RECONSTRUCTED);
    assert.ok(
      tracking.legacyCorrections.some((entry) => entry.includes("reconstructed from absent original plan")),
      "legacy correction string must still be emitted for absent-plan reconstruction",
    );
  });

  it("emits VERIFICATION_PROSE_REWRITTEN mutation when prose verification becomes executable command", () => {
    const tracking = buildPatchedPlanCorrectionTracking(
      [{
        verification: "verify behavior manually in local run",
        acceptance_criteria: ["tests pass"],
      }] as any[],
      [{
        verification: "npm test -- tests/core/athena_failclosed.test.ts",
        acceptance_criteria: ["tests pass"],
      }] as any[]
    );

    assert.ok(
      tracking.mutationEvents.some((event) => event.kind === PATCHED_PLAN_MUTATION_KIND.VERIFICATION_PROSE_REWRITTEN),
      "verification prose rewrite must emit structured mutation event",
    );
    assert.ok(
      tracking.legacyCorrections.some((entry) => entry.includes("verification rewritten from prose")),
      "legacy string correction must be preserved for verification rewrite",
    );
  });

  it("emits FORWARD_LOOKING_CRITERION_DEFERRED mutation when criteria are deferred to a future cycle", () => {
    const tracking = buildPatchedPlanCorrectionTracking(
      [{
        verification: "npm test -- tests/core/athena_review_normalization.test.ts",
        acceptance_criteria: ["All fixes are shipped in this cycle"],
      }] as any[],
      [{
        verification: "npm test -- tests/core/athena_review_normalization.test.ts",
        acceptance_criteria: ["Follow-up validation deferred to next cycle after release"],
      }] as any[]
    );

    assert.ok(
      tracking.mutationEvents.some((event) => event.kind === PATCHED_PLAN_MUTATION_KIND.FORWARD_LOOKING_CRITERION_DEFERRED),
      "forward-looking criterion deferrals must emit structured mutation events",
    );
    assert.ok(
      tracking.legacyCorrections.some((entry) => entry.includes("forward-looking deferral")),
      "legacy correction string must remain present for deferred criteria",
    );
  });
});

// ── Dual-lane verdict normalization contract ──────────────────────────────────

describe("buildQualityLaneVerdict — lane structure contract", () => {
  const VALID_PLAN = {
    role: "evolution-worker",
    task: "Add deterministic dispatch verification coverage for worker execution",
    verification: "npm test",
    wave: 1,
    riskLevel: "low",
    capacityDelta: 0.1,
    requestROI: 2.0,
  };

  it("returns a LaneVerdict with lane='quality'", () => {
    const v = buildQualityLaneVerdict([VALID_PLAN]);
    assert.equal(v.lane, "quality");
  });

  it("verdict has required shape: approved, score, summary, issues, reason", () => {
    const v = buildQualityLaneVerdict([VALID_PLAN]);
    assert.ok(typeof v.approved === "boolean", "approved must be boolean");
    assert.ok(typeof v.score === "number", "score must be number");
    assert.ok(typeof v.summary === "string", "summary must be string");
    assert.ok(Array.isArray(v.issues), "issues must be array");
    // reason is null on success, object on failure
    assert.ok(v.reason === null || typeof v.reason === "object");
  });

  it("score is in [0, 100]", () => {
    const v = buildQualityLaneVerdict([VALID_PLAN]);
    assert.ok(v.score >= 0 && v.score <= 100, "score must be in [0,100]");
  });

  it("issues is empty when approved=true", () => {
    const v = buildQualityLaneVerdict([VALID_PLAN]);
    if (v.approved) {
      assert.deepEqual(v.issues, []);
    }
  });

  it("reason is null when approved=true", () => {
    const v = buildQualityLaneVerdict([VALID_PLAN]);
    if (v.approved) {
      assert.equal(v.reason, null);
    }
  });

  it("reason.code is a non-empty string when approved=false", () => {
    const badPlan = { ...VALID_PLAN, task: "x", verification: "" };
    const v = buildQualityLaneVerdict([badPlan]);
    if (!v.approved) {
      assert.ok(v.reason !== null, "reason must be set on rejection");
      assert.ok(typeof v.reason!.code === "string" && v.reason!.code.length > 0);
      assert.ok(typeof v.reason!.message === "string");
    }
  });
});

describe("buildGovernanceLaneVerdict — lane structure contract", () => {
  const LOW_RISK_PLAN = {
    role: "evolution-worker",
    task: "Add retry logic to worker dispatch",
    verification: "npm test",
    wave: 1,
    riskLevel: "low",
  };

  it("returns a LaneVerdict with lane='governance'", () => {
    const v = buildGovernanceLaneVerdict([LOW_RISK_PLAN]);
    assert.equal(v.lane, "governance");
  });

  it("verdict has required shape: approved, score, summary, issues, reason", () => {
    const v = buildGovernanceLaneVerdict([LOW_RISK_PLAN]);
    assert.ok(typeof v.approved === "boolean");
    assert.ok(typeof v.score === "number");
    assert.ok(typeof v.summary === "string");
    assert.ok(Array.isArray(v.issues));
    assert.ok(v.reason === null || typeof v.reason === "object");
  });

  it("score is 100 when all governance checks pass", () => {
    const v = buildGovernanceLaneVerdict([LOW_RISK_PLAN]);
    assert.equal(v.score, 100);
  });

  it("high-risk plan without premortem gets a reduced score below 100", () => {
    const highRisk = { ...LOW_RISK_PLAN, riskLevel: "high" };
    const v = buildGovernanceLaneVerdict([highRisk]);
    assert.ok(v.score < 100, "governance score must be less than 100 when premortem missing");
  });
});

describe("mergeLaneVerdicts — output contract", () => {
  function makeVerdict(lane: "quality" | "governance", approved: boolean): any {
    return { lane, approved, score: 90, summary: "ok", issues: [], reason: null };
  }

  it("output always has approved, laneA, laneB, mergePolicy, mergeReason", () => {
    const result = mergeLaneVerdicts(makeVerdict("quality", true), makeVerdict("governance", true));
    assert.ok("approved" in result);
    assert.ok("laneA" in result);
    assert.ok("laneB" in result);
    assert.ok("mergePolicy" in result);
    assert.ok("mergeReason" in result);
  });

  it("laneA and laneB are the original verdict objects (not copies)", () => {
    const qa = makeVerdict("quality", true);
    const gb = makeVerdict("governance", false);
    const result = mergeLaneVerdicts(qa, gb, LANE_MERGE_POLICY.MUST_PASS_BOTH);
    assert.strictEqual(result.laneA, qa, "laneA must be the original quality verdict");
    assert.strictEqual(result.laneB, gb, "laneB must be the original governance verdict");
  });

  it("mergePolicy matches the policy argument", () => {
    const result = mergeLaneVerdicts(makeVerdict("quality", true), makeVerdict("governance", true), LANE_MERGE_POLICY.ANY_PASS);
    assert.equal(result.mergePolicy, LANE_MERGE_POLICY.ANY_PASS);
  });
});

