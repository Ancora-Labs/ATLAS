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
  markCycleDeltaSectionsRequired,
  PROMPT_BUDGET_PARTITION,
  analyzePacketDensification,
  validateActionablePacketCompleteness,
  ACTIONABLE_PACKET_CONTRACT_TERMS,
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

// ── markCycleDeltaSectionsRequired — cycle-delta bandwidth guarantee ──────────

describe("markCycleDeltaSectionsRequired()", () => {
  const CYCLE_DELTA_NAMES: ReadonlySet<string> = new Set([
    "research-intelligence",
    "topic-memory",
    "behavior-patterns",
    "carry-forward",
  ]);

  it("marks cycle-delta sections as required: true", () => {
    const sections = [
      section("research-intelligence", "some research data"),
      section("context", "some context"),
    ];
    const result = markCycleDeltaSectionsRequired(sections, CYCLE_DELTA_NAMES);
    const deltaSection = result.find(s => s.name === "research-intelligence")!;
    const otherSection = result.find(s => s.name === "context")!;
    assert.equal(deltaSection.required, true, "cycle-delta section must be required");
    assert.equal(otherSection.required, false, "non-delta section must not be required");
  });

  it("cycle-delta sections survive compilePrompt budget trimming when marked required", () => {
    const sections = [
      section("topic-memory", "TOPIC_MEMORY_DATA"),
      section("large-optional", "X".repeat(100_000)),
    ];
    const withRequired = markCycleDeltaSectionsRequired(sections, CYCLE_DELTA_NAMES);
    const result = compilePrompt(withRequired, { tokenBudget: 50 });
    assert.ok(result.includes("TOPIC_MEMORY_DATA"), "cycle-delta section must survive token pressure");
    assert.ok(!result.includes("X".repeat(10)), "large optional section must be dropped");
  });

  it("does not mutate input sections", () => {
    const sections = [{ name: "carry-forward", content: "data" }];
    markCycleDeltaSectionsRequired(sections, CYCLE_DELTA_NAMES);
    assert.equal((sections[0] as any).required, undefined, "original must be unmodified");
  });

  it("preserves existing required: true on non-delta sections", () => {
    const sections = [
      { ...section("role", "You are Prometheus."), required: true },
      section("research-intelligence", "delta"),
    ];
    const result = markCycleDeltaSectionsRequired(sections, CYCLE_DELTA_NAMES);
    assert.equal(result[0].required, true, "explicit required:true must be preserved");
    assert.equal(result[1].required, true, "cycle-delta must be required");
  });

  it("returns empty array for empty input", () => {
    const result = markCycleDeltaSectionsRequired([], CYCLE_DELTA_NAMES);
    assert.deepEqual(result, []);
  });

  it("negative path: non-delta sections remain required: false by default", () => {
    const sections = [
      section("role", "You are X."),
      section("system", "Instructions."),
      section("context", "Dynamic data."),
    ];
    const result = markCycleDeltaSectionsRequired(sections, CYCLE_DELTA_NAMES);
    for (const s of result) {
      assert.equal(s.required, false, `non-delta section "${s.name}" must not be required`);
    }
  });

  it("handles all four expected cycle-delta names", () => {
    const allDelta = Array.from(CYCLE_DELTA_NAMES).map(name => section(name, `content-${name}`));
    const result = markCycleDeltaSectionsRequired(allDelta, CYCLE_DELTA_NAMES);
    for (const s of result) {
      assert.equal(s.required, true, `cycle-delta section "${s.name}" must be required`);
    }
  });
});

// ── PROMPT_BUDGET_PARTITION — three-pass deterministic trimming ───────────────

describe("PROMPT_BUDGET_PARTITION", () => {
  it("exports INVARIANT, REQUIRED, EXPANDABLE string constants", () => {
    assert.equal(PROMPT_BUDGET_PARTITION.INVARIANT,  "invariant");
    assert.equal(PROMPT_BUDGET_PARTITION.REQUIRED,   "required");
    assert.equal(PROMPT_BUDGET_PARTITION.EXPANDABLE, "expandable");
  });

  it("is frozen (immutable)", () => {
    assert.ok(Object.isFrozen(PROMPT_BUDGET_PARTITION));
  });
});

describe("compilePrompt — three-pass budget trimming", () => {
  it("INVARIANT section is included even when it exceeds tokenBudget", () => {
    const big = Object.assign(section("core", "I".repeat(2000)), {
      partitionBudget: PROMPT_BUDGET_PARTITION.INVARIANT,
    });
    const result = compilePrompt([big], { tokenBudget: 10 });
    assert.ok(result.includes("I".repeat(100)), "invariant section must be present despite budget");
  });

  it("INVARIANT section bypasses section-level maxTokens cap", () => {
    const big = Object.assign(section("core", "X".repeat(400)), {
      partitionBudget: PROMPT_BUDGET_PARTITION.INVARIANT,
      maxTokens: 5, // would normally truncate to ~20 chars
    });
    const result = compilePrompt([big]);
    // Should not be truncated — invariant bypasses maxTokens
    assert.ok(!result.includes("[...truncated to section budget]"), "invariant must bypass maxTokens");
    assert.equal(result.length, 400);
  });

  it("REQUIRED section is always included and subject to section maxTokens", () => {
    const req = Object.assign(section("req", "R".repeat(400)), {
      partitionBudget: PROMPT_BUDGET_PARTITION.REQUIRED,
      maxTokens: 5, // cap at ~20 chars
    });
    const result = compilePrompt([req], { tokenBudget: 5000 });
    assert.ok(result.includes("[...truncated to section budget]"), "required section must be truncated by maxTokens");
  });

  it("EXPANDABLE section is dropped when budget is exhausted by invariant + required", () => {
    const inv = Object.assign(section("inv", "A".repeat(200)), {
      partitionBudget: PROMPT_BUDGET_PARTITION.INVARIANT,
    }); // ~50 tokens
    const req = Object.assign(section("req", "B".repeat(200)), {
      partitionBudget: PROMPT_BUDGET_PARTITION.REQUIRED,
    }); // ~50 tokens
    const exp = Object.assign(section("exp", "EXPANDABLE_DATA"), {
      partitionBudget: PROMPT_BUDGET_PARTITION.EXPANDABLE,
    }); // ~4 tokens — but budget is already exhausted
    const result = compilePrompt([inv, req, exp], { tokenBudget: 100 });
    assert.ok(result.includes("A".repeat(200)), "invariant must be present");
    assert.ok(result.includes("B".repeat(200)), "required must be present");
    assert.ok(!result.includes("EXPANDABLE_DATA"), "expandable must be dropped when budget exhausted");
  });

  it("EXPANDABLE sections fill remaining budget after invariant + required", () => {
    const inv = Object.assign(section("inv", "A".repeat(40)), {
      partitionBudget: PROMPT_BUDGET_PARTITION.INVARIANT,
    }); // ~10 tokens
    const req = Object.assign(section("req", "B".repeat(40)), {
      partitionBudget: PROMPT_BUDGET_PARTITION.REQUIRED,
    }); // ~10 tokens
    const exp = Object.assign(section("exp", "FITS"), {
      partitionBudget: PROMPT_BUDGET_PARTITION.EXPANDABLE,
    }); // 1 token — should fit in budget=100
    const result = compilePrompt([inv, req, exp], { tokenBudget: 100 });
    assert.ok(result.includes("FITS"), "expandable section must be included when budget allows");
  });

  it("original section order is preserved across all three partitions", () => {
    const s1 = Object.assign(section("first",  "AAA"), { partitionBudget: PROMPT_BUDGET_PARTITION.EXPANDABLE });
    const s2 = Object.assign(section("second", "BBB"), { partitionBudget: PROMPT_BUDGET_PARTITION.REQUIRED });
    const s3 = Object.assign(section("third",  "CCC"), { partitionBudget: PROMPT_BUDGET_PARTITION.INVARIANT });
    const s4 = Object.assign(section("fourth", "DDD"), { partitionBudget: PROMPT_BUDGET_PARTITION.EXPANDABLE });
    const result = compilePrompt([s1, s2, s3, s4], { tokenBudget: 10000 });
    const posA = result.indexOf("AAA");
    const posB = result.indexOf("BBB");
    const posC = result.indexOf("CCC");
    const posD = result.indexOf("DDD");
    assert.ok(posA < posB && posB < posC && posC < posD, "section order must be preserved across partitions");
  });

  it("backward compat: required:true without partitionBudget behaves as REQUIRED partition", () => {
    const req = { ...section("req", "MUST_KEEP"), required: true };
    const exp = section("exp", "X".repeat(400)); // ~100 tokens, no budget for it
    const result = compilePrompt([exp, req], { tokenBudget: 10 });
    assert.ok(result.includes("MUST_KEEP"), "required:true section must be retained (backward compat)");
  });

  it("negative path: all-expandable sections drop when budget is zero-like", () => {
    const s1 = Object.assign(section("a", "A".repeat(400)), { partitionBudget: PROMPT_BUDGET_PARTITION.EXPANDABLE });
    const s2 = Object.assign(section("b", "B".repeat(400)), { partitionBudget: PROMPT_BUDGET_PARTITION.EXPANDABLE });
    // tokenBudget: 5 — only ~20 chars fit; first expandable should fit if ≤ 5 tokens
    const tiny = Object.assign(section("tiny", "Hi"), { partitionBudget: PROMPT_BUDGET_PARTITION.EXPANDABLE });
    const result = compilePrompt([s1, s2, tiny], { tokenBudget: 5 });
    assert.ok(!result.includes("A".repeat(100)), "large expandable must be dropped");
    assert.ok(!result.includes("B".repeat(100)), "large expandable must be dropped");
  });
});

describe("markCycleDeltaSectionsRequired — partitionBudget field", () => {
  const CYCLE_DELTA: ReadonlySet<string> = new Set(["research-intelligence", "carry-forward"]);

  it("sets partitionBudget: REQUIRED on cycle-delta sections", () => {
    const sections = [section("research-intelligence", "data")];
    const result = markCycleDeltaSectionsRequired(sections, CYCLE_DELTA);
    assert.equal(result[0].partitionBudget, PROMPT_BUDGET_PARTITION.REQUIRED);
  });

  it("sets partitionBudget: EXPANDABLE on non-delta sections", () => {
    const sections = [section("context", "some context")];
    const result = markCycleDeltaSectionsRequired(sections, CYCLE_DELTA);
    assert.equal(result[0].partitionBudget, PROMPT_BUDGET_PARTITION.EXPANDABLE);
  });

  it("preserves existing partitionBudget on non-delta sections", () => {
    const sections = [Object.assign(section("role", "You are X."), {
      partitionBudget: PROMPT_BUDGET_PARTITION.INVARIANT,
    })];
    const result = markCycleDeltaSectionsRequired(sections, CYCLE_DELTA);
    assert.equal(result[0].partitionBudget, PROMPT_BUDGET_PARTITION.INVARIANT,
      "existing partitionBudget must be preserved on non-delta sections");
  });

  it("cycle-delta sections with partitionBudget:REQUIRED survive compilePrompt budget pressure", () => {
    const sections = [
      section("research-intelligence", "RESEARCH_DELTA"),
      section("large-context", "Z".repeat(100_000)),
    ];
    const withPartitions = markCycleDeltaSectionsRequired(sections, CYCLE_DELTA);
    const result = compilePrompt(withPartitions, { tokenBudget: 50 });
    assert.ok(result.includes("RESEARCH_DELTA"), "cycle-delta section must survive token pressure");
    assert.ok(!result.includes("Z".repeat(10)), "large expandable must be dropped");
  });
});

describe("analyzePacketDensification()", () => {
  it("flags thin packets when minimum density fields are missing", () => {
    const result = analyzePacketDensification([
      {
        task: "Small fix",
        target_files: ["src/core/a.ts"],
        acceptance_criteria: ["works"],
        estimatedExecutionTokens: 1000,
      },
    ]);
    assert.equal(result.thinCount, 1);
    assert.equal(result.isDenseEnough, false);
    assert.deepEqual(result.thinIndexes, [0]);
  });

  it("passes dense packets that satisfy floor thresholds", () => {
    const result = analyzePacketDensification([
      {
        task: "Implement bundled prompt densification checks with token-aware packet quality controls and deterministic acceptance gates.",
        target_files: ["src/core/prometheus.ts", "src/core/prompt_compiler.ts"],
        acceptance_criteria: ["criterion 1", "criterion 2"],
        estimatedExecutionTokens: 12000,
      },
    ]);
    assert.equal(result.thinCount, 0);
    assert.equal(result.isDenseEnough, true);
    assert.equal(result.denseRatio, 1);
  });
});

describe("validateActionablePacketCompleteness()", () => {
  it("requires implementation-status and capacity-first contract terms", () => {
    const result = validateActionablePacketCompleteness([
      section("output", "approved patchedPlans planReviews acceptance_criteria verification"),
    ]);
    assert.equal(result.complete, false);
    assert.ok(result.missingTerms.includes("implementationStatus"));
    assert.ok(result.missingTerms.includes("implementationEvidence"));
    assert.ok(result.missingTerms.includes("capacityDelta"));
    assert.ok(result.missingTerms.includes("requestROI"));
    assert.ok(result.missingTerms.includes("leverage_rank"));
  });

  it("passes when all actionable packet contract terms are present", () => {
    const result = validateActionablePacketCompleteness([
      section("output", ACTIONABLE_PACKET_CONTRACT_TERMS.join(" ")),
    ]);
    assert.equal(result.complete, true);
  });
});
