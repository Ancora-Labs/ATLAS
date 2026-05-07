import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadConfig } from "../config.js";
import { isDaemonProcess, isProcessAlive, readDaemonPid, requestDaemonReload } from "../core/daemon_control.js";
import { readPipelineProgress } from "../core/pipeline_progress.js";
import { normalizeWorkerName } from "../core/role_registry.js";
import {
  getTargetClarificationPacketPath,
  getTargetIntentContractPath,
  TARGET_INTENT_STATUS,
} from "../core/target_session_state.js";
import { linkAtlasDesktopSessionToProjectSession, type AtlasDesktopSessionRecord } from "./desktop_sessions.js";
import {
  buildAtlasPlanningPrompt,
  readAtlasBuildRequest,
  type AtlasBuildRequestRecord,
  type AtlasBuildTriggerMode,
  type AtlasBuildTriggerState,
  writeAtlasBuildRequest,
} from "./build_request_state.js";
import {
  deriveAtlasAssetSignals,
  deriveAtlasImplementationFlexibility,
  deriveAtlasOperatorIntentEvidence,
} from "./intent_signals.js";
import { applyAtlasRepoContextToEnv } from "./repository_context.js";
import { applyAtlasRuntimeStateDirToConfig, resolveAtlasRuntimeStateDir } from "./runtime_state_root.js";
import { compareAtlasSessionsForDesktop, readAtlasSessionReadModel, type AtlasSessionDto } from "./state_bridge.js";

export { readAtlasBuildRequest } from "./build_request_state.js";

export type AtlasRuntimeAgentState = "idle" | "queued" | "active" | "done" | "error";
export type AtlasRuntimeAgentId = "jesus" | "research_scout" | "research_synthesizer" | "prometheus" | "athena" | "worker" | "done";

export interface AtlasRuntimeAgentMetric {
  label: string;
  value: string;
}

export interface AtlasRuntimeAgentNode {
  id: AtlasRuntimeAgentId;
  label: string;
  state: AtlasRuntimeAgentState;
  stateLabel: string;
  summary: string;
  detailTitle: string;
  detailBody: string;
  metrics: AtlasRuntimeAgentMetric[];
  logLines: string[];
}

export interface AtlasRuntimePipelineSnapshot {
  stage: string;
  stageLabel: string;
  percent: number;
  detail: string;
  loopCount: number;
  updatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AtlasRuntimeMissionSnapshot {
  sessionId: string | null;
  desktopSessionId: string | null;
  projectSessionId: string | null;
  title: string;
  objective: string;
  summary: string;
  requestedAt: string | null;
}

export interface AtlasRuntimeRequestSnapshot {
  state: AtlasBuildTriggerState;
  stateLabel: string;
  triggerMode: AtlasBuildTriggerMode | null;
  triggerLabel: string;
  runnerPid: number | null;
  lastError: string | null;
}

export interface AtlasRuntimeSnapshot {
  mission: AtlasRuntimeMissionSnapshot;
  request: AtlasRuntimeRequestSnapshot;
  pipeline: AtlasRuntimePipelineSnapshot;
  agents: AtlasRuntimeAgentNode[];
  defaultAgentId: AtlasRuntimeAgentId;
  sessionPremiumRequests?: number | null;
  updatedAt: string | null;
}

export interface QueueAtlasBuildForSessionOptions {
  stateDir: string;
  session: AtlasDesktopSessionRecord;
  force?: boolean;
}

export interface BuildAtlasRuntimeSnapshotOptions {
  stateDir: string;
  session: AtlasDesktopSessionRecord | null;
}

interface RuntimeSnapshotContext {
  buildRequest: AtlasBuildRequestRecord | null;
  pipeline: AtlasRuntimePipelineSnapshot;
  openSessions: AtlasSessionDto[];
  missionArtifacts: AtlasMissionArtifactSnapshot | null;
  runtimeRunning: boolean;
}

interface AtlasAgentLogSnapshot {
  lines: string[];
  updatedAt: string | null;
}

interface AtlasRuntimeNodeFallback {
  state: AtlasRuntimeAgentState;
  summary: string;
  detailBody: string;
  metrics: AtlasRuntimeAgentMetric[];
  logLines: string[];
}

interface AtlasMissionArtifactSnapshot {
  sessionStateDir: string | null;
  jesusDirectiveExists: boolean;
  researchScoutExists: boolean;
  researchSynthesisExists: boolean;
  prometheusPlanCount: number;
  athenaApproved: boolean | null;
  athenaSummary: string | null;
  dispatchStatus: string | null;
  dispatchUpdatedAt: string | null;
  totalPlans: number;
  completedPlans: number;
  workerCycleStatus: string | null;
  workerCount: number;
  activeWorkerCount: number;
  blockedWorkerCount: number;
  doneWorkerCount: number;
  completionStage: string | null;
  completionFinalStatus: string | null;
  completionSummary: string | null;
  workerLogLines: string[];
  agentLogs: Partial<Record<Exclude<AtlasRuntimeAgentId, "worker" | "done">, AtlasAgentLogSnapshot>>;
}

interface AtlasCliLaunchSpec {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

interface RootBoxCliLaunchSpec extends AtlasCliLaunchSpec {
  cwd: string;
  runtimeStateDir: string;
}

export interface AtlasResolvedProjectBinding {
  projectId: string;
  projectSessionId: string;
  projectWorkspacePath: string | null;
  updatedAt: string | null;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function uniquePaths(paths: Array<string | null>): string[] {
  return [...new Set(paths.filter((entry): entry is string => Boolean(entry && entry.trim())))];
}

function resolvePackagedAppRootCandidates(rootDir: string): string[] {
  const resourcesAppRoot = typeof process.resourcesPath === "string" && process.resourcesPath.trim()
    ? path.join(process.resourcesPath, "app.asar")
    : null;
  const executableAppRoot = process.execPath
    ? path.join(path.dirname(process.execPath), "resources", "app.asar")
    : null;
  const extractedAppRoot = path.join(rootDir, "resources", "app.asar");

  return uniquePaths([resourcesAppRoot, executableAppRoot, extractedAppRoot]);
}

async function resolvePackagedRootBoxCliLaunchSpec(
  rootDir: string,
  runtimeStateDir: string,
  env: NodeJS.ProcessEnv,
): Promise<RootBoxCliLaunchSpec | null> {
  for (const packagedAppRoot of resolvePackagedAppRootCandidates(rootDir)) {
    if (!await pathExists(packagedAppRoot)) {
      continue;
    }

    const packagedCompiledCliPath = path.join(packagedAppRoot, "src", "cli.js");
    if (await pathExists(packagedCompiledCliPath)) {
      return {
        command: process.execPath,
        args: [packagedCompiledCliPath],
        env,
        cwd: rootDir,
        runtimeStateDir,
      };
    }

    const packagedSourceCliPath = path.join(packagedAppRoot, "src", "cli.ts");
    const packagedTsxLoaderPath = path.join(packagedAppRoot, "node_modules", "tsx", "dist", "loader.mjs");
    return {
      command: process.execPath,
      args: ["--import", pathToFileURL(packagedTsxLoaderPath).href, packagedSourceCliPath],
      env,
      cwd: rootDir,
      runtimeStateDir,
    };
  }

  return null;
}

export async function resolveRootBoxCliLaunchSpec(stateDir: string): Promise<RootBoxCliLaunchSpec> {
  const runtimeStateDir = await resolveAtlasRuntimeStateDir(stateDir);
  const rootDir = path.dirname(runtimeStateDir);
  const compiledCliPath = path.join(rootDir, "src", "cli.js");
  const env = { ...process.env };

  if (typeof process.versions.electron === "string" && !env.ELECTRON_RUN_AS_NODE) {
    env.ELECTRON_RUN_AS_NODE = "1";
  }

  if (await pathExists(compiledCliPath)) {
    return {
      command: process.execPath,
      args: [compiledCliPath],
      env,
      cwd: rootDir,
      runtimeStateDir,
    };
  }

  const packagedLaunchSpec = await resolvePackagedRootBoxCliLaunchSpec(rootDir, runtimeStateDir, env);
  if (packagedLaunchSpec) {
    return packagedLaunchSpec;
  }

  const sourceCliPath = path.join(rootDir, "src", "cli.ts");
  if (await pathExists(sourceCliPath)) {
    return {
      command: process.execPath,
      args: ["--import", "tsx", sourceCliPath],
      env,
      cwd: rootDir,
      runtimeStateDir,
    };
  }

  throw new Error(`ATLAS could not resolve the root BOX CLI in ${rootDir}.`);
}

export function buildAtlasDaemonStartArgs(
  baseArgs: string[],
  selection: { sessionId?: string | null; projectId?: string | null },
): string[] {
  const args = [...baseArgs, "start"];
  const sessionId = normalizeOptionalString(selection.sessionId);
  const projectId = normalizeOptionalString(selection.projectId);
  if (!sessionId) {
    return args;
  }
  args.push("--session", sessionId);
  if (projectId) {
    args.push("--project", projectId);
  }
  return args;
}

function formatCliFailure(purpose: string, status: number | null, stdout: string, stderr: string): string {
  const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
  const compact = details.replace(/\s+/g, " ").trim();
  return compact
    ? `${purpose} failed (${String(status ?? "unknown")}): ${compact.slice(0, 400)}`
    : `${purpose} failed (${String(status ?? "unknown")}).`;
}

async function runRootBoxCliCommand(stateDir: string, cliArgs: string[], purpose: string): Promise<RootBoxCliLaunchSpec> {
  const launchSpec = await resolveRootBoxCliLaunchSpec(stateDir);
  const result = spawnSync(launchSpec.command, [...launchSpec.args, ...cliArgs], {
    cwd: launchSpec.cwd,
    env: launchSpec.env,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(formatCliFailure(purpose, result.status, result.stdout || "", result.stderr || ""));
  }

  return launchSpec;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeUniqueStringList(values: Array<unknown>): string[] {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function extractAtlasDesktopSessionIdFromNotes(notes: unknown): string | null {
  if (!Array.isArray(notes)) {
    return null;
  }

  for (const note of notes) {
    const match = /^ATLAS desktop session id:\s*(.+)$/i.exec(String(note || "").trim());
    if (match?.[1]) {
      return match[1].trim() || null;
    }
  }

  return null;
}

function normalizeComparableText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildAtlasTargetRepoUrl(session: AtlasDesktopSessionRecord): string | null {
  const repoFullName = normalizeOptionalString(session.repoContext?.targetRepo);
  if (!repoFullName) {
    return null;
  }

  if (session.repoContext?.provider === "github") {
    const normalizedFullName = repoFullName
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "");
    return `https://github.com/${normalizedFullName}.git`;
  }

  return null;
}

function buildAtlasAcceptanceCriteria(session: AtlasDesktopSessionRecord): string[] {
  const summary = normalizeOptionalString(session.summary) || session.objective;
  const operatorIntentEvidence = buildAtlasOperatorIntentEvidence(session);
  return normalizeUniqueStringList([
    summary ? `Deliver the clarified ATLAS mission: ${summary}` : null,
    ...operatorIntentEvidence.slice(0, 3),
    ...session.executionNotes.slice(0, 4),
    ...session.attachmentPlans.slice(0, 2).map((plan) => `Use ${plan.attachmentName} from ${plan.storedRelativePath} as directed.`),
  ]).slice(0, 8);
}

function buildAtlasOperatorIntentBrief(session: AtlasDesktopSessionRecord): string {
  const explicitBrief = normalizeOptionalString(session.operatorIntentBrief);
  if (explicitBrief) {
    return explicitBrief;
  }

  return normalizeUniqueStringList([
    normalizeOptionalString(session.summary) || session.objective,
    ...buildAtlasOperatorIntentEvidence(session),
    ...session.executionNotes,
  ]).join("\n").trim();
}

function buildAtlasOperatorIntentEvidence(session: AtlasDesktopSessionRecord): string[] {
  const rawUserEvidence = deriveAtlasOperatorIntentEvidence({
    objective: session.objective,
    summary: session.summary,
    executionNotes: session.executionNotes,
    messages: session.messages,
  }).map((entry) => `Operator message: ${entry}`);

  const clarificationEvidence = Array.isArray(session.clarificationAnswers)
    ? session.clarificationAnswers
        .map((entry) => {
          const question = normalizeOptionalString(entry?.question)?.replace(/\?+$/g, "").trim();
          const answer = normalizeOptionalString(entry?.answer);
          if (!question || !answer) {
            return null;
          }
          return `Confirmed operator answer: ${question}: ${answer}`;
        })
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return normalizeUniqueStringList([
    ...clarificationEvidence,
    ...rawUserEvidence,
  ]).slice(0, 8);
}

function createResolvedProjectBinding(
  projectId: string | null,
  projectSessionId: string | null,
  projectWorkspacePath: string | null,
  updatedAt: string | null,
): AtlasResolvedProjectBinding | null {
  if (!projectId || !projectSessionId) {
    return null;
  }
  return {
    projectId,
    projectSessionId,
    projectWorkspacePath,
    updatedAt,
  };
}

function buildProjectSessionStateDir(runtimeStateDir: string, binding: AtlasResolvedProjectBinding): string {
  return path.join(runtimeStateDir, "projects", binding.projectId, binding.projectSessionId);
}

async function _bindingPointsToTargetSession(runtimeStateDir: string, binding: AtlasResolvedProjectBinding): Promise<boolean> {
  return pathExists(path.join(buildProjectSessionStateDir(runtimeStateDir, binding), "target_session.json"));
}

async function readActiveTargetSessionBinding(runtimeStateDir: string): Promise<AtlasResolvedProjectBinding | null> {
  const activeTargetSession = await readJsonObject(path.join(runtimeStateDir, "active_target_session.json"));
  return createResolvedProjectBinding(
    normalizeOptionalString(activeTargetSession?.projectId),
    normalizeOptionalString(activeTargetSession?.sessionId),
    normalizeOptionalString(activeTargetSession?.workspace && isRecord(activeTargetSession.workspace)
      ? activeTargetSession.workspace.path
      : null),
    normalizeOptionalString(activeTargetSession?.lifecycle && isRecord(activeTargetSession.lifecycle)
      ? activeTargetSession.lifecycle.updatedAt
      : activeTargetSession?.updatedAt),
  );
}

function targetSessionMatchesAtlasMission(
  session: AtlasDesktopSessionRecord,
  targetSession: Record<string, unknown> | null,
): boolean {
  if (!targetSession) {
    return false;
  }

  const candidateRepo = targetSession.repo && isRecord(targetSession.repo)
    ? targetSession.repo
    : null;
  const candidateRepoUrl = normalizeComparableText(candidateRepo?.repoUrl).replace(/\.git$/i, "");
  const candidateRepoFullName = normalizeComparableText(candidateRepo?.repoFullName)
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "");
  const sessionRepoUrl = normalizeComparableText(buildAtlasTargetRepoUrl(session)).replace(/\.git$/i, "");
  const sessionRepoFullName = normalizeComparableText(session.repoContext?.targetRepo)
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "");
  const candidateAtlasSessionId = extractAtlasDesktopSessionIdFromNotes(
    targetSession.hints && isRecord(targetSession.hints)
      ? targetSession.hints.notes
      : null,
  );

  if (candidateAtlasSessionId) {
    return candidateAtlasSessionId === session.id;
  }

  if (sessionRepoUrl && candidateRepoUrl && sessionRepoUrl === candidateRepoUrl) {
    return true;
  }

  if (sessionRepoFullName && candidateRepoFullName && sessionRepoFullName === candidateRepoFullName) {
    return true;
  }

  return false;
}
function targetSessionCarriesMissionIdentity(targetSession: Record<string, unknown> | null): boolean {
  if (!targetSession) {
    return false;
  }

  const candidateRepo = targetSession.repo && isRecord(targetSession.repo)
    ? targetSession.repo
    : null;
  const candidateRepoUrl = normalizeComparableText(candidateRepo?.repoUrl).replace(/\.git$/i, "");
  const candidateRepoFullName = normalizeComparableText(candidateRepo?.repoFullName)
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "");
  const candidateAtlasSessionId = extractAtlasDesktopSessionIdFromNotes(
    targetSession.hints && isRecord(targetSession.hints)
      ? targetSession.hints.notes
      : null,
  );

  return Boolean(candidateAtlasSessionId || candidateRepoUrl || candidateRepoFullName);
}

function targetSessionExplicitlyMatchesAtlasSession(
  session: AtlasDesktopSessionRecord,
  targetSession: Record<string, unknown> | null,
): boolean {
  if (!targetSession) {
    return false;
  }

  const candidateAtlasSessionId = extractAtlasDesktopSessionIdFromNotes(
    targetSession.hints && isRecord(targetSession.hints)
      ? targetSession.hints.notes
      : null,
  );

  return candidateAtlasSessionId === session.id;
}

async function readMatchingTargetSessionRecord(
  runtimeStateDir: string,
  session: AtlasDesktopSessionRecord,
  binding: AtlasResolvedProjectBinding,
): Promise<Record<string, unknown> | null> {
  const targetSession = await readJsonObject(
    path.join(runtimeStateDir, "projects", binding.projectId, binding.projectSessionId, "target_session.json"),
  );
  if (targetSessionMatchesAtlasMission(session, targetSession)) {
    return targetSession;
  }

  return targetSession && !targetSessionCarriesMissionIdentity(targetSession)
    ? targetSession
    : null;
}

function scoreProjectBindingCandidate(
  session: AtlasDesktopSessionRecord,
  candidateRepoUrl: string | null,
  candidateObjective: string | null,
  candidateUpdatedAt: string | null,
  candidateAtlasSessionId: string | null,
): number {
  let score = 0;
  let hasIdentitySignal = false;
  if (candidateAtlasSessionId && candidateAtlasSessionId === session.id) {
    score += 100;
    hasIdentitySignal = true;
  }

  const sessionRepoUrl = normalizeComparableText(buildAtlasTargetRepoUrl(session)).replace(/\.git$/i, "");
  const normalizedCandidateRepoUrl = normalizeComparableText(candidateRepoUrl).replace(/\.git$/i, "");
  if (sessionRepoUrl && normalizedCandidateRepoUrl && sessionRepoUrl === normalizedCandidateRepoUrl) {
    score += 12;
    hasIdentitySignal = true;
  }

  const sessionObjective = normalizeComparableText(normalizeOptionalString(session.summary) || session.objective);
  const normalizedCandidateObjective = normalizeComparableText(candidateObjective);
  if (sessionObjective && normalizedCandidateObjective) {
    if (sessionObjective.includes(normalizedCandidateObjective) || normalizedCandidateObjective.includes(sessionObjective)) {
      score += 6;
      hasIdentitySignal = true;
    }
  }

  if (hasIdentitySignal) {
    const sessionUpdatedAtMs = Date.parse(session.updatedAt || session.createdAt);
    const candidateUpdatedAtMs = candidateUpdatedAt ? Date.parse(candidateUpdatedAt) : Number.NaN;
    if (Number.isFinite(sessionUpdatedAtMs) && Number.isFinite(candidateUpdatedAtMs)) {
      const diffMs = Math.abs(candidateUpdatedAtMs - sessionUpdatedAtMs);
      if (diffMs <= 30 * 60 * 1000) {
        score += 3;
      } else if (diffMs <= 6 * 60 * 60 * 1000) {
        score += 1;
      }
    }
  }

  return score;
}

export async function resolveAtlasProjectBindingForSession(
  stateDir: string,
  session: AtlasDesktopSessionRecord,
  buildRequest: AtlasBuildRequestRecord | null,
  options: { allowHeuristicMatch?: boolean } = {},
): Promise<AtlasResolvedProjectBinding | null> {
  const runtimeStateDir = await resolveAtlasRuntimeStateDir(stateDir);
  const allowHeuristicMatch = options.allowHeuristicMatch !== false;
  const directCandidates = [
    createResolvedProjectBinding(
      normalizeOptionalString(session.projectId),
      normalizeOptionalString(session.projectSessionId),
      normalizeOptionalString(session.projectWorkspacePath),
      normalizeOptionalString(session.updatedAt),
    ),
    buildRequest?.sessionId === session.id
      ? createResolvedProjectBinding(
          buildRequest.projectId,
          buildRequest.projectSessionId,
          buildRequest.projectWorkspacePath,
          buildRequest.updatedAt,
        )
      : null,
  ].filter((candidate): candidate is AtlasResolvedProjectBinding => candidate !== null);

  for (const candidate of directCandidates) {
    if (await readMatchingTargetSessionRecord(runtimeStateDir, session, candidate)) {
      return candidate;
    }
  }

  const activeTargetBinding = await readActiveTargetSessionBinding(runtimeStateDir);
  if (
    activeTargetBinding
    && !directCandidates.some((candidate) => (
      candidate.projectId === activeTargetBinding.projectId
      && candidate.projectSessionId === activeTargetBinding.projectSessionId
    ))
  ) {
    const activeTargetSession = await readJsonObject(
      path.join(runtimeStateDir, "projects", activeTargetBinding.projectId, activeTargetBinding.projectSessionId, "target_session.json"),
    );
    if (targetSessionExplicitlyMatchesAtlasSession(session, activeTargetSession)) {
      return activeTargetBinding;
    }
  }

  if (!allowHeuristicMatch) {
    return null;
  }

  const rawRegistry = await readJsonValue(path.join(runtimeStateDir, "open_target_sessions.json"));
  const registryEntries = Array.isArray(rawRegistry) ? rawRegistry : [];
  const scoredCandidates = registryEntries.flatMap((rawEntry) => {
    if (!isRecord(rawEntry)) {
      return [] as Array<{ binding: AtlasResolvedProjectBinding; score: number }>;
    }

    const binding = createResolvedProjectBinding(
      normalizeOptionalString(rawEntry.projectId),
      normalizeOptionalString(rawEntry.sessionId),
      normalizeOptionalString(rawEntry.workspacePath),
      normalizeOptionalString(rawEntry.updatedAt),
    );
    if (!binding) {
      return [] as Array<{ binding: AtlasResolvedProjectBinding; score: number }>;
    }

    const score = scoreProjectBindingCandidate(
      session,
      normalizeOptionalString(rawEntry.repoUrl),
      normalizeOptionalString(rawEntry.objectiveSummary),
      normalizeOptionalString(rawEntry.updatedAt),
      normalizeOptionalString(rawEntry.atlasDesktopSessionId),
    );
    return score > 0 ? [{ binding, score }] : [];
  }).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return Date.parse(right.binding.updatedAt || "") - Date.parse(left.binding.updatedAt || "");
  });

  for (const candidate of scoredCandidates) {
    if (await readMatchingTargetSessionRecord(runtimeStateDir, session, candidate.binding)) {
      return candidate.binding;
    }
  }

  return null;
}

function buildSessionScopedBuildRequest(
  session: AtlasDesktopSessionRecord,
  buildRequest: AtlasBuildRequestRecord | null,
  binding: AtlasResolvedProjectBinding | null,
): AtlasBuildRequestRecord {
  if (buildRequest?.sessionId === session.id) {
    return buildRequest;
  }

  return {
    sessionId: session.id,
    projectId: binding?.projectId || null,
    projectSessionId: binding?.projectSessionId || null,
    projectWorkspacePath: binding?.projectWorkspacePath || null,
    title: session.title,
    objective: session.objective,
    summary: session.summary || session.objective,
    targetRepo: session.repoContext?.targetRepo || null,
    targetBaseBranch: session.repoContext?.targetBaseBranch || null,
    repoMode: session.repoContext?.repoMode || null,
    repoCreatedByAtlas: session.repoContext?.repoCreatedByAtlas === true,
    requestedAt: session.updatedAt || session.createdAt,
    updatedAt: binding?.updatedAt || session.updatedAt || session.createdAt,
    triggerMode: "watching",
    triggerState: "queued",
    triggerLabel: binding
      ? "This session is mapped to a canonical BOX target session. Resume it to make it the live build mission."
      : "Resume this session to attach a live BOX mission.",
    runnerPid: null,
    lastError: null,
    planningPrompt: buildAtlasPlanningPrompt({
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      operatorIntentBrief: session.operatorIntentBrief,
      targetRepo: session.repoContext?.targetRepo || null,
      repoMode: session.repoContext?.repoMode || null,
      executionNotes: session.executionNotes,
      messages: session.messages,
      attachmentPlans: session.attachmentPlans,
    }),
    appliedAt: null,
  };
}

function buildAtlasTargetManifest(session: AtlasDesktopSessionRecord): Record<string, unknown> {
  const repoUrl = buildAtlasTargetRepoUrl(session);
  if (!repoUrl) {
    throw new Error("ATLAS session is missing a valid GitHub target repository.");
  }

  const summary = normalizeOptionalString(session.summary) || session.objective;
  const operatorIntentBrief = buildAtlasOperatorIntentBrief(session);
  const operatorIntentEvidence = buildAtlasOperatorIntentEvidence(session);
  return {
    mode: "single_target_delivery",
    requestId: `atlas_${session.id}_${Date.now()}`,
    target: {
      repoUrl,
      defaultBranch: normalizeOptionalString(session.repoContext?.targetBaseBranch) || "main",
      provider: session.repoContext?.provider || "github",
      repoFullName: normalizeOptionalString(session.repoContext?.targetRepo),
      repoCreatedByBox: session.repoContext?.repoCreatedByAtlas === true,
      deleteOnCancel: session.repoContext?.repoCreatedByAtlas === true,
    },
    objective: {
      summary,
      desiredOutcome: normalizeOptionalString(session.projectDescription) || summary,
      acceptanceCriteria: buildAtlasAcceptanceCriteria(session),
    },
    constraints: {
      protectedPaths: [],
      forbiddenActions: [],
    },
    operator: {
      requestedBy: "atlas_desktop",
      approvalMode: "human_required_for_high_risk",
    },
    operatorIntentBrief,
    notes: normalizeUniqueStringList([
      `ATLAS desktop session id: ${session.id}`,
      session.projectName ? `Project name: ${session.projectName}` : null,
      session.projectDescription ? `Project description: ${session.projectDescription}` : null,
      operatorIntentBrief ? `Operator intent brief: ${operatorIntentBrief}` : null,
      ...operatorIntentEvidence,
      ...session.executionNotes,
      ...session.attachmentPlans.map((plan) => `${plan.attachmentName}: ${plan.intendedUse} (${plan.storedRelativePath})`),
    ]).slice(0, 12),
  };
}

function buildAtlasTargetIntentContractArtifact(
  session: AtlasDesktopSessionRecord,
  projectId: string,
  projectSessionId: string,
  now: string,
): Record<string, unknown> {
  const summary = normalizeOptionalString(session.summary) || session.objective;
  const acceptanceCriteria = buildAtlasAcceptanceCriteria(session);
  const operatorIntentBrief = buildAtlasOperatorIntentBrief(session);
  const operatorIntentEvidence = buildAtlasOperatorIntentEvidence(session);
  const implementationFlexibility = deriveAtlasImplementationFlexibility({
    objective: session.objective,
    summary,
    executionNotes: session.executionNotes,
    messages: session.messages,
  });
  const derivedAssetSignals = deriveAtlasAssetSignals({
    objective: session.objective,
    summary,
    executionNotes: session.executionNotes,
    messages: session.messages,
  });
  const assetRequirements = normalizeUniqueStringList([
    ...session.attachmentPlans.map((plan) => `Use ${plan.attachmentName} from ${plan.storedRelativePath} as directed. ${plan.intendedUse}`),
    ...derivedAssetSignals.assetRequirements,
  ]).slice(0, 8);

  return {
    schemaVersion: 1,
    projectId,
    sessionId: projectSessionId,
    status: TARGET_INTENT_STATUS.READY_FOR_PLANNING,
    objectiveSummary: summary,
    desiredOutcome: normalizeOptionalString(session.projectDescription) || summary,
    deliveryModeDecision: {
      recommendation: "active",
      reason: "atlas_desktop_ready_session",
    },
    readyForPlanning: true,
    planningMode: "active",
    clarifiedIntent: {
      productType: normalizeOptionalString(session.projectName) || normalizeOptionalString(session.title),
      operatorIntentBrief,
      targetUsers: [],
      mustHaveFlows: [],
      scopeIn: normalizeUniqueStringList([
        summary,
        ...operatorIntentEvidence,
        ...session.executionNotes,
      ]).slice(0, 12),
      scopeOut: [],
      protectedAreas: [],
      preferredQualityBar: "Honor the ATLAS session brief without downgrading scope, fidelity, or confirmed assets.",
      designDirection: normalizeOptionalString(session.projectDescription),
      deploymentExpectations: [],
      successCriteria: acceptanceCriteria,
      implementationFlexibility,
      operatorIntentEvidence,
      assetSourcingPolicy: session.attachmentPlans.length > 0
        ? "Use operator-confirmed attachments and explicitly requested real-world sources as source requirements."
        : derivedAssetSignals.assetSourcingPolicy
          || "Preserve explicitly requested real-world sources instead of replacing them with placeholders.",
      assetRequirements,
    },
    assumptions: [],
    openQuestions: [],
    resolvedPacket: {
      source: "atlas_desktop",
      sessionId: session.id,
      summary,
      operatorIntentBrief,
      executionNotes: session.executionNotes,
      operatorIntentEvidence,
      attachmentPlans: session.attachmentPlans,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function buildAtlasTargetClarificationPacketArtifact(
  session: AtlasDesktopSessionRecord,
  projectId: string,
  projectSessionId: string,
  now: string,
  intentContract: Record<string, unknown>,
): Record<string, unknown> {
  const summary = normalizeOptionalString(session.summary) || session.objective;
  const operatorIntentBrief = buildAtlasOperatorIntentBrief(session);

  return {
    schemaVersion: 1,
    projectId,
    sessionId: projectSessionId,
    status: TARGET_INTENT_STATUS.READY_FOR_PLANNING,
    readyForPlanning: true,
    conversationComplete: true,
    planningMode: "active",
    selectedAgentSlug: "atlas_desktop",
    repoState: session.repoContext?.repoMode || "unknown",
    summary,
    operatorIntentBrief,
    understanding: summary,
    assumptions: [],
    questions: [],
    clarifiedIntent: intentContract.clarifiedIntent,
    createdAt: now,
    updatedAt: now,
  };
}

export async function persistAtlasTargetHandoffArtifacts(
  runtimeStateDir: string,
  session: AtlasDesktopSessionRecord,
  binding: { projectId: string; sessionId: string },
): Promise<{ clarificationPacketPath: string; intentContractPath: string; }> {
  const now = new Date().toISOString();
  const intentContract = buildAtlasTargetIntentContractArtifact(session, binding.projectId, binding.sessionId, now);
  const clarificationPacket = buildAtlasTargetClarificationPacketArtifact(session, binding.projectId, binding.sessionId, now, intentContract);
  const clarificationPacketPath = getTargetClarificationPacketPath(runtimeStateDir, binding.projectId, binding.sessionId);
  const intentContractPath = getTargetIntentContractPath(runtimeStateDir, binding.projectId, binding.sessionId);

  await fs.mkdir(path.dirname(clarificationPacketPath), { recursive: true });
  await Promise.all([
    fs.writeFile(clarificationPacketPath, `${JSON.stringify(clarificationPacket, null, 2)}\n`, "utf8"),
    fs.writeFile(intentContractPath, `${JSON.stringify(intentContract, null, 2)}\n`, "utf8"),
  ]);

  return {
    clarificationPacketPath,
    intentContractPath,
  };
}

async function writeAtlasTargetManifestFile(stateDir: string, session: AtlasDesktopSessionRecord): Promise<string> {
  const manifestDir = path.join(stateDir, "atlas", "manifests");
  await fs.mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `${session.id}-target-start.json`);
  await fs.writeFile(manifestPath, `${JSON.stringify(buildAtlasTargetManifest(session), null, 2)}\n`, "utf8");
  return manifestPath;
}

async function ensureAtlasProjectSession(
  stateDir: string,
  session: AtlasDesktopSessionRecord,
  buildRequest: AtlasBuildRequestRecord | null,
): Promise<{ config: Record<string, unknown>; targetSession: Record<string, unknown>; }> {
  const runtimeStateDir = await resolveAtlasRuntimeStateDir(stateDir);
  const config = applyAtlasRuntimeStateDirToConfig(await loadConfig(), runtimeStateDir) as Record<string, unknown>;
  const repoUrl = buildAtlasTargetRepoUrl(session)?.toLowerCase() || null;
  const repoFullName = String(session.repoContext?.targetRepo || "").trim().toLowerCase();

  const readTargetSessionRecord = async (projectId: string | null, sessionId: string | null): Promise<Record<string, unknown> | null> => {
    if (!projectId || !sessionId) {
      return null;
    }
    return readJsonObject(path.join(runtimeStateDir, "projects", projectId, sessionId, "target_session.json"));
  };

  const findMatchingTargetSession = async (): Promise<Record<string, unknown> | null> => {
    const directMatch = buildRequest?.sessionId === session.id
      ? await readTargetSessionRecord(buildRequest.projectId || null, buildRequest.projectSessionId || null)
      : null;
    if (targetSessionMatchesAtlasMission(session, directMatch)) {
      return directMatch;
    }

    try {
      const rawRegistry = JSON.parse(await fs.readFile(path.join(runtimeStateDir, "open_target_sessions.json"), "utf8")) as unknown;
      const registryEntries = Array.isArray(rawRegistry) ? rawRegistry : [];
      const matches: Record<string, unknown>[] = [];

      for (const rawEntry of registryEntries) {
        if (!isRecord(rawEntry)) {
          continue;
        }
        const projectId = normalizeOptionalString(rawEntry.projectId);
        const sessionId = normalizeOptionalString(rawEntry.sessionId);
        const candidate = await readTargetSessionRecord(projectId, sessionId);
        if (!candidate) {
          continue;
        }

        const candidateRepoUrl = String(candidate?.repo && isRecord(candidate.repo) ? candidate.repo.repoUrl || "" : "").trim().toLowerCase();
        const candidateRepoFullName = String(candidate?.repo && isRecord(candidate.repo) ? candidate.repo.repoFullName || "" : "").trim().toLowerCase();
        const candidateAtlasSessionId = extractAtlasDesktopSessionIdFromNotes(candidate?.hints && isRecord(candidate.hints) ? candidate.hints.notes : null);
        if ((repoUrl && candidateRepoUrl === repoUrl) || (repoFullName && candidateRepoFullName === repoFullName)) {
          if (candidateAtlasSessionId && candidateAtlasSessionId !== session.id) {
            continue;
          }
          matches.push(candidate);
        }
      }

      matches.sort((left, right) => {
        const leftAtlasSessionId = extractAtlasDesktopSessionIdFromNotes(left?.hints && isRecord(left.hints) ? left.hints.notes : null);
        const rightAtlasSessionId = extractAtlasDesktopSessionIdFromNotes(right?.hints && isRecord(right.hints) ? right.hints.notes : null);
        const leftExact = leftAtlasSessionId === session.id;
        const rightExact = rightAtlasSessionId === session.id;
        if (leftExact !== rightExact) {
          return rightExact ? 1 : -1;
        }

        const leftUpdatedAt = Date.parse(String(left?.lifecycle && isRecord(left.lifecycle) ? left.lifecycle.updatedAt || left.lifecycle.openedAt || 0 : 0));
        const rightUpdatedAt = Date.parse(String(right?.lifecycle && isRecord(right.lifecycle) ? right.lifecycle.updatedAt || right.lifecycle.openedAt || 0 : 0));
        return rightUpdatedAt - leftUpdatedAt;
      });
      return matches[0] || null;
    } catch {
      return null;
    }
  };

  let targetSession = await findMatchingTargetSession();
  if (!targetSession) {
    const manifestPath = await writeAtlasTargetManifestFile(stateDir, session);
    try {
      await runRootBoxCliCommand(stateDir, ["target", "start", "--manifest", manifestPath, "--select"], "ATLAS target start");
    } catch (error) {
      const message = String((error as Error)?.message || error);
      if (!/already exists/i.test(message)) {
        throw error;
      }
    }
    targetSession = await findMatchingTargetSession();
  }

  if (!targetSession) {
    throw new Error("ATLAS could not resolve the canonical BOX target session for this mission.");
  }

  const projectId = normalizeOptionalString(targetSession.projectId);
  const projectSessionId = normalizeOptionalString(targetSession.sessionId);
  if (!projectId || !projectSessionId) {
    throw new Error("Canonical BOX target session is missing projectId or sessionId.");
  }

  await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
    projectId,
    sessionId: projectSessionId,
  });
  await runRootBoxCliCommand(stateDir, ["target", "select", "--session", projectSessionId, "--project", projectId], "ATLAS target select");
  await runRootBoxCliCommand(
    stateDir,
    ["target", "stage", "--to", "active", "--reason", "atlas_ready_session_handoff", "--next-action", "run_active_planning"],
    "ATLAS target activation",
  );

  const updatedTargetSession = await readTargetSessionRecord(projectId, projectSessionId);
  if (!updatedTargetSession) {
    throw new Error("ATLAS activated the target session but could not reload its persisted state.");
  }

  return { config, targetSession: updatedTargetSession };
}

function sanitizeLogLine(line: string): string {
  return String(line || "")
    // eslint-disable-next-line no-control-regex -- strip ANSI escape sequences
    .replace(/\u001B\[[0-9;]*m/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SESSION_PROGRESS_AGENT_PATTERNS: Record<Exclude<AtlasRuntimeAgentId, "worker" | "done">, RegExp[]> = {
  jesus: [/\[JESUS(?:\]|\[)/i, /\[AGENT\].*\[\s*JESUS\s*\]/i, /\[CYCLE\].*Jesus/i],
  research_scout: [/\[RESEARCH_SCOUT\]/i, /\[SCOUT\]/i],
  research_synthesizer: [/\[RESEARCH_SYNTHESIZER\]/i, /\[SYNTHESIZER\]/i],
  prometheus: [/\[PROMETHEUS(?:\]|\[)/i, /\[AGENT\].*PROMETHEUS/i, /\[CYCLE\].*Prometheus/i],
  athena: [/\[ATHENA(?:\]|\[)/i, /\[AGENT\].*ATHENA/i, /\[CYCLE\].*Athena/i],
};

function isRecentTimestamp(timestamp: string | null, windowMs = 5 * 60 * 1000): boolean {
  if (!timestamp) return false;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && (Date.now() - parsed) <= windowMs;
}

function normalizeArtifactStatus(value: unknown): AtlasRuntimeAgentState {
  const normalized = String(value || "idle").trim().toLowerCase();
  if (["working", "running"].includes(normalized)) return "active";
  if (["blocked", "error", "failed"].includes(normalized)) return "error";
  if (["done", "completed", "success"].includes(normalized)) return "done";
  if (["partial", "queued", "dispatching", "recovered"].includes(normalized)) return "queued";
  return "idle";
}

function isPipelineActive(pipeline: AtlasRuntimePipelineSnapshot): boolean {
  return Boolean(
    pipeline.startedAt
      && pipeline.stage !== "idle"
      && pipeline.stage !== "cycle_complete",
  );
}

function getTriggerStateLabel(state: AtlasBuildTriggerState): string {
  switch (state) {
    case "running": return "Build running";
    case "paused": return "Build paused";
    case "completed": return "Build complete";
    case "error": return "Needs attention";
    case "queued":
    default:
      return "Queued";
  }
}

function getAgentStateLabel(state: AtlasRuntimeAgentState): string {
  switch (state) {
    case "active": return "Live";
    case "done": return "Done";
    case "error": return "Needs attention";
    case "queued": return "Queued";
    case "idle":
    default:
      return "Standby";
  }
}

function toSentenceCase(value: string): string {
  const compact = String(value || "").trim();
  if (!compact) return "";
  return compact.charAt(0).toUpperCase() + compact.slice(1);
}

function toTitleCase(value: string): string {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function formatPipelineSnapshot(raw: Record<string, unknown>): AtlasRuntimePipelineSnapshot {
  return {
    stage: String(raw.stage || "idle").trim() || "idle",
    stageLabel: String(raw.stageLabel || "Idle").trim() || "Idle",
    percent: typeof raw.percent === "number" && Number.isFinite(raw.percent) ? raw.percent : 0,
    detail: String(raw.detail || "System ready").trim() || "System ready",
    loopCount: Number.isFinite(Number(raw.loopCount)) ? Math.max(0, Number(raw.loopCount)) : 0,
    updatedAt: normalizeOptionalString(raw.updatedAt),
    startedAt: normalizeOptionalString(raw.startedAt),
    completedAt: normalizeOptionalString(raw.completedAt),
  };
}

function mapSessionToAgentState(session: AtlasSessionDto | null): AtlasRuntimeAgentState {
  if (!session) return "idle";
  if (session.status === "blocked" || session.status === "error") return "error";
  if (session.status === "working") return "active";
  if (session.status === "done") return "done";
  if (session.status === "partial") return "queued";
  return "idle";
}

function pickPrimaryLogLines(session: AtlasSessionDto | null, fallback: string | null = null): string[] {
  const lines = session?.logExcerpt?.slice(0, 6) || [];
  if (lines.length > 0) {
    return lines;
  }
  return fallback ? [fallback] : [];
}

function matchesSessionRole(session: AtlasSessionDto, aliases: string[]): boolean {
  const normalizedAliases = aliases.map((value) => normalizeWorkerName(value));
  return [session.role, session.resolvedRole, session.logicalRole]
    .map((value) => normalizeWorkerName(String(value || "")))
    .some((value) => normalizedAliases.includes(value));
}

function getPrimarySession(sessions: AtlasSessionDto[], aliases: string[]): AtlasSessionDto | null {
  return sessions.find((session) => matchesSessionRole(session, aliases)) || null;
}

function getWorkerSessions(sessions: AtlasSessionDto[]): AtlasSessionDto[] {
  return sessions.filter((session) => {
    const normalizedRole = normalizeWorkerName(session.role);
    return normalizedRole.endsWith("-worker") || session.lane === "worker";
  });
}

function getPipelineStateFromProgress(pipeline: AtlasRuntimePipelineSnapshot, prefix: string): AtlasRuntimeAgentState {
  if (pipeline.stage.startsWith(prefix)) {
    return "active";
  }

  if (!pipeline.startedAt) {
    return "idle";
  }

  const orderedPrefixes = ["jesus_", "research_scout", "research_synthesis", "prometheus_", "athena_", "workers_"];
  const stageIndex = orderedPrefixes.findIndex((entry) => pipeline.stage.startsWith(entry));
  const prefixIndex = orderedPrefixes.findIndex((entry) => prefix.startsWith(entry.slice(0, -1)) || entry === prefix);
  if (stageIndex > -1 && prefixIndex > -1 && stageIndex > prefixIndex) {
    return "done";
  }

  return "idle";
}

function getPipelineNodeState(pipeline: AtlasRuntimePipelineSnapshot, prefix: string, session: AtlasSessionDto | null): AtlasRuntimeAgentState {
  if (session) {
    return mapSessionToAgentState(session);
  }

  return getPipelineStateFromProgress(pipeline, prefix);
}

function resolveLeadershipFallbackState(
  pipeline: AtlasRuntimePipelineSnapshot,
  prefix: string,
  hasEvidence: boolean,
  evidenceUpdatedAt: string | null,
  runtimeRunning: boolean,
): AtlasRuntimeAgentState {
  const pipelineState = getPipelineStateFromProgress(pipeline, prefix);
  if (pipelineState !== "idle") {
    return pipelineState;
  }
  if (!hasEvidence) {
    return "idle";
  }
  return runtimeRunning && isRecentTimestamp(evidenceUpdatedAt) ? "active" : "done";
}

function resolveResearchFallbackState(
  hasEvidence: boolean,
  evidenceUpdatedAt: string | null,
  runtimeRunning: boolean,
): AtlasRuntimeAgentState {
  if (!hasEvidence) {
    return "idle";
  }
  return (runtimeRunning || isRecentTimestamp(evidenceUpdatedAt)) && isRecentTimestamp(evidenceUpdatedAt) ? "active" : "done";
}

function getDisplayPipelineRank(stage: string): number {
  const normalizedStage = String(stage || "idle");
  if (normalizedStage === "cycle_complete") return 100;
  if (normalizedStage.startsWith("workers_")) return 80;
  if (normalizedStage.startsWith("athena_")) return 70;
  if (normalizedStage.startsWith("prometheus_")) return 60;
  if (normalizedStage.startsWith("research_synthesis")) return 45;
  if (normalizedStage.startsWith("research_scout")) return 35;
  if (normalizedStage.startsWith("jesus_")) return 20;
  return 0;
}

function createArtifactPipelineCandidate(
  pipeline: AtlasRuntimePipelineSnapshot,
  stage: string,
  stageLabel: string,
  percent: number,
  detail: string,
  updatedAt: string | null = null,
): AtlasRuntimePipelineSnapshot {
  return {
    ...pipeline,
    stage,
    stageLabel,
    percent,
    detail,
    updatedAt: updatedAt || pipeline.updatedAt,
    completedAt: stage === "cycle_complete" ? (pipeline.completedAt || updatedAt || pipeline.updatedAt) : null,
  };
}

function choosePipelineCandidate(
  pipeline: AtlasRuntimePipelineSnapshot,
  candidate: AtlasRuntimePipelineSnapshot | null,
): AtlasRuntimePipelineSnapshot {
  if (!candidate) {
    return pipeline;
  }
  if (pipeline.stage === "idle") {
    return candidate;
  }
  return getDisplayPipelineRank(candidate.stage) >= getDisplayPipelineRank(pipeline.stage)
    ? candidate
    : pipeline;
}

function isMissionDispatchActive(missionArtifacts: AtlasMissionArtifactSnapshot | null): boolean {
  if (!missionArtifacts) {
    return false;
  }

  if (missionArtifacts.activeWorkerCount > 0) {
    return true;
  }

  const hasDispatchFlag = String(missionArtifacts.dispatchStatus || "").toLowerCase() === "dispatching"
    || String(missionArtifacts.workerCycleStatus || "").toLowerCase() === "dispatching";
  if (!hasDispatchFlag) {
    return false;
  }

  const allPlansComplete = missionArtifacts.totalPlans > 0
    && missionArtifacts.completedPlans >= missionArtifacts.totalPlans;
  const allObservedWorkersDone = missionArtifacts.workerCount > 0
    && missionArtifacts.blockedWorkerCount === 0
    && missionArtifacts.doneWorkerCount >= missionArtifacts.workerCount;

  return !(allPlansComplete || allObservedWorkersDone);
}

async function readJsonObject(targetPath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readJsonValue(targetPath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function parsePremiumUsageAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function getPremiumUsageAmountFromLine(line: string): number {
  // Session progress logs emit one premium usage event per line, while the
  // `spent=` field is cycle-cumulative. Counting the field value inflates the
  // session total as 1+2+3... instead of counting actual requests.
  return /\[PREMIUM_USAGE\]/.test(line) ? 1 : 0;
}

function getPremiumUsageAmountFromEntry(entry: Record<string, unknown>): number {
  return parsePremiumUsageAmount(
    entry.premiumRequests
      ?? entry.requestCount
      ?? entry.requests
      ?? entry.spent
      ?? entry.quantity,
  ) ?? 1;
}

async function readSessionProgressPremiumRequestCount(stateDir: string, missionSessionId: string | null): Promise<number | null> {
  const missionStateDir = await findMissionStateDir(stateDir, missionSessionId);
  if (!missionStateDir) {
    return null;
  }

  try {
    const raw = await fs.readFile(path.join(missionStateDir, "session_progress.log"), "utf8");
    return raw
      .split(/\r?\n/)
      .reduce((sum, line) => sum + getPremiumUsageAmountFromLine(line), 0);
  } catch {
    return null;
  }
}

async function readSessionPremiumRequestCount(stateDir: string, requestedAt: string | null, missionSessionId: string | null): Promise<number | null> {
  const sessionProgressCount = await readSessionProgressPremiumRequestCount(stateDir, missionSessionId);
  if (sessionProgressCount !== null) {
    return sessionProgressCount;
  }

  const requestedAtMs = requestedAt ? Date.parse(requestedAt) : Number.NaN;
  if (!Number.isFinite(requestedAtMs)) {
    return null;
  }

  const raw = await readJsonValue(path.join(stateDir, "premium_usage_log.json"));
  const entries = Array.isArray(raw)
    ? raw
    : (isRecord(raw) && Array.isArray(raw.entries) ? raw.entries : []);

  return entries.reduce((sum, entry) => {
    if (!isRecord(entry)) {
      return sum;
    }
    const candidateTimestamps = [
      entry.startedAt,
      entry.completedAt,
      entry.timestamp,
      entry.createdAt,
      entry.updatedAt,
      entry.at,
    ];
    const entryTimeMs = candidateTimestamps
      .map((value) => typeof value === "string" ? Date.parse(value) : Number.NaN)
      .find((value) => Number.isFinite(value)) ?? Number.NaN;
    return Number.isFinite(entryTimeMs) && entryTimeMs >= requestedAtMs
      ? sum + getPremiumUsageAmountFromEntry(entry)
      : sum;
  }, 0);
}

async function readAgentLogSnapshot(stateDir: string, aliases: string[]): Promise<AtlasAgentLogSnapshot | null> {
  for (const alias of aliases.map((value) => normalizeWorkerName(value)).filter(Boolean)) {
    const logPath = path.join(stateDir, `live_worker_${alias}.log`);
    try {
      const stats = await fs.stat(logPath);
      if (!stats.isFile()) continue;
      const raw = await fs.readFile(logPath, "utf8");
      const lines = raw.split(/\r?\n/).map(sanitizeLogLine).filter(Boolean).slice(-6);
      if (!lines.length) continue;
      return {
        lines,
        updatedAt: stats.mtime.toISOString(),
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function readSessionScopedAgentLogSnapshot(
  sessionStateDir: string,
  agentId: Exclude<AtlasRuntimeAgentId, "worker" | "done">,
): Promise<AtlasAgentLogSnapshot | null> {
  const progressLogPath = path.join(sessionStateDir, "session_progress.log");
  const patterns = SESSION_PROGRESS_AGENT_PATTERNS[agentId] || [];
  if (patterns.length === 0) {
    return null;
  }

  try {
    const stats = await fs.stat(progressLogPath);
    if (!stats.isFile()) {
      return null;
    }

    const raw = await fs.readFile(progressLogPath, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map(sanitizeLogLine)
      .filter((line) => line && patterns.some((pattern) => pattern.test(line)))
      .slice(-6);
    if (!lines.length) {
      return null;
    }

    return {
      lines,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

async function findMissionStateDir(stateDir: string, missionSessionId: string | null): Promise<string | null> {
  const workspaceProjectSessionId = path.basename(process.cwd()).startsWith("sess_")
    ? path.basename(process.cwd())
    : null;
  const candidateSessionIds = missionSessionId
    ? [missionSessionId]
    : [workspaceProjectSessionId]
  .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  if (!candidateSessionIds.length) {
    return null;
  }
  const projectsDir = path.join(stateDir, "projects");
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      for (const sessionId of candidateSessionIds) {
        const candidate = path.join(projectsDir, entry.name, sessionId);
        if (await pathExists(path.join(candidate, "target_session.json"))) {
          return candidate;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function summarizeWorkerArtifactSessions(rawSessions: Record<string, unknown>): Pick<AtlasMissionArtifactSnapshot, "workerCount" | "activeWorkerCount" | "blockedWorkerCount" | "doneWorkerCount"> {
  let workerCount = 0;
  let activeWorkerCount = 0;
  let blockedWorkerCount = 0;
  let doneWorkerCount = 0;

  for (const [role, rawSession] of Object.entries(rawSessions)) {
    if (role === "schemaVersion" || !isRecord(rawSession)) {
      continue;
    }
    workerCount += 1;
    const state = normalizeArtifactStatus(rawSession.status ?? rawSession.lastStatus);
    if (state === "active") activeWorkerCount += 1;
    if (state === "error") blockedWorkerCount += 1;
    if (state === "done") doneWorkerCount += 1;
  }

  return {
    workerCount,
    activeWorkerCount,
    blockedWorkerCount,
    doneWorkerCount,
  };
}

function buildWorkerActivityExcerpt(rawCycle: Record<string, unknown> | null): string[] {
  if (!isRecord(rawCycle?.workerActivity)) {
    return [];
  }

  const collected = Object.entries(rawCycle.workerActivity).flatMap(([role, rawEntries]) => {
    if (!Array.isArray(rawEntries)) {
      return [] as Array<{ at: string | null; line: string }>;
    }
    return rawEntries.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [] as Array<{ at: string | null; line: string }>;
      }
      const task = normalizeOptionalString(entry.task) || normalizeOptionalString(entry.signal) || normalizeOptionalString(entry.dispatchBlockReason) || normalizeOptionalString(entry.status);
      if (!task) {
        return [] as Array<{ at: string | null; line: string }>;
      }
      const status = toSentenceCase(String(entry.status || "update"));
      return [{
        at: normalizeOptionalString(entry.at),
        line: `${toTitleCase(role.replace(/-worker$/i, " worker"))}: ${status} - ${task}`,
      }];
    });
  });

  return collected
    .sort((left, right) => {
      const leftValue = left.at ? Date.parse(left.at) : Number.NaN;
      const rightValue = right.at ? Date.parse(right.at) : Number.NaN;
      if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
        return rightValue - leftValue;
      }
      if (Number.isFinite(leftValue)) return -1;
      if (Number.isFinite(rightValue)) return 1;
      return 0;
    })
    .slice(0, 6)
    .map((entry) => entry.line);
}

async function readMissionArtifactSnapshot(stateDir: string, missionSessionId: string | null): Promise<AtlasMissionArtifactSnapshot | null> {
  const sessionStateDir = await findMissionStateDir(stateDir, missionSessionId);
  const agentLogTargets: Array<[Exclude<AtlasRuntimeAgentId, "worker" | "done">, string[]]> = [
    ["jesus", ["jesus", "jasus"]],
    ["research_scout", ["research-scout"]],
    ["research_synthesizer", ["research-synthesizer"]],
    ["prometheus", ["prometheus", "target-prometheus", "promethus"]],
    ["athena", ["athena"]],
  ];
  const agentLogEntries = await Promise.all(agentLogTargets.map(async ([agentId, aliases]) => {
    const scopedLog = sessionStateDir
      ? await readSessionScopedAgentLogSnapshot(sessionStateDir, agentId)
      : null;
    const fallbackLog = (!scopedLog && !sessionStateDir)
      ? await readAgentLogSnapshot(stateDir, aliases)
      : null;
    return [agentId, scopedLog || fallbackLog] as const;
  }));

  const agentLogs = Object.fromEntries(agentLogEntries.filter((entry) => entry[1])) as AtlasMissionArtifactSnapshot["agentLogs"];
  if (!sessionStateDir) {
    return {
      sessionStateDir: null,
      jesusDirectiveExists: false,
      researchScoutExists: false,
      researchSynthesisExists: false,
      prometheusPlanCount: 0,
      athenaApproved: null,
      athenaSummary: null,
      dispatchStatus: null,
      dispatchUpdatedAt: null,
      totalPlans: 0,
      completedPlans: 0,
      workerCycleStatus: null,
      workerCount: 0,
      activeWorkerCount: 0,
      blockedWorkerCount: 0,
      doneWorkerCount: 0,
      completionStage: null,
      completionFinalStatus: null,
      completionSummary: null,
      workerLogLines: [],
      agentLogs,
    };
  }

  const runtimeDir = path.join(sessionStateDir, "runtime");
  const [
    jesusDirectiveExists,
    researchScoutExists,
    researchSynthesisRootExists,
    researchSynthesisRuntimeExists,
    prometheusAnalysis,
    athenaPlanReview,
    dispatchCheckpoint,
    workerCycleArtifacts,
    workerSessions,
    targetCompletion,
  ] = await Promise.all([
    pathExists(path.join(sessionStateDir, "jesus_directive.json")),
    pathExists(path.join(sessionStateDir, "research_scout_output.json")),
    pathExists(path.join(sessionStateDir, "research_synthesis.json")),
    pathExists(path.join(runtimeDir, "research_synthesis.json")),
    readJsonObject(path.join(sessionStateDir, "prometheus_analysis.json")),
    readJsonObject(path.join(runtimeDir, "athena_plan_review.json")),
    readJsonObject(path.join(runtimeDir, "dispatch_checkpoint.json")),
    readJsonObject(path.join(runtimeDir, "worker_cycle_artifacts.json")),
    readJsonObject(path.join(runtimeDir, "worker_sessions.json")),
    readJsonObject(path.join(sessionStateDir, "target_completion.json")),
  ]);

  const latestCycleId = normalizeOptionalString(workerCycleArtifacts?.latestCycleId);
  const cycles = isRecord(workerCycleArtifacts?.cycles) ? workerCycleArtifacts.cycles : null;
  const latestCycle = latestCycleId && cycles && isRecord(cycles[latestCycleId])
    ? cycles[latestCycleId] as Record<string, unknown>
    : null;
  const runtimeWorkerSessions = isRecord(latestCycle?.workerSessions)
    ? latestCycle.workerSessions
    : (isRecord(workerSessions) ? workerSessions : {});
  const workerSummary = summarizeWorkerArtifactSessions(runtimeWorkerSessions);

  return {
    sessionStateDir,
    jesusDirectiveExists,
    researchScoutExists,
    researchSynthesisExists: researchSynthesisRootExists || researchSynthesisRuntimeExists,
    prometheusPlanCount: Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans.length : 0,
    athenaApproved: typeof athenaPlanReview?.approved === "boolean" ? athenaPlanReview.approved : null,
    athenaSummary: normalizeOptionalString(athenaPlanReview?.summary),
    dispatchStatus: normalizeOptionalString(dispatchCheckpoint?.status),
    dispatchUpdatedAt: normalizeOptionalString(dispatchCheckpoint?.updatedAt) || normalizeOptionalString(dispatchCheckpoint?.createdAt),
    totalPlans: Number(dispatchCheckpoint?.totalPlans || 0),
    completedPlans: Number(dispatchCheckpoint?.completedPlans || 0),
    workerCycleStatus: normalizeOptionalString(latestCycle?.status) || normalizeOptionalString(workerCycleArtifacts?.status),
    ...workerSummary,
    completionStage: normalizeOptionalString(targetCompletion?.currentStage),
    completionFinalStatus: normalizeOptionalString(targetCompletion?.finalStatus),
    completionSummary: normalizeOptionalString(targetCompletion?.completionSummary),
    workerLogLines: buildWorkerActivityExcerpt(latestCycle),
    agentLogs,
  };
}

function buildLeadershipNode(
  id: AtlasRuntimeAgentId,
  label: string,
  pipeline: AtlasRuntimePipelineSnapshot,
  session: AtlasSessionDto | null,
  prefix: string,
  fallbackSummary: string,
  artifactFallback: AtlasRuntimeNodeFallback | null = null,
): AtlasRuntimeAgentNode {
  const state = session ? mapSessionToAgentState(session) : (artifactFallback?.state || getPipelineNodeState(pipeline, prefix, null));
  const activeDetail = artifactFallback?.detailBody || pipeline.detail || fallbackSummary;
  const summary = session?.latestMeaningfulAction
    || (state === "active" ? activeDetail : (artifactFallback?.summary || fallbackSummary));
  const detailBody = session?.lastTask
    || session?.latestMeaningfulAction
    || (state === "active" ? activeDetail : (artifactFallback?.detailBody || fallbackSummary));
  const metrics: AtlasRuntimeAgentMetric[] = session ? [
    { label: "Status", value: session.statusLabel || getAgentStateLabel(state) },
    { label: "Stage", value: session.currentStageLabel || pipeline.stageLabel },
  ] : (artifactFallback?.metrics?.length
    ? [...artifactFallback.metrics]
    : [
        { label: "Status", value: getAgentStateLabel(state) },
        { label: "Stage", value: pipeline.stageLabel },
      ]);
  if (session?.pullRequestCount) {
    metrics.push({ label: "PRs", value: String(session.pullRequestCount) });
  }
  if (session?.touchedFileCount) {
    metrics.push({ label: "Files", value: String(session.touchedFileCount) });
  }

  return {
    id,
    label,
    state,
    stateLabel: getAgentStateLabel(state),
    summary,
    detailTitle: `${label} live detail`,
    detailBody,
    metrics,
    logLines: session
      ? pickPrimaryLogLines(session, state === "active" ? activeDetail : null)
      : (artifactFallback?.logLines.length ? artifactFallback.logLines : pickPrimaryLogLines(null, state === "active" ? activeDetail : fallbackSummary)),
  };
}

function buildResearchNode(
  id: AtlasRuntimeAgentId,
  label: string,
  session: AtlasSessionDto | null,
  helperCopy: string,
  artifactFallback: AtlasRuntimeNodeFallback | null = null,
): AtlasRuntimeAgentNode {
  const state = session ? mapSessionToAgentState(session) : (artifactFallback?.state || "idle");
  return {
    id,
    label,
    state,
    stateLabel: getAgentStateLabel(state),
    summary: session?.latestMeaningfulAction || artifactFallback?.summary || helperCopy,
    detailTitle: `${label} live detail`,
    detailBody: session?.lastTask || session?.latestMeaningfulAction || artifactFallback?.detailBody || helperCopy,
    metrics: session ? [
      { label: "Status", value: session.statusLabel || getAgentStateLabel(state) },
      { label: "Lane", value: session.lane ? toSentenceCase(session.lane) : "Optional lane" },
    ] : (artifactFallback?.metrics?.length
      ? [...artifactFallback.metrics]
      : [
          { label: "Status", value: getAgentStateLabel(state) },
          { label: "Lane", value: "Optional lane" },
        ]),
    logLines: session
      ? pickPrimaryLogLines(session, helperCopy)
      : (artifactFallback?.logLines.length ? artifactFallback.logLines : [artifactFallback?.detailBody || helperCopy]),
  };
}

function buildWorkerNode(
  pipeline: AtlasRuntimePipelineSnapshot,
  sessions: AtlasSessionDto[],
  artifactFallback: AtlasRuntimeNodeFallback | null = null,
): AtlasRuntimeAgentNode {
  const workers = getWorkerSessions(sessions);
  if (workers.length === 0 && artifactFallback) {
    const pipelineState = pipeline.stage.startsWith("workers_")
      ? getPipelineNodeState(pipeline, "workers_", null)
      : artifactFallback.state;
    const effectiveState = artifactFallback.state === "idle" && pipelineState !== "idle"
      ? pipelineState
      : artifactFallback.state;
    const activeSummary = pipeline.detail || artifactFallback.summary;
    return {
      id: "worker",
      label: "Worker",
      state: effectiveState,
      stateLabel: getAgentStateLabel(effectiveState),
      summary: effectiveState === "active" ? activeSummary : artifactFallback.summary,
      detailTitle: "Worker execution detail",
      detailBody: effectiveState === "active" ? (pipeline.detail || artifactFallback.detailBody) : artifactFallback.detailBody,
      metrics: artifactFallback.metrics,
      logLines: artifactFallback.logLines.length
        ? artifactFallback.logLines
        : [effectiveState === "active" ? activeSummary : artifactFallback.summary],
    };
  }

  const activeWorkers = workers.filter((session) => session.status === "working").length;
  const blockedWorkers = workers.filter((session) => session.status === "blocked" || session.status === "error").length;
  const doneWorkers = workers.filter((session) => session.status === "done").length;
  const state = blockedWorkers > 0
    ? "error"
    : activeWorkers > 0 || pipeline.stage.startsWith("workers_")
      ? "active"
      : pipeline.stage === "cycle_complete" || doneWorkers > 0
        ? "done"
        : workers.length > 0
          ? "queued"
          : "idle";
  const summary = blockedWorkers > 0
    ? `${String(blockedWorkers)} worker lanes need attention.`
    : activeWorkers > 0
      ? `${String(activeWorkers)} worker lanes are currently running.`
      : doneWorkers > 0
        ? `${String(doneWorkers)} worker lanes already completed.`
        : "Worker lanes will activate once the plan is approved.";
  const logLines = workers.flatMap((session) => session.logExcerpt || []).slice(0, 6);

  return {
    id: "worker",
    label: "Worker",
    state,
    stateLabel: getAgentStateLabel(state),
    summary,
    detailTitle: "Worker execution detail",
    detailBody: workers[0]?.latestMeaningfulAction || summary,
    metrics: [
      { label: "Open lanes", value: String(workers.length) },
      { label: "Running", value: String(activeWorkers) },
      { label: "Done", value: String(doneWorkers) },
    ],
    logLines: logLines.length > 0 ? logLines : [summary],
  };
}

function buildDoneNode(context: RuntimeSnapshotContext, artifactFallback: AtlasRuntimeNodeFallback | null = null): AtlasRuntimeAgentNode {
  const state = context.pipeline.stage === "cycle_complete"
    ? "done"
    : context.buildRequest?.triggerState === "error"
      ? "error"
      : artifactFallback?.state
        ? artifactFallback.state
      : context.buildRequest
        ? "queued"
        : "idle";
  const summary = state === "done"
    ? "The current cycle reached a completed state."
    : state === "error"
      ? (context.buildRequest?.lastError || "Build handoff needs attention.")
      : artifactFallback?.summary
        ? artifactFallback.summary
      : "Done stays idle until the worker lane and verification cycle finish.";

  return {
    id: "done",
    label: "Done",
    state,
    stateLabel: getAgentStateLabel(state),
    summary,
    detailTitle: "Completion detail",
    detailBody: state === "done"
      ? (artifactFallback?.detailBody || context.pipeline.detail || summary)
      : summary,
    metrics: artifactFallback?.metrics?.length
      ? artifactFallback.metrics
      : [
          { label: "Pipeline", value: context.pipeline.stageLabel },
          { label: "Progress", value: `${String(context.pipeline.percent)}%` },
        ],
    logLines: artifactFallback?.logLines.length
      ? artifactFallback.logLines
      : (context.pipeline.detail ? [context.pipeline.detail] : [summary]),
  };
}

function buildAtlasAgentNodes(context: RuntimeSnapshotContext): AtlasRuntimeAgentNode[] {
  const jesusSession = getPrimarySession(context.openSessions, ["jesus", "jasus"]);
  const scoutSession = getPrimarySession(context.openSessions, ["research-scout"]);
  const synthSession = getPrimarySession(context.openSessions, ["research-synthesizer"]);
  const prometheusSession = getPrimarySession(context.openSessions, ["prometheus", "target-prometheus", "promethus"]);
  const athenaSession = getPrimarySession(context.openSessions, ["athena"]);
  const missionArtifacts = context.missionArtifacts;

  const jesusFallback = missionArtifacts ? {
    state: resolveLeadershipFallbackState(
      context.pipeline,
      "jesus_",
      missionArtifacts.jesusDirectiveExists || Boolean(missionArtifacts.agentLogs.jesus?.lines.length),
      missionArtifacts.agentLogs.jesus?.updatedAt || null,
      context.runtimeRunning,
    ),
    summary: missionArtifacts.jesusDirectiveExists
      ? "Jesus directive was recorded for this session."
      : "Waiting for the first directive.",
    detailBody: missionArtifacts.jesusDirectiveExists
      ? "The session has a recorded Jesus directive and can advance through planning and execution artifacts."
      : "Waiting for the first directive.",
    metrics: [
      { label: "Directive", value: missionArtifacts.jesusDirectiveExists ? "Recorded" : "Pending" },
      { label: "Pipeline", value: context.pipeline.stageLabel },
    ],
    logLines: missionArtifacts.agentLogs.jesus?.lines || [],
  } satisfies AtlasRuntimeNodeFallback : null;

  const scoutFallback = missionArtifacts ? {
    state: resolveResearchFallbackState(
      missionArtifacts.researchScoutExists || Boolean(missionArtifacts.agentLogs.research_scout?.lines.length),
      missionArtifacts.agentLogs.research_scout?.updatedAt || null,
      context.runtimeRunning,
    ),
    summary: missionArtifacts.researchScoutExists
      ? "Scout findings were captured for this mission."
      : "Only activates when the active mission needs external research coverage.",
    detailBody: missionArtifacts.researchScoutExists
      ? "Research Scout produced mission evidence that now feeds the planning packet."
      : "Only activates when the active mission needs external research coverage.",
    metrics: [
      { label: "Evidence", value: missionArtifacts.researchScoutExists ? "Captured" : "Pending" },
      { label: "Lane", value: "Research" },
    ],
    logLines: missionArtifacts.agentLogs.research_scout?.lines || [],
  } satisfies AtlasRuntimeNodeFallback : null;

  const synthFallback = missionArtifacts ? {
    state: resolveResearchFallbackState(
      missionArtifacts.researchSynthesisExists || Boolean(missionArtifacts.agentLogs.research_synthesizer?.lines.length),
      missionArtifacts.agentLogs.research_synthesizer?.updatedAt || null,
      context.runtimeRunning,
    ),
    summary: missionArtifacts.researchSynthesisExists
      ? "Research synthesis is available for planning."
      : "Stays on standby until scout findings need synthesis.",
    detailBody: missionArtifacts.researchSynthesisExists
      ? "The session has a research synthesis artifact ready for downstream planning decisions."
      : "Stays on standby until scout findings need synthesis.",
    metrics: [
      { label: "Synthesis", value: missionArtifacts.researchSynthesisExists ? "Ready" : "Pending" },
      { label: "Lane", value: "Research" },
    ],
    logLines: missionArtifacts.agentLogs.research_synthesizer?.lines || [],
  } satisfies AtlasRuntimeNodeFallback : null;

  const prometheusFallback = missionArtifacts ? {
    state: resolveLeadershipFallbackState(
      context.pipeline,
      "prometheus_",
      missionArtifacts.prometheusPlanCount > 0 || Boolean(missionArtifacts.agentLogs.prometheus?.lines.length),
      missionArtifacts.agentLogs.prometheus?.updatedAt || null,
      context.runtimeRunning,
    ),
    summary: missionArtifacts.prometheusPlanCount > 0
      ? `Prometheus recorded ${String(missionArtifacts.prometheusPlanCount)} plan item(s) for this session.`
      : "Plan analysis begins after Jesus commits the direction.",
    detailBody: missionArtifacts.prometheusPlanCount > 0
      ? `The mission already has ${String(missionArtifacts.prometheusPlanCount)} planned item(s) in its Prometheus analysis packet.`
      : "Plan analysis begins after Jesus commits the direction.",
    metrics: [
      { label: "Plans", value: missionArtifacts.prometheusPlanCount > 0 ? String(missionArtifacts.prometheusPlanCount) : "Pending" },
      { label: "Pipeline", value: context.pipeline.stageLabel },
    ],
    logLines: missionArtifacts.agentLogs.prometheus?.lines || [],
  } satisfies AtlasRuntimeNodeFallback : null;

  const athenaFallback = missionArtifacts ? {
    state: resolveLeadershipFallbackState(
      context.pipeline,
      "athena_",
      missionArtifacts.athenaApproved === true || Boolean(missionArtifacts.athenaSummary) || Boolean(missionArtifacts.agentLogs.athena?.lines.length),
      missionArtifacts.agentLogs.athena?.updatedAt || null,
      context.runtimeRunning,
    ),
    summary: missionArtifacts.athenaSummary || (missionArtifacts.athenaApproved === true
      ? "Athena reviewed and approved the current plan packet."
      : "Plan review activates once Prometheus finishes the draft."),
    detailBody: missionArtifacts.athenaSummary || (missionArtifacts.athenaApproved === true
      ? "Athena approval is recorded for this mission."
      : "Plan review activates once Prometheus finishes the draft."),
    metrics: [
      { label: "Review", value: missionArtifacts.athenaApproved === true ? "Approved" : (missionArtifacts.athenaSummary ? "Reviewed" : "Pending") },
      { label: "Pipeline", value: context.pipeline.stageLabel },
    ],
    logLines: missionArtifacts.agentLogs.athena?.lines || [],
  } satisfies AtlasRuntimeNodeFallback : null;

  const workerFallback = missionArtifacts ? (() => {
    const state = missionArtifacts.blockedWorkerCount > 0
      ? "error"
      : isMissionDispatchActive(missionArtifacts)
        ? "active"
        : missionArtifacts.doneWorkerCount > 0 || missionArtifacts.completedPlans > 0
          ? "done"
          : missionArtifacts.workerCount > 0 || missionArtifacts.totalPlans > 0
            ? "queued"
            : "idle";
    const summary = missionArtifacts.blockedWorkerCount > 0
      ? `${String(missionArtifacts.blockedWorkerCount)} worker lanes need attention.`
      : missionArtifacts.activeWorkerCount > 0
        ? `${String(missionArtifacts.activeWorkerCount)} worker lanes are currently running.`
        : missionArtifacts.doneWorkerCount > 0
          ? `${String(missionArtifacts.doneWorkerCount)} worker lanes already completed.`
          : missionArtifacts.totalPlans > 0
            ? `${String(missionArtifacts.totalPlans)} plan(s) were handed to the worker lane.`
            : "Worker lanes will activate once the plan is approved.";
    return {
      state,
      summary,
      detailBody: missionArtifacts.workerCycleStatus
        ? `Latest worker cycle status: ${toSentenceCase(missionArtifacts.workerCycleStatus)}.`
        : summary,
      metrics: [
        { label: "Open lanes", value: String(missionArtifacts.workerCount) },
        { label: "Running", value: String(missionArtifacts.activeWorkerCount) },
        { label: "Done", value: String(missionArtifacts.doneWorkerCount) },
      ],
      logLines: missionArtifacts.workerLogLines,
    } satisfies AtlasRuntimeNodeFallback;
  })() : null;

  const doneFallback = missionArtifacts && (missionArtifacts.completionStage === "completed" || missionArtifacts.completionFinalStatus === "completed") ? {
    state: "done",
    summary: missionArtifacts.completionSummary || "The current cycle reached a completed state.",
    detailBody: missionArtifacts.completionSummary || "The current cycle reached a completed state.",
    metrics: [
      { label: "Outcome", value: missionArtifacts.completionFinalStatus || missionArtifacts.completionStage || "Completed" },
      { label: "Pipeline", value: context.pipeline.stageLabel },
    ],
    logLines: missionArtifacts.completionSummary ? [missionArtifacts.completionSummary] : [],
  } satisfies AtlasRuntimeNodeFallback : null;

  return [
    buildLeadershipNode("jesus", "Jesus", context.pipeline, jesusSession, "jesus_", "Waiting for the first directive.", jesusFallback),
    buildResearchNode("research_scout", "Research Scout", scoutSession, "Only activates when the active mission needs external research coverage.", scoutFallback),
    buildResearchNode("research_synthesizer", "Research Synthesizer", synthSession, "Stays on standby until scout findings need synthesis.", synthFallback),
    buildLeadershipNode("prometheus", "Prometheus", context.pipeline, prometheusSession, "prometheus_", "Plan analysis begins after Jesus commits the direction.", prometheusFallback),
    buildLeadershipNode("athena", "Athena", context.pipeline, athenaSession, "athena_", "Plan review activates once Prometheus finishes the draft.", athenaFallback),
    buildWorkerNode(context.pipeline, context.openSessions, workerFallback),
    buildDoneNode(context, doneFallback),
  ];
}

function resolvePipelinePreferredAgentId(pipelineStage: string): AtlasRuntimeAgentId | null {
  if (pipelineStage.startsWith("prometheus_")) {
    return "prometheus";
  }
  if (pipelineStage.startsWith("athena_")) {
    return "athena";
  }
  if (pipelineStage.startsWith("workers_")) {
    return "worker";
  }
  if (pipelineStage.startsWith("research_synthesis_")) {
    return "research_synthesizer";
  }
  if (pipelineStage.startsWith("research_scout_")) {
    return "research_scout";
  }
  if (pipelineStage.startsWith("jesus_")) {
    return "jesus";
  }
  if (pipelineStage === "cycle_complete") {
    return "done";
  }
  return null;
}

function resolveDefaultAgentId(
  agents: AtlasRuntimeAgentNode[],
  pipeline: AtlasRuntimePipelineSnapshot,
): AtlasRuntimeAgentId {
  const preferredAgentId = resolvePipelinePreferredAgentId(
    typeof pipeline?.stage === "string" ? pipeline.stage : "",
  );
  if (preferredAgentId && agents.some((agent) => agent.id === preferredAgentId && agent.state !== "idle")) {
    return preferredAgentId;
  }

  return agents.find((agent) => agent.state === "active")?.id
    || agents.find((agent) => agent.state === "error")?.id
    || agents.find((agent) => agent.state === "queued")?.id
    || agents.find((agent) => agent.id === "done" && agent.state === "done")?.id
    || "jesus";
}

async function readRuntimeExecutionState(buildRequest: AtlasBuildRequestRecord | null, stateDir: string): Promise<{ daemonRunning: boolean; requestRunnerAlive: boolean; daemonPid: number | null; }> {
  const requestRunnerAlive = Boolean(
    buildRequest?.triggerState === "queued"
    && buildRequest?.runnerPid
    && isProcessAlive(buildRequest.runnerPid),
  );

  try {
    const runtimeStateDir = await resolveAtlasRuntimeStateDir(stateDir);
    const baseConfig = applyAtlasRuntimeStateDirToConfig(await loadConfig(), runtimeStateDir) as Record<string, unknown>;
    const scopedConfig = buildRequest?.projectSessionId
      ? {
          ...baseConfig,
          daemonControlScope: {
            projectId: buildRequest.projectId || null,
            sessionId: buildRequest.projectSessionId,
          },
        }
      : baseConfig;
    const daemonPidState = await readDaemonPid(scopedConfig);
    const daemonPid = Number(daemonPidState?.pid || 0);
    const daemonRunning = daemonPid > 0 && (buildRequest?.projectSessionId ? isProcessAlive(daemonPid) : isDaemonProcess(daemonPid));
    return {
      daemonRunning,
      requestRunnerAlive: daemonRunning ? false : requestRunnerAlive,
      daemonPid: daemonPid > 0 ? daemonPid : null,
    };
  } catch {
    return {
      daemonRunning: false,
      requestRunnerAlive,
      daemonPid: null,
    };
  }
}

async function reconcileActiveBuildProjection(
  stateDir: string,
  buildRequest: AtlasBuildRequestRecord | null,
  updates: Partial<AtlasBuildRequestRecord>,
): Promise<AtlasBuildRequestRecord | null> {
  if (!buildRequest) {
    return buildRequest;
  }

  const nextRecord: AtlasBuildRequestRecord = {
    ...buildRequest,
    ...updates,
  };

  const changed = nextRecord.triggerState !== buildRequest.triggerState
    || nextRecord.runnerPid !== buildRequest.runnerPid
    || nextRecord.triggerLabel !== buildRequest.triggerLabel;

  if (!changed) {
    return buildRequest;
  }

  nextRecord.updatedAt = new Date().toISOString();
  await writeAtlasBuildRequest(stateDir, nextRecord);
  return nextRecord;
}

export async function queueAtlasBuildForSession(
  options: QueueAtlasBuildForSessionOptions,
): Promise<AtlasBuildRequestRecord> {
  const existing = await readAtlasBuildRequest(options.stateDir);
  const sameSessionExisting = existing?.sessionId === options.session.id ? existing : null;
  const reusableBinding = sameSessionExisting
    ? await resolveAtlasProjectBindingForSession(options.stateDir, options.session, sameSessionExisting, {
        allowHeuristicMatch: false,
      })
    : null;
  const reusableExisting = sameSessionExisting && reusableBinding ? sameSessionExisting : null;
  if (
    reusableExisting
    && reusableExisting.triggerState !== "error"
    && reusableBinding?.projectSessionId
    && options.force !== true
  ) {
    return reusableExisting;
  }

  const now = new Date().toISOString();
  const nextRecord: AtlasBuildRequestRecord = {
    sessionId: options.session.id,
    selectedModel: normalizeOptionalString(options.session.selectedModel) || null,
    projectId: reusableBinding?.projectId || null,
    projectSessionId: reusableBinding?.projectSessionId || null,
    projectWorkspacePath: reusableBinding?.projectWorkspacePath || null,
    title: options.session.title,
    objective: options.session.objective,
    summary: options.session.summary || options.session.objective,
    targetRepo: options.session.repoContext?.targetRepo || null,
    targetBaseBranch: options.session.repoContext?.targetBaseBranch || null,
    repoMode: options.session.repoContext?.repoMode || null,
    repoCreatedByAtlas: options.session.repoContext?.repoCreatedByAtlas === true,
    requestedAt: now,
    updatedAt: now,
    triggerMode: "watching",
    triggerState: "queued",
    triggerLabel: "Build request queued from the ATLAS desktop session.",
    runnerPid: null,
    lastError: null,
    planningPrompt: buildAtlasPlanningPrompt({
      title: options.session.title,
      objective: options.session.objective,
      summary: options.session.summary,
      targetRepo: options.session.repoContext?.targetRepo || null,
      repoMode: options.session.repoContext?.repoMode || null,
      executionNotes: options.session.executionNotes,
      messages: options.session.messages,
      attachmentPlans: options.session.attachmentPlans,
    }),
    appliedAt: null,
  };

  await writeAtlasBuildRequest(options.stateDir, nextRecord);

  try {
    applyAtlasRepoContextToEnv(options.session.repoContext || null);
    const { config, targetSession } = await ensureAtlasProjectSession(options.stateDir, options.session, reusableExisting);
    const runtimeStateDir = String(config?.paths && typeof config.paths === "object" ? (config.paths as Record<string, unknown>).stateDir || options.stateDir : options.stateDir);
    const targetWorkspace = isRecord(targetSession?.workspace) ? targetSession.workspace : null;
    nextRecord.projectId = normalizeOptionalString(targetSession?.projectId);
    nextRecord.projectSessionId = normalizeOptionalString(targetSession?.sessionId);
    nextRecord.projectWorkspacePath = normalizeOptionalString(targetWorkspace?.path);
    await linkAtlasDesktopSessionToProjectSession({
      stateDir: options.stateDir,
      sessionId: options.session.id,
      projectId: nextRecord.projectId,
      projectSessionId: nextRecord.projectSessionId,
      projectWorkspacePath: nextRecord.projectWorkspacePath,
    });
    const daemonPidState = await readDaemonPid(config);
    const daemonPid = Number(daemonPidState?.pid || 0);
    const daemonRunning = daemonPid > 0 && isDaemonProcess(daemonPid);
    const rawPipeline = await readPipelineProgress({ paths: { stateDir: runtimeStateDir } }) as Record<string, unknown>;
    const pipeline = formatPipelineSnapshot(rawPipeline);

    if (daemonRunning) {
      nextRecord.triggerMode = "daemon";
      nextRecord.runnerPid = daemonPid;
      nextRecord.triggerState = isPipelineActive(pipeline) ? "running" : "queued";
      nextRecord.triggerLabel = isPipelineActive(pipeline)
        ? "BOX runtime is already active, so ATLAS is now monitoring the live build flow."
        : "BOX runtime is already active. ATLAS requested a refresh so the next live cycle can pick up the build.";
      await requestDaemonReload(config, "atlas-ready-session");
    } else {
      const launchSpec = await resolveRootBoxCliLaunchSpec(options.stateDir);
      const child = spawn(launchSpec.command, buildAtlasDaemonStartArgs(launchSpec.args, {
        sessionId: nextRecord.projectSessionId,
        projectId: nextRecord.projectId,
      }), {
        cwd: launchSpec.cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: launchSpec.env,
      });
      child.unref();
      nextRecord.triggerMode = "daemon";
      nextRecord.runnerPid = typeof child.pid === "number" && Number.isFinite(child.pid) ? child.pid : null;
      nextRecord.triggerState = "queued";
      nextRecord.triggerLabel = nextRecord.runnerPid
        ? "ATLAS started a BOX runtime bootstrap for this session and is waiting for daemon readiness."
        : "ATLAS queued this mission, but the BOX runtime start did not expose a live pid.";
    }
  } catch (error) {
    nextRecord.triggerState = "error";
    nextRecord.lastError = String((error as Error)?.message || error);
    nextRecord.triggerLabel = "ATLAS could not trigger the build runtime automatically.";
  }

  nextRecord.updatedAt = new Date().toISOString();
  await writeAtlasBuildRequest(options.stateDir, nextRecord);
  return nextRecord;
}

function derivePipelineFromMissionArtifacts(
  pipeline: AtlasRuntimePipelineSnapshot,
  missionArtifacts: AtlasMissionArtifactSnapshot | null,
): AtlasRuntimePipelineSnapshot {
  if (!missionArtifacts) {
    return pipeline;
  }

  const basePipeline = pipeline.stage.startsWith("workers_")
    && !isMissionDispatchActive(missionArtifacts)
    && (missionArtifacts.doneWorkerCount > 0 || missionArtifacts.completedPlans > 0)
    ? {
        ...pipeline,
        stage: "idle",
        stageLabel: "Idle",
        percent: 0,
        detail: missionArtifacts.doneWorkerCount > 0
          ? `${String(missionArtifacts.doneWorkerCount)} worker lanes already completed.`
          : `${String(missionArtifacts.completedPlans)} plan(s) already completed.`,
        completedAt: null,
      }
    : pipeline;
  const loopCount = basePipeline.loopCount;
  let candidate: AtlasRuntimePipelineSnapshot | null;

  if (missionArtifacts.completionStage === "completed" || missionArtifacts.completionFinalStatus === "completed") {
    candidate = createArtifactPipelineCandidate(
      { ...basePipeline, loopCount },
      "cycle_complete",
      "Cycle Complete",
      100,
      missionArtifacts.completionSummary || "The current cycle reached a completed state.",
      basePipeline.updatedAt,
    );
    return choosePipelineCandidate(basePipeline, candidate);
  }

  if (isMissionDispatchActive(missionArtifacts)) {
    candidate = createArtifactPipelineCandidate(
      { ...basePipeline, loopCount },
      missionArtifacts.activeWorkerCount > 0 ? "workers_running" : "workers_dispatching",
      missionArtifacts.activeWorkerCount > 0 ? "Workers Running" : "Dispatching Workers",
      missionArtifacts.activeWorkerCount > 0 ? 85 : 78,
      missionArtifacts.activeWorkerCount > 0
        ? `${String(missionArtifacts.activeWorkerCount)} worker lanes are currently running for this session.`
        : "Worker dispatch was recorded for this session.",
      missionArtifacts.dispatchUpdatedAt,
    );
    return choosePipelineCandidate(basePipeline, candidate);
  }

  if (missionArtifacts.athenaApproved === true || missionArtifacts.athenaSummary) {
    candidate = createArtifactPipelineCandidate(
      { ...basePipeline, loopCount },
      "athena_approved",
      "Athena Plan Approved",
      72,
      missionArtifacts.athenaSummary || "Athena approved the plan for this session.",
    );
    return choosePipelineCandidate(basePipeline, candidate);
  }

  if (missionArtifacts.prometheusPlanCount > 0) {
    candidate = createArtifactPipelineCandidate(
      { ...basePipeline, loopCount },
      "prometheus_done",
      "Prometheus Analysis Complete",
      60,
      `Prometheus recorded ${String(missionArtifacts.prometheusPlanCount)} plan item(s) for this session.`,
    );
    return choosePipelineCandidate(basePipeline, candidate);
  }

  const synthLogUpdatedAt = missionArtifacts.agentLogs.research_synthesizer?.updatedAt || null;
  if (missionArtifacts.researchSynthesisExists || isRecentTimestamp(synthLogUpdatedAt)) {
    const active = isRecentTimestamp(synthLogUpdatedAt);
    candidate = createArtifactPipelineCandidate(
      { ...basePipeline, loopCount },
      active ? "research_synthesis_running" : "research_synthesis_done",
      active ? "Research Synthesis Running" : "Research Synthesis Ready",
      active ? 44 : 48,
      active
        ? "Research Synthesizer is turning scout evidence into planning context for this session."
        : "Research synthesis is available for downstream planning.",
      synthLogUpdatedAt,
    );
    return choosePipelineCandidate(basePipeline, candidate);
  }

  const scoutLogUpdatedAt = missionArtifacts.agentLogs.research_scout?.updatedAt || null;
  if (missionArtifacts.researchScoutExists || isRecentTimestamp(scoutLogUpdatedAt)) {
    const active = isRecentTimestamp(scoutLogUpdatedAt);
    candidate = createArtifactPipelineCandidate(
      { ...basePipeline, loopCount },
      active ? "research_scout_running" : "research_scout_done",
      active ? "Research Scout Running" : "Research Scout Complete",
      active ? 30 : 36,
      active
        ? "Research Scout is collecting external evidence for this session."
        : "Scout findings were captured for this mission.",
      scoutLogUpdatedAt,
    );
    return choosePipelineCandidate(basePipeline, candidate);
  }

  if (missionArtifacts.jesusDirectiveExists) {
    candidate = createArtifactPipelineCandidate(
      { ...basePipeline, loopCount },
      "jesus_decided",
      "Jesus Decided",
      18,
      "Jesus directive was recorded for this session.",
    );
    return choosePipelineCandidate(basePipeline, candidate);
  }

  return basePipeline;
}

export async function buildAtlasRuntimeSnapshot(
  options: BuildAtlasRuntimeSnapshotOptions,
): Promise<AtlasRuntimeSnapshot | null> {
  const buildRequest = await readAtlasBuildRequest(options.stateDir);
  if (!options.session && !buildRequest) {
    return null;
  }

  const runtimeStateDir = await resolveAtlasRuntimeStateDir(options.stateDir);
  const focusedSessionBinding = options.session
    ? await resolveAtlasProjectBindingForSession(options.stateDir, options.session, buildRequest, {
        allowHeuristicMatch: false,
      })
    : null;
  const scopedBuildRequest = options.session
    ? buildSessionScopedBuildRequest(options.session, buildRequest, focusedSessionBinding)
    : buildRequest;
  const missionSessionId = scopedBuildRequest?.projectSessionId || null;

  const [sessionReadModel, rawPipeline, runtimeExecutionState, activeTargetBinding] = await Promise.all([
    readAtlasSessionReadModel({ stateDir: runtimeStateDir }),
    readPipelineProgress({ paths: { stateDir: runtimeStateDir } }) as Promise<Record<string, unknown>>,
    readRuntimeExecutionState(scopedBuildRequest, runtimeStateDir),
    readActiveTargetSessionBinding(runtimeStateDir),
  ]);
  const focusedSessionUsesActiveBuild = !options.session || (
    buildRequest?.sessionId === options.session.id
    && (!activeTargetBinding || (
      buildRequest?.projectId === activeTargetBinding.projectId
      && buildRequest?.projectSessionId === activeTargetBinding.projectSessionId
    ))
  );
  const focusedSessionHasScopedRunner = Boolean(
    options.session
    && focusedSessionBinding?.projectSessionId
    && (runtimeExecutionState.daemonRunning || runtimeExecutionState.requestRunnerAlive)
  );
  const focusedSessionUsesRuntime = focusedSessionUsesActiveBuild || focusedSessionHasScopedRunner;
  const missionArtifacts = focusedSessionUsesRuntime
    ? await readMissionArtifactSnapshot(runtimeStateDir, missionSessionId)
    : null;
  const effectiveBuildRequest: AtlasBuildRequestRecord | null = options.session && !focusedSessionUsesActiveBuild
    ? {
        ...scopedBuildRequest,
        triggerMode: focusedSessionHasScopedRunner ? "daemon" : scopedBuildRequest.triggerMode,
        triggerState: focusedSessionHasScopedRunner ? "running" : "queued",
        triggerLabel: focusedSessionHasScopedRunner
          ? "BOX runtime is actively processing this session in its own isolated runner."
          : scopedBuildRequest?.projectSessionId
            ? "This session is not the current live mission. Resume it to bring its runtime here."
            : "Resume this session to attach a live BOX mission.",
        runnerPid: focusedSessionHasScopedRunner ? (runtimeExecutionState.daemonPid || scopedBuildRequest.runnerPid || null) : null,
      }
    : scopedBuildRequest;
  const effectiveMissionArtifacts = focusedSessionUsesRuntime
    ? missionArtifacts
    : options.session && !focusedSessionUsesActiveBuild
    ? null
    : missionArtifacts;
  const rawPipelineSnapshot = formatPipelineSnapshot(rawPipeline);
  const scopedPipelineSeed = options.session && !focusedSessionUsesActiveBuild
    ? {
        ...rawPipelineSnapshot,
        stage: "idle",
        stageLabel: "Idle",
        percent: 0,
        detail: scopedBuildRequest?.projectSessionId
          ? "This session is not the current live mission. Resume it to bring its runtime here."
          : "Resume this session to start a live BOX mission.",
        updatedAt: scopedBuildRequest?.updatedAt || options.session.updatedAt || rawPipelineSnapshot.updatedAt,
        startedAt: null,
        completedAt: null,
      }
    : rawPipelineSnapshot;
  const pipeline = derivePipelineFromMissionArtifacts(scopedPipelineSeed, effectiveMissionArtifacts);
  const openSessions = focusedSessionUsesActiveBuild
    ? Object.values(sessionReadModel.openSessions).sort(compareAtlasSessionsForDesktop)
    : [];
  const runtimeRunning = focusedSessionUsesActiveBuild
    ? (runtimeExecutionState.daemonRunning || runtimeExecutionState.requestRunnerAlive)
    : focusedSessionHasScopedRunner
      ? true
    : false;
  const missionSession = options.session;
  const missionDesktopSessionId = effectiveBuildRequest?.sessionId || missionSession?.id || null;
  const missionProjectSessionId = effectiveBuildRequest?.projectSessionId || null;
  const missionCompleted = effectiveMissionArtifacts?.completionStage === "completed" || effectiveMissionArtifacts?.completionFinalStatus === "completed";
  const missionDispatchActive = isMissionDispatchActive(effectiveMissionArtifacts);
  const missionRuntimeActive = Boolean(
    focusedSessionUsesActiveBuild
    && effectiveMissionArtifacts
    && missionDispatchActive,
  );
  let reconciledBuildRequest = effectiveBuildRequest;
  if (focusedSessionUsesActiveBuild && effectiveBuildRequest && !effectiveBuildRequest.lastError) {
    if (effectiveBuildRequest.triggerState === "paused" && !runtimeRunning) {
      reconciledBuildRequest = await reconcileActiveBuildProjection(options.stateDir, effectiveBuildRequest, {
        triggerState: "paused",
        runnerPid: null,
        triggerLabel: effectiveBuildRequest.triggerLabel || "ATLAS paused this build mission for the selected session.",
      });
    } else if (missionCompleted || pipeline.stage === "cycle_complete") {
      reconciledBuildRequest = await reconcileActiveBuildProjection(options.stateDir, effectiveBuildRequest, {
        triggerState: "completed",
        runnerPid: null,
        triggerLabel: effectiveMissionArtifacts?.completionSummary || "BOX completed this build mission.",
      });
    } else if (!runtimeRunning && !missionRuntimeActive && !isPipelineActive(pipeline) && effectiveBuildRequest.triggerState === "running") {
      reconciledBuildRequest = await reconcileActiveBuildProjection(options.stateDir, effectiveBuildRequest, {
        triggerState: "queued",
        runnerPid: null,
        triggerLabel: "ATLAS is waiting for the live runtime to resume this mission.",
      });
    } else {
      const liveRunnerPid = runtimeExecutionState.daemonRunning
        ? runtimeExecutionState.daemonPid
        : runtimeExecutionState.requestRunnerAlive
          ? effectiveBuildRequest.runnerPid
          : null;
      if ((runtimeRunning || missionRuntimeActive || isPipelineActive(pipeline)) && (effectiveBuildRequest.triggerState !== "running" || effectiveBuildRequest.runnerPid !== liveRunnerPid)) {
        reconciledBuildRequest = await reconcileActiveBuildProjection(options.stateDir, effectiveBuildRequest, {
          triggerState: "running",
          runnerPid: liveRunnerPid ?? effectiveBuildRequest.runnerPid,
          triggerLabel: missionRuntimeActive
            ? "BOX runtime is actively processing this build mission."
            : isPipelineActive(pipeline)
              ? "BOX pipeline progress is active, so ATLAS is now monitoring the live build flow."
              : "BOX runtime is already active, so ATLAS is now monitoring the live build flow.",
        });
      }
    }
  }
  const agents = buildAtlasAgentNodes({ buildRequest: reconciledBuildRequest, pipeline, openSessions, missionArtifacts: effectiveMissionArtifacts, runtimeRunning });
  const sessionPremiumRequests = focusedSessionUsesActiveBuild
    || focusedSessionHasScopedRunner
    ? await readSessionPremiumRequestCount(runtimeStateDir, reconciledBuildRequest?.requestedAt || null, missionProjectSessionId)
    : null;

  return {
    mission: {
      sessionId: missionDesktopSessionId || missionProjectSessionId,
      desktopSessionId: missionDesktopSessionId,
      projectSessionId: missionProjectSessionId,
      title: missionSession?.title || effectiveBuildRequest?.title || "Waiting for build mission",
      objective: missionSession?.objective || effectiveBuildRequest?.objective || "ATLAS will show the next ready session here.",
      summary: missionSession?.summary || effectiveBuildRequest?.summary || "The next ready ATLAS session will become the live build mission.",
      requestedAt: effectiveBuildRequest?.requestedAt || missionSession?.updatedAt || null,
    },
    request: {
      state: reconciledBuildRequest?.triggerState === "paused"
        ? "paused"
        : missionCompleted || pipeline.stage === "cycle_complete"
        ? "completed"
        : reconciledBuildRequest?.lastError
          ? "error"
          : runtimeRunning || missionRuntimeActive || (reconciledBuildRequest?.triggerState === "running" && isPipelineActive(pipeline))
            ? "running"
            : (reconciledBuildRequest?.triggerState || "queued"),
      stateLabel: reconciledBuildRequest?.triggerState === "paused"
        ? getTriggerStateLabel("paused")
        : missionCompleted || pipeline.stage === "cycle_complete"
        ? getTriggerStateLabel("completed")
        : reconciledBuildRequest?.lastError
          ? getTriggerStateLabel("error")
          : runtimeRunning || missionRuntimeActive || (reconciledBuildRequest?.triggerState === "running" && isPipelineActive(pipeline))
            ? getTriggerStateLabel("running")
            : getTriggerStateLabel(reconciledBuildRequest?.triggerState || "queued"),
      triggerMode: reconciledBuildRequest?.triggerMode || null,
      triggerLabel: reconciledBuildRequest?.lastError
        ? reconciledBuildRequest.lastError
        : effectiveMissionArtifacts?.completionSummary
          ? effectiveMissionArtifacts.completionSummary
        : reconciledBuildRequest?.triggerLabel || "ATLAS is waiting for the live runtime to acknowledge the mission.",
      runnerPid: reconciledBuildRequest?.runnerPid || null,
      lastError: reconciledBuildRequest?.lastError || null,
    },
    pipeline,
    agents,
    defaultAgentId: resolveDefaultAgentId(agents, pipeline),
    sessionPremiumRequests,
    updatedAt: pipeline.updatedAt || effectiveMissionArtifacts?.dispatchUpdatedAt || effectiveBuildRequest?.updatedAt || missionSession?.updatedAt || null,
  };
}