/**
 * Worker Runner — Single-Prompt Worker Sessions
 *
 * Each worker (King David, Esther, Aaron, etc.) has a conversation thread.
 * The orchestrator dispatches tasks via runWorkerConversation().
 *
 * The conversation history is passed as context on every call,
 * making it feel like a persistent session even though Copilot CLI is stateless.
 *
 * Workers use single-prompt mode (--agent only, no autopilot/allow-all):
 *   - 1 worker call = 1 premium request, tool calls within session are FREE
 *   - Worker uses tools to read/edit files, run commands, create PRs
 *   - Session management and status tracking are handled by the runner
 */

import path from "node:path";
import fs from "node:fs/promises";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { spawnAsync, writeJson } from "./fs_utils.js";
import { addSchemaVersion, STATE_FILE_TYPE } from "./schema_registry.js";
import { getRoleRegistry, assertRoleCapabilityForTask, isAthenaReviewOrPostmortemTask, normalizeTaskKindLabel } from "./role_registry.js";
import { appendProgress, appendLineageEntry, appendFailureClassification } from "./state_tracker.js";
import { buildAgentArgs, nameToSlug } from "./agent_loader.js";
import { buildVerificationChecklist, CANONICAL_VERIFICATION_REPORT_TEMPLATE } from "./verification_profiles.js";
import { getVerificationCommands, classifyNodeTestGlobWindowsArtifact } from "./verification_command_registry.js";
import { parseVerificationReport, parseResponsiveMatrix, validateWorkerContract, decideRework, checkPostMergeArtifact, collectArtifactGaps, isArtifactGateRequired, isDiscoverySafeTask, extractMergedSha, buildArtifactAuditEntry, buildReplayClosureEvidence, hasVerificationReportEvidence, hasCleanTreeStatusEvidence, parseToolExecutionTelemetry } from "./verification_gate.js";
import {
  enforceModelPolicy,
  routeModelUnderQualityFloor,
  classifyComplexityTier,
  COMPLEXITY_TIER,
  decideDeliberationPolicy,
  QUALITY_FLOOR_DEFAULT,
} from "./model_policy.js";
import { deriveRoutingAdjustments, buildPromptHardConstraints } from "./learning_policy_compiler.js";
import { loadPolicy, getProtectedPathMatches, getRolePathViolations } from "./policy_engine.js";
import { compileRankedContextSection } from "./prompt_compiler.js";
import {
  scanProject,
  buildSemanticFileCandidatesFromScan,
  rankSemanticFileCandidates,
} from "./project_scanner.js";
import { appendEscalation, BLOCKING_REASON_CLASS, NEXT_ACTION, resolveEscalationsForTask } from "./escalation_queue.js";
import { buildTaskFingerprint, buildLineageId, LINEAGE_ENTRY_STATUS } from "./lineage_graph.js";
import { buildSpanEvent, EVENTS, EVENT_DOMAIN, SPAN_CONTRACT } from "./event_schema.js";
import { classifyFailure, classifyExitCode } from "./failure_classifier.js";
import { resolveRetryAction, persistRetryMetric } from "./retry_strategy.js";
import { filterMemoryEntriesByTrust, isPrivilegedMemoryRequester, buildMemoryHitRecord } from "./trust_boundary.js";
import type { MemoryHitRecord } from "./trust_boundary.js";
import { emitEvent } from "./logger.js";
import { CancelledError } from "./daemon_control.js";
import type { CancellationToken } from "./daemon_control.js";

type WorkerRunnerConfig = {
  env?: Record<string, string | undefined>;
  paths?: {
    stateDir?: string;
  };
  [key: string]: unknown;
};

type PremiumUsageMeta = {
  outcome?: string;
  taskId?: string | number | null;
  /** Shared lineage key linking this premium request to lineage_graph and routing events. */
  lineageId?: string | null;
};

type WorkerRegistryEntry = {
  name?: string;
  model?: string;
  kind?: string;
  [key: string]: unknown;
};

type TaskHints = {
  estimatedLines?: number;
  estimatedDurationMinutes?: number;
  complexity?: string;
};

type BenchmarkRecommendation = {
  implementationStatus?: string;
  benchmarkScore?: number | null;
  capacityGain?: number | null;
};

type RoutingAdjustment = {
  policyId: string;
  modelOverride: string;
  reason: string;
  severity: string;
};

type PromptHardConstraint = {
  policyId: string;
  constraint: string;
  blocking: boolean;
  severity: string;
};

type PromptControls = {
  tier?: string;
  hardConstraints?: PromptHardConstraint[];
  deliberationMode?: "single-pass" | "multi-attempt";
  searchBudget?: number;
};

type WorkerActivityEntry = {
  at?: string;
  status?: string;
  task?: string;
  files?: string[];
  pr?: string;
  /** Wave number this activity entry belongs to, for wave-keyed completion tracking. */
  wave?: number | null;
};

type WorkerSessionState = {
  currentBranch?: string | null;
  createdPRs?: string[];
  filesTouched?: string[];
  activityLog?: WorkerActivityEntry[];
  [key: string]: unknown;
};

type SpawnAsyncResult = {
  status: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  aborted?: boolean;
};

type VerificationEvidence = {
  profile: string;
  hasReport: boolean;
  report: unknown;
  responsiveMatrix: unknown;
  prUrl: string | null;
  gaps: string[];
  passed: boolean;
  attempt: number;
  validatedAt: string;
  roleName: string;
  taskSnippet: string;
  /** Optional-field failures from the VERIFICATION_REPORT (tracked for calibration, not blocking). */
  optionalFieldFailures: string[];
  artifactDetail?: {
    hasSha: boolean;
    hasTestOutput: boolean;
    hasReplayAttachEvidence?: boolean;
    hasExplicitTestOutputBlock?: boolean;
    hasUnfilledPlaceholder: boolean;
    hasExplicitShaMarker: boolean;
    hasExplicitTestBlock: boolean;
    mergedSha: string | null;
  } | null;
  toolExecutionTelemetry?: unknown;
};

type ParsedWorkerResponse = ReturnType<typeof parseWorkerResponse> & {
  verificationEvidence?: VerificationEvidence | null;
};

type DispatchVerificationContract = {
  doneWorkerWithVerificationReportEvidence: boolean;
  doneWorkerWithCleanTreeStatusEvidence: boolean;
  dispatchBlockReason: string | null;
  replayClosure: {
    contractSatisfied: boolean;
    canonicalCommands: string[];
    executedCommands: string[];
    rawArtifactEvidenceLinks: string[];
  };
};

const ANALYTICS_COMPLETED_WORKER_STATUSES = new Set(["done", "success", "skipped"]);

export function isAnalyticsCompletedWorkerStatus(status: unknown): boolean {
  return ANALYTICS_COMPLETED_WORKER_STATUSES.has(String(status || "").toLowerCase());
}

const TERMINAL_WORKER_STATUSES = new Set([
  "done",
  "success",
  "skipped",
  "partial",
  "blocked",
  "error",
  "failed",
  "recovered",
]);

export function isTerminalWorkerStatus(status: unknown): boolean {
  return TERMINAL_WORKER_STATUSES.has(String(status || "").toLowerCase().trim());
}

// ── Span contract emitter ─────────────────────────────────────────────────────

/** Canonical agent identifier for workers in span events. */
export const WORKER_AGENT_ID = "worker";

/**
 * Build a PLANNING_STAGE_TRANSITION span event for a worker.
 * Conforms to SPAN_CONTRACT: stamps spanId, parentSpanId, traceId, agentId.
 *
 * @param correlationId — non-empty cycle trace ID
 * @param stageFrom     — stage being left (one of ORCHESTRATION_LOOP_STEPS)
 * @param stageTo       — stage being entered
 * @param opts          — optional parentSpanId, durationMs, taskId
 * @returns validated event envelope
 */
export function emitWorkerSpanTransition(
  correlationId: string,
  stageFrom: string,
  stageTo: string,
  opts: { parentSpanId?: string | null; durationMs?: number | null; taskId?: string | null } = {},
) {
  return buildSpanEvent(
    EVENTS.PLANNING_STAGE_TRANSITION,
    EVENT_DOMAIN.PLANNING,
    correlationId,
    { agentId: WORKER_AGENT_ID, parentSpanId: opts.parentSpanId ?? null },
    {
      [SPAN_CONTRACT.stageTransition.taskId]:     opts.taskId ?? null,
      [SPAN_CONTRACT.stageTransition.stageFrom]:  stageFrom,
      [SPAN_CONTRACT.stageTransition.stageTo]:    stageTo,
      [SPAN_CONTRACT.stageTransition.durationMs]: opts.durationMs ?? null,
    },
  );
}

/**
 * Build a PLANNING_TASK_DROPPED span event for a worker (blocked/capacity-exhausted path).
 * Conforms to SPAN_CONTRACT.dropReason.
 *
 * @param correlationId  — non-empty cycle trace ID
 * @param taskId         — identifier of the dropped task
 * @param reason         — human-readable drop reason
 * @param dropCode       — machine code from SPAN_CONTRACT.dropCodes (defaults to CAPACITY_EXHAUSTED)
 * @param opts           — optional parentSpanId, stageWhenDropped
 * @returns validated event envelope
 */
export function emitWorkerSpanDrop(
  correlationId: string,
  taskId: string,
  reason: string,
  dropCode: string = SPAN_CONTRACT.dropCodes.CAPACITY_EXHAUSTED,
  opts: { parentSpanId?: string | null; stageWhenDropped?: string } = {},
) {
  return buildSpanEvent(
    EVENTS.PLANNING_TASK_DROPPED,
    EVENT_DOMAIN.PLANNING,
    correlationId,
    { agentId: WORKER_AGENT_ID, parentSpanId: opts.parentSpanId ?? null },
    {
      [SPAN_CONTRACT.dropReason.taskId]:           taskId,
      [SPAN_CONTRACT.dropReason.stageWhenDropped]: opts.stageWhenDropped ?? "workers_running",
      [SPAN_CONTRACT.dropReason.reason]:           reason,
      [SPAN_CONTRACT.dropReason.dropCode]:         dropCode,
    },
  );
}

// ── Premium usage tracking ──────────────────────────────────────────────────

function logPremiumUsage(config, roleName, model, taskKind, durationMs, { outcome, taskId, lineageId }: PremiumUsageMeta = {}) {
  const logPath = path.join(config.paths?.stateDir || "state", "premium_usage_log.json");
  let entries = [];
  try {
    if (existsSync(logPath)) {
      entries = JSON.parse(readFileSync(logPath, "utf8"));
      if (!Array.isArray(entries)) entries = [];
    }
  } catch { entries = []; }
  entries.push({
    worker: roleName,
    model,
    taskKind: taskKind || "general",
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs,
    outcome: outcome || "unknown",
    taskId: taskId || null,
    lineageId: lineageId || null,
  });
  // Keep last 500 entries to prevent unbounded growth
  if (entries.length > 500) entries = entries.slice(-500);
  try { writeFileSync(logPath, JSON.stringify(entries, null, 2), "utf8"); } catch { /* non-critical */ }
}

// ── Memory-hit telemetry ─────────────────────────────────────────────────────

const MEMORY_HIT_LOG_FILE = "memory_hit_log.json";
const MEMORY_HIT_LOG_MAX  = 200;

/**
 * Persist a MemoryHitRecord to state/memory_hit_log.json.
 * Sync write — mirrors logPremiumUsage. Never throws.
 */
function logMemoryHit(config: WorkerRunnerConfig, record: MemoryHitRecord): void {
  try {
    const logPath = path.join(config.paths?.stateDir || "state", MEMORY_HIT_LOG_FILE);
    let entries: MemoryHitRecord[] = [];
    try {
      if (existsSync(logPath)) {
        const parsed2 = JSON.parse(readFileSync(logPath, "utf8"));
        if (Array.isArray(parsed2)) entries = parsed2;
      }
    } catch { entries = []; }
    entries.push(record);
    if (entries.length > MEMORY_HIT_LOG_MAX) entries = entries.slice(-MEMORY_HIT_LOG_MAX);
    try { writeFileSync(logPath, JSON.stringify(entries, null, 2), "utf8"); } catch { /* non-critical */ }
  } catch { /* non-critical — telemetry must never block dispatch */ }
}

/**
 * Update the most-recent memory hit entry matching taskId with the worker's
 * final outcome.  Outcome mapping: ties the retrieval event to task completion.
 * Never throws.
 */
function updateMemoryHitOutcome(config: WorkerRunnerConfig, taskId: string | null, outcome: string): void {
  if (!taskId) return;
  try {
    const logPath = path.join(config.paths?.stateDir || "state", MEMORY_HIT_LOG_FILE);
    if (!existsSync(logPath)) return;
    let entries: MemoryHitRecord[] = [];
    try {
      const parsed2 = JSON.parse(readFileSync(logPath, "utf8"));
      if (Array.isArray(parsed2)) entries = parsed2;
    } catch { return; }
    // Update last matching entry whose outcome is still null (unresolved)
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i] as any;
      if (e && e.taskId === taskId && e.outcome === null) {
        e.outcome = outcome;
        break;
      }
    }
    try { writeFileSync(logPath, JSON.stringify(entries, null, 2), "utf8"); } catch { /* non-critical */ }
  } catch { /* non-critical */ }
}

/**
 * Compute the memory hit ratio from the most-recent log entries.
 *
 * A "hit" is defined as a record where at least one hint or lesson was injected
 * (hintsInjected + lessonsInjected > 0). Returns a value in [0, 1].
 * Returns 0 when no data exists (fail-open — callers treat 0 as "no signal").
 *
 * @param config — BOX config object
 * @param limit  — max entries to consider (default 50)
 */
export function computeMemoryHitRatio(config: WorkerRunnerConfig, limit = 50): number {
  try {
    const logPath = path.join(config.paths?.stateDir || "state", MEMORY_HIT_LOG_FILE);
    if (!existsSync(logPath)) return 0;
    const raw = JSON.parse(readFileSync(logPath, "utf8"));
    if (!Array.isArray(raw) || raw.length === 0) return 0;
    const recent = raw.slice(-limit);
    let hits = 0;
    for (const e of recent) {
      if (!e || typeof e !== "object") continue;
      const injected = Number((e as any).hintsInjected || 0) + Number((e as any).lessonsInjected || 0);
      if (injected > 0) hits++;
    }
    return recent.length > 0 ? hits / recent.length : 0;
  } catch {
    return 0;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text, max) {
  const s = String(text || "");
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

/**
 * Compute a recent ROI proxy from the premium usage log for the given task kind.
 * Returns a value in [0, 1]: ratio of "done" outcomes in the last 10 matching entries.
 * Returns 0 when there is no history (fail-open — caller treats 0 as "no signal").
 */
function computeRecentROI(config, taskKind: string): number {
  try {
    const logPath = path.join(config.paths?.stateDir || "state", "premium_usage_log.json");
    if (!existsSync(logPath)) return 0;
    const entries = JSON.parse(readFileSync(logPath, "utf8"));
    if (!Array.isArray(entries)) return 0;
    const relevant = entries
      .filter((e) => !taskKind || e.taskKind === taskKind)
      .slice(-10);
    if (relevant.length === 0) return 0;
    const successCount = relevant.filter((e) => e.outcome === "done").length;
    return successCount / relevant.length;
  } catch {
    return 0; // fail-open: absence of history must never block dispatch
  }
}

function computeOutcomeMetrics(config, taskKind: string) {
  try {
    const logPath = path.join(config.paths?.stateDir || "state", "premium_usage_log.json");
    if (!existsSync(logPath)) return { sampleCount: 0, successRate: 0, recentROI: 0 };
    const entries = JSON.parse(readFileSync(logPath, "utf8"));
    if (!Array.isArray(entries)) return { sampleCount: 0, successRate: 0, recentROI: 0 };
    const relevant = entries
      .filter((e) => !taskKind || e.taskKind === taskKind)
      .slice(-12);
    if (relevant.length === 0) return { sampleCount: 0, successRate: 0, recentROI: 0 };
    const successCount = relevant.filter((e) => String(e.outcome || "").toLowerCase() === "done").length;
    const successRate = successCount / relevant.length;
    return {
      sampleCount: relevant.length,
      successRate,
      recentROI: successRate,
    };
  } catch {
    return { sampleCount: 0, successRate: 0, recentROI: 0 };
  }
}

function loadBenchmarkGroundTruthSignal(config) {
  try {
    const stateDir = config.paths?.stateDir || "state";
    const filePath = path.join(stateDir, "benchmark_ground_truth.json");
    if (!existsSync(filePath)) return null;
    const payload = JSON.parse(readFileSync(filePath, "utf8"));
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    const latest = entries.length > 0 ? entries[0] : null;
    if (!latest || !Array.isArray(latest.recommendations)) return null;
    return latest;
  } catch {
    return null;
  }
}

function analyzeBenchmarkReadiness(config, taskHints: TaskHints = {}) {
  const latest = loadBenchmarkGroundTruthSignal(config);
  const recommendations = Array.isArray(latest?.recommendations) ? latest.recommendations : [];
  if (recommendations.length === 0) return { hasSignal: false, unresolvedRatio: 0, avgScore: 0, avgGain: 0 };

  let unresolved = 0;
  let scoreCount = 0;
  let scoreSum = 0;
  let gainCount = 0;
  let gainSum = 0;
  for (const rec of recommendations as BenchmarkRecommendation[]) {
    const status = String(rec?.implementationStatus || "pending").toLowerCase();
    if (status !== "implemented" && status !== "implemented_correctly") unresolved++;
    const score = Number(rec?.benchmarkScore);
    if (Number.isFinite(score)) { scoreCount++; scoreSum += score; }
    const gain = Number(rec?.capacityGain);
    if (Number.isFinite(gain)) { gainCount++; gainSum += gain; }
  }

  const avgScore = scoreCount > 0 ? scoreSum / scoreCount : 0;
  const avgGain = gainCount > 0 ? gainSum / gainCount : 0;
  const unresolvedRatio = recommendations.length > 0 ? unresolved / recommendations.length : 0;

  const complexity = String(taskHints.complexity || "").toLowerCase();
  const hardTask = complexity === "critical" || complexity === "high" || Number(taskHints.estimatedLines || 0) >= 3000;
  const highUncertainty = hardTask && (
    unresolvedRatio >= 0.6 ||
    (avgScore > 0 && avgScore < 0.7) ||
    (avgGain > 0 && avgGain < 0.1)
  );

  return {
    hasSignal: true,
    unresolvedRatio: Math.round(unresolvedRatio * 1000) / 1000,
    avgScore: Math.round(avgScore * 1000) / 1000,
    avgGain: Math.round(avgGain * 1000) / 1000,
    highUncertainty,
  };
}

/**
 * Load compiled lesson-based policies from state/learned_policies.json.
 * Fail-open: returns [] on any read or parse error.
 */
function loadLearnedPolicies(config): any[] {
  try {
    const pPath = path.join(config.paths?.stateDir || "state", "learned_policies.json");
    if (!existsSync(pPath)) return [];
    const data = JSON.parse(readFileSync(pPath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return []; // non-critical; missing policy file must never block dispatch
  }
}

async function buildSemanticTaskContext(config, instruction): Promise<string> {
  try {
    const rootDir = String(config?.rootDir || process.cwd());
    const scan = await scanProject({ rootDir });
    const candidates = buildSemanticFileCandidatesFromScan(scan);
    const retrievalQuery = [
      String(instruction?.task || ""),
      String(instruction?.context || ""),
      String(instruction?.verification || ""),
      String(instruction?.scope || ""),
    ].join("\n");
    const ranked = rankSemanticFileCandidates(retrievalQuery, candidates, {
      tokenBudget: 550,
      maxEntries: 8,
      cacheKey: `worker:${rootDir}:${String(instruction?.taskKind || "general")}:${retrievalQuery}`,
    });
    if (ranked.length === 0) return "";
    return compileRankedContextSection(
      "SEMANTIC RETRIEVAL CONTEXT (deterministic, token-budgeted)",
      ranked,
      { tokenBudget: 550, maxEntries: 8 },
    );
  } catch (err) {
    await appendProgress(
      config,
      `[WORKER][SEMANTIC_CONTEXT] retrieval skipped (non-fatal): ${String((err as any)?.message || err)}`
    );
    return "";
  }
}

function getLiveLogPath(config, roleName) {
  const stateDir = config.paths?.stateDir || "state";
  const safeRole = String(roleName || "worker").replace(/[^a-z0-9_-]+/gi, "_");
  return path.join(stateDir, `live_worker_${safeRole}.log`);
}

function roleToWorkerStateFile(roleName: unknown): string {
  const slug = String(roleName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `worker_${slug || "worker"}.json`;
}

function toLegacySessionsBody(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, any>;
  if (obj.workerSessions && typeof obj.workerSessions === "object" && !Array.isArray(obj.workerSessions)) {
    return obj.workerSessions as Record<string, any>;
  }
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, any>;
  }
  const clone = { ...obj };
  delete clone.schemaVersion;
  delete clone.updatedAt;
  delete clone.latestCycleId;
  delete clone.cycles;
  return clone;
}

async function persistLegacyWorkerSessionArtifacts(
  config: WorkerRunnerConfig,
  roleName: string,
  input: {
    phase: "start" | "complete";
    task?: string;
    status?: string;
    pr?: string | null;
    dispatchBlockReason?: string | null;
  }
): Promise<void> {
  try {
    const stateDir = config.paths?.stateDir || "state";
    const nowIso = new Date().toISOString();

    const sessionsPath = path.join(stateDir, "worker_sessions.json");
    let sessions: Record<string, any> = {};
    try {
      if (existsSync(sessionsPath)) {
        sessions = toLegacySessionsBody(JSON.parse(readFileSync(sessionsPath, "utf8")));
      }
    } catch {
      sessions = {};
    }

    const existingSession = sessions[roleName] && typeof sessions[roleName] === "object"
      ? sessions[roleName]
      : {};

    if (input.phase === "start") {
      sessions[roleName] = {
        ...existingSession,
        status: "working",
        startedAt: nowIso,
        updatedAt: nowIso,
      };
    } else {
      sessions[roleName] = {
        ...existingSession,
        status: "idle",
        lastStatus: String(input.status || "unknown").toLowerCase(),
        updatedAt: nowIso,
      };
    }

    await writeJson(
      sessionsPath,
      addSchemaVersion(sessions, STATE_FILE_TYPE.WORKER_SESSIONS),
    );

    const workerPath = path.join(stateDir, roleToWorkerStateFile(roleName));
    let workerState: Record<string, any> = {};
    try {
      if (existsSync(workerPath)) {
        const parsed = JSON.parse(readFileSync(workerPath, "utf8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          workerState = parsed as Record<string, any>;
        }
      }
    } catch {
      workerState = {};
    }

    const previousLog = Array.isArray(workerState.activityLog) ? workerState.activityLog : [];
    const entry = input.phase === "start"
      ? {
          at: nowIso,
          status: "working",
          task: String(input.task || ""),
        }
      : {
          at: nowIso,
          status: String(input.status || "unknown").toLowerCase(),
          task: String(input.task || ""),
          pr: input.pr || null,
          dispatchBlockReason: input.dispatchBlockReason || null,
        };

    await writeJson(workerPath, {
      ...workerState,
      status: input.phase === "start" ? "working" : "idle",
      startedAt: input.phase === "start" ? nowIso : (workerState.startedAt || null),
      updatedAt: nowIso,
      activityLog: [...previousLog, entry].slice(-200),
    });
  } catch {
    // Session artifact persistence is observability-only and must never block worker execution.
  }
}

async function appendLiveWorkerLog(logPath, text) {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, text, "utf8");
}

// ── Find worker config by role name ─────────────────────────────────────────

function findWorkerByName(config, roleName) {
  const registry = getRoleRegistry(config);
  const workers = registry?.workers || {};
  const normalize = (value: unknown) => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const target = normalize(roleName);
  for (const [kind, worker] of Object.entries(workers) as Array<[string, WorkerRegistryEntry]>) {
    if (!worker?.name) continue;
    if (worker.name === roleName) return { kind, ...worker };
    if (normalize(worker.name) === target) return { kind, ...worker };
  }
  return null;
}

export function shouldEnableFullToolAccess(roleName: unknown, taskKind: unknown, taskText: unknown = ""): boolean {
  const normalizedRole = String(roleName || "").trim().toLowerCase();
  const normalizedTaskKind = normalizeTaskKindLabel(taskKind);
  const isImplementationTask = !normalizedTaskKind || normalizedTaskKind === "implementation";
  if (isImplementationTask) return true;
  if (normalizedRole === "evolution-worker") return true;
  return isAthenaReviewOrPostmortemTask(normalizedTaskKind, taskText);
}

export function evaluateWorkerRoleCapability(config, roleName: unknown, taskKind: unknown, taskText: unknown = "") {
  return assertRoleCapabilityForTask(config, roleName, taskKind, taskText);
}

/**
 * Apply trust classification and ranked filtering to knowledge-memory hints for prompt injection.
 *
 * Returns hints sorted high→medium, dropping LOW trust unless privilegedCaller=true.
 * Each returned entry is annotated with a `trust` metadata field.
 *
 * This is the canonical trust gate between knowledge_memory.json entries and the
 * worker prompt. Callers must not bypass this function to inject raw hints.
 *
 * @param hints           - raw hint/lesson entries from knowledge_memory.json
 * @param workerKind      - the worker's registered kind (e.g. "governance", "evolution")
 * @returns { selected, droppedLowTrustCount, isPrivileged }
 */
export function applyMemoryTrustFilter(
  hints: unknown[],
  workerKind: unknown,
): {
  selected: Array<Record<string, unknown> & { trust: { level: string; source: string; reason: string; taggedAt: string } }>;
  droppedLowTrustCount: number;
  isPrivileged: boolean;
} {
  const privilegedCaller = isPrivilegedMemoryRequester(workerKind);
  const { selected, droppedLowTrustCount } = filterMemoryEntriesByTrust(
    Array.isArray(hints) ? hints : [],
    { includeLowTrust: privilegedCaller, privilegedCaller },
  );
  return { selected, droppedLowTrustCount, isPrivileged: privilegedCaller };
}

// ── Repo contamination detection and recovery ────────────────────────────────

/** Patterns in worker output that indicate repo contamination (out-of-scope file modifications). */
const CONTAMINATION_INDICATORS = [
  /scope\s+violation/i,
  /unrelated\s+file/i,
  /modified\s+outside\s+(declared\s+)?scope/i,
  /git\s+checkout\s+--/i,
];

/**
 * Detect whether a worker's output indicates repo contamination — i.e., files
 * were modified outside the declared task scope.
 *
 * Returns isContamination=true when the summary text contains known contamination
 * markers OR when filesTouched contains entries that fall outside filesHint scope.
 *
 * @param summary      - worker summary text (may contain SCOPE VIOLATION markers)
 * @param filesTouched - files the worker reported touching
 * @param filesHint    - declared scope from the task (empty means "no scope declared")
 */
export function detectRepoContamination(
  summary: string,
  filesTouched: string[],
  filesHint: string[],
): { isContamination: boolean; unrelatedFiles: string[] } {
  const text = String(summary || "");
  const markerFound = CONTAMINATION_INDICATORS.some(r => r.test(text));

  let unrelatedFiles: string[] = [];
  if (Array.isArray(filesHint) && filesHint.length > 0
      && Array.isArray(filesTouched) && filesTouched.length > 0) {
    const normalizedHints = filesHint.map(h => h.replace(/\\/g, "/").toLowerCase());
    unrelatedFiles = filesTouched.filter(file => {
      const normalized = file.replace(/\\/g, "/").toLowerCase();
      return !normalizedHints.some(hint => {
        if (normalized === hint) return true;
        if (normalized.startsWith(hint.endsWith("/") ? hint : hint + "/")) return true;
        const hintBase = hint.replace(/\.(ts|js)$/, "");
        return normalized.includes(hintBase);
      });
    });
  }

  return {
    isContamination: markerFound || unrelatedFiles.length > 0,
    unrelatedFiles,
  };
}

/**
 * Attempt to recover branch cleanliness by reverting files outside the task scope.
 * Runs `git checkout -- <file>` for each file in filesToRecover.
 *
 * This is a best-effort, deterministic recovery: it retries up to maxAttempts times.
 * A blocked/partial closure is only permitted after all recovery attempts are exhausted.
 *
 * @param config         - runner config (used for path resolution context)
 * @param filesToRecover - files to revert via git checkout
 * @param maxAttempts    - max attempts before giving up (default 2)
 */
export async function attemptBranchCleanlinessRecovery(
  config: WorkerRunnerConfig,
  filesToRecover: string[],
  maxAttempts: number = 2,
): Promise<{ recovered: boolean; attemptsMade: number; errors: string[] }> {
  if (!Array.isArray(filesToRecover) || filesToRecover.length === 0) {
    return { recovered: true, attemptsMade: 0, errors: [] };
  }

  const errors: string[] = [];
  let attempt = 0;
  let pending = [...filesToRecover];

  while (attempt < maxAttempts && pending.length > 0) {
    attempt++;
    const failedThisAttempt: string[] = [];
    for (const file of pending) {
      try {
        const r = await spawnAsync("git", ["checkout", "--", file], {
          env: { ...process.env },
        }) as SpawnAsyncResult;
        if (r.status !== 0) {
          failedThisAttempt.push(file);
          errors.push(
            `[attempt ${attempt}] git checkout -- ${file} exit=${r.status}: ${String(r.stderr || "").slice(0, 80)}`
          );
        }
      } catch (e: unknown) {
        failedThisAttempt.push(file);
        errors.push(
          `[attempt ${attempt}] git checkout -- ${file}: ${String((e as Error)?.message || e).slice(0, 80)}`
        );
      }
    }
    pending = failedThisAttempt;
  }

  return { recovered: pending.length === 0, attemptsMade: attempt, errors };
}

// ── Task-aware model resolution ───────────────────────────────────────────────
// Priority: taskKind → role preference → worker model → uncertainty-aware routing → default
// Policy adjustments from compiled lessons may override the candidate after selection.

function resolveModel(config, roleName, taskKind, taskHints: TaskHints = {}, routingAdjustments: RoutingAdjustment[] = []) {
  const defaultModel = config?.copilot?.defaultModel || "Claude Sonnet 4.6";
  const strongModel = config?.copilot?.strongModel || defaultModel;
  const efficientModel = config?.copilot?.efficientModel || defaultModel;

  let candidate;
  // 1. Task-kind override (e.g. "scan" always uses GPT-5.3-Codex)
  if (taskKind) {
    const byKind = config?.copilot?.preferredModelsByTaskKind?.[taskKind];
    if (Array.isArray(byKind) && byKind.length > 0) candidate = byKind[0];
  }
  // 2. Role-specific preference
  if (!candidate) {
    const byRole = config?.copilot?.preferredModelsByRole?.[roleName];
    if (Array.isArray(byRole) && byRole.length > 0) candidate = byRole[0];
  }
  // 3. Worker's registered static model
  if (!candidate) {
    const workerConfig = findWorkerByName(config, roleName);
    if (workerConfig?.model) candidate = workerConfig.model;
  }
  // 4. Quality-floor-aware routing: combines uncertainty-aware routing with a minimum
  //    quality floor so the cheapest model that meets the floor is selected.
  //    Falls back to the strongest model when no candidate satisfies the floor.
  if (!candidate) {
    const recentROI = computeRecentROI(config, taskKind);
    const outcomeMetrics = computeOutcomeMetrics(config, taskKind);
    const benchmarkSignal = analyzeBenchmarkReadiness(config, taskHints);
    const qualityFloorRoute = routeModelUnderQualityFloor(
      taskHints,
      { defaultModel, strongModel, efficientModel },
      { recentROI },
      QUALITY_FLOOR_DEFAULT,
    );
    candidate = qualityFloorRoute.model;
    if (
      benchmarkSignal.hasSignal &&
      benchmarkSignal.highUncertainty &&
      (qualityFloorRoute.tier === COMPLEXITY_TIER.T3 || String(taskHints.complexity || "").toLowerCase() === "critical")
    ) {
      candidate = strongModel;
      try {
        appendProgress(
          config,
          `[UNCERTAINTY_ESCALATION] ${roleName}: hard-task benchmark uncertainty -> ${strongModel} (avgScore=${benchmarkSignal.avgScore.toFixed(2)} avgGain=${benchmarkSignal.avgGain.toFixed(2)} unresolved=${benchmarkSignal.unresolvedRatio.toFixed(2)} sample=${outcomeMetrics.sampleCount})`
        );
      } catch { /* non-critical */ }
    }
    if (qualityFloorRoute.uncertainty !== "low" || !qualityFloorRoute.meetsQualityFloor) {
      try {
        appendProgress(config,
          `[QUALITY_FLOOR_ROUTE] ${roleName}: tier=${qualityFloorRoute.tier} uncertainty=${qualityFloorRoute.uncertainty} meetsFloor=${qualityFloorRoute.meetsQualityFloor} recentROI=${recentROI.toFixed(2)} → ${candidate}`
        );
      } catch { /* non-critical */ }
    }
  }

  // 5. Apply routing adjustments derived from compiled lesson policies.
  //    Recurring failure classes (e.g. syntax errors, import errors) override the
  //    complexity-based selection since model capability was NOT the root cause.
  const sonnetModel = config?.copilot?.sonnetModel || "Claude Sonnet 4.6";
  for (const adj of routingAdjustments) {
    if (adj.modelOverride === "force-sonnet") {
      const previous = candidate;
      // Use explicit Sonnet — not defaultModel, which may itself be Codex/Opus.
      // force-sonnet means "this failure class is tooling, not reasoning — Sonnet is sufficient".
      candidate = sonnetModel;
      try {
        appendProgress(config,
          `[POLICY_ROUTE] ${roleName}: ${previous} → ${sonnetModel} (policy=${adj.policyId}: ${adj.reason})`
        );
      } catch { /* non-critical */ }
      break; // First critical policy override wins
    }
    if (adj.modelOverride === "block-opus" && /opus/i.test(String(candidate || ""))) {
      candidate = defaultModel;
      try {
        appendProgress(config,
          `[POLICY_ROUTE] ${roleName}: Opus blocked → ${defaultModel} (policy=${adj.policyId}: ${adj.reason})`
        );
      } catch { /* non-critical */ }
      break;
    }
  }

  // 6. Enforce model policy — ban fast/30x, gate Opus to large tasks
  const policy = enforceModelPolicy(candidate || defaultModel, taskHints, defaultModel);
  if (policy.downgraded) {
    try { appendProgress(config, `[MODEL_POLICY] ${roleName}: ${policy.reason}`); } catch { /* non-critical */ }
  }
  return policy.model;
}

// ── Build conversation-only context (persona is in .agent.md) ───────────────

function buildConversationContext(history, instruction, sessionState: WorkerSessionState = {}, config: WorkerRunnerConfig = {}, workerKind = null, promptControls: PromptControls = {}) {
  const parts = [];

  // Persistent worker state — always injected first so workers always know where they stand
  const targetRepo = config.env?.targetRepo || "(not set)";
  const branch = sessionState.currentBranch || null;
  const prs = Array.isArray(sessionState.createdPRs) ? sessionState.createdPRs : [];
  const filesTouchedAll = Array.isArray(sessionState.filesTouched) ? sessionState.filesTouched : [];
  const activityLog = Array.isArray(sessionState.activityLog) ? sessionState.activityLog : [];

  parts.push("## YOUR PERSISTENT STATE");
  parts.push(`Target Repo: ${targetRepo}`);
  if (branch) parts.push(`Current Branch: ${branch}`);
  if (prs.length > 0) parts.push(`PRs You Created: ${prs.slice(-5).join(", ")}`);
  if (filesTouchedAll.length > 0) {
    const shown = filesTouchedAll.slice(-10);
    const more = filesTouchedAll.length - shown.length;
    parts.push(`Files You've Worked On: ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`);
  }
  parts.push("");

  if (activityLog.length > 0) {
    parts.push("## YOUR ACTIVITY LOG");
    activityLog.slice(-5).forEach(entry => {
      const date = entry.at ? entry.at.slice(0, 16).replace("T", " ") : "?";
      const files = Array.isArray(entry.files) && entry.files.length > 0
        ? ` | ${entry.files.slice(0, 4).join(", ")}` : "";
      const pr = entry.pr ? ` → PR ${entry.pr.split("/").pop()}` : "";
      parts.push(`[${date}] ${String(entry.status || "").toUpperCase().padEnd(8)} ${String(entry.task || "").slice(0, 80)}${pr}${files}`);
    });
    parts.push("");
  }

  // Inject knowledge memory lessons relevant to this worker.
  // Trust classification + ranked filtering is applied before injection:
  //   HIGH trust (system/deterministic): always included, shown first.
  //   MEDIUM trust (model-produced): always included.
  //   LOW trust (user-mediated free text): dropped unless caller is privileged.
  // Privileged callers (governance, system, jesus) receive all trust levels with an
  // explicit [LOW-TRUST] label so they can assess and re-classify if needed.
  try {
    const kmPath = path.join(config.paths?.stateDir || "state", "knowledge_memory.json");
    if (existsSync(kmPath)) {
      const km = JSON.parse(readFileSync(kmPath, "utf8"));
      const privilegedCaller = isPrivilegedMemoryRequester(workerKind);

      const targetFiltered = Array.isArray(km.promptHints)
        ? km.promptHints.filter(h => {
            const target = String(h.targetAgent || "").toLowerCase();
            return target === "all" || target === "workers" || target === String(workerKind || "").toLowerCase();
          })
        : [];

      // Apply trust classification + ranked filtering (high→medium, drop low unless privileged)
      const { selected: trustedHints, droppedLowTrustCount: droppedHints } = filterMemoryEntriesByTrust(
        targetFiltered,
        { includeLowTrust: privilegedCaller, privilegedCaller },
      );

      const rawLessons = Array.isArray(km.lessons) ? km.lessons.slice(-5) : [];
      const { selected: trustedLessons, droppedLowTrustCount: droppedLessons } = filterMemoryEntriesByTrust(
        rawLessons,
        { includeLowTrust: privilegedCaller, privilegedCaller },
      );
      const filteredLessons = trustedLessons.filter(
        l => (l as any).severity === "critical" || (l as any).severity === "warning",
      );

      if (trustedHints.length > 0 || filteredLessons.length > 0) {
        parts.push("## SYSTEM LEARNINGS (from previous cycles)");
        for (const hint of trustedHints) {
          const h = hint as any;
          const trustLabel = hint.trust.level.toUpperCase();
          const lowNotice = hint.trust.level === "low" ? " [LOW-TRUST — verify before applying]" : "";
          parts.push(`- [${trustLabel}] ${h.hint} (reason: ${h.reason})${lowNotice}`);
        }
        for (const lesson of filteredLessons) {
          const l = lesson as any;
          const trustLabel = lesson.trust.level.toUpperCase();
          parts.push(`- [${trustLabel}] [${String(l.severity).toUpperCase()}] ${l.lesson}`);
        }
        if ((droppedHints + droppedLessons) > 0) {
          parts.push(`- [INFO] ${droppedHints + droppedLessons} low-trust hint(s) omitted (set privileged caller to include them).`);
        }
        parts.push("");
      }
    }
  } catch { /* knowledge memory not available yet — no-op */ }

  // Loop detection — inject a visible warning before history if the worker is stuck
  const myMessages = history.filter(m => {
    const from = String(m?.from || "").toLowerCase();
    return from !== "athena" && from !== "prometheus";
  });
  const recentOwn = myMessages.slice(-3);
  const allFailed = recentOwn.length >= 2 && recentOwn.every(m =>
    m.status === "error" || m.status === "blocked" ||
    String(m.content || "").toLowerCase().startsWith("error")
  );
  const repeatedContent = recentOwn.length >= 2 &&
    recentOwn.every(m => truncate(m.content, 120) === truncate(recentOwn[0].content, 120));

  if (repeatedContent) {
    parts.push("## ⚠️ LOOP DETECTED — YOU ARE REPEATING THE SAME OUTPUT");
    parts.push("Your last responses are identical. You are in a loop.");
    parts.push("MANDATORY: Stop completely. Do NOT repeat the same action.");
    parts.push("Step 1: Re-read the task from scratch — assume your previous understanding was wrong.");
    parts.push("Step 2: Pick a completely different implementation strategy.");
    parts.push("Step 3: If you genuinely cannot proceed differently, output BOX_STATUS=blocked with a root-cause analysis.");
    parts.push("");
  } else if (allFailed) {
    parts.push("## ⚠️ REPEATED FAILURE — CHANGE YOUR APPROACH");
    parts.push(`You have failed ${recentOwn.length} times in a row on this task. Your current approach is not working.`);
    parts.push("MANDATORY before continuing:");
    parts.push("  1. Identify WHY each previous attempt failed (permissions? missing deps? wrong file? wrong assumption?)");
    parts.push("  2. Form a NEW hypothesis about the root cause.");
    parts.push("  3. Apply a fundamentally different fix strategy.");
    parts.push("  4. If after this attempt it still fails, output BOX_STATUS=blocked with:");
    parts.push("     - All approaches you tried");
    parts.push("     - The exact error each time");
    parts.push("     - Evidence-based root cause analysis for why none of them worked");
    parts.push("");
  }

  if (history.length > 0) {
    parts.push("## CONVERSATION HISTORY");
    const recentHistory = history.slice(-12);
    for (const msg of recentHistory) {
      const from = String(msg?.from || "").toLowerCase();
      if (from === "athena" || from === "prometheus") {
        parts.push(`\nINSTRUCTION: ${truncate(msg.content, 600)}`);
      } else {
        parts.push(`\nYOU (${msg.from}): ${truncate(msg.content, 800)}`);
      }
    }
    parts.push("");
  }

  parts.push("## NEW INSTRUCTION");
  parts.push("Treat this instruction as an execution brief: objective, constraints, and success criteria.");
  parts.push("You own the method. If a better implementation order or safer approach exists, use it and explain why in your summary.");
  parts.push("Do not follow literal step ordering if repository reality suggests a stronger senior-level approach.");
  parts.push("\n## EXECUTION INTEGRITY PROTOCOL");
  parts.push("1) Verify access before acting. Validate: target repo path, required files, required tools, and required remote/API access.");
  parts.push("2) Never guess. Do not use assumed/projected facts when evidence is missing. If you need data, fetch it.");
  parts.push("3) If anything is inaccessible, do not improvise. Report the exact blocker with evidence.");
  parts.push("4) If you choose an alternative path, include impact analysis: correctness risk, scope impact, rollback, and whether it is a permanent fix or temporary workaround.");
  parts.push("5) Prefer permanent deterministic fixes over temporary bypasses.");
  parts.push("6) PR ownership is yours end-to-end: create/update your PR for your task, monitor GitHub checks, fix failures you see, and when checks are green merge it yourself.");
  parts.push("7) If checks remain pending, keep watching until green or report the exact failing/pending checks.");

  parts.push("\n## INDEPENDENT THINKING — VERIFY YOUR ORDERS");
  parts.push("You are a senior engineer, not a blind executor. Before implementing your instructions:");
  parts.push("1) EVALUATE the plan: Does this instruction make technical sense for the codebase? Is it the right approach?");
  parts.push("2) CHECK for conflicts: Will this change break something that's already working? Does it conflict with other workers' work?");
  parts.push("3) VALIDATE scope: Is the instruction appropriately scoped for this project type? (Don't add enterprise security to a portfolio site, don't skip auth on a SaaS app)");
  parts.push("4) CHALLENGE if wrong: If the instruction contains a technical error, an incorrect assumption, or a suboptimal approach:");
  parts.push("   - State what's wrong and why");
  parts.push("   - Propose the correct approach");
  parts.push("   - Implement the CORRECT version, not the flawed instruction");
  parts.push("   - Document your reasoning in the summary");
  parts.push("5) ENHANCE if possible: If you see an obviously better way to achieve the goal that the plan didn't consider, do it the better way.");
  parts.push("6) NEVER blindly execute instructions that would:");
  parts.push("   - Break existing passing tests");
  parts.push("   - Remove functionality that's currently working");
  parts.push("   - Add unnecessary complexity for the project type");
  parts.push("   - Introduce security vulnerabilities");
  parts.push("You own the quality of YOUR output. Execute at a senior engineering level — methodology is yours.");
  parts.push("\n## WORK QUALITY MANDATE");
  parts.push("Each premium request costs real money. You MUST deliver complete, correct, production-quality work in this single request.");
  parts.push("- Write exactly as much code as the task requires — no more, no less.");
  parts.push("- Prefer focused, targeted changes that solve the problem cleanly over large rewrites.");
  parts.push("- Complete your ENTIRE assigned task in one shot — do not leave partial work for a follow-up request.");
  parts.push("- If your task involves multiple files, fix ALL of them before reporting done.");
  parts.push("- Senior production standard: correct logic, proper error handling, edge cases handled, tests where relevant.");
  parts.push("\n## TOOL EXECUTION GOVERNANCE (MANDATORY)");
  parts.push("Before every execute tool call, emit one explicit tool-intent envelope:");
  parts.push("[TOOL_INTENT] scope=<repo-path-or-subsystem> intent=<goal> impact=<low|medium|high|critical> clearance=<read|write|admin>");
  parts.push("Then emit one deterministic hook decision line:");
  parts.push("[HOOK_DECISION] tool=execute decision=<allow|deny> reason_code=<code> rule_id=<id|none> envelope_scope=<scope> envelope_intent=<intent> envelope_impact=<impact> envelope_clearance=<clearance>");
  parts.push("If decision=deny, do NOT execute the tool call.");
  parts.push("Allowed decisions must be deterministic and policy-based; never guess.");

  // Canonical verification commands from the central registry
  const verifCmds = getVerificationCommands(config);
  parts.push("\n## CANONICAL VERIFICATION COMMANDS");
  parts.push(`Use these exact commands for verification (do NOT invent shell globs):`);
  parts.push(`  Test:  ${verifCmds.test}`);
  parts.push(`  Lint:  ${verifCmds.lint}`);
  parts.push(`  Build: ${verifCmds.build}`);
  parts.push("\n## TEST SCOPE POLICY (REQUIRED)");
  parts.push("Run ONLY tests that are directly related to your change set (targeted tests).");
  parts.push("Do NOT run the full repository test suite unless the task explicitly requires full-suite validation.");
  parts.push("If no specific test target is provided, infer the smallest relevant test set from touched files and verification commands.");
  parts.push("In your evidence, state exactly which targeted tests you ran and why they are sufficient for this task.");

  // Prompt tier budget — informs the worker how much reasoning depth is expected.
  // T3 (architectural): deep think required, critic mandatory, multi-pass.
  // T2 (medium): two-pass, moderate reasoning.
  // T1 (routine): lean, direct implementation — no extra passes needed.
  const tier = promptControls.tier;
  if (tier === COMPLEXITY_TIER.T3) {
    parts.push("\n## PROMPT TIER BUDGET — T3 (ARCHITECTURAL)");
    parts.push("This task is classified as T3: deep architectural reasoning required.");
    parts.push("- Mandatory: multi-pass reasoning (design → implement → verify → critique).");
    parts.push("- Perform a critic step before finalising: challenge your own solution.");
    parts.push("- Verify all edge cases explicitly before reporting done.");
    parts.push("- Budget: up to 5 continuation passes if needed.");
  } else if (tier === COMPLEXITY_TIER.T2) {
    parts.push("\n## PROMPT TIER BUDGET — T2 (MEDIUM)");
    parts.push("This task is classified as T2: two-pass reasoning expected.");
    parts.push("- Implement first, then verify the result before reporting done.");
    parts.push("- Budget: up to 3 continuation passes if needed.");
  }
  // T1: no tier section — keep the prompt lean for routine patches.

  // Role-based verification — inject requirements specific to this worker's kind
  if (workerKind) {
    parts.push("");
    parts.push(buildVerificationChecklist(workerKind));
  } else {
    // Fallback for unknown roles — basic verification
    parts.push("\n## SELF-VERIFICATION PROTOCOL");
    parts.push("Before reporting done, verify your work: run build, run tests, check edge cases.");
    parts.push("Include this exact verification report block and replace placeholders:");
    parts.push("```");
    parts.push(CANONICAL_VERIFICATION_REPORT_TEMPLATE);
    parts.push("```");
  }

  // Hard constraints from compiled lesson policies — injected prominently so the
  // model cannot silently violate them. Blocking constraints cause immediate rework
  // if violated. Violation is detected via the verification gate at post-task review.
  const hardConstraints = Array.isArray(promptControls.hardConstraints) ? promptControls.hardConstraints : [];
  if (hardConstraints.length > 0) {
    parts.push("\n## HARD CONSTRAINTS (enforced from prior cycle lessons — violations trigger rework)");
    for (const hc of hardConstraints) {
      const blockLabel = hc.blocking ? " [BLOCKING]" : "";
      parts.push(`${hc.constraint}${blockLabel}`);
    }
  }

  if (promptControls.deliberationMode === "multi-attempt") {
    const searchBudget = Number(promptControls.searchBudget || 0);
    parts.push("\n## SELECTIVE DELIBERATION POLICY");
    parts.push("This task is high-uncertainty. Use bounded multi-attempt reasoning:");
    parts.push("1) Attempt 1: initial implementation pass.");
    parts.push("2) Attempt 2+: reflect on failure signals and revise plan before edits.");
    if (searchBudget > 0) {
      parts.push(`3) Bounded search budget: at most ${searchBudget} focused repository searches before coding.`);
    }
    parts.push("Do not loop indefinitely; converge to a concrete implementation or explicit blocker.");
  }

  parts.push("\n## OUTPUT FORMAT");
  parts.push("Think deeply and work naturally. Write your full reasoning, analysis, and implementation details.");
  parts.push("At the END of your response, include these REQUIRED machine-readable markers:");
  parts.push("BOX_STATUS=<done|partial|blocked|error>  ← REQUIRED — do NOT omit");
  parts.push("BOX_PR_URL=<url>   (required when you created/updated a PR)");
  parts.push("BOX_BRANCH=<name>  (required when you created/switched a branch)");
  parts.push("BOX_FILES_TOUCHED=<comma-separated list>  (files you edited/created)");
  parts.push("BOX_ACCESS=repo:<ok|blocked>;files:<ok|blocked>;tools:<ok|blocked>;api:<ok|blocked>  (if you encountered access issues)");
  parts.push("PR POLICY: If your task changes code, open or update your PR and carry it to merge when checks are green.");

  // Mandatory completion gate checklist injected immediately before the task so the
  // model sees it right before the work description and again when writing its response.
  // Omitting any item → verification gate rejects the done status and triggers rework.
  if (!isDiscoverySafeTask(instruction.taskKind)) {
    // Extract specific test file paths from the plan's verification field so workers
    // run only the tests relevant to their changes — not the full 1000+ test suite.
    const targetTestFiles = (() => {
      const verText = String(instruction.verification || "");
      const testFileRe = /(?:^|\d+\.\s*)(tests\/[^\s—\-–|\n\r]+(?:\.test\.ts|\.test\.js))/gm;
      const found = new Set<string>();
      let m;
      while ((m = testFileRe.exec(verText)) !== null) found.add(m[1].trim());
      return [...found];
    })();
    const testRunCmd = targetTestFiles.length > 0
      ? `npm test -- ${targetTestFiles.join(" ")}`
      : "npm test -- tests/core/<module>.test.ts";
    parts.push("");
    parts.push("## ⛔ MANDATORY COMPLETION GATE — CHECK BEFORE WRITING BOX_STATUS=done");
    parts.push("At the end of your response, you MUST include ALL four of these — the gate scans for them literally:");
    parts.push("  ✓ BOX_MERGED_SHA=<actual sha>            ← run: git rev-parse HEAD after merge");
    parts.push("  ✓ CLEAN_TREE_STATUS=clean                ← run: git status --porcelain (must produce empty output)");
    parts.push(`  ✓ ===NPM TEST OUTPUT START===            ← run: ${testRunCmd}`);
    parts.push("    <paste full raw test stdout here>");
    parts.push("    ===NPM TEST OUTPUT END===");
    parts.push("  ✓ ===VERIFICATION_REPORT===              ← use pass/fail/n/a, not placeholders");
    parts.push("    BUILD=pass  TESTS=pass  SECURITY=pass  ...etc.");
    parts.push("    ===END_VERIFICATION===");
    parts.push("If ANY item is missing, unfilled, or uses an old format → write BOX_STATUS=partial and list what could not be completed.");
    parts.push("⚠️ Do NOT use POST_MERGE_TEST_OUTPUT — that format is rejected. Use ===NPM TEST OUTPUT START/END=== instead.");
  }

  parts.push(String(instruction.task || ""));

  // Warn when the task text provides no specific test file targets so the worker
  // knows it must supply concrete test evidence in its VERIFICATION_REPORT.
  const taskText = String(instruction.task || "");
  const hasSpecificTestTarget = /\.(test|spec)\.(ts|js|tsx|jsx)/i.test(taskText) ||
    /\/tests?\/[^\s]+/.test(taskText) ||
    /[—\-–]\s*test[:\s]/i.test(taskText);
  if (!hasSpecificTestTarget) {
    parts.push("");
    parts.push("## ⚠️ VERIFICATION TARGET REQUIRED");
    parts.push("No specific test file target was detected in this task's verification commands.");
    parts.push("You MUST provide specific test evidence in your VERIFICATION_REPORT:");
    parts.push("  - Run targeted tests: 'npm test -- tests/core/<module>.test.ts'");
    parts.push("  - Reference it explicitly in evidence. Do NOT run the full test suite unless explicitly requested by task text.");
    parts.push("  - Generic 'npm test passed' alone is NOT accepted as verification evidence.");
  }

  if (instruction.context) {
    parts.push("");
    parts.push("Additional context:");
    parts.push(String(instruction.context));
    if (String(instruction.context).includes("## CI_FAILURE_CONTEXT")) {
      parts.push("Use CI_FAILURE_CONTEXT as authoritative failure evidence for deterministic ci-fix work.");
    }
  }
  if (instruction.isFollowUp && instruction.previousResult) {
    parts.push("");
    parts.push(`Your previous result: ${truncate(instruction.previousResult, 400)}`);
  }

  return parts.join("\n");
}

/**
 * Inject CI_FAILURE_CONTEXT into a ci-fix worker instruction when the context
 * doesn't already contain it.  Reads local state artifact logs in priority order.
 * Always injects something — either log evidence or an explicit no-data marker.
 *
 * Exported for unit testing.
 */
export async function injectCiFailureContextIfMissing(
  instruction: Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const existingCtx = String(instruction?.context || "");
  if (existingCtx.includes("## CI_FAILURE_CONTEXT")) return instruction;

  const stateDir = String((config as any)?.paths?.stateDir ?? "");
  let ciContext: string | null = null;
  if (stateDir) {
    for (const artifactName of ["npm_test_full.log", "npm_test_relevant.log", "test_run.log", "build_run.log", "evo_run_latest.log"]) {
      try {
        const logContent = await fs.readFile(path.join(stateDir, artifactName), "utf8");
        if (logContent.trim().length > 0) {
          const excerpt = logContent.slice(-4000);
          ciContext = `## CI_FAILURE_CONTEXT\nsource: worker_runner_fallback:${artifactName}\ncommit_sha: unknown\n\n${excerpt}`;
          break;
        }
      } catch {
        // Artifact missing — try next
      }
    }
  }
  if (!ciContext) {
    ciContext = `## CI_FAILURE_CONTEXT\nsource: no_evidence_available\ncommit_sha: unknown\nnote: No CI failure logs could be retrieved. Do not speculate about the failure cause. Use npm test to reproduce and diagnose.`;
  }
  const trimmed = existingCtx.trim();
  return {
    ...instruction,
    context: trimmed ? `${trimmed}\n\n${ciContext}` : ciContext,
  };
}

// ── Parse worker response ────────────────────────────────────────────────────
// Exported for unit testing of marker extraction and access-guard normalization.
export function parseWorkerResponse(stdout, stderr) {
  const output = String(stdout || "");
  const combined = `${output}\n${String(stderr || "")}`;

  // Extract status marker
  const statusMatch = combined.match(/BOX_STATUS=(\w+)/i);
  const status = statusMatch ? statusMatch[1].toLowerCase() : "done";

  // Extract PR URL
  const prMatch = combined.match(/BOX_PR_URL=(https?:\/\/\S+)/i);
  const prUrl = prMatch ? prMatch[1] : null;

  // Extract branch name — workers output BOX_BRANCH=feature/... when they create/switch a branch
  const branchMatch = combined.match(/BOX_BRANCH=(\S+)/i);
  const currentBranch = branchMatch ? branchMatch[1] : null;

  // Extract files edited/created — workers output BOX_FILES_TOUCHED=src/a.js,src/b.js
  const filesMatch = combined.match(/BOX_FILES_TOUCHED=([^\n\r]+)/i);
  const filesTouched = filesMatch
    ? filesMatch[1].split(",").map(f => f.trim()).filter(Boolean)
    : [];

  const accessHeaderMatch = combined.match(/BOX_ACCESS=([^\n\r]+)/i);
  const accessHeader = accessHeaderMatch ? accessHeaderMatch[1].trim() : null;
  const accessPairs = accessHeader
    ? accessHeader
      .split(";")
      .map(part => String(part || "").trim())
      .filter(Boolean)
      .map(part => {
        const [rawScope, rawState] = part.split(":");
        return {
          scope: String(rawScope || "").trim().toLowerCase(),
          state: String(rawState || "").trim().toLowerCase(),
        };
      })
    : [];
  const blockedScopes = accessPairs.filter(item => item.state === "blocked").map(item => item.scope);
  const hasBlockedAccess = blockedScopes.length > 0;
  const blockerMatch = combined.match(/BOX_BLOCKER=([^\n\r]+)/i);
  let dispatchBlockReason = blockerMatch ? blockerMatch[1].trim() : null;

  // Guardrail: if access protocol reports blocked but status is not blocked,
  // force status to blocked for safe deterministic follow-up routing.
  // Exception: status=skipped means work is already done (e.g. already-merged);
  // tool access being blocked is irrelevant — do NOT override skipped to blocked.
  let normalizedStatus = ["done", "partial", "blocked", "error", "skipped"].includes(status) ? status : "done";
  if (hasBlockedAccess && normalizedStatus !== "blocked" && normalizedStatus !== "skipped") {
    normalizedStatus = "blocked";
  }
  if (normalizedStatus === "blocked" && !dispatchBlockReason) {
    dispatchBlockReason = hasBlockedAccess
      ? `access_blocked:${blockedScopes.join(",")}`
      : null;
  }

  // Summary: preserve full natural-language output (no truncation)
  const lines = output.split(/\r?\n/).filter(l => l.trim());
  const meaningfulLines = lines.filter(l =>
    !l.startsWith("●") &&
    !l.startsWith("✓") &&
    !l.startsWith("⏺") &&
    !l.includes("tool_call") &&
    l.trim().length > 5
  );
  const summary = meaningfulLines.join("\n") || output;

  // Extract verification evidence from worker output
  const verificationReport = parseVerificationReport(combined);
  const responsiveMatrix = parseResponsiveMatrix(combined);
  const cleanTreeStatus = hasCleanTreeStatusEvidence(combined);

  // Extract explicit merged SHA marker (BOX_MERGED_SHA=<sha>).
  // Stored for audit and lineage — also surfaced in the done-path artifact check.
  const mergedSha = extractMergedSha(output);
  const toolExecutionTelemetry = parseToolExecutionTelemetry(combined);

  if (
    toolExecutionTelemetry.deniedDecisions.length > 0
    && normalizedStatus !== "blocked"
    && normalizedStatus !== "skipped"
  ) {
    normalizedStatus = "blocked";
    if (!dispatchBlockReason) {
      const firstDenied = toolExecutionTelemetry.deniedDecisions[0];
      dispatchBlockReason = `tool_policy_denied:${String(firstDenied?.reasonCode || "unknown")}`;
    }
  }

  return {
    status: normalizedStatus,
    prUrl,
    currentBranch,
    filesTouched,
    accessHeader,
    blockedAccessScopes: blockedScopes,
    dispatchBlockReason,
    summary,
    fullOutput: output,
    verificationReport,
    responsiveMatrix,
    cleanTreeStatus,
    mergedSha,
    toolExecutionTelemetry,
  };
}

// ── Main Worker Conversation ─────────────────────────────────────────────────

export async function runWorkerConversation(config, roleName, instruction, history = [], sessionState: WorkerSessionState = {}, _token?: CancellationToken | null) {
  const taskHints: TaskHints = {
    estimatedLines: Number(instruction.estimatedLines || 0),
    estimatedDurationMinutes: Number(instruction.estimatedDurationMinutes || 0),
    complexity: String(instruction.complexity || instruction.estimatedComplexity || "")
  };

  // ── Task 2: Load compiled lesson policies and derive dispatch controls ──────
  // learned_policies.json is written by the orchestrator after each cycle from
  // postmortem lessons. Routing adjustments and prompt hard constraints are
  // derived here — fail-open so a missing/corrupt file never blocks dispatch.
  const learnedPolicies = loadLearnedPolicies(config);
  const routingAdjustments: RoutingAdjustment[] = deriveRoutingAdjustments(learnedPolicies);
  const hardConstraints: PromptHardConstraint[] = buildPromptHardConstraints(learnedPolicies);
  const recentROI = computeRecentROI(config, instruction.taskKind);
  const outcomeMetrics = computeOutcomeMetrics(config, instruction.taskKind);
  const _benchmarkSignal = analyzeBenchmarkReadiness(config, taskHints);
  const deliberation = decideDeliberationPolicy(
    taskHints,
    { recentROI },
    {
      benchmarkGroundTruth: loadBenchmarkGroundTruthSignal(config),
      outcomeMetrics,
    }
  );

  // ── Task 1: Uncertainty-aware model selection ─────────────────────────────
  // resolveModel now uses routeModelWithUncertainty (backed by historical ROI)
  // and applies policy routing adjustments from recurring failure lessons.
  let model = resolveModel(config, roleName, instruction.taskKind, taskHints, routingAdjustments);

  // ── Hard-task escalation: deliberation.mode → strong model upgrade ─────────
  // assessHardTaskEscalation (called inside decideDeliberationPolicy) can signal
  // that the task requires multi-attempt deliberation. When that happens, also
  // upgrade the model to strongModel if it is different from the resolved model,
  // ensuring hard tasks run on the most capable model available.
  if (deliberation.mode === "multi-attempt") {
    const defaultModel = config?.copilot?.defaultModel || "Claude Sonnet 4.6";
    const strongModel = config?.copilot?.strongModel || defaultModel;
    if (model !== strongModel) {
      const escalated = enforceModelPolicy(strongModel, taskHints, defaultModel);
      if (!escalated.downgraded) {
        const previousModel = model;
        model = strongModel;
        appendProgress(config,
          `[HARD_TASK_ESCALATION] ${roleName}: model upgraded ${previousModel} → ${model} (deliberation=multi-attempt reason=${deliberation.reason || "complex-task"})`
        ).catch(() => { /* non-critical */ });
      }
    }
  }

  // Classify complexity tier for prompt budget injection
  const { tier } = classifyComplexityTier(taskHints);

  // ── Cooperative cancellation: check before spawning subprocess ───────────
  if (_token?.cancelled) {
    throw new CancelledError(_token.reason || "cancelled-before-dispatch");
  }

  // ── Typed event: model routing decision telemetry ─────────────────────────
  // Emit after model is fully resolved (including deliberation escalation)
  // so downstream consumers see the final routing decision, not an intermediate one.
  // lineageId links this routing event to the matching premium_usage_log entry.
  let _dispatchLineageId: string | null = null;
  if (instruction.taskId) {
    try {
      const _fp = buildTaskFingerprint(instruction.taskKind || "general", instruction.task || "");
      const _attempt = Number(instruction.reworkAttempt || 0) + 1;
      _dispatchLineageId = buildLineageId(_fp, Number(instruction.taskId), _attempt);
    } catch { /* non-critical */ }
  }
  try {
    const policyResult = enforceModelPolicy(model, taskHints, config?.copilot?.defaultModel || "Claude Sonnet 4.6");
    emitEvent(EVENTS.POLICY_MODEL_ROUTED, EVENT_DOMAIN.POLICY, `model-route-${roleName}-${Date.now()}`, {
      roleName,
      resolvedModel: model,
      tier,
      wasDowngraded: policyResult.downgraded,
      routingReasonCode: deliberation.mode === "multi-attempt" ? "hard-task-escalation" : "standard",
      taskKind: instruction.taskKind || "general",
      lineageId: _dispatchLineageId,
      meetsQualityFloor: !policyResult.downgraded,
    });
  } catch { /* telemetry is non-critical */ }

  const command = config.env?.copilotCliCommand || "copilot";
  const agentSlug = nameToSlug(roleName); // "king-david", "esther", etc.

  // Resolve worker kind for role-based verification
  const workerConfig = findWorkerByName(config, roleName);
  const workerKind = workerConfig?.kind || null;
  const semanticContext = await buildSemanticTaskContext(config, instruction);
  const instructionWithSemanticContext = semanticContext
    ? {
      ...instruction,
      context: [semanticContext, String(instruction?.context || "").trim()].filter(Boolean).join("\n\n"),
    }
    : instruction;

  // ── Worker-runner CI context fallback ─────────────────────────────────────
  const taskKindNorm = String(instruction?.taskKind || "").toLowerCase().replace(/[_\s]+/g, "-");
  const taskTextLower = String(instruction?.task || "").toLowerCase();
  const isCiFixTask = taskKindNorm === "ci-fix" || /\bci[-_\s]?fix\b/.test(taskTextLower);
  const ciFixEnrichedInstruction = isCiFixTask
    ? await injectCiFailureContextIfMissing(instructionWithSemanticContext as Record<string, unknown>, config)
    : instructionWithSemanticContext;

  // Build conversation-only context with prompt tier budget and hard constraints injected
  const conversationContext = buildConversationContext(
    history, ciFixEnrichedInstruction, sessionState, config, workerKind,
    {
      tier,
      hardConstraints,
      deliberationMode: deliberation.mode,
      searchBudget: deliberation.searchBudget,
    }
  );

  // ── Memory-hit telemetry production ───────────────────────────────────────
  // Emit a record capturing how many memory hints/lessons were available for
  // this dispatch. Outcome starts null and is filled in after the worker returns.
  const _memoryHitTaskId = String(instruction.taskId || instruction.task || roleName || "");
  try {
    const kmPath = path.join(config.paths?.stateDir || "state", "knowledge_memory.json");
    let hintsInjected = 0;
    let lessonsInjected = 0;
    let droppedLowTrust = 0;
    let isPrivileged = false;
    if (existsSync(kmPath)) {
      const km = JSON.parse(readFileSync(kmPath, "utf8"));
      const privilegedCaller = isPrivilegedMemoryRequester(workerKind);
      isPrivileged = privilegedCaller;
      const targetFiltered = Array.isArray(km.promptHints)
        ? km.promptHints.filter((h: any) => {
            const target = String(h.targetAgent || "").toLowerCase();
            return target === "all" || target === "workers" || target === String(workerKind || "").toLowerCase();
          })
        : [];
      const { selected: filteredHints, droppedLowTrustCount: dropped1 } = filterMemoryEntriesByTrust(
        targetFiltered, { includeLowTrust: privilegedCaller, privilegedCaller },
      );
      const rawLessons = Array.isArray(km.lessons) ? km.lessons.slice(-5) : [];
      const { selected: filteredLessons, droppedLowTrustCount: dropped2 } = filterMemoryEntriesByTrust(
        rawLessons, { includeLowTrust: privilegedCaller, privilegedCaller },
      );
      const criticalLessons = filteredLessons.filter(
        (l: any) => l.severity === "critical" || l.severity === "warning",
      );
      hintsInjected   = filteredHints.length;
      lessonsInjected = criticalLessons.length;
      droppedLowTrust = dropped1 + dropped2;
    }
    const hitRecord = buildMemoryHitRecord({
      lineageId:       String(instruction.lineageId || instruction.lineageRootId || ""),
      taskId:          _memoryHitTaskId || null,
      workerKind:      workerKind ?? null,
      taskKind:        instruction.taskKind ?? null,
      hintsInjected,
      lessonsInjected,
      droppedLowTrust,
      isPrivileged,
    });
    logMemoryHit(config, hitRecord);
  } catch { /* telemetry is non-critical */ }

  await appendProgress(
    config,
    `[WORKER:${roleName}] [${instruction.taskKind || "general"}→${model}] deliberation=${deliberation.mode} ${truncate(instruction.task, 70)}`
  );

  await persistLegacyWorkerSessionArtifacts(config, String(roleName || "worker"), {
    phase: "start",
    task: String(instruction?.task || ""),
  });

  const updatedHistory = [
    ...history,
    { from: "prometheus", content: instruction.task, timestamp: new Date().toISOString() }
  ];

  const capabilityCheck = evaluateWorkerRoleCapability(config, roleName, instruction.taskKind, instruction.task);
  if (!capabilityCheck.allowed) {
    const summary = `Role capability check failed: ${capabilityCheck.code} — ${capabilityCheck.message}`;
    const replayClosure = buildReplayClosureEvidence(summary);
    const dispatchContract: DispatchVerificationContract = {
      doneWorkerWithVerificationReportEvidence: false,
      doneWorkerWithCleanTreeStatusEvidence: false,
      dispatchBlockReason: `role_capability_check_failed:${capabilityCheck.code}`,
      replayClosure: {
        contractSatisfied: replayClosure.contractSatisfied === true,
        canonicalCommands: Array.isArray(replayClosure.canonicalCommands) ? replayClosure.canonicalCommands : [],
        executedCommands: Array.isArray(replayClosure.executedCommands) ? replayClosure.executedCommands : [],
        rawArtifactEvidenceLinks: Array.isArray(replayClosure.rawArtifactEvidenceLinks) ? replayClosure.rawArtifactEvidenceLinks : [],
      },
    };
    await appendProgress(config, `[WORKER:${roleName}] ${summary}`);
    await persistLegacyWorkerSessionArtifacts(config, String(roleName || "worker"), {
      phase: "complete",
      task: String(instruction?.task || ""),
      status: "blocked",
      pr: null,
      dispatchBlockReason: dispatchContract.dispatchBlockReason,
    });
    updatedHistory.push({
      from: roleName,
      content: summary,
      fullOutput: summary,
      prUrl: null,
      timestamp: new Date().toISOString(),
      status: "blocked"
    });
    return {
      status: "blocked",
      summary,
      prUrl: null,
      currentBranch: null,
      filesTouched: [],
      updatedHistory,
      workerKind,
      tier,
      verificationReport: null,
      responsiveMatrix: null,
      verificationEvidence: null,
      dispatchContract,
      fullOutput: summary,
      failureClassification: null,
      retryDecision: null
    };
  }

  // Single-prompt mode: no autopilot continuations.
  // All implementation workers dispatched by the daemon need full tool access.
  const allowAllTools = shouldEnableFullToolAccess(roleName, instruction.taskKind, instruction.task);
  const args = buildAgentArgs({
    agentSlug,
    prompt: conversationContext,
    model,
    allowAll: allowAllTools,
    noAskUser: allowAllTools,
    maxContinues: undefined
  });

  // Compute timeout: config.runtime.workerTimeoutMinutes → ms.
  // 0 or negative means no timeout for worker execution.
  const workerTimeoutMinutes = Number(config?.runtime?.workerTimeoutMinutes || 0);
  const workerTimeoutMs = workerTimeoutMinutes > 0 ? workerTimeoutMinutes * 60 * 1000 : null;
  const liveLogPath = getLiveLogPath(config, roleName);

  await appendLiveWorkerLog(
    liveLogPath,
    [
      "",
      `${"=".repeat(80)}`,
      `[${new Date().toISOString()}] START role=${roleName} model=${model}`,
      `TASK: ${instruction.task}`,
      `${"-".repeat(80)}`,
      ""
    ].join("\n")
  );

  const startMs = Date.now();

  // Circuit breaker: detect consecutive transient API errors from the Copilot CLI
  // and abort the process early instead of waiting for 45-minute timeout.
  const TRANSIENT_ERROR_THRESHOLD = 10;
  let transientErrorCount = 0;
  const abortController = new AbortController();

  // Propagate external cancellation token into the subprocess AbortController.
  // This allows the orchestrator's per-cycle token to surface here and abort
  // a long-running copilot CLI spawn without waiting for the next stop check.
  if (_token?.cancelled) {
    abortController.abort(_token.reason || "cancelled-before-spawn");
  }

  const result = await spawnAsync(command, args, {
    env: {
      ...process.env,
      GH_TOKEN: config.env?.githubToken || process.env.GH_TOKEN || "",
      GITHUB_TOKEN: config.env?.githubToken || process.env.GITHUB_TOKEN || "",
      TARGET_REPO: config.env?.targetRepo || "",
      TARGET_BASE_BRANCH: config.env?.targetBaseBranch || "main"
    },
    timeoutMs: workerTimeoutMs,
    signal: abortController.signal,
    onStdout: (chunk) => {
      const text = String(chunk);
      appendLiveWorkerLog(liveLogPath, text).catch(() => {});
      if (/transient API error/i.test(text)) {
        transientErrorCount++;
        if (transientErrorCount >= TRANSIENT_ERROR_THRESHOLD) {
          abortController.abort(
            `[BOX] Transient API error circuit breaker: ${transientErrorCount} consecutive errors — aborting to avoid waste`
          );
        }
      } else if (text.trim().length > 20) {
        // Reset counter on meaningful (non-error) output
        transientErrorCount = 0;
      }
    },
    onStderr: (chunk) => {
      const text = String(chunk);
      appendLiveWorkerLog(liveLogPath, `[stderr] ${text}`).catch(() => {});
      if (/transient API error/i.test(text)) {
        transientErrorCount++;
        if (transientErrorCount >= TRANSIENT_ERROR_THRESHOLD) {
          abortController.abort(
            `[BOX] Transient API error circuit breaker: ${transientErrorCount} consecutive errors — aborting to avoid waste`
          );
        }
      }
    }
  }) as SpawnAsyncResult;

  const stdout = String(result?.stdout || "");
  const stderr = String(result?.stderr || "");

  if (result.status !== 0) {
    const isTransient = result.aborted === true && /transient API error circuit breaker/i.test(stderr);
    const exitCodeInfo = classifyExitCode(result.status);
    const reasonCode = isTransient ? "TRANSIENT_API_ERROR" : exitCodeInfo?.reasonCode ?? (result.timedOut ? "PROCESS_TIMEOUT" : "UNKNOWN_EXIT");
    const retryClass = isTransient ? "cooldown" : exitCodeInfo?.retryClass ?? (result.timedOut ? "cooldown" : null);
    const label = isTransient ? `TransientAPIError` : result.timedOut ? `Timeout` : `Error exit=${result.status}`;
    await appendLiveWorkerLog(
      liveLogPath,
      `\n[${new Date().toISOString()}] END status=error exit=${result.status} reason_code=${reasonCode} retry_class=${retryClass ?? "none"}${result.timedOut ? " timeout=true" : ""}${isTransient ? " transient=true" : ""}\n`
    );
    await appendProgress(config, `[WORKER:${roleName}] ${label} reason_code=${reasonCode} retry_class=${retryClass ?? "none"}`);
    const errorMsg = truncate(stderr || stdout || "unknown error", 300);

    // Persist structured escalation for worker errors/timeouts (non-critical write)
    appendEscalation(config, {
      role: roleName,
      task: instruction.task,
      blockingReasonClass: BLOCKING_REASON_CLASS.WORKER_ERROR,
      attempts: Number(instruction.reworkAttempt || 0),
      nextAction: NEXT_ACTION.RETRY,
      summary: label + ": " + errorMsg
    }).catch(() => { /* non-fatal */ });

    // Classify and persist failure (non-critical — never blocks the return)
    {
      const cfResult = classifyFailure({
        workerStatus: "error",
        blockingReasonClass: BLOCKING_REASON_CLASS.WORKER_ERROR,
        errorMessage: errorMsg,
        logLines: result.timedOut ? ["Process timed out"] : [],
        taskId: instruction.taskId || null,
      });
      if (cfResult.ok) {
        appendFailureClassification(config, cfResult.classification).catch(() => { /* non-fatal */ });
      }
    }

    // Resolve adaptive retry decision for error path
    let errorRetryDecision = null;
    try {
      const exitClassification = classifyFailure({
        workerStatus: "error",
        blockingReasonClass: BLOCKING_REASON_CLASS.WORKER_ERROR,
        errorMessage: errorMsg,
        logLines: result.timedOut ? ["Process timed out"] : [],
        taskId: instruction.taskId || null,
      });
      if (exitClassification.ok) {
        const rd = resolveRetryAction(
          exitClassification.classification.primaryClass,
          Number(instruction.reworkAttempt || 0),
          config,
          instruction.taskId || null
        );
        if (rd.ok) {
          errorRetryDecision = rd.decision;
          persistRetryMetric(config, rd.decision);
        }
      }
    } catch { /* non-fatal */ }

    updatedHistory.push({
      from: roleName,
      content: `ERROR: ${errorMsg}`,
      timestamp: new Date().toISOString(),
      status: "error"
    });
    await persistLegacyWorkerSessionArtifacts(config, String(roleName || "worker"), {
      phase: "complete",
      task: String(instruction?.task || ""),
      status: isTransient ? "transient_error" : "error",
      pr: null,
      dispatchBlockReason: null,
    });
    return {
      status: isTransient ? "transient_error" : "error",
      summary: errorMsg,
      updatedHistory,
      prUrl: null,
      tier,
      failureClassification: null,
      retryDecision: errorRetryDecision
    };
  }

  // Save raw output for debugging
  try {
    writeFileSync(
      path.join(config.paths?.stateDir || "state", `debug_worker_${roleName.replace(/\s+/g, "_")}.txt`),
      `TASK: ${instruction.task}\n\nOUTPUT:\n${stdout}`,
      "utf8"
    );
  } catch { /* non-critical */ }

  const parsed: ParsedWorkerResponse = parseWorkerResponse(stdout, stderr);
  const replayClosure = buildReplayClosureEvidence(parsed.fullOutput || "");
  const normalizedWorkerStatus = String(parsed.status || "").toLowerCase();
  const dispatchContract: DispatchVerificationContract = {
    doneWorkerWithVerificationReportEvidence:
      (normalizedWorkerStatus === "done" || normalizedWorkerStatus === "success")
      && hasVerificationReportEvidence(parsed.fullOutput || ""),
    doneWorkerWithCleanTreeStatusEvidence:
      (normalizedWorkerStatus === "done" || normalizedWorkerStatus === "success")
      && parsed.cleanTreeStatus === true,
    dispatchBlockReason: normalizedWorkerStatus === "blocked"
      ? (parsed.dispatchBlockReason || "worker_reported_blocked_without_reason")
      : null,
    replayClosure: {
      contractSatisfied: replayClosure.contractSatisfied === true,
      canonicalCommands: Array.isArray(replayClosure.canonicalCommands) ? replayClosure.canonicalCommands : [],
      executedCommands: Array.isArray(replayClosure.executedCommands) ? replayClosure.executedCommands : [],
      rawArtifactEvidenceLinks: Array.isArray(replayClosure.rawArtifactEvidenceLinks) ? replayClosure.rawArtifactEvidenceLinks : [],
    },
  };

  // Soft-fail policy: if only API access is blocked for any worker,
  // attempt an orchestrator-side recovery: commit the dirty working tree to a
  // feature branch and open a PR using the host process's git/gh access.
  // This prevents work being silently discarded when the subagent's CLI is blocked.
  if (
    parsed.status === "blocked"
    && Array.isArray(parsed.blockedAccessScopes)
    && parsed.blockedAccessScopes.length === 1
    && String(parsed.blockedAccessScopes[0] || "") === "api"
  ) {
    parsed.status = "partial";
    parsed.summary = `[ACCESS SOFTENED] api-only access block downgraded to partial to avoid cycle stall\n${parsed.summary}`;
    await appendProgress(config, `[WORKER:${roleName}] ACCESS_SOFTENED api-only block → partial (non-blocking)`);

    // Recovery: if the worker left uncommitted changes, commit and push them here.
    try {
      const cwd = String(config.rootDir || process.cwd());
      const statusResult = await spawnAsync("git", ["status", "--porcelain"], { cwd }) as SpawnAsyncResult;
      const isDirty = String(statusResult?.stdout || "").trim().length > 0;
      if (isDirty && !parsed.prUrl) {
        const slug = String(roleName || "worker").toLowerCase().replace(/[^a-z0-9-]/g, "-");
        const ts = Date.now();
        const branch = `recovery/${slug}-${ts}`;
        await spawnAsync("git", ["checkout", "-b", branch], { cwd }) as SpawnAsyncResult;
        await spawnAsync("git", ["add", "-A"], { cwd }) as SpawnAsyncResult;
        const commitMsg = `chore: ${roleName} changes (api-blocked orchestrator recovery)`;
        await spawnAsync("git", ["commit", "-m", commitMsg], { cwd }) as SpawnAsyncResult;
        await spawnAsync("git", ["push", "-u", "origin", branch], { cwd }) as SpawnAsyncResult;
        const prTitle = `[${roleName}] api-blocked recovery — automated commit`;
        const prBody = `Orchestrator auto-committed uncommitted changes after worker reported api:blocked.\n\nOriginal task: ${String(instruction.task || "").slice(0, 200)}`;
        const prResult = await spawnAsync("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", prTitle, "--body", prBody], { cwd }) as SpawnAsyncResult;
        const prUrl = String(prResult?.stdout || "").trim().match(/https:\/\/\S+/)?.[0] || null;
        if (prUrl) {
          parsed.prUrl = prUrl;
          parsed.summary = `[ACCESS RECOVERY] orchestrator opened PR from dirty tree: ${prUrl}\n${parsed.summary}`;
          await appendProgress(config, `[WORKER:${roleName}] ACCESS_RECOVERY pr-opened branch=${branch} pr=${prUrl}`);
        }
      }
    } catch (recoveryErr) {
      // Recovery is best-effort — never block the cycle on git/gh failures
      await appendProgress(config, `[WORKER:${roleName}] ACCESS_RECOVERY failed (non-fatal): ${String((recoveryErr as Error)?.message || recoveryErr).slice(0, 120)}`).catch(() => {});
    }
  }

  // If access was reported as blocked, persist a structured escalation (non-critical)
  if (parsed.status === "blocked" && /BOX_ACCESS=[^\n]*blocked/i.test(stdout)) {
    appendEscalation(config, {
      role: roleName,
      task: instruction.task,
      blockingReasonClass: BLOCKING_REASON_CLASS.ACCESS_BLOCKED,
      attempts: Number(instruction.reworkAttempt || 0),
      nextAction: NEXT_ACTION.RETRY,
      summary: "Worker reported BOX_ACCESS blocked"
    }).catch(() => { /* non-fatal */ });
  }

  const windowsGlobArtifact = classifyNodeTestGlobWindowsArtifact(stdout);
  if (parsed.status === "blocked" && windowsGlobArtifact.isArtifact && windowsGlobArtifact.hasNpmTestPassEvidence) {
    parsed.status = "partial";
    parsed.summary = `[VERIFICATION NORMALIZED] node --test glob failure classified as Windows shell-expansion artifact; npm test passed evidence detected\n${parsed.summary}`;
    await appendProgress(config, `[WORKER:${roleName}] VERIFICATION_NORMALIZED windows-node-test-glob-artifact`);
  }

  // Policy gate: protected path changes require reviewer approval,
  // so workers cannot auto-finish these changes as fully done.
  try {
    const policy = await loadPolicy(config);
    if (policy?.requireReviewerApprovalForProtectedPaths) {
      const protectedTouched = getProtectedPathMatches(policy, parsed.filesTouched);
      if (protectedTouched.length > 0 && parsed.status === "done") {
        parsed.status = "partial";
        parsed.summary = `Reviewer approval required for protected paths: ${protectedTouched.join(", ")}\n${parsed.summary}`;
      }
    }

    const pathViolations = getRolePathViolations(policy, roleName, parsed.filesTouched);
    if (pathViolations.hasViolation) {
      const deniedPreview = pathViolations.deniedMatches.slice(0, 3).join(", ");
      const outsidePreview = pathViolations.outsideAllowed.slice(0, 3).join(", ");
      const violationSummary = [
        pathViolations.deniedMatches.length > 0 ? `denied paths: ${deniedPreview}${pathViolations.deniedMatches.length > 3 ? " ..." : ""}` : "",
        pathViolations.outsideAllowed.length > 0 ? `outside allowed paths: ${outsidePreview}${pathViolations.outsideAllowed.length > 3 ? " ..." : ""}` : ""
      ].filter(Boolean).join(" | ");

      parsed.status = "blocked";
      parsed.summary = `Role path policy violation for ${roleName}: ${violationSummary}\n${parsed.summary}`;

      // Persist structured escalation for policy violations (non-critical)
      appendEscalation(config, {
        role: roleName,
        task: instruction.task,
        blockingReasonClass: BLOCKING_REASON_CLASS.POLICY_VIOLATION,
        attempts: Number(instruction.reworkAttempt || 0),
        nextAction: NEXT_ACTION.ESCALATE_TO_HUMAN,
        summary: `Role path policy violation: ${violationSummary}`,
        prUrl: parsed.prUrl
      }).catch(() => { /* non-fatal */ });
    }
  } catch {
    // Non-fatal: if policy cannot be read, keep existing worker result.
  }

  // Auto-resolve transient ACCESS_BLOCKED escalations once the same worker+task
  // completes or partially completes in a later retry.
  if (parsed.status !== "blocked" && parsed.status !== "error") {
    resolveEscalationsForTask(config, {
      role: roleName,
      task: instruction.task,
      blockingReasonClass: BLOCKING_REASON_CLASS.ACCESS_BLOCKED,
      resolutionSummary: `Worker recovered with status=${parsed.status}`,
      resolvedBy: `worker:${roleName}`,
    }).catch(() => { /* non-fatal */ });
  }

  // Track premium request usage per worker (always log, even for failed verification attempts)
  // Derive the shared lineage key so premium_usage_log entries can be joined with lineage_graph.
  let _premiumLineageId: string | null = null;
  if (instruction.taskId) {
    try {
      const _fp = buildTaskFingerprint(instruction.taskKind || "general", instruction.task || "");
      const _attempt = Number(instruction.reworkAttempt || 0) + 1;
      _premiumLineageId = buildLineageId(_fp, Number(instruction.taskId), _attempt);
    } catch { /* non-critical — lineage key is observability only */ }
  }
  logPremiumUsage(config, roleName, model, instruction.taskKind, Date.now() - startMs, {
    outcome: parsed.status,
    taskId: instruction.taskId || instruction.task || null,
    lineageId: _premiumLineageId,
  });

  // ── Outcome mapping: tie memory-hit record to final worker outcome ─────────
  // Updates the pre-dispatch hit record (outcome=null) with the actual result so
  // cycle analytics can compute memory ROI (hitRate × successRateOnHits).
  updateMemoryHitOutcome(config, _memoryHitTaskId || null, parsed.status);

  // ── Rework budget — pre-computed so both gates share the same values ─────────
  // Declared here (before the artifact gate) so the artifact gate can decide
  // whether to hard-block or to defer to the rework loop.
  const requireTaskContract = config?.runtime?.requireTaskContract !== false;
  const maxReworkAttempts = Number(config?.runtime?.maxReworkAttempts ?? 2);
  // reworkAttempt is set by buildReworkInstruction on re-dispatches; 0 on the first call
  const currentAttempt = Number(instruction.reworkAttempt || 0);

  // ── Unconditional artifact gate (strict merge evidence gate) ─────────────────
  // For any worker+task combination that requires a post-merge artifact
  // (determined by role kind AND task kind), this gate is NON-BYPASSABLE —
  // it runs regardless of config.runtime.requireTaskContract.
  //
  // Discovery-safe task kinds (scan, doc, observation, diagnosis, discovery,
  // research, review, audit) are exempt even for done-capable roles, eliminating
  // false completion loss on read-only / non-merge tasks (adaptive throttle bypass).
  //
  // Rework routing: when the verification gate and rework budget are both active
  // (requireTaskContract=true, currentAttempt < maxReworkAttempts), the artifact
  // gate does NOT hard-block immediately — it keeps parsed.status="done" so that
  // validateWorkerContract catches the same gaps and decideRework can dispatch a
  // targeted rework instruction to the worker.  Only when rework is exhausted (or
  // the verification gate is disabled) does the gate hard-block.
  //
  // Explicit telemetry is emitted for all gate outcomes:
  //   - discoveryBypass=true  → non-merge task; artifact gate skipped
  //   - rework-queued         → artifact missing but rework budget remains
  //   - hard-blocked          → artifact missing and rework exhausted / gate disabled
  //
  // The artifact is computed once here and reused by both this gate and the
  // subsequent validateWorkerContract call, avoiding duplicate evaluation.
  const isArtifactRequired = parsed.status === "done" && isArtifactGateRequired(workerKind ?? "unknown", instruction.taskKind);
  const precomputedArtifact = isArtifactRequired
    ? checkPostMergeArtifact(parsed.fullOutput || parsed.summary || "")
    : undefined;

  // Telemetry: emit bypass signal when discovery-safe task passes without artifact check
  if (parsed.status === "done" && !isArtifactRequired && isDiscoverySafeTask(instruction.taskKind)) {
    try {
      appendProgress(config,
        `[ARTIFACT GATE] ${roleName} taskKind=${instruction.taskKind} discoveryBypass=true — non-merge task bypasses artifact gate`
      );
    } catch { /* non-critical */ }
  }

  if (isArtifactRequired) {
    const artifact = precomputedArtifact!;
    if (!artifact.hasArtifact) {
      const artifactGaps = collectArtifactGaps(artifact);

      // Rework-capable path: verification gate is active and worker still has budget.
      // Keep status="done" so validateWorkerContract feeds artifact gaps into decideRework
      // with a targeted prompt.  Hard-block only when rework is exhausted or disabled.
      const canRework = requireTaskContract && currentAttempt < maxReworkAttempts;

      try {
        appendProgress(config,
          `[ARTIFACT GATE] ${roleName} ${canRework ? "rework-queued" : "hard-blocked"} taskKind=${instruction.taskKind || "unknown"} discoveryBypass=false hasSha=${artifact.hasSha} hasTestOutput=${artifact.hasTestOutput} gaps=${artifactGaps.length}`
        );
      } catch { /* non-critical */ }

      if (!canRework) {
        parsed.status = "blocked";
        parsed.summary = `[ARTIFACT GATE] done hard-blocked — ${artifactGaps.join("; ")}\n${parsed.summary}`;
      }
      // When canRework=true: status stays "done"; validateWorkerContract will catch
      // the same artifact gaps via collectArtifactGaps(precomputedArtifact) and
      // decideRework will build a targeted rework instruction for the worker.

      // Write structured audit entry so all artifact gate outcomes are traceable
      // in verification_audit.json alongside the soft-verify path entries.
      try {
        const auditPath = path.join(config.paths?.stateDir || "state", "verification_audit.json");
        let audit: unknown[] = [];
        try {
          if (existsSync(auditPath)) {
            const raw = readFileSync(auditPath, "utf8");
            const parsed2 = JSON.parse(raw);
            if (Array.isArray(parsed2)) audit = parsed2;
          }
        } catch { audit = []; }
        audit.push(buildArtifactAuditEntry(artifact, artifactGaps, {
          gateSource: canRework ? "rework-queued" : "hard-block",
          workerKind: workerKind ?? "unknown",
          roleName: String(roleName),
          taskId: instruction.taskId || null,
          taskSnippet: String(instruction.task || "").slice(0, 100),
        }));
        if (audit.length > 200) audit = audit.slice(-200);
        writeFileSync(auditPath, JSON.stringify(audit, null, 2), "utf8");
      } catch { /* non-critical */ }
    }
  }

  // ── Verification gate — evidence-based done acceptance ──────────────────────
  // Feature-flagged via config.runtime.requireTaskContract (default: true).
  // Rework threshold: config.runtime.maxReworkAttempts (default: 2, per Athena AC#2 concern).
  // Evidence snapshot schema includes profile, report fields, gaps, attempt, and timestamp (AC#4).
  // requireTaskContract / maxReworkAttempts / currentAttempt declared above (shared with artifact gate).
  if (requireTaskContract && parsed.status === "done") {

    // Artifact check is mandatory for all done-capable workers, even when workerKind is unknown.
    // Unknown workerKind falls back to the DEFAULT_PROFILE (build required, others optional).
    // Task kind is passed through so non-merge tasks (scan, doc, etc.) skip the artifact gate.
    // verificationText is passed from the packet's verification field so the named-test-proof gate
    // fires when the packet names a specific test file/description in its verification commands.
    // precomputedArtifact is reused from the hard-block gate above to avoid evaluating the same
    // output string twice.
    const effectiveKind = workerKind ?? "unknown";
    const validationResult = validateWorkerContract(effectiveKind, {
      status: parsed.status,
      fullOutput: parsed.fullOutput,
      summary: parsed.summary
    }, {
      gatesConfig: config?.gates as Record<string, unknown> | undefined,
      taskKind: instruction.taskKind,
      verificationText: String(instruction.verification || "").trim() || null,
      precomputedArtifact,
    });

    // Evidence snapshot for audit (AC#4 defined schema)
    const postMergeArtifact = validationResult.evidence?.postMergeArtifact as ReturnType<typeof checkPostMergeArtifact> | undefined;
    const verificationEvidence: VerificationEvidence = {
      profile: String(validationResult.evidence?.profile || effectiveKind),
      hasReport: Boolean(validationResult.evidence?.hasReport),
      report: validationResult.evidence?.report || {},
      responsiveMatrix: validationResult.evidence?.responsiveMatrix || {},
      prUrl: (validationResult.evidence?.prUrl as string | null) ?? null,
      gaps: validationResult.gaps,
      passed: validationResult.passed,
      attempt: currentAttempt,
      validatedAt: new Date().toISOString(),
      roleName: String(roleName),
      taskSnippet: String(instruction.task || "").slice(0, 100),
      optionalFieldFailures: Array.isArray(validationResult.evidence?.optionalFieldFailures)
        ? (validationResult.evidence.optionalFieldFailures as string[])
        : [],
      toolExecutionTelemetry: validationResult.evidence?.toolExecutionTelemetry ?? null,
      artifactDetail: postMergeArtifact ? {
        hasSha: postMergeArtifact.hasSha,
        hasTestOutput: postMergeArtifact.hasTestOutput,
        hasReplayAttachEvidence: (postMergeArtifact as any).hasReplayAttachEvidence === true,
        hasExplicitTestOutputBlock: postMergeArtifact.hasExplicitTestBlock,
        hasUnfilledPlaceholder: postMergeArtifact.hasUnfilledPlaceholder,
        hasExplicitShaMarker: postMergeArtifact.hasExplicitShaMarker,
        hasExplicitTestBlock: postMergeArtifact.hasExplicitTestBlock,
        mergedSha: postMergeArtifact.mergedSha ?? null,
      } : null,
    };

    // Persist evidence snapshot for audit trail (non-critical, keep last 200 entries)
    try {
      const auditPath = path.join(config.paths?.stateDir || "state", "verification_audit.json");
      let audit = [];
      try {
        if (existsSync(auditPath)) {
          audit = JSON.parse(readFileSync(auditPath, "utf8"));
          if (!Array.isArray(audit)) audit = [];
        }
      } catch { audit = []; }
      audit.push(verificationEvidence);
      if (audit.length > 200) audit = audit.slice(-200);
      writeFileSync(auditPath, JSON.stringify(audit, null, 2), "utf8");
    } catch { /* non-critical */ }

    const reworkDecision = decideRework(validationResult, instruction.task, currentAttempt, maxReworkAttempts);

    if (reworkDecision.shouldEscalate) {
      // Max rework attempts exhausted — block the task instead of looping
      parsed.status = "blocked";
      parsed.summary = `[VERIFICATION GATE] Escalated after ${currentAttempt} failed attempt(s). ${reworkDecision.escalationReason}\n${parsed.summary}`;

      // Persist structured escalation payload (non-critical write)
      appendEscalation(config, {
        role: roleName,
        task: instruction.task,
        blockingReasonClass: BLOCKING_REASON_CLASS.MAX_REWORK_EXHAUSTED,
        attempts: currentAttempt,
        nextAction: NEXT_ACTION.ESCALATE_TO_HUMAN,
        summary: reworkDecision.escalationReason || validationResult.gaps.slice(0, 3).join("; "),
        prUrl: parsed.prUrl
      }).catch(() => { /* non-fatal */ });
    } else if (reworkDecision.shouldRework) {
      // Push the failed attempt into history so the worker sees context on rework
      updatedHistory.push({
        from: roleName,
        content: `[VERIFICATION FAILED — attempt ${currentAttempt + 1}/${maxReworkAttempts}] ${truncate(parsed.summary, 400)}`,
        fullOutput: parsed.fullOutput,
        prUrl: parsed.prUrl,
        timestamp: new Date().toISOString(),
        status: "verification_failed",
        verificationEvidence
      });
      await appendProgress(config,
        `[WORKER:${roleName}] Verification failed (attempt ${currentAttempt + 1}/${maxReworkAttempts}) — gaps: ${validationResult.gaps.slice(0, 2).join("; ")}`
      );
      // Re-dispatch with rework instruction; recursive depth is bounded by maxReworkAttempts
      return runWorkerConversation(config, roleName, reworkDecision.instruction, updatedHistory, sessionState);
    }

    parsed.verificationEvidence = verificationEvidence;
  }

  await appendLiveWorkerLog(
    liveLogPath,
    `\n[${new Date().toISOString()}] END status=${parsed.status}${parsed.prUrl ? ` pr=${parsed.prUrl}` : ""}\n`
  );

  await appendProgress(config,
    `[WORKER:${roleName}] Completed status=${parsed.status}${parsed.prUrl ? ` PR=${parsed.prUrl}` : ""}`
  );

  await persistLegacyWorkerSessionArtifacts(config, String(roleName || "worker"), {
    phase: "complete",
    task: String(instruction?.task || ""),
    status: String(parsed.status || "unknown"),
    pr: parsed.prUrl || null,
    dispatchBlockReason: dispatchContract.dispatchBlockReason,
  });

  // ── Optional lineage graph recording (non-blocking; rollback via config.runtime.lineageGraphEnabled=false) ──
  // Only records when instruction.taskId is provided. Safe to skip — lineage is observability,
  // not execution state. On any failure, warn and continue.
  if (config?.runtime?.lineageGraphEnabled !== false && instruction.taskId) {
    try {
      const fp = buildTaskFingerprint(instruction.taskKind || "general", instruction.task || "");
      const attempt = Number(instruction.reworkAttempt || 0) + 1;
      const taskId = Number(instruction.taskId);
      const parentId = instruction.parentLineageId || null;
      const rootId = Number(instruction.lineageRootId || taskId);
      const depth = Number(instruction.lineageDepth || instruction.reworkAttempt || 0);
      const splitAncestry = Array.isArray(instruction.splitAncestry) ? instruction.splitAncestry : [];

      // Map worker result status to lineage entry status
      const statusMap = { done: LINEAGE_ENTRY_STATUS.PASSED, blocked: LINEAGE_ENTRY_STATUS.BLOCKED, error: LINEAGE_ENTRY_STATUS.FAILED };
      const entryStatus = statusMap[parsed.status] || LINEAGE_ENTRY_STATUS.FAILED;

      const lineageEntry = {
        id: buildLineageId(fp, taskId, attempt),
        taskId,
        semanticKey: String(instruction.semanticKey || `${instruction.taskKind || "general"}::${fp.slice(0, 16)}`),
        fingerprint: fp,
        parentId,
        rootId,
        depth,
        status: entryStatus,
        timestamp: new Date().toISOString(),
        failureReason: (entryStatus === LINEAGE_ENTRY_STATUS.FAILED || entryStatus === LINEAGE_ENTRY_STATUS.BLOCKED)
          ? truncate(parsed.summary || "unknown failure", 200)
          : null,
        splitAncestry
      };

      await appendLineageEntry(config, lineageEntry);
    } catch (lineageErr) {
      // Lineage recording failures are non-fatal — log but never block execution
      await appendProgress(config, `[LINEAGE] recording failed (non-fatal): ${String(lineageErr?.message || lineageErr)}`).catch(() => {});
    }
  }

  // Classify failure for error/blocked/partial statuses (non-critical)
  let failureClassification = null;
  let retryDecision = null;
  if (parsed.status === "error" || parsed.status === "blocked" || parsed.status === "partial") {
    // Derive blockingReasonClass from the escalation that was persisted (best-effort)
    let derivedRc = null;
    if (parsed.status === "blocked") {
      // Check common markers in summary text
      if (/policy violation|path policy/i.test(parsed.summary)) {
        derivedRc = BLOCKING_REASON_CLASS.POLICY_VIOLATION;
      } else if (/BOX_ACCESS.*blocked/i.test(parsed.fullOutput || "")) {
        derivedRc = BLOCKING_REASON_CLASS.ACCESS_BLOCKED;
      } else if (/rework.*exhausted|max rework/i.test(parsed.summary)) {
        derivedRc = BLOCKING_REASON_CLASS.MAX_REWORK_EXHAUSTED;
      } else if (/verification gate/i.test(parsed.summary)) {
        derivedRc = BLOCKING_REASON_CLASS.VERIFICATION_GATE;
      } else if (/role_capability_check_failed|role capability/i.test(parsed.dispatchBlockReason || "")) {
        derivedRc = BLOCKING_REASON_CLASS.POLICY_VIOLATION;
      }
    }

    const cfResult = classifyFailure({
      workerStatus: parsed.status,
      blockingReasonClass: derivedRc,
      errorMessage: parsed.summary,
      taskId: instruction.taskId || null,
    });
    if (cfResult.ok) {
      failureClassification = cfResult.classification;
      appendFailureClassification(config, cfResult.classification).catch(() => { /* non-fatal */ });

      // Resolve adaptive retry decision based on failure class (non-critical)
      try {
        const rd = resolveRetryAction(
          cfResult.classification.primaryClass,
          Number(instruction.reworkAttempt || 0),
          config,
          instruction.taskId || null
        );
        if (rd.ok) {
          retryDecision = rd.decision;
          persistRetryMetric(config, rd.decision);
        }
      } catch { /* non-fatal — retry resolution must never block worker results */ }
    }
  }

  // Add worker's response to history
  updatedHistory.push({
    from: roleName,
    content: parsed.summary,
    fullOutput: parsed.fullOutput,
    prUrl: parsed.prUrl,
    timestamp: new Date().toISOString(),
    status: parsed.status
  });

  return {
    status: parsed.status,
    summary: parsed.summary,
    prUrl: parsed.prUrl,
    currentBranch: parsed.currentBranch,
    filesTouched: parsed.filesTouched,
    updatedHistory,
    workerKind,
    tier,
    verificationReport: parsed.verificationReport,
    responsiveMatrix: parsed.responsiveMatrix,
    verificationEvidence: parsed.verificationEvidence || null,
    dispatchContract,
    fullOutput: parsed.fullOutput,
    failureClassification,
    retryDecision
  };
}
