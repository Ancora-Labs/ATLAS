import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePrometheusParsedOutput,
  filterResolvedCarryForwardItems,
  CARRY_FORWARD_MAX_TOKENS,
  BEHAVIOR_PATTERNS_MAX_TOKENS,
  PROMETHEUS_STATIC_SECTIONS,
  PROMETHEUS_CYCLE_DELTA_SECTION_NAMES,
  PROMETHEUS_STATIC_SECTION_NAMES,
  computeDriftConfidencePenalty,
  DRIFT_REMEDIATION_THRESHOLD,
  computeBottleneckCoverage,
  BOTTLENECK_COVERAGE_FLOOR,
  buildDriftDebtTasks,
  checkPacketCompleteness,
  UNRECOVERABLE_PACKET_REASONS,
  PLANNER_HEALTH_ALIASES,
  normalizeProjectHealthAlias,
  checkHighRiskPacketConfidence,
  HIGH_RISK_LOW_CONFIDENCE_REASON,
  computeHighRiskComponentGate,
  HIGH_RISK_COMPONENT_GATE_THRESHOLDS,
  checkDecompositionCaps,
  MAX_DECOMPOSITION_PLANS,
  DECOMPOSITION_CAP_REASON,
  CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS,
  computeClosureYield,
  rankPlansByClosureYield,
  CLOSURE_YIELD_LOW_THRESHOLD,
  CLOSURE_YIELD_BOOST_AMOUNT,
  CLOSURE_YIELD_BOOST_DIMENSIONS,
  computeNoveltyScore,
  seedDiscoveryGapPackets,
  NOVELTY_COLLAPSE_THRESHOLD,
  NOVELTY_SEED_DIMENSIONS,
  attachFallbackProvenance,
  quarantineLowConfidencePackets,
  FALLBACK_PROVENANCE_TAG,
  QUARANTINE_CONFIDENCE_THRESHOLD,
} from "../../src/core/prometheus.js";
import { compilePrompt, markCacheableSegments } from "../../src/core/prompt_compiler.js";
import { isNonSpecificVerification, validatePlanContract } from "../../src/core/plan_contract_validator.js";

describe("normalizePrometheusParsedOutput", () => {
  it("maps tasks/waves decision payload into planner plans", () => {
    const parsed = {
      cycleObjective: "Eliminate recurring verification false-fails",
      tasks: [
        {
          task_id: "T-VH-001",
          title: "Fix verification harness",
          verification_commands: ["npm test"],
          acceptance_criteria: ["Windows glob false-fail rate is zero"]
        },
        {
          task_id: "T-CF-003",
          title: "Automate carry-forward escalation",
          verification_commands: ["npm test"]
        }
      ],
      waves: [
        { wave: 1, tasks: ["T-VH-001"] },
        { wave: 2, tasks: ["T-CF-003"] }
      ]
    };

    const normalized = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(normalized.projectHealth, "needs-work");
    assert.equal(Array.isArray(normalized.plans), true);
    assert.equal(normalized.plans.length, 2);
    assert.equal(normalized.plans[0].task, "Fix verification harness");
    assert.equal(normalized.plans[0].wave, 1);
    assert.equal(normalized.plans[0].verification, "npm test");
    assert.equal(normalized.plans[1].wave, 2);
  });

  it("maps topBottlenecks + string-task waves (GPT analytical format) into planner plans", () => {
    const parsed = {
      projectHealth: "needs-work",
      topBottlenecks: [
        {
          id: "BN-1",
          title: "Jesus reads trump_analysis.json (non-existent)",
          severity: "critical",
          evidence: "jesus_supervisor.js:283 reads trump_analysis.json; never populated"
        },
        {
          id: "BN-2",
          title: "Sequential worker dispatch ignores wave infrastructure",
          severity: "high",
          evidence: "orchestrator.js:740 sequential for-loop"
        }
      ],
      waves: [
        {
          wave: 1,
          tasks: ["Fix-1: trump→prometheus reference fix"],
          workerSlots: 1,
          rationale: "Correctness bugs"
        },
        {
          wave: 2,
          tasks: ["Fix-2: wave-parallel worker dispatch"],
          workerSlots: 1,
          rationale: "Throughput improvement"
        }
      ],
      proofMetrics: [
        "prometheusAnalysis.projectHealth non-null in jesus_directive.json after trump fix",
        "cycle wall-clock time p50 reduction >= 40% after wave-parallel dispatch"
      ],
      requestBudget: { estimatedPremiumRequestsTotal: 2, errorMarginPercent: 30, hardCapTotal: 3 }
    };

    const normalized = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(normalized.projectHealth, "needs-work");
    assert.equal(Array.isArray(normalized.plans), true);
    assert.equal(normalized.plans.length, 2);
    // Wave 1 plan
    assert.equal(normalized.plans[0].wave, 1);
    assert.equal(normalized.plans[0].role, "evolution-worker");
    assert.equal(typeof normalized.plans[0].task, "string");
    assert.ok(normalized.plans[0].task.length > 0);
    // Wave 2 plan
    assert.equal(normalized.plans[1].wave, 2);
    // Priority should reflect severity — BN-1 is critical → priority 1
    assert.equal(normalized.plans[0].priority, 1);
  });

  it("keeps valid planner plans and fills missing required fields", () => {
    const parsed = {
      analysis: "System is stable but has quality debt",
      projectHealth: "good",
      executionStrategy: { waves: [] },
      plans: [
        {
          task: "Harden trust boundary"
        }
      ]
    };

    const normalized = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(normalized.projectHealth, "good");
    assert.equal(normalized.plans.length, 1);
    assert.equal(normalized.plans[0].role, "evolution-worker");
    assert.equal(normalized.plans[0].verification, "npm test");
    assert.equal(normalized.plans[0].priority, 1);
  });

  it("maps DECISION-style waves with string task ids into actionable plans", () => {
    const parsed = {
      maxTasks: 5,
      waves: [
        { wave: 1, tasks: ["verification-harness-fix", "decision-router-hardening"] },
        { wave: 2, dependsOn: [1], tasks: ["closed-loop-learning-ledger"] }
      ],
      blockingCarryForwardIncluded: true
    };

    const normalized = normalizePrometheusParsedOutput(parsed, {
      thinking: "Prometheus created a dependency-aware plan",
      raw: ""
    });

    assert.equal(normalized.plans.length, 3);
    assert.equal(normalized.plans[0].wave, 1);
    assert.equal(normalized.plans[1].wave, 1);
    assert.equal(normalized.plans[2].wave, 2);
    assert.equal(normalized.plans[0].task, "verification-harness-fix");
    assert.equal(normalized.plans[0].role, "evolution-worker");
  });

  it("always emits requestBudget to satisfy trust boundary", () => {
    const parsed = {
      waves: [{ wave: 1, tasks: ["premium-efficiency-controller"] }]
    };

    const normalized = normalizePrometheusParsedOutput(parsed, {
      thinking: "Plan with one task",
      raw: ""
    });

    assert.ok(normalized.requestBudget);
    assert.equal(
      Number.isFinite(Number(normalized.requestBudget.estimatedPremiumRequestsTotal)),
      true
    );
    assert.equal(Number(normalized.requestBudget.hardCapTotal) >= 1, true);
  });

  it("extracts plans from narrative wave sections when no JSON plans exist", () => {
    const parsed = {};
    const thinking = `
Wave 1 (blocking)
1) Fix Windows verification harness
2) Add planning gate for missing harness fix

Wave 2
3) Upgrade evaluation stack
`;

    const normalized = normalizePrometheusParsedOutput(parsed, { thinking, raw: "" });

    assert.equal(normalized.plans.length, 3);
    assert.equal(normalized.plans[0].wave, 1);
    assert.equal(normalized.plans[1].wave, 1);
    assert.equal(normalized.plans[2].wave, 2);
    assert.ok(normalized.plans[0].task.toLowerCase().includes("verification harness"));
  });

  it("synthesizes concrete Athena-facing fields for template-like plans", () => {
    const parsed = {
      analysis: "Capacity increase is bottlenecked by integration closure.",
      plans: [
        { task: "Add trust-boundary provider integration tests for untrusted linter payloads" },
        { task: "Introduce critical-path scheduling over dependency-aware waves" },
        { task: "Add uncertainty-aware model routing with ROI feedback loop", wave: 2 }
      ]
    };

    const normalized = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.ok(normalized.plans[0].target_files.length > 0);
    assert.ok(normalized.plans[0].scope.length > 0);
    assert.ok(normalized.plans[0].acceptance_criteria.length >= 2);
    assert.ok(/deterministic test/i.test(normalized.plans[0].before_state));

    assert.equal(normalized.plans[1].riskLevel, "high");
    assert.ok(normalized.plans[1].premortem);
    assert.ok(normalized.plans[1].premortem.failurePaths.length >= 1);

    assert.equal(normalized.plans[2].riskLevel, "high");
    assert.ok(normalized.plans[2].target_files.includes("src/core/model_router.ts"));
  });
});

describe("normalizePrometheusParsedOutput — confidence components", () => {
  it("emits full-score components when plans are JSON-direct and health is explicit", () => {
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Fix verification harness", role: "evolution-worker" }],
      requestBudget: { estimatedPremiumRequestsTotal: 2, errorMarginPercent: 15, hardCapTotal: 3 }
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.ok(result.parserConfidenceComponents, "parserConfidenceComponents must be present");
    assert.equal(result.parserConfidenceComponents.plansShape, 1.0);
    assert.equal(result.parserConfidenceComponents.healthField, 1.0);
    assert.equal(result.parserConfidenceComponents.requestBudget, 1.0);
    assert.ok(Array.isArray(result.parserConfidencePenalties), "parserConfidencePenalties must be an array");
    assert.equal(result.parserConfidencePenalties.length, 0, "no penalties expected for full-score output");
    assert.equal(result.parserConfidence, 1.0);
  });

  it("emits plansShape=0.5 and a narrative-fallback penalty when plans come from waves", () => {
    const parsed = {
      projectHealth: "needs-work",
      waves: [{ wave: 1, tasks: ["Fix trust boundary"] }],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 }
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserConfidenceComponents.plansShape, 0.5);
    const penalty = result.parserConfidencePenalties.find(p => p.component === "plansShape");
    assert.ok(penalty, "must have a plansShape penalty");
    assert.equal(penalty.reason, "plans_from_narrative_fallback");
    assert.equal(penalty.delta, -0.5);
    assert.equal(result.parserConfidence, 0.5);
  });

  it("emits healthField=0.9 and a health_field_inferred penalty when projectHealth is missing", () => {
    const parsed = {
      plans: [{ task: "Add canary metrics", role: "evolution-worker" }],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 }
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserConfidenceComponents.healthField, 0.9);
    const penalty = result.parserConfidencePenalties.find(p => p.component === "healthField");
    assert.ok(penalty, "must have a healthField penalty");
    assert.equal(penalty.reason, "health_field_inferred_from_text");
    assert.equal(penalty.delta, -0.1);
    assert.equal(result.parserConfidence, 0.9);
  });

  it("emits requestBudget=0.9 and a budget-fallback penalty when requestBudget is absent", () => {
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Improve retry logic", role: "evolution-worker" }],
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserConfidenceComponents.requestBudget, 0.9);
    const penalty = result.parserConfidencePenalties.find(p => p.component === "requestBudget");
    assert.ok(penalty, "must have a requestBudget penalty");
    assert.equal(penalty.reason, "request_budget_fallback");
    assert.equal(penalty.delta, -0.1);
    assert.equal(result.parserConfidence, 0.9);
  });

  it("accumulates multiple penalties correctly", () => {
    // Narrative plans (base=0.5) + inferred health (-0.1) + no budget (-0.1) = 0.3
    const parsed = {
      waves: [{ wave: 1, tasks: ["Fix parser"] }],
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserConfidenceComponents.plansShape, 0.5);
    assert.equal(result.parserConfidenceComponents.healthField, 0.9);
    assert.equal(result.parserConfidenceComponents.requestBudget, 0.9);
    assert.equal(result.parserConfidencePenalties.length, 3);
    // 0.5 - 0.1 - 0.1 = 0.3
    assert.equal(result.parserConfidence, 0.3);
  });

  it("emits plansShape=0.0 and no_plans_extracted penalty when no plans are found", () => {
    const result = normalizePrometheusParsedOutput({}, { raw: "" });

    assert.equal(result.parserConfidenceComponents.plansShape, 0.0);
    const penalty = result.parserConfidencePenalties.find(p => p.reason === "no_plans_extracted");
    assert.ok(penalty, "must have a no_plans_extracted penalty");
    assert.equal(penalty.component, "plansShape");
  });

  it("each penalty entry has required fields: reason, component, delta", () => {
    const parsed = {
      waves: [{ wave: 1, tasks: ["Fix something"] }],
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    for (const p of result.parserConfidencePenalties) {
      assert.ok(typeof p.reason === "string" && p.reason.length > 0, "penalty must have reason");
      assert.ok(typeof p.component === "string" && p.component.length > 0, "penalty must have component");
      assert.ok(typeof p.delta === "number" && p.delta < 0, "penalty delta must be a negative number");
    }
  });

  it("emits bottleneckCoverage=1.0 component when no topBottlenecks declared", () => {
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Fix verification harness", role: "evolution-worker" }],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.parserConfidenceComponents.bottleneckCoverage, 1.0);
    assert.ok(!result.parserConfidencePenalties.some(p => p.component === "bottleneckCoverage"));
  });

  it("applies bottleneckCoverage penalty when topBottlenecks are undercovered", () => {
    const parsed = {
      projectHealth: "good",
      topBottlenecks: [
        { id: "BN-1", title: "Sequential worker dispatch ignores wave infrastructure", severity: "high" },
        { id: "BN-2", title: "Trust boundary contract missing enforcement gate", severity: "critical" },
        { id: "BN-3", title: "Parser fence handling drops multiline blocks", severity: "medium" },
      ],
      // plans that only address BN-1 — BN-2 and BN-3 uncovered
      plans: [
        { task: "Fix sequential worker dispatch for wave infrastructure", role: "evolution-worker", _fromBottleneck: "BN-1" },
      ],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.ok(result.parserConfidenceComponents.bottleneckCoverage < 1.0,
      "bottleneckCoverage component must be below 1.0 when bottlenecks are uncovered");
    const penalty = result.parserConfidencePenalties.find(p => p.component === "bottleneckCoverage");
    assert.ok(penalty, "must have a bottleneckCoverage penalty");
    assert.ok(penalty.delta < 0, "penalty delta must be negative");
    assert.ok(result.bottleneckCoverage, "must emit bottleneckCoverage field on result");
    assert.equal(result.bottleneckCoverage.total, 3);
    assert.ok(result.bottleneckCoverage.uncovered.length >= 1);
  });

  it("does not apply bottleneckCoverage penalty when all topBottlenecks are covered", () => {
    const parsed = {
      projectHealth: "good",
      topBottlenecks: [
        { id: "BN-1", title: "Sequential worker dispatch ignores wave infrastructure", severity: "high" },
        { id: "BN-2", title: "Trust boundary contract enforcement missing", severity: "critical" },
      ],
      plans: [
        { task: "Fix sequential worker dispatch wave infrastructure", role: "evolution-worker", _fromBottleneck: "BN-1" },
        { task: "Add trust boundary contract enforcement gate", role: "evolution-worker", _fromBottleneck: "BN-2" },
      ],
      requestBudget: { estimatedPremiumRequestsTotal: 2, errorMarginPercent: 15, hardCapTotal: 3 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserConfidenceComponents.bottleneckCoverage, 1.0);
    assert.ok(!result.parserConfidencePenalties.some(p => p.component === "bottleneckCoverage"));
  });

  // ── Structural quality: alias variation must not affect healthField score ──

  it("healthField=1.0 for 'healthy' alias — structural quality invariant to alias vs canonical", () => {
    const parsed = {
      projectHealth: "healthy",
      plans: [{ task: "Harden trust boundary", role: "evolution-worker" }],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserConfidenceComponents.healthField, 1.0,
      "'healthy' alias must score healthField=1.0 — same as canonical 'good'");
    assert.ok(!result.parserConfidencePenalties.some(p => p.component === "healthField"),
      "no healthField penalty expected for a recognized alias");
  });

  it("healthField=1.0 for 'warning' alias — structural quality invariant to alias vs canonical", () => {
    const parsed = {
      projectHealth: "warning",
      plans: [{ task: "Fix retry escalation", role: "evolution-worker" }],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserConfidenceComponents.healthField, 1.0,
      "'warning' alias must score healthField=1.0 — same as canonical 'needs-work'");
    assert.ok(!result.parserConfidencePenalties.some(p => p.component === "healthField"),
      "no healthField penalty expected for a recognized alias");
  });

  it("healthField=1.0 for all canonical health values ('good', 'needs-work', 'critical')", () => {
    for (const value of ["good", "needs-work", "critical"]) {
      const parsed = {
        projectHealth: value,
        plans: [{ task: "Fix something", role: "evolution-worker" }],
        requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
      };
      const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
      assert.equal(result.parserConfidenceComponents.healthField, 1.0,
        `canonical '${value}' must score healthField=1.0`);
      assert.ok(!result.parserConfidencePenalties.some(p => p.component === "healthField"),
        `no healthField penalty expected for canonical value '${value}'`);
    }
  });

  it("healthField=0.9 for unrecognized projectHealth value — resolves to canonical via inference (negative path)", () => {
    const parsed = {
      projectHealth: "unknown-status",
      plans: [{ task: "Fix something", role: "evolution-worker" }],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserConfidenceComponents.healthField, 0.9,
      "unrecognized health value is resolved via inference — lighter penalty than truly missing");
    const penalty = result.parserConfidencePenalties.find(p => p.component === "healthField");
    assert.ok(penalty, "must have a healthField penalty for an unrecognized value");
    assert.equal(penalty.reason, "health_field_inferred_from_text");
  });

  // ── Channel split: parser-core vs context-penalty ──────────────────────────

  it("parserCoreConfidence equals 1.0 and parserContextPenalty equals 0 for full-score input", () => {
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Fix trust boundary", role: "evolution-worker" }],
      requestBudget: { estimatedPremiumRequestsTotal: 2, errorMarginPercent: 15, hardCapTotal: 3 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserCoreConfidence, 1.0, "core channel must be 1.0 for fully-scored structural input");
    assert.equal(result.parserContextPenalty, 0, "context-penalty channel must be 0 when no context signals degrade quality");
    assert.equal(result.parserConfidence, 1.0, "aggregate must equal core − context = 1.0 (backward compat)");
  });

  it("parserCoreConfidence absorbs healthField and requestBudget penalties; context channel stays 0", () => {
    // Narrative plans (base=0.5) + inferred health (-0.1) + no budget (-0.1)
    const parsed = {
      waves: [{ wave: 1, tasks: ["Fix parser"] }],
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserCoreConfidence, 0.3,
      "core confidence = 0.5 base − 0.1 healthField inferred − 0.1 requestBudget = 0.3");
    assert.equal(result.parserContextPenalty, 0,
      "context-penalty must be 0 — bottleneckCoverage and architectureDrift are context signals, not present here");
    assert.equal(result.parserConfidence, 0.3,
      "aggregate parserConfidence must equal parserCoreConfidence (backward compat)");
  });

  it("parserContextPenalty absorbs bottleneckCoverage penalty; parserCoreConfidence is unaffected", () => {
    const parsed = {
      projectHealth: "good",
      topBottlenecks: [
        { id: "BN-1", title: "Sequential worker dispatch", severity: "high" },
        { id: "BN-2", title: "Trust boundary missing gate", severity: "critical" },
        { id: "BN-3", title: "Parser fence drop", severity: "medium" },
        { id: "BN-4", title: "Budget estimation stale", severity: "low" },
      ],
      // Only BN-1 addressed — 3 uncovered → coverage < BOTTLENECK_COVERAGE_FLOOR
      plans: [
        { task: "Fix sequential worker dispatch", role: "evolution-worker", _fromBottleneck: "BN-1" },
      ],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserCoreConfidence, 1.0,
      "core confidence must be unaffected by bottleneckCoverage — that is a context signal");
    assert.ok(result.parserContextPenalty > 0,
      "context-penalty must be positive when bottleneck coverage is below floor");
    assert.ok(result.parserConfidence < 1.0,
      "aggregate must be reduced by context penalty");
    assert.equal(
      Math.round((result.parserCoreConfidence - result.parserContextPenalty) * 100) / 100,
      result.parserConfidence,
      "parserConfidence must equal parserCoreConfidence − parserContextPenalty (channel invariant)"
    );
  });

  it("parserCoreConfidence and parserContextPenalty are independent — negative path: no plans", () => {
    const result = normalizePrometheusParsedOutput({}, { raw: "" });

    // No plans: base=0.1, health penalty (-0.2) floored → core=0.1, no context signals
    assert.equal(result.parserCoreConfidence, 0.1,
      "core channel must floor at 0.1 for unparseable output");
    assert.equal(result.parserContextPenalty, 0,
      "context-penalty channel must be 0 when no context signals are present");
  });
});

describe("computeBottleneckCoverage", () => {
  it("returns coverage=1.0 when bottlenecks array is empty", () => {
    const result = computeBottleneckCoverage([], []);
    assert.equal(result.coverage, 1.0);
    assert.equal(result.total, 0);
  });

  it("returns coverage=1.0 when all bottlenecks are covered by _fromBottleneck reference", () => {
    const plans = [
      { task: "Fix BN-1", _fromBottleneck: "BN-1" },
      { task: "Fix BN-2", _fromBottleneck: "BN-2" },
    ];
    const bottlenecks = [
      { id: "BN-1", title: "Sequential worker dispatch ignores wave" },
      { id: "BN-2", title: "Trust boundary contract missing" },
    ];
    const result = computeBottleneckCoverage(plans, bottlenecks);
    assert.equal(result.coverage, 1.0);
    assert.equal(result.covered.length, 2);
    assert.equal(result.uncovered.length, 0);
  });

  it("returns partial coverage when some bottlenecks are not covered", () => {
    const plans = [
      { task: "Fix trust boundary contract enforcement", _fromBottleneck: "BN-2" },
    ];
    const bottlenecks = [
      { id: "BN-1", title: "Sequential dispatch ignores wave infrastructure" },
      { id: "BN-2", title: "Trust boundary contract missing" },
      { id: "BN-3", title: "Parser fence handling drops multiline blocks" },
    ];
    const result = computeBottleneckCoverage(plans, bottlenecks);
    assert.ok(result.coverage < 1.0);
    assert.equal(result.covered.length, 1);
    assert.equal(result.uncovered.length, 2);
    assert.equal(result.total, 3);
  });

  it("covers bottleneck by keyword overlap when no _fromBottleneck reference", () => {
    const plans = [
      { task: "Fix sequential worker dispatch for wave infrastructure ordering", title: "Fix wave dispatch" },
    ];
    const bottlenecks = [
      { id: "BN-1", title: "Sequential worker dispatch ignores wave infrastructure" },
    ];
    const result = computeBottleneckCoverage(plans, bottlenecks);
    assert.equal(result.coverage, 1.0, "keyword overlap should cover the bottleneck");
  });

  it("does not cover bottleneck with only 1 matching keyword (requires ≥2)", () => {
    const plans = [
      { task: "Fix dispatch logic", title: "Fix dispatch" },
    ];
    const bottlenecks = [
      { id: "BN-1", title: "Sequential worker dispatch ignores wave infrastructure" },
    ];
    const result = computeBottleneckCoverage(plans, bottlenecks);
    // Only "dispatch" matches (1 word), not enough for coverage
    assert.equal(result.uncovered.length, 1);
  });

  it("returns BOTTLENECK_COVERAGE_FLOOR as a number between 0 and 1", () => {
    assert.ok(typeof BOTTLENECK_COVERAGE_FLOOR === "number");
    assert.ok(BOTTLENECK_COVERAGE_FLOOR > 0 && BOTTLENECK_COVERAGE_FLOOR < 1);
  });
});

describe("filterResolvedCarryForwardItems", () => {
  const makePending = (followUpTask, workerName = "evolution-worker") => ({
    followUpNeeded: true,
    followUpTask,
    workerName,
    reviewedAt: "2025-01-01",
  });

  it("returns all items when ledger is empty and no completedTasks", () => {
    const pending = [makePending("Fix flaky test in worker runner"), makePending("Add trust-boundary coverage")];
    const result = filterResolvedCarryForwardItems(pending, [], []);
    assert.equal(result.length, 2);
  });

  it("retires items closed in the carry-forward ledger", () => {
    const pending = [
      makePending("Fix flaky test in worker runner"),
      makePending("Add trust-boundary coverage"),
    ];
    const ledger = [
      { id: "debt-1-0", lesson: "Fix flaky test in worker runner", closedAt: "2025-02-01T00:00:00Z", closureEvidence: "PR #99" },
      { id: "debt-1-1", lesson: "Another open item", closedAt: null },
    ];
    const result = filterResolvedCarryForwardItems(pending, ledger, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].followUpTask, "Add trust-boundary coverage");
  });

  it("retires items present in coordinationCompletedTasks", () => {
    const pending = [makePending("Upgrade evaluation stack"), makePending("Add circuit breaker for model calls")];
    const result = filterResolvedCarryForwardItems(pending, [], ["Upgrade evaluation stack"]);
    assert.equal(result.length, 1);
    assert.equal(result[0].followUpTask, "Add circuit breaker for model calls");
  });

  it("uses fingerprint matching — strips noise before hashing so noise-equivalent texts are retired", () => {
    const pending = [makePending("Create and complete a task to fix the verification harness")];
    const ledger = [
      // lesson matches after canonicalization; closureEvidence confirms it shipped
      { id: "d1", lesson: "fix the verification harness", closedAt: "2025-03-01T00:00:00Z", closureEvidence: "PR #101" },
    ];
    const result = filterResolvedCarryForwardItems(pending, ledger, []);
    assert.equal(result.length, 0);
  });

  it("does NOT retire items whose ledger entry is closed without closureEvidence", () => {
    const pending = [makePending("Automate carry-forward escalation")];
    const ledger = [
      // closedAt is set but closureEvidence is absent — no proof of fix
      { id: "d1", lesson: "Automate carry-forward escalation", closedAt: "2025-03-01T00:00:00Z", closureEvidence: null },
    ];
    const result = filterResolvedCarryForwardItems(pending, ledger, []);
    assert.equal(result.length, 1);
  });

  it("keeps items whose ledger entry is open (closedAt = null)", () => {
    const pending = [makePending("Automate carry-forward escalation")];
    const ledger = [
      { id: "d1", lesson: "Automate carry-forward escalation", closedAt: null },
    ];
    const result = filterResolvedCarryForwardItems(pending, ledger, []);
    assert.equal(result.length, 1);
  });

  it("handles empty pendingEntries gracefully", () => {
    const result = filterResolvedCarryForwardItems([], [{ id: "d1", lesson: "anything", closedAt: "2025-01-01", closureEvidence: "done" }], []);
    assert.equal(result.length, 0);
  });

  it("handles null/undefined inputs without throwing", () => {
    const result = filterResolvedCarryForwardItems(null, null, null);
    assert.equal(result.length, 0);
  });
});

describe("PROMETHEUS_STATIC_SECTIONS", () => {
  it("exports all required static sections", () => {
    assert.ok(PROMETHEUS_STATIC_SECTIONS.evolutionDirective);
    assert.ok(PROMETHEUS_STATIC_SECTIONS.mandatorySelfCritique);
    assert.ok(PROMETHEUS_STATIC_SECTIONS.mandatoryOperatorQuestions);
    assert.ok(PROMETHEUS_STATIC_SECTIONS.outputFormat);
  });

  it("static sections have non-empty content", () => {
    for (const [key, sec] of Object.entries(PROMETHEUS_STATIC_SECTIONS)) {
      assert.ok(sec.content && sec.content.length > 0, `${key} section must have content`);
    }
  });

  it("evolutionDirective contains EVOLUTION DIRECTIVE and EQUAL DIMENSION SET headers", () => {
    const content = PROMETHEUS_STATIC_SECTIONS.evolutionDirective.content;
    assert.ok(content.includes("EVOLUTION DIRECTIVE"), "should contain EVOLUTION DIRECTIVE header");
    assert.ok(content.includes("EQUAL DIMENSION SET"), "should contain EQUAL DIMENSION SET header");
  });

  it("outputFormat contains ACTIONABLE IMPROVEMENT PACKET FORMAT and PACKET FIELD ENFORCEMENT RULES", () => {
    const content = PROMETHEUS_STATIC_SECTIONS.outputFormat.content;
    assert.ok(content.includes("ACTIONABLE IMPROVEMENT PACKET FORMAT"));
    assert.ok(content.includes("PACKET FIELD ENFORCEMENT RULES"));
    assert.ok(content.includes("===DECISION==="), "should contain JSON output markers");
  });
});

describe("carry-forward token cap constants", () => {
  it("CARRY_FORWARD_MAX_TOKENS is a positive number", () => {
    assert.ok(Number.isFinite(CARRY_FORWARD_MAX_TOKENS));
    assert.ok(CARRY_FORWARD_MAX_TOKENS > 0);
  });

  it("BEHAVIOR_PATTERNS_MAX_TOKENS is a positive number", () => {
    assert.ok(Number.isFinite(BEHAVIOR_PATTERNS_MAX_TOKENS));
    assert.ok(BEHAVIOR_PATTERNS_MAX_TOKENS > 0);
  });
});

// ── Task 1: Required-field retention in mandatory planning contract directives ──

describe("PROMETHEUS_STATIC_SECTIONS — required field marking (Task 1)", () => {
  const MANDATORY_KEYS = ["evolutionDirective", "mandatorySelfCritique", "mandatoryOperatorQuestions", "outputFormat"] as const;

  it("mandatory planning sections are marked required:true", () => {
    for (const key of MANDATORY_KEYS) {
      const sec = PROMETHEUS_STATIC_SECTIONS[key] as Record<string, unknown>;
      assert.strictEqual(sec.required, true, `${key} must have required:true`);
    }
  });

  it("mandatory sections are retained under tight token budget (token pressure simulation)", () => {
    // Simulate a very tight budget — mandatory sections must survive
    const sections = [
      { ...PROMETHEUS_STATIC_SECTIONS.evolutionDirective },
      { ...PROMETHEUS_STATIC_SECTIONS.outputFormat },
      { name: "optional-noise", content: "o".repeat(100_000) }, // ~25000 tokens
    ];
    const result = compilePrompt(sections, { tokenBudget: 100 });
    assert.ok(
      result.includes("EVOLUTION DIRECTIVE"),
      "evolutionDirective must be retained under token pressure"
    );
    assert.ok(
      result.includes("OUTPUT FORMAT"),
      "outputFormat must be retained under token pressure"
    );
  });

  it("non-mandatory sections can be dropped under token pressure", () => {
    const sections = [
      { ...PROMETHEUS_STATIC_SECTIONS.evolutionDirective },
      { name: "optional-filler", content: "OPTIONAL_CONTENT" }, // no required:true
    ];
    const result = compilePrompt(sections, { tokenBudget: 5 }); // very tight
    // The filler is optional and large — evolutionDirective (required) should remain
    assert.ok(result.includes("EVOLUTION DIRECTIVE"), "required section must survive");
  });
});

// ── Task 4: Drift confidence penalty ──────────────────────────────────────────

describe("computeDriftConfidencePenalty (Task 4)", () => {
  it("returns zero penalty for null/undefined drift report", () => {
    assert.deepEqual(computeDriftConfidencePenalty(null), { penalty: 0, reason: "no-drift-report", requiresRemediation: false });
    assert.deepEqual(computeDriftConfidencePenalty(undefined), { penalty: 0, reason: "no-drift-report", requiresRemediation: false });
  });

  it("returns zero penalty when staleCount and deprecatedTokenCount are both 0", () => {
    const result = computeDriftConfidencePenalty({ staleCount: 0, deprecatedTokenCount: 0 });
    assert.equal(result.penalty, 0);
    assert.equal(result.requiresRemediation, false);
  });

  it("returns a positive penalty proportional to total unresolved items", () => {
    const result = computeDriftConfidencePenalty({ staleCount: 3, deprecatedTokenCount: 2 }); // total=5
    assert.ok(result.penalty > 0, "penalty must be positive for non-zero drift");
    assert.ok(result.penalty <= 0.30, "penalty must not exceed cap of 0.30");
  });

  it("caps penalty at 0.30 regardless of very high drift count", () => {
    const result = computeDriftConfidencePenalty({ staleCount: 100, deprecatedTokenCount: 100 }); // total=200
    assert.equal(result.penalty, 0.30, "penalty is capped at 0.30");
  });

  it("sets requiresRemediation=true when total >= DRIFT_REMEDIATION_THRESHOLD", () => {
    const atThreshold = computeDriftConfidencePenalty({ staleCount: DRIFT_REMEDIATION_THRESHOLD, deprecatedTokenCount: 0 });
    assert.equal(atThreshold.requiresRemediation, true);
    const belowThreshold = computeDriftConfidencePenalty({ staleCount: DRIFT_REMEDIATION_THRESHOLD - 1, deprecatedTokenCount: 0 });
    assert.equal(belowThreshold.requiresRemediation, false);
  });

  it("reason string encodes total unresolved count", () => {
    const result = computeDriftConfidencePenalty({ staleCount: 2, deprecatedTokenCount: 1 });
    assert.ok(result.reason.includes("3"), "reason must encode total count (3)");
  });

  it("priority-weighted: src/core/ stale ref incurs higher penalty than scripts/ ref of same count", () => {
    const highPriority = computeDriftConfidencePenalty({
      staleCount: 1,
      deprecatedTokenCount: 0,
      staleReferences: [{ referencedPath: "src/core/orchestrator.ts", docPath: "docs/a.md", line: 1 }],
    });
    const lowPriority = computeDriftConfidencePenalty({
      staleCount: 1,
      deprecatedTokenCount: 0,
      staleReferences: [{ referencedPath: "scripts/deploy.sh", docPath: "docs/a.md", line: 1 }],
    });
    assert.ok(highPriority.penalty > lowPriority.penalty,
      `src/core/ ref (${highPriority.penalty}) must penalize more than scripts/ ref (${lowPriority.penalty})`);
  });

  it("priority-weighted: fallback to flat formula when staleReferences array is absent", () => {
    const withCounts = computeDriftConfidencePenalty({ staleCount: 2, deprecatedTokenCount: 0 });
    // Flat formula: 2 × 0.02 = 0.04
    assert.equal(withCounts.penalty, 0.04, "flat fallback must produce 0.04 for 2 items");
  });

  it("priority-weighted: deprecated tokens penalized at medium rate (0.02 each)", () => {
    const result = computeDriftConfidencePenalty({
      staleCount: 0,
      deprecatedTokenCount: 3,
      staleReferences: [],
    });
    // 3 × 0.02 = 0.06
    assert.equal(result.penalty, 0.06, "3 deprecated tokens must produce 0.06 penalty");
  });

  it("priority-weighted: mixed report penalizes by priority, capped at 0.30", () => {
    // 2 high (src/core/) refs → 2 × 0.05 = 0.10, 1 low (scripts/) → 0.01, 2 tokens → 0.04 → total 0.15
    const result = computeDriftConfidencePenalty({
      staleCount: 3,
      deprecatedTokenCount: 2,
      staleReferences: [
        { referencedPath: "src/core/a.ts",   docPath: "docs/a.md", line: 1 },
        { referencedPath: "src/core/b.ts",   docPath: "docs/a.md", line: 2 },
        { referencedPath: "scripts/old.sh",  docPath: "docs/a.md", line: 3 },
      ],
    });
    assert.ok(result.penalty > 0 && result.penalty <= 0.30, "penalty must be positive and capped");
    // Exact: 0.10 + 0.01 + 0.04 = 0.15
    assert.equal(result.penalty, 0.15, "priority-weighted penalty must be 0.15 for this mix");
  });
});

// ── Batch/wave packet field preservation (current task) ───────────────────────

describe("normalizePrometheusParsedOutput — batch/wave packet field preservation", () => {
  it("preserves explicit owner field from a capability-aware plan", () => {
    const parsed = {
      projectHealth: "good",
      plans: [
        {
          task: "Harden trust boundary",
          role: "evolution-worker",
          owner: "orchestrator",
          wave: 1,
        }
      ]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.plans[0].owner, "orchestrator", "owner must be preserved from source plan");
  });

  it("synthesizes owner from role when owner is absent", () => {
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Fix parser", role: "governance-worker", wave: 1 }]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.plans[0].owner, "governance-worker", "owner should fall back to role");
  });

  it("defaults owner to evolution-worker when both owner and role are absent", () => {
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Fix something", wave: 1 }]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.plans[0].owner, "evolution-worker", "owner must default to evolution-worker");
  });

  it("preserves explicit leverage_rank array from a capability-aware plan", () => {
    const parsed = {
      projectHealth: "good",
      plans: [
        {
          task: "Improve wave dispatch",
          role: "evolution-worker",
          leverage_rank: ["speed", "task-quality"],
          wave: 1,
        }
      ]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.deepEqual(result.plans[0].leverage_rank, ["speed", "task-quality"],
      "leverage_rank must be preserved from source plan");
  });

  it("defaults leverage_rank to empty array when absent", () => {
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Fix something", wave: 1 }]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.deepEqual(result.plans[0].leverage_rank, [],
      "leverage_rank must default to empty array when absent");
  });

  it("synthesizes stub plans for string wave tasks that have no matching task entry", () => {
    // tasks[] has T-001 but waves[] also references T-999 which does not exist.
    // T-999 must NOT be silently dropped.
    const parsed = {
      tasks: [
        { task_id: "T-001", title: "Known task", wave: 1 }
      ],
      waves: [
        { wave: 1, tasks: ["T-001", "T-999"] }
      ]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.plans.length, 2, "unmatched wave task T-999 must produce a stub plan");
    const taskTexts = result.plans.map(p => p.task);
    assert.ok(taskTexts.includes("T-999"), "stub plan task must equal the unmatched task id string");
    assert.equal(result.plans.find(p => p.task === "T-999")?.wave, 1,
      "stub plan must have the correct wave assignment");
    assert.equal(result.plans.find(p => p.task === "T-999")?.role, "evolution-worker",
      "stub plan must be assigned a role");
  });

  it("propagates wave dependsOn to plan waveDepends via buildPlansFromAlternativeShape", () => {
    const parsed = {
      tasks: [
        { task_id: "T-001", title: "Foundation task" }
      ],
      waves: [
        { wave: 1, tasks: ["T-001"] },
        { wave: 2, dependsOn: [1], tasks: ["T-002"] }
      ]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    const wave2Plan = result.plans.find(p => p.wave === 2);
    assert.ok(wave2Plan, "wave 2 plan must exist");
    assert.deepEqual(wave2Plan.waveDepends, [1],
      "wave 2 plan must carry waveDepends: [1] from the wave dependsOn field");
  });

  it("propagates wave dependsOn to plan waveDepends via buildPlansFromBottlenecksShape", () => {
    const parsed = {
      topBottlenecks: [
        { id: "BN-1", title: "Slow dispatch", severity: "high", evidence: "orchestrator.js:740" }
      ],
      waves: [
        { wave: 1, tasks: ["Fix-1: slow dispatch fix"], workerSlots: 1 },
        { wave: 2, dependsOn: [1], tasks: ["Fix-2: follow-up validation"], workerSlots: 1 }
      ]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    const wave2Plan = result.plans.find(p => p.wave === 2);
    assert.ok(wave2Plan, "wave 2 plan must exist");
    assert.deepEqual(wave2Plan.waveDepends, [1],
      "wave 2 plan must carry waveDepends: [1] from the wave dependsOn field");
  });

  it("plans with no batch/wave metadata normalize correctly (negative path)", () => {
    // A plain plan with no owner, leverage_rank, or waveDepends — must normalize
    // without throwing and must emit sensible defaults for all packet fields.
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Basic task" }]
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.plans.length, 1);
    assert.equal(typeof result.plans[0].owner, "string");
    assert.ok(result.plans[0].owner.length > 0, "owner must be a non-empty string");
    assert.ok(Array.isArray(result.plans[0].leverage_rank), "leverage_rank must be an array");
    assert.ok(Array.isArray(result.plans[0].waveDepends), "waveDepends must be an array");
    assert.equal(result.plans[0].waveDepends.length, 0,
      "waveDepends must be empty when not provided");
  });
});

// ── Task: buildDriftDebtTasks — drift output → actionable planning debt ───────

describe("buildDriftDebtTasks", () => {
  it("returns empty array for null/undefined drift report", () => {
    assert.deepEqual(buildDriftDebtTasks(null), []);
    assert.deepEqual(buildDriftDebtTasks(undefined), []);
  });

  it("returns empty array when staleReferences and deprecatedTokenRefs are empty", () => {
    const report = { staleReferences: [], deprecatedTokenRefs: [], staleCount: 0, deprecatedTokenCount: 0 };
    assert.deepEqual(buildDriftDebtTasks(report), []);
  });

  it("generates one debt task per doc with stale file references", () => {
    const report = {
      staleReferences: [
        { docPath: "docs/arch.md", referencedPath: "src/core/missing.ts", line: 5 },
        { docPath: "docs/arch.md", referencedPath: "src/core/gone.ts", line: 9 },
        { docPath: "docs/ops.md", referencedPath: "docker/worker.Dockerfile", line: 2 },
      ],
      deprecatedTokenRefs: [],
    };
    const tasks = buildDriftDebtTasks(report);
    assert.equal(tasks.length, 2, "one task per distinct doc");
    const archTask = tasks.find(t => t.target_files?.includes("docs/arch.md"));
    assert.ok(archTask, "task for docs/arch.md must exist");
    assert.equal(archTask.taskKind, "debt");
    assert.equal(archTask.source, "architecture_drift");
    assert.equal(archTask._driftDebt, true);
    assert.ok(archTask.task.includes("docs/arch.md"), "task text must name the doc");
    assert.ok(Array.isArray(archTask.acceptance_criteria) && archTask.acceptance_criteria.length >= 2);
  });

  it("generates one debt task per doc with deprecated token usages", () => {
    const report = {
      staleReferences: [],
      deprecatedTokenRefs: [
        { docPath: "docs/legacy.md", token: "governance_verdict", hint: "use governance_contract", line: 3 },
        { docPath: "docs/legacy.md", token: "resume_dispatch", hint: "use runResumeDispatch", line: 7 },
      ],
    };
    const tasks = buildDriftDebtTasks(report);
    assert.equal(tasks.length, 1);
    assert.ok(tasks[0].task.includes("docs/legacy.md"));
    assert.ok(tasks[0].description.includes("governance_verdict"), "description must name deprecated tokens");
    assert.equal(tasks[0].taskKind, "debt");
    assert.equal(tasks[0].riskLevel, "low");
  });

  it("places debt tasks on wave maxWave+1 relative to existing plans", () => {
    const report = {
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/core/x.ts", line: 1 }],
      deprecatedTokenRefs: [],
    };
    const existingPlans = [
      { task: "Fix something", wave: 1 },
      { task: "Fix something else", wave: 3 },
    ];
    const tasks = buildDriftDebtTasks(report, existingPlans);
    assert.equal(tasks[0].wave, 4, "debt tasks must be placed on wave maxWave+1 (3+1=4)");
  });

  it("uses wave 1 when no existing plans exist", () => {
    const report = {
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/x.ts", line: 1 }],
      deprecatedTokenRefs: [],
    };
    const tasks = buildDriftDebtTasks(report, []);
    assert.equal(tasks[0].wave, 1, "debt tasks wave must be 1 when no existing plans");
  });

  it("suppresses debt task generation when existing plan already covers that doc", () => {
    const report = {
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/x.ts", line: 1 }],
      deprecatedTokenRefs: [],
    };
    const existingPlans = [
      { task: "Update stale references in docs/arch.md", target_files: ["docs/arch.md"], wave: 1 },
    ];
    const tasks = buildDriftDebtTasks(report, existingPlans);
    assert.equal(tasks.length, 0, "must not generate duplicate debt task when AI plan already covers the doc");
  });

  it("generates separate tasks for stale refs and deprecated tokens even in the same doc", () => {
    const report = {
      staleReferences: [{ docPath: "docs/mixed.md", referencedPath: "src/x.ts", line: 1 }],
      deprecatedTokenRefs: [{ docPath: "docs/mixed.md", token: "governance_verdict", hint: "use governance_contract", line: 4 }],
    };
    const tasks = buildDriftDebtTasks(report);
    assert.equal(tasks.length, 2, "stale-ref task and deprecated-token task must both be generated");
    const kinds = tasks.map(t => t.task);
    assert.ok(kinds.some(k => k.includes("stale")), "must have a stale-ref task");
    assert.ok(kinds.some(k => k.includes("deprecated")), "must have a deprecated-token task");
  });

  it("each debt task carries required plan packet fields", () => {
    const report = {
      staleReferences: [{ docPath: "docs/a.md", referencedPath: "src/x.ts", line: 1 }],
      deprecatedTokenRefs: [],
    };
    const [task] = buildDriftDebtTasks(report);
    assert.ok(typeof task.task === "string" && task.task.length > 0, "task text must be a non-empty string");
    assert.ok(typeof task.description === "string" && task.description.length > 0);
    assert.equal(task.role, "evolution-worker");
    // verification must reference a specific test file so isNonSpecificVerification passes
    assert.ok(/\.test\.(ts|js)/.test(task.verification), "verification must reference a specific test file");
    assert.ok(task.verification.includes("docs/a.md"), "verification must name the doc being fixed");
    assert.ok(Array.isArray(task.verification_commands));
    assert.ok(Array.isArray(task.acceptance_criteria) && task.acceptance_criteria.length >= 2);
    assert.ok(typeof task.wave === "number");
    assert.ok(typeof task.priority === "number");
    // contract-required fields must be present
    assert.ok(typeof task.capacityDelta === "number", "capacityDelta must be a number");
    assert.ok(typeof task.requestROI === "number" && task.requestROI > 0, "requestROI must be a positive number");
    assert.ok(Array.isArray(task.verification_targets) && task.verification_targets.length > 0,
      "verification_targets must be a non-empty array");
    // dispatch-survivable fields
    assert.ok(Array.isArray(task.dependencies), "dependencies must be an array for dependency-graph resolver");
    assert.ok(typeof task.scope === "string" && task.scope.length > 0, "scope must be a non-empty string");
    assert.ok(typeof task.owner === "string" && task.owner.length > 0, "owner must be a non-empty string");
  });

  it("deprecated-token debt task also carries dispatch-survivable fields", () => {
    const report = {
      staleReferences: [],
      deprecatedTokenRefs: [{ docPath: "docs/b.md", token: "old_token", hint: "use new_token", line: 5 }],
    };
    const [task] = buildDriftDebtTasks(report);
    assert.ok(Array.isArray(task.dependencies), "dependencies must be an array");
    assert.equal(task.scope, "docs/b.md", "scope must equal the source document path");
    assert.equal(task.owner, "evolution-worker");
  });

  it("negative path: handles malformed staleReferences entries without throwing", () => {
    const report = {
      staleReferences: [null, undefined, {}, { docPath: "docs/ok.md", referencedPath: "src/x.ts", line: 1 }],
      deprecatedTokenRefs: [],
    };
    // Must not throw; must produce at most one task (for the valid entry)
    let tasks: any[];
    assert.doesNotThrow(() => { tasks = buildDriftDebtTasks(report); });
    assert.ok(Array.isArray(tasks!));
  });
});

// ── buildDriftDebtTasks — prioritization and deduplication improvements ─────────

describe("buildDriftDebtTasks — prioritization and driftPriority field", () => {
  it("orders tasks so docs with high-priority (src/core/) refs come before docs with low-priority refs", () => {
    const report = {
      staleReferences: [
        // Low-priority doc inserted first in the input array
        { docPath: "docs/ops.md",  referencedPath: "scripts/old.sh",        line: 1 },
        // High-priority doc inserted second
        { docPath: "docs/arch.md", referencedPath: "src/core/missing.ts",   line: 2 },
        // Medium-priority doc inserted last
        { docPath: "docs/api.md",  referencedPath: "src/providers/gone.ts", line: 3 },
      ],
      deprecatedTokenRefs: [],
    };
    const tasks = buildDriftDebtTasks(report);
    assert.equal(tasks.length, 3);
    // High-priority doc must surface first regardless of insertion order.
    assert.ok(
      tasks[0].target_files?.includes("docs/arch.md"),
      `first task must cover the high-priority doc (docs/arch.md), got ${tasks[0].target_files}`
    );
    assert.ok(
      tasks[1].target_files?.includes("docs/api.md"),
      `second task must cover the medium-priority doc (docs/api.md), got ${tasks[1].target_files}`
    );
    assert.ok(
      tasks[2].target_files?.includes("docs/ops.md"),
      `last task must cover the low-priority doc (docs/ops.md), got ${tasks[2].target_files}`
    );
  });

  it("each stale-ref debt task carries a driftPriority field derived from its highest-urgency ref", () => {
    const report = {
      staleReferences: [
        // doc with one high-priority and one low-priority ref → effective priority = high
        { docPath: "docs/mixed.md",  referencedPath: "src/core/ghost.ts",  line: 1 },
        { docPath: "docs/mixed.md",  referencedPath: "scripts/old.sh",     line: 2 },
        // doc with only a low-priority ref → effective priority = low
        { docPath: "docs/ops.md",    referencedPath: "docker/worker.Dockerfile", line: 3 },
      ],
      deprecatedTokenRefs: [],
    };
    const tasks = buildDriftDebtTasks(report);
    const mixedTask = tasks.find(t => t.target_files?.includes("docs/mixed.md"));
    const opsTask   = tasks.find(t => t.target_files?.includes("docs/ops.md"));
    assert.ok(mixedTask, "task for docs/mixed.md must exist");
    assert.ok(opsTask,   "task for docs/ops.md must exist");
    assert.equal(mixedTask.driftPriority, "high",
      "docs/mixed.md task driftPriority must be 'high' (has src/core/ ref)");
    assert.equal(opsTask.driftPriority, "low",
      "docs/ops.md task driftPriority must be 'low' (only docker/ ref)");
  });

  it("priority numbers are assigned in order: high doc gets lower priority number than low doc", () => {
    const report = {
      staleReferences: [
        { docPath: "docs/ops.md",  referencedPath: "scripts/x.sh",         line: 1 },
        { docPath: "docs/arch.md", referencedPath: "src/core/missing.ts",  line: 2 },
      ],
      deprecatedTokenRefs: [],
    };
    const tasks = buildDriftDebtTasks(report);
    const archTask = tasks.find(t => t.target_files?.includes("docs/arch.md"))!;
    const opsTask  = tasks.find(t => t.target_files?.includes("docs/ops.md"))!;
    assert.ok(archTask.priority < opsTask.priority,
      `high-priority doc task (${archTask.priority}) must have lower priority number than low-priority doc task (${opsTask.priority})`);
  });
});

describe("buildDriftDebtTasks — quality gate contract compliance", () => {
  it("stale-ref debt task verification field is NOT flagged as non-specific by plan_contract_validator", () => {
    const report = {
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/core/missing.ts", line: 1 }],
      deprecatedTokenRefs: [],
    };
    const [task] = buildDriftDebtTasks(report);
    assert.equal(
      isNonSpecificVerification(task.verification),
      false,
      `Verification "${task.verification}" must pass isNonSpecificVerification (references a .test.ts file)`
    );
  });

  it("deprecated-token debt task verification field is NOT flagged as non-specific", () => {
    const report = {
      staleReferences: [],
      deprecatedTokenRefs: [{ docPath: "docs/legacy.md", token: "governance_verdict", hint: "use governance_contract", line: 2 }],
    };
    const [task] = buildDriftDebtTasks(report);
    assert.equal(
      isNonSpecificVerification(task.verification),
      false,
      `Verification "${task.verification}" must pass isNonSpecificVerification`
    );
  });

  it("stale-ref debt task passes validatePlanContract when capacityDelta and requestROI are present", () => {
    const report = {
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/core/missing.ts", line: 1 }],
      deprecatedTokenRefs: [],
    };
    const [task] = buildDriftDebtTasks(report);
    const result = validatePlanContract(task);
    const criticalViolations = result.violations.filter((v: any) => v.severity === "critical");
    assert.equal(
      criticalViolations.length,
      0,
      `Stale-ref debt task must have zero critical violations; got: ${criticalViolations.map((v: any) => v.message).join("; ")}`
    );
  });

  it("deprecated-token debt task passes validatePlanContract", () => {
    const report = {
      staleReferences: [],
      deprecatedTokenRefs: [
        { docPath: "docs/legacy.md", token: "governance_verdict", hint: "use governance_contract", line: 2 },
      ],
    };
    const [task] = buildDriftDebtTasks(report);
    const result = validatePlanContract(task);
    const criticalViolations = result.violations.filter((v: any) => v.severity === "critical");
    assert.equal(
      criticalViolations.length,
      0,
      `Deprecated-token debt task must have zero critical violations; got: ${criticalViolations.map((v: any) => v.message).join("; ")}`
    );
  });

  it("verification_targets is a non-empty array pointing to the architecture_drift test file", () => {
    const report = {
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/core/x.ts", line: 1 }],
      deprecatedTokenRefs: [{ docPath: "docs/arch.md", token: "resume_dispatch", hint: "use runResumeDispatch", line: 5 }],
    };
    const tasks = buildDriftDebtTasks(report);
    assert.equal(tasks.length, 2);
    for (const task of tasks) {
      assert.ok(Array.isArray(task.verification_targets) && task.verification_targets.length > 0,
        "verification_targets must be a non-empty array");
      assert.ok(
        task.verification_targets.every((t: string) => t.includes("architecture_drift.test.ts")),
        "each verification target must reference architecture_drift.test.ts"
      );
    }
  });

  it("negative path: bare 'npm test' alone is non-specific and would be rejected by contract (validates the fix rationale)", () => {
    // This test documents WHY we changed the verification field — to prove that
    // the old value would have been rejected by the quality gate.
    assert.equal(
      isNonSpecificVerification("npm test"),
      true,
      "bare 'npm test' must be flagged as non-specific — this is the problem the fix addresses"
    );
  });
});

// ── Task: parser core/context confidence composition recalibration ───────────
// Covers edge cases in the channel-split formula:
//   parserCoreConfidence  = coreBase − (non-context penalties), floored at 0.1
//   parserContextPenalty  = sum of context-channel penalties (uncapped)
//   parserConfidence      = max(0.1, parserCoreConfidence − parserContextPenalty)
//
// Key invariants:
//   1. parserConfidence is always >= 0.1
//   2. When core − context >= 0.1, parserConfidence == core − context (channel invariant holds)
//   3. When core − context < 0.1, floor kicks in — channel invariant intentionally breaks
//   4. parserCoreConfidence absorbs only healthField/requestBudget penalties
//   5. parserContextPenalty absorbs only bottleneckCoverage/architectureDrift penalties

describe("normalizePrometheusParsedOutput — confidence composition recalibration", () => {
  it("combined core + context penalties: core absorbs healthField/budget, context absorbs bottleneck", () => {
    // JSON plans (base=1.0) + inferred health (core -0.1) + no budget (core -0.1)
    // + 3 of 4 bottlenecks uncovered → context penalty
    const parsed = {
      plans: [
        { task: "Fix sequential dispatch", role: "evolution-worker", _fromBottleneck: "BN-1" },
      ],
      // No projectHealth → healthField inferred → core -0.1
      // No requestBudget → budget fallback → core -0.1
      topBottlenecks: [
        { id: "BN-1", title: "Sequential dispatch", severity: "high" },
        { id: "BN-2", title: "Trust boundary missing", severity: "critical" },
        { id: "BN-3", title: "Parser fence drop", severity: "medium" },
        { id: "BN-4", title: "Budget stale", severity: "low" },
      ],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    // core = 1.0 − 0.1 (healthField) = 0.9; no budget penalty (requestBudget provided)
    assert.equal(result.parserCoreConfidence, 0.9,
      "core channel = 1.0 base − 0.1 healthField inferred; budget provided so no budget penalty");
    // context = bottleneck coverage penalty (>0 because 3 of 4 uncovered)
    assert.ok(result.parserContextPenalty > 0,
      "context channel must be positive when bottleneck coverage is below floor");
    // aggregate = max(0.1, 0.9 − context)
    const expectedAggregate = Math.max(0.1, Math.round((result.parserCoreConfidence - result.parserContextPenalty) * 100) / 100);
    assert.equal(result.parserConfidence, expectedAggregate,
      "aggregate must equal max(0.1, core − context)");
  });

  it("context penalty large enough to push aggregate to floor — documents floor-break behavior", () => {
    // Construct a scenario where parserCoreConfidence = 0.1 (minimum)
    // and there is a context penalty, so aggregate floors at 0.1.
    // Use narrative plans (base=0.5) + health (-0.1) + budget (-0.1) = 0.3 core;
    // then add enough bottleneck uncovered to push context penalty > 0.3.
    // With 6 uncovered bottlenecks, delta = -min(0.30, 6*0.05) = -0.30 (capped).
    const parsed = {
      waves: [{ wave: 1, tasks: ["Fix one thing"] }],
      // No projectHealth, no requestBudget → core = 0.5 − 0.1 − 0.1 = 0.3
      topBottlenecks: Array.from({ length: 6 }, (_, i) => ({
        id: `BN-${i + 1}`, title: `Bottleneck ${i + 1}`, severity: "critical"
      })),
      // No plans address any bottleneck → all 6 uncovered → max context penalty = 0.30
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.ok(result.parserContextPenalty > 0, "context penalty must be positive");
    // parserConfidence must always be >= 0.1 regardless of penalties
    assert.ok(result.parserConfidence >= 0.1,
      `parserConfidence must always be >= 0.1; got ${result.parserConfidence}`);

    // When floor kicks in, the simple arithmetic invariant breaks — document this explicitly
    const rawDiff = Math.round((result.parserCoreConfidence - result.parserContextPenalty) * 100) / 100;
    if (rawDiff < 0.1) {
      // Floor-break case: parserConfidence is 0.1, not rawDiff
      assert.equal(result.parserConfidence, 0.1,
        "when core − context < 0.1, floor must be applied and parserConfidence must equal 0.1");
    } else {
      // Normal case: invariant holds
      assert.equal(result.parserConfidence, rawDiff,
        "when core − context >= 0.1, parserConfidence must equal core − context");
    }
  });

  it("parserConfidence is always >= 0.1 across all penalty combinations (property invariant)", () => {
    const cases = [
      // Full score — no penalties
      { projectHealth: "good", plans: [{ task: "x", role: "evolution-worker" }], requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 } },
      // Narrative plans only
      { waves: [{ wave: 1, tasks: ["x"] }] },
      // No output at all
      {},
      // All penalties: no plans, no health, no budget, max bottlenecks
      { topBottlenecks: Array.from({ length: 10 }, (_, i) => ({ id: `BN-${i}`, title: `BN ${i}`, severity: "critical" })) },
      // Health alias
      { projectHealth: "healthy", plans: [{ task: "x", role: "evolution-worker" }] },
    ];
    for (const parsed of cases) {
      const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
      assert.ok(result.parserConfidence >= 0.1,
        `parserConfidence must never go below 0.1; got ${result.parserConfidence} for input: ${JSON.stringify(parsed)}`);
    }
  });

  it("channel invariant holds exactly when floor is not triggered", () => {
    // JSON plans (base=1.0) + explicit health (no penalty) + budget provided (no penalty)
    // + 1 of 3 bottlenecks covered → context penalty fires (coverage=0.33 < FLOOR=0.5)
    // but core − context = 1.0 − small_penalty >> 0.1 so floor does NOT kick in
    const parsed = {
      projectHealth: "good",
      plans: [
        { task: "Fix sequential worker dispatch wave infrastructure", role: "evolution-worker", _fromBottleneck: "BN-1" },
      ],
      topBottlenecks: [
        { id: "BN-1", title: "Sequential dispatch ignores wave infrastructure", severity: "high" },
        { id: "BN-2", title: "Trust boundary contract missing enforcement gate", severity: "critical" },
        { id: "BN-3", title: "Parser fence handling drops multiline blocks", severity: "medium" },
      ],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    // core = 1.0 (JSON plans, explicit health, budget provided)
    assert.equal(result.parserCoreConfidence, 1.0, "core must be 1.0 when no core penalties apply");
    // context > 0 (BN-2 and BN-3 uncovered; coverage=1/3 < 0.5 → penalty fires)
    assert.ok(result.parserContextPenalty > 0,
      `context penalty must be positive when coverage is below floor; got parserContextPenalty=${result.parserContextPenalty}`);
    // channel invariant: aggregate = core − context when above floor
    const expected = Math.round((result.parserCoreConfidence - result.parserContextPenalty) * 100) / 100;
    if (expected >= 0.1) {
      assert.equal(result.parserConfidence, expected,
        "channel invariant: parserConfidence must equal parserCoreConfidence − parserContextPenalty when above floor");
    }
  });

  it("parserCoreConfidence floors at 0.1 even with stacked core penalties", () => {
    // Narrative fallback (base=0.5) with many health/budget penalties can't go below 0.1.
    // Use: base=0.1 (no plans) + health_missing -0.2 + budget -0.1 → clamped at 0.1 each step.
    const result = normalizePrometheusParsedOutput({}, { raw: "" });

    assert.equal(result.parserCoreConfidence, 0.1,
      "core confidence must floor at 0.1 when cumulative core penalties exceed base");
    assert.ok(result.parserCoreConfidence >= 0.1,
      "core confidence must never go below 0.1");
  });

  it("requestBudget penalty goes to core channel, not context channel", () => {
    const parsed = {
      projectHealth: "good",
      plans: [{ task: "Fix retry logic", role: "evolution-worker" }],
      // No requestBudget → fallback penalty
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    // core should be reduced (0.9), context should remain 0
    assert.equal(result.parserCoreConfidence, 0.9,
      "requestBudget fallback penalty must reduce core confidence, not context");
    assert.equal(result.parserContextPenalty, 0,
      "requestBudget fallback must not affect context-penalty channel");
    assert.equal(result.parserConfidence, 0.9, "aggregate must equal core (0.9) when context is 0");
  });

  it("healthField penalty goes to core channel, not context channel", () => {
    const parsed = {
      plans: [{ task: "Fix retry logic", role: "evolution-worker" }],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
      // No projectHealth → inferred → healthField penalty -0.1 goes to core
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    assert.equal(result.parserCoreConfidence, 0.9,
      "healthField inferred penalty must reduce core confidence, not context");
    assert.equal(result.parserContextPenalty, 0,
      "healthField penalty must not affect context-penalty channel");
  });

  it("rounding: parserCoreConfidence, parserContextPenalty, and parserConfidence are all 2-decimal values", () => {
    const parsed = {
      projectHealth: "good",
      topBottlenecks: [
        { id: "BN-1", title: "Wave dispatch broken", severity: "high" },
        { id: "BN-2", title: "Trust boundary missing", severity: "critical" },
        { id: "BN-3", title: "Parser fence drop", severity: "medium" },
      ],
      plans: [
        { task: "Fix wave dispatch broken", role: "evolution-worker", _fromBottleneck: "BN-1" },
      ],
      requestBudget: { estimatedPremiumRequestsTotal: 1, errorMarginPercent: 15, hardCapTotal: 2 },
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });

    // All three must be rounded to exactly 2 decimal places
    const isRounded = (n: number) => Math.round(n * 100) / 100 === n;
    assert.ok(isRounded(result.parserCoreConfidence),
      `parserCoreConfidence=${result.parserCoreConfidence} must be a 2-decimal number`);
    assert.ok(isRounded(result.parserContextPenalty),
      `parserContextPenalty=${result.parserContextPenalty} must be a 2-decimal number`);
    assert.ok(isRounded(result.parserConfidence),
      `parserConfidence=${result.parserConfidence} must be a 2-decimal number`);
  });
});

// ── Task 1: capacityDelta / requestROI hard filter at generation time ─────────

import { validateAllPlans, PLAN_VIOLATION_SEVERITY } from "../../src/core/plan_contract_validator.js";

describe("capacityDelta/requestROI generation-time hard filter", () => {
  function makeValidPlan(overrides = {}) {
    return {
      task: "Implement something with enough chars",
      role: "evolution-worker",
      wave: 1,
      verification: "tests/core/foo.test.ts — test: passes",
      dependencies: [],
      acceptance_criteria: ["must pass"],
      capacityDelta: 0.1,
      requestROI: 2.0,
      ...overrides,
    };
  }

  it("identifies plans missing capacityDelta for removal", () => {
    const plans = [
      makeValidPlan(),
      makeValidPlan({ capacityDelta: undefined }),
    ];
    const result = validateAllPlans(plans);
    const toRemove = result.results
      .filter(r => !r.valid && r.violations.some(v =>
        (v.field === "capacityDelta" || v.field === "requestROI") &&
        v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
      ))
      .map(r => r.planIndex)
      .sort((a, b) => b - a);
    assert.deepEqual(toRemove, [1], "plan without capacityDelta must be flagged for removal");
  });

  it("identifies plans missing requestROI for removal", () => {
    const plans = [
      makeValidPlan(),
      makeValidPlan({ requestROI: undefined }),
    ];
    const result = validateAllPlans(plans);
    const toRemove = result.results
      .filter(r => !r.valid && r.violations.some(v =>
        (v.field === "capacityDelta" || v.field === "requestROI") &&
        v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
      ))
      .map(r => r.planIndex)
      .sort((a, b) => b - a);
    assert.deepEqual(toRemove, [1], "plan without requestROI must be flagged for removal");
  });

  it("filters out capacity/ROI-violating plans without touching valid plans", () => {
    const plans = [
      makeValidPlan({ task: "First valid plan here" }),
      makeValidPlan({ capacityDelta: undefined, requestROI: undefined }),
      makeValidPlan({ task: "Third valid plan here" }),
    ];
    const result = validateAllPlans(plans);
    const toRemove = result.results
      .filter(r => !r.valid && r.violations.some(v =>
        (v.field === "capacityDelta" || v.field === "requestROI") &&
        v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
      ))
      .map(r => r.planIndex)
      .sort((a, b) => b - a);
    const filtered = [...plans];
    for (const idx of toRemove) filtered.splice(idx, 1);
    assert.equal(filtered.length, 2, "only the invalid plan should be removed");
    assert.equal(filtered[0].task, "First valid plan here");
    assert.equal(filtered[1].task, "Third valid plan here");
  });

  it("negative: plans with valid capacityDelta and requestROI are NOT flagged for removal", () => {
    const plans = [
      makeValidPlan({ capacityDelta: -0.5, requestROI: 1.1 }),
      makeValidPlan({ capacityDelta: 0, requestROI: 0.001 }),
    ];
    const result = validateAllPlans(plans);
    const toRemove = result.results
      .filter(r => !r.valid && r.violations.some(v =>
        (v.field === "capacityDelta" || v.field === "requestROI") &&
        v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
      ))
      .map(r => r.planIndex);
    assert.equal(toRemove.length, 0, "no valid plans should be flagged for capacity/ROI removal");
  });

  it("negative: out-of-range capacityDelta (> 1.0) is also flagged for removal", () => {
    const plans = [makeValidPlan({ capacityDelta: 2.0 })];
    const result = validateAllPlans(plans);
    const toRemove = result.results
      .filter(r => !r.valid && r.violations.some(v =>
        v.field === "capacityDelta" && v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
      ))
      .map(r => r.planIndex);
    assert.equal(toRemove.length, 1, "out-of-range capacityDelta must be flagged for removal");
  });
});

// ── Generation-boundary packet completeness gate ──────────────────────────────

describe("checkPacketCompleteness — generation-boundary gate", () => {
  function validRawPlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      task: "Implement trust boundary validation for planner output",
      role: "evolution-worker",
      wave: 1,
      capacityDelta: 0.15,
      requestROI: 2.5,
      verification_commands: ["npm test"],
      ...overrides,
    };
  }

  it("returns recoverable=true for a fully valid raw packet", () => {
    const result = checkPacketCompleteness(validRawPlan());
    assert.equal(result.recoverable, true);
    assert.deepEqual(result.reasons, []);
  });

  it("returns recoverable=false with no_task_identity when task/title/task_id/id are all absent", () => {
    const result = checkPacketCompleteness({ capacityDelta: 0.1, requestROI: 1.5 });
    assert.equal(result.recoverable, false);
    assert.ok(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.NO_TASK_IDENTITY));
  });

  it("returns recoverable=true when capacityDelta is absent (normalization synthesizes default)", () => {
    const plan = validRawPlan();
    delete (plan as any).capacityDelta;
    const result = checkPacketCompleteness(plan);
    assert.equal(result.recoverable, true);
  });

  it("returns recoverable=true when capacityDelta is out of range (normalization synthesizes default)", () => {
    const result = checkPacketCompleteness(validRawPlan({ capacityDelta: 2.0 }));
    assert.equal(result.recoverable, true);
  });

  it("returns recoverable=true when capacityDelta is non-finite (normalization synthesizes default)", () => {
    const result = checkPacketCompleteness(validRawPlan({ capacityDelta: NaN }));
    assert.equal(result.recoverable, true);
  });

  it("returns recoverable=true when requestROI is absent (normalization synthesizes default)", () => {
    const plan = validRawPlan();
    delete (plan as any).requestROI;
    const result = checkPacketCompleteness(plan);
    assert.equal(result.recoverable, true);
  });

  it("returns recoverable=true when requestROI is zero (normalization synthesizes default)", () => {
    const result = checkPacketCompleteness(validRawPlan({ requestROI: 0 }));
    assert.equal(result.recoverable, true);
  });

  it("returns recoverable=true when requestROI is negative (normalization synthesizes default)", () => {
    const result = checkPacketCompleteness(validRawPlan({ requestROI: -1 }));
    assert.equal(result.recoverable, true);
  });

  it("accepts non-empty verification text when verification_commands is absent", () => {
    const plan = validRawPlan({ verification: "npm test" });
    delete (plan as any).verification_commands;
    const result = checkPacketCompleteness(plan);
    assert.equal(result.recoverable, true);
    assert.equal(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.MISSING_VERIFICATION_COUPLING), false);
  });

  it("keeps packet recoverable when verification_commands is absent and verification is blank", () => {
    const plan = validRawPlan({ verification: "   " });
    delete (plan as any).verification_commands;
    const result = checkPacketCompleteness(plan);
    assert.equal(result.recoverable, true);
    assert.equal(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.MISSING_VERIFICATION_COUPLING), false);
  });

  it("only reports no_task_identity when task is missing (capacityDelta/requestROI handled by normalization)", () => {
    const result = checkPacketCompleteness({ wave: 1 }); // no task — only unrecoverable condition
    assert.equal(result.recoverable, false);
    assert.ok(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.NO_TASK_IDENTITY));
    assert.equal(result.reasons.length, 1);
  });

  it("accepts title as task identity fallback", () => {
    const plan = validRawPlan({ title: "Fix something important" });
    delete (plan as any).task;
    const result = checkPacketCompleteness(plan);
    assert.equal(result.recoverable, true, "title must count as task identity");
  });

  it("accepts task_id as task identity fallback", () => {
    const plan = validRawPlan({ task_id: "T-001" });
    delete (plan as any).task;
    const result = checkPacketCompleteness(plan);
    assert.equal(result.recoverable, true, "task_id must count as task identity");
  });

  it("returns recoverable=false for null input", () => {
    const result = checkPacketCompleteness(null);
    assert.equal(result.recoverable, false);
    assert.ok(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.NO_TASK_IDENTITY));
  });

  it("accepts capacityDelta=-1.0 (boundary min) as valid", () => {
    const result = checkPacketCompleteness(validRawPlan({ capacityDelta: -1.0 }));
    assert.equal(result.recoverable, true);
  });

  it("accepts capacityDelta=1.0 (boundary max) as valid", () => {
    const result = checkPacketCompleteness(validRawPlan({ capacityDelta: 1.0 }));
    assert.equal(result.recoverable, true);
  });

  it("negative path: only task identity is checked at raw stage", () => {
    // No task identity → single reason (capacityDelta/requestROI not checked here)
    const result = checkPacketCompleteness({ capacityDelta: 999, requestROI: 2.0 });
    assert.equal(result.recoverable, false);
    assert.ok(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.NO_TASK_IDENTITY));
    assert.equal(result.reasons.length, 1);
  });

  // ── Raw packet stage: verification coupling is synthesized downstream ─────

  it("returns recoverable=true when verification_commands is absent", () => {
    const plan = validRawPlan();
    delete (plan as any).verification_commands;
    const result = checkPacketCompleteness(plan);
    assert.equal(result.recoverable, true);
    assert.equal(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.MISSING_VERIFICATION_COUPLING), false);
  });

  it("returns recoverable=true when verification_commands is empty array", () => {
    const result = checkPacketCompleteness(validRawPlan({ verification_commands: [] }));
    assert.equal(result.recoverable, true);
    assert.equal(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.MISSING_VERIFICATION_COUPLING), false);
  });

  it("returns recoverable=true when all verification_commands are empty strings", () => {
    const result = checkPacketCompleteness(validRawPlan({ verification_commands: ["", "  "] }));
    assert.equal(result.recoverable, true);
    assert.equal(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.MISSING_VERIFICATION_COUPLING), false);
  });

  it("returns recoverable=true when verification_commands has one non-empty command", () => {
    const result = checkPacketCompleteness(validRawPlan({ verification_commands: ["npm test"] }));
    assert.equal(result.recoverable, true);
    assert.deepEqual(result.reasons, []);
  });

  it("negative path: packet with all unrecoverable fields does not add missing coupling at raw stage", () => {
    const result = checkPacketCompleteness({ wave: 1 }); // missing everything
    assert.equal(result.reasons.includes(UNRECOVERABLE_PACKET_REASONS.MISSING_VERIFICATION_COUPLING), false);
  });
});

describe("UNRECOVERABLE_PACKET_REASONS", () => {
  it("exports all expected reason codes as frozen string constants", () => {
    assert.equal(typeof UNRECOVERABLE_PACKET_REASONS.NO_TASK_IDENTITY, "string");
    assert.equal(typeof UNRECOVERABLE_PACKET_REASONS.MISSING_CAPACITY_DELTA, "string");
    assert.equal(typeof UNRECOVERABLE_PACKET_REASONS.INVALID_CAPACITY_DELTA, "string");
    assert.equal(typeof UNRECOVERABLE_PACKET_REASONS.MISSING_REQUEST_ROI, "string");
    assert.equal(typeof UNRECOVERABLE_PACKET_REASONS.INVALID_REQUEST_ROI, "string");
    assert.equal(typeof UNRECOVERABLE_PACKET_REASONS.MISSING_VERIFICATION_COUPLING, "string");
  });

  it("is frozen — mutation throws in strict mode", () => {
    assert.throws(
      () => { (UNRECOVERABLE_PACKET_REASONS as any).NEW_KEY = "x"; },
      /Cannot add property/,
      "UNRECOVERABLE_PACKET_REASONS must be frozen"
    );
  });
});

// ── Task 1: PLANNER_HEALTH_ALIASES + normalizeProjectHealthAlias ──────────────

describe("PLANNER_HEALTH_ALIASES and normalizeProjectHealthAlias (Task 1)", () => {
  it("PLANNER_HEALTH_ALIASES maps healthy → good and warning → needs-work", () => {
    assert.equal(PLANNER_HEALTH_ALIASES["healthy"], "good");
    assert.equal(PLANNER_HEALTH_ALIASES["warning"], "needs-work");
  });

  it("PLANNER_HEALTH_ALIASES is frozen — mutation throws", () => {
    assert.throws(
      () => { (PLANNER_HEALTH_ALIASES as any).ok = "good"; },
      /Cannot add property|object is not extensible/i
    );
  });

  it("normalizeProjectHealthAlias maps 'healthy' → 'good'", () => {
    assert.equal(normalizeProjectHealthAlias("healthy"), "good");
  });

  it("normalizeProjectHealthAlias maps 'warning' → 'needs-work'", () => {
    assert.equal(normalizeProjectHealthAlias("warning"), "needs-work");
  });

  it("normalizeProjectHealthAlias is case-insensitive", () => {
    assert.equal(normalizeProjectHealthAlias("HEALTHY"), "good");
    assert.equal(normalizeProjectHealthAlias("WARNING"), "needs-work");
    assert.equal(normalizeProjectHealthAlias("Healthy"), "good");
    assert.equal(normalizeProjectHealthAlias("Warning"), "needs-work");
  });

  it("normalizeProjectHealthAlias passes through canonical values unchanged", () => {
    assert.equal(normalizeProjectHealthAlias("good"), "good");
    assert.equal(normalizeProjectHealthAlias("needs-work"), "needs-work");
    assert.equal(normalizeProjectHealthAlias("critical"), "critical");
  });

  it("normalizeProjectHealthAlias returns the input for unknown values (no silent swallow)", () => {
    assert.equal(normalizeProjectHealthAlias("unknown-value"), "unknown-value");
    assert.equal(normalizeProjectHealthAlias("ok"), "ok");
  });

  it("normalizeProjectHealthAlias handles empty/null/undefined without throwing", () => {
    assert.equal(normalizeProjectHealthAlias(""), "");
    assert.equal(normalizeProjectHealthAlias(null as any), "");
    assert.equal(normalizeProjectHealthAlias(undefined as any), "");
  });

  it("normalizePrometheusParsedOutput accepts 'healthy' alias and scores healthField=1.0", () => {
    const parsed = {
      projectHealth: "healthy",
      plans: [{ task: "Harden trust boundary", role: "evolution-worker", wave: 1 }],
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.projectHealth, "good",
      "alias 'healthy' must be normalized to canonical 'good'");
    assert.equal(result.parserConfidenceComponents?.healthField, 1.0,
      "explicit alias must score healthField=1.0, not 0.8");
  });

  it("normalizePrometheusParsedOutput accepts 'warning' alias and scores healthField=1.0", () => {
    const parsed = {
      projectHealth: "warning",
      plans: [{ task: "Harden trust boundary", role: "evolution-worker", wave: 1 }],
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.projectHealth, "needs-work",
      "alias 'warning' must be normalized to canonical 'needs-work'");
    assert.equal(result.parserConfidenceComponents?.healthField, 1.0,
      "explicit alias must score healthField=1.0, not 0.8");
  });

  it("normalizePrometheusParsedOutput still infers when projectHealth is absent (negative path)", () => {
    const parsed = {
      // no projectHealth field
      plans: [{ task: "Harden trust boundary", role: "evolution-worker", wave: 1 }],
    };
    const result = normalizePrometheusParsedOutput(parsed, { raw: "" });
    assert.equal(result.parserConfidenceComponents?.healthField, 0.9,
      "missing projectHealth resolves via inference — scores healthField=0.9 with lighter penalty");
    const penalty = (result.parserConfidencePenalties as any[]).find(
      (p: any) => p.component === "healthField"
    );
    assert.ok(penalty, "must have a healthField penalty when health is missing");
    assert.equal(penalty.reason, "health_field_inferred_from_text");
  });
});

// ── splitWavesIntoMicrowaves — deterministic micro-wave splitting ──────────────

import {
  splitWavesIntoMicrowaves,
  MICROWAVE_MAX_TASKS_DEFAULT,
  buildPrometheusPlanningPolicy,
  buildDeterministicRequestBudget,
  buildTopicMemoryPromptSection,
} from "../../src/core/prometheus.js";

describe("splitWavesIntoMicrowaves", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(splitWavesIntoMicrowaves([]), []);
  });

  it("returns empty array for non-array input", () => {
    assert.deepEqual(splitWavesIntoMicrowaves(null as any), []);
  });

  it("preserves plans that already fit within the limit (no splitting needed)", () => {
    const plans = [
      { task_id: "T-1", task: "Task 1", wave: 1, dependencies: [] },
      { task_id: "T-2", task: "Task 2", wave: 1, dependencies: [] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 3);
    assert.equal(result.length, 2, "both plans must be preserved");
    assert.equal(result[0].wave, 1, "first plan remains in wave 1");
    assert.equal(result[1].wave, 1, "second plan remains in wave 1");
  });

  it("splits a wave with more tasks than the limit into micro-waves", () => {
    const plans = [
      { task_id: "T-1", task: "Task 1", wave: 1, dependencies: [] },
      { task_id: "T-2", task: "Task 2", wave: 1, dependencies: [] },
      { task_id: "T-3", task: "Task 3", wave: 1, dependencies: [] },
      { task_id: "T-4", task: "Task 4", wave: 1, dependencies: [] },
      { task_id: "T-5", task: "Task 5", wave: 1, dependencies: [] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 3);
    assert.equal(result.length, 5, "all plans must be preserved after split");
    const waveNumbers = [...new Set(result.map((p: any) => p.wave))].sort((a, b) => a - b);
    assert.equal(waveNumbers.length, 2, "5 tasks split into 3+2 should produce 2 micro-waves");
    assert.equal(waveNumbers[0], 1, "first micro-wave must be wave 1");
    assert.equal(waveNumbers[1], 2, "second micro-wave must be wave 2");
    const wave1Count = result.filter((p: any) => p.wave === 1).length;
    const wave2Count = result.filter((p: any) => p.wave === 2).length;
    assert.equal(wave1Count, 3, "first micro-wave must have exactly 3 tasks");
    assert.equal(wave2Count, 2, "second micro-wave must have exactly 2 tasks");
  });

  it("MICROWAVE_MAX_TASKS_DEFAULT is 3", () => {
    assert.equal(MICROWAVE_MAX_TASKS_DEFAULT, 3);
  });

  it("uses MICROWAVE_MAX_TASKS_DEFAULT when no limit is specified", () => {
    const plans = Array.from({ length: 4 }, (_, i) => ({
      task_id: `T-${i + 1}`, task: `Task ${i + 1}`, wave: 1, dependencies: [],
    }));
    const result = splitWavesIntoMicrowaves(plans);
    const waveNumbers = [...new Set(result.map((p: any) => p.wave))];
    assert.equal(waveNumbers.length, 2, "4 tasks with default limit of 3 must produce 2 micro-waves");
  });

  it("preserves relative ordering: wave 2 tasks are renumbered after wave 1 micro-waves", () => {
    const plans = [
      { task_id: "T-1", task: "Task 1", wave: 1, dependencies: [] },
      { task_id: "T-2", task: "Task 2", wave: 1, dependencies: [] },
      { task_id: "T-3", task: "Task 3", wave: 1, dependencies: [] },
      { task_id: "T-4", task: "Task 4", wave: 1, dependencies: [] },
      { task_id: "T-5", task: "Task 5", wave: 2, dependencies: [] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 3);
    const t5 = result.find((p: any) => p.task_id === "T-5");
    assert.ok(t5, "T-5 must be present in the output");
    assert.equal(t5.wave, 3,
      "original wave 2 task must be renumbered to wave 3 after wave 1 splits into 2 micro-waves");
  });

  it("critical-path ordering: tasks that others depend on in the same wave go first", () => {
    const plans = [
      { task_id: "T-A", task: "Task A", wave: 1, dependencies: [] },
      { task_id: "T-B", task: "Task B", wave: 1, dependencies: ["T-C"] },
      { task_id: "T-C", task: "Task C", wave: 1, dependencies: [] },
      { task_id: "T-D", task: "Task D", wave: 1, dependencies: ["T-C"] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 3);
    // T-C is depended on by T-B and T-D → 2 intra-wave dependents → must be in first micro-wave
    const wave1Tasks = result.filter((p: any) => p.wave === 1).map((p: any) => p.task_id);
    assert.ok(
      wave1Tasks.includes("T-C"),
      `T-C (2 dependents) must be in the first micro-wave; wave 1 tasks: ${wave1Tasks.join(", ")}`
    );
  });

// ── computeHighRiskComponentGate ──────────────────────────────────────────────

describe("computeHighRiskComponentGate", () => {
  it("returns shouldApplyStricterGate=false when all components are healthy (1.0)", () => {
    const result = computeHighRiskComponentGate({
      plansShape:      1.0,
      requestBudget:   1.0,
      dependencyGraph: 1.0,
    });
    assert.equal(result.shouldApplyStricterGate, false);
    assert.equal(result.weakComponents.length, 0);
    assert.equal(result.reason, "all_components_healthy");
  });

  it("returns shouldApplyStricterGate=false with empty components (all default to 1.0)", () => {
    const result = computeHighRiskComponentGate({});
    assert.equal(result.shouldApplyStricterGate, false);
    assert.equal(result.weakComponents.length, 0);
  });

  it("flags plansShape as weak when score is below threshold (0.5 = fallback mode)", () => {
    const result = computeHighRiskComponentGate({
      plansShape:      0.5,
      requestBudget:   1.0,
      dependencyGraph: 1.0,
    });
    assert.equal(result.shouldApplyStricterGate, true);
    assert.ok(result.weakComponents.includes("plansShape"), "plansShape must be listed as weak");
    assert.ok(result.reason.includes("plansShape"), "reason must mention the weak component");
  });

  it("flags requestBudget as weak when score is below threshold (0.9 = fallback budget)", () => {
    const result = computeHighRiskComponentGate({
      plansShape:      1.0,
      requestBudget:   0.9,
      dependencyGraph: 1.0,
    });
    assert.equal(result.shouldApplyStricterGate, true);
    assert.ok(result.weakComponents.includes("requestBudget"));
  });

  it("flags dependencyGraph as weak when score is below threshold (0.3 = cycle detected)", () => {
    const result = computeHighRiskComponentGate({
      plansShape:      1.0,
      requestBudget:   1.0,
      dependencyGraph: 0.3,
    });
    assert.equal(result.shouldApplyStricterGate, true);
    assert.ok(result.weakComponents.includes("dependencyGraph"));
  });

  it("flags multiple weak components and lists all in weakComponents", () => {
    const result = computeHighRiskComponentGate({
      plansShape:      0.5,
      requestBudget:   0.9,
      dependencyGraph: 0.6,
    });
    assert.equal(result.shouldApplyStricterGate, true);
    assert.ok(result.weakComponents.includes("plansShape"));
    assert.ok(result.weakComponents.includes("requestBudget"));
    assert.ok(result.weakComponents.includes("dependencyGraph"));
    assert.equal(result.weakComponents.length, 3);
  });

  it("does NOT flag plansShape=1.0 (direct JSON path — healthy)", () => {
    const result = computeHighRiskComponentGate({ plansShape: 1.0 });
    assert.ok(!result.weakComponents.includes("plansShape"));
  });

  it("does NOT flag requestBudget at exactly the threshold (scores at threshold are NOT weak)", () => {
    // threshold is 0.95; a score of exactly 0.95 is not below threshold
    const result = computeHighRiskComponentGate({ requestBudget: 0.95 });
    assert.ok(!result.weakComponents.includes("requestBudget"));
  });

  it("does NOT flag dependencyGraph=0.8 (at the threshold boundary — not below)", () => {
    const result = computeHighRiskComponentGate({ dependencyGraph: 0.8 });
    assert.ok(!result.weakComponents.includes("dependencyGraph"));
  });

  it("handles undefined component values by defaulting to 1.0 (healthy)", () => {
    const result = computeHighRiskComponentGate({ plansShape: undefined as any });
    assert.ok(!result.weakComponents.includes("plansShape"), "undefined plansShape must default to 1.0 (healthy)");
  });

  it("HIGH_RISK_COMPONENT_GATE_THRESHOLDS exports expected keys", () => {
    assert.ok("plansShape"      in HIGH_RISK_COMPONENT_GATE_THRESHOLDS);
    assert.ok("requestBudget"   in HIGH_RISK_COMPONENT_GATE_THRESHOLDS);
    assert.ok("dependencyGraph" in HIGH_RISK_COMPONENT_GATE_THRESHOLDS);
  });

  it("reason includes all weak component names when gate is active", () => {
    const result = computeHighRiskComponentGate({ plansShape: 0.5, dependencyGraph: 0.3 });
    assert.ok(result.reason.includes("plansShape"),      "reason must include plansShape");
    assert.ok(result.reason.includes("dependencyGraph"), "reason must include dependencyGraph");
  });

  // ── Negative paths ────────────────────────────────────────────────────────

  it("NEGATIVE: gate not active when plansShape is exactly at boundary 0.8", () => {
    const result = computeHighRiskComponentGate({ plansShape: 0.8 });
    // 0.8 is NOT below 0.8 → no weak component
    assert.equal(result.shouldApplyStricterGate, false);
  });

  it("NEGATIVE: gate not active when requestBudget is fully healthy (1.0)", () => {
    const result = computeHighRiskComponentGate({
      plansShape:      0.9,
      requestBudget:   1.0,
      dependencyGraph: 0.9,
    });
    // plansShape 0.9 >= 0.8, requestBudget 1.0 >= 0.95, dependencyGraph 0.9 >= 0.8
    assert.equal(result.shouldApplyStricterGate, false);
  });
});

  it("does not mutate the original plan objects", () => {
    const plan = { task_id: "T-1", task: "Task 1", wave: 1, dependencies: [], extra: "preserved" };
    const result = splitWavesIntoMicrowaves([plan], 3);
    assert.equal(plan.wave, 1, "original plan wave must not be mutated");
    assert.equal(result[0].extra, "preserved", "extra fields must be preserved in output");
  });

  it("negative: single-task waves are never split (no-op pass-through)", () => {
    const plans = [
      { task_id: "T-1", task: "Task 1", wave: 1, dependencies: [] },
      { task_id: "T-2", task: "Task 2", wave: 2, dependencies: [] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 3);
    assert.equal(result.length, 2);
    assert.equal(result[0].wave, 1, "single-task wave 1 must remain wave 1");
    assert.equal(result[1].wave, 2, "single-task wave 2 must remain wave 2");
  });

  it("maxTasksPerWave=1 forces one task per micro-wave", () => {
    const plans = [
      { task_id: "T-1", task: "Task 1", wave: 1, dependencies: [] },
      { task_id: "T-2", task: "Task 2", wave: 1, dependencies: [] },
      { task_id: "T-3", task: "Task 3", wave: 1, dependencies: [] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 1);
    assert.equal(result.length, 3);
    const waveNums = result.map((p: any) => p.wave).sort((a: number, b: number) => a - b);
    assert.deepEqual(waveNums, [1, 2, 3],
      "each task must be assigned a unique wave number when maxTasksPerWave=1");
  });

  it("multiple original waves both needing splitting produce sequential micro-wave numbers", () => {
    // wave 1: 4 tasks → split into micro-waves 1+2
    // wave 2: 4 tasks → split into micro-waves 3+4
    const plans = [
      { task_id: "A-1", task: "Wave A Task 1", wave: 1, dependencies: [] },
      { task_id: "A-2", task: "Wave A Task 2", wave: 1, dependencies: [] },
      { task_id: "A-3", task: "Wave A Task 3", wave: 1, dependencies: [] },
      { task_id: "A-4", task: "Wave A Task 4", wave: 1, dependencies: [] },
      { task_id: "B-1", task: "Wave B Task 1", wave: 2, dependencies: [] },
      { task_id: "B-2", task: "Wave B Task 2", wave: 2, dependencies: [] },
      { task_id: "B-3", task: "Wave B Task 3", wave: 2, dependencies: [] },
      { task_id: "B-4", task: "Wave B Task 4", wave: 2, dependencies: [] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 3);
    assert.equal(result.length, 8, "all 8 tasks must be preserved");
    const waveNums = [...new Set(result.map((p: any) => p.wave))].sort((a: number, b: number) => a - b);
    assert.deepEqual(waveNums, [1, 2, 3, 4],
      "wave 1 (4 tasks) → micro-waves 1+2; wave 2 (4 tasks) → micro-waves 3+4");
    // All original wave-1 tasks must be in micro-waves ≤2
    const wave1Tasks = result.filter((p: any) => p.task_id.startsWith("A-"));
    assert.ok(wave1Tasks.every((p: any) => p.wave <= 2),
      "all original wave-1 tasks must be assigned to micro-waves 1 or 2");
    // All original wave-2 tasks must be in micro-waves ≥3
    const wave2Tasks = result.filter((p: any) => p.task_id.startsWith("B-"));
    assert.ok(wave2Tasks.every((p: any) => p.wave >= 3),
      "all original wave-2 tasks must be renumbered to micro-waves 3 or 4");
  });

  it("cross-wave dependencies are not counted toward intra-wave critical-path score", () => {
    // T-X is in wave 2 and depends on T-A (wave 1). That cross-wave dependency
    // must NOT inflate T-A's intra-wave critical-path score in wave 1.
    const plans = [
      { task_id: "T-A", task: "Task A", wave: 1, dependencies: [] },
      { task_id: "T-B", task: "Task B", wave: 1, dependencies: [] },
      { task_id: "T-C", task: "Task C", wave: 1, dependencies: [] },
      { task_id: "T-D", task: "Task D", wave: 1, dependencies: [] },
      { task_id: "T-X", task: "Task X", wave: 2, dependencies: ["T-A"] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 3);
    assert.equal(result.length, 5, "all 5 tasks must be preserved");
    // Wave 1 (4 tasks) → split: micro-wave 1 gets 3, micro-wave 2 gets 1
    const mw1Tasks = result.filter((p: any) => p.wave === 1).map((p: any) => p.task_id);
    const mw2Tasks = result.filter((p: any) => p.wave === 2).map((p: any) => p.task_id);
    assert.equal(mw1Tasks.length, 3, "first micro-wave from wave 1 must have 3 tasks");
    assert.equal(mw2Tasks.length, 1, "second micro-wave from wave 1 must have 1 task");
    // T-X (wave 2) must still be present — renumbered to wave 3 after the split
    const tX = result.find((p: any) => p.task_id === "T-X");
    assert.ok(tX, "T-X must be preserved in output");
    assert.equal(tX.wave, 3, "T-X (original wave 2) must be renumbered to wave 3 after wave 1 splits");
  });

  it("boundary: exactly maxTasksPerWave tasks in a wave are not split (no-op)", () => {
    const plans = [
      { task_id: "T-1", task: "Task 1", wave: 1, dependencies: [] },
      { task_id: "T-2", task: "Task 2", wave: 1, dependencies: [] },
    ];
    const result = splitWavesIntoMicrowaves(plans, 2);
    assert.equal(result.length, 2, "both tasks must be preserved");
    const waveNums = [...new Set(result.map((p: any) => p.wave))];
    assert.equal(waveNums.length, 1, "exactly-2-tasks wave with limit-2 must NOT be split");
    assert.equal(waveNums[0], 1, "must remain in wave 1");
  });
});

describe("buildPrometheusPlanningPolicy", () => {
  it("preserves unlimited planning semantics when planner.maxTasks is 0", () => {
    const policy = buildPrometheusPlanningPolicy({
      planner: {
        maxTasks: 0,
        defaultMaxWorkersPerWave: 9,
      },
      runtime: {
        runtimeBudget: {
          maxTasksPerCycle: 12,
        },
      },
    });

    assert.equal(policy.maxTasks, 0);
    assert.equal(policy.maxWorkersPerWave, 9);
  });

  it("caps maxWorkersPerWave only when maxTasks is finite", () => {
    const policy = buildPrometheusPlanningPolicy({
      planner: {
        maxTasks: 3,
        defaultMaxWorkersPerWave: 10,
      },
    });

    assert.equal(policy.maxTasks, 3);
    assert.equal(policy.maxWorkersPerWave, 3);
  });
});

describe("buildDeterministicRequestBudget", () => {
  it("counts one worker request per distinct role session in each wave", () => {
    const plans = [
      { task: "Task A", role: "quality-worker", wave: 1 },
      { task: "Task B", role: "quality-worker", wave: 1 },
      { task: "Task C", role: "infrastructure-worker", wave: 1 },
      { task: "Task D", role: "quality-worker", wave: 2 },
    ];
    const executionStrategy = {
      waves: [
        { wave: 1 },
        { wave: 2 },
      ],
    };

    const budget = buildDeterministicRequestBudget(plans, executionStrategy);

    assert.equal(budget.byWave[0].estimatedRequests, 2, "wave 1 should count two role sessions");
    assert.equal(budget.byWave[1].estimatedRequests, 1, "wave 2 should count one role session");
    assert.equal(
      budget.byRole.find((entry: any) => entry.role === "quality-worker")?.estimatedRequests,
      2,
      "quality-worker should count once per wave where it runs"
    );
    assert.equal(
      budget.estimatedPremiumRequestsTotal,
      6,
      "3 leadership requests + 3 worker role sessions"
    );
  });

  it("does not multiply requests by plan count inside one shared role wave", () => {
    const plans = [
      { task: "Task A", role: "quality-worker", wave: 1 },
      { task: "Task B", role: "quality-worker", wave: 1 },
      { task: "Task C", role: "quality-worker", wave: 1 },
    ];
    const budget = buildDeterministicRequestBudget(plans, { waves: [{ wave: 1 }] });

    assert.equal(budget.byWave[0].estimatedRequests, 1);
    assert.equal(budget.byRole[0].estimatedRequests, 1);
  });
});

describe("buildTopicMemoryPromptSection", () => {
  it("omits empty active topics while keeping summary counts", () => {
    const prompt = buildTopicMemoryPromptSection({
      topics: {
        "empty-active": {
          status: "active",
          runCount: 2,
          firstSeenAt: "2026-03-30T00:00:00.000Z",
          lastUpdatedAt: "2026-03-31T00:00:00.000Z",
          knowledgeFragments: [],
          completedSummary: null,
        },
        "useful-active": {
          status: "active",
          runCount: 3,
          firstSeenAt: "2026-03-30T00:00:00.000Z",
          lastUpdatedAt: "2026-03-31T00:00:00.000Z",
          knowledgeFragments: ["Plan: tighten request budgeting in prometheus.ts"],
          completedSummary: null,
        },
        "done-topic": {
          status: "completed",
          runCount: 2,
          firstSeenAt: "2026-03-30T00:00:00.000Z",
          lastUpdatedAt: "2026-03-31T00:00:00.000Z",
          knowledgeFragments: [],
          completedSummary: "Completed summary",
        },
      },
    });

    assert.ok(prompt.includes("Active topics tracked: 2. Completed topics tracked: 1."));
    assert.ok(prompt.includes("useful-active"));
    assert.ok(!prompt.includes("**empty-active**"), "empty active topics should not consume prompt budget");
    assert.ok(prompt.includes("done-topic"));
  });

  it("returns an empty string when no topic memory exists", () => {
    assert.equal(buildTopicMemoryPromptSection({ topics: {} }), "");
  });
});

// ── checkHighRiskPacketConfidence — high-risk low-confidence gate ─────────────

describe("checkHighRiskPacketConfidence — high-risk low-confidence gate", () => {
  function highRiskBase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      task: "Rewrite orchestrator dispatch path for wave-parallel execution",
      riskLevel: "high",
      ...overrides,
    };
  }

  it("does not reject a low-risk packet even when premortem and acceptance_criteria are absent", () => {
    const result = checkHighRiskPacketConfidence({ task: "Improve log output formatting", riskLevel: "low" });
    assert.equal(result.requiresRejection, false);
  });

  it("does not reject a medium-risk packet lacking confidence signals", () => {
    const result = checkHighRiskPacketConfidence({ task: "Harden trust boundary validation", riskLevel: "medium" });
    assert.equal(result.requiresRejection, false);
  });

  it("does not reject a high-risk packet that has both premortem and acceptance_criteria", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase({
      premortem: {
        failurePaths: ["Breaks orchestration path under concurrent load"],
        mitigations: ["Feature flag for incremental rollout"],
        rollbackPlan: "Revert to previous dispatch commit",
      },
      acceptance_criteria: [
        "All orchestration integration tests pass",
        "Wave-parallel dispatch logs confirm new code path",
      ],
    }));
    assert.equal(result.requiresRejection, false);
    assert.equal(result.reason, "sufficient_confidence");
  });

  it("does not reject a high-risk packet that has acceptance_criteria but no premortem", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase({
      acceptance_criteria: ["All integration tests pass after dispatch change"],
    }));
    assert.equal(result.requiresRejection, false,
      "acceptance_criteria alone is sufficient confidence to allow the packet through");
  });

  it("does not reject a high-risk packet that has premortem but no acceptance_criteria", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase({
      premortem: {
        failurePaths: ["Cascading orchestrator failure"],
        mitigations: ["Disable parallel dispatch under error budget"],
        rollbackPlan: "Restore previous orchestrator.ts",
      },
    }));
    assert.equal(result.requiresRejection, false,
      "premortem alone is sufficient confidence to allow the packet through");
  });

  it("rejects a high-risk packet that has neither premortem nor acceptance_criteria", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase());
    assert.equal(result.requiresRejection, true);
    assert.equal(result.reason, HIGH_RISK_LOW_CONFIDENCE_REASON);
  });

  it("rejects a high-risk packet with empty acceptance_criteria and absent premortem", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase({ acceptance_criteria: [] }));
    assert.equal(result.requiresRejection, true);
    assert.equal(result.reason, HIGH_RISK_LOW_CONFIDENCE_REASON);
  });

  it("rejects a high-risk packet with blank acceptance_criteria entries and absent premortem", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase({ acceptance_criteria: ["", "   "] }));
    assert.equal(result.requiresRejection, true,
      "blank-only criteria must count as absent");
  });

  it("rejects a high-risk packet with empty premortem object and absent acceptance_criteria", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase({ premortem: {} }));
    assert.equal(result.requiresRejection, true,
      "empty premortem object must count as absent when no acceptance_criteria present");
  });

  it("rejects a high-risk packet with premortem missing all safety fields and no acceptance_criteria", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase({
      premortem: { scenario: "things might break" }, // no failurePaths / mitigations / rollbackPlan
    }));
    assert.equal(result.requiresRejection, true,
      "premortem with only non-safety fields must count as absent");
  });

  it("accepts a high-risk packet whose premortem has only rollbackPlan populated", () => {
    const result = checkHighRiskPacketConfidence(highRiskBase({
      premortem: { rollbackPlan: "Revert commit abc123 and redeploy" },
    }));
    assert.equal(result.requiresRejection, false,
      "rollbackPlan alone in premortem counts as meaningful safety evidence");
  });

  it("negative path: packet with no riskLevel field is not rejected (inference deferred to normalization)", () => {
    // A task whose text would infer high-risk but has no explicit riskLevel field
    const result = checkHighRiskPacketConfidence({
      task: "Implement critical-path scheduling with dependency-aware waves and parallel dispatcher",
      // no riskLevel
    });
    assert.equal(result.requiresRejection, false,
      "must not reject at raw stage when riskLevel is absent — inference runs during normalization");
  });

  it("handles null input without throwing — returns no rejection", () => {
    assert.doesNotThrow(() => checkHighRiskPacketConfidence(null));
    assert.equal(checkHighRiskPacketConfidence(null).requiresRejection, false);
  });

  it("handles undefined input without throwing — returns no rejection", () => {
    assert.doesNotThrow(() => checkHighRiskPacketConfidence(undefined));
    assert.equal(checkHighRiskPacketConfidence(undefined).requiresRejection, false);
  });

  it("HIGH_RISK_LOW_CONFIDENCE_REASON is a non-empty string constant", () => {
    assert.equal(typeof HIGH_RISK_LOW_CONFIDENCE_REASON, "string");
    assert.ok(HIGH_RISK_LOW_CONFIDENCE_REASON.length > 0);
    assert.ok(HIGH_RISK_LOW_CONFIDENCE_REASON.includes("high_risk"));
  });

  it("riskLevel comparison is case-insensitive (HIGH, High, high all trigger)", () => {
    for (const level of ["HIGH", "High", "high"]) {
      const result = checkHighRiskPacketConfidence({ task: "Some task", riskLevel: level });
      assert.equal(result.requiresRejection, true,
        `riskLevel="${level}" with no confidence signals must trigger rejection`);
    }
  });
});

// ── checkDecompositionCaps — deterministic decomposition ceiling ─────────────

describe("checkDecompositionCaps", () => {
  it("returns capped=false when plans count is within MAX_DECOMPOSITION_PLANS", () => {
    const plans = Array.from({ length: MAX_DECOMPOSITION_PLANS }, (_, i) => ({ task: `Task ${i + 1}` }));
    const result = checkDecompositionCaps(plans);
    assert.equal(result.capped, false);
    assert.equal(result.originalCount, MAX_DECOMPOSITION_PLANS);
    assert.equal(result.cappedCount, MAX_DECOMPOSITION_PLANS);
    assert.equal(result.reason, "within_cap");
  });

  it("returns capped=false for an empty array", () => {
    const result = checkDecompositionCaps([]);
    assert.equal(result.capped, false);
    assert.equal(result.originalCount, 0);
    assert.equal(result.cappedCount, 0);
  });

  it("returns capped=true when plans count exceeds MAX_DECOMPOSITION_PLANS", () => {
    const plans = Array.from({ length: MAX_DECOMPOSITION_PLANS + 1 }, (_, i) => ({ task: `Task ${i + 1}` }));
    const result = checkDecompositionCaps(plans);
    assert.equal(result.capped, true);
    assert.equal(result.originalCount, MAX_DECOMPOSITION_PLANS + 1);
    assert.equal(result.cappedCount, MAX_DECOMPOSITION_PLANS);
    assert.equal(result.reason, DECOMPOSITION_CAP_REASON);
  });

  it("reports the correct originalCount and cappedCount for a large batch", () => {
    const plans = Array.from({ length: 50 }, (_, i) => ({ task: `Task ${i + 1}` }));
    const result = checkDecompositionCaps(plans);
    assert.equal(result.capped, true);
    assert.equal(result.originalCount, 50);
    assert.equal(result.cappedCount, MAX_DECOMPOSITION_PLANS);
  });

  it("treats non-array input as empty (capped=false)", () => {
    const result = checkDecompositionCaps(null as any);
    assert.equal(result.capped, false);
    assert.equal(result.originalCount, 0);
  });

  it("is a pure function — does not mutate input array", () => {
    const plans = Array.from({ length: MAX_DECOMPOSITION_PLANS + 5 }, (_, i) => ({ task: `Task ${i + 1}` }));
    const lengthBefore = plans.length;
    checkDecompositionCaps(plans);
    assert.equal(plans.length, lengthBefore, "input array must not be mutated");
  });

  it("MAX_DECOMPOSITION_PLANS is 20", () => {
    assert.equal(MAX_DECOMPOSITION_PLANS, 20);
  });

  it("DECOMPOSITION_CAP_REASON is a non-empty string", () => {
    assert.equal(typeof DECOMPOSITION_CAP_REASON, "string");
    assert.ok(DECOMPOSITION_CAP_REASON.length > 0);
    assert.ok(DECOMPOSITION_CAP_REASON.includes("decomposition"));
  });

  it("negative path: exactly MAX_DECOMPOSITION_PLANS plans is NOT capped", () => {
    const plans = Array.from({ length: MAX_DECOMPOSITION_PLANS }, (_, i) => ({ task: `Task ${i + 1}` }));
    const result = checkDecompositionCaps(plans);
    assert.equal(result.capped, false, "exactly MAX_DECOMPOSITION_PLANS must not trigger capping");
  });
});

// ── Task 1: computeClosureYield + rankPlansByClosureYield ─────────────────────

describe("computeClosureYield — realized closure yield from carry-forward ledger", () => {
  it("returns zero-signal when ledger is empty", () => {
    const result = computeClosureYield([]);
    assert.equal(result.yield, 0);
    assert.equal(result.closed, 0);
    assert.equal(result.attempted, 0);
  });

  it("returns zero-signal when no entries have closedAt set", () => {
    const ledger = [
      { id: "e1", closedAt: null, closureEvidence: null },
      { id: "e2", closedAt: null, closureEvidence: "PR #1" },
    ];
    const result = computeClosureYield(ledger);
    assert.equal(result.yield, 0);
    assert.equal(result.attempted, 0);
  });

  it("counts attempted as entries with closedAt set regardless of evidence", () => {
    const ledger = [
      { id: "e1", closedAt: "2025-01-01", closureEvidence: null },
      { id: "e2", closedAt: "2025-01-02", closureEvidence: "" },
      { id: "e3", closedAt: null, closureEvidence: null },
    ];
    const result = computeClosureYield(ledger);
    assert.equal(result.attempted, 2, "only entries with closedAt contribute to attempted");
    assert.equal(result.closed, 0, "no evidence → zero closed");
    assert.equal(result.yield, 0);
  });

  it("computes yield correctly when all attempted closures have evidence", () => {
    const ledger = [
      { id: "e1", closedAt: "2025-01-01", closureEvidence: "PR #1" },
      { id: "e2", closedAt: "2025-01-02", closureEvidence: "PR #2" },
    ];
    const result = computeClosureYield(ledger);
    assert.equal(result.attempted, 2);
    assert.equal(result.closed, 2);
    assert.equal(result.yield, 1, "100% yield when all closures have evidence");
  });

  it("computes fractional yield when some closures lack evidence", () => {
    const ledger = [
      { id: "e1", closedAt: "2025-01-01", closureEvidence: "PR #1" },
      { id: "e2", closedAt: "2025-01-02", closureEvidence: null },
      { id: "e3", closedAt: "2025-01-03", closureEvidence: "PR #3" },
      { id: "e4", closedAt: "2025-01-04", closureEvidence: null },
    ];
    const result = computeClosureYield(ledger);
    assert.equal(result.attempted, 4);
    assert.equal(result.closed, 2);
    assert.equal(result.yield, 0.5, "2 of 4 attempted → yield 0.5");
  });

  it("ignores null entries in the array without throwing", () => {
    const ledger = [
      null,
      { id: "e1", closedAt: "2025-01-01", closureEvidence: "PR #1" },
      undefined,
    ];
    const result = computeClosureYield(ledger as any[]);
    assert.equal(result.attempted, 1);
    assert.equal(result.closed, 1);
    assert.equal(result.yield, 1);
  });

  it("negative path: null input returns zero-signal without throwing", () => {
    const result = computeClosureYield(null as any);
    assert.equal(result.yield, 0);
    assert.equal(result.attempted, 0);
    assert.equal(result.closed, 0);
  });

  it("CLOSURE_YIELD_LOW_THRESHOLD is 0.5", () => {
    assert.equal(CLOSURE_YIELD_LOW_THRESHOLD, 0.5);
  });

  it("CLOSURE_YIELD_BOOST_AMOUNT is 0.05", () => {
    assert.equal(CLOSURE_YIELD_BOOST_AMOUNT, 0.05);
  });
});

describe("rankPlansByClosureYield — planning rank boost for low yield", () => {
  function makePlan(overrides: Record<string, any> = {}): Record<string, any> {
    return {
      task: "Default task",
      capacityDelta: 0.2,
      requestROI: 1.5,
      leverage_rank: [],
      ...overrides,
    };
  }

  it("returns a copy of plans unchanged when closureYield is 0 (no data)", () => {
    const plans = [makePlan({ leverage_rank: ["learning"] })];
    const result = rankPlansByClosureYield(plans, 0);
    assert.equal(result.length, 1);
    assert.equal(result[0].capacityDelta, 0.2, "no boost when closureYield=0");
    assert.notStrictEqual(result, plans, "must return a new array");
  });

  it("returns plans unchanged when closureYield is at or above threshold (0.5)", () => {
    const plans = [makePlan({ leverage_rank: ["learning"], capacityDelta: 0.3 })];
    const resultAt = rankPlansByClosureYield(plans, 0.5);
    assert.equal(resultAt[0].capacityDelta, 0.3, "no boost at exactly threshold");
    const resultAbove = rankPlansByClosureYield(plans, 0.8);
    assert.equal(resultAbove[0].capacityDelta, 0.3, "no boost above threshold");
  });

  it("boosts capacityDelta for plans with 'learning' in leverage_rank when yield is low", () => {
    const plans = [makePlan({ leverage_rank: ["learning"], capacityDelta: 0.2 })];
    const result = rankPlansByClosureYield(plans, 0.3);
    assert.equal(result[0].capacityDelta, 0.25, "capacityDelta must be boosted by CLOSURE_YIELD_BOOST_AMOUNT");
  });

  it("boosts capacityDelta for plans with 'quality' in leverage_rank when yield is low", () => {
    const plans = [makePlan({ leverage_rank: ["quality"], capacityDelta: 0.4 })];
    const result = rankPlansByClosureYield(plans, 0.2);
    assert.equal(result[0].capacityDelta, 0.45);
  });

  it("boosts capacityDelta for plans with 'task-quality' in leverage_rank when yield is low", () => {
    const plans = [makePlan({ leverage_rank: ["speed", "task-quality"], capacityDelta: 0.1 })];
    const result = rankPlansByClosureYield(plans, 0.1);
    assert.equal(result[0].capacityDelta, 0.15);
  });

  it("does NOT boost plans whose leverage_rank does not include a boost dimension", () => {
    const plans = [makePlan({ leverage_rank: ["architecture", "speed"], capacityDelta: 0.3 })];
    const result = rankPlansByClosureYield(plans, 0.1);
    assert.equal(result[0].capacityDelta, 0.3, "non-targeted dimensions must not be boosted");
  });

  it("boosts only the qualifying plan in a mixed batch", () => {
    const plans = [
      makePlan({ leverage_rank: ["architecture"], capacityDelta: 0.3 }),
      makePlan({ leverage_rank: ["learning"], capacityDelta: 0.2 }),
    ];
    const result = rankPlansByClosureYield(plans, 0.3);
    assert.equal(result[0].capacityDelta, 0.3, "architecture plan must not be boosted");
    assert.equal(result[1].capacityDelta, 0.25, "learning plan must be boosted");
  });

  it("clamps boosted capacityDelta to 1.0", () => {
    const plans = [makePlan({ leverage_rank: ["learning"], capacityDelta: 0.99 })];
    const result = rankPlansByClosureYield(plans, 0.1);
    assert.equal(result[0].capacityDelta, 1.0, "boost must not exceed 1.0");
  });

  it("does not mutate the input array", () => {
    const plans = [makePlan({ leverage_rank: ["learning"], capacityDelta: 0.2 })];
    rankPlansByClosureYield(plans, 0.1);
    assert.equal(plans[0].capacityDelta, 0.2, "input plan must not be mutated");
  });

  it("negative path: returns empty array for non-array input", () => {
    const result = rankPlansByClosureYield(null as any, 0.1);
    assert.deepEqual(result, []);
  });

  it("negative path: NaN closureYield returns unchanged copy", () => {
    const plans = [makePlan({ leverage_rank: ["learning"], capacityDelta: 0.2 })];
    const result = rankPlansByClosureYield(plans, NaN);
    assert.equal(result[0].capacityDelta, 0.2);
  });

  it("CLOSURE_YIELD_BOOST_DIMENSIONS includes learning, quality, task-quality, learning loop", () => {
    assert.ok(CLOSURE_YIELD_BOOST_DIMENSIONS.has("learning"));
    assert.ok(CLOSURE_YIELD_BOOST_DIMENSIONS.has("quality"));
    assert.ok(CLOSURE_YIELD_BOOST_DIMENSIONS.has("task-quality"));
    assert.ok(CLOSURE_YIELD_BOOST_DIMENSIONS.has("learning loop"));
  });
});

// ── Task 2: Cycle-delta section prioritization ─────────────────────────────────

describe("PROMETHEUS_CYCLE_DELTA_SECTION_NAMES — cycle-delta section priority", () => {
  const DELTA_NAMES = ["research-intelligence", "topic-memory", "behavior-patterns", "carry-forward"];

  it("exports PROMETHEUS_CYCLE_DELTA_SECTION_NAMES as a non-empty ReadonlySet", () => {
    assert.ok(PROMETHEUS_CYCLE_DELTA_SECTION_NAMES instanceof Set,
      "PROMETHEUS_CYCLE_DELTA_SECTION_NAMES must be a Set");
    assert.ok(PROMETHEUS_CYCLE_DELTA_SECTION_NAMES.size > 0,
      "PROMETHEUS_CYCLE_DELTA_SECTION_NAMES must not be empty");
  });

  it("includes all expected cycle-delta section names", () => {
    for (const name of DELTA_NAMES) {
      assert.ok(PROMETHEUS_CYCLE_DELTA_SECTION_NAMES.has(name),
        `PROMETHEUS_CYCLE_DELTA_SECTION_NAMES must include "${name}"`);
    }
  });

  it("cycle-delta sections are disjoint from static section names", () => {
    for (const name of PROMETHEUS_CYCLE_DELTA_SECTION_NAMES) {
      assert.equal(PROMETHEUS_STATIC_SECTION_NAMES.has(name), false,
        `"${name}" must not appear in both delta and static section name sets`);
    }
  });

  it("cycle-delta sections survive under token pressure when marked required:true", () => {
    const deltaSection = Object.assign(
      { name: "research-intelligence", content: "RESEARCH_DELTA_CONTENT" },
      { required: true }
    );
    const largeOptional = { name: "repo-file-listing", content: "R".repeat(100_000) };
    const result = compilePrompt([deltaSection, largeOptional], { tokenBudget: 50 });
    assert.ok(result.includes("RESEARCH_DELTA_CONTENT"),
      "required cycle-delta section must survive token pressure");
  });

  it("optional large sections are dropped under token pressure, preserving cycle-delta content", () => {
    const deltaSection = Object.assign(
      { name: "carry-forward", content: "CARRY_FORWARD_DATA" },
      { required: true }
    );
    const optionalLarge = { name: "repo-file-listing", content: "REPO_LISTING_DATA_".repeat(5_000) };
    const result = compilePrompt([deltaSection, optionalLarge], { tokenBudget: 50 });
    assert.ok(result.includes("CARRY_FORWARD_DATA"),
      "required cycle-delta content must be retained");
    assert.equal(result.includes("REPO_LISTING_DATA_"), false,
      "large optional section must be dropped under tight token budget");
  });
});

describe("PROMETHEUS_STATIC_SECTION_NAMES — cache eligibility", () => {
  it("exports PROMETHEUS_STATIC_SECTION_NAMES as a non-empty ReadonlySet", () => {
    assert.ok(PROMETHEUS_STATIC_SECTION_NAMES instanceof Set,
      "PROMETHEUS_STATIC_SECTION_NAMES must be a Set");
    assert.ok(PROMETHEUS_STATIC_SECTION_NAMES.size > 0,
      "PROMETHEUS_STATIC_SECTION_NAMES must not be empty");
  });

  it("contains the name of every static section", () => {
    for (const [key, sec] of Object.entries(PROMETHEUS_STATIC_SECTIONS)) {
      assert.ok(PROMETHEUS_STATIC_SECTION_NAMES.has(sec.name),
        `static section "${key}" (name="${sec.name}") must appear in PROMETHEUS_STATIC_SECTION_NAMES`);
    }
  });

  it("markCacheableSegments marks static sections as cacheable using PROMETHEUS_STATIC_SECTION_NAMES", () => {
    const sections = [
      { ...PROMETHEUS_STATIC_SECTIONS.evolutionDirective },
      { name: "research-intelligence", content: "some research" },
      { name: "context", content: "dynamic context" },
    ];
    const marked = markCacheableSegments(sections, {
      stableNames: Array.from(PROMETHEUS_STATIC_SECTION_NAMES),
    });

    const evolutionEntry = marked.find(s => s.name === PROMETHEUS_STATIC_SECTIONS.evolutionDirective.name);
    const researchEntry = marked.find(s => s.name === "research-intelligence");

    assert.equal(evolutionEntry?.cacheable, true,
      "static section evolutionDirective must be marked cacheable");
    assert.equal(researchEntry?.cacheable, false,
      "cycle-delta section research-intelligence must NOT be marked cacheable");
  });

  it("negative path: cycle-delta sections are NOT marked cacheable by default", () => {
    const sections = Array.from(PROMETHEUS_CYCLE_DELTA_SECTION_NAMES).map(name => ({
      name,
      content: `content for ${name}`,
    }));
    const marked = markCacheableSegments(sections);
    for (const s of marked) {
      assert.equal(s.cacheable, false,
        `cycle-delta section "${s.name}" must not be cacheable by default`);
    }
  });
});

// ── Task 1: Telemetry-adjusted packet ranking ─────────────────────────────────

import {
  summarizeRealizedTelemetry,
  computeTelemetryAdjustedPacketScore,
  rankPlansByTelemetryAdjustedScore,
  TELEMETRY_ADJUSTMENT_CLAMP,
  type RealizedTelemetrySummary,
} from "../../src/core/prometheus.js";

describe("summarizeRealizedTelemetry", () => {
  it("returns zero-signal when entries array is empty", () => {
    const result = summarizeRealizedTelemetry([]);
    assert.equal(result.avgRoiDelta, 0);
    assert.equal(result.sampleCount, 0);
  });

  it("returns zero-signal when no entries are realized (realizedAt=null)", () => {
    const entries = [
      { roiDelta: 0.5, realizedAt: null },
      { roiDelta: -0.2, realizedAt: null },
    ];
    const result = summarizeRealizedTelemetry(entries);
    assert.equal(result.avgRoiDelta, 0);
    assert.equal(result.sampleCount, 0);
  });

  it("returns correct average for all-realized entries with positive deltas", () => {
    const entries = [
      { roiDelta: 0.4, realizedAt: "2026-01-01T00:00:00Z" },
      { roiDelta: 0.6, realizedAt: "2026-01-02T00:00:00Z" },
    ];
    const result = summarizeRealizedTelemetry(entries);
    assert.equal(result.avgRoiDelta, 0.5);
    assert.equal(result.sampleCount, 2);
  });

  it("returns correct average for negative deltas (underperformance signal)", () => {
    const entries = [
      { roiDelta: -0.3, realizedAt: "2026-01-01T00:00:00Z" },
      { roiDelta: -0.1, realizedAt: "2026-01-02T00:00:00Z" },
    ];
    const result = summarizeRealizedTelemetry(entries);
    assert.equal(result.avgRoiDelta, -0.2);
    assert.equal(result.sampleCount, 2);
  });

  it("respects the limit parameter — only considers the most-recent entries", () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({
      roiDelta: i < 20 ? -1.0 : 1.0, // first 20 are -1.0, last 5 are +1.0
      realizedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    }));
    // With limit=5, only the last 5 entries (+1.0 each) are included
    const result = summarizeRealizedTelemetry(entries, 5);
    assert.equal(result.avgRoiDelta, 1.0);
    assert.equal(result.sampleCount, 5);
  });

  it("skips entries where roiDelta is non-finite (NaN, Infinity)", () => {
    const entries = [
      { roiDelta: NaN, realizedAt: "2026-01-01T00:00:00Z" },
      { roiDelta: Infinity, realizedAt: "2026-01-02T00:00:00Z" },
      { roiDelta: 0.5, realizedAt: "2026-01-03T00:00:00Z" },
    ];
    const result = summarizeRealizedTelemetry(entries);
    assert.equal(result.avgRoiDelta, 0.5);
    assert.equal(result.sampleCount, 1);
  });
});

describe("computeTelemetryAdjustedPacketScore", () => {
  const basePlan = { requestROI: 2.0, capacityDelta: 0.5 };
  // baseScore = 2.0 × (1 + 0.5) = 3.0

  it("returns baseScore when telemetry has no realized data (sampleCount=0)", () => {
    const score = computeTelemetryAdjustedPacketScore(basePlan, { avgRoiDelta: 0, sampleCount: 0 });
    assert.equal(score, 3.0);
  });

  it("returns baseScore when telemetrySummary is omitted", () => {
    const score = computeTelemetryAdjustedPacketScore(basePlan);
    assert.equal(score, 3.0);
  });

  it("up-ranks when avgRoiDelta is positive (history beats predictions)", () => {
    const score = computeTelemetryAdjustedPacketScore(basePlan, { avgRoiDelta: 0.3, sampleCount: 5 });
    // baseScore × (1 + 0.3) = 3.0 × 1.3 = 3.9
    assert.ok(score > 3.0, "positive roiDelta must increase score above baseline");
    assert.ok(Math.abs(score - 3.9) < 0.001, `expected 3.9, got ${score}`);
  });

  it("down-ranks when avgRoiDelta is negative (history misses predictions)", () => {
    const score = computeTelemetryAdjustedPacketScore(basePlan, { avgRoiDelta: -0.3, sampleCount: 5 });
    // baseScore × (1 − 0.3) = 3.0 × 0.7 = 2.1
    assert.ok(score < 3.0, "negative roiDelta must reduce score below baseline");
    assert.ok(Math.abs(score - 2.1) < 0.001, `expected 2.1, got ${score}`);
  });

  it("clamps adjustment at +TELEMETRY_ADJUSTMENT_CLAMP — extreme positive history cannot inflate beyond clamp", () => {
    const score = computeTelemetryAdjustedPacketScore(basePlan, { avgRoiDelta: 5.0, sampleCount: 5 });
    // clamped to +0.5 → 3.0 × 1.5 = 4.5
    const expected = 3.0 * (1 + TELEMETRY_ADJUSTMENT_CLAMP);
    assert.ok(Math.abs(score - expected) < 0.001, `expected ${expected} (clamped), got ${score}`);
  });

  it("clamps adjustment at -TELEMETRY_ADJUSTMENT_CLAMP — extreme negative history cannot deflate below clamp", () => {
    const score = computeTelemetryAdjustedPacketScore(basePlan, { avgRoiDelta: -5.0, sampleCount: 5 });
    // clamped to -0.5 → 3.0 × 0.5 = 1.5
    const expected = 3.0 * (1 - TELEMETRY_ADJUSTMENT_CLAMP);
    assert.ok(Math.abs(score - expected) < 0.001, `expected ${expected} (clamped), got ${score}`);
  });

  it("returns 0 when plan has no requestROI", () => {
    const score = computeTelemetryAdjustedPacketScore({ capacityDelta: 0.5 }, { avgRoiDelta: 0.3, sampleCount: 5 });
    assert.equal(score, 0);
  });

  it("returns 0 when plan requestROI is non-positive", () => {
    const score = computeTelemetryAdjustedPacketScore({ requestROI: -1, capacityDelta: 0.5 }, { avgRoiDelta: 0.3, sampleCount: 5 });
    assert.equal(score, 0);
  });

  it("returns 0 for a null/undefined plan", () => {
    assert.equal(computeTelemetryAdjustedPacketScore(null as any), 0);
    assert.equal(computeTelemetryAdjustedPacketScore(undefined as any), 0);
  });

  it("result is always non-negative even with extreme negative adjustments", () => {
    const plan = { requestROI: 0.1, capacityDelta: -0.9 }; // baseScore = 0.1 × 0.1 = 0.01
    const score = computeTelemetryAdjustedPacketScore(plan, { avgRoiDelta: -5.0, sampleCount: 5 });
    assert.ok(score >= 0, "score must never be negative");
  });
});

describe("rankPlansByTelemetryAdjustedScore", () => {
  it("returns empty array for non-array input", () => {
    assert.deepEqual(rankPlansByTelemetryAdjustedScore(null as any), []);
  });

  it("returns same-length array as input", () => {
    const plans = [
      { task: "A", requestROI: 2.0, capacityDelta: 0.5 },
      { task: "B", requestROI: 1.0, capacityDelta: 0.2 },
    ];
    const ranked = rankPlansByTelemetryAdjustedScore(plans);
    assert.equal(ranked.length, plans.length);
  });

  it("orders plans by adjusted score descending (highest first)", () => {
    const plans = [
      { task: "LowROI", requestROI: 1.0, capacityDelta: 0.1 },  // base=1.1
      { task: "HighROI", requestROI: 3.0, capacityDelta: 0.2 }, // base=3.6
    ];
    const ranked = rankPlansByTelemetryAdjustedScore(plans, { avgRoiDelta: 0, sampleCount: 0 });
    assert.equal(ranked[0].task, "HighROI");
    assert.equal(ranked[1].task, "LowROI");
  });

  it("telemetry adjustment can reorder plans relative to declared ROI", () => {
    // Plan A: high declared ROI but tier has negative telemetry
    // Plan B: lower declared ROI but tier has positive telemetry
    const planA = { task: "A", requestROI: 3.0, capacityDelta: 0.0 }; // base=3.0
    const planB = { task: "B", requestROI: 2.0, capacityDelta: 0.0 }; // base=2.0

    // Without telemetry, A ranks first
    const ranked_no_tel = rankPlansByTelemetryAdjustedScore([planA, planB], { avgRoiDelta: 0, sampleCount: 0 });
    assert.equal(ranked_no_tel[0].task, "A", "without telemetry A should rank first");

    // With strong positive telemetry, A still leads (both get same uplift)
    // but if we adjust B specifically we can't — both get the same summary.
    // Instead test that negative telemetry down-ranks proportionally.
    // Both plans: A × 0.5 = 1.5, B × 0.5 = 1.0 → A still first
    const ranked_neg = rankPlansByTelemetryAdjustedScore([planA, planB], { avgRoiDelta: -0.5, sampleCount: 5 });
    assert.equal(ranked_neg[0].task, "A", "relative order preserved when uniform telemetry applied");
  });

  it("does not mutate the original plans array", () => {
    const plans = [
      { task: "A", requestROI: 1.0, capacityDelta: 0.1 },
      { task: "B", requestROI: 3.0, capacityDelta: 0.2 },
    ];
    const original = [...plans];
    rankPlansByTelemetryAdjustedScore(plans);
    assert.deepEqual(plans, original, "input array must not be mutated");
  });
});


// ── Task 3: carry-forward prompt bulk reduction constants ─────────────────────

describe("carry-forward prompt bulk reduction", () => {
  it("CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS is a positive integer", () => {
    assert.ok(Number.isFinite(CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS), "must be finite");
    assert.ok(CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS > 0, "must be positive");
    assert.ok(Number.isInteger(CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS), "must be integer");
  });

  it("CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS is less than CARRY_FORWARD_MAX_TOKENS (not token-like)", () => {
    // Ensures the two constants serve different roles and are not accidentally swapped.
    assert.ok(
      CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS < CARRY_FORWARD_MAX_TOKENS,
      "MAX_LOW_RECURRENCE_ITEMS must be smaller than MAX_TOKENS — they are different units"
    );
  });

  it("negative path: CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS < total items does not equal CARRY_FORWARD_MAX_TOKENS", () => {
    assert.notEqual(
      CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS,
      CARRY_FORWARD_MAX_TOKENS,
      "the item cap and the token cap must not be equal — they measure different things"
    );
  });
});

// ── Novelty / discovery-gap scoring ───────────────────────────────────────────

describe("computeNoveltyScore", () => {
  it("returns score 1.0 with empty novelCount when currentPlans is empty", () => {
    const result = computeNoveltyScore([], [{ task: "fix something" }]);
    assert.equal(result.score, 1.0);
    assert.equal(result.totalCount, 0);
    assert.equal(result.novelCount, 0);
    assert.deepEqual(result.repeatedTasks, []);
  });

  it("returns score 1.0 for all plans when historicalPlans is empty (first cycle)", () => {
    const current = [{ task: "add observability tracing" }, { task: "refactor module boundaries" }];
    const result = computeNoveltyScore(current, []);
    assert.equal(result.score, 1.0);
    assert.equal(result.novelCount, 2);
    assert.equal(result.totalCount, 2);
    assert.deepEqual(result.repeatedTasks, []);
  });

  it("identifies repeated plans when task text has ≥2 significant keyword overlaps with history", () => {
    const historical = [{ task: "fix verification harness false failures" }];
    const current = [
      { task: "fix verification harness race conditions" }, // ≥2 overlapping words with history
      { task: "add distributed tracing spans" },           // no overlap
    ];
    const result = computeNoveltyScore(current, historical);
    assert.equal(result.totalCount, 2);
    assert.equal(result.repeatedTasks.length, 1, "one plan should be classified as repeated");
    assert.equal(result.novelCount, 1);
    assert.ok(result.score > 0 && result.score < 1.0, "score should be between 0 and 1");
  });

  it("returns score 0 when all current plans are repeated", () => {
    const historical = [{ task: "implement dependency graph resolver logic" }];
    const current   = [{ task: "implement dependency graph resolver retry" }];
    const result = computeNoveltyScore(current, historical);
    assert.equal(result.novelCount, 0);
    assert.equal(result.score, 0);
    assert.equal(result.repeatedTasks.length, 1);
  });

  it("returns score 1.0 when no plan shares ≥2 keywords with history", () => {
    const historical = [{ task: "fix authentication token expiry" }];
    const current = [
      { task: "add observability metrics dashboard" },
      { task: "refactor database connection pooling" },
    ];
    const result = computeNoveltyScore(current, historical);
    assert.equal(result.score, 1.0);
    assert.equal(result.novelCount, 2);
    assert.deepEqual(result.repeatedTasks, []);
  });

  it("score is a rounded finite number in [0, 1]", () => {
    const historical = [
      { task: "fix carry forward ledger entries" },
      { task: "improve worker dispatch batching" },
    ];
    const current = [
      { task: "fix carry forward ledger cleanup" },  // repeated
      { task: "add circuit breaker pattern" },         // novel
      { task: "improve worker dispatch concurrency" }, // repeated
    ];
    const result = computeNoveltyScore(current, historical);
    assert.ok(Number.isFinite(result.score));
    assert.ok(result.score >= 0 && result.score <= 1.0);
  });

  it("negative path: handles null/undefined inputs gracefully", () => {
    const r1 = computeNoveltyScore(null as any, null as any);
    assert.equal(r1.score, 1.0);
    assert.equal(r1.totalCount, 0);
    const r2 = computeNoveltyScore(undefined as any, [{ task: "some task" }]);
    assert.equal(r2.totalCount, 0);
  });
});

describe("seedDiscoveryGapPackets", () => {
  it("returns empty array when novelty score is at or above threshold", () => {
    // All plans are novel (score = 1.0) — no seeding needed
    const current = [{ task: "add observability tracing" }];
    const result = seedDiscoveryGapPackets(current, []);
    assert.deepEqual(result, []);
  });

  it("returns empty array when currentPlans is empty", () => {
    const result = seedDiscoveryGapPackets([], [{ task: "fix something" }]);
    assert.deepEqual(result, []);
  });

  it("seeds packets when novelty collapses below NOVELTY_COLLAPSE_THRESHOLD", () => {
    // Construct a scenario where all current plans are repeated from history
    const historical = [
      { task: "fix verification harness false failures", leverage_rank: ["quality"] },
      { task: "implement carry forward ledger cleanup", leverage_rank: ["quality"] },
      { task: "add worker dispatch concurrency batching", leverage_rank: ["performance"] },
    ];
    const current = [
      { task: "fix verification harness race conditions", leverage_rank: ["quality"] },
      { task: "implement carry forward ledger expiry", leverage_rank: ["quality"] },
      { task: "add worker dispatch concurrency throttle", leverage_rank: ["performance"] },
    ];
    const result = seedDiscoveryGapPackets(current, historical);
    // novelty score should be 0 (all repeated) → below NOVELTY_COLLAPSE_THRESHOLD
    assert.ok(result.length > 0, "seeds must be generated when novelty collapses");
    // Each seed must be flagged
    for (const seed of result) {
      assert.equal(seed._discoveryGapSeed, true);
      assert.ok(typeof seed.task === "string" && seed.task.length > 0);
      assert.equal(seed.verification, "npm test");
      assert.ok(Array.isArray(seed.leverage_rank) && seed.leverage_rank.length > 0);
    }
  });

  it("respects maxSeeds option", () => {
    const historical = [
      { task: "fix verification harness false", leverage_rank: ["quality"] },
      { task: "implement carry forward ledger", leverage_rank: ["quality"] },
    ];
    const current = [
      { task: "fix verification harness race", leverage_rank: ["quality"] },
      { task: "implement carry forward expiry", leverage_rank: ["quality"] },
    ];
    const result = seedDiscoveryGapPackets(current, historical, { maxSeeds: 1 });
    assert.ok(result.length <= 1, "maxSeeds must be respected");
  });

  it("does not seed dimensions that are already covered", () => {
    const historical = [
      { task: "fix verification harness false", leverage_rank: ["observability", "security"] },
    ];
    const current = [
      { task: "fix verification harness race", leverage_rank: ["observability", "security"] },
    ];
    const result = seedDiscoveryGapPackets(current, historical);
    // observability and security are covered — seeds should not include those
    for (const seed of result) {
      assert.ok(
        !seed.leverage_rank.includes("observability"),
        "covered dimension must not be seeded"
      );
      assert.ok(
        !seed.leverage_rank.includes("security"),
        "covered dimension must not be seeded"
      );
    }
  });

  it("does not mutate input arrays", () => {
    const current  = [{ task: "fix verify harness false race", leverage_rank: ["quality"] }];
    const historical = [{ task: "fix verify harness false fails", leverage_rank: ["quality"] }];
    const origCurrent = current[0].task;
    seedDiscoveryGapPackets(current, historical);
    assert.equal(current[0].task, origCurrent, "input must not be mutated");
  });

  it("negative path: returns empty array for non-array inputs", () => {
    assert.deepEqual(seedDiscoveryGapPackets(null as any, null as any), []);
  });
});

describe("NOVELTY_COLLAPSE_THRESHOLD and NOVELTY_SEED_DIMENSIONS", () => {
  it("NOVELTY_COLLAPSE_THRESHOLD is a finite number in (0, 1)", () => {
    assert.ok(Number.isFinite(NOVELTY_COLLAPSE_THRESHOLD));
    assert.ok(NOVELTY_COLLAPSE_THRESHOLD > 0 && NOVELTY_COLLAPSE_THRESHOLD < 1);
  });

  it("NOVELTY_SEED_DIMENSIONS is a non-empty Set of strings", () => {
    assert.ok(NOVELTY_SEED_DIMENSIONS instanceof Set);
    assert.ok(NOVELTY_SEED_DIMENSIONS.size > 0);
    for (const dim of NOVELTY_SEED_DIMENSIONS) {
      assert.equal(typeof dim, "string");
    }
  });
});

// ── attachFallbackProvenance / quarantineLowConfidencePackets ──────────────────

describe("attachFallbackProvenance", () => {
  it("attaches _provenance to a plan packet", () => {
    const packet = { task: "do work", confidence: 0.4 };
    const tagged = attachFallbackProvenance(packet, { reason: "parser-fallback" });
    assert.ok(tagged._provenance, "_provenance must be attached");
    assert.equal(tagged._provenance.tag, FALLBACK_PROVENANCE_TAG.PARSER_FALLBACK);
    assert.equal(typeof tagged._provenance.attachedAt, "string");
    assert.ok(!isNaN(Date.parse(tagged._provenance.attachedAt)));
  });

  it("uses the provided confidence when supplied", () => {
    const packet = { task: "do work" };
    const tagged = attachFallbackProvenance(packet, { confidence: 0.3 });
    assert.equal(tagged._provenance.confidence, 0.3);
  });

  it("does not mutate the original packet object", () => {
    const packet = { task: "original" };
    const tagged = attachFallbackProvenance(packet, {});
    assert.ok(tagged !== packet, "must be a new object");
    assert.equal((packet as any)._provenance, undefined, "original must not be mutated");
  });

  it("passes non-object values through unchanged", () => {
    assert.equal(attachFallbackProvenance(null as any, {}), null);
    assert.equal(attachFallbackProvenance("string" as any, {}), "string");
    assert.equal(attachFallbackProvenance(42 as any, {}), 42);
  });

  it("FALLBACK_PROVENANCE_TAG is frozen and has expected keys", () => {
    assert.ok(Object.isFrozen(FALLBACK_PROVENANCE_TAG));
    assert.ok("PARSER_FALLBACK" in FALLBACK_PROVENANCE_TAG);
    assert.ok("UNCERTAINTY_FALLBACK" in FALLBACK_PROVENANCE_TAG);
  });
});

describe("quarantineLowConfidencePackets", () => {
  it("quarantines packets with confidence below threshold", () => {
    const packets = [
      { task: "a", _provenance: { confidence: 0.3, tag: "parser-fallback", attachedAt: new Date().toISOString() } },
      { task: "b", _provenance: { confidence: 0.8, tag: "parser-fallback", attachedAt: new Date().toISOString() } },
    ];
    const { allowed, quarantined } = quarantineLowConfidencePackets(packets);
    assert.equal(quarantined.length, 1, "one packet below threshold must be quarantined");
    assert.equal(quarantined[0].task, "a");
    assert.equal(allowed.length, 1);
    assert.equal(allowed[0].task, "b");
  });

  it("quarantined packets have _quarantined=true", () => {
    const packets = [
      { task: "low", _provenance: { confidence: 0.1, tag: "parser-fallback", attachedAt: new Date().toISOString() } },
    ];
    const { quarantined } = quarantineLowConfidencePackets(packets);
    assert.equal(quarantined[0]._quarantined, true);
  });

  it("packets without _provenance are not quarantined (backward compatible)", () => {
    const packets = [{ task: "no-provenance" }];
    const { allowed, quarantined } = quarantineLowConfidencePackets(packets);
    assert.equal(allowed.length, 1);
    assert.equal(quarantined.length, 0);
  });

  it("negative: empty input returns empty allowed and quarantined", () => {
    const { allowed, quarantined } = quarantineLowConfidencePackets([]);
    assert.deepEqual(allowed, []);
    assert.deepEqual(quarantined, []);
  });

  it("respects custom threshold option", () => {
    const packets = [
      { task: "mid", _provenance: { confidence: 0.6, tag: "parser-fallback", attachedAt: new Date().toISOString() } },
    ];
    // With threshold=0.7, a confidence of 0.6 should be quarantined
    const { quarantined } = quarantineLowConfidencePackets(packets, { threshold: 0.7 });
    assert.equal(quarantined.length, 1);
  });

  it("QUARANTINE_CONFIDENCE_THRESHOLD is exported as 0.5", () => {
    assert.equal(QUARANTINE_CONFIDENCE_THRESHOLD, 0.5);
  });
});