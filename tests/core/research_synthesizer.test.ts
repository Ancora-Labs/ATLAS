import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  stripExecutionTranscriptNoise,
  sanitizeResearchSynthesisForPersistence,
} from "../../src/core/research_synthesizer.js";

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
