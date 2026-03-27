import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadCorpus, appendCorpusEntry, replayCorpus, MAX_CONFIDENCE_DELTA } from "../../src/core/parser_replay_harness.js";

describe("parser_replay_harness (Packet 10)", () => {
  describe("loadCorpus", () => {
    it("returns empty array for missing file", async () => {
      const corpus = await loadCorpus({ paths: { stateDir: "/nonexistent/path" } });
      assert.ok(Array.isArray(corpus));
      assert.equal(corpus.length, 0);
    });
  });

  describe("appendCorpusEntry", () => {
    it("is a callable function", () => {
      assert.equal(typeof appendCorpusEntry, "function");
    });
  });

  describe("MAX_CONFIDENCE_DELTA", () => {
    it("is a negative number", () => {
      assert.ok(MAX_CONFIDENCE_DELTA < 0);
    });
  });

  describe("replayCorpus", () => {
    it("returns empty results for empty corpus", () => {
      const result = replayCorpus([], () => ({ confidence: 0.5, plans: [] }));
      assert.ok(Array.isArray(result.results));
      assert.equal(result.results.length, 0);
      assert.equal(result.regressionCount, 0);
      assert.equal(result.passed, true);
    });

    it("detects regression when confidence drops significantly", () => {
      const corpus = [
        { id: "t1", raw: "test input", baselineConfidence: 0.9, expectedPlanCount: 1 },
      ];
      const result = replayCorpus(corpus, () => ({ confidence: 0.5, plans: [] }));
      assert.ok(result.regressionCount > 0);
      assert.equal(result.passed, false);
    });

    it("passes when confidence is within threshold", () => {
      const corpus = [
        { id: "t1", raw: "test input", baselineConfidence: 0.8, expectedPlanCount: 1 },
      ];
      const result = replayCorpus(corpus, () => ({ confidence: 0.75, plans: [] }));
      assert.equal(result.regressionCount, 0);
      assert.equal(result.passed, true);
    });

    it("handles multiple corpus entries", () => {
      const corpus = [
        { id: "a", raw: "a", baselineConfidence: 0.9, expectedPlanCount: 1 },
        { id: "b", raw: "b", baselineConfidence: 0.7, expectedPlanCount: 1 },
        { id: "c", raw: "c", baselineConfidence: 0.5, expectedPlanCount: 0 },
      ];
      const result = replayCorpus(corpus, () => ({
        confidence: 0.6,
        plans: [],
      }));
      assert.equal(result.results.length, 3);
    });

    it("detects regression when required key is missing from a plan", () => {
      const corpus = [
        {
          id: "t-req",
          raw: "input",
          baselineConfidence: 0.9,
          expectedPlanCount: 1,
          requiredKeys: ["title", "priority"],
        },
      ];
      // parser returns a plan missing 'priority'
      const result = replayCorpus(corpus, () => ({
        confidence: 0.9,
        plans: [{ title: "do something" }],
      }));
      assert.equal(result.regressionCount, 1);
      assert.equal(result.passed, false);
      assert.ok(result.results[0].omittedKeys.includes("priority"));
    });

    it("passes when all required keys are present in every plan", () => {
      const corpus = [
        {
          id: "t-full",
          raw: "input",
          baselineConfidence: 0.8,
          expectedPlanCount: 1,
          requiredKeys: ["title", "priority"],
        },
      ];
      const result = replayCorpus(corpus, () => ({
        confidence: 0.8,
        plans: [{ title: "task", priority: 1 }],
      }));
      assert.equal(result.regressionCount, 0);
      assert.equal(result.passed, true);
      assert.deepEqual(result.results[0].omittedKeys, []);
    });

    it("detects missing keys across multiple plans", () => {
      const corpus = [
        {
          id: "t-multi",
          raw: "input",
          baselineConfidence: 0.7,
          expectedPlanCount: 2,
          requiredKeys: ["id"],
        },
      ];
      // second plan missing 'id'
      const result = replayCorpus(corpus, () => ({
        confidence: 0.7,
        plans: [{ id: 1, title: "a" }, { title: "b" }],
      }));
      assert.equal(result.regressionCount, 1);
      assert.ok(result.results[0].omittedKeys.includes("id"));
    });

    it("emits empty omittedKeys for corpus entries without requiredKeys", () => {
      const corpus = [
        { id: "t-no-req", raw: "input", baselineConfidence: 0.5, expectedPlanCount: 1 },
      ];
      const result = replayCorpus(corpus, () => ({ confidence: 0.5, plans: [{ title: "x" }] }));
      assert.deepEqual(result.results[0].omittedKeys, []);
    });

    it("flags regression when required keys missing even if confidence is stable", () => {
      const corpus = [
        {
          id: "t-stable-conf",
          raw: "input",
          baselineConfidence: 0.9,
          expectedPlanCount: 1,
          requiredKeys: ["scope"],
        },
      ];
      // confidence unchanged but key absent
      const result = replayCorpus(corpus, () => ({
        confidence: 0.9,
        plans: [{ title: "task" }],
      }));
      assert.equal(result.passed, false);
      assert.ok(result.results[0].omittedKeys.includes("scope"));
    });
  });
});
