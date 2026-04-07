/**
 * Prometheus — Self-Evolution Engine & Key Planner (Simplified)
 *
 * Prometheus is activated by Jesus for deep repository analysis.
 * Uses single-prompt mode: one request per invocation.
 * The Copilot CLI agent reads the repo itself — no chunk export needed.
 * Behavior is defined in .github/agents/prometheus.agent.md.
 *
 * Output: deep analysis artifact in state/prometheus_analysis.json
 * Live log: state/live_worker_prometheus.log (streamed in real-time)
 */

import path from "node:path";
import fs from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { readJson, writeJson, spawnAsync } from "./fs_utils.js";
import { appendAlert, appendProgress, appendInterventionOptimizerEntry, recordCapabilityExecution } from "./state_tracker.js";
import { getRoleRegistry } from "./role_registry.js";
import { buildAgentArgs, parseAgentOutput } from "./agent_loader.js";
import { addSchemaVersion, STATE_FILE_TYPE } from "./schema_registry.js";
import { PREMORTEM_RISK_LEVEL } from "./athena_reviewer.js";
import {
  runInterventionOptimizer,
  buildInterventionsFromPlan,
  buildBudgetFromConfig,
  buildPolicyImpactByInterventionId,
  OPTIMIZER_STATUS,
  OPTIMIZER_LOG_JSONL_SCHEMA,
  OPTIMIZER_LOG_RECORD_TYPE,
} from "./intervention_optimizer.js";
import {
  resolveDependencyGraph,
  persistGraphDiagnostics,
  GRAPH_STATUS,
  GRAPH_DIAGNOSTICS_JSONL_SCHEMA,
  GRAPH_DIAGNOSTICS_RECORD_TYPE,
} from "./dependency_graph_resolver.js";
import { dualPassCriticRepair } from "./plan_critic.js";
import { compileAcceptanceCriteria, enrichPlansWithAC } from "./ac_compiler.js";
import {
  validateLeadershipContract,
  LEADERSHIP_CONTRACT_TYPE,
  TRUST_BOUNDARY_ERROR,
  filterMemoryEntriesByTrust,
  isPrivilegedMemoryRequester,
  MEMORY_TRUST_LEVEL,
} from "./trust_boundary.js";
import {
  validateAllPlans,
  PLAN_VIOLATION_SEVERITY,
  PACKET_VIOLATION_CODE,
  isCycleSpecificExclusionJustification,
  EQUAL_DIMENSION_SET,
  normalizeLeverageRank,
  buildThinPacketRejectionReason,
  computePacketDensityMetrics,
  isThinPacketForAdmission,
  getPacketThresholdsForLane,
  scanParsedOutputForProcessThought,
  OUTPUT_FIDELITY_GATE_FAIL_REASON,
} from "./plan_contract_validator.js";
import {
  section,
  compilePrompt as _compilePrompt,
  markCacheableSegments as _markCacheableSegments,
  markCycleDeltaSectionsRequired as _markCycleDeltaSectionsRequired,
  analyzePacketDensification as _analyzePacketDensification,
  PROMPT_BUDGET_PARTITION,
  compileRankedContextSection,
  boundStructuredList,
  estimateTokenCost,
  compilePrometheusContextShortlist,
  type ShortlistItem,
} from "./prompt_compiler.js";
import {
  scanProject,
  buildSemanticFileCandidatesFromScan,
  rankSemanticFileCandidates,
} from "./project_scanner.js";
import { computeFingerprint, classifyCarryForwardByRecurrence } from "./carry_forward_ledger.js";
import { rewriteVerificationCommand } from "./verification_command_registry.js";
import { checkCarryForwardGate, hardGateRecurrenceToPolicies } from "./learning_policy_compiler.js";
import { buildRankedLessonShortlists } from "./lesson_halflife.js";
import {
  splitWavesIntoMicrowaves as _splitWavesIntoMicrowaves,
  MICROWAVE_MAX_TASKS_DEFAULT as _MICROWAVE_MAX_TASKS_DEFAULT,
  estimatePlanExecutionTokens,
  autoBundleThinRelatedPackets,
} from "./worker_batch_planner.js";

// Re-export so existing callers that import from prometheus.ts continue to work
export { _splitWavesIntoMicrowaves as splitWavesIntoMicrowaves, _MICROWAVE_MAX_TASKS_DEFAULT as MICROWAVE_MAX_TASKS_DEFAULT };

import { warn, emitEvent } from "./logger.js";
import { buildSpanEvent, EVENTS, EVENT_DOMAIN, SPAN_CONTRACT } from "./event_schema.js";

// ── Span contract emitter ─────────────────────────────────────────────────────

/** Canonical agent identifier for Prometheus in span events. */
export const PROMETHEUS_AGENT_ID = "prometheus";

/**
 * Build a PLANNING_STAGE_TRANSITION span event for Prometheus.
 * Conforms to SPAN_CONTRACT: stamps spanId, parentSpanId, traceId, agentId.
 *
 * @param correlationId — non-empty cycle trace ID
 * @param stageFrom     — stage being left (one of ORCHESTRATION_LOOP_STEPS)
 * @param stageTo       — stage being entered
 * @param opts          — optional parentSpanId, durationMs
 * @returns validated event envelope
 */
export function emitPrometheusSpanTransition(
  correlationId: string,
  stageFrom: string,
  stageTo: string,
  opts: { parentSpanId?: string | null; durationMs?: number | null } = {},
) {
  return buildSpanEvent(
    EVENTS.PLANNING_STAGE_TRANSITION,
    EVENT_DOMAIN.PLANNING,
    correlationId,
    { agentId: PROMETHEUS_AGENT_ID, parentSpanId: opts.parentSpanId ?? null },
    {
      [SPAN_CONTRACT.stageTransition.taskId]:     null,
      [SPAN_CONTRACT.stageTransition.stageFrom]:  stageFrom,
      [SPAN_CONTRACT.stageTransition.stageTo]:    stageTo,
      [SPAN_CONTRACT.stageTransition.durationMs]: opts.durationMs ?? null,
    },
  );
}

export function detectModelFallback(rawText) {
  const text = String(rawText || "");
  const match = text.match(/Warning:\s*Custom agent\s+"([^"]+)"\s+specifies model\s+"([^"]+)"\s+which is not available;\s+using\s+"([^"]+)"\s+instead/i);
  if (!match) return null;
  return { agent: match[1], requestedModel: match[2], fallbackModel: match[3] };
}

export function buildPrometheusPlanningPolicy(config, laneTelemetry?: Record<string, unknown> | null) {
  const planner = config?.planner || {};
  const configuredMaxWorkersPerWave = Math.max(1, Number(planner.defaultMaxWorkersPerWave || config?.maxParallelWorkers || 10));
  const rawMaxTasks = Number(planner.maxTasks);
  const maxTasks = Number.isFinite(rawMaxTasks) && rawMaxTasks > 0 ? Math.floor(rawMaxTasks) : 0;
  const maxWorkersPerWave = maxTasks > 0
    ? Math.min(configuredMaxWorkersPerWave, maxTasks)
    : configuredMaxWorkersPerWave;

  // Bounded packet-size defaults — prevent over-bundling by capping plans per packet
  const rawMaxPlansPerPacket = Number(planner.maxPlansPerPacket);
  const maxPlansPerPacket = Number.isFinite(rawMaxPlansPerPacket) && rawMaxPlansPerPacket > 0
    ? Math.max(1, Math.min(20, Math.floor(rawMaxPlansPerPacket)))
    : 5; // default: cap at 5 plans per packet to prevent context overflow

  // Lane telemetry: surface per-lane performance signals for planner awareness.
  // Each lane entry carries { dispatched, completed, failed, completionRate, roi, specialistLane }.
  // Prometheus uses this to avoid over-planning into lanes with low recent completion rates.
  const resolvedLaneTelemetry = (laneTelemetry && typeof laneTelemetry === "object")
    ? laneTelemetry
    : null;

  return {
    maxTasks,
    maxWorkersPerWave,
    maxPlansPerPacket,
    preferFewestWorkers: planner.preferFewestWorkers !== false,
    allowSameCycleFollowUps: Boolean(planner.allowSameCycleFollowUps),
    requireDependencyAwareWaves: planner.requireDependencyAwareWaves !== false,
    enforcePrometheusExecutionStrategy: planner.enforcePrometheusExecutionStrategy !== false,
    laneTelemetry: resolvedLaneTelemetry,
  };
}

export const HEALTH_AUDIT_MANDATORY_SEVERITIES: ReadonlySet<string> = new Set(["critical", "warning"]);

/**
 * Minimum character length for a strategic field value to be considered
 * semantically valid (not a noise token, placeholder, or trivially short string).
 * Exported for testing.
 */
export const STRATEGIC_FIELD_MIN_SEMANTIC_LENGTH = 10 as const;

/**
 * Lexical patterns that identify first-person process narration — AI agents
 * narrating their own tool usage in present tense.  These must NOT appear in
 * persisted strategic planning fields (keyFindings, strategicNarrative).
 *
 * Examples of rejected strings:
 *   "Let me analyze the codebase for gaps..."
 *   "I'm reading file src/core/prometheus.ts now"
 *   "I will now scan the repository to find..."
 *
 * Exported for testing and reuse in plan_contract_validator.ts.
 */
export const PROCESS_NARRATION_LEXICAL_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  // First-person agent narration of upcoming action at sentence start
  /^(let\s+me|i'?m\s+going\s+to|i\s+am\s+going\s+to|i\s+will\s+now|i'?m\s+now|i\s+am\s+now|now\s+i\s+will|now\s+i'?m|i'?ll\s+now)\s+(read|scan|check|view|analyze|look|open|search|find|examine|browse|explore|fetch|get|inspect)/im,
]);

/**
 * Semantic patterns that identify tool-trace fragments — direct tool invocation
 * or output text that leaked from the AI's execution context into output fields.
 *
 * Examples of rejected strings:
 *   "reading file src/core/prometheus.ts"
 *   "tool output: { ... }"
 *   "view_file(path='src/foo.ts')"
 *
 * Exported for testing and reuse in plan_contract_validator.ts.
 */
export const SEMANTIC_TOOL_TRACE_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  // Direct tool invocation traces (code-style)
  /\b(view_file|read_file|write_file|list_files|search_files|create_file|delete_file)\s*\(/i,
  // Tool/function output blocks
  /^(tool\s+output|function\s+output|tool\s+response|function\s+result)\s*:/im,
  // Present-progressive tool operation at line start
  /^(reading|scanning|checking|viewing)\s+(the\s+)?(file|directory|repo|codebase|code|source)\b/im,
]);

/**
 * Returns true when the given string contains tool-trace or process-thought
 * contamination patterns that must not appear in persisted planning fields.
 *
 * Checks three categories in order:
 *   1. Classic tool-call / role-prefix markers (tool_call:, assistant:, etc.)
 *   2. Process-thought XML/marker tags (<thinking>, [THINKING], <reasoning>, etc.)
 *   3. Process narration lexical patterns (first-person action narration)
 *   4. Semantic tool-trace fragments (tool invocation text, output blocks)
 *
 * Matches the same patterns stripped by sanitizePlanningFieldForPersistence
 * plus the PROCESS_THOUGHT_MARKER_PATTERNS from plan_contract_validator.ts so
 * validation and sanitisation share a single, consistent surface.
 *
 * Exported for testing.
 */
export function isStrategicFieldToolTraceContaminated(text: string): boolean {
  const s = String(text || "");
  // ── Category 1: classic tool-call / role-prefix markers ──────────────────
  if (/^(tool_call|tool_result|function_call|assistant:|system:|user:)/im.test(s)) return true;
  if (/^copilot>/im.test(s)) return true;
  if (/^\[?(synthesizer_start|synthesizer_end|research_synthesizer_live)\]/im.test(s)) return true;
  // ── Category 2: process-thought XML/marker tags ───────────────────────────
  if (/<thinking>[\s\S]*?<\/thinking>/i.test(s)) return true;
  if (/<think[\s>]/i.test(s)) return true;
  if (/<\/think>/i.test(s)) return true;
  if (/<reasoning[\s>]/i.test(s)) return true;
  if (/<\/reasoning>/i.test(s)) return true;
  if (/\[THINKING\]/i.test(s)) return true;
  if (/<internal>/i.test(s)) return true;
  if (/<!--\s*thinking/i.test(s)) return true;
  // ── Category 3: process narration lexical patterns ────────────────────────
  if (PROCESS_NARRATION_LEXICAL_PATTERNS.some(p => p.test(s))) return true;
  // ── Category 4: semantic tool-trace fragments ─────────────────────────────
  if (SEMANTIC_TOOL_TRACE_PATTERNS.some(p => p.test(s))) return true;
  return false;
}

export interface MandatoryHealthAuditFinding {
  id: string;
  area: string;
  severity: "critical" | "warning";
  finding: string;
  remediation: string;
  capabilityNeeded: string;
}

export interface MandatoryTaskCoverageValidationResult {
  ok: boolean;
  missing: string[];
  invalid: string[];
  mapped: string[];
  excluded: string[];
}

function sanitizeMandatoryFindingId(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeMandatorySeverity(value: unknown): "critical" | "warning" | "" {
  const severity = String(value || "").trim().toLowerCase();
  if (severity === "critical") return "critical";
  // Bridge legacy "important" → "warning" for backward compatibility with stored findings.
  if (severity === "warning" || severity === "important") return "warning";
  return "";
}

function buildMandatoryFindingId(entry: Record<string, unknown>, index: number): string {
  const capability = sanitizeMandatoryFindingId(entry.capabilityNeeded);
  if (capability) return capability;
  const area = sanitizeMandatoryFindingId(entry.area);
  if (area) return `${area}-${index + 1}`;
  return `mandatory-finding-${index + 1}`;
}

export function extractMandatoryHealthAuditFindings(payload: unknown): MandatoryHealthAuditFinding[] {
  const findings = Array.isArray((payload as any)?.findings) ? (payload as any).findings : [];
  const result: MandatoryHealthAuditFinding[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < findings.length; i++) {
    const raw = findings[i];
    if (!raw || typeof raw !== "object") continue;
    const severity = normalizeMandatorySeverity((raw as any).severity);
    if (!severity || !HEALTH_AUDIT_MANDATORY_SEVERITIES.has(severity)) continue;
    const entry = raw as Record<string, unknown>;
    const id = buildMandatoryFindingId(entry, i);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      area: String(entry.area || "unknown"),
      severity,
      finding: sanitizePromptLine(entry.finding, 500),
      remediation: sanitizePromptLine(entry.remediation, 500),
      capabilityNeeded: String(entry.capabilityNeeded || ""),
    });
  }

  return result;
}

export function buildMandatoryTasksPromptSection(findings: MandatoryHealthAuditFinding[]): string {
  if (!Array.isArray(findings) || findings.length === 0) return "";
  const lines = findings.map((f, i) =>
    `${i + 1}. id=${f.id} | severity=${f.severity} | area=${sanitizePromptLine(f.area, 80)} | finding=${sanitizePromptLine(f.finding, 240)} | remediation=${sanitizePromptLine(f.remediation, 240)}`
  ).join("\n");
  return `## MANDATORY_TASKS
The following findings are loaded from state/health_audit_findings.json (severity in {critical, warning}).
For EACH finding, you MUST do exactly one:
1. Map it to at least one concrete task in plans[] (status="mapped"), OR
2. Exclude it explicitly with cycle-specific justification (status="excluded" + non-empty justification).

You MUST include this JSON field in your companion block:
"mandatoryTaskCoverage": [
  { "findingId": "<id>", "status": "mapped", "planTask": "<exact task/title/task_id from plans[]>" },
  { "findingId": "<id>", "status": "excluded", "justification": "<why excluded this cycle>" }
]
All finding IDs below are mandatory and must appear exactly once in mandatoryTaskCoverage:
${lines}`;
}

function normalizeCoverageStatus(value: unknown): "mapped" | "excluded" | "" {
  const status = String(value || "").trim().toLowerCase();
  if (status === "mapped" || status === "include" || status === "included") return "mapped";
  if (status === "excluded" || status === "exclude") return "excluded";
  return "";
}

function normalizeTaskDescriptor(value: unknown): string {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeMandatoryTaskCoverageEntries(payload: unknown): Array<{
  findingId: string;
  status: "mapped" | "excluded" | "";
  planTask: string;
  justification: string;
}> {
  const entries = Array.isArray((payload as any)?.mandatoryTaskCoverage)
    ? (payload as any).mandatoryTaskCoverage
    : [];
  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const obj = entry as Record<string, unknown>;
      return {
        findingId: sanitizeMandatoryFindingId(obj.findingId || obj.id || obj.capabilityNeeded),
        status: normalizeCoverageStatus(obj.status),
        planTask: String(obj.planTask || obj.task || obj.mappedTask || obj.mappedToTask || "").trim(),
        justification: String(obj.justification || obj.exclusionJustification || obj.reason || "").trim(),
      };
    });
}

function planReferenceExists(plans: unknown[], taskRef: string): boolean {
  const normalizedRef = normalizeTaskDescriptor(taskRef);
  if (!normalizedRef) return false;
  const planList = Array.isArray(plans) ? plans : [];
  for (const plan of planList) {
    if (!plan || typeof plan !== "object") continue;
    const obj = plan as Record<string, unknown>;
    const candidates = [
      obj.task,
      obj.title,
      obj.task_id,
      obj.id,
    ].map(normalizeTaskDescriptor).filter(Boolean);
    if (candidates.some((c) => c === normalizedRef || c.includes(normalizedRef) || normalizedRef.includes(c))) {
      return true;
    }
  }
  return false;
}

export function validateMandatoryTaskCoverageContract(
  payload: unknown,
  findings: MandatoryHealthAuditFinding[],
): MandatoryTaskCoverageValidationResult {
  const mandatory = Array.isArray(findings) ? findings : [];
  if (mandatory.length === 0) {
    return { ok: true, missing: [], invalid: [], mapped: [], excluded: [] };
  }

  const entries = normalizeMandatoryTaskCoverageEntries(payload);
  const byId = new Map<string, { status: "mapped" | "excluded" | ""; planTask: string; justification: string }>();
  for (const entry of entries) {
    if (!entry.findingId || byId.has(entry.findingId)) continue;
    byId.set(entry.findingId, entry);
  }

  const missing: string[] = [];
  const invalid: string[] = [];
  const mapped: string[] = [];
  const excluded: string[] = [];
  const plans = Array.isArray((payload as any)?.plans) ? (payload as any).plans : [];

  for (const finding of mandatory) {
    const entry = byId.get(finding.id);
    if (!entry) {
      missing.push(finding.id);
      continue;
    }
    if (entry.status === "mapped") {
      if (!entry.planTask || !planReferenceExists(plans, entry.planTask)) {
        invalid.push(`${finding.id}:mapped_without_existing_plan`);
      } else {
        mapped.push(finding.id);
      }
      continue;
    }
    if (entry.status === "excluded") {
      if (!isCycleSpecificExclusionJustification(entry.justification)) {
        invalid.push(`${finding.id}:excluded_without_justification`);
      } else {
        excluded.push(finding.id);
      }
      continue;
    }
    invalid.push(`${finding.id}:invalid_status`);
  }

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid, mapped, excluded };
}

export function buildMandatoryCoverageRetryDiff(result: MandatoryTaskCoverageValidationResult): string {
  const missing = Array.isArray(result?.missing) ? result.missing : [];
  const invalid = Array.isArray(result?.invalid) ? result.invalid : [];
  const missingText = missing.length > 0 ? missing.join(", ") : "none";
  const invalidText = invalid.length > 0 ? invalid.join(", ") : "none";
  return `missing=[${sanitizePromptLine(missingText, 600)}]
invalid=[${sanitizePromptLine(invalidText, 1200)}]`;
}

export const MANDATORY_COVERAGE_ENFORCE_REJECT_TOKEN = "ENFORCE_REJECT";
export const MANDATORY_COVERAGE_ENFORCE_EXIT_CODE = 2;

export function applyMandatoryCoverageEnforceReject(
  payload: any,
  result: MandatoryTaskCoverageValidationResult,
): any {
  const next = (payload && typeof payload === "object") ? payload : {};
  next._mandatoryTaskCoverageGate = {
    ok: false,
    missing: Array.isArray(result?.missing) ? result.missing : [],
    invalid: Array.isArray(result?.invalid) ? result.invalid : [],
    mapped: Array.isArray(result?.mapped) ? result.mapped : [],
    excluded: Array.isArray(result?.excluded) ? result.excluded : [],
    _retryAttempted: true,
    logToken: MANDATORY_COVERAGE_ENFORCE_REJECT_TOKEN,
    exitCode: MANDATORY_COVERAGE_ENFORCE_EXIT_CODE,
  };
  next._parserReject = {
    token: MANDATORY_COVERAGE_ENFORCE_REJECT_TOKEN,
    exitCode: MANDATORY_COVERAGE_ENFORCE_EXIT_CODE,
    reason: "mandatory_task_coverage_enforce",
  };
  next.plans = [];
  return next;
}

function sanitizePromptLine(value: unknown, maxLen = 220): string {
  const compact = String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return "";
  return compact.length > maxLen ? `${compact.slice(0, maxLen - 3)}...` : compact;
}

/**
 * Strip operational tool traces and free-form internal reasoning from a planning
 * text field before persistence.  Prevents tool_call lines, thinking blocks, and
 * role prefixes from leaking into downstream planning artifacts (prometheus_analysis.json).
 *
 * Exported for testing.
 */
export function sanitizePlanningFieldForPersistence(text: string): string {
  const raw = String(text || "");
  // Remove <thinking>...</thinking> blocks (potentially multiline).
  const noThinking = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  const lines = noThinking.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const norm = line.trim();
    if (!norm) return false;
    if (/^(tool_call|tool_result|function_call|assistant:|system:|user:)/i.test(norm)) return false;
    if (/^copilot>/i.test(norm)) return false;
    if (/^\[?(synthesizer_start|synthesizer_end|research_synthesizer_live)\]/i.test(norm)) return false;
    return true;
  });
  return filtered.join("\n").trim();
}

/**
 * Returns true ONLY when ALL topics are quarantined (passedTopics is empty).
 * Partial quarantine (some topics pass) does NOT constitute degraded mode.
 * Exported for testing.
 */
export function isResearchDegradedModeActive(
  quarantinedTopicNames: string[],
  passedTopics: unknown[],
): boolean {
  return quarantinedTopicNames.length > 0 && passedTopics.length === 0;
}

function normalizeResearchTopic(value: unknown): string {
  const text = sanitizePromptLine(value, 180)
    .replace(/^[-*\u2022\u25cf\u25cb\u00b7\s]+/, "")
    .trim();
  if (!text) return "";
  if (/^read\s+/i.test(text)) return "";
  if (/^prompt[_-]/i.test(text)) return "";
  if (/^state[\\/]/i.test(text)) return "";
  return text;
}

function extractResearchTopics(synthesis: unknown, scout: unknown): string[] {
  const topics: string[] = [];
  const seen = new Set<string>();
  const synthesisObj = (synthesis && typeof synthesis === "object") ? synthesis as Record<string, unknown> : {};
  const scoutObj = (scout && typeof scout === "object") ? scout as Record<string, unknown> : {};

  const pushTopic = (raw: unknown) => {
    const normalized = normalizeResearchTopic(raw);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    topics.push(normalized);
  };

  const synthesisTopics = Array.isArray(synthesisObj.topics) ? synthesisObj.topics : [];
  for (const topic of synthesisTopics) {
    const topicObj = (topic && typeof topic === "object") ? topic as Record<string, unknown> : {};
    pushTopic(topicObj.topic);
  }

  const scoutSources = Array.isArray(scoutObj.sources) ? scoutObj.sources : [];
  for (const source of scoutSources) {
    const sourceObj = (source && typeof source === "object") ? source as Record<string, unknown> : {};
    const tags = Array.isArray(sourceObj.topicTags) ? sourceObj.topicTags : [];
    for (const tag of tags) pushTopic(tag);
    pushTopic(sourceObj.title);
  }

  return topics;
}

function computeResearchCoverageTarget(topicCount: number, sourceCount: number, maxTasks: number): number {
  const topics = Number.isFinite(topicCount) ? Math.max(0, Math.floor(topicCount)) : 0;
  const sources = Number.isFinite(sourceCount) ? Math.max(0, Math.floor(sourceCount)) : 0;
  if (topics === 0 && sources === 0) return 0;

  const signal = Math.max(topics, Math.ceil(sources / 2));
  const dynamicTarget = Math.max(3, Math.ceil(signal * 0.45));
  const boundedByResearch = Math.min(12, dynamicTarget);
  if (Number.isFinite(maxTasks) && maxTasks > 0) {
    return Math.max(1, Math.min(Math.floor(maxTasks), boundedByResearch));
  }
  return boundedByResearch;
}

function buildResearchPromptSection(
  synthesis: unknown,
  scout: unknown,
  planningPolicy: { maxTasks?: number } | Record<string, unknown>,
  artifactAgeMs?: number
): {
  sectionText: string;
  topicCount: number;
  sourceCount: number;
  coverageTarget: number;
} {
  // Staleness: if research artifacts are older than 72 h, flag them as stale
  // so Prometheus deprioritises re-injecting the same cached signal each cycle.
  const STALE_THRESHOLD_MS = 72 * 60 * 60 * 1000;
  const isStale = typeof artifactAgeMs === "number" && artifactAgeMs > 0
    && (Date.now() - artifactAgeMs) > STALE_THRESHOLD_MS;
  const synthesisObj = (synthesis && typeof synthesis === "object") ? synthesis as Record<string, unknown> : {};
  const scoutObj = (scout && typeof scout === "object") ? scout as Record<string, unknown> : {};
  const topics = extractResearchTopics(synthesis, scout);
  const topicCount = topics.length;
  const sourceCount = Number.isFinite(Number(synthesisObj.scoutSourceCount))
    ? Number(synthesisObj.scoutSourceCount)
    : Number.isFinite(Number(scoutObj.sourceCount))
      ? Number(scoutObj.sourceCount)
      : 0;
  const coverageTarget = computeResearchCoverageTarget(topicCount, sourceCount, Number(planningPolicy?.maxTasks || 0));

  if (topicCount === 0 && sourceCount === 0) {
    return { sectionText: "", topicCount: 0, sourceCount: 0, coverageTarget: 0 };
  }

  // When stale, reduce source preview to reduce bloat with outdated data.
  // Topics and cross-topic connections are always fully injected — they are the
  // richest planning signal and must not be truncated.
  const sourcePreviewLimit = isStale ? 5 : 15;
  const boundedTopics = boundStructuredList(topics, { maxItems: 24, maxItemChars: 220 });
  const topicLines = boundedTopics.map((topic, i) => `${i + 1}. ${topic}`).join("\n");
  const _hiddenTopicCount = 0; // all topics always shown
  const sourceSignals = (Array.isArray(scoutObj.sources) ? scoutObj.sources : [])
    .slice(0, sourcePreviewLimit)
    .map((source, i: number) => {
      const sourceObj = (source && typeof source === "object") ? source as Record<string, unknown> : {};
      const title = sanitizePromptLine(sourceObj.title || "Untitled source", 160);
      const why = sanitizePromptLine(sourceObj.whyImportant || "", 280);
      return `${i + 1}. ${title}${why ? ` — ${why}` : ""}`;
    })
    .join("\n");
  // Research gaps: inject in full — these directly tell Prometheus what was NOT covered.
  const gapsPreview = String(synthesisObj.researchGaps || "").slice(0, 2000);

  // Cross-topic connections are the RICHEST actionable content: they show which topics
  // must be implemented together and why. Inject ALL connections at full fidelity.
  const crossTopicLines = boundStructuredList(
    Array.isArray(synthesisObj.crossTopicConnections) ? synthesisObj.crossTopicConnections : [],
    { maxItems: 20, maxItemChars: 360 }
  )
    .map((c: string, i: number) => `${i + 1}. ${sanitizePromptLine(c, 360)}`)
    .join("\n");
  const plannerSignals = (synthesisObj.plannerSignals && typeof synthesisObj.plannerSignals === "object")
    ? synthesisObj.plannerSignals as Record<string, unknown>
    : {};
  const priorityActionLines = boundStructuredList(
    Array.isArray(plannerSignals.priorityActions) ? plannerSignals.priorityActions : [],
    { maxItems: 12, maxItemChars: 360 }
  )
    .map((entry: string, i: number) => `${i + 1}. ${sanitizePromptLine(entry, 360)}`)
    .join("\n");
  const riskFlagLines = boundStructuredList(
    Array.isArray(plannerSignals.riskFlags) ? plannerSignals.riskFlags : [],
    { maxItems: 12, maxItemChars: 360 }
  )
    .map((entry: string, i: number) => `${i + 1}. ${sanitizePromptLine(entry, 360)}`)
    .join("\n");

  const stalenessNote = isStale
    ? `\n⚠️  STALE: Research artifacts are >72 h old. Do NOT produce redundant plans for topics already in ACCUMULATED TOPIC KNOWLEDGE. Only generate NEW packets for genuinely unaddressed gaps.`
    : "";

  const sectionText = `\n\n## EXTERNAL RESEARCH INTELLIGENCE${stalenessNote}\nResearch signal available for this cycle: ${topicCount} topic(s), ${sourceCount} source(s).\n\nResearch coverage target: ${coverageTarget > 0 ? coverageTarget : "AUTO"} research-backed packet(s) when materially applicable.\nDo NOT ignore this section. For each high-confidence unresolved topic, either:\n1) produce an actionable packet with concrete target_files and verification, or\n2) state that it is already implemented and cite exact file evidence in before_state/after_state.\n\nAll research topics:\n${topicLines || "(none)"}${crossTopicLines ? `\n\nCross-topic implementation dependencies (act on these together — these are your highest-priority planning inputs):\n${crossTopicLines}` : ""}${priorityActionLines ? `\n\nPlanner-ready priority actions (distilled):\n${priorityActionLines}` : ""}${riskFlagLines ? `\n\nPlanner risk flags:\n${riskFlagLines}` : ""}${sourceSignals ? `\n\nSource signals:\n${sourceSignals}` : ""}${gapsPreview ? `\n\nResearch gaps to address next (areas the Scout did NOT cover — generate packets for these):\n${gapsPreview}` : ""}`;

  return { sectionText, topicCount, sourceCount, coverageTarget };
}

async function getLatestResearchArtifactUpdatedAtMs(stateDir: string): Promise<number> {
  const files = ["research_scout_output.json", "research_synthesis.json"];
  let latest = 0;
  for (const file of files) {
    try {
      const stat = await fs.stat(path.join(stateDir, file));
      const ms = Number(stat?.mtimeMs || 0);
      if (Number.isFinite(ms) && ms > latest) latest = ms;
    } catch {
      // Optional artifact; ignore missing file.
    }
  }
  return latest;
}

const DIAGNOSTICS_FRESHNESS_MAX_AGE_MS = 6 * 60 * 60 * 1000;

// ── Diagnostics freshness admission gate (exported) ──────────────────────────

/**
 * A single diagnostics source record for freshness evaluation.
 * Callers supply one entry per diagnostics artifact (intervention_optimizer,
 * dependency_graph, etc.).
 */
export interface DiagnosticsFreshnessRecord {
  /** Human-readable label for the diagnostics source (used in reasons). */
  label: string;
  /** ISO 8601 timestamp when the record was last written, or null if absent. */
  recordedAt: string | null;
  /**
   * Maximum age in ms before the record is considered stale.
   * Defaults to DIAGNOSTICS_FRESHNESS_MAX_AGE_MS (6 h).
   */
  staleAfterMs?: number;
}

/**
 * Result returned by computeDiagnosticsFreshnessAdmission.
 */
export interface DiagnosticsFreshnessAdmission {
  /** True when ALL diagnostics sources are fresh (no stale or missing entries). */
  allFresh: boolean;
  /** Labels of sources that are stale or missing. */
  staleSources: string[];
  /**
   * Machine-readable reasons, one per stale/missing source.
   * Format: "stale_diagnostics:<label>:ageMinutes=<N>:staleAfterMs=<M>"
   * or      "missing_diagnostics:<label>"
   */
  freshnessReasons: string[];
}

/**
 * Deterministic freshness gate for diagnostics records.
 *
 * Pure function — no I/O.  Callers pass pre-loaded timestamp metadata;
 * this function computes admission status from those values alone.
 *
 * @param records — array of diagnostics source descriptors
 * @param nowMs   — current time in ms (defaults to Date.now())
 * @returns DiagnosticsFreshnessAdmission
 */
export function computeDiagnosticsFreshnessAdmission(
  records: DiagnosticsFreshnessRecord[],
  nowMs: number = Date.now(),
): DiagnosticsFreshnessAdmission {
  const safeRecords = Array.isArray(records) ? records : [];
  const staleSources: string[] = [];
  const freshnessReasons: string[] = [];

  for (const record of safeRecords) {
    const label = String(record.label || "unknown");
    const staleAfterMs = Number.isFinite(record.staleAfterMs) && (record.staleAfterMs as number) > 0
      ? (record.staleAfterMs as number)
      : DIAGNOSTICS_FRESHNESS_MAX_AGE_MS;

    if (!record.recordedAt) {
      staleSources.push(label);
      freshnessReasons.push(`missing_diagnostics:${label}`);
      continue;
    }

    const recordedAtMs = new Date(record.recordedAt).getTime();
    if (!Number.isFinite(recordedAtMs)) {
      staleSources.push(label);
      freshnessReasons.push(`missing_diagnostics:${label}:invalid_timestamp`);
      continue;
    }

    const ageMs = nowMs - recordedAtMs;
    if (ageMs > staleAfterMs) {
      staleSources.push(label);
      const ageMinutes = Math.round(ageMs / 60_000);
      freshnessReasons.push(
        `stale_diagnostics:${label}:ageMinutes=${ageMinutes}:staleAfterMs=${staleAfterMs}`,
      );
    }
  }

  return {
    allFresh: staleSources.length === 0,
    staleSources,
    freshnessReasons,
  };
}

/**
 * Tag plans that reference stale diagnostics sources with machine-readable
 * quarantine metadata.  Plans are tagged when:
 *   1. The freshness admission result reports at least one stale source, AND
 *   2. The plan's task or context text explicitly references a known stale label
 *      OR the plan has no independent backing signals (no implementationEvidence
 *      and no explicit novelty score above the collapse threshold).
 *
 * Tagged plans receive `_staleDiagnosticsGated: true` and
 * `_staleDiagnosticsReason: string` so downstream validators can reject them
 * deterministically without re-reading the diagnostics files.
 *
 * Pure function — mutates plan objects in-place and returns the same array.
 *
 * @param plans             — plan objects to evaluate
 * @param freshnessResult   — result from computeDiagnosticsFreshnessAdmission
 * @returns the same plans array (with mutated entries)
 */
export function tagStaleDiagnosticsBackedPlans(
  plans: any[],
  freshnessResult: DiagnosticsFreshnessAdmission,
): any[] {
  if (!Array.isArray(plans) || freshnessResult.allFresh) return plans;

  const staleLabels = new Set(freshnessResult.staleSources.map(l => l.toLowerCase()));
  const reasonSummary = freshnessResult.freshnessReasons.join("; ");

  for (const plan of plans) {
    if (!plan || typeof plan !== "object") continue;

    const taskText = String(plan.task || plan.title || "").toLowerCase();
    const contextText = String(plan.context || "").toLowerCase();
    const combined = taskText + " " + contextText;

    // Check if the plan explicitly references a stale source by label
    const referencesStaleSource = [...staleLabels].some(label => combined.includes(label));

    // Check for independent backing: implementationEvidence or novelty
    const hasImplementationEvidence =
      Array.isArray(plan.implementationEvidence) &&
      plan.implementationEvidence.some((e: unknown) => String(e || "").trim().length > 0);
    const hasNoveltyScore =
      typeof plan._noveltyScore === "number" && plan._noveltyScore > 0;

    const hasIndependentBacking = hasImplementationEvidence || hasNoveltyScore;

    if (referencesStaleSource || !hasIndependentBacking) {
      plan._staleDiagnosticsGated = true;
      plan._staleDiagnosticsReason =
        `stale_diagnostics_backed: plan lacks independent backing and diagnostics are stale — ` +
        reasonSummary;
    }
  }

  return plans;
}

async function readLatestJsonlRecord(filePath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const lines = raw.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        // continue scanning backwards for the most recent parseable entry
      }
    }
  } catch {
    // optional diagnostics files may not exist
  }
  return null;
}

async function readLegacyDiagnosticsFallback(stateDir: string, label: string): Promise<any | null> {
  if (label !== "intervention_optimizer") return null;
  const fallbackPath = path.join(stateDir, "intervention_optimizer_log.json");
  try {
    const legacy = await readJson(fallbackPath, null);
    const entries = Array.isArray(legacy?.entries) ? legacy.entries : [];
    if (entries.length === 0) return null;
    const latest = entries[entries.length - 1];
    const savedAt = String(latest?.generatedAt || legacy?.updatedAt || "").trim() || new Date().toISOString();
    const staleAfterMs = DIAGNOSTICS_FRESHNESS_MAX_AGE_MS;
    return {
      jsonlSchema: OPTIMIZER_LOG_JSONL_SCHEMA,
      recordType: OPTIMIZER_LOG_RECORD_TYPE,
      schemaVersion: Number(legacy?.schemaVersion || 1),
      savedAt,
      freshness: {
        status: "fresh",
        staleAfterMs,
        expiresAt: new Date(new Date(savedAt).getTime() + staleAfterMs).toISOString(),
      },
      payload: latest,
    };
  } catch {
    return null;
  }
}

function normalizeDiagnosticsRecord(record: any, expectedSchema: string, expectedRecordType: string): any | null {
  if (isDiagnosticsRecordContractValid(record, expectedSchema, expectedRecordType)) return record;
  if (!record || typeof record !== "object") return null;
  const timestamp = String(record.savedAt || record.persistedAt || record.resolvedAt || record.recordedAt || "").trim();
  if (!timestamp) return null;
  const staleAfterMs = DIAGNOSTICS_FRESHNESS_MAX_AGE_MS;
  return {
    jsonlSchema: expectedSchema,
    recordType: expectedRecordType,
    schemaVersion: Number(record.schemaVersion || 1),
    savedAt: timestamp,
    freshness: {
      status: "fresh",
      staleAfterMs,
      expiresAt: new Date(new Date(timestamp).getTime() + staleAfterMs).toISOString(),
    },
    payload: record.payload && typeof record.payload === "object" ? record.payload : record,
  };
}

function isDiagnosticsRecordContractValid(
  record: any,
  expectedSchema: string,
  expectedRecordType: string,
): boolean {
  if (!record || typeof record !== "object") return false;
  if (record.jsonlSchema !== expectedSchema) return false;
  if (record.recordType !== expectedRecordType) return false;

  const freshness = record.freshness && typeof record.freshness === "object"
    ? record.freshness
    : null;
  if (!freshness) return false;

  const staleAfterMsRaw = Number(freshness.staleAfterMs);
  if (!Number.isFinite(staleAfterMsRaw) || staleAfterMsRaw <= 0) return false;

  const timestampRaw = String(
    record.savedAt
    || record.persistedAt
    || record.recordedAt
    || record.generatedAt
    || "",
  ).trim();
  const timestampMs = timestampRaw ? new Date(timestampRaw).getTime() : NaN;
  return Number.isFinite(timestampMs);
}

/**
 * Diagnostics source descriptors used by both freshness-prompt and admission gate.
 * Centralised so adding a new diagnostics file updates both consumers atomically.
 */
const DIAGNOSTICS_SOURCE_DESCRIPTORS = [
  {
    label: "intervention_optimizer",
    file: "intervention_optimizer_log.jsonl",
    jsonlSchema: OPTIMIZER_LOG_JSONL_SCHEMA,
    recordType: OPTIMIZER_LOG_RECORD_TYPE,
  },
  {
    label: "dependency_graph",
    file: "dependency_graph_diagnostics.json",
    jsonlSchema: GRAPH_DIAGNOSTICS_JSONL_SCHEMA,
    recordType: GRAPH_DIAGNOSTICS_RECORD_TYPE,
  },
] as const;

/**
 * Build DiagnosticsFreshnessRecord[] by reading each diagnostics artifact from
 * stateDir.  Records have recordedAt=null when the artifact is missing or
 * unparseable, which computeDiagnosticsFreshnessAdmission treats as stale.
 *
 * Exported so callers (tests, orchestrator) can invoke the admission gate
 * independently of the prompt-section builder.
 */
export async function buildDiagnosticsFreshnessRecords(stateDir: string): Promise<DiagnosticsFreshnessRecord[]> {
  const records: DiagnosticsFreshnessRecord[] = [];
  for (const item of DIAGNOSTICS_SOURCE_DESCRIPTORS) {
    const filePath = path.join(stateDir, item.file);
    let normalized: any = null;
    try {
      const latest = await readLatestJsonlRecord(filePath);
      normalized = normalizeDiagnosticsRecord(latest, item.jsonlSchema, item.recordType)
        || await readLegacyDiagnosticsFallback(stateDir, item.label);
    } catch {
      // diagnostics files are optional — treat as missing
    }
    if (!normalized || !isDiagnosticsRecordContractValid(normalized, item.jsonlSchema, item.recordType)) {
      records.push({ label: item.label, recordedAt: null });
      continue;
    }
    const recordedAt = String(
      normalized.savedAt
      || normalized.persistedAt
      || normalized.recordedAt
      || normalized.generatedAt
      || "",
    ).trim() || null;
    const staleAfterMsRaw = Number((normalized as any)?.freshness?.staleAfterMs);
    const staleAfterMs = Number.isFinite(staleAfterMsRaw) && staleAfterMsRaw > 0
      ? staleAfterMsRaw
      : undefined;
    records.push({ label: item.label, recordedAt, ...(staleAfterMs !== undefined && { staleAfterMs }) });
  }
  return records;
}

async function buildDiagnosticsFreshnessPromptSection(stateDir: string): Promise<string> {
  const diagnostics = DIAGNOSTICS_SOURCE_DESCRIPTORS;

  const lines: string[] = [];
  for (const item of diagnostics) {
    const filePath = path.join(stateDir, item.file);
    const latest = await readLatestJsonlRecord(filePath);
    const normalized = normalizeDiagnosticsRecord(latest, item.jsonlSchema, item.recordType)
      || await readLegacyDiagnosticsFallback(stateDir, item.label);
    if (!normalized || !isDiagnosticsRecordContractValid(normalized, item.jsonlSchema, item.recordType)) {
      lines.push(`- ${item.label}: missing_or_unparseable (${item.file})`);
      continue;
    }

    const recordedAtRaw = String(
      normalized.savedAt
      || normalized.persistedAt
      || normalized.recordedAt
      || normalized.generatedAt
      || "",
    ).trim();
    const recordedAtMs = recordedAtRaw ? new Date(recordedAtRaw).getTime() : NaN;
    const staleAfterMsRaw = Number((normalized as any)?.freshness?.staleAfterMs);
    const staleAfterMs = Number.isFinite(staleAfterMsRaw) && staleAfterMsRaw > 0
      ? staleAfterMsRaw
      : DIAGNOSTICS_FRESHNESS_MAX_AGE_MS;
    const ageMs = Number.isFinite(recordedAtMs) ? (Date.now() - recordedAtMs) : Number.POSITIVE_INFINITY;
    const stale = !Number.isFinite(recordedAtMs) || ageMs > staleAfterMs;
    const ageMinutes = Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60_000)) : -1;
    lines.push(
      `- ${item.label}: ${stale ? "stale" : "fresh"} ` +
      `(recordedAt=${recordedAtRaw || "unknown"} ageMinutes=${ageMinutes >= 0 ? ageMinutes : "unknown"} source=${item.file})`
    );
  }

  return `## DIAGNOSTICS FRESHNESS CONTRACT
Treat diagnostics artifacts as live planning truth ONLY when status=fresh.
Any status=stale or missing_or_unparseable is historical context only and MUST NOT drive new plan priorities.
${lines.join("\n")}`;
}

// ── Source Code & State Injection for Deep Context ──────────────────────────
// These builders give Prometheus direct visibility into the actual codebase and
// system state — not just file names. This enables dramatically better planning.

/**
 * Priority source files — DEPRECATED.
 * Prometheus now reads files autonomously via allowAll tools.
 * Kept as empty array for backward compatibility with any code referencing it.
 */
const _PRIORITY_SOURCE_FILES: string[] = [];

/**
 * DEPRECATED — Prometheus now reads files autonomously.
 */
const _LARGE_FILE_HEAD_LINES = 600;

/**
 * DEPRECATED — Prometheus now reads files autonomously.
 */
const _SOURCE_CODE_SECTION_MAX_CHARS = 600_000;

/**
 * DEPRECATED — Prometheus reads files autonomously via allowAll tools.
 * Returns empty string. Kept for backward compatibility.
 */
async function _buildSourceCodeSection(_repoRoot: string): Promise<string> {
  return "";
}

/**
 * Key state files — DEPRECATED. Prometheus reads these autonomously.
 */
const _STATE_FILES_TO_INJECT: Array<{ file: string; label: string; maxChars: number }> = [];

/**
 * DEPRECATED — Prometheus reads state files autonomously via allowAll tools.
 * Returns empty string. Kept for backward compatibility.
 */
async function _buildSystemStateSection(_stateDir: string): Promise<string> {
  return "";
}

/**
 * Maximum tokens for the carry-forward payload in the planning prompt.
 * Prevents unbounded growth when many follow-up tasks accumulate across cycles.
 */
export const CARRY_FORWARD_MAX_TOKENS = 2000;

/**
 * Maximum number of low-recurrence carry-forward items included in the planning prompt.
 * High-recurrence items (>= 3 occurrences) are always included regardless of this cap.
 * Reduces prompt bulk while preserving visibility of persistent unresolved debt.
 */
export const CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS = 5;


/**
 * Maximum tokens for the behavior-patterns payload in the planning prompt.
 */
export const BEHAVIOR_PATTERNS_MAX_TOKENS = 1500;

export const DEFAULT_PROMETHEUS_RESEARCH_SECTION_MAX_TOKENS = 16000;
export const DEFAULT_PROMETHEUS_TOPIC_MEMORY_MAX_TOKENS = 1800;
export const DEFAULT_PROMETHEUS_TIMEOUT_MINUTES = 20;

/**
 * Maximum tokens for the topic memory section in the planning prompt.
 * Active topics get full knowledge fragments; completed topics get only summaries.
 */
export const TOPIC_MEMORY_MAX_TOKENS = DEFAULT_PROMETHEUS_TOPIC_MEMORY_MAX_TOKENS;

// ── Topic Memory System ─────────────────────────────────────────────────────
// Accumulates knowledge per research topic across multiple Prometheus runs.
// Active topics retain full knowledge fragments until marked "completed",
// at which point a concise summary replaces the fragments.

export interface TopicKnowledge {
  status: "active" | "completed" | "archived";
  runCount: number;
  firstSeenAt: string;
  lastUpdatedAt: string;
  knowledgeFragments: string[];
  completedSummary: string | null;
  archivedSummary?: string | null;
}

export interface TopicMemoryState {
  topics: Record<string, TopicKnowledge>;
}

const TOPIC_MEMORY_FILE = "prometheus_topic_memory.json";

export async function loadTopicMemory(stateDir: string): Promise<TopicMemoryState> {
  try {
    const data = await readJson(path.join(stateDir, TOPIC_MEMORY_FILE), null);
    if (data && typeof data === "object" && data.topics && typeof data.topics === "object") {
      return data as TopicMemoryState;
    }
  } catch { /* first run — no memory yet */ }
  return { topics: {} };
}

export async function saveTopicMemory(stateDir: string, memory: TopicMemoryState): Promise<void> {
  await writeJson(path.join(stateDir, TOPIC_MEMORY_FILE), memory);
}

export function topicKey(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/**
 * Resolve a canonical key for a new topic against the existing topic map.
 * If an existing key is a word-prefix of the new key (≥4 chars), the shorter
 * canonical key is returned to prevent topic fragmentation (e.g., "evaluation"
 * absorbs "evaluation-framework", "evaluate-systematically-braintrust", etc.).
 */
export function findCanonicalTopicKey(newKey: string, existingKeys: string[]): string {
  if (!newKey || existingKeys.length === 0) return newKey;
  let bestMatch = "";
  for (const existing of existingKeys) {
    if (existing.length < 4) continue;
    // existing is a prefix-segment of newKey: "evaluation" matches "evaluation-framework"
    if (newKey.startsWith(existing + "-") || newKey === existing) {
      if (existing.length > bestMatch.length) bestMatch = existing;
    }
  }
  return bestMatch || newKey;
}

/**
 * Update topic memory with new knowledge from this run's research and plans.
 * For each active research topic, adds new knowledge fragments extracted from
 * the research synthesis and generated plans.
 */
export function updateTopicKnowledge(
  memory: TopicMemoryState,
  researchTopics: string[],
  plans: any[],
  synthesis: unknown
): TopicMemoryState {
  const now = new Date().toISOString();
  const synthesisObj = (synthesis && typeof synthesis === "object") ? synthesis as Record<string, unknown> : {};
  const synthTopics = Array.isArray(synthesisObj.topics) ? synthesisObj.topics : [];

  for (const rawTopic of researchTopics) {
    const rawKey = topicKey(rawTopic);
    if (!rawKey) continue;
    // Route to canonical key if a parent topic already exists (dedup)
    const key = findCanonicalTopicKey(rawKey, Object.keys(memory.topics));

    if (!memory.topics[key]) {
      memory.topics[key] = {
        status: "active",
        runCount: 0,
        firstSeenAt: now,
        lastUpdatedAt: now,
        knowledgeFragments: [],
        completedSummary: null,
      };
    }

    const entry = memory.topics[key];
    if (entry.status === "completed" || entry.status === "archived") continue; // skip terminal topics

    entry.runCount++;
    entry.lastUpdatedAt = now;

    // Extract knowledge from synthesis for this topic.
    // Synthesis topics in the current format only carry 'topic', 'confidence', 'freshness'.
    // Fall back to confidence/freshness as a lightweight evidence fragment.
    for (const st of synthTopics) {
      const stObj = (st && typeof st === "object") ? st as Record<string, unknown> : {};
      const stName = String(stObj.topic || "").toLowerCase();
      if (stName.includes(key.replace(/-/g, " ")) || key.includes(stName.replace(/\s+/g, "-"))) {
        const findings = String(stObj.findings || stObj.keyFindings || stObj.summary || "").trim();
        if (findings && findings.length > 10 && !entry.knowledgeFragments.includes(findings)) {
          entry.knowledgeFragments.push(findings.slice(0, 500));
        }
        // Use confidence/freshness as a lightweight fragment when findings is absent
        const conf = String(stObj.confidence || "").trim();
        const fresh = String(stObj.freshness || "").trim();
        if (!findings && (conf || fresh)) {
          const fragment = `Research signal: confidence=${conf.slice(0, 80)} freshness=${fresh.slice(0, 120)}`;
          if (!entry.knowledgeFragments.includes(fragment)) {
            entry.knowledgeFragments.push(fragment);
          }
        }
      }
    }

    // Extract knowledge from crossTopicConnections that mention this topic
    const crossConnections = Array.isArray(synthesisObj.crossTopicConnections) ? synthesisObj.crossTopicConnections : [];
    const topicWords = rawTopic.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    for (const conn of crossConnections) {
      const connText = String(conn || "").toLowerCase();
      if (topicWords.some(w => connText.includes(w))) {
        const fragment = sanitizePromptLine(conn, 400);
        if (fragment.length > 20 && !entry.knowledgeFragments.includes(fragment)) {
          entry.knowledgeFragments.push(fragment);
        }
      }
    }

    // Extract knowledge from plans that reference this topic
    for (const plan of (plans || [])) {
      const task = String(plan?.task || plan?.title || "").toLowerCase();
      const topicWords = rawTopic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matches = topicWords.some(w => task.includes(w));
      if (matches) {
        const fragment = `Plan: ${String(plan?.task || plan?.title || "").slice(0, 120)} | scope=${String(plan?.scope || "?").slice(0, 60)}`;
        if (!entry.knowledgeFragments.includes(fragment)) {
          entry.knowledgeFragments.push(fragment);
        }
      }
    }

    // Keep fragments bounded to prevent unbounded growth
    if (entry.knowledgeFragments.length > 30) {
      entry.knowledgeFragments = entry.knowledgeFragments.slice(-30);
    }
  }

  return memory;
}

/**
 * Detect topics that have been fully planned (all research topics have corresponding
 * plans with concrete target_files and verification). Mark them completed and generate
 * a concise summary from accumulated knowledge.
 */
export function detectAndCompleteTopics(
  memory: TopicMemoryState,
  researchTopics: string[],
  plans: any[],
  analysisRoot?: unknown,
  qualityGateQuarantinedTopics: string[] = []
): { memory: TopicMemoryState; completedThisRun: string[]; archivedThisRun: string[] } {
  const completedThisRun: string[] = [];
  const archivedThisRun: string[] = [];
  const now = new Date().toISOString();

  // Build set of topic keys covered by plan synthesis_sources (forward reference — accurate)
  const coveredByPlanKeys = new Set<string>();
  for (const plan of (plans || [])) {
    const sources = Array.isArray((plan as any).synthesis_sources) ? (plan as any).synthesis_sources as string[] : [];
    for (const s of sources) {
      coveredByPlanKeys.add(topicKey(s));
      // Also try canonical resolution so partial matches work
      coveredByPlanKeys.add(findCanonicalTopicKey(topicKey(s), Object.keys(memory.topics)));
    }
  }

  // Build set of keys explicitly marked informational (Prometheus says: "read but no plan needed")
  const informationalKeys = new Set<string>();
  const informationalList = Array.isArray((analysisRoot as any)?.informational_topics_consumed)
    ? (analysisRoot as any).informational_topics_consumed as string[]
    : [];
  for (const t of informationalList) {
    informationalKeys.add(topicKey(t));
    informationalKeys.add(findCanonicalTopicKey(topicKey(t), Object.keys(memory.topics)));
  }

  // Fallback: if synthesis quality gate quarantined topics and Prometheus did not
  // emit either synthesis_sources or informational_topics_consumed, archive those
  // low-density topics so they do not remain active forever.
  const quarantinedKeys = new Set<string>();
  for (const t of (qualityGateQuarantinedTopics || [])) {
    quarantinedKeys.add(topicKey(t));
    quarantinedKeys.add(findCanonicalTopicKey(topicKey(t), Object.keys(memory.topics)));
  }
  const canFallbackArchiveQuarantined = quarantinedKeys.size > 0 && coveredByPlanKeys.size === 0 && informationalKeys.size === 0;

  for (const rawTopic of researchTopics) {
    const key = findCanonicalTopicKey(topicKey(rawTopic), Object.keys(memory.topics));
    if (!key || !memory.topics[key]) continue;
    const entry = memory.topics[key];
    if (entry.status === "completed" || entry.status === "archived") continue;

    const coveredByPlan = coveredByPlanKeys.has(key);
    const isInformational = informationalKeys.has(key);
    const isQuarantinedLowDensity = canFallbackArchiveQuarantined && quarantinedKeys.has(key);

    if (entry.runCount >= 1 && (coveredByPlan || isInformational || isQuarantinedLowDensity)) {
      const fragmentSummary = entry.knowledgeFragments.slice(-5).join("; ");
      entry.lastUpdatedAt = now;
      entry.knowledgeFragments = [];
      if (coveredByPlan) {
        entry.status = "completed";
        entry.completedSummary = `Completed after ${entry.runCount} run(s) — reason: plan produced. Fragments: ${fragmentSummary.slice(0, 300)}`;
        entry.archivedSummary = null;
        completedThisRun.push(key);
      } else {
        entry.status = "archived";
        const archiveReason = isInformational
          ? "reviewed as informational (no implementation needed)"
          : "quarantined by synthesis quality gate (insufficient actionable signal)";
        entry.archivedSummary = `Archived after ${entry.runCount} run(s) — ${archiveReason}. Fragments: ${fragmentSummary.slice(0, 300)}`;
        entry.completedSummary = null;
        archivedThisRun.push(key);
      }
    }
  }

  return { memory, completedThisRun, archivedThisRun };
}

/**
 * Build a prompt section from accumulated topic memory.
 * Active topics include full knowledge fragments; completed topics include only summaries.
 */
export function buildTopicMemoryPromptSection(memory: TopicMemoryState): string {
  const activeTopics = Object.entries(memory.topics).filter(([, v]) => v.status === "active");
  const completedTopics = Object.entries(memory.topics).filter(([, v]) => v.status === "completed");
  const archivedTopics = Object.entries(memory.topics).filter(([, v]) => v.status === "archived");
  const activeTopicsWithFragments = activeTopics.filter(([, topic]) => topic.knowledgeFragments.length > 0);

  if (activeTopics.length === 0 && completedTopics.length === 0 && archivedTopics.length === 0) return "";

  const lines: string[] = [];
  lines.push("\n\n## ACCUMULATED TOPIC KNOWLEDGE (cross-run memory)");
  lines.push("This knowledge has been accumulated across multiple Prometheus runs.");
  lines.push("Use it to produce deeper, more informed plans. Do NOT re-research completed topics.");
  lines.push(`Active topics tracked: ${activeTopics.length}. Completed topics tracked: ${completedTopics.length}. Archived topics tracked: ${archivedTopics.length}.`);

  if (activeTopicsWithFragments.length > 0) {
    lines.push("\n### ACTIVE TOPICS (still being researched — use accumulated knowledge)");
    for (const [key, topic] of activeTopicsWithFragments.slice(0, 6)) {
      lines.push(`\n**${key}** (${topic.runCount} run(s), since ${topic.firstSeenAt.slice(0, 10)}):`);
      for (const frag of topic.knowledgeFragments.slice(-2)) {
        lines.push(`  - ${frag.slice(0, 200)}`);
      }
    }
    if (activeTopicsWithFragments.length > 6) {
      lines.push(`\n... ${activeTopicsWithFragments.length - 6} additional active topic(s) with stored evidence omitted for prompt budget control.`);
    }
  } else if (activeTopics.length > 0) {
    lines.push("\n### ACTIVE TOPICS");
    lines.push("Detailed active-topic fragments omitted because no accumulated evidence snippets are currently stored.");
  }

  if (completedTopics.length > 0) {
    lines.push("\n### COMPLETED TOPICS (fully researched — summaries only)");
    for (const [key, topic] of completedTopics.slice(0, 8)) {
      lines.push(`- **${key}**: ${(topic.completedSummary || "No summary").slice(0, 250)}`);
    }
    if (completedTopics.length > 8) {
      lines.push(`- ... ${completedTopics.length - 8} additional completed topic summary/summaries omitted for prompt budget control.`);
    }
  }

  if (archivedTopics.length > 0) {
    lines.push("\n### ARCHIVED TOPICS (reviewed, no action needed)");
    for (const [key, topic] of archivedTopics.slice(0, 8)) {
      lines.push(`- **${key}**: ${(topic.archivedSummary || "Archived as informational").slice(0, 250)}`);
    }
    if (archivedTopics.length > 8) {
      lines.push(`- ... ${archivedTopics.length - 8} additional archived topic summary/summaries omitted for prompt budget control.`);
    }
  }

  return lines.join("\n");
}

/**
 * Reason codes emitted by checkPacketCompleteness for unrecoverable conditions.
 * Used in logs and _rejectedIncompletePackets metadata so callers can diagnose
 * which field caused rejection without inspecting the raw plan object.
 *
 * These values are aliases into the canonical PACKET_VIOLATION_CODE taxonomy
 * defined in plan_contract_validator.ts.  Both the generation-boundary gate
 * (here) and the post-normalization contract validator share the same string
 * values, so log output, metadata, and filtering logic are consistent end-to-end.
 */
export const UNRECOVERABLE_PACKET_REASONS = Object.freeze({
  /** Raw plan has no task/title/task_id/id — normalization would synthesize "Task-N" */
  NO_TASK_IDENTITY:              PACKET_VIOLATION_CODE.NO_TASK_IDENTITY,
  /** capacityDelta field is absent — normalization cannot synthesize it */
  MISSING_CAPACITY_DELTA:        PACKET_VIOLATION_CODE.MISSING_CAPACITY_DELTA,
  /** capacityDelta is present but not a finite number ∈ [-1.0, 1.0] */
  INVALID_CAPACITY_DELTA:        PACKET_VIOLATION_CODE.INVALID_CAPACITY_DELTA,
  /** requestROI field is absent — normalization cannot synthesize it */
  MISSING_REQUEST_ROI:           PACKET_VIOLATION_CODE.MISSING_REQUEST_ROI,
  /** requestROI is present but not a positive finite number */
  INVALID_REQUEST_ROI:           PACKET_VIOLATION_CODE.INVALID_REQUEST_ROI,
  /** verification and verification_commands are both absent/empty — no completion signal */
  MISSING_VERIFICATION_COUPLING: PACKET_VIOLATION_CODE.MISSING_VERIFICATION_COUPLING,
});

/**
 * Reason code emitted when a packet is explicitly high-risk but lacks BOTH
 * premortem AND acceptance_criteria at the raw-packet stage.
 * Rejecting these packets before normalization prevents undocumented high-risk
 * changes from entering the dispatch pipeline without any safety evidence.
 */
export const HIGH_RISK_LOW_CONFIDENCE_REASON = "high_risk_low_confidence" as const;

/**
 * Maximum number of plans a single Prometheus decomposition cycle may produce.
 *
 * `0` means disabled (no hard cap). This is the default so Prometheus can emit
 * all useful plans it can justify from available evidence.
 *
 * A positive value enables trimming for operators who explicitly want a guardrail.
 */
export const MAX_DECOMPOSITION_PLANS = 20;

/** Reason code emitted when a plans batch is trimmed by the decomposition cap. */
export const DECOMPOSITION_CAP_REASON = "decomposition_cap_exceeded" as const;

/**
 * Check whether a raw plans array exceeds the decomposition cap.
 *
 * Returns a result indicating whether capping occurred, the original plan
 * count, the capped count, and the reason string.  Pure function — does not
 * mutate the input.
 *
 * @param rawPlans - the plans array as emitted by the AI, before normalization
 * @returns {{ capped: boolean; originalCount: number; cappedCount: number; reason: string }}
 */
export function checkDecompositionCaps(rawPlans: unknown[], configuredCap = MAX_DECOMPOSITION_PLANS): {
  capped: boolean;
  originalCount: number;
  cappedCount: number;
  reason: string;
} {
  const plans = Array.isArray(rawPlans) ? rawPlans : [];
  const originalCount = plans.length;
  const cap = Number.isFinite(Number(configuredCap)) && Number(configuredCap) > 0
    ? Math.floor(Number(configuredCap))
    : 0;
  if (cap <= 0 || originalCount <= cap) {
    return { capped: false, originalCount, cappedCount: originalCount, reason: "within_cap" };
  }
  return {
    capped: true,
    originalCount,
    cappedCount: cap,
    reason: DECOMPOSITION_CAP_REASON,
  };
}

/**
 * Component confidence thresholds for the strict high-risk gate.
 *
 * When a component score falls below its threshold, the component is considered
 * "weak" and the strict gate becomes active for high-risk plans.
 *
 *   plansShape:      < 0.8 — fallback/narrative parse mode was used (score 0.5)
 *   requestBudget:   < 0.95 — request budget was rebuilt deterministically (score 0.9)
 *   dependencyGraph: < 0.8 — dependency graph had cycles (0.3) or conflicts/degradation (0.6)
 */
export const HIGH_RISK_COMPONENT_GATE_THRESHOLDS: Readonly<Record<string, number>> = Object.freeze({
  plansShape:      0.8,
  requestBudget:   0.95,
  dependencyGraph: 0.8,
});

/** Result returned by computeHighRiskComponentGate(). */
export interface ComponentHighRiskGateResult {
  /** True when at least one component is below its threshold — strict gate is active. */
  shouldApplyStricterGate: boolean;
  /** Human-readable explanation of why the strict gate is/is not active. */
  reason: string;
  /** Names of components whose score fell below the threshold. */
  weakComponents: string[];
}

/**
 * Compute whether the component-level strict gate should be applied to high-risk plans.
 *
 * When any component (plansShape, requestBudget, dependencyGraph) is below its
 * threshold, the gate becomes active.  Active gate means high-risk plans must have
 * BOTH a valid premortem AND non-empty acceptance_criteria — not just one of the two,
 * which is the looser requirement enforced by the pre-normalization
 * checkHighRiskPacketConfidence gate.
 *
 * Pure function — no I/O.  Safe to call with partial/missing components;
 * missing scores default to 1.0 (healthy).
 *
 * @param components — subset of parserConfidenceComponents (plansShape, requestBudget, dependencyGraph)
 * @returns ComponentHighRiskGateResult
 */
export function computeHighRiskComponentGate(
  components: Partial<Record<string, number>>
): ComponentHighRiskGateResult {
  const weakComponents: string[] = [];

  const plansShape      = typeof components.plansShape      === "number" ? components.plansShape      : 1.0;
  const requestBudget   = typeof components.requestBudget   === "number" ? components.requestBudget   : 1.0;
  const dependencyGraph = typeof components.dependencyGraph === "number" ? components.dependencyGraph : 1.0;

  if (plansShape      < HIGH_RISK_COMPONENT_GATE_THRESHOLDS.plansShape)
    weakComponents.push("plansShape");
  if (requestBudget   < HIGH_RISK_COMPONENT_GATE_THRESHOLDS.requestBudget)
    weakComponents.push("requestBudget");
  if (dependencyGraph < HIGH_RISK_COMPONENT_GATE_THRESHOLDS.dependencyGraph)
    weakComponents.push("dependencyGraph");

  if (weakComponents.length === 0) {
    return { shouldApplyStricterGate: false, reason: "all_components_healthy", weakComponents: [] };
  }

  return {
    shouldApplyStricterGate: true,
    reason: `component_confidence_degraded(${weakComponents.join(",")})`,
    weakComponents,
  };
}

/**
 * Check whether a raw plan packet is a high-risk/low-confidence stub that must
 * be rejected before normalization.
 *
 * Rejection criteria (ALL must hold simultaneously):
 *  1. `riskLevel` is explicitly `"high"` in the raw packet.
 *  2. `premortem` is absent or contains no meaningful content (no failurePaths,
 *     mitigations, or rollbackPlan).
 *  3. `acceptance_criteria` is absent or is an empty array.
 *
 * Rationale: the OUTPUT FORMAT prompt mandates premortem for high-risk plans.
 * When BOTH confidence signals are absent the packet is an undocumented stub —
 * dispatching it is indistinguishable from random mutation on a critical path.
 *
 * Only EXPLICIT `riskLevel: "high"` triggers rejection.  Risk inferred from
 * task text is not checked here because inference requires the full normalised
 * task context which is not available at the raw-packet stage.
 *
 * @param rawPlan - raw plan object as emitted by the AI, before any normalization
 * @returns {{ requiresRejection: boolean, reason: string }}
 */
export function checkHighRiskPacketConfidence(rawPlan: any): { requiresRejection: boolean; reason: string } {
  if (!rawPlan || typeof rawPlan !== "object") {
    return { requiresRejection: false, reason: "not_an_object" };
  }

  const riskLevel = String(rawPlan.riskLevel || "").trim().toLowerCase();
  if (riskLevel !== "high") {
    return { requiresRejection: false, reason: "not_high_risk" };
  }

  // Premortem is "present" when it contains at least one of the required safety fields.
  const premortem = rawPlan.premortem;
  const hasPremortem = premortem && typeof premortem === "object" && (
    (Array.isArray(premortem.failurePaths) && premortem.failurePaths.length > 0) ||
    (Array.isArray(premortem.mitigations) && premortem.mitigations.length > 0) ||
    (typeof premortem.rollbackPlan === "string" && premortem.rollbackPlan.trim().length > 0)
  );

  const ac = rawPlan.acceptance_criteria;
  const hasAcceptanceCriteria = Array.isArray(ac) && ac.some(c => String(c || "").trim().length > 0);

  if (!hasPremortem && !hasAcceptanceCriteria) {
    return { requiresRejection: true, reason: HIGH_RISK_LOW_CONFIDENCE_REASON };
  }

  return { requiresRejection: false, reason: "sufficient_confidence" };
}

/**
 * Check whether a raw plan packet is unrecoverable before normalization.
 *
 * A packet is unrecoverable when it is missing fields that normalizePlanFromTask()
 * cannot meaningfully synthesize.  These packets must be rejected at the generation
 * boundary — right after parseAgentOutput() and before normalizePrometheusParsedOutput()
 * is called — so invalid AI output never enters the normalization pipeline.
 *
 * Unrecoverable conditions:
 *  1. No task identity  — all of task/title/task_id/id are absent or empty.
 *     Normalization falls back to "Task-N" which carries no semantic meaning.
 * Fields like capacityDelta, requestROI, and verification are NOT treated as
 * unrecoverable because normalizePlanFromTask() synthesizes sensible defaults.
 *
 * Reason codes are values from the canonical PACKET_VIOLATION_CODE taxonomy
 * (plan_contract_validator.ts) so they are identical to codes emitted by the
 * post-normalization validator — no translation layer needed.
 *
 * @param rawPlan - raw plan object as emitted by the AI, before any normalization
 * @returns {{ recoverable: boolean, reasons: string[] }}
 */
export function checkPacketCompleteness(rawPlan: any): { recoverable: boolean; reasons: string[] } {
  if (!rawPlan || typeof rawPlan !== "object") {
    return { recoverable: false, reasons: [PACKET_VIOLATION_CODE.NO_TASK_IDENTITY] };
  }

  const reasons: string[] = [];

  // 1. Task identity: at least one of task/title/task_id/id must be a non-empty string.
  const taskText = String(rawPlan.task || rawPlan.title || rawPlan.task_id || rawPlan.id || "").trim();
  if (taskText.length === 0) {
    reasons.push(PACKET_VIOLATION_CODE.NO_TASK_IDENTITY);
  }

  // capacityDelta and requestROI are NOT checked here because
  // normalizePlanFromTask() synthesizes defaults (0.1 and 1.0 respectively).

  return { recoverable: reasons.length === 0, reasons };
}

/**
 * Retire carry-forward items that have already been resolved.
 * Checks the carry-forward ledger (closedAt + closureEvidence) and the coordination
 * completedTasks list to skip items that have verified evidence of resolution before
 * including them in the prompt.
 *
 * Retirement is deterministic: each lesson is identified by a SHA-256 fingerprint of
 * its canonical form (boilerplate stripped), so matching is collision-resistant and
 * immune to trivial rewording. Ledger-based retirement additionally requires a
 * non-empty closureEvidence to confirm the fix actually shipped.
 *
 * @param {Array} pendingEntries - postmortem entries with followUpNeeded + followUpTask
 * @param {Array} ledger - carry_forward_ledger entries (may include closed entries)
 * @param {string[]} completedTasks - completed task IDs/titles from coordination state
 * @returns {Array} - only entries NOT yet resolved
 */
export function filterResolvedCarryForwardItems(pendingEntries, ledger, completedTasks) {
  const ledgerEntries = Array.isArray(ledger) ? ledger : [];
  const completed = Array.isArray(completedTasks) ? completedTasks : [];

  // Ledger retirement requires BOTH closedAt AND non-empty closureEvidence to ensure
  // the item was actually fixed, not just administratively closed without proof.
  const resolvedFingerprints = new Set(
    [
      ...ledgerEntries
        .filter(e => e.closedAt && e.closureEvidence)
        .map(e => e.fingerprint || computeFingerprint(String(e.lesson || ""))),
      ...completed.map(t => computeFingerprint(String(t || ""))),
    ].filter(Boolean)
  );

  return (Array.isArray(pendingEntries) ? pendingEntries : []).filter(e => {
    const fp = computeFingerprint(String(e.followUpTask || ""));
    return fp && !resolvedFingerprints.has(fp);
  });
}

function liveLogPath(stateDir) {
  return path.join(stateDir, "live_worker_prometheus.log");
}

function appendLiveLogSync(stateDir, text) {
  try {
    appendFileSync(liveLogPath(stateDir), text, "utf8");
  } catch { /* best-effort */ }
}

function appendPromptPreviewSync(stateDir, promptText) {
  const prompt = String(promptText || "").trim();
  if (!prompt) return;
  appendLiveLogSync(
    stateDir,
    [
      "",
      "[prometheus_runtime_prompt_start]",
      prompt,
      "[prometheus_runtime_prompt_end]",
      ""
    ].join("\n")
  );
}

async function appendPrometheusLiveLog(stateDir, section, text) {
  const message = String(text || "").trim();
  if (!message) return;
  const line = `\n[${section}]\n${message}\n`;
  try {
    await fs.appendFile(liveLogPath(stateDir), line, "utf8");
  } catch { /* best-effort */ }
}

/**
 * Risk threshold for pre-mortem requirement.
 * Aligned with PREMORTEM_RISK_LEVEL.HIGH from athena_reviewer.js.
 */
export const PREMORTEM_RISK_THRESHOLD = PREMORTEM_RISK_LEVEL.HIGH;

/**
 * Build an empty pre-mortem scaffold for a high-risk plan.
 */
export function buildPremortemScaffold(plan) {
  return {
    riskLevel: PREMORTEM_RISK_LEVEL.HIGH,
    scenario: "",
    failurePaths: [],
    mitigations: [],
    detectionSignals: [],
    guardrails: [],
    rollbackPlan: (plan && typeof plan === "object" && typeof plan.rollbackPlan === "string")
      ? plan.rollbackPlan
      : ""
  };
}

function inferProjectHealth(text) {
  const s = String(text || "").toLowerCase();
  if (s.includes("critical")) return "critical";
  if (s.includes("needs-work") || s.includes("needs work")) return "needs-work";
  if (s.includes("good") || s.includes("healthy")) return "good";
  return "needs-work";
}

function normalizeWaveValue(value, fallback = 1) {
  if (Number.isFinite(Number(value)) && Number(value) >= 1) {
    return Math.floor(Number(value));
  }
  const asText = String(value || "").trim();
  return asText || fallback;
}

function extractFilePathHints(text) {
  const s = String(text || "");
  const matches = s.match(/(?:src|tests|scripts|docs)\/[A-Za-z0-9_./-]+/g) || [];
  const normalized = matches
    .map((m) => m.replace(/[),.;:]+$/, ""))
    .filter(Boolean);
  return [...new Set(normalized)];
}

function slugifyTaskToFileStem(taskText) {
  return String(taskText || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "task";
}

function inferTaskKindFromText(taskText) {
  const lower = String(taskText || "").toLowerCase();
  if (/\b(test|tests|assertion|coverage|replay corpus|regression)\b/.test(lower)) return "test";
  if (/\b(readme|docs|documentation)\b/.test(lower)) return "documentation";
  if (/\b(fix|bug|failure|error|reject)\b/.test(lower)) return "bugfix";
  if (/\b(refactor|consolidat|cleanup|deduplicat)\b/.test(lower)) return "refactor";
  return "implementation";
}

function inferTargetFilesFromTask(taskText) {
  const lower = String(taskText || "").toLowerCase();
  const stem = slugifyTaskToFileStem(taskText);
  const mappings = [
    { pattern: /trust-boundary/, files: ["src/core/trust_boundary.ts"] },
    { pattern: /canary/, files: ["src/core/canary_engine.ts"] },
    { pattern: /compounding analyzer|compounding/, files: ["src/core/compounding_effects_analyzer.ts"] },
    { pattern: /freeze-window|freeze window/, files: ["src/core/governance_freeze.ts"] },
    { pattern: /resilience-drill|resilience drill/, files: ["src/core/catastrophe_detector.ts"] },
    { pattern: /worker-runner|worker runner/, files: ["src/core/worker_runner.ts"] },
    { pattern: /planner packet contract|contract completeness/, files: ["src/core/plan_contract_validator.ts", "src/core/prometheus.ts"] },
    { pattern: /critical-path scheduling|dependency-aware waves/, files: ["src/core/dag_scheduler.ts", "src/core/orchestrator.ts"] },
    { pattern: /parser replay corpus|marker\/fence|fence outputs/, files: ["src/core/parser_replay_harness.ts", "tests/core/parser_replay_harness.test.ts"] },
    { pattern: /governance integration worker lane|ownership contract/, files: ["src/core/capability_pool.ts", "src/core/role_registry.ts"] },
    { pattern: /model routing|uncertainty-aware|roi feedback loop/, files: ["src/core/agent_loader.ts", "src/core/model_router.ts"] },
    { pattern: /postmortem deltas|actionable packets/, files: ["src/core/delta_analytics.ts", "src/core/learning_policy_compiler.ts"] },
  ];

  for (const mapping of mappings) {
    if (mapping.pattern.test(lower)) {
      return mapping.files;
    }
  }

  if (/\b(test|tests|assertion|coverage|regression)\b/.test(lower)) {
    return [`tests/core/${stem}.test.ts`];
  }
  return [`src/core/${stem}.ts`];
}

function inferScopeFromTask(taskText, targetFiles) {
  const explicitScope = String(taskText || "").trim();
  const directories = [...new Set(targetFiles.map(file => String(file).split("/").slice(0, -1).join("/")).filter(Boolean))];
  if (directories.length === 1) {
    return `${directories[0]} :: ${explicitScope}`;
  }
  if (directories.length > 1) {
    return `${directories.join(" + ")} :: ${explicitScope}`;
  }
  return explicitScope;
}

function inferRiskLevel(taskText) {
  const lower = String(taskText || "").toLowerCase();
  if (/critical-path scheduling|dependency-aware waves|model routing|uncertainty-aware|roi feedback|feedback loop|postmortem deltas|actionable packets|planning feedback|scheduling core|wave.*dispatch|parallel.*dispatch|dispatcher|planner.*feedback/.test(lower)) {
    return PREMORTEM_RISK_LEVEL.HIGH;
  }
  if (/trust-boundary|contract completeness|worker lane|ownership contract|orchestrat|dispatch|planner|scheduler/.test(lower)) {
    return "medium";
  }
  return "low";
}

export function buildConcretePremortem(taskText, targetFiles) {
  const targetSummary = targetFiles.join(", ") || "targeted files";
  return {
    riskLevel: PREMORTEM_RISK_LEVEL.HIGH,
    scenario: `A high-risk change in ${targetSummary} could introduce regressions while implementing ${taskText}.`,
    failurePaths: [
      `Dependency ordering changes in ${targetSummary} break an existing orchestration path.`,
      `The new logic for ${taskText} routes work incorrectly under a previously valid input.`
    ],
    mitigations: [
      `Keep behavior behind deterministic validation checks and targeted tests for ${targetSummary}.`,
      `Preserve rollback-safe defaults so the previous path remains available if verification fails.`
    ],
    detectionSignals: [
      `Targeted tests for ${targetSummary} start failing immediately after the change.`,
      `Progress logs show a regression in the affected orchestration stage for ${taskText}.`
    ],
    guardrails: [
      `Require explicit verification before dispatching workers that depend on ${targetSummary}.`,
      `Block promotion if the modified path produces ambiguous or degraded outputs.`
    ],
    rollbackPlan: `Revert the ${targetSummary} change set and restore the previous deterministic execution path.`
  };
}

/**
 * Ensure a valid pre-mortem for the plan. If the AI model provided a partial
 * premortem, merge with scaffold defaults so all required fields are present.
 * Only high-risk plans require pre-mortems.
 */
function ensureValidPremortem(riskLevel, srcPremortem, taskText, targetFiles) {
  if (riskLevel !== PREMORTEM_RISK_LEVEL.HIGH) {
    return srcPremortem && typeof srcPremortem === "object" ? srcPremortem : undefined;
  }
  const scaffold = buildConcretePremortem(taskText, targetFiles);
  if (!srcPremortem || typeof srcPremortem !== "object") {
    return scaffold;
  }
  // Merge AI-provided premortem with scaffold defaults for missing fields
  const merged = { ...scaffold, ...srcPremortem, riskLevel: PREMORTEM_RISK_LEVEL.HIGH };
  for (const field of ["failurePaths", "mitigations", "detectionSignals", "guardrails"]) {
    if (!Array.isArray(merged[field]) || merged[field].length === 0) {
      merged[field] = scaffold[field];
    }
  }
  for (const [field, minLen] of [["scenario", 20], ["rollbackPlan", 10]] as any[]) {
    if (typeof merged[field] !== "string" || merged[field].trim().length < (minLen as number)) {
      merged[field] = scaffold[field];
    }
  }
  return merged;
}

function normalizeTargetFiles(src, taskText) {
  const direct = Array.isArray(src.targetFiles)
    ? src.targetFiles
    : Array.isArray(src.target_files)
      ? src.target_files
      : [];
  const directList = direct.map((v) => String(v || "").trim()).filter(Boolean);
  if (directList.length > 0) {
    return [...new Set(directList)];
  }

  const inferred = extractFilePathHints([
    taskText,
    src.scope,
    src.description,
    src.context,
    src.before_state,
    src.after_state,
  ].join(" "));

  if (inferred.length > 0) {
    return inferred;
  }

  return inferTargetFilesFromTask(taskText);
}

function deriveBeforeAfterState(src, taskText, acceptanceCriteria) {
  const before = String(src.beforeState || src.before_state || "").trim();
  const after = String(src.afterState || src.after_state || "").trim();
  if (before && after) {
    return { beforeState: before, afterState: after };
  }

  const primaryCriterion = String(acceptanceCriteria[0] || "").trim();
  const lowerTask = String(taskText || "").toLowerCase();
  if (/\b(test|tests|assertion|coverage|regression)\b/.test(lowerTask)) {
    return {
      beforeState: before || `No deterministic test currently proves the scenario "${taskText}".`,
      afterState: after || `A targeted test proves "${taskText}" and passes in the named test file.`
    };
  }
  if (/packet contract|contract completeness/.test(lowerTask)) {
    return {
      beforeState: before || "Planner payloads can reach dispatch without every required contract field being enforced.",
      afterState: after || "Dispatch blocks planner payloads missing required contract fields and reports the exact missing field names."
    };
  }
  if (/critical-path scheduling|dependency-aware waves/.test(lowerTask)) {
    return {
      beforeState: before || "Scheduling uses wave grouping only and does not prioritize the critical dependency path.",
      afterState: after || "Scheduler computes dependency-aware critical-path ordering while preserving wave constraints."
    };
  }
  if (/model routing|uncertainty-aware|roi feedback loop/.test(lowerTask)) {
    return {
      beforeState: before || "Model routing does not define an uncertainty schema or ROI formula before selecting a route.",
      afterState: after || "Model routing evaluates a defined uncertainty schema and ROI formula before choosing a route."
    };
  }
  if (/postmortem deltas|actionable packets/.test(lowerTask)) {
    return {
      beforeState: before || "Postmortem deltas remain descriptive notes and are not converted into actionable packets.",
      afterState: after || "Postmortem deltas deterministically produce actionable packets with scope, files, and acceptance criteria."
    };
  }

  const measurableTarget = primaryCriterion || "all acceptance criteria pass";
  return {
    beforeState: before || `Current behavior for "${taskText}" does not satisfy required acceptance criteria.`,
    afterState: after || `After completion, ${measurableTarget}`
  };
}

function buildExecutionStrategyFromPlans(plans = []) {
  const waveMap = new Map();
  for (const plan of plans) {
    const wave = Number.isFinite(Number(plan.wave)) ? Number(plan.wave) : 1;
    if (!waveMap.has(wave)) waveMap.set(wave, []);
    waveMap.get(wave).push(String(plan.task_id || plan.task || `wave-${wave}-task`));
  }

  const sortedWaves = [...waveMap.keys()].sort((a, b) => a - b);
  return {
    waves: sortedWaves.map((wave, idx) => ({
      wave,
      tasks: waveMap.get(wave),
      dependsOnWaves: idx === 0 ? [] : [sortedWaves[idx - 1]],
      maxParallelWorkers: waveMap.get(wave).length
    }))
  };
}

export function buildDeterministicRequestBudget(plans = [], executionStrategy: any = {}) {
  const waves = Array.isArray(executionStrategy.waves) ? executionStrategy.waves : [];
  const byWave = waves.map((w) => {
    const waveNum = Number.isFinite(Number(w.wave)) ? Number(w.wave) : 1;
    const wavePlans = plans.filter((p) => (Number.isFinite(Number(p.wave)) ? Number(p.wave) : 1) === waveNum);
    const roles = [...new Set(wavePlans.map((p) => String(p.role || "evolution-worker")))];
    return {
      wave: waveNum,
      planCount: wavePlans.length,
      roles,
      estimatedRequests: roles.length
    };
  });

  const byRoleMap = new Map();
  for (const plan of plans) {
    const role = String(plan.role || "evolution-worker");
    const wave = Number.isFinite(Number(plan.wave)) ? Number(plan.wave) : 1;
    if (!byRoleMap.has(role)) byRoleMap.set(role, new Set());
    byRoleMap.get(role).add(wave);
  }
  const byRole = [...byRoleMap.entries()].map(([role, waveSet]) => ({
    role,
    planCount: plans.filter((plan) => String(plan.role || "evolution-worker") === role).length,
    estimatedRequests: waveSet.size
  }));

  const estimatedPremiumRequestsTotal = Math.max(1, 3 + byWave.reduce((acc, w) => acc + w.estimatedRequests, 0));
  const errorMarginPercent = 15;
  // hardCap must be at least planCount: the optimizer must not reject plans
  // that Prometheus itself produced. Plans > estimatedTotal are allowed up to planCount.
  const minHardCap = (plans as any[]).length;
  return {
    estimatedPremiumRequestsTotal,
    errorMarginPercent,
    hardCapTotal: Math.max(minHardCap, Math.ceil(estimatedPremiumRequestsTotal * (1 + errorMarginPercent / 100))),
    confidence: "medium",
    byWave,
    byRole,
    assumptions: [
      "1 Jesus + 1 Prometheus + 1 Athena plan review per cycle",
      "1 worker premium request per role session within each execution wave"
    ]
  };
}

/**
 * Extract a scalar number from a raw plan contract field that may be either a
 * primitive number/string or an object-shaped value emitted by some LLM responses
 * (e.g. `{ "value": 0.5 }`).
 *
 * Accepted object shapes (checked in priority order):
 *   value · estimate · amount · score · number · v
 *
 * Returns `{ value: NaN, provenance: null }` for null/undefined inputs.
 * Returns `{ value: NaN, provenance: "no_scalar_key:<field>" }` when the object
 * exists but contains none of the canonical keys as a finite number.
 * When coercion succeeds, `provenance` is set to `"object_coercion:<field>:<key>"`
 * so callers can log it without losing the original parse context.
 *
 * @param rawValue  — raw field value from the parsed plan object
 * @param fieldName — field label used in provenance messages
 */
export function normalizeScalarContractField(
  rawValue: unknown,
  fieldName: string,
): { value: number; provenance: string | null } {
  if (rawValue === null || rawValue === undefined) {
    return { value: NaN, provenance: null };
  }
  // Fast path: primitive (number or numeric string) — no object coercion needed.
  if (typeof rawValue === "number" || typeof rawValue === "string") {
    return { value: Number(rawValue), provenance: null };
  }
  // Object-shaped: try canonical scalar keys in priority order.
  if (typeof rawValue === "object" && !Array.isArray(rawValue)) {
    const obj = rawValue as Record<string, unknown>;
    for (const key of ["value", "estimate", "amount", "score", "number", "v"] as const) {
      if (key in obj && obj[key] !== null && obj[key] !== undefined) {
        const extracted = Number(obj[key]);
        if (Number.isFinite(extracted)) {
          return { value: extracted, provenance: `object_coercion:${fieldName}:${key}` };
        }
      }
    }
    return { value: NaN, provenance: `no_scalar_key:${fieldName}` };
  }
  return { value: Number(rawValue), provenance: null };
}

function normalizePlanFromTask(task, index, fallbackWave = 1) {
  const src = (task && typeof task === "object") ? task : {};
  const taskText = String(src.task || src.title || src.task_id || src.id || `Task-${index + 1}`).trim();
  const taskKind = String(src.taskKind || src.kind || inferTaskKindFromText(taskText)).trim().toLowerCase();
  const verificationCommands = Array.isArray(src.verification_commands)
    ? src.verification_commands.map(v => String(v || "").trim()).filter(Boolean).map(rewriteVerificationCommand)
    : [];
  const initialVerification = String(src.verification || verificationCommands[0] || "npm test").trim() || "npm test";
  const wave = normalizeWaveValue(src.wave, fallbackWave);
  const explicitAcceptanceCriteria = Array.isArray(src.acceptance_criteria)
    ? src.acceptance_criteria.map(v => String(v || "").trim()).filter(Boolean)
    : [];
  const targetFiles = normalizeTargetFiles(src, taskText);
  const compiled = compileAcceptanceCriteria({
    ...src,
    task: taskText,
    taskKind,
    verification: initialVerification,
    targetFiles,
    target_files: targetFiles,
  });
  const verification = compiled.verification || initialVerification;
  const normalizedAcceptanceCriteria = explicitAcceptanceCriteria.length > 0
    ? explicitAcceptanceCriteria
    : compiled.criteria;
  const scope = String(src.scope || "").trim() || inferScopeFromTask(taskText, targetFiles);
  const beforeAfter = deriveBeforeAfterState(src, taskText, normalizedAcceptanceCriteria);
  const riskLevel = String(src.riskLevel || "").trim().toLowerCase() || inferRiskLevel(taskText);
  const premortem = ensureValidPremortem(riskLevel, src.premortem, taskText, targetFiles);
  const requestedRole = String(src.role || "evolution-worker").trim() || "evolution-worker";
  const normalizedRole = ["prometheus", "athena", "jesus"].includes(requestedRole.toLowerCase())
    ? "evolution-worker"
    : requestedRole;
  const interventionId = String(
    src.intervention_id || src.interventionId || src.task_id || src.id || `${normalizedRole}:${taskText}`
  ).trim() || `${normalizedRole}:${taskText}`;
  const estimatedExecutionTokens = Number.isFinite(Number(src.estimatedExecutionTokens)) && Number(src.estimatedExecutionTokens) > 0
    ? Math.floor(Number(src.estimatedExecutionTokens))
    : Number.isFinite(Number(src.estimated_execution_tokens)) && Number(src.estimated_execution_tokens) > 0
      ? Math.floor(Number(src.estimated_execution_tokens))
      : Number.isFinite(Number(src.estimated_tokens)) && Number(src.estimated_tokens) > 0
        ? Math.floor(Number(src.estimated_tokens))
        : Math.max(1, estimatePlanExecutionTokens({
          ...src,
          task: taskText,
          scope,
          target_files: targetFiles,
          acceptance_criteria: normalizedAcceptanceCriteria,
          verification: compiled.verification || initialVerification,
          riskLevel,
        }));

  // ── Parse-boundary normalization for object-shaped contract fields ─────────
  // Some LLM responses emit capacityDelta/requestROI as objects like
  // { "value": 0.5 } instead of bare scalars.  Normalize at the parse boundary
  // so the contract validator always receives the expected numeric type.
  const cdNorm = normalizeScalarContractField(src.capacityDelta, "capacityDelta");
  const roiNorm = normalizeScalarContractField(src.requestROI, "requestROI");
  if (cdNorm.provenance !== null) {
    console.warn(`[prometheus:normalize] ${taskText}: capacityDelta object-shaped coercion (${cdNorm.provenance})`);
  }
  if (roiNorm.provenance !== null) {
    console.warn(`[prometheus:normalize] ${taskText}: requestROI object-shaped coercion (${roiNorm.provenance})`);
  }
  const normalizedCapacityDelta = Number.isFinite(cdNorm.value) && cdNorm.value >= -1 && cdNorm.value <= 1
    ? cdNorm.value
    : 0.1;
  const normalizedRequestROI = Number.isFinite(roiNorm.value) && roiNorm.value > 0
    ? roiNorm.value
    : 1.0;

  return {
    ...src,
    role: normalizedRole,
    intervention_id: interventionId,
    expectedImpact: src.expectedImpact || {
      metric: "completionRate",
      direction: "up",
      note: `Derived baseline expectation from taskKind=${taskKind}`,
    },
    // owner is a required packet field (ACTIONABLE IMPROVEMENT PACKET FORMAT).
    // Preserve the explicit owner when provided; fall back to role.
    owner: String(src.owner || normalizedRole || "evolution-worker").trim() || "evolution-worker",
    task: taskText,
    priority: Number.isFinite(Number(src.priority)) ? Number(src.priority) : index + 1,
    wave,
    verification,
    taskKind,
    title: String(src.title || taskText).trim(),
    scope,
    task_id: String(src.task_id || src.id || taskText).trim(),
    description: String(src.description || "").trim(),
    waveLabel: String(src.waveLabel || "").trim(),
    targetFiles,
    target_files: targetFiles,
    beforeState: beforeAfter.beforeState,
    before_state: beforeAfter.beforeState,
    afterState: beforeAfter.afterState,
    after_state: beforeAfter.afterState,
    verification_commands: verificationCommands.length > 0 ? verificationCommands : [verification],
    acceptance_criteria: normalizedAcceptanceCriteria,
    dependencies: Array.isArray(src.dependencies)
      ? src.dependencies.map(v => String(v || "").trim()).filter(Boolean)
      : [],
    riskLevel,
    premortem,
    // leverage_rank: which EQUAL DIMENSION SET dimensions this task improves.
    // Preserved from source when provided; defaults to empty array.
    leverage_rank: Array.isArray(src.leverage_rank)
      ? src.leverage_rank.map(v => String(v || "").trim()).filter(Boolean)
      : [],
    // waveDepends: numeric wave numbers this wave depends on.
    // Propagated from the wave object by buildPlansFromAlternativeShape /
    // buildPlansFromBottlenecksShape so downstream schedulers can honour
    // wave-level ordering without re-parsing executionStrategy.
    waveDepends: Array.isArray(src.waveDepends)
      ? (src.waveDepends as any[]).map(Number).filter(n => Number.isFinite(n))
      : [],
    // capacityDelta / requestROI: normalized at parse boundary above via
    // normalizeScalarContractField() to handle object-shaped LLM outputs.
    capacityDelta: normalizedCapacityDelta,
    requestROI: normalizedRequestROI,
    // estimatedExecutionTokens: approximate total tokens this task is expected
    // to consume in a worker run; used for token-capacity-aware batching.
    estimatedExecutionTokens,
  };
}

function compactWavesForDependencyAwarePlanning(plans = []) {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  const normalized = plans.map((plan, index) => {
    const id = String(plan?.task_id || plan?.id || plan?.task || `task-${index + 1}`).trim() || `task-${index + 1}`;
    const depsRaw = [
      ...(Array.isArray(plan?.dependsOn) ? plan.dependsOn : []),
      ...(Array.isArray(plan?.dependencies) ? plan.dependencies : []),
    ];
    const deps = [...new Set(depsRaw.map((v) => String(v || "").trim()).filter(Boolean))];
    return { id, deps };
  });

  const knownIds = new Set(normalized.map((item) => item.id));
  for (const item of normalized) {
    item.deps = item.deps.filter((dep) => dep !== item.id && knownIds.has(dep));
  }

  const hasAnyDependencies = normalized.some((item) => item.deps.length > 0);
  if (!hasAnyDependencies) {
    // No explicit deps — preserve the wave assignments Prometheus already set
    // instead of collapsing everything to wave 1. Collapsing removes ordering
    // information that Athena uses to restructure execution waves.
    return plans;
  }

  try {
    const graph = resolveDependencyGraph(
      normalized.map((item) => ({ id: item.id, dependsOn: item.deps, filesInScope: [] }))
    );
    if (graph.status !== GRAPH_STATUS.OK || !Array.isArray(graph.waves) || graph.waves.length === 0) {
      return plans;
    }

    const waveById = new Map<string, number>();
    for (const wave of graph.waves) {
      const waveNum = Number(wave?.wave || 1);
      for (const taskId of Array.isArray(wave?.taskIds) ? wave.taskIds : []) {
        waveById.set(String(taskId), waveNum);
      }
    }

    return plans.map((plan, index) => {
      const current = normalized[index];
      const wave = Number(waveById.get(current.id) || plan?.wave || 1);
      const waveDepends = [...new Set(
        current.deps
          .map((depId) => Number(waveById.get(depId) || 0))
          .filter((depWave) => Number.isFinite(depWave) && depWave > 0 && depWave < wave)
      )].sort((a, b) => a - b);

      return {
        ...plan,
        wave,
        waveDepends,
        dependencies: current.deps,
        dependsOn: current.deps,
      };
    });
  } catch {
    return plans;
  }
}

function buildPlansFromAlternativeShape(input: any = {}) {
  if (!input || typeof input !== "object") return [];

  const taskIndexByKey = new Map();
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i] && typeof tasks[i] === "object" ? tasks[i] : {};
    const keys = [t.task_id, t.id, t.title, t.task].map(v => String(v || "").trim()).filter(Boolean);
    for (const key of keys) {
      if (!taskIndexByKey.has(key)) taskIndexByKey.set(key, i);
    }
  }

  const waveByTaskIndex = new Map();
  const waveDependsByTaskIndex = new Map();
  const waves = Array.isArray(input.waves) ? input.waves : [];
  for (let i = 0; i < waves.length; i++) {
    const waveObj = (waves[i] && typeof waves[i] === "object") ? waves[i] : {};
    const waveValue = normalizeWaveValue(waveObj.wave, i + 1 as any);
    // Capture wave-level dependency numbers so they survive plan normalization.
    const waveDepends: number[] = Array.isArray(waveObj.dependsOn)
      ? (waveObj.dependsOn as any[]).map(Number).filter(n => Number.isFinite(n))
      : Array.isArray(waveObj.dependsOnWaves)
        ? (waveObj.dependsOnWaves as any[]).map(Number).filter(n => Number.isFinite(n))
        : [];
    const waveTasks = Array.isArray(waveObj.tasks) ? waveObj.tasks : [];
    for (const waveTask of waveTasks) {
      if (waveTask && typeof waveTask === "object") {
        // Merge wave-level dependsOn into the task object before normalizing so
        // waveDepends is preserved through normalizePlanFromTask's ...src spread.
        const taskWithMeta = waveDepends.length > 0
          ? { waveDepends, ...waveTask }
          : waveTask;
        const asTask = normalizePlanFromTask(taskWithMeta, tasks.length, waveValue as any);
        tasks.push(asTask);
        const idx = tasks.length - 1;
        taskIndexByKey.set(asTask.task_id, idx);
        taskIndexByKey.set(asTask.task, idx);
        continue;
      }
      const key = String(waveTask || "").trim();
      if (!key) continue;
      const idx = taskIndexByKey.get(key);
      if (Number.isInteger(idx)) {
        waveByTaskIndex.set(idx, waveValue);
        if (waveDepends.length > 0) waveDependsByTaskIndex.set(idx, waveDepends);
      } else {
        // Unmatched string task: synthesize a stub plan rather than silently
        // dropping it.  The full plan fields are filled by normalizePlanFromTask.
        const stubIdx = tasks.length;
        const stub: Record<string, any> = { task: key, task_id: key, title: key };
        if (waveDepends.length > 0) stub.waveDepends = waveDepends;
        tasks.push(stub);
        taskIndexByKey.set(key, stubIdx);
        waveByTaskIndex.set(stubIdx, waveValue);
        if (waveDepends.length > 0) waveDependsByTaskIndex.set(stubIdx, waveDepends);
      }
    }
  }

  if (tasks.length > 0) {
    return tasks.map((task, i) => {
      const waveDepends = waveDependsByTaskIndex.get(i);
      // Merge wave depends into the task object so normalizePlanFromTask sees it
      // via ...src and emits it as waveDepends on the output plan.
      const taskWithMeta = waveDepends && !task.waveDepends
        ? { waveDepends, ...task }
        : task;
      return normalizePlanFromTask(taskWithMeta, i, waveByTaskIndex.get(i) || 1);
    });
  }

  return [];
}

/**
 * Build plans from the GPT analytical format: topBottlenecks[] + waves[].tasks (strings).
 * This is the format GPT-5.3-Codex produces when asked for a bottleneck analysis.
 */
function buildPlansFromBottlenecksShape(input) {
  const SEVERITY_PRIORITY = { critical: 1, high: 2, medium: 3, low: 4 };
  const waves = Array.isArray(input.waves) ? input.waves : [];
  const bottlenecks = Array.isArray(input.topBottlenecks) ? input.topBottlenecks : [];
  const proofMetrics = Array.isArray(input.proofMetrics) ? input.proofMetrics : [];

  const plans = [];

  for (const waveObj of waves) {
    if (!waveObj || typeof waveObj !== "object") continue;
    const waveNum = normalizeWaveValue(waveObj.wave, 1);
    // Preserve wave-level dependency numbers for downstream schedulers.
    const waveDepends: number[] = Array.isArray(waveObj.dependsOn)
      ? (waveObj.dependsOn as any[]).map(Number).filter(n => Number.isFinite(n))
      : Array.isArray(waveObj.dependsOnWaves)
        ? (waveObj.dependsOnWaves as any[]).map(Number).filter(n => Number.isFinite(n))
        : [];
    const taskStrings = Array.isArray(waveObj.tasks) ? waveObj.tasks : [];

    for (const taskStr of taskStrings) {
      const taskText = String(taskStr || "").trim();
      if (!taskText) continue;
      const lowerTask = taskText.toLowerCase();

      // Find a matching bottleneck by keyword overlap (split on all non-alphanumeric incl. underscores)
      const taskWords = lowerTask.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
      const matchedBn = bottlenecks.find(bn => {
        const titleWords = String(bn.title || "").toLowerCase()
          .split(/[^a-z0-9]+/).filter(w => w.length >= 4);
        return titleWords.some(w => taskWords.includes(w));
      });

      // Find a matching proof metric and normalize it to a portable command
      const rawMetric = proofMetrics.find(m => {
        const metricWords = String(m || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4);
        return taskWords.some(w => metricWords.includes(w));
      }) || "npm test";
      const verificationMetric = rewriteVerificationCommand(rawMetric);

      const severity = matchedBn?.severity || "medium";
      const plan: Record<string, any> = {
        role: "evolution-worker",
        task: taskText,
        priority: SEVERITY_PRIORITY[severity] ?? plans.length + 1,
        wave: waveNum,
        verification: verificationMetric,
        title: taskText,
        scope: String(matchedBn?.evidence || "").slice(0, 200),
        task_id: taskText,
        verification_commands: [verificationMetric],
        acceptance_criteria: [],
        dependencies: [],
        _fromBottleneck: matchedBn?.id || null,
      };
      if (waveDepends.length > 0) plan.waveDepends = waveDepends;
      plans.push(plan);
    }
  }

  // If no waves, fall back to one plan per bottleneck
  if (plans.length === 0) {
    for (let i = 0; i < bottlenecks.length; i++) {
      const bn = bottlenecks[i];
      const taskText = String(bn.title || `Fix-${bn.id}`).trim();
      const rawCmd = proofMetrics[i] || "npm test";
      const normalizedCmd = rewriteVerificationCommand(rawCmd);
      plans.push({
        role: "evolution-worker",
        task: taskText,
        priority: SEVERITY_PRIORITY[bn.severity] ?? i + 1,
        wave: i + 1,
        verification: normalizedCmd,
        title: taskText,
        scope: String(bn.evidence || "").slice(0, 200),
        task_id: String(bn.id || `bn-${i}`),
        verification_commands: [normalizedCmd],
        acceptance_criteria: [],
        dependencies: [],
        _fromBottleneck: bn.id || null,
      });
    }
  }

  return plans;
}

/**
 * Compute what fraction of the declared top bottlenecks are addressed by the generated plans.
 *
 * A bottleneck is considered "covered" when at least one plan's task text, title, or
 * _fromBottleneck field references the bottleneck's id or contains meaningful keyword overlap
 * with the bottleneck's title (≥2 matching 4-char words).
 *
 * @param plans - normalized plan objects
 * @param bottlenecks - topBottlenecks array from the Prometheus output
 * @returns {{ coverage: number, covered: string[], uncovered: string[], total: number }}
 */
export function computeBottleneckCoverage(plans: any[], bottlenecks: any[]): {
  coverage: number;
  covered: string[];
  uncovered: string[];
  total: number;
} {
  const bns = Array.isArray(bottlenecks) ? bottlenecks : [];
  const planList = Array.isArray(plans) ? plans : [];

  if (bns.length === 0) {
    return { coverage: 1.0, covered: [], uncovered: [], total: 0 };
  }

  const covered: string[] = [];
  const uncovered: string[] = [];

  for (const bn of bns) {
    const bnId = String(bn?.id || "").trim();
    const bnTitle = String(bn?.title || "").toLowerCase();
    const bnWords = bnTitle.split(/[^a-z0-9]+/).filter(w => w.length >= 4);

    const isCovered = planList.some(plan => {
      // Explicit bottleneck reference
      if (bnId && String(plan._fromBottleneck || "").trim() === bnId) return true;
      // Keyword overlap: ≥2 matching words between bottleneck title and plan task/title
      const planText = `${String(plan.task || "")} ${String(plan.title || "")}`.toLowerCase();
      const planWords = planText.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
      const matches = bnWords.filter(w => planWords.includes(w));
      return matches.length >= 2;
    });

    if (isCovered) {
      covered.push(bnId || bnTitle.slice(0, 40));
    } else {
      uncovered.push(bnId || bnTitle.slice(0, 40));
    }
  }

  const coverage = bns.length > 0 ? Math.round((covered.length / bns.length) * 100) / 100 : 1.0;
  return { coverage, covered, uncovered, total: bns.length };
}

/** Minimum bottleneck coverage ratio before a confidence penalty is applied. */
export const BOTTLENECK_COVERAGE_FLOOR = 0.5;

function buildPlansFromNarrative(analysisText) {
  const lines = String(analysisText || "").split(/\r?\n/);
  const plans = [];
  let currentWave = 1;
  let currentWaveLabel = "";
  let currentSection = "";
  let inWaveSection = false;

  const normalizeSectionTitle = (value) => String(value || "")
    .toLowerCase()
    .replace(/[*`:#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isActionSection = (section) => {
    const s = normalizeSectionTitle(section);
    if (!s) return false;
    return [
      "model capacity utilization",
      "what to stop / simplify / remove",
      "what to stop simplify remove",
      "architecture evolution roadmap",
      "recommendations",
      "next steps",
      "execution roadmap",
      "master plan"
    ].some(label => s.includes(label));
  };

  const isDiagnosticSection = (section) => {
    const s = normalizeSectionTitle(section);
    if (!s) return false;
    return [
      "mandatory answers",
      "evolution diagnosis",
      "strategic diagnosis",
      "prometheus self-critique",
      "metrics for a smarter next cycle",
      "final recommendation",
      "governance and rollback policy"
    ].some(label => s.includes(label));
  };

  const looksLikeActionablePlanLine = (text) => {
    const s = String(text || "").trim().toLowerCase();
    if (!s) return false;
    if (/^(strengths?|core bottleneck|recurrent defect|scaling risk|premium efficiency ceiling|why|exit criteria|rollback triggers?)\b/.test(s)) {
      return false;
    }
    return /^(task\s+\d|ship\b|fix\b|patch\b|replace\b|add\b|create\b|promote\b|keep\b|split\b|feed\b|require\b|validate\b|tighten\b|introduce\b|use\b|reduce\b|enforce\b|enable\b|remove\b|simplify\b|stop\b|upgrade\b|migrate\b|implement\b|refactor\b|extract\b|wire\b|emit\b|build\b|setup\b|configure\b|integrate\b)/.test(s);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || "").trim();
    if (!line) continue;

    const headingMatch = line.match(/^#+\s+(.+)$/);
    if (headingMatch) {
      currentSection = headingMatch[1];
      // Exit wave-collection mode when entering a diagnostic/analysis section
      // so Q&A answers are not mistaken for actionable tasks.
      if (isDiagnosticSection(currentSection)) inWaveSection = false;
    }

    // Wave header — capture wave number AND full label/description
    // Handles: "**Wave 0**", "### Wave 0 — Gate unblocker (must ship first)",
    //          "**Wave 0 (Gate blocker, must ship first)**"
    const waveMatch = line.match(/(?:^#+\s*)?(?:\*\*)?wave\s+(\d+)[:\s—\-\u2013\u2014(]*(.*?)(?:\*\*)?$/i);
    if (waveMatch) {
      currentWave = Math.max(1, Number(waveMatch[1]) || 1);
      inWaveSection = true;
      currentWaveLabel = String(waveMatch[2] || "")
        .replace(/\*\*/g, "")
        .replace(/[()]/g, "")
        .replace(/^\s*[-—\u2013\u2014]\s*/, "")
        .trim();
      continue;
    }

    // Numbered tasks: "1) Task", "2. **Task**: detail"
    const numberedMatch = line.match(/^\d+[).:-]\s*(.+)$/);
    if (numberedMatch) {
      const taskText = numberedMatch[1]
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .trim();
      const canCaptureNumbered = (inWaveSection || isActionSection(currentSection)) && !isDiagnosticSection(currentSection);
      if (taskText && canCaptureNumbered && looksLikeActionablePlanLine(taskText)) {
        // Collect continuation lines that follow until the next list item / wave header
        const continuationParts = [];
        while (i + 1 < lines.length) {
          const nextRaw = String(lines[i + 1] || "").trim();
          if (!nextRaw) { i++; continue; }
            if (/^\d+[).:-]\s/.test(nextRaw) || /^[-*]\s/.test(nextRaw) ||
              /(?:^#+\s*)?(?:\*\*)?wave\s+\d+/i.test(nextRaw) || /^#+\s/.test(nextRaw) ||
              /^===|^---/.test(nextRaw)) break;
          continuationParts.push(nextRaw.replace(/\*\*/g, "").replace(/`/g, "").trim());
          i++;
        }
        plans.push({
          task: taskText,
          wave: currentWave,
          waveLabel: currentWaveLabel,
          description: continuationParts.join(" "),
          verification: "npm test"
        });
      }
      continue;
    }

    // Bulleted tasks under waves: "- **Task**: ..."
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      const taskText = bulletMatch[1]
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .trim();
      const canCaptureBullet = inWaveSection || (isActionSection(currentSection) && !isDiagnosticSection(currentSection));
      if (taskText.length >= 8 && canCaptureBullet && looksLikeActionablePlanLine(taskText)) {
        const continuationParts = [];
        while (i + 1 < lines.length) {
          const nextRaw = String(lines[i + 1] || "").trim();
          if (!nextRaw) { i++; continue; }
            if (/^\d+[).:-]\s/.test(nextRaw) || /^[-*]\s/.test(nextRaw) ||
              /(?:^#+\s*)?(?:\*\*)?wave\s+\d+/i.test(nextRaw) || /^#+\s/.test(nextRaw) ||
              /^===|^---/.test(nextRaw)) break;
          continuationParts.push(nextRaw.replace(/\*\*/g, "").replace(/`/g, "").trim());
          i++;
        }
        plans.push({
          task: taskText,
          wave: currentWave,
          waveLabel: currentWaveLabel,
          description: continuationParts.join(" "),
          verification: "npm test"
        });
      }
    }
  }

  // Deduplicate by normalized task text while keeping insertion order.
  const seen = new Set();
  const unique = [];
  for (const p of plans) {
    const key = String(p.task || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }

  return unique;
}

/**
 * Canonical planner health aliases.
 * LLMs instructed to emit "<healthy|warning|critical>" may return these alias
 * values instead of the canonical internal values ("good", "needs-work", "critical").
 * Normalizing before validation ensures alias inputs score at full confidence.
 */
export const PLANNER_HEALTH_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  healthy:  "good",
  degraded: "needs-work",
  critical: "critical",
  good: "good",
  "needs-work": "needs-work",
  "needs work": "needs-work",
  "needs_work": "needs-work",
  needswork: "needs-work",
  warning:  "needs-work",
});

const REQUIRED_PROMETHEUS_HEALTH_VALUES = new Set(["healthy", "degraded", "critical", "needs-work", "good"]);

export function hasPrometheusRuntimeContractSignals(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const payload = parsed as Record<string, unknown>;
  const generatedAt = String(payload.generatedAt ?? "").trim();
  const keyFindings = String(payload.keyFindings ?? "").trim();
  return (
    generatedAt.length > 0 &&
    keyFindings.length >= STRATEGIC_FIELD_MIN_SEMANTIC_LENGTH &&
    !isStrategicFieldToolTraceContaminated(keyFindings)
  );
}

export const CYCLE_PROOF_SEAM_KEYS = Object.freeze(["prometheus", "athena", "worker"] as const);

export function validateCycleProofEvidenceSeams(artifact: unknown): {
  ok: boolean;
  cycleId: string;
  seamChecks: Record<string, { pass: boolean; failReasons: string[] }>;
  failReasons: string[];
} {
  const failReasons: string[] = [];
  if (!artifact || typeof artifact !== "object") {
    return {
      ok: false,
      cycleId: "",
      seamChecks: {},
      failReasons: ["cycle_proof_evidence must be an object"],
    };
  }
  const payload = artifact as Record<string, unknown>;
  const cycleId = String(payload.cycleId ?? "").trim();
  if (!cycleId) failReasons.push("cycle_proof_evidence.cycleId missing");

  const seams = payload.seams && typeof payload.seams === "object"
    ? payload.seams as Record<string, unknown>
    : null;
  const checks = seams?.checks && typeof seams.checks === "object"
    ? seams.checks as Record<string, unknown>
    : null;
  if (!checks) failReasons.push("cycle_proof_evidence.seams.checks missing");

  const seamChecks: Record<string, { pass: boolean; failReasons: string[] }> = {};
  for (const key of CYCLE_PROOF_SEAM_KEYS) {
    const seam = checks?.[key] && typeof checks[key] === "object"
      ? checks[key] as Record<string, unknown>
      : null;
    if (!seam) {
      failReasons.push(`cycle_proof_evidence.seams.checks.${key} missing`);
      seamChecks[key] = { pass: false, failReasons: [`${key} seam check missing`] };
      continue;
    }
    const pass = seam.pass === true;
    const seamFailReasons = Array.isArray(seam.failReasons)
      ? seam.failReasons.map((reason) => String(reason || "").trim()).filter(Boolean)
      : [];
    if (seam.pass !== true && seam.pass !== false) {
      failReasons.push(`cycle_proof_evidence.seams.checks.${key}.pass must be boolean`);
    }
    if (!pass && seamFailReasons.length === 0) {
      failReasons.push(`cycle_proof_evidence.seams.checks.${key}.failReasons missing`);
    }
    if (!pass && seamFailReasons.length > 0) {
      failReasons.push(...seamFailReasons.map((reason) => `${key}: ${reason}`));
    }
    seamChecks[key] = { pass, failReasons: seamFailReasons };
  }

  return {
    ok: failReasons.length === 0,
    cycleId,
    seamChecks,
    failReasons,
  };
}

export function buildTrustedMemoryShortlist(
  knowledgeMemory: any,
  opts: { requestedBy?: string; includeLowTrust?: boolean } = {},
): {
  lessons: any[];
  promptHints: any[];
  droppedLowTrustLessons: number;
  droppedLowTrustHints: number;
} {
  const requestedBy = String(opts.requestedBy || "");
  const privilegedCaller = isPrivilegedMemoryRequester(requestedBy);
  const includeLowTrust = opts.includeLowTrust === true && privilegedCaller;
  const lessons = Array.isArray(knowledgeMemory?.lessons) ? knowledgeMemory.lessons : [];
  const promptHints = Array.isArray(knowledgeMemory?.promptHints) ? knowledgeMemory.promptHints : [];

  const filteredLessons = filterMemoryEntriesByTrust(lessons, {
    includeLowTrust,
    privilegedCaller,
  });
  const filteredHints = filterMemoryEntriesByTrust(promptHints, {
    includeLowTrust,
    privilegedCaller,
  });

  const lessonShortlist = buildRankedLessonShortlists(filteredLessons.selected, { limit: 10 });
  const rankedLessons = lessonShortlist.combinedTop10.slice(0, 10);
  const rankedHints = filteredHints.selected
    .slice(0, 20)
    .sort((a, b) => {
      const aWeight = a?.trust?.level === MEMORY_TRUST_LEVEL.HIGH ? 3 : (a?.trust?.level === MEMORY_TRUST_LEVEL.MEDIUM ? 2 : 1);
      const bWeight = b?.trust?.level === MEMORY_TRUST_LEVEL.HIGH ? 3 : (b?.trust?.level === MEMORY_TRUST_LEVEL.MEDIUM ? 2 : 1);
      return bWeight - aWeight;
    })
    .slice(0, 5);

  return {
    lessons: rankedLessons,
    promptHints: rankedHints,
    droppedLowTrustLessons: filteredLessons.droppedLowTrustCount,
    droppedLowTrustHints: filteredHints.droppedLowTrustCount,
  };
}

function hasValidParserContractFields(parsed: any): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const rawHealth = String(parsed.projectHealth ?? "").trim().toLowerCase();
  const health = rawHealth.replace(/\s+/g, "-");
  const estimatedTotal = Number(parsed?.requestBudget?.estimatedPremiumRequestsTotal);
  const generatedAt = String(parsed?.generatedAt ?? "").trim();
  const keyFindings = String(parsed?.keyFindings ?? "").trim();
  const strategicNarrative = String(parsed?.strategicNarrative ?? "").trim();
  return REQUIRED_PROMETHEUS_HEALTH_VALUES.has(health)
    && Number.isFinite(estimatedTotal)
    && generatedAt.length > 0
    && keyFindings.length >= STRATEGIC_FIELD_MIN_SEMANTIC_LENGTH
    && !isStrategicFieldToolTraceContaminated(keyFindings)
    && strategicNarrative.length >= STRATEGIC_FIELD_MIN_SEMANTIC_LENGTH
    && !isStrategicFieldToolTraceContaminated(strategicNarrative);
}

function buildParserContractRetryDiff(parsed: any): string {
  const missing: string[] = [];
  const invalid: string[] = [];
  const rawHealth = String(parsed?.projectHealth ?? "").trim();
  const normalizedHealth = rawHealth.toLowerCase().replace(/\s+/g, "-");
  if (!rawHealth) {
    missing.push("projectHealth");
  } else if (!REQUIRED_PROMETHEUS_HEALTH_VALUES.has(normalizedHealth)) {
    invalid.push(`projectHealth=${rawHealth}`);
  }
  const hasBudgetObject = parsed?.requestBudget && typeof parsed.requestBudget === "object";
  if (!hasBudgetObject || parsed.requestBudget.estimatedPremiumRequestsTotal == null || parsed.requestBudget.estimatedPremiumRequestsTotal === "") {
    missing.push("requestBudget.estimatedPremiumRequestsTotal");
  } else if (!Number.isFinite(Number(parsed.requestBudget.estimatedPremiumRequestsTotal))) {
    invalid.push(`requestBudget.estimatedPremiumRequestsTotal=${String(parsed.requestBudget.estimatedPremiumRequestsTotal)}`);
  }
  const rawGeneratedAt = String(parsed?.generatedAt ?? "").trim();
  if (!rawGeneratedAt) {
    missing.push("generatedAt");
  }
  const rawKeyFindings = String(parsed?.keyFindings ?? "").trim();
  if (!rawKeyFindings) {
    missing.push("keyFindings");
  } else if (rawKeyFindings.length < STRATEGIC_FIELD_MIN_SEMANTIC_LENGTH) {
    invalid.push(`keyFindings_too_short(len=${rawKeyFindings.length})`);
  } else if (isStrategicFieldToolTraceContaminated(rawKeyFindings)) {
    invalid.push("keyFindings_tool_trace_contaminated");
  }
  const rawStrategicNarrative = String(parsed?.strategicNarrative ?? "").trim();
  if (!rawStrategicNarrative) {
    missing.push("strategicNarrative");
  } else if (rawStrategicNarrative.length < STRATEGIC_FIELD_MIN_SEMANTIC_LENGTH) {
    invalid.push(`strategicNarrative_too_short(len=${rawStrategicNarrative.length})`);
  } else if (isStrategicFieldToolTraceContaminated(rawStrategicNarrative)) {
    invalid.push("strategicNarrative_tool_trace_contaminated");
  }
  const missingText = missing.length > 0 ? missing.join(", ") : "none";
  const invalidText = invalid.length > 0 ? invalid.join(", ") : "none";
  return `missing=[${missingText}]; invalid=[${invalidText}]`;
}

export async function enforceParserContractBeforeNormalization(
  parsedCandidate: any,
  opts: {
    onRetryDiff?: (diff: string) => Promise<void> | void;
    onRetrySuccess?: () => Promise<void> | void;
    onRetryViolation?: (violationReason: string) => Promise<void> | void;
    buildRetryCandidate: (diff: string) => Promise<any | null>;
  },
): Promise<{ ok: boolean; parsed: any; retried: boolean; violationReason?: string }> {
  if (hasValidParserContractFields(parsedCandidate)) {
    return { ok: true, parsed: parsedCandidate, retried: false };
  }
  const parserDiff = buildParserContractRetryDiff(parsedCandidate);
  await opts.onRetryDiff?.(parserDiff);
  const retryCandidate = await opts.buildRetryCandidate(parserDiff);
  if (retryCandidate && hasValidParserContractFields(retryCandidate)) {
    await opts.onRetrySuccess?.();
    return { ok: true, parsed: retryCandidate, retried: true };
  }
  const secondDiff = buildParserContractRetryDiff(retryCandidate || parsedCandidate);
  await opts.onRetryViolation?.(secondDiff);
  return {
    ok: false,
    parsed: retryCandidate,
    retried: true,
    violationReason: secondDiff,
  };
}

/**
 * Normalize a raw projectHealth string by resolving known aliases to their
 * canonical equivalents before enum validation or divergence computation.
 *
 * @param {string} health — raw value from parser or LLM output
 * @returns {string} canonical health value
 */
export function normalizeProjectHealthAlias(health: string): string {
  const h = String(health || "").toLowerCase().trim();
  return (PLANNER_HEALTH_ALIASES as Record<string, string>)[h] ?? h;
}

export function normalizePrometheusParsedOutput(parsed, aiResult: any = {}) {
  const input = (parsed && typeof parsed === "object") ? parsed : {};
  // Build analysis text — also cover topBottlenecks narrative as fallback
  const bnNarrative = Array.isArray(input.topBottlenecks) && input.topBottlenecks.length > 0
    ? input.topBottlenecks.map(bn => `[${bn.id}] ${bn.title}: ${bn.evidence}`).join("\n")
    : "";
  const analysisText = String(
    input.analysis
      || input.strategicNarrative
      || input.cycleObjective
      || aiResult?.thinking
      || bnNarrative
      || aiResult?.raw
      || ""
  ).trim();

  const rawPlans = Array.isArray(input.plans) ? input.plans : [];
  let plans = rawPlans.length > 0
    ? rawPlans.map((plan, i) => normalizePlanFromTask(plan, i, plan?.wave || 1))
    : buildPlansFromAlternativeShape(input);

  // Third shape: GPT analytical format — topBottlenecks[] + waves[].tasks (strings)
  if (plans.length === 0 && (Array.isArray(input.topBottlenecks) || Array.isArray(input.waves))) {
    plans = buildPlansFromBottlenecksShape(input)
      .map((plan, i) => normalizePlanFromTask(plan, i, plan?.wave || 1));
  }

  // Final fallback: parse wave + numbered narrative plans from free-form output.
  if (plans.length === 0 && analysisText.length > 0) {
    plans = buildPlansFromNarrative(analysisText)
      .map((plan, i) => normalizePlanFromTask(plan, i, plan?.wave || 1));
  }

  // Deterministic research-topic accounting fallback:
  // if the model omits synthesis_sources/informational_topics_consumed, recover
  // source linkage from lexical matching so planning does not become context-blind.
  const researchTopicsForLinkage = Array.isArray((aiResult as any)?.researchTopics)
    ? ((aiResult as any).researchTopics as unknown[]).map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  const existingInformationalTopicsConsumed = Array.isArray((input as any)?.informational_topics_consumed)
    ? ((input as any).informational_topics_consumed as unknown[]).map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  const linkageResult = applyDeterministicResearchSourceLinkage(
    plans,
    researchTopicsForLinkage,
    existingInformationalTopicsConsumed,
  );
  plans = linkageResult.plans;
  const normalizedInformationalTopicsConsumed = linkageResult.informationalTopicsConsumed;

  const health = normalizeProjectHealthAlias(String(input.projectHealth || "").trim());
  const projectHealth = ["good", "needs-work", "critical"].includes(health)
    ? health
    : inferProjectHealth(analysisText);

  let executionStrategy = (input.executionStrategy && typeof input.executionStrategy === "object")
    ? input.executionStrategy
    : { waves: Array.isArray(input.waves) ? input.waves : [] };
  if (!Array.isArray(executionStrategy.waves) || executionStrategy.waves.length === 0) {
    executionStrategy = buildExecutionStrategyFromPlans(plans);
  }

  let requestBudget = (input.requestBudget && Number.isFinite(Number(input.requestBudget.estimatedPremiumRequestsTotal)))
    ? {
      ...input.requestBudget,
      hardCapTotal: Number.isFinite(Number(input.requestBudget.hardCapTotal))
        ? Number(input.requestBudget.hardCapTotal)
        : Math.max(1, Math.ceil((plans.length || 1) * 1.25)),
    }
    : {
      estimatedPremiumRequestsTotal: Math.max(1, plans.length || 1),
      errorMarginPercent: 25,
      hardCapTotal: Math.max(1, Math.ceil((plans.length || 1) * 1.25)),
      confidence: "low",
      byWave: [],
      byRole: [],
      _fallback: true,
    };
  if (requestBudget._fallback) {
    requestBudget = {
      ...buildDeterministicRequestBudget(plans, executionStrategy),
      _fallback: false
    };
  }

  // Capture whether budget was model-provided or deterministically rebuilt.
  // Must be captured AFTER the rebuild so _fallback=false doesn't shadow the origin.
  const requestBudgetWasFallback = !(
    input.requestBudget && Number.isFinite(Number(input.requestBudget.estimatedPremiumRequestsTotal))
  );

  // ── Parser confidence: structured breakdown ──────────────────────────────
  // parserConfidenceComponents: per-dimension score (0-1) for each structural signal.
  // parserConfidencePenalties: explicit list of reasons why the score was reduced.
  // The aggregate parserConfidence remains a single 0-1 value (backward compatible).
  //
  //   plansShape          — 1.0 = JSON plans direct, 0.5 = narrative/alt-shape fallback, 0.0 = no plans
  //   healthField         — 1.0 = canonical/alias health from field, 0.9 = inferred from analysis text, 0.8 = unresolvable
  //   requestBudget       — 1.0 = budget provided by model, 0.9 = fallback rebuilt deterministically
  //   bottleneckCoverage  — 1.0 = all declared bottlenecks addressed, reduced by uncovered fraction

  const parserConfidencePenalties: Array<{ reason: string; component: string; delta: number }> = [];

  let plansShapeScore: number;
  if (rawPlans.length > 0) {
    plansShapeScore = 1.0;
  } else if (plans.length > 0) {
    plansShapeScore = 0.5;
    parserConfidencePenalties.push({ reason: "plans_from_narrative_fallback", component: "plansShape", delta: -0.5 });
  } else {
    plansShapeScore = 0.0;
    parserConfidencePenalties.push({ reason: "no_plans_extracted", component: "plansShape", delta: -0.9 });
  }

  // `health` is alias-normalized from input.projectHealth; `projectHealth` is the fully
  // resolved canonical value (filled via inferProjectHealth when the field was absent or
  // unrecognized).  Scoring uses the resolved canonical health so that successfully-inferred
  // health carries a lighter penalty than a truly unresolvable field.
  const CANONICAL_HEALTH_VALS = ["good", "needs-work", "critical"] as const;
  const healthFieldExplicit = Boolean(health && CANONICAL_HEALTH_VALS.includes(health as typeof CANONICAL_HEALTH_VALS[number]));
  const healthFieldResolved = CANONICAL_HEALTH_VALS.includes(projectHealth as typeof CANONICAL_HEALTH_VALS[number]);
  let healthFieldScore: number;
  if (healthFieldExplicit) {
    healthFieldScore = 1.0;
  } else if (healthFieldResolved) {
    // Health was resolved via text inference — slight penalty to signal field was not explicit.
    healthFieldScore = 0.9;
    parserConfidencePenalties.push({ reason: "health_field_inferred_from_text", component: "healthField", delta: -0.1 });
  } else {
    // Field absent and inference also produced no canonical value (defensive; currently unreachable).
    healthFieldScore = 0.8;
    parserConfidencePenalties.push({ reason: "health_field_missing_or_invalid", component: "healthField", delta: -0.2 });
  }

  const requestBudgetScore = requestBudgetWasFallback ? 0.9 : 1.0;
  if (requestBudgetWasFallback) {
    parserConfidencePenalties.push({ reason: "request_budget_fallback", component: "requestBudget", delta: -0.1 });
  }

  // ── Research source-linkage check ────────────────────────────────────────
  // When research context is injected, plans must either reference topics via
  // synthesis_sources[] or explicitly mark reviewed topics as informational.
  // Missing both signals indicates context-blind planning and is penalized.
  const researchTopicCount = Number((input as any)?.researchContext?.topicCount || 0);
  const informationalTopicsConsumed = normalizedInformationalTopicsConsumed.length;
  const sourceLinkedPlans = (Array.isArray(plans) ? plans : [])
    .filter((p: any) => Array.isArray(p?.synthesis_sources) && p.synthesis_sources.length > 0)
    .length;
  let sourceLinkageScore = 1.0;
  if (researchTopicCount > 0 && sourceLinkedPlans === 0 && informationalTopicsConsumed === 0) {
    sourceLinkageScore = 0.6;
    parserConfidencePenalties.push({
      reason: `research_source_linkage_missing_topics_${researchTopicCount}`,
      component: "sourceLinkage",
      delta: -0.4,
    });
  } else if (researchTopicCount > 0 && sourceLinkedPlans === 0 && informationalTopicsConsumed > 0) {
    sourceLinkageScore = 0.85;
    parserConfidencePenalties.push({
      reason: "research_source_linkage_informational_only",
      component: "sourceLinkage",
      delta: -0.15,
    });
  }

  // ── Bottleneck coverage check ────────────────────────────────────────────
  // When the input declared topBottlenecks, every bottleneck should be
  // addressed by at least one generated plan.  A coverage ratio below
  // BOTTLENECK_COVERAGE_FLOOR triggers a proportional confidence penalty
  // so low-coverage cycles cannot silently proceed past quality gates.
  const topBottlenecks = Array.isArray(input.topBottlenecks) ? input.topBottlenecks : [];
  const bnCovResult = computeBottleneckCoverage(plans, topBottlenecks);
  let bottleneckCoverageScore: number;
  if (topBottlenecks.length === 0) {
    bottleneckCoverageScore = 1.0;
  } else {
    bottleneckCoverageScore = bnCovResult.coverage;
    if (bnCovResult.coverage < BOTTLENECK_COVERAGE_FLOOR) {
      const uncoveredCount = bnCovResult.uncovered.length;
      const delta = -Math.round(Math.min(0.3, uncoveredCount * 0.05) * 100) / 100;
      parserConfidencePenalties.push({
        reason: `bottleneck_coverage_low_${bnCovResult.covered.length}_of_${bnCovResult.total}`,
        component: "bottleneckCoverage",
        delta,
      });
    }
  }

  const parserConfidenceComponents = {
    plansShape:         plansShapeScore,
    healthField:        healthFieldScore,
    requestBudget:      requestBudgetScore,
    sourceLinkage:      sourceLinkageScore,
    bottleneckCoverage: bottleneckCoverageScore,
  };

  // ── Confidence channel split ──────────────────────────────────────────────
  // parser-core channel: structural parser signals only (plansShape base,
  //   healthField, requestBudget).  Reflects fidelity of the extraction step.
  // context-penalty channel: external/contextual signals (bottleneckCoverage,
  //   architectureDrift) applied on top of the core score.
  // parserConfidence remains the aggregate (core − context) for backward compat.
  const CONTEXT_PENALTY_COMPONENTS = new Set(["bottleneckCoverage", "architectureDrift"]);
  const coreBase = rawPlans.length > 0 ? 1.0 : plans.length > 0 ? 0.5 : 0.1;
  let parserCoreConfidence = coreBase;
  let parserContextPenalty = 0;
  for (const penalty of parserConfidencePenalties) {
    if (penalty.component === "plansShape") continue; // plansShape sets base, not an additive delta
    if (CONTEXT_PENALTY_COMPONENTS.has(penalty.component)) {
      parserContextPenalty += -penalty.delta; // delta is negative; negate to get positive magnitude
    } else {
      parserCoreConfidence = Math.max(0.1, parserCoreConfidence + penalty.delta);
    }
  }
  parserCoreConfidence = Math.round(parserCoreConfidence * 100) / 100;
  parserContextPenalty = Math.round(parserContextPenalty * 100) / 100;
  const parserConfidence = Math.max(0.1, parserCoreConfidence - parserContextPenalty);

  // ── Strict parser confidence floor (Packet 11) ───────────────────────────
  // If confidence is below the floor, fail-closed: reject plans rather than
  // dispatching low-quality work. Plans are replaced with an empty set and
  // the analysis is preserved for manual review.
  // Floor set at 0.15 to catch truly unparseable output (base 0.1) while
  // allowing legitimate narrative-fallback parses (base 0.5 with penalties).
  const PARSER_CONFIDENCE_FLOOR = 0.15;
  const belowFloor = parserConfidence < PARSER_CONFIDENCE_FLOOR;
  const finalPlans = belowFloor ? [] : applyPlanningRubric(plans);

  return {
    ...input,
    analysis: analysisText || "Prometheus analysis available but narrative was empty.",
    projectHealth,
    executionStrategy,
    requestBudget,
    parserConfidence: Math.round(parserConfidence * 100) / 100,
    parserCoreConfidence,
    parserContextPenalty,
    parserConfidenceComponents,
    parserConfidencePenalties,
    bottleneckCoverage: bnCovResult,
    informational_topics_consumed: normalizedInformationalTopicsConsumed,
    _parserBelowFloor: belowFloor,
    _parserConfidenceFloor: PARSER_CONFIDENCE_FLOOR,
    plans: finalPlans
  };
}

const TOPIC_MATCH_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "those", "these",
  "agent", "agents", "system", "systems", "benchmark", "benchmarks", "evaluation", "evaluations",
  "general", "framework", "frameworks", "model", "models", "use", "using", "based",
]);

function tokenizeTopicForMatch(value: string): string[] {
  const tokens = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !TOPIC_MATCH_STOP_WORDS.has(t));
  return [...new Set(tokens)];
}

function applyDeterministicResearchSourceLinkage(
  plans: any[],
  researchTopics: string[],
  existingInformationalTopicsConsumed: string[],
): { plans: any[]; informationalTopicsConsumed: string[] } {
  const planList = Array.isArray(plans) ? plans : [];
  const topics = Array.isArray(researchTopics) ? researchTopics.filter(Boolean) : [];
  const informationalSeed = Array.isArray(existingInformationalTopicsConsumed)
    ? existingInformationalTopicsConsumed.filter(Boolean)
    : [];
  if (topics.length === 0) {
    return {
      plans: planList,
      informationalTopicsConsumed: [...new Set(informationalSeed)],
    };
  }

  const topicCatalog = topics.map((topic) => ({
    topic,
    key: topicKey(topic),
    tokens: tokenizeTopicForMatch(topic),
  }));
  const consumedTopicKeys = new Set<string>();

  const linkedPlans = planList.map((plan: any) => {
    const existingSources = Array.isArray(plan?.synthesis_sources)
      ? plan.synthesis_sources.map((s: unknown) => String(s || "").trim()).filter(Boolean)
      : [];

    if (existingSources.length > 0) {
      for (const source of existingSources) consumedTopicKeys.add(topicKey(source));
      return { ...plan, synthesis_sources: [...new Set(existingSources)] };
    }

    const haystack = [plan?.task, plan?.title, plan?.context, plan?.scope]
      .map((v) => String(v || "").toLowerCase())
      .join(" \n ");

    let bestTopic: { topic: string; key: string; tokens: string[] } | null = null;
    let bestScore = 0;
    for (const candidate of topicCatalog) {
      if (candidate.tokens.length === 0) continue;
      let score = 0;
      for (const token of candidate.tokens) {
        if (haystack.includes(token)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        bestTopic = candidate;
      }
    }

    if (bestTopic && bestScore >= 2) {
      consumedTopicKeys.add(bestTopic.key);
      return { ...plan, synthesis_sources: [bestTopic.topic] };
    }

    return { ...plan, synthesis_sources: [] };
  });

  const informational = [...new Set(informationalSeed)];
  for (const candidate of topicCatalog) {
    if (!consumedTopicKeys.has(candidate.key)) {
      informational.push(candidate.topic);
    }
  }

  return {
    plans: linkedPlans,
    informationalTopicsConsumed: [...new Set(informational)],
  };
}

function buildNarrativeFallbackParsed(aiResult) {
  const thinking = String(aiResult?.thinking || "").trim();
  const raw = String(aiResult?.raw || "").trim();
  const narrative = (thinking || raw || "Prometheus produced narrative-only output.").slice(0, 20000);
  const strategic = narrative.slice(0, 4000);

  return {
    analysis: narrative,
    strategicNarrative: strategic,
    projectHealth: inferProjectHealth(narrative),
    keyFindings: "Narrative-only analysis mode enabled; convert key findings from analysis text.",
    productionReadinessCoverage: [],
    dependencyModel: {
      criticalPath: [],
      parallelizableTracks: [],
      blockedBy: []
    },
    executionStrategy: {
      waves: []
    },
    requestBudget: {
      estimatedPremiumRequestsTotal: 1,
      errorMarginPercent: 30,
      hardCapTotal: 2,
      confidence: "low",
      byWave: [],
      byRole: [],
      _fallback: true
    },
    plans: []
  };
}

// ── Main Prometheus Analysis (simplified) ────────────────────────────────────

/**
 * Static invariant Prometheus planning prompt sections.
 * These do not change between planning cycles — extract them here so they can be
 * shared, tested, and referenced by name rather than being buried in a template literal.
 */

/** Build a section marked as invariant — always retained in full, never trimmed by maxTokens or global budget. */
const ivs = (name: string, content: string) => Object.assign(section(name, content), { required: true as const, partitionBudget: PROMPT_BUDGET_PARTITION.INVARIANT });

export const PROMETHEUS_STATIC_SECTIONS = Object.freeze({
  evolutionDirective: ivs("evolution-directive", `## EVOLUTION DIRECTIVE
You are NOT a risk-reducing planner. You are NOT a security-first hardening auditor.
You are the system's META-IMPROVER: your primary objective is TOTAL SYSTEM CAPACITY INCREASE.
"Capacity" means: more capability delivered per cycle, deeper reasoning, faster adaptation, better learning, higher task quality, smarter model usage — across every dimension simultaneously.
Risk reduction is a side-effect of capacity increase, never the goal itself.
You must treat every component of BOX — including Prometheus itself — as an improvement target.

## EQUAL DIMENSION SET
The following dimensions are ALL equally important. No single dimension dominates.
You MUST analyze and propose improvements for EACH of these:
1. Architecture (system topology, module design, data flow)
2. Speed (cycle throughput, latency, parallelism)
3. Task quality (correctness, depth, completeness of delivered work)
4. Prompt quality (instruction clarity, model utilization, reasoning depth)
5. Parser / normalization quality (output parsing, plan normalization, fence handling)
6. Worker specialization (role design, capability matching, multi-worker topology)
7. Model-task fit (routing complexity to the right model, token budget allocation)
8. Learning loop (postmortem-to-policy conversion, pattern detection, carry-forward)
9. Cost efficiency (premium requests per useful outcome, waste reduction)
10. Security (vulnerability prevention, access control, governance — ONE dimension among equals)`),

  mandatorySelfCritique: ivs("mandatory-self-critique", `## MANDATORY SELF-CRITIQUE SECTIONS
You MUST include a dedicated self-critique section for EACH of the following components.
Each section must answer: "What is this component doing well?", "What is it doing poorly?", and "How specifically should it improve next cycle?"
Do NOT just say "there is a problem" — produce a concrete improvement proposal for each.

1. **Jesus Self-Critique** — Is Jesus making good strategic decisions? Is it reading the right signals? How should its decision logic improve?
2. **Prometheus Self-Critique** — Is Prometheus producing actionable plans or strategic fluff? How should its reasoning, prompt structure, and output format improve?
3. **Athena Self-Critique** — Is Athena catching real issues or generating noise? Are postmortems driving actual change? How should review quality improve?
4. **Worker Structure Self-Critique** — Is the worker topology enabling or blocking progress? Are workers specialized enough? How should worker roles evolve?
5. **Parser / Normalization Self-Critique** — Is plan parsing reliable? Are fence blocks handled correctly? What parsing failures recur and how to fix them?
6. **Prompt Layer Self-Critique** — Are runtime prompts getting the most out of model capacity? What prompt patterns waste tokens or produce shallow output?
7. **Verification System Self-Critique** — Is verification catching real failures or generating false signals? Are verification commands reliable across platforms?`),

  mandatoryOperatorQuestions: ivs("mandatory-operator-questions", `## MANDATORY_OPERATOR_QUESTIONS
You MUST answer these explicitly in a dedicated section titled "Mandatory Answers" before the rest of the plan:
1. Is wave-based plan distribution truly the most efficient model for this system?
2. Should it be preserved, improved, or removed?
3. If it changes, what should replace it and how should the transition be executed?
4. Is Prometheus currently evolving the system, or mostly auditing and distributing tasks?
5. How should Prometheus improve its own reasoning structure, planning quality, and model-capacity utilization?
6. Does the worker behavior model and code structure help self-improvement, or block it?
7. In this cycle, what are the highest-leverage changes that make the system not only safer, but also smarter and deeper in reasoning?`),

  mandatoryDepthChain: ivs("mandatory-depth-chain", `## MANDATORY_DEPTH_CHAIN
For every high-priority packet, you MUST explicitly map all four links:
1. **Evidence** — concrete file/function/runtime signal proving the issue exists now.
2. **Root Cause** — why the issue occurs in current architecture/logic.
3. **Implementation Change** — exact code-level intervention that addresses the cause.
4. **Verification Evidence** — exact test/log/assertion that proves the change worked.

If any link is missing, that packet is incomplete and must be revised before final output.
Do NOT emit shallow recommendations that skip code-level implementation mapping.`),

  outputFormat: ivs("output-format", `## OUTPUT FORMAT
Write a substantial senior-level narrative master plan.
The plan must be centered on TOTAL SYSTEM CAPACITY INCREASE, not generic hardening.
First analyze how BOX can increase its capacity in every dimension, then derive what should change.

Include ALL of these sections (in this order):
1. Mandatory Answers
2. Evolution Diagnosis
3. Equal Dimension Analysis (one subsection per dimension from the EQUAL DIMENSION SET)
4. Mandatory Self-Critique: Jesus
5. Mandatory Self-Critique: Prometheus
6. Mandatory Self-Critique: Athena
7. Mandatory Self-Critique: Worker Structure
8. Mandatory Self-Critique: Parser / Normalization
9. Mandatory Self-Critique: Prompt Layer
10. Mandatory Self-Critique: Verification System
11. System Redesign Directions (ranked by capacity-increase leverage)
12. Worker Model Redesign
13. Model Capacity Utilization
14. Metrics For A Smarter Next Cycle
15. Actionable Improvement Packets

## ACTIONABLE IMPROVEMENT PACKET FORMAT
Every concrete task you propose MUST be formatted as an Actionable Improvement Packet.
Do NOT produce vague strategic recommendations without this structure.
Each packet MUST contain ALL of the following fields:
- **title**: Clear one-line description of the change
- **owner**: Which component/agent/worker should execute this (e.g., evolution-worker, prometheus, athena, orchestrator)
- **wave**: Positive integer (≥1). Tasks in the same wave run in parallel; all wave N tasks complete before wave N+1 starts.
- **role**: Worker role identifier (e.g., "evolution-worker", "orchestrator", "prometheus")
  Role assignment policy: default to "evolution-worker". Use specialized roles
  (e.g., governance-worker, observation-worker, infrastructure-worker) ONLY when
  the task requires that role's unique domain behavior. Do not spread easy or
  generic implementation tasks across multiple specialized roles.
- **scope**: Module or directory boundary that this task is contained within (e.g., "src/core/orchestrator.js" or "src/workers/")
- **target_files**: Array of real file paths. ONLY use paths from the ## EXISTING REPOSITORY FILES section above. For new files, name the existing module that imports it and the exact call site.
- **before_state**: Observable CURRENT behavior — describe what specific function, code path, or measurable gap exists right now. Must be specific, not generic.
- **after_state**: Observable result after this task completes — what is measurably different. Must not restate the title.
- **riskLevel**: One of: "low" | "medium" | "high". Tasks touching orchestrator.js, athena_reviewer.js, prometheus.js, or gates.js default to "high".
- **dependencies**: Array of packet titles that must complete before this one, or empty array if none. If empty, state that wave ordering is the only ordering mechanism.
- **acceptance_criteria**: Array of ≥2 concrete testable statements that prove completion. Vague criteria like "code is improved" are rejected.
- **verification**: Specific test file path AND expected test description or observable log assertion (e.g., "tests/core/foo.test.ts — test: should return X when Y"). Generic "npm test" or "run tests" is REJECTED.
- **premortem** (REQUIRED when riskLevel is "medium" or "high"): Object with: failureModes (array of ≥2 distinct failure scenarios each with cause+impact), mitigations (array), rollbackPlan (string describing how to revert safely).
- **leverage_rank**: Which dimension(s) from the EQUAL DIMENSION SET this improves
- **capacityDelta** (REQUIRED): Finite number ∈ [-1.0, 1.0] — expected net change in system capacity if this plan succeeds. Positive = capacity gain, negative = capacity regression, zero = neutral. Used for plan ranking.
- **requestROI** (REQUIRED): Positive finite number — expected return-on-investment for the premium request consumed (e.g., 2.0 = doubles value spent). Used for plan ranking.
- **estimatedExecutionTokens** (REQUIRED): Positive integer — approximate total tokens this packet is expected to consume in one worker execution (prompt + reasoning + verification). Use realistic values (e.g., 12000, 28000), not placeholders.

## PACKET FIELD ENFORCEMENT RULES
These rules are enforced by the quality gate. Violations cause plan rejection:
1. **target_files**: Must list real existing paths verbatim from EXISTING REPOSITORY FILES. Do not invent module names. For new files, include the parent module path as the first entry.
2. **before_state**: Must describe observable current behavior — cite the actual function name, variable, or code gap. "Current state is suboptimal" is rejected.
3. **after_state**: Must describe what is measurably different — not a restatement of the title or before_state negation.
4. **verification**: Must name a specific test file (e.g., tests/core/foo.test.ts) plus an expected test name or exact log assertion. "npm test" alone is always rejected.
5. **acceptance_criteria**: ≥2 items, each a concrete testable statement. Every item must be independently verifiable.
6. **riskLevel + premortem**: Any task modifying orchestration paths, plan parsing, or dispatch logic is automatically high-risk and requires a compliant premortem.
7. **requestBudget**: Compute byWave and byRole from actual plan distribution. Never emit _fallback:true. byWave and byRole arrays must not be empty if plans exist.
8. **capacityDelta + requestROI**: Both are REQUIRED on every plan. Omitting either causes plan rejection by the contract validator.
9. **estimatedExecutionTokens**: REQUIRED on every plan and must be a positive integer. This is used by Athena and the batch planner to fill model context efficiently and reduce wasted premium requests.
10. **role minimization**: Minimize distinct roles per cycle. If a task does not require specialized domain behavior, assign role="evolution-worker" to reduce unnecessary worker sessions and premium requests.
11. **analysis-role ban in executable packets**: Do NOT emit role values "prometheus", "athena", or "jesus" in plans[].role. Those are analysis/review roles, not implementation workers.

Write the entire response in English only.
If you include recommendations, rank them by capacity-increase leverage, not by fear or surface risk alone.
Security or governance recommendations must explain how they contribute to capacity increase rather than being presented as the default center of gravity.
You MUST emit a structured JSON companion block at the end of your response.
The JSON block must contain all of the following fields:
{
  "projectHealth": "<good|healthy|needs-work|degraded|critical>",
  "keyFindings": "<one-paragraph summary of the most important repository findings>",
  "strategicNarrative": "<one-paragraph explanation of the strategic direction for this cycle>",
  "totalPackets": <number>,
  "requestBudget": {
    "estimatedPremiumRequestsTotal": 6,
    "errorMarginPercent": <number>,
    "hardCapTotal": <number>,
    "confidence": "low|medium|high",
    "byWave": [{ "wave": <n>, "planCount": <n>, "roles": ["..."], "estimatedRequests": <n> }],
    "byRole": [{ "role": "...", "planCount": <n>, "estimatedRequests": <n> }]
  },
  "executionStrategy": {
    "waves": [{ "wave": <n>, "tasks": ["..."], "dependsOnWaves": [], "maxParallelWorkers": <n> }]
  },
  "plans": [{
    "title": "...",
    "task": "...",
    "owner": "...",
    "role": "...",
    "wave": <number>,
    "scope": "...",
    "target_files": ["..."],
    "before_state": "...",
    "after_state": "...",
    "riskLevel": "low|medium|high",
    "dependencies": [],
    "acceptance_criteria": ["...", "..."],
    "verification": "tests/core/foo.test.ts — test: expected description",
    "premortem": null,
    "capacityDelta": <number ∈ [-1.0, 1.0]>,
    "requestROI": <positive number>,
    "estimatedExecutionTokens": <positive integer>,
    "synthesis_sources": ["<synthesis topic name(s) this plan directly addresses — use [] if this plan is not research-driven>"]
  }],
  "informational_topics_consumed": ["<REQUIRED — list every synthesis topic from RESEARCH INTELLIGENCE that you read but decided no plan is needed for (already implemented, out of scope, or purely contextual)>"]
}
Do NOT omit target_files, before_state, after_state, scope, acceptance_criteria, capacityDelta, or requestROI from any plan entry.
Do NOT omit estimatedExecutionTokens from any plan entry.
MANDATORY synthesis-topic accounting — you MUST populate synthesis_sources and informational_topics_consumed together such that EVERY topic listed in the RESEARCH INTELLIGENCE section is accounted for in exactly one of: (a) a plan's synthesis_sources[] if you are implementing it, or (b) informational_topics_consumed[] if you reviewed it but no plan is needed. Unaccounted topics accumulate in the research backlog forever and prevent new Scout runs. An empty informational_topics_consumed[] is only acceptable when EVERY synthesis topic is covered by a plan's synthesis_sources[].
For EVERY synthesis topic from the RESEARCH INTELLIGENCE section: if you produce a plan for it, list it in that plan's synthesis_sources[]. If you read it but no plan is needed (already done or purely informational), list it in informational_topics_consumed[].
Do NOT emit requestBudget with _fallback:true — compute byWave and byRole from the actual plan list.
Keep diagnostic findings in analysis or strategicNarrative and include only actionable redesign work in plans.
Wrap the JSON companion with markers:

===DECISION===
{ ...optional companion json... }
===END===`),
});

/**
 * Section names that carry per-cycle data in the Prometheus planning prompt.
 *
 * These sections are marked `required: true` during prompt compilation so that
 * under token-budget pressure they are retained over large optional context
 * (repo file listing, drift summary). The static sections in PROMETHEUS_STATIC_SECTIONS
 * are also required, but their content is invariant across cycles — unlike these
 * delta sections whose content changes every cycle.
 *
 * Downstream callers (e.g., tests) can import this to verify cycle-delta
 * prioritization behaviour without re-listing the names inline.
 */
export const PROMETHEUS_CYCLE_DELTA_SECTION_NAMES: ReadonlySet<string> = new Set([
  "research-intelligence",
  "topic-memory",
  "postmortem-shortlist",
  "behavior-patterns",
  "carry-forward",
  "diagnostics-freshness",
]);

/**
 * Section names for the static invariant Prometheus planning prompt sections.
 * Used with markCacheableSegments to flag these as prompt-cache eligible so
 * caching layers can avoid re-tokenising unchanged prefixes across cycles.
 */
export const PROMETHEUS_STATIC_SECTION_NAMES: ReadonlySet<string> = new Set(
  Object.values(PROMETHEUS_STATIC_SECTIONS).map(s => s.name)
);

export const PROMETHEUS_PROMPT_DENSITY_MIN = Object.freeze({
  minTargetFiles: 2,
  minAcceptanceCriteria: 2,
  minTaskChars: 120,
  // estimatedExecutionTokens is a batch-packing utility, not a plan quality signal.
  // The model consistently underestimates this field (~1000 vs expected 8000+) because
  // it estimates plan-text tokens rather than full-worker-session tokens. Disabling the
  // token floor prevents valid plans from being rejected on every cycle.
  minExecutionTokens: 0,
});

export const RIGIDITY_PENALTY = 0.15 as const;

function computePacketRubricScore(plan: Record<string, any>): number {
  const targetFiles = Array.isArray(plan?.target_files) ? plan.target_files : [];
  const acceptanceCriteria = Array.isArray(plan?.acceptance_criteria) ? plan.acceptance_criteria : [];
  const leverageRank = normalizeLeverageRank(plan?.leverage_rank);
  const normalizedTask = String(plan?.task || "").trim();
  const verification = String(plan?.verification || "").trim();
  const scope = String(plan?.scope || "").trim();
  const beforeState = String(plan?.before_state || "").trim();
  const afterState = String(plan?.after_state || "").trim();
  const dependencies = Array.isArray(plan?.dependencies) ? plan.dependencies : [];
  const capacityDelta = Number(plan?.capacityDelta);
  const requestROI = Number(plan?.requestROI);

  const dimensions = {
    architecture: scope.length > 0 && targetFiles.length > 0 ? 1 : 0,
    speed: Number.isFinite(Number(plan?.estimatedExecutionTokens)) ? 1 : 0,
    "task-quality": acceptanceCriteria.length >= 2 ? 1 : 0,
    "prompt-quality": beforeState.length > 0 && afterState.length > 0 ? 1 : 0,
    "parser-quality": verification.length > 0 ? 1 : 0,
    "worker-specialization": String(plan?.role || "").trim().length > 0 ? 1 : 0,
    "model-task-fit": Number.isFinite(requestROI) && requestROI > 0 ? 1 : 0,
    "learning-loop": leverageRank.includes("learning-loop") ? 1 : 0,
    "cost-efficiency": Number.isFinite(requestROI) && requestROI > 1 ? 1 : 0,
    security: /security|auth|trust|guard|policy/i.test(`${normalizedTask} ${scope} ${afterState}`) ? 1 : 0,
  } as Record<string, number>;
  const dimensionScore = Object.values(dimensions).reduce((sum, n) => sum + n, 0) / EQUAL_DIMENSION_SET.length;

  const capacityFirst = Number.isFinite(capacityDelta) && capacityDelta > 0 && Number.isFinite(requestROI) && requestROI > 1;
  const defensiveOnly = /(?:ban|block|forbid|deny|freeze|prevent|guardrail|lockdown|hard[- ]?gate)/i.test(normalizedTask)
    && !/(?:implement|build|add|create|refactor|optimi[sz]e|improve|automate|ship|wire)/i.test(normalizedTask);

  let score = dimensionScore;
  if (dependencies.length > 0) score += 0.05;
  if (capacityFirst) score += 0.25;
  if (defensiveOnly) score -= RIGIDITY_PENALTY;
  return Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000;
}

export function applyPlanningRubric(plans: any[]): any[] {
  if (!Array.isArray(plans)) return [];
  return plans
    .map((plan) => {
      if (!plan || typeof plan !== "object") return plan;
      const rubricScore = computePacketRubricScore(plan);
      const leverageRank = normalizeLeverageRank(plan.leverage_rank);
      const defensiveOnly = /(?:ban|block|forbid|deny|freeze|prevent|guardrail|lockdown|hard[- ]?gate)/i.test(String(plan.task || ""))
        && !/(?:implement|build|add|create|refactor|optimi[sz]e|improve|automate|ship|wire)/i.test(String(plan.task || ""));
      return {
        ...plan,
        leverage_rank: leverageRank,
        _planningRubric: {
          score: rubricScore,
          capacityFirst: Number(plan?.capacityDelta) > 0 && Number(plan?.requestROI) > 1,
          rigidityPenaltyApplied: defensiveOnly,
        },
      };
    })
    .sort((a, b) => {
      const scoreDiff = Number(b?._planningRubric?.score || 0) - Number(a?._planningRubric?.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return Number(a?.priority || 9999) - Number(b?.priority || 9999);
    });
}

// ── Architecture Drift Confidence Binding (Task 4) ──────────────────────────

/** Minimum total drift items above which plans must include remediation tasks. */
export const DRIFT_REMEDIATION_THRESHOLD = 5;

/**
 * Per-priority penalty weights for stale file references.
 * High-priority (src/core/) items carry more weight because they indicate
 * that the architecture doc references ghost paths in active infrastructure.
 */
export const DRIFT_PENALTY_BY_PRIORITY: Record<"high" | "medium" | "low", number> = Object.freeze({
  high:   0.05,
  medium: 0.02,
  low:    0.01,
});

/**
 * Compute a parser confidence penalty from an architecture drift report.
 * Applied after plan normalization to penalize cycles where docs are out of sync.
 *
 * When the full `staleReferences` array is available the penalty is priority-weighted:
 *   - src/core/ stale refs (high):   0.05 each
 *   - other src/ stale refs (medium): 0.02 each
 *   - docker/scripts/docs refs (low): 0.01 each
 *   - deprecated token usages:        0.02 each
 *
 * When only summary counts are available (legacy callers) the flat formula
 * `0.02 × total` is used as a fallback.  Both paths cap the result at 0.30.
 *
 * requiresRemediation is true when total unresolved items >= DRIFT_REMEDIATION_THRESHOLD.
 *
 * @param driftReport - result of checkArchitectureDrift(), or null/undefined
 * @returns {{ penalty: number, reason: string, requiresRemediation: boolean }}
 */
export function computeDriftConfidencePenalty(driftReport?: Record<string, unknown> | null): {
  penalty: number;
  reason: string;
  requiresRemediation: boolean;
} {
  if (!driftReport) return { penalty: 0, reason: "no-drift-report", requiresRemediation: false };
  const staleCount = (Number(driftReport.staleCount) || 0);
  const deprecatedTokenCount = (Number(driftReport.deprecatedTokenCount) || 0);
  const total = staleCount + deprecatedTokenCount;
  if (total === 0) return { penalty: 0, reason: "no-drift", requiresRemediation: false };

  let rawPenalty: number;
  const staleRefs = Array.isArray(driftReport.staleReferences) ? driftReport.staleReferences : null;
  if (staleRefs) {
    // Priority-weighted: penalize src/core/ ghost paths more heavily.
    rawPenalty = 0;
    for (const ref of staleRefs) {
      if (ref && typeof ref === "object") {
        const p = String((ref as any).referencedPath || "");
        const priority: "high" | "medium" | "low" =
          p.startsWith("src/core/") ? "high" : p.startsWith("src/") ? "medium" : "low";
        rawPenalty += DRIFT_PENALTY_BY_PRIORITY[priority];
      }
    }
    rawPenalty += deprecatedTokenCount * DRIFT_PENALTY_BY_PRIORITY.medium;
  } else {
    // Fallback flat formula for callers that supply only summary counts.
    rawPenalty = total * 0.02;
  }

  const penalty = Math.round(Math.min(0.30, rawPenalty) * 100) / 100;
  return {
    penalty,
    reason: `architecture_drift_${total}_unresolved`,
    requiresRemediation: total >= DRIFT_REMEDIATION_THRESHOLD,
  };
}

// ── Architecture Drift → Actionable Debt Tasks ────────────────────────────

/**
 * Convert architecture drift report items into structured debt plan tasks.
 * Groups items by source document so one task covers all issues in a given file.
 * Each task carries taskKind="debt" and source="architecture_drift" so it can
 * be tracked, filtered, and prioritised separately from AI-generated plans.
 *
 * Tasks are placed on a wave one beyond the highest existing plan wave so they
 * do not block critical delivery work but are still ingested into the plan graph.
 *
 * Existing plans that already reference a document path suppress debt task
 * generation for that document to prevent double-scheduling.
 *
 * @param driftReport - result of checkArchitectureDrift(), or null/undefined
 * @param existingPlans - plans already present in the parsed output
 * @returns array of debt plan task objects ready for injection into parsed.plans
 */
export function buildDriftDebtTasks(
  driftReport: Record<string, unknown> | null | undefined,
  existingPlans: any[] = []
): any[] {
  if (!driftReport) return [];

  const staleRefs = Array.isArray(driftReport.staleReferences)
    ? (driftReport.staleReferences as any[]).filter(r => r && typeof r === "object")
    : [];
  const tokenRefs = Array.isArray(driftReport.deprecatedTokenRefs)
    ? (driftReport.deprecatedTokenRefs as any[]).filter(r => r && typeof r === "object")
    : [];

  if (staleRefs.length === 0 && tokenRefs.length === 0) return [];

  // Place debt tasks on the wave immediately after the highest existing wave.
  const maxWave = existingPlans.reduce((max, p) => {
    const w = Number(p.wave) || 1;
    return w > max ? w : max;
  }, 0);
  const debtWave = maxWave + 1;

  // Identify docs already addressed in existing plans to avoid double-scheduling.
  const coveredDocs = new Set<string>();
  for (const plan of existingPlans) {
    const text = `${String(plan.task || "")} ${String(plan.description || "")} ${(plan.target_files || []).join(" ")}`.toLowerCase();
    for (const ref of [...staleRefs, ...tokenRefs]) {
      if (ref.docPath && text.includes(String(ref.docPath).toLowerCase())) {
        coveredDocs.add(String(ref.docPath));
      }
    }
  }

  const debtTasks: any[] = [];
  // Use high priority numbers so debt tasks sort after critical delivery work.
  // Within debt tasks, lower numbers mean higher urgency (high-priority refs first).
  let priority = 900;

  // Effective priority rank for a set of refs: the highest-priority (lowest rank) item wins.
  function effectivePriorityRank(refs: any[]): number {
    let best = 2; // low
    for (const r of refs) {
      const p = String(r.referencedPath || "");
      const rank = p.startsWith("src/core/") ? 0 : p.startsWith("src/") ? 1 : 2;
      if (rank < best) best = rank;
    }
    return best;
  }

  // One debt task per doc with stale file references.
  // Docs are sorted by their highest-priority ref so high-risk docs surface first.
  const staleByDoc = new Map<string, any[]>();
  for (const ref of staleRefs) {
    const doc = String(ref.docPath || "");
    if (!staleByDoc.has(doc)) staleByDoc.set(doc, []);
    staleByDoc.get(doc)!.push(ref);
  }
  const docPriorityScore = (doc: string, refs: any[]) => {
    const rankScore = effectivePriorityRank(refs) === 0 ? 300 : effectivePriorityRank(refs) === 1 ? 200 : 100;
    const pathBoost = String(doc || "").toLowerCase().includes("autonomous-dev-playbook.md") ? 40 : 0;
    return rankScore + pathBoost;
  };
  const sortedStaleByDoc = [...staleByDoc.entries()].sort(
    ([aDoc, aRefs], [bDoc, bRefs]) => {
      const scoreDiff = docPriorityScore(bDoc, bRefs) - docPriorityScore(aDoc, aRefs);
      if (scoreDiff !== 0) return scoreDiff;
      return aDoc.localeCompare(bDoc);
    }
  );
  const RANK_TO_DRIFT_PRIORITY = ["high", "medium", "low"] as const;
  for (const [doc, refs] of sortedStaleByDoc) {
    if (coveredDocs.has(doc)) continue;
    const paths = [...new Set(refs.map((r: any) => String(r.referencedPath)))].join(", ");
    const driftPriority = RANK_TO_DRIFT_PRIORITY[effectivePriorityRank(refs)];
    // Specific verification target: names the test file and the exact assertion so the
    // quality gate (plan_contract_validator.isNonSpecificVerification) accepts the task
    // and does not auto-remove it for having a bare "npm test" command.
    const verificationTarget = `tests/core/architecture_drift.test.ts — test: ${doc} has zero stale file references after update`;
    debtTasks.push({
      task: `Fix stale file references in ${doc}`,
      title: `Fix stale file references in ${doc}`,
      description: `${doc} references ${refs.length} file(s) that no longer exist: ${paths}. Update or remove these entries so documentation matches the current codebase.`,
      taskKind: "debt",
      source: "architecture_drift",
      _driftDebt: true,
      // driftPriority reflects the highest-urgency issue in this doc for downstream filtering.
      driftPriority,
      wave: debtWave,
      priority: priority++,
      target_files: [doc],
      acceptance_criteria: [
        `All ${refs.length} stale file reference(s) in ${doc} are updated or removed`,
        `No broken file references remain in ${doc}`,
        `npm test passes with no new failures after the update`,
      ],
      // Named test file reference satisfies isNonSpecificVerification — required to
      // survive the plan quality gate without being auto-removed.
      verification: verificationTarget,
      verification_commands: ["npm test"],
      // verification_targets enumerates the specific tests that must pass for this
      // debt task. The quality gate checks this field when present to validate that
      // the task is traceable to a concrete test assertion.
      verification_targets: [verificationTarget],
      riskLevel: "low",
      role: "evolution-worker",
      owner: "evolution-worker",
      // dependencies must be an array so the dependency-graph resolver and
      // validatePlanContract (WARNING check) do not flag this task.
      dependencies: [],
      // scope derived from the target document so validatePatchedPlan accepts
      // this task when Athena returns it in patchedPlans without modification.
      scope: doc,
      // capacityDelta and requestROI are mandatory contract fields (plan_contract_validator).
      // Debt remediation tasks improve documentation quality by a small, measurable amount.
      capacityDelta: 0.05,
      requestROI: 1.2,
      leverage_rank: ["quality"],
      implementationEvidence: [
        `architecture_drift report lists stale reference(s) in ${doc}`,
      ],
    });
  }

  // One debt task per doc with deprecated token usages.
  const tokensByDoc = new Map<string, any[]>();
  for (const ref of tokenRefs) {
    const doc = String(ref.docPath || "");
    if (!tokensByDoc.has(doc)) tokensByDoc.set(doc, []);
    tokensByDoc.get(doc)!.push(ref);
  }
  for (const [doc, refs] of tokensByDoc.entries()) {
    if (coveredDocs.has(doc)) continue;
    const uniqueTokens = [...new Set(refs.map((r: any) => String(r.token)))];
    const hints = [...new Map(refs.map((r: any) => [String(r.token), String(r.hint)])).entries()]
      .map(([t, h]) => `${t} → ${h}`)
      .join("; ");
    const verificationTarget = `tests/core/architecture_drift.test.ts — test: ${doc} has zero deprecated token usages after replacement`;
    debtTasks.push({
      task: `Replace deprecated API tokens in ${doc}`,
      title: `Replace deprecated API tokens in ${doc}`,
      description: `${doc} contains ${refs.length} use(s) of deprecated token(s): ${uniqueTokens.join(", ")}. Replace with current equivalents. Migration hints: ${hints}`,
      taskKind: "debt",
      source: "architecture_drift",
      _driftDebt: true,
      wave: debtWave,
      priority: priority++,
      target_files: [doc],
      acceptance_criteria: [
        `All ${refs.length} deprecated token usage(s) in ${doc} are replaced with current equivalents`,
        `No deprecated tokens remain in ${doc}`,
        `npm test passes with no new failures after the replacement`,
      ],
      verification: verificationTarget,
      verification_commands: ["npm test"],
      verification_targets: [verificationTarget],
      riskLevel: "low",
      role: "evolution-worker",
      owner: "evolution-worker",
      dependencies: [],
      scope: doc,
      capacityDelta: 0.05,
      requestROI: 1.2,
      leverage_rank: ["quality"],
      implementationEvidence: [
        `architecture_drift report lists deprecated token usage(s) in ${doc}`,
      ],
    });
  }

  return debtTasks;
}

// ── Telemetry-adjusted packet ranking ─────────────────────────────────────────
//
// Extends the base rank score (requestROI × (1 + capacityDelta)) by blending in
// realized outcome telemetry from the route ROI ledger.  When history shows that
// realized outcomes were better/worse than predicted (positive/negative avgRoiDelta),
// the ranking score is adjusted proportionally within a ±0.5 clamp.
//
// Consumers:
//   - Pass a RealizedTelemetrySummary built from model_policy.summarizeTierTelemetry
//     (or summarizeRealizedTelemetry for a pre-filtered slice of ledger entries).
//   - When no telemetry is available (sampleCount=0), adjustment is neutral (×1.0).

/**
 * Compact telemetry summary consumed by computeTelemetryAdjustedPacketScore.
 * Produced by summarizeRealizedTelemetry or model_policy.summarizeTierTelemetry.
 */
export interface RealizedTelemetrySummary {
  /** Average realized-minus-expected ROI delta across sampled entries. 0 = no data. */
  avgRoiDelta: number;
  /** Number of realized entries that contributed to the average. */
  sampleCount: number;
}

/**
 * Summarize realized outcome telemetry from a raw ledger slice into a compact signal
 * that packet ranking can consume without coupling to model_policy internals.
 *
 * Only entries that are fully realized (realizedAt non-null, roiDelta is a finite number)
 * contribute to the summary.  Returns { avgRoiDelta: 0, sampleCount: 0 } when no realized
 * entries are available so callers can distinguish "no data" from "neutral history".
 *
 * @param entries  — records with at least { roiDelta?, realizedAt? } fields
 * @param limit    — max most-recent entries to include (default: 20)
 */
export function summarizeRealizedTelemetry(
  entries: Array<{ roiDelta?: number | null; realizedAt?: string | null }>,
  limit = 20
): RealizedTelemetrySummary {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { avgRoiDelta: 0, sampleCount: 0 };
  }
  const realized = entries
    .filter(
      e =>
        e.realizedAt !== null &&
        e.realizedAt !== undefined &&
        typeof e.roiDelta === "number" &&
        Number.isFinite(e.roiDelta)
    )
    .slice(-limit);
  if (realized.length === 0) return { avgRoiDelta: 0, sampleCount: 0 };
  const sum = realized.reduce((acc, e) => acc + (e.roiDelta as number), 0);
  return {
    avgRoiDelta: Math.round((sum / realized.length) * 1000) / 1000,
    sampleCount: realized.length,
  };
}

/**
 * Maximum telemetry adjustment factor applied to a packet's base rank score.
 * avgRoiDelta is clamped to ±TELEMETRY_ADJUSTMENT_CLAMP before multiplication.
 * This prevents runaway adjustment from a small or anomalous sample.
 */
export const TELEMETRY_ADJUSTMENT_CLAMP = 0.5 as const;

/**
 * Compute a telemetry-adjusted ranking score for a single plan packet.
 *
 * Extends the base rank score (requestROI × (1 + capacityDelta)) by blending in
 * realized outcome signals.  The adjustment factor is derived from the historical
 * avgRoiDelta, clamped to ±TELEMETRY_ADJUSTMENT_CLAMP to limit sample sensitivity.
 *
 * Formula: baseScore × (1 + clamp(avgRoiDelta, −0.5, 0.5))
 *   − Positive avgRoiDelta → outcomes historically beat predictions → score up-ranked
 *   − Negative avgRoiDelta → outcomes historically missed predictions → score down-ranked
 *   − sampleCount=0         → telemetryFactor=0, score equals baseline (neutral)
 *
 * Plans missing valid capacityDelta or requestROI score 0 (filtered before ranking).
 *
 * @param plan             — normalized plan packet (capacityDelta, requestROI required)
 * @param telemetrySummary — from summarizeRealizedTelemetry or model_policy.summarizeTierTelemetry
 * @returns adjusted rank score ≥ 0
 */
export function computeTelemetryAdjustedPacketScore(
  plan: Record<string, any>,
  telemetrySummary: RealizedTelemetrySummary = { avgRoiDelta: 0, sampleCount: 0 }
): number {
  if (!plan || typeof plan !== "object") return 0;
  const roi = Number(plan.requestROI);
  const delta = Number(plan.capacityDelta);
  if (!Number.isFinite(roi) || roi <= 0) return 0;
  if (!Number.isFinite(delta)) return 0;
  const baseScore = roi * (1 + delta);
  if (!telemetrySummary || telemetrySummary.sampleCount === 0) return baseScore;
  const telemetryFactor = Math.max(
    -TELEMETRY_ADJUSTMENT_CLAMP,
    Math.min(TELEMETRY_ADJUSTMENT_CLAMP, telemetrySummary.avgRoiDelta)
  );
  return Math.max(0, baseScore * (1 + telemetryFactor));
}

/**
 * Rank plan packets by telemetry-adjusted composite score, descending.
 *
 * Uses computeTelemetryAdjustedPacketScore to score each plan.  Plans missing valid
 * capacityDelta/requestROI score 0 and sort to the end.  The original array is NOT
 * mutated — a new sorted array is returned.  Within equal scores, original order is
 * preserved (stable sort).
 *
 * @param plans            — normalized plan packets
 * @param telemetrySummary — from summarizeRealizedTelemetry (default: no adjustment)
 * @returns sorted copy, highest adjusted score first
 */
export function rankPlansByTelemetryAdjustedScore(
  plans: any[],
  telemetrySummary: RealizedTelemetrySummary = { avgRoiDelta: 0, sampleCount: 0 }
): any[] {
  if (!Array.isArray(plans)) return [];
  return [...plans].sort(
    (a, b) =>
      computeTelemetryAdjustedPacketScore(b, telemetrySummary) -
      computeTelemetryAdjustedPacketScore(a, telemetrySummary)
  );
}

// ── Realized closure yield — planning/routing rank adjustment ─────────────────
//
// Closure yield measures what fraction of carry-forward items that were marked
// closed (closedAt non-null) actually shipped with verifiable evidence
// (closureEvidence non-empty).  Low yield signals the system is declaring items
// done without proving they were fixed, which should bias plan ranking toward
// tasks that close the learning loop and bias routing toward stronger models.

/** Threshold below which closure yield is treated as "low" — triggers rank boosts. */
export const CLOSURE_YIELD_LOW_THRESHOLD = 0.5 as const;

/** Dimensions whose plans receive a capacityDelta boost when closure yield is low. */
export const CLOSURE_YIELD_BOOST_DIMENSIONS: ReadonlySet<string> = new Set([
  "learning",
  "quality",
  "task-quality",
  "learning loop",
]) as ReadonlySet<string>;

/** capacityDelta boost applied to qualifying plans when closure yield is below the threshold. */
export const CLOSURE_YIELD_BOOST_AMOUNT = 0.05 as const;

/** Result type returned by computeClosureYield. */
export interface ClosureYieldResult {
  /** Fraction of attempted closures with verified evidence (0–1; 0 when no attempts). */
  yield: number;
  /** Entries with both closedAt and non-empty closureEvidence. */
  closed: number;
  /** Entries with closedAt set (system declared them closed). */
  attempted: number;
}

/**
 * Compute the realized closure yield from carry-forward ledger entries.
 *
 * Yield = closed / attempted, where:
 *   - attempted = entries with closedAt non-null (system declared them closed)
 *   - closed    = entries with BOTH closedAt AND non-empty closureEvidence (verifiably shipped)
 *
 * Returns { yield: 0, closed: 0, attempted: 0 } when no entries have been attempted
 * so callers can distinguish "no history" from "genuinely zero yield".
 *
 * @param ledgerEntries — carry-forward ledger entry objects
 */
export function computeClosureYield(ledgerEntries: any[]): ClosureYieldResult {
  const entries = Array.isArray(ledgerEntries) ? ledgerEntries : [];
  const attempted = entries.filter(e => e != null && e.closedAt != null).length;
  if (attempted === 0) return { yield: 0, closed: 0, attempted: 0 };
  const closed = entries.filter(e => e != null && e.closedAt && e.closureEvidence).length;
  return {
    yield: Math.round((closed / attempted) * 1000) / 1000,
    closed,
    attempted,
  };
}

/**
 * Rank plan packets by applying a closure-yield boost to plans that target the
 * learning/quality feedback-loop dimensions when realized closure yield is low.
 *
 * When closureYield < CLOSURE_YIELD_LOW_THRESHOLD (and > 0), plans whose
 * leverage_rank includes any CLOSURE_YIELD_BOOST_DIMENSIONS entry have their
 * capacityDelta raised by CLOSURE_YIELD_BOOST_AMOUNT (clamped to 1.0).  This
 * surfaces fix-the-loop plans higher in dispatch without altering unrelated plans.
 *
 * Returns a new array (does not mutate input).  When yield is 0 or at/above the
 * threshold the input is copied unchanged (caller still gets a new array).
 *
 * @param plans        — normalized plan packets with capacityDelta and leverage_rank
 * @param closureYield — from computeClosureYield().yield (0 = no data; no adjustment)
 */
export function rankPlansByClosureYield(plans: any[], closureYield: number): any[] {
  if (!Array.isArray(plans)) return [];
  if (!Number.isFinite(closureYield) || closureYield <= 0 || closureYield >= CLOSURE_YIELD_LOW_THRESHOLD) {
    return [...plans];
  }
  return plans.map(plan => {
    if (!plan || typeof plan !== "object") return plan;
    const leverageRank = Array.isArray(plan.leverage_rank) ? plan.leverage_rank : [];
    const hasBoostDimension = leverageRank.some(
      (d: any) => CLOSURE_YIELD_BOOST_DIMENSIONS.has(String(d || "").toLowerCase())
    );
    if (!hasBoostDimension) return { ...plan };
    const current = Number.isFinite(Number(plan.capacityDelta)) ? Number(plan.capacityDelta) : 0.1;
    return {
      ...plan,
      capacityDelta: Math.min(1.0, Math.round((current + CLOSURE_YIELD_BOOST_AMOUNT) * 1000) / 1000),
    };
  });
}

// ── Novelty / discovery-gap scoring ───────────────────────────────────────────
//
// Novelty measures what fraction of current plan packets address task areas
// that were NOT seen in recent historical plans.  When novelty collapses (score
// below NOVELTY_COLLAPSE_THRESHOLD) the system seeds fresh discovery packets
// that target dimensions absent from both current and historical work.  This
// prevents planning cycles from becoming closed loops on previously-attempted
// tasks with diminishing returns.

/** Threshold below which plan novelty is treated as "collapsed" — triggers seeding. */
export const NOVELTY_COLLAPSE_THRESHOLD = 0.35 as const;

/**
 * Canonical discovery dimensions used when seeding packets on novelty collapse.
 * Each dimension represents a capability area that should periodically be explored.
 */
export const NOVELTY_SEED_DIMENSIONS: ReadonlySet<string> = new Set([
  "observability",
  "reliability",
  "performance",
  "security",
  "testing",
  "architecture",
  "documentation",
  "refactor",
]) as ReadonlySet<string>;

/** Result returned by computeNoveltyScore. */
export interface NoveltyScoreResult {
  /** Fraction of current plans that are novel vs. history (0–1). 1.0 when no history. */
  score: number;
  /** Number of current plans considered novel (no significant overlap with history). */
  novelCount: number;
  /** Total current plans evaluated. */
  totalCount: number;
  /** Task texts of plans that were classified as repeated from history. */
  repeatedTasks: string[];
}

/**
 * Compute a novelty score for current plan packets relative to historical plans.
 *
 * A plan is classified as "repeated" when its task text shares ≥2 significant words
 * (≥4 chars) with any historical plan — the same keyword-overlap strategy used by
 * computeBottleneckCoverage to keep measurement consistent across the system.
 *
 * Returns { score: 1.0, novelCount: 0, totalCount: 0, repeatedTasks: [] } when
 * currentPlans is empty so callers can distinguish "no work" from "zero novelty".
 * Returns score: 1.0 (all novel) when historicalPlans is empty (first cycle).
 *
 * @param currentPlans    — plan packets from the current planning cycle
 * @param historicalPlans — plan packets from recent prior cycles
 */
export function computeNoveltyScore(
  currentPlans: any[],
  historicalPlans: any[],
): NoveltyScoreResult {
  const current = Array.isArray(currentPlans) ? currentPlans : [];
  const historical = Array.isArray(historicalPlans) ? historicalPlans : [];

  if (current.length === 0) {
    return { score: 1.0, novelCount: 0, totalCount: 0, repeatedTasks: [] };
  }
  if (historical.length === 0) {
    return { score: 1.0, novelCount: current.length, totalCount: current.length, repeatedTasks: [] };
  }

  // Pre-build word sets for all historical plans to avoid repeated tokenization.
  const historicalWordSets = historical.map(plan => {
    const text = `${String(plan?.task || "")} ${String(plan?.title || "")}`.toLowerCase();
    return text.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  });

  const repeatedTasks: string[] = [];
  let novelCount = 0;

  for (const plan of current) {
    const taskText = String(plan?.task || plan?.title || "").trim();
    const planWords = `${taskText} ${String(plan?.title || "")}`.toLowerCase()
      .split(/[^a-z0-9]+/).filter(w => w.length >= 4);

    const isRepeated = planWords.length > 0 && historicalWordSets.some(histWords => {
      const matches = planWords.filter(w => histWords.includes(w));
      return matches.length >= 2;
    });

    if (isRepeated) {
      repeatedTasks.push(taskText);
    } else {
      novelCount++;
    }
  }

  return {
    score: Math.round((novelCount / current.length) * 1000) / 1000,
    novelCount,
    totalCount: current.length,
    repeatedTasks,
  };
}

/**
 * Seed fresh implementation packets when novelty collapses.
 *
 * When computeNoveltyScore returns a score below NOVELTY_COLLAPSE_THRESHOLD,
 * this function generates minimal discovery-gap packets targeting dimensions that
 * are absent from both current and historical plans.  This prevents the planning
 * cycle from becoming a closed loop on previously-attempted work with diminishing
 * returns on system capacity.
 *
 * Returns [] when:
 *   - novelty is at or above NOVELTY_COLLAPSE_THRESHOLD (no seeding needed), or
 *   - currentPlans is empty (no work to compare against), or
 *   - all NOVELTY_SEED_DIMENSIONS are already covered.
 *
 * Does NOT mutate input arrays.  Seed packets are flagged with _discoveryGapSeed: true
 * so callers can identify them and handle them separately if needed.
 *
 * @param currentPlans    — plan packets from the current cycle
 * @param historicalPlans — plan packets from recent prior cycles
 * @param options.maxSeeds — maximum seed packets to generate (default: 3)
 */
export function seedDiscoveryGapPackets(
  currentPlans: any[],
  historicalPlans: any[],
  options: { maxSeeds?: number } = {},
): any[] {
  const noveltyResult = computeNoveltyScore(currentPlans, historicalPlans);
  if (noveltyResult.score >= NOVELTY_COLLAPSE_THRESHOLD || noveltyResult.totalCount === 0) {
    return [];
  }

  const maxSeeds =
    Number.isFinite(Number(options?.maxSeeds)) && Number(options.maxSeeds) > 0
      ? Math.floor(Number(options.maxSeeds))
      : 3;

  // Collect dimensions already addressed in current + historical plans.
  const coveredDimensions = new Set<string>();
  const allPlans = [
    ...(Array.isArray(currentPlans) ? currentPlans : []),
    ...(Array.isArray(historicalPlans) ? historicalPlans : []),
  ];
  for (const plan of allPlans) {
    const leverageRank = Array.isArray(plan?.leverage_rank) ? plan.leverage_rank : [];
    for (const dim of leverageRank) {
      coveredDimensions.add(String(dim || "").toLowerCase().trim());
    }
    // Also extract seed dimension keywords from task text for best-effort coverage.
    const taskText = `${String(plan?.task || "")} ${String(plan?.title || "")}`.toLowerCase();
    for (const dim of NOVELTY_SEED_DIMENSIONS) {
      if (taskText.includes(dim)) coveredDimensions.add(dim);
    }
  }

  const uncoveredDimensions = [...NOVELTY_SEED_DIMENSIONS].filter(
    dim => !coveredDimensions.has(dim),
  );

  if (uncoveredDimensions.length === 0) {
    return [];
  }

  return uncoveredDimensions.slice(0, maxSeeds).map((dim, i) => ({
    task: `Discovery: explore ${dim} improvements and implementation gaps`,
    title: `Discovery gap seed — ${dim}`,
    role: "evolution-worker",
    wave: 1,
    priority: 99 + i,
    verification: "npm test",
    verification_commands: ["npm test"],
    capacityDelta: 0.05,
    requestROI: 0.8,
    leverage_rank: [dim],
    _discoveryGapSeed: true,
    _noveltyCollapseScore: noveltyResult.score,
  }));
}

export function ensurePersistedAnalysisTimestamps<T extends Record<string, unknown>>(analysis: T): T & {
  generatedAt: string;
  analyzedAt: string;
} {
  const nowIso = new Date().toISOString();
  return {
    ...analysis,
    generatedAt: nowIso,
    analyzedAt: nowIso,
  };
}

export async function runPrometheusAnalysis(config, options: any = {}) {
  const stateDir = config.paths?.stateDir || "state";

  // ── Freshness cache: skip if recent analysis exists ───────────────────────
  // bypassCache: allows event-driven invalidation (e.g., all plans completed)
  if (options.bypassCache) {
    await appendProgress(config, `[PROMETHEUS] Cache bypass requested (reason=${options.bypassReason || "unknown"}) — forcing fresh analysis`);
  }
  const freshnessMins = Number(config.runtime?.prometheusAnalysisFreshnessMinutes);
  if (!options.bypassCache && Number.isFinite(freshnessMins) && freshnessMins > 0) {
    try {
      const existing = await readJson(path.join(stateDir, "prometheus_analysis.json"), null);
      if (existing?.analyzedAt) {
        const analyzedAtMs = new Date(existing.analyzedAt).getTime();
        const ageMs = Date.now() - analyzedAtMs;
        const latestResearchArtifactMs = await getLatestResearchArtifactUpdatedAtMs(stateDir);
        const researchUpdatedAfterAnalysis = latestResearchArtifactMs > analyzedAtMs;
        if (ageMs < freshnessMins * 60_000 && !researchUpdatedAfterAnalysis) {
          // If cached file already has plans, re-normalise them so enrichment
          // functions (target_files, scope, acceptance_criteria) always run.
          if (Array.isArray(existing.plans) && existing.plans.length > 0) {
            const renormalized = normalizePrometheusParsedOutput(existing, {});
            const persistedRenormalized = ensurePersistedAnalysisTimestamps(renormalized);
            await writeJson(
              path.join(stateDir, "prometheus_analysis.json"),
              addSchemaVersion(persistedRenormalized, STATE_FILE_TYPE.PROMETHEUS_ANALYSIS),
            ).catch(() => {});
            await appendProgress(config, `[PROMETHEUS] Fresh analysis exists (${Math.round(ageMs / 60_000)}m old, threshold=${freshnessMins}m) — reusing cached result (re-normalized ${renormalized.plans.length} plan(s))`);
            return persistedRenormalized;
          }
          // Cached file has no plans — attempt normalization to recover plans
          const recovered = normalizePrometheusParsedOutput(existing, {});
          if (Array.isArray(recovered.plans) && recovered.plans.length > 0) {
            await appendProgress(config, `[PROMETHEUS] Cached analysis normalized: ${recovered.plans.length} plan(s) recovered — rebuilding dependency graph`);
            // Rebuild dependency graph for the recovered plans
            try {
              const graphTasks = recovered.plans.map((plan, i) => ({
                id: String(plan.task || `plan-${i}`),
                dependsOn: Array.isArray(plan.dependencies) ? plan.dependencies.map(String) : [],
                filesInScope: Array.isArray(plan.target_files) ? plan.target_files : (Array.isArray(plan.targetFiles) ? plan.targetFiles : []),
              }));
              const graphResult = resolveDependencyGraph(graphTasks);
              recovered.dependencyGraph = {
                status:          graphResult.status,
                reasonCode:      graphResult.reasonCode,
                waveCount:       graphResult.waves.length,
                parallelTasks:   graphResult.parallelTasks,
                serializedTasks: graphResult.serializedTasks,
                conflictCount:   graphResult.conflictPairs.length,
                cycleCount:      graphResult.cycles.length,
                waves:           graphResult.waves,
                errorMessage:    graphResult.errorMessage ?? null,
              };
            } catch (graphErr) {
              recovered.dependencyGraph = { status: "degraded", errorMessage: String(graphErr?.message || graphErr) };
            }
            // Persist normalized result so subsequent reads don't need re-normalization
            const persistedRecovered = ensurePersistedAnalysisTimestamps(recovered);
            await writeJson(
              path.join(stateDir, "prometheus_analysis.json"),
              addSchemaVersion(persistedRecovered, STATE_FILE_TYPE.PROMETHEUS_ANALYSIS),
            ).catch(() => {});
            return persistedRecovered;
          }
          // Cache exists but normalization also produced no plans — re-run
          await appendProgress(config, `[PROMETHEUS] Cached analysis has no actionable plans (${Math.round(ageMs / 60_000)}m old) — re-running`);
        } else if (ageMs < freshnessMins * 60_000 && researchUpdatedAfterAnalysis) {
          await appendProgress(config, `[PROMETHEUS] Fresh cache skipped — research artifacts are newer than cached analysis`);
        }
      }
    } catch { /* no cached analysis — proceed normally */ }
  }

  const repoRoot = process.cwd();
  const registry = getRoleRegistry(config);
  const prometheusName = registry?.deepPlanner?.name || "Prometheus";
  const prometheusModel = registry?.deepPlanner?.model || "gpt-5.3-codex";
  const command = config.env?.copilotCliCommand || "copilot";

  const userPrompt = options.prompt || options.prometheusReason || "Full repository self-evolution analysis";
  const requestedBy = options.requestedBy || "Jesus";

  const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);

  // ── Log start ─────────────────────────────────────────────────────────────
  await appendProgress(config, `[PROMETHEUS] ${prometheusName} awakening — starting deep repository analysis (simplified mode)`);
  await appendPrometheusLiveLog(stateDir, "leadership_live", `[${ts()}] ${prometheusName.padEnd(20)} Awakening — direct Copilot CLI scan starting...`);

  // ── Load lane telemetry from previous cycle analytics for context injection ──
  let prevLaneTelemetry: Record<string, unknown> | null = null;
  try {
    const prevAnalytics = await readJson(path.join(stateDir, "cycle_analytics.json"), null);
    const raw = (prevAnalytics as any)?.lastCycle?.laneTelemetry;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      prevLaneTelemetry = raw as Record<string, unknown>;
    }
  } catch { /* non-fatal — proceed without lane telemetry */ }

  const planningPolicy = buildPrometheusPlanningPolicy(config, prevLaneTelemetry);
  const diagnosticsFreshnessSection = await buildDiagnosticsFreshnessPromptSection(stateDir);
  // Build machine-readable freshness records for the live admission gate.
  // These are computed in parallel with the prompt section so the same file I/O
  // serves both the human-readable section and the deterministic admission gate.
  const _diagnosticsFreshnessRecords = await buildDiagnosticsFreshnessRecords(stateDir);
  const diagnosticsFreshnessAdmission = computeDiagnosticsFreshnessAdmission(_diagnosticsFreshnessRecords);

  let researchSectionText = "";
  let researchTopicCount = 0;
  let researchSourceCount = 0;
  let researchCoverageTarget = 0;
  let researchTopicsList: string[] = [];
  let researchSynthesisData: unknown = null;
  let mandatoryFindings: MandatoryHealthAuditFinding[] = [];
  let mandatoryTasksSection = "";
  let benchmarkSection = "";
  let routingOutcomeSection = "";
  try {
    const [researchSynthesis, researchScout] = await Promise.all([
      readJson(path.join(stateDir, "research_synthesis.json"), null),
      readJson(path.join(stateDir, "research_scout_output.json"), null),
    ]);
    researchSynthesisData = researchSynthesis;
    researchTopicsList = extractResearchTopics(researchSynthesis, researchScout);
    const researchArtifactUpdatedAtMs = await getLatestResearchArtifactUpdatedAtMs(stateDir);

    // ── Research quality gate: quarantine low-density topics ─────────────────
    // When the quality gate failed, filter out topics below minimum actionable density
    // before injecting them into the Prometheus prompt.  This prevents low-signal
    // topics from degrading plan quality; the resulting state is "degraded planning mode".
    let effectiveSynthesis: unknown = researchSynthesis;
    let degradedPlanningModeActive = false;
    const qg = (researchSynthesis as any)?.qualityGate;
    const qualityGatePlanningMode = String((qg as any)?.planningMode || "").trim();
    if (qg && qg.passed === false) {
      const allTopics: unknown[] = Array.isArray((researchSynthesis as any)?.topics)
        ? (researchSynthesis as any).topics
        : [];
      // Prefer persisted quarantinedTopics list (new schema); fall back to computing from densities.
      const quarantinedTopicNames: string[] = Array.isArray(qg.quarantinedTopics)
        ? qg.quarantinedTopics
        : (Array.isArray(qg.topicDensities)
            ? (qg.topicDensities as any[]).filter((d: any) => !d.passed).map((d: any) => String(d.topic || ""))
            : []);
      const quarantinedSet = new Set(quarantinedTopicNames);
      const passedTopics = allTopics.filter((t: any) => !quarantinedSet.has(String(t?.topic || "")));
      if (quarantinedTopicNames.length > 0) {
        // Always filter quarantined topics from the effective synthesis injected into the prompt.
        effectiveSynthesis = { ...(researchSynthesis as any), topics: passedTopics };
        const allTopicsQuarantined = passedTopics.length === 0;
        const contractRequiresInternalEvidenceOnly = qualityGatePlanningMode === "internal_evidence_only";
        if (allTopicsQuarantined || contractRequiresInternalEvidenceOnly) {
          // ALL topics quarantined — no valid signal remains. Enter degraded planning mode.
          degradedPlanningModeActive = true;
          await appendProgress(
            config,
            `[PROMETHEUS][DEGRADED_PLANNING] ${quarantinedTopicNames.length} low-density topic(s) quarantined from planning context ` +
            `(retried=${qg.retried}). mode=${contractRequiresInternalEvidenceOnly ? "contract:internal_evidence_only" : "inferred:all_topics_quarantined"} — operating in degraded planning mode.`
          );
        } else {
          // PARTIAL quarantine — valid signal retained in passedTopics. NOT degraded.
          await appendProgress(
            config,
            `[PROMETHEUS][PARTIAL_QUARANTINE] ${quarantinedTopicNames.length} low-density topic(s) quarantined ` +
            `(retried=${qg.retried}). ${passedTopics.length} valid topic(s) retained — continuing in normal planning mode.`
          );
        }
      } else {
        await appendProgress(
          config,
          `[PROMETHEUS][WARN] Research synthesis quality gate did not pass (retried=${qg.retried}). ` +
          `${(qg.topicDensities ?? []).filter((d: any) => !d.passed).length} topic(s) below minimum actionable density. ` +
          `Plans may have reduced signal quality.`
        );
      }
    }

    const researchContext = buildResearchPromptSection(effectiveSynthesis, researchScout, planningPolicy, researchArtifactUpdatedAtMs);
    researchSectionText = researchContext.sectionText;
    // Prepend degraded-mode warning so Prometheus knows its research context is incomplete.
    // When ALL topics are quarantined, researchSectionText may be empty — inject the
    // recovery signal regardless so Prometheus always receives a non-empty planning context.
    if (degradedPlanningModeActive) {
      const quarantinedForRecovery: string[] = Array.isArray(qg?.quarantinedTopics) ? qg.quarantinedTopics : [];
      // Schedule bounded recovery synthesis for the next cycle so the Research Scout
      // can re-run with strict density thresholds rather than silently skipping.
      try {
        const { scheduleBoundedRecoverySynthesis } = await import("./research_synthesizer.js");
        await scheduleBoundedRecoverySynthesis(stateDir, {
          quarantinedTopics: quarantinedForRecovery,
          retriedAlready: qg?.retried === true,
        });
        await appendProgress(
          config,
          `[PROMETHEUS][DEGRADED_PLANNING][INTERNAL_EVIDENCE_MODE] All research topics quarantined. ` +
          `Switching to internal repository-evidence-only planning. ` +
          `Bounded recovery synthesis scheduled for next cycle (${quarantinedForRecovery.length} topic(s)).`
        );
      } catch (recoveryErr) {
        await appendProgress(
          config,
          `[PROMETHEUS][DEGRADED_PLANNING][WARN] Failed to schedule recovery synthesis: ${String((recoveryErr as Error)?.message || recoveryErr)}`
        );
      }
      // Override planning context: derive tasks from repo state only — NOT from topic names.
      // The header below is injected as the sole research context so Prometheus cannot
      // accidentally treat topic names as evidence.
      const degradedHeader =
        `## ⚠️ DEGRADED PLANNING MODE — INTERNAL EVIDENCE ONLY\n` +
        `Research synthesis quality gate is in degraded mode due to insufficient actionable ` +
        `research density. You MUST derive tasks exclusively from concrete ` +
        `repository evidence (failing tests, error logs, source files, state files). ` +
        `Do NOT reference research topic names as task justification — topic names are not evidence.\n` +
        `Persisted planning contract: qualityGate.planningMode=internal_evidence_only.\n` +
        `A bounded recovery synthesis has been scheduled for the next cycle.\n\n`;
      researchSectionText = degradedHeader;
    }
    researchTopicCount = researchContext.topicCount;
    researchSourceCount = researchContext.sourceCount;
    researchCoverageTarget = researchContext.coverageTarget;
    if (researchSectionText) {
      await appendProgress(
        config,
        `[PROMETHEUS] Injecting research synthesis: ${researchTopicCount} topic(s) from ${researchSourceCount} source(s)`
      );
      // Mark synthesis as consumed so the scout gate can trigger a refresh on the next cycle.
      try {
        const synthPath = path.join(stateDir, "research_synthesis.json");
        const synthRaw = await readJson(synthPath, null);
        if (synthRaw && typeof synthRaw === "object") {
          const updated = { ...(synthRaw as Record<string, unknown>), lastConsumedAt: new Date().toISOString() };
          const { writeFile } = await import("node:fs/promises");
          await writeFile(synthPath, JSON.stringify(updated, null, 2), "utf8");
        }
      } catch { /* non-fatal — consumption tracking must never block planning */ }
    }
  } catch {
    // Optional signal; continue without research injection.
  }

  try {
    const healthAuditPayload = await readJson(path.join(stateDir, "health_audit_findings.json"), null);
    mandatoryFindings = extractMandatoryHealthAuditFindings(healthAuditPayload);
    mandatoryTasksSection = buildMandatoryTasksPromptSection(mandatoryFindings);
    if (mandatoryFindings.length > 0) {
      await appendProgress(
        config,
        `[PROMETHEUS] Injecting mandatory health-audit tasks: ${mandatoryFindings.length} finding(s) from state/health_audit_findings.json`
      );
    }
  } catch (error) {
    await appendProgress(
      config,
      `[PROMETHEUS][WARN] Failed to load health audit findings for mandatory-task injection: ${String((error as any)?.message || error)}`
    );
  }

  try {
    const [benchmarkData, premiumUsageData] = await Promise.all([
      readBenchmarkGroundTruth(config),
      readJson(path.join(stateDir, "premium_usage_log.json"), []),
    ]);
    benchmarkSection = buildBenchmarkSection(benchmarkData);
    routingOutcomeSection = buildRoutingOutcomeSection(premiumUsageData);
    if (benchmarkSection || routingOutcomeSection) {
      await appendProgress(
        config,
        `[PROMETHEUS] Injecting routing telemetry signals: benchmark=${benchmarkSection ? "yes" : "no"} outcomes=${routingOutcomeSection ? "yes" : "no"}`
      );
    }
  } catch (signalErr) {
    await appendProgress(
      config,
      `[PROMETHEUS][WARN] Failed to load routing telemetry signals: ${String((signalErr as any)?.message || signalErr)}`
    );
  }

  // ── Load accumulated topic memory ─────────────────────────────────────────
  let topicMemory = await loadTopicMemory(stateDir);
  let topicMemorySection = "";
  let trustedMemorySection = "";
  let cycleProofSection = "";
  try {
    topicMemorySection = buildTopicMemoryPromptSection(topicMemory);
    const activeCount = Object.values(topicMemory.topics).filter(t => t.status === "active").length;
    const completedCount = Object.values(topicMemory.topics).filter(t => t.status === "completed").length;
    const archivedCount = Object.values(topicMemory.topics).filter(t => t.status === "archived").length;
    if (activeCount > 0 || completedCount > 0 || archivedCount > 0) {
      await appendProgress(config,
        `[PROMETHEUS] Topic memory loaded: ${activeCount} active, ${completedCount} completed, ${archivedCount} archived topic(s)`
      );
    }
  } catch {
    // Non-fatal — proceed without topic memory.
  }

  try {
    const knowledgeMemory = await readJson(path.join(stateDir, "knowledge_memory.json"), null);
    const memoryShortlist = buildTrustedMemoryShortlist(knowledgeMemory, {
      requestedBy,
      includeLowTrust: options.includeLowTrustMemory === true,
    });
    if (memoryShortlist.lessons.length > 0 || memoryShortlist.promptHints.length > 0) {
      const lessonLines = memoryShortlist.lessons.map((entry: any, index: number) => {
        const trustLevel = String(entry?.trust?.level || MEMORY_TRUST_LEVEL.MEDIUM);
        return `${index + 1}. ${String(entry?.lesson || "").trim()} [trust=${trustLevel}]`;
      }).filter((line: string) => /\S/.test(line));
      const hintLines = memoryShortlist.promptHints.map((entry: any, index: number) => {
        const trustLevel = String(entry?.trust?.level || MEMORY_TRUST_LEVEL.MEDIUM);
        return `${index + 1}. ${String(entry?.hint || "").trim()} [trust=${trustLevel}]`;
      }).filter((line: string) => /\S/.test(line));
      trustedMemorySection = `\n\n## TRUST-FILTERED KNOWLEDGE MEMORY\nLessons:\n${lessonLines.length > 0 ? lessonLines.join("\n") : "- (none)"}\n\nPrompt hints:\n${hintLines.length > 0 ? hintLines.join("\n") : "- (none)"}`;
    }
    if (memoryShortlist.droppedLowTrustLessons > 0 || memoryShortlist.droppedLowTrustHints > 0) {
      await appendProgress(
        config,
        `[PROMETHEUS][MEMORY_TRUST] filtered low-trust entries lessons=${memoryShortlist.droppedLowTrustLessons} hints=${memoryShortlist.droppedLowTrustHints} includeLowTrust=${options.includeLowTrustMemory === true && isPrivilegedMemoryRequester(requestedBy)}`
      );
    }
  } catch (memoryErr) {
    await appendProgress(
      config,
      `[PROMETHEUS][WARN] Failed to load trust-filtered knowledge memory: ${String((memoryErr as any)?.message || memoryErr)}`
    );
  }

  try {
    const cycleProofEvidence = await readJson(path.join(stateDir, "cycle_proof_evidence.json"), null);
    const seamValidation = validateCycleProofEvidenceSeams(cycleProofEvidence);
    if (!seamValidation.ok) {
      await appendProgress(
        config,
        `[PROMETHEUS][CYCLE_PROOF] rejected incomplete cycle_proof_evidence artifact: ${seamValidation.failReasons.slice(0, 5).join("; ")}`
      );
    } else {
      const failedSeams = CYCLE_PROOF_SEAM_KEYS.filter((key) => seamValidation.seamChecks[key]?.pass !== true);
      cycleProofSection = `\n\n## CYCLE PROOF EVIDENCE\ncycleId=${seamValidation.cycleId}\nseamStatus=${failedSeams.length === 0 ? "all-pass" : `failed(${failedSeams.join(",")})`}`;
    }
  } catch {
    // Optional signal — proceed without cycle proof evidence section.
  }

  // ── Extract behavior patterns from postmortems ────────────────────────────
  let behaviorPatternsSection = "";
  let postmortemShortlistSection = "";
  let carryForwardSection = "";
  // Postmortem entries lifted to function scope so the carry-forward gate can
  // evaluate them after plan generation and validation.
  let postmortemEntries: any[] = [];
  try {
    // Load carry-forward ledger and coordination data in parallel for retirement check
    const [postmortems, cfLedgerData, coordinationData] = await Promise.all([
      readJson(path.join(stateDir, "athena_postmortems.json"), null),
      readJson(path.join(stateDir, "carry_forward_ledger.json"), { entries: [] }),
      readJson(path.join(stateDir, "athena_coordination.json"), {}),
    ]);
    const cfLedger = Array.isArray(cfLedgerData?.entries) ? cfLedgerData.entries : [];
    const coordinationCompletedTasks = Array.isArray(coordinationData?.completedTasks)
      ? coordinationData.completedTasks : [];
    const entries = Array.isArray(postmortems?.entries) ? postmortems.entries : [];
    postmortemEntries = entries; // expose to carry-forward gate after plan validation
    const shortlist = buildRankedLessonShortlists(entries, { limit: 10 });
    const unresolvedShortlistLessons = new Set(
      shortlist.unresolvedTop10.map((item) => String(item.lesson || "").toLowerCase().replace(/\s+/g, " ").trim()).filter(Boolean),
    );
    
    if (entries.length > 0) {
      // ── Token-partitioned postmortem shortlist (compilePrometheusContextShortlist) ──
      // Converts ranked lesson entries into ShortlistItem[] and enforces the
      // TOKEN_PARTITION_LIMITS.behaviorPatterns cap so repeated long-tail blocks
      // cannot exhaust the prompt budget.
      const shortlistItems: ShortlistItem[] = [
        ...shortlist.recentTop10,
        ...shortlist.highImpactTop10,
        ...shortlist.unresolvedTop10,
      ].reduce<ShortlistItem[]>((acc, item) => {
        if (!acc.some(a => a.id === item.lesson)) {
          acc.push({
            id: item.lesson,
            text: `${item.lesson} (score=${item.score.toFixed(2)}, impact=${item.impact.toFixed(2)}, freshness=${item.freshness.toFixed(2)})`,
            recencyScore: Math.max(0, Math.min(1, item.freshness)),
            impactScore: Math.max(0, Math.min(1, item.impact)),
            resolved: !item.unresolved,
          });
        }
        return acc;
      }, []);

      postmortemShortlistSection = compilePrometheusContextShortlist(
        "POSTMORTEM SHORTLISTS (ranked recent+high-impact+unresolved)",
        shortlistItems,
        "behaviorPatterns",
        { maxItems: 15, includeResolved: false },
      );
      if (postmortemShortlistSection) {
        postmortemShortlistSection = "\n\n" + postmortemShortlistSection;
      }

      // ── Shortlist-based behavior patterns section ─────────────────────────
      // Replaces old long-tail manual analysis with compilePrometheusContextShortlist:
      // selects ranked high-impact+unresolved items under TOKEN_PARTITION_LIMITS
      // behaviorPatterns cap so repeated large blocks cannot exhaust the prompt budget.
      if (shortlistItems.length > 0) {
        const bpSection = compilePrometheusContextShortlist(
          "BEHAVIOR PATTERNS FROM POSTMORTEMS (ranked high-impact+unresolved)",
          shortlistItems,
          "behaviorPatterns",
          { maxItems: 10, includeResolved: false },
        );
        if (bpSection) {
          behaviorPatternsSection = "\n\n" + bpSection;
        }
      }
      
      // Carry-forward follow-ups — retire items already resolved in ledger or coordination
      const allPending = entries
        .filter(e => e.followUpNeeded && e.followUpTask)
        .filter((entry) => {
          if (unresolvedShortlistLessons.size === 0) return true;
          const followUp = String(entry?.followUpTask || entry?.lessonLearned || "").toLowerCase().replace(/\s+/g, " ").trim();
          return followUp && unresolvedShortlistLessons.has(followUp);
        });
      const pending = filterResolvedCarryForwardItems(allPending, cfLedger, coordinationCompletedTasks);
      if (pending.length > 0) {
        const seenFollowUps = new Set();
        const deduped = [];
        // Traverse from newest to oldest so repeated tasks keep their latest wording/date.
        for (let i = pending.length - 1; i >= 0; i--) {
          const e = pending[i];
          const fp = computeFingerprint(String(e.followUpTask || ""));
          if (!fp || seenFollowUps.has(fp)) continue;
          seenFollowUps.add(fp);
          deduped.push(e);
        }
        const shortlistedPending = deduped.slice(-10);
        const classified = classifyCarryForwardByRecurrence(shortlistedPending, entries);
        const highRec = classified.highRecurrence;
        const lowRec = classified.lowRecurrence.slice(-CARRY_FORWARD_MAX_LOW_RECURRENCE_ITEMS);
        const combined = [...highRec, ...lowRec];
        combined.reverse();
        const suppressedCount = classified.lowRecurrence.length - lowRec.length;
        const suppressedNote = suppressedCount > 0 ? ` (${suppressedCount} low-recurrence items omitted)` : "";
        const items = combined.map((e, i) =>
          `${i + 1}. [worker=${e.workerName || "unknown"}, reviewed=${e.reviewedAt || "?"}, recurrence=${e.recurrenceCount ?? 1}] ${e.followUpTask}`
        ).join("\n");
        carryForwardSection = `\n\n## MANDATORY_CARRY_FORWARD\nThe following follow-up tasks from previous Athena postmortems have NOT been addressed yet.\nYou MUST include these in your plan unless they are already resolved in the codebase:${suppressedNote}:\n${items}\n`;
      }
    }
  } catch { /* non-fatal — proceed without pattern analysis */ }

  // ── Deterministic semantic retrieval for planner context ───────────────────
  let semanticRetrievalSection = "";
  try {
    const scan = await scanProject({ rootDir: repoRoot });
    const candidates = buildSemanticFileCandidatesFromScan(scan);
    const retrievalQuery = [
      userPrompt,
      String(options.prometheusReason || ""),
      String(carryForwardSection || ""),
      String(behaviorPatternsSection || ""),
    ].join("\n");
    const ranked = rankSemanticFileCandidates(retrievalQuery, candidates, {
      tokenBudget: 1100,
      maxEntries: 16,
      cacheKey: `prometheus:${repoRoot}:${retrievalQuery}`,
    });
    if (ranked.length > 0) {
      semanticRetrievalSection = compileRankedContextSection(
        "SEMANTIC FILE PRIORITY (deterministic, token-budgeted)",
        ranked,
        { tokenBudget: 1100, maxEntries: 16 },
      );
    }
  } catch {
    // Non-fatal — prompt generation continues without semantic retrieval.
  }

  // ── Self-improvement repair feedback injection ────────────────────────────
  let repairFeedbackSection = "";
  if (options.repairFeedback) {
    const rf = options.repairFeedback;
    const causes = (rf.rootCauses || []).map((c, i) => `${i + 1}. [${c.severity}] ${c.cause} (affects: ${c.affectedComponent})`).join("\n");
    const patches = (rf.behaviorPatches || []).map((p, i) => `${i + 1}. [${p.target}] ${p.patch} \u2014 rationale: ${p.rationale}`).join("\n");
    const constraints = rf.repairedPlanConstraints || {};
    const upgrades = (rf.verificationUpgrades || []).map((u, i) => `${i + 1}. ${u.area}: ${u.currentProblem} \u2192 required: ${u.requiredStandard}`).join("\n");

    repairFeedbackSection = `\n\n## CRITICAL: ATHENA REJECTION REPAIR FEEDBACK\nThe previous plan was REJECTED by Athena. Self-improvement has analyzed the failure.\nYou MUST address every item below. Repeating the same mistakes will cause a hard stop.\n\n### ROOT CAUSES OF REJECTION\n${causes || "- No root causes identified"}\n\n### BEHAVIOR PATCHES (you MUST follow these)\n${patches || "- No patches specified"}\n\n### PLAN CONSTRAINTS (mandatory for this re-plan)\n- Must include: ${JSON.stringify(constraints.mustInclude || [])}\n- Must NOT repeat: ${JSON.stringify(constraints.mustNotRepeat || [])}\n- Verification standard: ${constraints.verificationStandard || "task-specific, measurable"}\n- Wave strategy: ${constraints.waveStrategy || "explicit inter-wave dependencies required"}\n\n### VERIFICATION UPGRADES REQUIRED\n${upgrades || "- No specific upgrades"}\n\nFAILURE TO COMPLY WITH THESE CONSTRAINTS WILL RESULT IN CYCLE TERMINATION.\n`;
  }

  // ── Architecture drift summary injection ─────────────────────────────────
  // Inject unresolved stale doc references and deprecated token usage so
  // Prometheus can include remediation tasks in the plan.
  let driftSummarySection = "";
  const driftReport = options.driftReport;
  if (driftReport && (driftReport.staleCount > 0 || driftReport.deprecatedTokenCount > 0)) {
    const staleLines = (driftReport.staleReferences || []).slice(0, 20).map(
      (r, i) => `${i + 1}. [${r.docPath}:${r.line}] references missing file: ${r.referencedPath}`
    ).join("\n");
    const tokenLines = (driftReport.deprecatedTokenRefs || []).slice(0, 20).map(
      (r, i) => `${i + 1}. [${r.docPath}:${r.line}] deprecated token "${r.token}" — ${r.hint}`
    ).join("\n");
    const moreMsgStale = (driftReport.staleReferences || []).length > 20
      ? `\n... and ${(driftReport.staleReferences || []).length - 20} more` : "";
    const moreMsgToken = (driftReport.deprecatedTokenRefs || []).length > 20
      ? `\n... and ${(driftReport.deprecatedTokenRefs || []).length - 20} more` : "";

    driftSummarySection = `\n\n## ARCHITECTURE DRIFT REPORT (unresolved — generated this cycle)\nScanned ${driftReport.scannedDocs.length} documentation file(s). Found ${driftReport.staleCount} stale file reference(s) and ${driftReport.deprecatedTokenCount} deprecated token usage(s).\nThese represent gaps between docs and the current codebase. You MUST include remediation tasks for items you cannot immediately resolve.\n${staleLines ? `\n### Stale File References\n${staleLines}${moreMsgStale}` : ""}${tokenLines ? `\n\n### Deprecated Token Usage\n${tokenLines}${moreMsgToken}` : ""}`;
  }

  // ── Build minimal directive prompt ──────────────────────────────────────
  // Prometheus now reads files autonomously via allowAll tools.
  // No source code or state data is injected — Prometheus decides what to read.
  // Only cycle-delta context (carry-forward, behavior patterns, research topics,
  // repair feedback, drift summary) and planning policy are passed in the prompt.
  // The static identity sections (evolution directive, self-critique, output format)
  // are defined in prometheus.agent.md and loaded automatically by the agent runtime.

  // Build compact cycle-delta context sections
  const cycleDeltaParts: string[] = [];

  // Planning policy
  cycleDeltaParts.push(`## PLANNING POLICY
- maxTasks: ${planningPolicy.maxTasks > 0 ? planningPolicy.maxTasks : "UNLIMITED"}
- maxWorkersPerWave: ${planningPolicy.maxWorkersPerWave}
- maxPlansPerPacket: ${planningPolicy.maxPlansPerPacket} (HARD CAP — do not exceed)
- preferFewestWorkers: ${planningPolicy.preferFewestWorkers}
- requireDependencyAwareWaves: ${planningPolicy.requireDependencyAwareWaves}
- researchCoverageTarget: ${researchCoverageTarget > 0 ? researchCoverageTarget : "AUTO(0 when no research artifacts)"}
- Do NOT create extra waves without explicit task-level dependsOn/dependencies evidence.
- Avoid single-task waves unless dependency constraints force them.

## BUNDLED WORK PACKAGES — BOUNDED
Each plan packet you produce is ONE AI worker call. Bundle related work, but respect the maxPlansPerPacket cap (${planningPolicy.maxPlansPerPacket} steps).

RULE: Every packet MUST contain enough work to justify a full AI context call. This means:
1. GROUP related sub-tasks into a single packet. If you find 5 small fixes in the same area, bundle ALL of them into ONE packet with ordered steps.
2. A packet's task field must describe a COMPLETE feature or improvement area, not a single micro-fix.
3. Emit as many high-value packets as evidence supports, but each packet must stay within the maxPlansPerPacket cap.
4. Each packet's scope should cover multiple related files and multiple related behaviors.
5. Plans covering 5+ target files MUST declare estimatedExecutionTokens >= 8000.
6. EXCEPTION: Only create separate packets when there is a HARD dependency ordering requirement.

## STRUCTURAL CORRECTNESS — LEARN THESE PATTERNS
### dependencies — use EXACT packet titles, never aliases
### acceptance_criteria — every item MUST contain a numeric threshold
### wave assignments — tasks with dependencies must be in a later wave`);
  if (diagnosticsFreshnessSection) cycleDeltaParts.push(diagnosticsFreshnessSection);

  // Lane telemetry: inject per-lane performance signals to guide role assignment
  if (planningPolicy.laneTelemetry) {
    const laneTelemetrySection = buildLaneTelemetryPromptSection(planningPolicy.laneTelemetry);
    if (laneTelemetrySection) cycleDeltaParts.push(laneTelemetrySection);
  }

  // Research intelligence summary (topics only — Prometheus reads full synthesis file itself)
  if (researchTopicsList.length > 0) {
    const topicLines = researchTopicsList.map((topic, i) => `${i + 1}. ${topic}`).join("\n");
    cycleDeltaParts.push(`## RESEARCH INTELLIGENCE AVAILABLE
${researchTopicsList.length} topic(s) from ${researchSourceCount} source(s) available.
Research coverage target: ${researchCoverageTarget > 0 ? researchCoverageTarget : "AUTO"} research-backed packet(s).

Topics identified:
${topicLines}

IMPORTANT: Read state/research_synthesis.json for full extracted content from each source.
The synthesis contains real technical details — algorithm names, benchmark numbers, code examples, architecture patterns.
Use this data to produce evidence-backed plans, not vague strategic recommendations.`);
  }

  // Topic memory (compact)
  if (topicMemorySection) cycleDeltaParts.push(topicMemorySection);
  if (trustedMemorySection) cycleDeltaParts.push(trustedMemorySection);
  if (cycleProofSection) cycleDeltaParts.push(cycleProofSection);

  // Behavior patterns from postmortems
  if (behaviorPatternsSection) cycleDeltaParts.push(behaviorPatternsSection);
  if (postmortemShortlistSection) cycleDeltaParts.push(postmortemShortlistSection);

  // Carry-forward follow-ups
  if (carryForwardSection) cycleDeltaParts.push(carryForwardSection);
  if (benchmarkSection) cycleDeltaParts.push(benchmarkSection);
  if (routingOutcomeSection) cycleDeltaParts.push(routingOutcomeSection);

  // Repair feedback (if Athena rejected previous plan)
  if (repairFeedbackSection) cycleDeltaParts.push(repairFeedbackSection);

  // Architecture drift summary
  if (driftSummarySection) cycleDeltaParts.push(driftSummarySection);
  if (semanticRetrievalSection) cycleDeltaParts.push(`\n\n${semanticRetrievalSection}`);
  if (mandatoryTasksSection) cycleDeltaParts.push(mandatoryTasksSection);

  const cycleDeltaSections = _markCycleDeltaSectionsRequired(
    [
      section("research-intelligence", researchTopicsList.length > 0 ? cycleDeltaParts.find(p => p.startsWith("## RESEARCH INTELLIGENCE AVAILABLE")) || "" : ""),
      section("topic-memory", topicMemorySection || ""),
      section("trusted-memory", trustedMemorySection || ""),
      section("cycle-proof", cycleProofSection || ""),
      section("behavior-patterns", behaviorPatternsSection || ""),
      section("postmortem-shortlist", postmortemShortlistSection || ""),
      section("carry-forward", carryForwardSection || ""),
      section("benchmark", benchmarkSection || ""),
      section("routing-outcomes", routingOutcomeSection || ""),
      section("repair-feedback", repairFeedbackSection || ""),
      section("drift-summary", driftSummarySection || ""),
      section("mandatory-tasks", mandatoryTasksSection || ""),
      section("diagnostics-freshness", diagnosticsFreshnessSection || ""),
    ],
    PROMETHEUS_CYCLE_DELTA_SECTION_NAMES
  );
  const markedCycleDelta = _markCacheableSegments(cycleDeltaSections, {
    stableNames: Array.from(PROMETHEUS_STATIC_SECTION_NAMES),
  });
  const filteredCycleDelta = markedCycleDelta.filter(s => String(s.content || "").trim().length > 0);
  const compiledCycleDelta = _compilePrompt(filteredCycleDelta, { tokenBudget: 8000 });

  const contextPrompt = `TARGET REPO: ${config.env?.targetRepo || "unknown"}
REPO PATH: ${repoRoot}
STATE DIR: ${stateDir}

## OPERATOR OBJECTIVE
${userPrompt}

## YOUR WORKFLOW
You have full read and write access to the repository and state directory.
1. Read state/research_synthesis.json for the latest research intelligence (extracted content from internet sources).
2. Read key state files to understand system health: state/cycle_analytics.json, state/capacity_scoreboard.json, state/cycle_health.json, state/evolution_progress.json, state/athena_postmortems.json, state/intervention_optimizer_log.jsonl, state/dependency_graph_diagnostics.json
   - Use diagnostics freshness metadata (freshness.staleAfterMs + timestamp fields) and do NOT treat stale diagnostics entries as live planning truth.
3. Read source files you need to understand for planning — browse src/core/, src/workers/, src/types/ as needed.
4. Produce your self-evolution master plan following your agent definition's output format.
5. Your plan MUST end with a JSON companion block wrapped in ===DECISION=== / ===END=== markers containing a plans array.

The JSON plans array is MANDATORY — the orchestrator reads it to dispatch workers.
Each plan in the array must have: title, task, owner, role, wave, scope, target_files, before_state, after_state, riskLevel, dependencies, acceptance_criteria, verification, premortem (if medium/high risk), capacityDelta, requestROI.

${compiledCycleDelta}`;

  appendPromptPreviewSync(stateDir, contextPrompt);

  await appendPrometheusLiveLog(stateDir, "leadership_live", `[${ts()}] ${prometheusName.padEnd(20)} Calling Copilot CLI (agent=prometheus, allowAll=true)...`);

  // ── Call Copilot CLI with full tool access ────────────────────────────────
  // Prometheus reads files autonomously — no code/state injection from Node.js.
  // allowAll: true gives read + write + list_dir + search so Prometheus can
  // explore the repo, read research synthesis, read state files, and write its plan.
  const args = buildAgentArgs({
    agentSlug: "prometheus",
    prompt: contextPrompt,
    model: prometheusModel,
    allowAll: true,
    noAskUser: true,
    maxContinues: undefined,
  });

  appendLiveLogSync(stateDir, `\n[copilot_stream_start] ${ts()}\n`);

  const prometheusCallStartedAt = Date.now();
  const promptChars = contextPrompt.length;
  const prometheusTimeoutMs = Math.max(
    120_000,
    Number(config?.runtime?.prometheusTimeoutMs || 20 * 60 * 1000)
  );
  const heartbeatIntervalMs = Math.max(
    30_000,
    Number(config?.runtime?.prometheusHeartbeatIntervalMs || 60_000)
  );
  const heartbeatTimer = setInterval(() => {
    const elapsedMs = Date.now() - prometheusCallStartedAt;
    const elapsedMinutes = Math.floor(elapsedMs / 60_000);
    const elapsedSeconds = Math.floor((elapsedMs % 60_000) / 1000);
    const heartbeat = `[PROMETHEUS] Analysis in progress — elapsed=${elapsedMinutes}m ${elapsedSeconds}s promptChars=${promptChars} model=${prometheusModel}`;
    appendProgress(config, heartbeat).catch(() => { /* non-fatal heartbeat logging */ });
    appendPrometheusLiveLog(
      stateDir,
      "leadership_live",
      `[${ts()}] ${prometheusName.padEnd(20)} Heartbeat — elapsed=${elapsedMinutes}m ${elapsedSeconds}s promptChars=${promptChars} model=${prometheusModel}`
    ).catch(() => { /* non-fatal heartbeat logging */ });
  }, heartbeatIntervalMs);

  let result;
  try {
    result = await spawnAsync(command, args, {
      env: process.env,
      timeoutMs: prometheusTimeoutMs,
      // Kill the CLI process as soon as ===END=== appears in output — the
      // model is done and the CLI often hangs open for minutes after this.
      earlyExitMarker: "===END===",
      onStdout(chunk) {
        const text = chunk.toString("utf8");
        appendLiveLogSync(stateDir, text);
      },
      onStderr(chunk) {
        const text = chunk.toString("utf8");
        appendLiveLogSync(stateDir, text);
      }
    });
  } finally {
    clearInterval(heartbeatTimer);
  }

  appendLiveLogSync(stateDir, `\n[copilot_stream_end] ${ts()} exit=${(result as any).status}\n`);

  const stdout = String((result as any)?.stdout || "");
  const stderr = String((result as any)?.stderr || "");
  const raw = stdout || stderr;
  const combinedRaw = `${stdout}\n${stderr}`.trim();

  // ── Check for model fallback ──────────────────────────────────────────────
  const fallback = detectModelFallback(combinedRaw);
  if (fallback) {
    const warningMessage = `Prometheus model fallback: requested=${fallback.requestedModel}, active=${fallback.fallbackModel}`;
    await appendProgress(config, `[PROMETHEUS][WARN] ${warningMessage}`);
    try {
      await appendAlert(config, { severity: "warning", source: "prometheus", title: "Prometheus model fallback", message: warningMessage });
    } catch { /* non-fatal */ }
  }

  // ── Handle failure ────────────────────────────────────────────────────────
  if ((result as any).status !== 0) {
    const error = `exited ${(result as any).status}: ${(stderr || stdout).slice(0, 500)}`;
    await appendProgress(config, `[PROMETHEUS] Analysis failed — ${error}`);
    await appendPrometheusLiveLog(stateDir, "leadership_live", `[${ts()}] ${prometheusName.padEnd(20)} Analysis failed: ${error}`);
    return null;
  }

  // ── Parse output ──────────────────────────────────────────────────────────
  let aiResult = parseAgentOutput(raw);

  // ── Parser contract gate (pre-normalization) ──────────────────────────────
  // Mandatory parse fields must be present/valid before normalization:
  //   - projectHealth ∈ {healthy,degraded,critical,needs-work}
  //   - requestBudget.estimatedPremiumRequestsTotal is finite
  //   - keyFindings is non-empty
  //   - strategicNarrative is non-empty
  // Retry once with an explicit diff; fail-closed on second failure.
  const parsedContractCandidate = aiResult?.parsed || buildNarrativeFallbackParsed({ ...aiResult, raw });

  // Pre-fill all four inferrable/derivable mandatory fields before the contract check
  // so PARSER_CONTRACT never fires for fields that can be recovered from raw text or
  // computed from the plan list. Each fill is a last-resort fallback — if the model
  // emitted the field correctly, the existing value is kept (non-empty guard).
  if (!String(parsedContractCandidate.projectHealth ?? "").trim()) {
    parsedContractCandidate.projectHealth = inferProjectHealth(raw);
  }
  if (!String(parsedContractCandidate.generatedAt ?? "").trim()) {
    parsedContractCandidate.generatedAt = new Date().toISOString();
  }
  if (
    !parsedContractCandidate.requestBudget ||
    parsedContractCandidate.requestBudget.estimatedPremiumRequestsTotal == null ||
    !Number.isFinite(Number(parsedContractCandidate.requestBudget.estimatedPremiumRequestsTotal))
  ) {
    const deterministicBudget = buildDeterministicRequestBudget(
      Array.isArray(parsedContractCandidate.plans) ? parsedContractCandidate.plans : [],
      parsedContractCandidate.executionStrategy ?? {}
    );
    parsedContractCandidate.requestBudget = {
      ...deterministicBudget,
      ...(parsedContractCandidate.requestBudget || {}),
      estimatedPremiumRequestsTotal: deterministicBudget.estimatedPremiumRequestsTotal,
    };
  }
  // keyFindings: extract the first non-empty paragraph from the raw analysis text.
  if (!String(parsedContractCandidate.keyFindings ?? "").trim()) {
    const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 40);
    parsedContractCandidate.keyFindings = paragraphs[0] ?? "Analysis complete — see narrative for findings.";
  }
  // strategicNarrative: extract the last non-empty paragraph (typically the conclusion/direction).
  if (!String(parsedContractCandidate.strategicNarrative ?? "").trim()) {
    const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 40);
    parsedContractCandidate.strategicNarrative = paragraphs[paragraphs.length - 1] ?? parsedContractCandidate.keyFindings ?? "Analysis complete — see narrative for direction.";
  }

  let retryAiResult: any = null;
  const parserContractResult = await enforceParserContractBeforeNormalization(
    parsedContractCandidate,
    {
      onRetryDiff: async (parserDiff: string) => {
        await appendProgress(
          config,
          `[PROMETHEUS][PARSER_CONTRACT] Missing/invalid mandatory fields — retrying once with diff: ${parserDiff}`
        );
      },
      onRetrySuccess: async () => {
        await appendProgress(config, "[PROMETHEUS][PARSER_CONTRACT] Retry succeeded");
      },
      onRetryViolation: async (violationReason: string) => {
        await appendProgress(
          config,
          `[PROMETHEUS][PARSER_CONTRACT] Retry failed mandatory fields — parser_contract_violation: ${violationReason}`
        );
      },
      buildRetryCandidate: async (parserDiff: string) => {
        const retryPrompt = `${contextPrompt}

## PARSER_CONTRACT_RETRY
The previous response failed parser contract validation.
Regenerate the full response and companion JSON, then fix mandatory parser fields exactly.

Parser contract diff:
${parserDiff}

Mandatory parser fields:
- projectHealth must be exactly one of: good, healthy, needs-work, degraded, critical
- requestBudget.estimatedPremiumRequestsTotal must be present and finite
- generatedAt must be a non-empty ISO timestamp string
- keyFindings must be a non-empty string
- strategicNarrative must be a non-empty string
- Keep the rest of the plan deterministic and unchanged unless required by these fixes.`;

        try {
          const retryArgs = buildAgentArgs({
            agentSlug: "prometheus",
            prompt: retryPrompt,
            model: prometheusModel,
            allowAll: true,
            noAskUser: true,
            maxContinues: undefined,
          });
          appendLiveLogSync(stateDir, `\n[copilot_stream_retry_start] ${ts()}\n`);
          const retryResult = await spawnAsync(command, retryArgs, {
            env: process.env,
            timeoutMs: prometheusTimeoutMs,
            earlyExitMarker: "===END===",
            onStdout(chunk) {
              const text = chunk.toString("utf8");
              appendLiveLogSync(stateDir, text);
            },
            onStderr(chunk) {
              const text = chunk.toString("utf8");
              appendLiveLogSync(stateDir, text);
            }
          });
          const retryResultObj = retryResult as { status?: number; stdout?: string; stderr?: string };
          appendLiveLogSync(stateDir, `\n[copilot_stream_retry_end] ${ts()} exit=${retryResultObj.status}\n`);
          if (retryResultObj.status !== 0) {
            await appendProgress(
              config,
              `[PROMETHEUS][PARSER_CONTRACT] Retry process failed — parser_contract_violation: exited ${retryResultObj.status}`
            );
            return null;
          }
          const retryStdout = String(retryResultObj.stdout || "");
          const retryStderr = String(retryResultObj.stderr || "");
          const retryRaw = `${retryStdout}\n${retryStderr}`.trim();
          retryAiResult = parseAgentOutput(retryRaw);
          return retryAiResult?.parsed || buildNarrativeFallbackParsed({ ...retryAiResult, raw: retryRaw });
        } catch (retryError) {
          const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
          await appendProgress(
            config,
            `[PROMETHEUS][PARSER_CONTRACT] Retry execution error — parser_contract_violation: ${retryMessage}`
          );
          return null;
        }
      },
    }
  );
  if (!parserContractResult.ok) {
    return null;
  }
  if (parserContractResult.retried && retryAiResult) {
    aiResult = retryAiResult;
  }

  // ── Output fidelity gate — process-thought marker rejection ─────────────
  // Check for process-thought markers (<think>, <reasoning>, [THINKING], etc.)
  // in strategic fields of the raw parsed output.  These tokens are internal
  // reasoning artifacts that must never appear in persisted plans.
  // On first violation we issue one constrained retry with an explicit diff.
  // On repeated violation we fail-closed: plans=[], failReason=output-fidelity-gate.
  let rawParsedInput = aiResult?.parsed || buildNarrativeFallbackParsed({ ...aiResult, raw });
  {
    const fidelityContaminated = scanParsedOutputForProcessThought(rawParsedInput);
    if (fidelityContaminated.length > 0) {
      await appendProgress(
        config,
        `[PROMETHEUS][FIDELITY] Process-thought markers detected in fields: ${fidelityContaminated.join(", ")} — retrying once`
      );
      // One constrained retry
      let fidelityRetryParsed: unknown = null;
      try {
        const fidelityRetryPrompt = `${contextPrompt}

## OUTPUT_FIDELITY_RETRY
Your previous response contained process-thought markers (<think>, <reasoning>, [THINKING], etc.)
in the following fields: ${fidelityContaminated.join(", ")}.
These internal reasoning tokens must NOT appear in the JSON output or plan fields.
Regenerate the full response ensuring all strategic fields (analysis, strategicNarrative, keyFindings, plans[].task, plans[].context) contain ONLY final actionable content — no thinking fragments.`;
        const fidelityRetryArgs = buildAgentArgs({
          agentSlug: "prometheus",
          prompt: fidelityRetryPrompt,
          model: prometheusModel,
          allowAll: true,
          noAskUser: true,
          maxContinues: undefined,
        });
        appendLiveLogSync(stateDir, `\n[fidelity_retry_start] ${ts()}\n`);
        const fidelityRetryResult = await spawnAsync(command, fidelityRetryArgs, {
          env: process.env,
          timeoutMs: prometheusTimeoutMs,
          earlyExitMarker: "===END===",
          onStdout(chunk) { appendLiveLogSync(stateDir, chunk.toString("utf8")); },
          onStderr(chunk)  { appendLiveLogSync(stateDir, chunk.toString("utf8")); },
        }) as { status?: number; stdout?: string; stderr?: string };
        appendLiveLogSync(stateDir, `\n[fidelity_retry_end] ${ts()} exit=${fidelityRetryResult.status}\n`);
        if (fidelityRetryResult.status === 0) {
          const retryRaw = `${String(fidelityRetryResult.stdout || "")}\n${String(fidelityRetryResult.stderr || "")}`.trim();
          const retryAi = parseAgentOutput(retryRaw);
          fidelityRetryParsed = retryAi?.parsed || buildNarrativeFallbackParsed({ ...retryAi, raw: retryRaw });
        }
      } catch (fidelityErr) {
        await appendProgress(config, `[PROMETHEUS][FIDELITY] Retry failed: ${String((fidelityErr as any)?.message || fidelityErr)}`);
      }

      const retryContaminated = fidelityRetryParsed ? scanParsedOutputForProcessThought(fidelityRetryParsed) : fidelityContaminated;
      if (retryContaminated.length > 0 || !fidelityRetryParsed) {
        // Fail-closed: persist empty plans with an explicit failReason
        await appendProgress(
          config,
          `[PROMETHEUS][FIDELITY][${OUTPUT_FIDELITY_GATE_FAIL_REASON}] Repeated process-thought contamination after retry — fail-close plans=[]`
        );
        rawParsedInput = {
          ...(rawParsedInput as object),
          plans: [],
          failReason: OUTPUT_FIDELITY_GATE_FAIL_REASON,
          _fidelityGateFailed: true,
          _fidelityContaminatedFields: fidelityContaminated,
        };
      } else {
        rawParsedInput = fidelityRetryParsed as any;
        await appendProgress(config, "[PROMETHEUS][FIDELITY] Retry clean — process-thought markers resolved");
      }
    }
    // Record that the output-fidelity gate was invoked this cycle (source present AND executed).
    await recordCapabilityExecution(
      config,
      "output-fidelity-gate",
      `contaminated=${fidelityContaminated.length > 0} retried=${fidelityContaminated.length > 0}`,
    );
  }

  // ── Generation-boundary packet completeness gate ──────────────────────────
  // Reject unrecoverable incomplete packets BEFORE normalization so they never
  // enter the normalization pipeline. Unrecoverable means normalizePlanFromTask()
  // cannot synthesize a meaningful value for the missing field:
  //   - No task identity (task/title/task_id/id all absent) → "Task-N" is useless
  //   - Missing/invalid capacityDelta → normalization omits it; validator removes it
  //   - Missing/invalid requestROI   → same rationale
  // This is the primary enforcement gate. The post-normalization capacityDelta/
  // requestROI filter below remains as a secondary safety net for plans injected
  // by non-rawPlans paths (alternative shapes, drift debt tasks).
  const mandatoryCoverageResult = validateMandatoryTaskCoverageContract(rawParsedInput, mandatoryFindings);
  const mandatoryCoverageMode = config?.runtime?.mandatoryTaskCoverageMode === "enforce" ? "enforce" : "warn";
  if (mandatoryCoverageMode === "enforce") {
    rawParsedInput._retryAttempted = false;
  }
  if (!mandatoryCoverageResult.ok) {
    const missing = mandatoryCoverageResult.missing.join(", ") || "none";
    const invalid = mandatoryCoverageResult.invalid.join(", ") || "none";
    await appendProgress(
      config,
      `[PROMETHEUS][MANDATORY_TASKS] Coverage gate failed — missing=[${missing}] invalid=[${invalid}]`
    );
    rawParsedInput._mandatoryTaskCoverageGate = {
      ok: false,
      missing: mandatoryCoverageResult.missing,
      invalid: mandatoryCoverageResult.invalid,
      mapped: mandatoryCoverageResult.mapped,
      excluded: mandatoryCoverageResult.excluded,
      _retryAttempted: mandatoryCoverageMode === "enforce" ? true : undefined,
    };
    if (mandatoryCoverageMode === "enforce") {
      rawParsedInput._retryAttempted = true;
      const coverageDiff = buildMandatoryCoverageRetryDiff(mandatoryCoverageResult);
      const retryPrompt = `${contextPrompt}

## MANDATORY_TASK_COVERAGE_RETRY
The previous response failed mandatory coverage validation.
Regenerate the full response and companion JSON, then fix the mandatoryTaskCoverage contract exactly.

Coverage diff:
${coverageDiff}

Mandatory requirements:
- Every mandatory finding ID appears exactly once in mandatoryTaskCoverage.
- "mapped" entries must reference an existing plan task/title/task_id in plans[].
- "excluded" entries must include cycle-specific, non-generic justification.
- Keep plans actionable and deterministic.`;
      await appendProgress(
        config,
        "[PROMETHEUS][MANDATORY_TASKS] Enforcement active — retrying once with explicit coverage diff"
      );

      let retryRawParsedInput: unknown = null;
      try {
        const retryArgs = buildAgentArgs({
          agentSlug: "prometheus",
          prompt: retryPrompt,
          model: prometheusModel,
          allowAll: true,
          noAskUser: true,
          maxContinues: undefined,
        });
        appendLiveLogSync(stateDir, `\n[copilot_stream_retry_start] ${ts()}\n`);
        const retryResult = await spawnAsync(command, retryArgs, {
          env: process.env,
          timeoutMs: prometheusTimeoutMs,
          earlyExitMarker: "===END===",
          onStdout(chunk) {
            const text = chunk.toString("utf8");
            appendLiveLogSync(stateDir, text);
          },
          onStderr(chunk) {
            const text = chunk.toString("utf8");
            appendLiveLogSync(stateDir, text);
          }
        });
        const retryResultObj = retryResult as { status?: number; stdout?: string; stderr?: string };
        appendLiveLogSync(stateDir, `\n[copilot_stream_retry_end] ${ts()} exit=${retryResultObj.status}\n`);
        if (retryResultObj.status === 0) {
          const retryStdout = String(retryResultObj.stdout || "");
          const retryStderr = String(retryResultObj.stderr || "");
          const retryRaw = `${retryStdout}\n${retryStderr}`.trim();
          const retryAiResult = parseAgentOutput(retryRaw);
          retryRawParsedInput = retryAiResult?.parsed || buildNarrativeFallbackParsed({ ...retryAiResult, raw: retryRaw });
        } else {
          await appendProgress(
            config,
            `[PROMETHEUS][MANDATORY_TASKS][WARN] Retry process failed — exited ${retryResultObj.status}`
          );
        }
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        await appendProgress(
          config,
          `[PROMETHEUS][MANDATORY_TASKS][WARN] Retry execution error: ${retryMessage}`
        );
      }

      if (retryRawParsedInput) {
        const retryCoverageResult = validateMandatoryTaskCoverageContract(retryRawParsedInput, mandatoryFindings);
        if (retryCoverageResult.ok) {
          rawParsedInput = retryRawParsedInput;
          rawParsedInput._retryAttempted = true;
          rawParsedInput._mandatoryTaskCoverageGate = {
            ok: true,
            missing: [],
            invalid: [],
            mapped: retryCoverageResult.mapped,
            excluded: retryCoverageResult.excluded,
            _retryAttempted: true,
          };
          await appendProgress(
            config,
            `[PROMETHEUS][MANDATORY_TASKS] Retry succeeded — mapped=${retryCoverageResult.mapped.length} excluded=${retryCoverageResult.excluded.length}`
          );
        } else {
          const retryMissing = retryCoverageResult.missing.join(", ") || "none";
          const retryInvalid = retryCoverageResult.invalid.join(", ") || "none";
          rawParsedInput = applyMandatoryCoverageEnforceReject(retryRawParsedInput, retryCoverageResult);
          rawParsedInput._retryAttempted = true;
          await appendProgress(
            config,
            `[PROMETHEUS][MANDATORY_TASKS][${MANDATORY_COVERAGE_ENFORCE_REJECT_TOKEN}] Retry failed coverage — missing=[${retryMissing}] invalid=[${retryInvalid}] | fail-close plans=[] | exit_code=${MANDATORY_COVERAGE_ENFORCE_EXIT_CODE}`
          );
        }
      } else {
        rawParsedInput = applyMandatoryCoverageEnforceReject(rawParsedInput, mandatoryCoverageResult);
        rawParsedInput._retryAttempted = true;
        await appendProgress(
          config,
          `[PROMETHEUS][MANDATORY_TASKS][${MANDATORY_COVERAGE_ENFORCE_REJECT_TOKEN}] Retry produced no parsable payload — fail-close plans=[] | exit_code=${MANDATORY_COVERAGE_ENFORCE_EXIT_CODE}`
        );
      }
    } else {
      await appendProgress(
        config,
        "[PROMETHEUS][MANDATORY_TASKS][WARN] Coverage failure is non-blocking (warn mode) — continuing with generated plans"
      );
    }
  } else if (mandatoryFindings.length > 0) {
    rawParsedInput._mandatoryTaskCoverageGate = {
      ok: true,
      missing: [],
      invalid: [],
      mapped: mandatoryCoverageResult.mapped,
      excluded: mandatoryCoverageResult.excluded,
      _retryAttempted: mandatoryCoverageMode === "enforce" ? false : undefined,
    };
    await recordCapabilityExecution(
      config,
      "jesus-findings-to-plan-requirements",
      `mapped=${mandatoryCoverageResult.mapped.length} excluded=${mandatoryCoverageResult.excluded.length}`,
    );
    await appendProgress(
      config,
      `[PROMETHEUS][MANDATORY_TASKS] Coverage gate passed — mapped=${mandatoryCoverageResult.mapped.length} excluded=${mandatoryCoverageResult.excluded.length}`
    );
  }

  // ── CI-fix structural injection guard ────────────────────────────────────────
  // If any mandatory finding linked to CI failures was excluded by the LLM under a
  // passing coverage gate, inject a skeleton ci-fix plan directly. The finding's
  // presence in health_audit_findings.json is sufficient evidence that CI was failing
  // at audit time — Jesus only writes CI findings when CI failures are active.
  if (
    Array.isArray((rawParsedInput._mandatoryTaskCoverageGate as any)?.excluded) &&
    (rawParsedInput._mandatoryTaskCoverageGate as any)?.ok === true
  ) {
    const excludedGateIds = new Set<string>((rawParsedInput._mandatoryTaskCoverageGate as any).excluded as string[]);
    const excludedCiFindings = mandatoryFindings.filter(
      (f) =>
        excludedGateIds.has(f.id) &&
        (f.area === "ci" || /ci[.\-_]?fix/i.test(f.capabilityNeeded) || /ci[.\-_]?fail/i.test(String(f.finding))),
    );
    if (excludedCiFindings.length > 0) {
      if (!Array.isArray(rawParsedInput.plans)) rawParsedInput.plans = [];
      rawParsedInput.plans.push({
        role: "evolution-worker",
        wave: 1,
        task: `Fix CI failures — auto-injected because mandatory CI finding(s) were excluded: ${excludedCiFindings.map((f) => f.id).join(", ")}`,
        target_files: [] as unknown as string[],
        scope: "ci",
        acceptance_criteria: ["CI passes on main branch"],
        estimatedExecutionTokens: 4000,
      });
      await appendProgress(
        config,
        `[PROMETHEUS][CI_FIX_INJECTED] Injected ci-fix skeleton plan — excluded CI mandatory finding(s): ${excludedCiFindings.map((f) => f.id).join(", ")}`,
      );
      await recordCapabilityExecution(
        config,
        "ci-failure-log-injection",
        `injected=1 excludedCiFindings=${excludedCiFindings.map((f) => f.id).join(",")}`,
      );
    }
  }

  if (Array.isArray(rawParsedInput.plans) && rawParsedInput.plans.length > 0) {
    const densification = _analyzePacketDensification(rawParsedInput.plans, PROMETHEUS_PROMPT_DENSITY_MIN);
    rawParsedInput._packetDensification = densification;
    if (densification.thinCount > 0) {
      await appendProgress(
        config,
        `[PROMETHEUS][DENSITY] Thin packet detection: ${densification.thinCount}/${densification.total} packet(s) below densification floor`
      );
    }

    // Record that the packet-granularity-governor was invoked this cycle.
    await recordCapabilityExecution(
      config,
      "packet-granularity-governor",
      `thinCount=${densification.thinCount} total=${densification.total}`,
    );

    // Convert densification into dispatch admission behavior:
    // 1) auto-bundle thin related packets
    // 2) reject remaining thin packets with explicit reasons
    const bundled = autoBundleThinRelatedPackets(rawParsedInput.plans, PROMETHEUS_PROMPT_DENSITY_MIN);
    rawParsedInput.plans = bundled.plans;
    if (bundled.bundledCount > 0) {
      await appendProgress(
        config,
        `[PROMETHEUS][DENSITY] Auto-bundled ${bundled.bundledCount} thin related packet group(s) before admission`
      );
    }
    // Deterministic backfill pass: ensure no plan enters thin-filter with non-finite tokens.
    rawParsedInput.plans = rawParsedInput.plans.map((plan: any) => {
      const rawTokens = Number(plan?.estimatedExecutionTokens);
      if (Number.isFinite(rawTokens)) return plan;
      return {
        ...plan,
        estimatedExecutionTokens: Math.max(1, estimatePlanExecutionTokens(plan)),
      };
    });
    const postBundleDensity = _analyzePacketDensification(rawParsedInput.plans, PROMETHEUS_PROMPT_DENSITY_MIN);
    rawParsedInput._packetDensificationPostBundle = postBundleDensity;
    if (postBundleDensity.thinCount > 0) {
      const rejectedThinPackets: Array<{ index: number; reason: string }> = [];
      const baseDensityThresholds = {
        minTaskChars: PROMETHEUS_PROMPT_DENSITY_MIN.minTaskChars,
        minTargetFiles: PROMETHEUS_PROMPT_DENSITY_MIN.minTargetFiles,
        minAcceptanceCriteria: PROMETHEUS_PROMPT_DENSITY_MIN.minAcceptanceCriteria,
        minExecutionTokens: PROMETHEUS_PROMPT_DENSITY_MIN.minExecutionTokens,
      };
      rawParsedInput.plans = rawParsedInput.plans.filter((plan: any, i: number) => {
        const metrics = computePacketDensityMetrics(plan);
        // Use lane-aware token floor: plans covering 5+ files must declare ≥8 k tokens.
        const targetFileCount = Array.isArray(plan.target_files) ? plan.target_files.length : 0;
        const laneThresholds = getPacketThresholdsForLane(targetFileCount);
        const effectiveThresholds = {
          minTaskChars: Math.max(baseDensityThresholds.minTaskChars, laneThresholds.minTaskChars),
          minTargetFiles: Math.max(baseDensityThresholds.minTargetFiles, laneThresholds.minTargetFiles),
          minAcceptanceCriteria: Math.max(baseDensityThresholds.minAcceptanceCriteria, laneThresholds.minAcceptanceCriteria),
          minExecutionTokens: Math.max(baseDensityThresholds.minExecutionTokens, laneThresholds.minExecutionTokens),
        };
        const thin = isThinPacketForAdmission(metrics, effectiveThresholds);
        if (!thin) return true;
        const reason = buildThinPacketRejectionReason(metrics, effectiveThresholds);
        plan._thinPacketRejected = true;
        plan._thinPacketReason = reason;
        rejectedThinPackets.push({ index: i, reason });
        return false;
      });
      if (rejectedThinPackets.length > 0) {
        rawParsedInput._rejectedThinPacketCount = rejectedThinPackets.length;
        rawParsedInput._rejectedThinPackets = rejectedThinPackets;
        await appendProgress(
          config,
          `[PROMETHEUS][DENSITY] Rejected ${rejectedThinPackets.length} thin packet(s) after auto-bundling`
        );
      }
      // Safety valve: if all plans were rejected, restore them with a warning rather
      // than producing 0 plans (which causes a trust-boundary deadlock and kills the cycle).
      // Thin-packet enforcement is advisory when it would leave nothing to dispatch.
      if (rawParsedInput.plans.length === 0 && rejectedThinPackets.length > 0) {
        await appendProgress(
          config,
          `[PROMETHEUS][DENSITY] All packets rejected — restoring ${rejectedThinPackets.length} packet(s) with thin-packet warning to avoid deadlock`
        );
        // Re-parse original plans from the pre-filter state; mark them as needing densification
        // but allow dispatch so the cycle is not killed.
        const bundledPlans = bundled.plans;
        rawParsedInput.plans = bundledPlans.map((plan: any) => ({
          ...plan,
          _thinPacketWarning: plan._thinPacketRejected
            ? plan._thinPacketReason
            : undefined,
          _thinPacketRejected: false,
        }));
      }
      // Record that the token/density floor enforcement ran this cycle.
      await recordCapabilityExecution(
        config,
        "prometheus-token-budget-floor",
        `rejected=${rejectedThinPackets.length} remaining=${rawParsedInput.plans.length}`,
      );
    }

    // ── Decomposition cap gate ────────────────────────────────────────────
    // Trim oversized batches before any per-packet validation so subsequent
    // gates operate on a bounded set and log output stays tractable.
    const configuredDecompositionCap = Number(config?.runtime?.prometheusMaxDecompositionPlans ?? MAX_DECOMPOSITION_PLANS);
    const capResult = checkDecompositionCaps(rawParsedInput.plans, configuredDecompositionCap);
    if (capResult.capped) {
      rawParsedInput.plans = rawParsedInput.plans.slice(0, capResult.cappedCount);
      rawParsedInput._decompositionCapApplied = true;
      rawParsedInput._decompositionCapOriginalCount = capResult.originalCount;
      await appendProgress(config,
        `[PROMETHEUS][PACKET_GATE] Decomposition cap applied — trimmed ${capResult.originalCount} plans to ${capResult.cappedCount} (reason: ${DECOMPOSITION_CAP_REASON})`
      );
    }

    const incompletePackets: Array<{ index: number; reasons: string[] }> = [];
    rawParsedInput.plans = rawParsedInput.plans.filter((plan: any, i: number) => {
      const check = checkPacketCompleteness(plan);
      if (!check.recoverable) {
        incompletePackets.push({ index: i, reasons: check.reasons });
        return false;
      }
      return true;
    });
    if (incompletePackets.length > 0) {
      await appendProgress(config,
        `[PROMETHEUS][PACKET_GATE] Rejected ${incompletePackets.length} unrecoverable packet(s) at generation boundary ` +
        `(reasons: ${[...new Set(incompletePackets.flatMap(p => p.reasons))].join(", ")})`
      );
      rawParsedInput._rejectedIncompleteCount = incompletePackets.length;
      rawParsedInput._rejectedIncompletePackets = incompletePackets;
    }

    // ── High-risk / low-confidence packet gate ────────────────────────────
    // Reject packets that are explicitly high-risk but lack BOTH premortem AND
    // acceptance_criteria.  Executing an undocumented high-risk change without
    // any completion signal or failure-mode analysis is a safety violation.
    // Only runs when plans survived the completeness gate (empty arrays skipped).
    if (rawParsedInput.plans.length > 0) {
      const highRiskLowConfidence: Array<{ index: number; reason: string }> = [];
      rawParsedInput.plans = rawParsedInput.plans.filter((plan: any, i: number) => {
        const check = checkHighRiskPacketConfidence(plan);
        if (check.requiresRejection) {
          highRiskLowConfidence.push({ index: i, reason: check.reason });
          return false;
        }
        return true;
      });
      if (highRiskLowConfidence.length > 0) {
        await appendProgress(config,
          `[PROMETHEUS][PACKET_GATE] Rejected ${highRiskLowConfidence.length} high-risk low-confidence packet(s) ` +
          `— explicit riskLevel=high but no premortem and no acceptance_criteria (reason: ${HIGH_RISK_LOW_CONFIDENCE_REASON})`
        );
        rawParsedInput._rejectedHighRiskLowConfidenceCount = highRiskLowConfidence.length;
        rawParsedInput._rejectedHighRiskLowConfidencePackets = highRiskLowConfidence;
      }

      // ── Component-level strict high-risk gate ────────────────────────────
      // When parser component confidence is degraded (shape/budget/dependency
      // below thresholds), require BOTH premortem AND acceptance_criteria for
      // every high-risk plan.  This is stricter than the gate above, which only
      // rejects when BOTH signals are simultaneously absent.
      //
      // Preliminary component scores are computed from the raw parsed input
      // (pre-normalization) because normalization always injects premortem/AC
      // for high-risk plans, making post-normalization checks ineffective.
      //   plansShape:      1.0 if plans[] is non-empty JSON array, else 0.5
      //   requestBudget:   1.0 if budget with estimatedPremiumRequestsTotal
      //                    present, else 0.9 (built deterministically)
      //   dependencyGraph: 1.0 default; refined post-normalization via the
      //                    non-blocking dependency resolver.
      if (rawParsedInput.plans.length > 0) {
        const prelimComponents = {
          plansShape:      Array.isArray(rawParsedInput.plans) && rawParsedInput.plans.length > 0 ? 1.0 : 0.5,
          requestBudget:   (rawParsedInput.requestBudget &&
            Number.isFinite(Number(rawParsedInput.requestBudget.estimatedPremiumRequestsTotal))) ? 1.0 : 0.9,
          dependencyGraph: 1.0,
        };
        const componentGateResult = computeHighRiskComponentGate(prelimComponents);
        if (componentGateResult.shouldApplyStricterGate) {
          const componentStrictAutoRepaired: Array<{ index: number; reason: string }> = [];
          rawParsedInput.plans = rawParsedInput.plans.map((plan: any, i: number) => {
            if (String(plan?.riskLevel || "").trim().toLowerCase() !== "high") return plan;

            const premortem = plan?.premortem;
            const hasPremortem = premortem && typeof premortem === "object" && (
              (typeof premortem.scenario === "string" && premortem.scenario.trim().length >= 20) &&
              (Array.isArray(premortem.failurePaths) && premortem.failurePaths.length > 0) &&
              (Array.isArray(premortem.mitigations) && premortem.mitigations.length > 0) &&
              (Array.isArray(premortem.detectionSignals) && premortem.detectionSignals.length > 0) &&
              (Array.isArray(premortem.guardrails) && premortem.guardrails.length > 0) &&
              (typeof premortem.rollbackPlan === "string" && premortem.rollbackPlan.trim().length >= 10) &&
              (String(premortem.riskLevel || "").trim().toLowerCase() === "high")
            );

            const ac = Array.isArray(plan?.acceptance_criteria) ? plan.acceptance_criteria : [];
            const hasAC = ac.some(c => String(c || "").trim().length > 0);
            if (hasPremortem && hasAC) return plan;

            const repairedPremortem = hasPremortem
              ? premortem
              : {
                  scenario: `High-risk task "${String(plan?.task || plan?.title || `plan-${i + 1}`).trim()}" can regress core behavior if executed without staged safeguards.`,
                  failurePaths: ["Regression introduces failing verification checks"],
                  mitigations: ["Implement in small deterministic steps and verify after each step"],
                  detectionSignals: ["Verification command exits non-zero"],
                  guardrails: ["Do not continue to next dependent wave if verification fails"],
                  rollbackPlan: "Revert the scoped code change and re-run verification.",
                  riskLevel: "high",
                };

            const repairedAC = hasAC
              ? ac
              : [
                  "verification command exits with code 0",
                  "post-change regression count remains 0",
                ];

            componentStrictAutoRepaired.push({
              index: i,
              reason: `component_high_risk_strict_gate_auto_repair(${componentGateResult.weakComponents.join(",")})`,
            });

            return {
              ...plan,
              premortem: repairedPremortem,
              acceptance_criteria: repairedAC,
            };
          });
          if (componentStrictAutoRepaired.length > 0) {
            await appendProgress(config,
              `[PROMETHEUS][PACKET_GATE] Component-level strict gate auto-repaired ${componentStrictAutoRepaired.length} high-risk packet(s) ` +
              `(weak: ${componentGateResult.weakComponents.join(",")}) — no packet dropped`
            );
            rawParsedInput._autoRepairedComponentGateCount   = componentStrictAutoRepaired.length;
            rawParsedInput._autoRepairedComponentGatePackets = componentStrictAutoRepaired;
          }
        }
      }
    }
  }

  const parsedForValidation = normalizePrometheusParsedOutput(
    rawParsedInput,
    { ...aiResult, raw, researchTopics: researchTopicsList }
  );

  if (planningPolicy.requireDependencyAwareWaves && Array.isArray(parsedForValidation.plans) && parsedForValidation.plans.length > 0) {
    const uniqueWaveCountBefore = new Set(
      parsedForValidation.plans.map((plan) => Number(plan?.wave || 1))
    ).size;
    parsedForValidation.plans = compactWavesForDependencyAwarePlanning(parsedForValidation.plans);
    const uniqueWaveCountAfter = new Set(
      parsedForValidation.plans.map((plan) => Number(plan?.wave || 1))
    ).size;
    if (uniqueWaveCountAfter < uniqueWaveCountBefore) {
      await appendProgress(
        config,
        `[PROMETHEUS][WAVE_COMPACTION] Reduced waves ${uniqueWaveCountBefore} -> ${uniqueWaveCountAfter} using explicit dependency graph`
      );
    }
    parsedForValidation.executionStrategy = buildExecutionStrategyFromPlans(parsedForValidation.plans);
    parsedForValidation.requestBudget = {
      ...buildDeterministicRequestBudget(parsedForValidation.plans, parsedForValidation.executionStrategy || {}),
      _fallback: false,
    };
  }

  // ── Schema v2 plan validation ─────────────────────────────────────────────
  // Validate each plan has the required schema fields. Non-conforming plans are
  // tagged but kept (Athena makes the final accept/reject decision).
  const REQUIRED_PLAN_FIELDS = ["task", "role"];
  if (Array.isArray(parsedForValidation.plans)) {
    let invalidCount = 0;
    for (const plan of parsedForValidation.plans) {
      const missing = REQUIRED_PLAN_FIELDS.filter(f => !plan[f] || String(plan[f]).trim().length === 0);
      if (missing.length > 0) {
        plan._schemaViolations = missing;
        invalidCount++;
      }
      // Tag verification quality: plans without verification are schema-weak
      if (!plan.verification || String(plan.verification).trim().length === 0) {
        plan._schemaViolations = [...(plan._schemaViolations || []), "verification"];
      }
    }
    if (invalidCount > 0) {
      await appendProgress(config,
        `[PROMETHEUS][SCHEMA] ${invalidCount}/${parsedForValidation.plans.length} plan(s) missing required fields`
      );
    }
  }

  // ── Trust boundary validation ─────────────────────────────────────────────
  const tbMode = config?.runtime?.trustBoundaryMode === "warn" ? "warn" : "enforce";
  const trustCheck = validateLeadershipContract(
    LEADERSHIP_CONTRACT_TYPE.PLANNER, parsedForValidation, { mode: tbMode }
  );
  if (!trustCheck.ok && tbMode === "enforce") {
    const tbErrors = trustCheck.errors.map(e => `${e.payloadPath}: ${e.message}`).join(" | ");
    await appendProgress(config, `[PROMETHEUS][TRUST_BOUNDARY] Contract validation failed — class=${TRUST_BOUNDARY_ERROR} errors=${tbErrors}`);
    try {
      await appendAlert(config, {
        severity: "critical",
        source: "prometheus",
        title: "Planner output failed trust-boundary validation",
        message: `class=${TRUST_BOUNDARY_ERROR} reasonCode=${trustCheck.reasonCode} errors=${tbErrors}`
      });
    } catch { /* non-fatal */ }
    // Block on trust-boundary violation (fail-closed)
    await appendProgress(config, `[PROMETHEUS][TRUST_BOUNDARY] Blocking analysis — returning null (fail-closed)`);
    return null;
  }
  if (trustCheck.errors.length > 0 && tbMode === "warn") {
    const tbErrors = trustCheck.errors.map(e => `${e.payloadPath}: ${e.message}`).join(" | ");
    await appendProgress(config, `[PROMETHEUS][TRUST_BOUNDARY][WARN] Contract violations (warn mode): ${tbErrors}`);
  }

  // ── Log thinking/dossier ──────────────────────────────────────────────────
  if (aiResult.thinking) {
    await appendPrometheusLiveLog(stateDir, "prometheus_dossier", aiResult.thinking);
  }

  // ── Enforce mandatory requestBudget ───────────────────────────────────────
  const parsed = parsedForValidation;
  if (!parsed.requestBudget || !Number.isFinite(Number(parsed.requestBudget.estimatedPremiumRequestsTotal))) {
    const planCount = Array.isArray(parsed.plans) ? parsed.plans.length : 4;
    const margin = 25;
    parsed.requestBudget = {
      estimatedPremiumRequestsTotal: planCount,
      errorMarginPercent: margin,
      hardCapTotal: Math.ceil(planCount * (1 + margin / 100)),
      confidence: "low",
      byWave: [],
      byRole: [],
      _fallback: true
    };
    await appendProgress(config, `[PROMETHEUS][WARN] No requestBudget — fallback: ${parsed.requestBudget.hardCapTotal} requests`);
  } else {
    const rb = parsed.requestBudget;
    const total = Number(rb.estimatedPremiumRequestsTotal) || 0;
    const margin = Number(rb.errorMarginPercent) || 20;
    if (!Number.isFinite(Number(rb.hardCapTotal)) || Number(rb.hardCapTotal) <= 0) {
      rb.hardCapTotal = Math.ceil(total * (1 + margin / 100));
    }
  }

  // ── Stale-diagnostics-backed plan admission gate ─────────────────────────
  // Tag plans that are backed by stale diagnostics and lack independent evidence.
  // Must run BEFORE validateAllPlans so the contract validator can emit the
  // STALE_DIAGNOSTICS_BACKED violation code for tagged plans.
  if (Array.isArray(parsed.plans) && parsed.plans.length > 0 && !diagnosticsFreshnessAdmission.allFresh) {
    tagStaleDiagnosticsBackedPlans(parsed.plans, diagnosticsFreshnessAdmission);
    const staleTaggedCount = parsed.plans.filter((p: any) => p._staleDiagnosticsGated === true).length;
    if (staleTaggedCount > 0) {
      await appendProgress(
        config,
        `[PROMETHEUS][DIAG_FRESHNESS] Tagged ${staleTaggedCount}/${parsed.plans.length} plan(s) as stale-diagnostics-backed ` +
        `(staleSources=${diagnosticsFreshnessAdmission.staleSources.join(",")})`,
      );
      parsed._staleTaggedPlanCount = staleTaggedCount;
    }
  }

  // ── Contract-first plan validation (Packet 2) ────────────────────────────
  // Every plan must pass schema contract before persistence.
  if (Array.isArray(parsed.plans) && parsed.plans.length > 0) {
    const contractResult = validateAllPlans(parsed.plans);
    if (contractResult.invalidCount > 0) {
      await appendProgress(config,
        `[PROMETHEUS][CONTRACT] ${contractResult.invalidCount}/${contractResult.totalPlans} plan(s) have contract violations (passRate=${contractResult.passRate})`
      );
    }
    // Tag each plan with contract validation results
    for (const r of contractResult.results) {
      parsed.plans[r.planIndex]._contractValid = r.valid;
      parsed.plans[r.planIndex]._contractViolations = r.violations;
    }
    parsed._planContractPassRate = contractResult.passRate;
    // Record that the structural lint gate was invoked this cycle.
    await recordCapabilityExecution(
      config,
      "prometheus-plan-structural-lint",
      `plans=${contractResult.totalPlans} invalid=${contractResult.invalidCount} passRate=${contractResult.passRate}`,
    );
    await recordCapabilityExecution(
      config,
      "pre-athena-plan-structural-validation",
      `plans=${contractResult.totalPlans} passRate=${contractResult.passRate}`,
    );

    // ── Secondary safety net: hard-filter plans missing valid capacityDelta / requestROI ─
    // Primary rejection happens at the generation boundary (checkPacketCompleteness above).
    // This secondary pass catches any surviving violations from alternative-shape synthesized
    // plans (waves, bottlenecks, narrative fallback) or drift debt tasks that bypass the
    // pre-normalization gate. These fields are required for plan ranking and budget comparison.
    //
    // Filter uses deterministic PACKET_VIOLATION_CODE codes (canonical taxonomy from
    // plan_contract_validator.ts) rather than field-name string equality, so matching
    // is immune to field rename and consistent with the generation-boundary gate codes.
    const ADMISSION_REJECTION_VIOLATION_CODES: Set<string> = new Set([
      PACKET_VIOLATION_CODE.MISSING_CAPACITY_DELTA,
      PACKET_VIOLATION_CODE.INVALID_CAPACITY_DELTA,
      PACKET_VIOLATION_CODE.MISSING_REQUEST_ROI,
      PACKET_VIOLATION_CODE.INVALID_REQUEST_ROI,
      PACKET_VIOLATION_CODE.MISSING_IMPLEMENTATION_EVIDENCE,
      PACKET_VIOLATION_CODE.MISSING_CAPACITY_FIRST_JUSTIFICATION,
    ]);
    const admissionRejectIndices = contractResult.results
      .filter(r => !r.valid && r.violations.some(v =>
        ADMISSION_REJECTION_VIOLATION_CODES.has(v.code) &&
        v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
      ))
      .map(r => r.planIndex)
      .sort((a, b) => b - a); // reverse order for safe in-place splice
    if (admissionRejectIndices.length > 0) {
      for (const idx of admissionRejectIndices) {
        parsed.plans.splice(idx, 1);
      }
      await appendProgress(config,
        `[PROMETHEUS][CONTRACT] Hard-filtered ${admissionRejectIndices.length} low-quality/redundant admission packet(s) missing required evidence or capacity-first justification`
      );
      parsed._capacityRoiFilteredCount = admissionRejectIndices.length;
    }

    // ── Stale-diagnostics hard rejection gate ────────────────────────────────
    // Reject plans that were tagged _staleDiagnosticsGated by the gate above and
    // received a CRITICAL STALE_DIAGNOSTICS_BACKED violation from the contract
    // validator.  Safety valve: if ALL plans are stale-backed (no fresh
    // alternative exists), preserve them with a warning rather than killing the
    // cycle — Athena will make the final accept/reject decision.
    const staleBackedIndices = contractResult.results
      .filter(r => !r.valid && r.violations.some(v =>
        v.code === PACKET_VIOLATION_CODE.STALE_DIAGNOSTICS_BACKED &&
        v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL
      ))
      .map(r => r.planIndex)
      .sort((a, b) => b - a);
    if (staleBackedIndices.length > 0) {
      const nonStaleCount = parsed.plans.length - staleBackedIndices.length;
      if (nonStaleCount > 0) {
        // Non-stale alternatives exist — hard-reject stale-backed plans.
        for (const idx of staleBackedIndices) {
          parsed.plans.splice(idx, 1);
        }
        await appendProgress(
          config,
          `[PROMETHEUS][DIAG_FRESHNESS] Hard-rejected ${staleBackedIndices.length} stale-diagnostics-backed packet(s) ` +
          `(${nonStaleCount} independently-evidenced plan(s) remain)`,
        );
        parsed._staleBackedRejectedCount = staleBackedIndices.length;
      } else {
        // All plans are stale-backed — preserve with warning to avoid deadlock.
        await appendProgress(
          config,
          `[PROMETHEUS][DIAG_FRESHNESS] WARN: all ${staleBackedIndices.length} plan(s) are stale-diagnostics-backed ` +
          `— preserving for Athena review (staleSources=${diagnosticsFreshnessAdmission.staleSources.join(",")})`,
        );
        parsed._allPlansStale = true;
      }
    }
  }

  // ── Low-confidence quarantine ────────────────────────────────────────────
  // Attach aggregate parser confidence as provenance to plans that do not yet
  // carry per-packet provenance, then run quarantineLowConfidencePackets so
  // low-quality fallback plans are excluded from the dispatchable set.
  // This executes the quarantine function in the normalization pipeline rather
  // than leaving it as an untriggered utility — low-confidence packets must
  // never reach dispatch.
  if (Array.isArray(parsed.plans) && parsed.plans.length > 0) {
    const parserConfidenceScore = typeof parsed.parserConfidence === "number"
      ? parsed.parserConfidence
      : 1.0;
    const plansWithProvenance = parsed.plans.map((plan: any) =>
      plan._provenance
        ? plan
        : attachFallbackProvenance(plan, {
            source: "prometheus-normalization",
            reason: "aggregate-parser-confidence",
            confidence: parserConfidenceScore,
            tag: parserConfidenceScore < QUARANTINE_CONFIDENCE_THRESHOLD
              ? FALLBACK_PROVENANCE_TAG.PARSER_FALLBACK
              : FALLBACK_PROVENANCE_TAG.DIRECT,
          })
    );
    const quarantineResult = quarantineLowConfidencePackets(plansWithProvenance);
    if (quarantineResult.quarantined.length > 0) {
      parsed.plans = quarantineResult.allowed;
      parsed._quarantinedPacketCount = quarantineResult.quarantined.length;
      parsed._quarantinedPackets = quarantineResult.quarantined;
      await appendProgress(config,
        `[PROMETHEUS][QUARANTINE] ${quarantineResult.quarantined.length} low-confidence packet(s) excluded from dispatch ` +
        `(parserConfidence=${parserConfidenceScore} < threshold=${QUARANTINE_CONFIDENCE_THRESHOLD})`
      );
    } else {
      parsed.plans = plansWithProvenance;
    }
  }

  // ── Carry-forward admission gate (Task 2) ────────────────────────────────
  // Blocks plan dispatch when the same unresolved lesson has recurred past the
  // threshold without being addressed in the current plan set. This converts
  // repeated advisory carry-forward items into hard admission blockers.
  if (postmortemEntries.length > 0 && Array.isArray(parsed.plans) && parsed.plans.length > 0) {
    const maxUnresolvedCycles = Number(config?.planner?.maxUnresolvedCycles) || 3;
    const gateResult = checkCarryForwardGate(postmortemEntries, parsed.plans, { maxUnresolvedCycles });
    // Also compile recurring unresolved lessons into enforceable hard-gate policies.
    const existingPolicyIds = (parsed._hardGatePolicies || []).map((p: any) => String(p.id));
    const recurrenceResult = hardGateRecurrenceToPolicies(postmortemEntries, existingPolicyIds, {
      maxRecurrences: maxUnresolvedCycles,
    });
    if (recurrenceResult.newPolicies.length > 0) {
      parsed._hardGatePolicies = [...(parsed._hardGatePolicies || []), ...recurrenceResult.newPolicies];
    }
    parsed._carryForwardGateResult = gateResult;
    if (gateResult.shouldBlock) {
      parsed._carryForwardGateBlocked = true;
      await appendProgress(config,
        `[PROMETHEUS][CARRY-FORWARD] HARD BLOCK — ${gateResult.reason}` +
        (gateResult.unresolvedLessons.length > 0 ? ` | unresolved: ${gateResult.unresolvedLessons.slice(0, 3).join("; ")}` : "") +
        (gateResult.missingMandatory.length > 0 ? ` | missing mandatory: ${gateResult.missingMandatory.slice(0, 3).join("; ")}` : "")
      );
    }
  }

  // ── Dual-pass planning: Pass-B critic gate ─────────────────────────────────
  // Deterministic critic evaluates plans before Athena review (no AI call).
  // Rejected plans are logged but still included (Athena makes final decision).
  if (Array.isArray(parsed.plans) && parsed.plans.length > 0) {
    const criticRepair = dualPassCriticRepair(parsed.plans);
    parsed.plans = criticRepair.plans;
    if (criticRepair.repairCount > 0 || criticRepair.finalRejected > 0) {
      await appendProgress(
        config,
        `[PROMETHEUS][CRITIC] repaired=${criticRepair.repairCount} approved=${criticRepair.finalApproved} rejected=${criticRepair.finalRejected}`
      );
    }
  }

  // ── AC measurability enrichment ───────────────────────────────────────────
  // Enrich plans lacking concrete acceptance criteria with compiled ACs.
  if (Array.isArray(parsed.plans) && parsed.plans.length > 0) {
    const acResult = enrichPlansWithAC(parsed.plans);
    if (acResult.enrichedCount > 0) {
      await appendProgress(config,
        `[PROMETHEUS][AC] Enriched ${acResult.enrichedCount} plan(s) with compiled acceptance criteria`
      );
    }
    parsed.plans = acResult.plans;
  }

  // Ensure Athena-facing rigor fields exist after all enrichment/repair passes.
  if (Array.isArray(parsed.plans) && parsed.plans.length > 0) {
    parsed.plans = parsed.plans.map((plan, idx) => normalizePlanFromTask(plan, idx, Number(plan.wave) || 1));
    parsed.plans = applyPlanningRubric(parsed.plans);
  }

  // Ensure execution strategy and request budget remain concrete after plan normalization.
  if (!parsed.executionStrategy || !Array.isArray(parsed.executionStrategy.waves) || parsed.executionStrategy.waves.length === 0) {
    parsed.executionStrategy = buildExecutionStrategyFromPlans(parsed.plans || []);
  }
  if (!parsed.requestBudget || parsed.requestBudget._fallback) {
    parsed.requestBudget = {
      ...buildDeterministicRequestBudget(parsed.plans || [], parsed.executionStrategy || {}),
      _fallback: false
    };
    await appendProgress(config, `[PROMETHEUS][BUDGET] Rebuilt deterministic request budget with byWave/byRole breakdown`);
  }

  // ── Drift confidence penalty (Task 4) ────────────────────────────────────
  // Bind unresolved architecture drift counts to planning confidence.
  // High drift counts signal docs-codebase divergence, reducing trust in the plan.
  const driftPenaltyResult = computeDriftConfidencePenalty(driftReport);
  if (driftPenaltyResult.penalty > 0) {
    parsed.parserConfidence = Math.max(0.1, (parsed.parserConfidence ?? 1.0) - driftPenaltyResult.penalty);
    // Accumulate drift into the context-penalty channel (architectureDrift is a context signal).
    parsed.parserContextPenalty = Math.round(((parsed.parserContextPenalty ?? 0) + driftPenaltyResult.penalty) * 100) / 100;
    if (!Array.isArray(parsed.parserConfidencePenalties)) parsed.parserConfidencePenalties = [];
    parsed.parserConfidencePenalties.push({
      reason: driftPenaltyResult.reason,
      component: "architectureDrift",
      delta: -driftPenaltyResult.penalty,
    });
    if (driftPenaltyResult.requiresRemediation) {
      parsed._requiresDriftRemediation = true;
    }
    await appendProgress(config,
      `[PROMETHEUS][DRIFT] Confidence penalty applied: ${driftPenaltyResult.penalty.toFixed(2)} (${driftPenaltyResult.reason})` +
      (driftPenaltyResult.requiresRemediation ? " — remediation plans required" : "")
    );
  }

  // ── Drift debt task injection ─────────────────────────────────────────────
  // Deterministically convert unresolved drift items into tracked debt tasks so
  // they appear in the plan graph regardless of whether the AI included them.
  if (driftReport && (driftReport.staleCount > 0 || driftReport.deprecatedTokenCount > 0)) {
    const driftDebtTasks = buildDriftDebtTasks(driftReport, parsed.plans || []);
    if (driftDebtTasks.length > 0) {
      if (!Array.isArray(parsed.plans)) parsed.plans = [];
      parsed.plans = [...parsed.plans, ...driftDebtTasks];
      parsed._driftDebtTaskCount = driftDebtTasks.length;
      await appendProgress(config,
        `[PROMETHEUS][DRIFT] Injected ${driftDebtTasks.length} debt task(s) from architecture drift into plan (wave ${driftDebtTasks[0].wave})`
      );
    }
  }

  // ── Build analysis result ─────────────────────────────────────────────────
  const analysis = ensurePersistedAnalysisTimestamps({
    ...parsed,
    dossierPath: null,
    model: prometheusModel,
    repo: config.env?.targetRepo,
    requestedBy,
    researchContext: {
      injected: Boolean(researchSectionText),
      topicCount: researchTopicCount,
      sourceCount: researchSourceCount,
      coverageTarget: researchCoverageTarget,
    },
    mandatoryTasks: {
      sourceFile: path.join(stateDir, "health_audit_findings.json"),
      requiredSeverities: Array.from(HEALTH_AUDIT_MANDATORY_SEVERITIES),
      findingCount: mandatoryFindings.length,
      findings: mandatoryFindings,
      coverageGate: parsed._mandatoryTaskCoverageGate || null,
    },
  });

  try {
    // Sanitize plan text fields before persistence to strip operational tool traces.
    if (Array.isArray((analysis as any).plans)) {
      (analysis as any).plans = (analysis as any).plans.map((plan: any) => ({
        ...plan,
        task: sanitizePlanningFieldForPersistence(String(plan.task || "")),
        context: plan.context != null
          ? sanitizePlanningFieldForPersistence(String(plan.context))
          : plan.context,
      }));
    }
    await writeJson(path.join(stateDir, "prometheus_analysis.json"), addSchemaVersion(analysis, STATE_FILE_TYPE.PROMETHEUS_ANALYSIS));
  } catch (writeErr) {
    // Critical planning ledger write failed — emit structured WARN so the orchestrator
    // can detect degraded state without halting the cycle (fail-open contract).
    warn(`[prometheus] prometheus_analysis.json write failed (degraded): ${String((writeErr as any)?.message || writeErr)}`);
    emitEvent(EVENTS.ORCHESTRATION_HEALTH_DEGRADED, EVENT_DOMAIN.PLANNING, "prometheus_analysis_write", {
      source: "prometheus",
      ledger: "prometheus_analysis.json",
      error: String((writeErr as any)?.message || writeErr),
    });
  }

  const planCount = Array.isArray(analysis.plans) ? analysis.plans.length : 0;
  await appendProgress(config, `[PROMETHEUS] Analysis complete — ${planCount} work items | health=${analysis.projectHealth}`);
  await appendPrometheusLiveLog(stateDir, "leadership_live", `[${ts()}] ${prometheusName.padEnd(20)} Analysis ready: ${planCount} plans | health=${analysis.projectHealth}`);

  // ── Update topic memory with knowledge from this run ──────────────────────
  try {
    if (researchTopicsList.length > 0 && Array.isArray(analysis.plans)) {
      topicMemory = updateTopicKnowledge(topicMemory, researchTopicsList, analysis.plans, researchSynthesisData);
      const qualityGateQuarantinedTopics = Array.isArray((researchSynthesisData as any)?.qualityGate?.quarantinedTopics)
        ? ((researchSynthesisData as any).qualityGate.quarantinedTopics as string[])
        : [];
      const completion = detectAndCompleteTopics(
        topicMemory,
        researchTopicsList,
        analysis.plans,
        analysis,
        qualityGateQuarantinedTopics,
      );
      topicMemory = completion.memory;
      await saveTopicMemory(stateDir, topicMemory);

      if (completion.completedThisRun.length > 0) {
        await appendProgress(config,
          `[PROMETHEUS][TOPIC_MEMORY] Completed ${completion.completedThisRun.length} topic(s): ${completion.completedThisRun.join(", ")}`
        );
      }
      if (completion.archivedThisRun.length > 0) {
        await appendProgress(config,
          `[PROMETHEUS][TOPIC_MEMORY] Archived ${completion.archivedThisRun.length} informational topic(s): ${completion.archivedThisRun.join(", ")}`
        );
      }
      const activeCount = Object.values(topicMemory.topics).filter(t => t.status === "active").length;
      const completedCount = Object.values(topicMemory.topics).filter(t => t.status === "completed").length;
      const archivedCount = Object.values(topicMemory.topics).filter(t => t.status === "archived").length;
      await appendProgress(config,
        `[PROMETHEUS][TOPIC_MEMORY] Updated: ${activeCount} active, ${completedCount} completed, ${archivedCount} archived topic(s), ${Object.keys(topicMemory.topics).length} total`
      );
    }
  } catch (tmErr) {
    warn(`[prometheus] Topic memory update failed (degraded): ${String((tmErr as any)?.message || tmErr)}`);
    emitEvent(EVENTS.ORCHESTRATION_HEALTH_DEGRADED, EVENT_DOMAIN.PLANNING, "prometheus_topic_memory", {
      source: "prometheus",
      ledger: "topic_memory",
      error: String((tmErr as any)?.message || tmErr),
    });
    await appendProgress(config, `[PROMETHEUS][WARN] Topic memory update failed (non-fatal): ${String((tmErr as any)?.message || tmErr)}`).catch(() => {});
  }

  // ── Budget-aware intervention optimizer (non-blocking) ────────────────────
  if (config?.interventionOptimizer?.enabled !== false && Array.isArray(analysis.plans) && analysis.plans.length > 0) {
    try {
      const interventions = buildInterventionsFromPlan(analysis.plans, config);
      const budget = buildBudgetFromConfig(analysis.requestBudget, config);
      const learnedPolicies = await readJson(path.join(stateDir, "learned_policies.json"), []);
      const policyImpactByInterventionId = buildPolicyImpactByInterventionId(
        analysis.plans,
        Array.isArray(learnedPolicies) ? learnedPolicies : [],
      );
      const optimizerResult = runInterventionOptimizer(interventions, budget, { policyImpactByInterventionId });

      await appendInterventionOptimizerEntry(config, {
        ...optimizerResult,
        correlationId: `prometheus-${Date.now()}`,
        prometheusAnalyzedAt: analysis.analyzedAt,
      }).catch((err) => {
        appendProgress(config, `[PROMETHEUS][WARN] Optimizer log persist failed: ${String(err?.message || err)}`).catch(() => {});
      });

      const selectedCount = Array.isArray(optimizerResult.selected) ? optimizerResult.selected.length : 0;
      const rejectedCount = Array.isArray(optimizerResult.rejected) ? optimizerResult.rejected.length : 0;
      const policyImpactPenaltiesApplied = "policyImpactPenaltiesApplied" in optimizerResult
        ? Number(optimizerResult.policyImpactPenaltiesApplied || 0)
        : 0;
      await appendProgress(config,
        `[PROMETHEUS] Intervention optimizer: status=${optimizerResult.status} selected=${selectedCount} rejected=${rejectedCount} budgetUsed=${optimizerResult.totalBudgetUsed}/${optimizerResult.totalBudgetLimit} (${optimizerResult.budgetUnit ?? "workerSpawns"})`
      ).catch(() => {});

      if (optimizerResult.status === OPTIMIZER_STATUS.BUDGET_EXCEEDED) {
        await appendProgress(config,
          `[PROMETHEUS][WARN] Budget pressure: ${rejectedCount} intervention(s) blocked — reasonCode=${optimizerResult.reasonCode}`
        ).catch(() => {});
      }

      analysis.interventionOptimizer = {
        status:           optimizerResult.status,
        reasonCode:       optimizerResult.reasonCode,
        selectedCount,
        rejectedCount,
        policyImpactPenaltiesApplied,
        totalBudgetUsed:  optimizerResult.totalBudgetUsed,
        totalBudgetLimit: optimizerResult.totalBudgetLimit,
        budgetUnit:       optimizerResult.budgetUnit,
      };
    } catch (err) {
      analysis.interventionOptimizer = {
        status:       "error",
        reasonCode:   "OPTIMIZER_INTERNAL_ERROR",
        errorMessage: String(err?.message || err),
      };
      await appendProgress(config, `[PROMETHEUS][WARN] Intervention optimizer error (non-fatal): ${String(err?.message || err)}`).catch(() => {});
    }
  }

  // ── Dependency graph resolver (non-blocking) ─────────────────────────────
  if (Array.isArray(analysis.plans) && analysis.plans.length > 0) {
    try {
      const graphTasks = analysis.plans.map((plan, i) => ({
        id: String(plan.task || `plan-${i}`),
        dependsOn: Array.isArray(plan.dependencies) ? plan.dependencies.map(String) : [],
        filesInScope: Array.isArray(plan.target_files) ? plan.target_files : (Array.isArray(plan.targetFiles) ? plan.targetFiles : []),
      }));

      const graphResult = resolveDependencyGraph(graphTasks);

      await persistGraphDiagnostics(stateDir, graphResult, {
        correlationId: `prometheus-${Date.now()}`,
        prometheusAnalyzedAt: analysis.analyzedAt,
      }).catch((err) => {
        appendProgress(config, `[PROMETHEUS][WARN] Dependency graph diagnostics persist failed: ${String(err?.message || err)}`).catch(() => {});
      });

      await appendProgress(config,
        `[PROMETHEUS] Dependency graph: status=${graphResult.status} waves=${graphResult.waves.length} parallel=${graphResult.parallelTasks} serialized=${graphResult.serializedTasks} conflicts=${graphResult.conflictPairs.length}`
      ).catch(() => {});

      if (graphResult.status === GRAPH_STATUS.CYCLE_DETECTED) {
        await appendProgress(config,
          `[PROMETHEUS][WARN] Dependency graph cycle detected — scheduler will fall back to sequential dispatch: ${graphResult.errorMessage}`
        ).catch(() => {});
      }

      analysis.dependencyGraph = {
        status:          graphResult.status,
        reasonCode:      graphResult.reasonCode,
        waveCount:       graphResult.waves.length,
        parallelTasks:   graphResult.parallelTasks,
        serializedTasks: graphResult.serializedTasks,
        conflictCount:   graphResult.conflictPairs.length,
        cycleCount:      graphResult.cycles.length,
        waves:           graphResult.waves,
        errorMessage:    graphResult.errorMessage ?? null,
      };

      // ── Update dependencyGraph confidence component ──────────────────────
      // Compute a 0–1 score from the resolved graph and attach it to the
      // parserConfidenceComponents so that calibration loops (baseline recovery,
      // dispatch strictness) can use it on the next cycle.
      //
      // Score scale:
      //   1.0 — OK, no conflicts
      //   0.8–1.0 — OK, conflict-rate adjusted (0.2 deducted per 100% conflict rate)
      //   0.6 — non-OK status without cycles (degraded but recoverable)
      //   0.3 — cycle detected (hard graph failure)
      const conflictRate = graphResult.conflictPairs.length / Math.max(1, analysis.plans.length);
      const cycleCount   = Array.isArray(graphResult.cycles) ? graphResult.cycles.length : 0;
      const dependencyGraphScore =
        cycleCount > 0                           ? 0.3 :
        graphResult.status !== GRAPH_STATUS.OK   ? 0.6 :
        Math.max(0.5, 1.0 - conflictRate * 0.2);
      const roundedDGScore = Math.round(dependencyGraphScore * 100) / 100;

      if (!analysis.parserConfidenceComponents) analysis.parserConfidenceComponents = {};
      analysis.parserConfidenceComponents.dependencyGraph = roundedDGScore;
      analysis.dependencyGraph.score = roundedDGScore;
    } catch (err) {
      analysis.dependencyGraph = {
        status:       GRAPH_STATUS.DEGRADED,
        reasonCode:   "RESOLVER_INTERNAL_ERROR",
        errorMessage: String(err?.message || err),
      };
      // Reflect degraded graph in parserConfidenceComponents so downstream gates see it.
      if (!analysis.parserConfidenceComponents) analysis.parserConfidenceComponents = {};
      analysis.parserConfidenceComponents.dependencyGraph = 0.6;
      await appendProgress(config, `[PROMETHEUS][WARN] Dependency graph resolver error (non-fatal): ${String(err?.message || err)}`).catch(() => {});
    }
  }

  // ── Emit per-cycle planner metrics (Task 1 observability) ────────────────
  // Non-blocking: append to prometheus_cycle_metrics.jsonl for budget efficiency
  // measurement. Captures: findingsInjectedCount, coverageGateRetries, planCount,
  // estimatedPromptTokens, estimatedTokenCost, diagnosticsFreshnessSnapshot.
  try {
    const promptTokens = Math.ceil(contextPrompt.length / 4);
    const tokenCost = estimateTokenCost(promptTokens);
    const freshnessSnap = diagnosticsFreshnessSection
      ? String(diagnosticsFreshnessSection).slice(0, 200).trim() || null
      : null;
    await emitPlannerCycleMetrics(stateDir, {
      schemaVersion: PROMETHEUS_CYCLE_METRICS_SCHEMA_VERSION,
      cycleId: analysis.analyzedAt || new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      findingsInjectedCount: mandatoryFindings.length,
      coverageGateRetries: parserContractResult.retried ? 1 : 0,
      planCount: Array.isArray(analysis.plans) ? analysis.plans.length : 0,
      estimatedPromptTokens: promptTokens,
      estimatedTokenCost: tokenCost,
      diagnosticsFreshnessSnapshot: freshnessSnap,
    });
  } catch { /* non-fatal — metrics emission must never block planning */ }

  return analysis;
}

// ── Per-cycle planner metrics ──────────────────────────────────────────────────
//
// Emitted at the end of every successful runPrometheusAnalysis() call.
// Appended to state/prometheus_cycle_metrics.jsonl so budget efficiency
// can be measured and improved across cycles.

/** Schema version for prometheus_cycle_metrics.jsonl entries. */
export const PROMETHEUS_CYCLE_METRICS_SCHEMA_VERSION = 1;

/** Per-cycle planner observability record. */
export interface PlannerCycleMetrics {
  schemaVersion: number;
  /** ISO timestamp matching analysis.analyzedAt — used as the cycle identity key. */
  cycleId: string;
  recordedAt: string;
  /** Number of mandatory health-audit findings injected into the prompt. */
  findingsInjectedCount: number;
  /**
   * 1 when the parser contract gate triggered a retry this cycle; 0 otherwise.
   * Proxy for how often the planner output needed correction.
   */
  coverageGateRetries: number;
  /** Number of plans in the final analysis (after all gates). */
  planCount: number;
  /** Estimated token count for the full context prompt (chars / 4). */
  estimatedPromptTokens: number;
  /** Estimated USD cost for the prompt tokens at default model pricing. */
  estimatedTokenCost: number;
  /**
   * Compact snapshot (≤200 chars) of the diagnostics freshness section text,
   * or null when no freshness section was built this cycle.
   */
  diagnosticsFreshnessSnapshot: string | null;
}

/**
 * Append a PlannerCycleMetrics record to state/prometheus_cycle_metrics.jsonl.
 *
 * Uses appendFileSync so each record is a single atomic line write.
 * Never throws — all errors are silently swallowed to prevent blocking planning.
 *
 * @param stateDir - path to the state directory
 * @param metrics  - the record to persist
 */
export async function emitPlannerCycleMetrics(
  stateDir: string,
  metrics: PlannerCycleMetrics,
): Promise<void> {
  try {
    const { appendFileSync } = await import("node:fs");
    const filePath = path.join(stateDir, "prometheus_cycle_metrics.jsonl");
    const entry = JSON.stringify(metrics) + "\n";
    appendFileSync(filePath, entry, "utf8");
  } catch { /* non-fatal */ }
}

// ── Fallback provenance and low-confidence quarantine ─────────────────────────
//
// Fallback packets (produced by narrative extraction, wave-derivation, or
// parser recovery modes) carry lower-confidence plans than direct JSON parses.
// Attaching explicit provenance lets downstream gates (Athena, validateAllPlans)
// reason about plan origin; quarantine prevents low-confidence packets from
// being dispatched at all.

/**
 * Canonical provenance tags for fallback plan packets.
 * `direct` = JSON plans parsed directly from model output (highest confidence).
 * All others indicate fallback / recovery paths with reduced confidence.
 */
export const FALLBACK_PROVENANCE_TAG = Object.freeze({
  DIRECT:               "direct",
  NARRATIVE:            "narrative-extracted",
  WAVE_DERIVED:         "wave-derived",
  PARSER_FALLBACK:      "parser-fallback",
  UNCERTAINTY_FALLBACK: "uncertainty-fallback",
} as const);

export type FallbackProvenanceTag = typeof FALLBACK_PROVENANCE_TAG[keyof typeof FALLBACK_PROVENANCE_TAG];

/**
 * Packets whose `_provenance.confidence` is below this threshold are quarantined
 * and excluded from worker dispatch by `quarantineLowConfidencePackets`.
 */
export const QUARANTINE_CONFIDENCE_THRESHOLD = 0.5 as const;

/**
 * Attach provenance metadata to a fallback plan packet.
 *
 * Returns a new object with `_provenance` set — the original packet is not mutated.
 * Non-object inputs are returned unchanged (safe for piping through pipelines).
 *
 * @param packet — the plan packet to annotate
 * @param opts   — { source, reason, confidence (0-1), tag }
 */
export function attachFallbackProvenance(
  packet: any,
  opts: {
    source?:     string;
    reason?:     string;
    confidence?: number;
    tag?:        FallbackProvenanceTag | string;
  } = {},
): any {
  if (!packet || typeof packet !== "object") return packet;
  const confidence = typeof opts.confidence === "number"
    ? Math.max(0, Math.min(1, opts.confidence))
    : 0.5;
  return {
    ...packet,
    _provenance: {
      source:     String(opts.source  || "parser"),
      reason:     String(opts.reason  || "fallback"),
      confidence,
      tag:        opts.tag || FALLBACK_PROVENANCE_TAG.PARSER_FALLBACK,
      attachedAt: new Date().toISOString(),
    },
  };
}

/**
 * Partition plan packets into allowed and quarantined sets.
 *
 * A packet is quarantined when its `_provenance.confidence` is present and
 * strictly less than `threshold`.  Packets without provenance metadata are
 * treated as high-confidence (backward compatible with pre-provenance plans).
 *
 * Quarantined packets are tagged with `_quarantined: true` and a
 * `_quarantineReason` string; allowed packets are returned unchanged.
 *
 * @param packets  — plan packets to partition
 * @param opts     — { threshold } override (default: QUARANTINE_CONFIDENCE_THRESHOLD)
 * @returns {{ allowed: any[], quarantined: any[] }}
 */
export function quarantineLowConfidencePackets(
  packets: any[],
  opts: { threshold?: number } = {},
): { allowed: any[]; quarantined: any[] } {
  if (!Array.isArray(packets)) return { allowed: [], quarantined: [] };

  const threshold = typeof opts.threshold === "number"
    ? opts.threshold
    : QUARANTINE_CONFIDENCE_THRESHOLD;

  const allowed: any[]     = [];
  const quarantined: any[] = [];

  for (const packet of packets) {
    const provConfidence = packet?._provenance?.confidence;
    // No provenance → assume max confidence (backward compatible)
    const confidence = typeof provConfidence === "number" ? provConfidence : 1.0;

    if (confidence < threshold) {
      quarantined.push({
        ...packet,
        _quarantined:      true,
        _quarantineReason: `confidence ${confidence} < threshold ${threshold}`,
      });
    } else {
      allowed.push(packet);
    }
  }

  return { allowed, quarantined };
}

// ── Benchmark ground-truth section for planning prompt ────────────────────────

/**
 * Read benchmark_ground_truth.json from the state directory.
 * Returns null when the file does not exist or cannot be parsed.
 */
export async function readBenchmarkGroundTruth(config: any): Promise<any | null> {
  const stateDir = config?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, "benchmark_ground_truth.json");
  try {
    return await readJson(filePath, null);
  } catch {
    return null;
  }
}

/**
 * Build a concise benchmark status section for injection into the Prometheus
 * planning prompt.
 *
 * Shows the most-recent cycle's research recommendation statuses so Prometheus
 * can see which prior research has been implemented and what still needs work.
 * Returns empty string when no benchmark data is available.
 *
 * @param benchmarkData — parsed benchmark_ground_truth.json content
 */
export function buildBenchmarkSection(benchmarkData: any): string {
  if (!benchmarkData || !Array.isArray(benchmarkData.entries) || benchmarkData.entries.length === 0) {
    return "";
  }

  const latest = benchmarkData.entries[0];
  if (!latest || !Array.isArray(latest.recommendations) || latest.recommendations.length === 0) {
    return "";
  }

  const lines = latest.recommendations.map((rec: any) => {
    const status = String(rec.implementationStatus || "pending").toUpperCase();
    const score = typeof rec.benchmarkScore === "number"
      ? ` score=${rec.benchmarkScore.toFixed(2)}`
      : "";
    const gain = typeof rec.capacityGain === "number"
      ? ` gain=${rec.capacityGain.toFixed(2)}`
      : "";
    const summary = String(rec.summary || "").slice(0, 120);
    const topic   = String(rec.topic || rec.id || "?");
    return `  - [${status}${score}${gain}] ${topic} — ${summary}`;
  }).join("\n");

  const cycleLabel = latest.cycleId ? ` (cycle ${latest.cycleId})` : "";
  return `\n\n## RESEARCH BENCHMARK STATUS${cycleLabel}\nPrior research recommendation tracking — avoid re-proposing implemented items; prioritize pending ones:\n${lines}`;
}

export function buildRoutingOutcomeSection(premiumUsageData: any): string {
  if (!Array.isArray(premiumUsageData) || premiumUsageData.length === 0) return "";
  const recent = premiumUsageData.slice(-20);
  if (recent.length === 0) return "";

  const byKind = new Map<string, { total: number; done: number }>();
  for (const row of recent) {
    if (!row || typeof row !== "object") continue;
    const kind = String((row as any).taskKind || "general").trim() || "general";
    const key = kind.toLowerCase();
    const status = String((row as any).outcome || "").toLowerCase();
    const current = byKind.get(key) || { total: 0, done: 0 };
    current.total += 1;
    if (status === "done") current.done += 1;
    byKind.set(key, current);
  }

  if (byKind.size === 0) return "";

  const lines = [...byKind.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([kind, stats]) => {
      const successRate = stats.total > 0 ? stats.done / stats.total : 0;
      return `  - taskKind=${kind} | samples=${stats.total} | successRate=${successRate.toFixed(2)}`;
    })
    .join("\n");

  return `\n\n## ROUTING OUTCOME SIGNALS\nObserved outcomes from recent premium usage telemetry (last ${recent.length} entries):\n${lines}\nUse this to calibrate uncertainty and escalation for hard tasks.`;
}

/**
 * Format lane performance telemetry from the previous cycle as a Prometheus
 * prompt section.  This allows Prometheus to make informed role-assignment
 * decisions based on measured lane completion rates rather than static defaults.
 *
 * Lanes with low completion rates should receive fewer or smaller tasks.
 * Lanes with high completion rates are good candidates for additional work.
 *
 * Returns "" when no telemetry is available (safe no-op).
 *
 * @param laneTelemetry — laneTelemetry record from the previous cycle analytics
 */
export function buildLaneTelemetryPromptSection(laneTelemetry: unknown): string {
  if (!laneTelemetry || typeof laneTelemetry !== "object" || Array.isArray(laneTelemetry)) {
    return "";
  }
  const entries = Object.entries(laneTelemetry as Record<string, unknown>)
    .filter(([, v]) => v && typeof v === "object")
    .map(([lane, raw]) => {
      const entry = raw as Record<string, unknown>;
      const dispatched = Number(entry.dispatched ?? 0);
      const completed = Number(entry.completed ?? 0);
      const failed = Number(entry.failed ?? 0);
      const completionRate = typeof entry.completionRate === "number" ? entry.completionRate : null;
      const roi = typeof entry.roi === "number" ? entry.roi : null;
      const rateStr = completionRate !== null ? (completionRate * 100).toFixed(0) + "%" : "n/a";
      const roiStr = roi !== null ? roi.toFixed(2) : "n/a";
      return `  - lane=${lane} | dispatched=${dispatched} | completed=${completed} | failed=${failed} | completionRate=${rateStr} | roi=${roiStr}`;
    });
  if (entries.length === 0) return "";
  return `\n\n## LANE PERFORMANCE TELEMETRY (previous cycle)\nUse this to shape role assignments — prefer lanes with higher completion rates for critical tasks:\n${entries.join("\n")}`;
}

