import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readJson, spawnAsync, writeJson } from "./fs_utils.js";
import { agentFileExistsForExecution, appendAgentLiveLog, appendAgentLiveLogDetail, buildAgentArgs, parseAgentOutput, writeAgentDebugFile } from "./agent_loader.js";
import { appendProgress } from "./state_tracker.js";
import { getTargetCompletionPath, getTargetSessionPath, loadActiveTargetSession } from "./target_session_state.js";
import { evaluateTargetClosure, isTargetClosureDecisionTerminal } from "./target_closure_engine.js";

export const TARGET_SUCCESS_CONTRACT_STATUS = Object.freeze({
  OPEN: "open",
  FULFILLED: "fulfilled",
  FULFILLED_WITH_HANDOFF: "fulfilled_with_handoff",
});

const NON_BLOCKING_ACCEPTANCE_CRITERIA = new Set(["clarified", "planning-ready"]);
const PROJECT_READINESS_ACCEPTANCE_CRITERIA = new Set([
  "single_target_project_readiness",
  "target_project_readiness",
  "project_readiness",
  "best_possible_delivery",
  "saturated_best_effort_delivery",
]);
const STOPWORDS = new Set([
  "a", "an", "and", "app", "be", "build", "completed", "correctly", "for", "has", "have", "i", "in",
  "is", "it", "list", "main", "of", "on", "or", "project", "simple", "the", "to", "want", "working",
]);

const PRODUCT_PRESENTER_AGENT_SLUG = "product-presenter";
const DEBUG_WORKER_FILE_PATTERN = /^debug_worker_[A-Za-z0-9_-]+\.txt$/;
const PROJECT_READINESS_LEDGER_FILE = "project_readiness_ledger.json";
const PROJECT_READINESS_REPORT_FILE = "project_readiness_report.json";
const PROJECT_READINESS_MODE = Object.freeze({
  BEST_EFFORT: "best_effort",
  STRICT_SATURATION: "strict_saturation",
});
const DEFAULT_PROJECT_READINESS_THRESHOLDS = Object.freeze({
  stableSampleMin: 3,
  maxGrowthSignalsInStableWindow: 0,
});

function resolveProjectReadinessThresholds(config: any) {
  const raw = config?.runtime?.singleTargetProjectReadiness?.thresholds || {};
  const stableSampleMin = Number.isFinite(Number(raw?.stableSampleMin))
    ? Math.max(2, Math.floor(Number(raw.stableSampleMin)))
    : DEFAULT_PROJECT_READINESS_THRESHOLDS.stableSampleMin;
  const maxGrowthSignalsInStableWindow = Number.isFinite(Number(raw?.maxGrowthSignalsInStableWindow))
    ? Math.max(0, Math.floor(Number(raw.maxGrowthSignalsInStableWindow)))
    : DEFAULT_PROJECT_READINESS_THRESHOLDS.maxGrowthSignalsInStableWindow;
  return {
    stableSampleMin,
    maxGrowthSignalsInStableWindow,
  };
}

const DELIVERY_ROLE_PRIORITY: Record<string, number> = Object.freeze({
  "evolution-worker": 400,
  "integration-worker": 350,
  "infrastructure-worker": 300,
  "quality-worker": 250,
});

const RELEASE_ROLE_PRIORITY: Record<string, number> = Object.freeze({
  "quality-worker": 400,
  "evolution-worker": 250,
  "integration-worker": 200,
  "infrastructure-worker": 150,
});

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseTimestampOrZero(value: unknown): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function laterTimestamp(left: string | null, right: string | null): string | null {
  return parseTimestampOrZero(right) > parseTimestampOrZero(left) ? right : left;
}

function getSessionReactivatedAt(session: any): number {
  return parseTimestampOrZero(session?.lifecycle?.reactivatedAt);
}

function isEvidenceCurrentForSession(session: any, evidenceAt: string | null): boolean {
  const reactivatedAt = getSessionReactivatedAt(session);
  if (reactivatedAt <= 0) {
    return true;
  }
  return parseTimestampOrZero(evidenceAt) >= reactivatedAt;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function tokenizeMeaningfulWords(value: unknown): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return [...new Set(normalized.split(" ").filter((token) => token.length >= 3 && !STOPWORDS.has(token)))];
}

function parseWorkerEvidence(rawText: string) {
  const text = String(rawText || "");
  const status = (text.match(/BOX_STATUS=([^\n\r]+)/i)?.[1] || "").trim().toLowerCase() || null;
  const skipReason = (text.match(/BOX_SKIP_REASON=([^\n\r]+)/i)?.[1] || "").trim().toLowerCase() || null;
  const prUrl = (text.match(/BOX_PR_URL=(https?:\/\/\S+)/i)?.[1] || "").trim() || null;
  const mergedSha = (text.match(/BOX_MERGED_SHA=([0-9a-f]{7,40})/i)?.[1] || "").trim() || null;
  const expectedOutcome = (text.match(/BOX_EXPECTED_OUTCOME=([^\n\r]+)/i)?.[1] || "").trim() || null;
  const actualOutcome = (text.match(/BOX_ACTUAL_OUTCOME=([^\n\r]+)/i)?.[1] || "").trim() || null;
  const deliveredSentence = (text.match(/DELIVERED:[^\n\r]*/i)?.[0] || "").trim() || null;
  return {
    status,
    skipReason,
    prUrl,
    mergedSha,
    expectedOutcome,
    actualOutcome,
    deliveredSentence,
    rawText: text,
  };
}

function buildStampedWorkerHeader(session: any): string {
  return [
    `TARGET_PROJECT_ID: ${String(session?.projectId || "")}`,
    `TARGET_SESSION_ID: ${String(session?.sessionId || "")}`,
    `TARGET_REPO_URL: ${String(session?.repo?.repoUrl || "")}`,
    `TARGET_REPO_FULL_NAME: ${String(session?.repo?.repoFullName || "")}`,
    `TARGET_WORKSPACE_PATH: ${String(session?.workspace?.path || "")}`,
  ].join("\n");
}

function collectRoleVerificationCommands(dispatchCheckpoint: any, roleName: string): string[] {
  const plans = Array.isArray(dispatchCheckpoint?.dispatchPlanSnapshot)
    ? dispatchCheckpoint.dispatchPlanSnapshot
    : [];
  const normalizedRoleName = String(roleName || "").trim().toLowerCase();
  const commands: string[] = plans.flatMap((plan: any) => {
    const planRoles = [
      plan?.role,
      plan?.owner,
      plan?.worker,
      plan?._originalRole,
      plan?._originalSpecialistRole,
      plan?.planArtifact?.role,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    if (!planRoles.includes(normalizedRoleName)) {
      return [] as string[];
    }
    const candidates = [
      ...(Array.isArray(plan?.verification_commands) ? plan.verification_commands : []),
      ...(Array.isArray(plan?.verificationCommands) ? plan.verificationCommands : []),
      ...(Array.isArray(plan?.planArtifact?.verificationCommands) ? plan.planArtifact.verificationCommands : []),
      plan?.verification,
    ];
    return candidates
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  });
  return Array.from(new Set(commands));
}

function buildRuntimeArtifactEvidenceText(
  session: any,
  roleName: string,
  completedTasks: string[],
  verificationCommands: string[],
  prUrl: string | null,
): string {
  const lines = [buildStampedWorkerHeader(session), "BOX_STATUS=done"];
  const objectiveSummary = String(session?.objective?.summary || "").trim();
  const intentSummary = String(session?.intent?.summary || "").trim();
  const acceptanceCriteria = Array.isArray(session?.objective?.acceptanceCriteria)
    ? session.objective.acceptanceCriteria.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
    : [];
  const scopeIn = Array.isArray(session?.intent?.scopeIn)
    ? session.intent.scopeIn.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (prUrl) {
    lines.push(`BOX_PR_URL=${prUrl}`);
  }

  if (objectiveSummary) {
    lines.push(`BOX_OBJECTIVE_SUMMARY=${objectiveSummary}`);
  }
  if (intentSummary) {
    lines.push(`BOX_INTENT_SUMMARY=${intentSummary}`);
  }
  if (scopeIn.length > 0) {
    lines.push(`BOX_SCOPE_IN=${scopeIn.join(" | ")}`);
  }
  if (acceptanceCriteria.length > 0) {
    lines.push(`BOX_ACCEPTANCE_CRITERIA=${acceptanceCriteria.join(" | ")}`);
  }

  if (completedTasks.length > 0) {
    lines.push(`BOX_EXPECTED_OUTCOME=${completedTasks.join(" | ")}`);
  }

  const actualOutcomeParts: string[] = [];
  if (completedTasks.length > 0) {
    actualOutcomeParts.push(`Completed session work: ${completedTasks.join(" | ")}.`);
  }
  if (prUrl) {
    actualOutcomeParts.push(`Delivered target changes through ${prUrl}.`);
  }
  if (verificationCommands.length > 0) {
    actualOutcomeParts.push(`Verification commands for this delivered session: ${verificationCommands.join(" ; ")}.`);
  }
  if (roleName === "quality-worker" && verificationCommands.length > 0) {
    actualOutcomeParts.push("Release validation evidence is present for the delivered target.");
  }
  if (actualOutcomeParts.length > 0) {
    lines.push(`BOX_ACTUAL_OUTCOME=${actualOutcomeParts.join(" ")}`);
  }

  if (session?.repo?.repoUrl && (roleName === "quality-worker" || prUrl)) {
    lines.push(`DELIVERED: Product delivered to ${String(session.repo.repoUrl)}.`);
  }

  for (const command of verificationCommands) {
    lines.push(command);
  }

  return lines.join("\n");
}

async function loadSessionRuntimeArtifactEvidenceEntries(stateDir: string, session: any) {
  const projectId = String(session?.projectId || "").trim();
  const sessionId = String(session?.sessionId || "").trim();
  if (!projectId || !sessionId) {
    return [];
  }

  const sessionDir = getTargetSessionPath(stateDir, projectId, sessionId);
  const runtimeDir = path.join(sessionDir, "runtime");
  const [workerCycleArtifacts, dispatchCheckpoint] = await Promise.all([
    readJson(path.join(runtimeDir, "worker_cycle_artifacts.json"), null),
    readJson(path.join(runtimeDir, "dispatch_checkpoint.json"), null),
  ]);

  const cycles = workerCycleArtifacts && typeof workerCycleArtifacts === "object" && workerCycleArtifacts.cycles && typeof workerCycleArtifacts.cycles === "object"
    ? Object.values(workerCycleArtifacts.cycles as Record<string, any>)
    : [];
  const roleMap = new Map<string, {
    tasks: Set<string>;
    verificationCommands: Set<string>;
    prUrl: string | null;
    done: boolean;
    evidenceAt: string | null;
  }>();

  for (const rawCycle of cycles) {
    if (!rawCycle || typeof rawCycle !== "object") {
      continue;
    }
    const workerSessions = rawCycle.workerSessions && typeof rawCycle.workerSessions === "object"
      ? rawCycle.workerSessions as Record<string, any>
      : {};
    const workerActivity = rawCycle.workerActivity && typeof rawCycle.workerActivity === "object"
      ? rawCycle.workerActivity as Record<string, any>
      : {};

    for (const [roleName, rawSession] of Object.entries(workerSessions)) {
      const state = roleMap.get(roleName) || {
        tasks: new Set<string>(),
        verificationCommands: new Set<string>(),
        prUrl: null,
        done: false,
        evidenceAt: null,
      };
      const lastStatus = String((rawSession as any)?.lastStatus || (rawSession as any)?.status || "").trim().toLowerCase();
      if (lastStatus === "done") {
        state.done = true;
        state.evidenceAt = laterTimestamp(
          state.evidenceAt,
          normalizeOptionalString((rawSession as any)?.updatedAt) || normalizeOptionalString((rawCycle as any)?.updatedAt),
        );
      }
      for (const command of collectRoleVerificationCommands(dispatchCheckpoint, roleName)) {
        state.verificationCommands.add(command);
      }
      roleMap.set(roleName, state);
    }

    for (const [roleName, rawEntries] of Object.entries(workerActivity)) {
      const state = roleMap.get(roleName) || {
        tasks: new Set<string>(),
        verificationCommands: new Set<string>(),
        prUrl: null,
        done: false,
        evidenceAt: null,
      };
      for (const command of collectRoleVerificationCommands(dispatchCheckpoint, roleName)) {
        state.verificationCommands.add(command);
      }
      if (Array.isArray(rawEntries)) {
        for (const rawEntry of rawEntries) {
          if (!rawEntry || typeof rawEntry !== "object") {
            continue;
          }
          const status = String((rawEntry as any).status || "").trim().toLowerCase();
          if (status === "done") {
            state.done = true;
            state.evidenceAt = laterTimestamp(
              state.evidenceAt,
              normalizeOptionalString((rawEntry as any).at) || normalizeOptionalString((rawEntry as any).updatedAt),
            );
            const prUrl = String((rawEntry as any).pr || "").trim();
            if (prUrl) {
              state.prUrl = prUrl;
            }
            const taskIds = Array.isArray((rawEntry as any).taskIds)
              ? (rawEntry as any).taskIds
              : [];
            for (const taskId of taskIds) {
              const normalizedTask = String(taskId || "").trim();
              if (normalizedTask) {
                state.tasks.add(normalizedTask);
              }
            }
            const taskText = String((rawEntry as any).task || "").trim();
            if (taskText) {
              state.tasks.add(taskText);
            }
          }
        }
      }
      roleMap.set(roleName, state);
    }
  }

  return [...roleMap.entries()]
    .filter(([, state]) => state.done)
    .map(([roleName, state]) => {
      const text = buildRuntimeArtifactEvidenceText(
        session,
        roleName,
        [...state.tasks],
        [...state.verificationCommands],
        state.prUrl,
      );
      return {
        filePath: path.join(runtimeDir, `synthetic_worker_${roleName}.txt`),
        roleName,
        scope: "session",
        text,
        aligned: true,
        evidenceAt: state.evidenceAt,
        evidence: parseWorkerEvidence(text),
      };
    })
    .filter((entry) => entry.text.trim());
}

function getTargetSessionWorkerEvidenceDir(stateDir: string, projectId: string, sessionId: string): string {
  return path.join(getTargetSessionPath(stateDir, projectId, sessionId), "worker_evidence");
}

function extractWorkerRoleFromEvidencePath(filePath: string): string {
  return path.basename(filePath).replace(/^debug_worker_/i, "").replace(/\.txt$/i, "");
}

async function loadAlignedWorkerEvidenceEntries(stateDir: string, session: any) {
  const reactivatedAt = getSessionReactivatedAt(session);
  const candidatePaths = new Set<string>();
  const sessionEvidenceDir = session?.projectId && session?.sessionId
    ? getTargetSessionWorkerEvidenceDir(stateDir, String(session.projectId), String(session.sessionId))
    : null;

  if (sessionEvidenceDir) {
    const sessionEntries = await fs.readdir(sessionEvidenceDir).catch(() => []);
    for (const entry of sessionEntries) {
      if (DEBUG_WORKER_FILE_PATTERN.test(entry)) {
        candidatePaths.add(path.join(sessionEvidenceDir, entry));
      }
    }
  }

  const stateEntries = await fs.readdir(stateDir).catch(() => []);
  for (const entry of stateEntries) {
    if (DEBUG_WORKER_FILE_PATTERN.test(entry)) {
      candidatePaths.add(path.join(stateDir, entry));
    }
  }

  const entries = await Promise.all([...candidatePaths].map(async (filePath) => {
    const text = await readTextIfExists(filePath);
    const aligned = isWorkerEvidenceAlignedToSession(text, session);
    const stat = await fs.stat(filePath).catch(() => null);
    return {
      filePath,
      roleName: extractWorkerRoleFromEvidencePath(filePath),
      scope: sessionEvidenceDir && filePath.startsWith(sessionEvidenceDir) ? "session" : "global",
      text,
      aligned,
      evidenceAt: stat && Number.isFinite(stat.mtimeMs) ? new Date(stat.mtimeMs).toISOString() : null,
      evidence: parseWorkerEvidence(aligned ? text : ""),
    };
  }));

  const runtimeArtifactEntries = await loadSessionRuntimeArtifactEvidenceEntries(stateDir, session);

  return [
    ...entries.filter((entry) => entry.aligned && entry.text.trim() && (reactivatedAt <= 0 || isEvidenceCurrentForSession(session, entry.evidenceAt))),
    ...runtimeArtifactEntries.filter((entry) => reactivatedAt <= 0 || isEvidenceCurrentForSession(session, entry.evidenceAt)),
  ];
}

function scoreDeliveryEntry(session: any, entry: any): number {
  const evidence = entry?.evidence || {};
  const repoRequiresFreshWork = isExistingRepoSession(session);
  const status = String(evidence.status || "").toLowerCase();
  const statusEligible = repoRequiresFreshWork ? status === "done" : status === "done" || status === "skipped";
  const scopeBoost = entry?.scope === "session" ? 1000 : 0;
  const roleBoost = DELIVERY_ROLE_PRIORITY[String(entry?.roleName || "").toLowerCase()] || 100;
  const mergedBoost = evidence.mergedSha ? 60 : 0;
  const prBoost = evidence.prUrl ? 45 : 0;
  const outcomeBoost = evidence.actualOutcome ? 30 : 0;
  const deliveredBoost = evidence.deliveredSentence ? 20 : 0;
  return (statusEligible ? 5000 : 0) + scopeBoost + roleBoost + mergedBoost + prBoost + outcomeBoost + deliveredBoost;
}

function scoreReleaseEntry(entry: any): number {
  const evidence = entry?.evidence || {};
  const status = String(evidence.status || "").toLowerCase();
  const statusEligible = status === "done" || status === "skipped";
  const scopeBoost = entry?.scope === "session" ? 1000 : 0;
  const roleBoost = RELEASE_ROLE_PRIORITY[String(entry?.roleName || "").toLowerCase()] || 100;
  const mergedBoost = evidence.mergedSha ? 50 : 0;
  const prBoost = evidence.prUrl ? 30 : 0;
  const outcomeBoost = evidence.actualOutcome ? 30 : 0;
  const deliveredBoost = evidence.deliveredSentence ? 20 : 0;
  return (statusEligible ? 5000 : 0) + scopeBoost + roleBoost + mergedBoost + prBoost + outcomeBoost + deliveredBoost;
}

function selectBestDeliveryEvidence(session: any, entries: any[]) {
  const ranked = [...entries].sort((left, right) => scoreDeliveryEntry(session, right) - scoreDeliveryEntry(session, left));
  return ranked[0] || null;
}

function selectBestReleaseEvidence(entries: any[]) {
  const ranked = [...entries].sort((left, right) => scoreReleaseEntry(right) - scoreReleaseEntry(left));
  return ranked[0] || null;
}

function evaluateEvidenceAlignmentDimension(entries: any[], deliveryEntry: any, releaseEntry: any) {
  const alignedRoles = entries.map((entry) => `${String(entry?.scope || "global")}:${String(entry?.roleName || "unknown")}`);
  return {
    status: alignedRoles.length > 0 ? "satisfied" : "missing",
    evidence: {
      evolutionEvidenceAligned: Boolean(deliveryEntry),
      qualityEvidenceAligned: Boolean(releaseEntry),
      alignedRoles,
    },
  };
}

function isExistingRepoSession(session: any): boolean {
  return String(session?.intent?.repoState || session?.repoProfile?.repoState || "")
  .trim()
  .toLowerCase() === "existing";
}

function resolveEffectiveHumanInputs(session: any) {
  const requiredHumanInputs = Array.isArray(session?.handoff?.requiredHumanInputs)
    ? session.handoff.requiredHumanInputs.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
    : [];
  const ignoredHumanInputs: string[] = [];
  const pendingHumanInputs: string[] = [];
  const preferredQualityBar = String(session?.intent?.preferredQualityBar || "").trim();

  for (const item of requiredHumanInputs) {
    if (/choose the main priority|optimi[sz]e the first build correctly/i.test(item) && preferredQualityBar) {
      ignoredHumanInputs.push(item);
      continue;
    }
    pendingHumanInputs.push(item);
  }

  return { pendingHumanInputs, ignoredHumanInputs };
}

function getBlockingAcceptanceCriteria(session: any): string[] {
  return (Array.isArray(session?.objective?.acceptanceCriteria) ? session.objective.acceptanceCriteria : [])
    .map((entry: unknown) => String(entry || "").trim().toLowerCase())
    .filter((entry: string) => entry && !NON_BLOCKING_ACCEPTANCE_CRITERIA.has(entry));
}

function requiresProjectReadiness(session: any): boolean {
  const blockingCriteria = getBlockingAcceptanceCriteria(session);
  if (blockingCriteria.some((entry) => PROJECT_READINESS_ACCEPTANCE_CRITERIA.has(entry))) return true;
  if (session?.feedback?.pendingResearchRefresh === true) return true;
  // Default: any non-trivial delivery target session must clear project readiness
  // before closure. Sessions that only carry clarification/planning markers are
  // treated as opt-out (handled by NON_BLOCKING_ACCEPTANCE_CRITERIA upstream).
  if (blockingCriteria.length > 0) return true;
  return false;
}

function resolveProjectReadinessMode(session: any): string {
  const blockingCriteria = getBlockingAcceptanceCriteria(session);
  return blockingCriteria.includes("saturated_best_effort_delivery")
    ? PROJECT_READINESS_MODE.STRICT_SATURATION
    : PROJECT_READINESS_MODE.BEST_EFFORT;
}

function isResearchArtifactAlignedToSession(raw: any, session: any): boolean {
  if (!raw || typeof raw !== "object") return false;
  const targetSession = raw?.targetSession;
  if (!targetSession || typeof targetSession !== "object") return false;

  const expectedProjectId = String(session?.projectId || "").trim();
  const expectedSessionId = String(session?.sessionId || "").trim();
  const actualProjectId = String((targetSession as any)?.projectId || "").trim();
  const actualSessionId = String((targetSession as any)?.sessionId || "").trim();

  if (expectedProjectId && actualProjectId && actualProjectId !== expectedProjectId) return false;
  if (expectedSessionId && actualSessionId && actualSessionId !== expectedSessionId) return false;
  return Boolean(actualProjectId || actualSessionId);
}

function getProjectReadinessLedgerPath(stateDir: string, session: any): string | null {
  const projectId = String(session?.projectId || "").trim();
  const sessionId = String(session?.sessionId || "").trim();
  if (!projectId || !sessionId) return null;
  return path.join(getTargetSessionPath(stateDir, projectId, sessionId), PROJECT_READINESS_LEDGER_FILE);
}

function isStableResearchSample(sample: any, readinessMode: string): boolean {
  const commonStable = sample?.pendingRefresh !== true
    && sample?.scoutAligned === true
    && sample?.synthesisAligned === true
    && Number(sample?.sourceCount || 0) > 0
    && sample?.coveragePassed === true
    && sample?.refreshRecommended !== true;

  if (!commonStable) return false;
  if (readinessMode === PROJECT_READINESS_MODE.STRICT_SATURATION) {
    return Number(sample?.totalPairs || 0) === 0 || sample?.topicSiteSaturated === true;
  }

  return true;
}

async function appendProjectReadinessSample(stateDir: string, session: any, sample: Record<string, unknown>) {
  const ledgerPath = getProjectReadinessLedgerPath(stateDir, session);
  if (!ledgerPath) {
    return { ledgerPath: null, samples: [] as any[] };
  }

  await fs.mkdir(path.dirname(ledgerPath), { recursive: true }).catch(() => {});
  const current = await readJson(ledgerPath, {
    schemaVersion: 1,
    projectId: String(session?.projectId || ""),
    sessionId: String(session?.sessionId || ""),
    samples: [],
  });
  const samples = Array.isArray(current?.samples) ? current.samples.slice(-24) : [];
  const signature = String(sample?.signature || "").trim();
  const lastSignature = String(samples[samples.length - 1]?.signature || "").trim();

  if (signature && signature !== lastSignature) {
    samples.push(sample);
    await writeJson(ledgerPath, {
      schemaVersion: 1,
      projectId: String(session?.projectId || ""),
      sessionId: String(session?.sessionId || ""),
      updatedAt: new Date().toISOString(),
      samples: samples.slice(-24),
    });
  }

  return { ledgerPath, samples: samples.slice(-24) };
}

function computeResearchHistoryEvidence(
  samples: any[],
  thresholds: { stableSampleMin: number; maxGrowthSignalsInStableWindow: number; },
  readinessMode: string,
) {
  const stableStreak: any[] = [];
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index];
    if (!isStableResearchSample(sample, readinessMode)) break;
    stableStreak.unshift(sample);
  }

  const recentWindow = stableStreak.slice(-thresholds.stableSampleMin);
  const historyEnough = recentWindow.length >= thresholds.stableSampleMin;
  let noveltyDecayed = false;
  let growthSignals = 0;

  if (historyEnough) {
    for (let index = 1; index < recentWindow.length; index += 1) {
      const prev = recentWindow[index - 1] || {};
      const next = recentWindow[index] || {};
      const grew = readinessMode === PROJECT_READINESS_MODE.STRICT_SATURATION
        ? Number(next.sourceCount || 0) > Number(prev.sourceCount || 0)
          || Number(next.topicCount || 0) > Number(prev.topicCount || 0)
          || Number(next.completedPairs || 0) > Number(prev.completedPairs || 0)
          || Number(next.totalPairs || 0) > Number(prev.totalPairs || 0)
        : Number(next.topicCount || 0) > Number(prev.topicCount || 0);
      if (grew) growthSignals += 1;
    }
    noveltyDecayed = growthSignals <= thresholds.maxGrowthSignalsInStableWindow;
  }

  return {
    sampleCount: samples.length,
    stableSampleCount: stableStreak.length,
    historyEnough,
    noveltyDecayed,
    growthSignals,
  };
}

async function evaluateResearchSaturationDimension(stateDir: string, session: any, config: any) {
  const required = requiresProjectReadiness(session);
  const readinessMode = resolveProjectReadinessMode(session);
  const pendingRefresh = session?.feedback?.pendingResearchRefresh === true;
  const [scoutOutput, synthesis, topicSiteState] = await Promise.all([
    readJson(path.join(stateDir, "research_scout_output.json"), null),
    readJson(path.join(stateDir, "research_synthesis.json"), null),
    readJson(path.join(stateDir, "research_scout_topic_site_status.json"), { entries: [] }),
  ]);

  const scoutAligned = isResearchArtifactAlignedToSession(scoutOutput, session);
  const synthesisAligned = isResearchArtifactAlignedToSession(synthesis, session);
  const sourceCount = Math.max(0, Number(scoutOutput?.sourceCount ?? synthesis?.scoutSourceCount ?? 0));
  const topicCount = Math.max(0, Number(synthesis?.topicCount ?? 0));
  const refreshRecommended = synthesis?.qualityGate?.refreshRecommended === true;
  const coveragePassed = synthesis?.qualityGate?.coverage?.passed === true;
  const missingObligations = Array.isArray(synthesis?.qualityGate?.coverage?.missingObligations)
    ? synthesis.qualityGate.coverage.missingObligations.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
    : [];
  const topicEntries = Array.isArray(topicSiteState?.entries) ? topicSiteState.entries : [];
  const totalPairs = topicEntries.length;
  const completedPairs = topicEntries.filter((entry: any) => String(entry?.status || "") === "completed").length;
  const topicSiteSaturated = totalPairs > 0 && completedPairs >= totalPairs;
  const saturationSignals = [
    sourceCount > 0 ? "sources_collected" : "",
    coveragePassed ? "coverage_complete" : "",
    !refreshRecommended ? "refresh_not_recommended" : "",
    topicSiteSaturated ? "topic_sites_exhausted" : "",
  ].filter(Boolean);

  const sample = {
    recordedAt: new Date().toISOString(),
    signature: [
      String(scoutOutput?.scoutedAt || "none"),
      String(synthesis?.synthesizedAt || "none"),
      String(sourceCount),
      String(topicCount),
      String(coveragePassed),
      String(refreshRecommended),
      String(pendingRefresh),
      String(completedPairs),
      String(totalPairs),
    ].join("|"),
    sourceCount,
    topicCount,
    coveragePassed,
    refreshRecommended,
    pendingRefresh,
    scoutAligned,
    synthesisAligned,
    completedPairs,
    totalPairs,
    topicSiteSaturated,
  };

  const thresholds = resolveProjectReadinessThresholds(config);
  const ledger = await appendProjectReadinessSample(stateDir, session, sample);
  const history = computeResearchHistoryEvidence(ledger.samples, thresholds, readinessMode);

  const satisfied = isStableResearchSample(sample, readinessMode)
    && history.historyEnough
    && history.noveltyDecayed;

  const status = satisfied
    ? "satisfied"
    : required || pendingRefresh || scoutAligned || synthesisAligned || sourceCount > 0
      ? "missing"
      : "not_applicable";

  return {
    status,
    evidence: {
      required,
      pendingRefresh,
      scoutAligned,
      synthesisAligned,
      sourceCount,
      topicCount,
      refreshRecommended,
      coveragePassed,
      missingObligations,
      completedPairs,
      totalPairs,
      remainingPairs: Math.max(0, totalPairs - completedPairs),
      completionRatio: totalPairs > 0 ? completedPairs / totalPairs : 1,
      saturationSignals,
      readinessMode,
      topicSiteSaturatedRequired: readinessMode === PROJECT_READINESS_MODE.STRICT_SATURATION,
      historyEnough: history.historyEnough,
      stableSampleCount: history.stableSampleCount,
      sampleCount: history.sampleCount,
      noveltyDecayed: history.noveltyDecayed,
      growthSignals: history.growthSignals,
      ledgerPath: ledger.ledgerPath,
      thresholds,
    },
  };
}

function evaluateProjectReadinessDimension(
  session: any,
  delivery: any,
  releaseVerification: any,
  intentCore: any,
  researchSaturation: any,
) {
  const required = requiresProjectReadiness(session);
  const coreSatisfied = delivery?.status === "satisfied"
    && releaseVerification?.status === "satisfied"
    && intentCore?.status === "satisfied";
  if (!required && coreSatisfied) {
    return {
      status: "not_applicable",
      evidence: {
        required,
        coreSatisfied,
        deliveryStatus: delivery?.status || "missing",
        releaseStatus: releaseVerification?.status || "missing",
        intentStatus: intentCore?.status || "missing",
        researchStatus: researchSaturation?.status || "missing",
      },
    };
  }
  const satisfied = coreSatisfied
    && (researchSaturation?.status === "satisfied" || (!required && researchSaturation?.status === "not_applicable"));

  return {
    status: satisfied ? "satisfied" : (required || researchSaturation?.status !== "not_applicable" ? "missing" : "not_applicable"),
    evidence: {
      required,
      coreSatisfied,
      deliveryStatus: delivery?.status || "missing",
      releaseStatus: releaseVerification?.status || "missing",
      intentStatus: intentCore?.status || "missing",
      researchStatus: researchSaturation?.status || "missing",
    },
  };
}

function evaluateDeliveryDimension(
  session: any,
  evolutionEvidence: ReturnType<typeof parseWorkerEvidence>,
  qualityEvidence: ReturnType<typeof parseWorkerEvidence>,
) {
  const text = [
    evolutionEvidence.rawText,
    evolutionEvidence.actualOutcome || "",
    qualityEvidence.rawText,
    qualityEvidence.actualOutcome || "",
    qualityEvidence.deliveredSentence || "",
  ].join("\n");
  const repoRequiresFreshWork = isExistingRepoSession(session);
  const statusEligible = repoRequiresFreshWork
    ? evolutionEvidence.status === "done"
    : evolutionEvidence.status === "done" || evolutionEvidence.status === "skipped";
  const hasDeliveryMarker = Boolean(evolutionEvidence.mergedSha || evolutionEvidence.prUrl);
  const hasMergedShaProof = Boolean(evolutionEvidence.mergedSha);
  const hasLiveDeploymentProof = /live at https?:\/\/|preview is available at https?:\/\/|deployed at https?:\/\//i.test(text);
  const hasMergedOrPresentMarker = /already merged on main|already present on main|delivered in the target repository|live repo passes|merged\s+(?:\*\*)?pr\s*#\d+|left main clean/i.test(text);
  const hasRuntimeArtifactProof = /verification commands for this delivered session:/i.test(text)
    && /\b(test|vitest|playwright|lint|build|check)\b/i.test(text);
  // Tightened gate: textual PR/actualOutcome alone is insufficient. Require at
  // least one concrete artifact/runtime proof signal alongside the delivery
  // marker before treating the dimension as satisfied.
  const hasConcreteProof = hasMergedShaProof
    || hasLiveDeploymentProof
    || hasMergedOrPresentMarker
    || hasRuntimeArtifactProof;
  const satisfied = statusEligible && hasDeliveryMarker && hasConcreteProof;
  let proofStrength: "strong" | "moderate" | "weak" | "missing" = "missing";
  if (satisfied) {
    const strongSignalCount = [hasMergedShaProof, hasLiveDeploymentProof, hasRuntimeArtifactProof, hasMergedOrPresentMarker]
      .filter(Boolean).length;
    if (hasMergedShaProof && strongSignalCount >= 2) {
      proofStrength = "strong";
    } else if (hasMergedShaProof || hasLiveDeploymentProof || hasRuntimeArtifactProof) {
      proofStrength = "moderate";
    } else {
      proofStrength = "weak";
    }
  } else if (hasDeliveryMarker || evolutionEvidence.actualOutcome) {
    proofStrength = "weak";
  }
  return {
    status: satisfied ? "satisfied" : "missing",
    evidence: {
      status: evolutionEvidence.status,
      skipReason: evolutionEvidence.skipReason,
      prUrl: evolutionEvidence.prUrl,
      mergedSha: evolutionEvidence.mergedSha,
      actualOutcome: evolutionEvidence.actualOutcome,
      repoRequiresFreshWork,
      proofStrength,
      hasMergedShaProof,
      hasLiveDeploymentProof,
      hasMergedOrPresentMarker,
      hasRuntimeArtifactProof,
    },
  };
}

function evaluateReleaseDimension(qualityEvidence: ReturnType<typeof parseWorkerEvidence>) {
  const text = `${qualityEvidence.rawText}\n${qualityEvidence.actualOutcome || ""}`;
  const statusEligible = qualityEvidence.status === "done" || qualityEvidence.status === "skipped";
  const hasReleaseChecks = /all six release checks passed|release checks passed|verified live main already contains/i.test(text);
  const hasLocalTrustGate = /npm test[\s\S]*npm run lint(?:[\s\S]*npm run build)?|40 passing tests|left main clean/i.test(text);
  const hasRuntimeReleaseValidation = /release validation evidence is present for the delivered target/i.test(text)
    && /verification commands for this delivered session:/i.test(text)
    && /\b(test|vitest|playwright|lint|build|check)\b/i.test(text);
  const releaseMarkerPresent = Boolean(qualityEvidence.deliveredSentence) || Boolean(qualityEvidence.mergedSha) || Boolean(qualityEvidence.prUrl) || Boolean(qualityEvidence.actualOutcome);
  const satisfied = statusEligible && releaseMarkerPresent && (hasReleaseChecks || hasLocalTrustGate || hasRuntimeReleaseValidation);
  let proofStrength: "strong" | "moderate" | "weak" | "missing" = "missing";
  if (satisfied) {
    if (hasLocalTrustGate || (hasRuntimeReleaseValidation && Boolean(qualityEvidence.mergedSha))) {
      proofStrength = "strong";
    } else if (hasReleaseChecks || hasRuntimeReleaseValidation) {
      proofStrength = "moderate";
    } else {
      proofStrength = "weak";
    }
  } else if (releaseMarkerPresent) {
    proofStrength = "weak";
  }
  return {
    status: satisfied ? "satisfied" : "missing",
    evidence: {
      status: qualityEvidence.status,
      skipReason: qualityEvidence.skipReason,
      deliveredSentence: qualityEvidence.deliveredSentence,
      actualOutcome: qualityEvidence.actualOutcome,
      prUrl: qualityEvidence.prUrl,
      mergedSha: qualityEvidence.mergedSha,
      proofStrength,
      hasReleaseChecks,
      hasLocalTrustGate,
      hasRuntimeReleaseValidation,
    },
  };
}

function evaluateIntentDimension(session: any, evidenceText: string, deliverySatisfied: boolean, releaseSatisfied: boolean) {
  const objectiveTokens = tokenizeMeaningfulWords(session?.objective?.summary);
  const scopeTokens = [
    ...(Array.isArray(session?.intent?.scopeIn) ? session.intent.scopeIn : []),
    ...(Array.isArray(session?.intent?.mustHaveFlows) ? session.intent.mustHaveFlows : []),
  ].flatMap((item: unknown) => tokenizeMeaningfulWords(item));
  const evidenceTokens = new Set(tokenizeMeaningfulWords(evidenceText));
  const matchedObjectiveTokens = objectiveTokens.filter((token) => evidenceTokens.has(token));
  const matchedScopeTokens = [...new Set(scopeTokens)].filter((token) => evidenceTokens.has(token));
  const objectiveMatchRatio = objectiveTokens.length === 0
    ? 1
    : matchedObjectiveTokens.length / objectiveTokens.length;
  const objectiveSatisfied = objectiveTokens.length === 0
    ? true
    : matchedObjectiveTokens.length >= Math.min(2, objectiveTokens.length);
  const mustHaveFlows = Array.isArray(session?.intent?.mustHaveFlows) ? session.intent.mustHaveFlows : [];
  const mustHaveFlowSatisfied = mustHaveFlows.every((flow: unknown) => {
    const normalizedFlow = normalizeText(flow);
    if (!normalizedFlow) return true;
    if (/completed|working project|working/.test(normalizedFlow)) {
      return deliverySatisfied && releaseSatisfied;
    }
    return normalizeText(evidenceText).includes(normalizedFlow);
  });
  const blockingAcceptanceCriteria = getBlockingAcceptanceCriteria(session)
    .filter((entry: string) => !PROJECT_READINESS_ACCEPTANCE_CRITERIA.has(entry));
  const acceptanceCriteriaSatisfied = blockingAcceptanceCriteria.every((criteria: string) => {
    const criteriaTokens = tokenizeMeaningfulWords(criteria);
    if (criteriaTokens.length === 0) {
      return true;
    }
    const matchedCriteriaTokens = criteriaTokens.filter((token) => evidenceTokens.has(token));
    const minRequired = Math.min(criteriaTokens.length, Math.max(2, Math.ceil(criteriaTokens.length * 0.35)));
    return matchedCriteriaTokens.length >= minRequired;
  });
  const satisfied = objectiveSatisfied && mustHaveFlowSatisfied && acceptanceCriteriaSatisfied;

  let matchStrength: "strong" | "moderate" | "weak" = "weak";
  if (objectiveTokens.length === 0) {
    matchStrength = "strong";
  } else if (objectiveMatchRatio >= 0.6) {
    matchStrength = "strong";
  } else if (objectiveMatchRatio >= 0.35) {
    matchStrength = "moderate";
  }
  return {
    status: satisfied ? "satisfied" : "missing",
    evidence: {
      objectiveTokens,
      matchedObjectiveTokens,
      matchedScopeTokens,
      blockingAcceptanceCriteria,
      objectiveMatchRatio: Number(objectiveMatchRatio.toFixed(3)),
      matchStrength,
    },
  };
}

function evaluatePreferenceDimension(session: any, evidenceText: string) {
  void session;
  void evidenceText;
  return {
    status: "not_applicable",
    evidence: { preferredQualityBar: null, matchedSignals: [] },
  };
}

function normalizeRepoWebUrl(repoUrl: unknown): string | null {
  const raw = String(repoUrl || "").trim();
  if (!raw) return null;
  return raw.replace(/\.git$/i, "");
}

function normalizePathForComparison(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function normalizeRepoMarker(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\.git$/i, "")
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function readStampedHeader(rawText: string, key: string): string | null {
  const match = String(rawText || "").match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  const value = String(match?.[1] || "").trim();
  return value || null;
}

function isWorkerEvidenceAlignedToSession(rawText: string, session: any): boolean {
  const text = String(rawText || "");
  if (!text.trim()) return false;

  const sessionId = String(session?.sessionId || "").trim();
  const projectId = String(session?.projectId || "").trim();
  const repoFullName = normalizeRepoMarker(session?.repo?.repoFullName);
  const repoWebUrl = normalizeRepoMarker(normalizeRepoWebUrl(session?.repo?.repoUrl));
  const repoName = String(session?.repo?.name || "").trim().toLowerCase();
  const workspacePath = normalizePathForComparison(session?.workspace?.path);

  const stampedSessionId = String(readStampedHeader(text, "TARGET_SESSION_ID") || "").trim();
  if (stampedSessionId) {
    return stampedSessionId === sessionId;
  }

  const stampedProjectId = String(readStampedHeader(text, "TARGET_PROJECT_ID") || "").trim();
  const stampedRepoUrl = normalizeRepoMarker(readStampedHeader(text, "TARGET_REPO_URL"));
  const stampedRepoFullName = normalizeRepoMarker(readStampedHeader(text, "TARGET_REPO_FULL_NAME"));
  const stampedWorkspacePath = normalizePathForComparison(readStampedHeader(text, "TARGET_WORKSPACE_PATH"));

  const hasStampedTargetMetadata = Boolean(stampedProjectId || stampedRepoUrl || stampedRepoFullName || stampedWorkspacePath);
  if (hasStampedTargetMetadata) {
    if (stampedProjectId && stampedProjectId !== projectId) return false;
    if (stampedRepoFullName && stampedRepoFullName !== repoFullName) return false;
    if (stampedRepoUrl && repoWebUrl && stampedRepoUrl !== repoWebUrl) return false;
    if (stampedWorkspacePath && workspacePath && stampedWorkspacePath !== workspacePath) return false;
    return true;
  }

  const normalizedText = text.toLowerCase();
  const normalizedTextPath = normalizePathForComparison(text);
  const repoMarkers = [repoFullName, repoWebUrl, repoName].filter(Boolean);
  if (repoMarkers.some((marker) => normalizedText.includes(marker))) {
    return true;
  }

  if (workspacePath && normalizedTextPath.includes(workspacePath)) {
    return true;
  }

  const hasLegacyDeliverySignal = /DELIVERED:|BOX_SKIP_REASON=already-merged(?:-on-main)?|release checks passed|verified live main already contains/i.test(text);
  const hasLegacyProductSignal = /index\.html|live on main|browser-openable|working project|todo|to-do|weather app|preview/i.test(text);
  if (workspacePath && hasLegacyDeliverySignal && hasLegacyProductSignal) {
    return true;
  }

  return false;
}

function extractHttpUrls(value: unknown): string[] {
  const text = String(value || "");
  const matches = text.match(/https?:\/\/[^\s'"<>\])]+/gi) || [];
  const cleaned = matches
    .map((entry) => entry.replace(/[),.;]+$/g, "").trim())
    .filter(Boolean);
  return [...new Set(cleaned)];
}

function rankPreviewUrlCandidate(url: string): number {
  const normalized = String(url || "").toLowerCase();
  if (!normalized) return -1;
  if (/github\.com\/.+\/(pull|issues|actions)\//.test(normalized)) return 0;
  if (/github\.com\/.+\/blob\//.test(normalized)) return 0;
  if (/github\.com\/.+\/.+$/.test(normalized) && !/github\.io/.test(normalized)) return 5;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(normalized)) return 100;
  if (/vercel\.app|netlify\.app|pages\.dev|github\.io|web\.app|azurewebsites\.net|onrender\.com|fly\.dev/.test(normalized)) return 90;
  if (/\/preview|\/demo|\/app|\/index\.html/.test(normalized)) return 80;
  if (/raw\.githubusercontent\.com/.test(normalized)) return 5;
  return 50;
}

function resolveEvidencePreviewUrl(evidenceParts: unknown[]): string | null {
  const urls = evidenceParts.flatMap((entry) => extractHttpUrls(entry));
  if (urls.length === 0) return null;
  const ranked = urls
    .map((url) => ({ url, score: rankPreviewUrlCandidate(url) }))
    .filter((entry) => entry.score >= 20)
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.url || null;
}

async function readWorkspacePresentationContext(workspacePath: string | null) {
  const normalizedWorkspacePath = String(workspacePath || "").trim();
  if (!normalizedWorkspacePath || !(await pathExists(normalizedWorkspacePath))) {
    return {
      exists: false,
      topLevelEntries: [],
      packageJson: null,
      readmeExcerpt: null,
      repoKind: "unknown",
      distIndexPath: null,
      rootIndexPath: null,
      previewUrls: [],
      recommendedOpenTarget: null,
    };
  }

  const entries = await fs.readdir(normalizedWorkspacePath, { withFileTypes: true }).catch(() => []);
  const topLevelEntries = entries
    .slice(0, 40)
    .map((entry) => `${entry.isDirectory() ? "dir" : "file"}:${entry.name}`)
    .sort();

  const packageJsonPath = path.join(normalizedWorkspacePath, "package.json");
  const readmePath = path.join(normalizedWorkspacePath, "README.md");
  const distIndexPath = await pathExists(path.join(normalizedWorkspacePath, "dist", "index.html"))
    ? path.join(normalizedWorkspacePath, "dist", "index.html")
    : null;
  const rootIndexPath = await pathExists(path.join(normalizedWorkspacePath, "index.html"))
    ? path.join(normalizedWorkspacePath, "index.html")
    : null;
  let packageJson: any = null;
  if (await pathExists(packageJsonPath)) {
    try {
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    } catch {
      packageJson = null;
    }
  }

  const readmeExcerpt = await fs.readFile(readmePath, "utf8")
    .then((content) => content.slice(0, 4000))
    .catch(() => null);

  const dependencyNames = packageJson?.dependencies && typeof packageJson.dependencies === "object"
    ? Object.keys(packageJson.dependencies)
    : [];
  const scriptNames = packageJson?.scripts && typeof packageJson.scripts === "object"
    ? Object.keys(packageJson.scripts)
    : [];
  const previewUrls = resolvePresentationPreviewUrls([
    readmeExcerpt,
    packageJson?.homepage,
  ]);
  const repoKind = inferWorkspaceRepoKind({
    topLevelEntries,
    dependencyNames,
    scriptNames,
    rootIndexPath,
    distIndexPath,
  });
  const recommendedOpenTarget = previewUrls[0]
    || distIndexPath
    || rootIndexPath
    || (repoKind === "website" ? normalizedWorkspacePath : null);

  return {
    exists: true,
    workspacePath: normalizedWorkspacePath,
    topLevelEntries,
    packageJson: packageJson
      ? {
          name: packageJson.name || null,
          scripts: packageJson.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {},
          dependencies: packageJson.dependencies && typeof packageJson.dependencies === "object"
            ? Object.keys(packageJson.dependencies).slice(0, 30)
            : [],
        }
      : null,
    readmeExcerpt,
    repoKind,
    distIndexPath,
    rootIndexPath,
    previewUrls,
    recommendedOpenTarget,
  };
}

function resolvePresentationPreviewUrls(evidenceParts: unknown[]): string[] {
  const urls = evidenceParts.flatMap((entry) => extractHttpUrls(entry));
  if (urls.length === 0) return [];
  return urls
    .map((url) => ({ url, score: rankPreviewUrlCandidate(url) }))
    .filter((entry) => entry.score >= 60)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.url);
}

function createAgentStreamLogger(config: any, session: any, agentSlug: string, contextLabel: string, stage: "stdout" | "stderr") {
  let buffer = "";
  return {
    push(chunk: unknown) {
      const text = String(chunk || "");
      if (!text) return;
      buffer += text;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const normalized = String(line || "").trimEnd();
        if (!normalized.trim()) continue;
        appendAgentLiveLog(config, {
          agentSlug,
          session,
          contextLabel,
          status: `stream_${stage}`,
          message: normalized,
        });
      }
    },
    flush() {
      const normalized = String(buffer || "").trimEnd();
      if (!normalized.trim()) return;
      appendAgentLiveLog(config, {
        agentSlug,
        session,
        contextLabel,
        status: `stream_${stage}`,
        message: normalized,
      });
      buffer = "";
    },
  };
}

function inferWorkspaceRepoKind(input: {
  topLevelEntries: string[];
  dependencyNames: string[];
  scriptNames: string[];
  rootIndexPath: string | null;
  distIndexPath: string | null;
}): "website" | "service" | "library" | "unknown" {
  const dependencyText = input.dependencyNames.join(" ").toLowerCase();
  const scriptText = input.scriptNames.join(" ").toLowerCase();
  const entryText = input.topLevelEntries.join(" ").toLowerCase();
  const looksLikeWebsite = Boolean(input.rootIndexPath || input.distIndexPath)
    || /next|react|vite|vue|svelte|astro|gatsby|nuxt|tailwind|framer-motion/.test(dependencyText)
    || /dev|preview/.test(scriptText)
    || /dir:public|dir:app|dir:src/.test(entryText);
  if (looksLikeWebsite) return "website";
  if (/express|fastify|koa|hono|nestjs/.test(dependencyText) || /start|serve/.test(scriptText)) return "service";
  if (/typescript|vitest|jest/.test(dependencyText) && /dir:src/.test(entryText)) return "library";
  return "unknown";
}

function applyWorkspaceAwareFallbackDelivery(fallback: any, workspaceContext: any, reportStatus: string) {
  if (!isTargetSuccessContractTerminal({ status: reportStatus })) return fallback;
  const preferredOpenTarget = String(workspaceContext?.recommendedOpenTarget || "").trim() || null;
  if (!preferredOpenTarget) return fallback;

  const locationType = /^https?:\/\//i.test(preferredOpenTarget)
    ? "url"
    : preferredOpenTarget === String(workspaceContext?.workspacePath || "")
      ? "workspace"
      : /\.html?(?:$|[?#])/i.test(preferredOpenTarget)
        ? "local_path"
        : fallback.locationType;
  const instructions = /^https?:\/\//i.test(preferredOpenTarget)
    ? [`Open ${preferredOpenTarget}.`]
    : workspaceContext?.repoKind === "website"
      ? [`Open the website from ${preferredOpenTarget}. BOX can serve it locally when needed.`]
      : [`Open ${preferredOpenTarget}.`];
  return {
    ...fallback,
    status: "ready_to_open",
    locationType,
    primaryLocation: preferredOpenTarget,
    openTarget: preferredOpenTarget,
    autoOpenEligible: true,
    preserveWorkspace: !/^https?:\/\//i.test(preferredOpenTarget),
    instructions,
    userMessage: /^https?:\/\//i.test(preferredOpenTarget)
      ? `Product preview available at ${preferredOpenTarget}. BOX can try to open it automatically.`
      : workspaceContext?.repoKind === "website"
        ? `Website preview can be opened from ${preferredOpenTarget}. BOX can try to launch the simplest local surface automatically.`
        : fallback.userMessage,
    execution: /^https?:\/\//i.test(preferredOpenTarget)
      ? {
          mode: "open_url",
          target: preferredOpenTarget,
          staticRoot: null,
          preferredPort: null,
        }
      : workspaceContext?.repoKind === "website"
        ? {
            mode: "serve_and_open",
            target: preferredOpenTarget,
            staticRoot: /index\.html?$/i.test(preferredOpenTarget) ? path.dirname(preferredOpenTarget) : preferredOpenTarget,
            preferredPort: 4173,
          }
        : {
            mode: "open_direct",
            target: preferredOpenTarget,
            staticRoot: null,
            preferredPort: null,
          },
    resolutionSource: `${String(fallback?.resolutionSource || "fallback_evidence_only")}:workspace_context`,
  };
}

function sanitizeFallbackDeliveryAgainstWorkspace(fallback: any, workspaceContext: any) {
  const openTarget = String(fallback?.openTarget || "").trim();
  const primaryLocation = String(fallback?.primaryLocation || "").trim();
  const pointsToLocalSurface = Boolean(openTarget || primaryLocation)
    && !/^https?:\/\//i.test(openTarget || primaryLocation);
  if (workspaceContext?.exists !== false || !pointsToLocalSurface) {
    return fallback;
  }

  const repoWebUrl = String(fallback?.repoWebUrl || "").trim() || null;
  if (repoWebUrl) {
    return {
      ...fallback,
      status: "documented",
      locationType: "repo",
      primaryLocation: repoWebUrl,
      openTarget: null,
      autoOpenEligible: false,
      preserveWorkspace: false,
      instructions: [`Open ${repoWebUrl}.`],
      userMessage: `Product delivery is documented at ${repoWebUrl}, but the local workspace preview is no longer available.`,
      execution: {
        mode: "document_only",
        target: repoWebUrl,
        staticRoot: null,
        preferredPort: null,
      },
      resolutionSource: `${String(fallback?.resolutionSource || "fallback_evidence_only")}:workspace_missing`,
    };
  }

  return {
    ...fallback,
    status: "manual_followup_required",
    locationType: "manual",
    primaryLocation: null,
    openTarget: null,
    autoOpenEligible: false,
    preserveWorkspace: false,
    instructions: ["The local workspace preview is no longer available; inspect recorded artifacts manually."],
    userMessage: "The local workspace preview is no longer available, so BOX could not open the product automatically.",
    execution: {
      mode: "document_only",
      target: null,
      staticRoot: null,
      preferredPort: null,
    },
    resolutionSource: `${String(fallback?.resolutionSource || "fallback_evidence_only")}:workspace_missing`,
  };
}

function buildFallbackDelivery(config: any, session: any, qualityEvidence: ReturnType<typeof parseWorkerEvidence>, reportStatus: string) {
  const repoWebUrl = normalizeRepoWebUrl(session?.repo?.repoUrl);
  const workspacePath = String(session?.workspace?.path || "").trim() || null;
  const deliveredSentence = qualityEvidence?.deliveredSentence || null;
  const localIndexPath = workspacePath ? path.join(workspacePath, "index.html") : null;
  const evidencePreviewUrl = resolveEvidencePreviewUrl([
    deliveredSentence,
    qualityEvidence?.actualOutcome,
    qualityEvidence?.expectedOutcome,
    qualityEvidence?.rawText,
  ]);
  const canOpenLocalIndex = isTargetSuccessContractTerminal({ status: reportStatus }) && Boolean(localIndexPath);
  const openTarget = isTargetSuccessContractTerminal({ status: reportStatus })
    ? (evidencePreviewUrl || (canOpenLocalIndex ? localIndexPath : null))
    : null;
  const locationType = evidencePreviewUrl
    ? "url"
    : canOpenLocalIndex
      ? "local_path"
    : repoWebUrl
      ? "repo"
      : workspacePath
        ? "workspace"
        : "manual";
  const primaryLocation = openTarget || repoWebUrl || workspacePath || null;
  const instructions = openTarget
    ? [`Open ${openTarget}.`]
    : repoWebUrl
      ? [`Open ${repoWebUrl}.`]
      : workspacePath
        ? [`Inspect workspace at ${workspacePath}.`]
        : ["Inspect the recorded repo or worker evidence manually."];
  const userMessage = openTarget
    ? `Product preview available at ${openTarget}. BOX can try to open it automatically.`
    : repoWebUrl
      ? `Product delivered to ${repoWebUrl}. Presentation agent did not provide a direct runnable surface.`
      : deliveredSentence || "Product delivered, but BOX could not determine how to present it automatically.";
  return {
    deliveredSentence,
    status: openTarget ? "ready_to_open" : primaryLocation ? "documented" : "manual_followup_required",
    locationType,
    primaryLocation,
    repoWebUrl,
    workspacePath,
    openTarget,
    autoOpenEligible: Boolean(openTarget),
    preserveWorkspace: canOpenLocalIndex,
    instructions,
    userMessage,
    execution: openTarget
      ? /^https?:\/\//i.test(openTarget)
        ? {
            mode: "open_url",
            target: openTarget,
            staticRoot: null,
            preferredPort: null,
          }
        : /index\.html?$/i.test(openTarget)
          ? {
              mode: "serve_and_open",
              target: openTarget,
              staticRoot: path.dirname(openTarget),
              preferredPort: 4173,
            }
          : {
              mode: "open_direct",
              target: openTarget,
              staticRoot: null,
              preferredPort: null,
            }
      : {
          mode: "document_only",
          target: primaryLocation,
          staticRoot: null,
          preferredPort: null,
        },
    resolutionSource: "fallback_evidence_only",
  };
}

function isPreviewLikeTarget(target: unknown): boolean {
  const normalized = String(target || "").trim().toLowerCase();
  if (!normalized) return false;
  if (/^https?:\/\//.test(normalized)) {
    return rankPreviewUrlCandidate(normalized) >= 60;
  }
  if (/^file:/.test(normalized)) {
    return true;
  }
  if (/\.html?(?:$|[?#])/.test(normalized)) return true;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|vercel\.app|netlify\.app|pages\.dev|github\.io|web\.app|azurewebsites\.net|onrender\.com|fly\.dev/.test(normalized)) {
    return true;
  }
  return false;
}

function normalizePresentationDelivery(rawPresentation: any, fallback: any, reportStatus: string) {
  const locationType = String(rawPresentation?.locationType || "").trim().toLowerCase();
  const primaryLocation = String(rawPresentation?.primaryLocation || "").trim() || null;
  const openTarget = String(rawPresentation?.openTarget || "").trim() || null;
  const thinkingSummary = String(rawPresentation?.thinkingSummary || rawPresentation?.decisionTrace?.summary || "").trim() || null;
  const decisionTrace = rawPresentation?.decisionTrace && typeof rawPresentation.decisionTrace === "object"
    ? {
      summary: String(rawPresentation.decisionTrace.summary || "").trim() || null,
      repoAssessment: String(rawPresentation.decisionTrace.repoAssessment || "").trim() || null,
      availableSurfaces: Array.isArray(rawPresentation.decisionTrace.availableSurfaces)
        ? rawPresentation.decisionTrace.availableSurfaces.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
        : [],
      blockers: Array.isArray(rawPresentation.decisionTrace.blockers)
        ? rawPresentation.decisionTrace.blockers.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
        : [],
      chosenAction: String(rawPresentation.decisionTrace.chosenAction || "").trim() || null,
    }
    : null;
  const instructions = Array.isArray(rawPresentation?.instructions)
    ? rawPresentation.instructions.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
    : [];
  const userMessage = String(rawPresentation?.userMessage || rawPresentation?.summary || "").trim() || null;
  const preserveWorkspace = rawPresentation?.preserveWorkspace === true;
  const status = String(rawPresentation?.status || "").trim().toLowerCase();
  const resolvedStatus = ["ready_to_open", "documented", "manual_followup_required"].includes(status)
    ? status
    : openTarget
      ? "ready_to_open"
      : primaryLocation
        ? "documented"
        : "manual_followup_required";
  const autoOpenEligible = isTargetSuccessContractTerminal({ status: reportStatus })
    && resolvedStatus === "ready_to_open"
    && Boolean(openTarget);
  if (!locationType || (!primaryLocation && !openTarget && !userMessage)) {
    return fallback;
  }
  const normalizedPresentation = {
    ...fallback,
    status: resolvedStatus,
    locationType,
    primaryLocation: primaryLocation || openTarget || fallback.primaryLocation,
    openTarget: autoOpenEligible ? openTarget : null,
    autoOpenEligible,
    preserveWorkspace,
    thinkingSummary,
    decisionTrace,
    instructions: instructions.length > 0 ? instructions : fallback.instructions,
    userMessage: userMessage || fallback.userMessage,
    execution: normalizePresentationExecution(rawPresentation?.execution, {
      fallback,
      resolvedStatus,
      openTarget,
      primaryLocation: primaryLocation || openTarget || fallback.primaryLocation,
      locationType,
    }),
    resolutionSource: "product_presenter_ai",
  };

  const fallbackTarget = String(fallback?.openTarget || fallback?.primaryLocation || "").trim() || null;
  const chosenTarget = String(normalizedPresentation?.openTarget || normalizedPresentation?.primaryLocation || "").trim() || null;
  const preferFallbackPreview = isTargetSuccessContractTerminal({ status: reportStatus })
    && isPreviewLikeTarget(fallbackTarget)
    && !isPreviewLikeTarget(chosenTarget);

  if (preferFallbackPreview) {
    return {
      ...fallback,
      thinkingSummary,
      decisionTrace,
      instructions: instructions.length > 0 ? instructions : fallback.instructions,
      userMessage: userMessage || fallback.userMessage,
      resolutionSource: "product_presenter_ai_preview_overridden",
    };
  }

  return normalizedPresentation;
}

function normalizePresentationExecution(
  rawExecution: any,
  context: {
    fallback: any;
    resolvedStatus: string;
    openTarget: string | null;
    primaryLocation: string | null;
    locationType: string;
  },
) {
  const supportedModes = new Set(["open_direct", "open_url", "serve_and_open", "document_only"]);
  const mode = String(rawExecution?.mode || "").trim().toLowerCase();
  const target = String(rawExecution?.target || "").trim() || null;
  const staticRoot = String(rawExecution?.staticRoot || "").trim() || null;
  const rawPort = Number(rawExecution?.preferredPort);
  const preferredPort = Number.isFinite(rawPort) && rawPort >= 1024 ? rawPort : null;

  if (supportedModes.has(mode)) {
    if (mode === "document_only") {
      return { mode, target: target || context.primaryLocation, staticRoot: null, preferredPort: null };
    }
    if (mode === "serve_and_open") {
      const serveTarget = target || context.openTarget || context.primaryLocation || null;
      return {
        mode,
        target: serveTarget,
        staticRoot: staticRoot || (serveTarget && /index\.html?$/i.test(serveTarget) ? path.dirname(serveTarget) : serveTarget),
        preferredPort,
      };
    }
    return {
      mode,
      target: target || context.openTarget || context.primaryLocation,
      staticRoot: null,
      preferredPort: null,
    };
  }

  if (context.resolvedStatus !== "ready_to_open") {
    return {
      mode: "document_only",
      target: context.primaryLocation || context.fallback?.primaryLocation || null,
      staticRoot: null,
      preferredPort: null,
    };
  }

  const inferredTarget = context.openTarget || context.primaryLocation || context.fallback?.openTarget || null;
  if (/^https?:\/\//i.test(String(inferredTarget || ""))) {
    return { mode: "open_url", target: inferredTarget, staticRoot: null, preferredPort: null };
  }
  if (context.locationType === "local_path" || /index\.html?$/i.test(String(inferredTarget || ""))) {
    return {
      mode: "serve_and_open",
      target: inferredTarget,
      staticRoot: inferredTarget && /index\.html?$/i.test(inferredTarget) ? path.dirname(inferredTarget) : inferredTarget,
      preferredPort: 4173,
    };
  }
  return { mode: "open_direct", target: inferredTarget, staticRoot: null, preferredPort: null };
}

async function resolvePresentationDelivery(
  config: any,
  report: any,
  session: any,
  qualityEvidence: ReturnType<typeof parseWorkerEvidence>,
  opts: { resolvePresentation?: (input: any) => Promise<any> } = {},
) {
  const baseFallback = buildFallbackDelivery(config, session, qualityEvidence, report?.status);
  const workspaceContext = await readWorkspacePresentationContext(baseFallback.workspacePath);
  const sanitizedFallback = sanitizeFallbackDeliveryAgainstWorkspace(baseFallback, workspaceContext);
  const fallback = applyWorkspaceAwareFallbackDelivery(
    sanitizedFallback,
    workspaceContext,
    report?.status,
  );
  const requestPayload = {
    projectId: report?.projectId || null,
    sessionId: report?.sessionId || null,
    status: report?.status || null,
    objectiveSummary: report?.objectiveSummary || session?.objective?.summary || null,
    repoUrl: session?.repo?.repoUrl || null,
    defaultBranch: session?.repo?.defaultBranch || null,
    workspacePath: fallback.workspacePath,
    deliveredSentence: qualityEvidence?.deliveredSentence || null,
    evidencePreviewUrl: fallback.openTarget,
    qualityEvidence: {
      actualOutcome: qualityEvidence?.actualOutcome || null,
      expectedOutcome: qualityEvidence?.expectedOutcome || null,
      rawText: qualityEvidence?.rawText || null,
    },
    presentationCandidates: {
      distIndexPath: workspaceContext?.distIndexPath || null,
      rootIndexPath: workspaceContext?.rootIndexPath || null,
      previewUrls: Array.isArray(workspaceContext?.previewUrls) ? workspaceContext.previewUrls : [],
      recommendedOpenTarget: workspaceContext?.recommendedOpenTarget || null,
    },
    workspaceContext,
    fallback,
    platform: process.platform,
  };

  if (typeof opts.resolvePresentation === "function") {
    try {
      const resolved = await opts.resolvePresentation(requestPayload);
      return normalizePresentationDelivery(resolved, fallback, report?.status);
    } catch {
      return fallback;
    }
  }

  const command = config?.env?.copilotCliCommand || "copilot";
  const executionCwd = String(fallback?.workspacePath || "").trim();
  const presenterExecutionCwd = executionCwd && await pathExists(executionCwd)
    ? executionCwd
    : process.cwd();
  if (!agentFileExistsForExecution(PRODUCT_PRESENTER_AGENT_SLUG, presenterExecutionCwd)) {
    await appendProgress(config, `[TARGET_PRESENTATION] presenter=skipped reason=agent_missing repoKind=${workspaceContext.repoKind} fallback=${fallback.locationType}:${String(fallback.openTarget || fallback.primaryLocation || "none")}`);
    return fallback;
  }
  const model = config?.roleRegistry?.qualityReviewer?.model || "Claude Sonnet 4.6";
  const prompt = `You are BOX's product presentation agent.
Your task: decide how BOX should present a completed product to the user after delivery.

Rules:
- Use ONLY the evidence provided below.
- Do NOT invent files, routes, URLs, commands, servers, or deployment surfaces.
- You may inspect the workspace directly with read/search/execute tools before deciding.
- If workspacePath exists on disk, you MUST inspect the workspace directly before deciding.
- If workspacePath exists on disk, you MUST perform at least one concrete artifact or runtime check that is relevant to the final action you choose.
- Understand the repo type from the workspace evidence.
- Decide the best presentation path from the evidence, repo state, and available surfaces.
- Prioritize the best currently runnable or openable verified product surface over PR/repo metadata when both exist.
- If a verified \`dist/index.html\`, deployed preview URL, or other concrete product surface exists now, prefer that over a PR or repo link.
- Treat delivery evidence and merged PRs as supporting context unless they are the only real surfaces available.
- Choose the presentation style that best shows the finished result to the user when a safe surface exists.
- If no direct runnable surface is evidenced, document the safest verifiable access path instead of guessing.
- Choose the exact execution action BOX should apply now: open_direct, open_url, serve_and_open, or document_only.
- If a local website artifact would be safer through a static server, explicitly choose serve_and_open instead of leaving that decision to the caller.
- preserveWorkspace=true only when the target you want BOX to open depends on the local workspace continuing to exist.
- First write a short operator-visible reasoning section in plain English before the markers.
- That reasoning section should briefly say what surfaces you evaluated, what blockers mattered, and why you chose the final action.
- Include concrete action-style lines when you inspect things, for example short lines showing what you checked in the workspace before deciding.
- If the workspace exists, do not answer from the provided JSON alone. Re-check the workspace with tools and reflect those actions in the visible reasoning lines.
- End the reasoning by naming the exact action BOX should execute now.
- Prefer a worker-like operator trace with 4-8 short lines, such as: inspect workspace, inspect build artifact, inspect preview candidates, compare surfaces, choose action.
- After the reasoning section, output strict JSON only inside markers.

Context:
${JSON.stringify(requestPayload, null, 2)}

===DECISION===
{
  "presentation": {
    "status": "ready_to_open|documented|manual_followup_required",
    "locationType": "local_path|url|repo|workspace|manual",
    "primaryLocation": "string|null",
    "openTarget": "string|null",
    "execution": {
      "mode": "open_direct|open_url|serve_and_open|document_only",
      "target": "string|null",
      "staticRoot": "string|null",
      "preferredPort": 4173
    },
    "preserveWorkspace": true,
    "thinkingSummary": "string",
    "rationale": "string",
    "decisionTrace": {
      "summary": "string",
      "repoAssessment": "string",
      "availableSurfaces": ["string"],
      "blockers": ["string"],
      "chosenAction": "string"
    },
    "instructions": ["string"],
    "userMessage": "string"
  }
}
===END===`;

  const args = buildAgentArgs({
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    prompt,
    model,
    allowAll: false,
    noAskUser: true,
    autopilot: false,
    silent: false,
    runContract: {
      executionCwd: presenterExecutionCwd,
    },
  });
  appendAgentLiveLog(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session,
    contextLabel: "target_presentation",
    status: "starting",
    message: `reportStatus=${String(report?.status || "unknown")} repoKind=${String(workspaceContext?.repoKind || "unknown")} fallback=${String(fallback?.openTarget || fallback?.primaryLocation || "none")}`,
  });
  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session,
    contextLabel: "target_presentation",
    stage: "prompt",
    title: "Prompt",
    content: prompt,
  });
  const stdoutStreamLogger = createAgentStreamLogger(
    config,
    session,
    PRODUCT_PRESENTER_AGENT_SLUG,
    "target_presentation",
    "stdout",
  );
  const stderrStreamLogger = createAgentStreamLogger(
    config,
    session,
    PRODUCT_PRESENTER_AGENT_SLUG,
    "target_presentation",
    "stderr",
  );
  const result: any = await spawnAsync(command, args, {
    env: process.env,
    cwd: presenterExecutionCwd,
    timeoutMs: 120000,
    onStdout: (chunk: Buffer | string) => {
      stdoutStreamLogger.push(chunk);
    },
    onStderr: (chunk: Buffer | string) => {
      stderrStreamLogger.push(chunk);
    },
  });
  stdoutStreamLogger.flush();
  stderrStreamLogger.flush();
  appendAgentLiveLog(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session,
    contextLabel: "target_presentation",
    status: Number(result?.status ?? 1) === 0 ? "completed" : "failed",
    message: `repoKind=${String(workspaceContext?.repoKind || "unknown")} fallback=${String(fallback?.openTarget || fallback?.primaryLocation || "none")} stdout=${String(result?.stdout || "").trim() ? "present" : "empty"} stderr=${String(result?.stderr || "").trim() ? "present" : "empty"}`,
  });
  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session,
    contextLabel: "target_presentation",
    stage: "result",
    title: "Raw Output",
    content: [
      `STATUS: ${String(result?.status ?? "unknown")}`,
      "",
      "STDOUT:",
      String(result?.stdout || ""),
      "",
      "STDERR:",
      String(result?.stderr || ""),
    ].join("\n"),
  });
  writeAgentDebugFile(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    prompt,
    result,
    session,
    contextLabel: "target_presentation",
    metadata: {
      reportStatus: report?.status || null,
      repoKind: workspaceContext?.repoKind || null,
      fallbackTarget: fallback?.openTarget || fallback?.primaryLocation || null,
    },
  });
  if (Number(result?.status ?? 1) !== 0 || !String(result?.stdout || "").trim()) {
    await appendProgress(config, `[TARGET_PRESENTATION] presenter=failed repoKind=${workspaceContext.repoKind} reason=${String(result?.stderr || result?.error || "empty_output").slice(0, 120)} fallback=${fallback.locationType}:${String(fallback.openTarget || fallback.primaryLocation || "none")}`);
    return {
      ...fallback,
      resolutionSource: `product_presenter_failed:${String(result?.stderr || result?.error || "empty_output").slice(0, 120)}`,
    };
  }
  const parsed = parseAgentOutput(String(result.stdout || ""));
  appendAgentLiveLog(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session,
    contextLabel: "target_presentation",
    status: parsed?.ok ? "parsed" : "unparsed",
    message: [
      parsed?.parsed?.presentation?.thinkingSummary
        ? `thinking=${String(parsed.parsed.presentation.thinkingSummary).replace(/\s+/g, " ").slice(0, 400)}`
        : parsed?.thinking
          ? `thinking=${String(parsed.thinking).replace(/\s+/g, " ").slice(0, 400)}`
          : "thinking=none",
      `decisionStatus=${String(parsed?.parsed?.presentation?.status || "none")}`,
      `executionMode=${String(parsed?.parsed?.presentation?.execution?.mode || "none")}`,
      `target=${String(parsed?.parsed?.presentation?.openTarget || parsed?.parsed?.presentation?.primaryLocation || "none")}`,
      parsed?.parsed?.presentation?.decisionTrace?.chosenAction
        ? `chosenAction=${String(parsed.parsed.presentation.decisionTrace.chosenAction).replace(/\s+/g, " ").slice(0, 240)}`
        : "chosenAction=none",
      parsed?.parsed?.presentation?.rationale ? `rationale=${String(parsed.parsed.presentation.rationale).replace(/\s+/g, " ").slice(0, 240)}` : "rationale=none",
    ].join(" | "),
  });
  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session,
    contextLabel: "target_presentation",
    stage: "thinking",
    title: "Visible Reasoning",
    content: String(parsed?.thinking || parsed?.parsed?.presentation?.thinkingSummary || ""),
  });
  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session,
    contextLabel: "target_presentation",
    stage: "parsed",
    title: "Parsed Decision",
    content: JSON.stringify(parsed, null, 2),
  });
  writeAgentDebugFile(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    prompt,
    result,
    parsed,
    session,
    contextLabel: "target_presentation",
    metadata: {
      reportStatus: report?.status || null,
      repoKind: workspaceContext?.repoKind || null,
      fallbackTarget: fallback?.openTarget || fallback?.primaryLocation || null,
    },
  });
  const normalized = normalizePresentationDelivery(parsed?.parsed?.presentation, fallback, report?.status);
  await appendProgress(config, `[TARGET_PRESENTATION] presenter=ai repoKind=${workspaceContext.repoKind} status=${normalized.status} action=${String(normalized.execution?.mode || "none")} source=${normalized.resolutionSource} target=${String(normalized.openTarget || normalized.primaryLocation || "none")} thinking=${String(normalized.thinkingSummary || normalized.decisionTrace?.summary || "none").replace(/\s+/g, " ").slice(0, 220)}`);
  return normalized;
}

async function startLocalStaticServer(directoryPath: string, preferredPort = 4173) {
  const normalizedDir = path.resolve(directoryPath);
  const listenPort = Math.max(1024, Number(preferredPort || 4173));
  const script = [
    "const http=require('http');",
    "const fs=require('fs');",
    "const path=require('path');",
    `const root=${JSON.stringify(normalizedDir)};`,
    `const port=${listenPort};`,
    "const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};",
    "const server=http.createServer((req,res)=>{",
    "  const requestPath=decodeURIComponent(String(req.url||'/').split('?')[0]);",
    "  const safePath=path.normalize(requestPath).replace(/^([\\/])+/, '');",
    "  let filePath=path.join(root, safePath || 'index.html');",
    "  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath=path.join(filePath,'index.html');",
    "  if (!fs.existsSync(filePath) && fs.existsSync(path.join(root,'index.html'))) filePath=path.join(root,'index.html');",
    "  fs.readFile(filePath,(err,data)=>{",
    "    if(err){res.statusCode=404;res.end('Not found');return;}",
    "    res.setHeader('Content-Type', mime[path.extname(filePath).toLowerCase()]||'application/octet-stream');",
    "    res.end(data);",
    "  });",
    "});",
    "server.listen(port,'127.0.0.1',()=>{});",
  ].join("");
  const child = spawn(process.execPath, ["-e", script], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return { url: `http://127.0.0.1:${listenPort}`, reason: "static_server_started" };
}

async function spawnDetachedAndConfirm(command: string, args: string[], options: Record<string, unknown> = {}) {
  try {
    return await new Promise<{ attempted: boolean; opened: boolean; reason: string | null }>((resolve) => {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: process.platform === "win32",
        ...options,
      });

      let settled = false;
      const timer = setTimeout(() => finish({ attempted: true, opened: true, reason: null }), 350);

      const cleanup = () => {
        clearTimeout(timer);
        child.removeListener("error", onError);
        child.removeListener("exit", onExit);
      };

      const finish = (result: { attempted: boolean; opened: boolean; reason: string | null }) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (result.opened === true) {
          child.unref();
        }
        resolve(result);
      };

      const onError = (err: unknown) => {
        finish({
          attempted: true,
          opened: false,
          reason: String(err instanceof Error ? err.message : err || "spawn_failed"),
        });
      };

      const onExit = (code: number | null) => {
        if (code === 0) {
          finish({ attempted: true, opened: true, reason: null });
          return;
        }
        finish({
          attempted: true,
          opened: false,
          reason: code === null ? "exited_without_code" : `exit_${code}`,
        });
      };

      child.once("error", onError);
      child.once("exit", onExit);
    });
  } catch (err) {
    return {
      attempted: true,
      opened: false,
      reason: String(err instanceof Error ? err.message : err || "spawn_failed"),
    };
  }
}

async function openDeliveryTarget(targetPath: string) {
  const target = String(targetPath || "").trim();
  if (!target) {
    return { attempted: false, opened: false, reason: "missing_target" };
  }

  try {
    if (process.platform === "win32") {
      const isHttpUrl = /^https?:/i.test(target);
      const isFileUrl = /^file:/i.test(target);
      const normalizedTarget = isHttpUrl || isFileUrl ? target : path.resolve(target);
      const targetUrl = isHttpUrl || isFileUrl
        ? target
        : pathToFileURL(path.resolve(target)).toString();
      const browserCandidates = [
        { kind: "edge", path: path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe") },
        { kind: "edge", path: path.join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe") },
        { kind: "chrome", path: path.join(process.env["ProgramFiles(x86)"] || "", "Google", "Chrome", "Application", "chrome.exe") },
        { kind: "chrome", path: path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe") },
        { kind: "chrome", path: path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe") },
        { kind: "firefox", path: path.join(process.env.ProgramFiles || "", "Mozilla Firefox", "firefox.exe") },
        { kind: "firefox", path: path.join(process.env["ProgramFiles(x86)"] || "", "Mozilla Firefox", "firefox.exe") },
      ].filter((entry) => entry.path);
      const looksLikeHtml = /\.html?$/i.test(normalizedTarget) || /^file:.*\.html?$/i.test(targetUrl);

      if (isHttpUrl || looksLikeHtml) {
        for (const candidate of browserCandidates) {
          if (!(await pathExists(candidate.path))) continue;
          const args = candidate.kind === "firefox"
            ? ["-new-window", targetUrl]
            : ["--new-window", targetUrl];
          const launched = await spawnDetachedAndConfirm(candidate.path, args);
          if (launched.opened) {
            return { attempted: true, opened: true, reason: `browser_new_window:${candidate.kind}` };
          }
        }
      }

      if (isHttpUrl) {
        const cmdOpen = await spawnDetachedAndConfirm("cmd.exe", ["/d", "/s", "/c", "start", "", targetUrl]);
        if (cmdOpen.opened) {
          return { attempted: true, opened: true, reason: "cmd_start_url" };
        }
      }

      if (!isHttpUrl && !isFileUrl) {
        const explorerOpen = await spawnDetachedAndConfirm("explorer.exe", [normalizedTarget]);
        if (explorerOpen.opened) {
          return { attempted: true, opened: true, reason: looksLikeHtml ? "explorer_html" : "explorer_path" };
        }
      }

      const psTarget = (isHttpUrl || isFileUrl ? targetUrl : normalizedTarget).replace(/'/g, "''");
      const powerShellOpen = await spawnDetachedAndConfirm(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", `Start-Process '${psTarget}'`],
      );
      return powerShellOpen.opened
        ? { attempted: true, opened: true, reason: isHttpUrl ? "powershell_start_url" : looksLikeHtml ? "powershell_start_process_html" : "powershell_start_path" }
        : powerShellOpen;
    }
    if (process.platform === "darwin") {
      return await spawnDetachedAndConfirm("open", [target]);
    }
    return await spawnDetachedAndConfirm("xdg-open", [target]);
  } catch (err) {
    return { attempted: true, opened: false, reason: String(err instanceof Error ? err.message : err || "open_failed") };
  }
}

async function executePresentationAction(
  delivery: any,
  openTargetFn: (target: string) => Promise<any>,
) {
  const execution = delivery?.execution && typeof delivery.execution === "object"
    ? delivery.execution
    : null;
  const mode = String(execution?.mode || "").trim().toLowerCase();
  const target = String(execution?.target || delivery?.openTarget || delivery?.primaryLocation || "").trim() || null;
  const staticRoot = String(execution?.staticRoot || "").trim() || null;
  const preferredPort = Number.isFinite(Number(execution?.preferredPort)) ? Number(execution.preferredPort) : 4173;

  if (!mode || mode === "document_only") {
    return {
      attempted: false,
      opened: false,
      reason: target ? "document_only" : "no_execution_target",
      execution: {
        mode: mode || "document_only",
        target,
        staticRoot: null,
        preferredPort: null,
        finalTarget: target,
      },
    };
  }

  if (!target) {
    return {
      attempted: false,
      opened: false,
      reason: "missing_target",
      execution: {
        mode,
        target: null,
        staticRoot,
        preferredPort,
        finalTarget: null,
      },
    };
  }

  if (mode === "serve_and_open") {
    try {
      const directOpen = await openTargetFn(target);
      if (directOpen?.opened === true) {
        return {
          ...directOpen,
          execution: {
            mode,
            target,
            staticRoot: staticRoot || (/index\.html?$/i.test(target) ? path.dirname(target) : target),
            preferredPort,
            finalTarget: target,
          },
        };
      }

      const serveRoot = staticRoot || (/index\.html?$/i.test(target) ? path.dirname(target) : target);
      const served = await startLocalStaticServer(serveRoot, preferredPort);
      const openResult = await openTargetFn(served.url);
      return {
        ...openResult,
        reason: openResult?.reason || served.reason,
        execution: {
          mode,
          target,
          staticRoot: serveRoot,
          preferredPort,
          finalTarget: served.url,
        },
      };
    } catch (err) {
      return {
        attempted: true,
        opened: false,
        reason: String(err instanceof Error ? err.message : err || "serve_and_open_failed"),
        execution: {
          mode,
          target,
          staticRoot,
          preferredPort,
          finalTarget: null,
        },
      };
    }
  }

  const openResult = await openTargetFn(target);
  return {
    ...openResult,
    execution: {
      mode,
      target,
      staticRoot: null,
      preferredPort: null,
      finalTarget: target,
    },
  };
}

export async function performTargetDeliveryHandoff(
  config: any,
  report: any,
  opts: {
    openTarget?: (target: string) => Promise<any>;
    resolvePresentation?: (input: any) => Promise<any>;
    forceAutoOpen?: boolean;
  } = {},
) {
  const stateDir = config?.paths?.stateDir || "state";
  await appendProgress(config, `[TARGET_PRESENTATION] handoff=starting status=${String(report?.status || "unknown")}`);
  const session = await loadActiveTargetSession(config);
  const handoffSession = session || {
    projectId: report?.projectId || null,
    sessionId: report?.sessionId || null,
    repo: {
      repoUrl: report?.delivery?.repoWebUrl || null,
      repoFullName: normalizeRepoMarker(report?.delivery?.repoWebUrl),
      name: null,
    },
    workspace: { path: report?.delivery?.workspacePath || null },
    objective: { summary: report?.objectiveSummary || null },
  };
  const alignedEntries = await loadAlignedWorkerEvidenceEntries(stateDir, handoffSession);
  const releaseEntry = selectBestReleaseEvidence(alignedEntries);
  const qualityEvidence = releaseEntry?.evidence || parseWorkerEvidence("");
  const delivery = await resolvePresentationDelivery(config, report, handoffSession, qualityEvidence, {
    resolvePresentation: opts.resolvePresentation,
  });
  const openTargetFn = typeof opts.openTarget === "function" ? opts.openTarget : openDeliveryTarget;
  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session: handoffSession,
    contextLabel: "target_presentation",
    stage: "execution_plan",
    title: "Execution Plan",
    content: JSON.stringify(delivery?.execution || null, null, 2),
  });
  const autoOpenEnabled = opts.forceAutoOpen === true || config?.runtime?.autoOpenTargetDelivery === true;
  const hasOpenableSurface = delivery?.autoOpenEligible || ["serve_and_open", "open_direct", "open_url"].includes(String(delivery?.execution?.mode || ""));
  const autoOpen = autoOpenEnabled && hasOpenableSurface
    ? await executePresentationAction(delivery, openTargetFn)
    : {
        attempted: false,
        opened: false,
        reason: !hasOpenableSurface
          ? delivery?.primaryLocation ? "auto_open_not_supported_for_surface" : "no_openable_target"
          : "auto_open_disabled",
        execution: delivery?.execution || null,
      };
  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session: handoffSession,
    contextLabel: "target_presentation",
    stage: "execution_result",
    title: "Execution Result",
    content: JSON.stringify(autoOpen, null, 2),
  });
  const handoff = {
    recordedAt: new Date().toISOString(),
    projectId: report?.projectId || null,
    sessionId: report?.sessionId || null,
    status: report?.status || null,
    summary: delivery?.userMessage || report?.summary || null,
    delivery,
    autoOpen,
  };
  await appendProgress(config, `[TARGET_PRESENTATION] handoff=resolved status=${String(delivery?.status || "unknown")} locationType=${String(delivery?.locationType || "unknown")} target=${String(autoOpen?.execution?.finalTarget || delivery?.openTarget || delivery?.primaryLocation || "none")} autoOpen=${autoOpen.opened === true ? "opened" : autoOpen.attempted === true ? `failed:${String(autoOpen.reason || "unknown")}` : `skipped:${String(autoOpen.reason || "n/a")}`}`);
  await writeJson(path.join(stateDir, "last_target_delivery_handoff.json"), handoff);
  return handoff;
}

export async function rerunCompletedTargetPresentation(
  config: any,
  input: {
    projectId?: string | null;
    sessionId?: string | null;
    status?: string | null;
    summary?: string | null;
    repoUrl?: string | null;
    workspacePath?: string | null;
    objectiveSummary?: string | null;
    delivery?: Record<string, unknown> | null;
  },
  opts: {
    openTarget?: (target: string) => Promise<any>;
    resolvePresentation?: (input: any) => Promise<any>;
  } = {},
) {
  const stateDir = config?.paths?.stateDir || "state";
  const projectId = normalizeOptionalString(input?.projectId);
  const sessionId = normalizeOptionalString(input?.sessionId);
  if (!projectId || !sessionId) {
    throw new Error("Project id and session id are required to rerun completed target presentation.");
  }

  const rawDelivery = input?.delivery && typeof input.delivery === "object"
    ? input.delivery
    : null;
  const persistedSession = await readJson(getTargetSessionPath(stateDir, projectId, sessionId), null);
  const handoffSession = persistedSession && typeof persistedSession === "object" && !Array.isArray(persistedSession)
    ? persistedSession
    : {
        projectId,
        sessionId,
        repo: {
          repoUrl: normalizeOptionalString((rawDelivery as any)?.repoWebUrl) || normalizeOptionalString(input?.repoUrl),
          repoFullName: normalizeRepoMarker((rawDelivery as any)?.repoWebUrl) || normalizeRepoMarker(input?.repoUrl),
          name: null,
        },
        workspace: { path: normalizeOptionalString((rawDelivery as any)?.workspacePath) || normalizeOptionalString(input?.workspacePath) },
        objective: { summary: normalizeOptionalString(input?.objectiveSummary) || normalizeOptionalString(input?.summary) },
      };

  await appendProgress(
    config,
    `[TARGET_PRESENTATION] refresh=starting project=${projectId} session=${sessionId}`,
  );

  const alignedEntries = await loadAlignedWorkerEvidenceEntries(stateDir, handoffSession);
  const releaseEntry = selectBestReleaseEvidence(alignedEntries);
  const qualityEvidence = releaseEntry?.evidence || parseWorkerEvidence("");
  const delivery = await resolvePresentationDelivery(
    config,
    {
      projectId,
      sessionId,
      status: normalizeOptionalString(input?.status),
      summary: normalizeOptionalString(input?.summary),
      objectiveSummary: normalizeOptionalString(input?.objectiveSummary),
      delivery: {
        ...(rawDelivery || {}),
        repoWebUrl: normalizeOptionalString((rawDelivery as any)?.repoWebUrl)
          || normalizeOptionalString(input?.repoUrl)
          || normalizeOptionalString((handoffSession as any)?.repo?.repoUrl),
        workspacePath: normalizeOptionalString((rawDelivery as any)?.workspacePath)
          || normalizeOptionalString(input?.workspacePath)
          || normalizeOptionalString((handoffSession as any)?.workspace?.path),
      },
    },
    handoffSession,
    qualityEvidence,
    { resolvePresentation: opts.resolvePresentation },
  );

  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session: handoffSession,
    contextLabel: "target_presentation_refresh",
    stage: "execution_plan",
    title: "Refresh Execution Plan",
    content: JSON.stringify(delivery?.execution || null, null, 2),
  });

  const openTargetFn = typeof opts.openTarget === "function" ? opts.openTarget : openDeliveryTarget;
  const hasOpenableSurface = delivery?.autoOpenEligible || ["serve_and_open", "open_direct", "open_url"].includes(String(delivery?.execution?.mode || ""));
  const autoOpen = hasOpenableSurface
    ? await executePresentationAction(delivery, openTargetFn)
    : {
        attempted: false,
        opened: false,
        reason: delivery?.primaryLocation ? "auto_open_not_supported_for_surface" : "no_openable_target",
        execution: delivery?.execution || null,
      };

  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session: handoffSession,
    contextLabel: "target_presentation_refresh",
    stage: "execution_result",
    title: "Refresh Execution Result",
    content: JSON.stringify(autoOpen, null, 2),
  });

  const handoff = {
    recordedAt: new Date().toISOString(),
    projectId,
    sessionId,
    status: normalizeOptionalString(input?.status) || delivery?.status || null,
    summary: delivery?.userMessage || normalizeOptionalString(input?.summary),
    delivery,
    autoOpen,
  };

  await appendProgress(
    config,
    `[TARGET_PRESENTATION] refresh=resolved status=${String(delivery?.status || "unknown")} action=${String(delivery?.execution?.mode || "none")} target=${String(autoOpen?.execution?.finalTarget || delivery?.openTarget || delivery?.primaryLocation || "none")} opened=${autoOpen.opened === true ? "true" : "false"}`,
  );
  await writeJson(path.join(stateDir, "last_target_delivery_handoff.json"), handoff);
  return handoff;
}

export async function replayStoredTargetPresentation(
  config: any,
  input: {
    projectId?: string | null;
    sessionId?: string | null;
    status?: string | null;
    summary?: string | null;
    repoUrl?: string | null;
    workspacePath?: string | null;
    objectiveSummary?: string | null;
    delivery?: Record<string, unknown> | null;
  },
  opts: {
    openTarget?: (target: string) => Promise<any>;
  } = {},
) {
  const stateDir = config?.paths?.stateDir || "state";
  const delivery = input?.delivery && typeof input.delivery === "object"
    ? input.delivery
    : null;
  if (!delivery) {
    throw new Error("No archived presentation delivery is available for replay.");
  }

  const replaySession = {
    projectId: input?.projectId || null,
    sessionId: input?.sessionId || null,
    repo: {
      repoUrl: normalizeOptionalString((delivery as any)?.repoWebUrl) || normalizeOptionalString(input?.repoUrl),
      repoFullName: normalizeRepoMarker((delivery as any)?.repoWebUrl) || normalizeRepoMarker(input?.repoUrl),
      name: null,
    },
    workspace: { path: normalizeOptionalString((delivery as any)?.workspacePath) || normalizeOptionalString(input?.workspacePath) },
    objective: { summary: normalizeOptionalString(input?.objectiveSummary) || normalizeOptionalString(input?.summary) },
  };

  await appendProgress(
    config,
    `[TARGET_PRESENTATION] replay=starting project=${String(input?.projectId || "unknown")} session=${String(input?.sessionId || "unknown")}`,
  );

  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session: replaySession,
    contextLabel: "target_presentation_replay",
    stage: "execution_plan",
    title: "Replay Execution Plan",
    content: JSON.stringify((delivery as any)?.execution || null, null, 2),
  });

  const openTargetFn = typeof opts.openTarget === "function" ? opts.openTarget : openDeliveryTarget;
  const autoOpen = await executePresentationAction(delivery, openTargetFn);

  appendAgentLiveLogDetail(config, {
    agentSlug: PRODUCT_PRESENTER_AGENT_SLUG,
    session: replaySession,
    contextLabel: "target_presentation_replay",
    stage: "execution_result",
    title: "Replay Execution Result",
    content: JSON.stringify(autoOpen, null, 2),
  });

  const handoff = {
    recordedAt: new Date().toISOString(),
    projectId: input?.projectId || null,
    sessionId: input?.sessionId || null,
    status: input?.status || (delivery as any)?.status || null,
    summary: normalizeOptionalString((delivery as any)?.userMessage) || normalizeOptionalString(input?.summary),
    delivery,
    autoOpen,
  };

  await appendProgress(
    config,
    `[TARGET_PRESENTATION] replay=resolved status=${String((delivery as any)?.status || "unknown")} target=${String((autoOpen as any)?.execution?.finalTarget || (delivery as any)?.openTarget || (delivery as any)?.primaryLocation || "none")} opened=${(autoOpen as any)?.opened === true ? "true" : "false"}`,
  );
  await writeJson(path.join(stateDir, "last_target_delivery_handoff.json"), handoff);
  return handoff;
}

export function isTargetSuccessContractTerminal(report: any): boolean {
  return isTargetClosureDecisionTerminal(report);
}

export async function evaluateTargetSuccessContract(config: any, providedSession: any = null) {
  const stateDir = config?.paths?.stateDir || "state";
  const session = providedSession || await loadActiveTargetSession(config);
  if (!session) {
    return {
      schemaVersion: 1,
      status: TARGET_SUCCESS_CONTRACT_STATUS.OPEN,
      evaluatedAt: new Date().toISOString(),
      projectId: null,
      sessionId: null,
      summary: "No active target session available for success-contract evaluation.",
      blockers: ["no_active_target_session"],
      pendingHumanInputs: [],
      ignoredHumanInputs: [],
      objectiveSummary: null,
      delivery: null,
      dimensions: {},
    };
  }

  const alignedEntries = await loadAlignedWorkerEvidenceEntries(stateDir, session);
  const deliveryEntry = selectBestDeliveryEvidence(session, alignedEntries);
  const releaseEntry = selectBestReleaseEvidence(alignedEntries);
  const evolutionEvidence = deliveryEntry?.evidence || parseWorkerEvidence("");
  const qualityEvidence = releaseEntry?.evidence || parseWorkerEvidence("");
  const delivery = evaluateDeliveryDimension(session, evolutionEvidence, qualityEvidence);
  const releaseVerification = evaluateReleaseDimension(qualityEvidence);
  const evidenceAlignment = evaluateEvidenceAlignmentDimension(alignedEntries, deliveryEntry, releaseEntry);
  const evidenceText = [
    session?.objective?.summary,
    session?.intent?.summary,
    deliveryEntry?.text,
    releaseEntry?.text,
    evolutionEvidence.expectedOutcome,
    evolutionEvidence.actualOutcome,
    qualityEvidence.expectedOutcome,
    qualityEvidence.actualOutcome,
    qualityEvidence.deliveredSentence,
  ].filter(Boolean).join("\n");
  const intentCore = evaluateIntentDimension(
    session,
    evidenceText,
    delivery.status === "satisfied",
    releaseVerification.status === "satisfied",
  );
  const preferences = evaluatePreferenceDimension(session, evidenceText);
  const researchSaturation = await evaluateResearchSaturationDimension(stateDir, session, config);
  const projectReadiness = evaluateProjectReadinessDimension(
    session,
    delivery,
    releaseVerification,
    intentCore,
    researchSaturation,
  );
  const { pendingHumanInputs, ignoredHumanInputs } = resolveEffectiveHumanInputs(session);
  const blockers: string[] = [];
  if (delivery.status !== "satisfied") blockers.push("delivery_evidence_missing");
  if (releaseVerification.status !== "satisfied") blockers.push("release_signoff_missing");
  if (intentCore.status !== "satisfied") blockers.push("intent_alignment_unverified");
  if (projectReadiness.status === "missing" && projectReadiness.evidence.required) blockers.push("project_readiness_unverified");
  if (pendingHumanInputs.length > 0) blockers.push("human_input_pending");

  let status: string = TARGET_SUCCESS_CONTRACT_STATUS.OPEN;
  const readinessSatisfied = projectReadiness.status === "satisfied" || projectReadiness.status === "not_applicable";
  if (delivery.status === "satisfied" && releaseVerification.status === "satisfied" && intentCore.status === "satisfied" && readinessSatisfied) {
    status = pendingHumanInputs.length > 0
      ? TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED_WITH_HANDOFF
      : TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED;
  }

  const deliveryHandoff = buildFallbackDelivery(config, session, qualityEvidence, status);

  const result = {
    schemaVersion: 1,
    status,
    evaluatedAt: new Date().toISOString(),
    projectId: session.projectId,
    sessionId: session.sessionId,
    objectiveSummary: session?.objective?.summary || null,
    summary: status === TARGET_SUCCESS_CONTRACT_STATUS.OPEN
      ? `Target success contract remains open: ${blockers.join(", ") || "additional evidence required"}`
      : `Target success contract satisfied: ${status}`,
    blockers,
    pendingHumanInputs,
    ignoredHumanInputs,
    delivery: deliveryHandoff,
    dimensions: {
      delivery,
      releaseVerification,
      intentCore,
      preferences,
      evidenceAlignment,
      researchSaturation,
      projectReadiness,
    },
  };

  const resultWithClosure = {
    ...result,
    closure: await evaluateTargetClosure(config, session, result),
  };

  let effectiveResult = resultWithClosure;
  try {
    const persistedReport = await readJson(path.join(stateDir, "last_target_project_readiness.json"), null);
    const sameSession = persistedReport
      && persistedReport.projectId === session.projectId
      && persistedReport.sessionId === session.sessionId;
    const persistedHasClosureDecision = Boolean(String(persistedReport?.closure?.decision || "").trim());
    const freshReportIsTerminal = isTargetSuccessContractTerminal(resultWithClosure);
    const reopenedAfterPersistedTerminal = getSessionReactivatedAt(session) > parseTimestampOrZero(persistedReport?.evaluatedAt);
    if (
      sameSession
      && isTargetSuccessContractTerminal(persistedReport)
      && !freshReportIsTerminal
      && persistedHasClosureDecision
      && !reopenedAfterPersistedTerminal
    ) {
      effectiveResult = {
        ...persistedReport,
        evaluatedAt: new Date().toISOString(),
        stickyTerminal: true,
        stickyTerminalReason: "previous_terminal_success_preserved",
      };
    }
  } catch {
    // best-effort sticky terminal preservation
  }

  try {
    await writeJson(path.join(stateDir, "last_target_project_readiness.json"), effectiveResult);
    if (session?.projectId && session?.sessionId) {
      await writeJson(
        path.join(getTargetSessionPath(stateDir, String(session.projectId), String(session.sessionId)), PROJECT_READINESS_REPORT_FILE),
        effectiveResult,
      );
    }
  } catch {
    // best-effort persistence; evaluation result remains authoritative in memory
  }

  return effectiveResult;
}

export async function persistTargetSuccessContract(config: any, report: any) {
  if (!report?.projectId || !report?.sessionId) return null;
  const stateDir = config?.paths?.stateDir || "state";
  const completionPath = getTargetCompletionPath(stateDir, report.projectId, report.sessionId);
  await writeJson(completionPath, report);
  return completionPath;
}