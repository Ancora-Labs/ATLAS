/**
 * prompt_compiler.js — Assembles agent prompts from reusable sections.
 *
 * Instead of monolithic prompt strings scattered across modules, this compiler
 * builds prompts from named sections that can be shared, tested, and versioned.
 *
 * Usage:
 *   const prompt = compilePrompt([
 *     section("role", "You are Athena — BOX Quality Gate."),
 *     section("context", `TARGET REPO: ${repo}`),
 *     section("mission", missionText),
 *     section("format", outputFormat),
 *   ]);
 */

/**
 * Create a named prompt section.
 *
 * @param {string} name — section identifier for debugging/tracing
 * @param {string} content — the text content of this section
 * @returns {{ name: string, content: string }}
 */
export function section(name, content) {
  return { name, content: String(content || "").trim() };
}

/**
 * Compile an array of prompt sections into a single prompt string.
 * Empty sections are omitted. Each section is separated by a double newline.
 *
 * With section-level caps (Packet 8): each section can have a maxTokens limit.
 * If a section exceeds its cap, it is truncated from the end.
 *
 * Required-field retention: sections marked `required: true` are always included
 * regardless of the global token budget. Optional sections fill remaining budget.
 *
 * @param {Array<{ name: string, content: string, maxTokens?: number, required?: boolean }>} sections
 * @param {{ separator?: string, includeHeaders?: boolean, tokenBudget?: number }} opts
 * @returns {string}
 */
export function compilePrompt(sections, opts: any = {}) {
  const sep = opts.separator || "\n\n";
  const includeHeaders = opts.includeHeaders || false;
  const budget = opts.tokenBudget || 0;

  // Pair each non-empty section with its original index for stable ordering
  const tagged = sections
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => s && s.content && s.content.length > 0)
    .map(({ s, idx }) => {
      let content = s.content;
      // Section-level cap: truncate if section exceeds its own maxTokens
      if (s.maxTokens && s.maxTokens > 0) {
        const sectionTokens = estimateTokens(content);
        if (sectionTokens > s.maxTokens) {
          const maxChars = s.maxTokens * 4;
          content = content.slice(0, maxChars) + "\n[...truncated to section budget]";
        }
      }
      const piece = includeHeaders ? `## ${s.name}\n${content}` : content;
      return { piece, idx, required: s.required === true };
    });

  let pieces: string[];

  // If a global token budget is specified, required sections are always kept;
  // optional sections fill remaining budget in original order.
  if (budget > 0) {
    const requiredItems = tagged.filter(t => t.required);
    const optionalItems = tagged.filter(t => !t.required);

    const requiredTokens = requiredItems.reduce((sum, t) => sum + estimateTokens(t.piece), 0);
    let remainingBudget = budget - requiredTokens;

    const keptOptional: typeof tagged = [];
    for (const item of optionalItems) {
      const t = estimateTokens(item.piece);
      if (remainingBudget - t < 0) break;
      keptOptional.push(item);
      remainingBudget -= t;
    }

    // Merge required + kept optional, preserving original section order
    pieces = [...requiredItems, ...keptOptional]
      .sort((a, b) => a.idx - b.idx)
      .map(t => t.piece);
  } else {
    pieces = tagged.map(t => t.piece);
  }

  return pieces.join(sep);
}

/**
 * Common reusable sections.
 */
export const COMMON_SECTIONS = Object.freeze({
  singlePromptMode: section(
    "single-prompt-mode",
    "EXECUTION MODE: Single-prompt, single-turn. You get ONE shot — no follow-ups, no continues. Make it count."
  ),
  jsonOutputMarkers: section(
    "json-output-markers",
    "Wrap your structured JSON output with:\n===DECISION===\n{ ... }\n===END==="
  ),
  noVagueGoals: section(
    "no-vague-goals",
    "Every goal must be measurable and specific. Do NOT use vague verbs like 'improve', 'optimize', or 'enhance' without a concrete metric."
  ),
  leverageRankedAlternatives: section(
    "leverage-ranked-alternatives",
    [
      "LEVERAGE-RANKED ALTERNATIVES (required for every proposed change):",
      "For each improvement you propose, provide at least 2 concrete alternatives ranked by leverage",
      "(capacity increase per unit effort). State which you recommend and why.",
      "Format each alternative as: [RANK N] <approach> — leverage: <high|medium|low> — rationale: <why>.",
      "Do NOT propose only a single approach. The highest-leverage option must address the system bottleneck directly.",
      "Alternatives that merely re-order existing behavior without measurable capacity gain are NOT valid."
    ].join("\n")
  ),
});

/**
 * Estimate token count for a text string.
 * Uses the ~4 chars per token heuristic (accurate ±10% for English/code).
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

/**
 * Estimate per-section and total token usage for an array of sections.
 *
 * @param {Array<{ name: string, content: string }>} sections
 * @returns {{ total: number, sections: Array<{ name: string, tokens: number }> }}
 */
export function estimatePromptTokens(sections) {
  const result = [];
  let total = 0;
  for (const s of (sections || [])) {
    if (!s || !s.content) continue;
    const t = estimateTokens(s.content);
    result.push({ name: s.name, tokens: t });
    total += t;
  }
  return { total, sections: result };
}

// ─── Packet 18 — Prompt Compiler Tiering by Task Complexity ────────────

/**
 * Complexity tiers matching model_policy.js classifications.
 * Each tier defines: max total tokens, section budgets, and anti-fluff strictness.
 */
export const PROMPT_TIERS = Object.freeze({
  T1: { label: "trivial", maxTokens: 800, antiFluff: false },
  T2: { label: "moderate", maxTokens: 2000, antiFluff: true },
  T3: { label: "complex", maxTokens: 4000, antiFluff: true },
});

/**
 * Vague verbs that add no measurable value to prompts.
 * Used by the anti-fluff filter in T2/T3 prompts.
 */
const FLUFF_PATTERNS = [
  /\b(significantly|drastically|greatly|massively)\s+(improve|enhance|optimize|boost)\b/gi,
  /\bstrive\s+to\b/gi,
  /\bas\s+(?:much|needed|appropriate)\s+as\s+possible\b/gi,
  /\btry\s+(?:to\s+)?(?:improve|enhance|optimize)\b/gi,
];

/**
 * Strip anti-fluff patterns from text.
 * Replaces vague verb phrases with empty string and collapses whitespace.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripFluff(text) {
  if (!text) return "";
  let cleaned = text;
  for (const pat of FLUFF_PATTERNS) {
    cleaned = cleaned.replace(pat, "");
  }
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

/**
 * Compile a tiered prompt — applies complexity-based token budget and anti-fluff.
 *
 * @param {Array<{ name: string, content: string, maxTokens?: number }>} sections
 * @param {{ tier?: "T1"|"T2"|"T3", separator?: string, includeHeaders?: boolean }} opts
 * @returns {string}
 */
export function compileTieredPrompt(sections, opts: any = {}) {
  const tier = PROMPT_TIERS[opts.tier] || PROMPT_TIERS.T2;

  let processed = sections;
  if (tier.antiFluff) {
    // Preserve all section properties (including `required`) when stripping fluff
    processed = sections.map(s => ({
      ...s,
      content: stripFluff(s.content),
    }));
  }

  return compilePrompt(processed, {
    separator: opts.separator,
    includeHeaders: opts.includeHeaders,
    tokenBudget: tier.maxTokens,
  });
}

// ─── Actionable Packet Contract Validation ──────────────────────────────────

/**
 * Required output-contract terms for actionable packet prompts.
 *
 * Every prompt that instructs an AI to produce an actionable packet (a structured
 * response consumed by the dispatch pipeline) MUST reference these terms in the
 * output format section so the AI knows which fields to populate.
 *
 * Absence of any term from the compiled prompt is a completeness gap — the AI
 * may omit that field entirely, causing downstream failures in plan review,
 * normalization, and dispatch.
 *
 * Terms are checked case-insensitively against the full compiled section content.
 */
export const ACTIONABLE_PACKET_CONTRACT_TERMS = Object.freeze([
  "approved",
  "patchedPlans",
  "planReviews",
  "acceptance_criteria",
  "verification",
]);

/**
 * Status codes returned by validateActionablePacketCompleteness.
 *
 * @enum {string}
 */
export const COMPLETENESS_STATUS = Object.freeze({
  /** All required contract terms are present in the sections. */
  COMPLETE: "complete",
  /** One or more required contract terms are absent from the sections. */
  INCOMPLETE: "incomplete",
});

/**
 * Validate that a compiled set of prompt sections provides adequate coverage for
 * an actionable packet response. Checks whether all required contract terms appear
 * in the combined section content so the AI knows which output fields to populate.
 *
 * Terms are checked case-insensitively. A section must have non-empty content to
 * contribute to coverage — empty sections are skipped.
 *
 * @param {Array<{ name: string, content: string }>} sections
 * @returns {{ status: string, complete: boolean, completenessScore: number, missingTerms: string[] }}
 */
export function validateActionablePacketCompleteness(sections) {
  const combinedContent = (sections || [])
    .filter(s => s && typeof s.content === "string" && s.content.trim().length > 0)
    .map(s => s.content)
    .join(" ")
    .toLowerCase();

  const missingTerms = (ACTIONABLE_PACKET_CONTRACT_TERMS as readonly string[]).filter(
    term => !combinedContent.includes(term.toLowerCase())
  );

  const presentCount = ACTIONABLE_PACKET_CONTRACT_TERMS.length - missingTerms.length;
  const completenessScore = ACTIONABLE_PACKET_CONTRACT_TERMS.length > 0
    ? Math.round((presentCount / ACTIONABLE_PACKET_CONTRACT_TERMS.length) * 10000) / 10000
    : 1.0;

  const complete = missingTerms.length === 0;
  return {
    status: complete ? COMPLETENESS_STATUS.COMPLETE : COMPLETENESS_STATUS.INCOMPLETE,
    complete,
    completenessScore,
    missingTerms,
  };
}

// ─── Packet — Cache-eligible segment marking ──────────────────────────────────

/**
 * Section names that are structurally stable across calls — suitable for
 * prompt-caching layers that avoid re-tokenising unchanged prefixes.
 *
 * Dynamic sections (task context, plan details, per-call data) must NOT appear
 * here; only content that is effectively constant for a given system/model build.
 */
export const CACHE_STABLE_SECTION_NAMES: ReadonlySet<string> = new Set([
  "role",
  "system",
  "instructions",
  "single-prompt-mode",
  "json-output-markers",
  "no-vague-goals",
  "leverage-ranked-alternatives",
]);

/**
 * Mark prompt sections as cache-eligible based on naming heuristics.
 *
 * A section is marked `cacheable: true` when:
 *   (a) its name is in CACHE_STABLE_SECTION_NAMES, or
 *   (b) `opts.stableNames` includes its name, or
 *   (c) the section already carries `cacheable: true`.
 *
 * Sections that vary per-call (task context, plan details) are left
 * `cacheable: false` so callers know not to include them in a cached prefix.
 *
 * Original section objects are never mutated — a new array is returned.
 *
 * @param sections - prompt sections to process
 * @param opts     - optional additional stable names to treat as cacheable
 * @returns new array with `cacheable` field set on every element
 */
export function markCacheableSegments(
  sections: Array<{ name: string; content: string; cacheable?: boolean; [key: string]: any }>,
  opts: { stableNames?: string[] } = {}
): Array<{ name: string; content: string; cacheable: boolean; [key: string]: any }> {
  const extra = new Set((opts.stableNames || []).map(n => String(n).toLowerCase()));
  return (sections || []).map(s => {
    const name = String(s?.name || "").toLowerCase();
    const isStable = CACHE_STABLE_SECTION_NAMES.has(name) || extra.has(name) || s?.cacheable === true;
    return { ...s, cacheable: isStable };
  });
}

/**
 * Mark sections whose names appear in a cycle-delta name set as `required: true`,
 * guaranteeing they survive token-budget trimming in compilePrompt.
 *
 * Cycle-delta sections carry per-cycle reasoning context (research intelligence,
 * topic memory, carry-forward state) that must not be dropped under token pressure
 * — unlike large static context that can be safely truncated.
 *
 * Original section objects are never mutated — a new array is returned.
 * Sections not in the cycle-delta set retain their existing `required` field.
 *
 * @param sections       - prompt sections to process
 * @param cycleDeltaNames - set of section names that must be marked required
 * @returns new array with `required: true` on every cycle-delta section
 */
export function markCycleDeltaSectionsRequired<
  T extends { name: string; content: string; required?: boolean; [key: string]: any }
>(
  sections: T[],
  cycleDeltaNames: ReadonlySet<string>
): Array<T & { required: boolean }> {
  return (sections || []).map(s => {
    const name = String(s?.name || "").toLowerCase();
    if (cycleDeltaNames.has(name)) {
      return { ...s, required: true };
    }
    return { ...s, required: s?.required === true };
  });
}

/**
 * Compile an actionable packet prompt with integrated completeness validation.
 *
 * Wraps compileTieredPrompt and runs validateActionablePacketCompleteness before
 * returning. The caller receives both the compiled prompt string and the completeness
 * result so it can decide whether to proceed or reject the prompt before submission.
 *
 * This is the preferred entry point when building prompts that expect structured
 * actionable packet responses (e.g., Athena plan review, governance decisions).
 *
 * @param {Array<{ name: string, content: string, maxTokens?: number, required?: boolean }>} sections
 * @param {{ tier?: "T1"|"T2"|"T3", separator?: string, includeHeaders?: boolean }} opts
 * @returns {{ prompt: string, completeness: { status, complete, completenessScore, missingTerms } }}
 */
export function compileActionablePacketPrompt(sections, opts: any = {}) {
  const completeness = validateActionablePacketCompleteness(sections);
  const prompt = compileTieredPrompt(sections, opts);
  return { prompt, completeness };
}
