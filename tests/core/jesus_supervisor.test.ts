/**
 * Tests for src/core/jesus_supervisor.ts — directive payload validation.
 *
 * Covers:
 *   - validateDirectivePayload: required field enforcement and fail-close semantics
 *   - validateExpectedOutcomeMeasurable: concrete measurable outcome verification
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  runSystemHealthAudit,
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

describe("jesus_supervisor — runSystemHealthAudit", () => {
  function withTempRepo<T>(fn: (ctx: { repoDir: string; stateDir: string }) => Promise<T> | T): Promise<T> {
    const repoDir = mkdtempSync(path.join(tmpdir(), "jesus-audit-"));
    const srcDir = path.join(repoDir, "src", "core");
    const stateDir = path.join(repoDir, "state");
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    const previousCwd = process.cwd();

    return Promise.resolve()
      .then(async () => {
        process.chdir(repoDir);
        return await fn({ repoDir, stateDir });
      })
      .finally(() => {
        process.chdir(previousCwd);
        rmSync(repoDir, { recursive: true, force: true });
      });
  }

  it("downgrades verified capability gaps to info with verification note", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(
        path.join(repoDir, "src", "core", "prometheus.ts"),
        "const a='MANDATORY_TASKS'; function buildMandatoryTasksPromptSection(){} function extractMandatoryHealthAuditFindings(){}",
        "utf8",
      );

      writeFileSync(
        path.join(stateDir, "knowledge_memory.json"),
        JSON.stringify({
          lessons: [],
          capabilityGaps: [
            {
              gap: "Missing capability: Jesus findings were not fed as mandatory plan tasks",
              severity: "critical",
              capability: "jesus-findings-to-plan-requirements",
              proposedFix: "Inject findings as mandatory tasks",
            },
          ],
        }),
        "utf8",
      );

      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        { latestMainCi: null, failedCiRuns: [], pullRequests: [] },
        {},
        {},
      );

      const capGap = findings.find((f: any) => f.area === "capability-gap");
      assert.ok(capGap, "capability-gap finding should exist");
      assert.equal(capGap.severity, "info");
      assert.equal(capGap.note, "verified_present_in_source");
    });
  });

  it("keeps unverified capability gaps at original severity", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(path.join(repoDir, "src", "core", "placeholder.ts"), "export const ok = true;", "utf8");
      writeFileSync(
        path.join(stateDir, "knowledge_memory.json"),
        JSON.stringify({
          lessons: [],
          capabilityGaps: [
            {
              gap: "Missing impossible capability",
              severity: "important",
              capability: "non-existent-capability",
              proposedFix: "Implement imaginary feature",
            },
          ],
        }),
        "utf8",
      );

      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        { latestMainCi: null, failedCiRuns: [], pullRequests: [] },
        {},
        {},
      );

      const capGap = findings.find((f: any) => f.area === "capability-gap");
      assert.ok(capGap, "capability-gap finding should exist");
      assert.equal(capGap.severity, "important");
      assert.equal(capGap.note, undefined);
    });
  });

  it("suppresses pre-head failed CI runs when latest main CI is successful", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(path.join(repoDir, "src", "core", "placeholder.ts"), "export const ok = true;", "utf8");
      writeFileSync(path.join(stateDir, "knowledge_memory.json"), JSON.stringify({ lessons: [], capabilityGaps: [] }), "utf8");

      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        {
          latestMainCi: {
            conclusion: "success",
            branch: "main",
            headSha: "abc123456",
            commit: "abc1234",
            updatedAt: "2026-04-03T12:00:00.000Z",
          },
          failedCiRuns: [
            {
              name: "ci-old",
              branch: "main",
              headSha: "old000001",
              commit: "old0000",
              updatedAt: "2026-04-03T11:00:00.000Z",
            },
            {
              name: "ci-current",
              branch: "feature-1",
              headSha: "abc123456",
              commit: "abc1234",
              updatedAt: "2026-04-03T12:30:00.000Z",
            },
          ],
          pullRequests: [],
        },
        {},
        {},
      );

      const ciFailures = findings.filter((f: any) => f.area === "ci" && f.finding.startsWith("Failed CI:"));
      assert.equal(ciFailures.length, 1);
      assert.ok(ciFailures[0].finding.includes("ci-current"));
    });
  });
});
