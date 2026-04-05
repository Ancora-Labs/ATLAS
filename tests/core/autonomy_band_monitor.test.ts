import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BAND_STATE,
  DEFAULT_THRESHOLDS,
  computeCompositeScore,
  evaluateInBandThresholds,
  evaluateRegressionTriggers,
  computeNextState,
  type CycleSample,
} from "../../src/core/autonomy_band_monitor.js";

// ── Helper: build a CycleSample with convenient defaults ─────────────────────

function makeSample(overrides: Partial<CycleSample> = {}): CycleSample {
  return {
    cycleId: `test-${Date.now()}`,
    recordedAt: new Date().toISOString(),
    phase: "completed",
    completionRate: 0.85,
    premiumEfficiency: 0.70,
    athenaRejectRate: 0.10,
    parserFallbackRate: 0.05,
    contractFailRate: 0.05,
    benchmarkGain: 0.20,
    crashCount: 0,
    crashRate: 0,
    hardGuardrailBreach: false,
    capacityTrend: "stable",
    ...overrides,
  };
}

function makeHistory(count: number, overrides: Partial<CycleSample> = {}): CycleSample[] {
  return Array.from({ length: count }, (_, i) =>
    makeSample({ cycleId: `cycle-${i}`, ...overrides }),
  );
}

// ── computeCompositeScore ────────────────────────────────────────────────────

describe("computeCompositeScore", () => {
  it("computes weighted score with all dimensions present", () => {
    const score = computeCompositeScore({
      completion: 0.8,
      premiumEfficiency: 0.7,
      quality: 0.9,
      capacityTrend: 0.6,
      stability: 0.85,
    });
    assert.ok(score !== null);
    assert.ok(score! > 0.7 && score! < 0.85, `expected ~0.77, got ${score}`);
  });

  it("returns null when all dimensions are null", () => {
    const score = computeCompositeScore({
      completion: null,
      premiumEfficiency: null,
      quality: null,
      capacityTrend: null,
      stability: null,
    });
    assert.equal(score, null);
  });

  it("redistributes weight when some dimensions are null", () => {
    // Only completion(0.25) and stability(0.20) present
    const partial = computeCompositeScore({
      completion: 1.0,
      premiumEfficiency: null,
      quality: null,
      capacityTrend: null,
      stability: 1.0,
    });
    assert.ok(partial !== null);
    // With redistribution, all active weights normalize to 1.0, score should be 1.0
    assert.equal(partial, 1.0);
  });

  it("clamps dimension values to 0-1", () => {
    const score = computeCompositeScore({
      completion: 1.5,
      premiumEfficiency: -0.2,
      quality: 0.5,
      capacityTrend: 0.5,
      stability: 0.5,
    });
    assert.ok(score !== null);
    // 1.5 clamped to 1.0, -0.2 clamped to 0.0
    assert.ok(score! >= 0 && score! <= 1);
  });
});

// ── evaluateInBandThresholds ─────────────────────────────────────────────────

describe("evaluateInBandThresholds", () => {
  it("returns allMet=true when all thresholds met", () => {
    const history = makeHistory(35, {
      completionRate: 0.90,
      premiumEfficiency: 0.80,
      athenaRejectRate: 0.05,
    });
    const checks = evaluateInBandThresholds(history, DEFAULT_THRESHOLDS);
    assert.ok(checks.allMet, `expected allMet but got ${JSON.stringify(checks)}`);
    assert.ok(checks.compositeScoreMet);
    assert.ok(checks.completionRateMet);
    assert.ok(checks.premiumEfficiencyMet);
    assert.ok(checks.athenaRejectRateMet);
    assert.ok(checks.hardGuardrailBreachMet);
  });

  it("returns allMet=false when completion rate is below threshold", () => {
    const history = makeHistory(35, {
      completionRate: 0.50,
      premiumEfficiency: 0.80,
      athenaRejectRate: 0.05,
    });
    const checks = evaluateInBandThresholds(history, DEFAULT_THRESHOLDS);
    assert.ok(!checks.allMet);
    assert.ok(!checks.completionRateMet);
  });

  it("returns allMet=false when too many guardrail breaches", () => {
    const history = makeHistory(55);
    // Add 3 breaches (max is 2)
    history[50]!.hardGuardrailBreach = true;
    history[51]!.hardGuardrailBreach = true;
    history[52]!.hardGuardrailBreach = true;
    const checks = evaluateInBandThresholds(history, DEFAULT_THRESHOLDS);
    assert.ok(!checks.hardGuardrailBreachMet);
    assert.ok(!checks.allMet);
  });
});

// ── evaluateRegressionTriggers ───────────────────────────────────────────────

describe("evaluateRegressionTriggers", () => {
  it("returns no breaches for healthy history", () => {
    const history = makeHistory(20);
    const checks = evaluateRegressionTriggers(history, DEFAULT_THRESHOLDS);
    assert.ok(!checks.anyBreach);
    assert.ok(!checks.crashBreach);
    assert.ok(!checks.completionBreach);
    assert.ok(!checks.hardGuardrailBreach);
    assert.ok(!checks.athenaRejectBreach);
  });

  it("detects crash breach when 3+ crashes in window", () => {
    const history = makeHistory(12, { crashCount: 0 });
    history[9]!.crashCount = 1;
    history[10]!.crashCount = 1;
    history[11]!.crashCount = 1;
    const checks = evaluateRegressionTriggers(history, DEFAULT_THRESHOLDS);
    assert.ok(checks.crashBreach);
    assert.ok(checks.anyBreach);
  });

  it("detects completion breach when avg < 0.40", () => {
    const history = makeHistory(12, { completionRate: 0.30 });
    const checks = evaluateRegressionTriggers(history, DEFAULT_THRESHOLDS);
    assert.ok(checks.completionBreach);
    assert.ok(checks.anyBreach);
  });

  it("detects hard guardrail breach in last cycle", () => {
    const history = makeHistory(5);
    history[4]!.hardGuardrailBreach = true;
    const checks = evaluateRegressionTriggers(history, DEFAULT_THRESHOLDS);
    assert.ok(checks.hardGuardrailBreach);
    assert.ok(checks.anyBreach);
  });

  it("detects athena reject breach when avg > 0.40 in window", () => {
    const history = makeHistory(8, { athenaRejectRate: 0.50 });
    const checks = evaluateRegressionTriggers(history, DEFAULT_THRESHOLDS);
    assert.ok(checks.athenaRejectBreach);
    assert.ok(checks.anyBreach);
  });
});

// ── computeNextState ─────────────────────────────────────────────────────────

describe("computeNextState", () => {
  it("stays BOOTSTRAPPING when cycle count is below minimum", () => {
    const history = makeHistory(5);
    const { nextState } = computeNextState(BAND_STATE.BOOTSTRAPPING, history, DEFAULT_THRESHOLDS);
    assert.equal(nextState, BAND_STATE.BOOTSTRAPPING);
  });

  it("transitions to STABILIZING after minimum cycles with unmet thresholds", () => {
    const history = makeHistory(15, { completionRate: 0.50 });
    const { nextState } = computeNextState(BAND_STATE.BOOTSTRAPPING, history, DEFAULT_THRESHOLDS);
    assert.equal(nextState, BAND_STATE.STABILIZING);
  });

  it("transitions to IN_BAND when all thresholds met", () => {
    const history = makeHistory(35, {
      completionRate: 0.90,
      premiumEfficiency: 0.80,
      athenaRejectRate: 0.05,
    });
    const { nextState } = computeNextState(BAND_STATE.STABILIZING, history, DEFAULT_THRESHOLDS);
    assert.equal(nextState, BAND_STATE.IN_BAND);
  });

  it("transitions from IN_BAND to STABILIZING on threshold drift (not REGRESSED)", () => {
    const history = makeHistory(35, {
      completionRate: 0.90,
      premiumEfficiency: 0.80,
      athenaRejectRate: 0.05,
    });
    // Drop last few cycles' completion
    for (let i = 30; i < 35; i++) {
      history[i]!.completionRate = 0.50;
    }
    // First check with only 5 bad cycles — avg may still pass. Force clear failure:
    for (let i = 10; i < 35; i++) {
      history[i]!.completionRate = 0.50;
    }
    const { nextState: state2 } = computeNextState(BAND_STATE.IN_BAND, history, DEFAULT_THRESHOLDS);
    assert.equal(state2, BAND_STATE.STABILIZING);
  });

  it("transitions to REGRESSED on hard regression trigger regardless of state", () => {
    const history = makeHistory(20, { crashCount: 0 });
    // 3 crashes in last 10
    history[17]!.crashCount = 1;
    history[18]!.crashCount = 1;
    history[19]!.crashCount = 1;
    const { nextState } = computeNextState(BAND_STATE.IN_BAND, history, DEFAULT_THRESHOLDS);
    assert.equal(nextState, BAND_STATE.REGRESSED);
  });

  it("transitions from REGRESSED back to STABILIZING when triggers clear", () => {
    const history = makeHistory(15, {
      completionRate: 0.60,
      premiumEfficiency: 0.50,
      athenaRejectRate: 0.10,
    });
    const { nextState } = computeNextState(BAND_STATE.REGRESSED, history, DEFAULT_THRESHOLDS);
    // No regression triggers, enough cycles, but thresholds not all met → STABILIZING
    assert.equal(nextState, BAND_STATE.STABILIZING);
  });
});
