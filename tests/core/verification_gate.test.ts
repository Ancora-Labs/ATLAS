import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildReworkInstruction,
  decideRework,
  parseResponsiveMatrix,
  parseVerificationReport,
  validateWorkerContract,
  checkPostMergeArtifact,
  POST_MERGE_PLACEHOLDER,
  NON_MERGE_TASK_KINDS,
  isArtifactGateRequired,
  checkNamedTestProof,
  NAMED_TEST_PROOF_GAP,
  NAMED_TEST_PROOF_PATTERN,
} from "../../src/core/verification_gate.js";

describe("verification_gate parse helpers", () => {
  it("parses canonical VERIFICATION_REPORT fields", () => {
    const report = parseVerificationReport(
      "VERIFICATION_REPORT: BUILD=pass; TESTS=fail; RESPONSIVE=n/a; API=pass; EDGE_CASES=pass; SECURITY=pass"
    );
    assert.deepEqual(report, {
      build: "pass",
      tests: "fail",
      responsive: "n/a",
      api: "pass",
      edgeCases: "pass",
      security: "pass"
    });
  });

  it("normalizes synonyms in VERIFICATION_REPORT", () => {
    const report = parseVerificationReport(
      "VERIFICATION_REPORT: test=pass; responsivematrix=pass; edge_cases=pass; build=pass"
    );
    assert.equal(report.tests, "pass");
    assert.equal(report.responsive, "pass");
    assert.equal(report.edgeCases, "pass");
    assert.equal(report.build, "pass");
  });

  it("returns null when VERIFICATION_REPORT marker is missing", () => {
    assert.equal(parseVerificationReport("no report here"), null);
  });

  it("parses RESPONSIVE_MATRIX key/value pairs", () => {
    const matrix = parseResponsiveMatrix("RESPONSIVE_MATRIX: 320x568=pass, 360x640=fail, 768x1024=pass");
    assert.deepEqual(matrix, {
      "320x568": "pass",
      "360x640": "fail",
      "768x1024": "pass"
    });
  });
});

describe("verification_gate worker contract enforcement", () => {
  it("rejects backend done result when required tests evidence is fail", () => {
    const parsedResponse = {
      status: "done",
      fullOutput: "VERIFICATION_REPORT: BUILD=pass; TESTS=fail; EDGE_CASES=pass; SECURITY=pass\nBOX_PR_URL=https://github.com/a/b/pull/1"
    };
    const result = validateWorkerContract("backend", parsedResponse);
    assert.equal(result.passed, false);
    assert.ok(result.gaps.some((g) => g.includes("TESTS reported as FAIL")));
  });

  it("rejects backend done result when VERIFICATION_REPORT is missing", () => {
    const parsedResponse = {
      status: "done",
      fullOutput: "I fixed the issue but forgot report"
    };
    const result = validateWorkerContract("backend", parsedResponse);
    assert.equal(result.passed, false);
    assert.ok(result.gaps.some((g) => g.includes("VERIFICATION_REPORT missing")));
  });

  it("passes skipped status without requiring evidence", () => {
    const parsedResponse = {
      status: "skipped",
      fullOutput: ""
    };
    const result = validateWorkerContract("backend", parsedResponse);
    assert.equal(result.passed, true);
    assert.equal(result.gaps.length, 0);
  });

  it("rejects frontend when responsive matrix has fewer passes than required minimum", () => {
    const parsedResponse = {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; RESPONSIVE=pass; EDGE_CASES=pass; SECURITY=pass",
        "RESPONSIVE_MATRIX: 320x568=pass, 360x640=pass, 375x667=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/123"
      ].join("\n")
    };
    const result = validateWorkerContract("frontend", parsedResponse);
    assert.equal(result.passed, false);
    assert.ok(result.gaps.some((g) => g.includes("viewports passed")));
  });

  it("passes backend when all required evidence and PR URL are present", () => {
    const parsedResponse = {
      status: "done",
      fullOutput: [
        "Merged commit abc123d into main",
        "# tests 10 # pass 10 # fail 0",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass; API=n/a; RESPONSIVE=n/a",
        "BOX_PR_URL=https://github.com/org/repo/pull/88"
      ].join("\n")
    };
    const result = validateWorkerContract("backend", parsedResponse);
    assert.equal(result.passed, true);
    assert.equal(result.gaps.length, 0);
  });
});

describe("verification_gate rework decisioning", () => {
  it("requests rework when validation failed and attempts remain", () => {
    const decision = decideRework(
      { passed: false, gaps: ["TESTS reported as FAIL"] },
      "Fix tests",
      0,
      2
    );
    assert.equal(decision.shouldRework, true);
    assert.equal(decision.shouldEscalate, false);
    assert.ok(decision.instruction?.isRework);
  });

  it("escalates when max rework attempts are exceeded", () => {
    const decision = decideRework(
      { passed: false, gaps: ["BUILD reported as FAIL"] },
      "Fix build",
      2,
      2
    );
    assert.equal(decision.shouldRework, false);
    assert.equal(decision.shouldEscalate, true);
    assert.ok(String(decision.escalationReason || "").includes("failed verification"));
  });

  it("passes through immediately when validation already passed", () => {
    const decision = decideRework(
      { passed: true, gaps: [] },
      "Fix tests",
      0,
      2
    );
    assert.equal(decision.shouldRework, false);
    assert.equal(decision.shouldEscalate, false);
    assert.equal(decision.instruction, null);
  });
});

describe("verification_gate buildReworkInstruction — gap list and attempt metadata (AC#3)", () => {
  it("includes all gap descriptions in rework task text", () => {
    const gaps = ["BUILD is required but was missing", "TESTS reported as FAIL"];
    const instruction = buildReworkInstruction("Implement feature X", gaps, 1, 2);
    assert.ok(
      instruction.task.includes("BUILD is required but was missing"),
      "gap 1 must appear in task text"
    );
    assert.ok(
      instruction.task.includes("TESTS reported as FAIL"),
      "gap 2 must appear in task text"
    );
  });

  it("includes numbered gap list in rework task text", () => {
    const gaps = ["EDGE_CASES is required but was missing"];
    const instruction = buildReworkInstruction("Fix edge cases", gaps, 1, 2);
    assert.match(instruction.task, /1\.\s+EDGE_CASES is required/);
  });

  it("includes attempt metadata in rework instruction object", () => {
    const instruction = buildReworkInstruction("Do work", ["BUILD missing"], 1, 2);
    assert.equal(instruction.reworkAttempt, 1, "reworkAttempt must equal the current attempt");
    assert.equal(instruction.maxReworkAttempts, 2, "maxReworkAttempts must be preserved");
    assert.equal(instruction.isRework, true);
    assert.equal(instruction.taskKind, "rework");
  });

  it("includes attempt counter in task header string", () => {
    const instruction = buildReworkInstruction("task", ["gap"], 2, 2);
    assert.match(instruction.task, /attempt 2\/2/i);
  });

  it("includes final-attempt warning when attempt equals max", () => {
    const instruction = buildReworkInstruction("task", ["gap"], 2, 2);
    assert.match(instruction.task, /FINAL ATTEMPT/i);
  });

  it("does not include final-attempt warning on intermediate attempts", () => {
    const instruction = buildReworkInstruction("task", ["gap"], 1, 2);
    assert.ok(!instruction.task.includes("FINAL ATTEMPT"));
  });

  it("includes original task text for worker reference", () => {
    const instruction = buildReworkInstruction("Implement OAuth login", ["BUILD missing"], 1, 2);
    assert.ok(instruction.task.includes("Implement OAuth login"), "original task must be included");
  });

  it("sets isFollowUp=true so conversation context is built correctly", () => {
    const instruction = buildReworkInstruction("task", ["gap"], 1, 2);
    assert.equal(instruction.isFollowUp, true);
  });

  it("includes gap summary in instruction context field", () => {
    const gaps = ["TESTS fail", "BUILD missing"];
    const instruction = buildReworkInstruction("task", gaps, 1, 2);
    assert.ok(instruction.context.includes("TESTS fail"), "context must include gap list");
    assert.ok(instruction.context.includes("BUILD missing"));
  });
});

describe("verification_gate validateWorkerContract — skipped and non-done statuses", () => {
  it("skipped status passes without evidence (pre-existing pass-through)", () => {
    const result = validateWorkerContract("backend", { status: "skipped", fullOutput: "" });
    assert.equal(result.passed, true);
    assert.equal(result.gaps.length, 0);
  });

  it("partial status bypasses verification (non-done)", () => {
    const result = validateWorkerContract("backend", { status: "partial", fullOutput: "" });
    assert.equal(result.passed, true);
    assert.equal(result.gaps.length, 0);
  });

  it("blocked status bypasses verification (non-done)", () => {
    const result = validateWorkerContract("backend", { status: "blocked", fullOutput: "Cannot access repo" });
    assert.equal(result.passed, true);
    assert.equal(result.gaps.length, 0);
  });

  it("scan role (scanA) is fully exempt from verification", () => {
    const result = validateWorkerContract("scanA", {
      status: "done",
      fullOutput: "Scanned 42 files, no report needed"
    });
    assert.equal(result.passed, true);
    assert.equal(result.gaps.length, 0);
    assert.match(result.reason, /exempt/i);
  });
});

describe("verification_gate — post-merge artifact (Packet 1/3)", () => {
  it("exports post-merge placeholder constant", () => {
    assert.ok(POST_MERGE_PLACEHOLDER);
  });

  it("checkPostMergeArtifact detects missing SHA in short text", () => {
    const result = checkPostMergeArtifact("no sha here at all");
    assert.equal(result.hasSha, false);
  });

  it("checkPostMergeArtifact detects present SHA and test output", () => {
    const result = checkPostMergeArtifact("Commit: abc123d\ntests 5 pass 5 fail 0");
    assert.equal(result.hasSha, true);
    assert.equal(result.hasTestOutput, true);
  });

  it("checkPostMergeArtifact detects unfilled placeholder", () => {
    const result = checkPostMergeArtifact(`Some output with ${POST_MERGE_PLACEHOLDER}`);
    assert.equal(result.hasUnfilledPlaceholder, true);
  });

  it("checkPostMergeArtifact returns clean result for complete artifact", () => {
    const text = "abc123d\n# tests 10 pass";
    const result = checkPostMergeArtifact(text);
    assert.equal(result.hasSha, true);
    assert.equal(result.hasTestOutput, true);
    assert.equal(result.hasUnfilledPlaceholder, false);
    assert.equal(result.hasArtifact, true);
  });
});

// ── SHA + raw npm output enforced across done-capable lanes ──────────────────

describe("verification_gate — SHA + raw npm output enforced across done-capable lanes", () => {
  it("should fail done when SHA or raw npm output block is absent for done-capable lanes", () => {
    // Test worker (quality lane) reports done without a git SHA or npm test output block.
    // With the extended artifact gate, this must fail even for non-implementation lanes.
    const result = validateWorkerContract("test", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=n/a; TESTS=pass; EDGE_CASES=pass",
        // No 7-char hex SHA, no raw npm test output block
      ].join("\n")
    });

    assert.equal(result.passed, false, "test worker done without SHA/npm output must fail");
    const hasArtifactGap = result.gaps.some(
      g => /sha|npm|post-merge/i.test(g)
    );
    assert.ok(hasArtifactGap,
      `expected a SHA or npm output gap; got: [${result.gaps.join("; ")}]`
    );
  });

  it("test worker done with valid SHA and npm output passes the artifact gate", () => {
    const result = validateWorkerContract("test", {
      status: "done",
      fullOutput: [
        "abc123d merged into main",
        "# tests 10 # pass 10 # fail 0",
        "VERIFICATION_REPORT: BUILD=n/a; TESTS=pass; EDGE_CASES=pass"
      ].join("\n")
    });
    // No artifact-related gaps (other gaps like prUrl may exist for different profiles)
    const artifactGap = result.gaps.find(g => /sha|npm|post-merge/i.test(g));
    assert.equal(artifactGap, undefined,
      `unexpected artifact gap when SHA + npm output are present: ${artifactGap}`
    );
  });

  it("backend worker done without SHA fails the artifact gate", () => {
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=n/a; API=n/a; RESPONSIVE=n/a",
        "BOX_PR_URL=https://github.com/org/repo/pull/99"
        // No git SHA present
      ].join("\n")
    });
    assert.equal(result.passed, false);
    assert.ok(result.gaps.some(g => /sha/i.test(g)),
      `expected SHA gap; got: [${result.gaps.join("; ")}]`
    );
  });

  it("scan role done is not gated by post-merge artifact requirements", () => {
    const result = validateWorkerContract("scanA", {
      status: "done",
      fullOutput: "read-only scan finished"
    });
    assert.equal(result.passed, true);
    assert.equal(result.gaps.length, 0);
    assert.match(String(result.reason || ""), /exempt/i);
  });
});

// ── Task 2: Artifact gate applies regardless of workerKind ────────────────────

describe("verification_gate — artifact check mandatory across all completion paths (Task 2)", () => {
  it("unknown workerKind falls through to DEFAULT_PROFILE which requires build", () => {
    // 'unknown' kind hits DEFAULT_PROFILE: build=required, artifacts required
    const result = validateWorkerContract("unknown", {
      status: "done",
      fullOutput: "All done!"
    });
    assert.equal(result.passed, false);
    assert.ok(
      result.gaps.some(g => /sha|test output/i.test(g)),
      `expected artifact gap for unknown kind; got: [${result.gaps.join("; ")}]`
    );
  });

  it("done status with git SHA + npm test output passes artifact gate for unknown workerKind", () => {
    const result = validateWorkerContract("unknown", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=n/a",
        "Merged at abc1234",
        "  3 passing"
      ].join("\n")
    });
    // Should not fail on artifact gate specifically
    const artifactGaps = result.gaps.filter(g => /sha|test output|placeholder/i.test(g));
    assert.equal(artifactGaps.length, 0, `artifact gate should not fire; gaps: [${result.gaps.join("; ")}]`);
  });

  it("negative path: done output with placeholder token is rejected even for unknown workerKind", () => {
    const result = validateWorkerContract("unknown", {
      status: "done",
      fullOutput: "POST_MERGE_TEST_OUTPUT placeholder not replaced"
    });
    assert.equal(result.passed, false);
    assert.ok(
      result.gaps.some(g => /placeholder/i.test(g)),
      `expected placeholder gap; got: [${result.gaps.join("; ")}]`
    );
  });
});

// ── Task 1: Refined done gate — NON_MERGE_TASK_KINDS + isArtifactGateRequired ─

describe("verification_gate — NON_MERGE_TASK_KINDS constant", () => {
  it("exports a Set containing the canonical non-merge task kinds", () => {
    assert.ok(NON_MERGE_TASK_KINDS instanceof Set, "NON_MERGE_TASK_KINDS must be a Set");
    assert.ok(NON_MERGE_TASK_KINDS.has("scan"), "scan must be in NON_MERGE_TASK_KINDS");
    assert.ok(NON_MERGE_TASK_KINDS.has("doc"), "doc must be in NON_MERGE_TASK_KINDS");
    assert.ok(NON_MERGE_TASK_KINDS.has("observation"), "observation must be in NON_MERGE_TASK_KINDS");
    assert.ok(NON_MERGE_TASK_KINDS.has("diagnosis"), "diagnosis must be in NON_MERGE_TASK_KINDS");
  });

  it("does not include implementation or rework kinds", () => {
    assert.ok(!NON_MERGE_TASK_KINDS.has("backend"), "backend must NOT be in NON_MERGE_TASK_KINDS");
    assert.ok(!NON_MERGE_TASK_KINDS.has("rework"), "rework must NOT be in NON_MERGE_TASK_KINDS");
    assert.ok(!NON_MERGE_TASK_KINDS.has("general"), "general must NOT be in NON_MERGE_TASK_KINDS");
  });
});

describe("verification_gate — isArtifactGateRequired", () => {
  it("returns true for backend role with implementation taskKind", () => {
    assert.equal(isArtifactGateRequired("backend", "backend"), true);
  });

  it("returns true for backend role with no taskKind", () => {
    assert.equal(isArtifactGateRequired("backend", null), true);
    assert.equal(isArtifactGateRequired("backend", undefined), true);
  });

  it("returns false for fully-exempt role (scanA) regardless of taskKind", () => {
    assert.equal(isArtifactGateRequired("scanA", "backend"), false);
    assert.equal(isArtifactGateRequired("scanA", null), false);
  });

  it("returns false for backend role when taskKind is scan (non-merge)", () => {
    assert.equal(isArtifactGateRequired("backend", "scan"), false);
  });

  it("returns false for backend role when taskKind is doc (non-merge)", () => {
    assert.equal(isArtifactGateRequired("backend", "doc"), false);
  });

  it("returns false for backend role when taskKind is observation (non-merge)", () => {
    assert.equal(isArtifactGateRequired("backend", "observation"), false);
  });

  it("returns false for backend role when taskKind is diagnosis (non-merge)", () => {
    assert.equal(isArtifactGateRequired("backend", "diagnosis"), false);
  });

  it("returns true for backend role when taskKind is rework (re-implementation)", () => {
    assert.equal(isArtifactGateRequired("backend", "rework"), true);
  });

  it("returns true for backend role when taskKind is general (ambiguous, conservative default)", () => {
    assert.equal(isArtifactGateRequired("backend", "general"), true);
  });

  it("is case-insensitive for taskKind", () => {
    assert.equal(isArtifactGateRequired("backend", "SCAN"), false);
    assert.equal(isArtifactGateRequired("backend", "Doc"), false);
  });
});

describe("verification_gate — task-kind aware artifact gate in validateWorkerContract", () => {
  const SCAN_OUTPUT_NO_ARTIFACT = [
    "VERIFICATION_REPORT: BUILD=n/a; TESTS=n/a; EDGE_CASES=n/a",
    "Scanned 42 files. No changes required.",
    // No git SHA, no npm test output — legitimate for scan task
  ].join("\n");

  it("backend role with scan taskKind: done without artifact passes gate", () => {
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: SCAN_OUTPUT_NO_ARTIFACT
    }, { taskKind: "scan" });

    const artifactGap = result.gaps.find(g => /sha|npm|post-merge/i.test(g));
    assert.equal(
      artifactGap, undefined,
      `scan taskKind must skip artifact gate; unexpected gap: ${artifactGap}`
    );
  });

  it("backend role with doc taskKind: done without artifact passes gate", () => {
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: SCAN_OUTPUT_NO_ARTIFACT
    }, { taskKind: "doc" });

    const artifactGap = result.gaps.find(g => /sha|npm|post-merge/i.test(g));
    assert.equal(
      artifactGap, undefined,
      `doc taskKind must skip artifact gate; unexpected gap: ${artifactGap}`
    );
  });

  it("backend role with backend taskKind: done without artifact still fails gate", () => {
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=n/a; API=n/a; RESPONSIVE=n/a",
        "BOX_PR_URL=https://github.com/org/repo/pull/99"
        // No git SHA or npm test block
      ].join("\n")
    }, { taskKind: "backend" });

    assert.equal(result.passed, false);
    const hasArtifactGap = result.gaps.some(g => /sha|test output|npm/i.test(g));
    assert.ok(hasArtifactGap,
      `implementation taskKind must still require artifact; gaps: [${result.gaps.join("; ")}]`
    );
  });

  it("backend role with rework taskKind: done without artifact still fails gate (re-implementation)", () => {
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=n/a; API=n/a; RESPONSIVE=n/a",
        "BOX_PR_URL=https://github.com/org/repo/pull/77"
      ].join("\n")
    }, { taskKind: "rework" });

    assert.equal(result.passed, false);
    const hasArtifactGap = result.gaps.some(g => /sha|test output|npm/i.test(g));
    assert.ok(hasArtifactGap,
      `rework taskKind must still require artifact; gaps: [${result.gaps.join("; ")}]`
    );
  });

  it("negative path: scan taskKind with unfilled placeholder is still rejected", () => {
    // Placeholder is always rejected regardless of task kind — it signals
    // the worker did not replace the template with real output.
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: `POST_MERGE_TEST_OUTPUT placeholder here`
    }, { taskKind: "scan" });

    // For scan taskKind: artifact gate is skipped entirely, so placeholder
    // check does NOT fire (no artifact gate = no placeholder check).
    // This is correct: a scan worker won't include npm output at all.
    const artifactGap = result.gaps.find(g => /sha|npm|post-merge|placeholder/i.test(g));
    assert.equal(
      artifactGap, undefined,
      `scan taskKind skips artifact gate entirely (including placeholder check); got: ${artifactGap}`
    );
  });
});

// ── collectArtifactGaps — shared gap-collection contract ──────────────────────

import {
  collectArtifactGaps,
  ARTIFACT_GAP,
} from "../../src/core/verification_gate.js";

describe("verification_gate — collectArtifactGaps shared contract", () => {
  it("returns empty array when artifact is complete", () => {
    const artifact = { hasSha: true, hasTestOutput: true, hasUnfilledPlaceholder: false };
    assert.deepEqual(collectArtifactGaps(artifact), []);
  });

  it("returns MISSING_SHA gap when SHA is absent", () => {
    const artifact = { hasSha: false, hasTestOutput: true, hasUnfilledPlaceholder: false };
    const gaps = collectArtifactGaps(artifact);
    assert.ok(gaps.some(g => /sha/i.test(g)), `expected SHA gap; got: [${gaps.join("; ")}]`);
  });

  it("returns MISSING_TEST_OUTPUT gap when test output is absent", () => {
    const artifact = { hasSha: true, hasTestOutput: false, hasUnfilledPlaceholder: false };
    const gaps = collectArtifactGaps(artifact);
    assert.ok(gaps.some(g => /npm|test output/i.test(g)), `expected test-output gap; got: [${gaps.join("; ")}]`);
  });

  it("returns UNFILLED_PLACEHOLDER gap when placeholder is present", () => {
    const artifact = { hasSha: true, hasTestOutput: true, hasUnfilledPlaceholder: true };
    const gaps = collectArtifactGaps(artifact);
    assert.ok(gaps.some(g => /placeholder/i.test(g)), `expected placeholder gap; got: [${gaps.join("; ")}]`);
  });

  it("collects all three gaps when artifact is fully missing", () => {
    const artifact = { hasSha: false, hasTestOutput: false, hasUnfilledPlaceholder: true };
    const gaps = collectArtifactGaps(artifact);
    assert.equal(gaps.length, 3, `expected 3 gaps; got: [${gaps.join("; ")}]`);
  });

  it("gap reasons match ARTIFACT_GAP constants exactly", () => {
    const artifact = { hasSha: false, hasTestOutput: false, hasUnfilledPlaceholder: true };
    const gaps = collectArtifactGaps(artifact);
    assert.ok(gaps.includes(ARTIFACT_GAP.UNFILLED_PLACEHOLDER), "must include UNFILLED_PLACEHOLDER constant");
    assert.ok(gaps.includes(ARTIFACT_GAP.MISSING_SHA), "must include MISSING_SHA constant");
    assert.ok(gaps.includes(ARTIFACT_GAP.MISSING_TEST_OUTPUT), "must include MISSING_TEST_OUTPUT constant");
  });

  it("negative path: partial artifact returns only applicable gaps", () => {
    const artifact = { hasSha: true, hasTestOutput: false, hasUnfilledPlaceholder: false };
    const gaps = collectArtifactGaps(artifact);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0], ARTIFACT_GAP.MISSING_TEST_OUTPUT);
  });
});

// ── Task 1 hardening: artifact gate is non-bypassable ────────────────────────

describe("verification_gate — artifact gate non-bypassable (Task 1 hardening)", () => {
  it("artifact gate fires even when no explicit bypass option is passed", () => {
    // A backend worker reports done without a git SHA — must fail regardless of options.
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=n/a; API=n/a; RESPONSIVE=n/a",
        "BOX_PR_URL=https://github.com/org/repo/pull/1"
        // No git SHA or npm test output
      ].join("\n")
    }, {});  // empty options — no requirePostMergeArtifact property
    assert.equal(result.passed, false);
    assert.ok(result.gaps.some(g => /sha/i.test(g)),
      `artifact gate must fire with empty options; gaps: [${result.gaps.join("; ")}]`
    );
  });

  it("ValidateWorkerContractOptions interface no longer includes requirePostMergeArtifact", () => {
    // Passing an extra property is allowed in TS at runtime, but the gate must not use it.
    // A done result without SHA must fail even when a caller attempts to pass the old option.
    const optionsWithOldBypass: Record<string, unknown> = { requirePostMergeArtifact: false };
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass"
    }, optionsWithOldBypass as any);
    // Gate must still fire — the old option is ignored.
    assert.equal(result.passed, false);
    assert.ok(result.gaps.some(g => /sha|artifact|test output/i.test(g)),
      `old requirePostMergeArtifact:false must not bypass the gate; gaps: [${result.gaps.join("; ")}]`
    );
  });

  it("negative path: done with SHA + test output passes even when old option value passed", () => {
    // Ensure we haven't broken the happy path while removing the bypass.
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "Merged abc1234 into main",
        "# tests 5 # pass 5 # fail 0",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=n/a; API=n/a; RESPONSIVE=n/a",
        "BOX_PR_URL=https://github.com/org/repo/pull/1"
      ].join("\n")
    }, { requirePostMergeArtifact: false } as any);
    const artifactGap = result.gaps.find(g => /sha|artifact|test output/i.test(g));
    assert.equal(artifactGap, undefined,
      `no artifact gap expected when SHA + test output are present; gaps: [${result.gaps.join("; ")}]`
    );
  });
});

// ── Task 3: Explicit merged SHA marker + npm test output block ─────────────────

import { extractMergedSha } from "../../src/core/verification_gate.js";

describe("verification_gate — BOX_MERGED_SHA explicit marker (Task 3)", () => {
  it("checkPostMergeArtifact detects explicit BOX_MERGED_SHA= marker", () => {
    const output = "BOX_MERGED_SHA=abc1234f\n# tests 5 pass 5 fail 0";
    const result = checkPostMergeArtifact(output);
    assert.equal(result.hasSha, true);
    assert.equal(result.hasExplicitShaMarker, true);
    assert.equal(result.mergedSha, "abc1234f");
  });

  it("checkPostMergeArtifact falls back to loose hex detection when no explicit marker", () => {
    const output = "Merged abc1234f into main\n# tests 5 pass";
    const result = checkPostMergeArtifact(output);
    assert.equal(result.hasSha, true);
    assert.equal(result.hasExplicitShaMarker, false);
    assert.equal(result.mergedSha, null, "loose SHA detection must not set mergedSha");
  });

  it("extractMergedSha returns the SHA from BOX_MERGED_SHA= marker", () => {
    const sha = extractMergedSha("BOX_MERGED_SHA=deadbeef1234567");
    assert.equal(sha, "deadbeef1234567");
  });

  it("extractMergedSha returns null when marker is absent", () => {
    assert.equal(extractMergedSha("Merged abc123 into main"), null);
    assert.equal(extractMergedSha(""), null);
  });

  it("extractMergedSha is case-insensitive for the marker", () => {
    assert.equal(extractMergedSha("box_merged_sha=abc1234f"), "abc1234f");
  });

  it("checkPostMergeArtifact detects explicit NPM test output block markers", () => {
    const output = [
      "BOX_MERGED_SHA=abc1234",
      "===NPM TEST OUTPUT START===",
      "# tests 10",
      "# pass 10",
      "# fail 0",
      "===NPM TEST OUTPUT END===",
    ].join("\n");
    const result = checkPostMergeArtifact(output);
    assert.equal(result.hasExplicitTestBlock, true);
    assert.equal(result.hasTestOutput, true);
    assert.equal(result.hasArtifact, true);
  });

  it("checkPostMergeArtifact hasExplicitTestBlock=false when only loose npm output present", () => {
    const output = "abc1234 merged\n# tests 10 pass";
    const result = checkPostMergeArtifact(output);
    assert.equal(result.hasExplicitTestBlock, false);
    assert.equal(result.hasTestOutput, true, "loose detection still counts as test output");
  });

  it("negative path: output with BOX_MERGED_SHA but no test output fails artifact gate", () => {
    const result = checkPostMergeArtifact("BOX_MERGED_SHA=abc1234");
    assert.equal(result.hasSha, true);
    assert.equal(result.hasTestOutput, false);
    assert.equal(result.hasArtifact, false);
  });

  it("negative path: output with npm test block but no SHA fails artifact gate", () => {
    const result = checkPostMergeArtifact(
      "===NPM TEST OUTPUT START===\n# pass 10\n===NPM TEST OUTPUT END===\n"
    );
    assert.equal(result.hasTestOutput, true);
    assert.equal(result.hasSha, false);
    assert.equal(result.hasArtifact, false);
  });
});

describe("worker_runner — mergedSha extraction in parseWorkerResponse (Task 3)", () => {
  it("extracts mergedSha from BOX_MERGED_SHA marker in worker output", async () => {
    const { parseWorkerResponse } = await import("../../src/core/worker_runner.js");
    const stdout = [
      "BOX_STATUS=done",
      "BOX_MERGED_SHA=abc1234f",
      "# tests 10 pass 10",
      "VERIFICATION_REPORT: BUILD=pass; TESTS=pass",
    ].join("\n");
    const result = parseWorkerResponse(stdout, "");
    assert.equal((result as any).mergedSha, "abc1234f",
      "mergedSha must be extracted from BOX_MERGED_SHA marker");
  });

  it("mergedSha is null when BOX_MERGED_SHA marker is absent", async () => {
    const { parseWorkerResponse } = await import("../../src/core/worker_runner.js");
    const result = parseWorkerResponse("BOX_STATUS=done\nSome output without SHA marker", "");
    assert.equal((result as any).mergedSha, null,
      "mergedSha must be null when explicit marker is absent");
  });
});

// ── Task 2: Strengthen done-path artifact assertions across role profiles ──────

describe("verification_gate — qa role done-path artifact enforcement (Task 2)", () => {
  it("qa role done without SHA or npm output fails artifact gate", () => {
    const result = validateWorkerContract("qa", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/55"
        // No SHA or npm test output block
      ].join("\n")
    });
    assert.equal(result.passed, false, "qa role done without artifact must fail");
    const hasArtifactGap = result.gaps.some(g => /sha|npm|post-merge|test output/i.test(g));
    assert.ok(hasArtifactGap,
      `expected artifact gap for qa role; got: [${result.gaps.join("; ")}]`
    );
  });

  it("qa role done with explicit BOX_MERGED_SHA and npm test block passes artifact gate", () => {
    const result = validateWorkerContract("qa", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234f",
        "===NPM TEST OUTPUT START===",
        "# tests 20",
        "# pass 20",
        "# fail 0",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/55"
      ].join("\n")
    });
    const artifactGap = result.gaps.find(g => /sha|npm|post-merge|test output/i.test(g));
    assert.equal(artifactGap, undefined,
      `qa done with BOX_MERGED_SHA + npm block must pass artifact gate; gaps: [${result.gaps.join("; ")}]`
    );
  });

  it("negative path: qa role done with unfilled placeholder is rejected", () => {
    const result = validateWorkerContract("qa", {
      status: "done",
      fullOutput: [
        "POST_MERGE_TEST_OUTPUT placeholder not replaced",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/55"
      ].join("\n")
    });
    assert.equal(result.passed, false);
    assert.ok(result.gaps.some(g => /placeholder/i.test(g)),
      `expected placeholder gap for qa role; got: [${result.gaps.join("; ")}]`
    );
  });
});

describe("verification_gate — security role done-path artifact enforcement (Task 2)", () => {
  it("security role done without SHA fails artifact gate", () => {
    const result = validateWorkerContract("security", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/77"
        // No SHA or npm test output
      ].join("\n")
    });
    assert.equal(result.passed, false, "security role done without artifact must fail");
    const hasArtifactGap = result.gaps.some(g => /sha|npm|post-merge|test output/i.test(g));
    assert.ok(hasArtifactGap,
      `expected artifact gap for security role; got: [${result.gaps.join("; ")}]`
    );
  });

  it("security role done with SHA and npm test output passes artifact gate", () => {
    const result = validateWorkerContract("security", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=deadbeef",
        "# tests 15 pass 15 fail 0",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/77"
      ].join("\n")
    });
    const artifactGap = result.gaps.find(g => /sha|npm|post-merge|test output/i.test(g));
    assert.equal(artifactGap, undefined,
      `security done with SHA + test output must pass artifact gate; gaps: [${result.gaps.join("; ")}]`
    );
  });

  it("api role done without artifact fails gate (negative path)", () => {
    const result = validateWorkerContract("api", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; API=pass; EDGE_CASES=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/33"
      ].join("\n")
    });
    assert.equal(result.passed, false, "api role done without artifact must fail");
    const hasArtifactGap = result.gaps.some(g => /sha|npm|post-merge|test output/i.test(g));
    assert.ok(hasArtifactGap,
      `expected artifact gap for api role; got: [${result.gaps.join("; ")}]`
    );
  });
});

// ── Task: ARTIFACT_GAP_CODE machine-readable reason codes ───────────────────

import {
  ARTIFACT_GAP_CODE,
  buildArtifactAuditEntry,
} from "../../src/core/verification_gate.js";

describe("verification_gate — ARTIFACT_GAP_CODE machine-readable codes", () => {
  it("exports ARTIFACT_GAP_CODE with three canonical codes", () => {
    assert.ok(ARTIFACT_GAP_CODE, "ARTIFACT_GAP_CODE must be exported");
    assert.equal(typeof ARTIFACT_GAP_CODE.UNFILLED_PLACEHOLDER, "string");
    assert.equal(typeof ARTIFACT_GAP_CODE.MISSING_SHA, "string");
    assert.equal(typeof ARTIFACT_GAP_CODE.MISSING_TEST_OUTPUT, "string");
  });

  it("ARTIFACT_GAP_CODE values are prefixed with artifact-gate/", () => {
    assert.ok(ARTIFACT_GAP_CODE.UNFILLED_PLACEHOLDER.startsWith("artifact-gate/"));
    assert.ok(ARTIFACT_GAP_CODE.MISSING_SHA.startsWith("artifact-gate/"));
    assert.ok(ARTIFACT_GAP_CODE.MISSING_TEST_OUTPUT.startsWith("artifact-gate/"));
  });

  it("ARTIFACT_GAP_CODE is frozen (immutable)", () => {
    assert.ok(Object.isFrozen(ARTIFACT_GAP_CODE), "ARTIFACT_GAP_CODE must be frozen");
  });

  it("ARTIFACT_GAP_CODE codes are distinct", () => {
    const codes = [
      ARTIFACT_GAP_CODE.UNFILLED_PLACEHOLDER,
      ARTIFACT_GAP_CODE.MISSING_SHA,
      ARTIFACT_GAP_CODE.MISSING_TEST_OUTPUT,
    ];
    const unique = new Set(codes);
    assert.equal(unique.size, codes.length, "all codes must be distinct");
  });
});

describe("verification_gate — buildArtifactAuditEntry structured audit record", () => {
  const fullArtifact = {
    hasSha: true,
    hasTestOutput: true,
    hasUnfilledPlaceholder: false,
    hasArtifact: true,
    hasExplicitShaMarker: true,
    hasExplicitTestBlock: false,
    mergedSha: "abc1234f",
  };

  const missingArtifact = {
    hasSha: false,
    hasTestOutput: false,
    hasUnfilledPlaceholder: true,
    hasArtifact: false,
    hasExplicitShaMarker: false,
    hasExplicitTestBlock: false,
    mergedSha: null,
  };

  it("returns a structured entry with gateSource and all required fields", () => {
    const gaps = collectArtifactGaps(missingArtifact);
    const entry = buildArtifactAuditEntry(missingArtifact, gaps, {
      gateSource: "hard-block",
      workerKind: "backend",
      roleName: "KingDavid",
      taskId: "T-001",
      taskSnippet: "Fix auth bug",
    });
    assert.equal(entry.gateSource, "hard-block");
    assert.equal(entry.workerKind, "backend");
    assert.equal(entry.roleName, "KingDavid");
    assert.equal(entry.taskId, "T-001");
    assert.equal(entry.taskSnippet, "Fix auth bug");
    assert.equal(entry.passed, false);
    assert.equal(Array.isArray(entry.gaps), true);
    assert.equal(Array.isArray(entry.reasonCodes), true);
    assert.ok(typeof entry.auditedAt === "string" && entry.auditedAt.length > 0);
  });

  it("reasonCodes correspond to ARTIFACT_GAP_CODE for each gap", () => {
    const gaps = collectArtifactGaps(missingArtifact);
    const entry = buildArtifactAuditEntry(missingArtifact, gaps, { gateSource: "hard-block" });
    assert.ok(entry.reasonCodes.includes(ARTIFACT_GAP_CODE.UNFILLED_PLACEHOLDER));
    assert.ok(entry.reasonCodes.includes(ARTIFACT_GAP_CODE.MISSING_SHA));
    assert.ok(entry.reasonCodes.includes(ARTIFACT_GAP_CODE.MISSING_TEST_OUTPUT));
  });

  it("reasonCodes length matches gaps length", () => {
    const gaps = collectArtifactGaps(missingArtifact);
    const entry = buildArtifactAuditEntry(missingArtifact, gaps, { gateSource: "evolution-gate" });
    assert.equal(entry.reasonCodes.length, gaps.length);
  });

  it("artifactDetail captures explicit marker flags and mergedSha", () => {
    const entry = buildArtifactAuditEntry(fullArtifact, [], {
      gateSource: "hard-block",
    });
    assert.equal(entry.artifactDetail.hasSha, true);
    assert.equal(entry.artifactDetail.hasTestOutput, true);
    assert.equal(entry.artifactDetail.hasExplicitShaMarker, true);
    assert.equal(entry.artifactDetail.hasExplicitTestBlock, false);
    assert.equal(entry.artifactDetail.mergedSha, "abc1234f");
  });

  it("passed=true when gaps array is empty", () => {
    const entry = buildArtifactAuditEntry(fullArtifact, [], { gateSource: "hard-block" });
    assert.equal(entry.passed, true);
  });

  it("defaults workerKind and roleName to 'unknown' when not provided", () => {
    const entry = buildArtifactAuditEntry(fullArtifact, [], { gateSource: "evolution-gate" });
    assert.equal(entry.workerKind, "unknown");
    assert.equal(entry.roleName, "unknown");
  });

  it("taskId defaults to null when not provided", () => {
    const entry = buildArtifactAuditEntry(fullArtifact, [], { gateSource: "evolution-gate" });
    assert.equal(entry.taskId, null);
  });

  it("taskSnippet is truncated to 100 characters", () => {
    const longSnippet = "A".repeat(200);
    const entry = buildArtifactAuditEntry(fullArtifact, [], {
      gateSource: "hard-block",
      taskSnippet: longSnippet,
    });
    assert.ok(entry.taskSnippet !== null && entry.taskSnippet.length <= 100,
      `taskSnippet must be at most 100 chars; got ${entry.taskSnippet?.length}`);
  });

  it("negative path: reasonCodes contains UNKNOWN for unrecognized gap string", () => {
    const entry = buildArtifactAuditEntry(fullArtifact, ["some-unrecognized-gap"], {
      gateSource: "hard-block",
    });
    assert.ok(entry.reasonCodes.includes(ARTIFACT_GAP_CODE.UNKNOWN),
      `unrecognized gap must map to UNKNOWN code; got: [${entry.reasonCodes.join("; ")}]`
    );
  });

  it("evolution-gate gateSource is preserved in the entry", () => {
    const entry = buildArtifactAuditEntry(fullArtifact, [], { gateSource: "evolution-gate" });
    assert.equal(entry.gateSource, "evolution-gate");
  });
});

// ── Task 1: Artifact gate enforced across all done-capable lanes ──────────────
// Ensures devops, integration, and frontend roles (all have ≥1 required
// evidence field) are blocked when SHA or npm test output is absent.

describe("verification_gate — artifact gate across additional done-capable lanes (Task 1)", () => {
  it("devops role done without SHA or npm output fails artifact gate", () => {
    const result = validateWorkerContract("devops", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=n/a; EDGE_CASES=n/a; SECURITY=n/a",
        "BOX_PR_URL=https://github.com/org/repo/pull/201",
        // No git SHA or npm test output
      ].join("\n")
    });
    assert.equal(result.passed, false, "devops done without artifact must fail");
    const hasArtifactGap = result.gaps.some(g => /sha|npm|post-merge|test output/i.test(g));
    assert.ok(hasArtifactGap,
      `expected artifact gap for devops role; got: [${result.gaps.join("; ")}]`
    );
  });

  it("devops role done with BOX_MERGED_SHA and npm block passes artifact gate", () => {
    const result = validateWorkerContract("devops", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=cafe1234",
        "===NPM TEST OUTPUT START===",
        "# tests 5",
        "# pass 5",
        "# fail 0",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=n/a; EDGE_CASES=n/a; SECURITY=n/a",
        "BOX_PR_URL=https://github.com/org/repo/pull/201",
      ].join("\n")
    });
    const artifactGap = result.gaps.find(g => /sha|npm|post-merge|test output/i.test(g));
    assert.equal(artifactGap, undefined,
      `devops done with BOX_MERGED_SHA + npm block must pass artifact gate; gaps: [${result.gaps.join("; ")}]`
    );
  });

  it("integration role done without artifact fails artifact gate (negative path)", () => {
    const result = validateWorkerContract("integration", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; API=pass; EDGE_CASES=pass",
        // No git SHA or npm test output
      ].join("\n")
    });
    assert.equal(result.passed, false, "integration done without artifact must fail");
    const hasArtifactGap = result.gaps.some(g => /sha|npm|post-merge|test output/i.test(g));
    assert.ok(hasArtifactGap,
      `expected artifact gap for integration role; got: [${result.gaps.join("; ")}]`
    );
  });

  it("frontend role done without SHA fails artifact gate (negative path)", () => {
    const result = validateWorkerContract("frontend", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=n/a; RESPONSIVE=pass; EDGE_CASES=pass",
        "RESPONSIVE_MATRIX: 320x568=pass, 360x640=pass, 375x667=pass, 390x844=pass, 412x915=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/300",
        // No git SHA or npm test output
      ].join("\n")
    });
    assert.equal(result.passed, false, "frontend done without artifact must fail");
    const hasArtifactGap = result.gaps.some(g => /sha|npm|post-merge|test output/i.test(g));
    assert.ok(hasArtifactGap,
      `expected artifact gap for frontend role; got: [${result.gaps.join("; ")}]`
    );
  });

  it("negative path: devops done with unfilled placeholder is rejected", () => {
    const result = validateWorkerContract("devops", {
      status: "done",
      fullOutput: [
        "POST_MERGE_TEST_OUTPUT placeholder not replaced",
        "VERIFICATION_REPORT: BUILD=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/202",
      ].join("\n")
    });
    assert.equal(result.passed, false);
    assert.ok(result.gaps.some(g => /placeholder/i.test(g)),
      `expected placeholder gap for devops role; got: [${result.gaps.join("; ")}]`
    );
  });
});

// ── Named test proof gate ─────────────────────────────────────────────────────

describe("verification_gate — checkNamedTestProof", () => {
  it("exports NAMED_TEST_PROOF_PATTERN as a RegExp", () => {
    assert.ok(NAMED_TEST_PROOF_PATTERN instanceof RegExp, "NAMED_TEST_PROOF_PATTERN must be a RegExp");
  });

  it("exports NAMED_TEST_PROOF_GAP as a non-empty string", () => {
    assert.ok(typeof NAMED_TEST_PROOF_GAP === "string" && NAMED_TEST_PROOF_GAP.length > 0);
  });

  it("returns matched:false for non-named-test verification text (e.g. 'npm test')", () => {
    const result = checkNamedTestProof("npm test", "all tests passed");
    assert.equal(result.matched, false, "'npm test' is not a named test proof format");
    assert.equal(result.gap, null, "no gap for non-named-test verification text");
    assert.equal(result.testFile, null);
    assert.equal(result.testDesc, null);
  });

  it("returns matched:false for empty verification text", () => {
    const result = checkNamedTestProof("", "some output");
    assert.equal(result.matched, false);
    assert.equal(result.gap, null);
  });

  it("returns matched:true with gap=null when test file appears in output (file-only format)", () => {
    const output = "# Subtest: prometheus_parse.test.ts\nok 1 - should compute X\n# pass 3\n";
    const result = checkNamedTestProof("tests/core/prometheus_parse.test.ts", output);
    assert.equal(result.matched, true, "file-only format must be matched");
    assert.equal(result.testFile, "tests/core/prometheus_parse.test.ts");
    assert.equal(result.gap, null, "gap must be null when test file appears in output");
  });

  it("returns matched:true with gap when test file does NOT appear in output", () => {
    const output = "# Subtest: some_other.test.ts\nok 1 - passes\n";
    const result = checkNamedTestProof("tests/core/prometheus_parse.test.ts", output);
    assert.equal(result.matched, true);
    assert.ok(result.gap !== null, "gap must be non-null when test file is missing from output");
    assert.ok(result.gap!.includes("prometheus_parse.test.ts"), "gap message must name the missing test file");
  });

  it("returns gap when test file is present but description is NOT in output", () => {
    const output = "# Subtest: verification_gate.test.ts\nok 1 - some other test\n";
    const result = checkNamedTestProof(
      "tests/core/verification_gate.test.ts — test: should validate named test proof",
      output
    );
    assert.equal(result.matched, true);
    assert.equal(result.testFile, "tests/core/verification_gate.test.ts");
    assert.equal(result.testDesc, "should validate named test proof");
    assert.ok(result.gap !== null, "gap must be non-null when description is missing from output");
    assert.ok(result.gap!.includes("should validate named test proof"), "gap must include the missing description");
  });

  it("returns gap=null when both test file and description appear in output", () => {
    const output = [
      "# Subtest: verification_gate.test.ts",
      "  ok 1 - should validate named test proof",
      "# pass 1",
    ].join("\n");
    const result = checkNamedTestProof(
      "tests/core/verification_gate.test.ts — test: should validate named test proof",
      output
    );
    assert.equal(result.matched, true);
    assert.equal(result.gap, null, "gap must be null when both file and description are in output");
  });

  it("negative: returns gap when worker output is empty", () => {
    const result = checkNamedTestProof("tests/core/foo.test.ts — test: should do X", "");
    assert.equal(result.matched, true, "empty output triggers named test proof check");
    assert.ok(result.gap !== null, "gap must be non-null when output is empty");
  });

  it("integrates with validateWorkerContract via options.verificationText — adds gap when named test file missing", () => {
    const parsedResponse = {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234",
        "===NPM TEST OUTPUT START===",
        "# Subtest: other_test.test.ts",
        "ok 1 - some test",
        "# pass 1",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/99",
      ].join("\n"),
    };
    const result = validateWorkerContract("backend", parsedResponse, {
      taskKind: "implementation",
      verificationText: "tests/core/my_specific.test.ts — test: should handle edge case",
    });
    assert.equal(result.passed, false, "must fail when named test file is not in output");
    const namedGap = result.gaps.find((g: string) => g.includes("my_specific.test.ts"));
    assert.ok(namedGap, `gaps must include the named test file gap; got: [${result.gaps.join("; ")}]`);
  });

  it("integrates with validateWorkerContract — no gap when verificationText is not a named test format", () => {
    const parsedResponse = {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234",
        "===NPM TEST OUTPUT START===",
        "# pass 5",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/88",
      ].join("\n"),
    };
    const result = validateWorkerContract("backend", parsedResponse, {
      taskKind: "implementation",
      verificationText: "npm test",
    });
    // 'npm test' is non-specific, so no named-test-proof gap should be added
    const namedGap = result.gaps.find((g: string) => g.includes("Named test proof"));
    assert.equal(namedGap, undefined, "no named-test-proof gap when verificationText is 'npm test'");
  });

  it("en dash (–) separator is supported as a valid named test proof format", () => {
    const output = "# Subtest: verification_gate.test.ts\n  ok 1 - should parse en dash separator\n";
    const result = checkNamedTestProof(
      "tests/core/verification_gate.test.ts \u2013 test: should parse en dash separator",
      output
    );
    assert.equal(result.matched, true, "en dash separator must be matched by NAMED_TEST_PROOF_PATTERN");
    assert.equal(result.gap, null, "gap must be null when file and description are in output");
  });

  it("hyphen (-) separator is supported as a valid named test proof format", () => {
    const output = "# Subtest: verification_gate.test.ts\n  ok 1 - should parse hyphen separator\n";
    const result = checkNamedTestProof(
      "tests/core/verification_gate.test.ts - test: should parse hyphen separator",
      output
    );
    assert.equal(result.matched, true, "hyphen separator must be matched by NAMED_TEST_PROOF_PATTERN");
    assert.equal(result.gap, null, "gap must be null when file and description are in output");
  });

  it("'it:' prefix is supported in named test proof description", () => {
    const output = "# Subtest: foo.test.ts\n  ok 1 - handle edge case\n";
    const result = checkNamedTestProof(
      "tests/core/foo.test.ts \u2014 it: handle edge case",
      output
    );
    assert.equal(result.matched, true, "it: prefix must be recognized as a named test proof format");
    assert.equal(result.testDesc, "handle edge case", "testDesc must strip the 'it:' prefix");
    assert.equal(result.gap, null, "gap must be null when description is in output");
  });

  it("negative: named test proof gap is NOT added when worker status is 'skipped'", () => {
    const parsedResponse = {
      status: "skipped",
      fullOutput: "Already merged in previous wave.",
    };
    const result = validateWorkerContract("backend", parsedResponse, {
      verificationText: "tests/core/specific.test.ts \u2014 test: some named proof",
    });
    assert.equal(result.passed, true,
      "skipped status must bypass all verification gates including named test proof");
    const namedGap = result.gaps.find((g: string) => g.includes("Named test proof"));
    assert.equal(namedGap, undefined,
      "named test proof gap must not be added for skipped status");
  });

  it("negative: named test proof gap is NOT added when worker status is 'partial'", () => {
    const parsedResponse = {
      status: "partial",
      fullOutput: "Work in progress.",
    };
    const result = validateWorkerContract("backend", parsedResponse, {
      verificationText: "tests/core/specific.test.ts \u2014 test: some named proof",
    });
    // partial status → verification skipped by validateWorkerContract
    const namedGap = result.gaps.find((g: string) => g.includes("Named test proof"));
    assert.equal(namedGap, undefined,
      "named test proof gap must not be added when status is partial (verification skipped for non-done)");
  });

  it("gap message references NAMED_TEST_PROOF_GAP constant prefix text", () => {
    const result = checkNamedTestProof("tests/core/foo.test.ts", "some unrelated output");
    assert.ok(result.gap !== null, "must produce a gap when test file is absent from output");
    assert.ok(
      result.gap!.startsWith("Named test proof missing"),
      `gap message must start with the NAMED_TEST_PROOF_GAP prefix; got: "${result.gap}"`
    );
  });
});

// ── Task 1: scanB and quality-worker done-path artifact gate coverage ─────────
// scanB has no required evidence fields → artifact gate must NOT fire.
// quality-worker has no dedicated profile → falls back to DEFAULT_PROFILE
// (build=required) → artifact gate MUST fire and block when SHA/npm output absent.

describe("verification_gate — scanB and quality-worker artifact gate (Task 1 coverage)", () => {
  it("scanB role done without artifact passes gate (no required evidence fields)", () => {
    // scanB (Documentation role): build=optional, everything else optional/exempt.
    // hasRequiredFields=false → requireArtifact=false → artifact gate is skipped.
    const result = validateWorkerContract("scanB", {
      status: "done",
      fullOutput: "Documentation review complete. No code changes made."
      // No git SHA, no npm test output — intentionally absent
    });
    assert.equal(result.passed, true,
      "scanB has no required fields, so artifact gate must not fire"
    );
    const artifactGap = result.gaps.find(g => /sha|npm|post-merge|test output/i.test(g));
    assert.equal(artifactGap, undefined,
      `scanB must not be blocked by artifact gate; unexpected gap: ${artifactGap}`
    );
  });

  it("quality-worker role done without SHA or npm output fails artifact gate", () => {
    // 'quality-worker' has no dedicated profile → falls back to DEFAULT_PROFILE.
    // DEFAULT_PROFILE has build=required → hasRequiredFields=true → artifact gate fires.
    const result = validateWorkerContract("quality-worker", {
      status: "done",
      fullOutput: [
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass",
        // No git SHA or npm test output
      ].join("\n")
    });
    assert.equal(result.passed, false,
      "quality-worker done without SHA/npm output must fail (DEFAULT_PROFILE: build=required)"
    );
    const hasArtifactGap = result.gaps.some(g => /sha|npm|post-merge|test output/i.test(g));
    assert.ok(hasArtifactGap,
      `expected artifact gap for quality-worker role; got: [${result.gaps.join("; ")}]`
    );
  });

  it("quality-worker role done with BOX_MERGED_SHA and npm block passes artifact gate", () => {
    const result = validateWorkerContract("quality-worker", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234f",
        "===NPM TEST OUTPUT START===",
        "# tests 10",
        "# pass 10",
        "# fail 0",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass",
      ].join("\n")
    });
    const artifactGap = result.gaps.find(g => /sha|npm|post-merge|test output/i.test(g));
    assert.equal(artifactGap, undefined,
      `quality-worker with BOX_MERGED_SHA + npm block must pass artifact gate; gaps: [${result.gaps.join("; ")}]`
    );
  });

  it("negative path: scanB done with unfilled placeholder passes gate (artifact gate skipped entirely for scanB)", () => {
    // scanB has no required fields → artifact gate block is never entered,
    // so the placeholder check does NOT fire — same behavior as scan taskKind.
    const result = validateWorkerContract("scanB", {
      status: "done",
      fullOutput: "POST_MERGE_TEST_OUTPUT placeholder not replaced"
    });
    assert.equal(result.passed, true,
      "scanB artifact gate is skipped entirely (no required fields)"
    );
    const artifactGap = result.gaps.find(g => /sha|npm|post-merge|test output|placeholder/i.test(g));
    assert.equal(artifactGap, undefined,
      `scanB placeholder check must not fire when artifact gate is skipped; got: ${artifactGap}`
    );
  });
});

// ── Task 1: Packet-named verification proof gate ──────────────────────────────
// When the task packet's verification field names a specific test file and/or
// description, the worker output must contain that evidence before done closure
// is accepted. This tests the integration path through validateWorkerContract.

describe("verification_gate — packet-named verification proof gate (Task 1)", () => {
  it("rejects done when packet verification names a test file absent from worker output", () => {
    // Packet says: run tests/core/foo.test.ts — but worker output doesn't mention it.
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234f",
        "===NPM TEST OUTPUT START===",
        "# Subtest: other_test.test.ts",
        "ok 1 - some passing test",
        "# pass 1",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/1",
      ].join("\n"),
    }, {
      taskKind: "backend",
      verificationText: "tests/core/foo.test.ts — test: should handle edge case",
    });
    assert.equal(result.passed, false,
      "done must be rejected when packet-named test file is absent from worker output"
    );
    const namedGap = result.gaps.find((g: string) => g.includes("foo.test.ts"));
    assert.ok(namedGap,
      `gaps must reference the missing named test file; got: [${result.gaps.join("; ")}]`
    );
  });

  it("accepts done when packet verification names a test file present in worker output", () => {
    // Packet names foo.test.ts and worker output contains it.
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234f",
        "===NPM TEST OUTPUT START===",
        "# Subtest: foo.test.ts",
        "ok 1 - should handle edge case",
        "# pass 1",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/1",
      ].join("\n"),
    }, {
      taskKind: "backend",
      verificationText: "tests/core/foo.test.ts — test: should handle edge case",
    });
    const namedGap = result.gaps.find((g: string) => g.includes("Named test proof"));
    assert.equal(namedGap, undefined,
      `no named-proof gap expected when test file and description are in output; got: ${namedGap}`
    );
  });

  it("no named-proof gap when verificationText is a non-specific format (e.g. 'npm test')", () => {
    // 'npm test' is not a named test proof format — gate must not fire.
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234f",
        "===NPM TEST OUTPUT START===",
        "# pass 5",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/2",
      ].join("\n"),
    }, {
      taskKind: "backend",
      verificationText: "npm test",
    });
    const namedGap = result.gaps.find((g: string) => g.includes("Named test proof"));
    assert.equal(namedGap, undefined,
      "generic 'npm test' must not trigger the named-proof gate"
    );
  });

  it("no named-proof gap when verificationText is null or empty", () => {
    // When no verificationText is provided, the gate must not fire.
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234f",
        "===NPM TEST OUTPUT START===",
        "# pass 5",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/3",
      ].join("\n"),
    }, {
      taskKind: "backend",
      verificationText: null,
    });
    const namedGap = result.gaps.find((g: string) => g.includes("Named test proof"));
    assert.equal(namedGap, undefined,
      "null verificationText must not trigger the named-proof gate"
    );
  });

  it("negative: named-proof gap is NOT added when worker status is skipped (proof gate bypassed)", () => {
    const result = validateWorkerContract("backend", {
      status: "skipped",
      fullOutput: "Already merged in a previous wave.",
    }, {
      verificationText: "tests/core/bar.test.ts — test: some named proof",
    });
    assert.equal(result.passed, true,
      "skipped status must bypass the named-proof gate entirely"
    );
    const namedGap = result.gaps.find((g: string) => g.includes("Named test proof"));
    assert.equal(namedGap, undefined,
      "skipped status must not trigger the named-proof gate"
    );
  });

  it("rejects done when packet names only a test file (no description) and file is absent", () => {
    const result = validateWorkerContract("backend", {
      status: "done",
      fullOutput: [
        "BOX_MERGED_SHA=abc1234f",
        "===NPM TEST OUTPUT START===",
        "# Subtest: other.test.ts",
        "# pass 1",
        "===NPM TEST OUTPUT END===",
        "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; EDGE_CASES=pass; SECURITY=pass",
        "BOX_PR_URL=https://github.com/org/repo/pull/4",
      ].join("\n"),
    }, {
      taskKind: "backend",
      verificationText: "tests/core/specific.test.ts",
    });
    assert.equal(result.passed, false,
      "done must be rejected when packet-named test file (file-only format) is absent"
    );
    const namedGap = result.gaps.find((g: string) => g.includes("specific.test.ts"));
    assert.ok(namedGap,
      `gaps must reference the missing named test file; got: [${result.gaps.join("; ")}]`
    );
  });
});

