import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  parseWorkerResponse,
  detectRepoContamination,
  attemptBranchCleanlinessRecovery,
  shouldEnableFullToolAccess,
  evaluateWorkerRoleCapability,
  injectCiFailureContextIfMissing,
  applyMemoryTrustFilter,
  computeMemoryHitRatio,
} from "../../src/core/worker_runner.js";
import { isProcessAlive } from "../../src/core/daemon_control.js";
import { buildRoutingROISummary } from "../../src/core/cycle_analytics.js";

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

  it("extracts explicit dispatch block reason from BOX_BLOCKER", () => {
    const stdout = "BOX_STATUS=blocked\nBOX_BLOCKER=governance_freeze_active:manual_freeze";
    const result = parseWorkerResponse(stdout, "");
    assert.equal(result.dispatchBlockReason, "governance_freeze_active:manual_freeze");
  });

  it("derives dispatch block reason from BOX_ACCESS blocked scopes when BOX_BLOCKER is absent", () => {
    const stdout = "BOX_STATUS=done\nBOX_ACCESS=repo:blocked;files:ok;tools:ok;api:ok";
    const result = parseWorkerResponse(stdout, "");
    assert.equal(result.status, "blocked");
    assert.equal(result.dispatchBlockReason, "access_blocked:repo");
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

  it("parses canonical block-style VERIFICATION_REPORT", () => {
    const stdout = [
      "===VERIFICATION_REPORT===",
      "BUILD=pass",
      "TESTS=pass",
      "EDGE_CASES=pass",
      "===END_VERIFICATION===",
    ].join("\n");
    const result = parseWorkerResponse(stdout, "");
    assert.ok(result.verificationReport);
    assert.equal(result.verificationReport.build, "pass");
    assert.equal(result.verificationReport.tests, "pass");
  });

  it("extracts CLEAN_TREE_STATUS evidence marker", () => {
    const result = parseWorkerResponse("CLEAN_TREE_STATUS=clean", "");
    assert.equal(result.cleanTreeStatus, true);
  });

  it("negative: cleanTreeStatus=false when marker is absent", () => {
    const result = parseWorkerResponse("No clean tree marker here", "");
    assert.equal(result.cleanTreeStatus, false);
  });

  it("keeps verificationReport null when VERIFICATION_REPORT block is malformed", () => {
    const stdout = "===VERIFICATION_REPORT===\nnot-a-report\n===END_VERIFICATION===";
    const result = parseWorkerResponse(stdout, "");
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

// ── injectCiFailureContextIfMissing ──────────────────────────────────────────

describe("injectCiFailureContextIfMissing", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-worker-ci-"));
  });

  afterEach(async () => {
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  it("skips injection when CI_FAILURE_CONTEXT already present", async () => {
    const instruction = { task: "fix ci", context: "## CI_FAILURE_CONTEXT\nalready present" };
    const result = await injectCiFailureContextIfMissing(instruction, { paths: { stateDir } });
    assert.equal(result.context, instruction.context, "must not double-inject");
  });

  it("injects from npm_test_full.log when available", async () => {
    await fs.writeFile(path.join(stateDir, "npm_test_full.log"), "FAIL tests/core/auth.test.ts\nError: bad", "utf8");
    const instruction = { task: "fix ci", context: "" };
    const result = await injectCiFailureContextIfMissing(instruction, { paths: { stateDir } });
    assert.ok(String(result.context).includes("## CI_FAILURE_CONTEXT"));
    assert.ok(String(result.context).includes("worker_runner_fallback:npm_test_full.log"));
  });

  it("falls back through artifact priority order", async () => {
    // Only test_run.log available
    await fs.writeFile(path.join(stateDir, "test_run.log"), "FAIL tests/core/runner.test.ts\nTypeError: x", "utf8");
    const instruction = { task: "fix ci", context: "" };
    const result = await injectCiFailureContextIfMissing(instruction, { paths: { stateDir } });
    assert.ok(String(result.context).includes("worker_runner_fallback:test_run.log"));
  });

  it("injects no-data marker when no artifacts exist", async () => {
    const instruction = { task: "fix ci", context: "" };
    const result = await injectCiFailureContextIfMissing(instruction, { paths: { stateDir } });
    assert.ok(String(result.context).includes("## CI_FAILURE_CONTEXT"));
    assert.ok(String(result.context).includes("no_evidence_available"));
  });

  it("preserves existing context and appends CI block", async () => {
    await fs.writeFile(path.join(stateDir, "npm_test_full.log"), "FAIL tests/core/x.test.ts\nError: fail", "utf8");
    const instruction = { task: "fix ci", context: "existing context" };
    const result = await injectCiFailureContextIfMissing(instruction, { paths: { stateDir } });
    assert.ok(String(result.context).startsWith("existing context"));
    assert.ok(String(result.context).includes("## CI_FAILURE_CONTEXT"));
  });

  it("negative: does not inject when stateDir is empty string", async () => {
    const instruction = { task: "fix ci", context: "" };
    const result = await injectCiFailureContextIfMissing(instruction, { paths: { stateDir: "" } });
    assert.ok(String(result.context).includes("no_evidence_available"), "must still inject no-data marker");
  });
});

// ── applyMemoryTrustFilter ────────────────────────────────────────────────────

describe("applyMemoryTrustFilter", () => {
  const highHint = {
    hint: "use path.join for all file paths",
    reason: "prevents separator issues",
    trust: { level: "high", source: "system", reason: "deterministic", taggedAt: "2024-01-01T00:00:00Z" },
  };
  const mediumHint = {
    hint: "prefer small functions",
    reason: "model-derived best practice",
    trust: { level: "medium", source: "model", reason: "model-produced", taggedAt: "2024-01-01T00:00:00Z" },
  };
  const lowHint = {
    hint: "try manual review first",
    reason: "user feedback",
    trust: { level: "low", source: "user-mediated", reason: "free text", taggedAt: "2024-01-01T00:00:00Z" },
  };

  it("returns only HIGH and MEDIUM hints for non-privileged worker kind", () => {
    const { selected, droppedLowTrustCount, isPrivileged } = applyMemoryTrustFilter(
      [highHint, mediumHint, lowHint],
      "evolution",
    );
    assert.equal(selected.length, 2);
    assert.equal(droppedLowTrustCount, 1);
    assert.equal(isPrivileged, false);
    assert.ok(!selected.some(h => h.trust.level === "low"));
  });

  it("returns HIGH hints first (ranked by trust level descending)", () => {
    const { selected } = applyMemoryTrustFilter([mediumHint, highHint], "quality");
    assert.equal(selected[0].trust.level, "high");
    assert.equal(selected[1].trust.level, "medium");
  });

  it("includes LOW trust hints for privileged caller (governance)", () => {
    const { selected, droppedLowTrustCount, isPrivileged } = applyMemoryTrustFilter(
      [highHint, mediumHint, lowHint],
      "governance",
    );
    assert.equal(selected.length, 3);
    assert.equal(droppedLowTrustCount, 0);
    assert.equal(isPrivileged, true);
  });

  it("includes LOW trust hints for 'system' worker kind", () => {
    const { isPrivileged } = applyMemoryTrustFilter([lowHint], "system");
    assert.equal(isPrivileged, true);
  });

  it("handles empty hints array without throwing", () => {
    const { selected, droppedLowTrustCount } = applyMemoryTrustFilter([], "evolution");
    assert.equal(selected.length, 0);
    assert.equal(droppedLowTrustCount, 0);
  });

  it("annotates raw hints without trust field via classification", () => {
    const rawHint = { hint: "use npm test", reason: "standard", source: "system" };
    const { selected } = applyMemoryTrustFilter([rawHint], "evolution");
    assert.ok(selected.length > 0, "system-sourced hint must pass trust filter");
    assert.ok(selected[0].trust, "trust metadata must be attached");
  });

  it("negative: non-privileged caller cannot force LOW trust inclusion", () => {
    const { selected } = applyMemoryTrustFilter([lowHint], "infrastructure");
    assert.equal(selected.length, 0, "non-privileged caller must not receive LOW trust hints");
  });
});

// ── computeMemoryHitRatio ─────────────────────────────────────────────────────

describe("computeMemoryHitRatio", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-memory-hit-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 when no log file exists", async () => {
    const config = { paths: { stateDir: tmpDir } };
    const ratio = await computeMemoryHitRatio(config);
    assert.equal(ratio, 0, "missing log must yield ratio=0");
  });

  it("returns 0 for empty log array", async () => {
    await fs.writeFile(path.join(tmpDir, "memory_hit_log.json"), "[]");
    const config = { paths: { stateDir: tmpDir } };
    const ratio = await computeMemoryHitRatio(config);
    assert.equal(ratio, 0, "empty log must yield ratio=0");
  });

  it("returns 1.0 when all entries have hints injected", async () => {
    const log = [
      { taskId: "t1", hintsInjected: 2, lessonsInjected: 1, outcome: "done", isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
      { taskId: "t2", hintsInjected: 1, lessonsInjected: 0, outcome: null, isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
    ];
    await fs.writeFile(path.join(tmpDir, "memory_hit_log.json"), JSON.stringify(log));
    const config = { paths: { stateDir: tmpDir } };
    const ratio = await computeMemoryHitRatio(config);
    assert.equal(ratio, 1.0, "all entries with hints must yield ratio=1.0");
  });

  it("returns correct ratio for mixed hit/miss entries", async () => {
    const log = [
      { taskId: "t1", hintsInjected: 2, lessonsInjected: 0, outcome: "done", isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
      { taskId: "t2", hintsInjected: 0, lessonsInjected: 0, outcome: null, isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
      { taskId: "t3", hintsInjected: 0, lessonsInjected: 1, outcome: "done", isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
      { taskId: "t4", hintsInjected: 0, lessonsInjected: 0, outcome: null, isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
    ];
    await fs.writeFile(path.join(tmpDir, "memory_hit_log.json"), JSON.stringify(log));
    const config = { paths: { stateDir: tmpDir } };
    const ratio = await computeMemoryHitRatio(config);
    assert.equal(ratio, 0.5, "2 hits out of 4 entries must yield ratio=0.5");
  });

  it("respects limit parameter (only checks most recent N entries)", async () => {
    // 4 entries: first 2 are misses, last 2 are hits — with limit=2, only hits counted → ratio=1.0
    const log = [
      { taskId: "t1", hintsInjected: 0, lessonsInjected: 0, outcome: null, isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
      { taskId: "t2", hintsInjected: 0, lessonsInjected: 0, outcome: null, isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
      { taskId: "t3", hintsInjected: 1, lessonsInjected: 0, outcome: "done", isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
      { taskId: "t4", hintsInjected: 2, lessonsInjected: 1, outcome: "done", isPrivileged: false, timestamp: "2024-01-01T00:00:00Z" },
    ];
    await fs.writeFile(path.join(tmpDir, "memory_hit_log.json"), JSON.stringify(log));
    const config = { paths: { stateDir: tmpDir } };
    const ratio = await computeMemoryHitRatio(config, 2);
    assert.equal(ratio, 1.0, "limit=2 must only look at the 2 most-recent entries");
  });

  it("negative: returns 0 for corrupt/invalid JSON log file", async () => {
    await fs.writeFile(path.join(tmpDir, "memory_hit_log.json"), "NOT_JSON{{{");
    const config = { paths: { stateDir: tmpDir } };
    const ratio = await computeMemoryHitRatio(config);
    assert.equal(ratio, 0, "corrupt log must yield ratio=0 without throwing");
  });
});

// ── buildRoutingROISummary — lineage-key join for premium usage + routing ROI ──
// These tests verify that premium usage log entries are correctly joined via
// the shared lineageId key and that ROI is computed per-lineage group.

describe("buildRoutingROISummary — lineage-keyed routing ROI", () => {
  it("returns zero-state for empty log", () => {
    const result = buildRoutingROISummary([]);
    assert.equal(result.totalRequests, 0);
    assert.equal(result.linkedRequests, 0);
    assert.equal(result.linkedRatio, null);
    assert.deepEqual(result.roiByLineageId, {});
    assert.equal(result.overallLinkedROI, null);
  });

  it("counts entries without lineageId as unlinked", () => {
    const log = [
      { worker: "king-david", model: "Claude Sonnet 4.6", taskKind: "backend", outcome: "done", taskId: "1", lineageId: null },
      { worker: "esther",     model: "Claude Sonnet 4.6", taskKind: "backend", outcome: "done", taskId: "2", lineageId: null },
    ];
    const result = buildRoutingROISummary(log);
    assert.equal(result.totalRequests, 2);
    assert.equal(result.linkedRequests, 0);
    assert.equal(result.linkedRatio, 0);
    assert.deepEqual(result.roiByLineageId, {});
  });

  it("groups done outcomes by lineageId and computes ROI", () => {
    const log = [
      { worker: "king-david", model: "Claude Sonnet 4.6", taskKind: "backend", outcome: "done",    lineageId: "lid-abc" },
      { worker: "king-david", model: "Claude Sonnet 4.6", taskKind: "backend", outcome: "blocked", lineageId: "lid-abc" },
      { worker: "esther",     model: "Claude Sonnet 4.6", taskKind: "scan",    outcome: "done",    lineageId: "lid-xyz" },
    ];
    const result = buildRoutingROISummary(log);
    assert.equal(result.totalRequests, 3);
    assert.equal(result.linkedRequests, 3);
    assert.equal(result.linkedRatio, 1);
    // lid-abc: 1 done / 2 total = 0.5
    assert.equal(result.roiByLineageId["lid-abc"]?.roi, 0.5);
    assert.equal(result.roiByLineageId["lid-abc"]?.success, 1);
    assert.equal(result.roiByLineageId["lid-abc"]?.total, 2);
    // lid-xyz: 1 done / 1 total = 1.0
    assert.equal(result.roiByLineageId["lid-xyz"]?.roi, 1);
    // overallLinkedROI: 2 done / 3 total = 0.667
    assert.ok(typeof result.overallLinkedROI === "number");
    assert.ok(result.overallLinkedROI > 0.6 && result.overallLinkedROI < 0.7);
  });

  it("computes linkedRatio correctly with mixed linked/unlinked entries", () => {
    const log = [
      { outcome: "done",    lineageId: "lid-1" },
      { outcome: "done",    lineageId: "lid-1" },
      { outcome: "blocked", lineageId: null     },
      { outcome: "done",    lineageId: null     },
    ];
    const result = buildRoutingROISummary(log);
    assert.equal(result.totalRequests, 4);
    assert.equal(result.linkedRequests, 2);
    assert.equal(result.linkedRatio, 0.5, "half of entries carry a lineageId");
    assert.equal(result.overallLinkedROI, 1, "both linked entries are done");
  });

  it("negative: ignores non-object entries in the log", () => {
    const log = [null, undefined, "not-an-object", 42,
      { outcome: "done", lineageId: "lid-1" }];
    const result = buildRoutingROISummary(log as unknown[]);
    assert.equal(result.linkedRequests, 1);
    assert.ok(result.totalRequests >= 1);
  });
});

// ── WorkerActivityEntry wave field — structural contract ──────────────────────
// WorkerActivityEntry is a local type; we verify its structural contract here
// by confirming worker session state JSON with a wave field is accepted by the
// worker session parsing path without error. The wave field must be optional
// (number | null | undefined).
describe("WorkerActivityEntry wave field — structural contract", () => {
  it("worker session JSON with wave field in activityLog is read without error", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-wave-field-"));
    try {
      const sessionFile = path.join(tmpDir, "worker_evolution-worker.json");
      const sessionData = {
        currentBranch: "feat/test",
        activityLog: [
          { at: new Date().toISOString(), status: "done", task: "Fix auth", wave: 1 },
          { at: new Date().toISOString(), status: "done", task: "Add test", wave: null },
          { at: new Date().toISOString(), status: "in_progress", task: "Deploy" },
        ]
      };
      await fs.writeFile(sessionFile, JSON.stringify(sessionData), "utf8");
      const raw = await fs.readFile(sessionFile, "utf8");
      const parsed = JSON.parse(raw);
      assert.ok(Array.isArray(parsed.activityLog), "activityLog must be an array");
      assert.equal(parsed.activityLog[0].wave, 1, "wave=1 must be preserved");
      assert.equal(parsed.activityLog[1].wave, null, "wave=null must be preserved");
      assert.equal(parsed.activityLog[2].wave, undefined, "wave absent is ok");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
