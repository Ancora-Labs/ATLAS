import type { IncomingMessage, ServerResponse } from "node:http";

import { buildAtlasRuntimeSnapshot } from "../build_runtime.js";
import { readAtlasBuildRequest } from "../build_request_state.js";
import { listAtlasCompletedSessions } from "../completed_sessions.js";
import { resolveAtlasGitHubBootstrap } from "../github_auth.js";
import { renderAtlasHomeHtml, type AtlasPageData } from "../renderer.js";
import { readJsonSafe } from "../../core/fs_utils.js";
import { getActiveTargetSessionPath, getPlatformModeStatePath } from "../../core/mode_state.js";
import {
  getTargetClarificationPacketPath,
  getTargetIntentContractPath,
  getTargetSessionStateFilePath,
  listOpenTargetSessions,
} from "../../core/target_session_state.js";
import {
  archiveAtlasDesktopSession,
  getAtlasDesktopSessionStatusLabel,
  linkAtlasDesktopSessionToProjectSession,
  listAtlasDesktopSessions,
  MAX_ATLAS_DESKTOP_SESSIONS,
  upsertAtlasResolvedOnboardingSession,
  type AtlasDesktopSessionRecord,
} from "../desktop_sessions.js";
import { readAtlasDesktopRepoContext } from "../repository_context.js";
import type { AtlasDesktopRepoContext } from "../desktop_state.js";

type RuntimeSessionState = "active" | "stopped" | "onboarding" | "complete" | "attention";

function summarizeRuntimeStatus(
  session: AtlasDesktopSessionRecord,
  snapshot: Awaited<ReturnType<typeof buildAtlasRuntimeSnapshot>>,
  canonicalStage: string | null,
): { state: RuntimeSessionState; label: string; tone: "active" | "idle" | "complete" | "attention" } {
  if (session.status !== "ready") {
    return { state: "onboarding", label: getAtlasDesktopSessionStatusLabel(session.status), tone: "idle" };
  }
  const normalizedStage = String(canonicalStage || "").trim().toLowerCase();
  if (!snapshot) {
    return normalizedStage === "active"
      ? { state: "active", label: "Active", tone: "active" }
      : { state: "stopped", label: "Stopped", tone: "idle" };
  }
  if (snapshot.request.state === "error") {
    return { state: "attention", label: "Needs attention", tone: "attention" };
  }
  if (snapshot.request.state === "completed" || snapshot.pipeline.stage === "cycle_complete") {
    return { state: "complete", label: "Complete", tone: "complete" };
  }
  if (snapshot.request.state === "running" || normalizedStage === "active") {
    return { state: "active", label: "Active", tone: "active" };
  }
  return { state: "stopped", label: "Stopped", tone: "idle" };
}

export interface AtlasHomeRouteOptions {
  stateDir: string;
  targetRepo?: string;
  hostLabel?: string;
  shellCommand?: string;
  desktopSessionId?: string;
}

function normalizeRepoLabel(repoContext: AtlasDesktopRepoContext | null, targetRepo?: string): string {
  return repoContext?.targetRepo || String(targetRepo || "").trim() || "No repo selected";
}

function sortSessions(sessions: AtlasDesktopSessionRecord[]): AtlasDesktopSessionRecord[] {
  return [...sessions].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function resolveFocusedSessionId(sessions: AtlasDesktopSessionRecord[], requestedSessionId: string | null): string | null {
  const normalizedRequestedSessionId = String(requestedSessionId || "").trim();
  if (!normalizedRequestedSessionId) {
    return null;
  }
  return sessions.some((session) => session.id === normalizedRequestedSessionId)
    ? normalizedRequestedSessionId
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractAtlasDesktopSessionIdFromNotes(notes: unknown): string | null {
  if (!Array.isArray(notes)) {
    return null;
  }
  for (const note of notes) {
    const match = /^ATLAS desktop session id:\s*(.+)$/i.exec(String(note || "").trim());
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

async function readAtlasRecoveryPacket(
  stateDir: string,
  targetSession: any,
  atlasDesktopSessionId: string,
): Promise<Record<string, unknown>> {
  const projectId = normalizeOptionalString(targetSession?.projectId);
  const sessionId = normalizeOptionalString(targetSession?.sessionId);

  if (projectId && sessionId) {
    const intentContract = await readJsonSafe(getTargetIntentContractPath(stateDir, projectId, sessionId));
    if (intentContract.ok && isRecord(intentContract.data) && isRecord(intentContract.data.resolvedPacket)) {
      return {
        ...intentContract.data.resolvedPacket,
        sessionId: atlasDesktopSessionId || intentContract.data.resolvedPacket.sessionId,
      };
    }

    const clarificationPacket = await readJsonSafe(getTargetClarificationPacketPath(stateDir, projectId, sessionId));
    if (clarificationPacket.ok && isRecord(clarificationPacket.data)) {
      return {
        ...clarificationPacket.data,
        sessionId: atlasDesktopSessionId || clarificationPacket.data.sessionId,
      };
    }
  }

  const objective = normalizeOptionalString(targetSession?.objective?.summary) || "Recovered ATLAS session";
  const operatorIntentBrief = normalizeOptionalString(targetSession?.intent?.operatorIntentBrief)
    || normalizeOptionalString(targetSession?.objective?.desiredOutcome)
    || objective;
  return {
    sessionId: atlasDesktopSessionId,
    targetRepo: normalizeOptionalString(targetSession?.repo?.repoFullName)
      || normalizeOptionalString(targetSession?.repo?.name)
      || process.cwd(),
    repoMode: targetSession?.repo?.repoCreatedByBox === true ? "new" : "existing",
    objective,
    summary: objective,
    operatorIntentBrief,
    openQuestions: [],
    executionNotes: [],
    attachments: [],
    attachmentPlans: [],
    provider: "atlas-home-recovery",
    rawResponse: "",
    createdAt: normalizeOptionalString(targetSession?.lifecycle?.updatedAt) || new Date().toISOString(),
  };
}

function buildAtlasRepoContextFromTargetSession(targetSession: any): AtlasDesktopRepoContext {
  return {
    provider: "github",
    targetRepo: normalizeOptionalString(targetSession?.repo?.repoFullName)
      || normalizeOptionalString(targetSession?.repo?.name)
      || process.cwd(),
    targetBaseBranch: normalizeOptionalString(targetSession?.repo?.defaultBranch),
    repoMode: targetSession?.repo?.repoCreatedByBox === true ? "new" : "existing",
    repoCreatedByAtlas: targetSession?.repo?.repoCreatedByBox === true,
  };
}

async function rehydrateAtlasDesktopSessionsFromOpenTargets(
  stateDir: string,
  sessions: AtlasDesktopSessionRecord[],
): Promise<AtlasDesktopSessionRecord[]> {
  const openTargetSessions = await listOpenTargetSessions({ paths: { stateDir } });
  const [activeTargetPointer, platformModeState] = await Promise.all([
    readJsonSafe(getActiveTargetSessionPath(stateDir)),
    readJsonSafe(getPlatformModeStatePath(stateDir)),
  ]);
  const activeTargetSession = activeTargetPointer.ok && isRecord(activeTargetPointer.data)
    ? activeTargetPointer.data
    : null;
  const modeStateProjectId = platformModeState.ok && isRecord(platformModeState.data)
    ? normalizeOptionalString(platformModeState.data.activeTargetProjectId)
    : null;
  const modeStateSessionId = platformModeState.ok && isRecord(platformModeState.data)
    ? normalizeOptionalString(platformModeState.data.activeTargetSessionId)
    : null;
  const modeStateTargetSession = modeStateProjectId && modeStateSessionId
    ? await readJsonSafe(getTargetSessionStateFilePath(stateDir, modeStateProjectId, modeStateSessionId))
    : null;
  const resolvedModeStateTargetSession = modeStateTargetSession?.ok && isRecord(modeStateTargetSession.data)
    ? modeStateTargetSession.data
    : null;

  const candidateTargetSessions = [
    activeTargetSession,
    resolvedModeStateTargetSession,
    ...openTargetSessions,
  ].filter((session, index, all): session is Record<string, unknown> => {
    if (!isRecord(session)) {
      return false;
    }
    const projectId = normalizeOptionalString(session.projectId);
    const sessionId = normalizeOptionalString(session.sessionId);
    if (!projectId || !sessionId) {
      return false;
    }
    return all.findIndex((candidate) => (
      isRecord(candidate)
      && normalizeOptionalString(candidate.projectId) === projectId
      && normalizeOptionalString(candidate.sessionId) === sessionId
    )) === index;
  });
  const existingSessionIds = new Set(sessions.map((session) => session.id));
  const existingProjectBindings = new Set(
    sessions
      .map((session) => {
        const projectId = normalizeOptionalString(session.projectId);
        const projectSessionId = normalizeOptionalString(session.projectSessionId);
        return projectId && projectSessionId ? `${projectId}:${projectSessionId}` : null;
      })
      .filter((value): value is string => Boolean(value)),
  );

  let recoveredAny = false;
  for (const targetSession of candidateTargetSessions) {
    const projectId = normalizeOptionalString(targetSession?.projectId);
    const projectSessionId = normalizeOptionalString(targetSession?.sessionId);
    if (!projectId || !projectSessionId) {
      continue;
    }
    const projectKey = `${projectId}:${projectSessionId}`;
    if (existingProjectBindings.has(projectKey)) {
      continue;
    }

    const hints = isRecord(targetSession.hints) ? targetSession.hints : null;
    const objective = isRecord(targetSession.objective) ? targetSession.objective : null;
    const workspace = isRecord(targetSession.workspace) ? targetSession.workspace : null;
    const atlasDesktopSessionId = extractAtlasDesktopSessionIdFromNotes(hints?.notes)
      || normalizeOptionalString(targetSession?.atlasDesktopSessionId)
      || normalizeOptionalString((await readAtlasRecoveryPacket(stateDir, targetSession, "")).sessionId);
    if (!atlasDesktopSessionId || existingSessionIds.has(atlasDesktopSessionId)) {
      continue;
    }

    try {
      const packet = await readAtlasRecoveryPacket(stateDir, targetSession, atlasDesktopSessionId);
      const session = await upsertAtlasResolvedOnboardingSession({
        stateDir,
        sessionId: atlasDesktopSessionId,
        objective: normalizeOptionalString(objective?.summary) || normalizeOptionalString(packet.objective) || projectId,
        repoContext: buildAtlasRepoContextFromTargetSession(targetSession),
        packet: packet as any,
      });
      await linkAtlasDesktopSessionToProjectSession({
        stateDir,
        sessionId: session.id,
        projectId,
        projectSessionId,
        projectWorkspacePath: normalizeOptionalString(workspace?.path),
      });
      existingSessionIds.add(session.id);
      existingProjectBindings.add(projectKey);
      recoveredAny = true;
    } catch (error) {
      console.error(`[atlas] failed to recover desktop session for ${projectKey}: ${String((error as Error)?.message || error)}`);
    }
  }

  return recoveredAny
    ? sortSessions(await listAtlasDesktopSessions(stateDir))
    : sessions;
}

async function reconcileCompletedDesktopSessions(
  stateDir: string,
  sessions: AtlasDesktopSessionRecord[],
  completedSessions: Awaited<ReturnType<typeof listAtlasCompletedSessions>>,
): Promise<AtlasDesktopSessionRecord[]> {
  const openTargetSessions = await listOpenTargetSessions({ paths: { stateDir } });
  const [activeTargetPointer, platformModeState, activeBuildRequest] = await Promise.all([
    readJsonSafe(getActiveTargetSessionPath(stateDir)),
    readJsonSafe(getPlatformModeStatePath(stateDir)),
    readAtlasBuildRequest(stateDir),
  ]);
  const completedKeys = new Set(completedSessions.map((session) => `${session.projectId}:${session.sessionId}`));
  const protectedKeys = new Set(
    openTargetSessions
      .map((session) => {
        const projectId = normalizeOptionalString(session?.projectId);
        const projectSessionId = normalizeOptionalString(session?.sessionId);
        return projectId && projectSessionId ? `${projectId}:${projectSessionId}` : null;
      })
      .filter((value): value is string => Boolean(value)),
  );
  const activePointerProjectId = normalizeOptionalString(activeTargetPointer.ok && isRecord(activeTargetPointer.data)
    ? activeTargetPointer.data.projectId
    : null);
  const activePointerSessionId = normalizeOptionalString(activeTargetPointer.ok && isRecord(activeTargetPointer.data)
    ? activeTargetPointer.data.sessionId
    : null);
  if (activePointerProjectId && activePointerSessionId) {
    protectedKeys.add(`${activePointerProjectId}:${activePointerSessionId}`);
  }

  const modeStateProjectId = normalizeOptionalString(platformModeState.ok && isRecord(platformModeState.data)
    ? platformModeState.data.activeTargetProjectId
    : null);
  const modeStateSessionId = normalizeOptionalString(platformModeState.ok && isRecord(platformModeState.data)
    ? platformModeState.data.activeTargetSessionId
    : null);
  if (modeStateProjectId && modeStateSessionId) {
    protectedKeys.add(`${modeStateProjectId}:${modeStateSessionId}`);
  }

  const activeBuildSessionId = normalizeOptionalString(activeBuildRequest?.sessionId);
  const activeBuildProjectId = normalizeOptionalString(activeBuildRequest?.projectId);
  const activeBuildProjectSessionId = normalizeOptionalString(activeBuildRequest?.projectSessionId);
  const activeBuildProtectsSession = activeBuildRequest && activeBuildRequest.triggerState !== "completed";
  if (activeBuildProtectsSession && activeBuildProjectId && activeBuildProjectSessionId) {
    protectedKeys.add(`${activeBuildProjectId}:${activeBuildProjectSessionId}`);
  }

  const archiveCandidates = sessions.filter((session) => {
    if (activeBuildProtectsSession && activeBuildSessionId && session.id === activeBuildSessionId) {
      return false;
    }
    const projectId = String(session.projectId || "").trim();
    const projectSessionId = String(session.projectSessionId || "").trim();
    if (!projectId || !projectSessionId) {
      return false;
    }
    const projectKey = `${projectId}:${projectSessionId}`;
    return completedKeys.has(projectKey) && !protectedKeys.has(projectKey);
  });

  if (archiveCandidates.length === 0) {
    return sessions;
  }

  for (const session of archiveCandidates) {
    await archiveAtlasDesktopSession({
      stateDir,
      atlasDesktopSessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
    });
  }

  return sortSessions(await listAtlasDesktopSessions(stateDir));
}

function getLatestSessionTimestamp(sessions: AtlasDesktopSessionRecord[]): string | null {
  const timestamps = sessions
    .map((session) => session.updatedAt)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  return timestamps[0] || null;
}

function deriveAtlasHomeReadiness(
  sessions: AtlasDesktopSessionRecord[],
  repoContext: AtlasDesktopRepoContext | null,
): Pick<AtlasPageData, "homePrimaryActionLabel" | "homeReadinessHeading" | "homeReadinessDetail"> {
  return sessions.length > 0
    ? {
        homePrimaryActionLabel: "New Session",
        homeReadinessHeading: "Ready to continue",
        homeReadinessDetail: "Pick any tracked session from the left rail or open a fresh one from the same window.",
      }
    : {
        homePrimaryActionLabel: "New Session",
        homeReadinessHeading: "Ready to start",
        homeReadinessDetail: repoContext?.targetRepo
          ? `Selected project: ${repoContext.targetRepo}. Your next message will open ${repoContext.repoMode === "existing" ? "existing-project" : "new-project"} onboarding.`
            : "Write one concrete request. If you do not choose an existing project first, Atlas will ask for a new project name and description before it creates the repo.",
      };
}

export function writeAtlasHtmlResponse(res: ServerResponse, html: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function resolveRequestFocusSessionId(requestUrl: string | undefined): string | null {
  try {
    const parsedUrl = new URL(String(requestUrl || "/"), "http://127.0.0.1");
    return String(parsedUrl.searchParams.get("focusSession") || "").trim() || null;
  } catch {
    return null;
  }
}

export async function buildAtlasPageData(options: AtlasHomeRouteOptions, requestUrl?: string): Promise<AtlasPageData> {
  const authBootstrap = await resolveAtlasGitHubBootstrap(options.stateDir);
  const repoContext = await readAtlasDesktopRepoContext(options.stateDir);
  const completedSessions = await listAtlasCompletedSessions(options.stateDir);
  const liveSessions = await rehydrateAtlasDesktopSessionsFromOpenTargets(
    options.stateDir,
    sortSessions(await listAtlasDesktopSessions(options.stateDir)),
  );
  const sortedSessions = await reconcileCompletedDesktopSessions(
    options.stateDir,
    liveSessions,
    completedSessions,
  );
  const requestedFocusedSessionId = resolveRequestFocusSessionId(requestUrl);
  const focusedSessionId = resolveFocusedSessionId(sortedSessions, requestedFocusedSessionId);
  const focusedSession = focusedSessionId
    ? (sortedSessions.find((session) => session.id === focusedSessionId) || null)
    : null;
  const canonicalOpenTargetSessions = await listOpenTargetSessions({ paths: { stateDir: options.stateDir } });
  const canonicalSessionStages = Object.fromEntries(sortedSessions.flatMap((session) => {
    const match = canonicalOpenTargetSessions.find((entry) => (
      normalizeOptionalString(entry?.atlasDesktopSessionId) === session.id
    ) || (
      normalizeOptionalString(entry?.projectId) === normalizeOptionalString(session.projectId)
      && normalizeOptionalString(entry?.sessionId) === normalizeOptionalString(session.projectSessionId)
    ));
    const stage = normalizeOptionalString(match?.currentStage);
    return stage ? [[session.id, stage]] : [];
  }));
  const missingFocusedSnapshot = Boolean(requestedFocusedSessionId && !focusedSessionId);
  const latestSessionTimestamp = getLatestSessionTimestamp(sortedSessions);
  const hasLiveSessions = sortedSessions.length > 0;
  const readySessionSnapshots = await Promise.all(sortedSessions.map(async (session) => ({
    session,
    snapshot: session.status === "ready"
      ? await buildAtlasRuntimeSnapshot({ stateDir: options.stateDir, session })
      : null,
  })));
  const focusedSnapshot = focusedSession
    ? (readySessionSnapshots.find((entry) => entry.session.id === focusedSession.id)?.snapshot || null)
    : null;
  const runtimeSnapshot = focusedSession
    ? focusedSnapshot
    : null;
  const sessionRuntimeStatuses = Object.fromEntries(readySessionSnapshots.map((entry) => [
    entry.session.id,
    summarizeRuntimeStatus(entry.session, entry.snapshot, canonicalSessionStages[entry.session.id] || null),
  ]));
  const activeSessionCount = Object.values(sessionRuntimeStatuses).filter((entry) => entry.state === "active").length;

  const pageData = {
    title: "ATLAS Home",
    repoLabel: normalizeRepoLabel(repoContext, options.targetRepo),
    repoContext,
    hostLabel: String(options.hostLabel || "Windows host").trim() || "Windows host",
    shellCommand: String(options.shellCommand || ".\\ATLAS.cmd").trim() || ".\\ATLAS.cmd",
    updatedAt: latestSessionTimestamp,
    buildSessionId: options.desktopSessionId || "atlas-desktop",
    buildTimestamp: latestSessionTimestamp,
    sessionStartStatusLabel: hasLiveSessions ? "Tracked sessions available" : "Waiting for the first session",
    sessionStartStatusDetail: hasLiveSessions
      ? `Continue any tracked session from the left rail or open a fresh one. ATLAS keeps up to ${MAX_ATLAS_DESKTOP_SESSIONS} sessions active in this shell.`
      : (repoContext?.targetRepo
          ? `ATLAS will use ${repoContext.targetRepo} for the next session and switch into ${repoContext.repoMode === "existing" ? "existing-project" : "new-project"} onboarding.`
          : "No session has been created yet. Send a message and Atlas will ask for the new project name and description before it creates a fresh repo, or choose an existing repo first."),
    sessionStartUpdatedAt: latestSessionTimestamp,
    continuityStatusLabel: missingFocusedSnapshot ? "Focus target missing" : (hasLiveSessions ? "Session rail ready" : "No live sessions yet"),
    continuityStatusDetail: missingFocusedSnapshot
      ? "The previously focused session no longer exists in the current live rail, so ATLAS returned to the blank workspace."
      : (hasLiveSessions
          ? "The desktop shell keeps all tracked sessions in one responsive window without dropping older rows."
          : "The desktop shell is ready and will show tracked sessions here as soon as the first request is sent."),
    mainPaneMode: focusedSessionId ? "selected-session" : "new-session",
    focusedSessionId,
    missingFocusedSnapshot,
    runtimeSnapshot,
    githubAuth: authBootstrap.auth,
    copilotUsage: authBootstrap.copilotUsage,
    authRequired: authBootstrap.authRequired,
    maxTrackedSessions: MAX_ATLAS_DESKTOP_SESSIONS,
    activeSessionCount,
    canonicalSessionStages,
    sessionRuntimeStatuses,
    completedSessionCount: completedSessions.length,
    completedSessions,
    completedSession: null,
    focusedCompletedSessionKey: null,
    ...deriveAtlasHomeReadiness(sortedSessions, repoContext),
    sessions: sortedSessions,
  };
  return pageData as AtlasPageData;
}

export async function handleAtlasHomeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasHomeRouteOptions,
): Promise<void> {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>Method Not Allowed</h1></body></html>");
    return;
  }

  try {
    const pageData = await buildAtlasPageData(options, req.url);
    writeAtlasHtmlResponse(res, renderAtlasHomeHtml(pageData));
  } catch (error) {
    console.error(`[atlas] home route failed: ${String((error as Error)?.message || error)}`);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><h1>ATLAS Home unavailable</h1><p>Review the route logs and try again.</p></body></html>");
  }
}