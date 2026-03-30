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
  appendRouteROIEntry,
  realizeRouteROIEntry,
  loadRouteROILedger,
  computeRecentROIForTier,
  MAX_LEDGER_SIZE,
  routeModelByCost,
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
