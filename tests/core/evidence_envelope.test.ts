/**
 * evidence_envelope.test.ts
 *
 * Unit tests for validateEvidenceEnvelope — the hard admission control that
 * blocks malformed envelopes from reaching Athena's postmortem logic.
 *
 * Covers:
 *   - Valid envelope passes
 *   - Missing required fields fail
 *   - Invalid verificationEvidence slot values fail
 *   - Null / non-object input fails
 *   - Negative path: partial envelope (only some required fields)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateEvidenceEnvelope } from "../../src/core/evidence_envelope.js";

const VALID_EVIDENCE = { build: "pass", tests: "pass", lint: "n/a" };

function validEnvelope() {
  return {
    roleName: "evolution-worker",
    status: "done",
    summary: "Task completed successfully.",
    verificationEvidence: { build: "pass", tests: "pass", lint: "n/a" },
  };
}

describe("validateEvidenceEnvelope", () => {
  it("accepts a fully valid envelope", () => {
    const result = validateEvidenceEnvelope(validEnvelope());
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it("accepts envelope with all optional fields present", () => {
    const envelope = {
      ...validEnvelope(),
      prUrl: "https://github.com/owner/repo/pull/1",
      filesTouched: ["src/core/foo.ts"],
      verificationOutput: "Tests passed",
      verificationPassed: true,
      prChecks: { ok: true, passed: true, failed: [], pending: [], total: 3 },
      preReviewAssessment: "Looks good",
      preReviewIssues: [],
    };
    const result = validateEvidenceEnvelope(envelope);
    assert.equal(result.valid, true);
  });

  it("rejects null", () => {
    const result = validateEvidenceEnvelope(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it("rejects non-object (string)", () => {
    const result = validateEvidenceEnvelope("bad");
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it("rejects missing roleName", () => {
    const { roleName: _, ...envelope } = validEnvelope();
    const result = validateEvidenceEnvelope(envelope);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("roleName")));
  });

  it("rejects empty roleName", () => {
    const result = validateEvidenceEnvelope({ ...validEnvelope(), roleName: "  " });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("roleName")));
  });

  it("rejects missing status", () => {
    const { status: _, ...envelope } = validEnvelope();
    const result = validateEvidenceEnvelope(envelope);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("status")));
  });

  it("rejects missing summary", () => {
    const { summary: _, ...envelope } = validEnvelope();
    const result = validateEvidenceEnvelope(envelope);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("summary")));
  });

  it("rejects missing verificationEvidence", () => {
    const { verificationEvidence: _, ...envelope } = validEnvelope();
    const result = validateEvidenceEnvelope(envelope);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("verificationEvidence")));
  });

  it("rejects verificationEvidence with invalid build slot", () => {
    const result = validateEvidenceEnvelope({
      ...validEnvelope(),
      verificationEvidence: { build: "unknown", tests: "pass", lint: "n/a" },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("verificationEvidence.build")));
  });

  it("rejects verificationEvidence with invalid tests slot", () => {
    const result = validateEvidenceEnvelope({
      ...validEnvelope(),
      verificationEvidence: { build: "pass", tests: null, lint: "n/a" },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("verificationEvidence.tests")));
  });

  it("rejects verificationEvidence with invalid lint slot", () => {
    const result = validateEvidenceEnvelope({
      ...validEnvelope(),
      verificationEvidence: { build: "pass", tests: "fail", lint: "bad" },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("verificationEvidence.lint")));
  });

  it("collects all errors when multiple fields are invalid", () => {
    const result = validateEvidenceEnvelope({
      roleName: "",
      status: "",
      summary: "",
      verificationEvidence: { build: "bad", tests: "bad", lint: "bad" },
    });
    assert.equal(result.valid, false);
    // roleName, status, summary, + 3 evidence slot errors = at least 6
    assert.ok(result.errors.length >= 6, `expected ≥6 errors, got ${result.errors.length}`);
  });

  it("negative path: envelope with only roleName is invalid", () => {
    const result = validateEvidenceEnvelope({ roleName: "worker" });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("status")));
    assert.ok(result.errors.some(e => e.includes("summary")));
  });

  it("accepts all valid slot combinations", () => {
    const slots = ["pass", "fail", "n/a"] as const;
    for (const b of slots) {
      for (const t of slots) {
        for (const l of slots) {
          const result = validateEvidenceEnvelope({
            ...validEnvelope(),
            verificationEvidence: { build: b, tests: t, lint: l },
          });
          assert.equal(result.valid, true, `expected valid for build=${b} tests=${t} lint=${l}`);
        }
      }
    }
  });
});
