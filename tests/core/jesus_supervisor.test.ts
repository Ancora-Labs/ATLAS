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
  sanitizeDirectiveFieldForPersistence,
  shouldWarnJesusDecisionLatency,
  hasReachedJesusSoftTimeout,
  formatJesusTierEscalationMessage,
  emitJesusSpanTransition,
  JESUS_AGENT_ID,
  JESUS_WARNING_CODE,
} from "../../src/core/jesus_supervisor.js";
import {
  computeQueueViability,
  QUEUE_VIABILITY_MIN_COMPLETION_RATE,
} from "../../src/core/pipeline_progress.js";
import { recordCapabilityExecution } from "../../src/core/state_tracker.js";
import {
  buildEvent,
  EVENT_DOMAIN,
  EVENTS,
  JESUS_SOFT_TIMEOUT_POLICY_CONTRACT,
  SPAN_CONTRACT,
  VALID_EVENT_NAMES,
} from "../../src/core/event_schema.js";

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

      // Record a runtime execution trace so the dual-gate check passes.
      await recordCapabilityExecution(
        { paths: { stateDir } },
        "jesus-findings-to-plan-requirements",
        "test: observed in prometheus planning loop",
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
      assert.equal(capGap.note, "verified_present_in_source_and_executed");
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

      // Record a runtime execution trace so the dual-gate check passes.
      await recordCapabilityExecution(
        { paths: { stateDir } },
        "ci-failure-log-injection",
        "test: observed in orchestrator dispatch context hydration",
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
      assert.equal(capGap.note, "verified_present_in_source_and_executed");
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
      assert.notEqual(capGap.note, "verified_present_in_source_and_executed");
    });
  });


  it("does NOT downgrade gap when source signatures present but no execution trace exists", async () => {
    // Validates the execution-trace gate: source-presence alone is insufficient.
    await withTempRepo(async ({ stateDir, repoDir }) => {
      // Write all required source signatures for jesus-findings-to-plan-requirements.
      writeFileSync(
        path.join(repoDir, "src", "core", "prometheus.ts"),
        "const a='MANDATORY_TASKS'; function buildMandatoryTasksPromptSection(){} function extractMandatoryHealthAuditFindings(){}",
        "utf8",
      );
      // No execution trace written — capability never observed in runtime path.
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
      // Source is present but no execution trace → must NOT downgrade.
      assert.notEqual(capGap.severity, "info",
        "gap must remain at original severity when execution trace is absent, even if source signatures exist"
      );
      assert.equal(capGap.note, undefined,
        "verification note must not be set without execution trace evidence"
      );
    });
  });

  it("does NOT downgrade gap when only stale execution traces exist", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(
        path.join(repoDir, "src", "core", "prometheus.ts"),
        "const a='MANDATORY_TASKS'; function buildMandatoryTasksPromptSection(){} function extractMandatoryHealthAuditFindings(){}",
        "utf8",
      );
      writeFileSync(
        path.join(stateDir, "capability_execution_traces.json"),
        JSON.stringify({
          traces: [
            {
              capability: "jesus-findings-to-plan-requirements",
              observedAt: new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString(),
              context: "stale historical invocation",
            },
          ],
        }),
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
      assert.equal(capGap.severity, "critical");
      assert.equal(capGap.note, undefined);
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
              severity: "warning",
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
      assert.equal(capGap.severity, "warning");
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

  // ── Wave task membership: exact Set check (no substring regression) ────────
  it("does NOT flag a wave as incomplete when it has no explicit tasks array", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(path.join(repoDir, "src", "core", "placeholder.ts"), "export const ok = true;", "utf8");
      writeFileSync(
        path.join(stateDir, "knowledge_memory.json"),
        JSON.stringify({ lessons: [], capabilityGaps: [] }),
        "utf8",
      );
      // Wave with no tasks[] array — legacy format. Should NOT be flagged incomplete.
      const athenaCoord = {
        completedTasks: ["T-001"],
        executionStrategy: {
          waves: [
            { id: "wave-1", workers: ["evolution-worker"] }
            // Note: no tasks[] field — wave completeness cannot be determined
          ]
        }
      };
      writeFileSync(
        path.join(stateDir, "athena_coordination.json"),
        JSON.stringify(athenaCoord),
        "utf8",
      );
      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        { latestMainCi: null, failedCiRuns: [], pullRequests: [] },
        athenaCoord,
        {},
      );
      const gapFindings = findings.filter((f: any) => f.area === "execution-gaps");
      assert.equal(gapFindings.length, 0,
        "waves without tasks[] must not be flagged incomplete (avoids false positives)");
    });
  });

  it("flags a wave as incomplete using exact task membership, not substring matching", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(path.join(repoDir, "src", "core", "placeholder.ts"), "export const ok = true;", "utf8");
      writeFileSync(
        path.join(stateDir, "knowledge_memory.json"),
        JSON.stringify({ lessons: [], capabilityGaps: [] }),
        "utf8",
      );
      // Wave 1 owns T-001 (not done); wave 11 owns T-011 (done).
      // Substring match bug: "1" matches "T-011" so wave 1 would appear complete.
      // Exact membership fix: "T-011" is NOT in wave 1's tasks, so wave 1 is still incomplete.
      const athenaCoord = {
        completedTasks: ["T-011"],
        executionStrategy: {
          waves: [
            { id: "wave-1", tasks: ["T-001"], workers: ["evolution-worker"] },
            { id: "wave-11", tasks: ["T-011"], workers: ["evolution-worker"] },
          ]
        }
      };
      writeFileSync(
        path.join(stateDir, "athena_coordination.json"),
        JSON.stringify(athenaCoord),
        "utf8",
      );
      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        { latestMainCi: null, failedCiRuns: [], pullRequests: [] },
        athenaCoord,
        {},
      );
      const gapFindings = findings.filter((f: any) => f.area === "execution-gaps");
      assert.equal(gapFindings.length, 1, "wave-1 must be flagged incomplete: T-001 not in completedTasks");
      assert.ok(gapFindings[0].finding.includes("wave-1"),
        "incomplete wave finding must name wave-1");
    });
  });

  it("does NOT flag a working session as stuck when lastActiveAt is absent but startedAt is recent", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(path.join(repoDir, "src", "core", "placeholder.ts"), "export const ok = true;", "utf8");
      writeFileSync(path.join(stateDir, "knowledge_memory.json"), JSON.stringify({ lessons: [], capabilityGaps: [] }), "utf8");

      // Worker with status=working, no lastActiveAt, but startedAt is 2 minutes ago (not stuck)
      const recentStart = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const sessions = {
        "quality-worker": { status: "working", startedAt: recentStart, lastActiveAt: undefined },
      };

      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        { latestMainCi: null, failedCiRuns: [], pullRequests: [] },
        {},
        sessions,
      );

      const workerHealth = findings.filter((f: any) => f.area === "worker-health");
      assert.equal(workerHealth.length, 0,
        "worker with no lastActiveAt but recent startedAt must NOT be flagged as stuck");
    });
  });

  it("does NOT flag a working session as stuck when neither lastActiveAt nor startedAt is present", async () => {
    await withTempRepo(async ({ stateDir, repoDir }) => {
      writeFileSync(path.join(repoDir, "src", "core", "placeholder.ts"), "export const ok = true;", "utf8");
      writeFileSync(path.join(stateDir, "knowledge_memory.json"), JSON.stringify({ lessons: [], capabilityGaps: [] }), "utf8");

      // Worker with status=working but no timestamp at all — Infinity fallback must not trigger
      const sessions = {
        "quality-worker": { status: "working" },
      };

      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        { latestMainCi: null, failedCiRuns: [], pullRequests: [] },
        {},
        sessions,
      );

      const workerHealth = findings.filter((f: any) => f.area === "worker-health");
      assert.equal(workerHealth.length, 0,
        "worker with no timestamps must NOT generate false stuck finding");
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

// ── Task 2: sanitizeDirectiveFieldForPersistence ──────────────────────────────

describe("sanitizeDirectiveFieldForPersistence", () => {
  it("strips tool_call lines from briefForPrometheus text", () => {
    const input = "Check GitHub issues.\ntool_call: list_files state/\nActivate appropriate workers.";
    const result = sanitizeDirectiveFieldForPersistence(input);
    assert.ok(!result.includes("tool_call:"), "tool_call lines must be stripped");
    assert.ok(result.includes("Check GitHub issues."), "genuine content must be preserved");
    assert.ok(result.includes("Activate appropriate workers."), "genuine content must be preserved");
  });

  it("strips <thinking>...</thinking> blocks including multiline", () => {
    const input = "Strategic brief.\n<thinking>\nInternal reasoning\nacross lines\n</thinking>\nPriority: fix CI.";
    const result = sanitizeDirectiveFieldForPersistence(input);
    assert.ok(!result.includes("<thinking>"), "thinking tags must be stripped");
    assert.ok(!result.includes("Internal reasoning"), "thinking content must be removed");
    assert.ok(result.includes("Strategic brief."), "genuine content must be preserved");
    assert.ok(result.includes("Priority: fix CI."), "genuine content must be preserved");
  });

  it("strips role prefix lines (assistant:, user:, system:)", () => {
    const input = "assistant: OK, here is the brief.\nFix the failing build.\nuser: understood";
    const result = sanitizeDirectiveFieldForPersistence(input);
    assert.ok(!result.includes("assistant:"), "assistant prefix must be stripped");
    assert.ok(!result.includes("user:"), "user prefix must be stripped");
    assert.ok(result.includes("Fix the failing build."), "genuine content preserved");
  });

  it("returns empty string for empty or whitespace input", () => {
    assert.equal(sanitizeDirectiveFieldForPersistence(""), "");
    assert.equal(sanitizeDirectiveFieldForPersistence("   \n\n  "), "");
  });

  it("preserves clean strategic text unchanged", () => {
    const clean = "Focus on fixing CI failures and improving test coverage.";
    assert.equal(sanitizeDirectiveFieldForPersistence(clean), clean);
  });

  it("negative path: does not strip normal content that happens to contain 'tool' as a word", () => {
    const input = "The build tool must be configured correctly.";
    const result = sanitizeDirectiveFieldForPersistence(input);
    assert.ok(result.includes("build tool"), "word 'tool' in content must not be stripped");
  });
});

describe("jesus_supervisor — shouldWarnJesusDecisionLatency", () => {
  it("returns true when elapsed latency is equal to warning threshold", () => {
    assert.equal(shouldWarnJesusDecisionLatency(900000, 900000), true);
  });

  it("returns true when elapsed latency exceeds warning threshold", () => {
    assert.equal(shouldWarnJesusDecisionLatency(900001, 900000), true);
  });

  it("returns false when elapsed latency is below warning threshold", () => {
    assert.equal(shouldWarnJesusDecisionLatency(899999, 900000), false);
  });

  it("falls back to default threshold when threshold is invalid", () => {
    assert.equal(shouldWarnJesusDecisionLatency(900000, Number.NaN), true);
    assert.equal(shouldWarnJesusDecisionLatency(899999, Number.NaN), false);
  });
});

describe("jesus_supervisor — hasReachedJesusSoftTimeout", () => {
  it("returns true when elapsed latency is equal to soft-timeout threshold", () => {
    assert.equal(hasReachedJesusSoftTimeout(600000, 600000), true);
  });

  it("returns true when elapsed latency exceeds soft-timeout threshold", () => {
    assert.equal(hasReachedJesusSoftTimeout(600001, 600000), true);
  });

  it("returns false when elapsed latency is below soft-timeout threshold", () => {
    assert.equal(hasReachedJesusSoftTimeout(599999, 600000), false);
  });

  it("falls back to default soft-timeout threshold when threshold is invalid", () => {
    assert.equal(hasReachedJesusSoftTimeout(600000, Number.NaN), true);
    assert.equal(hasReachedJesusSoftTimeout(599999, Number.NaN), false);
  });
});

describe("jesus_supervisor — fallback activation event contract", () => {
  it("registers POLICY_JESUS_FALLBACK_ACTIVATED in canonical event registry", () => {
    assert.ok(EVENTS.POLICY_JESUS_FALLBACK_ACTIVATED);
    assert.equal(VALID_EVENT_NAMES.has(EVENTS.POLICY_JESUS_FALLBACK_ACTIVATED), true);
  });

  it("builds a valid fallback activation event with soft-timeout semantics fields", () => {
    const event = buildEvent(
      EVENTS.POLICY_JESUS_FALLBACK_ACTIVATED,
      EVENT_DOMAIN.POLICY,
      "jesus-fallback-evt-001",
      {
        source: "jesus_supervisor",
        baseModel: "Claude Sonnet 4.6",
        fallbackModel: "GPT-5.3-Codex",
        fromTier: "T2",
        toTier: "T3",
        softTimeoutMs: 600000,
        elapsedMsAtActivation: 602000,
        softTimeoutReached: true,
        hardTimeoutMs: 1800000,
        routingReason: "JESUS_LATENCY_FALLBACK",
      }
    );

    assert.equal(event.event, EVENTS.POLICY_JESUS_FALLBACK_ACTIVATED);
    assert.equal(event.domain, EVENT_DOMAIN.POLICY);
    assert.equal(
      event.payload.softTimeoutReached,
      JESUS_SOFT_TIMEOUT_POLICY_CONTRACT.fallbackActivated.softTimeoutReached,
    );
  });

  it("negative path: throws when fallback activation event uses an invalid domain", () => {
    assert.throws(
      () => buildEvent(EVENTS.POLICY_JESUS_FALLBACK_ACTIVATED, "not-a-domain", "jesus-fallback-evt-002", {}),
      /not-a-domain/,
    );
  });
});

describe("jesus_supervisor — tier escalation messaging", () => {
  it("uses non-terminal wording for fallback activation after tier budget exhaustion", () => {
    const message = formatJesusTierEscalationMessage(
      { label: "T2", timeoutMs: 600_000, model: "Claude Sonnet 4.6" },
      { label: "T3", timeoutMs: 1_800_000, model: "gpt-5.3-codex" },
      "JESUS_LATENCY_FALLBACK",
    );
    assert.match(message, /reached its 600s tier budget/i);
    assert.doesNotMatch(message, /timed out after 600s/i);
  });

  it("keeps timeout wording for same-model escalation tiers", () => {
    const message = formatJesusTierEscalationMessage(
      { label: "T1", timeoutMs: 60_000, model: "Claude Sonnet 4.6" },
      { label: "T2", timeoutMs: 600_000, model: "Claude Sonnet 4.6" },
      "JESUS_LATENCY_ESCALATION",
    );
    assert.match(message, /timed out after 60s/i);
    assert.match(message, /escalating to T2/i);
  });
});

// ── Soft-timeout cutoff event contract ──────────────────────────────────────────

describe("jesus_supervisor — soft-timeout cutoff event contract", () => {
  it("registers POLICY_JESUS_SOFT_TIMEOUT_CUTOFF in canonical event registry", () => {
    assert.ok(EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF,
      "POLICY_JESUS_SOFT_TIMEOUT_CUTOFF must be defined in EVENTS");
    assert.equal(VALID_EVENT_NAMES.has(EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF), true,
      "POLICY_JESUS_SOFT_TIMEOUT_CUTOFF must be in VALID_EVENT_NAMES for O(1) lookup");
  });

  it("event name matches box.v1.policy.* naming convention", () => {
    assert.match(
      EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF,
      /^box\.v1\.policy\.[a-zA-Z][a-zA-Z0-9_]*$/,
      "event name must follow box.v1.policy.<action> convention",
    );
  });

  it("builds a valid cutoff event with softTimeoutReached=false (threshold not crossed)", () => {
    const event = buildEvent(
      EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF,
      EVENT_DOMAIN.POLICY,
      "jesus-cutoff-evt-001",
      {
        source: "jesus_supervisor",
        tier: "T3",
        softTimeoutMs: 600000,
        elapsedMsAtCutoff: 420000,
        softTimeoutReached: false,
        baseModel: "Claude Sonnet 4.6",
        fallbackModel: "Claude Opus 4.5",
        hardTimeoutMs: 1800000,
      },
    );

    assert.equal(event.event, EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF);
    assert.equal(event.domain, EVENT_DOMAIN.POLICY);
    assert.equal(event.payload.softTimeoutReached, JESUS_SOFT_TIMEOUT_POLICY_CONTRACT.softTimeoutCutoff.softTimeoutReached,
      "cutoff fires because soft-timeout was NOT reached — field must be false");
    assert.equal(event.payload.tier, "T3");
    assert.equal(event.payload.elapsedMsAtCutoff, 420000);
    assert.equal(event.payload.softTimeoutMs, 600000);
  });

  it("cutoff event carries baseModel and fallbackModel for routing traceability", () => {
    const event = buildEvent(
      EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF,
      EVENT_DOMAIN.POLICY,
      "jesus-cutoff-evt-002",
      {
        source: "jesus_supervisor",
        tier: "T3",
        softTimeoutMs: 300000,
        elapsedMsAtCutoff: 180000,
        softTimeoutReached: false,
        baseModel: "Claude Sonnet 4.6",
        fallbackModel: "Claude Sonnet 4.6",
        hardTimeoutMs: 1800000,
      },
    );
    assert.equal(event.payload.baseModel, "Claude Sonnet 4.6");
    assert.equal(event.payload.fallbackModel, "Claude Sonnet 4.6");
    assert.equal(event.payload.hardTimeoutMs, 1800000);
  });

  it("negative path: throws when cutoff event uses an invalid domain", () => {
    assert.throws(
      () => buildEvent(
        EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF,
        "not-a-valid-domain",
        "jesus-cutoff-evt-003",
        { source: "test" },
      ),
      /not-a-valid-domain/,
      "buildEvent must throw for an invalid domain",
    );
  });

  it("distinguishes cutoff (softTimeoutReached=false) from fallback activation (softTimeoutReached=true)", () => {
    // Cutoff event: threshold not reached → no agent call made
    const cutoffEvent = buildEvent(
      EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF,
      EVENT_DOMAIN.POLICY,
      "jesus-distinguish-001",
      {
        source: "jesus_supervisor",
        tier: "T3",
        softTimeoutMs: 600000,
        elapsedMsAtCutoff: 350000,
        softTimeoutReached: false,
        baseModel: "Claude Sonnet 4.6",
        fallbackModel: "Claude Opus 4.5",
        hardTimeoutMs: 1800000,
      },
    );

    // Fallback activation event: threshold WAS reached → agent call proceeds with fallback model
    const fallbackEvent = buildEvent(
      EVENTS.POLICY_JESUS_FALLBACK_ACTIVATED,
      EVENT_DOMAIN.POLICY,
      "jesus-distinguish-001",
      {
        source: "jesus_supervisor",
        baseModel: "Claude Sonnet 4.6",
        fallbackModel: "Claude Opus 4.5",
        fromTier: "T2",
        toTier: "T3",
        softTimeoutMs: 600000,
        elapsedMsAtActivation: 620000,
        softTimeoutReached: true,
        hardTimeoutMs: 1800000,
        routingReason: "JESUS_LATENCY_FALLBACK",
      },
    );

    assert.notEqual(cutoffEvent.event, fallbackEvent.event,
      "cutoff and fallback activation must be distinct canonical events");
    assert.equal(cutoffEvent.payload.softTimeoutReached, JESUS_SOFT_TIMEOUT_POLICY_CONTRACT.softTimeoutCutoff.softTimeoutReached,
      "cutoff must carry softTimeoutReached=false");
    assert.equal(fallbackEvent.payload.softTimeoutReached, JESUS_SOFT_TIMEOUT_POLICY_CONTRACT.fallbackActivated.softTimeoutReached,
      "fallback activation must carry softTimeoutReached=true");
  });

  it("hasReachedJesusSoftTimeout predicate is consistent with cutoff condition", () => {
    // The cutoff fires when hasReachedJesusSoftTimeout returns false.
    // These assertions prove the predicate boundary is deterministic.
    const softTimeoutMs = 600_000;
    assert.equal(hasReachedJesusSoftTimeout(599_999, softTimeoutMs), false,
      "1ms below threshold: cutoff fires (no agent call)");
    assert.equal(hasReachedJesusSoftTimeout(600_000, softTimeoutMs), true,
      "at threshold: fallback proceeds (no cutoff)");
    assert.equal(hasReachedJesusSoftTimeout(600_001, softTimeoutMs), true,
      "1ms above threshold: fallback proceeds (no cutoff)");
  });
});

// ── emitJesusSpanTransition — analytics event wiring ─────────────────────────

describe("jesus_supervisor — emitJesusSpanTransition span contract", () => {
  it("returns a PLANNING_STAGE_TRANSITION event with correct name and domain", () => {
    const evt = emitJesusSpanTransition("trace-001", "idle", "planning");
    assert.equal(evt.event, EVENTS.PLANNING_STAGE_TRANSITION,
      "event name must be PLANNING_STAGE_TRANSITION");
    assert.equal(evt.domain, EVENT_DOMAIN.PLANNING,
      "domain must be PLANNING");
  });

  it("stamps agentId as JESUS_AGENT_ID in the span payload", () => {
    const evt = emitJesusSpanTransition("trace-002", "planning", "execution");
    assert.equal(evt.payload[SPAN_CONTRACT.fields.agentId], JESUS_AGENT_ID,
      "span agentId must equal JESUS_AGENT_ID");
  });

  it("records stageFrom and stageTo in the span payload", () => {
    const evt = emitJesusSpanTransition("trace-003", "execution", "review");
    assert.equal(evt.payload[SPAN_CONTRACT.stageTransition.stageFrom], "execution",
      "stageFrom must match the argument passed");
    assert.equal(evt.payload[SPAN_CONTRACT.stageTransition.stageTo], "review",
      "stageTo must match the argument passed");
  });

  it("stamps optional durationMs and parentSpanId when provided", () => {
    const evt = emitJesusSpanTransition("trace-004", "idle", "planning", {
      durationMs: 12345,
      parentSpanId: "parent-span-abc",
    });
    assert.equal(evt.payload[SPAN_CONTRACT.stageTransition.durationMs], 12345,
      "durationMs must be forwarded into the span payload");
    assert.equal(evt.payload[SPAN_CONTRACT.fields.parentSpanId], "parent-span-abc",
      "parentSpanId must be forwarded into the span payload");
  });

  it("negative path: throws when correlationId is an empty string", () => {
    assert.throws(
      () => emitJesusSpanTransition("", "idle", "planning"),
      /correlationId|MISSING_CORRELATION_ID/i,
    );
  });
});

// ── JESUS_AGENT_ID and JESUS_WARNING_CODE ─────────────────────────────────────

describe("jesus_supervisor — JESUS_AGENT_ID and JESUS_WARNING_CODE constants", () => {
  it("JESUS_AGENT_ID is the canonical agent identifier 'jesus'", () => {
    assert.equal(JESUS_AGENT_ID, "jesus",
      "JESUS_AGENT_ID must be the literal string 'jesus' for span correlation");
  });

  it("JESUS_WARNING_CODE is a frozen object with deterministic code strings", () => {
    assert.ok(Object.isFrozen(JESUS_WARNING_CODE),
      "JESUS_WARNING_CODE must be frozen to prevent accidental mutation");
    assert.ok(typeof JESUS_WARNING_CODE.DECISION_LATENCY_WARNING === "string"
      && JESUS_WARNING_CODE.DECISION_LATENCY_WARNING.length > 0,
      "DECISION_LATENCY_WARNING must be a non-empty string");
    assert.ok(typeof JESUS_WARNING_CODE.LATENCY_ESCALATION === "string"
      && JESUS_WARNING_CODE.LATENCY_ESCALATION.length > 0,
      "LATENCY_ESCALATION must be a non-empty string");
    assert.ok(typeof JESUS_WARNING_CODE.LATENCY_FALLBACK_ACTIVATED === "string"
      && JESUS_WARNING_CODE.LATENCY_FALLBACK_ACTIVATED.length > 0,
      "LATENCY_FALLBACK_ACTIVATED must be a non-empty string");
  });

  it("JESUS_WARNING_CODE codes are distinct from each other", () => {
    const codes = Object.values(JESUS_WARNING_CODE);
    const unique = new Set(codes);
    assert.equal(unique.size, codes.length, "all JESUS_WARNING_CODE values must be unique");
  });
});


// ── hasCiSystemLearningDebt ───────────────────────────────────────────────────

import { hasCiSystemLearningDebt } from "../../src/core/jesus_supervisor.js";

describe("hasCiSystemLearningDebt", () => {
  it("returns false for empty findings array", () => {
    assert.equal(hasCiSystemLearningDebt([]), false);
  });

  it("returns true when any finding has ciFastlaneRequired=true", () => {
    assert.equal(hasCiSystemLearningDebt([{ ciFastlaneRequired: true }]), true);
  });

  it("returns true when area=ci and severity=critical", () => {
    assert.equal(
      hasCiSystemLearningDebt([{ area: "ci", severity: "critical", finding: "CI broken", remediation: "" }]),
      true
    );
  });

  it("returns true when capabilityNeeded=ci-fix", () => {
    assert.equal(
      hasCiSystemLearningDebt([{ capabilityNeeded: "ci-fix", severity: "critical" }]),
      true
    );
  });

  it("returns true when area=system-learning with CI-break pattern", () => {
    const findings = [{
      area: "system-learning",
      severity: "critical",
      finding: "CI-broken tests accumulating as system-learning debt",
      remediation: "ci-fix required"
    }];
    assert.equal(hasCiSystemLearningDebt(findings), true);
  });

  it("negative: returns false for non-CI finding", () => {
    const findings = [{ area: "planning", severity: "warning", finding: "low plan quality", remediation: "" }];
    assert.equal(hasCiSystemLearningDebt(findings), false);
  });

  it("negative: returns false for null/non-array input", () => {
    assert.equal(hasCiSystemLearningDebt(null as any), false);
    assert.equal(hasCiSystemLearningDebt("string" as any), false);
  });

  it("negative: returns false when finding is null or non-object", () => {
    assert.equal(hasCiSystemLearningDebt([null, undefined, 42, "string"]), false);
  });

  it("negative: returns false for system-learning finding annotated with latestMainCiConclusion=success even when text mentions CI", () => {
    // The live CI signal confirms main is healthy — the lesson is referencing past debt.
    const findings = [{
      area: "system-learning",
      severity: "warning",
      finding: "CI-broken tests accumulating as system-learning debt",
      remediation: "ci-fix required",
      latestMainCiConclusion: "success",
    }];
    assert.equal(hasCiSystemLearningDebt(findings), false,
      "stale CI-break lesson with live success signal must NOT trigger CI fastlane");
  });

  it("positive: returns true for system-learning finding with latestMainCiConclusion=failure when text mentions CI", () => {
    // CI is still broken — the lesson represents active debt.
    const findings = [{
      area: "system-learning",
      severity: "warning",
      finding: "CI-broken tests accumulating as system-learning debt",
      remediation: "ci-fix required",
      latestMainCiConclusion: "failure",
    }];
    assert.equal(hasCiSystemLearningDebt(findings), true,
      "system-learning CI-break finding with live failure signal must still trigger CI fastlane");
  });

  it("positive: latestMainCiConclusion=success does NOT suppress ciFastlaneRequired=true marker", () => {
    // Explicit ciFastlaneRequired overrides freshness gate — highest-priority signal.
    const findings = [{
      area: "system-learning",
      severity: "warning",
      finding: "some lesson",
      remediation: "",
      latestMainCiConclusion: "success",
      ciFastlaneRequired: true,
    }];
    assert.equal(hasCiSystemLearningDebt(findings), true,
      "ciFastlaneRequired=true must bypass the freshness gate");
  });
});

// ── runSystemHealthAudit — CI context in findings for freshness arbitration ────

describe("jesus_supervisor — runSystemHealthAudit CI finding shape", () => {
  function withTempRepo<T>(fn: (ctx: { stateDir: string }) => Promise<T>): Promise<T> {
    const repoDir = mkdtempSync(path.join(tmpdir(), "jesus-ci-audit-"));
    const stateDir = path.join(repoDir, "state");
    mkdirSync(stateDir, { recursive: true });
    const previousCwd = process.cwd();
    return Promise.resolve()
      .then(() => { process.chdir(repoDir); return fn({ stateDir }); })
      .finally(() => {
        process.chdir(previousCwd);
        rmSync(repoDir, { recursive: true, force: true });
      });
  }

  it("emits a ci-fix finding with area=ci when latestMainCi.conclusion is failure", async () => {
    await withTempRepo(async ({ stateDir }) => {
      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        {
          latestMainCi: { conclusion: "failure", branch: "main", headSha: "abc123", updatedAt: new Date().toISOString() },
          failedCiRuns: [],
          pullRequests: [],
        },
        {},
        {},
      );
      const ciFinding = findings.find((f: any) => f.area === "ci" && f.capabilityNeeded === "ci-fix");
      assert.ok(ciFinding, "must emit a ci-fix finding when main CI is failed");
      assert.equal(ciFinding.severity, "critical");
    });
  });

  it("does not emit a ci area finding when latestMainCi.conclusion is success", async () => {
    await withTempRepo(async ({ stateDir }) => {
      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        {
          latestMainCi: { conclusion: "success", branch: "main", headSha: "def456", updatedAt: new Date().toISOString() },
          failedCiRuns: [],
          pullRequests: [],
        },
        {},
        {},
      );
      const ciFinding = findings.find((f: any) => f.area === "ci" && f.capabilityNeeded === "ci-fix");
      assert.equal(ciFinding, undefined, "must NOT emit ci-fix finding when main CI is healthy");
    });
  });

  it("annotates system-improvement finding with latestMainCiConclusion from live CI state", async () => {
    await withTempRepo(async ({ stateDir }) => {
      // Write a knowledge_memory.json with a critical lesson that mentions CI.
      const stateFullPath = path.join(process.cwd(), "state");
      writeFileSync(
        path.join(stateFullPath, "knowledge_memory.json"),
        JSON.stringify({
          schemaVersion: 1,
          lessons: [
            { lesson: "CI-broken tests kept accumulating", severity: "critical" },
          ],
        }),
      );
      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        {
          latestMainCi: { conclusion: "success", branch: "main", headSha: "abc999", updatedAt: new Date().toISOString() },
          failedCiRuns: [],
          pullRequests: [],
        },
        {},
        {},
      );
      const siFinding = findings.find((f: any) => f.area === "system-learning" && f.capabilityNeeded === "system-improvement");
      assert.ok(siFinding, "system-improvement finding must be emitted when critical lessons exist");
      assert.equal(siFinding.latestMainCiConclusion, "success",
        "finding must carry latestMainCiConclusion=success from live CI state");
    });
  });

  it("annotates system-improvement finding with latestMainCiConclusion=failure when CI is broken", async () => {
    await withTempRepo(async ({ stateDir }) => {
      const stateFullPath = path.join(process.cwd(), "state");
      writeFileSync(
        path.join(stateFullPath, "knowledge_memory.json"),
        JSON.stringify({
          schemaVersion: 1,
          lessons: [
            { lesson: "CI-broken tests kept accumulating", severity: "critical" },
          ],
        }),
      );
      const findings = await runSystemHealthAudit(
        { paths: { stateDir } } as any,
        {
          latestMainCi: { conclusion: "failure", branch: "main", headSha: "abc000", updatedAt: new Date().toISOString() },
          failedCiRuns: [],
          pullRequests: [],
        },
        {},
        {},
      );
      const siFinding = findings.find((f: any) => f.area === "system-learning" && f.capabilityNeeded === "system-improvement");
      assert.ok(siFinding, "system-improvement finding must be emitted when critical lessons exist");
      assert.equal(siFinding.latestMainCiConclusion, "failure",
        "finding must carry latestMainCiConclusion=failure when CI is still broken");
    });
  });
});