import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWorkerResponse } from "../../src/core/worker_runner.js";
import { checkPostMergeArtifact, ARTIFACT_GAP, POST_MERGE_PLACEHOLDER } from "../../src/core/verification_gate.js";

describe("worker_runner safety seam", () => {
  it("forces blocked status when worker reports done but access protocol says blocked", () => {
    const output = [
      "Implemented the changes.",
      "BOX_STATUS=done",
      "BOX_ACCESS=repo:ok;files:ok;tools:blocked;api:ok"
    ].join("\n");
    const parsed = parseWorkerResponse(output, "");
    assert.equal(parsed.status, "blocked");
  });

  it("keeps done status when all access channels are ok", () => {
    const output = [
      "BOX_STATUS=done",
      "BOX_ACCESS=repo:ok;files:ok;tools:ok;api:ok",
      "BOX_PR_URL=https://github.com/org/repo/pull/9"
    ].join("\n");
    const parsed = parseWorkerResponse(output, "");
    assert.equal(parsed.status, "done");
  });

  it("keeps explicit blocked status intact", () => {
    const output = [
      "BOX_STATUS=blocked",
      "BOX_ACCESS=repo:blocked;files:ok;tools:ok;api:ok"
    ].join("\n");
    const parsed = parseWorkerResponse(output, "");
    assert.equal(parsed.status, "blocked");
  });
});

// ── Artifact hard-block gate — enforced on all done-capable completion paths ──

describe("worker_runner artifact hard-block gate", () => {
  it("checkPostMergeArtifact: rejects done output missing both SHA and test result", () => {
    const artifact = checkPostMergeArtifact("All changes applied, everything looks good.");
    assert.equal(artifact.hasSha, false);
    assert.equal(artifact.hasTestOutput, false);
    assert.equal(artifact.hasArtifact, false);
  });

  it("checkPostMergeArtifact: rejects when SHA present but test output absent", () => {
    const artifact = checkPostMergeArtifact("Merged commit abc1234 into main — deployment complete.");
    assert.equal(artifact.hasSha, true);
    assert.equal(artifact.hasTestOutput, false);
    assert.equal(artifact.hasArtifact, false);
  });

  it("checkPostMergeArtifact: rejects when test output present but SHA absent", () => {
    const artifact = checkPostMergeArtifact("# tests 10 # pass 10 # fail 0 — looks good");
    assert.equal(artifact.hasSha, false);
    assert.equal(artifact.hasTestOutput, true);
    assert.equal(artifact.hasArtifact, false);
  });

  it("checkPostMergeArtifact: rejects when placeholder is unfilled even if SHA+output present", () => {
    const output = [
      "Merged abc1234 into main",
      "10 passing",
      `VERIFICATION_REPORT: BUILD=pass; TESTS=${POST_MERGE_PLACEHOLDER}`
    ].join("\n");
    const artifact = checkPostMergeArtifact(output);
    assert.equal(artifact.hasUnfilledPlaceholder, true);
    assert.equal(artifact.hasArtifact, false);
  });

  it("checkPostMergeArtifact: accepts valid evidence with SHA and test block", () => {
    const output = [
      "Merged abc1234 into main",
      "VERIFICATION_REPORT: BUILD=pass; TESTS=pass",
      "# tests 12 # pass 12 # fail 0"
    ].join("\n");
    const artifact = checkPostMergeArtifact(output);
    assert.equal(artifact.hasSha, true);
    assert.equal(artifact.hasTestOutput, true);
    assert.equal(artifact.hasUnfilledPlaceholder, false);
    assert.equal(artifact.hasArtifact, true);
  });

  it("ARTIFACT_GAP exports are non-empty deterministic strings (shared gap registry)", () => {
    assert.ok(typeof ARTIFACT_GAP.MISSING_SHA === "string" && ARTIFACT_GAP.MISSING_SHA.length > 0);
    assert.ok(typeof ARTIFACT_GAP.MISSING_TEST_OUTPUT === "string" && ARTIFACT_GAP.MISSING_TEST_OUTPUT.length > 0);
    assert.ok(typeof ARTIFACT_GAP.UNFILLED_PLACEHOLDER === "string" && ARTIFACT_GAP.UNFILLED_PLACEHOLDER.length > 0);
  });

  it("negative path: done output that is all prose produces three gap reasons", () => {
    const artifact = checkPostMergeArtifact("I completed the task and everything is good.");
    const gaps: string[] = [];
    if (artifact.hasUnfilledPlaceholder) gaps.push(ARTIFACT_GAP.UNFILLED_PLACEHOLDER);
    if (!artifact.hasSha) gaps.push(ARTIFACT_GAP.MISSING_SHA);
    if (!artifact.hasTestOutput) gaps.push(ARTIFACT_GAP.MISSING_TEST_OUTPUT);
    assert.equal(gaps.length, 2, "prose-only done must produce MISSING_SHA + MISSING_TEST_OUTPUT gaps");
  });
});
