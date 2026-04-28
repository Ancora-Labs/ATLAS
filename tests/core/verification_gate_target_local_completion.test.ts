import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateWorkerContract } from "../../src/core/verification_gate.js";

describe("verification_gate — active single-target local completion", () => {
  it("accepts local target completion without PR URL or merged SHA", () => {
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=n/a; API=n/a; RESPONSIVE=n/a",
      ].join("\n"),
    }, {
      taskKind: "backend",
      allowLocalTargetCompletion: true,
    });

    assert.equal(result.passed, true);
    assert.equal(result.gaps.length, 0);
  });

  it("still enforces required local verification fields in local target mode", () => {
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=fail; EDGE_CASES=pass; SECURITY=n/a; API=n/a; RESPONSIVE=n/a",
      ].join("\n"),
    }, {
      taskKind: "backend",
      allowLocalTargetCompletion: true,
    });

    assert.equal(result.passed, false);
    assert.ok(result.gaps.some((gap) => gap.includes("TESTS reported as FAIL")), `expected TESTS failure gap, got: ${result.gaps.join(" | ")}`);
  });
});