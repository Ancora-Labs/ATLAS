import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildScoutDynamicQueryTerms,
  canonicalSiteFromUrl,
  computeAdaptiveScoutTarget,
  normalizeUrl,
  parseScoutSources,
  selectDiverseScoutSources,
} from "../../src/core/research_scout.js";

describe("computeAdaptiveScoutTarget", () => {
  it("keeps configured target when adaptation is disabled", () => {
    const result = computeAdaptiveScoutTarget({
      configuredTarget: 12,
      minTarget: 6,
      adaptiveEnabled: false,
      seenUrlCount: 900,
      topicSiteState: { updatedAt: new Date().toISOString(), entries: [] },
      recentUniqueSourceCount: 1,
    });

    assert.equal(result.effectiveTarget, 12);
    assert.equal(result.reason, "adaptive_disabled");
  });

  it("relaxes target under high saturation and low recent yield", () => {
    const result = computeAdaptiveScoutTarget({
      configuredTarget: 20,
      minTarget: 6,
      adaptiveEnabled: true,
      seenUrlCount: 500,
      topicSiteState: {
        updatedAt: new Date().toISOString(),
        entries: [
          { site: "d.com", topic: "z", status: "in_progress", uniqueSourceCount: 3, lastSeenAt: new Date().toISOString() },
        ],
      },
      recentUniqueSourceCount: 1,
    });

    assert.equal(result.effectiveTarget, 6);
    assert.ok(result.saturationRatio > 0.5);
  });

  it("never goes below minTarget", () => {
    const result = computeAdaptiveScoutTarget({
      configuredTarget: 10,
      minTarget: 5,
      adaptiveEnabled: true,
      seenUrlCount: 1000,
      topicSiteState: {
        updatedAt: new Date().toISOString(),
        entries: [
          { site: "a.com", topic: "x", status: "in_progress", uniqueSourceCount: 10, lastSeenAt: new Date().toISOString() },
        ],
      },
      recentUniqueSourceCount: 0,
    });

    assert.equal(result.effectiveTarget, 5);
  });
});

describe("normalizeUrl", () => {
  it("keeps only valid http(s) URLs", () => {
    assert.equal(normalizeUrl("https://example.com/path#frag"), "https://example.com/path");
    assert.equal(normalizeUrl("http://docs.example.org/a/"), "http://docs.example.org/a");
    assert.equal(normalizeUrl("$u`ntitle: bad"), "");
    assert.equal(normalizeUrl("mailto:test@example.com"), "");
  });
});

describe("parseScoutSources", () => {
  it("extracts URLs from URL field and fallback link text", () => {
    const raw = `
### [Source 1] First
- **URL**: https://docs.github.com/en/copilot/reference#acp
- **Source Type**: docs
- **Topic Tags**: planning, orchestration

### [Source 2] Second
No URL field here, but link exists: https://api.github.com/repos/github/docs/contents/content/copilot/reference
`;
    const parsed = parseScoutSources(raw);
    assert.equal(parsed.length, 2);
    assert.equal(String(parsed[0]?.url || ""), "https://docs.github.com/en/copilot/reference");
    assert.equal(
      String(parsed[1]?.url || ""),
      "https://api.github.com/repos/github/docs/contents/content/copilot/reference"
    );
  });

  it("ignores tool transcript preamble before the first source heading", () => {
    const raw = `
I am gathering sources.
● Fetch candidate files
  https://api.github.com/repos/github/docs/contents/content/copilot/reference

### [Source 1] First real source
- **URL**: https://docs.github.com/en/copilot/reference/custom-agents-configuration
`;

    const parsed = parseScoutSources(raw);
    assert.equal(parsed.length, 1);
    assert.equal(
      String(parsed[0]?.url || ""),
      "https://docs.github.com/en/copilot/reference/custom-agents-configuration"
    );
  });
});

describe("canonicalSiteFromUrl", () => {
  it("collapses GitHub content aliases into a stable source family", () => {
    assert.equal(
      canonicalSiteFromUrl("https://api.github.com/repos/github/docs/contents/content/copilot/reference/custom-agents-configuration.md"),
      "github-docs"
    );
    assert.equal(
      canonicalSiteFromUrl("https://raw.githubusercontent.com/github/docs/main/content/copilot/reference/custom-agents-configuration.md"),
      "github-docs"
    );
    assert.equal(
      canonicalSiteFromUrl("https://github.com/github/docs/blob/main/content/copilot/reference/custom-agents-configuration.md"),
      "github-docs"
    );
  });
});

describe("selectDiverseScoutSources", () => {
  it("allows same host when sources are from distinct topics/subpaths", () => {
    const parsedSources = [
      { url: "https://docs.python.org/library/asyncio.html", topicTags: ["asyncio", "python-runtime"] },
      { url: "https://docs.python.org/library/concurrent.futures.html", topicTags: ["threading", "executors"] },
      { url: "https://docs.python.org/reference/datamodel.html", topicTags: ["object-model", "internals"] },
      { url: "https://example.com/blog/systems", topicTags: ["systems-design"] },
    ];

    const selected = selectDiverseScoutSources({
      parsedSources,
      seenUrls: new Set<string>(),
      targetSourceCount: 4,
      topicSiteState: { updatedAt: new Date().toISOString(), entries: [] },
    });

    assert.equal(selected.sources.length, 4);
    const hosts = selected.sources.map((s) => new URL(String(s.url)).hostname);
    const pythonCount = hosts.filter((h) => h === "docs.python.org").length;
    assert.equal(pythonCount, 3);
    assert.equal(selected.uniqueHostCount, 2);
  });

  it("penalizes repetitive same host-topic when alternatives exist", () => {
    const selected = selectDiverseScoutSources({
      parsedSources: [
        { url: "https://a.com/cache/tuning-1", topicTags: ["cache"] },
        { url: "https://a.com/cache/tuning-2", topicTags: ["cache"] },
        { url: "https://a.com/cache/tuning-3", topicTags: ["cache"] },
        { url: "https://b.com/consensus/raft", topicTags: ["consensus"] },
      ],
      seenUrls: new Set<string>(),
      targetSourceCount: 2,
      topicSiteState: {
        updatedAt: new Date().toISOString(),
        entries: [
          { site: "a.com", topic: "cache", status: "in_progress", uniqueSourceCount: 12, lastSeenAt: new Date().toISOString() },
        ],
      },
    });

    const urls = selected.sources.map((s) => String(s.url));
    assert.ok(urls.some((u) => u.includes("b.com/consensus/raft")));
  });

  it("prioritizes candidates that cover unresolved blocker gaps", () => {
    const selected = selectDiverseScoutSources({
      parsedSources: [
        {
          url: "https://example.com/general/agent-overview",
          title: "General autonomous agent overview",
          topicTags: ["agents", "planning"],
          whyImportant: "High-level overview",
        },
        {
          url: "https://docs.prefect.io/v3/how-to-guides/workflows/retries",
          title: "Workflow retries and failure recovery",
          topicTags: ["workflow-durability", "failure-recovery", "retries"],
          whyImportant: "Covers partial branch execution recovery and retry semantics",
        },
      ],
      seenUrls: new Set<string>(),
      targetSourceCount: 1,
      topicSiteState: { updatedAt: new Date().toISOString(), entries: [] },
      researchFeedback: {
        updatedAt: new Date().toISOString(),
        researchGaps: "",
        unresolvedGaps: ["Partial branch execution recovery patterns for interrupted coding loops"],
        topTopics: [],
        priorityActions: [],
      },
    });

    assert.equal(selected.sources.length, 1);
    assert.equal(String(selected.sources[0]?.url || ""), "https://docs.prefect.io/v3/how-to-guides/workflows/retries");
  });

  it("extends selection beyond adaptive target to rescue uncovered blocker gaps", () => {
    const selected = selectDiverseScoutSources({
      parsedSources: [
        {
          url: "https://example.com/general/overview",
          title: "General overview",
          topicTags: ["planning"],
        },
        {
          url: "https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically",
          title: "Running GitHub Copilot CLI programmatically",
          topicTags: ["copilot-cli", "automation", "non-interactive"],
          whyImportant: "Documents one-shot worker execution contract",
        },
        {
          url: "https://redis.io/docs/latest/develop/reference/eviction/",
          title: "Key eviction",
          topicTags: ["memory", "eviction", "ttl"],
          whyImportant: "Implementation-grade retention policy source",
        },
      ],
      seenUrls: new Set<string>(),
      targetSourceCount: 1,
      maxTargetSourceCount: 3,
      topicSiteState: { updatedAt: new Date().toISOString(), entries: [] },
      researchFeedback: {
        updatedAt: new Date().toISOString(),
        researchGaps: "",
        unresolvedGaps: [
          "A documented Copilot CLI transcript or programmatic worker execution contract",
          "A concrete implementation-grade state eviction retention policy source",
        ],
        topTopics: [],
        priorityActions: [],
      },
    });

    const urls = selected.sources.map((source) => String(source.url));
    assert.ok(urls.includes("https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically"));
    assert.ok(urls.includes("https://redis.io/docs/latest/develop/reference/eviction"));
    assert.equal(selected.sources.length, 2);
  });

  it("filters already-seen and duplicate-in-run URLs", () => {
    const selected = selectDiverseScoutSources({
      parsedSources: [
        { url: "https://a.com/1" },
        { url: "https://a.com/1" },
        { url: "https://b.com/1" },
      ],
      seenUrls: new Set<string>(["https://a.com/1"]),
      targetSourceCount: 3,
    });

    assert.equal(selected.sources.length, 1);
    assert.equal(String(selected.sources[0]?.url || ""), "https://b.com/1");
    assert.equal(selected.filteredRepeatCount, 2);
    assert.equal(selected.filteredDuplicateInRunCount, 0);
  });

  it("dedupes github content aliases (api/raw/blob) as one source identity", () => {
    const selected = selectDiverseScoutSources({
      parsedSources: [
        { url: "https://api.github.com/repos/github/docs/contents/content/copilot/reference/copilot-cli-reference/cli-plugin-reference.md" },
        { url: "https://raw.githubusercontent.com/github/docs/main/content/copilot/reference/copilot-cli-reference/cli-plugin-reference.md" },
        { url: "https://github.com/github/docs/blob/main/content/copilot/reference/copilot-cli-reference/cli-plugin-reference.md" },
      ],
      seenUrls: new Set<string>(),
      targetSourceCount: 3,
    });

    assert.equal(selected.sources.length, 1);
    assert.equal(selected.filteredDuplicateInRunCount, 2);
  });
});

describe("buildScoutDynamicQueryTerms", () => {
  it("prioritizes research feedback before seeds when term budget is tight", () => {
    const terms = buildScoutDynamicQueryTerms({
      systemSeeds: ["governance gate", "worker verification", "planner reliability"],
      researchFeedback: {
        updatedAt: new Date().toISOString(),
        researchGaps: "deterministic schema migration and branch recovery",
        unresolvedGaps: ["partial branch execution recovery"],
        topTopics: ["search controlled planning"],
        priorityActions: [],
      },
      topicSiteState: { updatedAt: new Date().toISOString(), entries: [] },
      queryMemory: {
        updatedAt: new Date().toISOString(),
        terms: [
          { term: "context compression", score: 8, lastSeenAt: new Date().toISOString(), sourceCount: 2 },
          { term: "recovery journal", score: 6, lastSeenAt: new Date().toISOString(), sourceCount: 3 },
        ],
      },
      maxTerms: 6,
    });

    assert.ok(terms.includes("partial branch execution recovery"));
    assert.ok(terms.includes("search controlled planning"));
    assert.ok(terms.includes("deterministic schema migration and branch recovery"));
    assert.ok(terms.includes("governance gate"));
    assert.ok(!terms.includes("context compression"));
    assert.ok(!terms.includes("recovery journal"));
  });

  it("drops empty or low-quality terms and dedupes deterministically", () => {
    const terms = buildScoutDynamicQueryTerms({
      systemSeeds: ["", "system", "governance gate", "governance gate"],
      researchFeedback: {
        updatedAt: new Date().toISOString(),
        researchGaps: "",
        unresolvedGaps: [],
        topTopics: [],
        priorityActions: [],
      },
      topicSiteState: { updatedAt: new Date().toISOString(), entries: [] },
      queryMemory: {
        updatedAt: new Date().toISOString(),
        terms: [
          { term: "system", score: 9, lastSeenAt: new Date().toISOString(), sourceCount: 2 },
          { term: "policy invariants", score: 7, lastSeenAt: new Date().toISOString(), sourceCount: 1 },
        ],
      },
      maxTerms: 8,
    });

    assert.equal(terms.filter((t) => t === "governance gate").length, 1);
    assert.ok(!terms.includes("system"));
    assert.ok(terms.includes("policy invariants"));
  });

  it("prioritizes underexplored feedback terms ahead of already-covered memory", () => {
    const terms = buildScoutDynamicQueryTerms({
      systemSeeds: ["governance gate"],
      researchFeedback: {
        updatedAt: new Date().toISOString(),
        researchGaps: "checkpoint validation recovery",
        unresolvedGaps: ["checkpoint validation"],
        topTopics: ["governance gate"],
        priorityActions: [],
      },
      topicSiteState: {
        updatedAt: new Date().toISOString(),
        entries: [
          { site: "github-docs", topic: "governance-gate", status: "in_progress", uniqueSourceCount: 6, lastSeenAt: new Date().toISOString() },
        ],
      },
      queryMemory: {
        updatedAt: new Date().toISOString(),
        terms: [
          { term: "governance gate", score: 9, lastSeenAt: new Date().toISOString(), sourceCount: 5 },
          { term: "checkpoint validation", score: 2, lastSeenAt: new Date().toISOString(), sourceCount: 0 },
        ],
      },
      maxTerms: 6,
    });

    assert.equal(terms[0], "checkpoint validation");
  });
});
