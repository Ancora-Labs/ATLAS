import path from "node:path";

import { readJsonSafe, writeJson } from "../core/fs_utils.js";
import type { AtlasDesktopRepoMode } from "./desktop_state.js";
import {
  deriveAtlasAssetSignals,
  deriveAtlasImplementationFlexibility,
  deriveAtlasOperatorIntentEvidence,
  type AtlasIntentSignalMessageInput,
} from "./intent_signals.js";

export type AtlasBuildTriggerMode = "detached-once" | "daemon" | "watching";
export type AtlasBuildTriggerState = "queued" | "running" | "paused" | "completed" | "error";

export interface AtlasBuildAttachmentPlanInput {
  attachmentName?: string | null;
  storedRelativePath?: string | null;
  intendedUse?: string | null;
  placementHint?: string | null;
  implementationNotes?: string[] | null;
}

export interface AtlasBuildPromptInput {
  title: string;
  objective: string;
  summary?: string | null;
  operatorIntentBrief?: string | null;
  targetRepo?: string | null;
  repoMode?: AtlasDesktopRepoMode | null;
  executionNotes?: string[] | null;
  messages?: AtlasIntentSignalMessageInput[] | null;
  attachmentPlans?: AtlasBuildAttachmentPlanInput[] | null;
}

export interface AtlasBuildRequestRecord {
  sessionId: string;
  selectedModel?: string | null;
  projectId: string | null;
  projectSessionId: string | null;
  projectWorkspacePath: string | null;
  title: string;
  objective: string;
  summary: string;
  targetRepo: string | null;
  targetBaseBranch: string | null;
  repoMode: AtlasDesktopRepoMode | null;
  repoCreatedByAtlas: boolean;
  requestedAt: string;
  updatedAt: string;
  triggerMode: AtlasBuildTriggerMode;
  triggerState: AtlasBuildTriggerState;
  triggerLabel: string;
  runnerPid: number | null;
  lastError: string | null;
  planningPrompt: string;
  appliedAt: string | null;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function normalizeBuildTriggerMode(value: unknown): AtlasBuildTriggerMode {
  return value === "daemon" || value === "watching" ? value : "detached-once";
}

function normalizeBuildTriggerState(value: unknown): AtlasBuildTriggerState {
  if (value === "running" || value === "paused" || value === "completed" || value === "error") {
    return value;
  }
  return "queued";
}

export function resolveAtlasBuildRequestPath(stateDir: string): string {
  return path.join(stateDir, "atlas", "active_build.json");
}

export function buildAtlasPlanningPrompt(input: AtlasBuildPromptInput): string {
  const executionNotes = normalizeStringList(input.executionNotes);
  const attachmentPlans = Array.isArray(input.attachmentPlans) ? input.attachmentPlans : [];
  const repoMode = input.repoMode === "existing" || input.repoMode === "new" ? input.repoMode : null;
  const implementationFlexibility = deriveAtlasImplementationFlexibility({
    objective: input.objective,
    summary: input.summary,
    executionNotes,
    messages: input.messages,
  });
  const derivedAssetSignals = deriveAtlasAssetSignals({
    objective: input.objective,
    summary: input.summary,
    executionNotes,
    messages: input.messages,
  });
  const operatorIntentEvidence = deriveAtlasOperatorIntentEvidence({
    objective: input.objective,
    summary: input.summary,
    executionNotes,
    messages: input.messages,
  });
  const operatorIntentBrief = normalizeOptionalString(input.operatorIntentBrief);

  const attachmentLines = attachmentPlans.length > 0
    ? attachmentPlans.map((plan) => {
        const name = normalizeOptionalString(plan.attachmentName) || "Attached file";
        const filePath = normalizeOptionalString(plan.storedRelativePath) || "recorded session asset";
        const intendedUse = normalizeOptionalString(plan.intendedUse) || "Use this operator asset where it directly serves the requested outcome.";
        const placementHint = normalizeOptionalString(plan.placementHint) || "Place it where the mission needs it most.";
        const notes = normalizeStringList(plan.implementationNotes);
        const noteSuffix = notes.length > 0 ? ` Notes: ${notes.join(" ")}` : "";
        return `- ${name} from ${filePath}. Intended use: ${intendedUse} Placement: ${placementHint}.${noteSuffix}`;
      })
    : ["- No operator attachments were recorded for this mission."];

  return [
    "ATLAS desktop mission override",
    "This mission came from a completed ATLAS onboarding session.",
    "Treat it as the highest-priority operator brief for the current build cycle.",
    `Mission title: ${String(input.title || "").trim() || "Untitled mission"}`,
    `Primary objective: ${String(input.objective || "").trim()}`,
    `Mission summary: ${normalizeOptionalString(input.summary) || String(input.objective || "").trim()}`,
    `Target repository: ${normalizeOptionalString(input.targetRepo) || "unknown target repository"}`,
    `Repository mode: ${repoMode === "existing" ? "existing repository" : repoMode === "new" ? "new repository" : "not specified"}`,
    `Implementation latitude: ${implementationFlexibility}`,
    executionNotes.length > 0
      ? `Execution notes:\n${executionNotes.map((note) => `- ${note}`).join("\n")}`
      : "Execution notes:\n- Use the ATLAS mission summary as the delivery brief.",
    operatorIntentBrief
      ? `Detailed operator intent brief:\n${operatorIntentBrief}`
      : null,
    operatorIntentEvidence.length > 0
      ? `Operator intent evidence:\n${operatorIntentEvidence.map((entry) => `- ${entry}`).join("\n")}`
      : null,
    `Operator attachments:\n${attachmentLines.join("\n")}`,
    "Source preservation rules:",
    "- If the mission names a real image, photo, logo, screenshot, or external source asset, preserve that source in the final build.",
    "- Preserve operator-supplied or explicitly requested real visuals as source requirements in the final build.",
    "- If the mission includes product-facing UI and no concrete operator reference is supplied, planning must require at least one externally sourced visual exemplar to be inspected before implementation starts.",
    "- If the mission names a reference site or external design target, planning must preserve a concrete visual capture or provided screenshot from that reference before reducing the work into components, sections, or scaffolding.",
    "- HTML extraction, text scraping, headings, link lists, or DOM summaries from a reference site are supporting evidence only and cannot replace direct visual reference evidence for a design-fidelity task.",
    "- If exemplar sourcing is blocked by policy, rights, or network access, preserve that blocker explicitly instead of allowing a generic safe fallback.",
    "- For product-facing or credibility-critical UI sections, explicitly choose the visual medium and source strategy that best matches a believable shipped product before implementation.",
    "- Prefer operator assets, real photography, screenshots, internet-sourced imagery, or existing branded assets when they are the right medium; do not narrow this to stock-image sourcing by default.",
    derivedAssetSignals.assetSourcingPolicy
      ? "- When the mission depends on a real visual asset and external sourcing is allowed, actively source an internet image, logo, brand mark, texture, or other operator-approved source asset that matches the requested subject instead of fabricating artwork."
      : null,
    "- If the needed real or operator-approved source asset is unavailable, disclose that blocker explicitly and keep the source requirement visible.",
    derivedAssetSignals.assetSourcingPolicy ? `Asset sourcing policy: ${derivedAssetSignals.assetSourcingPolicy}` : null,
    derivedAssetSignals.assetRequirements.length > 0
      ? `Asset requirements:\n${derivedAssetSignals.assetRequirements.map((requirement) => `- ${requirement}`).join("\n")}`
      : null,
    "Deliver against this mission directly.",
    "Do not replace it with generic repository self-improvement, generic GitHub issue triage, or unrelated backlog work unless the repo state proves the mission impossible.",
  ].join("\n\n");
}

export function normalizeBuildRequestRecord(value: unknown): AtlasBuildRequestRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sessionId = normalizeOptionalString(record.sessionId);
  const title = normalizeOptionalString(record.title);
  const objective = normalizeOptionalString(record.objective);
  if (!sessionId || !title || !objective) {
    return null;
  }

  const summary = normalizeOptionalString(record.summary) || objective;
  return {
    sessionId,
    selectedModel: normalizeOptionalString(record.selectedModel),
    projectId: normalizeOptionalString(record.projectId),
    projectSessionId: normalizeOptionalString(record.projectSessionId),
    projectWorkspacePath: normalizeOptionalString(record.projectWorkspacePath),
    title,
    objective,
    summary,
    targetRepo: normalizeOptionalString(record.targetRepo),
    targetBaseBranch: normalizeOptionalString(record.targetBaseBranch),
    repoMode: record.repoMode === "existing" || record.repoMode === "new" ? record.repoMode : null,
    repoCreatedByAtlas: record.repoCreatedByAtlas === true,
    requestedAt: normalizeOptionalString(record.requestedAt) || new Date().toISOString(),
    updatedAt: normalizeOptionalString(record.updatedAt) || new Date().toISOString(),
    triggerMode: normalizeBuildTriggerMode(record.triggerMode),
    triggerState: normalizeBuildTriggerState(record.triggerState),
    triggerLabel: normalizeOptionalString(record.triggerLabel) || "Build request queued",
    runnerPid: typeof record.runnerPid === "number" && Number.isFinite(record.runnerPid) ? record.runnerPid : null,
    lastError: normalizeOptionalString(record.lastError),
    planningPrompt: normalizeOptionalString(record.planningPrompt) || buildAtlasPlanningPrompt({
      title,
      objective,
      summary,
      targetRepo: normalizeOptionalString(record.targetRepo),
      repoMode: record.repoMode === "existing" || record.repoMode === "new" ? record.repoMode : null,
    }),
    appliedAt: normalizeOptionalString(record.appliedAt),
  };
}

export async function readAtlasBuildRequest(stateDir: string): Promise<AtlasBuildRequestRecord | null> {
  const result = await readJsonSafe(resolveAtlasBuildRequestPath(stateDir));
  if (!result.ok) {
    return null;
  }
  return normalizeBuildRequestRecord(result.data);
}

export async function writeAtlasBuildRequest(stateDir: string, record: AtlasBuildRequestRecord): Promise<void> {
  await writeJson(resolveAtlasBuildRequestPath(stateDir), record);
}