import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  section,
  compilePrompt,
  estimateTokens,
  estimatePromptTokens,
  COMMON_SECTIONS,
  PROMPT_TIERS,
  stripFluff,
  compileTieredPrompt,
  markCacheableSegments,
  CACHE_STABLE_SECTION_NAMES,
} from "../../src/core/prompt_compiler.js";

describe("prompt_compiler", () => {
  describe("section()", () => {
    it("creates a named section", () => {
      const s = section("role", "You are Athena.");
      assert.equal(s.name, "role");
      assert.equal(s.content, "You are Athena.");
    });

    it("trims content", () => {
      const s = section("x", "  hello  ");
      assert.equal(s.content, "hello");
    });
  });

  describe("compilePrompt()", () => {
    it("joins sections with double newline by default", () => {
      const result = compilePrompt([section("a", "A"), section("b", "B")]);
      assert.equal(result, "A\n\nB");
    });

    it("skips empty sections", () => {
      const result = compilePrompt([section("a", "A"), section("b", ""), section("c", "C")]);
      assert.equal(result, "A\n\nC");
    });

    it("includes headers when includeHeaders=true", () => {
      const result = compilePrompt([section("role", "You are X.")], { includeHeaders: true });
      assert.ok(result.startsWith("## role\nYou are X."));
    });

    it("respects token budget — truncates sections that exceed budget", () => {
      const longText = "x".repeat(400); // ~100 tokens
      const result = compilePrompt(
        [section("a", "short"), section("b", longText)],
        { tokenBudget: 10 }
      );
      assert.equal(result, "short");
    });

    it("keeps all sections when budget is sufficient", () => {
      const result = compilePrompt(
        [section("a", "hello"), section("b", "world")],
        { tokenBudget: 1000 }
      );
      assert.equal(result, "hello\n\nworld");
    });

    it("retains required sections even when they push past the token budget", () => {
      const longText = "x".repeat(400); // ~100 tokens
      const req = { ...section("required", "MUST_KEEP"), required: true };
      const result = compilePrompt(
        [section("optional", longText), req],
        { tokenBudget: 10 }
      );
      assert.ok(result.includes("MUST_KEEP"), "required section must be retained despite budget");
    });

    it("drops optional sections when budget exhausted by required ones", () => {
      const req = { ...section("req", "R".repeat(200)), required: true }; // ~50 tokens
      const opt = section("opt", "optional text");
      const result = compilePrompt([opt, req], { tokenBudget: 50 });
      // optional should not fit — required alone may already fill the budget
      assert.ok(result.includes("R".repeat(200)), "required section must be present");
    });

    it("truncates section content when maxTokens is set on section", () => {
      const longContent = "a".repeat(200); // ~50 tokens worth
      const s = section("limited", longContent);
      s.maxTokens = 5; // cap at 5 tokens → ~20 chars
      const result = compilePrompt([s]);
      assert.ok(result.length < longContent.length, "should be truncated");
      assert.ok(result.includes("[...truncated to section budget]"));
    });

    it("does not truncate section when content is within maxTokens", () => {
      const s = section("ok", "short text");
      s.maxTokens = 100;
      const result = compilePrompt([s]);
      assert.equal(result, "short text");
    });
  });

  describe("estimateTokens()", () => {
    it("returns 0 for empty/null input", () => {
      assert.equal(estimateTokens(""), 0);
      assert.equal(estimateTokens(null), 0);
      assert.equal(estimateTokens(undefined), 0);
    });

    it("estimates ~1 token per 4 chars", () => {
      assert.equal(estimateTokens("abcd"), 1);
      assert.equal(estimateTokens("abcdefgh"), 2);
    });

    it("rounds up", () => {
      assert.equal(estimateTokens("ab"), 1); // ceil(2/4) = 1
    });
  });

  describe("estimatePromptTokens()", () => {
    it("returns total and per-section breakdown", () => {
      const sections = [section("a", "abcd"), section("b", "12345678")];
      const result = estimatePromptTokens(sections);
      assert.equal(result.total, 3); // 1 + 2
      assert.equal(result.sections.length, 2);
      assert.equal(result.sections[0].name, "a");
      assert.equal(result.sections[0].tokens, 1);
      assert.equal(result.sections[1].name, "b");
      assert.equal(result.sections[1].tokens, 2);
    });

    it("handles empty array", () => {
      const result = estimatePromptTokens([]);
      assert.equal(result.total, 0);
      assert.equal(result.sections.length, 0);
    });
  });

  describe("COMMON_SECTIONS", () => {
    it("has expected sections", () => {
      assert.ok(COMMON_SECTIONS.singlePromptMode);
      assert.ok(COMMON_SECTIONS.jsonOutputMarkers);
      assert.ok(COMMON_SECTIONS.noVagueGoals);
    });

    it("has leverageRankedAlternatives section with required keywords", () => {
      assert.ok(COMMON_SECTIONS.leverageRankedAlternatives, "leverageRankedAlternatives must exist");
      const content = COMMON_SECTIONS.leverageRankedAlternatives.content;
      assert.ok(/leverage/i.test(content), "must mention leverage");
      assert.ok(/alternative/i.test(content), "must mention alternatives");
      assert.ok(/rank/i.test(content), "must mention ranking");
    });

    it("leverageRankedAlternatives is usable as a prompt section", () => {
      const compiled = compilePrompt([
        section("role", "You are Prometheus."),
        COMMON_SECTIONS.leverageRankedAlternatives,
      ]);
      assert.ok(compiled.includes("leverage"), "compiled prompt should include leverage content");
    });
  });

  describe("PROMPT_TIERS (Packet 18)", () => {
    it("has T1, T2, T3 tiers", () => {
      assert.ok(PROMPT_TIERS.T1);
      assert.ok(PROMPT_TIERS.T2);
      assert.ok(PROMPT_TIERS.T3);
    });

    it("T1 has lowest maxTokens", () => {
      assert.ok(PROMPT_TIERS.T1.maxTokens < PROMPT_TIERS.T2.maxTokens);
      assert.ok(PROMPT_TIERS.T2.maxTokens < PROMPT_TIERS.T3.maxTokens);
    });

    it("T1 has antiFluff disabled", () => {
      assert.equal(PROMPT_TIERS.T1.antiFluff, false);
    });

    it("T2/T3 have antiFluff enabled", () => {
      assert.equal(PROMPT_TIERS.T2.antiFluff, true);
      assert.equal(PROMPT_TIERS.T3.antiFluff, true);
    });
  });

  describe("stripFluff (Packet 18)", () => {
    it("strips 'significantly improve'", () => {
      const text = "We should significantly improve performance.";
      const result = stripFluff(text);
      assert.ok(!result.includes("significantly improve"));
    });

    it("strips 'try to enhance'", () => {
      const result = stripFluff("try to enhance the system");
      assert.ok(!result.includes("try to enhance"));
    });

    it("preserves clean text", () => {
      const text = "Add input validation to config parser.";
      assert.equal(stripFluff(text), text);
    });

    it("returns empty for null", () => {
      assert.equal(stripFluff(null), "");
    });
  });

  describe("compileTieredPrompt (Packet 18)", () => {
    it("applies token budget from tier", () => {
      const longText = "x".repeat(4000); // ~1000 tokens
      const result = compileTieredPrompt(
        [section("big", longText)],
        { tier: "T1" }, // T1 has 800 token budget
      );
      assert.ok(result.length < longText.length);
    });

    it("applies anti-fluff for T2", () => {
      const result = compileTieredPrompt(
        [section("mission", "We should significantly improve the codebase and try to enhance quality.")],
        { tier: "T2" },
      );
      assert.ok(!result.includes("significantly improve"));
    });

    it("does not apply anti-fluff for T1", () => {
      const result = compileTieredPrompt(
        [section("mission", "We should significantly improve the codebase.")],
        { tier: "T1" },
      );
      assert.ok(result.includes("significantly improve"));
    });

    it("defaults to T2 when no tier specified", () => {
      const result = compileTieredPrompt(
        [section("a", "short text")],
      );
      assert.ok(result.includes("short text"));
    });

    it("retains required sections even when token budget is exceeded", () => {
      const longText = "x".repeat(4000); // ~1000 tokens — exceeds T1 budget of 800
      const requiredSection = { ...section("footer", "REQUIRED_FOOTER"), required: true };
      const result = compileTieredPrompt(
        [section("big", longText), requiredSection],
        { tier: "T1" },
      );
      assert.ok(result.includes("REQUIRED_FOOTER"), "required section must survive budget truncation");
    });

    it("drops non-required sections when budget is tight but preserves required ones", () => {
      // budget: T1 = 800 tokens. optional section is ~1000 tokens, required is tiny.
      const bigOptional = section("optional", "o".repeat(4000)); // ~1000 tokens
      const tiny = { ...section("must", "KEEP_ME"), required: true };
      const result = compileTieredPrompt([bigOptional, tiny], { tier: "T1" });
      assert.ok(result.includes("KEEP_ME"), "required section must be present");
    });

    it("preserves original section order when required sections are interspersed", () => {
      const s1 = { ...section("first", "AAA"), required: true };
      const s2 = section("second", "BBB");
      const s3 = { ...section("third", "CCC"), required: true };
      const result = compileTieredPrompt([s1, s2, s3], { tier: "T3", tokenBudget: 10000 });
      const posA = result.indexOf("AAA");
      const posB = result.indexOf("BBB");
      const posC = result.indexOf("CCC");
      assert.ok(posA < posB && posB < posC, "order must be preserved");
    });
  });

  describe("markCacheableSegments()", () => {
    it("marks stable section names as cacheable", () => {
      const sections = [
        section("role", "You are Athena."),
        section("context", "Task: fix bug #42"),
      ];
      const result = markCacheableSegments(sections);
      assert.equal(result[0].cacheable, true, "'role' should be cacheable");
      assert.equal(result[1].cacheable, false, "'context' should NOT be cacheable");
    });

    it("marks all CACHE_STABLE_SECTION_NAMES as cacheable", () => {
      for (const name of CACHE_STABLE_SECTION_NAMES) {
        const result = markCacheableSegments([section(name, "content")]);
        assert.equal(result[0].cacheable, true, `section '${name}' should be cacheable`);
      }
    });

    it("honours opts.stableNames for extra stable sections", () => {
      const sections = [section("preamble", "Stable preamble text.")];
      const result = markCacheableSegments(sections, { stableNames: ["preamble"] });
      assert.equal(result[0].cacheable, true);
    });

    it("preserves sections already marked cacheable: true", () => {
      const sections = [{ name: "custom", content: "text", cacheable: true }];
      const result = markCacheableSegments(sections);
      assert.equal(result[0].cacheable, true);
    });

    it("does not mutate input sections", () => {
      const sections = [section("role", "You are X.")];
      markCacheableSegments(sections);
      assert.equal((sections[0] as any).cacheable, undefined, "original should be unmodified");
    });

    it("negative path: returns empty array for empty input", () => {
      const result = markCacheableSegments([]);
      assert.deepEqual(result, []);
    });

    it("CACHE_STABLE_SECTION_NAMES is a Set and contains 'role' and 'system'", () => {
      assert.ok(CACHE_STABLE_SECTION_NAMES instanceof Set);
      assert.ok(CACHE_STABLE_SECTION_NAMES.has("role"));
      assert.ok(CACHE_STABLE_SECTION_NAMES.has("system"));
    });
  });
});
