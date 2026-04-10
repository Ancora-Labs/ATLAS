/**
 * Agent Loader ÔÇö Integrates .github/agents/*.agent.md with Copilot CLI
 *
 * Each AI role has a dedicated .agent.md file in .github/agents/.
 * These are standard VS Code Copilot custom agent files with YAML frontmatter.
 *
 * When calling the Copilot CLI, we pass --agent <slug> to load the agent's
 * persona, tools, and model preferences from that file.
 * The runtime data (GitHub state, sessions, etc.) is passed via -p <context>.
 *
 * Edit an agent's behavior by editing their .agent.md file ÔÇö no code changes needed.
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isModelBanned } from "./model_policy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENTS_DIR = path.join(__dirname, "..", "..", ".github", "agents");

function logBannedModelAttempt(model, reason) {
  try {
    const stateDir = path.join(__dirname, "..", "..", "state");
    const line = `[${new Date().toISOString()}] BANNED_MODEL_BLOCKED: model="${model}" reason="${reason}"\n`;
    appendFileSync(path.join(stateDir, "progress.txt"), line, "utf8");
  } catch { /* non-critical */ }
}

// ÔöÇÔöÇ Convert agent name to .agent.md file slug ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// "King David" ÔåÆ "king-david", "Trump" ÔåÆ "trump"

export function nameToSlug(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, "-");
}

// ÔöÇÔöÇ Check if .agent.md file exists for a slug ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

export function agentFileExists(slug) {
  return existsSync(path.join(AGENTS_DIR, `${slug}.agent.md`));
}

// ÔöÇÔöÇ Map model name to Copilot CLI model slug ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

export function toCopilotModelSlug(name) {
  const map = {
    "claude sonnet 4.6": "claude-sonnet-4.6",
    "claude sonnet 4.5": "claude-sonnet-4.5",
    "claude sonnet 4": "claude-sonnet-4",
    "claude haiku 4.5": "claude-haiku-4.5",
    "claude opus 4.6": "claude-opus-4.6",
    // claude-opus-4.6-fast is BANNED ÔÇö 30x rate, never use
    "claude opus 4.5": "claude-opus-4.5",
    "gemini 3 pro preview": "gemini-3-pro-preview",
    "gpt-5.4": "gpt-5.4",
    "gpt 5.4": "gpt-5.4",
    "gpt-5.3-codex": "gpt-5.3-codex",
    "gpt 5.3 codex": "gpt-5.3-codex",
    "gpt-5.2-codex": "gpt-5.2-codex",
    "gpt 5.2 codex": "gpt-5.2-codex",
    "gpt-5.2": "gpt-5.2",
    "gpt 5.2": "gpt-5.2",
    "gpt 5.1 codex max": "gpt-5.1-codex-max",
    "gpt 5.1 codex": "gpt-5.1-codex",
    "gpt 5.1 codex mini": "gpt-5.1-codex-mini",
    "gpt 5.1": "gpt-5.1",
    "gpt 5 mini": "gpt-5-mini",
    "gpt 4.1": "gpt-4.1"
  };
  const key = String(name || "").trim().toLowerCase();
  if (map[key]) return map[key];
  return key
    .replace(/[^a-z0-9.\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ÔöÇÔöÇ Build CLI args array for a Copilot agent call ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
//
// Usage:
//   const args = buildAgentArgs({ agentSlug: "jesus", prompt: contextText, model: "claude-sonnet-4.6" });
//   spawnSync(copilotCommand, args, ...)
//
// If an .agent.md file exists for the slug, --agent <slug> is added and the
// agent's frontmatter model is used (unless overridden by model arg).
// If no agent file exists, falls back to plain --model + -p call.

// Windows limits total CLI argument length to ~32KB (CreateProcessW).
// For prompts >25KB, write to a temp file and pass a short -p telling the agent to read it.
const PROMPT_FILE_THRESHOLD = 25_000;
const STATE_DIR = path.join(__dirname, "..", "..", "state");

export function buildAgentArgs({
  agentSlug,
  prompt,
  model,
  allowAll = false,
  autopilot = false,
  noAskUser = false,
  silent = false,
  maxContinues = undefined,
  runContract = undefined,
}: any = {}) {
  const args = [];

  const pushResolvedModelArg = (requestedModel) => {
    if (!requestedModel) return;
    const banCheck = isModelBanned(requestedModel);
    if (banCheck.banned) {
      // HARD BLOCK: never pass a banned model to Copilot CLI
      const safe = toCopilotModelSlug("Claude Sonnet 4.6");
      if (safe) args.push("--model", safe);
      logBannedModelAttempt(requestedModel, banCheck.reason);
      return;
    }
    const slug = toCopilotModelSlug(requestedModel);
    if (slug) args.push("--model", slug);
  };

  if (allowAll) args.push("--allow-all");
  if (noAskUser) args.push("--no-ask-user");
  if (autopilot) {
    args.push("--autopilot");
    // runContract.maxTurns takes precedence over the legacy maxContinues arg.
    const effectiveMaxContinues = runContract?.maxTurns ?? maxContinues;
    if (effectiveMaxContinues != null) args.push("--max-autopilot-continues", String(effectiveMaxContinues));
  }
  if (silent) args.push("--silent");

  if (agentSlug && agentFileExists(agentSlug)) {
    args.push("--agent", agentSlug);
    // Force explicit model even with custom agent to avoid default-model fallback.
    pushResolvedModelArg(model);
  } else if (model) {
    // No agent file — explicit model only.
    pushResolvedModelArg(model);
  }

  let promptText = String(prompt);
  const useDensePromptMode = String(process.env.BOX_PROMPT_DENSIFY_MODE || "").toLowerCase() === "true";
  if (useDensePromptMode) {
    promptText = `\n[DENSIFIED_PROMPT_MODE]\nPrioritize dense, high-leverage bundled work packets over thin micro-tasks.\n${promptText}`;
  }
  if (promptText.length > PROMPT_FILE_THRESHOLD) {
    const slug = agentSlug || "agent";
    const promptFile = path.join(STATE_DIR, `prompt_${slug}_${Date.now()}.md`);
    writeFileSync(promptFile, promptText, "utf8");
    pruneOldPromptFiles(slug);
    promptText = `Your full instructions are in the file: ${promptFile}\nRead that file NOW with your read_file / view tool, then follow every instruction in it.`;
  }
  args.push("-p", promptText);
  return args;
}

// ÔöÇÔöÇ Read agent persona text from .agent.md (strips YAML frontmatter) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

export function readAgentPersona(slug) {
  const filePath = path.join(AGENTS_DIR, `${slug}.agent.md`);
  if (!existsSync(filePath)) return "";
  const raw = readFileSync(filePath, "utf8");
  // Strip YAML frontmatter (--- ... ---)
  const stripped = raw.replace(/^---[\s\S]*?---\s*/, "");
  return stripped.trim();
}

// ÔöÇÔöÇ Build CLI args for single-prompt worker calls (no autopilot/tools) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
//
// Workers get ONE request: --model + -p with persona embedded in prompt.
// No --agent, no --autopilot, no --allow-all, no tool calls.
// The worker must output everything in a single response.

export function buildWorkerPromptArgs({ agentSlug, prompt, model }) {
  const args = [];

  // Resolve model
  const banCheck = isModelBanned(model || "");
  if (banCheck.banned) {
    const safe = toCopilotModelSlug("Claude Sonnet 4.6");
    if (safe) args.push("--model", safe);
    logBannedModelAttempt(model, banCheck.reason);
  } else {
    const slug = toCopilotModelSlug(model || "Claude Sonnet 4.6");
    if (slug) args.push("--model", slug);
  }

  // Embed persona from .agent.md into prompt
  const persona = agentSlug ? readAgentPersona(agentSlug) : "";
  let fullPrompt = persona
    ? `## YOUR ROLE\n${persona}\n\n${String(prompt)}`
    : String(prompt);

  if (fullPrompt.length > PROMPT_FILE_THRESHOLD) {
    const slug = agentSlug || "worker";
    const promptFile = path.join(STATE_DIR, `prompt_${slug}_${Date.now()}.md`);
    writeFileSync(promptFile, fullPrompt, "utf8");
    pruneOldPromptFiles(slug);
    fullPrompt = `Your full instructions are in the file: ${promptFile}\nRead that file NOW, then follow every instruction in it.`;
  }
  args.push("-p", fullPrompt);
  return args;
}

// pruneOldPromptFiles — keep only the last `maxKeep` prompt files for a slug.
// Called immediately after writing each new prompt file so state/ stays clean.
function pruneOldPromptFiles(slug: string, maxKeep = 3): void {
  try {
    const prefix = `prompt_${slug}_`;
    const files = readdirSync(STATE_DIR)
      .filter(f => f.startsWith(prefix) && f.endsWith(".md"))
      .sort(); // timestamps embedded in name → lexicographic = chronological
    const toDelete = files.slice(0, Math.max(0, files.length - maxKeep));
    for (const f of toDelete) {
      try { unlinkSync(path.join(STATE_DIR, f)); } catch { /* best-effort */ }
    }
  } catch { /* non-fatal */ }
}

// cleanupPromptFile — deletes a specific prompt file after the agent has read it.
export function cleanupPromptFile(filePath: string): void {
  try { if (filePath && existsSync(filePath)) unlinkSync(filePath); } catch { /* best-effort */ }
}

// ÔöÇÔöÇ Parse agent output: extract thinking + structured JSON ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
//
// Agents write freely, then end with one of two marker formats:
//
//   English (preferred):      Legacy Turkish (backward compat):
//   ===DECISION===            ===KARAR===
//   { json }                  { json }
//   ===END===                 ===SON===
//
// The section BEFORE the marker is the agent's visible thinking.
// The section INSIDE is parsed as structured JSON.
// Falls back to finding any JSON anywhere in the output.

export function parseAgentOutput(raw) {
  const text = String(raw || "");

  // Try ===DECISION=== / ===END=== markers (English format)
  // Use lastIndexOf so that tool-output echoes of the marker (e.g. grep patterns
  // containing "===DECISION===") do not shadow the agent's actual final block.
  const decisionIdx = text.lastIndexOf("===DECISION===");
  if (decisionIdx >= 0) {
    const afterDecision = text.slice(decisionIdx + "===DECISION===".length);
    const endIdx = afterDecision.indexOf("===END===");
    if (endIdx >= 0) {
      const jsonStr = afterDecision.slice(0, endIdx).trim();
      const parsed = tryParseJson(jsonStr);
      if (parsed) {
        const thinking = text.slice(0, decisionIdx).trim();
        return { thinking, parsed, ok: true };
      }
    }
  }

  // Try ===KARAR=== / ===SON=== markers (legacy Turkish format — backward compat)
  const kararIdx = text.lastIndexOf("===KARAR===");
  if (kararIdx >= 0) {
    const afterKarar = text.slice(kararIdx + "===KARAR===".length);
    const sonIdx = afterKarar.indexOf("===SON===");
    if (sonIdx >= 0) {
      const jsonStr = afterKarar.slice(0, sonIdx).trim();
      const parsed = tryParseJson(jsonStr);
      if (parsed) {
        const thinking = text.slice(0, kararIdx).trim();
        return { thinking, parsed, ok: true };
      }
    }
  }

  // Try ```json fenced blocks
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const splitIdx = text.indexOf("```json");
    const thinking = text.slice(0, splitIdx).trim();
    const parsed = tryParseJson(fenceMatch[1].trim());
    return { thinking, parsed, ok: !!parsed };
  }

  // Fall back: find JSON object anywhere, everything before it is thinking
  const jsonStart = text.search(/\{/);
  const thinking = jsonStart > 20 ? text.slice(0, jsonStart).trim() : "";
  const parsed = tryParseJson(text);
  return { thinking, parsed, ok: !!parsed };
}

// ÔöÇÔöÇ Internal JSON parser (handles raw, fenced, deep-nested) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

function tryParseJson(text) {
  const s = String(text || "");
  try {
    return JSON.parse(s);
  } catch {
    // fall through to fenced/deep parse attempts
  }
  const fenceMatch = s.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // try additional extraction strategies below
    }
  }
  const anyFence = s.match(/```\s*([\s\S]*?)```/);
  if (anyFence) {
    try {
      return JSON.parse(anyFence[1].trim());
    } catch {
      // try additional extraction strategies below
    }
  }
  // Find last top-level JSON object
  let lastCandidate = null;
  let i = 0;
  while (i < s.length) {
    if (s[i] !== "{") { i++; continue; }
    let depth = 0, inString = false, escape = false;
    const start = i;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { lastCandidate = s.slice(start, i + 1); i++; break; } }
    }
  }
  if (lastCandidate) {
    try {
      return JSON.parse(lastCandidate);
    } catch {
      // return null when all parse strategies fail
    }
  }
  return null;
}

// ─── Agent contract validation ────────────────────────────────────────────────
//
// Validates that every .agent.md file has the required YAML frontmatter fields.
// Used by doctor checks and the cloud-agent governance gate.

/**
 * YAML frontmatter fields required in every .agent.md file that BOX dispatches.
 * - description: mandatory per GitHub custom-agent spec
 * - model:       mandatory for deterministic model selection (no implicit fallback)
 * - tools:       mandatory so the governance gate can verify the tool surface
 */
export interface AgentContractValidation {
  slug: string;
  filePath: string;
  valid: boolean;
  violations: string[];
  fields: {
    name?: string;
    description?: string;
    model?: string;
    tools?: string[];
  };
}

/**
 * Validate a single agent's .agent.md frontmatter contract.
 * Uses regex extraction (no YAML parser dep) for deterministic behavior.
 */
export function validateAgentContract(slug: string): AgentContractValidation {
  const filePath = path.join(AGENTS_DIR, `${slug}.agent.md`);
  const result: AgentContractValidation = {
    slug,
    filePath,
    valid: false,
    violations: [],
    fields: {},
  };

  if (!existsSync(filePath)) {
    result.violations.push("file_missing");
    return result;
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    result.violations.push("file_unreadable");
    return result;
  }

  // Extract YAML frontmatter block: --- ... ---
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    result.violations.push("frontmatter_missing");
    return result;
  }

  const fmText = fmMatch[1];

  const extractField = (key: string): string | undefined => {
    const m = fmText.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : undefined;
  };

  const extractTools = (): string[] | undefined => {
    // Inline array form: tools: [read, search]
    const inline = fmText.match(/^tools:\s*\[([^\]]*)\]/m);
    if (inline) return inline[1].split(",").map(t => t.trim()).filter(Boolean);
    // Block list form:
    //   tools:
    //     - read
    //     - search
    const block = fmText.match(/^tools:\s*\n((?:[ \t]+-[ \t]*.+\n?)+)/m);
    if (block) {
      return block[1].split("\n").map(l => l.replace(/^[ \t]+-[ \t]*/, "").trim()).filter(Boolean);
    }
    return undefined;
  };

  result.fields.name = extractField("name");
  result.fields.description = extractField("description");
  result.fields.model = extractField("model");
  result.fields.tools = extractTools();

  if (!result.fields.description) result.violations.push("description_missing");
  if (!result.fields.model) result.violations.push("model_missing");
  if (!result.fields.tools || result.fields.tools.length === 0) result.violations.push("tools_missing");

  result.valid = result.violations.length === 0;
  return result;
}

/**
 * Validate all .agent.md files found in the agents directory.
 * Returns per-agent results plus a summary.
 */
export function validateAllAgentContracts(): {
  allValid: boolean;
  results: AgentContractValidation[];
  violations: AgentContractValidation[];
} {
  let slugs: string[];
  try {
    slugs = readdirSync(AGENTS_DIR)
      .filter(f => f.endsWith(".agent.md"))
      .map(f => f.replace(/\.agent\.md$/, ""));
  } catch {
    // Agents dir unreadable — treat as valid to avoid blocking on infra failures
    return { allValid: true, results: [], violations: [] };
  }
  const results = slugs.map(validateAgentContract);
  const violations = results.filter(r => !r.valid);
  return { allValid: violations.length === 0, results, violations };
}

/**
 * Validate only the agents critical to the planning dispatch pipeline.
 * Prometheus and Athena are the minimum required; if either is invalid,
 * the governance gate should block dispatch.
 */
export function validateCriticalAgentContracts(): {
  allValid: boolean;
  results: AgentContractValidation[];
  violations: AgentContractValidation[];
} {
  const criticalSlugs = ["prometheus", "athena"];
  const results = criticalSlugs.map(validateAgentContract);
  const violations = results.filter(r => !r.valid);
  return { allValid: violations.length === 0, results, violations };
}

// ─── Log agent thinking to a visible file ─────────────────────────────────────

export function logAgentThinking(stateDir, agentName, thinking) {
  if (!thinking || thinking.length < 10) return;
  try {
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    const separator = `\n${"ÔöÇ".repeat(60)}\n[${ts}] ${agentName} ÔÇö D├£┼Ş├£NCE\n${"ÔöÇ".repeat(60)}\n`;
    appendFileSync(
      path.join(stateDir, "leadership_thinking.txt"),
      `${separator}${thinking}\n`,
      "utf8"
    );
  } catch { /* non-critical */ }
}
