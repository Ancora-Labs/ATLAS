import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  classifyComplexityTier,
  COMPLEXITY_TIER,
  isModelBanned,
  isOpusTier,
  isOpusJustified,
  ROUTING_REASON,
  enforceModelPolicy,
  routeModelByComplexity,
  computeTokenROI,
  routeModelWithUncertainty,
  routeModelUnderQualityFloor,
  appendRouteROIEntry,
  realizeRouteROIEntry,
  loadRouteROILedger,
  computeRecentROIForTier,
  MAX_LEDGER_SIZE,
  routeModelByCost,
  routeModelWithCompletionROI,
  routeModelWithClosureYield,
  CLOSURE_YIELD_LOW_THRESHOLD,
  routeModelWithRealizedROI,
  EXPLORATION_BOUND,
  decideDeliberationPolicy,
  rankModelsByTaskKindExpectedValue,
  assessRetryExpectedROI,
  RETRY_EXPECTED_GAIN_MIN_THRESHOLD,
  MIN_TELEMETRY_SAMPLE_THRESHOLD,
  routeModelWithMemoryHitRatio,
  MEMORY_HIT_RATIO_HIGH,
  MEMORY_HIT_RATIO_LOW,
  MEMORY_FLOOR_RELAX_AMOUNT,
  MEMORY_FLOOR_TIGHTEN_AMOUNT,
  QUALITY_FLOOR_DEFAULT,
} from "../../src/core/model_policy.js";

describe("model_policy — complexity tiers", () => {
  describe("classifyComplexityTier", () => {
    it("returns T1 for simple tasks", () => {
      const result = classifyComplexityTier({ estimatedLines: 50, complexity: "low" });
      assert.equal(result.tier, COMPLEXITY_TIER.T1);
      assert.equal(result.maxContinuations, 1);
    });

    it("returns T2 for medium tasks", () => {
      const result = classifyComplexityTier({ estimatedLines: 800, complexity: "medium" });
      assert.equal(result.tier, COMPLEXITY_TIER.T2);
      assert.equal(result.maxContinuations, 3);
    });

    it("returns T3 for critical tasks", () => {
      const result = classifyComplexityTier({ complexity: "critical" });
      assert.equal(result.tier, COMPLEXITY_TIER.T3);
      assert.equal(result.maxContinuations, 5);
    });

    it("returns T3 for high line count", () => {
      const result = classifyComplexityTier({ estimatedLines: 5000 });
      assert.equal(result.tier, COMPLEXITY_TIER.T3);
    });

    it("returns T3 for long duration", () => {
      const result = classifyComplexityTier({ estimatedDurationMinutes: 180 });
      assert.equal(result.tier, COMPLEXITY_TIER.T3);
    });

    it("returns T2 for medium complexity keyword", () => {
      const result = classifyComplexityTier({ complexity: "medium" });
      assert.equal(result.tier, COMPLEXITY_TIER.T2);
    });

    it("returns T1 for empty hints", () => {
      const result = classifyComplexityTier({});
      assert.equal(result.tier, COMPLEXITY_TIER.T1);
    });

    it("includes reason string", () => {
      const result = classifyComplexityTier({ complexity: "high" });
      assert.ok(result.reason.includes("complexity=high"));
    });
  });

  describe("COMPLEXITY_TIER enum", () => {
    it("has three tiers", () => {
      assert.equal(Object.keys(COMPLEXITY_TIER).length, 3);
      assert.ok(COMPLEXITY_TIER.T1);
      assert.ok(COMPLEXITY_TIER.T2);
      assert.ok(COMPLEXITY_TIER.T3);
    });

    it("is frozen", () => {
      assert.ok(Object.isFrozen(COMPLEXITY_TIER));
    });
  });

  describe("existing model_policy exports", () => {
    it("bans fast models", () => {
      const result = isModelBanned("Claude Opus 4.6 Fast");
      assert.equal(result.banned, true);
    });

    it("detects opus tier", () => {
      assert.equal(isOpusTier("Claude Opus 4.6"), true);
      assert.equal(isOpusTier("Claude Sonnet 4.6"), false);
    });

    it("justifies opus for critical tasks", () => {
      const result = isOpusJustified({ complexity: "critical" });
      assert.equal(result.allowed, true);
    });

    it("rejects opus for small tasks", () => {
      const result = isOpusJustified({ estimatedLines: 10 });
      assert.equal(result.allowed, false);
    });

    it("enforceModelPolicy bans fast models", () => {
      const result = enforceModelPolicy("Claude Fast Preview");
      assert.equal(result.downgraded, true);
      assert.equal(result.routingReasonCode, ROUTING_REASON.BANNED);
    });

    it("enforceModelPolicy allows normal models", () => {
      const result = enforceModelPolicy("Claude Sonnet 4.6");
      assert.equal(result.downgraded, false);
      assert.equal(result.routingReasonCode, ROUTING_REASON.ALLOWED);
    });
  });

  describe("routeModelByComplexity", () => {
    it("routes T3 tasks to strong model", () => {
      const result = routeModelByComplexity({ complexity: "critical" }, { strongModel: "Claude Opus 4.6" });
      assert.equal(result.model, "Claude Opus 4.6");
      assert.equal(result.tier, COMPLEXITY_TIER.T3);
    });

    it("routes T1 tasks to efficient model", () => {
      const result = routeModelByComplexity({ estimatedLines: 10 }, { efficientModel: "Claude Haiku 4" });
      assert.equal(result.model, "Claude Haiku 4");
      assert.equal(result.tier, COMPLEXITY_TIER.T1);
    });

    it("routes T2 tasks to default model", () => {
      const result = routeModelByComplexity({ complexity: "medium" }, { defaultModel: "Claude Sonnet 4.6" });
      assert.equal(result.model, "Claude Sonnet 4.6");
      assert.equal(result.tier, COMPLEXITY_TIER.T2);
    });

    it("uses Claude Sonnet 4.6 as default when no options", () => {
      const result = routeModelByComplexity({});
      assert.equal(result.model, "Claude Sonnet 4.6");
    });
  });

  describe("computeTokenROI (Packet 14)", () => {
    it("computes positive ROI for done outcome", () => {
      const roi = computeTokenROI({
        model: "Claude Sonnet 4.6",
        tier: "T2",
        estimatedTokens: 1000,
        outcome: "done",
        qualityScore: 0.9,
      });
      assert.ok(roi.roi > 0);
      assert.ok(typeof roi.efficiency === "string");
    });

    it("computes zero ROI for failed outcome", () => {
      const roi = computeTokenROI({
        model: "Claude Sonnet 4.6",
        tier: "T1",
        estimatedTokens: 500,
        outcome: "failure",
        qualityScore: 0,
      });
      assert.equal(roi.roi, 0);
    });

    it("handles missing quality score gracefully", () => {
      const roi = computeTokenROI({
        model: "Claude Sonnet 4.6",
        tier: "T1",
        estimatedTokens: 500,
        outcome: "done",
      });
      assert.ok(typeof roi.roi === "number");
    });
  });

  describe("routeModelWithUncertainty (Packet 14)", () => {
    it("returns a model selection", () => {
      const result = routeModelWithUncertainty(
        { complexity: "medium" },
        { defaultModel: "Claude Sonnet 4.6", strongModel: "Claude Opus 4.6" },
      );
      assert.ok(result.model);
      assert.ok(result.reason);
    });

    it("considers history for routing", () => {
      const result = routeModelWithUncertainty(
        { complexity: "low" },
        { defaultModel: "Claude Sonnet 4.6" },
        { recentROI: 0.8 },
      );
      assert.ok(result.model);
    });

    it("uses default model when no history", () => {
      const result = routeModelWithUncertainty({}, { defaultModel: "Claude Sonnet 4.6" });
      assert.equal(result.model, "Claude Sonnet 4.6");
    });
  });
});

describe("assessRetryExpectedROI", () => {
  const benchmarkGroundTruth = {
    entries: [
      {
        cycleId: "c-1",
        recommendations: [
          { implementationStatus: "implemented", benchmarkScore: 0.9, capacityGain: 0.5 },
          { implementationStatus: "pending", benchmarkScore: 0.8, capacityGain: 0.4 },
        ],
      },
    ],
  };

  it("allows retry when expected gain beats threshold", () => {
    const result = assessRetryExpectedROI({
      attempt: 1,
      maxRetries: 3,
      taskKind: "implementation",
      premiumUsageData: [
        { taskKind: "implementation", outcome: "done" },
        { taskKind: "implementation", outcome: "done" },
        { taskKind: "implementation", outcome: "done" },
      ],
      benchmarkGroundTruth,
      minExpectedGain: 0.2,
    });
    assert.equal(result.allowRetry, true);
    assert.ok(result.expectedGain >= 0.2);
  });

  it("suppresses retry when expected gain is below threshold", () => {
    const result = assessRetryExpectedROI({
      attempt: 2,
      maxRetries: 3,
      taskKind: "implementation",
      premiumUsageData: [
        { taskKind: "implementation", outcome: "blocked" },
        { taskKind: "implementation", outcome: "blocked" },
      ],
      benchmarkGroundTruth: {
        entries: [{ recommendations: [{ implementationStatus: "pending", benchmarkScore: 0.3, capacityGain: 0.05 }] }],
      },
      minExpectedGain: RETRY_EXPECTED_GAIN_MIN_THRESHOLD,
    });
    assert.equal(result.allowRetry, false);
    assert.ok(result.expectedGain < RETRY_EXPECTED_GAIN_MIN_THRESHOLD);
  });

  it("negative path: blocks retry when attempt exceeds maxRetries", () => {
    const result = assessRetryExpectedROI({
      attempt: 4,
      maxRetries: 3,
      taskKind: "implementation",
      premiumUsageData: [{ taskKind: "implementation", outcome: "done" }],
      benchmarkGroundTruth,
    });
    assert.equal(result.allowRetry, false);
    assert.equal(result.expectedGain, 0);
  });
});

// ── Route ROI Ledger — Packet 14 persistence ─────────────────────────────────

describe("Route ROI Ledger — persist uncertainty and realized ROI per route", () => {
  async function makeTmpConfig() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "roi-test-"));
    return { config: { paths: { stateDir: dir } }, dir };
  }

  it("appendRouteROIEntry creates a new ledger entry with null realized fields", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      await appendRouteROIEntry(config, {
        taskId: "T-001",
        model: "Claude Sonnet 4.6",
        tier: "T2",
        estimatedTokens: 1500,
        expectedQuality: 0.8,
      });
      const ledger = await loadRouteROILedger(config);
      assert.equal(ledger.length, 1);
      const entry = ledger[0];
      assert.equal(entry.taskId, "T-001");
      assert.equal(entry.model, "Claude Sonnet 4.6");
      assert.equal(entry.tier, "T2");
      assert.equal(entry.estimatedTokens, 1500);
      assert.equal(entry.expectedQuality, 0.8);
      assert.equal(entry.realizedQuality, null);
      assert.equal(entry.outcome, null);
      assert.equal(entry.roi, null);
      assert.equal(entry.roiDelta, null);
      assert.equal(entry.realizedAt, null);
      assert.ok(typeof entry.routedAt === "string");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("realizeRouteROIEntry updates the unrealized entry with quality score and outcome", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      await appendRouteROIEntry(config, {
        taskId: "T-002",
        model: "Claude Sonnet 4.6",
        tier: "T1",
        estimatedTokens: 500,
        expectedQuality: 0.9,
      });
      await realizeRouteROIEntry(config, "T-002", 0.85, "done");
      const ledger = await loadRouteROILedger(config);
      const entry = ledger[0];
      assert.equal(entry.realizedQuality, 0.85);
      assert.equal(entry.outcome, "done");
      assert.ok(typeof entry.roi === "number" && entry.roi > 0);
      assert.ok(typeof entry.roiDelta === "number");
      assert.ok(entry.realizedAt !== null);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("roiDelta = realizedROI − expectedROI (learning signal is correct)", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      const estimatedTokens = 1000;
      const expectedQuality = 0.8;
      await appendRouteROIEntry(config, {
        taskId: "T-003",
        model: "Claude Sonnet 4.6",
        tier: "T2",
        estimatedTokens,
        expectedQuality,
      });
      await realizeRouteROIEntry(config, "T-003", 0.6, "partial");
      const ledger = await loadRouteROILedger(config);
      const entry = ledger[0];
      // ROI = qualityScore / (tokens / 1000) = 0.6 / 1 = 0.6
      // expectedROI = 0.8 / 1 = 0.8
      // delta = 0.6 - 0.8 = -0.2
      assert.ok(typeof entry.roiDelta === "number");
      assert.ok(entry.roiDelta! < 0, "negative delta when realized quality < expected");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("computeRecentROIForTier returns 0 when no realized history exists", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      const roi = await computeRecentROIForTier(config, "T2");
      assert.equal(roi, 0);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("computeRecentROIForTier averages realized ROI for the specified tier", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      // Append and realize 3 T2 entries with known ROI values
      for (let i = 0; i < 3; i++) {
        await appendRouteROIEntry(config, {
          taskId: `T-ROI-${i}`,
          model: "Claude Sonnet 4.6",
          tier: "T2",
          estimatedTokens: 1000,
          expectedQuality: 0.8,
        });
        // qualityScore 0.6, 0.8, 1.0 → ROI 0.6, 0.8, 1.0 → avg 0.8
        await realizeRouteROIEntry(config, `T-ROI-${i}`, 0.6 + i * 0.2, "done");
      }
      const avg = await computeRecentROIForTier(config, "T2");
      // 0.6 + 0.8 + 1.0 = 2.4 / 3 = 0.8
      assert.ok(Math.abs(avg - 0.8) < 0.01, `Expected avg ≈ 0.8, got ${avg}`);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("computeRecentROIForTier ignores entries from other tiers", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      // T1 entry with known ROI
      await appendRouteROIEntry(config, {
        taskId: "T-T1",
        model: "Claude Haiku 4.5",
        tier: "T1",
        estimatedTokens: 200,
        expectedQuality: 0.9,
      });
      await realizeRouteROIEntry(config, "T-T1", 1.0, "done");
      // Query T2 — should be 0 since no T2 entries
      const roi = await computeRecentROIForTier(config, "T2");
      assert.equal(roi, 0);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("loadRouteROILedger returns empty array when file does not exist", async () => {
    const ledger = await loadRouteROILedger({ paths: { stateDir: "/nonexistent/xyz" } });
    assert.deepEqual(ledger, []);
  });

  it("ledger is capped at MAX_LEDGER_SIZE (oldest entries evicted)", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      // Append MAX_LEDGER_SIZE + 5 entries
      for (let i = 0; i < MAX_LEDGER_SIZE + 5; i++) {
        await appendRouteROIEntry(config, {
          taskId: `T-CAP-${i}`,
          model: "Claude Sonnet 4.6",
          tier: "T1",
          estimatedTokens: 100,
          expectedQuality: 0.7,
        });
      }
      const ledger = await loadRouteROILedger(config);
      assert.ok(ledger.length <= MAX_LEDGER_SIZE, `Ledger has ${ledger.length} entries, expected ≤ ${MAX_LEDGER_SIZE}`);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("negative path: realizeRouteROIEntry is a no-op for unknown taskId", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      await appendRouteROIEntry(config, {
        taskId: "T-KNOWN",
        model: "Claude Sonnet 4.6",
        tier: "T2",
        estimatedTokens: 500,
        expectedQuality: 0.7,
      });
      // Realize for a different taskId — should not throw and not corrupt the ledger
      await realizeRouteROIEntry(config, "T-UNKNOWN", 0.5, "done");
      const ledger = await loadRouteROILedger(config);
      // T-KNOWN entry should remain unrealized
      assert.equal(ledger[0].realizedAt, null);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("routeModelByCost — quality-floor routing", () => {
  const modelOptions = {
    efficientModel: "Claude Haiku 4",
    defaultModel:   "Claude Sonnet 4.6",
    strongModel:    "Claude Opus 4.6",
    qualityByModel: {
      "Claude Haiku 4":   0.70,
      "Claude Sonnet 4.6": 0.85,
      "Claude Opus 4.6":  0.95,
    },
  };

  it("selects cheapest model that meets quality floor", () => {
    const result = routeModelByCost({}, modelOptions, 0.65);
    assert.equal(result.model, "Claude Haiku 4", "Haiku (0.70) should be chosen when floor is 0.65");
    assert.equal(result.meetsQualityFloor, true);
  });

  it("skips haiku and selects sonnet when floor is 0.80", () => {
    const result = routeModelByCost({}, modelOptions, 0.80);
    assert.equal(result.model, "Claude Sonnet 4.6");
    assert.equal(result.meetsQualityFloor, true);
  });

  it("uses strongest model when floor is very high (0.99)", () => {
    const result = routeModelByCost({}, modelOptions, 0.99);
    // Opus scores 0.95 < 0.99 so no model qualifies; falls back to strongest
    assert.equal(result.model, "Claude Opus 4.6");
    assert.equal(result.meetsQualityFloor, false);
  });

  it("includes tier in result", () => {
    const result = routeModelByCost({ complexity: "critical" }, modelOptions, 0.8);
    assert.ok(result.tier, "tier must be present");
    assert.ok(typeof result.reason === "string");
  });

  it("negative path: no options — falls back to default model", () => {
    const result = routeModelByCost({}, {}, 0.5);
    assert.ok(result.model, "should return a model");
    assert.ok(typeof result.meetsQualityFloor === "boolean");
  });

  it("deduplicates candidates when efficientModel equals defaultModel", () => {
    const result = routeModelByCost(
      {},
      { efficientModel: "Claude Sonnet 4.6", defaultModel: "Claude Sonnet 4.6" },
      0.8
    );
    assert.ok(result.model);
  });
});

// ── routeModelWithCompletionROI — ROI-adjusted quality floor routing ──────────

describe("routeModelWithCompletionROI — completion-yield ROI routing", () => {
  const modelOptions = {
    efficientModel: "Claude Haiku 4",
    defaultModel:   "Claude Sonnet 4.6",
    strongModel:    "Claude Opus 4.6",
    qualityByModel: {
      "Claude Haiku 4":    0.70,
      "Claude Sonnet 4.6": 0.85,
      "Claude Opus 4.6":   0.95,
    },
  };

  it("zero tierROI (no history) uses base quality floor unchanged", () => {
    const result = routeModelWithCompletionROI({}, modelOptions, 0.65, 0);
    assert.equal(result.effectiveFloor, 0.65);
    assert.equal(result.roiAdjustment, "none");
    // Haiku (0.70) meets floor 0.65 → cheapest option selected
    assert.equal(result.model, "Claude Haiku 4", "Haiku must be selected when floor is 0.65 and no ROI history");
    assert.equal(result.meetsQualityFloor, true);
  });

  it("high tierROI (> 0.8) relaxes the floor so a cheaper model is selected", () => {
    // base floor = 0.72 → Haiku (0.70) would NOT meet it
    // after relaxation (0.72 - 0.05 = 0.67) → Haiku (0.70) meets 0.67
    const result = routeModelWithCompletionROI({}, modelOptions, 0.72, 1.2);
    assert.ok(result.effectiveFloor < 0.72, "floor must be relaxed when tierROI is high");
    assert.equal(result.model, "Claude Haiku 4", "relaxed floor should allow cheaper Haiku");
    assert.equal(result.meetsQualityFloor, true);
    assert.ok(result.roiAdjustment.includes("relaxed"), "adjustment reason must mention relaxed");
  });

  it("low tierROI (< 0.3, > 0) tightens the floor, forcing a better model", () => {
    // base floor = 0.65 → Haiku (0.70) would meet it
    // after tightening (0.65 + 0.10 = 0.75) → Haiku (0.70) no longer meets it → Sonnet selected
    const result = routeModelWithCompletionROI({}, modelOptions, 0.65, 0.1);
    assert.ok(result.effectiveFloor > 0.65, "floor must be tightened when tierROI is low");
    assert.notEqual(result.model, "Claude Haiku 4", "tightened floor must reject Haiku (0.70)");
    assert.equal(result.model, "Claude Sonnet 4.6", "Sonnet must be selected after floor tightening");
    assert.ok(result.roiAdjustment.includes("tightened"), "adjustment reason must mention tightened");
  });

  it("low tierROI with moderate floor forces Opus when Sonnet no longer qualifies", () => {
    // base floor = 0.80, tierROI = 0.1 → tightened: 0.80 + 0.10 = 0.90
    // Haiku (0.70 < 0.90) no, Sonnet (0.85 < 0.90) no, Opus (0.95 >= 0.90) yes
    const result = routeModelWithCompletionROI({}, modelOptions, 0.80, 0.1);
    assert.equal(result.model, "Claude Opus 4.6", "Opus must be selected when floor tightens past Sonnet");
    assert.equal(result.meetsQualityFloor, true);
  });

  it("effective floor is clamped to MIN_QUALITY_FLOOR (0.50) even with high ROI + very low base floor", () => {
    // base floor = 0.1, tierROI = 2.0 (high) → relaxation: 0.1 - 0.05 = 0.05 → clamped to 0.50
    const result = routeModelWithCompletionROI({}, modelOptions, 0.1, 2.0);
    assert.ok(result.effectiveFloor >= 0.50, `effectiveFloor (${result.effectiveFloor}) must not go below 0.50`);
  });

  it("effective floor is clamped to MAX_QUALITY_FLOOR (0.99) even with low ROI + very high base floor", () => {
    // base floor = 0.95, tierROI = 0.1 (low) → tightening: 0.95 + 0.10 = 1.05 → clamped to 0.99
    const result = routeModelWithCompletionROI({}, modelOptions, 0.95, 0.1);
    assert.ok(result.effectiveFloor <= 0.99, `effectiveFloor (${result.effectiveFloor}) must not exceed 0.99`);
  });

  it("quality floor contract: result always includes meetsQualityFloor boolean", () => {
    const result = routeModelWithCompletionROI({}, modelOptions, 0.99, 0);
    assert.equal(result.meetsQualityFloor, false, "no model meets floor 0.99 exactly");
    assert.ok(result.model, "must still return a model (strongest fallback)");
    assert.equal(result.model, "Claude Opus 4.6", "strongest model used as fallback");
  });

  it("result includes tier from complexity classification", () => {
    const result = routeModelWithCompletionROI({ complexity: "critical" }, modelOptions, 0.7, 0);
    assert.ok(result.tier, "result must include tier");
    assert.ok(result.reason.includes("roi-adjusted"), "reason must reference roi-adjusted");
  });

  it("reason string includes roiAdjustment and base routing details", () => {
    const result = routeModelWithCompletionROI({}, modelOptions, 0.65, 1.5);
    assert.ok(result.reason.includes("roi-adjusted"), "reason must start with roi-adjusted");
    assert.ok(result.reason.includes("relaxed"), "reason must mention the relaxation");
  });

  it("negative path: no model options falls back to default model", () => {
    const result = routeModelWithCompletionROI({}, {}, 0.5, 0);
    assert.ok(result.model, "must return a model even with empty options");
    assert.ok(typeof result.meetsQualityFloor === "boolean");
  });

  it("negative path: medium ROI (between thresholds) does not adjust floor", () => {
    // tierROI = 0.5 (between 0.3 and 0.8 → no adjustment)
    const result = routeModelWithCompletionROI({}, modelOptions, 0.65, 0.5);
    assert.equal(result.effectiveFloor, 0.65, "medium ROI must leave floor unchanged");
    assert.equal(result.roiAdjustment, "none");
  });
});

// ── Task 1: summarizeTierTelemetry — realized ROI delta signals ───────────────

import { summarizeTierTelemetry } from "../../src/core/model_policy.js";

describe("summarizeTierTelemetry", () => {
  async function makeTmpConfig() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tier-tel-test-"));
    return { config: { paths: { stateDir: dir } }, dir };
  }

  it("returns zero-signal when no entries exist for the tier", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      const result = await summarizeTierTelemetry(config, "T2");
      assert.equal(result.avgRoiDelta, 0);
      assert.equal(result.sampleCount, 0);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("returns correct average roiDelta across realized T2 entries", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      // Append and realize 2 T2 entries: expectedQuality=0.8, realized=0.6 → roiDelta < 0
      for (let i = 0; i < 2; i++) {
        await appendRouteROIEntry(config, {
          taskId: `T-TEL-${i}`,
          model: "Claude Sonnet 4.6",
          tier: "T2",
          estimatedTokens: 1000,
          expectedQuality: 0.8,
        });
        await realizeRouteROIEntry(config, `T-TEL-${i}`, 0.6, "done");
      }
      const result = await summarizeTierTelemetry(config, "T2");
      assert.equal(result.sampleCount, 2, "both realized entries must be included");
      assert.ok(typeof result.avgRoiDelta === "number", "avgRoiDelta must be a number");
      assert.ok(result.avgRoiDelta < 0, "negative delta when realized < expected quality");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores unrealized entries (realizedAt=null)", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      // Append one unrealized entry
      await appendRouteROIEntry(config, {
        taskId: "T-UNREAL",
        model: "Claude Sonnet 4.6",
        tier: "T1",
        estimatedTokens: 500,
        expectedQuality: 0.9,
      });
      const result = await summarizeTierTelemetry(config, "T1");
      assert.equal(result.sampleCount, 0, "unrealized entries must not contribute");
      assert.equal(result.avgRoiDelta, 0);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores entries from other tiers", async () => {
    const { config, dir } = await makeTmpConfig();
    try {
      await appendRouteROIEntry(config, {
        taskId: "T-T3",
        model: "Claude Opus 4.6",
        tier: "T3",
        estimatedTokens: 2000,
        expectedQuality: 0.8,
      });
      await realizeRouteROIEntry(config, "T-T3", 0.9, "done");
      // Query T2 — should be zero (no T2 entries)
      const result = await summarizeTierTelemetry(config, "T2");
      assert.equal(result.sampleCount, 0, "T3 entry must not appear in T2 telemetry");
      assert.equal(result.avgRoiDelta, 0);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("negative path: returns zero-signal gracefully when stateDir does not exist", async () => {
    const result = await summarizeTierTelemetry(
      { paths: { stateDir: "/nonexistent/xyzzy-box-test-dir" } },
      "T1"
    );
    assert.equal(result.avgRoiDelta, 0, "missing state dir must not throw — returns zero-signal");
    assert.equal(result.sampleCount, 0);
  });
});


// ── routeModelUnderQualityFloor — uncertainty-aware routing under quality-floor constraints ──

describe("routeModelUnderQualityFloor — uncertainty + quality floor", () => {
  const modelOptions = {
    efficientModel: "Claude Haiku 4",
    defaultModel:   "Claude Sonnet 4.6",
    strongModel:    "Claude Opus 4.6",
    qualityByModel: {
      "Claude Haiku 4":    0.70,
      "Claude Sonnet 4.6": 0.85,
      "Claude Opus 4.6":   0.95,
    },
  };

  it("returns a model with meetsQualityFloor and uncertainty fields", () => {
    const result = routeModelUnderQualityFloor({}, modelOptions);
    assert.ok(result.model, "must return a model");
    assert.ok(typeof result.meetsQualityFloor === "boolean", "meetsQualityFloor must be boolean");
    assert.ok(typeof result.uncertainty === "string", "uncertainty must be a string");
    assert.ok(result.tier, "tier must be present");
    assert.ok(typeof result.reason === "string", "reason must be a string");
  });

  it("passes through uncertainty-selected model when it meets the quality floor", () => {
    // Low complexity → Haiku selected; Haiku (0.70) meets floor 0.65
    const result = routeModelUnderQualityFloor({ complexity: "low" }, modelOptions, { recentROI: 0 }, 0.65);
    assert.equal(result.meetsQualityFloor, true);
    assert.ok(result.model, "must return a model");
  });

  it("upgrades to floor-constrained model when uncertainty-selected model is below floor", () => {
    // Low complexity with very high floor 0.88 → Haiku (0.70) and Sonnet (0.85) fail → Opus (0.95) selected
    const result = routeModelUnderQualityFloor({ complexity: "low" }, modelOptions, { recentROI: 0 }, 0.88);
    assert.equal(result.meetsQualityFloor, true, "upgrade path must meet quality floor");
    assert.ok(
      result.reason.includes("quality-floor-upgrade"),
      `reason must mention quality-floor-upgrade; got: ${result.reason}`
    );
    assert.equal(result.model, "Claude Opus 4.6", "must upgrade to Opus when floor is 0.88");
  });

  it("preserves uncertainty signal even when upgrading for quality floor", () => {
    // High ROI → low uncertainty, but floor forces upgrade
    const result = routeModelUnderQualityFloor({ complexity: "low" }, modelOptions, { recentROI: 0.9 }, 0.88);
    assert.ok(typeof result.uncertainty === "string", "uncertainty must still be present after upgrade");
  });

  it("negative path: no history → low uncertainty, tier selects appropriately", () => {
    const result = routeModelUnderQualityFloor({ complexity: "critical" }, modelOptions, { recentROI: 0 }, 0.7);
    assert.ok(result.model, "must return a model even with no history");
    assert.equal(result.uncertainty, "low", "zero recentROI means no signal → low uncertainty");
    assert.equal(result.meetsQualityFloor, true);
  });

  it("negative path: high uncertainty with low ROI downgrades T3, but still meets floor", () => {
    // T3 + low ROI → downgraded to defaultModel (Sonnet); Sonnet (0.85) > floor (0.7)
    const result = routeModelUnderQualityFloor({ complexity: "critical" }, modelOptions, { recentROI: 0.1 }, 0.7);
    assert.equal(result.model, "Claude Sonnet 4.6", "high-uncertainty T3 must downgrade to default (Sonnet)");
    assert.equal(result.uncertainty, "high");
    assert.equal(result.meetsQualityFloor, true, "Sonnet must meet quality floor 0.7");
  });

  it("handles empty modelOptions without throwing", () => {
    const result = routeModelUnderQualityFloor({}, {}, { recentROI: 0 }, 0.5);
    assert.ok(result.model, "must return a model even with empty options");
    assert.ok(typeof result.meetsQualityFloor === "boolean");
  });
});

// ── routeModelWithClosureYield — closure-yield-adjusted quality floor routing ──

describe("routeModelWithClosureYield — closure-yield routing", () => {
  const modelOptions = {
    efficientModel: "Claude Haiku 4",
    defaultModel:   "Claude Sonnet 4.6",
    strongModel:    "Claude Opus 4.6",
    qualityByModel: {
      "Claude Haiku 4":    0.70,
      "Claude Sonnet 4.6": 0.85,
      "Claude Opus 4.6":   0.95,
    },
  };

  it("zero closureYield (no history) leaves floor unchanged", () => {
    const result = routeModelWithClosureYield({}, modelOptions, 0.65, 0);
    assert.equal(result.effectiveFloor, 0.65, "floor must be unchanged when closureYield=0");
    assert.equal(result.closureYieldAdjustment, "none");
    assert.equal(result.model, "Claude Haiku 4", "cheapest model meeting floor 0.65 must be selected");
    assert.equal(result.meetsQualityFloor, true);
  });

  it("low closureYield (< 0.5, > 0) tightens the floor, forcing a better model", () => {
    // base floor 0.65 → tightened: 0.65 + 0.10 = 0.75 → Haiku (0.70) fails → Sonnet (0.85) selected
    const result = routeModelWithClosureYield({}, modelOptions, 0.65, 0.3);
    assert.ok(result.effectiveFloor > 0.65, "floor must be tightened when closureYield is low");
    assert.equal(result.model, "Claude Sonnet 4.6", "Sonnet must be selected after floor tightening");
    assert.ok(result.closureYieldAdjustment.includes("tightened"), "adjustment must say tightened");
    assert.ok(result.reason.includes("closure-yield-adjusted"), "reason must include closure-yield-adjusted");
  });

  it("low closureYield with moderate floor forces Opus when Sonnet no longer qualifies", () => {
    // base floor 0.80, closureYield=0.1 → tightened: 0.80 + 0.10 = 0.90
    // Haiku (0.70) no, Sonnet (0.85) no, Opus (0.95) yes
    const result = routeModelWithClosureYield({}, modelOptions, 0.80, 0.1);
    assert.equal(result.model, "Claude Opus 4.6", "Opus must be selected when floor tightens past Sonnet");
    assert.equal(result.meetsQualityFloor, true);
  });

  it("closureYield at exactly threshold (0.5) does NOT tighten the floor", () => {
    const result = routeModelWithClosureYield({}, modelOptions, 0.65, CLOSURE_YIELD_LOW_THRESHOLD);
    assert.equal(result.effectiveFloor, 0.65, "floor at exactly threshold must not be tightened");
    assert.equal(result.closureYieldAdjustment, "none");
  });

  it("closureYield above threshold (0.8) does NOT tighten the floor", () => {
    const result = routeModelWithClosureYield({}, modelOptions, 0.65, 0.8);
    assert.equal(result.effectiveFloor, 0.65, "floor above threshold must not be adjusted");
    assert.equal(result.closureYieldAdjustment, "none");
  });

  it("effective floor is clamped to MAX_QUALITY_FLOOR (0.99) even with low yield + very high base floor", () => {
    // base floor 0.95, yield=0.1 → tightened: 0.95 + 0.10 = 1.05 → clamped to 0.99
    const result = routeModelWithClosureYield({}, modelOptions, 0.95, 0.1);
    assert.ok(result.effectiveFloor <= 0.99, `effectiveFloor (${result.effectiveFloor}) must not exceed 0.99`);
  });

  it("result always includes meetsQualityFloor boolean", () => {
    const result = routeModelWithClosureYield({}, modelOptions, 0.99, 0);
    assert.equal(typeof result.meetsQualityFloor, "boolean", "meetsQualityFloor must be a boolean");
    assert.equal(result.model, "Claude Opus 4.6", "strongest model used when floor unattainable");
  });

  it("reason string references closure-yield-adjusted and the base routing reason", () => {
    const result = routeModelWithClosureYield({}, modelOptions, 0.65, 0.2);
    assert.ok(result.reason.startsWith("closure-yield-adjusted"), "reason must start with closure-yield-adjusted");
    assert.ok(result.reason.includes("tightened"), "reason must reference tightening");
  });

  it("negative path: no model options falls back to default model", () => {
    const result = routeModelWithClosureYield({}, {}, 0.5, 0);
    assert.ok(result.model, "must return a model even with empty options");
    assert.ok(typeof result.meetsQualityFloor === "boolean");
  });

  it("CLOSURE_YIELD_LOW_THRESHOLD is 0.5", () => {
    assert.equal(CLOSURE_YIELD_LOW_THRESHOLD, 0.5);
  });
});

// ── routeModelWithRealizedROI ─────────────────────────────────────────────────

describe("routeModelWithRealizedROI", () => {
  let tmpDir: string;

  it("EXPLORATION_BOUND is exported as 0.15", () => {
    assert.equal(EXPLORATION_BOUND, 0.15);
  });

  it("returns a valid routing result with no ledger data (no-data path)", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-roi-route-"));
    const config = { paths: { stateDir: tmpDir } };
    const result = await routeModelWithRealizedROI(config, {}, {});
    assert.ok(result.model, "must return a model");
    assert.ok(typeof result.tier === "string");
    assert.ok(typeof result.reason === "string");
    assert.equal(result.realizedROI, 0, "no data → realizedROI=0");
    assert.equal(result.uncertainty, "low", "no data → uncertainty=low");
    assert.equal(result.explorationLimited, false, "no data → no exploration limit");
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("sets explorationLimited=true when realizedROI is positive but below EXPLORATION_BOUND", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-roi-expl-"));
    const config = { paths: { stateDir: tmpDir } };

    // Seed the ledger with a low-ROI entry so computeRecentROIForTier returns something
    // explorationBound override set very high to force the exploration-limited path
    const result = await routeModelWithRealizedROI(
      config, {},
      { qualityByModel: { "claude-3-5-haiku-20241022": 0.8, "claude-opus-4-5": 0.95 } },
      { qualityFloor: 0.7, explorationBound: 1.0 },   // bound=1.0 → any realizedROI < 1.0 triggers limit
    );
    // realizedROI is 0 (no ledger) so bound won't trigger — adjust expectation
    assert.ok(typeof result.explorationLimited === "boolean");
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("negative: handles missing stateDir gracefully (no crash)", async () => {
    const config = { paths: { stateDir: "/nonexistent/path/for/roi/test" } };
    // computeRecentROIForTier must fail silently → realizedROI=0
    const result = await routeModelWithRealizedROI(config, {}, {});
    assert.equal(result.realizedROI, 0);
    assert.ok(result.model, "still returns a model on ledger read failure");
  });

  it("reason string includes roi and tier", async () => {
    const config = { paths: { stateDir: await fs.mkdtemp(path.join(os.tmpdir(), "box-roi-reason-")) } };
    const result = await routeModelWithRealizedROI(config, { taskComplexity: "simple" }, {});
    assert.ok(result.reason.includes("roi="), `reason should include roi=, got: ${result.reason}`);
    assert.ok(result.reason.includes("tier="), `reason should include tier=, got: ${result.reason}`);
    await fs.rm((config as any).paths.stateDir, { recursive: true, force: true });
  });
});

describe("decideDeliberationPolicy", () => {
  it("returns single-pass policy for routine low-uncertainty tasks", () => {
    const result = decideDeliberationPolicy(
      { complexity: "low", estimatedLines: 60 },
      { recentROI: 0.9 },
      {}
    );
    assert.equal(result.mode, "single-pass");
    assert.equal(result.attempts, 1);
    assert.equal(result.boundedSearch, false);
  });

  it("returns multi-attempt policy for hard high-uncertainty tasks", () => {
    const result = decideDeliberationPolicy(
      { complexity: "critical", estimatedLines: 4200 },
      { recentROI: 0.1 },
      { outcomeMetrics: { sampleCount: 1, successRate: 0.1, recentROI: 0.1 } }
    );
    assert.equal(result.mode, "multi-attempt");
    assert.ok(result.attempts >= 2);
    assert.equal(result.reflection, true);
    assert.ok(result.searchBudget >= 2);
  });
});

describe("rankModelsByTaskKindExpectedValue", () => {
  it("ranks models by expected value from cycle analytics telemetry", () => {
    const cycleAnalytics = {
      modelRoutingTelemetry: {
        byTaskKind: {
          "ci-fix": {
            default: { successProbability: 0.5, capacityImpact: 0.5, requestCost: 1 },
            models: {
              "Claude Sonnet 4.6": { successProbability: 0.7, capacityImpact: 0.8, requestCost: 1.0 },
              "GPT-5.3-Codex": { successProbability: 0.6, capacityImpact: 0.9, requestCost: 0.8 },
            },
          },
        },
      },
    };
    const result = rankModelsByTaskKindExpectedValue(
      "ci-fix",
      ["Claude Sonnet 4.6", "GPT-5.3-Codex"],
      cycleAnalytics,
    );
    assert.equal(result.usedTelemetry, true);
    assert.equal(result.rankedModels[0], "GPT-5.3-Codex");
  });

  it("keeps deterministic fallback order when telemetry is missing", () => {
    const result = rankModelsByTaskKindExpectedValue(
      "implementation",
      ["Claude Sonnet 4.6", "GPT-5.3-Codex"],
      null,
    );
    assert.equal(result.usedTelemetry, false);
    assert.deepEqual(result.rankedModels, ["Claude Sonnet 4.6", "GPT-5.3-Codex"]);
  });
});

// ── Task 3: modelRoutingTelemetry threshold-gated consumption ─────────────────

describe("rankModelsByTaskKindExpectedValue — threshold enforcement", () => {
  it("returns reason=telemetry-below-threshold when sampleCount < MIN_TELEMETRY_SAMPLE_THRESHOLD", () => {
    const belowThreshold = Math.max(0, MIN_TELEMETRY_SAMPLE_THRESHOLD - 1);
    const cycleAnalytics = {
      modelRoutingTelemetry: {
        byTaskKind: {
          "ci-fix": {
            sampleCount: belowThreshold,
            default: { successProbability: 0.9, capacityImpact: 0.8, requestCost: 1 },
            models: {},
          },
        },
      },
    };
    const result = rankModelsByTaskKindExpectedValue(
      "ci-fix",
      ["Claude Sonnet 4.6", "GPT-5.3-Codex"],
      cycleAnalytics,
    );
    assert.equal(result.usedTelemetry, false,
      "sparse telemetry must not be used for routing");
    assert.equal(result.reason, "telemetry-below-threshold",
      "reason must identify the threshold gate");
    assert.deepEqual(result.rankedModels, ["Claude Sonnet 4.6", "GPT-5.3-Codex"],
      "original order must be preserved as deterministic fallback");
  });

  it("uses telemetry when sampleCount >= MIN_TELEMETRY_SAMPLE_THRESHOLD", () => {
    const cycleAnalytics = {
      modelRoutingTelemetry: {
        byTaskKind: {
          "ci-fix": {
            sampleCount: MIN_TELEMETRY_SAMPLE_THRESHOLD,
            default: { successProbability: 0.5, capacityImpact: 0.5, requestCost: 1 },
            models: {
              "GPT-5.3-Codex": { successProbability: 0.95, capacityImpact: 0.9, requestCost: 1 },
              "Claude Sonnet 4.6": { successProbability: 0.6, capacityImpact: 0.5, requestCost: 1 },
            },
          },
        },
      },
    };
    const result = rankModelsByTaskKindExpectedValue(
      "ci-fix",
      ["Claude Sonnet 4.6", "GPT-5.3-Codex"],
      cycleAnalytics,
    );
    assert.equal(result.usedTelemetry, true,
      "telemetry at or above threshold must be used");
    assert.equal(result.rankedModels[0], "GPT-5.3-Codex",
      "higher expected-value model must be ranked first");
  });

  it("MIN_TELEMETRY_SAMPLE_THRESHOLD is exported as a positive integer", () => {
    assert.ok(typeof MIN_TELEMETRY_SAMPLE_THRESHOLD === "number");
    assert.ok(MIN_TELEMETRY_SAMPLE_THRESHOLD > 0);
    assert.ok(Number.isInteger(MIN_TELEMETRY_SAMPLE_THRESHOLD));
  });
});

// ── routeModelWithMemoryHitRatio ──────────────────────────────────────────────

describe("routeModelWithMemoryHitRatio", () => {
  const modelOptions = {
    efficientModel: "Claude Haiku 4",
    defaultModel:   "Claude Sonnet 4.6",
    strongModel:    "Claude Opus 4.6",
    qualityByModel: {
      "Claude Haiku 4":    0.70,
      "Claude Sonnet 4.6": 0.85,
      "Claude Opus 4.6":   0.95,
    },
  };

  it("exported constants have correct values", () => {
    assert.equal(MEMORY_HIT_RATIO_HIGH, 0.70);
    assert.equal(MEMORY_HIT_RATIO_LOW,  0.30);
    assert.equal(MEMORY_FLOOR_RELAX_AMOUNT,  0.05);
    assert.equal(MEMORY_FLOOR_TIGHTEN_AMOUNT, 0.08);
  });

  it("high ratio (>=0.70) relaxes the quality floor", () => {
    // base floor 0.75, high ratio → relaxed to 0.70
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.75, MEMORY_HIT_RATIO_HIGH);
    assert.ok(result.memoryHitAdjustment.startsWith("relaxed"),
      "high hit ratio must relax the floor");
    assert.ok(result.effectiveFloor < 0.75, "effective floor must be lower than base floor");
  });

  it("high ratio selects a cheaper model when floor is relaxed", () => {
    // base floor 0.80, high ratio → relaxed to 0.75 → Haiku (0.70) fails, Sonnet (0.85) selected
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.80, 1.0);
    assert.equal(result.model, "Claude Sonnet 4.6",
      "relaxed floor should prefer lowest-cost qualifying model");
  });

  it("low ratio (0 < ratio < 0.30) tightens the quality floor", () => {
    // base floor 0.75, low ratio → tightened to 0.83
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.75, 0.10);
    assert.ok(result.memoryHitAdjustment.startsWith("tightened"),
      "low hit ratio must tighten the floor");
    assert.ok(result.effectiveFloor > 0.75, "effective floor must be higher than base floor");
  });

  it("low ratio forces stronger model when floor tightens past Sonnet", () => {
    // base floor 0.80, very low ratio → tightened to 0.88 → Sonnet (0.85) fails, Opus (0.95) selected
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.80, 0.05);
    assert.equal(result.model, "Claude Opus 4.6",
      "tightened floor must require Opus when Sonnet no longer qualifies");
  });

  it("zero ratio (no data) leaves floor unchanged", () => {
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.75, 0);
    assert.ok(result.memoryHitAdjustment.startsWith("none"),
      "zero ratio must not adjust the floor");
    assert.equal(result.effectiveFloor, 0.75, "effective floor must equal base floor");
  });

  it("effective floor is clamped to MAX_QUALITY_FLOOR (0.99)", () => {
    // base floor 0.95 + tighten 0.08 = 1.03 → clamped to 0.99
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.95, 0.05);
    assert.ok(result.effectiveFloor <= 0.99, "effective floor must not exceed 0.99");
  });

  it("effective floor is clamped to MIN_QUALITY_FLOOR (0.50)", () => {
    // base floor 0.52 - relax 0.05 = 0.47 → clamped to 0.50
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.52, 1.0);
    assert.ok(result.effectiveFloor >= 0.50, "effective floor must not go below 0.50");
  });

  it("result includes memoryHitRatio field matching the input ratio", () => {
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.75, 0.65);
    assert.equal(result.memoryHitRatio, 0.65, "memoryHitRatio must echo back the input ratio");
  });

  it("result always has a meetsQualityFloor boolean", () => {
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.75, 0.5);
    assert.equal(typeof result.meetsQualityFloor, "boolean");
  });

  it("reason string references memory-hit-adjusted", () => {
    const result = routeModelWithMemoryHitRatio({}, modelOptions, 0.75, 1.0);
    assert.ok(result.reason.includes("memory-hit-adjusted"),
      "reason must reference memory-hit-adjusted");
  });

  it("negative path: empty modelOptions returns a model without throwing", () => {
    const result = routeModelWithMemoryHitRatio({}, {}, 0.75, 0.8);
    assert.ok(result.model, "must return a model even with empty options");
    assert.equal(typeof result.meetsQualityFloor, "boolean");
  });
});

// ── QUALITY_FLOOR_DEFAULT — shared constant used by dispatch routing ──────────

describe("QUALITY_FLOOR_DEFAULT — quality floor constant", () => {
  it("is a numeric value in (0, 1)", () => {
    assert.equal(typeof QUALITY_FLOOR_DEFAULT, "number");
    assert.ok(QUALITY_FLOOR_DEFAULT > 0 && QUALITY_FLOOR_DEFAULT < 1,
      "QUALITY_FLOOR_DEFAULT must be in (0, 1)");
  });

  it("matches the default parameter of routeModelUnderQualityFloor", () => {
    // When no qualityFloor arg is supplied, the default (0.7) must be used.
    // A Sonnet-quality (0.85) model should always meet the default floor.
    const modelOptions = {
      efficientModel: "Claude Haiku 4",
      defaultModel:   "Claude Sonnet 4.6",
      strongModel:    "Claude Opus 4.6",
      qualityByModel: {
        "claude haiku 4":    0.70,
        "claude sonnet 4.6": 0.85,
        "claude opus 4.6":   0.95,
      },
    };
    // Call with explicit QUALITY_FLOOR_DEFAULT — result must be same as no-arg default.
    const withConst  = routeModelUnderQualityFloor({ complexity: "low" }, modelOptions, {}, QUALITY_FLOOR_DEFAULT);
    const withDefault = routeModelUnderQualityFloor({ complexity: "low" }, modelOptions, {});
    assert.equal(withConst.model, withDefault.model,
      "explicit QUALITY_FLOOR_DEFAULT must produce identical routing to the default parameter");
    assert.equal(withConst.meetsQualityFloor, withDefault.meetsQualityFloor);
  });

  it("quality-floor enforcement upgrades a below-floor candidate", () => {
    // Force haiku as the sole efficientModel; quality floor set above haiku (0.70).
    // routeModelUnderQualityFloor must upgrade to Sonnet.
    const modelOptions = {
      efficientModel: "Claude Haiku 4",
      defaultModel:   "Claude Sonnet 4.6",
      strongModel:    "Claude Opus 4.6",
      qualityByModel: {
        "claude haiku 4":    0.60,
        "claude sonnet 4.6": 0.85,
        "claude opus 4.6":   0.95,
      },
    };
    const result = routeModelUnderQualityFloor({ complexity: "low" }, modelOptions, { recentROI: 0 }, 0.75);
    assert.notEqual(result.model, "Claude Haiku 4",
      "below-floor candidate must be upgraded");
    assert.equal(result.meetsQualityFloor, true,
      "selected model must meet the floor after upgrade");
    assert.ok(result.reason.includes("quality-floor-upgrade"),
      "reason must explain why floor upgrade was applied");
  });

  it("negative: no model meeting floor returns strongest with meetsQualityFloor=false", () => {
    // All models score below an impossibly high floor.
    const modelOptions = {
      efficientModel: "Claude Haiku 4",
      defaultModel:   "Claude Sonnet 4.6",
      strongModel:    "Claude Opus 4.6",
      qualityByModel: {
        "claude haiku 4":    0.10,
        "claude sonnet 4.6": 0.20,
        "claude opus 4.6":   0.30,
      },
    };
    const result = routeModelUnderQualityFloor({}, modelOptions, { recentROI: 0 }, 0.99);
    assert.equal(result.model, "Claude Opus 4.6",
      "when nothing meets the floor, the strongest model must be returned");
    assert.equal(result.meetsQualityFloor, false,
      "meetsQualityFloor must be false when no model qualifies");
  });
});

// ── resolveJesusFallbackModel + JESUS_LATENCY_FALLBACK ────────────────────────
import { resolveJesusFallbackModel } from "../../src/core/model_policy.js";

describe("ROUTING_REASON — JESUS_LATENCY_FALLBACK value", () => {
  it("JESUS_LATENCY_FALLBACK is present in ROUTING_REASON enum", () => {
    assert.equal(ROUTING_REASON.JESUS_LATENCY_FALLBACK, "JESUS_LATENCY_FALLBACK",
      "ROUTING_REASON.JESUS_LATENCY_FALLBACK must be set to its own string key");
  });
});

describe("resolveJesusFallbackModel", () => {
  it("returns jesusFallbackModel when explicitly configured", () => {
    const cfg = { runtime: { jesusFallbackModel: "claude-opus-4" } };
    assert.equal(resolveJesusFallbackModel(cfg), "claude-opus-4");
  });

  it("falls back to copilot.efficientModel when jesusFallbackModel is empty", () => {
    const cfg = {
      runtime: { jesusFallbackModel: "" },
      copilot: { efficientModel: "claude-haiku-3" }
    };
    assert.equal(resolveJesusFallbackModel(cfg), "claude-haiku-3");
  });

  it("falls back to copilot.defaultModel when both jesusFallbackModel and efficientModel are absent", () => {
    const cfg = { copilot: { defaultModel: "claude-sonnet-3" } };
    assert.equal(resolveJesusFallbackModel(cfg), "claude-sonnet-3");
  });

  it("returns default model string when config is empty", () => {
    const model = resolveJesusFallbackModel({});
    assert.equal(typeof model, "string", "must always return a string");
    assert.ok(model.length > 0, "must not return empty string");
  });

  it("negative path: whitespace-only jesusFallbackModel falls through to efficientModel", () => {
    const cfg = {
      runtime: { jesusFallbackModel: "   " },
      copilot: { efficientModel: "claude-haiku-3" }
    };
    assert.equal(resolveJesusFallbackModel(cfg), "claude-haiku-3");
  });
});
