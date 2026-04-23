import { spawnSync } from "node:child_process";
import path from "node:path";

import { loadConfig } from "../config.js";
import { READ_JSON_REASON, readJsonSafe, writeJson } from "../core/fs_utils.js";

export interface AtlasClarificationPacket {
  sessionId: string;
  targetRepo: string;
  objective: string;
  summary: string;
  openQuestions: string[];
  executionNotes: string[];
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
  openQuestions: string[];
  executionNotes: string[];
}

export interface AtlasClarificationRunnerInput {
  command: string;
  prompt: string;
}

export type AtlasClarificationRunner = (
  input: AtlasClarificationRunnerInput,
) => Promise<string>;

export interface CreateAtlasClarificationPacketOptions {
  stateDir: string;
  sessionId: string;
  targetRepo: string;
  objective: string;
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

export function getAtlasClarificationPacketPath(stateDir: string, sessionId: string): string {
  return path.join(
    stateDir,
    "atlas",
    "desktop_sessions",
    sanitizeSessionId(sessionId),
    "clarification_packet.json",
  );
}

export function buildAtlasClarificationPrompt(targetRepo: string, objective: string): string {
  return [
    "You are ATLAS onboarding for a desktop-native software delivery shell.",
    "Read the operator objective and respond with exactly one JSON object.",
    "Do not include markdown fences, commentary, or any extra text.",
    "Schema:",
    "{",
    '  "summary": "one sentence in English",',
    '  "openQuestions": ["1 to 3 concise clarification questions"],',
    '  "executionNotes": ["1 to 3 deterministic next-step notes for planning handoff"]',
    "}",
    "Constraints:",
    "- summary must be a non-empty English sentence under 220 characters.",
    "- openQuestions must contain at least 1 and at most 3 strings.",
    "- executionNotes must contain at least 1 and at most 3 strings.",
    `Target repository: ${targetRepo || "unknown target repository"}`,
    `Operator objective: ${objective}`,
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

export function parseAtlasClarificationResponse(raw: string): AtlasClarificationResult {
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
  const openQuestions = normalizeStringList(parsed.openQuestions, 3);
  const executionNotes = normalizeStringList(parsed.executionNotes, 3);

  if (!summary) {
    throw new AtlasClarificationError(
      "Clarification provider response is missing a summary.",
      502,
      "clarification_contract_invalid",
    );
  }
  if (openQuestions.length === 0) {
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
    openQuestions,
    executionNotes,
  };
}

async function resolveClarificationCommand(explicitCommand?: string): Promise<string> {
  const trimmed = String(explicitCommand || "").trim();
  if (trimmed) return trimmed;

  const config = await loadConfig();
  const configured = String(config.copilotCliCommand || "").trim();
  return configured || "copilot";
}

async function runAtlasClarificationCommand(
  input: AtlasClarificationRunnerInput,
): Promise<string> {
  const promptArgs = ["--prompt", input.prompt];
  let result;
  try {
    result = spawnSync(input.command, promptArgs, {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    throw new AtlasClarificationError(
      `Clarification invocation failed: ${String((error as Error)?.message || error)}`,
      502,
      "clarification_invocation_failed",
    );
  }

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

  const packet = packetResult.data as AtlasClarificationPacket;
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

  const command = await resolveClarificationCommand(options.command);
  const runner = options.runner || runAtlasClarificationCommand;
  const prompt = buildAtlasClarificationPrompt(options.targetRepo, objective);

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

  const clarified = parseAtlasClarificationResponse(rawResponse);
  const packet: AtlasClarificationPacket = {
    sessionId: options.sessionId,
    targetRepo: options.targetRepo,
    objective,
    summary: clarified.summary,
    openQuestions: clarified.openQuestions,
    executionNotes: clarified.executionNotes,
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
