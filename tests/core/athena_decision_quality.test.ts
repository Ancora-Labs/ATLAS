/**
 * Tests for T-012: Decision Quality Labels on Postmortems.
 *
 * Covers:
 *   AC1:  Every postmortem includes one decision-quality label.
 *   AC2:  Labels map deterministically from measurable outcomes via LABEL_OUTCOME_MAP.
 *   AC3:  getDecisionQualityTrend() returns trendData with shape {timestamp, label, count}.
 *   AC4:  computeWeightedDecisionScore uses explicit weights as signals.
 *   AC5:  Legacy entries (no decisionQualityLabel) default to "inconclusive" (backward-compat).
 *   AC8:  DECISION_QUALITY_LABEL and LABEL_OUTCOME_MAP are frozen enums with defined values.
 *   AC9:  Missing vs invalid input produce distinct reason codes.
 *   AC10: No silent fallback — degraded state carries explicit status and reason fields.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import {
  DECISION_QUALITY_LABEL,
  DECISION_QUALITY_REASON,
  DEGRADED_POSTMORTEM_REVIEW_REASON,
  LABEL_OUTCOME_MAP,
  computeDecisionQualityLabel,
  normalizeDecisionQualityLabel,
  POSTMORTEM_REVIEW_STATUS,
  runAthenaPostmortem,
  POSTMORTEM_RECOMMENDATION,
  deriveDeterministicRecommendation,
  ATHENA_FAST_PATH_REASON,
  AUTO_APPROVE_DELTA_REVIEW_THRESHOLD,
  runAthenaPlanReview,
} from "../../src/core/athena_reviewer.js";

import {
  DECISION_QUALITY_WEIGHTS,
  computeWeightedDecisionScore
} from "../../src/core/self_improvement.js";

import { getDecisionQualityTrend } from "../../src/dashboard/live_dashboard.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

// ── DECISION_QUALITY_LABEL enum ───────────────────────────────────────────────

describe("DECISION_QUALITY_LABEL enum", () => {
  it("exports four frozen label constants", () => {
    assert.equal(DECISION_QUALITY_LABEL.CORRECT, "correct");
    assert.equal(DECISION_QUALITY_LABEL.DELAYED_CORRECT, "delayed-correct");
    assert.equal(DECISION_QUALITY_LABEL.INCORRECT, "incorrect");
    assert.equal(DECISION_QUALITY_LABEL.INCONCLUSIVE, "inconclusive");
    assert.ok(Object.isFrozen(DECISION_QUALITY_LABEL), "DECISION_QUALITY_LABEL must be frozen");
  });
});

// ── LABEL_OUTCOME_MAP ─────────────────────────────────────────────────────────

describe("LABEL_OUTCOME_MAP", () => {
  it("maps merged → correct", () => {
    assert.equal(LABEL_OUTCOME_MAP.merged, DECISION_QUALITY_LABEL.CORRECT);
  });

  it("maps reopen → delayed-correct", () => {
    assert.equal(LABEL_OUTCOME_MAP.reopen, DECISION_QUALITY_LABEL.DELAYED_CORRECT);
  });

  it("maps rollback → incorrect", () => {
    assert.equal(LABEL_OUTCOME_MAP.rollback, DECISION_QUALITY_LABEL.INCORRECT);
  });

  it("maps timeout → inconclusive", () => {
    assert.equal(LABEL_OUTCOME_MAP.timeout, DECISION_QUALITY_LABEL.INCONCLUSIVE);
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(LABEL_OUTCOME_MAP), "LABEL_OUTCOME_MAP must be frozen");
  });
});

// ── computeDecisionQualityLabel — positive paths ──────────────────────────────

describe("computeDecisionQualityLabel — positive paths", () => {
  it("returns correct for outcome=merged", () => {
    const r = computeDecisionQualityLabel("merged");
    assert.equal(r.label, "correct");
    assert.equal(r.reason, DECISION_QUALITY_REASON.OK);
    assert.equal(r.status, "ok");
  });

  it("returns delayed-correct for outcome=reopen", () => {
    const r = computeDecisionQualityLabel("reopen");
    assert.equal(r.label, "delayed-correct");
    assert.equal(r.reason, DECISION_QUALITY_REASON.OK);
    assert.equal(r.status, "ok");
  });

  it("returns incorrect for outcome=rollback", () => {
    const r = computeDecisionQualityLabel("rollback");
    assert.equal(r.label, "incorrect");
    assert.equal(r.reason, DECISION_QUALITY_REASON.OK);
    assert.equal(r.status, "ok");
  });

  it("returns inconclusive for outcome=timeout", () => {
    const r = computeDecisionQualityLabel("timeout");
    assert.equal(r.label, "inconclusive");
    assert.equal(r.reason, DECISION_QUALITY_REASON.OK);
    assert.equal(r.status, "ok");
  });
});

// ── computeDecisionQualityLabel — negative paths ─────────────────────────────

describe("computeDecisionQualityLabel — negative paths (AC9, AC10)", () => {
  it("distinguishes missing input (null) from invalid input — returns MISSING_INPUT reason", () => {
    const r = computeDecisionQualityLabel(null);
    assert.equal(r.label, "inconclusive",
      "missing input must default label to inconclusive");
    assert.equal(r.reason, DECISION_QUALITY_REASON.MISSING_INPUT,
      "reason must be MISSING_INPUT, not INVALID_INPUT");
    assert.equal(r.status, "degraded",
      "missing input must set status=degraded — no silent fallback");
  });

  it("distinguishes missing input (undefined) — returns MISSING_INPUT reason", () => {
    const r = computeDecisionQualityLabel(undefined);
    assert.equal(r.reason, DECISION_QUALITY_REASON.MISSING_INPUT);
    assert.equal(r.status, "degraded");
  });

  it("distinguishes missing input (empty string) — returns MISSING_INPUT reason", () => {
    const r = computeDecisionQualityLabel("");
    assert.equal(r.reason, DECISION_QUALITY_REASON.MISSING_INPUT);
  });

  it("returns INVALID_INPUT for unknown outcome values — degraded, not silent", () => {
    const r = computeDecisionQualityLabel("some-unknown-outcome");
    assert.equal(r.label, "inconclusive",
      "unknown outcome must default to inconclusive");
    assert.equal(r.reason, DECISION_QUALITY_REASON.INVALID_INPUT,
      "reason must be INVALID_INPUT — not MISSING_INPUT and not OK");
    assert.equal(r.status, "degraded",
      "invalid input must set status=degraded — no silent fallback");
  });

  it("returns INVALID_INPUT for numeric outcome", () => {
    const r = computeDecisionQualityLabel(42);
    assert.equal(r.reason, DECISION_QUALITY_REASON.INVALID_INPUT);
    assert.equal(r.status, "degraded");
  });
});

// ── normalizeDecisionQualityLabel — backward compat ──────────────────────────

describe("normalizeDecisionQualityLabel — legacy backward-compat (AC5, AC14)", () => {
  it("returns inconclusive for legacy entry without decisionQualityLabel", () => {
    const legacyPm = {
      workerName: "evolution-worker",
      recommendation: "proceed",
      reviewedAt: "2025-06-01T10:00:00.000Z"
    };
    assert.equal(normalizeDecisionQualityLabel(legacyPm), "inconclusive",
      "legacy entries without decisionQualityLabel must default to inconclusive");
  });

  it("returns the existing label for new entries", () => {
    const newPm = {
      workerName: "worker",
      decisionQualityLabel: "correct",
      reviewedAt: "2026-01-01T00:00:00.000Z"
    };
    assert.equal(normalizeDecisionQualityLabel(newPm), "correct");
  });

  it("returns inconclusive for entries with an unknown label value", () => {
    const badPm = { decisionQualityLabel: "some-future-label" };
    assert.equal(normalizeDecisionQualityLabel(badPm), "inconclusive");
  });

  it("returns inconclusive for null input", () => {
    assert.equal(normalizeDecisionQualityLabel(null), "inconclusive");
  });
});

describe("postmortem_legacy.json fixture — backward-compat read (AC5, AC14)", () => {
  it("all legacy entries parse and default to inconclusive label", async () => {
    const raw = JSON.parse(
      await fs.readFile(path.join(FIXTURES_DIR, "postmortem_legacy.json"), "utf8")
    );
    assert.ok(Array.isArray(raw), "legacy fixture must be a plain array (v0 format)");
    assert.ok(raw.length >= 1, "fixture must have at least one entry");
    for (const pm of raw) {
      assert.ok(!("decisionQualityLabel" in pm),
        "legacy entries must not have decisionQualityLabel field");
      assert.equal(normalizeDecisionQualityLabel(pm), "inconclusive",
        "legacy entry without decisionQualityLabel must normalize to inconclusive");
    }
  });
});

// ── DECISION_QUALITY_WEIGHTS ──────────────────────────────────────────────────

describe("DECISION_QUALITY_WEIGHTS (AC4, AC13)", () => {
  it("defines explicit weights for all four labels", () => {
    assert.equal(DECISION_QUALITY_WEIGHTS["correct"], 1.0);
    assert.equal(DECISION_QUALITY_WEIGHTS["delayed-correct"], 0.6);
    assert.equal(DECISION_QUALITY_WEIGHTS["incorrect"], 0.0);
    assert.equal(DECISION_QUALITY_WEIGHTS["inconclusive"], 0.3);
    assert.ok(Object.isFrozen(DECISION_QUALITY_WEIGHTS), "weights must be frozen");
  });

  it("correct > delayed-correct > inconclusive > incorrect ordering", () => {
    assert.ok(DECISION_QUALITY_WEIGHTS["correct"] > DECISION_QUALITY_WEIGHTS["delayed-correct"]);
    assert.ok(DECISION_QUALITY_WEIGHTS["delayed-correct"] > DECISION_QUALITY_WEIGHTS["inconclusive"]);
    assert.ok(DECISION_QUALITY_WEIGHTS["inconclusive"] > DECISION_QUALITY_WEIGHTS["incorrect"]);
  });
});

// ── computeWeightedDecisionScore ──────────────────────────────────────────────

describe("computeWeightedDecisionScore (AC4, AC13)", () => {
  it("returns score=1.0 for all-correct postmortems", () => {
    const pms = [
      { decisionQualityLabel: "correct" },
      { decisionQualityLabel: "correct" }
    ];
    const r = computeWeightedDecisionScore(pms);
    assert.equal(r.score, 1.0);
    assert.equal(r.total, 2);
    assert.equal(r.labelCounts.correct, 2);
  });

  it("returns score=0.0 for all-incorrect postmortems", () => {
    const pms = [
      { decisionQualityLabel: "incorrect" },
      { decisionQualityLabel: "incorrect" }
    ];
    const r = computeWeightedDecisionScore(pms);
    assert.equal(r.score, 0.0);
  });

  it("computes mixed score deterministically", () => {
    const pms = [
      { decisionQualityLabel: "correct" },    // 1.0
      { decisionQualityLabel: "incorrect" }   // 0.0
    ];
    const r = computeWeightedDecisionScore(pms);
    assert.equal(r.score, 0.5, "mixed correct+incorrect should average to 0.5");
  });

  it("legacy entries (no label) count as inconclusive (weight=0.3)", () => {
    const pms = [
      { workerName: "legacy", recommendation: "proceed" }  // no decisionQualityLabel
    ];
    const r = computeWeightedDecisionScore(pms);
    assert.equal(r.score, 0.3, "missing label must use inconclusive weight=0.3");
    assert.equal(r.labelCounts.inconclusive, 1);
  });

  it("returns null score for empty input", () => {
    const r = computeWeightedDecisionScore([]);
    assert.equal(r.score, null);
    assert.equal(r.total, 0);
  });

  it("returns null score for non-array input (negative path)", () => {
    const r = computeWeightedDecisionScore(null);
    assert.equal(r.score, null);
  });
});

// ── getDecisionQualityTrend — data-contract check (AC3, AC12) ────────────────

describe("getDecisionQualityTrend — data-contract (AC3, AC12)", () => {
  let tmpDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-dqt-"));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns trendData=[] and total=0 when no postmortems file exists", async () => {
    const result = await getDecisionQualityTrend(tmpDir);
    assert.ok(Array.isArray(result.trendData), "trendData must be an array");
    assert.equal(result.trendData.length, 0);
    assert.equal(result.total, 0);
  });

  it("returns trendData with shape {timestamp, label, count} for v1 postmortems", async () => {
    const pmFile = path.join(tmpDir, "athena_postmortems.json");
    await fs.writeFile(pmFile, JSON.stringify({
      schemaVersion: 1,
      entries: [
        { decisionQualityLabel: "correct", reviewedAt: "2026-03-01T10:00:00.000Z" },
        { decisionQualityLabel: "correct", reviewedAt: "2026-03-01T12:00:00.000Z" },
        { decisionQualityLabel: "incorrect", reviewedAt: "2026-03-01T14:00:00.000Z" },
        { decisionQualityLabel: "inconclusive", reviewedAt: "2026-03-02T08:00:00.000Z" }
      ]
    }), "utf8");

    const result = await getDecisionQualityTrend(tmpDir);
    assert.ok(Array.isArray(result.trendData), "trendData must be an array");
    assert.equal(result.total, 4, "total must count all entries");

    // Validate shape of each element
    for (const item of result.trendData) {
      assert.ok(typeof item.timestamp === "string", "timestamp must be a string");
      assert.ok(typeof item.label === "string", "label must be a string");
      assert.ok(typeof item.count === "number", "count must be a number");
      assert.ok(item.count > 0, "count must be positive");
    }

    // Day 2026-03-01 should have two buckets: correct(2) and incorrect(1)
    const march1correct = result.trendData.find(
      d => d.timestamp === "2026-03-01" && d.label === "correct"
    );
    assert.ok(march1correct, "should have a correct bucket for 2026-03-01");
    assert.equal(march1correct.count, 2);

    const march1incorrect = result.trendData.find(
      d => d.timestamp === "2026-03-01" && d.label === "incorrect"
    );
    assert.ok(march1incorrect, "should have an incorrect bucket for 2026-03-01");
    assert.equal(march1incorrect.count, 1);
  });

  it("handles v0 (plain array) postmortems format", async () => {
    const pmFile = path.join(tmpDir, "athena_postmortems.json");
    await fs.writeFile(pmFile, JSON.stringify([
      { decisionQualityLabel: "delayed-correct", reviewedAt: "2026-03-05T09:00:00.000Z" }
    ]), "utf8");

    const result = await getDecisionQualityTrend(tmpDir);
    assert.equal(result.total, 1);
    assert.equal(result.trendData.length, 1);
    assert.equal(result.trendData[0].label, "delayed-correct");
    assert.equal(result.trendData[0].count, 1);
  });

  it("legacy entries without decisionQualityLabel count as inconclusive (AC5)", async () => {
    const pmFile = path.join(tmpDir, "athena_postmortems.json");
    await fs.writeFile(pmFile, JSON.stringify([
      { workerName: "old-worker", recommendation: "proceed", reviewedAt: "2026-02-01T10:00:00.000Z" }
    ]), "utf8");

    const result = await getDecisionQualityTrend(tmpDir);
    assert.equal(result.total, 1);
    const bucket = result.trendData[0];
    assert.equal(bucket.label, "inconclusive",
      "legacy entries without label must be bucketed as inconclusive");
    assert.equal(bucket.count, 1);
  });

  it("returns empty trend for corrupt/empty postmortems file (negative path)", async () => {
    const pmFile = path.join(tmpDir, "athena_postmortems.json");
    await fs.writeFile(pmFile, "not valid json", "utf8");

    const result = await getDecisionQualityTrend(tmpDir);
    assert.ok(Array.isArray(result.trendData));
    assert.equal(result.trendData.length, 0);
    assert.equal(result.total, 0);
  });
});

// ── computeEvidenceCompleteness ───────────────────────────────────────────────

import {
  EVIDENCE_COMPLETENESS_REASON,
  computeEvidenceCompleteness,
  computeDecisionQualityLabelWithEvidence,
} from "../../src/core/athena_reviewer.js";

describe("computeEvidenceCompleteness — positive path", () => {
  it("returns complete=true for a fully-populated evidence envelope", () => {
    const evidence = {
      roleName: "worker-alpha",
      status: "done",
      summary: "All tests passed and build succeeded without errors.",
      verificationEvidence: { build: "pass", tests: "pass" },
    };
    const result = computeEvidenceCompleteness(evidence);
    assert.equal(result.complete, true);
    assert.equal(result.reason, EVIDENCE_COMPLETENESS_REASON.EVIDENCE_COMPLETE);
    assert.deepEqual(result.missing, []);
  });
});

describe("computeEvidenceCompleteness — negative path: null/undefined", () => {
  it("returns complete=false for null input", () => {
    const result = computeEvidenceCompleteness(null);
    assert.equal(result.complete, false);
    assert.equal(result.reason, EVIDENCE_COMPLETENESS_REASON.MISSING_EVIDENCE);
  });

  it("returns complete=false for undefined input", () => {
    const result = computeEvidenceCompleteness(undefined);
    assert.equal(result.complete, false);
    assert.equal(result.reason, EVIDENCE_COMPLETENESS_REASON.MISSING_EVIDENCE);
  });

  it("returns complete=false for array input", () => {
    const result = computeEvidenceCompleteness([]);
    assert.equal(result.complete, false);
    assert.equal(result.reason, EVIDENCE_COMPLETENESS_REASON.MISSING_EVIDENCE);
  });
});

describe("computeEvidenceCompleteness — negative path: missing fields", () => {
  it("flags missing roleName", () => {
    const evidence = {
      status: "done",
      summary: "All tests passed and build succeeded.",
      verificationEvidence: { build: "pass", tests: "pass" },
    };
    const result = computeEvidenceCompleteness(evidence);
    assert.equal(result.complete, false);
    assert.equal(result.reason, EVIDENCE_COMPLETENESS_REASON.INCOMPLETE_EVIDENCE);
    assert.ok(result.missing.includes("roleName"), `expected roleName in missing; got ${result.missing}`);
  });

  it("flags summary too short (under 10 chars)", () => {
    const evidence = {
      roleName: "worker-alpha",
      status: "done",
      summary: "short",  // only 5 chars
      verificationEvidence: { build: "pass", tests: "pass" },
    };
    const result = computeEvidenceCompleteness(evidence);
    assert.equal(result.complete, false);
    assert.ok(result.missing.includes("summary:too_short"));
  });

  it("flags missing verificationEvidence", () => {
    const evidence = {
      roleName: "worker-alpha",
      status: "done",
      summary: "All tests passed and build succeeded.",
    };
    const result = computeEvidenceCompleteness(evidence);
    assert.equal(result.complete, false);
    assert.ok(result.missing.includes("verificationEvidence"));
  });

  it("flags missing verificationEvidence.build", () => {
    const evidence = {
      roleName: "worker-alpha",
      status: "done",
      summary: "All tests passed and build succeeded.",
      verificationEvidence: { tests: "pass" },  // missing build
    };
    const result = computeEvidenceCompleteness(evidence);
    assert.equal(result.complete, false);
    assert.ok(result.missing.includes("verificationEvidence.build"));
  });
});

// ── computeDecisionQualityLabelWithEvidence ───────────────────────────────────

describe("computeDecisionQualityLabelWithEvidence — positive path", () => {
  const fullEvidence = {
    roleName: "worker-alpha",
    status: "done",
    summary: "All tests passed and build succeeded without errors.",
    verificationEvidence: { build: "pass", tests: "pass" },
  };

  it("returns correct label with evidenceComplete=true when outcome=merged + full evidence", () => {
    const result = computeDecisionQualityLabelWithEvidence("merged", fullEvidence);
    assert.equal(result.label, DECISION_QUALITY_LABEL.CORRECT);
    assert.equal(result.evidenceComplete, true);
    assert.equal(result.status, "ok");
  });

  it("returns delayed-correct label with evidenceComplete=true when outcome=reopen", () => {
    const result = computeDecisionQualityLabelWithEvidence("reopen", fullEvidence);
    assert.equal(result.label, DECISION_QUALITY_LABEL.DELAYED_CORRECT);
    assert.equal(result.evidenceComplete, true);
  });

  it("returns incorrect label with evidenceComplete=true when outcome=rollback", () => {
    const result = computeDecisionQualityLabelWithEvidence("rollback", fullEvidence);
    assert.equal(result.label, DECISION_QUALITY_LABEL.INCORRECT);
    assert.equal(result.evidenceComplete, true);
  });
});

describe("computeDecisionQualityLabelWithEvidence — negative path: missing evidence", () => {
  it("downgrades non-inconclusive label to inconclusive when evidence is null", () => {
    const result = computeDecisionQualityLabelWithEvidence("merged", null);
    assert.equal(result.label, DECISION_QUALITY_LABEL.INCONCLUSIVE);
    assert.equal(result.evidenceComplete, false);
    assert.equal(result.status, "degraded");
    assert.equal(result.evidenceReason, EVIDENCE_COMPLETENESS_REASON.MISSING_EVIDENCE);
  });

  it("downgrades to inconclusive when evidence is incomplete (missing summary)", () => {
    const incomplete = {
      roleName: "worker-alpha",
      status: "done",
      // missing summary and verificationEvidence
    };
    const result = computeDecisionQualityLabelWithEvidence("merged", incomplete);
    assert.equal(result.label, DECISION_QUALITY_LABEL.INCONCLUSIVE);
    assert.equal(result.evidenceComplete, false);
    assert.ok(result.evidenceMissing.length > 0);
  });

  it("still returns inconclusive for unknown outcome even with full evidence (outcome gate fires first)", () => {
    const fullEvidence = {
      roleName: "worker-alpha",
      status: "done",
      summary: "All tests passed and build succeeded without errors.",
      verificationEvidence: { build: "pass", tests: "pass" },
    };
    const result = computeDecisionQualityLabelWithEvidence("unknown_outcome", fullEvidence);
    // Unknown outcome maps to inconclusive regardless of evidence
    assert.equal(result.label, DECISION_QUALITY_LABEL.INCONCLUSIVE);
  });

  it("returns inconclusive with degraded status when no evidence provided (omitted arg)", () => {
    const result = computeDecisionQualityLabelWithEvidence("merged");
    assert.equal(result.label, DECISION_QUALITY_LABEL.INCONCLUSIVE);
    assert.equal(result.evidenceComplete, false);
    assert.equal(result.evidenceReason, EVIDENCE_COMPLETENESS_REASON.MISSING_EVIDENCE);
  });
});

// ── validatePostmortemClosureFields (Task 1) ──────────────────────────────────

import {
  POSTMORTEM_CLOSURE_VALIDATION_REASON,
  validatePostmortemClosureFields,
} from "../../src/core/athena_reviewer.js";

describe("validatePostmortemClosureFields — positive path", () => {
  it("returns valid=true when all closure fields are populated", () => {
    const pm = {
      expectedOutcome: "Worker should add validation logic to the postmortem closure path.",
      actualOutcome: "Worker added validatePostmortemClosureFields and tests. Build passed.",
      deviation: "none",
    };
    const r = validatePostmortemClosureFields(pm);
    assert.equal(r.valid, true);
    assert.equal(r.reason, POSTMORTEM_CLOSURE_VALIDATION_REASON.OK);
    assert.deepEqual(r.emptyFields, []);
  });

  it("accepts deviation=minor", () => {
    const pm = { expectedOutcome: "Task done", actualOutcome: "Build passed", deviation: "minor" };
    const r = validatePostmortemClosureFields(pm);
    assert.equal(r.valid, true);
  });

  it("accepts deviation=major", () => {
    const pm = { expectedOutcome: "Task done", actualOutcome: "Build passed", deviation: "major" };
    const r = validatePostmortemClosureFields(pm);
    assert.equal(r.valid, true);
  });
});

describe("validatePostmortemClosureFields — negative paths", () => {
  it("rejects when expectedOutcome is empty string", () => {
    const pm = { expectedOutcome: "", actualOutcome: "Build passed", deviation: "none" };
    const r = validatePostmortemClosureFields(pm);
    assert.equal(r.valid, false);
    assert.ok(r.emptyFields.includes("expectedOutcome"),
      "emptyFields must include expectedOutcome");
  });

  it("rejects when actualOutcome is empty string", () => {
    const pm = { expectedOutcome: "Task done", actualOutcome: "", deviation: "none" };
    const r = validatePostmortemClosureFields(pm);
    assert.equal(r.valid, false);
    assert.ok(r.emptyFields.includes("actualOutcome"),
      "emptyFields must include actualOutcome");
  });

  it("rejects when deviation is empty string", () => {
    const pm = { expectedOutcome: "Task done", actualOutcome: "Build passed", deviation: "" };
    const r = validatePostmortemClosureFields(pm);
    assert.equal(r.valid, false);
    assert.ok(r.emptyFields.includes("deviation"),
      "emptyFields must include deviation");
  });

  it("rejects when expectedOutcome is missing (undefined)", () => {
    const pm = { actualOutcome: "Build passed", deviation: "none" };
    const r = validatePostmortemClosureFields(pm);
    assert.equal(r.valid, false);
    assert.ok(r.emptyFields.includes("expectedOutcome"));
    assert.equal(r.reason, POSTMORTEM_CLOSURE_VALIDATION_REASON.MISSING_FIELD);
  });

  it("rejects when deviation is an unknown value", () => {
    const pm = { expectedOutcome: "Task done", actualOutcome: "Build passed", deviation: "catastrophic" };
    const r = validatePostmortemClosureFields(pm);
    assert.equal(r.valid, false,
      "unknown deviation value must be rejected — only 'none', 'minor', 'major' are valid");
    assert.ok(r.emptyFields.includes("deviation"));
  });

  it("rejects null input entirely", () => {
    const r = validatePostmortemClosureFields(null);
    assert.equal(r.valid, false);
    assert.equal(r.reason, POSTMORTEM_CLOSURE_VALIDATION_REASON.MISSING_FIELD);
  });
});

describe("runAthenaPostmortem — fallback learning-grade guard", () => {
  it("routes AI fallback postmortems to degraded review with replay/manual follow-up", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-athena-fallback-"));
    try {
      const config = {
        paths: {
          stateDir,
          progressFile: path.join(stateDir, "progress.log"),
          policyFile: path.join(stateDir, "policy.json"),
        },
        env: {
          targetRepo: "Ancora-Labs/Box",
          copilotCliCommand: "__missing_copilot_binary__",
        },
        roleRegistry: {
          qualityReviewer: { name: "Athena", model: "GPT-5.3-Codex" },
        },
        athena: { forceAiPostmortem: true },
      };
      const workerResult = {
        roleName: "quality-worker",
        status: "done",
        summary: "Worker completed task and reported status.",
        verificationPassed: true,
        verificationEvidence: { build: "pass", tests: "pass", lint: "pass" },
      };
      const originalPlan = { task: "Harden fallback handling for Athena postmortems", riskLevel: "low" };
      const result: any = await runAthenaPostmortem(config as any, workerResult as any, originalPlan as any);

      assert.equal(result.reviewStatus, POSTMORTEM_REVIEW_STATUS.DEGRADED_REVIEW_REQUIRED);
      assert.equal(result.learningGradeEligible, false);
      assert.equal(result.degradedReviewReason, DEGRADED_POSTMORTEM_REVIEW_REASON.AI_POSTMORTEM_FAILURE);
      assert.equal(result.followUpNeeded, true);
      assert.match(String(result.followUpTask || ""), /replay|manual/i);
      assert.equal(result.decisionQualityStatus, "degraded");
      assert.equal(result.closureFieldsValid, true);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});

// ── isEnvelopeUnambiguous (Task 3) ────────────────────────────────────────────

import { isEnvelopeUnambiguous } from "../../src/core/evidence_envelope.js";

const UNAMBIGUOUS_ENVELOPE = {
  roleName: "evolution-worker",
  status: "done",
  summary: "All tests passed and build succeeded without errors.",
  verificationEvidence: { build: "pass", tests: "pass", lint: "pass" },
  verificationPassed: true,
};

describe("isEnvelopeUnambiguous — positive path", () => {
  it("returns unambiguous=true for a fully green low-risk envelope", () => {
    const r = isEnvelopeUnambiguous(UNAMBIGUOUS_ENVELOPE, { planRiskLevel: "low" });
    assert.equal(r.unambiguous, true);
    assert.deepEqual(r.reasons, []);
  });

  it("returns unambiguous=true when lint is n/a", () => {
    const env = { ...UNAMBIGUOUS_ENVELOPE, verificationEvidence: { build: "pass", tests: "pass", lint: "n/a" } };
    const r = isEnvelopeUnambiguous(env);
    assert.equal(r.unambiguous, true);
  });

  it("returns unambiguous=true when preReviewIssues is absent", () => {
    const r = isEnvelopeUnambiguous({ ...UNAMBIGUOUS_ENVELOPE });
    assert.equal(r.unambiguous, true);
  });
});

describe("isEnvelopeUnambiguous — negative paths (Task 3 gate)", () => {
  it("returns unambiguous=false when plan riskLevel=high", () => {
    const r = isEnvelopeUnambiguous(UNAMBIGUOUS_ENVELOPE, { planRiskLevel: "high" });
    assert.equal(r.unambiguous, false,
      "high-risk plans must always require full AI review — never take deterministic fast-path");
    assert.ok(r.reasons.length > 0);
  });

  it("returns unambiguous=false when status is not 'done'", () => {
    const env = { ...UNAMBIGUOUS_ENVELOPE, status: "partial" };
    const r = isEnvelopeUnambiguous(env);
    assert.equal(r.unambiguous, false);
    assert.ok(r.reasons.some(s => s.includes("status")));
  });

  it("returns unambiguous=false when verificationPassed is false", () => {
    const env = { ...UNAMBIGUOUS_ENVELOPE, verificationPassed: false };
    const r = isEnvelopeUnambiguous(env);
    assert.equal(r.unambiguous, false);
    assert.ok(r.reasons.some(s => s.includes("verificationPassed")));
  });

  it("returns unambiguous=false when build evidence is not 'pass'", () => {
    const env = { ...UNAMBIGUOUS_ENVELOPE, verificationEvidence: { build: "fail", tests: "pass", lint: "pass" } };
    const r = isEnvelopeUnambiguous(env);
    assert.equal(r.unambiguous, false);
    assert.ok(r.reasons.some(s => s.includes("build")));
  });

  it("returns unambiguous=false when lint evidence is 'fail'", () => {
    const env = { ...UNAMBIGUOUS_ENVELOPE, verificationEvidence: { build: "pass", tests: "pass", lint: "fail" } };
    const r = isEnvelopeUnambiguous(env);
    assert.equal(r.unambiguous, false);
    assert.ok(r.reasons.some(s => s.includes("lint")));
  });

  it("returns unambiguous=false when preReviewIssues is non-empty (unfixed issues)", () => {
    const env = { ...UNAMBIGUOUS_ENVELOPE, preReviewIssues: ["missing test coverage"] };
    const r = isEnvelopeUnambiguous(env);
    assert.equal(r.unambiguous, false,
      "unfixed pre-review issues make the result ambiguous — must fall through to AI review");
    assert.ok(r.reasons.some(s => s.includes("preReviewIssues")));
  });

  it("returns unambiguous=false for null input (structural check fails)", () => {
    const r = isEnvelopeUnambiguous(null);
    assert.equal(r.unambiguous, false);
  });
});

// ── deriveDeterministicRecommendation ─────────────────────────────────────────

describe("deriveDeterministicRecommendation", () => {
  it("returns proceed for correct label", () => {
    assert.equal(
      deriveDeterministicRecommendation(DECISION_QUALITY_LABEL.CORRECT),
      POSTMORTEM_RECOMMENDATION.PROCEED,
    );
  });

  it("returns proceed for delayed-correct label", () => {
    assert.equal(
      deriveDeterministicRecommendation(DECISION_QUALITY_LABEL.DELAYED_CORRECT),
      POSTMORTEM_RECOMMENDATION.PROCEED,
    );
  });

  it("returns rework for inconclusive label — never silently proceed on missing evidence", () => {
    assert.equal(
      deriveDeterministicRecommendation(DECISION_QUALITY_LABEL.INCONCLUSIVE),
      POSTMORTEM_RECOMMENDATION.REWORK,
      "inconclusive outcome must produce rework, not proceed",
    );
  });

  it("returns escalate for incorrect label (rollback scenario)", () => {
    assert.equal(
      deriveDeterministicRecommendation(DECISION_QUALITY_LABEL.INCORRECT),
      POSTMORTEM_RECOMMENDATION.ESCALATE,
    );
  });

  it("negative path: returns rework for unknown/empty label — safe default", () => {
    assert.equal(deriveDeterministicRecommendation(""),             POSTMORTEM_RECOMMENDATION.REWORK);
    assert.equal(deriveDeterministicRecommendation("some-future"),  POSTMORTEM_RECOMMENDATION.REWORK);
    assert.equal(deriveDeterministicRecommendation(null as any),    POSTMORTEM_RECOMMENDATION.REWORK);
  });
});

// ── ATHENA_FAST_PATH_REASON: delta-review ─────────────────────────────────────

describe("ATHENA_FAST_PATH_REASON enum", () => {
  it("exports DELTA_REVIEW_APPROVED constant", () => {
    assert.equal(ATHENA_FAST_PATH_REASON.DELTA_REVIEW_APPROVED, "DELTA_REVIEW_APPROVED");
    assert.ok(Object.isFrozen(ATHENA_FAST_PATH_REASON), "ATHENA_FAST_PATH_REASON must be frozen");
  });

  it("still exports the two original constants unchanged", () => {
    assert.equal(ATHENA_FAST_PATH_REASON.LOW_RISK_UNCHANGED, "LOW_RISK_UNCHANGED");
    assert.equal(ATHENA_FAST_PATH_REASON.HIGH_QUALITY_LOW_RISK, "HIGH_QUALITY_LOW_RISK");
  });
});

describe("AUTO_APPROVE_DELTA_REVIEW_THRESHOLD", () => {
  it("is a number at or above 0 and at or below 100", () => {
    assert.ok(typeof AUTO_APPROVE_DELTA_REVIEW_THRESHOLD === "number");
    assert.ok(AUTO_APPROVE_DELTA_REVIEW_THRESHOLD >= 0 && AUTO_APPROVE_DELTA_REVIEW_THRESHOLD <= 100);
  });
});

// ── Delta-review fast path integration ───────────────────────────────────────

describe("runAthenaPlanReview — delta-review fast path", () => {
  let tmpDir: string;
  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-delta-test-"));
  });
  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns DELTA_REVIEW_APPROVED when cached review exists, fingerprint changed, all plans high quality", async () => {
    // Write a prior cached review with a different fingerprint (simulates fingerprint changed)
    const priorReview = {
      approved: true,
      planBatchFingerprint: "deadbeef00000000", // intentionally different from actual batch
      overallScore: 90,
      reviewedAt: new Date(Date.now() - 3600000).toISOString(),
    };
    await fs.writeFile(
      path.join(tmpDir, "athena_plan_review.json"),
      JSON.stringify(priorReview),
      "utf8",
    );

    // High-quality low-risk plans that will score above the delta threshold
    const plans = [
      {
        task: "Refactor utility module to remove duplication and improve coverage",
        role: "evolution-worker",
        wave: 1,
        riskLevel: "low",
        acceptance_criteria: ["All unit tests pass", "No lint errors", "Coverage remains at or above 90%"],
        verification: "Run npm test and npm run lint; confirm exit code 0",
        context: "utility.ts currently has two near-identical helpers that can be merged",
      },
    ];

    const config = {
      paths: {
        stateDir: tmpDir,
        progressFile: path.join(tmpDir, "progress.log"),
      },
      runtime: {
        disablePlanReviewCache: false,
        autoApproveDeltaReviewThreshold: 0, // threshold=0 so any plan score passes
      },
      env: { targetRepo: "test/repo" },
    };

    const result = await runAthenaPlanReview(config, { plans });
    assert.ok(result.autoApproved, "result should be auto-approved via delta path");
    assert.equal(
      result.autoApproveReason?.code,
      ATHENA_FAST_PATH_REASON.DELTA_REVIEW_APPROVED,
      "auto-approve reason code must be DELTA_REVIEW_APPROVED",
    );
  });

  it("negative path: does NOT delta-approve when cached review exists but plan quality is below threshold", async () => {
    // Use a sub-dir so the cached review is the one we write
    const subDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-delta-low-"));
    try {
      const priorReview = {
        approved: true,
        planBatchFingerprint: "00000000ffffffff",
        overallScore: 80,
        reviewedAt: new Date(Date.now() - 3600000).toISOString(),
      };
      await fs.writeFile(
        path.join(subDir, "athena_plan_review.json"),
        JSON.stringify(priorReview),
        "utf8",
      );
      const plans = [
        { task: "x", role: "evolution-worker", wave: 1, riskLevel: "low" },
      ];
      const config = {
        paths: {
          stateDir: subDir,
          progressFile: path.join(subDir, "progress.log"),
        },
        runtime: {
          disablePlanReviewCache: false,
          autoApproveDeltaReviewThreshold: 100, // threshold=100, no plan can reach it
        },
        env: { targetRepo: "test/repo" },
      };
      const result = await runAthenaPlanReview(config, { plans });
      // Should NOT have the delta reason code
      assert.notEqual(
        result.autoApproveReason?.code,
        ATHENA_FAST_PATH_REASON.DELTA_REVIEW_APPROVED,
        "should not delta-approve when quality is below threshold",
      );
    } finally {
      await fs.rm(subDir, { recursive: true, force: true });
    }
  });
});
