import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { readJson, spawnAsync, writeJson } from "./fs_utils.js";
import { agentFileExists, appendAgentLiveLog, appendAgentLiveLogDetail, buildAgentArgs, parseAgentOutput, writeAgentDebugFile } from "./agent_loader.js";
import { appendProgress } from "./state_tracker.js";
import { buildInteractiveAccessPromptSection, shouldEnableInteractiveAccessResolution } from "./access_interaction.js";
import {
  getTargetBaselinePath,
  getTargetClarificationPacketPath,
  getTargetClarificationTranscriptPath,
  getTargetIntentContractPath,
  getTargetOnboardingReportPath,
  getTargetPrerequisiteStatusPath,
  getTargetRepoAnalysisPath,
  getTargetWorkspacePath,
  loadActiveTargetSession,
  prepareTargetWorkspaceForSession,
  saveTargetSession,
  TARGET_INTENT_STATUS,
  TARGET_SESSION_STAGE,
} from "./target_session_state.js";

export const TARGET_ONBOARDING_SCHEMA_VERSION = 2;
export const TARGET_ONBOARDING_AGENT_SLUG = "onboarding";
export const TARGET_EMPTY_REPO_ONBOARDING_AGENT_SLUG = "onboarding-empty-repo";
export const TARGET_EXISTING_REPO_ONBOARDING_AGENT_SLUG = "onboarding-existing-repo";
const INITIAL_ONBOARDING_FREE_TEXT_PROMPT = "Hello, what would you like me to help you with in this session?";

const EMPTY_REPO_IGNORABLE_NAMES = new Set([
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".nvmrc",
  ".npmrc",
  "readme",
  "readme.md",
  "license",
  "license.md",
  "changelog.md",
]);

const IMPLEMENTATION_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".kt", ".php", ".rb", ".cs", ".swift", ".scala", ".sh", ".sql", ".html", ".css", ".scss", ".vue", ".svelte",
]);

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((entry) => String(entry || "").trim()).filter(Boolean))];
}

function normalizeNumber(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeQuestionAnswerMode(value: unknown, fallback = "hybrid") {
  const normalized = String(value || "").trim().toLowerCase();
  if (["single_select", "multi_select", "hybrid"].includes(normalized)) {
    return normalized;
  }
  if (["single", "single choice", "single-choice"].includes(normalized)) {
    return "single_select";
  }
  if (["multi", "multi choice", "multi-choice", "checkboxes"].includes(normalized)) {
    return "multi_select";
  }
  if (["free_text", "free-text", "freeform", "text"].includes(normalized)) {
    return "hybrid";
  }
  return fallback;
}

function normalizeClarifiedIntent(rawIntent: any) {
  const source = rawIntent && typeof rawIntent === "object" ? rawIntent : {};
  return {
    productType: normalizeNullableString(source?.productType),
    targetUsers: normalizeStringArray(source?.targetUsers),
    mustHaveFlows: normalizeStringArray(source?.mustHaveFlows),
    scopeIn: normalizeStringArray(source?.scopeIn),
    scopeOut: normalizeStringArray(source?.scopeOut),
    protectedAreas: normalizeStringArray(source?.protectedAreas),
    preferredQualityBar: normalizeNullableString(source?.preferredQualityBar),
    designDirection: normalizeNullableString(source?.designDirection),
    deploymentExpectations: normalizeStringArray(source?.deploymentExpectations),
    successCriteria: normalizeStringArray(source?.successCriteria),
  };
}

function isConversationCompletePacket(rawPacket: any) {
  return rawPacket?.conversationComplete === true || rawPacket?.readyForPlanning === true;
}

function resolveClarificationPacketIdentity(rawPacket: any) {
  const normalizedPacket = rawPacket && typeof rawPacket === "object" ? rawPacket : {};
  const sessionContext = normalizedPacket?.sessionContext && typeof normalizedPacket.sessionContext === "object"
    ? normalizedPacket.sessionContext
    : null;
  const targetSession = normalizedPacket?.targetSession && typeof normalizedPacket.targetSession === "object"
    ? normalizedPacket.targetSession
    : null;
  return {
    projectId: normalizeNullableString(
      normalizedPacket?.projectId
      || sessionContext?.projectId
      || targetSession?.projectId,
    ),
    sessionId: normalizeNullableString(
      normalizedPacket?.sessionId
      || sessionContext?.sessionId
      || targetSession?.sessionId,
    ),
  };
}

function isClarificationPacketBoundToSession(rawPacket: any, preparedSession: any): boolean {
  const packetIdentity = resolveClarificationPacketIdentity(rawPacket);
  if (!packetIdentity.projectId && !packetIdentity.sessionId) {
    return true;
  }
  if (packetIdentity.projectId && packetIdentity.projectId !== normalizeNullableString(preparedSession?.projectId)) {
    return false;
  }
  if (packetIdentity.sessionId && packetIdentity.sessionId !== normalizeNullableString(preparedSession?.sessionId)) {
    return false;
  }
  return true;
}

function resolveCompletedPlanningMode(rawPacket: any) {
  const planningMode = String(rawPacket?.planningMode || rawPacket?.deliveryMode || "active").trim().toLowerCase();
  return planningMode === "shadow" ? "shadow" : "active";
}

function extractPremiumRequestsFromOutput(rawOutput: unknown): number | null {
  const text = String(rawOutput || "");
  let premiumCount: number | null = null;
  const regex = /Requests\s+(\d+)\s+Premium/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const parsed = Number.parseInt(String(match[1] || ""), 10);
    if (Number.isFinite(parsed)) premiumCount = parsed;
  }
  return premiumCount;
}

async function persistOnboardingSingleCallState(config: any, preparedSession: any, patch: Record<string, unknown>) {
  const currentSingleCall = preparedSession?.clarification?.singleCall && typeof preparedSession.clarification.singleCall === "object"
    ? preparedSession.clarification.singleCall
    : {};
  const nextSession = {
    ...preparedSession,
    clarification: {
      ...(preparedSession?.clarification || {}),
      singleCall: {
        ...currentSingleCall,
        ...patch,
      },
    },
    lifecycle: {
      ...(preparedSession?.lifecycle || {}),
      updatedAt: new Date().toISOString(),
    },
  };
  return saveTargetSession(config, nextSession, { selectAsActive: true });
}

function normalizeFollowUpQuestion(rawFollowUp: any, sourceQuestion: any, fallbackId: string) {
  if (!rawFollowUp || typeof rawFollowUp !== "object") {
    return null;
  }

  const title = normalizeNullableString(rawFollowUp?.title)
    || normalizeNullableString(sourceQuestion?.title)
    || "Follow-up";
  const prompt = normalizeNullableString(rawFollowUp?.prompt);
  if (!prompt) {
    return null;
  }

  const semanticSlot = normalizeNullableString(rawFollowUp?.semanticSlot)
    || normalizeNullableString(sourceQuestion?.semanticSlot)
    || normalizeNullableString(sourceQuestion?.id)
    || fallbackId;
  const options = normalizeStringArray(Array.isArray(rawFollowUp?.options) ? rawFollowUp.options : sourceQuestion?.options);

  return {
    ...rawFollowUp,
    id: normalizeNullableString(rawFollowUp?.id) || `follow_up_${fallbackId}`,
    semanticSlot,
    title,
    prompt,
    answerMode: normalizeQuestionAnswerMode(rawFollowUp?.answerMode, "hybrid"),
    options,
    triggerOnEmpty: rawFollowUp?.triggerOnEmpty === true,
    triggerOnOtherWithoutText: rawFollowUp?.triggerOnOtherWithoutText !== false,
    minAnswerLength: normalizeNumber(rawFollowUp?.minAnswerLength, null),
    requireTextWhenOptionsSelected: normalizeStringArray(rawFollowUp?.requireTextWhenOptionsSelected),
    whenSelectedOptionsAny: normalizeStringArray(rawFollowUp?.whenSelectedOptionsAny),
    whenSelectedOptionsAll: normalizeStringArray(rawFollowUp?.whenSelectedOptionsAll),
    sourceQuestionId: normalizeNullableString(rawFollowUp?.sourceQuestionId)
      || normalizeNullableString(sourceQuestion?.id)
      || fallbackId,
  };
}

function normalizeClarificationQuestion(rawQuestion: any, fallbackQuestion: any, index: number) {
  const semanticSlot = normalizeNullableString(rawQuestion?.semanticSlot)
    || normalizeNullableString(fallbackQuestion?.semanticSlot)
    || normalizeNullableString(fallbackQuestion?.id)
    || normalizeNullableString(rawQuestion?.id)
    || `question_${index + 1}`;
  const rawId = normalizeNullableString(rawQuestion?.id)
    || normalizeNullableString(fallbackQuestion?.id)
    || semanticSlot;
  const title = normalizeNullableString(rawQuestion?.title)
    || normalizeNullableString(fallbackQuestion?.title)
    || `Question ${index + 1}`;
  const prompt = normalizeNullableString(rawQuestion?.prompt)
    || normalizeNullableString(fallbackQuestion?.prompt)
    || title;
  const answerMode = normalizeQuestionAnswerMode(
    rawQuestion?.answerMode,
    normalizeQuestionAnswerMode(fallbackQuestion?.answerMode, "hybrid"),
  );
  const options = normalizeStringArray(Array.isArray(rawQuestion?.options) ? rawQuestion.options : fallbackQuestion?.options);
  const fallbackId = rawId || semanticSlot;
  const rawFollowUps = Array.isArray(rawQuestion?.followUps)
    ? rawQuestion.followUps
    : rawQuestion?.followUp
      ? [rawQuestion.followUp]
      : [];
  const followUps = rawFollowUps
    .map((followUp: any, followUpIndex: number) => normalizeFollowUpQuestion(followUp, {
      ...fallbackQuestion,
      ...rawQuestion,
      semanticSlot,
      id: fallbackId,
      options,
      answerMode,
    }, `${fallbackId}_${followUpIndex + 1}`))
    .filter(Boolean);

  return {
    ...fallbackQuestion,
    ...((rawQuestion && typeof rawQuestion === "object") ? rawQuestion : {}),
    id: fallbackId,
    semanticSlot,
    title,
    prompt,
    answerMode,
    options,
    required: rawQuestion?.required !== false,
    followUps,
  };
}

function normalizeClarificationPacket(rawPacket: any, fallbackPacket: any) {
  const fallbackQuestions = Array.isArray(fallbackPacket?.questions) ? fallbackPacket.questions : [];
  const rawQuestions = Array.isArray(rawPacket?.questions) ? rawPacket.questions : [];
  const conversationComplete = isConversationCompletePacket(rawPacket);
  if (conversationComplete && rawQuestions.length === 0) {
    return {
      ...fallbackPacket,
      ...((rawPacket && typeof rawPacket === "object") ? rawPacket : {}),
      schemaVersion: TARGET_ONBOARDING_SCHEMA_VERSION,
      selectedAgentSlug: fallbackPacket.selectedAgentSlug,
      repoState: fallbackPacket.repoState,
      repoStateReason: fallbackPacket.repoStateReason,
      meaningfulEntryPoints: fallbackPacket.meaningfulEntryPoints,
      dominantSignals: fallbackPacket.dominantSignals,
      workspaceFacts: fallbackPacket.workspaceFacts,
      openingPrompt: normalizeNullableString(rawPacket?.openingPrompt) || fallbackPacket.openingPrompt,
      closingCriteria: normalizeStringArray(rawPacket?.closingCriteria).length > 0
        ? normalizeStringArray(rawPacket?.closingCriteria)
        : fallbackPacket.closingCriteria,
      requiredSemanticSlots: [],
      clarifiedIntent: normalizeClarifiedIntent(rawPacket?.clarifiedIntent || rawPacket?.resolvedIntent?.clarifiedIntent),
      assumptions: normalizeStringArray(rawPacket?.assumptions),
      summary: normalizeNullableString(rawPacket?.summary) || normalizeNullableString(rawPacket?.resolvedIntent?.summary),
      planningMode: resolveCompletedPlanningMode(rawPacket),
      conversationComplete: true,
      readyForPlanning: true,
      questions: [],
    };
  }
  const selectedQuestions = rawQuestions.length > 0 ? rawQuestions : fallbackQuestions;
  const seenIds = new Set<string>();

  const questions = selectedQuestions.map((question: any, index: number) => {
    const fallbackQuestion = fallbackQuestions[index] || fallbackQuestions[Math.max(0, fallbackQuestions.length - 1)] || null;
    const normalizedQuestion = normalizeClarificationQuestion(question, fallbackQuestion, index);
    const rawId = normalizeNullableString(normalizedQuestion?.id) || `question_${index + 1}`;
    let id = rawId;
    let duplicateSuffix = 2;
    while (seenIds.has(id)) {
      id = `${rawId}_${duplicateSuffix++}`;
    }
    seenIds.add(id);
    return {
      ...normalizedQuestion,
      id,
    };
  }).filter((question) => question.id && question.title && question.prompt);

  if (questions.length === 0) {
    return fallbackPacket;
  }

  const requiredSemanticSlots = normalizeStringArray(rawPacket?.requiredSemanticSlots).length > 0
    ? normalizeStringArray(rawPacket?.requiredSemanticSlots)
    : questions
      .filter((question) => question.required !== false)
      .map((question) => String(question.semanticSlot || question.id || "").trim())
      .filter(Boolean);

  return {
    ...fallbackPacket,
    ...((rawPacket && typeof rawPacket === "object") ? rawPacket : {}),
    schemaVersion: TARGET_ONBOARDING_SCHEMA_VERSION,
    selectedAgentSlug: fallbackPacket.selectedAgentSlug,
    repoState: fallbackPacket.repoState,
    repoStateReason: fallbackPacket.repoStateReason,
    meaningfulEntryPoints: fallbackPacket.meaningfulEntryPoints,
    dominantSignals: fallbackPacket.dominantSignals,
    workspaceFacts: fallbackPacket.workspaceFacts,
    openingPrompt: normalizeNullableString(rawPacket?.openingPrompt) || fallbackPacket.openingPrompt,
    closingCriteria: normalizeStringArray(rawPacket?.closingCriteria).length > 0
      ? normalizeStringArray(rawPacket?.closingCriteria)
      : fallbackPacket.closingCriteria,
    requiredSemanticSlots,
    clarifiedIntent: normalizeClarifiedIntent(rawPacket?.clarifiedIntent || rawPacket?.resolvedIntent?.clarifiedIntent),
    assumptions: normalizeStringArray(rawPacket?.assumptions),
    summary: normalizeNullableString(rawPacket?.summary) || normalizeNullableString(rawPacket?.resolvedIntent?.summary),
    planningMode: conversationComplete ? resolveCompletedPlanningMode(rawPacket) : null,
    conversationComplete,
    readyForPlanning: rawPacket?.readyForPlanning === true || conversationComplete,
    questions,
  };
}

async function pathExists(targetPath: string | null | undefined) {
  if (!targetPath) return false;
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectWorkspaceEntries(rootPath: string, maxDepth = 2, maxEntries = 80): Promise<string[]> {
  const discovered: string[] = [];
  async function walk(currentPath: string, depth: number, prefix = "") {
    if (depth > maxDepth || discovered.length >= maxEntries) return;
    const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (discovered.length >= maxEntries) break;
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      discovered.push(relativePath);
      if (entry.isDirectory() && entry.name !== ".git") {
        await walk(path.join(currentPath, entry.name), depth + 1, relativePath);
      }
    }
  }
  await walk(rootPath, 0);
  return discovered;
}

function isIgnorableRepoEntry(relativePath: string): boolean {
  const normalizedPath = String(relativePath || "").trim().toLowerCase();
  if (!normalizedPath) return true;
  if (normalizedPath === ".git" || normalizedPath.startsWith(".git/")) return true;
  if (normalizedPath.startsWith(".github/")) return true;
  const baseName = normalizedPath.split("/").pop() || normalizedPath;
  if (EMPTY_REPO_IGNORABLE_NAMES.has(baseName)) return true;
  return false;
}

function classifyRepoState(workspaceFacts: any, workspaceEntries: string[]) {
  const meaningfulEntries = workspaceEntries.filter((entry) => !isIgnorableRepoEntry(entry));
  const sourceLikeEntries = meaningfulEntries.filter((entry) => {
    const lower = entry.toLowerCase();
    return ["src", "app", "pages", "components", "server", "api", "lib", "packages", "services", "features"].some((segment) => lower === segment || lower.startsWith(`${segment}/`));
  });
  const codeLikeEntries = meaningfulEntries.filter((entry) => {
    const lower = entry.toLowerCase();
    const ext = path.extname(lower);
    if (IMPLEMENTATION_EXTENSIONS.has(ext)) return true;
    return ["prisma/schema.prisma", "supabase/config.toml"].some((segment) => lower === segment);
  });

  const dominantSignals = [
    workspaceFacts.framework !== "unknown" ? workspaceFacts.framework : null,
    workspaceFacts.packageManager !== "unknown" ? workspaceFacts.packageManager : null,
    workspaceFacts.repoShape !== "single_repo" ? workspaceFacts.repoShape : null,
    workspaceFacts.buildDetected ? "build_detected" : null,
    workspaceFacts.testDetected ? "test_detected" : null,
    workspaceFacts.lintDetected ? "lint_detected" : null,
    workspaceFacts.typecheckDetected ? "typecheck_detected" : null,
  ].filter(Boolean);

  if (codeLikeEntries.length === 0 && meaningfulEntries.length === 0) {
    return {
      repoState: "empty",
      repoStateReason: "Repository contains no meaningful product files beyond bootstrap or housekeeping artifacts.",
      meaningfulEntryPoints: [],
      dominantSignals,
    };
  }

  if (codeLikeEntries.length === 0 && sourceLikeEntries.length === 0) {
    return {
      repoState: "empty",
      repoStateReason: "Repository contains only lightweight scaffolding and still needs product intent discovery before planning can begin.",
      meaningfulEntryPoints: meaningfulEntries.slice(0, 8),
      dominantSignals,
    };
  }

  return {
    repoState: "existing",
    repoStateReason: `Repository already contains meaningful implementation or delivery artifacts (${Math.max(codeLikeEntries.length, meaningfulEntries.length)} signals detected).`,
    meaningfulEntryPoints: (codeLikeEntries.length > 0 ? codeLikeEntries : meaningfulEntries).slice(0, 8),
    dominantSignals,
  };
}

async function detectWorkspaceFacts(workspacePath: string) {
  const gitDir = path.join(workspacePath, ".git");
  const packageJsonPath = path.join(workspacePath, "package.json");
  const packageLockPath = path.join(workspacePath, "package-lock.json");
  const pnpmLockPath = path.join(workspacePath, "pnpm-lock.yaml");
  const yarnLockPath = path.join(workspacePath, "yarn.lock");
  const bunLockPath = path.join(workspacePath, "bun.lockb");
  const tsconfigPath = path.join(workspacePath, "tsconfig.json");
  const turboPath = path.join(workspacePath, "turbo.json");
  const pnpmWorkspacePath = path.join(workspacePath, "pnpm-workspace.yaml");
  const npmrcPath = path.join(workspacePath, ".npmrc");
  const envExamplePath = path.join(workspacePath, ".env.example");
  const envSamplePath = path.join(workspacePath, ".env.sample");
  const vercelPath = path.join(workspacePath, "vercel.json");
  const wranglerPath = path.join(workspacePath, "wrangler.toml");
  const railwayPath = path.join(workspacePath, "railway.json");
  const prismaPath = path.join(workspacePath, "prisma", "schema.prisma");
  const supabasePath = path.join(workspacePath, "supabase", "config.toml");
  const sentryPath = path.join(workspacePath, "sentry.client.config.ts");

  const [gitExists, packageJsonExists, packageLockExists, pnpmLockExists, yarnLockExists, bunLockExists, tsconfigExists, turboExists, pnpmWorkspaceExists, npmrcExists, envExampleExists, envSampleExists, vercelExists, wranglerExists, railwayExists, prismaExists, supabaseExists, sentryExists, workspaceEntries] = await Promise.all([
    pathExists(gitDir),
    pathExists(packageJsonPath),
    pathExists(packageLockPath),
    pathExists(pnpmLockPath),
    pathExists(yarnLockPath),
    pathExists(bunLockPath),
    pathExists(tsconfigPath),
    pathExists(turboPath),
    pathExists(pnpmWorkspacePath),
    pathExists(npmrcPath),
    pathExists(envExamplePath),
    pathExists(envSamplePath),
    pathExists(vercelPath),
    pathExists(wranglerPath),
    pathExists(railwayPath),
    pathExists(prismaPath),
    pathExists(supabasePath),
    pathExists(sentryPath),
    collectWorkspaceEntries(workspacePath),
  ]);

  let packageJson: any = null;
  if (packageJsonExists) {
    packageJson = await readJson(packageJsonPath, null);
  }

  const scripts = packageJson?.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {};
  const deps = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };
  const [npmrcContents, envExampleContents, envSampleContents] = await Promise.all([
    npmrcExists ? fs.readFile(npmrcPath, "utf8").catch(() => "") : "",
    envExampleExists ? fs.readFile(envExamplePath, "utf8").catch(() => "") : "",
    envSampleExists ? fs.readFile(envSamplePath, "utf8").catch(() => "") : "",
  ]);

  let framework = "unknown";
  if (deps.next) framework = "nextjs";
  else if (deps.nuxt) framework = "nuxt";
  else if (deps.react) framework = "react";
  else if (deps.vue) framework = "vue";
  else if (deps.svelte) framework = "svelte";
  else if (deps.express) framework = "express";

  let packageManager = "unknown";
  if (pnpmLockExists || packageJson?.packageManager?.startsWith("pnpm")) packageManager = "pnpm";
  else if (yarnLockExists || packageJson?.packageManager?.startsWith("yarn")) packageManager = "yarn";
  else if (bunLockExists || packageJson?.packageManager?.startsWith("bun")) packageManager = "bun";
  else if (packageLockExists || packageJsonExists) packageManager = "npm";

  const repoShape = turboExists || pnpmWorkspaceExists || Array.isArray(packageJson?.workspaces) ? "monorepo" : "single_repo";
  const buildDetected = typeof scripts.build === "string" && scripts.build.trim().length > 0;
  const testDetected = typeof scripts.test === "string" && scripts.test.trim().length > 0;
  const lintDetected = typeof scripts.lint === "string" && scripts.lint.trim().length > 0;
  const typecheckDetected = typeof scripts.typecheck === "string" && scripts.typecheck.trim().length > 0 || tsconfigExists;

  return {
    gitExists,
    packageJsonExists,
    packageManager,
    stack: packageJsonExists ? "node" : "unknown",
    framework,
    repoShape,
    buildDetected,
    testDetected,
    lintDetected,
    typecheckDetected,
    deployDetected: typeof scripts.deploy === "string" && scripts.deploy.trim().length > 0,
    privateRegistryRequired: /(_authToken|npmAuthToken|registry=)/i.test(npmrcContents)
      || Boolean(packageJson?.publishConfig?.registry),
    deployPlatforms: [
      ...(vercelExists ? ["vercel"] : []),
      ...(wranglerExists ? ["cloudflare"] : []),
      ...(railwayExists ? ["railway"] : []),
    ],
    databaseAccessDetected: prismaExists || supabaseExists,
    optionalIntegrations: [
      ...(sentryExists ? ["sentry"] : []),
    ],
    envExampleVariables: [...new Set([
      ...[envExampleContents, envSampleContents]
        .flatMap((content) => content.split(/\r?\n/))
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => line.split("=", 1)[0].trim())
        .filter(Boolean),
    ])],
    buildCommand: buildDetected ? String(scripts.build) : null,
    testCommand: testDetected ? String(scripts.test) : null,
    lintCommand: lintDetected ? String(scripts.lint) : null,
    typecheckCommand: typecheckDetected && typeof scripts.typecheck === "string" ? String(scripts.typecheck) : null,
    workspaceEntries,
  };
}

function detectProvider(repoUrl: string | null) {
  const source = String(repoUrl || "").toLowerCase();
  if (source.includes("github.com")) return "github";
  if (source.includes("gitlab")) return "gitlab";
  if (source.includes("bitbucket")) return "bitbucket";
  return "unknown";
}

function hasConfiguredSecret(config: any, names: string[]) {
  return names.some((name) => {
    const configValue = config?.env?.[name];
    const processValue = process.env[name];
    return Boolean(String(configValue || processValue || "").trim());
  });
}

async function readDynamicEnvFile(envPath: string): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(envPath, "utf8");
    return dotenv.parse(content);
  } catch {
    return {};
  }
}

async function buildDynamicSecretSnapshot(config: any, workspacePath: string | null): Promise<Record<string, string>> {
  const rootDir = normalizeNullableString(config?.rootDir) || process.cwd();
  const candidatePaths = [
    path.join(rootDir, ".env"),
    path.join(rootDir, ".env.sandbox"),
    ...(workspacePath ? [
      path.join(workspacePath, ".env"),
      path.join(workspacePath, ".env.local"),
      path.join(workspacePath, ".env.sandbox"),
    ] : []),
  ];

  const parsedFiles = await Promise.all(candidatePaths.map((envPath) => readDynamicEnvFile(envPath)));
  return Object.assign({}, ...parsedFiles);
}

async function hasConfiguredSecretFromRuntime(config: any, workspacePath: string | null, names: string[]) {
  const dynamicSecretSnapshot = await buildDynamicSecretSnapshot(config, workspacePath);
  return names.some((name) => {
    const configValue = config?.env?.[name];
    const processValue = process.env[name];
    const dynamicValue = dynamicSecretSnapshot[name];
    return Boolean(String(configValue || processValue || dynamicValue || "").trim());
  });
}

async function applyMockOnboardingAccessResolution(config: any, workspacePath: string | null) {
  const mockPayload = normalizeNullableString(config?.env?.mockTargetOnboardingAccessResolution);
  if (!mockPayload) {
    return false;
  }

  try {
    const parsed = JSON.parse(mockPayload);
    const rootDir = normalizeNullableString(config?.rootDir) || process.cwd();
    const rootEnvEntries = parsed?.rootEnv && typeof parsed.rootEnv === "object" ? Object.entries(parsed.rootEnv) : [];
    const workspaceEnvEntries = parsed?.workspaceEnv && typeof parsed.workspaceEnv === "object" ? Object.entries(parsed.workspaceEnv) : [];
    const workspaceDirectories = Array.isArray(parsed?.workspaceDirectories) ? parsed.workspaceDirectories : [];
    const workspaceFiles = parsed?.workspaceFiles && typeof parsed.workspaceFiles === "object" ? Object.entries(parsed.workspaceFiles) : [];

    if (rootEnvEntries.length > 0) {
      const content = rootEnvEntries.map(([key, value]) => `${String(key).trim()}=${String(value ?? "").trim()}`).join("\n");
      await fs.writeFile(path.join(rootDir, ".env"), `${content}\n`, "utf8");
    }
    if (workspacePath && workspaceEnvEntries.length > 0) {
      const content = workspaceEnvEntries.map(([key, value]) => `${String(key).trim()}=${String(value ?? "").trim()}`).join("\n");
      await fs.mkdir(workspacePath, { recursive: true });
      await fs.writeFile(path.join(workspacePath, ".env"), `${content}\n`, "utf8");
    }
    if (workspacePath) {
      for (const dirEntry of workspaceDirectories) {
        const dirPath = path.join(workspacePath, String(dirEntry || "").trim());
        await fs.mkdir(dirPath, { recursive: true });
      }
      for (const [relativeFilePath, fileContent] of workspaceFiles) {
        const resolvedPath = path.join(workspacePath, String(relativeFilePath || "").trim());
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, String(fileContent ?? ""), "utf8");
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function attemptInteractiveOnboardingAccessResolution(input: {
  config: any;
  preparedSession: any;
  workspacePath: string | null;
  workspaceFacts: any;
  repoProfile: any;
  requiredNow: string[];
  requiredLater: string[];
  optional: string[];
  manualStepRequired: boolean;
  bootstrapError: string | null;
}) {
  const { config, preparedSession, workspacePath, workspaceFacts, repoProfile, requiredNow, requiredLater, optional, manualStepRequired, bootstrapError } = input;
  const hasBlockingAccess = requiredNow.length > 0 || manualStepRequired;
  const interactiveEnabled = shouldEnableInteractiveAccessResolution(config);
  if (!interactiveEnabled || !hasBlockingAccess) {
    return { attempted: false, resolved: false, source: null };
  }

  const appliedMock = await applyMockOnboardingAccessResolution(config, workspacePath);
  if (appliedMock) {
    return { attempted: true, resolved: true, source: "mock" };
  }

  const command = normalizeNullableString(config?.env?.copilotCliCommand);
  if (!command) {
    return { attempted: false, resolved: false, source: null };
  }

  const prompt = [
    `You are ${TARGET_ONBOARDING_AGENT_SLUG}, BOX's onboarding access-resolution agent for a single-target delivery session.`,
    "Resolve operator-fixable access or setup blockers in the same active call before onboarding falls back to a waiting stage.",
    "Preferred credential placement for BOX runtime detection is the repo root .env file unless a safer workspace-local .env path is more appropriate.",
    "When a workspace/bootstrap issue is missing, guide the operator to create the exact directory/file or perform the exact non-destructive setup step, then verify it.",
    buildInteractiveAccessPromptSection({
      actor: "onboarding",
      activeTargetSession: preparedSession,
      acceptanceCriteria: preparedSession?.objective?.acceptanceCriteria,
    }),
    "Current onboarding blocker snapshot:",
    JSON.stringify({
      repoState: repoProfile?.repoState || null,
      repoStateReason: repoProfile?.repoStateReason || null,
      workspacePath,
      workspaceFacts: {
        stack: workspaceFacts?.stack || null,
        framework: workspaceFacts?.framework || null,
        packageManager: workspaceFacts?.packageManager || null,
        deployPlatforms: Array.isArray(workspaceFacts?.deployPlatforms) ? workspaceFacts.deployPlatforms : [],
        databaseAccessDetected: workspaceFacts?.databaseAccessDetected === true,
      },
      blockers: {
        requiredNow,
        requiredLater,
        optional,
        manualStepRequired,
        bootstrapError,
      },
    }, null, 2),
    "At the end, emit strict JSON only in the final block.",
    "===DECISION===",
    JSON.stringify({
      decision: {
        outcome: "resolved|still_blocked",
        summary: "string",
      },
    }, null, 2),
    "===END===",
  ].join("\n\n");

  const args = buildAgentArgs({
    agentSlug: agentFileExists(TARGET_ONBOARDING_AGENT_SLUG) ? TARGET_ONBOARDING_AGENT_SLUG : undefined,
    prompt,
    model: config?.roleRegistry?.targetOnboarding?.model || "Claude Sonnet 4.6",
    allowAll: true,
    allowInteractiveUserInput: true,
    noAskUser: false,
    silent: true,
  });

  try {
    appendAgentLiveLog(config, {
      agentSlug: TARGET_ONBOARDING_AGENT_SLUG,
      session: preparedSession,
      contextLabel: "onboarding_access_resolution",
      status: "starting",
      message: `requiredNow=${requiredNow.length} manualStepRequired=${String(manualStepRequired)}`,
    });
    const result: any = await spawnAsync(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(config?.env || {}) },
      timeoutMs: 240000,
    });
    const stdout = String(result?.stdout || "");
    const stderr = String(result?.stderr || "");
    const rawOutput = [stdout, stderr].filter(Boolean).join("\n");
    writeAgentDebugFile(config, {
      agentSlug: TARGET_ONBOARDING_AGENT_SLUG,
      session: preparedSession,
      contextLabel: "onboarding_access_resolution",
      prompt,
      result,
      metadata: {
        requiredNowCount: requiredNow.length,
        manualStepRequired,
      },
    });
    appendAgentLiveLogDetail(config, {
      agentSlug: TARGET_ONBOARDING_AGENT_SLUG,
      session: preparedSession,
      contextLabel: "onboarding_access_resolution",
      stage: "result",
      title: `onboarding access resolution [exit=${String(result?.status ?? "unknown")}]`,
      content: rawOutput || "(no output)",
    });
    const parsed = parseAgentOutput(rawOutput);
    const outcome = String(parsed?.parsed?.decision?.outcome || "").trim().toLowerCase();
    return {
      attempted: true,
      resolved: outcome === "resolved" || Number(result?.status ?? 1) === 0,
      source: "agent",
      summary: normalizeNullableString(parsed?.parsed?.decision?.summary),
    };
  } catch {
    return { attempted: true, resolved: false, source: "agent" };
  }
}

async function detectRequiredCredentials(provider: string, config: any, workspaceFacts: any, activeTargetSession: any, workspacePath: string | null) {
  const requiredNow: string[] = [];
  const requiredLater: string[] = [];
  const optional: string[] = [];
  const bootstrapStatus = String(activeTargetSession?.workspace?.bootstrap?.status || "").trim().toLowerCase();

  if (
    provider === "github"
    && bootstrapStatus === "awaiting_credentials"
    && !(await hasConfiguredSecretFromRuntime(config, workspacePath, ["githubToken", "copilotGithubToken", "GITHUB_TOKEN"]))
  ) {
    requiredNow.push("github_repo_access_token");
  }
  if (workspaceFacts.privateRegistryRequired && !(await hasConfiguredSecretFromRuntime(config, workspacePath, ["NPM_TOKEN", "NODE_AUTH_TOKEN", "YARN_NPM_AUTH_TOKEN"]))) {
    requiredNow.push("package_registry_access_token");
  }

  if (workspaceFacts.deployPlatforms.includes("vercel") && !(await hasConfiguredSecretFromRuntime(config, workspacePath, ["VERCEL_TOKEN"]))) {
    requiredLater.push("vercel_access_token");
  }
  if (workspaceFacts.deployPlatforms.includes("cloudflare") && !(await hasConfiguredSecretFromRuntime(config, workspacePath, ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_TOKEN"]))) {
    requiredLater.push("cloudflare_access_token");
  }
  if (workspaceFacts.deployPlatforms.includes("railway") && !(await hasConfiguredSecretFromRuntime(config, workspacePath, ["RAILWAY_TOKEN"]))) {
    requiredLater.push("railway_access_token");
  }
  if (workspaceFacts.databaseAccessDetected && !(await hasConfiguredSecretFromRuntime(config, workspacePath, ["DATABASE_URL", "DIRECT_URL", "SUPABASE_ACCESS_TOKEN"]))) {
    requiredLater.push("database_access_credentials");
  }

  if (workspaceFacts.optionalIntegrations.includes("sentry") && !(await hasConfiguredSecretFromRuntime(config, workspacePath, ["SENTRY_AUTH_TOKEN"]))) {
    optional.push("sentry_access_token");
  }

  for (const envVar of Array.isArray(workspaceFacts.envExampleVariables) ? workspaceFacts.envExampleVariables : []) {
    if (!/(token|secret|key|url)$/i.test(envVar)) continue;
    if (await hasConfiguredSecretFromRuntime(config, workspacePath, [envVar])) continue;
    if (/sentry/i.test(envVar)) {
      optional.push(envVar);
      continue;
    }
    if (/database|db|prisma|supabase/i.test(envVar)) {
      requiredLater.push(envVar);
      continue;
    }
    if (/deploy|vercel|railway|cloudflare/i.test(envVar)) {
      requiredLater.push(envVar);
      continue;
    }
  }

  return {
    requiredNow: [...new Set(requiredNow)],
    requiredLater: [...new Set(requiredLater.filter((entry) => !requiredNow.includes(entry)))],
    optional: [...new Set(optional.filter((entry) => !requiredNow.includes(entry) && !requiredLater.includes(entry)))],
  };
}

function buildReadinessDecision(input: {
  requiredNow: string[];
  workspacePrepared: boolean;
  repoMaterialPresent: boolean;
  manualStepRequired: boolean;
  riskLevel: string;
}) {
  if (input.requiredNow.length > 0) {
    return {
      readinessStatus: "blocked",
      recommendedNextStage: TARGET_SESSION_STAGE.AWAITING_CREDENTIALS,
      allowPlanning: false,
      allowShadowExecution: false,
      allowActiveExecution: false,
      quarantine: false,
      quarantineReason: null,
    };
  }

  if (!input.workspacePrepared || !input.repoMaterialPresent || input.manualStepRequired) {
    return {
      readinessStatus: "partial",
      recommendedNextStage: TARGET_SESSION_STAGE.AWAITING_MANUAL_STEP,
      allowPlanning: false,
      allowShadowExecution: false,
      allowActiveExecution: false,
      quarantine: false,
      quarantineReason: null,
    };
  }

  if (input.riskLevel === "high") {
    return {
      readinessStatus: "quarantined",
      recommendedNextStage: TARGET_SESSION_STAGE.QUARANTINED,
      allowPlanning: false,
      allowShadowExecution: false,
      allowActiveExecution: false,
      quarantine: true,
      quarantineReason: "target risk remains too high for safe automated delivery",
    };
  }

  return {
    readinessStatus: "clarification_required",
    recommendedNextStage: TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION,
    allowPlanning: false,
    allowShadowExecution: false,
    allowActiveExecution: false,
    quarantine: false,
    quarantineReason: null,
  };
}

function buildDeterministicClarificationPacket(preparedSession: any, repoProfile: any, workspaceFacts: any) {
  const isEmptyRepo = repoProfile.repoState === "empty";
  const selectedAgentSlug = isEmptyRepo
    ? TARGET_EMPTY_REPO_ONBOARDING_AGENT_SLUG
    : TARGET_EXISTING_REPO_ONBOARDING_AGENT_SLUG;
  const questions = isEmptyRepo
    ? [
        {
          id: "product_goal",
          title: "Initial request",
          prompt: INITIAL_ONBOARDING_FREE_TEXT_PROMPT,
          answerMode: "hybrid",
          options: ["Landing page", "Business website", "Dashboard/Admin panel", "Reservation/booking system", "E-commerce", "Other"],
        },
        {
          id: "target_users",
          title: "Who is it for?",
          prompt: "Who will use this product and what do they need most?",
          answerMode: "hybrid",
          options: ["Customers", "Internal team", "Restaurant guests", "Store admins", "Mixed audience", "Other"],
        },
        {
          id: "must_have_flows",
          title: "What must exist in v1?",
          prompt: "Which flows or pages are non-negotiable for the first version?",
          answerMode: "multi_select",
          options: ["Homepage", "Contact form", "Booking flow", "Auth/Login", "Admin dashboard", "Payment", "Content management", "Other"],
        },
        {
          id: "quality_bar",
          title: "What matters most?",
          prompt: "Choose the main priority so BOX can optimize the first build correctly.",
          answerMode: "single_select",
          options: ["Fast MVP", "Strong design polish", "Operational reliability", "Business conversion", "Internal workflow speed"],
        },
        {
          id: "design_direction",
          title: "What should it feel like?",
          prompt: "What kind of look, tone, or overall feel should the first version have? Answer in user-facing terms, not implementation details.",
          answerMode: "hybrid",
          options: ["Clean and professional", "Bold and modern", "Calm and minimal", "Playful and branded", "Other"],
        },
      ]
    : [
        {
          id: "repo_purpose_confirmation",
          title: "Initial request",
          prompt: INITIAL_ONBOARDING_FREE_TEXT_PROMPT,
          answerMode: "hybrid",
          options: ["New feature", "Redesign", "Bug fixes", "Stability/performance", "Cleanup/refactor", "Launch-ready polish", "Other"],
        },
        {
          id: "target_users",
          title: "Who is this for?",
          prompt: "Who are the primary users of the current product, and which users matter most for this requested change?",
          answerMode: "hybrid",
          options: ["Customers", "Internal team", "Admins/staff", "Mixed audience", "Other"],
        },
        {
          id: "requested_change",
          title: "What change do you want?",
          prompt: "What should BOX improve or build in this existing repository?",
          answerMode: "hybrid",
          options: ["New feature", "Redesign", "Bug fixes", "Stability/performance", "Cleanup/refactor", "Launch-ready polish", "Other"],
        },
        {
          id: "protected_areas",
          title: "What must stay safe?",
          prompt: "Which areas, flows, or business rules should BOX avoid breaking?",
          answerMode: "hybrid",
          options: ["Payments", "Auth", "Admin workflows", "Production infra", "Content/data", "Brand/UI", "Other"],
        },
        {
          id: "success_signal",
          title: "How will you judge success?",
          prompt: "What outcome would make you say the target work is correct?",
          answerMode: "hybrid",
          options: ["Feature works end-to-end", "Design looks production-ready", "Tests are green", "Deployment is safe", "Operations become easier", "Other"],
        },
      ];

  return {
    schemaVersion: TARGET_ONBOARDING_SCHEMA_VERSION,
    mode: isEmptyRepo ? "empty_repo" : "existing_repo",
    selectedAgentSlug,
    repoState: repoProfile.repoState,
    repoStateReason: repoProfile.repoStateReason,
    meaningfulEntryPoints: repoProfile.meaningfulEntryPoints,
    dominantSignals: repoProfile.dominantSignals,
    workspaceFacts: {
      stack: workspaceFacts.stack,
      framework: workspaceFacts.framework,
      packageManager: workspaceFacts.packageManager,
      repoShape: workspaceFacts.repoShape,
      buildDetected: workspaceFacts.buildDetected,
      testDetected: workspaceFacts.testDetected,
      lintDetected: workspaceFacts.lintDetected,
      typecheckDetected: workspaceFacts.typecheckDetected,
      deployDetected: workspaceFacts.deployDetected,
    },
    openingPrompt: INITIAL_ONBOARDING_FREE_TEXT_PROMPT,
    closingCriteria: [
      "User goal is concrete enough for planning.",
      "Scope boundaries are explicit enough to avoid accidental overbuild.",
      "Success criteria are concrete enough for Prometheus and Athena.",
    ],
    requiredSemanticSlots: questions.map((question: any) => String(question.id || "question").trim()).filter(Boolean),
    questions: questions.map((question: any) => ({
      ...question,
      semanticSlot: normalizeNullableString(question?.semanticSlot) || String(question.id || "question").trim(),
      required: question?.required !== false,
    })),
  };
}

async function requestClarificationPacketFromAgent(config: any, preparedSession: any, repoProfile: any, workspaceFacts: any) {
  const templatePacket = buildDeterministicClarificationPacket(preparedSession, repoProfile, workspaceFacts);
  const selectedAgentSlug = templatePacket.selectedAgentSlug;
  const requireSingleCallCompletion = config?.env?.targetOnboardingRequireSingleCallCompletion === true;
  const mockPacketText = normalizeNullableString(config?.env?.mockTargetOnboardingClarificationPacket);
  const singleCallState = preparedSession?.clarification?.singleCall && typeof preparedSession.clarification.singleCall === "object"
    ? preparedSession.clarification.singleCall
    : {};
  const retryableFailedSingleCall = singleCallState.attempted === true
    && singleCallState.completed !== true
    && singleCallState.failed === true
    && singleCallState.withinLimit !== false;

  if (singleCallState.attempted === true && singleCallState.completed !== true && !retryableFailedSingleCall) {
    throw new Error("Onboarding single-call already consumed for this session; retry/restart is disabled until manual reset.");
  }

  if (mockPacketText) {
    let parsedMockPacket: any;
    try {
      parsedMockPacket = JSON.parse(mockPacketText);
    } catch (error: any) {
      throw new Error(`Invalid mock onboarding clarification packet JSON: ${String(error?.message || error)}`);
    }
    await appendProgress(
      config,
      `[ONBOARDING][AI] using configured clarification packet override agent=${selectedAgentSlug} (no live onboarding call)`,
      {
        mode: preparedSession.currentMode,
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
      },
    );
    return normalizeClarificationPacket(parsedMockPacket, templatePacket);
  }

  const command = normalizeNullableString(config?.env?.copilotCliCommand);
  if (!command || /^__missing(?:_copilot_binary__)?$/i.test(command)) {
    await appendProgress(
      config,
      `[ONBOARDING][AI] clarification CLI unavailable agent=${selectedAgentSlug} — using deterministic intake packet`,
      {
        mode: preparedSession.currentMode,
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
      },
    );
    return templatePacket;
  }

  const semanticSlots = templatePacket.questions.map((question: any) => String(question.semanticSlot || question.id || "").trim()).filter(Boolean);

  // Pass ONLY session context as the prompt — all conversation rules live in the agent .md file.
  const prompt = [
    "Context:",
    JSON.stringify({
      projectId: preparedSession.projectId,
      sessionId: preparedSession.sessionId,
      repoUrl: preparedSession.repo?.repoUrl || null,
      repoFullName: preparedSession.repo?.repoFullName || null,
      repoName: preparedSession.repo?.name || null,
      repoProvider: preparedSession.repo?.provider || null,
      defaultBranch: preparedSession.repo?.defaultBranch || "main",
      workspacePath: preparedSession.workspace?.path || preparedSession.repo?.localPath || null,
      workspacePrepared: preparedSession.workspace?.prepared === true,
      workspaceBootstrapStatus: preparedSession.workspace?.bootstrap?.status || null,
      repoState: repoProfile.repoState,
      repoStateReason: repoProfile.repoStateReason,
      meaningfulEntryPoints: repoProfile.meaningfulEntryPoints,
      dominantSignals: repoProfile.dominantSignals,
      objectiveSummary: preparedSession.objective?.summary || null,
      desiredOutcome: preparedSession.objective?.desiredOutcome || null,
      acceptanceCriteria: preparedSession.objective?.acceptanceCriteria || [],
      preferredSemanticSlots: semanticSlots.length ? semanticSlots : ["product_goal", "target_users", "requested_change", "protected_areas", "success_signal"],
      stack: workspaceFacts.stack,
      framework: workspaceFacts.framework,
      repoShape: workspaceFacts.repoShape,
      buildDetected: workspaceFacts.buildDetected,
      testDetected: workspaceFacts.testDetected,
      lintDetected: workspaceFacts.lintDetected,
      typecheckDetected: workspaceFacts.typecheckDetected,
      deployDetected: workspaceFacts.deployDetected,
    }, null, 2),
  ].join("\n");

  const args = buildAgentArgs({
    agentSlug: agentFileExists(selectedAgentSlug) ? selectedAgentSlug : undefined,
    prompt,
    model: config?.roleRegistry?.targetOnboarding?.model || "Claude Sonnet 4.6",
    allowAll: true,
    allowInteractiveUserInput: true,
    noAskUser: false,
    autopilot: false,
    silent: false,
  });

  // Onboarding must run in true interactive mode so ask_user can be used.
  // buildAgentArgs emits -p (non-interactive), so convert first prompt flag to -i.
  const promptFlagIndex = args.indexOf("-p");
  if (promptFlagIndex >= 0) args[promptFlagIndex] = "-i";

  try {
    await persistOnboardingSingleCallState(config, preparedSession, {
      attempted: true,
      completed: false,
      inProgress: true,
      startedAt: new Date().toISOString(),
      selectedAgentSlug,
      maxPremiumRequests: 1,
    });

    await appendProgress(
      config,
      `[ONBOARDING][AI] requesting clarification packet from ${selectedAgentSlug}`,
      {
        mode: preparedSession.currentMode,
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
      },
    );
    appendAgentLiveLog(config, {
      agentSlug: selectedAgentSlug,
      session: preparedSession,
      contextLabel: "onboarding_clarification_packet",
      status: "starting",
      message: `requesting dynamic clarification packet repoState=${String(repoProfile.repoState || "unknown")}`,
    });

    let rawOutput = "";
    let result: any = null;
    let status = 1;

    const stateDir = config?.paths?.stateDir || path.join(process.cwd(), "state");
    const sessionSuffix = `${Date.now()}_${String(preparedSession?.sessionId || "").slice(-6)}`;
    const transcriptPath = path.join(stateDir, `onboarding_terminal_transcript_${sessionSuffix}.txt`);
    const consoleOutputPath = path.join(stateDir, `onboarding_terminal_console_${sessionSuffix}.txt`);

    await fs.unlink(transcriptPath).catch(() => {});
    await fs.unlink(consoleOutputPath).catch(() => {});
    const manifestPath = path.join(stateDir, `onboarding_terminal_manifest_${sessionSuffix}.json`);
    const doneFlagPath = path.join(stateDir, `onboarding_terminal_done_${sessionSuffix}.flag`);
    const psScriptPath = path.join(process.cwd(), "scripts", "onboarding-terminal.ps1");
    await fs.unlink(doneFlagPath).catch(() => {});

    await fs.writeFile(manifestPath, JSON.stringify({
      command,
      args,
      transcriptPath,
      consoleOutputPath,
      doneFlagPath,
      rootDir: process.cwd(),
      agentSlug: selectedAgentSlug,
    }, null, 2), "utf8");

    const { spawn: spawnChild } = await import("node:child_process");
    const termProc = spawnChild("cmd.exe", [
      "/c", "start", "ATLAS Onboarding Session",
      "pwsh.exe",
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", psScriptPath,
      "-ManifestPath", manifestPath,
      "-HoldSeconds", "10",
    ], { detached: true, stdio: "ignore", cwd: process.cwd(), env: process.env });
    termProc.unref();

    await appendProgress(config, `[ONBOARDING][AI] interactive session open in external terminal agent=${selectedAgentSlug}`, {
      mode: preparedSession.currentMode,
      projectId: preparedSession.projectId,
      sessionId: preparedSession.sessionId,
    });

    const sessionExitCode = await new Promise<number>((resolve) => {
      const poll = () => {
        fs.readFile(doneFlagPath, "utf8")
          .then((content) => {
            const code = parseInt(String(content || "0").replace("done:", "").trim(), 10);
            resolve(Number.isNaN(code) ? 1 : code);
          })
          .catch(() => setTimeout(poll, 2000));
      };
      poll();
    });

    status = sessionExitCode;
    rawOutput = await fs.readFile(consoleOutputPath, "utf8").catch(() => "");
    if (!String(rawOutput || "").trim()) {
      rawOutput = await fs.readFile(transcriptPath, "utf8").catch(() => "");
    }
    const premiumRequests = extractPremiumRequestsFromOutput(rawOutput);
    const withinLimit = premiumRequests == null || premiumRequests <= 1;
    result = {
      stdout: rawOutput,
      stderr: "",
      status,
      onboardingAiUsage: {
        premiumRequests,
        maxPremiumRequests: 1,
        withinLimit,
      },
    };

    await persistOnboardingSingleCallState(config, preparedSession, {
      attempted: true,
      completed: status === 0 && withinLimit,
      inProgress: false,
      finishedAt: new Date().toISOString(),
      premiumRequests,
      maxPremiumRequests: 1,
      withinLimit,
    });

    if (!withinLimit) {
      throw new Error(`Onboarding premium request limit exceeded: used=${String(premiumRequests)} max=1`);
    }

    writeAgentDebugFile(config, {
      agentSlug: selectedAgentSlug,
      session: preparedSession,
      contextLabel: "onboarding_clarification_packet",
      prompt,
      result,
      metadata: {
        repoState: repoProfile.repoState || null,
      },
    });
    appendAgentLiveLogDetail(config, {
      agentSlug: selectedAgentSlug,
      session: preparedSession,
      contextLabel: "onboarding_clarification_packet",
      stage: "result",
      title: `onboarding clarification packet [exit=${status}]`,
      content: rawOutput || "(no output)",
    });
    const parsed = parseAgentOutput(rawOutput);
    const normalizedPacket = normalizeClarificationPacket(parsed?.parsed?.packet || parsed?.parsed, templatePacket);
    if (status === 0 && parsed?.ok && normalizedPacket) {
      Object.assign(normalizedPacket, {
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
        __onboardingAiUsage: {
          premiumRequests: extractPremiumRequestsFromOutput(rawOutput),
          maxPremiumRequests: 1,
          withinLimit: true,
          source: "copilot_cli_single_process",
        },
      });
      const isCompleted = normalizedPacket?.conversationComplete === true || normalizedPacket?.readyForPlanning === true;
      const packetMatchesSession = isClarificationPacketBoundToSession(normalizedPacket, preparedSession);
      if (isCompleted && !packetMatchesSession) {
        throw new Error("Onboarding clarification packet does not belong to the active target session.");
      }
      if (requireSingleCallCompletion && !isCompleted) {
        throw new Error("Onboarding clarification must finish in this same AI call; packet was not marked complete.");
      }
      return normalizedPacket;
    }
    throw new Error(`Onboarding clarification failed: agent=${selectedAgentSlug} status=${status} parseOk=${parsed?.ok === true}`);
  } catch (error: any) {
    await persistOnboardingSingleCallState(config, preparedSession, {
      attempted: true,
      completed: false,
      inProgress: false,
      failed: true,
      failureReason: String(error?.message || error || "unknown"),
      finishedAt: new Date().toISOString(),
      maxPremiumRequests: 1,
    }).catch(() => undefined);
    await appendProgress(
      config,
      `[ONBOARDING][ERROR] clarification packet agent failure agent=${selectedAgentSlug} error=${String(error?.message || error || "unknown").slice(0, 160)}`,
      {
        mode: preparedSession.currentMode,
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
      },
    );
    throw error;
  }
}

function isClarificationComplete(clarificationPacket: any) {
  return clarificationPacket?.conversationComplete === true || clarificationPacket?.readyForPlanning === true;
}

function buildIntentContractSkeleton(preparedSession: any, clarificationPacket: any) {
  const conversationComplete = isClarificationComplete(clarificationPacket);
  const planningMode = conversationComplete
    ? resolveCompletedPlanningMode(clarificationPacket)
    : null;
  return {
    schemaVersion: 1,
    projectId: preparedSession.projectId,
    sessionId: preparedSession.sessionId,
    status: conversationComplete ? TARGET_INTENT_STATUS.READY_FOR_PLANNING : "pending_clarification",
    repoState: clarificationPacket.repoState,
    selectedAgentSlug: clarificationPacket.selectedAgentSlug,
    objectiveSummary: preparedSession.objective?.summary || null,
    desiredOutcome: preparedSession.objective?.desiredOutcome || null,
    deliveryModeDecision: null,
    requiredSemanticSlots: normalizeStringArray(clarificationPacket?.requiredSemanticSlots),
    authoredUnderstanding: clarificationPacket?.understanding || null,
    resolvedPacket: conversationComplete ? clarificationPacket : null,
    clarifiedIntent: conversationComplete
      ? normalizeClarifiedIntent(clarificationPacket?.clarifiedIntent)
      : {
          productType: null,
          targetUsers: [],
          mustHaveFlows: [],
          scopeIn: [],
          scopeOut: [],
          protectedAreas: [],
          preferredQualityBar: null,
          designDirection: null,
          deploymentExpectations: [],
          successCriteria: [],
        },
    assumptions: conversationComplete ? normalizeStringArray(clarificationPacket?.assumptions) : [],
    openQuestions: clarificationPacket.questions.map((question: any) => ({
      ...question,
      id: question.id,
      semanticSlot: normalizeNullableString(question.semanticSlot) || normalizeNullableString(question.id) || "question",
      title: question.title,
      prompt: question.prompt,
      answerMode: question.answerMode,
      options: Array.isArray(question.options) ? question.options : [],
      required: question?.required !== false,
      followUps: Array.isArray(question?.followUps) ? question.followUps : [],
    })),
    readyForPlanning: conversationComplete,
    planningMode,
    summary: conversationComplete ? normalizeNullableString(clarificationPacket?.summary) : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function evaluateTargetReadiness(config: any, activeTargetSession: any, actor: string) {
  if (!activeTargetSession) {
    throw new Error("Target readiness evaluation requires an active target session");
  }

  const stateDir = config?.paths?.stateDir || path.join(process.cwd(), "state");
  const workspaceDir = config?.paths?.workspaceDir || path.join(process.cwd(), ".box-work");
  const preparedSession = await prepareTargetWorkspaceForSession(activeTargetSession, config);
  const fallbackWorkspace = getTargetWorkspacePath(workspaceDir, activeTargetSession.projectId, activeTargetSession.sessionId);
  const candidateWorkspacePath = normalizeNullableString(preparedSession.workspace?.path)
    || normalizeNullableString(preparedSession.repo?.localPath)
    || fallbackWorkspace;
  const workspacePath = candidateWorkspacePath || fallbackWorkspace;
  const workspacePrepared = await pathExists(workspacePath);
  let workspaceFacts = workspacePrepared
    ? await detectWorkspaceFacts(workspacePath)
    : {
        gitExists: false,
        packageJsonExists: false,
        packageManager: "unknown",
        stack: "unknown",
        framework: "unknown",
        repoShape: "single_repo",
        buildDetected: false,
        testDetected: false,
        lintDetected: false,
        typecheckDetected: false,
        deployDetected: false,
        privateRegistryRequired: false,
        deployPlatforms: [],
        databaseAccessDetected: false,
        optionalIntegrations: [],
        envExampleVariables: [],
        buildCommand: null,
        testCommand: null,
        lintCommand: null,
        typecheckCommand: null,
        workspaceEntries: [],
      };

  const provider = detectProvider(preparedSession.repo?.repoUrl || null);
  let credentialState = await detectRequiredCredentials(provider, config, workspaceFacts, preparedSession, workspacePath);
  let requiredNow = credentialState.requiredNow;
  let requiredLater = credentialState.requiredLater;
  let optional = credentialState.optional;
  const bootstrapStatus = String(preparedSession.workspace?.bootstrap?.status || "").trim().toLowerCase();
  const bootstrapError = normalizeNullableString(preparedSession.workspace?.bootstrap?.lastError);
  let manualStepRequired = bootstrapStatus !== "awaiting_credentials" && (!workspacePrepared || !workspaceFacts.gitExists);
  const repoMaterialPresent = workspaceFacts.gitExists || workspaceFacts.packageJsonExists;
  let repoProfile = classifyRepoState(workspaceFacts, Array.isArray(workspaceFacts.workspaceEntries) ? workspaceFacts.workspaceEntries : []);
  const riskLevel = preparedSession.constraints?.protectedPaths?.length > 0 ? "medium" : "low";
  let confidenceScore = Math.max(0, Math.min(100,
    (workspacePrepared ? 30 : 0)
    + (repoMaterialPresent ? 20 : 0)
    + (workspaceFacts.buildDetected ? 10 : 0)
    + (workspaceFacts.testDetected ? 10 : 0)
    + (workspaceFacts.lintDetected ? 10 : 0)
    + (workspaceFacts.typecheckDetected ? 10 : 0)
    + (repoProfile.repoState === "existing" ? 10 : 0)
    - (requiredNow.length * 20)
    - (manualStepRequired ? 20 : 0)
  ));
  let decision = buildReadinessDecision({
    requiredNow,
    workspacePrepared,
    repoMaterialPresent,
    manualStepRequired,
    riskLevel,
  });

  const accessResolution = await attemptInteractiveOnboardingAccessResolution({
    config,
    preparedSession,
    workspacePath,
    workspaceFacts,
    repoProfile,
    requiredNow,
    requiredLater,
    optional,
    manualStepRequired,
    bootstrapError,
  });

  if (accessResolution.attempted) {
    const refreshedWorkspacePrepared = await pathExists(workspacePath);
    const refreshedWorkspaceFacts = refreshedWorkspacePrepared
      ? await detectWorkspaceFacts(workspacePath)
      : workspaceFacts;
    credentialState = await detectRequiredCredentials(provider, config, refreshedWorkspaceFacts, preparedSession, workspacePath);
    requiredNow = credentialState.requiredNow;
    requiredLater = credentialState.requiredLater;
    optional = credentialState.optional;
    manualStepRequired = bootstrapStatus !== "awaiting_credentials" && (!refreshedWorkspacePrepared || !refreshedWorkspaceFacts.gitExists);
    repoProfile = classifyRepoState(refreshedWorkspaceFacts, Array.isArray(refreshedWorkspaceFacts.workspaceEntries) ? refreshedWorkspaceFacts.workspaceEntries : []);
    confidenceScore = Math.max(0, Math.min(100,
      (refreshedWorkspacePrepared ? 30 : 0)
      + ((refreshedWorkspaceFacts.gitExists || refreshedWorkspaceFacts.packageJsonExists) ? 20 : 0)
      + (refreshedWorkspaceFacts.buildDetected ? 10 : 0)
      + (refreshedWorkspaceFacts.testDetected ? 10 : 0)
      + (refreshedWorkspaceFacts.lintDetected ? 10 : 0)
      + (refreshedWorkspaceFacts.typecheckDetected ? 10 : 0)
      + (repoProfile.repoState === "existing" ? 10 : 0)
      - (requiredNow.length * 20)
      - (manualStepRequired ? 20 : 0)
    ));
    decision = buildReadinessDecision({
      requiredNow,
      workspacePrepared: refreshedWorkspacePrepared,
      repoMaterialPresent: refreshedWorkspaceFacts.gitExists || refreshedWorkspaceFacts.packageJsonExists,
      manualStepRequired,
      riskLevel,
    });
    if (requiredNow.length === 0 && !manualStepRequired) {
      await appendProgress(
        config,
        `[ONBOARDING][ACCESS_RESOLUTION] same-call recovery cleared onboarding blockers source=${String(accessResolution.source || "unknown")}`,
        {
          mode: preparedSession.currentMode,
          projectId: preparedSession.projectId,
          sessionId: preparedSession.sessionId,
        },
      );
    }
    workspaceFacts = refreshedWorkspaceFacts;
  }

  const clarificationPacket = decision.recommendedNextStage === TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION
    ? await requestClarificationPacketFromAgent(config, preparedSession, repoProfile, workspaceFacts)
    : null;
  const onboardingAiUsage = clarificationPacket?.__onboardingAiUsage && typeof clarificationPacket.__onboardingAiUsage === "object"
    ? clarificationPacket.__onboardingAiUsage
    : null;
  const clarificationConversationCompleteRequested = clarificationPacket?.conversationComplete === true || clarificationPacket?.readyForPlanning === true;
  const clarificationPacketMatchesSession = clarificationPacket ? isClarificationPacketBoundToSession(clarificationPacket, preparedSession) : false;
  const hasConsumptiveOnboardingCall = onboardingAiUsage?.premiumRequests == null
    ? true
    : Number(onboardingAiUsage.premiumRequests) > 0;
  const clarificationConversationComplete = clarificationConversationCompleteRequested && hasConsumptiveOnboardingCall && clarificationPacketMatchesSession;
  if (clarificationConversationCompleteRequested && !hasConsumptiveOnboardingCall) {
    await appendProgress(
      config,
      "[ONBOARDING][WARN] clarification packet marked completed without consumptive AI usage; keeping session in clarification stage",
      {
        mode: preparedSession.currentMode,
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
      },
    );
  }
  if (clarificationConversationCompleteRequested && !clarificationPacketMatchesSession) {
    await appendProgress(
      config,
      "[ONBOARDING][WARN] clarification packet marked completed for a different or unresolved session; keeping session in clarification stage",
      {
        mode: preparedSession.currentMode,
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
      },
    );
  }
  const resolvedPlanningMode = clarificationConversationComplete ? resolveCompletedPlanningMode(clarificationPacket) : null;
  const resolvedPlanningStage = clarificationConversationComplete
    ? (resolvedPlanningMode === "shadow" ? TARGET_SESSION_STAGE.SHADOW : TARGET_SESSION_STAGE.ACTIVE)
    : null;
  const effectiveRecommendedNextStage = resolvedPlanningStage || decision.recommendedNextStage;
  const effectiveAllowPlanning = clarificationConversationComplete ? true : decision.allowPlanning;
  const effectiveAllowShadowExecution = clarificationConversationComplete ? resolvedPlanningStage === TARGET_SESSION_STAGE.SHADOW : decision.allowShadowExecution;
  const effectiveAllowActiveExecution = clarificationConversationComplete ? resolvedPlanningStage === TARGET_SESSION_STAGE.ACTIVE : decision.allowActiveExecution;

  const blockers = [];
  if (requiredNow.length > 0) {
    blockers.push({
      code: "missing_credentials",
      message: bootstrapError || `Missing required credentials: ${requiredNow.join(", ")}`,
      severity: "high",
      userActionRequired: true,
    });
  }
  if (manualStepRequired) {
    blockers.push({
      code: "workspace_not_ready",
      message: "Target repository workspace is not checked out and ready yet.",
      severity: "medium",
      userActionRequired: true,
    });
  }
  if (decision.quarantine) {
    blockers.push({
      code: "quarantine_required",
      message: decision.quarantineReason,
      severity: "critical",
      userActionRequired: true,
    });
  }

  const requiredHumanInputs = blockers.filter((entry) => entry.userActionRequired).map((entry) => entry.message);
  if (clarificationPacket && !clarificationConversationComplete) {
    requiredHumanInputs.push(`Respond to ${clarificationPacket.selectedAgentSlug} so BOX can clarify the target intent before planning starts.`);
  }

  const onboardingReport = {
    schemaVersion: TARGET_ONBOARDING_SCHEMA_VERSION,
    agent: {
      slug: TARGET_ONBOARDING_AGENT_SLUG,
      executionMode: "ai_led_single_call_clarification",
    },
    projectId: activeTargetSession.projectId,
    sessionId: activeTargetSession.sessionId,
    mode: activeTargetSession.currentMode,
    stage: TARGET_SESSION_STAGE.ONBOARDING,
    repo: {
      repoUrl: activeTargetSession.repo?.repoUrl || null,
      localPath: activeTargetSession.repo?.localPath || null,
      defaultBranch: activeTargetSession.repo?.defaultBranch || "main",
      vcsProvider: provider,
      repoState: repoProfile.repoState,
      repoStateReason: repoProfile.repoStateReason,
      meaningfulEntryPoints: repoProfile.meaningfulEntryPoints,
      dominantSignals: repoProfile.dominantSignals,
    },
    classification: {
      stack: workspaceFacts.stack,
      framework: workspaceFacts.framework,
      packageManager: workspaceFacts.packageManager,
      repoShape: workspaceFacts.repoShape,
      riskLevel,
    },
    readiness: {
      status: decision.readinessStatus,
      recommendedNextStage: effectiveRecommendedNextStage,
      readinessScore: confidenceScore,
    },
    prerequisites: {
      requiredNow,
      requiredLater,
      optional,
    },
    capabilities: {
      buildDetected: workspaceFacts.buildDetected,
      testDetected: workspaceFacts.testDetected,
      lintDetected: workspaceFacts.lintDetected,
      typecheckDetected: workspaceFacts.typecheckDetected,
      deployDetected: workspaceFacts.deployDetected,
    },
    baseline: {
      buildStatus: workspaceFacts.buildDetected ? "detected" : "not_detected",
      testStatus: workspaceFacts.testDetected ? "detected" : "not_detected",
      lintStatus: workspaceFacts.lintDetected ? "detected" : "not_detected",
      notes: [
        `workspacePrepared=${workspacePrepared}`,
        `repoMaterialPresent=${repoMaterialPresent}`,
        `repoState=${repoProfile.repoState}`,
      ],
    },
    blockers,
    clarification: clarificationPacket,
    nextAction: {
      owner: effectiveRecommendedNextStage === TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION ? "user" : "system",
      action: effectiveRecommendedNextStage === TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION
        ? `launch_${clarificationPacket?.selectedAgentSlug || "target_onboarding"}`
        : effectiveRecommendedNextStage === TARGET_SESSION_STAGE.AWAITING_CREDENTIALS
          ? "provide_required_credentials"
          : effectiveRecommendedNextStage === TARGET_SESSION_STAGE.AWAITING_MANUAL_STEP
            ? "prepare_target_workspace"
            : effectiveRecommendedNextStage === TARGET_SESSION_STAGE.QUARANTINED
              ? "request_human_review"
              : effectiveRecommendedNextStage === TARGET_SESSION_STAGE.ACTIVE
                ? "run_active_planning"
                : effectiveRecommendedNextStage === TARGET_SESSION_STAGE.SHADOW
                  ? "run_shadow_planning"
                  : "preserve_session_truth",
      reason: blockers[0]?.message || clarificationPacket?.summary || clarificationPacket?.openingPrompt || "Onboarding completed",
    },
    handoff: {
      allowPlanning: effectiveAllowPlanning,
      allowShadowExecution: effectiveAllowShadowExecution,
      allowActiveExecution: effectiveAllowActiveExecution,
      requiredHumanInputs,
      carriedContextSummary: clarificationConversationComplete
        ? String(clarificationPacket?.summary || `Repo precheck complete. repoState=${repoProfile.repoState}; stack=${workspaceFacts.stack}; framework=${workspaceFacts.framework}; packageManager=${workspaceFacts.packageManager}; nextStage=${effectiveRecommendedNextStage}; clarificationAgent=${clarificationPacket?.selectedAgentSlug || "none"}.`).trim()
        : `Repo precheck complete. repoState=${repoProfile.repoState}; stack=${workspaceFacts.stack}; framework=${workspaceFacts.framework}; packageManager=${workspaceFacts.packageManager}; nextStage=${effectiveRecommendedNextStage}; clarificationAgent=${clarificationPacket?.selectedAgentSlug || "none"}.`,
    },
    aiUsage: {
      premiumRequests: onboardingAiUsage?.premiumRequests ?? null,
      maxPremiumRequests: 1,
      withinLimit: onboardingAiUsage?.withinLimit !== false,
    },
  };

  const prerequisiteStatus = {
    projectId: activeTargetSession.projectId,
    sessionId: activeTargetSession.sessionId,
    requiredNow,
    requiredLater,
    optional,
    blockingNow: requiredNow.length > 0 || manualStepRequired,
    awaitingHumanInput: effectiveRecommendedNextStage === TARGET_SESSION_STAGE.AWAITING_CREDENTIALS
      || effectiveRecommendedNextStage === TARGET_SESSION_STAGE.AWAITING_MANUAL_STEP
      || effectiveRecommendedNextStage === TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION,
    blockedReason: blockers[0]?.message || (clarificationConversationComplete ? null : clarificationPacket?.openingPrompt) || null,
  };

  const baseline = {
    projectId: activeTargetSession.projectId,
    sessionId: activeTargetSession.sessionId,
    buildStatus: onboardingReport.baseline.buildStatus,
    testStatus: onboardingReport.baseline.testStatus,
    lintStatus: onboardingReport.baseline.lintStatus,
    typecheckStatus: workspaceFacts.typecheckDetected ? "detected" : "not_detected",
    notes: onboardingReport.baseline.notes,
  };

  const nextSession = {
    ...preparedSession,
    currentStage: effectiveRecommendedNextStage,
    workspace: {
      ...preparedSession.workspace,
      path: workspacePath,
      prepared: workspacePrepared,
      preparedAt: workspacePrepared
        ? normalizeNullableString(preparedSession.workspace?.preparedAt) || new Date().toISOString()
        : null,
    },
    onboarding: {
      completed: true,
      reportPath: getTargetOnboardingReportPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId),
      recommendedNextStage: effectiveRecommendedNextStage,
      readiness: decision.readinessStatus,
      readinessScore: confidenceScore,
      baselineCaptured: true,
    },
    repoProfile: {
      repoState: repoProfile.repoState,
      repoStateReason: repoProfile.repoStateReason,
      analysisPath: getTargetRepoAnalysisPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId),
      analyzedAt: new Date().toISOString(),
      selectedOnboardingAgent: clarificationPacket?.selectedAgentSlug || null,
      meaningfulEntryPoints: repoProfile.meaningfulEntryPoints,
      dominantSignals: repoProfile.dominantSignals,
    },
    clarification: {
      ...preparedSession.clarification,
      status: clarificationPacket ? (clarificationConversationComplete ? "completed" : "pending") : preparedSession.clarification?.status || "pending",
      mode: clarificationPacket?.mode || preparedSession.clarification?.mode || "unknown",
      selectedAgentSlug: clarificationPacket?.selectedAgentSlug || null,
      packetPath: getTargetClarificationPacketPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId),
      transcriptPath: getTargetClarificationTranscriptPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId),
      intentContractPath: getTargetIntentContractPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId),
      questionCount: Array.isArray(clarificationPacket?.questions) ? clarificationPacket.questions.length : 0,
      pendingQuestions: Array.isArray(clarificationPacket?.questions) ? clarificationPacket.questions.map((question: any) => String(question.title || question.id || "question").trim()).filter(Boolean) : [],
      loopCount: preparedSession.clarification?.loopCount || 0,
      singleCall: {
        ...(preparedSession?.clarification?.singleCall || {}),
        attempted: clarificationPacket ? true : Boolean(preparedSession?.clarification?.singleCall?.attempted),
        completed: clarificationConversationComplete,
        inProgress: false,
        finishedAt: new Date().toISOString(),
        premiumRequests: onboardingAiUsage?.premiumRequests ?? preparedSession?.clarification?.singleCall?.premiumRequests ?? null,
        maxPremiumRequests: 1,
        withinLimit: onboardingAiUsage?.withinLimit !== false,
      },
      readyForPlanning: clarificationConversationComplete,
      lastAskedAt: clarificationPacket && !clarificationConversationComplete ? new Date().toISOString() : preparedSession.clarification?.lastAskedAt || null,
      lastAnsweredAt: preparedSession.clarification?.lastAnsweredAt || null,
      completedAt: clarificationConversationComplete ? new Date().toISOString() : null,
    },
    intent: clarificationConversationComplete
      ? {
          status: TARGET_INTENT_STATUS.READY_FOR_PLANNING,
          summary: normalizeNullableString(clarificationPacket?.summary),
          repoState: normalizeNullableString(clarificationPacket?.repoState) || normalizeNullableString(repoProfile.repoState) || "unknown",
          planningMode: resolvedPlanningMode,
          ...normalizeClarifiedIntent(clarificationPacket?.clarifiedIntent),
          assumptions: normalizeStringArray(clarificationPacket?.assumptions),
          openQuestions: [],
          sourceIntentContractPath: getTargetIntentContractPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId),
          updatedAt: new Date().toISOString(),
        }
      : preparedSession.intent,
    prerequisites: prerequisiteStatus,
    gates: {
      allowPlanning: effectiveAllowPlanning,
      allowShadowExecution: effectiveAllowShadowExecution,
      allowActiveExecution: effectiveAllowActiveExecution,
      quarantine: decision.quarantine,
      quarantineReason: decision.quarantineReason,
    },
    lifecycle: {
      ...preparedSession.lifecycle,
      updatedAt: new Date().toISOString(),
    },
    handoff: {
      carriedContextSummary: onboardingReport.handoff.carriedContextSummary,
      requiredHumanInputs,
      lastAction: actor,
      nextAction: onboardingReport.nextAction.action,
    },
  };

  const intentContract = clarificationPacket ? buildIntentContractSkeleton(preparedSession, clarificationPacket) : null;
  const clarificationTranscript = clarificationPacket
    ? {
        schemaVersion: 1,
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
        status: clarificationConversationComplete ? "ready_for_planning" : "awaiting_user_response",
        turns: [],
        selectedAgentSlug: clarificationPacket.selectedAgentSlug,
        completedAt: clarificationConversationComplete ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      }
    : null;

    await appendProgress(
      config,
      `[ONBOARDING] repoState=${repoProfile.repoState} readiness=${decision.readinessStatus} nextStage=${effectiveRecommendedNextStage} clarificationAgent=${clarificationPacket?.selectedAgentSlug || "none"}`,
      {
        mode: preparedSession.currentMode,
        projectId: preparedSession.projectId,
        sessionId: preparedSession.sessionId,
      },
    );
    if (clarificationPacket) {
      await appendProgress(
        config,
        `[ONBOARDING][CLARIFICATION] agent=${clarificationPacket.selectedAgentSlug} mode=${clarificationPacket.mode} questions=${clarificationPacket.questions.length} repoState=${repoProfile.repoState} completed=${clarificationConversationComplete}`,
        {
          mode: preparedSession.currentMode,
          projectId: preparedSession.projectId,
          sessionId: preparedSession.sessionId,
        },
      );
      await appendProgress(
        config,
        `[ONBOARDING][AI_USAGE] premiumRequests=${String(onboardingReport.aiUsage.premiumRequests ?? "unknown")} max=1 withinLimit=${onboardingReport.aiUsage.withinLimit ? "true" : "false"}`,
        {
          mode: preparedSession.currentMode,
          projectId: preparedSession.projectId,
          sessionId: preparedSession.sessionId,
        },
      );
    }
    if (requiredNow.length > 0 || manualStepRequired || decision.quarantine) {
      await appendProgress(
        config,
        `[ONBOARDING][BLOCKERS] requiredNow=${requiredNow.length} manualStepRequired=${manualStepRequired} quarantined=${decision.quarantine}`,
        {
          mode: preparedSession.currentMode,
          projectId: preparedSession.projectId,
          sessionId: preparedSession.sessionId,
        },
      );
    }

  await Promise.all([
    writeJson(getTargetOnboardingReportPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId), onboardingReport),
    writeJson(getTargetPrerequisiteStatusPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId), prerequisiteStatus),
    writeJson(getTargetBaselinePath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId), baseline),
    writeJson(getTargetRepoAnalysisPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId), {
      schemaVersion: 1,
      projectId: preparedSession.projectId,
      sessionId: preparedSession.sessionId,
      repoState: repoProfile.repoState,
      repoStateReason: repoProfile.repoStateReason,
      meaningfulEntryPoints: repoProfile.meaningfulEntryPoints,
      dominantSignals: repoProfile.dominantSignals,
      workspaceFacts: onboardingReport.classification,
      analyzedAt: new Date().toISOString(),
    }),
    ...(clarificationPacket ? [writeJson(getTargetClarificationPacketPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId), clarificationPacket)] : []),
    ...(clarificationTranscript ? [writeJson(getTargetClarificationTranscriptPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId), clarificationTranscript)] : []),
    ...(intentContract ? [writeJson(getTargetIntentContractPath(stateDir, activeTargetSession.projectId, activeTargetSession.sessionId), intentContract)] : []),
  ]);

  const selectedSession = await loadActiveTargetSession(config).catch(() => null);
  const shouldSelectAsActive = !selectedSession
    || (
      String(selectedSession?.projectId || "") === String(nextSession?.projectId || "")
      && String(selectedSession?.sessionId || "") === String(nextSession?.sessionId || "")
    );
  const persistedSession = await saveTargetSession(config, nextSession, { selectAsActive: shouldSelectAsActive });
  return {
    session: persistedSession,
    report: onboardingReport,
    prerequisiteStatus,
    baseline,
  };
}

export async function runTargetOnboarding(config: any, activeTargetSession: any) {
  if (!activeTargetSession || activeTargetSession.currentStage !== TARGET_SESSION_STAGE.ONBOARDING) {
    throw new Error("Target onboarding requires an active session in onboarding stage");
  }
  return evaluateTargetReadiness(config, activeTargetSession, "onboarding_completed");
}

export async function refreshTargetSessionReadiness(config: any, activeTargetSession: any) {
  if (!activeTargetSession) {
    throw new Error("Target readiness refresh requires an active session");
  }
  return evaluateTargetReadiness(config, activeTargetSession, "readiness_refreshed");
}