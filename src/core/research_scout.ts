/**
 * Research Scout — Internet Knowledge Acquisition Engine
 *
 * Searches the open internet for the most valuable technical knowledge
 * to advance the BOX autonomous agent system. Uses 1 premium request.
 *
 * Output: raw research package in state/research_scout_output.json
 * Live log: state/live_worker_research-scout.log
 */

import path from "node:path";
import fs from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { readJson, writeJson, spawnAsync } from "./fs_utils.js";
import { appendProgress } from "./state_tracker.js";
import { buildAgentArgs } from "./agent_loader.js";
import { section, compilePrompt, estimateTokens } from "./prompt_compiler.js";
import { appendAgentContextUsage, resolveMaxPromptBudget } from "./context_usage.js";
import { appendAggregateLiveLogSync } from "./live_log.js";

const SCOUT_SEEN_URLS_FILE = "research_scout_seen_urls.json";
const SCOUT_TOPIC_SITE_STATUS_FILE = "research_scout_topic_site_status.json";

type TopicSiteEntry = {
  site: string;
  topic: string;
  status: "in_progress" | "completed";
  uniqueSourceCount: number;
  lastSeenAt: string;
  completedAt?: string;
};

type TopicSiteState = {
  updatedAt: string;
  entries: TopicSiteEntry[];
};

type QueryMemoryState = {
  updatedAt?: string;
  terms?: Array<{ term?: string; score?: number; sourceCount?: number; lastSeenAt?: string }>;
};

type ResearchFeedbackState = {
  updatedAt?: string;
  researchGaps?: string;
  unresolvedGaps?: string[];
  topTopics?: string[];
  priorityActions?: string[];
};

function normalizeSearchTerm(raw: unknown): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenizeSearchTerm(raw: unknown): string[] {
  return normalizeSearchTerm(raw)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function isLowQualitySearchTerm(raw: unknown): boolean {
  const normalized = normalizeSearchTerm(raw);
  if (!normalized) return true;
  const tokens = tokenizeSearchTerm(normalized);
  if (tokens.length === 0) return true;
  if (tokens.length === 1 && new Set(["system", "general", "overview", "topic", "agent"]).has(tokens[0])) {
    return true;
  }
  return false;
}

function overlapTokenScore(left: unknown, right: unknown): number {
  const leftTokens = new Set(tokenizeSearchTerm(left));
  const rightTokens = new Set(tokenizeSearchTerm(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let score = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) score += 1;
  }
  return score;
}

export function normalizeUrl(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol)) return "";
    u.hash = "";
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function canonicalGitHubDocsPath(url: URL): string {
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "api.github.com") {
    const marker = ["repos", "github", "docs", "contents"];
    const startsWithMarker = marker.every((value, index) => parts[index] === value);
    if (startsWithMarker) return parts.slice(marker.length).join("/").toLowerCase();
  }
  if (host === "raw.githubusercontent.com") {
    if (parts[0] === "github" && parts[1] === "docs" && parts.length >= 4) {
      return parts.slice(3).join("/").toLowerCase();
    }
  }
  if (host === "github.com") {
    if (parts[0] === "github" && parts[1] === "docs" && parts[2] === "blob" && parts.length >= 5) {
      return parts.slice(4).join("/").toLowerCase();
    }
  }
  return url.pathname.replace(/^\/+/, "").toLowerCase();
}

export function canonicalSiteFromUrl(raw: string): string {
  const normalized = normalizeUrl(raw);
  if (!normalized) return "unknown";
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (["api.github.com", "raw.githubusercontent.com", "github.com"].includes(host)) {
      const docsPath = canonicalGitHubDocsPath(url);
      if (docsPath.startsWith("content/copilot/") || docsPath.startsWith("content/en/copilot/")) {
        return "github-docs";
      }
    }
    return host || "unknown";
  } catch {
    return "unknown";
  }
}

function canonicalSourceIdentity(raw: string): string {
  const normalized = normalizeUrl(raw);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    const site = canonicalSiteFromUrl(normalized);
    if (site === "github-docs") {
      return `${site}:${canonicalGitHubDocsPath(url)}`;
    }
    return normalized;
  } catch {
    return normalized;
  }
}

async function loadSeenScoutUrls(stateDir: string): Promise<Set<string>> {
  const seen = new Set<string>();
  const [memoryRaw, prevScout] = await Promise.all([
    readJson(path.join(stateDir, SCOUT_SEEN_URLS_FILE), { urls: [] }),
    readJson(path.join(stateDir, "research_scout_output.json"), null),
  ]);

  const memoryUrls = Array.isArray(memoryRaw?.urls) ? memoryRaw.urls : [];
  for (const item of memoryUrls) {
    const n = normalizeUrl(String(item || ""));
    if (n) seen.add(n);
  }

  const prevSources = Array.isArray(prevScout?.sources) ? prevScout.sources : [];
  for (const source of prevSources) {
    const n = normalizeUrl(String((source as any)?.url || ""));
    if (n) seen.add(n);
  }

  return seen;
}

async function saveSeenScoutUrls(stateDir: string, seenUrls: Set<string>): Promise<void> {
  const cap = 5000;
  const urls = Array.from(seenUrls).slice(-cap);
  await writeJson(path.join(stateDir, SCOUT_SEEN_URLS_FILE), {
    updatedAt: new Date().toISOString(),
    count: urls.length,
    urls,
  });
}

function normalizeTopic(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "general";
  return s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "general";
}

function inferSourceTopics(source: Record<string, unknown>): string[] {
  const raw = (source as any)?.topicTags;
  if (Array.isArray(raw)) {
    const out = raw.map((t: unknown) => normalizeTopic(String(t || ""))).filter(Boolean);
    return out.length > 0 ? Array.from(new Set(out)).slice(0, 4) : ["general"];
  }
  if (typeof raw === "string") {
    const out = raw.split(/,\s*/).map(t => normalizeTopic(t)).filter(Boolean);
    return out.length > 0 ? Array.from(new Set(out)).slice(0, 4) : ["general"];
  }
  return ["general"];
}

function getSourceHost(source: Record<string, unknown>): string {
  const url = String((source as any)?.url || "").trim();
  if (!url) return "unknown";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}

function topicSiteKey(site: string, topic: string): string {
  return `${site}::${topic}`;
}

function indexTopicSiteState(state: TopicSiteState): Map<string, TopicSiteEntry> {
  const map = new Map<string, TopicSiteEntry>();
  for (const e of Array.isArray(state.entries) ? state.entries : []) {
    const site = String(e?.site || "").toLowerCase() || "unknown";
    const topic = normalizeTopic(String(e?.topic || "general"));
    const key = topicSiteKey(site, topic);
    map.set(key, {
      site,
      topic,
      status: e?.status === "completed" ? "completed" : "in_progress",
      uniqueSourceCount: Math.max(0, Number(e?.uniqueSourceCount || 0)),
      lastSeenAt: String(e?.lastSeenAt || new Date(0).toISOString()),
      completedAt: e?.completedAt ? String(e.completedAt) : undefined,
    });
  }
  return map;
}

async function loadTopicSiteState(stateDir: string): Promise<TopicSiteState> {
  const raw = await readJson(path.join(stateDir, SCOUT_TOPIC_SITE_STATUS_FILE), {
    updatedAt: new Date(0).toISOString(),
    entries: [],
  });
  return {
    updatedAt: String(raw?.updatedAt || new Date(0).toISOString()),
    entries: Array.isArray(raw?.entries) ? raw.entries : [],
  };
}

async function saveTopicSiteState(stateDir: string, map: Map<string, TopicSiteEntry>): Promise<void> {
  const entries = Array.from(map.values())
    .sort((a, b) => (a.site + a.topic).localeCompare(b.site + b.topic));
  await writeJson(path.join(stateDir, SCOUT_TOPIC_SITE_STATUS_FILE), {
    updatedAt: new Date().toISOString(),
    entries,
  });
}

function buildBlockedSourcesSection(
  seenUrls: Set<string>,
  topicSiteState: TopicSiteState,
  maxUrls = 150,
): string {
  const entries = Array.isArray(topicSiteState.entries) ? topicSiteState.entries : [];
  const completed = entries.filter(e => e.status === "completed");

  const exhaustedLines = completed
    .sort((a, b) => b.uniqueSourceCount - a.uniqueSourceCount)
    .map(e => `  - ${e.site} [topic: ${e.topic}] - ${e.uniqueSourceCount} pages read (exhausted)`)
    .join("\n");

  const recent = Array.from(seenUrls).slice(-maxUrls);

  return [
    "## BLOCKED SOURCES - READ BEFORE ANY FETCH/SEARCH",
    "",
    "You MUST check this section before calling any web tool.",
    "Do NOT re-fetch URLs listed below.",
    "Do NOT search any exhausted site+topic pair listed below.",
    "Skip blocked items and focus only on NEW sources.",
    "",
    "### Exhausted topic+site pairs (do not search)",
    exhaustedLines || "  - none",
    "",
    `### Already fetched URLs (do not re-fetch) - ${seenUrls.size} total, showing last ${recent.length}`,
    recent.join("\n") || "  - none",
  ].join("\n");
}

function buildInProgressTopicsSection(state: TopicSiteState, maxEntries = 25): string {
  const entries = Array.isArray(state.entries) ? state.entries : [];
  const active = entries
    .filter(e => e.status !== "completed")
    .sort((a, b) => b.uniqueSourceCount - a.uniqueSourceCount)
    .slice(0, maxEntries);

  const activeLines = active
    .map(e => `  - ${e.site} | topic: ${e.topic} - ${e.uniqueSourceCount} pages read`) 
    .join("\n");

  return [
    "## PARTIALLY EXPLORED TOPIC-SITE PAIRS",
    "These pairs are not exhausted yet. Continue only if high-value and still novel.",
    "",
    activeLines || "  - none",
  ].join("\n");
}

function collectFeedbackTerms(feedback: ResearchFeedbackState | null | undefined): string[] {
  if (!feedback || typeof feedback !== "object") return [];
  const terms: string[] = [];
  const unresolved = Array.isArray(feedback.unresolvedGaps) ? feedback.unresolvedGaps : [];
  const topTopics = Array.isArray(feedback.topTopics) ? feedback.topTopics : [];
  const priorityActions = Array.isArray(feedback.priorityActions) ? feedback.priorityActions : [];
  for (const value of unresolved) terms.push(normalizeSearchTerm(value));
  for (const value of topTopics) terms.push(normalizeSearchTerm(value));
  for (const value of priorityActions) terms.push(normalizeSearchTerm(value));
  if (typeof feedback.researchGaps === "string") {
    for (const part of feedback.researchGaps.split(/[;\n]+/)) {
      terms.push(normalizeSearchTerm(part));
    }
  }
  return terms.filter((term) => !isLowQualitySearchTerm(term));
}

function topicCoverageScore(term: string, state: TopicSiteState | null | undefined): number {
  const entries = Array.isArray(state?.entries) ? state!.entries : [];
  if (!term) return 0;
  let best = 0;
  for (const entry of entries) {
    const coverageTarget = `${entry.site} ${entry.topic}`;
    const overlap = overlapTokenScore(term, coverageTarget);
    if (overlap <= 0) continue;
    best = Math.max(best, Math.max(0, Number(entry.uniqueSourceCount || 0)));
  }
  return best;
}

export function computeAdaptiveScoutTarget({
  configuredTarget,
  minTarget,
  adaptiveEnabled,
  seenUrlCount,
  topicSiteState,
  recentUniqueSourceCount,
}: {
  configuredTarget: number;
  minTarget: number;
  adaptiveEnabled: boolean;
  seenUrlCount: number;
  topicSiteState?: TopicSiteState | null;
  recentUniqueSourceCount?: number;
}): { effectiveTarget: number; saturationRatio: number; reason: string } {
  const safeConfiguredTarget = Math.max(1, Math.floor(Number(configuredTarget || 1)));
  const safeMinTarget = Math.max(1, Math.min(safeConfiguredTarget, Math.floor(Number(minTarget || 1))));
  if (adaptiveEnabled !== true) {
    return { effectiveTarget: safeConfiguredTarget, saturationRatio: 0, reason: "adaptive_disabled" };
  }

  const entryCount = Array.isArray(topicSiteState?.entries) ? topicSiteState!.entries.length : 0;
  const seenPressure = Math.min(1, Math.max(0, Number(seenUrlCount || 0)) / 400);
  const topicPressure = Math.min(1, entryCount / 12);
  const saturationRatio = Math.max(seenPressure, topicPressure);
  const lowYield = Math.max(0, Number(recentUniqueSourceCount || 0)) <= 1;

  if (saturationRatio >= 0.55 && lowYield) {
    return { effectiveTarget: safeMinTarget, saturationRatio, reason: "high_saturation_low_yield" };
  }

  if (saturationRatio >= 0.75) {
    const reduced = Math.max(safeMinTarget, Math.min(safeConfiguredTarget, Math.round(safeConfiguredTarget * 0.5)));
    return { effectiveTarget: reduced, saturationRatio, reason: "high_saturation" };
  }

  return { effectiveTarget: safeConfiguredTarget, saturationRatio, reason: "baseline" };
}

function extractFallbackUrl(block: string): string {
  const match = String(block || "").match(/https?:\/\/[^\s)\]}>"]+/i);
  return match ? match[0] : "";
}

function buildSourceSearchCorpus(source: Record<string, unknown>): string {
  return [
    source.title,
    source.url,
    source.whyImportant,
    Array.isArray(source.topicTags) ? source.topicTags.join(" ") : source.topicTags,
    source.learningNote,
    source.extractedContent,
  ].map((part) => String(part || "")).join(" ");
}

function deriveSourceDiversityKey(source: Record<string, unknown>): string {
  const normalizedUrl = normalizeUrl(String(source.url || ""));
  const site = canonicalSiteFromUrl(normalizedUrl);
  const topicTags = Array.isArray(source.topicTags)
    ? source.topicTags.map((tag) => normalizeTopic(String(tag || ""))).filter(Boolean)
    : [];
  if (topicTags.length > 0) {
    return `${site}:${Array.from(new Set(topicTags)).sort().join("|")}`;
  }

  try {
    const url = new URL(normalizedUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const firstPathSegment = parts[0] || "root";
    return `${site}:${firstPathSegment.toLowerCase()}`;
  } catch {
    return `${site}:unknown`;
  }
}

function scoreCandidateAgainstFeedback(
  source: Record<string, unknown>,
  feedbackTerms: string[],
  state: TopicSiteState | null | undefined,
): number {
  const corpus = buildSourceSearchCorpus(source);
  let bestFeedback = 0;
  for (const term of feedbackTerms) {
    bestFeedback = Math.max(bestFeedback, overlapTokenScore(term, corpus));
  }
  const topicPenalty = Math.max(0, topicCoverageScore(corpus, state) * 0.1);
  return bestFeedback - topicPenalty;
}

export function selectDiverseScoutSources({
  parsedSources,
  seenUrls,
  targetSourceCount,
  maxTargetSourceCount,
  topicSiteState,
  researchFeedback,
}: {
  parsedSources: Array<Record<string, unknown>>;
  seenUrls?: Set<string>;
  targetSourceCount: number;
  maxTargetSourceCount?: number;
  topicSiteState?: TopicSiteState | null;
  researchFeedback?: ResearchFeedbackState | null;
}): {
  sources: Array<Record<string, unknown>>;
  uniqueHostCount: number;
  filteredRepeatCount: number;
  filteredDuplicateInRunCount: number;
} {
  const alreadySeen = seenUrls instanceof Set ? seenUrls : new Set<string>();
  const feedbackTerms = collectFeedbackTerms(researchFeedback);
  const uniqueCandidates: Array<Record<string, unknown> & { _identity: string; _normalizedUrl: string; _site: string; _score: number }> = [];
  const seenIdentities = new Set<string>();
  let filteredRepeatCount = 0;
  let filteredDuplicateInRunCount = 0;

  for (const rawSource of Array.isArray(parsedSources) ? parsedSources : []) {
    const normalizedUrl = normalizeUrl(String(rawSource?.url || ""));
    if (!normalizedUrl) continue;
    const identity = canonicalSourceIdentity(normalizedUrl);
    if (!identity) continue;
    if (alreadySeen.has(normalizedUrl)) {
      filteredRepeatCount += 1;
      continue;
    }
    if (seenIdentities.has(identity)) {
      filteredDuplicateInRunCount += 1;
      continue;
    }
    seenIdentities.add(identity);
    uniqueCandidates.push({
      ...rawSource,
      url: normalizedUrl,
      _identity: identity,
      _normalizedUrl: normalizedUrl,
      _site: canonicalSiteFromUrl(normalizedUrl),
      _score: scoreCandidateAgainstFeedback(rawSource, feedbackTerms, topicSiteState),
    });
  }

  uniqueCandidates.sort((left, right) => {
    if (right._score !== left._score) return right._score - left._score;
    const leftTopicPenalty = topicCoverageScore(buildSourceSearchCorpus(left), topicSiteState);
    const rightTopicPenalty = topicCoverageScore(buildSourceSearchCorpus(right), topicSiteState);
    if (leftTopicPenalty !== rightTopicPenalty) return leftTopicPenalty - rightTopicPenalty;
    return String(left.url || "").localeCompare(String(right.url || ""));
  });

  const desiredCount = Math.max(1, Math.floor(Number(targetSourceCount || 1)));
  const hardCap = Math.max(desiredCount, Math.floor(Number(maxTargetSourceCount || desiredCount)));
  const selected: Array<Record<string, unknown> & { _site?: string }> = [];
  const selectedDiversityKeys = new Set<string>();
  let blockerCoverageCount = 0;

  for (const candidate of uniqueCandidates) {
    const shouldExtendForFeedback = candidate._score > 0 && blockerCoverageCount < feedbackTerms.length && selected.length < hardCap;
    if (selected.length >= desiredCount && !shouldExtendForFeedback) continue;
    const candidateDiversityKey = deriveSourceDiversityKey(candidate);
    if (selected.length < desiredCount && selectedDiversityKeys.has(candidateDiversityKey)) {
      const alternativeExists = uniqueCandidates.some((alternative) => {
        if (selected.includes(alternative)) return false;
        return deriveSourceDiversityKey(alternative) !== candidateDiversityKey;
      });
      if (alternativeExists) continue;
    }
    selected.push(candidate);
    selectedDiversityKeys.add(candidateDiversityKey);
    if (candidate._score > 0) blockerCoverageCount += 1;
    if (selected.length >= hardCap) break;
  }

  const uniqueHostCount = new Set(selected.map((source) => String(source._site || canonicalSiteFromUrl(String(source.url || ""))))).size;
  return {
    sources: selected.map(({ _identity, _normalizedUrl, _site, _score, ...source }) => source),
    uniqueHostCount,
    filteredRepeatCount,
    filteredDuplicateInRunCount,
  };
}

export function buildScoutDynamicQueryTerms({
  systemSeeds,
  researchFeedback,
  topicSiteState,
  queryMemory,
  maxTerms,
}: {
  systemSeeds?: string[];
  researchFeedback?: ResearchFeedbackState | null;
  topicSiteState?: TopicSiteState | null;
  queryMemory?: QueryMemoryState | null;
  maxTerms?: number;
}): string[] {
  const limit = Math.max(1, Math.floor(Number(maxTerms || 8)));
  const scored = new Map<string, number>();
  const feedbackTerms = collectFeedbackTerms(researchFeedback);
  const addTerm = (term: unknown, baseScore: number) => {
    const normalized = normalizeSearchTerm(term);
    if (isLowQualitySearchTerm(normalized)) return;
    const coveragePenalty = topicCoverageScore(normalized, topicSiteState) * 0.35;
    const nextScore = baseScore - coveragePenalty;
    const current = scored.get(normalized) ?? Number.NEGATIVE_INFINITY;
    if (nextScore > current) scored.set(normalized, nextScore);
  };

  for (const term of feedbackTerms) addTerm(term, 300);
  for (const term of Array.isArray(systemSeeds) ? systemSeeds : []) addTerm(term, 200);

  const memoryTerms = Array.isArray(queryMemory?.terms) ? queryMemory!.terms : [];
  for (const entry of memoryTerms) {
    const sourceCount = Math.max(0, Number(entry?.sourceCount || 0));
    const score = Math.max(0, Number(entry?.score || 0));
    addTerm(entry?.term, 100 + score - sourceCount * 6);
  }

  return Array.from(scored.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([term]) => term);
}

function liveLogPath(stateDir: string): string {
  return path.join(stateDir, "live_worker_research-scout.log");
}

function appendLiveLogSync(stateDir: string, text: string): void {
  try {
    appendFileSync(liveLogPath(stateDir), text, "utf8");
    appendAggregateLiveLogSync(stateDir, "research-scout", text);
  } catch { /* best-effort */ }
}

/**
 * Build the context prompt for the Research Scout.
 * Includes: system purpose, current bottlenecks, recent plans, recent improvements.
 */
async function buildScoutContext(config: any): Promise<string> {
  const stateDir = config.paths?.stateDir || "state";
  const scoutModel = config?.roleRegistry?.researchScout?.model || "gpt-5.4";
  const promptTokenBudget = resolveMaxPromptBudget(
    config,
    String(scoutModel),
    Number(config?.runtime?.researchScoutPromptTokenBudget)
  );

  // Read system state to give Scout awareness of what BOX needs
  const [
    _prometheusAnalysis,
    jesusDirective,
    capacityScoreboard,
    previousResearch,
    seenUrls,
    topicSiteState,
  ] = await Promise.all([
    readJson(path.join(stateDir, "prometheus_analysis.json"), null),
    readJson(path.join(stateDir, "jesus_directive.json"), null),
    readJson(path.join(stateDir, "capacity_scoreboard.json"), null),
    readJson(path.join(stateDir, "research_scout_output.json"), null),
    loadSeenScoutUrls(stateDir),
    loadTopicSiteState(stateDir),
  ]);

  const sections: Array<{ name: string; content: string }> = [];

  if (seenUrls.size > 0 || topicSiteState.entries.length > 0) {
    sections.push(section("blocked-sources", buildBlockedSourcesSection(seenUrls, topicSiteState)));
  }
  if (topicSiteState.entries.some(e => e.status !== "completed")) {
    sections.push(section("in-progress-topics", buildInProgressTopicsSection(topicSiteState)));
  }

  // System identity and purpose
  sections.push(section("system-identity", `## SYSTEM CONTEXT
You are searching for knowledge to improve BOX — an autonomous software delivery system.
BOX runs a continuous loop: Jesus (strategy) → Prometheus (planning) → Athena (review) → Workers (execution) → postmortem → repeat.
The system evolves itself: it reads its own code, plans improvements, executes them, and measures results.
Your job is finding external knowledge that makes this system significantly better.
Do NOT spend tokens producing repository file inventories; focus on external research evidence.`));

  sections.push(section("repo-goals-static", `## REPOSITORY GOALS (STATIC)
This repository is the BOX orchestrator and worker runtime for autonomous software delivery.
Primary goal: increase end-to-end autonomous delivery capacity with production-oriented, minimal, reversible changes.
Key behavior targets for research relevance:
- Better planning quality and deeper reasoning under real constraints.
- Better worker execution reliability, verification quality, and recovery behavior.
- Better model utilization (quality-per-request, token efficiency, context strategy).
- Better governance and deterministic control loops without slowing delivery.
Treat these goals as fixed context. Do not generate file lists or repository inventories.`));

  // Current system health and direction (lightweight — don't overload Scout)
  if (jesusDirective?.thinking) {
    const thinking = String(jesusDirective.thinking).slice(0, 500);
    sections.push(section("current-direction", `## CURRENT SYSTEM DIRECTION
Jesus's latest strategic assessment (summary):
${thinking}`));
  }

  // Capacity dimensions — where the system is weak
  if (capacityScoreboard?.entries?.length > 0) {
    const latest = capacityScoreboard.entries[capacityScoreboard.entries.length - 1];
    if (latest?.dimensions) {
      const dims = Object.entries(latest.dimensions)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n");
      sections.push(section("capacity-state", `## CURRENT CAPACITY STATE
Latest capacity scores across dimensions:
${dims}
Focus your research on dimensions with the LOWEST scores — that's where knowledge has the most impact.`));
    }
  }

  // Previous research gap hints — what the Synthesizer said was missing
  if (previousResearch?.researchGaps) {
    sections.push(section("previous-gaps", `## PREVIOUS RESEARCH GAPS
The last Research Synthesizer identified these as missing topics. Consider searching for these:
${String(previousResearch.researchGaps).slice(0, 1000)}`));
  }

  return compilePrompt(sections, {
    tokenBudget: promptTokenBudget > 0 ? promptTokenBudget : undefined,
  });
}

/**
 * Parse structured sources from the Scout's raw text output.
 * Extracts source blocks with their metadata fields.
 */
export function parseScoutSources(rawText: string): Array<Record<string, unknown>> {
  const sources: Array<Record<string, unknown>> = [];
  const text = String(rawText || "");
  const firstHeadingIndex = text.search(/###\s*\[?Source\s*\d+\]?\s*/i);
  if (firstHeadingIndex < 0) return [];
  const blocks = text.slice(firstHeadingIndex).split(/###\s*\[?Source\s*\d+\]?\s*/i).filter(b => b.trim());

  for (const block of blocks) {
    const source: Record<string, unknown> = {};

    // Extract title from first line
    const firstLine = block.split("\n")[0]?.trim();
    if (firstLine) source.title = firstLine;

    // Extract fields
    const urlMatch = block.match(/\*?\*?URL\*?\*?:\s*(.+)/i);
    const extractedUrl = normalizeUrl(urlMatch ? urlMatch[1].trim() : extractFallbackUrl(block));
    if (extractedUrl) source.url = extractedUrl;

    const typeMatch = block.match(/\*?\*?Source\s*Type\*?\*?:\s*(.+)/i);
    if (typeMatch) source.sourceType = typeMatch[1].trim();

    const dateMatch = block.match(/\*?\*?Date\*?\*?:\s*(.+)/i);
    if (dateMatch) source.date = dateMatch[1].trim();

    const tagsMatch = block.match(/\*?\*?Topic\s*Tags\*?\*?:\s*(.+)/i);
    if (tagsMatch) source.topicTags = tagsMatch[1].trim().split(/,\s*/);

    const confMatch = block.match(/\*?\*?Confidence\s*Score\*?\*?:\s*([\d.]+)/i);
    if (confMatch) source.confidenceScore = parseFloat(confMatch[1]);

    const whyMatch = block.match(/\*?\*?Why\s*Important\*?\*?:\s*(.+)/i);
    if (whyMatch) source.whyImportant = whyMatch[1].trim();

    const knowledgeTypeMatch = block.match(/\*?\*?Knowledge\s*Type\*?\*?:\s*(.+)/i);
    if (knowledgeTypeMatch) source.knowledgeType = knowledgeTypeMatch[1].trim().toLowerCase();

    // Extract key findings (legacy format: bullet points after "Key Findings:")
    const findingsMatch = block.match(/\*?\*?Key\s*Findings\*?\*?:\s*\n([\s\S]*?)(?=\n###|\n\*\*|$)/i);
    if (findingsMatch) {
      source.keyFindings = findingsMatch[1]
        .split("\n")
        .map(l => l.replace(/^[\s-*•]+/, "").trim())
        .filter(l => l.length > 0);
    }

    // Extract learning note (new format: structured knowledge note after "Learning Note:")
    const lnMatch = block.match(/\*?\*?Learning\s*Note\*?\*?:\s*\n([\s\S]*?)(?=\n-\s*\*\*Extracted|\n\*\*Extracted|\n###|\n\*\*\s*URL|\n-\s*\*\*URL|$)/i);
    if (lnMatch) {
      source.learningNote = lnMatch[1].trim();
    }

    // Extract full content (new format: free-form text after "Extracted Content:")
    const ecMatch = block.match(/\*?\*?Extracted\s*Content\*?\*?:\s*\n([\s\S]*?)(?=\n###|\n\*\*\s*URL|\n-\s*\*\*URL|$)/i);
    if (ecMatch) {
      source.extractedContent = ecMatch[1].trim();
    }

    if (source.url || source.title) {
      sources.push(source);
    }
  }

  return sources;
}

export interface ResearchScoutResult {
  success: boolean;
  sourceCount: number;
  sources: Array<Record<string, unknown>>;
  rawText: string;
  scoutedAt: string;
  model: string;
  error?: string;
}

/**
 * Run the Research Scout — 1 premium request.
 *
 * The Scout searches the open internet for knowledge valuable to BOX,
 * ranks findings by importance, and outputs a structured research package.
 */
export async function runResearchScout(config: any): Promise<ResearchScoutResult> {
  const stateDir = config.paths?.stateDir || "state";
  const command = config.env?.copilotCliCommand || "copilot";
  const model = config.roleRegistry?.researchScout?.model || "gpt-5.4";
  const disablePromptCache = config?.runtime?.researchScoutDisableCache !== false;
  const runNonce = disablePromptCache
    ? `research-scout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    : "research-scout";
  const targetSourceCount = Number.isFinite(Number(config?.runtime?.researchScoutTargetSources))
    ? Math.max(1, Number(config.runtime.researchScoutTargetSources))
    : 20;
  const topicSiteCompletionThreshold = Number.isFinite(Number(config?.runtime?.researchScoutTopicSiteCompletionThreshold))
    ? Math.max(2, Number(config.runtime.researchScoutTopicSiteCompletionThreshold))
    : 8;

  const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);

  // Initialize live log
  try {
    await fs.writeFile(liveLogPath(stateDir), `[research_scout_live]\n[${ts()}] Research Scout starting...\n`, "utf8");
  } catch { /* best-effort */ }

  await appendProgress(config, "[RESEARCH_SCOUT] Starting internet knowledge acquisition");
  await appendProgress(config, `[RESEARCH_SCOUT][CACHE_POLICY] promptCache=${disablePromptCache ? "disabled(via nonce)" : "enabled"}`);

  // Build context prompt
  const contextPrompt = await buildScoutContext(config);
  await appendProgress(config, `[RESEARCH_SCOUT][CONTEXT_BUDGET] prompt~${estimateTokens(contextPrompt)} tokens maxCapacityMode=${config?.runtime?.maxCapacityMode === true}`);

  const fullPrompt = `${contextPrompt}

## YOUR TASK
Search the internet for the most valuable technical knowledge that can advance this autonomous agent system.
Use your full capacity — search as many different angles as you can.
Target at least ${targetSourceCount} high-quality sources when evidence allows; only return fewer if genuinely no additional strong sources are accessible.
Rank your findings by importance — most valuable first.
If native web search/fetch tools are unavailable, use execute tool with shell HTTP commands (curl/Invoke-WebRequest) to retrieve web pages and continue.
Follow the output format specified in your agent definition exactly.`;

  const cacheBypassPrefix = disablePromptCache
    ? `\n\n## RUN NONCE\n${runNonce}\nTreat this run nonce as immutable metadata for this execution.\n`
    : "";

  const contextPromptFinal = `${fullPrompt}${cacheBypassPrefix}`;

  // Build args — Scout needs --allow-all for web search/fetch tools
  const args = buildAgentArgs({
    agentSlug: "research-scout",
    prompt: contextPromptFinal,
    model,
    allowAll: true,
    maxContinues: undefined,
  });

  appendLiveLogSync(stateDir, `\n[scout_start] ${ts()}\n`);

  const result = await spawnAsync(command, args, {
    env: process.env,
    onStdout(chunk: Buffer) {
      appendLiveLogSync(stateDir, chunk.toString("utf8"));
    },
    onStderr(chunk: Buffer) {
      appendLiveLogSync(stateDir, chunk.toString("utf8"));
    },
  });

  appendLiveLogSync(stateDir, `\n[scout_end] ${ts()} exit=${(result as any).status}\n`);

  const stdout = String((result as any)?.stdout || "");
  const stderr = String((result as any)?.stderr || "");
  const raw = stdout || stderr;
  await appendAgentContextUsage(config, {
    agent: "research-scout",
    model: String(model || "gpt-5.4"),
    promptText: contextPromptFinal,
    status: (result as any).status === 0 ? "success" : "failed",
  });

  if ((result as any).status !== 0) {
    const error = `exited ${(result as any).status}: ${(stderr || stdout).slice(0, 500)}`;
    await appendProgress(config, `[RESEARCH_SCOUT] Failed — ${error}`);
    return {
      success: false,
      sourceCount: 0,
      sources: [],
      rawText: raw,
      scoutedAt: new Date().toISOString(),
      model,
      error,
    };
  }

  // Parse sources from the raw output and filter previously-seen URLs
  const parsedSources = parseScoutSources(raw);
  const seenUrls = await loadSeenScoutUrls(stateDir);
  const topicSiteState = await loadTopicSiteState(stateDir);
  const topicSiteMap = indexTopicSiteState(topicSiteState);
  const sources: Array<Record<string, unknown>> = [];
  let filteredRepeatCount = 0;
  let filteredCompletedPairCount = 0;
  const newlyCompletedPairs = new Set<string>();
  for (const source of parsedSources) {
    const normalized = normalizeUrl(String((source as any)?.url || ""));

    const host = getSourceHost(source);
    const topics = inferSourceTopics(source);
    const isCompletedPair = topics.some(topic => {
      const key = topicSiteKey(host, topic);
      const entry = topicSiteMap.get(key);
      return entry?.status === "completed";
    });
    if (isCompletedPair) {
      filteredCompletedPairCount += 1;
      continue;
    }

    if (normalized && seenUrls.has(normalized)) {
      filteredRepeatCount += 1;
      continue;
    }
    if (normalized) seenUrls.add(normalized);
    sources.push(source);

    const nowIso = new Date().toISOString();
    for (const topic of topics) {
      const key = topicSiteKey(host, topic);
      const current = topicSiteMap.get(key) || {
        site: host,
        topic,
        status: "in_progress" as const,
        uniqueSourceCount: 0,
        lastSeenAt: nowIso,
      };
      const nextCount = current.uniqueSourceCount + 1;
      const nextStatus: "in_progress" | "completed" =
        current.status === "completed" || nextCount >= topicSiteCompletionThreshold
          ? "completed"
          : "in_progress";
      if (current.status !== "completed" && nextStatus === "completed") {
        newlyCompletedPairs.add(`${host} | ${topic}`);
      }
      topicSiteMap.set(key, {
        ...current,
        status: nextStatus,
        uniqueSourceCount: nextCount,
        lastSeenAt: nowIso,
        completedAt: nextStatus === "completed" ? (current.completedAt || nowIso) : undefined,
      });
    }
  }
  await saveSeenScoutUrls(stateDir, seenUrls);
  await saveTopicSiteState(stateDir, topicSiteMap);

  await appendProgress(
    config,
    `[RESEARCH_SCOUT][YIELD] parsed=${parsedSources.length} uniqueNew=${sources.length} filteredRepeat=${filteredRepeatCount} filteredCompletedPair=${filteredCompletedPairCount}`
  );
  if (newlyCompletedPairs.size > 0) {
    const sample = Array.from(newlyCompletedPairs).slice(0, 8).join("; ");
    await appendProgress(
      config,
      `[RESEARCH_SCOUT][TOPIC_SITE_COMPLETED] count=${newlyCompletedPairs.size} sample=${sample}`
    );
  }

  const output: ResearchScoutResult = {
    success: true,
    sourceCount: sources.length,
    sources,
    rawText: raw,
    scoutedAt: new Date().toISOString(),
    model,
  };

  // Persist raw research package
  await writeJson(path.join(stateDir, "research_scout_output.json"), output);

  if (filteredRepeatCount > 0) {
    await appendProgress(config, `[RESEARCH_SCOUT][DEDUPE] Filtered ${filteredRepeatCount} previously-seen source(s)`);
  }

  if (sources.length < targetSourceCount) {
    await appendProgress(config,
      `[RESEARCH_SCOUT][LOW_YIELD] Found ${sources.length}/${targetSourceCount} target source(s) — continue improving query breadth/depth next cycle`
    );
  }

  await appendProgress(config, `[RESEARCH_SCOUT] Complete — found ${sources.length} source(s)`);

  return output;
}
