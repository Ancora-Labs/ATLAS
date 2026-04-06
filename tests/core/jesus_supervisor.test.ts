/**
 * Tests for src/core/jesus_supervisor.ts — directive payload validation.
 *
 * Covers:
 *   - validateDirectivePayload: required field enforcement and fail-close semantics
 *   - validateExpectedOutcomeMeasurable: concrete measurable outcome verification
 *   - queue viability + completionRate gate: replan suppression respects execution-effectiveness
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  runSystemHealthAudit,
  validateDirectivePayload,
  validateExpectedOutcomeMeasurable,
} from "../../src/core/jesus_supervisor.js";
import {
  computeQueueViability,
  QUEUE_VIABILITY_MIN_COMPLETION_RATE,
} from "../../src/core/pipeline_progress.js";

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

  it("downgrades ci-failure-log-injection capability gap when source signatures exist", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(
        path.join(repoDir, "src", "core", "orchestrator.ts"),
        "export async function hydrateDispatchContextWithCiEvidence(){} const note='CI failure evidence';",
        "utf8",
      );

      // Both orchestrator AND worker-runner signatures are required since Task 5.
      writeFileSync(
        path.join(repoDir, "src", "core", "worker_runner.ts"),
        "export async function injectCiFailureContextIfMissing(plan: any, config: any) {}",
        "utf8",
      );

      writeFileSync(
        path.join(stateDir, "knowledge_memory.json"),
        JSON.stringify({
          lessons: [],
          capabilityGaps: [
            {
              gap: "Missing capability: workers lack CI failure evidence context",
              severity: "critical",
              capability: "ci-failure-log-injection",
              proposedFix: "Inject CI failure logs into worker context",
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

  it("keeps ci-failure-log-injection gap at original severity when worker_runner signature is missing", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      // Only orchestrator content — worker_runner.ts is absent.
      writeFileSync(
        path.join(repoDir, "src", "core", "orchestrator.ts"),
        "export async function hydrateDispatchContextWithCiEvidence(){} const note='CI failure evidence';",
        "utf8",
      );

      writeFileSync(
        path.join(stateDir, "knowledge_memory.json"),
        JSON.stringify({
          lessons: [],
          capabilityGaps: [
            {
              gap: "Missing capability: workers lack CI failure evidence context",
              severity: "critical",
              capability: "ci-failure-log-injection",
              proposedFix: "Inject CI failure logs into worker context",
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
      // Without worker_runner injectCiFailureContextIfMissing, the gap must NOT be downgraded.
      assert.notEqual(capGap.severity, "info",
        "gap should remain at original severity when worker_runner signature is absent"
      );
      assert.notEqual(capGap.note, "verified_present_in_source");
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

  it("does NOT downgrade gaps via heuristic text match — only explicit registry entries qualify", async () => {
    // A gap whose proposedFix text coincidentally appears in source but whose
    // capability key is NOT in the deterministic registry must NOT be downgraded.
    await withTempRepo(async ({ stateDir, repoDir }) => {
      // Inject source that contains the proposedFix text verbatim.
      writeFileSync(
        path.join(repoDir, "src", "core", "placeholder.ts"),
        "export const ok = true; // Inject CI failure logs into worker context",
        "utf8",
      );
      writeFileSync(
        path.join(stateDir, "knowledge_memory.json"),
        JSON.stringify({
          lessons: [],
          capabilityGaps: [
            {
              gap: "Missing heuristic-only capability",
              severity: "critical",
              capability: "heuristic-only-capability",
              proposedFix: "Inject CI failure logs into worker context",
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
      // Must stay at original severity — NOT downgraded to info
      assert.equal(capGap.severity, "critical", "heuristic-only match must NOT downgrade severity");
      assert.equal(capGap.note, undefined, "heuristic-only match must NOT add verification note");
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

// ── Jesus outcome ledger ───────────────────────────────────────────────────────
import {
  buildJesusDecisionOutcome,
  appendJesusOutcomeLedger,
} from "../../src/core/jesus_supervisor.js";

describe("buildJesusDecisionOutcome", () => {
  it("returns a well-formed outcome record", () => {
    const outcome = buildJesusDecisionOutcome({
      directiveHash: "abc123",
      plansGenerated: 5,
      plansExecuted: 3,
      budgetDelta: 12.5,
      ciOutcome: "success",
    });
    assert.equal(outcome.directiveHash, "abc123");
    assert.equal(outcome.plansGenerated, 5);
    assert.equal(outcome.plansExecuted, 3);
    assert.equal(outcome.budgetDelta, 12.5);
    assert.equal(outcome.ciOutcome, "success");
    assert.ok(typeof outcome.recordedAt === "string");
    assert.equal(outcome.schemaVersion, 1);
  });

  it("plansExecuted is not clamped by implementation (simple floor)", () => {
    const outcome = buildJesusDecisionOutcome({
      directiveHash: "x",
      plansGenerated: 3,
      plansExecuted: 5,
    });
    // Implementation uses Math.max(0, floor) but does not clamp to plansGenerated
    assert.equal(outcome.plansExecuted, 5);
  });

  it("defaults budgetDelta to null and ciOutcome to null when omitted", () => {
    const outcome = buildJesusDecisionOutcome({
      directiveHash: "y",
      plansGenerated: 2,
      plansExecuted: 1,
    });
    assert.equal(outcome.budgetDelta, null);
    assert.equal(outcome.ciOutcome, null);
  });
});

describe("appendJesusOutcomeLedger", () => {
  it("creates the ledger file and appends a valid JSON line", async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), "jesus-ledger-"));
    try {
      const outcome = buildJesusDecisionOutcome({
        directiveHash: "hash1",
        plansGenerated: 2,
        plansExecuted: 2,
        budgetDelta: 5,
        ciOutcome: "success",
      });
      await appendJesusOutcomeLedger(tmpDir, outcome);
      const { readFileSync } = await import("node:fs");
      const content = readFileSync(path.join(tmpDir, "jesus_outcome_ledger.jsonl"), "utf8");
      const parsed = JSON.parse(content.trim());
      assert.equal(parsed.directiveHash, "hash1");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("fail-open: does NOT throw when the state dir is invalid (write failure is non-fatal)", async () => {
    // Point at a path that cannot be written to (state dir is a file, not a directory).
    const tmpBase = mkdtempSync(path.join(tmpdir(), "jesus-ledger-ioerr-"));
    const blockerFile = path.join(tmpBase, "state-as-file");
    writeFileSync(blockerFile, "not-a-dir");
    const outcome = buildJesusDecisionOutcome({
      directiveHash: "hashErr",
      plansGenerated: 1,
      plansExecuted: 0,
    });
    // Must not throw — fail-open contract
    await assert.doesNotReject(
      () => appendJesusOutcomeLedger(path.join(blockerFile, "subdir"), outcome),
      "appendJesusOutcomeLedger must not throw on write failure (fail-open)",
    );
    rmSync(tmpBase, { recursive: true, force: true });
  });
});

// ── Queue viability + completionRate gate ──────────────────────────────────────
// Tests that verify Jesus only suppresses replans when queued work is both
// pending (existing checks) AND execution-effective (new completionRate gate).

describe("jesus replan-suppression via computeQueueViability — completionRate gate", () => {
  async function makeTmpDir() {
    return fs.mkdtemp(path.join(tmpdir(), "jesus-qv-"));
  }

  function cfg(dir: string) {
    return { paths: { stateDir: dir } };
  }

  async function seed(dir: string, files: Record<string, unknown>) {
    for (const [name, data] of Object.entries(files)) {
      await fs.writeFile(path.join(dir, name), JSON.stringify(data), "utf8");
    }
  }

  it("viable=true when pending plans exist AND completionRate is above threshold (replan suppressed)", async () => {
    const dir = await makeTmpDir();
    try {
      await seed(dir, {
        "prometheus_analysis.json": { plans: [{ id: "t1" }, { id: "t2" }] },
        "athena_plan_review.json": { approved: true },
        "cycle_analytics.json": { funnel: { dispatched: 4, completed: 3, completionRate: 0.75 } },
      });
      const result = await computeQueueViability(cfg(dir));
      assert.equal(result.viable, true, "replan should be suppressed: pending work + high completion rate");
      assert.equal(result.completionRate, 0.75);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("viable=false when pending plans exist BUT completionRate is below threshold (replan NOT suppressed)", async () => {
    const dir = await makeTmpDir();
    try {
      await seed(dir, {
        "prometheus_analysis.json": { plans: [{ id: "t1" }, { id: "t2" }] },
        "athena_plan_review.json": { approved: true },
        "cycle_analytics.json": { funnel: { dispatched: 5, completed: 0, completionRate: 0.0 } },
      });
      const result = await computeQueueViability(cfg(dir));
      assert.equal(result.viable, false, "replan must NOT be suppressed: pending work but zero completion rate");
      assert.equal(result.reason, "low-completion-rate");
      assert.ok(typeof result.completionRate === "number");
      assert.ok(result.completionRate! < QUEUE_VIABILITY_MIN_COMPLETION_RATE);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("viable=true when pending plans exist AND no cycle_analytics (absence does not penalise)", async () => {
    const dir = await makeTmpDir();
    try {
      await seed(dir, {
        "prometheus_analysis.json": { plans: [{ id: "t1" }] },
        "athena_plan_review.json": { approved: true },
        // No cycle_analytics.json
      });
      const result = await computeQueueViability(cfg(dir));
      assert.equal(result.viable, true, "missing analytics must not block replan suppression");
      assert.equal(result.completionRate, null);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("viable=false (reason=low-completion-rate) takes precedence over viable pending count", async () => {
    const dir = await makeTmpDir();
    try {
      await seed(dir, {
        "prometheus_analysis.json": { plans: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] },
        "athena_plan_review.json": { approved: true },
        "dispatch_checkpoint.json": { status: "in_progress", totalPlans: 3, completedPlans: 1 },
        "cycle_analytics.json": {
          funnel: { dispatched: 10, completed: 1, completionRate: 0.1 } // below 0.2 threshold
        },
      });
      const result = await computeQueueViability(cfg(dir));
      assert.equal(result.viable, false);
      assert.equal(result.reason, "low-completion-rate");
      assert.ok(result.pendingCount > 0, "pendingCount should still reflect pending work");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("QUEUE_VIABILITY_MIN_COMPLETION_RATE is exported as a positive number between 0 and 1", () => {
    assert.ok(typeof QUEUE_VIABILITY_MIN_COMPLETION_RATE === "number");
    assert.ok(QUEUE_VIABILITY_MIN_COMPLETION_RATE > 0);
    assert.ok(QUEUE_VIABILITY_MIN_COMPLETION_RATE < 1);
  });
});