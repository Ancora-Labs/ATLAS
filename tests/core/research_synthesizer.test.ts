import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  stripExecutionTranscriptNoise,
  sanitizeResearchSynthesisForPersistence,
  computeSynthesisActionableDensity,
  quarantineLowDensityTopics,
  topicHasActionableArtifact,
  buildQualityGateRecoverySignal,
  SYNTHESIS_ACTIONABLE_SIGNAL_MIN_LENGTH,
} from "../../src/core/research_synthesizer.js";

// ── Task 1 invariant: partial quarantine must not trigger degraded mode ────────

describe("qualityGate degradedPlanningMode invariant", () => {
  it("degradedPlanningMode is false when partial quarantine (some topics pass)", () => {
    const topics = [
      { topic: "CI/CD automation", netFindings: ["Fix CI matrix", "Add parallel jobs"] },
      { topic: "Low density topic", netFindings: [] },
    ];
    const densities = [
      { topic: "CI/CD automation",    actionableCount: 2, passed: true },
      { topic: "Low density topic",   actionableCount: 0, passed: false },
    ];
    const { quarantinedTopics, passedTopics } = quarantineLowDensityTopics(topics as any, densities);
    assert.equal(quarantinedTopics.length, 1, "one topic should be quarantined");
    assert.equal(passedTopics.length, 1, "one topic should pass");

    // Mirror how research_synthesizer.ts computes degradedPlanningMode.
    const degradedPlanningMode = quarantinedTopics.length > 0 && passedTopics.length === 0;
    assert.equal(degradedPlanningMode, false,
      "partial quarantine MUST NOT trigger degraded mode — valid signal remains");
  });

  it("degradedPlanningMode is true only when ALL topics are quarantined", () => {
    const topics = [
      { topic: "Empty A", netFindings: [] },
      { topic: "Empty B", netFindings: [] },
    ];
    const densities = [
      { topic: "Empty A", actionableCount: 0, passed: false },
      { topic: "Empty B", actionableCount: 0, passed: false },
    ];
    const { quarantinedTopics, passedTopics } = quarantineLowDensityTopics(topics as any, densities);
    const degradedPlanningMode = quarantinedTopics.length > 0 && passedTopics.length === 0;
    assert.equal(degradedPlanningMode, true,
      "degraded mode must activate when ALL topics are quarantined");
  });
});

describe("research_synthesizer persistence hardening", () => {
  it("strips execution transcript noise while preserving synthesis content", () => {
    const raw = [
      "[research_synthesizer_live]",
      "tool_call: read file",
      "## Topic: Planner contracts",
      "**Net Findings**:",
      "- Keep strict output markers",
      "```json",
      "{}",
      "```",
    ].join("\n");
    const cleaned = stripExecutionTranscriptNoise(raw);
    assert.ok(cleaned.includes("## Topic: Planner contracts"));
    assert.ok(!cleaned.includes("tool_call:"));
    assert.ok(!cleaned.includes("```"));
  });

  it("emits bounded planner-ready synthesis fields", () => {
    const input = {
      success: true,
      topicCount: 1,
      topics: [{
        topic: "Planner contracts",
        confidence: "0.9",
        sourceCount: 1,
        netFindings: ["A".repeat(600)],
        sources: [{
          title: "Source title",
          url: "https://example.com",
          confidence: 1.4,
          scoutFindings: "B".repeat(600),
        }],
      }],
      crossTopicConnections: ["C".repeat(700)],
      researchGaps: "gap-1\ngap-2",
      synthesizedAt: "2026-01-01T00:00:00.000Z",
      scoutSourceCount: 1,
      model: "gpt-5.3-codex",
    };

    const output = sanitizeResearchSynthesisForPersistence(input as any);
    assert.equal(output.success, true);
    assert.equal(output.topicCount, 1);
    assert.ok(Array.isArray(output.topics));
    assert.ok(Array.isArray((output as any).plannerSignals.priorityActions));
    const firstConnection = (output as any).crossTopicConnections[0];
    assert.ok(firstConnection.length <= 360, "cross-topic entries must be bounded");
  });

  it("negative path: drops empty/invalid topics from persisted output", () => {
    const output = sanitizeResearchSynthesisForPersistence({
      success: true,
      topicCount: 2,
      topics: [{ topic: "" }, { topic: "   " }] as any,
      crossTopicConnections: [],
      researchGaps: "",
      synthesizedAt: "2026-01-01T00:00:00.000Z",
      scoutSourceCount: 0,
      model: "gpt-5.3-codex",
    });
    assert.equal(output.topicCount, 0);
    assert.deepEqual(output.topics, []);
  });
});

// ── computeSynthesisActionableDensity (quality gate) ─────────────────────────

describe("computeSynthesisActionableDensity", () => {
  it("counts netFindings and applicableIdeas as actionable signals", () => {
    const topics = [{
      topic: "Topic A",
      netFindings: ["finding 1", "finding 2"],
      applicableIdeas: ["idea 1"],
      sources: [],
    }];
    const densities = computeSynthesisActionableDensity(topics);
    assert.equal(densities.length, 1);
    assert.equal(densities[0].topic, "Topic A");
    assert.equal(densities[0].actionableCount, 3);
    assert.equal(densities[0].passed, true);
  });

  it("counts prometheusReadySummary from sources as actionable signal", () => {
    const topics = [{
      topic: "Topic B",
      netFindings: [],
      applicableIdeas: [],
      sources: [{ prometheusReadySummary: "Key insight here." }],
    }];
    const densities = computeSynthesisActionableDensity(topics);
    assert.equal(densities[0].actionableCount, 1);
    assert.equal(densities[0].passed, true);
  });

  it("returns passed=false when topic has zero actionable signals", () => {
    const topics = [{
      topic: "Empty Topic",
      netFindings: [],
      applicableIdeas: [],
      sources: [{ prometheusReadySummary: "" }],
    }];
    const densities = computeSynthesisActionableDensity(topics);
    assert.equal(densities[0].actionableCount, 0);
    assert.equal(densities[0].passed, false);
  });

  it("ignores whitespace-only findings as non-actionable", () => {
    const topics = [{
      topic: "Whitespace Only",
      netFindings: ["   ", "\t"],
      applicableIdeas: [],
      sources: [],
    }];
    const densities = computeSynthesisActionableDensity(topics);
    assert.equal(densities[0].actionableCount, 0);
    assert.equal(densities[0].passed, false);
  });

  it("returns empty array for empty input", () => {
    const densities = computeSynthesisActionableDensity([]);
    assert.deepEqual(densities, []);
  });

  it("sanitizeResearchSynthesisForPersistence passes through qualityGate field", () => {
    const qualityGate = {
      passed: false,
      retried: true,
      topicDensities: [{ topic: "T", actionableCount: 0, passed: false }],
    };
    const output = sanitizeResearchSynthesisForPersistence({
      success: true,
      topicCount: 1,
      topics: [{ topic: "T", netFindings: ["f1"], sources: [] }] as any,
      crossTopicConnections: [],
      researchGaps: "",
      synthesizedAt: "2026-01-01T00:00:00.000Z",
      scoutSourceCount: 0,
      model: "gpt-5.3-codex",
      qualityGate,
    });
    assert.deepEqual((output as any).qualityGate, qualityGate);
  });

  it("sanitizeResearchSynthesisForPersistence omits qualityGate when not provided", () => {
    const output = sanitizeResearchSynthesisForPersistence({
      success: true,
      topicCount: 1,
      topics: [{ topic: "T", netFindings: ["f1"], sources: [] }] as any,
      crossTopicConnections: [],
      researchGaps: "",
      synthesizedAt: "2026-01-01T00:00:00.000Z",
      scoutSourceCount: 0,
      model: "gpt-5.3-codex",
    });
    assert.equal((output as any).qualityGate, undefined);
  });
});

// ── quarantineLowDensityTopics ─────────────────────────────────────────────────

describe("quarantineLowDensityTopics", () => {
  it("returns all topics as passed when all densities pass", () => {
    const topics = [
      { topic: "Topic A", netFindings: ["f1"] },
      { topic: "Topic B", netFindings: ["f2"] },
    ];
    const densities = [
      { topic: "Topic A", actionableCount: 2, passed: true },
      { topic: "Topic B", actionableCount: 1, passed: true },
    ];
    const result = quarantineLowDensityTopics(topics as any, densities);
    assert.equal(result.passedTopics.length, 2);
    assert.deepEqual(result.quarantinedTopics, []);
  });

  it("quarantines topics that failed density check", () => {
    const topics = [
      { topic: "Good Topic",  netFindings: ["f1"] },
      { topic: "Empty Topic", netFindings: [] },
    ];
    const densities = [
      { topic: "Good Topic",  actionableCount: 1, passed: true },
      { topic: "Empty Topic", actionableCount: 0, passed: false },
    ];
    const result = quarantineLowDensityTopics(topics as any, densities);
    assert.equal(result.passedTopics.length, 1,  "only passed topics survive");
    assert.equal(result.passedTopics[0].topic, "Good Topic");
    assert.deepEqual(result.quarantinedTopics, ["Empty Topic"]);
  });

  it("quarantines all topics when all fail density", () => {
    const topics = [{ topic: "A" }, { topic: "B" }];
    const densities = [
      { topic: "A", actionableCount: 0, passed: false },
      { topic: "B", actionableCount: 0, passed: false },
    ];
    const result = quarantineLowDensityTopics(topics as any, densities);
    assert.equal(result.passedTopics.length, 0);
    assert.equal(result.quarantinedTopics.length, 2);
  });

  it("negative path: returns all topics as passed for empty densities array", () => {
    const topics = [{ topic: "Topic X" }];
    const result = quarantineLowDensityTopics(topics as any, []);
    assert.equal(result.passedTopics.length, 1);
    assert.deepEqual(result.quarantinedTopics, []);
  });

  it("sanitizeResearchSynthesisForPersistence passes quarantinedTopics through qualityGate", () => {
    const qualityGate = {
      passed: false,
      retried: true,
      topicDensities: [{ topic: "Bad Topic", actionableCount: 0, passed: false }],
      quarantinedTopics: ["Bad Topic"],
      degradedPlanningMode: true,
    };
    const output = sanitizeResearchSynthesisForPersistence({
      success: true,
      topicCount: 1,
      topics: [{ topic: "Good Topic", netFindings: ["f1"], sources: [] }] as any,
      crossTopicConnections: [],
      researchGaps: "",
      synthesizedAt: "2026-01-01T00:00:00.000Z",
      scoutSourceCount: 0,
      model: "gpt-5.3-codex",
      qualityGate,
    });
    const qg = (output as any).qualityGate;
    assert.ok(qg, "qualityGate must be persisted");
    assert.deepEqual(qg.quarantinedTopics, ["Bad Topic"]);
    assert.equal(qg.degradedPlanningMode, true);
  });
});

// ── Task 3: Actionable-signal invariants + SYNTHESIS_ACTIONABLE_SIGNAL_MIN_LENGTH ────

describe("SYNTHESIS_ACTIONABLE_SIGNAL_MIN_LENGTH invariant", () => {
  it("rejects strings shorter than the minimum as non-actionable", () => {
    const topics = [{
      topic: "Short Signals Only",
      netFindings: ["f1", "f2", "ok"],
      applicableIdeas: ["x"],
      sources: [],
    }];
    const densities = computeSynthesisActionableDensity(topics);
    assert.equal(densities[0].actionableCount, 0, "sub-threshold signals must not count toward density");
    assert.equal(densities[0].passed, false, "topic must fail density with only noise signals");
  });

  it("accepts strings meeting the minimum length threshold", () => {
    const topics = [{
      topic: "Real Signals",
      netFindings: ["Deploy fix"],   // 10 chars ≥ 5
      applicableIdeas: ["Add test"],  // 8 chars ≥ 5
      sources: [],
    }];
    const densities = computeSynthesisActionableDensity(topics);
    assert.equal(densities[0].actionableCount, 2, "both signals must count toward density");
    assert.equal(densities[0].passed, true);
  });

  it("mixed short and long signals: only long ones contribute to count", () => {
    const topics = [{
      topic: "Mixed",
      netFindings: ["ok", "Fix the failing test suite now"],  // "ok" noise, long one actionable
      applicableIdeas: [],
      sources: [],
    }];
    const densities = computeSynthesisActionableDensity(topics);
    assert.equal(densities[0].actionableCount, 1, "only the long finding must count");
  });

  it("whitespace padding does not artificially inflate length", () => {
    const topics = [{
      topic: "Padded",
      netFindings: ["   ok   "],  // after trim = 2 chars
      applicableIdeas: [],
      sources: [],
    }];
    const densities = computeSynthesisActionableDensity(topics);
    assert.equal(densities[0].actionableCount, 0, "trimmed short string must not count");
  });

  it("SYNTHESIS_ACTIONABLE_SIGNAL_MIN_LENGTH is exported and its value is positive", () => {
    assert.ok(typeof SYNTHESIS_ACTIONABLE_SIGNAL_MIN_LENGTH === "number", "must be a number");
    assert.ok(SYNTHESIS_ACTIONABLE_SIGNAL_MIN_LENGTH > 1, "floor must be > 1 to reject single-char noise");
  });
});

// ── topicHasActionableArtifact — persistence-time invariant ───────────────────

describe("topicHasActionableArtifact", () => {
  it("returns true for topic with a netFinding of sufficient length", () => {
    const topic = { topic: "CI Coverage", netFindings: ["Fix the integration test suite"] };
    assert.equal(topicHasActionableArtifact(topic), true);
  });

  it("returns true for topic with a prometheusReadySummary in sources", () => {
    const topic = {
      topic: "Auth Security",
      sources: [{ prometheusReadySummary: "Add JWT validation to all endpoints" }],
    };
    assert.equal(topicHasActionableArtifact(topic), true);
  });

  it("returns true for topic with scoutFindings in sources", () => {
    const topic = {
      topic: "Test Coverage",
      sources: [{ scoutFindings: "Coverage is below 60% in core modules" }],
    };
    assert.equal(topicHasActionableArtifact(topic), true);
  });

  it("returns true for topic with an applicableIdea", () => {
    const topic = {
      topic: "Observability",
      netFindings: [],
      applicableIdeas: ["Add structured logging with correlation IDs"],
    };
    assert.equal(topicHasActionableArtifact(topic), true);
  });

  it("returns false for topic with only empty arrays", () => {
    const topic = {
      topic: "Empty Topic",
      netFindings: [],
      applicableIdeas: [],
      sources: [],
    };
    assert.equal(topicHasActionableArtifact(topic), false);
  });

  it("returns false for topic with only sub-threshold strings", () => {
    const topic = {
      topic: "Noise Topic",
      netFindings: ["ok", "x"],
      applicableIdeas: ["y"],
      sources: [{ scoutFindings: "abc" }],
    };
    assert.equal(topicHasActionableArtifact(topic), false);
  });

  it("negative path: returns false for null/undefined input", () => {
    assert.equal(topicHasActionableArtifact(null as any), false);
    assert.equal(topicHasActionableArtifact(undefined as any), false);
  });

  it("sanitizeResearchSynthesisForPersistence drops topics without actionable artifact", () => {
    const output = sanitizeResearchSynthesisForPersistence({
      success: true,
      topicCount: 2,
      topics: [
        { topic: "Has Signal", netFindings: ["Fix the failing test suite"] },
        { topic: "No Signal",  netFindings: [], applicableIdeas: [], sources: [] },
      ] as any,
      crossTopicConnections: [],
      researchGaps: "",
      synthesizedAt: "2026-01-01T00:00:00.000Z",
      scoutSourceCount: 0,
      model: "gpt-5.3-codex",
    });
    assert.equal(output.topicCount, 1, "only the topic with signal should be retained");
    assert.equal((output.topics as any[])[0].topic, "Has Signal");
  });
});

// ── buildQualityGateRecoverySignal ────────────────────────────────────────────

describe("buildQualityGateRecoverySignal", () => {
  it("returns a non-empty string when quarantined topic names are provided", () => {
    const signal = buildQualityGateRecoverySignal(["CI/CD Pipeline", "Auth Security"]);
    assert.ok(signal.length > 0, "recovery signal must be non-empty");
    assert.ok(signal.includes("CI/CD Pipeline"), "topic name must appear in recovery signal");
    assert.ok(signal.includes("Auth Security"), "both topic names must appear");
  });

  it("includes all topic names and a density-failure explanation", () => {
    const signal = buildQualityGateRecoverySignal(["Topic A", "Topic B"]);
    assert.ok(signal.includes("density check"), "must mention density check failure");
    assert.ok(signal.includes("minimal planning signal"), "must suggest using topics as minimal signal");
  });

  it("returns empty string when no quarantined topic names are provided", () => {
    assert.equal(buildQualityGateRecoverySignal([]), "");
  });

  it("returns empty string when all names are blank", () => {
    assert.equal(buildQualityGateRecoverySignal(["", "   ", ""]), "");
  });

  it("negative path: degraded mode WITHOUT recovery signal would leave Prometheus with empty context", () => {
    // Verify that the recovery signal IS non-empty for a typical failure case
    // (i.e. the feature actually provides the recovery path)
    const signal = buildQualityGateRecoverySignal(["Test Coverage Gap"]);
    assert.notEqual(signal, "",
      "recovery signal must never be empty when topic names exist — Prometheus needs minimal context");
  });
});

// ── Task 3: scout-to-synthesis provenance coupling invariants ─────────────────

describe("research_synthesizer — provenance coupling invariants (Task 3)", () => {
  it("sanitizeResearchSynthesisForPersistence includes recoverySignal when degradedPlanningMode=true", () => {
    const payload = {
      success: true,
      topicCount: 0,
      topics: [],
      crossTopicConnections: [],
      researchGaps: "",
      synthesizedAt: new Date().toISOString(),
      scoutSourceCount: 0,
      model: "test-model",
      qualityGate: {
        passed: false,
        retried: false,
        topicDensities: [],
        quarantinedTopics: ["CI Pipeline", "Auth Security"],
        degradedPlanningMode: true,
        recoverySignal: "Research completed on topics: CI Pipeline, Auth Security. All topics failed density check — use topic names as minimal planning signal.",
      },
    };
    const result = sanitizeResearchSynthesisForPersistence(payload);
    assert.ok(result.qualityGate, "qualityGate must be persisted");
    assert.equal((result.qualityGate as any).degradedPlanningMode, true);
    assert.ok(typeof (result.qualityGate as any).recoverySignal === "string" && (result.qualityGate as any).recoverySignal.length > 0,
      "recoverySignal must be non-empty when degradedPlanningMode=true (provenance invariant)");
  });

  it("negative: degradedPlanningMode=true with empty recoverySignal violates provenance invariant", () => {
    // The synthesizer code enforces non-empty recoverySignal on write.
    // This test documents the invariant contract for code reviewers.
    const topicNames = ["Valid Topic A", "Valid Topic B"];
    const signal = buildQualityGateRecoverySignal(topicNames);
    // When topic names are non-empty, signal must be non-empty
    assert.ok(signal.length > 0,
      "recoverySignal invariant: when topics exist and degradedPlanningMode=true, signal must be non-empty");
    assert.ok(signal.includes("Valid Topic A"), "topic provenance must appear in recovery signal");
  });

  it("qualityGate.recoverySignal invariant: non-empty when topic names are provided for degraded state", () => {
    // Mirror the state/research_synthesis.json schema check in pure unit form.
    // When degradedPlanningMode=true, the recoverySignal must be derivable from topic names.
    const topicNames = [
      "Durable Cancellation and Long-Running Loop Control",
      "Runtime Event Contracts and Multi-Agent Routing Semantics",
    ];
    const signal = buildQualityGateRecoverySignal(topicNames);
    assert.ok(
      typeof signal === "string" && signal.trim().length > 0,
      "state/research_synthesis.json: degradedPlanningMode=true requires non-empty recoverySignal (provenance invariant)"
    );
    assert.ok(signal.includes(topicNames[0]), "scout topic name must appear in recovery signal for provenance tracing");
  });
});
