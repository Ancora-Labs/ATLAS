/**
 * Tests for src/core/jesus_supervisor.ts — directive payload validation.
 *
 * Covers:
 *   - validateDirectivePayload: required field enforcement and fail-close semantics
 *   - validateExpectedOutcomeMeasurable: concrete measurable outcome verification
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateDirectivePayload,
  validateExpectedOutcomeMeasurable,
} from "../../src/core/jesus_supervisor.js";

// ── Shared fixtures ────────────────────────────────────────────────────────────

/** A fully valid directive payload that should always pass validation. */
const VALID_DIRECTIVE: Record<string, unknown> = {
  decision: "tactical",
  systemHealth: "good",
  wakeAthena: true,
  callPrometheus: false,
  briefForPrometheus: "Check GitHub issues and activate appropriate workers.",
  priorities: [],
  workerSuggestions: [],
};

/** A fully valid expectedOutcome block. */
const VALID_EXPECTED_OUTCOME: Record<string, unknown> = {
  expectedSystemHealthAfter: "good",
  expectedNextDecision: "tactical",
  expectedAthenaActivated: true,
  expectedPrometheusRan: false,
  expectedWorkItemCount: 3,
  forecastConfidence: "medium",
};

// ── validateExpectedOutcomeMeasurable ─────────────────────────────────────────

describe("jesus_supervisor — validateExpectedOutcomeMeasurable", () => {
  it("returns true for a fully valid expectedOutcome block", () => {
    assert.equal(validateExpectedOutcomeMeasurable(VALID_EXPECTED_OUTCOME), true);
  });

  it("returns false when expectedOutcome is null or undefined", () => {
    assert.equal(validateExpectedOutcomeMeasurable(null as any), false);
    assert.equal(validateExpectedOutcomeMeasurable(undefined as any), false);
  });

  it("returns false when expectedOutcome is not an object", () => {
    assert.equal(validateExpectedOutcomeMeasurable("string" as any), false);
    assert.equal(validateExpectedOutcomeMeasurable(42 as any), false);
  });

  it("returns false when expectedSystemHealthAfter is missing", () => {
    const outcome = { ...VALID_EXPECTED_OUTCOME, expectedSystemHealthAfter: undefined };
    assert.equal(validateExpectedOutcomeMeasurable(outcome), false);
  });

  it("returns false when expectedNextDecision is an unrecognised value", () => {
    const outcome = { ...VALID_EXPECTED_OUTCOME, expectedNextDecision: "freeform-string" };
    assert.equal(validateExpectedOutcomeMeasurable(outcome), false);
  });

  it("returns false when expectedSystemHealthAfter is an unrecognised value", () => {
    const outcome = { ...VALID_EXPECTED_OUTCOME, expectedSystemHealthAfter: "super-good" };
    assert.equal(validateExpectedOutcomeMeasurable(outcome), false);
  });

  it("returns false when expectedAthenaActivated is not boolean", () => {
    const outcome = { ...VALID_EXPECTED_OUTCOME, expectedAthenaActivated: "yes" };
    assert.equal(validateExpectedOutcomeMeasurable(outcome), false);
  });

  it("returns false when expectedPrometheusRan is not boolean", () => {
    const outcome = { ...VALID_EXPECTED_OUTCOME, expectedPrometheusRan: 1 };
    assert.equal(validateExpectedOutcomeMeasurable(outcome), false);
  });

  it("returns false when expectedWorkItemCount is not a number", () => {
    const outcome = { ...VALID_EXPECTED_OUTCOME, expectedWorkItemCount: "3" };
    assert.equal(validateExpectedOutcomeMeasurable(outcome), false);
  });

  it("accepts 'unknown' as a valid health state (transient system state)", () => {
    const outcome = { ...VALID_EXPECTED_OUTCOME, expectedSystemHealthAfter: "unknown" };
    assert.equal(validateExpectedOutcomeMeasurable(outcome), true);
  });

  it("accepts all four valid decision types", () => {
    for (const decision of ["tactical", "strategic", "emergency", "wait"]) {
      const outcome = { ...VALID_EXPECTED_OUTCOME, expectedNextDecision: decision };
      assert.equal(validateExpectedOutcomeMeasurable(outcome), true,
        `decision type "${decision}" must be accepted as measurable`
      );
    }
  });
});

// ── validateDirectivePayload ───────────────────────────────────────────────────

describe("jesus_supervisor — validateDirectivePayload", () => {
  it("returns valid:true for a complete directive with valid expectedOutcome", () => {
    const result = validateDirectivePayload(VALID_DIRECTIVE, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, true, `directive should be valid; gaps: [${result.gaps.join("; ")}]`);
    assert.equal(result.gaps.length, 0);
    assert.equal(result.hasMeasurableOutcome, true);
  });

  it("returns valid:false when decision field is missing", () => {
    const directive = { ...VALID_DIRECTIVE, decision: undefined };
    const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, false);
    assert.ok(result.gaps.some(g => g.includes("directive.decision")),
      `gap must mention decision; got: [${result.gaps.join("; ")}]`
    );
  });

  it("returns valid:false when systemHealth field is missing", () => {
    const directive = { ...VALID_DIRECTIVE, systemHealth: "" };
    const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, false);
    assert.ok(result.gaps.some(g => g.includes("directive.systemHealth")),
      `gap must mention systemHealth; got: [${result.gaps.join("; ")}]`
    );
  });

  it("returns valid:false when wakeAthena is not a boolean", () => {
    const directive = { ...VALID_DIRECTIVE, wakeAthena: "true" };
    const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, false);
    assert.ok(result.gaps.some(g => g.includes("directive.wakeAthena")),
      `gap must mention wakeAthena; got: [${result.gaps.join("; ")}]`
    );
  });

  it("returns valid:false when callPrometheus is not a boolean", () => {
    const directive = { ...VALID_DIRECTIVE, callPrometheus: 0 };
    const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, false);
    assert.ok(result.gaps.some(g => g.includes("directive.callPrometheus")),
      `gap must mention callPrometheus; got: [${result.gaps.join("; ")}]`
    );
  });

  it("returns valid:false when briefForPrometheus is empty", () => {
    const directive = { ...VALID_DIRECTIVE, briefForPrometheus: "   " };
    const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, false);
    assert.ok(result.gaps.some(g => g.includes("directive.briefForPrometheus")),
      `gap must mention briefForPrometheus; got: [${result.gaps.join("; ")}]`
    );
  });

  it("returns valid:false when decision is an unrecognised value", () => {
    const directive = { ...VALID_DIRECTIVE, decision: "magic-override" };
    const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, false);
    assert.ok(result.gaps.some(g => g.includes("magic-override")),
      `gap must name the invalid decision value; got: [${result.gaps.join("; ")}]`
    );
  });

  it("returns valid:false and hasMeasurableOutcome:false when expectedOutcome is incomplete", () => {
    const badOutcome = { ...VALID_EXPECTED_OUTCOME, expectedSystemHealthAfter: undefined };
    const result = validateDirectivePayload(VALID_DIRECTIVE, badOutcome);
    assert.equal(result.valid, false);
    assert.equal(result.hasMeasurableOutcome, false);
    assert.ok(result.gaps.some(g => g.includes("expectedOutcome")),
      `gap must mention expectedOutcome; got: [${result.gaps.join("; ")}]`
    );
  });

  it("hasMeasurableOutcome:true when expectedOutcome is valid even if directive has gaps", () => {
    const directive = { ...VALID_DIRECTIVE, decision: undefined };
    const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, false, "directive gaps must cause valid:false");
    assert.equal(result.hasMeasurableOutcome, true,
      "hasMeasurableOutcome must be true when only directive fields (not outcome) are invalid"
    );
  });

  it("multiple gaps are all reported simultaneously", () => {
    const directive = { ...VALID_DIRECTIVE, decision: undefined, systemHealth: undefined, wakeAthena: "yes" };
    const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
    assert.equal(result.valid, false);
    assert.ok(result.gaps.length >= 3,
      `expected at least 3 gaps for missing decision, systemHealth, and non-boolean wakeAthena; got: [${result.gaps.join("; ")}]`
    );
  });

  it("all four valid decision types pass validation", () => {
    for (const decision of ["tactical", "strategic", "emergency", "wait"]) {
      const directive = { ...VALID_DIRECTIVE, decision };
      const result = validateDirectivePayload(directive, VALID_EXPECTED_OUTCOME);
      assert.equal(result.valid, true,
        `decision type "${decision}" must produce valid:true; gaps: [${result.gaps.join("; ")}]`
      );
    }
  });
});
