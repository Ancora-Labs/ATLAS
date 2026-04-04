import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseWorkerResponse,
  detectRepoContamination,
  attemptBranchCleanlinessRecovery,
  shouldEnableFullToolAccess,
  evaluateWorkerRoleCapability
} from "../../src/core/worker_runner.js";
import { isProcessAlive } from "../../src/core/daemon_control.js";

// ── parseWorkerResponse ──────────────────────────────────────────────────────

describe("parseWorkerResponse", () => {
  it("parses done status when BOX_STATUS=done", () => {
    const result = parseWorkerResponse("BOX_STATUS=done\nSome output", "");
    assert.equal(result.status, "done");
  });

  it("defaults to done when no BOX_STATUS marker is present", () => {
    const result = parseWorkerResponse("Worker completed the task successfully.", "");
    assert.equal(result.status, "done");
  });

  it("parses blocked status", () => {
    const result = parseWorkerResponse("BOX_STATUS=blocked\nCannot access repo", "");
    assert.equal(result.status, "blocked");
  });

  it("parses partial status", () => {
    const result = parseWorkerResponse("BOX_STATUS=partial", "");
    assert.equal(result.status, "partial");
  });

  it("parses error status", () => {
    const result = parseWorkerResponse("", "fatal: not a git repository\nBOX_STATUS=error");
    assert.equal(result.status, "error");
  });

  it("normalizes unknown status values to done", () => {
    const result = parseWorkerResponse("BOX_STATUS=complete", "");
    assert.equal(result.status, "done");
  });

  it("extracts BOX_PR_URL", () => {
    const result = parseWorkerResponse("BOX_PR_URL=https://github.com/org/repo/pull/42", "");
    assert.equal(result.prUrl, "https://github.com/org/repo/pull/42");
  });

  it("returns null prUrl when marker is absent", () => {
    const result = parseWorkerResponse("No PR in this output", "");
    assert.equal(result.prUrl, null);
  });

  it("extracts BOX_BRANCH", () => {
    const result = parseWorkerResponse("BOX_BRANCH=box/feature-auth", "");
    assert.equal(result.currentBranch, "box/feature-auth");
  });

  it("extracts BOX_FILES_TOUCHED as array", () => {
    const result = parseWorkerResponse("BOX_FILES_TOUCHED=src/a.js,src/b.js, src/c.js", "");
    assert.deepEqual(result.filesTouched, ["src/a.js", "src/b.js", "src/c.js"]);
  });

  it("returns empty filesTouched when marker is absent", () => {
    const result = parseWorkerResponse("No files mentioned", "");
    assert.deepEqual(result.filesTouched, []);
  });

  // BOX_ACCESS blocked guardrail — access-blocked output must force status=blocked
  // even if the worker self-reports BOX_STATUS=done. This prevents silent swallowing
  // of blocked access states.
  it("forces status=blocked when BOX_ACCESS reports blocked fields", () => {
    const stdout = [
      "BOX_STATUS=done",
      "BOX_ACCESS=repo:blocked;files:ok;tools:ok;api:ok",
      "I completed the task"
    ].join("\n");
    const result = parseWorkerResponse(stdout, "");
    assert.equal(result.status, "blocked",
      "Worker self-reporting done must be overridden when access is blocked");
  });

  it("does not override status when BOX_ACCESS reports all ok", () => {
    const stdout = [
      "BOX_STATUS=done",
      "BOX_ACCESS=repo:ok;files:ok;tools:ok;api:ok"
    ].join("\n");
    const result = parseWorkerResponse(stdout, "");
    assert.equal(result.status, "done");
  });

  it("does not override status=blocked when BOX_ACCESS also blocked", () => {
    const stdout = "BOX_STATUS=blocked\nBOX_ACCESS=repo:blocked;files:ok;tools:ok;api:ok";
    const result = parseWorkerResponse(stdout, "");
    assert.equal(result.status, "blocked");
  });

  it("includes VERIFICATION_REPORT in verificationReport field", () => {
    const stdout = "VERIFICATION_REPORT: BUILD=pass; TESTS=pass; RESPONSIVE=n/a; API=n/a; EDGE_CASES=pass; SECURITY=pass";
    const result = parseWorkerResponse(stdout, "");
    assert.ok(result.verificationReport, "verificationReport should be populated");
    assert.equal(result.verificationReport.build, "pass");
    assert.equal(result.verificationReport.tests, "pass");
  });

  it("sets verificationReport to null when no VERIFICATION_REPORT marker is present", () => {
    const result = parseWorkerResponse("Task complete. No report.", "");
    assert.equal(result.verificationReport, null);
  });

  it("returns non-empty summary from stdout", () => {
    const result = parseWorkerResponse("I fixed the bug in src/auth.js", "");
    assert.ok(result.summary.length > 0);
  });

  it("returns fullOutput equal to raw stdout", () => {
    const raw = "BOX_STATUS=done\nSome text";
    const result = parseWorkerResponse(raw, "");
    assert.equal(result.fullOutput, raw);
  });
});

describe("tool access + capability guards", () => {
  it("grants full tools for Athena postmortem/review work even with drifted taskKind label", () => {
    const allowAll = shouldEnableFullToolAccess("quality-worker", "audit-followup", "Run Athena postmortem review on latest cycle");
    assert.equal(allowAll, true);
  });

  it("keeps least-privilege defaults for non-implementation/non-review tasks", () => {
    const allowAll = shouldEnableFullToolAccess("infrastructure-worker", "observation", "Collect dashboard screenshots");
    assert.equal(allowAll, false);
  });

  it("blocks unknown roles before worker invocation", () => {
    const check = evaluateWorkerRoleCapability({}, "unknown-worker", "athena-review", "Review dispatch failures");
    assert.equal(check.allowed, false);
    assert.equal(check.code, "ROLE_NOT_REGISTERED");
  });
});

// ── detectRepoContamination ──────────────────────────────────────────────────

describe("detectRepoContamination", () => {
  it("returns isContamination=false when summary is clean and no scope declared", () => {
    const result = detectRepoContamination("All good, task complete.", [], []);
    assert.equal(result.isContamination, false);
    assert.deepEqual(result.unrelatedFiles, []);
  });

  it("returns isContamination=true when summary contains SCOPE VIOLATION marker", () => {
    const result = detectRepoContamination("SCOPE VIOLATION: 1 file modified outside scope.", [], []);
    assert.equal(result.isContamination, true);
  });

  it("returns isContamination=true when summary contains 'unrelated file'", () => {
    const result = detectRepoContamination("Worker touched unrelated file src/foo.ts", [], []);
    assert.equal(result.isContamination, true);
  });

  it("returns isContamination=true when summary contains 'git checkout --'", () => {
    const result = detectRepoContamination("Recovery: revert with git checkout -- src/bar.ts", [], []);
    assert.equal(result.isContamination, true);
  });

  it("returns unrelatedFiles when touched files fall outside declared scope", () => {
    const result = detectRepoContamination(
      "Task done.",
      ["src/core/foo.ts", "src/dashboard/live.ts"],
      ["src/core/foo.ts"]
    );
    assert.equal(result.isContamination, true);
    assert.ok(result.unrelatedFiles.includes("src/dashboard/live.ts"));
    assert.ok(!result.unrelatedFiles.includes("src/core/foo.ts"));
  });

  it("returns isContamination=false when all touched files are within scope", () => {
    const result = detectRepoContamination(
      "Task done.",
      ["src/core/foo.ts", "tests/core/foo.test.ts"],
      ["src/core/foo.ts", "tests/core/foo.test.ts"]
    );
    assert.equal(result.isContamination, false);
    assert.deepEqual(result.unrelatedFiles, []);
  });

  it("returns isContamination=false when no files_hint declared (cannot enforce)", () => {
    const result = detectRepoContamination(
      "Task done.",
      ["src/core/foo.ts", "src/dashboard/live.ts"],
      []
    );
    assert.equal(result.isContamination, false);
    assert.deepEqual(result.unrelatedFiles, []);
  });

  it("normalizes Windows backslash paths when checking scope", () => {
    const result = detectRepoContamination(
      "Task done.",
      ["src\\core\\foo.ts"],
      ["src/core/foo.ts"]
    );
    assert.equal(result.isContamination, false, "backslash paths must be normalized for scope check");
    assert.deepEqual(result.unrelatedFiles, []);
  });

  it("negative: clean summary with no unrelated files returns false", () => {
    const result = detectRepoContamination(
      "Build passed, PR created.",
      ["src/core/orchestrator.ts", "tests/core/orchestrator.test.ts"],
      ["src/core/orchestrator.ts", "tests/core/orchestrator.test.ts"]
    );
    assert.equal(result.isContamination, false);
  });
});

// ── attemptBranchCleanlinessRecovery ────────────────────────────────────────

describe("attemptBranchCleanlinessRecovery", () => {
  it("returns recovered=true immediately when no files are specified", async () => {
    const result = await attemptBranchCleanlinessRecovery({}, [], 2);
    assert.equal(result.recovered, true);
    assert.equal(result.attemptsMade, 0);
    assert.deepEqual(result.errors, []);
  });

  it("returns recovered=true when filesToRecover is null-like (empty array)", async () => {
    const result = await attemptBranchCleanlinessRecovery({}, null as unknown as string[], 2);
    assert.equal(result.recovered, true);
    assert.equal(result.attemptsMade, 0);
  });

  it("returns a result object with the expected shape", async () => {
    // Non-empty file list will fail (git not in a repo here), but shape must be correct
    const result = await attemptBranchCleanlinessRecovery({}, ["non_existent_file.ts"], 1);
    assert.ok("recovered" in result, "result must have recovered field");
    assert.ok("attemptsMade" in result, "result must have attemptsMade field");
    assert.ok("errors" in result, "result must have errors field");
    assert.ok(Array.isArray(result.errors), "errors must be an array");
    // With a non-existent file, git will fail — recovered should be false
    assert.equal(result.recovered, false);
    assert.equal(result.attemptsMade, 1);
  });

  it("negative: exhausts maxAttempts without giving up early", async () => {
    const result = await attemptBranchCleanlinessRecovery({}, ["missing_file_1.ts", "missing_file_2.ts"], 2);
    // Both attempts should be made since files cannot be recovered
    assert.equal(result.attemptsMade, 2);
    assert.equal(result.recovered, false);
  });
});

// ── daemon-control: isProcessAlive ──────────────────────────────────────────

describe("isProcessAlive", () => {
  it("returns true for the current process pid", () => {
    assert.equal(isProcessAlive(process.pid), true);
  });

  it("returns false for pid 0", () => {
    assert.equal(isProcessAlive(0), false);
  });

  it("returns false for a negative pid", () => {
    assert.equal(isProcessAlive(-1), false);
  });

  it("returns false for a non-numeric value", () => {
    assert.equal(isProcessAlive("not-a-pid"), false);
  });

  it("returns false for a pid that does not exist (very high number)", () => {
    // PID 9999999 is astronomically unlikely to be a real process
    assert.equal(isProcessAlive(9999999), false);
  });
});
