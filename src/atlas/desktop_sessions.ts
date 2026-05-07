import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { READ_JSON_REASON, readJsonSafe, writeJson } from "../core/fs_utils.js";
import {
  clearDaemonPid,
  clearStopRequest,
  isProcessAlive,
  readDaemonPid,
  requestDaemonStop,
} from "../core/daemon_control.js";
import {
  persistAtlasSessionAttachments,
  type AtlasSessionAttachment,
  type AtlasSessionAttachmentInput,
  type AtlasSessionAttachmentKind,
} from "./attachments.js";
import {
  getAtlasClarificationPacketPath,
  resolveAtlasClarificationAttachmentPlans,
  syncAtlasClarificationPacketAttachments,
  createAtlasClarificationPacket,
  type AtlasClarificationAnswer,
  type AtlasClarificationPacket,
  type AtlasClarificationAttachmentPlan,
  type AtlasClarificationRunner,
} from "./clarification.js";
import {
  normalizeAtlasDesktopRepoContext,
  type AtlasDesktopRepoContext,
} from "./desktop_state.js";
import { resolveAtlasBuildRequestPath } from "./build_request_state.js";
import { resolveAtlasRuntimeStateDir } from "./runtime_state_root.js";
import { getPlatformModeStatePath } from "../core/mode_state.js";

export const MAX_ATLAS_DESKTOP_SESSIONS = 3;

export type AtlasDesktopMessageRole = "user" | "agent";
export type AtlasDesktopSessionStatus = "active" | "ready";

export interface AtlasDesktopSessionMessage {
  id: string;
  role: AtlasDesktopMessageRole;
  text: string;
  createdAt: string;
}

export interface AtlasDesktopSessionRecord {
  id: string;
  title: string;
  objective: string;
  summary: string;
  operatorIntentBrief: string;
  selectedModel?: string | null;
  projectId?: string | null;
  projectSessionId?: string | null;
  projectWorkspacePath?: string | null;
  projectName: string | null;
  projectDescription: string | null;
  repoContext: AtlasDesktopRepoContext | null;
  status: AtlasDesktopSessionStatus;
  openQuestions: string[];
  executionNotes: string[];
  attachments: AtlasSessionAttachment[];
  attachmentPlans: AtlasClarificationAttachmentPlan[];
  clarificationAnswers: AtlasClarificationAnswer[];
  pendingQuestionIndex: number | null;
  pendingQuestion: string | null;
  messages: AtlasDesktopSessionMessage[];
  createdAt: string;
  updatedAt: string;
}

interface AtlasDesktopSessionStore {
  schemaVersion: number;
  updatedAt: string | null;
  sessions: AtlasDesktopSessionRecord[];
}

export interface StartAtlasDesktopSessionOptions {
  stateDir: string;
  repoContext: AtlasDesktopRepoContext;
  message: string;
  sessionId?: string | null;
  selectedModel?: string | null;
  projectName?: string | null;
  projectDescription?: string | null;
  attachments?: AtlasSessionAttachmentInput[];
  clarificationCommand?: string;
  clarificationRunner?: AtlasClarificationRunner;
}

export interface UpsertAtlasResolvedOnboardingSessionOptions {
  stateDir: string;
  sessionId: string;
  objective: string;
  repoContext: AtlasDesktopRepoContext;
  packet: AtlasClarificationPacket;
}

export interface ContinueAtlasDesktopSessionOptions {
  stateDir: string;
  sessionId: string;
  message: string;
  attachments?: AtlasSessionAttachmentInput[];
  clarificationCommand?: string;
  clarificationRunner?: AtlasClarificationRunner;
}

export interface LinkAtlasDesktopSessionProjectBindingOptions {
  stateDir: string;
  sessionId: string;
  projectId: string | null;
  projectSessionId: string | null;
  projectWorkspacePath: string | null;
}

export interface DeleteAtlasDesktopSessionOptions {
  stateDir: string;
  sessionId: string;
}

export interface ArchiveAtlasDesktopSessionOptions {
  stateDir: string;
  projectId?: string | null;
  projectSessionId?: string | null;
  atlasDesktopSessionId?: string | null;
}

export class AtlasDesktopSessionError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "atlas_desktop_session_error") {
    super(message);
    this.name = "AtlasDesktopSessionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const ATLAS_DESKTOP_SESSION_STORE_SCHEMA_VERSION = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => normalizeString(entry)).filter(Boolean);
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function extractAtlasDesktopSessionIdFromNotes(notes: unknown): string | null {
  if (!Array.isArray(notes)) {
    return null;
  }
  for (const note of notes) {
    const match = /^ATLAS desktop session id:\s*(.+)$/i.exec(normalizeString(note));
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

function getTargetSessionStateFilePath(stateDir: string, projectId: string, sessionId: string): string {
  return path.join(stateDir, "projects", projectId, sessionId, "target_session.json");
}

function getTargetIntentContractPath(stateDir: string, projectId: string, sessionId: string): string {
  return path.join(stateDir, "projects", projectId, sessionId, "target_intent_contract.json");
}

function getTargetClarificationPacketPath(stateDir: string, projectId: string, sessionId: string): string {
  return path.join(stateDir, "projects", projectId, sessionId, "clarification_packet.json");
}

function buildRepoContextFromTargetSession(targetSession: Record<string, unknown>): AtlasDesktopRepoContext {
  const repo = isRecord(targetSession.repo) ? targetSession.repo : {};
  return {
    provider: "github",
    targetRepo: normalizeOptionalString(repo.repoFullName)
      || normalizeOptionalString(repo.name)
      || process.cwd(),
    targetBaseBranch: normalizeOptionalString(repo.defaultBranch),
    repoMode: repo.repoCreatedByBox === true ? "new" : "existing",
    repoCreatedByAtlas: repo.repoCreatedByBox === true,
  };
}

async function readDesktopRecoveryPacket(
  stateDir: string,
  targetSession: Record<string, unknown>,
  atlasDesktopSessionId: string,
): Promise<AtlasClarificationPacket> {
  const projectId = normalizeOptionalString(targetSession.projectId);
  const sessionId = normalizeOptionalString(targetSession.sessionId);
  if (projectId && sessionId) {
    const intentContract = await readJsonSafe(getTargetIntentContractPath(stateDir, projectId, sessionId));
    if (intentContract.ok && isRecord(intentContract.data) && isRecord(intentContract.data.resolvedPacket)) {
      const resolvedPacket = intentContract.data.resolvedPacket;
      const summary = normalizeOptionalString(resolvedPacket.summary)
        || normalizeOptionalString(intentContract.data.objectiveSummary)
        || normalizeOptionalString(targetSession.objective && isRecord(targetSession.objective) ? targetSession.objective.summary : null)
        || "Recovered ATLAS session";
      return {
        sessionId: atlasDesktopSessionId || normalizeString(resolvedPacket.sessionId),
        targetRepo: normalizeOptionalString(resolvedPacket.targetRepo)
          || buildRepoContextFromTargetSession(targetSession).targetRepo,
        repoMode: resolvedPacket.repoMode === "new" || resolvedPacket.repoMode === "existing" ? resolvedPacket.repoMode : null,
        objective: normalizeOptionalString(resolvedPacket.objective) || summary,
        summary,
        operatorIntentBrief: normalizeOptionalString(resolvedPacket.operatorIntentBrief) || summary,
        openQuestions: normalizeStringList(resolvedPacket.openQuestions),
        executionNotes: normalizeStringList(resolvedPacket.executionNotes),
        attachments: Array.isArray(resolvedPacket.attachments) ? resolvedPacket.attachments as AtlasSessionAttachment[] : [],
        attachmentPlans: Array.isArray(resolvedPacket.attachmentPlans) ? resolvedPacket.attachmentPlans as AtlasClarificationAttachmentPlan[] : [],
        provider: normalizeOptionalString(resolvedPacket.provider) || "atlas-runtime-recovery",
        rawResponse: normalizeString(resolvedPacket.rawResponse),
        createdAt: normalizeOptionalString(resolvedPacket.createdAt) || new Date().toISOString(),
      };
    }

    const clarificationPacket = await readJsonSafe(getTargetClarificationPacketPath(stateDir, projectId, sessionId));
    if (clarificationPacket.ok && isRecord(clarificationPacket.data)) {
      const packet = clarificationPacket.data;
      const summary = normalizeOptionalString(packet.summary)
        || normalizeOptionalString(packet.objective)
        || "Recovered ATLAS session";
      return {
        sessionId: atlasDesktopSessionId || normalizeString(packet.sessionId),
        targetRepo: normalizeOptionalString(packet.targetRepo)
          || buildRepoContextFromTargetSession(targetSession).targetRepo,
        repoMode: packet.repoMode === "new" || packet.repoMode === "existing" ? packet.repoMode : null,
        objective: normalizeOptionalString(packet.objective) || summary,
        summary,
        operatorIntentBrief: normalizeOptionalString(packet.operatorIntentBrief) || summary,
        openQuestions: normalizeStringList(packet.openQuestions),
        executionNotes: normalizeStringList(packet.executionNotes),
        attachments: Array.isArray(packet.attachments) ? packet.attachments as AtlasSessionAttachment[] : [],
        attachmentPlans: Array.isArray(packet.attachmentPlans) ? packet.attachmentPlans as AtlasClarificationAttachmentPlan[] : [],
        provider: normalizeOptionalString(packet.provider) || "atlas-runtime-recovery",
        rawResponse: normalizeString(packet.rawResponse),
        createdAt: normalizeOptionalString(packet.createdAt) || new Date().toISOString(),
      };
    }
  }

  const objective = isRecord(targetSession.objective)
    ? normalizeOptionalString(targetSession.objective.summary) || normalizeOptionalString(targetSession.objective.desiredOutcome)
    : null;
  const summary = objective || "Recovered ATLAS session";
  return {
    sessionId: atlasDesktopSessionId,
    targetRepo: buildRepoContextFromTargetSession(targetSession).targetRepo,
    repoMode: buildRepoContextFromTargetSession(targetSession).repoMode,
    objective: summary,
    summary,
    operatorIntentBrief: isRecord(targetSession.intent)
      ? normalizeOptionalString(targetSession.intent.operatorIntentBrief) || summary
      : summary,
    openQuestions: [],
    executionNotes: [],
    attachments: [],
    attachmentPlans: [],
    provider: "atlas-runtime-recovery",
    rawResponse: "",
    createdAt: new Date().toISOString(),
  };
}

async function readRuntimeTargetSessionCandidates(stateDir: string): Promise<Record<string, unknown>[]> {
  const candidates: Record<string, unknown>[] = [];
  const modeState = await readJsonSafe(path.join(stateDir, "platform", "mode_state.json"));
  const modeProjectId = modeState.ok && isRecord(modeState.data) ? normalizeOptionalString(modeState.data.activeTargetProjectId) : null;
  const modeSessionId = modeState.ok && isRecord(modeState.data) ? normalizeOptionalString(modeState.data.activeTargetSessionId) : null;
  if (modeProjectId && modeSessionId) {
    const targetSession = await readJsonSafe(getTargetSessionStateFilePath(stateDir, modeProjectId, modeSessionId));
    if (targetSession.ok && isRecord(targetSession.data)) {
      candidates.push(targetSession.data);
    }
  }

  const activeTargetSession = await readJsonSafe(path.join(stateDir, "active_target_session.json"));
  if (activeTargetSession.ok && isRecord(activeTargetSession.data)) {
    candidates.push(activeTargetSession.data);
  }

  const openTargetSessions = await readJsonSafe(path.join(stateDir, "open_target_sessions.json"));
  if (openTargetSessions.ok && Array.isArray(openTargetSessions.data)) {
    candidates.push(...openTargetSessions.data.filter(isRecord));
  }

  return candidates.filter((candidate, index, all) => {
    const projectId = normalizeOptionalString(candidate.projectId);
    const sessionId = normalizeOptionalString(candidate.sessionId);
    if (!projectId || !sessionId) {
      return false;
    }
    return all.findIndex((entry) => (
      normalizeOptionalString(entry.projectId) === projectId
      && normalizeOptionalString(entry.sessionId) === sessionId
    )) === index;
  });
}

export async function ensureAtlasRuntimeDesktopSessions(stateDir: string): Promise<AtlasDesktopSessionRecord[]> {
  const store = await readDesktopSessionStore(stateDir);
  const existingSessionIds = new Set(store.sessions.map((session) => session.id));
  const existingProjectBindings = new Set(store.sessions
    .map((session) => {
      const projectId = normalizeOptionalString(session.projectId);
      const projectSessionId = normalizeOptionalString(session.projectSessionId);
      return projectId && projectSessionId ? `${projectId}:${projectSessionId}` : null;
    })
    .filter((value): value is string => Boolean(value)));

  let recoveredAny = false;
  for (const targetSession of await readRuntimeTargetSessionCandidates(stateDir)) {
    const projectId = normalizeOptionalString(targetSession.projectId);
    const projectSessionId = normalizeOptionalString(targetSession.sessionId);
    if (!projectId || !projectSessionId) {
      continue;
    }
    const projectKey = `${projectId}:${projectSessionId}`;
    if (existingProjectBindings.has(projectKey)) {
      continue;
    }

    const atlasDesktopSessionId = extractAtlasDesktopSessionIdFromNotes(isRecord(targetSession.hints) ? targetSession.hints.notes : null)
      || normalizeOptionalString(targetSession.atlasDesktopSessionId);
    if (!atlasDesktopSessionId || existingSessionIds.has(atlasDesktopSessionId)) {
      continue;
    }

    const packet = await readDesktopRecoveryPacket(stateDir, targetSession, atlasDesktopSessionId);
    const session = await upsertAtlasResolvedOnboardingSession({
      stateDir,
      sessionId: atlasDesktopSessionId,
      objective: isRecord(targetSession.objective)
        ? normalizeOptionalString(targetSession.objective.summary) || packet.objective
        : packet.objective,
      repoContext: buildRepoContextFromTargetSession(targetSession),
      packet,
    });
    await linkAtlasDesktopSessionToProjectSession({
      stateDir,
      sessionId: session.id,
      projectId,
      projectSessionId,
      projectWorkspacePath: isRecord(targetSession.workspace) ? normalizeOptionalString(targetSession.workspace.path) : null,
    });
    existingSessionIds.add(session.id);
    existingProjectBindings.add(projectKey);
    recoveredAny = true;
  }

  return recoveredAny ? listAtlasDesktopSessions(stateDir) : [...store.sessions].sort(sortDesktopSessions);
}

function normalizeAttachmentKind(value: unknown): AtlasSessionAttachmentKind {
  const kind = normalizeString(value);
  if (kind === "image" || kind === "text" || kind === "document" || kind === "archive") {
    return kind;
  }
  return "other";
}

function normalizeAttachment(value: unknown): AtlasSessionAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id);
  const originalName = normalizeString(value.originalName);
  const storedName = normalizeString(value.storedName);
  const storedRelativePath = normalizeString(value.storedRelativePath);
  if (!id || !originalName || !storedName || !storedRelativePath) {
    return null;
  }

  return {
    id,
    originalName,
    storedName,
    storedRelativePath,
    mediaType: normalizeString(value.mediaType) || "application/octet-stream",
    byteSize: typeof value.byteSize === "number" && Number.isFinite(value.byteSize) ? value.byteSize : 0,
    kind: normalizeAttachmentKind(value.kind),
    sha256: normalizeString(value.sha256),
    roleHint: normalizeString(value.roleHint),
    textPreview: normalizeString(value.textPreview) || null,
    createdAt: normalizeString(value.createdAt) || new Date().toISOString(),
  };
}

function normalizeAttachmentPlan(value: unknown): AtlasClarificationAttachmentPlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const attachmentId = normalizeString(value.attachmentId);
  const attachmentName = normalizeString(value.attachmentName);
  const storedRelativePath = normalizeString(value.storedRelativePath);
  if (!attachmentId || !attachmentName || !storedRelativePath) {
    return null;
  }

  return {
    attachmentId,
    attachmentName,
    storedRelativePath,
    intendedUse: normalizeString(value.intendedUse),
    placementHint: normalizeString(value.placementHint),
    implementationNotes: normalizeStringList(value.implementationNotes),
  };
}

function normalizeMessage(value: unknown): AtlasDesktopSessionMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const text = normalizeString(value.text);
  if (!text) {
    return null;
  }

  return {
    id: normalizeString(value.id) || randomUUID(),
    role: normalizeString(value.role) === "agent" ? "agent" : "user",
    text,
    createdAt: normalizeString(value.createdAt) || new Date().toISOString(),
  };
}

function normalizeClarificationAnswer(value: unknown): AtlasClarificationAnswer | null {
  if (!isRecord(value)) {
    return null;
  }

  const question = normalizeString(value.question);
  const answer = normalizeString(value.answer);
  if (!question || !answer) {
    return null;
  }

  return { question, answer };
}

function normalizeStatus(value: unknown): AtlasDesktopSessionStatus {
  return normalizeString(value) === "ready" ? "ready" : "active";
}

function normalizePendingQuestionIndex(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeSessionRecord(value: unknown): AtlasDesktopSessionRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id);
  const title = normalizeString(value.title);
  const objective = normalizeString(value.objective);
  if (!id || !title || !objective) {
    return null;
  }

  const openQuestions = normalizeStringList(value.openQuestions);
  const pendingQuestionIndex = normalizePendingQuestionIndex(value.pendingQuestionIndex);
  const pendingQuestion = normalizeString(value.pendingQuestion) || (pendingQuestionIndex !== null
    ? (openQuestions[pendingQuestionIndex] || null)
    : null);

  return {
    id,
    title,
    objective,
    summary: normalizeString(value.summary),
    operatorIntentBrief: normalizeString(value.operatorIntentBrief),
    selectedModel: normalizeString(value.selectedModel) || null,
    projectId: normalizeString(value.projectId) || null,
    projectSessionId: normalizeString(value.projectSessionId) || null,
    projectWorkspacePath: normalizeString(value.projectWorkspacePath) || null,
    projectName: normalizeString(value.projectName) || null,
    projectDescription: normalizeString(value.projectDescription) || null,
    repoContext: normalizeAtlasDesktopRepoContext(value.repoContext),
    status: normalizeStatus(value.status),
    openQuestions,
    executionNotes: normalizeStringList(value.executionNotes),
    attachments: Array.isArray(value.attachments)
      ? value.attachments.map(normalizeAttachment).filter((attachment): attachment is AtlasSessionAttachment => attachment !== null)
      : [],
    attachmentPlans: Array.isArray(value.attachmentPlans)
      ? value.attachmentPlans.map(normalizeAttachmentPlan).filter((plan): plan is AtlasClarificationAttachmentPlan => plan !== null)
      : [],
    clarificationAnswers: Array.isArray(value.clarificationAnswers)
      ? value.clarificationAnswers.map(normalizeClarificationAnswer).filter((entry): entry is AtlasClarificationAnswer => entry !== null)
      : [],
    pendingQuestionIndex,
    pendingQuestion,
    messages: Array.isArray(value.messages)
      ? value.messages.map(normalizeMessage).filter((message): message is AtlasDesktopSessionMessage => message !== null)
      : [],
    createdAt: normalizeString(value.createdAt) || new Date().toISOString(),
    updatedAt: normalizeString(value.updatedAt) || new Date().toISOString(),
  };
}

function createEmptyStore(): AtlasDesktopSessionStore {
  return {
    schemaVersion: ATLAS_DESKTOP_SESSION_STORE_SCHEMA_VERSION,
    updatedAt: null,
    sessions: [],
  };
}

function createSessionTitle(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  if (compact.length <= 48) {
    return compact;
  }
  return `${compact.slice(0, 45).trimEnd()}...`;
}

function createMessage(role: AtlasDesktopMessageRole, text: string): AtlasDesktopSessionMessage {
  return {
    id: randomUUID(),
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

function buildSessionOperatorIntentBrief(session: AtlasDesktopSessionRecord): string {
  const answerDigest = buildClarificationAnswerDigest(session.clarificationAnswers);
  const lines = [
    normalizeString(session.operatorIntentBrief),
    normalizeString(session.summary),
    normalizeString(session.projectDescription),
    ...normalizeStringList(session.executionNotes),
    answerDigest ? `Confirmed operator answers: ${answerDigest}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return lines.join("\n").trim();
}

function recordClarificationAnswer(
  session: AtlasDesktopSessionRecord,
  answer: string,
): void {
  const question = normalizeString(session.pendingQuestion);
  if (!question) {
    return;
  }

  session.clarificationAnswers = [
    ...session.clarificationAnswers,
    {
      question,
      answer,
    },
  ];
}

function buildClarificationAnswerDigest(clarificationAnswers: AtlasClarificationAnswer[]): string | null {
  if (!clarificationAnswers.length) {
    return null;
  }

  const compactEntries = clarificationAnswers
    .map((entry) => {
      const question = normalizeString(entry.question).replace(/\?+$/g, "").trim();
      const answer = normalizeString(entry.answer);
      if (!question || !answer) {
        return null;
      }
      return `${question}: ${answer}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  if (!compactEntries.length) {
    return null;
  }

  return compactEntries.join(" | ");
}

function finalizeClarificationSession(session: AtlasDesktopSessionRecord): void {
  const answerDigest = buildClarificationAnswerDigest(session.clarificationAnswers);
  const executionNotes = normalizeStringList(session.executionNotes);

  if (answerDigest && !executionNotes.some((note) => /confirmed operator answers:/i.test(note))) {
    executionNotes.push(`Confirmed operator answers: ${answerDigest}`);
  }

  session.summary = normalizeString(session.summary)
    || normalizeString(session.projectDescription)
    || session.objective;
  session.operatorIntentBrief = buildSessionOperatorIntentBrief({
    ...session,
    summary: session.summary,
    executionNotes,
  });
  session.executionNotes = executionNotes;
  session.openQuestions = [];
  session.pendingQuestionIndex = null;
  session.pendingQuestion = null;
  session.status = "ready";
}

function countActiveSessions(sessions: AtlasDesktopSessionRecord[]): number {
  return sessions.filter((session) => session.status === "active").length;
}

function sortDesktopSessions(left: AtlasDesktopSessionRecord, right: AtlasDesktopSessionRecord): number {
  if (left.status !== right.status) {
    return left.status === "active" ? -1 : 1;
  }
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function resolveStorePath(stateDir: string): string {
  return path.join(stateDir, "atlas", "desktop_sessions.json");
}

function isSafeGeneratedWorkspacePath(workspacePath: string | null): boolean {
  if (!workspacePath) {
    return false;
  }
  const normalized = path.resolve(workspacePath).toLowerCase();
  return normalized.includes(`${path.sep}.box-target-workspaces${path.sep}`)
    && normalized.includes(`${path.sep}targets${path.sep}`);
}

async function readJsonObject(targetPath: string): Promise<Record<string, unknown> | null> {
  const result = await readJsonSafe(targetPath);
  return result.ok && isRecord(result.data) ? result.data : null;
}

function hasTerminalTargetCompletionArtifact(completion: Record<string, unknown> | null): boolean {
  if (!completion) {
    return false;
  }
  const normalizedStatus = normalizeString(completion.finalStatus || completion.status).toLowerCase();
  return ["completed", "fulfilled", "fulfilled_with_handoff", "success", "closed"].includes(normalizedStatus);
}

async function clearModeStateTargetPointerIfMatches(
  stateDir: string,
  projectId: string,
  projectSessionId: string,
): Promise<void> {
  const modeStatePath = getPlatformModeStatePath(stateDir);
  const modeStateResult = await readJsonSafe(modeStatePath);
  if (!modeStateResult.ok || !isRecord(modeStateResult.data)) {
    return;
  }
  const activeTargetProjectId = normalizeOptionalString(modeStateResult.data.activeTargetProjectId);
  const activeTargetSessionId = normalizeOptionalString(modeStateResult.data.activeTargetSessionId);
  if (activeTargetProjectId !== projectId || activeTargetSessionId !== projectSessionId) {
    return;
  }
  await writeJson(modeStatePath, {
    ...modeStateResult.data,
    activeTargetProjectId: null,
    activeTargetSessionId: null,
    updatedAt: new Date().toISOString(),
    reason: "atlas_session_deleted",
  });
}

function buildRuntimeControlConfig(
  stateDir: string,
  selection?: { projectId?: string | null; sessionId?: string | null } | null,
) {
  return selection?.sessionId
    ? {
        paths: { stateDir },
        daemonControlScope: {
          projectId: selection.projectId || null,
          sessionId: selection.sessionId || null,
        },
      }
    : {
        paths: { stateDir },
      };
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !isProcessAlive(pid);
}

async function stopRuntimeControlScope(config: any, reason: string): Promise<number | null> {
  const pidState = await readDaemonPid(config).catch(() => null);
  const pid = Number(pidState?.pid || 0);
  if (!(pid > 0)) {
    await clearDaemonPid(config).catch(() => {});
    await clearStopRequest(config).catch(() => {});
    return null;
  }

  if (!isProcessAlive(pid)) {
    await clearDaemonPid(config).catch(() => {});
    await clearStopRequest(config).catch(() => {});
    return null;
  }

  await clearStopRequest(config).catch(() => {});
  await requestDaemonStop(config, reason).catch(() => {});
  if (!(await waitForProcessExit(pid, 1200))) {
    try {
      process.kill(pid, "SIGKILL");
    } catch { /* already exited */ }
    await waitForProcessExit(pid, 300);
  }

  await clearDaemonPid(config).catch(() => {});
  await clearStopRequest(config).catch(() => {});
  return pid;
}

async function stopAtlasSessionRuntime(
  runtimeStateDir: string,
  session: AtlasDesktopSessionRecord,
  activeBuild: Record<string, unknown> | null,
  matchesActiveBuild: boolean,
): Promise<void> {
  const projectId = normalizeString(session.projectId);
  const projectSessionId = normalizeString(session.projectSessionId);
  let stoppedPid: number | null = null;

  if (projectId && projectSessionId) {
    stoppedPid = await stopRuntimeControlScope(
      buildRuntimeControlConfig(runtimeStateDir, { projectId, sessionId: projectSessionId }),
      `atlas-session-delete:${session.id}`,
    );
  }

  if (!stoppedPid && matchesActiveBuild) {
    stoppedPid = await stopRuntimeControlScope(
      buildRuntimeControlConfig(runtimeStateDir, null),
      `atlas-session-delete:${session.id}`,
    );
  }

  if (!stoppedPid) {
    const runnerPid = Number(activeBuild?.runnerPid || 0);
    if (runnerPid > 0 && isProcessAlive(runnerPid)) {
      try {
        process.kill(runnerPid, "SIGKILL");
      } catch { /* already exited */ }
    }
  }
}

async function removeAtlasSessionRuntimeArtifacts(stateDir: string, session: AtlasDesktopSessionRecord): Promise<void> {
  const runtimeStateDir = await resolveAtlasRuntimeStateDir(stateDir);
  const projectId = normalizeString(session.projectId);
  const projectSessionId = normalizeString(session.projectSessionId);
  let sessionHasCompletionArchive = false;

  const activeBuildPath = resolveAtlasBuildRequestPath(stateDir);
  const activeBuild = await readJsonObject(activeBuildPath);
  const matchesActiveBuild = normalizeString(activeBuild?.sessionId) === session.id
    || Boolean(
      projectId
      && projectSessionId
      && normalizeString(activeBuild?.projectId) === projectId
      && normalizeString(activeBuild?.projectSessionId) === projectSessionId,
    );
  await stopAtlasSessionRuntime(runtimeStateDir, session, activeBuild, matchesActiveBuild);
  if (matchesActiveBuild) {
    await fs.rm(activeBuildPath, { force: true }).catch(() => {});
  }

  if (projectId && projectSessionId) {
    const sessionStateDir = path.join(runtimeStateDir, "projects", projectId, projectSessionId);
    const completion = await readJsonObject(path.join(sessionStateDir, "target_completion.json"));
    sessionHasCompletionArchive = hasTerminalTargetCompletionArtifact(completion);

    const activeTargetPath = path.join(runtimeStateDir, "active_target_session.json");
    const activeTarget = await readJsonObject(activeTargetPath);
    if (normalizeString(activeTarget?.projectId) === projectId && normalizeString(activeTarget?.sessionId) === projectSessionId) {
      await fs.rm(activeTargetPath, { force: true }).catch(() => {});
    }

    await clearModeStateTargetPointerIfMatches(stateDir, projectId, projectSessionId);
    if (path.resolve(runtimeStateDir) !== path.resolve(stateDir)) {
      await clearModeStateTargetPointerIfMatches(runtimeStateDir, projectId, projectSessionId);
    }

    const openSessionsPath = path.join(runtimeStateDir, "open_target_sessions.json");
    const openSessionsResult = await readJsonSafe(openSessionsPath);
    if (openSessionsResult.ok && Array.isArray(openSessionsResult.data)) {
      const retained = openSessionsResult.data.filter((entry) => {
        if (!isRecord(entry)) {
          return true;
        }
        return !(normalizeString(entry.projectId) === projectId && normalizeString(entry.sessionId) === projectSessionId)
          && normalizeString(entry.atlasDesktopSessionId) !== session.id;
      });
      await writeJson(openSessionsPath, retained);
    }

    if (!sessionHasCompletionArchive) {
      await fs.rm(sessionStateDir, { recursive: true, force: true }).catch(() => {});
      await fs.rmdir(path.join(runtimeStateDir, "projects", projectId)).catch(() => {});
    }
  }

  if (!sessionHasCompletionArchive && isSafeGeneratedWorkspacePath(session.projectWorkspacePath || null)) {
    await fs.rm(String(session.projectWorkspacePath), { recursive: true, force: true }).catch(() => {});
  }

  await Promise.all([
    fs.rm(getAtlasClarificationPacketPath(stateDir, session.id), { force: true }).catch(() => {}),
    fs.rm(path.join(stateDir, "atlas", "desktop_sessions", session.id), { recursive: true, force: true }).catch(() => {}),
  ]);
}

async function readDesktopSessionStore(stateDir: string): Promise<AtlasDesktopSessionStore> {
  const result = await readJsonSafe(resolveStorePath(stateDir));
  if (!result.ok) {
    if (result.reason !== READ_JSON_REASON.MISSING && result.reason !== READ_JSON_REASON.INVALID) {
      throw new AtlasDesktopSessionError(
        `Failed to read desktop sessions: ${String(result.error?.message || result.error)}`,
        500,
        "desktop_sessions_read_failed",
      );
    }
    return createEmptyStore();
  }

  if (!isRecord(result.data) || !Array.isArray(result.data.sessions)) {
    return createEmptyStore();
  }

  return {
    schemaVersion: ATLAS_DESKTOP_SESSION_STORE_SCHEMA_VERSION,
    updatedAt: normalizeString(result.data.updatedAt) || null,
    sessions: result.data.sessions
      .map(normalizeSessionRecord)
      .filter((session): session is AtlasDesktopSessionRecord => session !== null)
      .sort(sortDesktopSessions),
  };
}

async function writeDesktopSessionStore(stateDir: string, store: AtlasDesktopSessionStore): Promise<void> {
  await writeJson(resolveStorePath(stateDir), {
    schemaVersion: ATLAS_DESKTOP_SESSION_STORE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    sessions: [...store.sessions].sort(sortDesktopSessions),
  });
}

function getSessionById(store: AtlasDesktopSessionStore, sessionId: string): AtlasDesktopSessionRecord | null {
  return store.sessions.find((session) => session.id === sessionId) || null;
}

function resolveWrapUpMessage(session: AtlasDesktopSessionRecord): string {
  return session.executionNotes[0]
    || session.summary
    || "Atlas has enough onboarding context to keep this session in the live rail.";
}

function buildStoredClarificationPacket(session: AtlasDesktopSessionRecord): AtlasClarificationPacket {
  return {
    sessionId: session.id,
    targetRepo: session.repoContext?.targetRepo || process.cwd(),
    repoMode: session.repoContext?.repoMode || null,
    objective: session.objective,
    summary: normalizeString(session.summary)
      || normalizeString(session.projectDescription)
      || session.objective,
    operatorIntentBrief: buildSessionOperatorIntentBrief(session),
    openQuestions: session.openQuestions.slice(0, 3),
    executionNotes: session.executionNotes,
    attachments: session.attachments,
    attachmentPlans: session.attachmentPlans,
    provider: "atlas-session-store-sync",
    rawResponse: "",
    createdAt: session.updatedAt || session.createdAt,
  };
}

async function syncClarificationPacketFromSession(
  stateDir: string,
  session: AtlasDesktopSessionRecord,
): Promise<void> {
  await writeJson(getAtlasClarificationPacketPath(stateDir, session.id), buildStoredClarificationPacket(session));
}

async function ensureClarificationPacketForSession(
  stateDir: string,
  session: AtlasDesktopSessionRecord,
): Promise<void> {
  const packetPath = getAtlasClarificationPacketPath(stateDir, session.id);
  const existingPacket = await readJsonSafe(packetPath);
  if (existingPacket.ok) {
    return;
  }
  if (existingPacket.reason !== READ_JSON_REASON.MISSING) {
    throw new AtlasDesktopSessionError(
      `Failed to read clarification packet: ${String(existingPacket.error?.message || existingPacket.error)}`,
      500,
      "clarification_packet_read_failed",
    );
  }

  await writeJson(packetPath, {
    ...buildStoredClarificationPacket(session),
    provider: "atlas-session-store-backfill",
    createdAt: session.createdAt,
  });
}

export function getAtlasDesktopSessionStatusLabel(status: AtlasDesktopSessionStatus): string {
  return status === "active" ? "Onboarding" : "Prepared";
}

export async function listAtlasDesktopSessions(stateDir: string): Promise<AtlasDesktopSessionRecord[]> {
  const store = await readDesktopSessionStore(stateDir);
  return [...store.sessions].sort(sortDesktopSessions);
}

export async function deleteAtlasDesktopSession(
  options: DeleteAtlasDesktopSessionOptions,
): Promise<{ deletedSession: AtlasDesktopSessionRecord; sessions: AtlasDesktopSessionRecord[] }> {
  const sessionId = normalizeString(options.sessionId);
  if (!sessionId) {
    throw new AtlasDesktopSessionError("Select a project before deleting it.", 400, "missing_session_id");
  }

  const store = await readDesktopSessionStore(options.stateDir);
  const session = getSessionById(store, sessionId);
  if (!session) {
    throw new AtlasDesktopSessionError("The selected session no longer exists.", 404, "session_not_found");
  }

  await removeAtlasSessionRuntimeArtifacts(options.stateDir, session);
  store.sessions = store.sessions.filter((entry) => entry.id !== session.id);
  await writeDesktopSessionStore(options.stateDir, store);
  return {
    deletedSession: session,
    sessions: [...store.sessions].sort(sortDesktopSessions),
  };
}

export async function archiveAtlasDesktopSession(
  options: ArchiveAtlasDesktopSessionOptions,
): Promise<AtlasDesktopSessionRecord[]> {
  const atlasDesktopSessionId = normalizeString(options.atlasDesktopSessionId);
  const projectId = normalizeString(options.projectId);
  const projectSessionId = normalizeString(options.projectSessionId);
  if (!atlasDesktopSessionId && !(projectId && projectSessionId)) {
    return [];
  }

  const store = await readDesktopSessionStore(options.stateDir);
  const archivedSessions = store.sessions.filter((session) => (
    atlasDesktopSessionId && session.id === atlasDesktopSessionId
  ) || (
    projectId
    && projectSessionId
    && normalizeString(session.projectId) === projectId
    && normalizeString(session.projectSessionId) === projectSessionId
  ));
  if (archivedSessions.length === 0) {
    return [];
  }

  for (const session of archivedSessions) {
    await removeAtlasSessionRuntimeArtifacts(options.stateDir, session);
  }

  const archivedIds = new Set(archivedSessions.map((session) => session.id));
  store.sessions = store.sessions.filter((session) => !archivedIds.has(session.id));
  await writeDesktopSessionStore(options.stateDir, store);
  return [...archivedSessions].sort(sortDesktopSessions);
}

export async function startAtlasDesktopSession(
  options: StartAtlasDesktopSessionOptions,
): Promise<AtlasDesktopSessionRecord> {
  const message = normalizeString(options.message);
  if (!message) {
    throw new AtlasDesktopSessionError("Write a concrete message before starting a session.", 400, "missing_message");
  }

  if (!options.repoContext?.targetRepo) {
    throw new AtlasDesktopSessionError("Select a repository context before starting a session.", 400, "missing_repo_context");
  }

  await ensureAtlasRuntimeDesktopSessions(options.stateDir);
  const store = await readDesktopSessionStore(options.stateDir);
  if (countActiveSessions(store.sessions) >= MAX_ATLAS_DESKTOP_SESSIONS) {
    throw new AtlasDesktopSessionError(
      `ATLAS can keep at most ${String(MAX_ATLAS_DESKTOP_SESSIONS)} active sessions at the same time.`,
      409,
      "active_session_limit_reached",
    );
  }

  const sessionId = normalizeString(options.sessionId) || randomUUID();
  let attachments: AtlasSessionAttachment[];
  let packet;
  try {
    attachments = options.attachments?.length
      ? await persistAtlasSessionAttachments(options.stateDir, sessionId, options.attachments)
      : [];
    packet = await createAtlasClarificationPacket({
      stateDir: options.stateDir,
      sessionId,
      targetRepo: options.repoContext.targetRepo,
      repoMode: options.repoContext.repoMode,
      objective: message,
      attachments,
      command: options.clarificationCommand,
      runner: options.clarificationRunner,
    });
  } catch (error) {
    throw new AtlasDesktopSessionError(
      String((error as Error)?.message || error),
      502,
      "clarification_start_failed",
    );
  }

  const firstQuestion = packet.openQuestions[0] || null;
  const now = new Date().toISOString();
  const projectName = normalizeString(options.projectName) || null;
  const projectDescription = normalizeString(options.projectDescription) || null;
  const session: AtlasDesktopSessionRecord = {
    id: sessionId,
    title: projectName || createSessionTitle(message),
    objective: message,
    summary: packet.summary,
    operatorIntentBrief: packet.operatorIntentBrief,
    selectedModel: normalizeString(options.selectedModel) || null,
    projectName,
    projectDescription,
    repoContext: options.repoContext,
    status: firstQuestion ? "active" : "ready",
    openQuestions: packet.openQuestions,
    executionNotes: packet.executionNotes,
    attachments,
    attachmentPlans: packet.attachmentPlans,
    clarificationAnswers: [],
    pendingQuestionIndex: firstQuestion ? 0 : null,
    pendingQuestion: firstQuestion,
    messages: [
      createMessage("user", message),
      createMessage("agent", firstQuestion || packet.summary),
    ],
    createdAt: now,
    updatedAt: now,
  };

  store.sessions = [session, ...store.sessions.filter((entry) => entry.id !== session.id)];
  await writeDesktopSessionStore(options.stateDir, store);
  return session;
}

export async function upsertAtlasResolvedOnboardingSession(
  options: UpsertAtlasResolvedOnboardingSessionOptions,
): Promise<AtlasDesktopSessionRecord> {
  const sessionId = normalizeString(options.sessionId);
  const objective = normalizeString(options.objective) || normalizeString(options.packet.objective);
  if (!sessionId) {
    throw new AtlasDesktopSessionError("ATLAS onboarding session id is missing.", 400, "missing_session_id");
  }
  if (!objective) {
    throw new AtlasDesktopSessionError("Write a concrete objective before starting Atlas.", 400, "missing_message");
  }

  const store = await readDesktopSessionStore(options.stateDir);
  const existingSession = getSessionById(store, sessionId);
  if (!existingSession && countActiveSessions(store.sessions) >= MAX_ATLAS_DESKTOP_SESSIONS) {
    throw new AtlasDesktopSessionError(
      `ATLAS can keep at most ${String(MAX_ATLAS_DESKTOP_SESSIONS)} active sessions at the same time.`,
      409,
      "active_session_limit_reached",
    );
  }

  const now = new Date().toISOString();
  const retainedQuestionNotes = normalizeStringList(options.packet.openQuestions)
    .map((question) => `Original onboarding question retained for planning: ${question}`);
  const executionNotes = [
    ...normalizeStringList(options.packet.executionNotes),
    ...retainedQuestionNotes,
  ];
  const session: AtlasDesktopSessionRecord = {
    id: sessionId,
    title: existingSession?.title || createSessionTitle(objective),
    objective,
    summary: normalizeString(options.packet.summary) || objective,
    operatorIntentBrief: normalizeString(options.packet.operatorIntentBrief) || normalizeString(options.packet.summary) || objective,
    selectedModel: existingSession?.selectedModel || null,
    projectId: existingSession?.projectId || null,
    projectSessionId: existingSession?.projectSessionId || null,
    projectWorkspacePath: existingSession?.projectWorkspacePath || null,
    projectName: existingSession?.projectName || null,
    projectDescription: existingSession?.projectDescription || null,
    repoContext: options.repoContext,
    status: "ready",
    openQuestions: [],
    executionNotes,
    attachments: Array.isArray(options.packet.attachments) ? options.packet.attachments : [],
    attachmentPlans: Array.isArray(options.packet.attachmentPlans) ? options.packet.attachmentPlans : [],
    clarificationAnswers: existingSession?.clarificationAnswers || [],
    pendingQuestionIndex: null,
    pendingQuestion: null,
    messages: existingSession?.messages?.length
      ? existingSession.messages
      : [
          createMessage("user", objective),
          createMessage("agent", normalizeString(options.packet.summary) || "ATLAS captured the onboarding packet."),
        ],
    createdAt: existingSession?.createdAt || options.packet.createdAt || now,
    updatedAt: now,
  };

  await syncClarificationPacketFromSession(options.stateDir, session);
  store.sessions = [session, ...store.sessions.filter((entry) => entry.id !== session.id)];
  await writeDesktopSessionStore(options.stateDir, store);
  return session;
}

export async function continueAtlasDesktopSession(
  options: ContinueAtlasDesktopSessionOptions,
): Promise<AtlasDesktopSessionRecord> {
  const message = normalizeString(options.message);
  if (!message) {
    throw new AtlasDesktopSessionError("Write a reply before sending it to Atlas.", 400, "missing_message");
  }

  const store = await readDesktopSessionStore(options.stateDir);
  const session = getSessionById(store, options.sessionId);
  if (!session) {
    throw new AtlasDesktopSessionError("The selected session no longer exists.", 404, "session_not_found");
  }

  const newAttachments = options.attachments?.length
    ? await persistAtlasSessionAttachments(options.stateDir, session.id, options.attachments)
    : [];
  if (newAttachments.length > 0) {
    session.attachments = [...session.attachments, ...newAttachments];
    const newPlans = resolveAtlasClarificationAttachmentPlans(newAttachments, []);
    session.attachmentPlans = [...session.attachmentPlans, ...newPlans];
    await syncAtlasClarificationPacketAttachments(options.stateDir, session.id, newAttachments, newPlans);
  }

  session.messages.push(createMessage("user", message));

  if (session.pendingQuestionIndex !== null) {
    recordClarificationAnswer(session, message);
    const nextQuestionIndex = session.pendingQuestionIndex + 1;
    const nextQuestion = session.openQuestions[nextQuestionIndex] || null;
    if (nextQuestion) {
      session.pendingQuestionIndex = nextQuestionIndex;
      session.pendingQuestion = nextQuestion;
      session.status = "active";
      session.messages.push(createMessage("agent", nextQuestion));
    } else {
      finalizeClarificationSession(session);
      session.messages.push(createMessage("agent", resolveWrapUpMessage(session)));
    }
  } else {
    session.status = "ready";
    session.messages.push(createMessage("agent", resolveWrapUpMessage(session)));
  }

  session.updatedAt = new Date().toISOString();
  await syncClarificationPacketFromSession(options.stateDir, session);
  await ensureClarificationPacketForSession(options.stateDir, session);
  await writeDesktopSessionStore(options.stateDir, store);
  return session;
}

export async function linkAtlasDesktopSessionToProjectSession(
  options: LinkAtlasDesktopSessionProjectBindingOptions,
): Promise<void> {
  const store = await readDesktopSessionStore(options.stateDir);
  const session = getSessionById(store, options.sessionId);
  if (!session) {
    return;
  }

  const nextProjectId = normalizeString(options.projectId) || null;
  const nextProjectSessionId = normalizeString(options.projectSessionId) || null;
  const nextProjectWorkspacePath = normalizeString(options.projectWorkspacePath) || null;
  if (
    session.projectId === nextProjectId
    && session.projectSessionId === nextProjectSessionId
    && session.projectWorkspacePath === nextProjectWorkspacePath
  ) {
    return;
  }

  session.projectId = nextProjectId;
  session.projectSessionId = nextProjectSessionId;
  session.projectWorkspacePath = nextProjectWorkspacePath;
  await writeDesktopSessionStore(options.stateDir, store);
}
