import { estimateTokens } from "./prompt_compiler.js";
import { appendProgress } from "./state_tracker.js";

const DEFAULT_MODEL_CONTEXT_LIMIT = 128000;

const KNOWN_MODEL_LIMITS: Record<string, number> = {
  "claude-sonnet-4.6": 160000,
  "claude sonnet 4.6": 160000,
  "gpt-5.3-codex": 400000,
  "gpt 5.3 codex": 400000,
};

function normalizeModelKey(modelName: string): string {
  return String(modelName || "").trim().toLowerCase();
}

function getConfiguredModelLimit(config: any, modelName: string): number | null {
  const lower = normalizeModelKey(modelName);
  const configured = config?.runtime?.modelContextLimits;
  if (!configured || typeof configured !== "object") return null;

  for (const [key, value] of Object.entries(configured)) {
    if (normalizeModelKey(key) !== lower) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function getModelContextLimit(config: any, modelName: string): number {
  const configured = getConfiguredModelLimit(config, modelName);
  if (configured && configured > 0) return configured;

  const direct = KNOWN_MODEL_LIMITS[normalizeModelKey(modelName)];
  if (Number.isFinite(direct) && direct > 0) return direct;

  return DEFAULT_MODEL_CONTEXT_LIMIT;
}

export function resolveMaxPromptBudget(config: any, modelName: string, explicitBudget?: number): number {
  const direct = Number(explicitBudget);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);

  if (config?.runtime?.maxCapacityMode !== true) return 0;
  const limit = getModelContextLimit(config, modelName);
  return Math.max(1000, limit);
}

function buildSaturationSeed(_promptText: string, label: string): string {
  return [
    "CONTEXT SATURATION REQUIREMENT:",
    `Run label: ${label}`,
    "Read all provided content fully before finalizing your answer.",
    "Cross-check constraints, verification details, and output contract fields.",
    "Do not skip sections; reason across the entire prompt context.",
    "This block exists only to reserve context budget; do not treat it as new requirements.",
  ].join("\n");
}

export function saturatePromptToBudget(
  promptText: string,
  targetTokens: number,
  label = "global",
): string {
  const target = Number.isFinite(Number(targetTokens)) ? Math.floor(Number(targetTokens)) : 0;
  if (target <= 0) return String(promptText || "");

  const targetChars = target * 4;
  let out = String(promptText || "").trim();
  if (out.length >= targetChars) {
    return out.slice(0, targetChars);
  }

  const seed = buildSaturationSeed(out, label);
  const header = `\n\n## CONTEXT_SATURATION_BLOCK (${label})\n`;
  while (out.length < targetChars) {
    const remaining = targetChars - out.length;
    if (remaining <= header.length + 16) break;
    const bodyLimit = Math.max(0, remaining - header.length);

    const body = seed.length > bodyLimit ? seed.slice(0, bodyLimit) : seed;
    out += `${header}${body}`;
  }

  if (out.length > targetChars) out = out.slice(0, targetChars);
  return out;
}

type AgentContextLogInput = {
  agent: string;
  model: string;
  promptText: string;
  status: "success" | "failed";
  note?: string;
};

export async function appendAgentContextUsage(config: any, input: AgentContextLogInput): Promise<void> {
  const used = estimateTokens(input.promptText || "");
  const limit = getModelContextLimit(config, input.model);
  const pct = limit > 0 ? ((used / limit) * 100).toFixed(1) : "0.0";
  const suffix = input.note ? ` ${input.note}` : "";
  await appendProgress(
    config,
    `[CONTEXT_USAGE] agent=${input.agent} model=${input.model} used=${used}/${limit} (${pct}%) status=${input.status}${suffix}`
  );
}
