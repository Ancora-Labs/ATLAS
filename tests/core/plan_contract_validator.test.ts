import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validatePlanContract,
  validateAllPlans,
  PLAN_VIOLATION_SEVERITY,
  PACKET_VIOLATION_CODE,
  isNonSpecificVerification,
  isAmbiguousTask,
  isCycleSpecificExclusionJustification,
  MANDATORY_EXCLUSION_JUSTIFICATION_MIN_LENGTH,
  AMBIGUOUS_TASK_PATTERNS,
  MAX_ACCEPTANCE_CRITERIA_PER_TASK,
  MAX_FILES_IN_SCOPE_PER_TASK,
  EQUAL_DIMENSION_SET,
  normalizeLeverageRank,
  isPacketQuarantined,
  QUARANTINE_CONFIDENCE_THRESHOLD,
} from "../../src/core/plan_contract_validator.js";
import { checkForbiddenCommands } from "../../src/core/verification_command_registry.js";

describe("plan_contract_validator", () => {
  describe("normalizeLeverageRank", () => {
    it("maps aliases to canonical dimension set", () => {
      const normalized = normalizeLeverageRank(["quality", "learning loop", "routing", "security"]);
      assert.deepEqual(normalized, ["task-quality", "learning-loop", "model-task-fit", "security"]);
    });

    it("negative path: ignores unknown/empty values and deduplicates", () => {
      const normalized = normalizeLeverageRank(["", "unknown", "quality", "task-quality", "quality"]);
      assert.deepEqual(normalized, ["task-quality"]);
    });
  });

  describe("isNonSpecificVerification", () => {
    it("identifies bare npm test as non-specific", () => {
      assert.equal(isNonSpecificVerification("npm test"), true);
      assert.equal(isNonSpecificVerification("npm run test"), true);
      assert.equal(isNonSpecificVerification("npm run tests"), true);
      assert.equal(isNonSpecificVerification("node --test"), true);
      assert.equal(isNonSpecificVerification("run tests"), true);
    });

    it("identifies test file references as specific", () => {
      assert.equal(isNonSpecificVerification("tests/core/foo.test.ts — test: should return X"), false);
      assert.equal(isNonSpecificVerification("node --test tests/core/foo.test.ts"), false);
      assert.equal(isNonSpecificVerification("src/core/bar.spec.js"), false);
    });

    it("identifies description separators as specific", () => {
      assert.equal(isNonSpecificVerification("tests/core/auth.test.ts — test: login works"), false);
    });

    it("treats empty string as non-specific", () => {
      assert.equal(isNonSpecificVerification(""), true);
      assert.equal(isNonSpecificVerification("   "), true);
    });

    it("treats non-CLI descriptive text as specific (benefit of doubt)", () => {
      // Descriptive assertion text is not a bare CLI command
      assert.equal(isNonSpecificVerification("All integration tests pass when auth module is loaded"), false);
    });
  });

  describe("isCycleSpecificExclusionJustification", () => {
    it("accepts justifications meeting minimum cycle-specific length", () => {
      const text = "Blocked by governance freeze in this cycle.";
      assert.equal(isCycleSpecificExclusionJustification(text), true);
      assert.ok(text.trim().length >= MANDATORY_EXCLUSION_JUSTIFICATION_MIN_LENGTH);
    });

    it("negative path: rejects too-short justifications", () => {
      assert.equal(isCycleSpecificExclusionJustification("too short"), false);
      assert.equal(isCycleSpecificExclusionJustification("   "), false);
    });
  });

  describe("validatePlanContract", () => {
    it("accepts a fully valid plan with specific verification", () => {
      const plan = {
        task: "Implement user authentication module",
        role: "evolution-worker",
        wave: 1,
        verification: "tests/core/auth.test.ts — test: should authenticate user",
        dependencies: [],
        acceptance_criteria: ["All tests pass"],
        capacityDelta: 0.1,
        requestROI: 2.0,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, true);
      assert.equal(result.violations.length, 0);
    });

    it("rejects null plan", () => {
      const result = validatePlanContract(null);
      assert.equal(result.valid, false);
      assert.ok(result.violations.some(v => v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });

    it("rejects plan with short task", () => {
      const result = validatePlanContract({ task: "Fix", role: "worker", wave: 1, verification: "npm test" });
      assert.equal(result.valid, false);
      assert.ok(result.violations.some(v => v.field === "task"));
    });

    it("rejects plan with missing role", () => {
      const result = validatePlanContract({ task: "Implement something long enough", role: "", wave: 1, verification: "npm test" });
      assert.equal(result.valid, false);
      assert.ok(result.violations.some(v => v.field === "role"));
    });

    it("warns on missing wave", () => {
      const plan = { task: "Implement something long enough", role: "worker", verification: "tests/core/foo.test.ts — test: passes", dependencies: [], acceptance_criteria: ["pass"], capacityDelta: 0.1, requestROI: 1.5 };
      const result = validatePlanContract(plan);
      // wave warning is non-critical
      assert.ok(result.violations.some(v => v.field === "wave"));
    });

    it("warns on missing verification", () => {
      const plan = { task: "Implement something long enough", role: "worker", wave: 1, dependencies: [], acceptance_criteria: ["pass"], capacityDelta: 0.1, requestROI: 1.5 };
      const result = validatePlanContract(plan);
      assert.ok(result.violations.some(v => v.field === "verification"));
    });

    it("warns on missing dependencies", () => {
      const plan = { task: "Implement something long enough", role: "worker", wave: 1, verification: "tests/core/foo.test.ts — test: passes", acceptance_criteria: ["pass"], capacityDelta: 0.1, requestROI: 1.5 };
      const result = validatePlanContract(plan);
      assert.ok(result.violations.some(v => v.field === "dependencies"));
    });

    it("detects forbidden glob pattern", () => {
      const plan = {
        task: "Implement something long enough",
        role: "worker",
        wave: 1,
        verification: "node --test tests/**/*.test.ts",
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false);
      assert.ok(result.violations.some(v => v.field === "verification" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });

    it("rejects non-specific verification (npm test alone) as CRITICAL", () => {
      const plan = {
        task: "Implement something long enough",
        role: "worker",
        wave: 1,
        verification: "npm test",
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false, "plan with non-specific verification must be invalid");
      assert.ok(
        result.violations.some(v => v.field === "verification" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL),
        "must have a CRITICAL violation on the verification field"
      );
    });

    it("accepts specific verification with test file path", () => {
      const plan = {
        task: "Implement something long enough",
        role: "worker",
        wave: 1,
        verification: "tests/core/foo.test.ts — test: should pass validation",
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.ok(!result.violations.some(v => v.field === "verification" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL),
        "specific verification should not produce a CRITICAL violation");
    });

    it("accepts node --test with a specific test file as verification", () => {
      const plan = {
        task: "Implement something long enough here",
        role: "worker",
        wave: 1,
        verification: "node --test tests/core/foo.test.ts",
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.ok(!result.violations.some(v => v.field === "verification" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL),
        "node --test with specific file should not be CRITICAL");
    });

    it("rejects empty acceptance_criteria as CRITICAL (Packet 8)", () => {
      const plan = {
        task: "Implement something reasonably long",
        role: "worker",
        wave: 1,
        verification: "npm test",
        dependencies: [],
        acceptance_criteria: [],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false);
      assert.ok(result.violations.some(v => v.field === "acceptance_criteria" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });

    it("detects forbidden command via centralized check (Packet 5)", () => {
      const plan = {
        task: "Implement something long enough here",
        role: "worker",
        wave: 1,
        verification: "node --test src/**/*.test.ts",
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false);
      assert.ok(result.violations.some(v => v.field === "verification" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });

    it("detects forbidden command in verification_commands array", () => {
      const plan = {
        task: "Implement something long enough here",
        role: "worker",
        wave: 1,
        verification: "npm test",
        verification_commands: ["npm test", "node --test tests/**/*.test.ts"],
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false);
      assert.ok(result.violations.some(v => v.field === "verification_commands[1]" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });

    it("passes when all verification_commands are safe", () => {
      const plan = {
        task: "Implement something long enough here",
        role: "worker",
        wave: 1,
        verification: "tests/core/foo.test.ts — test: should pass with safe commands",
        verification_commands: ["npm test", "npm run lint"],
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, true);
    });

    it("detects forbidden command only in verification_commands when verification is clean", () => {
      const plan = {
        task: "Implement something long enough here",
        role: "worker",
        wave: 1,
        verification: "npm test",
        verification_commands: ["node --test src/**/*.test.ts"],
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false);
      assert.ok(result.violations.some(v => v.field === "verification_commands[0]" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });
  });

  describe("validatePlanContract — capacityDelta and requestROI (measurable packet scoring)", () => {
    it("rejects when capacityDelta is missing (CRITICAL)", () => {
      const plan = {
        task: "Implement something long enough",
        role: "worker",
        wave: 1,
        verification: "npm test",
        dependencies: [],
        acceptance_criteria: ["pass"],
        requestROI: 1.5,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false, "plan must be invalid without capacityDelta");
      assert.ok(result.violations.some(v => v.field === "capacityDelta" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });

    it("rejects when requestROI is missing (CRITICAL)", () => {
      const plan = {
        task: "Implement something long enough",
        role: "worker",
        wave: 1,
        verification: "npm test",
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.1,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false, "plan must be invalid without requestROI");
      assert.ok(result.violations.some(v => v.field === "requestROI" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });

    it("accepts valid capacityDelta at boundaries", () => {
      for (const delta of [-1.0, 0, 0.5, 1.0]) {
        const plan = {
          task: "Implement something long enough",
          role: "worker",
          wave: 1,
          verification: "npm test",
          dependencies: [],
          acceptance_criteria: ["pass"],
          capacityDelta: delta,
          requestROI: 2.0,
        };
        const result = validatePlanContract(plan);
        assert.ok(
          !result.violations.some(v => v.field === "capacityDelta"),
          `capacityDelta=${delta} should be accepted`
        );
      }
    });

    it("rejects when capacityDelta is out of range (CRITICAL)", () => {
      const plan = {
        task: "Implement something long enough",
        role: "worker",
        wave: 1,
        verification: "npm test",
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 1.5,
        requestROI: 1.0,
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false, "plan must be invalid with out-of-range capacityDelta");
      assert.ok(result.violations.some(v => v.field === "capacityDelta" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });

    it("rejects when requestROI is zero or negative (CRITICAL)", () => {
      for (const roi of [0, -0.5, -1]) {
        const plan = {
          task: "Implement something long enough",
          role: "worker",
          wave: 1,
          verification: "npm test",
          dependencies: [],
          acceptance_criteria: ["pass"],
          capacityDelta: 0.1,
          requestROI: roi,
        };
        const result = validatePlanContract(plan);
        assert.equal(result.valid, false, `plan must be invalid with requestROI=${roi}`);
        assert.ok(
          result.violations.some(v => v.field === "requestROI" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL),
          `requestROI=${roi} should produce a CRITICAL violation`
        );
      }
    });

    it("does not produce capacityDelta or requestROI warnings for fully-specified packets", () => {
      const plan = {
        task: "Implement something long enough",
        role: "worker",
        wave: 1,
        verification: "npm test",
        dependencies: [],
        acceptance_criteria: ["pass"],
        capacityDelta: 0.2,
        requestROI: 3.0,
      };
      const result = validatePlanContract(plan);
      assert.ok(!result.violations.some(v => v.field === "capacityDelta"), "no capacityDelta warning expected");
      assert.ok(!result.violations.some(v => v.field === "requestROI"), "no requestROI warning expected");
    });

    it("missing capacityDelta/requestROI makes an otherwise-valid plan invalid (CRITICAL violations)", () => {
      const plan = {
        task: "Implement something long enough",
        role: "worker",
        wave: 1,
        verification: "npm test",
        dependencies: [],
        acceptance_criteria: ["pass"],
        // no capacityDelta or requestROI
      };
      const result = validatePlanContract(plan);
      assert.equal(result.valid, false, "plan must be invalid — capacityDelta and requestROI are required");
      assert.ok(result.violations.some(v => v.field === "capacityDelta" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
      assert.ok(result.violations.some(v => v.field === "requestROI" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL));
    });
  });

  describe("validateAllPlans", () => {
    it("returns passRate 1.0 for empty array", () => {
      const result = validateAllPlans([]);
      assert.equal(result.passRate, 1.0);
      assert.equal(result.totalPlans, 0);
    });

    it("computes correct pass rate for mixed plans", () => {
      const plans = [
        { task: "Valid plan with enough chars", role: "worker", wave: 1, verification: "tests/core/foo.test.ts — test: ok", dependencies: [], acceptance_criteria: ["ok"], capacityDelta: 0.1, requestROI: 1.5 },
        { task: "X", role: "", wave: -1, verification: "" }, // invalid
      ];
      const result = validateAllPlans(plans);
      assert.equal(result.totalPlans, 2);
      assert.equal(result.validCount, 1);
      assert.equal(result.invalidCount, 1);
      assert.equal(result.passRate, 0.5);
    });

    it("returns all valid when all plans pass", () => {
      const plans = [
        { task: "First valid plan task here", role: "w1", wave: 1, verification: "tests/core/foo.test.ts — test: first", dependencies: [], acceptance_criteria: ["ok"], capacityDelta: 0.1, requestROI: 2.0 },
        { task: "Second valid plan task here", role: "w2", wave: 2, verification: "tests/core/bar.test.ts — test: second", dependencies: [], acceptance_criteria: ["ok"], capacityDelta: 0.2, requestROI: 1.5 },
      ];
      const result = validateAllPlans(plans);
      assert.equal(result.passRate, 1);
      assert.equal(result.invalidCount, 0);
    });

    it("planIndex correctly identifies critical-violation plans for removal", () => {
      const plans = [
        { task: "Valid plan with enough chars", role: "worker", wave: 1, verification: "tests/core/foo.test.ts — test: passes", dependencies: [], acceptance_criteria: ["ok"], capacityDelta: 0.1, requestROI: 1.5 },
        { task: "X", role: "", wave: -1, verification: "" }, // critical violations
        { task: "Another valid plan here", role: "worker", wave: 2, verification: "tests/core/bar.test.ts — test: ok", dependencies: [], acceptance_criteria: ["ok"], capacityDelta: 0.2, requestROI: 2.0 },
      ];
      const result = validateAllPlans(plans);

      // Collect indices with critical violations (as orchestrator does)
      const toRemove = result.results
        .filter(r => !r.valid && r.violations.some(v => v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL))
        .map(r => r.planIndex)
        .sort((a, b) => b - a);

      assert.deepEqual(toRemove, [1], "only index 1 should be flagged for removal");

      // Simulate splice in reverse order (as orchestrator does)
      const filtered = [...plans];
      for (const idx of toRemove) {
        filtered.splice(idx, 1);
      }
      assert.equal(filtered.length, 2, "critical-violation plan should be removed");
      assert.equal(filtered[0].task, "Valid plan with enough chars");
      assert.equal(filtered[1].task, "Another valid plan here");
    });
  });
});

describe("EQUAL_DIMENSION_SET", () => {
  it("exports all 10 canonical planning dimensions", () => {
    assert.equal(Array.isArray(EQUAL_DIMENSION_SET), true);
    assert.equal(EQUAL_DIMENSION_SET.length, 10);
    assert.ok(EQUAL_DIMENSION_SET.includes("architecture"));
    assert.ok(EQUAL_DIMENSION_SET.includes("speed"));
    assert.ok(EQUAL_DIMENSION_SET.includes("task-quality"));
    assert.ok(EQUAL_DIMENSION_SET.includes("prompt-quality"));
    assert.ok(EQUAL_DIMENSION_SET.includes("parser-quality"));
    assert.ok(EQUAL_DIMENSION_SET.includes("worker-specialization"));
    assert.ok(EQUAL_DIMENSION_SET.includes("model-task-fit"));
    assert.ok(EQUAL_DIMENSION_SET.includes("learning-loop"));
    assert.ok(EQUAL_DIMENSION_SET.includes("cost-efficiency"));
    assert.ok(EQUAL_DIMENSION_SET.includes("security"));
  });
});

describe("PACKET_VIOLATION_CODE — deterministic violation taxonomy", () => {
  it("exports all expected codes as frozen string constants", () => {
    const expectedCodes = [
      "NO_TASK_IDENTITY", "TASK_TOO_SHORT", "MISSING_ROLE",
      "INVALID_WAVE",
      "MISSING_VERIFICATION", "NON_SPECIFIC_VERIFICATION", "FORBIDDEN_COMMAND", "MISSING_VERIFICATION_COUPLING",
      "MISSING_ACCEPTANCE_CRITERIA", "MISSING_DEPENDENCIES",
      "MISSING_CAPACITY_DELTA", "INVALID_CAPACITY_DELTA",
      "MISSING_REQUEST_ROI", "INVALID_REQUEST_ROI",
    ];
    for (const key of expectedCodes) {
      assert.equal(typeof PACKET_VIOLATION_CODE[key], "string", `${key} must be a string`);
      assert.ok(PACKET_VIOLATION_CODE[key].length > 0, `${key} must be non-empty`);
    }
  });

  it("is frozen — mutation throws in strict mode", () => {
    assert.throws(
      () => { (PACKET_VIOLATION_CODE as any).NEW_KEY = "x"; },
      /Cannot add property/,
      "PACKET_VIOLATION_CODE must be frozen"
    );
  });

  it("scoring codes match UNRECOVERABLE_PACKET_REASONS string values for cross-gate consistency", async () => {
    // Import UNRECOVERABLE_PACKET_REASONS from prometheus to verify alignment.
    // Both gates must emit identical string codes for the same violation.
    const { UNRECOVERABLE_PACKET_REASONS } = await import("../../src/core/prometheus.js");
    assert.equal(UNRECOVERABLE_PACKET_REASONS.NO_TASK_IDENTITY,       PACKET_VIOLATION_CODE.NO_TASK_IDENTITY);
    assert.equal(UNRECOVERABLE_PACKET_REASONS.MISSING_CAPACITY_DELTA, PACKET_VIOLATION_CODE.MISSING_CAPACITY_DELTA);
    assert.equal(UNRECOVERABLE_PACKET_REASONS.INVALID_CAPACITY_DELTA, PACKET_VIOLATION_CODE.INVALID_CAPACITY_DELTA);
    assert.equal(UNRECOVERABLE_PACKET_REASONS.MISSING_REQUEST_ROI,    PACKET_VIOLATION_CODE.MISSING_REQUEST_ROI);
    assert.equal(UNRECOVERABLE_PACKET_REASONS.INVALID_REQUEST_ROI,    PACKET_VIOLATION_CODE.INVALID_REQUEST_ROI);
    assert.equal(UNRECOVERABLE_PACKET_REASONS.MISSING_VERIFICATION_COUPLING, PACKET_VIOLATION_CODE.MISSING_VERIFICATION_COUPLING);
  });

  describe("validatePlanContract violations include deterministic code field", () => {
    const baseValidPlan = () => ({
      task: "Implement something long enough",
      role: "evolution-worker",
      wave: 1,
      verification: "tests/core/foo.test.ts — test: should pass",
      dependencies: [],
      acceptance_criteria: ["All tests pass"],
      capacityDelta: 0.1,
      requestROI: 2.0,
    });

    it("every violation object has a non-empty string code", () => {
      // Generate a maximally-invalid plan to collect many violations
      const result = validatePlanContract({
        task: "X",  // too short → TASK_TOO_SHORT
        role: "",   // missing → MISSING_ROLE
        wave: -1,   // invalid → INVALID_WAVE
        verification: "npm test", // non-specific → NON_SPECIFIC_VERIFICATION
        // no dependencies, no acceptance_criteria, no capacityDelta, no requestROI
      });
      assert.equal(result.valid, false);
      for (const v of result.violations) {
        assert.equal(typeof v.code, "string", `violation on field "${v.field}" must have a string code`);
        assert.ok(v.code.length > 0, `violation code on field "${v.field}" must be non-empty`);
      }
    });

    it("TASK_TOO_SHORT code on short task", () => {
      const result = validatePlanContract({ ...baseValidPlan(), task: "Fix" });
      const v = result.violations.find(x => x.field === "task");
      assert.ok(v, "must have task violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.TASK_TOO_SHORT);
    });

    it("MISSING_ROLE code on empty role", () => {
      const result = validatePlanContract({ ...baseValidPlan(), role: "" });
      const v = result.violations.find(x => x.field === "role");
      assert.ok(v, "must have role violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.MISSING_ROLE);
    });

    it("INVALID_WAVE code on missing wave", () => {
      const plan = { ...baseValidPlan() };
      delete (plan as any).wave;
      const result = validatePlanContract(plan);
      const v = result.violations.find(x => x.field === "wave");
      assert.ok(v, "must have wave violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.INVALID_WAVE);
    });

    it("NON_SPECIFIC_VERIFICATION code on bare npm test", () => {
      const result = validatePlanContract({ ...baseValidPlan(), verification: "npm test" });
      const v = result.violations.find(x => x.field === "verification" && x.severity === PLAN_VIOLATION_SEVERITY.CRITICAL);
      assert.ok(v, "must have verification violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.NON_SPECIFIC_VERIFICATION);
    });

    it("MISSING_VERIFICATION code on absent verification", () => {
      const plan = { ...baseValidPlan() };
      delete (plan as any).verification;
      const result = validatePlanContract(plan);
      const v = result.violations.find(x => x.field === "verification");
      assert.ok(v, "must have verification violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.MISSING_VERIFICATION);
    });

    it("MISSING_ACCEPTANCE_CRITERIA code on empty array", () => {
      const result = validatePlanContract({ ...baseValidPlan(), acceptance_criteria: [] });
      const v = result.violations.find(x => x.field === "acceptance_criteria");
      assert.ok(v, "must have acceptance_criteria violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.MISSING_ACCEPTANCE_CRITERIA);
    });

    it("MISSING_DEPENDENCIES code on absent dependencies", () => {
      const plan = { ...baseValidPlan() };
      delete (plan as any).dependencies;
      const result = validatePlanContract(plan);
      const v = result.violations.find(x => x.field === "dependencies");
      assert.ok(v, "must have dependencies violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.MISSING_DEPENDENCIES);
    });

    it("MISSING_CAPACITY_DELTA code on absent capacityDelta", () => {
      const plan = { ...baseValidPlan() };
      delete (plan as any).capacityDelta;
      const result = validatePlanContract(plan);
      const v = result.violations.find(x => x.field === "capacityDelta");
      assert.ok(v, "must have capacityDelta violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.MISSING_CAPACITY_DELTA);
    });

    it("INVALID_CAPACITY_DELTA code on out-of-range capacityDelta", () => {
      const result = validatePlanContract({ ...baseValidPlan(), capacityDelta: 2.0 });
      const v = result.violations.find(x => x.field === "capacityDelta");
      assert.ok(v, "must have capacityDelta violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.INVALID_CAPACITY_DELTA);
    });

    it("MISSING_REQUEST_ROI code on absent requestROI", () => {
      const plan = { ...baseValidPlan() };
      delete (plan as any).requestROI;
      const result = validatePlanContract(plan);
      const v = result.violations.find(x => x.field === "requestROI");
      assert.ok(v, "must have requestROI violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.MISSING_REQUEST_ROI);
    });

    it("INVALID_REQUEST_ROI code on zero requestROI", () => {
      const result = validatePlanContract({ ...baseValidPlan(), requestROI: 0 });
      const v = result.violations.find(x => x.field === "requestROI");
      assert.ok(v, "must have requestROI violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.INVALID_REQUEST_ROI);
    });

    it("FORBIDDEN_COMMAND code on glob pattern in verification", () => {
      const result = validatePlanContract({ ...baseValidPlan(), verification: "node --test tests/**/*.test.ts" });
      const v = result.violations.find(x => x.field === "verification" && x.severity === PLAN_VIOLATION_SEVERITY.CRITICAL);
      assert.ok(v, "must have verification violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND);
    });

    it("FORBIDDEN_COMMAND code on glob in verification_commands array", () => {
      const result = validatePlanContract({
        ...baseValidPlan(),
        verification_commands: ["node --test src/**/*.test.ts"],
      });
      const v = result.violations.find(x => x.field === "verification_commands[0]");
      assert.ok(v, "must have verification_commands violation");
      assert.equal(v!.code, PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND);
    });

    it("NO_TASK_IDENTITY code when plan is null", () => {
      const result = validatePlanContract(null);
      assert.equal(result.violations[0].code, PACKET_VIOLATION_CODE.NO_TASK_IDENTITY);
    });

    it("secondary safety net can filter by code — code-based filter matches field-based filter", () => {
      const SCORING_CODES = new Set([
        PACKET_VIOLATION_CODE.MISSING_CAPACITY_DELTA,
        PACKET_VIOLATION_CODE.INVALID_CAPACITY_DELTA,
        PACKET_VIOLATION_CODE.MISSING_REQUEST_ROI,
        PACKET_VIOLATION_CODE.INVALID_REQUEST_ROI,
      ]);
      const plans = [
        { task: "First valid plan here", role: "w1", wave: 1, verification: "tests/core/foo.test.ts — test: first", dependencies: [], acceptance_criteria: ["ok"], capacityDelta: 0.1, requestROI: 2.0 },
        { task: "Missing scoring fields", role: "w2", wave: 2, verification: "tests/core/bar.test.ts — test: bar", dependencies: [], acceptance_criteria: ["ok"] },
      ];
      const result = validateAllPlans(plans);
      const byCode = result.results
        .filter(r => !r.valid && r.violations.some(v =>
          SCORING_CODES.has(v.code) && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
        ))
        .map(r => r.planIndex);
      const byField = result.results
        .filter(r => !r.valid && r.violations.some(v =>
          (v.field === "capacityDelta" || v.field === "requestROI") && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
        ))
        .map(r => r.planIndex);
      assert.deepEqual(byCode, byField, "code-based and field-based filters must identify the same plans");
    });
  });
});

// ── Task 3: Harden forbidden command checks — plan contract level ─────────────

describe("plan_contract_validator — forbidden command checks (Task 3 hardening)", () => {
  it("detects forbidden bash in verification field with leading whitespace (trimming fix)", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "  bash scripts/run_tests.sh",
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "leading-whitespace bash in verification must be detected as forbidden");
    assert.ok(
      result.violations.some(v => v.field === "verification" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND),
      `expected FORBIDDEN_COMMAND violation on verification; got: [${JSON.stringify(result.violations)}]`
    );
  });

  it("detects forbidden node --test glob in verification_commands with leading whitespace", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "tests/core/foo.test.ts — test: should pass",
      verification_commands: ["  node --test tests/**/*.test.ts"],
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "leading-whitespace node --test glob in verification_commands must be detected as forbidden");
    assert.ok(
      result.violations.some(v =>
        v.field === "verification_commands[0]" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND
      ),
      `expected FORBIDDEN_COMMAND on verification_commands[0]; got: [${JSON.stringify(result.violations)}]`
    );
  });

  it("negative path: clean commands with leading whitespace are NOT flagged as forbidden", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "tests/core/foo.test.ts — test: should pass",
      verification_commands: ["  npm test", "  npm run lint"],
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    const forbiddenViolations = result.violations.filter(
      v => v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND
    );
    assert.equal(forbiddenViolations.length, 0,
      `canonical commands with leading whitespace must not be flagged; got: [${JSON.stringify(forbiddenViolations)}]`
    );
  });
});

// ── Task 2: Shell-glob regression locks — dual-path enforcement ───────────────
// Guards against two distinct regression paths:
//   Path A (isNonSpecificVerification): bare "node --test tests/**" passes the
//     specificity check (the "--test " substring triggers the separator pattern),
//     so Path A does NOT catch this — demonstrating that Path B is essential.
//   Path B (checkForbiddenCommands): "node --test tests/**" AND
//     "node --test tests/**/*.test.ts" are both caught as forbidden globs.
// Both paths must be independently tested so removing either check causes failures.

describe("plan_contract_validator — shell-glob regression locks (Task 2)", () => {
  // ── Path A specificity edge-case: isNonSpecificVerification has a false-negative
  // for "node --test tests/**" because "--test " matches the separator check.
  // This makes Path B (checkForbiddenCommands) the sole guard for this pattern.
  it("isNonSpecificVerification treats 'node --test tests/**' as specific (--test separator match)", () => {
    // The "--test " portion matches the description-separator pattern [—\-–]\s*test[:\s],
    // so isNonSpecificVerification returns false. Path A does NOT catch this glob.
    // Regression lock: Path B (checkForbiddenCommands) must remain to catch it.
    assert.equal(isNonSpecificVerification("node --test tests/**"), false,
      "isNonSpecificVerification has a false-negative for 'node --test tests/**' — Path B must catch it"
    );
  });

  it("validatePlanContract rejects 'node --test tests/**' via FORBIDDEN_COMMAND (Path B catches what Path A misses)", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "node --test tests/**",
      dependencies: [],
      acceptance_criteria: ["pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "glob must be rejected even though isNonSpecificVerification returned false"
    );
    // Must be caught by FORBIDDEN_COMMAND (Path B)
    const forbiddenViolation = result.violations.find(
      v => v.field === "verification" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND
    );
    assert.ok(forbiddenViolation,
      `expected FORBIDDEN_COMMAND on verification; got: [${JSON.stringify(result.violations)}]`
    );
  });

  // ── Path B: FORBIDDEN_COMMAND gate catches glob-with-extension ─────────────
  it("isNonSpecificVerification treats 'node --test tests/**/*.test.ts' as specific (has .test.ts)", () => {
    // .test.ts extension → specificity check returns false
    // Confirms Path A alone would NOT catch this; Path B must handle it
    assert.equal(isNonSpecificVerification("node --test tests/**/*.test.ts"), false,
      "glob WITH .test.ts extension is considered specific by isNonSpecificVerification"
    );
  });

  it("validatePlanContract rejects 'node --test tests/**/*.test.ts' via FORBIDDEN_COMMAND (Path B)", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "node --test tests/**/*.test.ts",
      dependencies: [],
      acceptance_criteria: ["pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "glob-with-extension must still be rejected via FORBIDDEN_COMMAND check"
    );
    const forbiddenViolation = result.violations.find(
      v => v.field === "verification" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND
    );
    assert.ok(forbiddenViolation,
      `expected FORBIDDEN_COMMAND violation for glob-with-extension; got: [${JSON.stringify(result.violations)}]`
    );
    // Must NOT have NON_SPECIFIC_VERIFICATION code (Path A didn't catch it)
    const nonSpecificViolation = result.violations.find(
      v => v.field === "verification" && v.code === PACKET_VIOLATION_CODE.NON_SPECIFIC_VERIFICATION
    );
    assert.equal(nonSpecificViolation, undefined,
      "glob-with-extension must NOT trigger NON_SPECIFIC_VERIFICATION (Path B handles it)"
    );
  });

  it("negative path: 'node --test tests/core/foo.test.ts' (no glob) passes both path checks", () => {
    // Specific file reference without glob → passes both isNonSpecificVerification AND checkForbiddenCommands
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "node --test tests/core/foo.test.ts",
      dependencies: [],
      acceptance_criteria: ["pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    const verificationViolation = result.violations.find(
      v => v.field === "verification" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
    );
    assert.equal(verificationViolation, undefined,
      "specific file reference without glob must not produce a CRITICAL verification violation"
    );
  });

  it("glob in verification_commands is caught even when verification is clean (Path B via array)", () => {
    // Regression lock: forbidden glob in verification_commands must be rejected
    // even when the primary verification field is specific and clean
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "tests/core/foo.test.ts — test: should pass",
      verification_commands: ["node --test tests/**/*.test.ts"],
      dependencies: [],
      acceptance_criteria: ["pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "glob in verification_commands must be rejected even with clean verification field"
    );
    const v = result.violations.find(
      v => v.field === "verification_commands[0]" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND
    );
    assert.ok(v,
      `expected FORBIDDEN_COMMAND on verification_commands[0]; got: [${JSON.stringify(result.violations)}]`
    );
  });
});

// ── Task 2: Regression locks for additional forbidden shell patterns ──────────
// Guards against sh, npx tsx glob, and ts-node glob patterns slipping through
// the planner validation path (validatePlanContract) AND the registry-level
// forbidden check (checkForbiddenCommands). Both paths are independently tested.

describe("plan_contract_validator — additional forbidden shell-pattern regression locks (Task 2)", () => {
  it("rejects 'sh scripts/run_tests.sh' in verification field as FORBIDDEN_COMMAND", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "sh scripts/run_tests.sh",
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "'sh ...' command in verification must be rejected as forbidden"
    );
    assert.ok(
      result.violations.some(v => v.field === "verification" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND),
      `expected FORBIDDEN_COMMAND violation on verification; got: [${JSON.stringify(result.violations)}]`
    );
  });

  it("rejects 'npx tsx tests/**/*.test.ts' in verification field as FORBIDDEN_COMMAND", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "npx tsx tests/**/*.test.ts",
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "'npx tsx ...' glob command in verification must be rejected as forbidden"
    );
    assert.ok(
      result.violations.some(v => v.field === "verification" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND),
      `expected FORBIDDEN_COMMAND violation on verification; got: [${JSON.stringify(result.violations)}]`
    );
  });

  it("rejects 'ts-node tests/**/*.test.ts' in verification field as FORBIDDEN_COMMAND", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "ts-node tests/**/*.test.ts",
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "'ts-node ...' glob command in verification must be rejected as forbidden"
    );
    assert.ok(
      result.violations.some(v => v.field === "verification" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND),
      `expected FORBIDDEN_COMMAND violation on verification; got: [${JSON.stringify(result.violations)}]`
    );
  });

  it("rejects 'sh scripts/run_tests.sh' in verification_commands array (runtime dispatch path)", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "tests/core/foo.test.ts — test: passes",
      verification_commands: ["sh scripts/run_tests.sh"],
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "'sh ...' in verification_commands must be rejected as forbidden"
    );
    assert.ok(
      result.violations.some(v => v.field === "verification_commands[0]" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND),
      `expected FORBIDDEN_COMMAND on verification_commands[0]; got: [${JSON.stringify(result.violations)}]`
    );
  });

  it("rejects 'npx tsx tests/**/*.test.ts' in verification_commands array (runtime dispatch path)", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "tests/core/foo.test.ts — test: passes",
      verification_commands: ["npx tsx tests/**/*.test.ts"],
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "'npx tsx ...' glob in verification_commands must be rejected as forbidden"
    );
    assert.ok(
      result.violations.some(v => v.field === "verification_commands[0]" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND),
      `expected FORBIDDEN_COMMAND on verification_commands[0]; got: [${JSON.stringify(result.violations)}]`
    );
  });

  it("rejects 'ts-node src/**/*.test.ts' in verification_commands array (runtime dispatch path)", () => {
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "tests/core/foo.test.ts — test: passes",
      verification_commands: ["ts-node src/**/*.test.ts"],
      dependencies: [],
      acceptance_criteria: ["tests pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    assert.equal(result.valid, false,
      "'ts-node ...' glob in verification_commands must be rejected as forbidden"
    );
    assert.ok(
      result.violations.some(v => v.field === "verification_commands[0]" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND),
      `expected FORBIDDEN_COMMAND on verification_commands[0]; got: [${JSON.stringify(result.violations)}]`
    );
  });

  it("negative path: 'sh' alone (no argument) is not caught by forbidden registry pattern", () => {
    // The forbidden pattern requires '^sh\s+' — 'sh' alone doesn't match.
    // Locks the boundary of the sh detection pattern.
    const result = checkForbiddenCommands("sh");
    assert.equal(result.forbidden, false,
      "'sh' without an argument must NOT be caught (pattern requires '^sh\\s+' — space + argument needed)"
    );
  });

  it("negative path: 'npx tsx tests/core/foo.test.ts' (no glob) is NOT forbidden", () => {
    // npx tsx with a specific file (no glob) must pass the forbidden check.
    // The forbidden pattern requires a '*' in the path.
    const plan = {
      task: "Implement something long enough here",
      role: "worker",
      wave: 1,
      verification: "npx tsx tests/core/foo.test.ts",
      dependencies: [],
      acceptance_criteria: ["pass"],
      capacityDelta: 0.1,
      requestROI: 1.5,
    };
    const result = validatePlanContract(plan);
    const forbiddenViolation = result.violations.find(
      v => v.field === "verification" && v.code === PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND
    );
    assert.equal(forbiddenViolation, undefined,
      "'npx tsx tests/core/foo.test.ts' (no glob) must not be flagged as FORBIDDEN_COMMAND"
    );
  });

  it("all four forbidden shell patterns are independently detected by checkForbiddenCommands", () => {
    // Registry-level regression lock: ensures each pattern independently fires.
    const forbidden = [
      "sh run.sh",
      "bash scripts/test.sh",
      "npx tsx tests/**/*.test.ts",
      "ts-node tests/**/*.spec.ts",
    ];
    for (const cmd of forbidden) {
      const result = checkForbiddenCommands(cmd);
      assert.equal(result.forbidden, true,
        `"${cmd}" must be detected as forbidden by checkForbiddenCommands`
      );
      assert.ok(result.violations.length > 0,
        `"${cmd}" must produce at least one violation`
      );
    }
  });
});

// ── isAmbiguousTask — ambiguity detection ─────────────────────────────────────

describe("isAmbiguousTask", () => {
  it("identifies generic single-action descriptions as ambiguous", () => {
    const ambiguous = [
      "fix bugs",
      "fix issues",
      "update code",
      "update system",
      "improve system",
      "improve code",
      "refactor code",
      "clean up code",
      "cleanup",
      "misc changes",
      "misc fixes",
      "miscellaneous updates",
      "general cleanup",
      "general refactor",
      "various updates",
      "add tests",
      "write tests",
    ];
    for (const task of ambiguous) {
      assert.equal(isAmbiguousTask(task), true, `"${task}" must be detected as ambiguous`);
    }
  });

  it("identifies specific task descriptions as NOT ambiguous", () => {
    const specific = [
      "Add deterministic decomposition caps to prometheus.ts to prevent oversized plans",
      "Fix verification glob false-fail in Windows CI by rewriting path separator logic",
      "Implement trust boundary validation for planner output packets",
      "Harden plan_contract_validator to detect ambiguous task descriptions",
      "Refactor orchestrator wave dispatch to use dependency-aware scheduling",
    ];
    for (const task of specific) {
      assert.equal(isAmbiguousTask(task), false, `"${task}" must NOT be detected as ambiguous`);
    }
  });

  it("returns true for empty string", () => {
    assert.equal(isAmbiguousTask(""), true);
    assert.equal(isAmbiguousTask("   "), true);
  });

  it("is case-insensitive", () => {
    assert.equal(isAmbiguousTask("FIX BUGS"), true);
    assert.equal(isAmbiguousTask("Update Code"), true);
    assert.equal(isAmbiguousTask("MISC CHANGES"), true);
  });

  it("AMBIGUOUS_TASK_PATTERNS is a frozen non-empty array of RegExps", () => {
    assert.ok(Array.isArray(AMBIGUOUS_TASK_PATTERNS));
    assert.ok(AMBIGUOUS_TASK_PATTERNS.length > 0);
    for (const p of AMBIGUOUS_TASK_PATTERNS) {
      assert.ok(p instanceof RegExp, "every entry must be a RegExp");
    }
    assert.throws(() => { (AMBIGUOUS_TASK_PATTERNS as any).push(/extra/); },
      "AMBIGUOUS_TASK_PATTERNS must be frozen");
  });

  it("negative path: descriptive tasks with action verbs are NOT ambiguous", () => {
    // A sentence that starts with a known verb but contains specifics is not ambiguous.
    assert.equal(isAmbiguousTask("Fix the parser confidence penalty computation in prometheus.ts"), false);
    assert.equal(isAmbiguousTask("Update worker_batch_planner to respect microwave caps"), false);
  });
});

// ── validatePlanContract — TASK_TOO_LARGE and TASK_AMBIGUOUS ─────────────────

describe("validatePlanContract — decomposition caps and ambiguity", () => {
  function baseValidPlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      task: "Implement deterministic decomposition cap for Prometheus output packets",
      role: "evolution-worker",
      wave: 1,
      verification: "tests/core/prometheus_parse.test.ts — test: checkDecompositionCaps",
      dependencies: [],
      acceptance_criteria: ["Cap applied when batch exceeds MAX_DECOMPOSITION_PLANS"],
      capacityDelta: 0.1,
      requestROI: 2.0,
      ...overrides,
    };
  }

  it("accepts a plan with exactly MAX_ACCEPTANCE_CRITERIA_PER_TASK criteria", () => {
    const ac = Array.from({ length: MAX_ACCEPTANCE_CRITERIA_PER_TASK }, (_, i) => `Criterion ${i + 1}`);
    const result = validatePlanContract(baseValidPlan({ acceptance_criteria: ac }));
    assert.ok(
      !result.violations.some(v => v.code === PACKET_VIOLATION_CODE.TASK_TOO_LARGE),
      "exactly MAX_ACCEPTANCE_CRITERIA_PER_TASK must NOT produce TASK_TOO_LARGE"
    );
  });

  it("emits TASK_TOO_LARGE (WARNING) when acceptance_criteria exceeds the cap", () => {
    const ac = Array.from({ length: MAX_ACCEPTANCE_CRITERIA_PER_TASK + 1 }, (_, i) => `Criterion ${i + 1}`);
    const result = validatePlanContract(baseValidPlan({ acceptance_criteria: ac }));
    const v = result.violations.find(x => x.code === PACKET_VIOLATION_CODE.TASK_TOO_LARGE && x.field === "acceptance_criteria");
    assert.ok(v, "must have TASK_TOO_LARGE violation on acceptance_criteria");
    assert.equal(v!.severity, PLAN_VIOLATION_SEVERITY.WARNING);
  });

  it("plan remains valid (no CRITICAL) when only TASK_TOO_LARGE is triggered via oversized AC", () => {
    const ac = Array.from({ length: MAX_ACCEPTANCE_CRITERIA_PER_TASK + 1 }, (_, i) => `Criterion ${i + 1}`);
    const result = validatePlanContract(baseValidPlan({ acceptance_criteria: ac }));
    // WARNING-only; plan is still valid unless there are CRITICALs
    assert.ok(result.violations.every(v => v.severity !== PLAN_VIOLATION_SEVERITY.CRITICAL),
      "only WARNING violations expected for oversized AC");
  });

  it("emits TASK_TOO_LARGE (WARNING) for filesInScope exceeding the cap", () => {
    const files = Array.from({ length: MAX_FILES_IN_SCOPE_PER_TASK + 1 }, (_, i) => `src/file${i}.ts`);
    const result = validatePlanContract(baseValidPlan({ filesInScope: files }));
    const v = result.violations.find(x => x.code === PACKET_VIOLATION_CODE.TASK_TOO_LARGE && x.field === "filesInScope");
    assert.ok(v, "must have TASK_TOO_LARGE violation on filesInScope");
    assert.equal(v!.severity, PLAN_VIOLATION_SEVERITY.WARNING);
  });

  it("emits TASK_TOO_LARGE (WARNING) for target_files exceeding the cap", () => {
    const files = Array.from({ length: MAX_FILES_IN_SCOPE_PER_TASK + 1 }, (_, i) => `src/file${i}.ts`);
    const result = validatePlanContract(baseValidPlan({ target_files: files }));
    const v = result.violations.find(x => x.code === PACKET_VIOLATION_CODE.TASK_TOO_LARGE && x.field === "filesInScope");
    assert.ok(v, "must have TASK_TOO_LARGE violation on target_files (reported as filesInScope)");
  });

  it("does NOT emit TASK_TOO_LARGE when filesInScope is exactly MAX_FILES_IN_SCOPE_PER_TASK", () => {
    const files = Array.from({ length: MAX_FILES_IN_SCOPE_PER_TASK }, (_, i) => `src/file${i}.ts`);
    const result = validatePlanContract(baseValidPlan({ filesInScope: files }));
    assert.ok(
      !result.violations.some(v => v.code === PACKET_VIOLATION_CODE.TASK_TOO_LARGE && v.field === "filesInScope"),
      "exactly MAX_FILES_IN_SCOPE_PER_TASK must NOT produce TASK_TOO_LARGE"
    );
  });

  it("emits TASK_AMBIGUOUS (WARNING) for a generic task description", () => {
    const result = validatePlanContract(baseValidPlan({ task: "fix bugs" }));
    const v = result.violations.find(x => x.code === PACKET_VIOLATION_CODE.TASK_AMBIGUOUS);
    assert.ok(v, "must have TASK_AMBIGUOUS violation for generic description");
    assert.equal(v!.field, "task");
    assert.equal(v!.severity, PLAN_VIOLATION_SEVERITY.WARNING);
  });

  it("does NOT emit TASK_AMBIGUOUS for a specific task description", () => {
    const result = validatePlanContract(baseValidPlan());
    assert.ok(
      !result.violations.some(v => v.code === PACKET_VIOLATION_CODE.TASK_AMBIGUOUS),
      "specific task must not produce TASK_AMBIGUOUS"
    );
  });

  it("does NOT emit TASK_AMBIGUOUS when TASK_TOO_SHORT fires (no duplicate errors)", () => {
    // Very short task hits TASK_TOO_SHORT — TASK_AMBIGUOUS must not fire on the same field.
    const result = validatePlanContract(baseValidPlan({ task: "fix" }));
    assert.ok(
      result.violations.some(v => v.code === PACKET_VIOLATION_CODE.TASK_TOO_SHORT),
      "TASK_TOO_SHORT must fire for a 3-char task"
    );
    assert.ok(
      !result.violations.some(v => v.code === PACKET_VIOLATION_CODE.TASK_AMBIGUOUS),
      "TASK_AMBIGUOUS must not co-occur with TASK_TOO_SHORT"
    );
  });

  it("TASK_TOO_LARGE and TASK_AMBIGUOUS codes exist in PACKET_VIOLATION_CODE", () => {
    assert.equal(typeof PACKET_VIOLATION_CODE.TASK_TOO_LARGE, "string");
    assert.equal(typeof PACKET_VIOLATION_CODE.TASK_AMBIGUOUS, "string");
    assert.equal(PACKET_VIOLATION_CODE.TASK_TOO_LARGE, "task_too_large");
    assert.equal(PACKET_VIOLATION_CODE.TASK_AMBIGUOUS, "task_ambiguous");
  });

  it("MAX_ACCEPTANCE_CRITERIA_PER_TASK is 10", () => {
    assert.equal(MAX_ACCEPTANCE_CRITERIA_PER_TASK, 10);
  });

  it("MAX_FILES_IN_SCOPE_PER_TASK is 30", () => {
    assert.equal(MAX_FILES_IN_SCOPE_PER_TASK, 30);
  });
});

// ── isPacketQuarantined ───────────────────────────────────────────────────────

describe("isPacketQuarantined", () => {
  it("returns true when _quarantined flag is set", () => {
    assert.equal(isPacketQuarantined({ _quarantined: true, task: "x" }), true);
  });

  it("returns true when _provenance.confidence is below threshold", () => {
    const packet = {
      task: "low-conf",
      _provenance: { confidence: 0.3, tag: "parser-fallback", attachedAt: new Date().toISOString() },
    };
    assert.equal(isPacketQuarantined(packet), true);
  });

  it("returns false when _provenance.confidence is exactly at threshold", () => {
    const packet = {
      task: "borderline",
      _provenance: { confidence: QUARANTINE_CONFIDENCE_THRESHOLD, tag: "parser-fallback", attachedAt: new Date().toISOString() },
    };
    assert.equal(isPacketQuarantined(packet), false);
  });

  it("returns false when _provenance.confidence is above threshold", () => {
    const packet = {
      task: "high-conf",
      _provenance: { confidence: 0.9, tag: "parser-fallback", attachedAt: new Date().toISOString() },
    };
    assert.equal(isPacketQuarantined(packet), false);
  });

  it("returns false when packet has no provenance metadata (backward compatible)", () => {
    assert.equal(isPacketQuarantined({ task: "no provenance" }), false);
  });

  it("negative: returns false for null input", () => {
    assert.equal(isPacketQuarantined(null), false);
  });

  it("negative: returns false for non-object input", () => {
    assert.equal(isPacketQuarantined("string" as any), false);
    assert.equal(isPacketQuarantined(42 as any), false);
  });

  it("QUARANTINE_CONFIDENCE_THRESHOLD is 0.5", () => {
    assert.equal(QUARANTINE_CONFIDENCE_THRESHOLD, 0.5);
  });
});
