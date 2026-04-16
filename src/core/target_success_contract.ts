import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { spawnAsync, writeJson } from "./fs_utils.js";
import { agentFileExists, buildAgentArgs, parseAgentOutput } from "./agent_loader.js";
import { getTargetCompletionPath, loadActiveTargetSession } from "./target_session_state.js";

export const TARGET_SUCCESS_CONTRACT_STATUS = Object.freeze({
  OPEN: "open",
  FULFILLED: "fulfilled",
  FULFILLED_WITH_HANDOFF: "fulfilled_with_handoff",
});

const NON_BLOCKING_ACCEPTANCE_CRITERIA = new Set(["clarified", "planning-ready"]);
const STOPWORDS = new Set([
  "a", "an", "and", "app", "be", "build", "completed", "correctly", "for", "has", "have", "i", "in",
  "is", "it", "list", "main", "of", "on", "or", "project", "simple", "the", "to", "want", "working",
]);

const PRODUCT_PRESENTER_AGENT_SLUG = "product-presenter";

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

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const mergedSha = (text.match(/BOX_MERGED_SHA=([0-9a-f]{7,40})/i)?.[1] || "").trim() || null;
  const expectedOutcome = (text.match(/BOX_EXPECTED_OUTCOME=([^\n\r]+)/i)?.[1] || "").trim() || null;
  const actualOutcome = (text.match(/BOX_ACTUAL_OUTCOME=([^\n\r]+)/i)?.[1] || "").trim() || null;
  const deliveredSentence = (text.match(/DELIVERED:[^\n\r]*/i)?.[0] || "").trim() || null;
  return {
    status,
    skipReason,
    mergedSha,
    expectedOutcome,
    actualOutcome,
    deliveredSentence,
    rawText: text,
  };
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

function evaluateDeliveryDimension(
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
  const statusEligible = evolutionEvidence.status === "done" || evolutionEvidence.status === "skipped";
  const mergedOrDelivered = /already merged on main|already present on main|delivered in the target repository|live repo passes|live at https?:\/\/|preview is available at https?:\/\/|deployed at https?:\/\//i.test(text);
  const satisfied = statusEligible && Boolean(evolutionEvidence.mergedSha) && mergedOrDelivered;
  return {
    status: satisfied ? "satisfied" : "missing",
    evidence: {
      status: evolutionEvidence.status,
      skipReason: evolutionEvidence.skipReason,
      mergedSha: evolutionEvidence.mergedSha,
      actualOutcome: evolutionEvidence.actualOutcome,
    },
  };
}

function evaluateReleaseDimension(qualityEvidence: ReturnType<typeof parseWorkerEvidence>) {
  const text = `${qualityEvidence.rawText}\n${qualityEvidence.actualOutcome || ""}`;
  const statusEligible = qualityEvidence.status === "done" || qualityEvidence.status === "skipped";
  const hasReleaseChecks = /all six release checks passed|release checks passed|verified live main already contains/i.test(text);
  const satisfied = statusEligible && Boolean(qualityEvidence.deliveredSentence) && hasReleaseChecks;
  return {
    status: satisfied ? "satisfied" : "missing",
    evidence: {
      status: qualityEvidence.status,
      skipReason: qualityEvidence.skipReason,
      deliveredSentence: qualityEvidence.deliveredSentence,
      actualOutcome: qualityEvidence.actualOutcome,
      mergedSha: qualityEvidence.mergedSha,
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
  const blockingAcceptanceCriteria = (Array.isArray(session?.objective?.acceptanceCriteria) ? session.objective.acceptanceCriteria : [])
    .map((entry: unknown) => String(entry || "").trim())
    .filter((entry: string) => entry && !NON_BLOCKING_ACCEPTANCE_CRITERIA.has(entry.toLowerCase()));
  const acceptanceCriteriaSatisfied = blockingAcceptanceCriteria.every((criteria: string) => normalizeText(evidenceText).includes(normalizeText(criteria)));
  const satisfied = objectiveSatisfied && mustHaveFlowSatisfied && acceptanceCriteriaSatisfied;

  return {
    status: satisfied ? "satisfied" : "missing",
    evidence: {
      objectiveTokens,
      matchedObjectiveTokens,
      matchedScopeTokens,
      blockingAcceptanceCriteria,
    },
  };
}

function evaluatePreferenceDimension(session: any, evidenceText: string) {
  const preferredQualityBar = String(session?.intent?.preferredQualityBar || "").trim();
  if (!preferredQualityBar) {
    return {
      status: "not_applicable",
      evidence: { preferredQualityBar: null, matchedSignals: [] },
    };
  }

  const matchedSignals: string[] = [];
  const normalizedEvidence = normalizeText(evidenceText);
  if (/fast mvp/i.test(preferredQualityBar) && /no build step|browser openable|live on main/.test(normalizedEvidence)) {
    matchedSignals.push("fast_mvp_delivery_shape");
  }
  if (/complete delete task flow/i.test(preferredQualityBar) && /complete toggles|delete removes|release checks passed/.test(normalizedEvidence)) {
    matchedSignals.push("core_todo_flows_verified");
  }

  return {
    status: matchedSignals.length > 0 ? "satisfied" : "unverified",
    evidence: { preferredQualityBar, matchedSignals },
  };
}

function normalizeRepoWebUrl(repoUrl: unknown): string | null {
  const raw = String(repoUrl || "").trim();
  if (!raw) return null;
  return raw.replace(/\.git$/i, "");
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
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(normalized)) return 100;
  if (/vercel\.app|netlify\.app|pages\.dev|github\.io|web\.app|azurewebsites\.net|onrender\.com|fly\.dev/.test(normalized)) return 90;
  if (/\/preview|\/demo|\/app|\/index\.html/.test(normalized)) return 80;
  if (/github\.com\/.+\/blob\//.test(normalized)) return 10;
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
    };
  }

  const entries = await fs.readdir(normalizedWorkspacePath, { withFileTypes: true }).catch(() => []);
  const topLevelEntries = entries
    .slice(0, 40)
    .map((entry) => `${entry.isDirectory() ? "dir" : "file"}:${entry.name}`)
    .sort();

  const packageJsonPath = path.join(normalizedWorkspacePath, "package.json");
  const readmePath = path.join(normalizedWorkspacePath, "README.md");
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

  return {
    exists: true,
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
  };
}

function buildFallbackDelivery(config: any, session: any, qualityEvidence: ReturnType<typeof parseWorkerEvidence>, reportStatus: string) {
  const repoWebUrl = normalizeRepoWebUrl(session?.repo?.repoUrl);
  const workspacePath = String(session?.workspace?.path || "").trim() || null;
  const deliveredSentence = qualityEvidence?.deliveredSentence || null;
  const evidencePreviewUrl = resolveEvidencePreviewUrl([
    deliveredSentence,
    qualityEvidence?.actualOutcome,
    qualityEvidence?.expectedOutcome,
    qualityEvidence?.rawText,
  ]);
  const openTarget = isTargetSuccessContractTerminal({ status: reportStatus }) && evidencePreviewUrl
    ? evidencePreviewUrl
    : null;
  const locationType = evidencePreviewUrl
    ? "url"
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
    preserveWorkspace: false,
    instructions,
    userMessage,
    resolutionSource: "fallback_evidence_only",
  };
}

function normalizePresentationDelivery(rawPresentation: any, fallback: any, reportStatus: string) {
  const locationType = String(rawPresentation?.locationType || "").trim().toLowerCase();
  const primaryLocation = String(rawPresentation?.primaryLocation || "").trim() || null;
  const openTarget = String(rawPresentation?.openTarget || "").trim() || null;
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
  const autoOpenEligible = isTargetSuccessContractTerminal({ status: reportStatus }) && Boolean(openTarget);
  if (!locationType || (!primaryLocation && !openTarget && !userMessage)) {
    return fallback;
  }
  return {
    ...fallback,
    status: resolvedStatus,
    locationType,
    primaryLocation: primaryLocation || openTarget || fallback.primaryLocation,
    openTarget: autoOpenEligible ? openTarget : null,
    autoOpenEligible,
    preserveWorkspace,
    instructions: instructions.length > 0 ? instructions : fallback.instructions,
    userMessage: userMessage || fallback.userMessage,
    resolutionSource: "product_presenter_ai",
  };
}

async function resolvePresentationDelivery(
  config: any,
  report: any,
  session: any,
  qualityEvidence: ReturnType<typeof parseWorkerEvidence>,
  opts: { resolvePresentation?: (input: any) => Promise<any> } = {},
) {
  const fallback = buildFallbackDelivery(config, session, qualityEvidence, report?.status);
  const workspaceContext = await readWorkspacePresentationContext(fallback.workspacePath);
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
  if (!agentFileExists(PRODUCT_PRESENTER_AGENT_SLUG)) {
    return fallback;
  }
  const model = config?.roleRegistry?.qualityReviewer?.model || "Claude Sonnet 4.6";
  const prompt = `You are BOX's product presentation agent.
Your task: decide how BOX should present a completed product to the user after delivery.

Rules:
- Use ONLY the evidence provided below.
- Do NOT invent files, routes, URLs, commands, servers, or deployment surfaces.
- Prefer an already-provided live preview URL when one exists.
- If no direct runnable surface is evidenced, document the safest verifiable access path instead of guessing.
- preserveWorkspace=true only when the target you want BOX to open depends on the local workspace continuing to exist.
- Output strict JSON only inside markers.

Context:
${JSON.stringify(requestPayload, null, 2)}

===DECISION===
{
  "presentation": {
    "status": "ready_to_open|documented|manual_followup_required",
    "locationType": "local_path|url|repo|workspace|manual",
    "primaryLocation": "string|null",
    "openTarget": "string|null",
    "preserveWorkspace": true,
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
    silent: true,
  });
  const result: any = await spawnAsync(command, args, {
    env: process.env,
    timeoutMs: 120000,
  });
  if (Number(result?.status ?? 1) !== 0 || !String(result?.stdout || "").trim()) {
    return {
      ...fallback,
      resolutionSource: `product_presenter_failed:${String(result?.stderr || result?.error || "empty_output").slice(0, 120)}`,
    };
  }
  const parsed = parseAgentOutput(String(result.stdout || ""));
  return normalizePresentationDelivery(parsed?.parsed?.presentation, fallback, report?.status);
}

async function openDeliveryTarget(targetPath: string) {
  const target = String(targetPath || "").trim();
  if (!target) {
    return { attempted: false, opened: false, reason: "missing_target" };
  }

  try {
    if (process.platform === "win32") {
      const normalizedTarget = path.resolve(target);
      const targetUrl = /^(https?:|file:)/i.test(target)
        ? target
        : pathToFileURL(normalizedTarget).toString();
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

      if (looksLikeHtml) {
        for (const candidate of browserCandidates) {
          if (!(await pathExists(candidate.path))) continue;
          const args = candidate.kind === "firefox"
            ? ["-new-window", targetUrl]
            : ["--new-window", targetUrl];
          const child = spawn(candidate.path, args, { detached: true, stdio: "ignore" });
          child.unref();
          return { attempted: true, opened: true, reason: `browser_new_window:${candidate.kind}` };
        }
      }

      const psTarget = target.replace(/'/g, "''");
      const child = spawn(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", `Start-Process -FilePath '${psTarget}'`],
        { detached: true, stdio: "ignore", windowsHide: true },
      );
      child.unref();
      return { attempted: true, opened: true, reason: looksLikeHtml ? "powershell_start_process_html" : null };
    }
    if (process.platform === "darwin") {
      const child = spawn("open", [target], { detached: true, stdio: "ignore" });
      child.unref();
      return { attempted: true, opened: true, reason: null };
    }
    const child = spawn("xdg-open", [target], { detached: true, stdio: "ignore" });
    child.unref();
    return { attempted: true, opened: true, reason: null };
  } catch (err) {
    return { attempted: true, opened: false, reason: String(err instanceof Error ? err.message : err || "open_failed") };
  }
}

export async function performTargetDeliveryHandoff(
  config: any,
  report: any,
  opts: {
    openTarget?: (target: string) => Promise<any>;
    resolvePresentation?: (input: any) => Promise<any>;
  } = {},
) {
  const stateDir = config?.paths?.stateDir || "state";
  const session = await loadActiveTargetSession(config);
  const qualityText = await readTextIfExists(path.join(stateDir, "debug_worker_quality-worker.txt"));
  const qualityEvidence = parseWorkerEvidence(qualityText);
  const delivery = await resolvePresentationDelivery(config, report, session || {
    repo: { repoUrl: report?.delivery?.repoWebUrl || null },
    workspace: { path: report?.delivery?.workspacePath || null },
    objective: { summary: report?.objectiveSummary || null },
  }, qualityEvidence, { resolvePresentation: opts.resolvePresentation });
  const openTargetFn = typeof opts.openTarget === "function" ? opts.openTarget : openDeliveryTarget;
  const autoOpen = delivery?.autoOpenEligible && delivery?.openTarget
    ? await openTargetFn(String(delivery.openTarget))
    : {
        attempted: false,
        opened: false,
        reason: delivery?.primaryLocation ? "auto_open_not_supported_for_surface" : "no_openable_target",
      };
  const handoff = {
    recordedAt: new Date().toISOString(),
    projectId: report?.projectId || null,
    sessionId: report?.sessionId || null,
    status: report?.status || null,
    summary: delivery?.userMessage || report?.summary || null,
    delivery,
    autoOpen,
  };
  await writeJson(path.join(stateDir, "last_target_delivery_handoff.json"), handoff);
  return handoff;
}

export function isTargetSuccessContractTerminal(report: any): boolean {
  const status = String(report?.status || "").trim().toLowerCase();
  return status === TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED
    || status === TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED_WITH_HANDOFF;
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
      dimensions: {},
    };
  }

  const [evolutionText, qualityText] = await Promise.all([
    readTextIfExists(path.join(stateDir, "debug_worker_evolution-worker.txt")),
    readTextIfExists(path.join(stateDir, "debug_worker_quality-worker.txt")),
  ]);
  const evolutionEvidence = parseWorkerEvidence(evolutionText);
  const qualityEvidence = parseWorkerEvidence(qualityText);
  const delivery = evaluateDeliveryDimension(evolutionEvidence, qualityEvidence);
  const releaseVerification = evaluateReleaseDimension(qualityEvidence);
  const evidenceText = [
    session?.objective?.summary,
    session?.intent?.summary,
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
  const { pendingHumanInputs, ignoredHumanInputs } = resolveEffectiveHumanInputs(session);
  const blockers: string[] = [];
  if (delivery.status !== "satisfied") blockers.push("delivery_evidence_missing");
  if (releaseVerification.status !== "satisfied") blockers.push("release_signoff_missing");
  if (intentCore.status !== "satisfied") blockers.push("intent_alignment_unverified");
  if (pendingHumanInputs.length > 0) blockers.push("human_input_pending");

  let status: string = TARGET_SUCCESS_CONTRACT_STATUS.OPEN;
  if (delivery.status === "satisfied" && releaseVerification.status === "satisfied" && intentCore.status === "satisfied") {
    status = pendingHumanInputs.length > 0
      ? TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED_WITH_HANDOFF
      : TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED;
  }

  const deliveryHandoff = buildFallbackDelivery(config, session, qualityEvidence, status);

  return {
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
    },
  };
}

export async function persistTargetSuccessContract(config: any, report: any) {
  if (!report?.projectId || !report?.sessionId) return null;
  const stateDir = config?.paths?.stateDir || "state";
  const completionPath = getTargetCompletionPath(stateDir, report.projectId, report.sessionId);
  await writeJson(completionPath, report);
  return completionPath;
}