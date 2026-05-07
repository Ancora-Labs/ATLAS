import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "../config.js";
import { READ_JSON_REASON, readJsonSafe, writeJson } from "../core/fs_utils.js";
import { bootstrapEnvironment } from "../env_bootstrap.js";
import type { AtlasSessionAttachment } from "./attachments.js";
import type { AtlasDesktopRepoMode } from "./desktop_state.js";

export interface AtlasClarificationPacket {
  sessionId: string;
  targetRepo: string;
  repoMode: AtlasDesktopRepoMode | null;
  objective: string;
  summary: string;
  operatorIntentBrief: string;
  openQuestions: string[];
  executionNotes: string[];
  attachments: AtlasSessionAttachment[];
  attachmentPlans: AtlasClarificationAttachmentPlan[];
  provider: string;
  rawResponse: string;
  createdAt: string;
}

export interface AtlasClarificationStatus {
  sessionId: string;
  ready: boolean;
  packetPath: string;
  packet: AtlasClarificationPacket | null;
}

export interface AtlasClarificationResult {
  summary: string;
  operatorIntentBrief: string;
  openQuestions: string[];
  executionNotes: string[];
  attachmentPlans: AtlasClarificationAttachmentPlan[];
}

export interface AtlasClarificationAttachmentPlan {
  attachmentId: string;
  attachmentName: string;
  storedRelativePath: string;
  intendedUse: string;
  placementHint: string;
  implementationNotes: string[];
}

export interface AtlasClarificationAnswer {
  question: string;
  answer: string;
}

export interface AtlasClarificationRunnerInput {
  command: string;
  prompt: string;
}

export type AtlasClarificationRunner = (
  input: AtlasClarificationRunnerInput,
) => Promise<string>;

export const ATLAS_CLARIFICATION_MODEL = "gpt-5-mini";
export const ATLAS_CLARIFICATION_RATE_LIMIT_FALLBACK_MODEL = "gpt-5-mini";
const ATLAS_CLARIFICATION_COMMAND_TIMEOUT_MS = 180000;
const ATLAS_CLARIFICATION_JSON_IDLE_MS = 1000;

interface AtlasClarificationCommandResult {
  stdout: string;
  stderr: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  error: Error | null;
}

export interface CreateAtlasClarificationPacketOptions {
  stateDir: string;
  sessionId: string;
  targetRepo: string;
  repoMode?: AtlasDesktopRepoMode | null;
  objective: string;
  attachments?: AtlasSessionAttachment[];
  clarificationAnswers?: AtlasClarificationAnswer[];
  allowResolvedPacket?: boolean;
  command?: string;
  runner?: AtlasClarificationRunner;
}

export class AtlasClarificationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "atlas_clarification_error") {
    super(message);
    this.name = "AtlasClarificationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function sanitizeSessionId(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "atlas-session";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeIntentBrief(value: unknown): string {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .trim();
}

function normalizeRepoMode(value: unknown): AtlasDesktopRepoMode | null {
  return value === "existing" || value === "new" ? value : null;
}

function normalizeClarificationAnswers(value: AtlasClarificationAnswer[] | undefined): AtlasClarificationAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => ({
      question: normalizeString(entry?.question),
      answer: normalizeString(entry?.answer),
    }))
    .filter((entry) => entry.question && entry.answer)
    .slice(0, 12);
}

function findAttachmentMatch(
  attachments: AtlasSessionAttachment[],
  value: unknown,
): AtlasSessionAttachment | null {
  const key = normalizeString(value).toLowerCase();
  if (!key) {
    return null;
  }

  return attachments.find((attachment) => (
    attachment.id.toLowerCase() === key
    || attachment.originalName.toLowerCase() === key
    || attachment.storedRelativePath.toLowerCase() === key
  )) || null;
}

export function createAtlasFallbackAttachmentPlan(
  attachment: AtlasSessionAttachment,
): AtlasClarificationAttachmentPlan {
  const placementHint = attachment.kind === "image"
    ? "Use this exact operator-supplied image in the most relevant visual section such as hero, gallery, about, team, testimonial, or brand content."
    : attachment.kind === "text"
      ? "Use this file as source copy or structured content during implementation."
      : attachment.kind === "document"
        ? "Review this document before implementation and pull the relevant facts or copy into the final build."
        : "Inspect this file before implementation and place it where the operator-supplied material is required.";

  const intendedUse = attachment.kind === "image"
    ? "Use this exact operator-supplied image file in the final deliverable wherever the requested real photo, screenshot, or branded visual is needed."
    : attachment.roleHint;

  const implementationNotes = attachment.kind === "image"
    ? [
        `Load ${attachment.originalName} from ${attachment.storedRelativePath} when building the final deliverable.`,
        "Use this exact operator-supplied image file wherever the real visual asset is required in the final deliverable.",
        "Preserve this exact operator-supplied image file as the source visual for the matching final-deliverable surface.",
      ]
    : [
        `Load ${attachment.originalName} from ${attachment.storedRelativePath} before implementation decisions are finalized.`,
        attachment.roleHint,
      ];

  return {
    attachmentId: attachment.id,
    attachmentName: attachment.originalName,
    storedRelativePath: attachment.storedRelativePath,
    intendedUse,
    placementHint,
    implementationNotes: implementationNotes.slice(0, 3),
  };
}

function normalizeAttachmentPlan(
  value: unknown,
  attachments: AtlasSessionAttachment[],
): AtlasClarificationAttachmentPlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const attachment = findAttachmentMatch(
    attachments,
    value.attachmentId || value.attachmentName || value.storedRelativePath,
  );
  if (!attachment) {
    return null;
  }

  const fallbackPlan = createAtlasFallbackAttachmentPlan(attachment);
  const implementationNotes = normalizeStringList(value.implementationNotes, 3);

  return {
    attachmentId: attachment.id,
    attachmentName: attachment.originalName,
    storedRelativePath: attachment.storedRelativePath,
    intendedUse: normalizeString(value.intendedUse || value.use || value.roleHint) || fallbackPlan.intendedUse,
    placementHint: normalizeString(value.placementHint || value.placement || value.location) || fallbackPlan.placementHint,
    implementationNotes: implementationNotes.length > 0 ? implementationNotes : fallbackPlan.implementationNotes,
  };
}

export function resolveAtlasClarificationAttachmentPlans(
  attachments: AtlasSessionAttachment[],
  plans: AtlasClarificationAttachmentPlan[],
): AtlasClarificationAttachmentPlan[] {
  if (!attachments.length) {
    return [];
  }

  const planByAttachmentId = new Map<string, AtlasClarificationAttachmentPlan>();
  for (const plan of plans) {
    if (!planByAttachmentId.has(plan.attachmentId)) {
      planByAttachmentId.set(plan.attachmentId, plan);
    }
  }

  return attachments.map((attachment) => planByAttachmentId.get(attachment.id) || createAtlasFallbackAttachmentPlan(attachment));
}

function buildAttachmentAwareExecutionNotes(
  executionNotes: string[],
  attachments: AtlasSessionAttachment[],
  attachmentPlans: AtlasClarificationAttachmentPlan[],
): string[] {
  const normalizedNotes = executionNotes.filter(Boolean);
  if (!attachments.length) {
    return normalizedNotes;
  }

  if (normalizedNotes.some((note) => /(attach|asset|image|photo|file)/i.test(note))) {
    return normalizedNotes;
  }

  const pointerNote = attachmentPlans.length === 1
    ? `Use the recorded attachment ${attachmentPlans[0].attachmentName} from ${attachmentPlans[0].storedRelativePath} in the final build as planned.`
    : "Use the recorded session attachments from their stored paths according to attachmentPlans.";

  if (normalizedNotes.length === 0) {
    return [pointerNote];
  }

  return [...normalizedNotes, pointerNote];
}

export function getAtlasClarificationPacketPath(stateDir: string, sessionId: string): string {
  return path.join(
    stateDir,
    "atlas",
    "desktop_sessions",
    sanitizeSessionId(sessionId),
    "clarification_packet.json",
  );
}

function buildAttachmentPromptBlock(attachments: AtlasSessionAttachment[]): string[] {
  if (!attachments.length) {
    return ["Attached session files: none."];
  }

  return [
    "Attached session files:",
    ...attachments.flatMap((attachment) => {
      const lines = [
        `- id: ${attachment.id}`,
        `  name: ${attachment.originalName}`,
        `  kind: ${attachment.kind}`,
        `  mediaType: ${attachment.mediaType || "application/octet-stream"}`,
        `  byteSize: ${String(attachment.byteSize)}`,
        `  storedRelativePath: ${attachment.storedRelativePath}`,
        `  roleHint: ${attachment.roleHint}`,
      ];
      if (attachment.textPreview) {
        lines.push(`  textPreview: ${attachment.textPreview.replace(/\s+/g, " ").slice(0, 320)}`);
      }
      return lines;
    }),
  ];
}

function buildClarificationAnswerPromptBlock(clarificationAnswers: AtlasClarificationAnswer[]): string[] {
  if (!clarificationAnswers.length) {
    return ["Recorded clarification answers: none."];
  }

  return [
    "Recorded clarification answers:",
    ...clarificationAnswers.flatMap((entry) => [
      `- question: ${entry.question}`,
      `  answer: ${entry.answer}`,
    ]),
  ];
}

export function buildAtlasClarificationPrompt(
  targetRepo: string,
  objective: string,
  attachments: AtlasSessionAttachment[] = [],
  repoMode: AtlasDesktopRepoMode | null = null,
  clarificationAnswers: AtlasClarificationAnswer[] = [],
  allowResolvedPacket = false,
): string {
  const repoModeBlock = repoMode === "existing"
    ? [
        "Repository mode: existing repository with operator-owned code already present.",
        "Bias clarification toward change scope, protected flows, integration boundaries, data constraints, deployment expectations, and what must stay untouched.",
        "Avoid greenfield setup questions unless the operator objective explicitly asks for a rebuild or major stack change.",
      ]
    : repoMode === "new"
      ? [
          "Repository mode: fresh or empty repository intended for a new project.",
          "Bias clarification toward product scope, requested interaction surface, brand direction, launch constraints, and the minimum viable outcome for the first delivery.",
          "Do not waste questions on legacy compatibility unless the operator objective introduces external systems that must already be integrated.",
        ]
      : [
          "Repository mode: not yet classified.",
          "Ask only the smallest clarification set needed to safely move into planning.",
        ];

  return [
    "You are ATLAS onboarding, collecting a planning handoff for the operator's requested deliverable.",
    "The ATLAS desktop app is only the intake surface. It is not evidence that the requested product is a desktop app, shell experience, or native runtime.",
    "Read the operator objective and respond with exactly one JSON object.",
    "Do not include markdown fences, commentary, or any extra text.",
    "Schema:",
    "{",
    '  "summary": "one sentence in English",',
    '  "operatorIntentBrief": "detailed English planning handoff that preserves exactly what the operator wants without softening important constraints",',
    '  "openQuestions": ["1 to 3 concise clarification questions"],',
    '  "executionNotes": ["1 to 3 deterministic next-step notes for planning handoff"],',
    '  "attachmentPlans": [{"attachmentId": "match an input attachment id", "attachmentName": "input file name", "storedRelativePath": "input stored path", "intendedUse": "where the file should be used in the final deliverable", "placementHint": "exact or likely placement in the build", "implementationNotes": ["1 to 3 deterministic build notes"]}]',
    "}",
    "Constraints:",
    "- summary must be a non-empty English sentence under 220 characters.",
    "- operatorIntentBrief must be a non-empty English handoff brief that preserves the requested product, confirmed constraints, protected details, and visual/asset expectations without compressing them away.",
    "- operatorIntentBrief is the authoritative detailed handoff. Prefer 2 to 6 sentences or short paragraphs over a slogan-like summary.",
    "- if the operator provides a concrete reference site, screenshot set, attachment, or named visual exemplar, preserve that reference as the primary design authority for layout, section order, spacing rhythm, component shapes, CTA placement, media treatment, and breakpoint behavior instead of rewriting it into a generic safe fallback.",
    "- if the operator requests UI work and does not provide a concrete reference, preserve a requirement to source and inspect at least one external visual exemplar before implementation begins rather than letting the build start from generic scaffolding or house-style guesses.",
    "- when the operator provides a reference site or named external design target, keep planning anchored to a concrete visual capture or provided screenshot from that reference before reducing the task into components, sections, or scaffolding language.",
    "- HTML scraping, text extraction, headings, navigation labels, or DOM summaries from a reference site are supporting evidence only; they are not enough by themselves to redefine the requested design direction.",
    "- if external exemplar research is blocked, preserve that blocker explicitly instead of silently substituting a generic safe UI direction.",
    "- do not soften a broad or simple UI brief into a safer, more generic, more basic, or more template-like design direction when a concrete external reference or source example is available to anchor the work.",
    "- if a specific reference detail cannot be carried into the final deliverable because of an explicit blocker, keep the rest of the reference-specific direction intact and describe the blocker precisely rather than diluting the whole design brief into a generic alternative.",
    allowResolvedPacket
      ? "- openQuestions may be [] only when the recorded clarification answers already resolve the onboarding packet for planning handoff. Otherwise return 1 to 3 unresolved questions."
      : "- openQuestions must contain at least 1 and at most 3 strings.",
    "- executionNotes must contain at least 1 and at most 3 strings.",
    "- ask in plain product language the operator would naturally understand.",
    "- do not use internal jargon such as shell experience, delivery shell, runtime container, orchestration, or agent names.",
    "- do not ask about desktop shells, Electron, frontend stacks, framework choice, or implementation technology unless the operator explicitly requested that surface or the repo evidence makes it a real planning constraint.",
    "- attachmentPlans must be an array. Return [] when no attachments are present.",
    "- when attachments are present, include one attachmentPlans item per attachment.",
    "- if an attachment is an operator-supplied photo or image, tell builders to use that exact file instead of generic replacement imagery when appropriate.",
    "- if the operator objective or attachments identify a real photo, logo, screenshot, or other source image, preserve that source in attachmentPlans.",
    "- preserve real visual sources as direct build requirements when the operator objective or attachments identify them.",
    "- if the operator says original assets cannot be reused but similar, replacement, or newly sourced assets are acceptable, do not convert that into a stop-work instruction.",
    "- do not write executionNotes or operatorIntentBrief text that says to hold work until written permission, original assets, or exact-source rights are provided unless the operator explicitly says work must pause until those rights are secured.",
    "- in that replacement-allowed case, preserve the intended visual outcome and say builders should source non-infringing replacement assets that match the requested feel, subject, or brand constraints.",
    "- ask a clarifying question instead of emitting a hard stop only when it is still unclear whether replacement assets are acceptable.",
    "- if the exact placement of an attachment is still ambiguous, keep the best current placementHint and ask a clarifying question.",
    `Target repository: ${targetRepo || "unknown target repository"}`,
    ...repoModeBlock,
    `Operator objective: ${objective}`,
    ...buildClarificationAnswerPromptBlock(normalizeClarificationAnswers(clarificationAnswers)),
    ...buildAttachmentPromptBlock(attachments),
  ].join("\n");
}

function extractFirstJsonObject(raw: string): string {
  const text = String(raw || "").trim();
  const startIndex = text.indexOf("{");
  if (startIndex < 0) {
    throw new AtlasClarificationError(
      "Clarification provider did not return a JSON object.",
      502,
      "clarification_contract_invalid",
    );
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  throw new AtlasClarificationError(
    "Clarification provider returned incomplete JSON.",
    502,
    "clarification_contract_invalid",
  );
}

function hasCompleteJsonObject(raw: string): boolean {
  try {
    extractFirstJsonObject(raw);
    return true;
  } catch {
    return false;
  }
}

export function parseAtlasClarificationResponse(
  raw: string,
  attachments: AtlasSessionAttachment[] = [],
  options: { allowResolvedPacket?: boolean } = {},
): AtlasClarificationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractFirstJsonObject(raw));
  } catch (error) {
    if (error instanceof AtlasClarificationError) {
      throw error;
    }
    throw new AtlasClarificationError(
      `Clarification provider returned invalid JSON: ${String((error as Error)?.message || error)}`,
      502,
      "clarification_contract_invalid",
    );
  }

  if (!isRecord(parsed)) {
    throw new AtlasClarificationError(
      "Clarification provider returned a non-object payload.",
      502,
      "clarification_contract_invalid",
    );
  }

  const summary = String(parsed.summary || "").trim();
  const operatorIntentBrief = normalizeIntentBrief(parsed.operatorIntentBrief);
  const openQuestions = normalizeStringList(parsed.openQuestions, 3);
  const executionNotes = normalizeStringList(parsed.executionNotes, 3);
  const attachmentPlans = Array.isArray(parsed.attachmentPlans)
    ? resolveAtlasClarificationAttachmentPlans(
        attachments,
        parsed.attachmentPlans
          .map((value) => normalizeAttachmentPlan(value, attachments))
          .filter((plan): plan is AtlasClarificationAttachmentPlan => plan !== null),
      )
    : resolveAtlasClarificationAttachmentPlans(attachments, []);

  if (!summary) {
    throw new AtlasClarificationError(
      "Clarification provider response is missing a summary.",
      502,
      "clarification_contract_invalid",
    );
  }
  if (!operatorIntentBrief) {
    throw new AtlasClarificationError(
      "Clarification provider response is missing operatorIntentBrief.",
      502,
      "clarification_contract_invalid",
    );
  }
  if (openQuestions.length === 0 && !options.allowResolvedPacket) {
    throw new AtlasClarificationError(
      "Clarification provider response is missing open questions.",
      502,
      "clarification_contract_invalid",
    );
  }
  if (executionNotes.length === 0) {
    throw new AtlasClarificationError(
      "Clarification provider response is missing execution notes.",
      502,
      "clarification_contract_invalid",
    );
  }

  return {
    summary,
    operatorIntentBrief,
    openQuestions,
    executionNotes,
    attachmentPlans,
  };
}

async function resolveClarificationCommand(explicitCommand?: string): Promise<string> {
  const trimmed = String(explicitCommand || "").trim();
  if (trimmed) return resolveWindowsCopilotExecutable(trimmed);

  const config = await loadConfig();
  const configured = String(config.copilotCliCommand || "").trim();
  return resolveWindowsCopilotExecutable(configured || "copilot");
}

function resolveWindowsCopilotExecutable(command: string): string {
  if (process.platform !== "win32") {
    return command;
  }

  const commandName = path.basename(command).toLowerCase();
  if (!["copilot", "copilot.exe", "copilot.cmd", "copilot.ps1"].includes(commandName)) {
    return command;
  }

  const excludedDirs = new Set<string>();
  if (/[\\/]/.test(command)) {
    excludedDirs.add(path.dirname(path.resolve(command)).toLowerCase());
  }

  for (const pathEntry of String(process.env.PATH || "").split(path.delimiter)) {
    const trimmedEntry = pathEntry.trim();
    if (!trimmedEntry) continue;
    const normalizedEntry = path.resolve(trimmedEntry).toLowerCase();
    if (excludedDirs.has(normalizedEntry)) continue;
    const candidate = path.join(trimmedEntry, "copilot.exe");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return command;
}

async function runAtlasClarificationCommand(
  input: AtlasClarificationRunnerInput,
): Promise<string> {
  const promptArgs = [
    "--silent",
    "--no-color",
    "--no-remote",
    "--disable-builtin-mcps",
    "--no-custom-instructions",
    "--no-auto-update",
    "--prompt",
    input.prompt,
    "--model",
    ATLAS_CLARIFICATION_MODEL,
  ];
  const firstResult = await runAtlasClarificationCommandOnce(
    input.command,
    promptArgs,
    buildAtlasClarificationCommandEnv({ model: ATLAS_CLARIFICATION_MODEL }),
  );
  const result = isCopilotRateLimitFailure(firstResult) && ATLAS_CLARIFICATION_MODEL !== ATLAS_CLARIFICATION_RATE_LIMIT_FALLBACK_MODEL
    ? await runAtlasClarificationCommandOnce(
        input.command,
        promptArgs.map((arg, index) => (promptArgs[index - 1] === "--model" ? ATLAS_CLARIFICATION_RATE_LIMIT_FALLBACK_MODEL : arg)),
        buildAtlasClarificationCommandEnv({ model: ATLAS_CLARIFICATION_RATE_LIMIT_FALLBACK_MODEL }),
      )
    : firstResult;

  if (result.error) {
    throw new AtlasClarificationError(
      `Clarification invocation failed: ${String(result.error.message || result.error)}`,
      502,
      "clarification_invocation_failed",
    );
  }

  if (result.status !== 0) {
    const failureDetail = [
      String(result.stdout || "").trim(),
      String(result.stderr || "").trim(),
    ].filter(Boolean).join("\n");
    throw new AtlasClarificationError(
      `Clarification invocation failed with status ${String(result.status)}.${failureDetail ? ` ${failureDetail}` : ""}`,
      502,
      "clarification_invocation_failed",
    );
  }

  const output = String(result.stdout || "").trim();
  if (!output) {
    throw new AtlasClarificationError(
      "Clarification invocation returned an empty response.",
      502,
      "clarification_invocation_failed",
    );
  }

  return output;
}

export function buildAtlasClarificationCommandEnv(overrides: { model?: string } = {}): NodeJS.ProcessEnv {
  bootstrapEnvironment({ forceReload: true, preferRepoEnv: true });
  const env: NodeJS.ProcessEnv = { ...process.env };
  const copilotToken = resolveFirstSupportedCopilotCliToken(
    process.env.COPILOT_GITHUB_TOKEN,
    process.env.GITHUB_FINEGRADED,
  );
  const githubToken = resolveFirstSupportedCopilotCliToken(
    process.env.GITHUB_TOKEN,
    process.env.GH_TOKEN,
    copilotToken,
  );

  if (copilotToken) {
    env.COPILOT_GITHUB_TOKEN = copilotToken;
    env.GITHUB_FINEGRADED = copilotToken;
  } else {
    delete env.COPILOT_GITHUB_TOKEN;
    delete env.GITHUB_FINEGRADED;
  }
  if (githubToken) {
    env.GITHUB_TOKEN = githubToken;
    env.GH_TOKEN = githubToken;
  } else {
    delete env.GITHUB_TOKEN;
    delete env.GH_TOKEN;
  }
  if (overrides.model) {
    env.COPILOT_MODEL = overrides.model;
  }

  return env;
}

function resolveFirstSupportedCopilotCliToken(...values: unknown[]): string | null {
  for (const value of values) {
    const token = resolveSupportedCopilotCliToken(value);
    if (token) {
      return token;
    }
  }
  return null;
}

export function resolveSupportedCopilotCliToken(value: unknown): string | null {
  const token = normalizeString(value);
  if (!token) {
    return null;
  }

  if (token.startsWith("github_pat_") || token.startsWith("gho_") || token.startsWith("ghu_")) {
    return token;
  }

  return null;
}

function runAtlasClarificationCommandOnce(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<AtlasClarificationCommandResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    let jsonIdleTimeout: NodeJS.Timeout | undefined;

    const finish = (result: Omit<AtlasClarificationCommandResult, "stdout" | "stderr">) => {
      if (settled) return;
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (jsonIdleTimeout) {
        clearTimeout(jsonIdleTimeout);
      }
      resolve({
        stdout,
        stderr,
        status: result.status,
        signal: result.signal,
        error: result.error,
      });
    };

    let child;
    try {
      child = spawn(command, args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      finish({
        status: null,
        signal: null,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return;
    }

    timeout = setTimeout(() => {
      if (!child.killed) {
        child.kill();
      }
      finish({
        status: null,
        signal: null,
        error: new Error(`Clarification invocation timed out after ${String(ATLAS_CLARIFICATION_COMMAND_TIMEOUT_MS)}ms`),
      });
    }, ATLAS_CLARIFICATION_COMMAND_TIMEOUT_MS);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (hasCompleteJsonObject(stdout)) {
        if (jsonIdleTimeout) {
          clearTimeout(jsonIdleTimeout);
        }
        jsonIdleTimeout = setTimeout(() => {
          if (!child.killed) {
            child.kill();
          }
          finish({ status: 0, signal: null, error: null });
        }, ATLAS_CLARIFICATION_JSON_IDLE_MS);
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      finish({ status: null, signal: null, error });
    });
    child.on("close", (status, signal) => {
      finish({ status, signal, error: null });
    });
  });
}

function isCopilotRateLimitFailure(result: AtlasClarificationCommandResult): boolean {
  if (result.status === 0) {
    return false;
  }
  const combinedOutput = [result.stdout, result.stderr]
    .map((value) => String(value || ""))
    .join("\n");
  return /rate limit|rate-limited|switch to auto model|limit to reset/i.test(combinedOutput);
}

export async function readAtlasClarificationStatus(
  stateDir: string,
  sessionId: string,
): Promise<AtlasClarificationStatus> {
  const packetPath = getAtlasClarificationPacketPath(stateDir, sessionId);
  const packetResult = await readJsonSafe(packetPath);
  if (!packetResult.ok) {
    if (packetResult.reason === READ_JSON_REASON.MISSING) {
      return {
        sessionId,
        ready: false,
        packetPath,
        packet: null,
      };
    }

    throw new AtlasClarificationError(
      `Failed to read clarification packet: ${String(packetResult.error?.message || packetResult.error)}`,
      500,
      "clarification_packet_read_failed",
    );
  }

  const rawPacket = packetResult.data as Partial<AtlasClarificationPacket>;
  const packet = {
    ...rawPacket,
    sessionId: normalizeString(rawPacket.sessionId) || sessionId,
    targetRepo: normalizeString(rawPacket.targetRepo),
    repoMode: normalizeRepoMode(rawPacket.repoMode),
    objective: normalizeString(rawPacket.objective),
    summary: normalizeString(rawPacket.summary),
    operatorIntentBrief: normalizeIntentBrief(rawPacket.operatorIntentBrief),
    openQuestions: normalizeStringList(rawPacket.openQuestions, 3),
    executionNotes: normalizeStringList(rawPacket.executionNotes, Number.POSITIVE_INFINITY),
    attachments: Array.isArray(rawPacket.attachments) ? rawPacket.attachments as AtlasSessionAttachment[] : [],
    attachmentPlans: Array.isArray(rawPacket.attachmentPlans) ? rawPacket.attachmentPlans as AtlasClarificationAttachmentPlan[] : [],
    provider: normalizeString(rawPacket.provider),
    rawResponse: normalizeString(rawPacket.rawResponse),
    createdAt: normalizeString(rawPacket.createdAt) || new Date().toISOString(),
  } as AtlasClarificationPacket;
  return {
    sessionId,
    ready: true,
    packetPath,
    packet,
  };
}

export async function createAtlasClarificationPacket(
  options: CreateAtlasClarificationPacketOptions,
): Promise<AtlasClarificationPacket> {
  const objective = String(options.objective || "").trim();
  if (!objective) {
    throw new AtlasClarificationError("Objective is required for ATLAS onboarding.", 400, "missing_objective");
  }

  const attachments = options.attachments || [];
  const clarificationAnswers = normalizeClarificationAnswers(options.clarificationAnswers);
  const allowResolvedPacket = options.allowResolvedPacket === true;
  const command = await resolveClarificationCommand(options.command);
  const runner = options.runner || runAtlasClarificationCommand;
  const repoMode = normalizeRepoMode(options.repoMode);
  const prompt = buildAtlasClarificationPrompt(
    options.targetRepo,
    objective,
    attachments,
    repoMode,
    clarificationAnswers,
    allowResolvedPacket,
  );

  const rawResponse = await (async () => {
    try {
      return await runner({ command, prompt });
    } catch (error) {
      console.error(`[atlas] clarification request failed: ${String((error as Error)?.message || error)}`);
      if (error instanceof AtlasClarificationError) {
        throw error;
      }
      throw new AtlasClarificationError(
        `Clarification request failed: ${String((error as Error)?.message || error)}`,
        502,
        "clarification_invocation_failed",
      );
    }
  })();

  const clarified = parseAtlasClarificationResponse(rawResponse, attachments, { allowResolvedPacket });
  const packet: AtlasClarificationPacket = {
    sessionId: options.sessionId,
    targetRepo: options.targetRepo,
    repoMode,
    objective,
    summary: clarified.summary,
    operatorIntentBrief: clarified.operatorIntentBrief,
    openQuestions: clarified.openQuestions,
    executionNotes: buildAttachmentAwareExecutionNotes(clarified.executionNotes, attachments, clarified.attachmentPlans),
    attachments,
    attachmentPlans: clarified.attachmentPlans,
    provider: command,
    rawResponse,
    createdAt: new Date().toISOString(),
  };

  const packetPath = getAtlasClarificationPacketPath(options.stateDir, options.sessionId);
  try {
    await writeJson(packetPath, packet);
  } catch (error) {
    console.error(`[atlas] clarification packet write failed: ${String((error as Error)?.message || error)}`);
    throw new AtlasClarificationError(
      `Failed to persist clarification packet: ${String((error as Error)?.message || error)}`,
      500,
      "clarification_packet_write_failed",
    );
  }

  return packet;
}

export async function syncAtlasClarificationPacketAttachments(
  stateDir: string,
  sessionId: string,
  attachments: AtlasSessionAttachment[],
  attachmentPlans: AtlasClarificationAttachmentPlan[],
): Promise<void> {
  if (!attachments.length && !attachmentPlans.length) {
    return;
  }

  const packetPath = getAtlasClarificationPacketPath(stateDir, sessionId);
  const packetResult = await readJsonSafe(packetPath);
  if (!packetResult.ok) {
    if (packetResult.reason === READ_JSON_REASON.MISSING) {
      return;
    }
    throw new AtlasClarificationError(
      `Failed to read clarification packet: ${String(packetResult.error?.message || packetResult.error)}`,
      500,
      "clarification_packet_read_failed",
    );
  }

  if (!isRecord(packetResult.data)) {
    return;
  }

  const packet = packetResult.data as Partial<AtlasClarificationPacket>;
  const existingAttachments = Array.isArray(packet.attachments) ? packet.attachments as AtlasSessionAttachment[] : [];
  const mergedAttachmentsById = new Map<string, AtlasSessionAttachment>();
  for (const attachment of [...existingAttachments, ...attachments]) {
    mergedAttachmentsById.set(attachment.id, attachment);
  }

  const mergedAttachments = [...mergedAttachmentsById.values()];
  const existingPlans = Array.isArray(packet.attachmentPlans) ? packet.attachmentPlans as AtlasClarificationAttachmentPlan[] : [];
  const mergedPlans = resolveAtlasClarificationAttachmentPlans(mergedAttachments, [...existingPlans, ...attachmentPlans]);

  await writeJson(packetPath, {
    ...packet,
    sessionId: normalizeString(packet.sessionId) || sessionId,
    targetRepo: normalizeString(packet.targetRepo),
    repoMode: normalizeRepoMode(packet.repoMode),
    objective: normalizeString(packet.objective),
    summary: normalizeString(packet.summary),
    operatorIntentBrief: normalizeIntentBrief(packet.operatorIntentBrief),
    openQuestions: normalizeStringList(packet.openQuestions, 3),
    executionNotes: buildAttachmentAwareExecutionNotes(
      normalizeStringList(packet.executionNotes, Number.POSITIVE_INFINITY),
      mergedAttachments,
      mergedPlans,
    ),
    attachments: mergedAttachments,
    attachmentPlans: mergedPlans,
    provider: normalizeString(packet.provider),
    rawResponse: normalizeString(packet.rawResponse),
    createdAt: normalizeString(packet.createdAt) || new Date().toISOString(),
  });
}
