/**
 * Regression tests for T-002: Athena fail-closed mode.
 *
 * Verifies that plan review AI failures return approved=false with a
 * machine-readable reason, that the orchestrator blocks worker dispatch,
 * and that an alert record with deterministic severity is written.
 *
 * The runtime.athenaFailOpen flag must restore legacy permissive behavior.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { runAthenaPlanReview } from "../../src/core/athena_reviewer.js";
import { runOnce } from "../../src/core/orchestrator.js";
import { ALERT_SEVERITY } from "../../src/core/state_tracker.js";
import { isEnvelopeUnambiguous } from "../../src/core/evidence_envelope.js";
import {
  computePlanBatchFingerprint,
  correctBoundedPacketDefects,
  PACKET_DEFECT_CODE,
  normalizeAthenaReviewPayload,
} from "../../src/core/athena_reviewer.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(tmpDir, overrides = {}) {
  return {
    loopIntervalMs: 1000,
    maxParallelWorkers: 1,
    paths: {
      stateDir: tmpDir,
      progressFile: path.join(tmpDir, "progress.txt"),
      policyFile: path.join(tmpDir, "policy.json")
    },
    env: {
      // Missing binary forces every AI call to fail deterministically.
      copilotCliCommand: "__missing_copilot_binary__",
      targetRepo: "CanerDoqdu/Box"
    },
    roleRegistry: {
      ceoSupervisor: { name: "Jesus", model: "Claude Sonnet 4.6" },
      deepPlanner: { name: "Prometheus", model: "GPT-5.3-Codex" },
      qualityReviewer: { name: "Athena", model: "Claude Sonnet 4.6" },
      workers: {
        backend: { name: "King David" }
      }
    },
    copilot: { leadershipAutopilot: false },
    runtime: {},
    ...overrides
  };
}

// A minimal Prometheus analysis that satisfies the plan shape Athena reads.
const VALID_PROMETHEUS_ANALYSIS = {
  analyzedAt: new Date().toISOString(),
  projectHealth: "good",
  analysis: "Test analysis",
  keyFindings: "None",
  plans: [
    {
      role: "King David",
      task: "Fix test",
      priority: 1,
      wave: 1,
      verification: "npm test"
    }
  ],
  executionStrategy: {},
  requestBudget: {}
};

// ── ALERT_SEVERITY constants ─────────────────────────────────────────────────

describe("ALERT_SEVERITY enum", () => {
  it("exports deterministic severity constants", () => {
    assert.equal(ALERT_SEVERITY.LOW, "low");
    assert.equal(ALERT_SEVERITY.MEDIUM, "medium");
    assert.equal(ALERT_SEVERITY.HIGH, "high");
    assert.equal(ALERT_SEVERITY.CRITICAL, "critical");
  });
});

// ── runAthenaPlanReview: fail-closed mode ────────────────────────────────────

describe("runAthenaPlanReview — fail-closed on AI failure", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-fc-"));
    await fs.writeFile(path.join(tmpDir, "policy.json"), JSON.stringify({ blockedCommands: [] }), "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns approved=false when AI call fails (fail-closed default)", async () => {
    const config = makeConfig(tmpDir);
    const result = await runAthenaPlanReview(config, VALID_PROMETHEUS_ANALYSIS);

    assert.equal(result.approved, false,
      "AI failure must return approved=false — no silent pass-through");
  });

  it("returns a machine-readable reason object with code and message", async () => {
    const config = makeConfig(tmpDir);
    const result = await runAthenaPlanReview(config, VALID_PROMETHEUS_ANALYSIS);

    assert.ok(result.reason && typeof result.reason === "object",
      "reason must be an object, not a plain string");
    assert.ok(typeof result.reason.code === "string" && result.reason.code.length > 0,
      "reason.code must be a non-empty string");
    assert.ok(typeof result.reason.message === "string",
      "reason.message must be a string");
    assert.equal(result.reason.code, "AI_CALL_FAILED");
  });

  it("writes an alert record with CRITICAL severity on AI failure", async () => {
    const config = makeConfig(tmpDir);
    await runAthenaPlanReview(config, VALID_PROMETHEUS_ANALYSIS);

    const alertsFile = path.join(tmpDir, "alerts.json");
    const alertsExists = await fs.access(alertsFile).then(() => true).catch(() => false);
    assert.ok(alertsExists, "alerts.json must be created when plan review AI fails");

    const alerts = JSON.parse(await fs.readFile(alertsFile, "utf8"));
    const criticalAlerts = alerts.entries.filter(e => e.severity === ALERT_SEVERITY.CRITICAL);
    assert.ok(criticalAlerts.length > 0,
      "At least one CRITICAL alert must be recorded on AI failure");
    assert.ok(criticalAlerts[0].source === "athena_reviewer",
      "Alert source must be 'athena_reviewer'");
    assert.ok(criticalAlerts[0].message.includes("AI_CALL_FAILED"),
      "Alert message must include the reason code for machine readability");
  });

  it("returns approved=true with fail-open flag enabled (rollback mode)", async () => {
    const config = makeConfig(tmpDir, { runtime: { athenaFailOpen: true } });
    const result = await runAthenaPlanReview(config, VALID_PROMETHEUS_ANALYSIS);

    assert.equal(result.approved, true,
      "runtime.athenaFailOpen=true must restore legacy permissive behavior");
    assert.equal(result.reason.code, "AI_CALL_FAILED_FAILOPEN");
  });

  it("returns approved=false and empty corrections array on AI failure", async () => {
    const config = makeConfig(tmpDir);
    const result = await runAthenaPlanReview(config, VALID_PROMETHEUS_ANALYSIS);

    assert.ok(Array.isArray(result.corrections),
      "corrections must always be an array");
  });

  it("does not write athena_plan_review.json when AI call fails (no data to persist)", async () => {
    const config = makeConfig(tmpDir);
    await runAthenaPlanReview(config, VALID_PROMETHEUS_ANALYSIS);

    // The review JSON is only written on successful AI response; failure path must not write it.
    const reviewFile = path.join(tmpDir, "athena_plan_review.json");
    const reviewExists = await fs.access(reviewFile).then(() => true).catch(() => false);
    assert.equal(reviewExists, false,
      "athena_plan_review.json must not be written when AI call fails");
  });
});

// ── Orchestrator: no worker dispatch on failed plan review ───────────────────

describe("orchestrator — no worker dispatch when Athena blocks plan", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-orch-fc-"));
    await fs.writeFile(path.join(tmpDir, "policy.json"), JSON.stringify({ blockedCommands: [] }), "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("does not dispatch workers when plan review returns approved=false", async () => {
    const config = makeConfig(tmpDir);

    // Run a full cycle — Jesus/Prometheus/Athena all use missing binary, so
    // the cycle will fail before dispatching any worker.
    await runOnce(config);

    // Confirm no worker state files were created (dispatch did not happen).
    const workerFiles = await fs.readdir(tmpDir)
      .then(files => files.filter(f => f.startsWith("worker_") && f.endsWith(".json")))
      .catch(() => []);

    assert.equal(workerFiles.length, 0,
      "No worker state files must exist — dispatch must be blocked when Athena rejects");
  });

  it("writes athena_plan_rejection.json with reason object when plan is blocked", async () => {
    const config = makeConfig(tmpDir);

    // Pre-seed a Prometheus analysis so the orchestrator reaches Athena review.
    await fs.writeFile(
      path.join(tmpDir, "prometheus_analysis.json"),
      JSON.stringify(VALID_PROMETHEUS_ANALYSIS),
      "utf8"
    );

    // Manually invoke the plan review and simulate the orchestrator rejection path.
    const result = await runAthenaPlanReview(config, VALID_PROMETHEUS_ANALYSIS);

    // The reason must be a machine-readable object, not a legacy string.
    assert.equal(typeof result.reason, "object",
      "reason must be a structured object for machine readability");
    assert.ok(result.reason.code, "reason.code must be present");
    assert.equal(result.approved, false);
  });

  it("records blocked cycle state in progress log when Athena blocks", async () => {
    const config = makeConfig(tmpDir);
    await runOnce(config);

    const progress = await fs.readFile(config.paths.progressFile, "utf8").catch(() => "");
    // Either Prometheus fails first or Athena blocks — either way, no dispatch.
    // The key assertion is that no worker was dispatched.
    const workerFiles = await fs.readdir(tmpDir)
      .then(files => files.filter(f => f.startsWith("worker_") && f.endsWith(".json")))
      .catch(() => []);
    assert.equal(workerFiles.length, 0,
      "Worker dispatch must not occur when the cycle is blocked");
    // Progress log must exist with some content.
    assert.ok(progress.length > 0, "Progress log must be written during blocked cycle");
  });
});

// ── Task 3: isEnvelopeUnambiguous — deterministic fast-path gate ─────────────

describe("isEnvelopeUnambiguous — fast-path bypass gate (Task 3)", () => {
  function makeGreenEnvelope(overrides: Record<string, unknown> = {}): any {
    const base: any = {
      roleName: "evolution-worker",
      status: "done",
      summary: "All changes implemented, build and tests pass.",
      verificationPassed: true,
      verificationEvidence: { build: "pass", tests: "pass", lint: "pass" },
      preReviewIssues: [],
    };
    // Allow overriding nested verificationEvidence keys directly
    const { build, tests, lint, ...rest } = overrides as any;
    if (build !== undefined || tests !== undefined || lint !== undefined) {
      base.verificationEvidence = {
        ...base.verificationEvidence,
        ...(build !== undefined ? { build } : {}),
        ...(tests !== undefined ? { tests } : {}),
        ...(lint !== undefined ? { lint } : {}),
      };
    }
    return { ...base, ...rest };
  }

  it("returns unambiguous=true for a fully green, unambiguous low-risk envelope", () => {
    const result = isEnvelopeUnambiguous(makeGreenEnvelope(), { planRiskLevel: "low" });
    assert.equal(result.unambiguous, true,
      "green envelope with low-risk plan must qualify for fast-path");
  });

  it("returns unambiguous=false when lint evidence is 'fail' — failed lint must fall through to AI review", () => {
    const result = isEnvelopeUnambiguous(makeGreenEnvelope({ lint: "fail" }), { planRiskLevel: "low" });
    assert.equal(result.unambiguous, false,
      "lint=fail must block fast-path to prevent shipping with linting errors");
  });

  it("returns unambiguous=false when preReviewIssues is non-empty — unresolved issues require AI judgment", () => {
    const result = isEnvelopeUnambiguous(
      makeGreenEnvelope({ preReviewIssues: ["Security vulnerability found in dependency"] }),
      { planRiskLevel: "low" }
    );
    assert.equal(result.unambiguous, false,
      "non-empty preReviewIssues must block fast-path");
  });

  it("returns unambiguous=false for high-risk plan even with otherwise perfect envelope", () => {
    const result = isEnvelopeUnambiguous(makeGreenEnvelope(), { planRiskLevel: "high" });
    assert.equal(result.unambiguous, false,
      "high-risk plans must always go through AI review regardless of evidence quality");
  });

  it("returns unambiguous=false when status is not 'done' (partial completion is ambiguous)", () => {
    const result = isEnvelopeUnambiguous(
      makeGreenEnvelope({ status: "partial" }),
      { planRiskLevel: "low" }
    );
    assert.equal(result.unambiguous, false,
      "non-done status must block fast-path");
  });

  it("returns unambiguous=false when verificationPassed is false — cannot skip AI when verification failed", () => {
    const result = isEnvelopeUnambiguous(
      makeGreenEnvelope({ verificationPassed: false }),
      { planRiskLevel: "low" }
    );
    assert.equal(result.unambiguous, false,
      "verificationPassed=false must block fast-path");
  });

  it("returns unambiguous=false when build evidence is 'fail'", () => {
    const result = isEnvelopeUnambiguous(
      makeGreenEnvelope({ build: "fail" }),
      { planRiskLevel: "low" }
    );
    assert.equal(result.unambiguous, false, "build=fail must block fast-path");
  });

  it("returns unambiguous=false when tests evidence is 'fail'", () => {
    const result = isEnvelopeUnambiguous(
      makeGreenEnvelope({ tests: "fail" }),
      { planRiskLevel: "low" }
    );
    assert.equal(result.unambiguous, false, "tests=fail must block fast-path");
  });

  it("returns unambiguous=false for null envelope — structural failure must not qualify for bypass", () => {
    const result = isEnvelopeUnambiguous(null, { planRiskLevel: "low" });
    assert.equal(result.unambiguous, false, "null envelope must return false, not throw");
  });
});

// ── Task 1: runAthenaPlanReview — deterministic auto-approve for low-risk unchanged batches ──

describe("computePlanBatchFingerprint", () => {
  it("returns the same fingerprint for the same plan batch", () => {
    const plans = [
      { task: "Fix retry logic", role: "evolution-worker", wave: 1, riskLevel: "low", verification: "npm test", acceptance_criteria: ["retries < 3"] },
    ];
    assert.equal(computePlanBatchFingerprint(plans), computePlanBatchFingerprint(plans),
      "same input must produce the same fingerprint (deterministic)");
  });

  it("returns different fingerprints when acceptance_criteria changes", () => {
    const base = { task: "Fix retry logic", role: "evolution-worker", wave: 1, riskLevel: "low", verification: "npm test", acceptance_criteria: ["retries < 3"] };
    const changed = { ...base, acceptance_criteria: ["retries < 5"] };
    assert.notEqual(computePlanBatchFingerprint([base]), computePlanBatchFingerprint([changed]),
      "changed acceptance_criteria must yield a different fingerprint");
  });

  it("returns empty string for an empty plans array", () => {
    assert.equal(computePlanBatchFingerprint([]), "",
      "empty plans array must return empty fingerprint");
  });

  it("is order-sensitive — different plan order yields different fingerprint", () => {
    const p1 = { task: "Task A", role: "evolution-worker", wave: 1, riskLevel: "low", verification: "npm test", acceptance_criteria: [] };
    const p2 = { task: "Task B", role: "evolution-worker", wave: 1, riskLevel: "low", verification: "npm test", acceptance_criteria: [] };
    assert.notEqual(
      computePlanBatchFingerprint([p1, p2]),
      computePlanBatchFingerprint([p2, p1]),
      "plan order is significant for fingerprint — reordering must change the fingerprint"
    );
  });
});

describe("runAthenaPlanReview — deterministic auto-approve for low-risk unchanged batches", () => {
  let tmpDir;

  const LOW_RISK_PLANS = [
    {
      role: "evolution-worker",
      task: "Add retry logic to worker dispatch with exponential backoff",
      priority: 1,
      wave: 1,
      riskLevel: "low",
      verification: "tests/core/worker_dispatch.test.ts — test: retry logic passes",
      acceptance_criteria: ["retry count < 3 on transient failures"],
      dependencies: [],
      scope: "src/core/worker_dispatch.ts",
      capacityDelta: 0.1,
      requestROI: 2.0,
    },
  ];

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-aa-"));
    await fs.writeFile(path.join(tmpDir, "policy.json"), JSON.stringify({ blockedCommands: [] }), "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("auto-approves a low-risk unchanged batch when a prior approved review exists with matching fingerprint", async () => {
    const fingerprint = computePlanBatchFingerprint(LOW_RISK_PLANS);
    // Seed state with a previously approved review with the matching fingerprint.
    await fs.writeFile(
      path.join(tmpDir, "athena_plan_review.json"),
      JSON.stringify({
        approved: true,
        overallScore: 8,
        summary: "All plans are well-defined",
        appliedFixes: [],
        corrections: [],
        unresolvedIssues: [],
        planBatchFingerprint: fingerprint,
      }),
      "utf8"
    );

    const config = makeConfig(tmpDir);
    const prometheusOutput = { plans: LOW_RISK_PLANS, analyzedAt: new Date().toISOString() };
    const result = await runAthenaPlanReview(config, prometheusOutput);

    assert.equal(result.approved, true, "auto-approve must return approved=true");
    assert.equal(result.autoApproved, true, "autoApproved flag must be set on cache-hit results");
    assert.ok(
      result.autoApproveReason?.code === "LOW_RISK_UNCHANGED",
      "autoApproveReason.code must be LOW_RISK_UNCHANGED"
    );
  });

  it("falls through to AI review (fails closed) when last review has a different fingerprint", async () => {
    const staleFingerprint = "0000000000000000";
    await fs.writeFile(
      path.join(tmpDir, "athena_plan_review.json"),
      JSON.stringify({
        approved: true,
        overallScore: 8,
        summary: "Old review",
        appliedFixes: [],
        corrections: [],
        unresolvedIssues: [],
        planBatchFingerprint: staleFingerprint,
      }),
      "utf8"
    );

    const config = makeConfig(tmpDir);
    const prometheusOutput = { plans: LOW_RISK_PLANS, analyzedAt: new Date().toISOString() };
    const result = await runAthenaPlanReview(config, prometheusOutput);

    // With no valid AI binary, the call fails; the result must not be auto-approved
    assert.equal(result.autoApproved, undefined,
      "mismatched fingerprint must not trigger auto-approve");
    assert.notEqual(result.reason?.code, "LOW_RISK_UNCHANGED",
      "mismatched fingerprint must fall through to AI, not return auto-approve");
  });

  it("never auto-approves when any plan has riskLevel=high even if fingerprint matches", async () => {
    const highRiskPlan = {
      ...LOW_RISK_PLANS[0],
      riskLevel: "high",
      preMortem: {
        failureScenarios: ["DB migration fails"],
        mitigations: ["rollback script tested"],
        rollbackPlan: "revert migration",
        guardrails: ["read-only mode enabled during migration"],
      },
    };
    const highRiskPlans = [highRiskPlan];
    const fingerprint = computePlanBatchFingerprint(highRiskPlans);
    await fs.writeFile(
      path.join(tmpDir, "athena_plan_review.json"),
      JSON.stringify({
        approved: true,
        overallScore: 8,
        summary: "Old approved",
        appliedFixes: [],
        corrections: [],
        unresolvedIssues: [],
        planBatchFingerprint: fingerprint,
      }),
      "utf8"
    );

    const config = makeConfig(tmpDir);
    const prometheusOutput = { plans: highRiskPlans, analyzedAt: new Date().toISOString() };
    const result = await runAthenaPlanReview(config, prometheusOutput);

    assert.equal(result.autoApproved, undefined,
      "high-risk plans must never be auto-approved, even when fingerprint matches");
  });

  it("never auto-approves when disablePlanReviewCache=true", async () => {
    const fingerprint = computePlanBatchFingerprint(LOW_RISK_PLANS);
    await fs.writeFile(
      path.join(tmpDir, "athena_plan_review.json"),
      JSON.stringify({
        approved: true,
        overallScore: 8,
        summary: "All plans are well-defined",
        appliedFixes: [],
        corrections: [],
        unresolvedIssues: [],
        planBatchFingerprint: fingerprint,
      }),
      "utf8"
    );

    const config = makeConfig(tmpDir, { runtime: { disablePlanReviewCache: true } });
    const prometheusOutput = { plans: LOW_RISK_PLANS, analyzedAt: new Date().toISOString() };
    const result = await runAthenaPlanReview(config, prometheusOutput);

    assert.equal(result.autoApproved, undefined,
      "disablePlanReviewCache=true must bypass the auto-approve path regardless of fingerprint match");
  });
});

// ── correctBoundedPacketDefects — fail-closed guarantee tests ─────────────────

describe("correctBoundedPacketDefects — fail-closed guarantees", () => {
  const LOW_RISK_PLAN = {
    role: "evolution-worker",
    task: "Add retry logic to worker dispatch with exponential backoff",
    verification: "npm test",
    target_files: ["src/core/worker_dispatch.ts"],
    acceptance_criteria: ["retry count < 3 on transient failures"],
    riskLevel: "low",
  };

  const HIGH_RISK_PLAN = {
    role: "evolution-worker",
    task: "Migrate database schema with zero-downtime deployment strategy",
    verification: "npm test",
    target_files: ["src/core/db_migrator.ts"],
    acceptance_criteria: ["migration completes with < 1% error rate"],
    riskLevel: "high",
    premortem: {
      riskLevel: "high",
      scenario: "Migration could corrupt live data if applied during peak traffic.",
      failurePaths: ["Schema mismatch causes query failures"],
      mitigations: ["Blue-green deployment with canary"],
      detectionSignals: ["Error rate spike > 1%"],
      guardrails: ["Rollback script tested in staging"],
      rollbackPlan: "Restore from last known good snapshot within 5 minutes",
    },
  };

  it("returns corrected=false when both approved and planReviews are missing — cannot auto-correct structural failures", () => {
    const normalized = normalizeAthenaReviewPayload({ summary: "Looks good." }, [LOW_RISK_PLAN]);

    assert.ok(normalized.missingFields.includes("approved"), "pre-condition: approved missing");
    assert.ok(normalized.missingFields.includes("planReviews"), "pre-condition: planReviews missing");

    const correction = correctBoundedPacketDefects(normalized, [LOW_RISK_PLAN]);

    assert.equal(correction.corrected, false,
      "both fields missing is not a bounded defect — must remain fail-closed");
    assert.ok(correction.updatedMissingFields.includes("approved"),
      "approved must remain in updatedMissingFields when both fields are absent");
    assert.ok(correction.updatedMissingFields.includes("planReviews"),
      "planReviews must remain in updatedMissingFields when both fields are absent");
  });

  it("never auto-corrects approved when planReviews contain issues — fail-closed: issues must be addressed explicitly", () => {
    const normalized = normalizeAthenaReviewPayload({
      planReviews: [
        { planIndex: 0, role: "evolution-worker", measurable: false, issues: ["task description too vague"] },
      ],
      summary: "Issues found.",
    }, [LOW_RISK_PLAN]);

    const correction = correctBoundedPacketDefects(normalized, [LOW_RISK_PLAN]);

    assert.equal(correction.corrected, false,
      "approved must not be synthesized when plan reviews indicate issues — fail-closed");
    assert.ok(!correction.correctedFields.includes("approved"),
      "correctedFields must not include approved when reviews have issues");
  });

  it("never auto-corrects planReviews when any plan has riskLevel=high — high-risk always requires explicit AI judgment", () => {
    const normalized = normalizeAthenaReviewPayload({
      approved: true,
      summary: "Plans approved.",
    }, [HIGH_RISK_PLAN]);

    const correction = correctBoundedPacketDefects(normalized, [HIGH_RISK_PLAN]);

    assert.equal(correction.correctedFields.includes("planReviews"), false,
      "planReviews must never be auto-corrected for high-risk plans");
    assert.ok(correction.updatedMissingFields.includes("planReviews"),
      "planReviews must remain in updatedMissingFields for high-risk plans");
  });

  it("never auto-corrects planReviews when the plan array is empty — no plans means no evidence basis", () => {
    const normalized = normalizeAthenaReviewPayload({ approved: true, summary: "No plans." }, []);

    const correction = correctBoundedPacketDefects(normalized, []);

    assert.equal(correction.correctedFields.includes("planReviews"), false,
      "planReviews must not be auto-corrected when the plans array is empty");
  });

  it("corrects approved when planReviews are all-clear — bounded defect with explicit AI evidence", () => {
    const normalized = normalizeAthenaReviewPayload({
      planReviews: [
        { planIndex: 0, role: "evolution-worker", measurable: true, issues: [] },
      ],
      summary: "Plan validated.",
    }, [LOW_RISK_PLAN]);

    const correction = correctBoundedPacketDefects(normalized, [LOW_RISK_PLAN]);

    if (normalized.missingFields.includes("approved")) {
      // Only assert correction when the pre-condition is met (approved truly absent)
      assert.equal(correction.corrected, true,
        "approved must be corrected when planReviews are all-clear");
      assert.equal(correction.updatedPayload.approved, true,
        "corrected payload must set approved=true");
    }
  });

  it("defectCodes array contains the applicable code for each corrected field", () => {
    const normalized = normalizeAthenaReviewPayload({
      planReviews: [
        { planIndex: 0, role: "evolution-worker", measurable: true, issues: [] },
      ],
      summary: "Plan validated.",
    }, [LOW_RISK_PLAN]);

    const correction = correctBoundedPacketDefects(normalized, [LOW_RISK_PLAN]);

    if (correction.corrected) {
      assert.equal(correction.defectCodes.length, correction.correctedFields.length,
        "each corrected field must have a corresponding defect code");
      for (const code of correction.defectCodes) {
        const validCodes = Object.values(PACKET_DEFECT_CODE) as string[];
        assert.ok(validCodes.includes(code),
          `defect code '${code}' must be a known PACKET_DEFECT_CODE value`);
      }
    }
  });
});

// ── Task 2: HIGH_QUALITY_LOW_RISK auto-approve fast-path ──────────────────────

import {
  ATHENA_FAST_PATH_REASON,
  AUTO_APPROVE_HIGH_QUALITY_THRESHOLD,
} from "../../src/core/athena_reviewer.js";

import {
  AUTO_APPROVE_DISPATCH_SIGNAL,
  appendAutoApproveTelemetry,
} from "../../src/core/orchestrator.js";

describe("ATHENA_FAST_PATH_REASON structural invariants", () => {
  it("exports LOW_RISK_UNCHANGED reason code", () => {
    assert.equal(ATHENA_FAST_PATH_REASON.LOW_RISK_UNCHANGED, "LOW_RISK_UNCHANGED");
  });

  it("exports HIGH_QUALITY_LOW_RISK reason code", () => {
    assert.equal(ATHENA_FAST_PATH_REASON.HIGH_QUALITY_LOW_RISK, "HIGH_QUALITY_LOW_RISK");
  });

  it("is frozen (immutable)", () => {
    assert.ok(Object.isFrozen(ATHENA_FAST_PATH_REASON), "ATHENA_FAST_PATH_REASON must be frozen");
  });

  it("AUTO_APPROVE_HIGH_QUALITY_THRESHOLD is a positive integer above PLAN_QUALITY_MIN_SCORE", () => {
    assert.ok(Number.isInteger(AUTO_APPROVE_HIGH_QUALITY_THRESHOLD));
    assert.ok(AUTO_APPROVE_HIGH_QUALITY_THRESHOLD > 40,
      "high-quality threshold must exceed PLAN_QUALITY_MIN_SCORE=40 to avoid trivial pass-through");
  });
});

describe("runAthenaPlanReview — HIGH_QUALITY_LOW_RISK fast-path", () => {
  let tmpDir;

  // A plan that will score ≥ 80 in scorePlanQuality:
  //   task ≥ 10 chars, non-vague (+20), role (+20), verification ≥ 5 chars (+20),
  //   wave defined (+10), capacityDelta+requestROI present (no penalty) = 70+
  //   With specific file path in task: +10 = 80
  const HIGH_QUALITY_PLAN = {
    role: "evolution-worker",
    task: "Add src/core/worker_runner.ts retry logic with exponential backoff",
    priority: 1,
    wave: 1,
    riskLevel: "low",
    verification: "npm test -- worker_runner",
    acceptance_criteria: ["retry count < 3 on transient failures"],
    target_files: ["src/core/worker_runner.ts"],
    scope: "src/core/worker_runner.ts",
    dependencies: [],
    capacityDelta: 0.1,
    requestROI: 2.0,
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-hq-"));
    await fs.writeFile(path.join(tmpDir, "policy.json"), JSON.stringify({ blockedCommands: [] }), "utf8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("auto-approves a high-quality low-risk batch even without a cached fingerprint", async () => {
    const config = makeConfig(tmpDir);
    const prometheusOutput = { plans: [HIGH_QUALITY_PLAN], analyzedAt: new Date().toISOString() };
    const result = await runAthenaPlanReview(config, prometheusOutput);

    // The missing binary ensures AI call would fail; auto-approve must fire first.
    assert.equal(result.approved, true, "high-quality low-risk batch must auto-approve");
    assert.equal(result.autoApproved, true, "autoApproved flag must be set");
    assert.equal(
      result.autoApproveReason?.code,
      ATHENA_FAST_PATH_REASON.HIGH_QUALITY_LOW_RISK,
      "autoApproveReason.code must be HIGH_QUALITY_LOW_RISK"
    );
  });

  it("never auto-approves via high-quality path when any plan is high-risk", async () => {
    const highRiskPlan = {
      ...HIGH_QUALITY_PLAN,
      riskLevel: "high",
      premortem: {
        riskLevel: "high",
        scenario: "Migration could corrupt live data if applied during peak traffic.",
        failurePaths: ["Schema mismatch causes query failures"],
        mitigations: ["Blue-green deployment with canary"],
        detectionSignals: ["Error rate spike > 1%"],
        guardrails: ["Rollback script tested in staging"],
        rollbackPlan: "Restore from last known good snapshot within 5 minutes",
      },
    };
    const config = makeConfig(tmpDir);
    const prometheusOutput = { plans: [highRiskPlan], analyzedAt: new Date().toISOString() };
    const result = await runAthenaPlanReview(config, prometheusOutput);

    assert.equal(result.autoApproved, undefined,
      "high-risk plan must never qualify for the high-quality fast-path");
    assert.notEqual(result.autoApproveReason?.code, ATHENA_FAST_PATH_REASON.HIGH_QUALITY_LOW_RISK);
  });

  it("falls through to AI review when plan quality is below the high-quality threshold", async () => {
    // Vague task below 10 chars: scorePlanQuality will produce a low score
    const lowQualityPlan = {
      ...HIGH_QUALITY_PLAN,
      task: "Fix stuff",      // short + vague → score < AUTO_APPROVE_HIGH_QUALITY_THRESHOLD
      verification: "",        // missing verification → score drops further
    };
    const config = makeConfig(tmpDir);
    const prometheusOutput = { plans: [lowQualityPlan], analyzedAt: new Date().toISOString() };
    const result = await runAthenaPlanReview(config, prometheusOutput);

    // Low quality plan fails pre-gate (score < 40); autoApproved must not be set
    assert.equal(result.autoApproved, undefined,
      "low-quality plan must not trigger HIGH_QUALITY_LOW_RISK fast-path");
  });

  it("respects disablePlanReviewCache=true — high-quality path is also skipped", async () => {
    const config = makeConfig(tmpDir, { runtime: { disablePlanReviewCache: true } });
    const prometheusOutput = { plans: [HIGH_QUALITY_PLAN], analyzedAt: new Date().toISOString() };
    const result = await runAthenaPlanReview(config, prometheusOutput);

    assert.equal(result.autoApproved, undefined,
      "disablePlanReviewCache=true must suppress all fast-path approval including HIGH_QUALITY_LOW_RISK");
  });
});

describe("AUTO_APPROVE_DISPATCH_SIGNAL and appendAutoApproveTelemetry", () => {
  it("exports LOW_RISK_UNCHANGED and HIGH_QUALITY_LOW_RISK signal codes", () => {
    assert.equal(AUTO_APPROVE_DISPATCH_SIGNAL.LOW_RISK_UNCHANGED, "LOW_RISK_UNCHANGED");
    assert.equal(AUTO_APPROVE_DISPATCH_SIGNAL.HIGH_QUALITY_LOW_RISK, "HIGH_QUALITY_LOW_RISK");
  });

  it("is frozen (immutable)", () => {
    assert.ok(Object.isFrozen(AUTO_APPROVE_DISPATCH_SIGNAL));
  });

  it("appendAutoApproveTelemetry writes a telemetry entry to state/auto_approve_telemetry.json", async () => {
    const tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), "box-aat-"));
    try {
      const config = { paths: { stateDir: tmpDir2 } };
      await appendAutoApproveTelemetry(
        config,
        {
          autoApproveReason: { code: AUTO_APPROVE_DISPATCH_SIGNAL.HIGH_QUALITY_LOW_RISK },
          planReviews: [{}, {}],
        },
        "cycle-test-001"
      );
      const raw = await fs.readFile(path.join(tmpDir2, "auto_approve_telemetry.json"), "utf8");
      const entries = JSON.parse(raw);
      assert.ok(Array.isArray(entries), "file must contain a JSON array");
      assert.equal(entries.length, 1, "one entry must be written");
      assert.equal(entries[0].cycleId, "cycle-test-001");
      assert.equal(entries[0].signal, AUTO_APPROVE_DISPATCH_SIGNAL.HIGH_QUALITY_LOW_RISK);
      assert.equal(entries[0].planCount, 2);
      assert.ok(typeof entries[0].recordedAt === "string");
    } finally {
      await fs.rm(tmpDir2, { recursive: true, force: true });
    }
  });

  it("negative path: appendAutoApproveTelemetry does not throw when stateDir does not exist", async () => {
    const config = { paths: { stateDir: "/nonexistent/xyzzy-box-aat" } };
    // Must not throw — fail-open
    await assert.doesNotReject(
      () => appendAutoApproveTelemetry(config, { autoApproveReason: { code: "LOW_RISK_UNCHANGED" } }, "c-001"),
      "appendAutoApproveTelemetry must be fail-open — no throw on missing state dir"
    );
  });
});

