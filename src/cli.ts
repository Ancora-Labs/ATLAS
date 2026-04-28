import type { Config } from "./types/index.js";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "./config.js";
import { runOnce, runDaemon, runRebase, runResumeDispatch } from "./core/orchestrator.js";
import { runDoctor } from "./core/doctor.js";
import { loadPlatformModeState, PLATFORM_MODE, summarizePlatformModeState, updatePlatformModeState } from "./core/mode_state.js";
import { readSiControl, writeSiControl, isSelfImprovementActive, readSiLiveLog, siLogAsync } from "./core/si_control.js";
import { archiveActiveSessionForFreshActivation } from "./core/activation_flow.js";
import {
  archiveTargetSession,
  createTargetSession,
  getTargetSessionProgressLogPath,
  listOpenTargetSessions,
  loadActiveTargetSession,
  loadTargetSession,
  purgeAllTargetSessionArtifacts,
  saveActiveTargetSession,
  selectActiveTargetSession,
  summarizeActiveTargetSession,
  TARGET_SESSION_STAGE,
  transitionActiveTargetSession,
} from "./core/target_session_state.js";
import { getTargetClarificationRuntimeState, submitTargetClarificationAnswer } from "./core/clarification_runtime.js";
import { buildSingleTargetStartupGuardMessage, evaluateSingleTargetStartupRequirements } from "./core/single_target_startup_guard.js";
import { runTargetOnboarding } from "./core/onboarding_runner.js";
import {
  countRunningTargetSessionRunners,
  listTargetSessionRunnerStates,
  MAX_CONCURRENT_TARGET_SESSION_RUNNERS,
  findDaemonStartConflict,
  readDaemonPid,
  readStopRequest,
  isDaemonProcess,
  isProcessAlive,
  requestDaemonStop,
  requestDaemonReload,
  clearDaemonPid,
  clearStopRequest,
  clearAllAIState,
  killAllDaemonProcesses
} from "./core/daemon_control.js";

// ── box on: start dashboard + daemon in one command ──────────────────────────

function killByPort(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      const ps = spawn("powershell", [
        "-NoProfile", "-Command",
        `$c=Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; $c.OwningProcess}else{''}`
      ], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
      let out = "";
      ps.stdout.on("data", (d) => { out += d; });
      ps.on("close", () => {
        const pid = parseInt(out.trim(), 10);
        resolve(Number.isFinite(pid) && pid > 0 ? pid : null);
      });
      ps.on("error", () => resolve(null));
    } else {
      const fuser = spawn("fuser", [`${port}/tcp`], { stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      fuser.stdout.on("data", (d) => { out += d; });
      fuser.on("close", () => {
        const pid = parseInt(out.trim(), 10);
        if (Number.isFinite(pid) && pid > 0) {
          try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ }
          resolve(pid);
        } else {
          resolve(null);
        }
      });
      fuser.on("error", () => resolve(null));
    }
  });
}

function spawnDetached(command: string, args: string[], cwd: string): number | undefined {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return child.pid;
}

function savePid(stateDir: string, name: string, pid: number | undefined): void {
  const filePath = path.join(stateDir, `${name}.pid`);
  writeFileSync(filePath, String(pid), "utf8");
}

function readPid(stateDir: string, name: string): number | null {
  const filePath = path.join(stateDir, `${name}.pid`);
  try {
    if (existsSync(filePath)) {
      const pid = parseInt(readFileSync(filePath, "utf8").trim(), 10);
      return Number.isFinite(pid) && pid > 0 ? pid : null;
    }
  } catch { /* ignore */ }
  return null;
}

function removePidFile(stateDir: string, name: string): void {
  const filePath = path.join(stateDir, `${name}.pid`);
  try { unlinkSync(filePath); } catch { /* ignore */ }
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasArgFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function printTargetStatus(modeSummary: string, sessionSummary: string, readinessSummary?: string | null): void {
  console.log(`[box target] mode=${modeSummary}`);
  console.log(`[box target] session=${sessionSummary}`);
  if (readinessSummary) {
    console.log(`[box target] readiness=${readinessSummary}`);
  }
}

function getTargetSessionSelectionFromCli(): { sessionId: string | null; projectId: string | null } {
  return {
    sessionId: getArgValue("--session") || getArgValue("--session-id"),
    projectId: getArgValue("--project") || getArgValue("--project-id"),
  };
}

function bindTargetSessionSelector(config: Config, selection: { sessionId: string | null; projectId: string | null }): Config {
  if (!selection?.sessionId) {
    return config;
  }

  return Object.assign({}, config, {
    targetSessionSelector: {
      sessionId: selection.sessionId,
      projectId: selection.projectId,
    },
  });
}

async function resolveTargetSessionFromCli(config: Config) {
  const selection = getTargetSessionSelectionFromCli();
  if (selection.sessionId) {
    const session = await loadTargetSession(config, selection);
    if (!session) {
      throw new Error(`target session not found: ${selection.sessionId}`);
    }
    return session;
  }
  return loadActiveTargetSession(config);
}

function printTargetSessionLogPath(config: Config, session: any): void {
  const progressLogPath = session?.projectId && session?.sessionId
    ? getTargetSessionProgressLogPath(config.paths.stateDir, session.projectId, session.sessionId)
    : null;
  printProductField("progress log", progressLogPath || "none");
}

async function printTargetSessionList(config: Config): Promise<void> {
  const selectedSession = await loadActiveTargetSession(config);
  const openSessions = await listOpenTargetSessions(config);
  const runnerStates = await listTargetSessionRunnerStates(config);
  printProductHeader("BOX Target Sessions", "Open target sessions and their per-session logs");
  if (openSessions.length === 0) {
    printProductField("sessions", "none");
    return;
  }

  for (const session of openSessions) {
    const isSelected = String(session?.sessionId || "") === String(selectedSession?.sessionId || "");
    const runnerState = runnerStates.find((entry) => String(entry?.sessionId || "") === String(session?.sessionId || "") && String(entry?.projectId || "") === String(session?.projectId || ""));
    console.log(`[box target] ${isSelected ? "selected" : "open"} project=${String(session?.projectId || "unknown")} session=${String(session?.sessionId || "unknown")} stage=${String(session?.currentStage || "unknown")} runner=${runnerState ? `pid=${runnerState.pid}` : "stopped"} repo=${String(session?.repo?.repoUrl || session?.repo?.localPath || "unknown")}`);
    printTargetSessionLogPath(config, session);
  }
}

async function spawnTargetSessionRunner(config: Config, session: any): Promise<number | undefined> {
  const runningCount = await countRunningTargetSessionRunners(config);
  if (runningCount >= MAX_CONCURRENT_TARGET_SESSION_RUNNERS) {
    throw new Error(`target session runner limit reached (${MAX_CONCURRENT_TARGET_SESSION_RUNNERS})`);
  }

  const root = path.resolve(config.paths?.stateDir || "state", "..");
  return spawnDetached(
    "node",
    [
      "--import",
      "tsx",
      "src/cli.ts",
      "start",
      "--session",
      String(session.sessionId),
      "--project",
      String(session.projectId),
    ],
    root,
  );
}

async function summarizeTargetReadinessState(config: Config): Promise<string | null> {
  const filePath = path.join(config.paths.stateDir, "last_target_project_readiness.json");
  try {
    if (!existsSync(filePath)) return null;
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    const status = String(raw?.status || "unknown");
    const projectReadiness = String(raw?.dimensions?.projectReadiness?.status || "unknown");
    const researchSaturation = String(raw?.dimensions?.researchSaturation?.status || "unknown");
    const blockers = Array.isArray(raw?.blockers) ? raw.blockers.join(",") : "none";
    return `status=${status} | projectReadiness=${projectReadiness} | researchSaturation=${researchSaturation} | blockers=${blockers || "none"}`;
  } catch {
    return null;
  }
}

function printProductHeader(title: string, subtitle?: string | null): void {
  console.log("");
  console.log(`=== ${title} ===`);
  if (subtitle) {
    console.log(subtitle);
  }
}

function printProductField(label: string, value: unknown): void {
  console.log(`${label}: ${String(value ?? "-")}`);
}

function humanizeMode(mode: unknown): string {
  return String(mode || "unknown").replace(/_/g, " ");
}

function resolveModeAlias(value: unknown): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "status") return null;
  if (["self", "self-dev", "self_dev", "default"].includes(normalized)) {
    return PLATFORM_MODE.SELF_DEV;
  }
  if (["target", "single-target", "single_target", "single_target_delivery"].includes(normalized)) {
    return PLATFORM_MODE.SINGLE_TARGET_DELIVERY;
  }
  if (["idle"].includes(normalized)) {
    return PLATFORM_MODE.IDLE;
  }
  return "invalid";
}

async function printModeScreen(config: Config): Promise<void> {
  const modeState = await loadPlatformModeState(config);
  const session = await loadActiveTargetSession(config);
  printProductHeader("BOX Mode", "Simple mode switch surface");
  printProductField("current", humanizeMode(modeState.currentMode));
  printProductField("fallback", humanizeMode(modeState.fallbackModeAfterCompletion));
  printProductField("single target enabled", modeState.singleTargetDeliveryEnabled === true ? "yes" : "no");
  printProductField("active target session", session?.sessionId || "none");
  if (session?.objective?.summary) {
    printProductField("target objective", session.objective.summary);
  }
  if (Array.isArray(modeState.warnings) && modeState.warnings.length > 0) {
    printProductField("warnings", modeState.warnings.join(" | "));
  }
}

async function setPlatformModeFromCli(config: Config, modeValue: string): Promise<void> {
  const requestedMode = resolveModeAlias(modeValue);
  if (requestedMode === "invalid") {
    throw new Error(`unknown mode: ${modeValue}`);
  }
  if (!requestedMode) {
    await printModeScreen(config);
    return;
  }

  if (requestedMode === PLATFORM_MODE.SINGLE_TARGET_DELIVERY) {
    if (!(await ensureSingleTargetStartupReady(config, { forceSingleTarget: true }))) {
      return;
    }
    const activeSession = await loadActiveTargetSession(config);
    if (!activeSession) {
      console.error("[box mode] no active target session. Use: node --import tsx src/cli.ts activate --manifest <path>");
      return;
    }
    await updatePlatformModeState(config, {
      currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
      activeTargetSessionId: activeSession.sessionId,
      activeTargetProjectId: activeSession.projectId,
      fallbackModeAfterCompletion: PLATFORM_MODE.IDLE,
      reason: "cli_mode_switch:single_target_delivery",
    }, activeSession);
  } else if (requestedMode === PLATFORM_MODE.SELF_DEV) {
    await updatePlatformModeState(config, {
      currentMode: PLATFORM_MODE.SELF_DEV,
      activeTargetSessionId: null,
      activeTargetProjectId: null,
      fallbackModeAfterCompletion: PLATFORM_MODE.SELF_DEV,
      reason: "cli_mode_switch:self_dev",
    }, null);
  } else {
    await updatePlatformModeState(config, {
      currentMode: requestedMode,
      reason: `cli_mode_switch:${requestedMode}`,
    });
  }

  await printModeScreen(config);
}

async function printActivationScreen(config: Config, session?: any | null): Promise<void> {
  const activeSession = session || await loadActiveTargetSession(config);
  const modeState = await loadPlatformModeState(config);
  printProductHeader("BOX Activate", "Single-target activation flow");
  printProductField("mode", humanizeMode(modeState.currentMode));
  if (!activeSession) {
    printProductField("status", "no active target session");
    console.log("next: node --import tsx src/cli.ts activate --manifest <path>");
    return;
  }

  printProductField("session", activeSession.sessionId);
  printProductField("stage", humanizeMode(activeSession.currentStage));
  printProductField("repo", activeSession.repo?.repoUrl || activeSession.repo?.localPath || "unknown");
  printProductField("objective", activeSession.objective?.summary || "unknown");
  printProductField("repo state", activeSession.intent?.repoState || activeSession.repoProfile?.repoState || "unknown");

  if (activeSession.currentStage === TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION) {
    const runtime = await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    const currentQuestion = runtime?.currentQuestion;
    printProductField("activation", "clarification required");
    if (currentQuestion) {
      printProductField("question", currentQuestion.title || currentQuestion.id);
      printProductField("prompt", currentQuestion.prompt || "-");
      if (Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0) {
        printProductField("options", currentQuestion.options.join(" | "));
      }
      console.log("answer: interactive terminalde dogrudan cevap verebilir veya node --import tsx src/cli.ts activate --answer \"...\" [--options \"A,B\"] kullanabilirsiniz");
    }
    return;
  }

  if (activeSession.currentStage === TARGET_SESSION_STAGE.SHADOW || activeSession.currentStage === TARGET_SESSION_STAGE.ACTIVE) {
    printProductField("activation", "planning ready");
    printProductField("next", activeSession.handoff?.nextAction || "run planning");
    return;
  }

  printProductField("activation", activeSession.handoff?.nextAction || "waiting");
}

async function handleActivationCommand(config: Config): Promise<void> {
  if (!(await ensureSingleTargetStartupReady(config, { forceSingleTarget: true }))) {
    return;
  }

  const manifestPath = getArgValue("--manifest");
  const answerText = getArgValue("--answer");
  const questionId = getArgValue("--question-id");
  const selectedOptions = getArgValue("--options");
  const interactiveEnabled = !process.argv.includes("--no-interactive");
  const deleteRepoOnRestart = hasArgFlag("--delete-repo");
  const replaceActive = hasArgFlag("--replace-active");
  const selectNewSession = replaceActive || hasArgFlag("--select");
  const existingSelectedSession = await loadActiveTargetSession(config);

  if (hasArgFlag("--restart") && (answerText || selectedOptions || manifestPath)) {
    throw new Error("--restart cannot be combined with --manifest, --answer, or --options");
  }
  if (deleteRepoOnRestart && !hasArgFlag("--restart")) {
    throw new Error("--delete-repo can only be used with --restart");
  }

  if (manifestPath) {
    const resolvedManifestPath = path.resolve(manifestPath);
    const manifest = JSON.parse(readFileSync(resolvedManifestPath, "utf8"));
    if (replaceActive) {
      await archiveActiveSessionForFreshActivation(config, {
        reason: "activate_manifest_requested_fresh_session",
        completionSummary: "Activation archived the previous target session before opening a new manifest-driven session.",
      });
    }
    const willSelectNewSession = selectNewSession || !existingSelectedSession;
    const session = await createTargetSession(manifest, config, { selectAsActive: willSelectNewSession });
    const onboardingResult = await runTargetOnboarding(config, session);
    const finalSession = interactiveEnabled && isInteractiveTerminal() && willSelectNewSession
      ? await runInteractiveClarificationSession(config, onboardingResult.session)
      : onboardingResult.session;
    await printActivationScreen(config, finalSession);
    if (existingSelectedSession && !willSelectNewSession) {
      console.log(`[box activate] opened session=${finalSession.sessionId} without replacing selected active session=${existingSelectedSession.sessionId}`);
      console.log(`[box activate] select later: node --import tsx src/cli.ts target select --session ${finalSession.sessionId} --project ${finalSession.projectId}`);
    }
    return;
  }

  if (answerText || selectedOptions) {
    const result = await submitTargetClarificationAnswer(config, {
      questionId,
      answerText,
      selectedOptions,
      answeredBy: "user",
    });
    const finalSession = interactiveEnabled && isInteractiveTerminal()
      ? await runInteractiveClarificationSession(config, result.session)
      : result.session;
    await printActivationScreen(config, finalSession);
    return;
  }

  if (interactiveEnabled && isInteractiveTerminal()) {
    if (replaceActive) {
      await archiveActiveSessionForFreshActivation(config, {
        reason: "activate_interactive_requested_fresh_session",
        completionSummary: "Activation archived the previous target session before opening a new interactive onboarding session.",
      });
    }
    const wizardResult = await runInteractiveActivationWizard(config);
    const willSelectNewSession = selectNewSession || !existingSelectedSession;
    const session = await createTargetSession(wizardResult.manifest, config, { selectAsActive: willSelectNewSession });
    const onboardingResult = await runTargetOnboarding(config, session);
    const finalSession = willSelectNewSession
      ? await runInteractiveClarificationSession(config, onboardingResult.session)
      : onboardingResult.session;
    if (wizardResult.createdRepo?.full_name) {
      printProductField("created repo", String(wizardResult.createdRepo.full_name));
    }
    await printActivationScreen(config, finalSession);
    if (existingSelectedSession && !willSelectNewSession) {
      console.log(`[box activate] opened session=${finalSession.sessionId} without replacing selected active session=${existingSelectedSession.sessionId}`);
      console.log(`[box activate] select later: node --import tsx src/cli.ts target select --session ${finalSession.sessionId} --project ${finalSession.projectId}`);
    }
    return;
  }

  if (hasArgFlag("--restart")) {
    await restartActiveTargetSession(config, {
      reason: hasArgFlag("--delete-repo") ? "restart_flag_requested_delete_repo" : "restart_flag_requested",
      deleteRemoteRepo: hasArgFlag("--delete-repo"),
    });
    await printActivationScreen(config);
    return;
  }

  await printActivationScreen(config);
}

function printClarificationState(runtime: any): void {
  const currentQuestion = runtime?.currentQuestion;
  const intentSummary = runtime?.intentSummary || runtime?.session?.intent || {};
  console.log(`[box clarify] stage=${runtime?.session?.currentStage || "unknown"} status=${runtime?.session?.clarification?.status || "pending"} intent=${intentSummary?.status || "pending"}`);
  if (intentSummary?.summary) {
    console.log(`[box clarify] summary=${intentSummary.summary}`);
  }
  if (!currentQuestion) {
    console.log("[box clarify] no pending clarification question");
    return;
  }
  console.log(`[box clarify] questionId=${currentQuestion.id}`);
  console.log(`[box clarify] title=${currentQuestion.title || currentQuestion.id}`);
  console.log(`[box clarify] prompt=${currentQuestion.prompt || "(none)"}`);
  if (Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0) {
    console.log(`[box clarify] options=${currentQuestion.options.join(" | ")}`);
  }
}

async function ensureSingleTargetStartupReady(config: Config, options: { forceSingleTarget?: boolean } = {}): Promise<boolean> {
  const result = await evaluateSingleTargetStartupRequirements(config, options);
  if (result.ok) return true;
  console.error(buildSingleTargetStartupGuardMessage(result));
  return false;
}

function isInteractiveTerminal(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

async function promptInput(promptText: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return String(await rl.question(promptText)).trim();
  } finally {
    rl.close();
  }
}

async function promptRequired(promptText: string): Promise<string> {
  while (true) {
    const answer = await promptInput(promptText);
    if (answer) return answer;
  }
}

async function promptChoice(promptText: string, allowed: string[], fallback?: string): Promise<string> {
  const normalizedAllowed = allowed.map((entry) => String(entry || "").trim().toLowerCase());
  while (true) {
    const answer = String(await promptInput(promptText) || fallback || "").trim().toLowerCase();
    if (normalizedAllowed.includes(answer)) {
      return answer;
    }
  }
}

function isOtherClarificationOption(value: string): boolean {
  return /^(other|custom|something else|başka|diger|diğer)(\b|\s|$)/i.test(String(value || "").trim());
}

function parseClarificationOptionSelection(rawAnswer: string, options: string[]): { answerText: string; selectedOptions: string[] } {
  const trimmedAnswer = String(rawAnswer || "").trim();
  if (!trimmedAnswer || !Array.isArray(options) || options.length === 0) {
    return { answerText: trimmedAnswer, selectedOptions: [] };
  }

  const normalizedOptions = options.map((option) => String(option || "").trim()).filter(Boolean);
  const optionMap = new Map<string, string>();
  normalizedOptions.forEach((option, index) => {
    optionMap.set(option.toLowerCase(), option);
    optionMap.set(String(index + 1), option);
  });

  const tokens = trimmedAnswer.split(/[|,]/).map((entry) => entry.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return { answerText: trimmedAnswer, selectedOptions: [] };
  }

  const matchedOptions = tokens
    .map((token) => optionMap.get(token.toLowerCase()) || null)
    .filter((value): value is string => Boolean(value));

  if (matchedOptions.length === tokens.length) {
    return {
      answerText: "",
      selectedOptions: [...new Set(matchedOptions)],
    };
  }

  return { answerText: trimmedAnswer, selectedOptions: [] };
}

function hasClarificationUserAnswers(transcript: any): boolean {
  return Array.isArray(transcript?.turns)
    && transcript.turns.some((turn: any) => turn?.actor === "user" && turn?.kind === "answer");
}

function printCleanClarificationQuestion(runtime: any, currentQuestion: any): void {
  const openingPrompt = String(runtime?.packet?.openingPrompt || "").trim();
  const prompt = String(currentQuestion?.prompt || currentQuestion?.title || currentQuestion?.id || "What should ATLAS do?").trim();
  const isFirstTurn = !hasClarificationUserAnswers(runtime?.transcript);
  if (isFirstTurn && openingPrompt) {
    console.log(`\nATLAS: ${openingPrompt}`);
  }
  if (!(isFirstTurn && openingPrompt && openingPrompt === prompt)) {
    console.log(`\nATLAS: ${prompt}`);
  }
  const options = Array.isArray(currentQuestion?.options)
    ? currentQuestion.options.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (options.length > 0) {
    for (let index = 0; index < options.length; index += 1) {
      console.log(`${index + 1}. ${options[index]}`);
    }
  }
}

async function runInteractiveClarificationSession(config: Config, session?: any | null): Promise<any> {
  let currentSession = session || await loadActiveTargetSession(config);
  while (currentSession?.currentStage === TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION) {
    const runtime = await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    const currentQuestion = runtime?.currentQuestion;
    if (!currentQuestion) {
      return runtime?.session || currentSession;
    }
    printCleanClarificationQuestion(runtime, currentQuestion);
    const options = Array.isArray(currentQuestion.options)
      ? currentQuestion.options.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
      : [];
    const rawAnswer = await promptRequired("You: ");
    const parsedAnswer = parseClarificationOptionSelection(rawAnswer, options);
    if (parsedAnswer.selectedOptions.some((option) => isOtherClarificationOption(option)) && !parsedAnswer.answerText) {
      parsedAnswer.answerText = await promptRequired("You: ");
    }
    const result = await submitTargetClarificationAnswer(config, {
      questionId: currentQuestion.id,
      answerText: parsedAnswer.answerText,
      selectedOptions: parsedAnswer.selectedOptions,
      answeredBy: "user",
    });
    currentSession = result.session;
  }

  return currentSession;
}

async function restartActiveTargetSession(
  config: Config,
  options: {
    reason?: string;
    deleteRemoteRepo?: boolean;
    completionSummary?: string;
  } = {},
): Promise<void> {
  const activeSession = await loadActiveTargetSession(config);
  if (!activeSession) {
    return;
  }

  const reason = options.reason || "restart_requested_from_activate";
  const deleteRemoteRepo = options.deleteRemoteRepo === true;

  if (deleteRemoteRepo) {
    const repoFullName = String(activeSession?.repo?.repoFullName || "").trim();
    if (!canDeleteSessionRepo(activeSession)) {
      throw new Error("Active target session does not have a BOX-created repo that can be deleted");
    }
    await deleteGithubRepo(config, repoFullName);
    console.log(`[box activate] deleted created repo=${repoFullName}`);
  }

  const archived = await archiveTargetSession(config, {
    completionStage: TARGET_SESSION_STAGE.COMPLETED,
    completionReason: reason,
    completionSummary: options.completionSummary
      || (deleteRemoteRepo
        ? "Target session intentionally closed from the activation flow and the BOX-created repo was deleted."
        : "Target session intentionally closed from the activation flow while preserving the repository."),
    unresolvedItems: [],
  });
  console.log(`[box activate] previous session archived=${archived.sessionId} reason=${reason}`);
}

async function githubApiRequest(config: Config, pathname: string, init: RequestInit = {}): Promise<any> {
  const token = String(config?.env?.githubToken || "").trim();
  if (!token) {
    throw new Error("GITHUB_TOKEN is required for GitHub activation wizard");
  }

  const response = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "BOX/1.0",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub API request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function deleteGithubRepo(config: Config, repoFullName: string): Promise<void> {
  const normalizedRepoFullName = String(repoFullName || "").trim();
  if (!normalizedRepoFullName) {
    throw new Error("deleteGithubRepo requires repoFullName");
  }
  await githubApiRequest(config, `/repos/${normalizedRepoFullName}`, {
    method: "DELETE",
  });
}

function canDeleteSessionRepo(session: any): boolean {
  return session?.repo?.repoCreatedByBox === true
    && session?.repo?.deleteOnCancel === true
    && String(session?.repo?.repoFullName || "").trim().length > 0;
}

async function listGithubRepos(config: Config): Promise<Array<Record<string, unknown>>> {
  const repos = await githubApiRequest(config, "/user/repos?per_page=30&sort=updated&affiliation=owner,collaborator");
  return Array.isArray(repos) ? repos : [];
}

async function createGithubRepo(config: Config, repoInput: {
  name: string;
  description?: string;
  visibility: "public" | "private";
}): Promise<Record<string, unknown>> {
  return githubApiRequest(config, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: repoInput.name,
      description: repoInput.description || "",
      private: repoInput.visibility === "private",
      auto_init: false,
    }),
  });
}

function buildInteractiveManifest(
  repoUrl: string,
  objectiveSummary?: string | null,
  repoName?: string | null,
  repoOptions: { repoFullName?: string | null; repoCreatedByBox?: boolean; deleteOnCancel?: boolean } = {},
): Record<string, unknown> {
  const resolvedObjectiveSummary = String(objectiveSummary || "").trim()
    || `Clarify the requested change for ${repoName || repoUrl} through AI-led onboarding, then continue single-target delivery.`;
  return {
    mode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
    requestId: `req_target_${Date.now()}`,
    target: {
      repoUrl,
      defaultBranch: "main",
      provider: "github",
      repoFullName: String(repoOptions.repoFullName || "").trim() || null,
      repoCreatedByBox: repoOptions.repoCreatedByBox === true,
      deleteOnCancel: repoOptions.deleteOnCancel === true,
    },
    objective: {
      summary: resolvedObjectiveSummary,
      desiredOutcome: `${repoName || repoUrl} reaches single_target_project_readiness for delivery`,
      acceptanceCriteria: ["clarified", "single_target_project_readiness"],
    },
    constraints: {
      protectedPaths: [],
      forbiddenActions: [],
    },
    operator: {
      requestedBy: "user",
      approvalMode: "human_required_for_high_risk",
    },
  };
}

async function runInteractiveActivationWizard(config: Config): Promise<{ manifest: Record<string, unknown>; createdRepo?: Record<string, unknown> }> {
  printProductHeader("BOX Activate", "Choose repo source");
  console.log("ATLAS will open a fresh session, lead the onboarding conversation, and shape the target with you in real time.");
  console.log("1. Existing GitHub repo");
  console.log("2. New GitHub repo");
  console.log("3. Manual repo URL");
  const sourceChoice = await promptChoice("select [1/2/3]: ", ["1", "2", "3"]);

  if (sourceChoice === "1") {
    const repos = await listGithubRepos(config);
    if (repos.length === 0) {
      console.log("No repos found. Falling back to manual URL.");
      const repoUrl = await promptRequired("repo url: ");
      return { manifest: buildInteractiveManifest(repoUrl) };
    }

    const shownRepos = repos.slice(0, 12);
    shownRepos.forEach((repo, index) => {
      const fullName = String(repo.full_name || repo.name || `repo-${index + 1}`);
      const description = String(repo.description || "").trim();
      console.log(`${index + 1}. ${fullName}${description ? ` - ${description}` : ""}`);
    });
    console.log("m. Manual repo URL");
    const selection = await promptRequired("pick repo number: ");
    if (selection.toLowerCase() === "m") {
      const repoUrl = await promptRequired("repo url: ");
      return { manifest: buildInteractiveManifest(repoUrl) };
    }

    const selectedRepo = shownRepos[Number(selection) - 1];
    if (!selectedRepo) {
      throw new Error("Invalid repo selection");
    }

    return {
      manifest: buildInteractiveManifest(
        String(selectedRepo.clone_url || selectedRepo.html_url || "").trim(),
        null,
        String(selectedRepo.full_name || selectedRepo.name || "").trim(),
      ),
    };
  }

  if (sourceChoice === "2") {
    const repoName = await promptRequired("new repo name: ");
    const visibility = await promptChoice("visibility [public/private] (default: private): ", ["public", "private"], "private");
    const description = await promptInput("description (optional): ");
    const createdRepo = await createGithubRepo(config, {
      name: repoName,
      description,
      visibility: visibility as "public" | "private",
    });
    return {
      manifest: buildInteractiveManifest(
        String(createdRepo.clone_url || createdRepo.html_url || "").trim(),
        null,
        String(createdRepo.full_name || createdRepo.name || repoName).trim(),
        {
          repoFullName: String(createdRepo.full_name || createdRepo.name || repoName).trim(),
          repoCreatedByBox: true,
          deleteOnCancel: true,
        },
      ),
      createdRepo,
    };
  }

  const repoUrl = await promptRequired("repo url: ");
  return { manifest: buildInteractiveManifest(repoUrl) };
}

async function boxOn(config: Config): Promise<void> {
  const stateDir = config.paths?.stateDir || "state";
  const root = path.resolve(stateDir, "..");

  const dashboardEnabled = config?.runtime?.dashboardEnabled !== false;

  // 1. Kill stale dashboard on port 8787
  const killed = await killByPort(8787);
  if (killed) console.log(`[box on] killed stale dashboard on port 8787 (pid=${killed})`);

  // 2. Kill any orphan daemon processes before starting fresh
  const orphans = killAllDaemonProcesses();
  if (orphans.length > 0) {
    console.log(`[box on] killed ${orphans.length} orphan daemon(s): ${orphans.join(", ")}`);
  }

  // 3. Check if daemon is already running
  const daemonPidState = await readDaemonPid(config);
  const daemonPid = Number(daemonPidState?.pid || 0);
  if (daemonPid && isDaemonProcess(daemonPid)) {
    console.log(`[box on] daemon already running pid=${daemonPid}`);
  } else {
    // Clear stale stop requests
    await clearStopRequest(config);

    // 4. Start daemon (detached)
    const dPid = spawnDetached("node", ["--import", "tsx", "src/cli.ts", "start"], root);
    savePid(stateDir, "daemon_bg", dPid);
    console.log(`[box on] daemon started pid=${dPid}`);
  }

  // 5. Start dashboard (detached) only when enabled
  if (dashboardEnabled) {
    const dashPid = spawnDetached("node", ["--import", "tsx", "src/dashboard/live_dashboard.ts"], root);
    savePid(stateDir, "dashboard_bg", dashPid);
    console.log(`[box on] dashboard started pid=${dashPid} → http://localhost:8787`);
  } else {
    removePidFile(stateDir, "dashboard_bg");
    console.log("[box on] dashboard auto-start disabled (runtime.dashboardEnabled=false)");
  }

  console.log("");
  if (dashboardEnabled) {
    console.log("BOX is running. Dashboard: http://localhost:8787");
  } else {
    console.log("BOX is running. Dashboard is disabled.");
  }
  console.log("To stop: node --import tsx src/cli.ts off  (or: npm run box:off)");
}

async function boxOff(config: Config): Promise<void> {
  const stateDir = config.paths?.stateDir || "state";

  // 1. Graceful daemon stop via stop request
  const daemonPidState = await readDaemonPid(config);
  const daemonPid = Number(daemonPidState?.pid || 0);
  if (daemonPid && isDaemonProcess(daemonPid)) {
    await requestDaemonStop(config, "cli-off");
    console.log(`[box off] stop requested for daemon pid=${daemonPid}`);

    // Wait up to 8s for daemon to exit
    for (let waited = 0; waited < 8000; waited += 500) {
      await waitMs(500);
      if (!isProcessAlive(daemonPid)) break;
    }
    if (isProcessAlive(daemonPid)) {
      try { process.kill(daemonPid, "SIGKILL"); } catch { /* already gone */ }
      console.log(`[box off] daemon force-killed pid=${daemonPid}`);
    } else {
      console.log("[box off] daemon stopped cleanly");
    }
  } else {
    await clearDaemonPid(config);
    await clearStopRequest(config);
    console.log("[box off] daemon was not running");
  }
  removePidFile(stateDir, "daemon_bg");

  // 1b. Sweep orphan daemon processes that escaped PID-file tracking
  const orphans = killAllDaemonProcesses();
  if (orphans.length > 0) {
    console.log(`[box off] killed ${orphans.length} orphan daemon(s): ${orphans.join(", ")}`);
  }

  // 2. Kill dashboard by saved PID
  const dashPid = readPid(stateDir, "dashboard_bg");
  if (dashPid && isProcessAlive(dashPid)) {
    try { process.kill(dashPid, "SIGKILL"); } catch { /* already gone */ }
    console.log(`[box off] dashboard stopped pid=${dashPid}`);
  }
  removePidFile(stateDir, "dashboard_bg");

  // 3. Fallback: kill by port 8787
  const killedByPort = await killByPort(8787);
  if (killedByPort) console.log(`[box off] dashboard killed by port 8787 (pid=${killedByPort})`);

  console.log("");
  console.log("BOX is down.");
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "once";
  const config = await loadConfig();

  if (command === "doctor") {
    await runDoctor(config);
    return;
  }

  if (command === "mode") {
    await setPlatformModeFromCli(config, process.argv[3] || "status");
    return;
  }

  if (command === "activate") {
    await handleActivationCommand(config);
    return;
  }

  if (command === "target") {
    const subCommand = process.argv[3] || "status";

    if (subCommand === "list") {
      await printTargetSessionList(config);
      return;
    }

    if (subCommand === "select") {
      const selection = getTargetSessionSelectionFromCli();
      if (!selection.sessionId) {
        throw new Error("target select requires --session <id>");
      }
      const session = await selectActiveTargetSession(config, selection);
      printTargetStatus(
        summarizePlatformModeState(await loadPlatformModeState(config)),
        summarizeActiveTargetSession(session),
        await summarizeTargetReadinessState(config),
      );
      printTargetSessionLogPath(config, session);
      return;
    }

    if (subCommand === "start") {
      if (!(await ensureSingleTargetStartupReady(config, { forceSingleTarget: true }))) {
        return;
      }
      const manifestPath = getArgValue("--manifest") || process.argv[4] || null;
      if (!manifestPath) {
        throw new Error("target start requires --manifest <path>");
      }
      const resolvedManifestPath = path.resolve(manifestPath);
      const manifest = JSON.parse(readFileSync(resolvedManifestPath, "utf8"));
      const existingSelectedSession = await loadActiveTargetSession(config);
      const shouldSelectStartedSession = hasArgFlag("--select") || !existingSelectedSession;
      const session = await createTargetSession(manifest, config, { selectAsActive: shouldSelectStartedSession });
      const shouldRunDetached = hasArgFlag("--run");
      printTargetStatus(
        summarizePlatformModeState(await loadPlatformModeState(config)),
        summarizeActiveTargetSession(session),
        await summarizeTargetReadinessState(config),
      );
      printTargetSessionLogPath(config, session);
      if (shouldRunDetached) {
        const runnerPid = await spawnTargetSessionRunner(config, session);
        console.log(`[box target] runner started pid=${String(runnerPid || "unknown")} session=${session.sessionId}`);
      }
      if (existingSelectedSession && !shouldSelectStartedSession) {
        console.log(`[box target] opened additional session without replacing selected session=${existingSelectedSession.sessionId}`);
      }
      return;
    }

    if (subCommand === "run") {
      const session = await resolveTargetSessionFromCli(config);
      if (!session) {
        throw new Error("target run requires an open session or --session <id>");
      }
      const runnerPid = await spawnTargetSessionRunner(config, session);
      console.log(`[box target] runner started pid=${String(runnerPid || "unknown")} session=${session.sessionId}`);
      printTargetSessionLogPath(config, session);
      return;
    }

    if (subCommand === "runner-status") {
      const session = await resolveTargetSessionFromCli(config);
      if (!session) {
        throw new Error("target runner-status requires an open session or --session <id>");
      }
      const scopedConfig = bindTargetSessionSelector(config, {
        sessionId: String(session.sessionId || "") || null,
        projectId: String(session.projectId || "") || null,
      });
      const runnerState = await readDaemonPid(scopedConfig);
      const runnerPid = Number(runnerState?.pid || 0);
      console.log(`[box target] runner session=${session.sessionId} running=${runnerPid && isProcessAlive(runnerPid) ? "true" : "false"} pid=${runnerPid || "none"}`);
      printTargetSessionLogPath(config, session);
      return;
    }

    if (subCommand === "stop-runner") {
      const session = await resolveTargetSessionFromCli(config);
      if (!session) {
        throw new Error("target stop-runner requires an open session or --session <id>");
      }
      const scopedConfig = bindTargetSessionSelector(config, {
        sessionId: String(session.sessionId || "") || null,
        projectId: String(session.projectId || "") || null,
      });
      const runnerState = await readDaemonPid(scopedConfig);
      const runnerPid = Number(runnerState?.pid || 0);
      if (!runnerPid || !isProcessAlive(runnerPid)) {
        await clearDaemonPid(scopedConfig);
        await clearStopRequest(scopedConfig);
        console.log(`[box target] runner not running session=${session.sessionId}`);
        return;
      }
      await requestDaemonStop(scopedConfig, "cli-target-stop-runner");
      console.log(`[box target] stop requested pid=${runnerPid} session=${session.sessionId}`);
      return;
    }

    if (subCommand === "status") {
      const session = await resolveTargetSessionFromCli(config);
      printTargetStatus(
        summarizePlatformModeState(await loadPlatformModeState(config)),
        summarizeActiveTargetSession(session),
        !getTargetSessionSelectionFromCli().sessionId ? await summarizeTargetReadinessState(config) : null,
      );
      printTargetSessionLogPath(config, session);
      printProductField("selected active", String(session?.sessionId || "") === String((await loadActiveTargetSession(config))?.sessionId || "") ? "yes" : "no");
      return;
    }

    if (subCommand === "log-path") {
      const session = await resolveTargetSessionFromCli(config);
      printTargetSessionLogPath(config, session);
      return;
    }

    if (subCommand === "stage") {
      const nextStage = getArgValue("--to") || process.argv[4] || null;
      if (!nextStage) {
        throw new Error("target stage requires --to <stage>");
      }
      const scopedConfig = bindTargetSessionSelector(config, getTargetSessionSelectionFromCli());
      const session = await transitionActiveTargetSession(scopedConfig, {
        nextStage,
        actor: "cli",
        reason: getArgValue("--reason"),
        nextAction: getArgValue("--next-action"),
      });
      printTargetStatus(
        summarizePlatformModeState(await loadPlatformModeState(config)),
        summarizeActiveTargetSession(session),
        await summarizeTargetReadinessState(config),
      );
      return;
    }

    if (subCommand === "close") {
      const scopedConfig = bindTargetSessionSelector(config, getTargetSessionSelectionFromCli());
      const deleteRemoteRepo = hasArgFlag("--delete-repo");
      if (deleteRemoteRepo) {
        const activeSession = await loadActiveTargetSession(scopedConfig);
        if (!canDeleteSessionRepo(activeSession)) {
          throw new Error("Active target session does not have a BOX-created repo that can be deleted");
        }
        await deleteGithubRepo(config, String(activeSession.repo.repoFullName));
        console.log(`[box target] deleted created repo=${String(activeSession.repo.repoFullName)}`);
      }
      const completionStage = getArgValue("--status") || TARGET_SESSION_STAGE.COMPLETED;
      const archived = await archiveTargetSession(scopedConfig, {
        completionStage,
        completionReason: getArgValue("--reason"),
        completionSummary: getArgValue("--summary"),
      });
      console.log(`[box target] archived=${archived.sessionId} stage=${archived.currentStage}`);
      printTargetStatus(
        summarizePlatformModeState(await loadPlatformModeState(config)),
        summarizeActiveTargetSession(await loadActiveTargetSession(config)),
        await summarizeTargetReadinessState(config),
      );
      return;
    }

    if (subCommand === "purge-all") {
      await purgeAllTargetSessionArtifacts(config);
      console.log("[box target] purged all target sessions, archived session records, and session workspaces");
      printTargetStatus(
        summarizePlatformModeState(await loadPlatformModeState(config)),
        summarizeActiveTargetSession(await loadActiveTargetSession(config)),
        await summarizeTargetReadinessState(config),
      );
      return;
    }

    if (subCommand === "clarify") {
      const scopedConfig = bindTargetSessionSelector(config, getTargetSessionSelectionFromCli());
      const answerText = getArgValue("--answer");
      const questionId = getArgValue("--question-id");
      const selectedOptions = getArgValue("--options");
      if (!answerText && !selectedOptions) {
        const runtime = await getTargetClarificationRuntimeState(scopedConfig, { persistPrompt: true });
        printClarificationState(runtime);
        return;
      }

      const result = await submitTargetClarificationAnswer(scopedConfig, {
        questionId,
        answerText,
        selectedOptions,
        answeredBy: "user",
      });
      printTargetStatus(
        summarizePlatformModeState(await loadPlatformModeState(config)),
        summarizeActiveTargetSession(result.session),
        await summarizeTargetReadinessState(config),
      );
      printClarificationState({
        session: result.session,
        currentQuestion: result.currentQuestion,
        intentSummary: result.session.intent,
      });
      return;
    }

    throw new Error(`unknown target subcommand: ${subCommand}`);
  }

  if (command === "start") {
    const targetSelection = getTargetSessionSelectionFromCli();
    const sessionScopedConfig = bindTargetSessionSelector(config, targetSelection);
    if (!(await ensureSingleTargetStartupReady(sessionScopedConfig))) {
      return;
    }

    const startConflict = await findDaemonStartConflict(sessionScopedConfig);
    if (startConflict) {
      console.log(`[box] ${startConflict.reason}`);
      return;
    }

    if (!targetSelection.sessionId) {
      // Kill orphan daemons before starting — prevents multiple instances
      const orphans = killAllDaemonProcesses();
      if (orphans.length > 0) {
        console.log(`[box] killed ${orphans.length} orphan daemon(s): ${orphans.join(", ")}`);
      }
    }

    const daemonPidState = await readDaemonPid(sessionScopedConfig);
    const daemonPid = Number(daemonPidState?.pid || 0);
    if (daemonPid && isDaemonProcess(daemonPid)) {
      console.log(`[box] daemon already running pid=${daemonPid}`);
      return;
    }

    // Starting should always clear any previously persisted stop request.
    await clearStopRequest(sessionScopedConfig);

    await runDaemon(sessionScopedConfig);
    return;
  }

  if (command === "rebase") {
    const result = await runRebase(config, { trigger: "cli-rebase" });
    console.log(`[box] rebase completed triggered=${result?.triggered ? "true" : "false"} reason=${result?.reason || "unknown"}`);
    return;
  }

  if (command === "resume") {
    const sessionScopedConfig = bindTargetSessionSelector(config, getTargetSessionSelectionFromCli());
    const startConflict = await findDaemonStartConflict(sessionScopedConfig);
    if (startConflict) {
      console.log(`[box] ${startConflict.reason}`);
      return;
    }
    sessionScopedConfig.platformModeState = await loadPlatformModeState(sessionScopedConfig);
    sessionScopedConfig.activeTargetSession = await loadActiveTargetSession(sessionScopedConfig);
    await runResumeDispatch(sessionScopedConfig);
    console.log("[box] resume completed from dispatch checkpoint");
    return;
  }

  if (command === "reload") {
    const sessionScopedConfig = bindTargetSessionSelector(config, getTargetSessionSelectionFromCli());
    const daemonPidState = await readDaemonPid(sessionScopedConfig);
    const daemonPid = Number(daemonPidState?.pid || 0);
    if (!daemonPid || !isDaemonProcess(daemonPid)) {
      console.log("[box] daemon not running — nothing to reload");
      return;
    }
    await requestDaemonReload(sessionScopedConfig, "cli-reload");
    console.log(`[box] reload requested for daemon pid=${daemonPid} — config will refresh on next loop iteration`);
    return;
  }

  if (command === "stop") {
    const sessionScopedConfig = bindTargetSessionSelector(config, getTargetSessionSelectionFromCli());
    const daemonPidState = await readDaemonPid(sessionScopedConfig);
    const daemonPid = Number(daemonPidState?.pid || 0);
    if (!daemonPid) {
      await clearDaemonPid(sessionScopedConfig);
      await clearStopRequest(sessionScopedConfig);
      console.log("[box] daemon not running");
      return;
    }

    if (!isDaemonProcess(daemonPid)) {
      await clearDaemonPid(sessionScopedConfig);
      await clearStopRequest(sessionScopedConfig);
      console.log("[box] cleared stale daemon control files");
      console.log("[box] daemon not running");
      return;
    }

    const existingStopRequest = await readStopRequest(sessionScopedConfig);
    if (existingStopRequest?.requestedAt) {
      const requestedAtMs = new Date(existingStopRequest.requestedAt).getTime();
      const ageMs = Number.isFinite(requestedAtMs) ? (Date.now() - requestedAtMs) : Number.MAX_SAFE_INTEGER;
      const staleMs = Math.max(120000, Number(config.loopIntervalMs || 0) * 2);
      if (ageMs > staleMs) {
        await clearDaemonPid(sessionScopedConfig);
        await clearStopRequest(sessionScopedConfig);
        console.log("[box] cleared stale daemon control files");
        console.log("[box] daemon not running");
        return;
      }
    }

    await requestDaemonStop(sessionScopedConfig, "cli-stop");
    console.log(`[box] stop requested for daemon pid=${daemonPid}`);
    return;
  }

  if (command === "on") {
    if (!(await ensureSingleTargetStartupReady(config))) {
      return;
    }
    await boxOn(config);
    return;
  }

  if (command === "off") {
    await boxOff(config);
    return;
  }

  if (command === "shutdown") {
    // SHUTDOWN = full reset. Kills daemon, clears all AI state.
    // Next "box on" or "box start" will run fresh Jesus cycle.
    const daemonPidState = await readDaemonPid(config);
    const daemonPid = Number(daemonPidState?.pid || 0);
    if (daemonPid && isDaemonProcess(daemonPid)) {
      await requestDaemonStop(config, "cli-shutdown");
      console.log(`[box shutdown] stop requested for daemon pid=${daemonPid}`);
      for (let waited = 0; waited < 8000; waited += 500) {
        await waitMs(500);
        if (!isProcessAlive(daemonPid)) break;
      }
      if (isProcessAlive(daemonPid)) {
        try { process.kill(daemonPid, "SIGKILL"); } catch { /* already gone */ }
        console.log(`[box shutdown] daemon force-killed pid=${daemonPid}`);
      } else {
        console.log("[box shutdown] daemon stopped");
      }
    } else {
      console.log("[box shutdown] daemon was not running");
    }

    // Kill dashboard too
    const stateDir = config.paths?.stateDir || "state";
    const dashPid = readPid(stateDir, "dashboard_bg");
    if (dashPid && isProcessAlive(dashPid)) {
      try { process.kill(dashPid, "SIGKILL"); } catch { /* already gone */ }
      console.log(`[box shutdown] dashboard stopped pid=${dashPid}`);
    }
    removePidFile(stateDir, "dashboard_bg");
    removePidFile(stateDir, "daemon_bg");
    await killByPort(8787);

    // Clear all AI state for fresh start
    const cleared = await clearAllAIState(config);
    console.log(`[box shutdown] cleared ${cleared.length} state files`);
    console.log("");
    console.log("BOX fully shutdown. All AI state cleared.");
    console.log("Next 'box on' or 'box start' will run a fresh Jesus cycle.");
    return;
  }

  // ── si: Self-Improvement toggle ───────────────────────────────────────────
  if (command === "si") {
    const subCmd = process.argv[3] || "status";
    const reason = process.argv.indexOf("--reason") !== -1
      ? process.argv[process.argv.indexOf("--reason") + 1] || "manual"
      : "manual";

    if (subCmd === "on") {
      const record = await writeSiControl(config, { enabled: true, reason, updatedBy: "cli" });
      await siLogAsync(config, "TOGGLE", "Self-Improvement ENABLED via CLI (reason: " + reason + ")");
      console.log("[box si] Self-Improvement ENABLED");
      console.log("  reason:    " + record.reason);
      console.log("  updatedAt: " + record.updatedAt);
      console.log("  updatedBy: " + record.updatedBy);
      console.log("");
      console.log("Takes effect on next orchestrator loop iteration.");
      return;
    }

    if (subCmd === "off") {
      const record = await writeSiControl(config, { enabled: false, reason, updatedBy: "cli" });
      await siLogAsync(config, "TOGGLE", "Self-Improvement DISABLED via CLI (reason: " + reason + ")");
      console.log("[box si] Self-Improvement DISABLED");
      console.log("  reason:    " + record.reason);
      console.log("  updatedAt: " + record.updatedAt);
      console.log("  updatedBy: " + record.updatedBy);
      console.log("");
      console.log("System continues running without SI. Re-enable: node --import tsx src/cli.ts si on");
      return;
    }

    if (subCmd === "log" || subCmd === "logs") {
      const maxLines = Number(process.argv[4]) || 50;
      const lines = await readSiLiveLog(config, maxLines);
      if (lines.length === 0) {
        console.log("[box si] No SI log entries yet.");
      } else {
        console.log("[box si] Last " + lines.length + " SI log entries:");
        console.log("─".repeat(80));
        for (const line of lines) console.log(line);
        console.log("─".repeat(80));
      }
      return;
    }

    // Default: status
    const gate = await isSelfImprovementActive(config);
    const control = await readSiControl(config);
    console.log("[box si] Self-Improvement Status");
    console.log("─".repeat(40));
    console.log("  active:         " + gate.active);
    console.log("  status:         " + gate.status);
    console.log("  reason:         " + gate.reason);
    console.log("  config.enabled: " + ((config as any).selfImprovement?.enabled !== false));
    console.log("  manual.enabled: " + control.enabled);
    if (control.updatedAt) {
      console.log("  manual.updated: " + control.updatedAt + " by " + control.updatedBy);
      console.log("  manual.reason:  " + control.reason);
    }
    return;
  }

  if (command === "once") {
    const sessionScopedConfig = bindTargetSessionSelector(config, getTargetSessionSelectionFromCli());
    if (!(await ensureSingleTargetStartupReady(sessionScopedConfig))) {
      return;
    }
    const startConflict = await findDaemonStartConflict(sessionScopedConfig);
    if (startConflict) {
      console.log(`[box] ${startConflict.reason}`);
      return;
    }
    const existingStopRequest = await readStopRequest(sessionScopedConfig);
    if (existingStopRequest?.requestedAt) {
      await clearStopRequest(sessionScopedConfig);
      console.log("[box once] cleared stale stop request before one-shot run");
    }
    await runOnce(sessionScopedConfig);
    return;
  }

  const startConflict = await findDaemonStartConflict(config);
  if (startConflict) {
    console.log(`[box] ${startConflict.reason}`);
    return;
  }
  await runOnce(config);
}

main().catch((error) => {
  console.error("[box] fatal:", error?.message ?? error);
  process.exit(1);
});
