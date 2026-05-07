import { readFileSync } from "node:fs";
import path from "node:path";

import type { AtlasRuntimeSnapshot } from "./build_runtime.js";
import type { AtlasCompletedSessionRecord } from "./completed_sessions.js";
import {
  FREE_PLAN_ALLOWED_MODELS,
  PRO_PLAN_ALLOWED_MODELS,
  PRO_PLUS_ALLOWED_MODELS,
} from "../core/copilot_plan_profile.js";
import type { AtlasDesktopRepoContext } from "./desktop_state.js";
import {
  getAtlasDesktopSessionStatusLabel,
  type AtlasDesktopSessionMessage,
  type AtlasDesktopSessionRecord,
} from "./desktop_sessions.js";

export type AtlasMainPaneMode = "new-session" | "selected-session" | "completed-session-list" | "completed-session-detail";

export interface AtlasGitHubAuthSummary {
  accountLogin: string | null;
  githubTokenConfigured: boolean;
  copilotTokenConfigured: boolean;
  authRequired: boolean;
  source: "env" | "state" | "mixed" | "none";
}

export interface AtlasCopilotUsageSnapshot {
  planTier: "free" | "pro" | "pro_plus" | "business" | "enterprise" | "student" | "unknown";
  planLabel: string;
  modelAccess: "free" | "current";
  planDetectedBy: "field" | "entitlement" | "unknown";
  source: string;
  rawPlan: string | null;
  entitlement: number | null;
  usedRequests: number | null;
  remainingRequests: number | null;
  percentRemaining: number | null;
  currentSelectionMode?: "schema" | "single";
  currentSelectionSource?: "plan_schema" | "plan_default" | "session_selection" | "custom_schema";
  currentSelectionModel?: string | null;
}

export interface AtlasPageData {
  title: string;
  repoLabel: string;
  repoContext: AtlasDesktopRepoContext | null;
  hostLabel: string;
  shellCommand: string;
  updatedAt: string | null;
  buildSessionId: string;
  buildTimestamp: string | null;
  homeReadinessHeading: string;
  homeReadinessDetail: string;
  homePrimaryActionLabel: string;
  sessionStartStatusLabel: string;
  sessionStartStatusDetail: string;
  sessionStartUpdatedAt: string | null;
  continuityStatusLabel: string;
  continuityStatusDetail: string;
  mainPaneMode?: AtlasMainPaneMode;
  focusedSessionId: string | null;
  missingFocusedSnapshot: boolean;
  runtimeSnapshot: AtlasRuntimeSnapshot | null;
  githubAuth: AtlasGitHubAuthSummary;
  copilotUsage: AtlasCopilotUsageSnapshot | null;
  authRequired: boolean;
  maxTrackedSessions: number;
  activeSessionCount: number;
  canonicalSessionStages?: Record<string, string>;
  sessionRuntimeStatuses?: Record<string, AtlasSessionRuntimeStatusSummary>;
  completedSessionCount: number;
  sessions: AtlasDesktopSessionRecord[];
  completedSessions?: AtlasCompletedSessionRecord[];
  completedSession?: AtlasCompletedSessionRecord | null;
  focusedCompletedSessionKey?: string | null;
}

export interface AtlasSessionRuntimeStatusSummary {
  state: "active" | "stopped" | "onboarding" | "complete" | "attention";
  label: string;
  tone: "active" | "idle" | "complete" | "attention";
}

const ATLAS_THEME_STORAGE_KEY = "atlas.ui.theme";
const ATLAS_LANGUAGE_STORAGE_KEY = "atlas.ui.language";
const ATLAS_SELECTED_MODEL_STORAGE_KEY = "atlas.copilot.selectedModel";
const ATLAS_DEFAULT_THEME = "linen";
const ATLAS_DEFAULT_LANGUAGE = "en";
const ATLAS_LOGO_FILES = ["atlasimage.png", "atlas.png", "atlaslogoii.png", "Frame 5.png"] as const;
const ATLAS_THEME_OPTIONS = [
  {
    id: "linen",
    label: "Linen",
    description: "Warm paper surfaces with low-glare navy accents.",
    swatch: ["#f6f1e8", "#ebe0d2", "#2f5977"],
  },
  {
    id: "mist",
    label: "Mist",
    description: "Cool cloud neutrals with calm steel-blue depth.",
    swatch: ["#eff4f8", "#dde8f0", "#2a6189"],
  },
  {
    id: "sage",
    label: "Sage",
    description: "Soft green-tinted panels with restrained contrast.",
    swatch: ["#eef4ed", "#dce8d9", "#305f4b"],
  },
  {
    id: "petal",
    label: "Petal",
    description: "Blush-sand light mode with muted clay emphasis.",
    swatch: ["#faf0ec", "#ecd9d2", "#7d5354"],
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Balanced charcoal with soft silver contrast.",
    swatch: ["#0d0f12", "#171b20", "#d5dbe2"],
  },
  {
    id: "carbon",
    label: "Carbon",
    description: "Deep black panels with crisp cool-gray highlights.",
    swatch: ["#090a0c", "#13161a", "#c7ced7"],
  },
  {
    id: "slate",
    label: "Slate",
    description: "Muted blue-gray tones for a calmer desktop feel.",
    swatch: ["#0d1015", "#171d25", "#b9c4d0"],
  },
  {
    id: "smoke",
    label: "Smoke",
    description: "Softened gunmetal with subtle layered depth.",
    swatch: ["#121416", "#1d2227", "#cad0d6"],
  },
] as const;
const ATLAS_LANGUAGE_OPTIONS = [
  {
    id: "en",
    label: "English",
    nativeLabel: "English",
    description: "Interface copy stays in English.",
  },
  {
    id: "tr",
    label: "Türkçe",
    nativeLabel: "Türkçe",
    description: "Arayüz Türkçe olur.",
  },
] as const;

type AtlasThemeOption = (typeof ATLAS_THEME_OPTIONS)[number];

let cachedLogoDataUri: string | null | undefined;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeForInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Waiting for the next live update";
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "Waiting for the next live update";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatFileSize(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatQuotaCount(value: number | null, minimum = 0): string {
  if (value === null || !Number.isFinite(value)) {
    return "Unknown";
  }
  return new Intl.NumberFormat("en").format(Math.max(Math.round(value), minimum));
}

function getAtlasLogoDataUri(): string | null {
  if (cachedLogoDataUri !== undefined) {
    return cachedLogoDataUri;
  }

  for (const fileName of ATLAS_LOGO_FILES) {
    try {
      const logoPath = path.join(process.cwd(), fileName);
      const buffer = readFileSync(logoPath);
      cachedLogoDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
      return cachedLogoDataUri;
    } catch {
      continue;
    }
  }

  cachedLogoDataUri = null;
  return cachedLogoDataUri;
}

function renderBrandMark(): string {
  const logoDataUri = getAtlasLogoDataUri();
  if (logoDataUri) {
    return `<img class="brand-mark" src="${logoDataUri}" alt="ATLAS logo" />`;
  }
  return "";
}

function getSelectedSession(pageData: AtlasPageData): AtlasDesktopSessionRecord | null {
  if (!pageData.focusedSessionId) {
    return null;
  }
  return pageData.sessions.find((session) => session.id === pageData.focusedSessionId) || null;
}

function resolveMainPaneMode(pageData: AtlasPageData): AtlasMainPaneMode {
  if (pageData.mainPaneMode) {
    return pageData.mainPaneMode;
  }
  return getSelectedSession(pageData) ? "selected-session" : "new-session";
}

export function resolvePreferredAtlasSessionId(
  returnedSessionId: string | null | undefined,
  sessions: Array<Pick<AtlasDesktopSessionRecord, "id">> | null | undefined,
): string | null {
  const normalizedReturnedSessionId = typeof returnedSessionId === "string" && returnedSessionId.trim()
    ? returnedSessionId.trim()
    : null;
  const knownSessionIds = Array.isArray(sessions)
    ? sessions
      .map((session) => (session && typeof session.id === "string" ? session.id.trim() : ""))
      .filter((sessionId): sessionId is string => Boolean(sessionId))
    : [];

  if (normalizedReturnedSessionId && (knownSessionIds.length === 0 || knownSessionIds.includes(normalizedReturnedSessionId))) {
    return normalizedReturnedSessionId;
  }

  return knownSessionIds[0] || null;
}

function isCompletedSessionHistoryMode(pageData: AtlasPageData): boolean {
  return pageData.mainPaneMode === "completed-session-list" || pageData.mainPaneMode === "completed-session-detail";
}

function getCompletedSessionHref(session: AtlasCompletedSessionRecord): string {
  return `/sessions/view?projectId=${encodeURIComponent(session.projectId)}&sessionId=${encodeURIComponent(session.sessionId)}`;
}

function getCompletedSessionSummary(session: AtlasCompletedSessionRecord): string {
  return String(session.completionSummary || session.objective || "No final summary was recorded for this session.").trim();
}

function isHttpUrl(value: string | null): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function getCompletedSessionPresentationTarget(session: AtlasCompletedSessionRecord): string | null {
  return String(
    session.presentation?.finalTarget
    || session.presentation?.openTarget
    || session.presentation?.primaryLocation
    || session.repoUrl
    || "",
  ).trim() || null;
}

function renderCompletedSessionTargetValue(target: string | null): string {
  if (!target) {
    return `<p>No presentation target was recorded.</p>`;
  }
  if (isHttpUrl(target)) {
    return `<a class="history-product-link" href="${escapeHtml(target)}" target="_blank" rel="noreferrer">${escapeHtml(target)}</a>`;
  }
  return `<p class="history-mono">${escapeHtml(target)}</p>`;
}

function getCompletedSessionStatusLabel(session: AtlasCompletedSessionRecord): string {
  const status = String(session.finalStatus || "completed").trim();
  if (!status) return "Completed";
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ");
}

function renderCompletedSessionBadge(): string {
  return `<span class="status-pill status-pill-complete status-pill-compact history-status-pill">
    <span class="status-pill-dot" aria-hidden="true"></span>
    <span>Completed</span>
  </span>`;
}

function getAtlasThemeOption(themeId: string): AtlasThemeOption {
  return ATLAS_THEME_OPTIONS.find((option) => option.id === themeId) || ATLAS_THEME_OPTIONS[0];
}

function renderThemePreview(option: AtlasThemeOption): string {
  return `<span class="theme-preview" aria-hidden="true">
    ${option.swatch.map((color) => `<span class="theme-preview-swatch" style="background:${escapeHtml(color)}"></span>`).join("")}
  </span>`;
}

function getMessageKey(message: AtlasDesktopSessionMessage): string {
  const explicitId = String(message.id || "").trim();
  if (explicitId) {
    return explicitId;
  }
  return `${message.role}:${message.createdAt}:${message.text}`;
}

function getSessionRuntimeStatus(pageData: AtlasPageData, session: AtlasDesktopSessionRecord): AtlasSessionRuntimeStatusSummary {
  const runtimeStatus = pageData.sessionRuntimeStatuses?.[session.id];
  if (runtimeStatus?.label && runtimeStatus.tone) {
    return runtimeStatus;
  }
  return session.status === "ready"
    ? { state: "stopped", label: "Stopped", tone: "idle" }
    : { state: "onboarding", label: getAtlasDesktopSessionStatusLabel(session.status), tone: "idle" };
}

function renderStatusPill(pageData: AtlasPageData, session: AtlasDesktopSessionRecord, compact = false): string {
  const runtimeStatus = getSessionRuntimeStatus(pageData, session);
  const tone = runtimeStatus.tone;
  const label = runtimeStatus.label;
  return `<span class="status-pill status-pill-${tone}${compact ? " status-pill-compact" : ""}">
    <span class="status-pill-dot" aria-hidden="true"></span>
    <span>${escapeHtml(label)}</span>
  </span>`;
}

function getRepoDisplayName(repoContext: AtlasDesktopRepoContext | null): string | null {
  const targetRepo = String(repoContext?.targetRepo || "").trim();
  if (!targetRepo) {
    return null;
  }
  const normalized = targetRepo
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || normalized || null;
}

function getSessionDisplayTitle(session: AtlasDesktopSessionRecord): string {
  return getRepoDisplayName(session.repoContext)
    || String(session.projectName || "").trim()
    || String(session.title || "").trim()
    || "Tracked session";
}

function getSessionRailDescription(session: AtlasDesktopSessionRecord): string {
  return session.projectDescription || session.summary || session.objective;
}

function canonicalizeModelName(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getPlanModelOptions(usage: AtlasCopilotUsageSnapshot | null): string[] {
  const planTier = String(usage?.planTier || "").trim();
  const sourceModels = planTier === "free"
    ? FREE_PLAN_ALLOWED_MODELS
    : planTier === "pro" || planTier === "student"
      ? PRO_PLAN_ALLOWED_MODELS
      : planTier === "pro_plus" || planTier === "business" || planTier === "enterprise"
        ? PRO_PLUS_ALLOWED_MODELS
        : [];

  const resolved: string[] = [];
  for (const model of sourceModels) {
    if (resolved.some((entry) => canonicalizeModelName(entry) === canonicalizeModelName(model))) {
      continue;
    }
    resolved.push(model);
  }
  return resolved;
}

function getPlanDefaultSingleModel(usage: AtlasCopilotUsageSnapshot | null): string | null {
  const options = getPlanModelOptions(usage);
  if (usage?.planTier === "free") {
    return options.find((model) => canonicalizeModelName(model) === canonicalizeModelName("GPT-5 mini")) || options[0] || null;
  }
  if (usage?.planTier === "pro" || usage?.planTier === "student") {
    return options.find((model) => canonicalizeModelName(model) === canonicalizeModelName("GPT-5.3-codex"))
      || options.find((model) => canonicalizeModelName(model) === canonicalizeModelName("GPT-5.2 Codex"))
      || options[0]
      || null;
  }
  return null;
}

function getModelPickerDefaultState(usage: AtlasCopilotUsageSnapshot | null): {
  label: string;
  description: string;
  accentLabel: string;
  inlineNote: string;
  statusCopy: string;
} {
  const currentSelectionMode = usage?.currentSelectionMode || null;
  const currentSelectionSource = usage?.currentSelectionSource || null;
  const currentSelectionModel = usage?.currentSelectionModel || null;
  const defaultSingleModel = getPlanDefaultSingleModel(usage);

  if (currentSelectionMode === "schema" || currentSelectionSource === "custom_schema") {
    const isCustomSchema = currentSelectionSource === "custom_schema";
    return {
      label: isCustomSchema ? "Use current custom schema" : "Use current agent schema",
      description: isCustomSchema
        ? "Keep each agent on its current configured custom model schema."
        : "Keep each agent on its current configured model schema.",
      accentLabel: isCustomSchema ? "Custom" : "Current",
      inlineNote: isCustomSchema
        ? "Default: keep the current custom per-agent schema unless you choose one model."
        : "Default: keep the current per-agent schema unless you choose one model.",
      statusCopy: isCustomSchema
        ? "Choose one model to replace every agent model in the next new session. Without an override, Atlas keeps the current custom per-agent schema."
        : "Choose one model to replace every agent model in the next new session. Without an override, Atlas keeps the current per-agent schema.",
    };
  }

  if (currentSelectionSource === "session_selection" && currentSelectionModel) {
    return {
      label: `Use saved selection (${currentSelectionModel})`,
      description: `${currentSelectionModel} remains the single model for all agents until you change it.`,
      accentLabel: "Saved",
      inlineNote: `Default: ${currentSelectionModel} for all agents on this setup.`,
      statusCopy: `Choose one model to replace every agent model in the next new session. Atlas is currently set to ${currentSelectionModel} for all agents.`,
    };
  }

  if (defaultSingleModel) {
    return {
      label: `Use plan default (${defaultSingleModel})`,
      description: `${defaultSingleModel} becomes the single model for all agents.`,
      accentLabel: "Default",
      inlineNote: `Default: ${defaultSingleModel} for all agents on this plan.`,
      statusCopy: `Choose one model to replace every agent model in the next new session. Without an override, Atlas defaults to ${defaultSingleModel}.`,
    };
  }

  return {
    label: "Use current agent schema",
    description: "Keep each agent on its current configured model.",
    accentLabel: "Current",
    inlineNote: "Default: keep the current per-agent schema unless you choose one model.",
    statusCopy: "Choose one model to replace every agent model in the next new session. Without an override, Atlas keeps the current per-agent schema.",
  };
}

function getModelPickerInlineNote(usage: AtlasCopilotUsageSnapshot | null, selectedModel: string | null = null): string {
  if (selectedModel) {
    return `${selectedModel} will be used across all agents in the next new session.`;
  }
  if (!usage) {
    return "Connect GitHub to load plan-specific model choices.";
  }
  return getModelPickerDefaultState(usage).inlineNote;
}

function getModelPickerStatusCopy(usage: AtlasCopilotUsageSnapshot | null): string {
  if (!usage) {
    return "Connect GitHub so Atlas can show the model list for your current Copilot plan.";
  }
  return getModelPickerDefaultState(usage).statusCopy;
}

function renderModelPickerOptions(usage: AtlasCopilotUsageSnapshot | null): string {
  const options = getPlanModelOptions(usage);
  if (!options.length) {
    return `<div class="runtime-log-empty">${escapeHtml("No model choices are available for this plan yet.")}</div>`;
  }

  const defaultState = getModelPickerDefaultState(usage);

  return [
    `<button class="repo-picker-item model-picker-option model-picker-option-active" type="button" data-role="model-option-button" data-model-value="">`
      + `<div class="repo-picker-item-topline"><strong>${escapeHtml(defaultState.label)}</strong><span class="chip">${escapeHtml(defaultState.accentLabel)}</span></div>`
      + `<p class="support-copy repo-picker-description">${escapeHtml(defaultState.description)}</p>`
      + `</button>`,
    ...options.map((model) => `<button class="repo-picker-item model-picker-option" type="button" data-role="model-option-button" data-model-value="${escapeHtml(model)}">`
      + `<div class="repo-picker-item-topline"><strong>${escapeHtml(model)}</strong><span class="chip">All agents</span></div>`
      + `<p class="support-copy repo-picker-description">${escapeHtml(`${model} will replace every agent model in the next new session.`)}</p>`
      + `</button>`),
  ].join("");
}

function renderInlineProjectButton(
  repoContext: AtlasDesktopRepoContext | null,
  usage: AtlasCopilotUsageSnapshot | null,
): string {
  const buttonLabel = repoContext?.targetRepo || "I have a project";
  const helperCopy = repoContext?.targetRepo
    ? `Using ${repoContext.targetRepo} for the next request. Click the button if you want to change it.`
    : "Choose an existing project here, or use fresh repo in the picker and save the new project name and description before Atlas creates a new GitHub repository.";
  const modelCopy = getModelPickerInlineNote(usage);

  return `<div class="composer-project-row-copy">
    <div class="composer-project-action-row">
      <button class="build-control-button build-control-button-secondary build-control-button-compact composer-project-button" type="button" data-role="repo-picker-open">${escapeHtml(buttonLabel)}</button>
      <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="model-picker-open">Choose model</button>
    </div>
    <p class="support-copy composer-project-note">${escapeHtml(helperCopy)}</p>
    <p class="support-copy composer-project-note composer-model-note">${escapeHtml(modelCopy)}</p>
  </div>`;
}

function renderCopilotUsageCard(
  auth: AtlasGitHubAuthSummary,
  usage: AtlasCopilotUsageSnapshot | null,
  compact = false,
): string {
  const accountLabel = auth.accountLogin || "Not connected";
  const heading = auth.authRequired
    ? "GitHub sign-in required"
    : (usage?.planLabel || `Connected as ${accountLabel}`);
  const remainingCopy = usage
    ? formatQuotaCount(usage.remainingRequests)
    : (auth.authRequired ? "Required" : "Unavailable");
  const usageDetail = usage
    ? (compact
        ? `${usage.modelAccess === "free" ? "Free-safe" : "Current paid"} model pool`
        : `Model pool: ${usage.modelAccess === "free" ? "Free-safe" : "Current paid pool"}`)
    : (auth.authRequired
        ? "Connect GitHub before Atlas can list repos or choose the right Copilot model pool."
        : "Atlas is connected, but Copilot quota data is not available for this token yet.");
  const stats = compact
    ? [
        { label: "Account", value: accountLabel },
        { label: "Remaining", value: remainingCopy },
      ]
    : [
        { label: "Account", value: accountLabel },
        { label: "Remaining", value: remainingCopy },
        { label: "Used", value: formatQuotaCount(usage?.usedRequests ?? null) },
        { label: "Plan", value: usage?.planLabel || "Pending" },
      ];

  return `<section class="copilot-usage-card${compact ? " copilot-usage-card-compact" : ""}" aria-label="Copilot usage">
    <div class="copilot-usage-topline">
      <div>
        <p class="eyebrow">GitHub access</p>
        <strong class="copilot-usage-title">${escapeHtml(heading)}</strong>
      </div>
      <div class="copilot-usage-actions">
        <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="github-auth-refresh">Refresh</button>
        <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="github-auth-open">${auth.authRequired ? "Connect" : "Update access"}</button>
      </div>
    </div>
    <div class="copilot-usage-grid">
      ${stats.map((stat) => `<div class="copilot-usage-stat">
        <span class="copilot-usage-stat-label">${escapeHtml(stat.label)}</span>
        <strong>${escapeHtml(stat.value)}</strong>
      </div>`).join("")}
    </div>
    <p class="support-copy copilot-usage-copy">${escapeHtml(usageDetail)}</p>
  </section>`;
}

function renderGitHubAuthModal(pageData: AtlasPageData): string {
  return `<div class="github-auth-modal" data-role="github-auth-modal" ${pageData.authRequired ? "" : "hidden"}>
    <div class="github-auth-card" role="dialog" aria-modal="true" aria-labelledby="github-auth-title">
      <div class="github-auth-header">
        <div>
          <p class="eyebrow">Atlas startup</p>
          <strong class="runtime-log-title" id="github-auth-title">Connect your GitHub account</strong>
          <p class="support-copy" data-role="github-auth-status">Atlas needs a GitHub token before it can list repositories, create new repos, and detect the correct Copilot model pool.</p>
        </div>
        ${pageData.authRequired ? "" : '<button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="github-auth-close">Close</button>'}
      </div>
      <form class="github-auth-form" data-role="github-auth-form">
        <label class="github-auth-field">
          <span>GitHub account label</span>
          <input class="github-auth-input" type="text" name="accountLogin" placeholder="octocat" value="${escapeHtml(pageData.githubAuth.accountLogin || "")}" autocomplete="username" />
        </label>
        <label class="github-auth-field">
          <span>GitHub repo token</span>
          <input class="github-auth-input" type="password" name="githubToken" placeholder="ghp_... or github_pat_..." autocomplete="off" />
        </label>
        <label class="github-auth-field">
          <span>Fine-grained GitHub token</span>
          <input class="github-auth-input" type="password" name="githubFinegrainedToken" placeholder="Optional if the GitHub token above is already github_pat_/gho_/ghu_" autocomplete="off" />
        </label>
        <p class="support-copy github-auth-note">Use GITHUB_TOKEN for repo/API access. Use GITHUB_FINEGRADED only when the repo token is not already a Copilot-compatible github_pat_, gho_, or ghu_ token. Tokens are stored locally on this machine so Atlas can restore access on the next launch.</p>
        <p class="composer-error" data-role="github-auth-error"></p>
        <div class="github-auth-actions">
          <button class="build-control-button" type="submit">Save access</button>
        </div>
      </form>
    </div>
  </div>`;
}

function resolveNewSessionComposerPlaceholder(repoContext: AtlasDesktopRepoContext | null): string {
  if (!repoContext?.targetRepo) {
    return "Describe the new project you want Atlas to create";
  }
  return repoContext.repoMode === "existing"
    ? `What should Atlas change in ${repoContext.targetRepo}?`
    : `What should Atlas build in ${repoContext.targetRepo}?`;
}

function renderContinuityCard(pageData: AtlasPageData, compact = false): string {
  const detailCopy = compact
    ? (pageData.activeSessionCount === 0
        ? "Your next request becomes the first live row in this shell."
        : "Tracked sessions stay pinned here so you can resume them from the left rail.")
    : pageData.continuityStatusDetail;
  const metaCopy = compact
    ? ""
    : pageData.sessionStartStatusDetail;

  return `<section class="workspace-note-card${compact ? " workspace-note-card-compact" : ""}" aria-label="Desktop continuity">
    <p class="eyebrow">Desktop continuity</p>
    <strong class="workspace-note-title">${escapeHtml(pageData.continuityStatusLabel)}</strong>
    <p class="support-copy workspace-note-copy">${escapeHtml(detailCopy)}</p>
    <div class="workspace-note-meta${compact ? " workspace-note-meta-compact" : ""}">
      <span class="chip">${escapeHtml(`${pageData.activeSessionCount}/${pageData.maxTrackedSessions} live sessions`)}</span>
      ${metaCopy ? `<span class="support-copy">${escapeHtml(metaCopy)}</span>` : ""}
    </div>
  </section>`;
}

function renderThemePicker(): string {
  const activeTheme = getAtlasThemeOption(ATLAS_DEFAULT_THEME);
  const activeLanguage = ATLAS_LANGUAGE_OPTIONS.find((option) => option.id === ATLAS_DEFAULT_LANGUAGE) || ATLAS_LANGUAGE_OPTIONS[0];
  return `<section class="theme-switcher" data-role="theme-switcher" aria-label="Atlas settings">
    <button class="theme-switcher-button" type="button" data-role="theme-picker-toggle" aria-haspopup="true" aria-expanded="false">
      <span class="theme-switcher-copy">
        <span class="eyebrow" data-i18n="settingsEyebrow">Settings</span>
        <strong data-i18n="settingsTitle">Workspace settings</strong>
        <span class="support-copy" data-role="settings-summary">${escapeHtml(`${activeTheme.label} · ${activeLanguage.nativeLabel}`)}</span>
      </span>
      <span class="theme-switcher-visuals">
        <span class="language-chip" data-role="language-current-label">${escapeHtml(activeLanguage.nativeLabel)}</span>
        ${renderThemePreview(activeTheme)}
      </span>
    </button>
    <div class="theme-switcher-menu" data-role="theme-picker-menu" hidden>
      <div class="theme-switcher-menu-head">
        <strong data-i18n="settingsMenuTitle">Workspace settings</strong>
        <span class="support-copy" data-i18n="settingsMenuSummary">Choose the theme and interface language for the full desktop shell.</span>
      </div>
      <section class="settings-section">
        <div class="settings-section-head">
          <p class="eyebrow" data-i18n="settingsThemeSection">Theme</p>
          <span class="support-copy" data-i18n="settingsThemeSummary">Applied across the whole GUI, including tracked sessions.</span>
        </div>
        <div class="theme-switcher-options">
          ${ATLAS_THEME_OPTIONS.map((option) => `<button class="theme-option" type="button" data-role="theme-option" data-theme-id="${escapeHtml(option.id)}">
            <span class="theme-option-copy">
              <strong>${escapeHtml(option.label)}</strong>
              <span class="support-copy">${escapeHtml(option.description)}</span>
            </span>
            ${renderThemePreview(option)}
          </button>`).join("")}
        </div>
      </section>
      <section class="settings-section">
        <div class="settings-section-head">
          <p class="eyebrow" data-i18n="settingsLanguageSection">Language</p>
          <span class="support-copy" data-i18n="settingsLanguageSummary">Switch the ATLAS interface between English and Turkish.</span>
        </div>
        <div class="language-option-grid">
          ${ATLAS_LANGUAGE_OPTIONS.map((option) => `<button class="theme-option language-option" type="button" data-role="language-option" data-language-id="${escapeHtml(option.id)}">
            <span class="theme-option-copy">
              <strong>${escapeHtml(option.nativeLabel)}</strong>
              <span class="support-copy">${escapeHtml(option.description)}</span>
            </span>
            <span class="language-option-label">${escapeHtml(option.label)}</span>
          </button>`).join("")}
        </div>
      </section>
    </div>
  </section>`;
}

function renderRepoPickerModal(): string {
  return `<div class="repo-picker-modal" data-role="repo-picker-modal" hidden>
    <div class="repo-picker-card" role="dialog" aria-modal="true" aria-labelledby="repo-picker-title">
      <div class="repo-picker-header">
        <div>
          <p class="eyebrow">Existing project</p>
          <strong class="runtime-log-title" id="repo-picker-title">Choose a GitHub repository</strong>
          <p class="support-copy" data-role="repo-picker-status">Atlas will use existing-project onboarding for the repo you select here.</p>
        </div>
        <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="repo-picker-close">Close</button>
      </div>
      <div class="repo-picker-toolbar">
        <input class="repo-picker-search-input" type="search" data-role="repo-picker-search" placeholder="Search repositories" />
        <div class="repo-picker-toolbar-actions">
          <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="repo-context-clear">Use fresh repo</button>
          <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="repo-picker-refresh">Refresh</button>
        </div>
      </div>
      <div class="repo-picker-list" data-role="repo-picker-list">
        <div class="runtime-log-empty">Atlas will load your GitHub repositories here.</div>
      </div>
    </div>
  </div>`;
}

function renderProjectDetailsModal(): string {
  return `<div class="repo-picker-modal" data-role="project-details-modal" hidden>
    <div class="repo-picker-card project-details-card" role="dialog" aria-modal="true" aria-labelledby="project-details-title">
      <div class="repo-picker-header">
        <div>
          <p class="eyebrow">New project</p>
          <strong class="runtime-log-title" id="project-details-title">Write the project name and description</strong>
          <p class="support-copy" data-role="project-details-status">Atlas will create the new GitHub repository from these details instead of using your first prompt as the repo name.</p>
        </div>
        <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="project-details-close">Close</button>
      </div>
      <form class="github-auth-form project-details-form" data-role="project-details-form">
        <label class="github-auth-field">
          <span>Project name</span>
          <input class="github-auth-input" type="text" name="projectName" placeholder="Steak Restaurant Landing Page" autocomplete="off" />
        </label>
        <label class="github-auth-field">
          <span>Project description</span>
          <textarea class="github-auth-input project-details-textarea" name="projectDescription" rows="5" placeholder="Describe what Atlas should create in this repository."></textarea>
        </label>
        <p class="support-copy">Atlas will use this name for the repo and the live row title, and this description for the live row detail.</p>
        <p class="composer-error" data-role="project-details-error"></p>
        <div class="github-auth-actions">
          <button class="build-control-button" type="submit">Save project details</button>
        </div>
      </form>
    </div>
  </div>`;
}

function renderModelPickerModal(pageData: AtlasPageData): string {
  return `<div class="repo-picker-modal" data-role="model-picker-modal" hidden>
    <div class="repo-picker-card model-picker-card" role="dialog" aria-modal="true" aria-labelledby="model-picker-title">
      <div class="repo-picker-header">
        <div>
          <p class="eyebrow">Choose model</p>
          <strong class="runtime-log-title" id="model-picker-title">Select one model for all agents</strong>
          <p class="support-copy model-picker-status" data-role="model-picker-status">${escapeHtml(getModelPickerStatusCopy(pageData.copilotUsage))}</p>
        </div>
        <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="model-picker-close">Close</button>
      </div>
      <div class="repo-picker-list model-picker-list" data-role="model-picker-list">${renderModelPickerOptions(pageData.copilotUsage)}</div>
    </div>
  </div>`;
}

function renderSidebar(pageData: AtlasPageData): string {
  const newSessionDisabled = pageData.activeSessionCount >= pageData.maxTrackedSessions;
  const completedView = isCompletedSessionHistoryMode(pageData);
  return `<aside class="desktop-sidebar" aria-label="ATLAS desktop sidebar">
    <button class="sidebar-brand" type="button" data-action="new-session">
      ${renderBrandMark()}
      <span class="brand-copy">
        <strong class="brand-title">ATLAS</strong>
      </span>
    </button>
    <button class="sidebar-new-session${pageData.focusedSessionId || completedView ? "" : " sidebar-new-session-active"}" type="button" data-action="new-session" ${newSessionDisabled ? "disabled" : ""}>
      <strong data-i18n="sidebarNewSession">New Session</strong>
      <span>${escapeHtml(`${pageData.activeSessionCount}/${pageData.maxTrackedSessions}`)}</span>
    </button>
    <a class="sidebar-history-link${completedView ? " sidebar-history-link-active" : ""}" href="/sessions">
      <strong data-i18n="sidebarCompletedSessions">Completed Sessions</strong>
      <span>${escapeHtml(String(pageData.completedSessionCount || 0))}</span>
    </a>
    <div class="sidebar-compact-stack">
      <div class="copilot-usage-host copilot-usage-host-sidebar copilot-usage-host-compact" data-role="copilot-usage-host">${renderCopilotUsageCard(pageData.githubAuth, pageData.copilotUsage, true)}</div>
      <div data-role="continuity-card-host">${renderContinuityCard(pageData, true)}</div>
    </div>
    <section class="sidebar-rail-section" aria-label="Live rows">
      <div class="section-heading">
        <h2 data-i18n="sidebarLiveRows">Live Rows</h2>
        <span class="sidebar-row-count">${escapeHtml(String(pageData.sessions.length))}</span>
      </div>
      <div class="session-rail" data-role="session-rail-host">
        ${pageData.sessions.length === 0
          ? `<div class="sidebar-empty">
              <strong data-i18n="sidebarEmptyTitle">No live rows yet.</strong>
              <p class="support-copy" data-i18n="sidebarEmptyBody">Start the first session from the composer on the right.</p>
            </div>`
          : pageData.sessions.map((session) => `
            <button class="session-rail-link${session.id === pageData.focusedSessionId ? " session-rail-link-selected" : ""}" type="button" data-session-id="${escapeHtml(session.id)}">
              <div class="session-rail-header">
                <strong>${escapeHtml(getSessionDisplayTitle(session))}</strong>
                ${renderStatusPill(pageData, session, true)}
              </div>
              <p>${escapeHtml(getSessionRailDescription(session))}</p>
            </button>
          `).join("")}
      </div>
    </section>
    ${renderThemePicker()}
  </aside>`;
}

function renderNewSessionPane(pageData: AtlasPageData): string {
  const newSessionDisabled = pageData.activeSessionCount >= pageData.maxTrackedSessions;
  return `<section class="main-pane main-pane-start" data-role="new-session-view">
    <div class="new-session-shell">
      <div class="new-session-grid">
        <div class="new-session-primary">
          <div class="new-session-intro">
            <p class="eyebrow">Atlas desktop</p>
            <h1 class="new-session-heading" data-i18n="newSessionHeading">What do you want Atlas to deliver today?</h1>
            <p class="support-copy intro-copy" data-role="new-session-intro-copy">${escapeHtml(pageData.homeReadinessDetail)}</p>
          </div>
          <form class="composer-card composer-card-home" data-role="chat-form">
            <div class="composer-entry-shell">
              <button class="composer-inline-button composer-attach-button" type="button" data-role="composer-attach-button" aria-label="Add files" ${newSessionDisabled ? "disabled" : ""}>+</button>
              <input class="composer-attachment-input" type="file" data-role="attachment-input" multiple hidden ${newSessionDisabled ? "disabled" : ""} />
              <textarea class="composer-input" data-role="chat-input" rows="1" placeholder="${escapeHtml(resolveNewSessionComposerPlaceholder(pageData.repoContext))}" ${newSessionDisabled ? "disabled" : ""}></textarea>
              <button class="composer-submit-button" type="submit" aria-label="Send message" ${newSessionDisabled ? "disabled" : ""}>
                <span class="composer-submit-icon" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M4.25 3.75L10.5 8L4.25 12.25" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
              </button>
            </div>
            <div class="pending-attachment-list" data-role="pending-attachment-list" hidden></div>
            <div class="composer-project-row" data-role="project-context-row-host">${renderInlineProjectButton(pageData.repoContext, pageData.copilotUsage)}</div>
            <p class="support-copy global-status" data-role="global-status">${escapeHtml(newSessionDisabled
              ? `ATLAS already tracks ${pageData.maxTrackedSessions} live sessions in this shell.`
              : "Message box ready.")}</p>
            <p class="composer-error" data-role="global-error"></p>
          </form>
        </div>
      </div>
    </div>
    ${renderRepoPickerModal()}
    ${renderProjectDetailsModal()}
    ${renderModelPickerModal(pageData)}
    <div class="ui-loading-overlay" data-role="loading-overlay" hidden>
      <div class="loading-card">
        <div class="loading-spinner" aria-hidden="true"></div>
        <strong class="loading-title" data-role="loading-overlay-heading">Atlas is shaping the onboarding lane</strong>
        <p class="support-copy loading-copy" data-role="loading-overlay-detail">Your request is being converted into a live onboarding session.</p>
      </div>
    </div>
  </section>`;
}

function renderMessage(message: AtlasDesktopSessionMessage): string {
  const isUser = message.role === "user";
  return `<div class="message-row${isUser ? " message-row-user" : ""}" data-message-id="${escapeHtml(getMessageKey(message))}">
    <article class="message-card${isUser ? " message-card-user" : ""}">
      <div class="message-meta">
        <span>${isUser ? "You" : "Atlas"}</span>
        <span>${escapeHtml(formatTimestamp(message.createdAt))}</span>
      </div>
      <div class="message-body">${escapeHtml(message.text).replaceAll("\n", "<br />")}</div>
    </article>
  </div>`;
}

function renderSessionAttachmentPanel(session: AtlasDesktopSessionRecord): string {
  if (session.attachments.length === 0) {
    return "";
  }

  const planByAttachmentId = new Map(session.attachmentPlans.map((plan) => [plan.attachmentId, plan]));
  return `<section class="asset-rail" aria-label="Attached files">
    <div class="asset-rail-header">
      <p class="eyebrow">Attached files</p>
      <span class="sidebar-row-count">${escapeHtml(String(session.attachments.length))}</span>
    </div>
    <div class="asset-rail-track">
      ${session.attachments.map((attachment) => {
        const plan = planByAttachmentId.get(attachment.id);
        const primaryCopy = plan?.intendedUse || attachment.roleHint;
        const placementCopy = plan?.placementHint || attachment.storedRelativePath;
        return `<article class="asset-rail-card">
          <div class="asset-card-header">
            <strong class="asset-card-title">${escapeHtml(attachment.originalName)}</strong>
            <span class="chip">${escapeHtml(attachment.kind)}</span>
          </div>
          <div class="asset-card-meta">
            <span>${escapeHtml(attachment.mediaType || "application/octet-stream")}</span>
            <span>${escapeHtml(formatFileSize(attachment.byteSize))}</span>
          </div>
          <p class="asset-rail-copy">${escapeHtml(primaryCopy)}</p>
          <p class="asset-card-placement">${escapeHtml(placementCopy)}</p>
        </article>`;
      }).join("")}
    </div>
  </section>`;
}

function renderBuildControlsHtml(sessionId: string, runtimeSnapshot: AtlasRuntimeSnapshot | null): string {
  const requestState = String(runtimeSnapshot?.request.state || "queued");
  const missionSessionId = String(runtimeSnapshot?.mission.desktopSessionId || runtimeSnapshot?.mission.sessionId || "").trim();
  const ownsMission = missionSessionId === sessionId;
  const canStop = ownsMission && requestState === "running";
  const canContinue = !ownsMission || requestState === "queued" || requestState === "paused" || requestState === "completed" || requestState === "error";
  const helperCopy = ownsMission
    ? (requestState === "paused"
        ? "This session's build is paused. Resume will re-inject the same mission brief into BOX."
        : "These controls affect only the live build mission owned by this selected session.")
    : "Resume promotes this ready session into the live build mission without disturbing the other tracked sessions in the rail.";

  return `<section class="build-control-bar" data-role="build-control-host">
    <div class="build-control-copy">
      <p class="eyebrow" data-i18n="missionControls">Mission controls</p>
      <p class="support-copy build-control-note" data-role="build-control-feedback">${escapeHtml(helperCopy)}</p>
    </div>
    <div class="build-control-actions">
      <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="runtime-log-button" data-session-id="${escapeHtml(sessionId)}" data-i18n="logsLabel">Logs</button>
      <button class="build-control-button" type="button" data-role="build-control-button" data-build-action="resume-build" data-session-id="${escapeHtml(sessionId)}" data-i18n="resumeLabel" ${canContinue ? "" : "disabled"}>Resume</button>
      <button class="build-control-button build-control-button-danger" type="button" data-role="build-control-button" data-build-action="stop-build" data-session-id="${escapeHtml(sessionId)}" data-i18n="stopLabel" ${canStop ? "" : "disabled"}>Stop</button>
    </div>
  </section>`;
}

function renderRuntimeLogModal(): string {
  return `<div class="runtime-log-modal" data-role="runtime-log-modal" hidden>
    <div class="runtime-log-card" role="dialog" aria-modal="true" aria-labelledby="runtime-log-modal-title">
      <div class="runtime-log-header">
        <div class="runtime-log-title-group">
          <p class="eyebrow" data-i18n="rawLogsEyebrow">Raw logs</p>
          <strong class="runtime-log-title" id="runtime-log-modal-title" data-role="runtime-log-title" data-i18n="runtimeLogsTitle">Runtime logs</strong>
          <p class="support-copy" data-role="runtime-log-status" data-i18n="runtimeLogsHint">Select Logs to load the matched session progress log for this session.</p>
        </div>
        <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="runtime-log-close" data-i18n="closeLabel">Close</button>
      </div>
      <div class="runtime-log-output" data-role="runtime-log-output">
        <div class="runtime-log-empty" data-i18n="runtimeLogsEmpty">ATLAS will show the newest raw runtime logs for this build mission here.</div>
      </div>
    </div>
  </div>`;
}

function renderBuildShell(session: AtlasDesktopSessionRecord, runtimeSnapshot: AtlasRuntimeSnapshot | null): string {
  const pipelinePercent = Math.max(0, Math.min(100, Number(runtimeSnapshot?.pipeline.percent || 0)));
  const requestState = String(runtimeSnapshot?.request.state || "queued");
  const loopCount = Number.isFinite(Number(runtimeSnapshot?.pipeline.loopCount)) ? Math.max(0, Number(runtimeSnapshot?.pipeline.loopCount)) : 0;
  const sessionPremiumRequests = Number.isFinite(Number(runtimeSnapshot?.sessionPremiumRequests)) ? Math.max(0, Number(runtimeSnapshot?.sessionPremiumRequests)) : 0;
  return `<section class="build-shell" data-role="build-view" data-session-id="${escapeHtml(session.id)}" ${session.status === "ready" ? "" : "hidden"}>
    ${renderBuildControlsHtml(session.id, runtimeSnapshot)}
    <section class="build-progress-card" aria-label="Build pipeline progress">
      <div class="build-progress-topline">
        <div class="build-progress-copy">
          <p class="eyebrow" data-i18n="pipelineLabel">Pipeline</p>
          <strong class="build-progress-stage" data-role="build-stage-label">${escapeHtml(runtimeSnapshot?.pipeline.stageLabel || "Waiting for runtime")}</strong>
        </div>
        <div class="build-progress-meta">
          <div class="build-progress-statline">
            <span class="build-runtime-stat">
              <span class="build-runtime-stat-label" data-i18n="loopsLabel">Loops</span>
              <strong class="build-runtime-stat-value" data-role="build-loop-count">${escapeHtml(String(loopCount))}</strong>
            </span>
            <span class="build-runtime-stat">
              <span class="build-runtime-stat-label" data-i18n="sessionPremiumLabel">Session premium</span>
              <strong class="build-runtime-stat-value" data-role="build-session-premium-count">${escapeHtml(String(sessionPremiumRequests))}</strong>
            </span>
          </div>
          <span class="build-state-badge build-state-${escapeHtml(requestState)}" data-role="build-request-state">${escapeHtml(runtimeSnapshot?.request.stateLabel || "Queued")}</span>
          <strong class="build-progress-percent" data-role="build-percent-label">${escapeHtml(`${String(pipelinePercent)}%`)}</strong>
        </div>
      </div>
      <p class="support-copy build-state-copy" data-role="build-request-copy">${escapeHtml(runtimeSnapshot?.request.triggerLabel || "ATLAS is preparing the live runtime bridge for this session.")}</p>
      <div class="build-progress-track" aria-hidden="true">
        <span class="build-progress-fill" data-role="build-progress-fill" style="width:${String(pipelinePercent)}%"></span>
      </div>
      <p class="support-copy build-progress-detail" data-role="build-stage-detail">${escapeHtml(runtimeSnapshot?.pipeline.detail || "ATLAS will stream the live build flow here as soon as the runtime responds.")}</p>
    </section>
    <div class="build-layout">
      <div class="build-agent-stack" data-role="build-agent-list"></div>
      <div class="build-detail-card" data-role="build-agent-detail">
        <div class="build-detail-empty">
          <p class="eyebrow" data-i18n="readableDetailLabel">Readable detail</p>
          <strong data-i18n="selectAgentLabel">Select an agent</strong>
          <p class="support-copy" data-i18n="selectAgentHelp">The build surface stays minimal until you pick an agent card. Then the right panel turns into that agent's readable detail view.</p>
        </div>
      </div>
    </div>
  </section>`;
}

function renderSelectedSessionPane(pageData: AtlasPageData, session: AtlasDesktopSessionRecord, runtimeSnapshot: AtlasRuntimeSnapshot | null): string {
  return `<section class="main-pane main-pane-thread" data-role="selected-session-view">
    <div class="conversation-shell">
      <header class="conversation-header">
        <div class="conversation-header-main">
          <p class="eyebrow" data-i18n="trackedSessionEyebrow">Tracked session</p>
          <h1 class="conversation-title" data-role="conversation-title">${escapeHtml(getSessionDisplayTitle(session))}</h1>
        </div>
        <div class="conversation-header-side">
          <div data-role="conversation-status-pill-host">${renderStatusPill(pageData, session)}</div>
          <button class="build-control-button build-control-button-danger build-control-button-compact" type="button" data-role="delete-session-button" data-session-id="${escapeHtml(session.id)}" data-i18n="deleteProjectLabel">Delete this project</button>
          <span class="support-copy" data-role="conversation-updated-at">${escapeHtml(formatTimestamp(session.updatedAt))}</span>
        </div>
      </header>
      <div class="session-content" data-role="selected-session-content">
        <div class="conversation-mode" data-role="conversation-view" ${session.status === "ready" ? "hidden" : ""}>
          <div data-role="asset-panel-host">${renderSessionAttachmentPanel(session)}</div>
          <div class="conversation-thread" data-role="conversation-thread">
            ${session.messages.map(renderMessage).join("")}
          </div>
          <form class="composer-card composer-card-thread" data-role="chat-form" data-session-id="${escapeHtml(session.id)}">
            <div class="composer-entry-shell">
              <button class="composer-inline-button composer-attach-button" type="button" data-role="composer-attach-button" aria-label="Add files">+</button>
              <input class="composer-attachment-input" type="file" data-role="attachment-input" multiple hidden />
              <textarea class="composer-input" data-role="chat-input" rows="1" placeholder="What do you want to create?"></textarea>
              <button class="composer-submit-button" type="submit" aria-label="Send message">
                <span class="composer-submit-icon" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M4.25 3.75L10.5 8L4.25 12.25" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
              </button>
            </div>
            <div class="pending-attachment-list" data-role="pending-attachment-list" hidden></div>
            <p class="composer-error" data-role="global-error"></p>
          </form>
        </div>
        ${renderBuildShell(session, runtimeSnapshot)}
      </div>
      <div class="ui-loading-overlay" data-role="loading-overlay" hidden>
        <div class="loading-card">
          <div class="loading-spinner" aria-hidden="true"></div>
          <strong class="loading-title" data-role="loading-overlay-heading">Atlas is processing your session</strong>
          <p class="support-copy loading-copy" data-role="loading-overlay-detail">Your latest answer is being folded into the onboarding flow.</p>
        </div>
      </div>
      ${renderRuntimeLogModal()}
    </div>
  </section>`;
}

function renderCompletedSessionListPane(pageData: AtlasPageData): string {
  const completedSessions = Array.isArray(pageData.completedSessions) ? pageData.completedSessions : [];
  return `<section class="main-pane main-pane-history" data-role="completed-session-list-view">
    <div class="history-shell history-shell-list">
      <header class="history-header">
        <div>
          <p class="eyebrow">Session archive</p>
          <h1 class="history-heading">Completed sessions</h1>
          <p class="support-copy history-copy">Finished sessions stay here so you can reopen the final product without keeping them pinned in live rows.</p>
        </div>
        <span class="chip">${escapeHtml(String(completedSessions.length))} saved</span>
      </header>
      ${completedSessions.length === 0
        ? `<div class="history-empty">
            <strong>No completed sessions yet.</strong>
            <p class="support-copy">ATLAS will keep finished sessions here instead of clearing them when the desktop app restarts.</p>
          </div>`
        : `<div class="history-list history-list-compact">
            ${completedSessions.map((session) => `<a class="history-card" href="${escapeHtml(getCompletedSessionHref(session))}">
              <div class="history-card-topline">
                ${renderCompletedSessionBadge()}
                <span class="support-copy">${escapeHtml(formatTimestamp(session.archivedAt))}</span>
              </div>
              <strong class="history-card-title">${escapeHtml(session.title)}</strong>
              <p class="history-card-summary">${escapeHtml(getCompletedSessionSummary(session))}</p>
              <div class="history-card-meta history-card-meta-compact">
                <span class="history-card-meta-value">${escapeHtml(session.projectId)}</span>
                <span class="history-card-meta-value">${escapeHtml(session.sessionId)}</span>
              </div>
            </a>`).join("")}
          </div>`}
    </div>
  </section>`;
}

function renderCompletedSessionDetailPane(session: AtlasCompletedSessionRecord): string {
  const hasUnresolvedItems = session.unresolvedItems.length > 0;
  const presentation = session.presentation;
  const presentationTarget = getCompletedSessionPresentationTarget(session);
  const presentationAction = String(
    presentation?.executionMode
    || presentation?.locationType
    || (presentationTarget ? "open_url" : "document_only"),
  ).trim();
  const workspaceSnapshotMessage = session.workspacePath
    ? (session.workspaceSnapshotAvailable
      ? "The preserved workspace snapshot is still available on this PC."
      : "This workspace snapshot has already been removed from this PC.")
    : "No workspace snapshot was recorded for this session.";
  return `<section class="main-pane main-pane-history" data-role="completed-session-detail-view">
    <div class="history-shell history-shell-detail">
      <header class="history-header">
        <div>
          <a class="history-back-link" href="/sessions">Back to completed sessions</a>
          <p class="eyebrow">Session archive</p>
          <h1 class="history-heading">${escapeHtml(session.title)}</h1>
          <p class="support-copy history-copy">${escapeHtml(getCompletedSessionSummary(session))}</p>
        </div>
        <span class="chip">${escapeHtml(getCompletedSessionStatusLabel(session))}</span>
      </header>
      <div class="history-detail-grid">
        <article class="history-detail-card">
          <p class="eyebrow">Session info</p>
          <dl class="history-detail-list">
            <div><dt>Project</dt><dd>${escapeHtml(session.projectId)}</dd></div>
            <div><dt>Session</dt><dd>${escapeHtml(session.sessionId)}</dd></div>
            <div><dt>Archived</dt><dd>${escapeHtml(formatTimestamp(session.archivedAt))}</dd></div>
            <div><dt>Reason</dt><dd>${escapeHtml(session.completionReason || "No completion reason recorded")}</dd></div>
          </dl>
        </article>
        <article class="history-detail-card">
          <p class="eyebrow">Final product</p>
          <div class="history-product-grid">
            <div class="history-product-card">
              <span class="history-product-label">Completion summary</span>
              <p>${escapeHtml(getCompletedSessionSummary(session))}</p>
            </div>
            <div class="history-product-card">
              <span class="history-product-label">GitHub repository</span>
              ${session.repoUrl
                ? `<a class="history-product-link" href="${escapeHtml(session.repoUrl)}" target="_blank" rel="noreferrer">${escapeHtml(session.repoUrl)}</a>`
                : `<p>No repository URL was recorded.</p>`}
            </div>
            <div class="history-product-card">
              <span class="history-product-label">Workspace snapshot</span>
              <p class="history-mono" data-role="completed-workspace-path">${escapeHtml(session.workspacePath || "No workspace path was recorded.")}</p>
              <p class="support-copy" data-role="completed-workspace-feedback">${escapeHtml(workspaceSnapshotMessage)}</p>
              <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="completed-session-files-delete" data-project-id="${escapeHtml(session.projectId)}" data-session-id="${escapeHtml(session.sessionId)}"${session.workspaceSnapshotAvailable ? "" : " disabled"}>Delete session files from my PC</button>
              </div>
            </div>
          </div>
        </article>
        <article class="history-detail-card history-detail-card-wide">
          <p class="eyebrow">Product presentation</p>
          <div class="history-product-grid">
            <div class="history-product-card">
              <span class="history-product-label">Presenter summary</span>
              <p data-role="completed-presentation-summary">${escapeHtml(presentation?.userMessage || getCompletedSessionSummary(session))}</p>
            </div>
            <div class="history-product-card" data-role="completed-presentation-card" data-project-id="${escapeHtml(session.projectId)}" data-session-id="${escapeHtml(session.sessionId)}">
              <span class="history-product-label">Open target</span>
              <div data-role="completed-presentation-target">${renderCompletedSessionTargetValue(presentationTarget)}</div>
              <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="completed-presentation-refresh" data-project-id="${escapeHtml(session.projectId)}" data-session-id="${escapeHtml(session.sessionId)}">Refresh Open Target</button>
                <span class="support-copy" data-role="completed-presentation-feedback">Re-run the archived presenter for this session and refresh the target link.</span>
              </div>
            </div>
            <div class="history-product-card">
              <span class="history-product-label">Action</span>
              <p data-role="completed-presentation-action">${escapeHtml(presentationAction || "document_only")}${presentation?.autoOpenStatus ? ` - auto-open ${escapeHtml(presentation.autoOpenStatus)}` : ""}</p>
            </div>
            <div class="history-product-card">
              <span class="history-product-label">Decision source</span>
              <p data-role="completed-presentation-source">${escapeHtml(presentation?.resolutionSource || "No presenter decision source was recorded.")}</p>
            </div>
          </div>
        </article>
        <article class="history-detail-card history-detail-card-wide">
          <p class="eyebrow">Original objective</p>
          <p class="history-copy">${escapeHtml(session.objective || "No objective was recorded for this session.")}</p>
        </article>
        <article class="history-detail-card history-detail-card-wide">
          <p class="eyebrow">Unresolved items</p>
          ${hasUnresolvedItems
            ? `<ul class="history-unresolved-list">${session.unresolvedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            : `<p class="history-copy">No unresolved items were recorded when this session was archived.</p>`}
        </article>
      </div>
    </div>
  </section>`;
}

function renderMainPane(pageData: AtlasPageData): string {
  const mainPaneMode = resolveMainPaneMode(pageData);
  if (mainPaneMode === "completed-session-list") {
    return renderCompletedSessionListPane(pageData);
  }
  if (mainPaneMode === "completed-session-detail" && pageData.completedSession) {
    return renderCompletedSessionDetailPane(pageData.completedSession);
  }
  const selectedSession = getSelectedSession(pageData);
  return selectedSession ? renderSelectedSessionPane(pageData, selectedSession, pageData.runtimeSnapshot) : renderNewSessionPane(pageData);
}

function renderAppScript(pageData: AtlasPageData): string {
  return `<script type="application/json" id="atlas-page-data">${serializeForInlineJson(pageData)}</script>
<script>
(() => {
  const pageDataElement = document.getElementById("atlas-page-data");
  if (!pageDataElement) return;

  ${resolvePreferredAtlasSessionId.toString()}

  const state = JSON.parse(pageDataElement.textContent || "{}");
  let selectedBuildAgentId = null;
  let selectedBuildAgentPinned = false;
  let runtimePollHandle = null;
  let runtimeLogPollHandle = null;
  let activeRuntimeLogSessionId = null;
  let runtimeLogAutoFollow = true;
  let pendingNewProjectRequest = null;
  const themeStorageKey = ${JSON.stringify(ATLAS_THEME_STORAGE_KEY)};
  const languageStorageKey = ${JSON.stringify(ATLAS_LANGUAGE_STORAGE_KEY)};
  const themeOptions = ${serializeForInlineJson(ATLAS_THEME_OPTIONS)};
  const languageOptions = ${serializeForInlineJson(ATLAS_LANGUAGE_OPTIONS)};
  const uiCopy = {
    en: {
      settingsEyebrow: 'Settings',
      settingsTitle: 'Workspace settings',
      settingsMenuTitle: 'Workspace settings',
      settingsMenuSummary: 'Choose the theme and interface language for the full desktop shell.',
      settingsThemeSection: 'Theme',
      settingsThemeSummary: 'Applied across the whole GUI, including tracked sessions.',
      settingsLanguageSection: 'Language',
      settingsLanguageSummary: 'Switch the ATLAS interface between English and Turkish.',
      sidebarNewSession: 'New Session',
      sidebarCompletedSessions: 'Completed Sessions',
      sidebarLiveRows: 'Live Rows',
      sidebarEmptyTitle: 'No live rows yet.',
      sidebarEmptyBody: 'Start the first session from the composer on the right.',
      newSessionHeading: 'What do you want Atlas to deliver today?',
      trackedSessionEyebrow: 'Tracked session',
      statusPrepared: 'Prepared',
      statusOnboarding: 'Onboarding',
      statusActive: 'Active',
      statusStopped: 'Stopped',
      statusLoading: 'Loading',
      statusComplete: 'Complete',
      statusAttention: 'Needs attention',
      repoModeNew: 'New project onboarding',
      repoModeExisting: 'Existing project onboarding',
      repoCreated: 'Atlas-created repo',
      changeProject: 'Change project',
      useFreshRepoNext: 'Use fresh repo next',
      inlineProjectDefault: 'I have a project',
      inlineProjectUsingPrefix: 'Using ',
      inlineProjectUsingSuffix: ' for the next request. Click the button if you want to change it.',
      inlineProjectFreshPrefix: 'New repo: ',
      inlineProjectFreshSuffix: 'Fresh repo mode is armed. Atlas will create a new GitHub repository after you send the first request.',
      inlineProjectHelp: 'Choose an existing project here, or use fresh repo in the picker and save the new project name and description before Atlas creates a new GitHub repository.',
      introSelectedPrefix: 'Selected project: ',
      introSelectedSuffix: ' Your next message will start from that repository.',
      introFreshPrefix: 'Fresh repo ready: ',
      introFreshSuffix: ' Atlas will create a new GitHub repository from these saved project details when you send the first request.',
      introDefault: 'Write one concrete request. If you do not pick an existing project first, Atlas will ask for a new project name and description before it creates the repository.',
      placeholderSession: 'What do you want to create?',
      placeholderNewProject: 'Describe the new project you want Atlas to create',
      placeholderExistingPrefix: 'What should Atlas change in ',
      placeholderBuildPrefix: 'What should Atlas build in ',
      globalStatusReady: 'Message box ready.',
      newSessionTransitionHeading: 'Atlas is opening a fresh workspace',
      newSessionTransitionDetail: 'Live rows stay pinned on the left while Atlas reloads the new-session surface.',
      newSessionTransitionStatus: 'Atlas is returning to the fresh workspace. Live rows stay pinned on the left rail.',
      youLabel: 'You',
      atlasLabel: 'Atlas',
      attachedFiles: 'Attached files',
      repoListEmpty: 'No GitHub repositories matched this search.',
      repoExisting: 'Existing repo',
      repoNew: 'New repo',
      repoExistingDescription: 'Atlas will use existing-project onboarding for this repo.',
      repoNewDescription: 'Atlas will treat this repo as a fresh-project starting point.',
      repoSelectedPrefix: 'Selected ',
      repoSelectedSuffix: ' for existing-project onboarding.',
      repoClearStatus: 'Fresh repo mode is armed. Save the project name and description, then send the first request. Atlas will create the new GitHub repository for you.',
      notConnectedLabel: 'Not connected',
      githubAccessLabel: 'GitHub access',
      githubSignInRequired: 'GitHub sign-in required',
      connectedAsPrefix: 'Connected as',
      refreshLabel: 'Refresh',
      updateAccessLabel: 'Update access',
      connectLabel: 'Connect',
      requiredLabel: 'Required',
      unavailableLabel: 'Unavailable',
      accountStatLabel: 'Account',
      remainingStatLabel: 'Remaining',
      usedStatLabel: 'Used',
      planStatLabel: 'Plan',
      pendingLabel: 'Pending',
      githubUsageNoQuotaData: 'Atlas is connected, but Copilot quota data is not available for this token yet.',
      githubUsageConnectFirst: 'Connect GitHub before Atlas can list repositories or choose the correct Copilot model pool.',
      desktopContinuityLabel: 'Desktop continuity',
      desktopContinuityMonitoring: 'Monitoring live build',
      continuityFirstLiveRow: 'Your next request becomes the first live row in this shell.',
      continuityPinnedSessions: 'Tracked sessions stay pinned here so you can resume them from the left rail.',
      liveSessionsSuffix: 'live sessions',
      projectDetailsCreateRepoPrompt: 'Write the project name and description Atlas should use when creating the new GitHub repository.',
      projectDetailsSavePrompt: 'Save the project name and description Atlas should use the next time it creates a new GitHub repository.',
      createProjectRepo: 'Create project repo',
      saveProjectDetails: 'Save project details',
      missionControls: 'Mission controls',
      buildPausedHelp: "This session's build is paused. Resume will re-inject the same mission brief into BOX.",
      buildActiveHelp: 'These controls affect only the live build mission owned by this selected session.',
      buildResumeHelp: 'Resume promotes this ready session into the live build mission without disturbing the other tracked sessions in the rail.',
      logsLabel: 'Logs',
      resumeLabel: 'Resume',
      resumePendingLabel: 'Resuming...',
      stopLabel: 'Stop',
      stopPendingLabel: 'Stopping...',
      deleteProjectLabel: 'Delete this project',
      deleteProjectConfirm: 'Are you sure you want to delete this project from ATLAS?',
      deleteProjectFeedback: 'Deleting this project from ATLAS...',
      deleteProjectDone: 'Project deleted from ATLAS.',
      rawLogsEyebrow: 'Raw logs',
      runtimeLogsTitle: 'Runtime logs',
      runtimeLogsHint: 'Select Logs to load the matched session progress log for this session.',
      closeLabel: 'Close',
      runtimeLogsEmpty: 'ATLAS will show the newest raw runtime logs for this build mission here.',
      pipelineLabel: 'Pipeline',
      waitingForRuntime: 'Waiting for runtime',
      loopsLabel: 'Loops',
      sessionPremiumLabel: 'Session premium',
      queuedLabel: 'Queued',
      runningLabel: 'Running',
      pausedLabel: 'Paused',
      completedLabel: 'Completed',
      errorLabel: 'Error',
      waitingForLiveBuildMission: 'Waiting for live build mission',
      nextReadyBuildMission: 'ATLAS will stream the next ready build mission here.',
      runtimePreparing: 'ATLAS is preparing the live runtime bridge for this session.',
      runtimeAwaiting: 'ATLAS will stream the live build flow here as soon as the runtime responds.',
      readableDetailLabel: 'Readable detail',
      selectAgentLabel: 'Select an agent',
      selectAgentHelp: "The build surface stays minimal until you pick an agent card. Then the right panel turns into that agent's readable detail view.",
      waitingForLiveRuntime: 'Waiting for live runtime',
      waitingForLiveRuntimeHelp: 'ATLAS will render the build agents here as soon as the runtime acknowledges the mission.',
      runtimeLogLabel: 'Runtime log',
      stateLogLabel: 'state log',
      noRawLogOutputYet: 'No raw log output is available yet.',
      collectingRawLogs: 'ATLAS is collecting the matched raw session log for the selected session.',
      loadingRawLogs: 'Loading raw logs...',
      runtimeLogsSuffix: ' raw logs',
      desktopSessionLabel: 'Desktop session',
      buildSessionLabel: 'Build session',
      sourceLabel: 'Source',
      rawLogSourceLabel: 'raw log',
      unknownLabel: 'unknown',
      runtimeLogsMissing: 'ATLAS does not have raw runtime logs for this build mission yet.',
      noRuntimeLogsYet: 'No raw runtime logs are available for this mission yet.',
      runtimeLogsLoadError: 'ATLAS could not load the raw runtime logs.',
      resumeBuildFeedback: 'ATLAS is re-injecting this session brief into the live build runtime.',
      stopBuildFeedback: 'ATLAS is pausing this session build mission.',
    },
    tr: {
      settingsEyebrow: 'Ayarlar',
      settingsTitle: 'Çalışma alanı ayarları',
      settingsMenuTitle: 'Çalışma alanı ayarları',
      settingsMenuSummary: 'Tüm masaüstü kabuğu için tema ve arayüz dilini seçin.',
      settingsThemeSection: 'Tema',
      settingsThemeSummary: 'İzlenen oturumlar dahil tüm arayüze uygulanır.',
      settingsLanguageSection: 'Dil',
      settingsLanguageSummary: 'ATLAS arayüzünü Türkçe ve İngilizce arasında değiştirin.',
      sidebarNewSession: 'Yeni Oturum',
      sidebarCompletedSessions: 'Tamamlanan Oturumlar',
      sidebarLiveRows: 'Canlı Satırlar',
      sidebarEmptyTitle: 'Henüz canlı satır yok.',
      sidebarEmptyBody: 'İlk oturumu sağdaki yazma kutusundan başlatın.',
      newSessionHeading: 'Atlas bugün ne teslim etsin?',
      trackedSessionEyebrow: 'İzlenen oturum',
      statusPrepared: 'Hazır',
      statusOnboarding: 'Onboarding',
      statusActive: 'Aktif',
      statusStopped: 'Stopped',
      statusLoading: 'Yükleniyor',
      statusComplete: 'Tamamlandı',
      statusAttention: 'Dikkat gerekiyor',
      repoModeNew: 'Yeni proje kurulumu',
      repoModeExisting: 'Mevcut proje kurulumu',
      repoCreated: 'Atlas oluşturdu',
      changeProject: 'Projeyi değiştir',
      useFreshRepoNext: 'Sonraki istekte yeni repo kullan',
      inlineProjectDefault: 'Bir projem var',
      inlineProjectUsingPrefix: 'Sonraki istek için ',
      inlineProjectUsingSuffix: ' kullanılıyor. Değiştirmek için düğmeye basın.',
      inlineProjectFreshPrefix: 'Yeni repo: ',
      inlineProjectFreshSuffix: ' Yeni repo modu hazır. İlk isteği gönderince Atlas GitHub deposunu oluşturacak.',
      inlineProjectHelp: 'Buradan mevcut bir proje seçin ya da seçicide yeni repo modunu kullanıp proje adını ve açıklamasını kaydedin.',
      introSelectedPrefix: 'Seçilen proje: ',
      introSelectedSuffix: ' Sonraki mesaj bu depoyla başlayacak.',
      introFreshPrefix: 'Yeni repo hazır: ',
      introFreshSuffix: ' Atlas ilk istekte bu kayıtlı proje bilgileriyle GitHub deposunu oluşturacak.',
      introDefault: 'Tek ve net bir istek yazın. Önce mevcut bir proje seçmezseniz Atlas, repo oluşturmadan önce proje adını ve açıklamasını ister.',
      placeholderSession: 'Ne oluşturmak istiyorsun?',
      placeholderNewProject: 'Atlas için oluşturulacak yeni projeyi tarif edin',
      placeholderExistingPrefix: 'Atlas ',
      placeholderBuildPrefix: 'Atlas ',
      globalStatusReady: 'Mesaj kutusu hazır.',
      newSessionTransitionHeading: 'Atlas yeni bir çalışma alanı açıyor',
      newSessionTransitionDetail: 'Atlas yeni oturum yüzeyini yeniden yüklerken canlı satırlar solda sabit kalır.',
      newSessionTransitionStatus: 'Atlas yeni çalışma alanına dönüyor. Canlı satırlar soldaki rayda sabit kalır.',
      youLabel: 'Sen',
      atlasLabel: 'Atlas',
      attachedFiles: 'Eklenen dosyalar',
      repoListEmpty: 'Bu aramayla eşleşen GitHub deposu bulunamadı.',
      repoExisting: 'Mevcut repo',
      repoNew: 'Yeni repo',
      repoExistingDescription: 'Atlas bu depo için mevcut proje kurulumunu kullanacak.',
      repoNewDescription: 'Atlas bu depoyu yeni proje başlangıcı olarak ele alacak.',
      repoSelectedPrefix: '',
      repoSelectedSuffix: ' mevcut proje kurulumu için seçildi.',
      repoClearStatus: 'Yeni repo modu hazır. Proje adını ve açıklamasını kaydedip ilk isteği gönderin. Atlas yeni GitHub deposunu sizin için oluşturacak.',
      notConnectedLabel: 'Bağlı değil',
      githubAccessLabel: 'GitHub erişimi',
      githubSignInRequired: 'GitHub oturumu gerekli',
      connectedAsPrefix: 'Bağlı hesap',
      refreshLabel: 'Yenile',
      updateAccessLabel: 'Erişimi güncelle',
      connectLabel: 'Bağlan',
      requiredLabel: 'Gerekli',
      unavailableLabel: 'Kullanılamıyor',
      accountStatLabel: 'Hesap',
      remainingStatLabel: 'Kalan',
      usedStatLabel: 'Kullanılan',
      planStatLabel: 'Plan',
      pendingLabel: 'Bekleniyor',
      githubUsageNoQuotaData: 'Atlas bağlı, ancak bu belirteç için Copilot kota verisi henüz kullanılamıyor.',
      githubUsageConnectFirst: 'Atlas depoları listeleyip doğru Copilot model havuzunu seçmeden önce GitHub bağlantısını kurun.',
      desktopContinuityLabel: 'Masaüstü sürekliliği',
      desktopContinuityMonitoring: 'Canlı derleme izleniyor',
      continuityFirstLiveRow: 'Bir sonraki isteğiniz bu kabuktaki ilk canlı satıra dönüşecek.',
      continuityPinnedSessions: 'İzlenen oturumlar burada sabit kalır; böylece soldaki raydan devam edebilirsiniz.',
      liveSessionsSuffix: 'canlı oturum',
      projectDetailsCreateRepoPrompt: 'Atlas yeni GitHub deposunu oluştururken kullanacağı proje adını ve açıklamayı yazın.',
      projectDetailsSavePrompt: 'Atlas bir sonraki yeni GitHub deposunu oluştururken kullanacağı proje adını ve açıklamayı kaydedin.',
      createProjectRepo: 'Proje reposunu oluştur',
      saveProjectDetails: 'Proje ayrıntılarını kaydet',
      missionControls: 'Görev denetimleri',
      buildPausedHelp: 'Bu oturumun derlemesi duraklatıldı. Devam et, aynı görev özetini BOX içine yeniden enjekte eder.',
      buildActiveHelp: 'Bu denetimler yalnızca seçili oturumun sahip olduğu canlı derleme görevini etkiler.',
      buildResumeHelp: 'Devam et, bu hazır oturumu soldaki diğer izlenen oturumları bozmadan canlı derleme görevine taşır.',
      logsLabel: 'Loglar',
      resumeLabel: 'Devam et',
      resumePendingLabel: 'Devam ediliyor...',
      stopLabel: 'Durdur',
      stopPendingLabel: 'Durduruluyor...',
      deleteProjectLabel: 'Delete this project',
      deleteProjectConfirm: 'Bu projeyi ATLAS içinden silmek istediğinizden emin misiniz?',
      deleteProjectFeedback: 'Bu proje ATLAS içinden siliniyor...',
      deleteProjectDone: 'Proje ATLAS içinden silindi.',
      rawLogsEyebrow: 'Ham loglar',
      runtimeLogsTitle: 'Çalışma zamanı logları',
      runtimeLogsHint: 'Bu oturumun eşleşen ilerleme logunu yüklemek için Loglar düğmesine basın.',
      closeLabel: 'Kapat',
      runtimeLogsEmpty: 'ATLAS bu derleme görevi için en yeni ham çalışma zamanı loglarını burada gösterecek.',
      pipelineLabel: 'Akış',
      waitingForRuntime: 'Çalışma zamanı bekleniyor',
      loopsLabel: 'Döngüler',
      sessionPremiumLabel: 'Oturum premium',
      queuedLabel: 'Sırada',
      runningLabel: 'Çalışıyor',
      pausedLabel: 'Duraklatıldı',
      completedLabel: 'Tamamlandı',
      errorLabel: 'Hata',
      waitingForLiveBuildMission: 'Canlı derleme görevi bekleniyor',
      nextReadyBuildMission: 'ATLAS sıradaki hazır derleme görevini burada gösterecek.',
      runtimePreparing: 'ATLAS bu oturum için canlı çalışma zamanı köprüsünü hazırlıyor.',
      runtimeAwaiting: 'Çalışma zamanı yanıt verir vermez ATLAS canlı derleme akışını burada gösterecek.',
      readableDetailLabel: 'Okunabilir ayrıntı',
      selectAgentLabel: 'Bir ajan seçin',
      selectAgentHelp: 'Derleme yüzeyi siz soldan bir ajan kartı seçene kadar sade kalır. Sonra sağ panel o ajanın okunabilir ayrıntı görünümüne dönüşür.',
      waitingForLiveRuntime: 'Canlı çalışma zamanı bekleniyor',
      waitingForLiveRuntimeHelp: 'ATLAS çalışma zamanı görevi onaylar onaylamaz derleme ajanlarını burada gösterecek.',
      runtimeLogLabel: 'Çalışma zamanı logu',
      stateLogLabel: 'durum logu',
      noRawLogOutputYet: 'Henüz ham log çıktısı yok.',
      collectingRawLogs: 'ATLAS seçili oturum için eşleşen ham oturum logunu topluyor.',
      loadingRawLogs: 'Ham loglar yükleniyor...',
      runtimeLogsSuffix: ' ham logları',
      desktopSessionLabel: 'Masaüstü oturumu',
      buildSessionLabel: 'Derleme oturumu',
      sourceLabel: 'Kaynak',
      rawLogSourceLabel: 'ham log',
      unknownLabel: 'bilinmiyor',
      runtimeLogsMissing: 'ATLAS bu derleme görevi için henüz ham çalışma zamanı logu bulamadı.',
      noRuntimeLogsYet: 'Bu görev için henüz ham çalışma zamanı logu yok.',
      runtimeLogsLoadError: 'ATLAS ham çalışma zamanı loglarını yükleyemedi.',
      resumeBuildFeedback: 'ATLAS bu oturum özetini canlı derleme çalışma zamanına yeniden enjekte ediyor.',
      stopBuildFeedback: 'ATLAS bu oturumun derleme görevini duraklatıyor.',
    },
  };
  let currentLanguageId = ${JSON.stringify(ATLAS_DEFAULT_LANGUAGE)};
  let syncLocalizedUi = () => {};
  state.availableRepositories = Array.isArray(state.availableRepositories) ? state.availableRepositories : [];
  state.pendingProjectDetails = state.pendingProjectDetails && typeof state.pendingProjectDetails === 'object'
    ? state.pendingProjectDetails
    : null;
  state.githubAuth = state.githubAuth || { accountLogin: null, githubTokenConfigured: false, copilotTokenConfigured: false, authRequired: true, source: 'none' };
  state.copilotUsage = state.copilotUsage || null;
  state.authRequired = Boolean(state.authRequired);
  state.selectedCopilotModel = state.selectedCopilotModel || null;
  const selectedCopilotModelStorageKey = ${JSON.stringify(ATLAS_SELECTED_MODEL_STORAGE_KEY)};
  const planModelPools = ${serializeForInlineJson({
    free: FREE_PLAN_ALLOWED_MODELS,
    pro: PRO_PLAN_ALLOWED_MODELS,
    pro_plus: PRO_PLUS_ALLOWED_MODELS,
  })};

  const escapeClientHtml = (value) => String(value ?? "")
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const getLanguageOptionById = (languageId) => {
    return languageOptions.find((option) => option && option.id === languageId) || languageOptions[0] || null;
  };

  const getIntlLocale = () => currentLanguageId === 'tr' ? 'tr-TR' : 'en-US';

  const t = (key) => {
    const languagePack = uiCopy[currentLanguageId] || uiCopy.en;
    if (languagePack && Object.prototype.hasOwnProperty.call(languagePack, key)) {
      return languagePack[key];
    }
    return uiCopy.en[key] || key;
  };

  const localizeRequestStateLabel = (label, state) => {
    const normalizedState = String(state || '').trim().toLowerCase();
    if (normalizedState === 'queued') {
      return t('queuedLabel');
    }
    if (normalizedState === 'running') {
      return t('runningLabel');
    }
    if (normalizedState === 'paused') {
      return t('pausedLabel');
    }
    if (normalizedState === 'completed') {
      return t('completedLabel');
    }
    if (normalizedState === 'error') {
      return t('errorLabel');
    }
    return label || t('queuedLabel');
  };

  const syncStaticTranslations = () => {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const key = node.getAttribute('data-i18n');
      if (!key) {
        return;
      }
      node.textContent = t(key);
    });
  };

  const formatBytes = (value) => {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = numericValue;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const rounded = size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1);
    return rounded + ' ' + units[unitIndex];
  };

  const formatTimestamp = (value) => {
    if (!value) {
      return 'Waiting for the next live update';
    }
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      return 'Waiting for the next live update';
    }
    return new Intl.DateTimeFormat(getIntlLocale(), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

  const formatCount = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 'Unknown';
    }
    return new Intl.NumberFormat(getIntlLocale()).format(numericValue);
  };

  const formatQuotaCount = (value, minimum = 0) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 'Unknown';
    }
    return new Intl.NumberFormat(getIntlLocale()).format(Math.max(Math.round(numericValue), minimum));
  };

  const clampPercent = (value) => {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(numericValue)));
  };

  const getStatusLabel = (status) => status === 'ready' ? t('statusStopped') : t('statusOnboarding');

  const getSessionRuntimeStatus = (session) => {
    const sessionId = String(session && session.id ? session.id : '').trim();
    const statuses = state.sessionRuntimeStatuses && typeof state.sessionRuntimeStatuses === 'object'
      ? state.sessionRuntimeStatuses
      : {};
    const runtimeStatus = sessionId ? statuses[sessionId] : null;
    if (runtimeStatus && runtimeStatus.label && runtimeStatus.tone) {
      const localizedLabel = runtimeStatus.state === 'active'
        ? t('statusActive')
        : runtimeStatus.state === 'stopped'
          ? t('statusStopped')
          : runtimeStatus.state === 'complete'
            ? t('statusComplete')
            : runtimeStatus.state === 'attention'
              ? t('statusAttention')
              : runtimeStatus.state === 'onboarding'
                ? t('statusOnboarding')
                : runtimeStatus.label;
      return { ...runtimeStatus, label: localizedLabel };
    }
    return session && session.status === 'ready'
      ? { state: 'stopped', label: t('statusStopped'), tone: 'idle' }
      : { state: 'onboarding', label: t('statusOnboarding'), tone: 'idle' };
  };

  const countRuntimeActiveSessions = () => {
    const statuses = state.sessionRuntimeStatuses && typeof state.sessionRuntimeStatuses === 'object'
      ? Object.values(state.sessionRuntimeStatuses)
      : [];
    return statuses.filter((entry) => entry && entry.state === 'active').length;
  };

  const deriveRuntimeStatusFromSnapshot = (session, snapshot) => {
    if (!session || session.status !== 'ready') {
      return { state: 'onboarding', label: t('statusOnboarding'), tone: 'idle' };
    }
    const canonicalStages = state.canonicalSessionStages && typeof state.canonicalSessionStages === 'object'
      ? state.canonicalSessionStages
      : {};
    const canonicalStage = String(canonicalStages[session.id] || '').trim().toLowerCase();
    if (!snapshot) {
      return canonicalStage === 'active'
        ? { state: 'active', label: t('statusActive'), tone: 'active' }
        : { state: 'stopped', label: t('statusStopped'), tone: 'idle' };
    }
    const requestState = String(snapshot.request && snapshot.request.state ? snapshot.request.state : 'queued');
    const stage = String(snapshot.pipeline && snapshot.pipeline.stage ? snapshot.pipeline.stage : 'idle');
    if (requestState === 'error') {
      return { state: 'attention', label: t('statusAttention'), tone: 'attention' };
    }
    if (requestState === 'completed' || stage === 'cycle_complete') {
      return { state: 'complete', label: t('statusComplete'), tone: 'complete' };
    }
    if (requestState === 'running' || canonicalStage === 'active') {
      return { state: 'active', label: t('statusActive'), tone: 'active' };
    }
    return { state: 'stopped', label: t('statusStopped'), tone: 'idle' };
  };

  const syncActiveSessionCounter = () => {
    state.activeSessionCount = countRuntimeActiveSessions();
    const maxTrackedSessions = Number(state.maxTrackedSessions || 0);
    const newSessionButton = document.querySelector('.sidebar-new-session');
    if (newSessionButton instanceof HTMLButtonElement) {
      newSessionButton.disabled = state.activeSessionCount >= maxTrackedSessions;
      const countElement = newSessionButton.querySelector('span');
      if (countElement instanceof HTMLElement) {
        countElement.textContent = state.activeSessionCount + '/' + maxTrackedSessions;
      }
    }
    const continuityHost = document.querySelector('[data-role="continuity-card-host"]');
    if (continuityHost instanceof HTMLElement) {
      continuityHost.innerHTML = renderContinuityCardHtml(true);
    }
  };

  const getRepoModeLabel = (repoContext) => {
    if (!repoContext) {
      return t('repoModeNew');
    }
    return repoContext.repoMode === 'existing' ? t('repoModeExisting') : t('repoModeNew');
  };

  const getRepoContextSummary = (repoContext) => {
    if (!repoContext || !repoContext.targetRepo) {
      return '';
    }
    return repoContext.targetRepo + ' • ' + (repoContext.repoCreatedByAtlas ? t('repoCreated') : getRepoModeLabel(repoContext));
  };

  const getRepoDisplayName = (repoContext) => {
    const targetRepo = String(repoContext && repoContext.targetRepo ? repoContext.targetRepo : '').trim();
    if (!targetRepo) {
      return null;
    }
    const normalized = targetRepo
      .replace(/^https?:\\/\\/github\\.com\\//i, '')
      .replace(/\\.git$/i, '');
    const parts = normalized.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : normalized;
  };

  const getSessionDisplayTitle = (session) => {
    return String(
      getRepoDisplayName(session && session.repoContext ? session.repoContext : null)
      || (session && session.projectName ? session.projectName : '')
      || (session && session.title ? session.title : '')
      || 'Tracked session'
    ).trim();
  };

  const getSessionRailDescription = (session) => {
    return String(session && (session.projectDescription || session.summary || session.objective) ? (session.projectDescription || session.summary || session.objective) : '');
  };

  const getPreparedProjectDetails = () => {
    if (!state.pendingProjectDetails || typeof state.pendingProjectDetails !== 'object') {
      return null;
    }
    const projectName = String(state.pendingProjectDetails.projectName || '').trim();
    const projectDescription = String(state.pendingProjectDetails.projectDescription || '').trim();
    if (!projectName || !projectDescription) {
      return null;
    }
    return { projectName, projectDescription };
  };

  const getNewSessionIntroCopy = (repoContext, pendingProjectDetails) => {
    if (repoContext && repoContext.targetRepo) {
      return t('introSelectedPrefix') + repoContext.targetRepo + t('introSelectedSuffix');
    }
    if (pendingProjectDetails && pendingProjectDetails.projectName) {
      return t('introFreshPrefix') + pendingProjectDetails.projectName + t('introFreshSuffix');
    }
    return t('introDefault');
  };

  const getComposerPlaceholder = (repoContext, hasSessionId) => {
    if (hasSessionId) {
      return t('placeholderSession');
    }
    if (!repoContext || !repoContext.targetRepo) {
      return t('placeholderNewProject');
    }
    if (currentLanguageId === 'tr') {
      return repoContext.repoMode === 'existing'
        ? repoContext.targetRepo + ' için Atlas neyi değiştirsin?'
        : repoContext.targetRepo + ' için Atlas ne inşa etsin?';
    }
    return repoContext.repoMode === 'existing'
      ? t('placeholderExistingPrefix') + repoContext.targetRepo + '?'
      : t('placeholderBuildPrefix') + repoContext.targetRepo + '?';
  };

  const canonicalizeClientModelName = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

  const getPlanModelOptionsForUsage = (usage) => {
    const planTier = String(usage && usage.planTier ? usage.planTier : '').trim();
    const rawModels = planTier === 'free'
      ? planModelPools.free
      : planTier === 'pro' || planTier === 'student'
        ? planModelPools.pro
        : planTier === 'pro_plus' || planTier === 'business' || planTier === 'enterprise'
          ? planModelPools.pro_plus
          : [];
    const resolved = [];
    rawModels.forEach((model) => {
      const normalizedModel = String(model || '').trim();
      if (!normalizedModel || resolved.some((entry) => canonicalizeClientModelName(entry) === canonicalizeClientModelName(normalizedModel))) {
        return;
      }
      resolved.push(normalizedModel);
    });
    return resolved;
  };

  const resolveAllowedModelForUsage = (candidate, usage) => {
    const normalizedCandidate = String(candidate || '').trim();
    if (!normalizedCandidate) {
      return null;
    }
    return getPlanModelOptionsForUsage(usage).find((model) => canonicalizeClientModelName(model) === canonicalizeClientModelName(normalizedCandidate)) || null;
  };

  const getPlanDefaultSingleModelForUsage = (usage) => {
    const options = getPlanModelOptionsForUsage(usage);
    const planTier = String(usage && usage.planTier ? usage.planTier : '').trim();
    if (planTier === 'free') {
      return resolveAllowedModelForUsage('GPT-5 mini', usage) || options[0] || null;
    }
    if (planTier === 'pro' || planTier === 'student') {
      return resolveAllowedModelForUsage('GPT-5.3-codex', usage)
        || resolveAllowedModelForUsage('GPT-5.2 Codex', usage)
        || options[0]
        || null;
    }
    return null;
  };

  const getModelPickerDefaultStateForUsage = (usage) => {
    const currentSelectionMode = usage && usage.currentSelectionMode ? usage.currentSelectionMode : null;
    const currentSelectionSource = usage && usage.currentSelectionSource ? usage.currentSelectionSource : null;
    const currentSelectionModel = usage && usage.currentSelectionModel ? usage.currentSelectionModel : null;
    const defaultSingleModel = getPlanDefaultSingleModelForUsage(usage);

    if (currentSelectionMode === 'schema' || currentSelectionSource === 'custom_schema') {
      const isCustomSchema = currentSelectionSource === 'custom_schema';
      return {
        label: isCustomSchema ? 'Use current custom schema' : 'Use current agent schema',
        description: isCustomSchema
          ? 'Keep each agent on its current configured custom model schema.'
          : 'Keep each agent on its current configured model schema.',
        accentLabel: isCustomSchema ? 'Custom' : 'Current',
        inlineNote: isCustomSchema
          ? 'Default: keep the current custom per-agent schema unless you choose one model.'
          : 'Default: keep the current per-agent schema unless you choose one model.',
        statusCopy: isCustomSchema
          ? 'Choose one model to replace every agent model in the next new session. Without an override, Atlas keeps the current custom per-agent schema.'
          : 'Choose one model to replace every agent model in the next new session. Without an override, Atlas keeps the current per-agent schema.',
      };
    }

    if (currentSelectionSource === 'session_selection' && currentSelectionModel) {
      return {
        label: 'Use saved selection (' + currentSelectionModel + ')',
        description: currentSelectionModel + ' remains the single model for all agents until you change it.',
        accentLabel: 'Saved',
        inlineNote: 'Default: ' + currentSelectionModel + ' for all agents on this setup.',
        statusCopy: 'Choose one model to replace every agent model in the next new session. Atlas is currently set to ' + currentSelectionModel + ' for all agents.',
      };
    }

    if (defaultSingleModel) {
      return {
        label: 'Use plan default (' + defaultSingleModel + ')',
        description: defaultSingleModel + ' becomes the single model for all agents.',
        accentLabel: 'Default',
        inlineNote: 'Default: ' + defaultSingleModel + ' for all agents on this plan.',
        statusCopy: 'Choose one model to replace every agent model in the next new session. Without an override, Atlas defaults to ' + defaultSingleModel + '.',
      };
    }

    return {
      label: 'Use current agent schema',
      description: 'Keep each agent on its current configured model.',
      accentLabel: 'Current',
      inlineNote: 'Default: keep the current per-agent schema unless you choose one model.',
      statusCopy: 'Choose one model to replace every agent model in the next new session. Without an override, Atlas keeps the current per-agent schema.',
    };
  };

  const readStoredSelectedCopilotModel = () => {
    try {
      return String(window.localStorage.getItem(selectedCopilotModelStorageKey) || '').trim() || null;
    } catch {
      return null;
    }
  };

  const writeStoredSelectedCopilotModel = (modelName) => {
    try {
      if (modelName) {
        window.localStorage.setItem(selectedCopilotModelStorageKey, modelName);
      } else {
        window.localStorage.removeItem(selectedCopilotModelStorageKey);
      }
    } catch {
    }
  };

  const syncSelectedCopilotModel = () => {
    if (!state.copilotUsage) {
      state.selectedCopilotModel = String(state.selectedCopilotModel || '').trim() || null;
      return state.selectedCopilotModel;
    }
    const resolvedModel = resolveAllowedModelForUsage(state.selectedCopilotModel, state.copilotUsage);
    state.selectedCopilotModel = resolvedModel || null;
    if (!resolvedModel) {
      writeStoredSelectedCopilotModel(null);
    }
    return state.selectedCopilotModel;
  };

  const getSelectedCopilotModel = () => syncSelectedCopilotModel();

  const getInlineModelPickerNote = () => {
    const selectedModel = getSelectedCopilotModel();
    if (selectedModel) {
      return selectedModel + ' will be used across all agents in the next new session.';
    }
    if (state.authRequired || !state.copilotUsage) {
      return 'Connect GitHub to load plan-specific model choices.';
    }
    return getModelPickerDefaultStateForUsage(state.copilotUsage).inlineNote;
  };

  const getModelPickerStatusText = () => {
    const selectedModel = getSelectedCopilotModel();
    if (selectedModel) {
      return 'Selected model: ' + selectedModel + '. Atlas will replace every agent model with this choice for the next new session.';
    }
    if (state.authRequired || !state.copilotUsage) {
      return 'Connect GitHub so Atlas can show the model list for your current Copilot plan.';
    }
    return getModelPickerDefaultStateForUsage(state.copilotUsage).statusCopy;
  };

  const renderModelPickerOptionsHtml = () => {
    const options = getPlanModelOptionsForUsage(state.copilotUsage);
    const selectedModel = getSelectedCopilotModel();
    const defaultState = getModelPickerDefaultStateForUsage(state.copilotUsage);

    const renderOption = (modelValue, title, description, accentLabel, isActive) => {
      return '<button class="repo-picker-item model-picker-option' + (isActive ? ' model-picker-option-active' : '') + '" type="button" data-role="model-option-button" data-model-value="' + escapeClientHtml(modelValue) + '">'
        + '<div class="repo-picker-item-topline"><strong>' + escapeClientHtml(title) + '</strong><span class="chip">' + escapeClientHtml(accentLabel) + '</span></div>'
        + '<p class="support-copy repo-picker-description">' + escapeClientHtml(description) + '</p>'
        + '</button>';
    };

    if (!options.length) {
      return '<div class="runtime-log-empty">' + escapeClientHtml(state.authRequired ? 'Connect GitHub to see plan-specific model choices.' : 'No model choices are available for this plan yet.') + '</div>';
    }

    return [
      renderOption('', defaultState.label, defaultState.description, defaultState.accentLabel, !selectedModel),
      ...options.map((model) => renderOption(
        model,
        model,
        model + ' will replace every agent model in the next new session.',
        'All agents',
        Boolean(selectedModel && canonicalizeClientModelName(selectedModel) === canonicalizeClientModelName(model)),
      )),
    ].join('');
  };

  const renderInlineProjectButtonHtml = (repoContext, pendingProjectDetails, modelSummary) => {
    const buttonLabel = repoContext && repoContext.targetRepo
      ? repoContext.targetRepo
      : (pendingProjectDetails && pendingProjectDetails.projectName
          ? t('inlineProjectFreshPrefix') + pendingProjectDetails.projectName
          : t('inlineProjectDefault'));
    const helperCopy = repoContext && repoContext.targetRepo
      ? t('inlineProjectUsingPrefix') + repoContext.targetRepo + t('inlineProjectUsingSuffix')
      : (pendingProjectDetails && pendingProjectDetails.projectName
          ? pendingProjectDetails.projectName + '. ' + t('inlineProjectFreshSuffix')
          : t('inlineProjectHelp'));

    return '<div class="composer-project-row-copy">'
      + '<div class="composer-project-action-row">'
      + '<button class="build-control-button build-control-button-secondary build-control-button-compact composer-project-button" type="button" data-role="repo-picker-open">' + escapeClientHtml(buttonLabel) + '</button>'
      + '<button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="model-picker-open">Choose model</button>'
      + '</div>'
      + '<p class="support-copy composer-project-note">' + escapeClientHtml(helperCopy) + '</p>'
      + '<p class="support-copy composer-project-note composer-model-note">' + escapeClientHtml(modelSummary || getInlineModelPickerNote()) + '</p>'
      + '</div>';
  };

  const renderRepoContextCardHtml = (repoContext) => {
    if (!repoContext || !repoContext.targetRepo) {
      return '<section class="repo-context-card" aria-label="Project context">'
        + '<div class="repo-context-copy">'
        + '<p class="eyebrow">Project context</p>'
        + '<strong class="repo-context-title">' + escapeClientHtml(t('inlineProjectDefault')) + '</strong>'
        + '<p class="support-copy">' + escapeClientHtml(t('inlineProjectHelp')) + '</p>'
        + '</div>'
        + '<div class="repo-context-actions">'
        + '<button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="repo-picker-open">' + escapeClientHtml(t('inlineProjectDefault')) + '</button>'
        + '</div>'
        + '</section>';
    }

    return '<section class="repo-context-card" aria-label="Project context">'
      + '<div class="repo-context-copy">'
      + '<p class="eyebrow">Project context</p>'
      + '<strong class="repo-context-title">' + escapeClientHtml(repoContext.targetRepo) + '</strong>'
      + '<p class="support-copy">' + escapeClientHtml(getRepoContextSummary(repoContext)) + '</p>'
      + '</div>'
      + '<div class="repo-context-actions">'
      + '<span class="chip">' + escapeClientHtml(getRepoModeLabel(repoContext)) + '</span>'
        + (repoContext.repoCreatedByAtlas ? '<span class="chip">' + escapeClientHtml(t('repoCreated')) + '</span>' : '')
        + '<button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="repo-picker-open">' + escapeClientHtml(t('changeProject')) + '</button>'
        + '<button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="repo-context-clear">' + escapeClientHtml(t('useFreshRepoNext')) + '</button>'
      + '</div>'
      + '</section>';
  };

  const renderCopilotUsageCardHtml = (auth, usage, compact = false) => {
    const accountLabel = auth && auth.accountLogin ? auth.accountLogin : t('notConnectedLabel');
    const authRequired = Boolean(auth && auth.authRequired);
    const heading = authRequired
      ? t('githubSignInRequired')
      : (usage && usage.planLabel ? usage.planLabel : t('connectedAsPrefix') + ' ' + accountLabel);
    const remainingCopy = usage ? formatQuotaCount(usage.remainingRequests) : (authRequired ? t('requiredLabel') : t('unavailableLabel'));
    const usageDetail = usage
      ? (compact
          ? (usage.modelAccess === 'free' ? 'Free-safe' : 'Current paid') + ' model pool'
          : 'Model pool: ' + (usage.modelAccess === 'free' ? 'Free-safe' : 'Current paid pool'))
      : (authRequired
          ? t('githubUsageConnectFirst')
          : t('githubUsageNoQuotaData'));
    const stats = compact
      ? [
          { label: t('accountStatLabel'), value: accountLabel },
          { label: t('remainingStatLabel'), value: remainingCopy },
        ]
      : [
          { label: t('accountStatLabel'), value: accountLabel },
          { label: t('remainingStatLabel'), value: remainingCopy },
          { label: t('usedStatLabel'), value: formatQuotaCount(usage ? usage.usedRequests : null) },
          { label: t('planStatLabel'), value: usage && usage.planLabel ? usage.planLabel : t('pendingLabel') },
        ];

    return '<section class="copilot-usage-card' + (compact ? ' copilot-usage-card-compact' : '') + '" aria-label="Copilot usage">'
      + '<div class="copilot-usage-topline">'
      + '<div>'
      + '<p class="eyebrow">' + escapeClientHtml(t('githubAccessLabel')) + '</p>'
      + '<strong class="copilot-usage-title">' + escapeClientHtml(heading) + '</strong>'
      + '</div>'
      + '<div class="copilot-usage-actions">'
      + '<button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="github-auth-refresh">' + escapeClientHtml(t('refreshLabel')) + '</button>'
      + '<button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="github-auth-open">' + escapeClientHtml(authRequired ? t('connectLabel') : t('updateAccessLabel')) + '</button>'
      + '</div>'
      + '</div>'
      + '<div class="copilot-usage-grid">'
        + stats.map((stat) => '<div class="copilot-usage-stat"><span class="copilot-usage-stat-label">' + escapeClientHtml(stat.label) + '</span><strong>' + escapeClientHtml(stat.value) + '</strong></div>').join('')
      + '</div>'
      + '<p class="support-copy copilot-usage-copy">' + escapeClientHtml(usageDetail) + '</p>'
      + '</section>';
  };

  const renderContinuityCardHtml = (compact = false) => {
    const activeSessionCount = Number(state.activeSessionCount || 0);
    const maxTrackedSessions = Number(state.maxTrackedSessions || 0);
    const detailCopy = compact
      ? (activeSessionCount === 0 ? t('continuityFirstLiveRow') : t('continuityPinnedSessions'))
      : (state.continuityStatusDetail || t('continuityPinnedSessions'));
    const metaCopy = compact ? '' : (state.sessionStartStatusDetail || '');
    const title = compact ? t('desktopContinuityMonitoring') : (state.continuityStatusLabel || t('desktopContinuityMonitoring'));

    return '<section class="workspace-note-card' + (compact ? ' workspace-note-card-compact' : '') + '" aria-label="Desktop continuity">'
      + '<p class="eyebrow">' + escapeClientHtml(t('desktopContinuityLabel')) + '</p>'
      + '<strong class="workspace-note-title">' + escapeClientHtml(title) + '</strong>'
      + '<p class="support-copy workspace-note-copy">' + escapeClientHtml(detailCopy) + '</p>'
      + '<div class="workspace-note-meta' + (compact ? ' workspace-note-meta-compact' : '') + '">'
      + '<span class="chip">' + escapeClientHtml(activeSessionCount + '/' + maxTrackedSessions + ' ' + t('liveSessionsSuffix')) + '</span>'
      + (metaCopy ? '<span class="support-copy">' + escapeClientHtml(metaCopy) + '</span>' : '')
      + '</div>'
      + '</section>';
  };

  const getThemeOptionById = (themeId) => {
    return themeOptions.find((option) => option && option.id === themeId) || themeOptions[0] || null;
  };

  const syncSettingsSummary = (themeId, languageId) => {
    const activeTheme = getThemeOptionById(themeId || ${JSON.stringify(ATLAS_DEFAULT_THEME)});
    const activeLanguage = getLanguageOptionById(languageId || ${JSON.stringify(ATLAS_DEFAULT_LANGUAGE)});
    const settingsSummary = document.querySelector('[data-role="settings-summary"]');
    const languageLabel = document.querySelector('[data-role="language-current-label"]');
    if (settingsSummary instanceof HTMLElement && activeTheme && activeLanguage) {
      settingsSummary.textContent = activeTheme.label + ' · ' + activeLanguage.nativeLabel;
    }
    if (languageLabel instanceof HTMLElement && activeLanguage) {
      languageLabel.textContent = activeLanguage.nativeLabel;
    }
  };

  const syncThemePicker = (themeId, languageId = currentLanguageId) => {
    const activeTheme = getThemeOptionById(themeId || ${JSON.stringify(ATLAS_DEFAULT_THEME)});
    if (!activeTheme) {
      return;
    }
    document.documentElement.dataset.theme = activeTheme.id;
    const trigger = document.querySelector('[data-role="theme-picker-toggle"]');
    if (trigger instanceof HTMLElement) {
      const preview = trigger.querySelector('.theme-preview');
      if (preview instanceof HTMLElement) {
        preview.outerHTML = '<span class="theme-preview" aria-hidden="true">'
          + activeTheme.swatch.map((color) => '<span class="theme-preview-swatch" style="background:' + escapeClientHtml(color) + '"></span>').join('')
          + '</span>';
      }
    }
    document.querySelectorAll('[data-role="theme-option"]').forEach((option) => {
      if (!(option instanceof HTMLElement)) {
        return;
      }
      const isActive = option.getAttribute('data-theme-id') === activeTheme.id;
      option.classList.toggle('theme-option-active', isActive);
      option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    syncSettingsSummary(activeTheme.id, languageId);
  };

  const syncLanguagePicker = (languageId) => {
    const activeLanguage = getLanguageOptionById(languageId || ${JSON.stringify(ATLAS_DEFAULT_LANGUAGE)});
    if (!activeLanguage) {
      return;
    }
    currentLanguageId = activeLanguage.id;
    document.documentElement.lang = activeLanguage.id === 'tr' ? 'tr' : 'en';
    document.querySelectorAll('[data-role="language-option"]').forEach((option) => {
      if (!(option instanceof HTMLElement)) {
        return;
      }
      const isActive = option.getAttribute('data-language-id') === activeLanguage.id;
      option.classList.toggle('theme-option-active', isActive);
      option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    syncSettingsSummary(document.documentElement.dataset.theme || ${JSON.stringify(ATLAS_DEFAULT_THEME)}, activeLanguage.id);
  };

  const closeThemePicker = () => {
    const menu = document.querySelector('[data-role="theme-picker-menu"]');
    const trigger = document.querySelector('[data-role="theme-picker-toggle"]');
    if (menu instanceof HTMLElement) {
      menu.hidden = true;
    }
    if (trigger instanceof HTMLElement) {
      trigger.setAttribute('aria-expanded', 'false');
    }
  };

  const toggleThemePicker = () => {
    const menu = document.querySelector('[data-role="theme-picker-menu"]');
    const trigger = document.querySelector('[data-role="theme-picker-toggle"]');
    if (!(menu instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
      return;
    }
    const nextExpanded = menu.hidden;
    menu.hidden = !nextExpanded;
    trigger.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
  };

  const applyTheme = (themeId) => {
    const activeTheme = getThemeOptionById(themeId);
    if (!activeTheme) {
      return;
    }
    syncThemePicker(activeTheme.id, currentLanguageId);
    try {
      window.localStorage.setItem(themeStorageKey, activeTheme.id);
    } catch {
    }
  };

  const applyLanguage = (languageId) => {
    const activeLanguage = getLanguageOptionById(languageId);
    if (!activeLanguage) {
      return;
    }
    syncLanguagePicker(activeLanguage.id);
    syncStaticTranslations();
    syncLocalizedUi();
    try {
      window.localStorage.setItem(languageStorageKey, activeLanguage.id);
    } catch {
    }
  };

  const renderRepositoryListHtml = (repositories, selectedRepoName) => {
    if (!Array.isArray(repositories) || !repositories.length) {
      return '<div class="runtime-log-empty">' + escapeClientHtml(t('repoListEmpty')) + '</div>';
    }

    return repositories.map((repo) => {
      const isSelected = repo && repo.fullName === selectedRepoName;
      const description = repo && repo.description ? repo.description : (repo && repo.repoMode === 'existing'
        ? t('repoExistingDescription')
        : t('repoNewDescription'));
      return '<button class="repo-picker-item' + (isSelected ? ' repo-picker-item-selected' : '') + '" type="button" data-role="repo-select-button" data-repo-full-name="' + escapeClientHtml(repo && repo.fullName ? repo.fullName : '') + '">'
        + '<div class="repo-picker-item-topline">'
        + '<strong>' + escapeClientHtml(repo && repo.fullName ? repo.fullName : 'GitHub repository') + '</strong>'
        + '<span class="chip">' + escapeClientHtml(repo && repo.repoMode === 'existing' ? t('repoExisting') : t('repoNew')) + '</span>'
        + '</div>'
        + '<p class="support-copy repo-picker-description">' + escapeClientHtml(description) + '</p>'
        + '<div class="repo-picker-item-meta">'
        + '<span>' + escapeClientHtml(repo && repo.visibility ? repo.visibility : (repo && repo.isPrivate ? 'private' : 'public')) + '</span>'
        + '<span>' + escapeClientHtml(formatTimestamp(repo && repo.updatedAt ? repo.updatedAt : null)) + '</span>'
        + '</div>'
        + '</button>';
    }).join('');
  };

  const getMessageKey = (message) => {
    const explicitId = String(message && message.id ? message.id : '').trim();
    if (explicitId) {
      return explicitId;
    }
    return String((message && message.role ? message.role : '') + ':' + (message && message.createdAt ? message.createdAt : '') + ':' + (message && message.text ? message.text : ''));
  };

  const renderStatusPillHtml = (session, compact = false) => {
    const runtimeStatus = typeof session === 'string'
      ? { label: getStatusLabel(session), tone: session === 'ready' ? 'idle' : 'active' }
      : getSessionRuntimeStatus(session);
    const tone = runtimeStatus.tone || 'idle';
    return '<span class="status-pill status-pill-' + tone + (compact ? ' status-pill-compact' : '') + '">'
      + '<span class="status-pill-dot" aria-hidden="true"></span>'
      + '<span>' + escapeClientHtml(runtimeStatus.label || t('statusStopped')) + '</span>'
      + '</span>';
  };

  const markSessionRailNavigationLoading = (trigger) => {
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    trigger.classList.add('session-rail-link-loading');
    trigger.setAttribute('aria-busy', 'true');
    const statusPill = trigger.querySelector('.status-pill');
    if (statusPill instanceof HTMLElement) {
      statusPill.classList.remove('status-pill-idle', 'status-pill-complete', 'status-pill-attention');
      statusPill.classList.add('status-pill-active');
      const label = statusPill.querySelector('span:last-child');
      if (label instanceof HTMLElement) {
        label.textContent = t('statusLoading');
      }
    }
  };

  const renderMessageHtml = (message) => {
    const isUser = message && message.role === 'user';
    return '<div class="message-row' + (isUser ? ' message-row-user' : '') + '" data-message-id="' + escapeClientHtml(getMessageKey(message)) + '">'
      + '<article class="message-card' + (isUser ? ' message-card-user' : '') + '">'
      + '<div class="message-meta">'
      + '<span>' + (isUser ? t('youLabel') : t('atlasLabel')) + '</span>'
      + '<span>' + escapeClientHtml(formatTimestamp(message && message.createdAt)) + '</span>'
      + '</div>'
      + '<div class="message-body">' + escapeClientHtml(message && message.text).replaceAll('\\n', '<br />') + '</div>'
      + '</article>'
      + '</div>';
  };

  const renderAssetPanelHtml = (session) => {
    const attachments = Array.isArray(session && session.attachments) ? session.attachments : [];
    if (!attachments.length) {
      return '';
    }

    const planByAttachmentId = new Map((Array.isArray(session && session.attachmentPlans) ? session.attachmentPlans : []).map((plan) => [plan.attachmentId, plan]));
    return '<section class="asset-rail" aria-label="Attached files">'
      + '<div class="asset-rail-header">'
      + '<p class="eyebrow">' + escapeClientHtml(t('attachedFiles')) + '</p>'
      + '<span class="sidebar-row-count">' + escapeClientHtml(String(attachments.length)) + '</span>'
      + '</div>'
      + '<div class="asset-rail-track">'
      + attachments.map((attachment) => {
        const plan = planByAttachmentId.get(attachment.id);
        const primaryCopy = plan && plan.intendedUse ? plan.intendedUse : attachment.roleHint;
        const placementCopy = plan && plan.placementHint ? plan.placementHint : attachment.storedRelativePath;
        return '<article class="asset-rail-card">'
          + '<div class="asset-card-header">'
          + '<strong class="asset-card-title">' + escapeClientHtml(attachment.originalName) + '</strong>'
          + '<span class="chip">' + escapeClientHtml(attachment.kind) + '</span>'
          + '</div>'
          + '<div class="asset-card-meta">'
          + '<span>' + escapeClientHtml(attachment.mediaType || 'application/octet-stream') + '</span>'
          + '<span>' + escapeClientHtml(formatBytes(attachment.byteSize)) + '</span>'
          + '</div>'
          + '<p class="asset-rail-copy">' + escapeClientHtml(primaryCopy) + '</p>'
          + '<p class="asset-card-placement">' + escapeClientHtml(placementCopy) + '</p>'
          + '</article>';
      }).join('')
      + '</div>'
      + '</section>';
  };

  const renderSessionRailHtml = (sessions, focusedSessionId) => {
    if (!Array.isArray(sessions) || !sessions.length) {
      return '<div class="sidebar-empty">'
        + '<strong>' + escapeClientHtml(t('sidebarEmptyTitle')) + '</strong>'
        + '<p class="support-copy">' + escapeClientHtml(t('sidebarEmptyBody')) + '</p>'
        + '</div>';
    }

    return sessions.map((session) => {
      const summary = getSessionRailDescription(session);
      return '<button class="session-rail-link' + (session.id === focusedSessionId ? ' session-rail-link-selected' : '') + '" type="button" data-session-id="' + escapeClientHtml(session.id) + '">'
        + '<div class="session-rail-header">'
        + '<strong>' + escapeClientHtml(getSessionDisplayTitle(session)) + '</strong>'
        + renderStatusPillHtml(session, true)
        + '</div>'
        + '<p>' + escapeClientHtml(summary) + '</p>'
        + '</button>';
    }).join('');
  };

  const renderBuildMetricHtml = (metric) => {
    return '<div class="build-metric-card">'
      + '<div class="build-metric-label">' + escapeClientHtml(metric && metric.label ? metric.label : 'Metric') + '</div>'
      + '<div class="build-metric-value">' + escapeClientHtml(metric && metric.value ? metric.value : 'Waiting') + '</div>'
      + '</div>';
  };

  const renderBuildOverviewHtml = (snapshot) => {
    if (!snapshot) {
      return '<div class="build-detail-empty">'
        + '<p class="eyebrow">' + escapeClientHtml(t('readableDetailLabel')) + '</p>'
        + '<strong>' + escapeClientHtml(t('waitingForLiveRuntime')) + '</strong>'
        + '<p class="support-copy">' + escapeClientHtml(t('waitingForLiveRuntimeHelp')) + '</p>'
        + '</div>';
    }

    return '<div class="build-detail-copy">'
      + '<div class="build-detail-head">'
      + '<div>'
      + '<p class="eyebrow">' + escapeClientHtml(t('readableDetailLabel')) + '</p>'
      + '<strong class="build-detail-title">' + escapeClientHtml(t('selectAgentLabel')) + '</strong>'
      + '</div>'
      + '<span class="build-state-badge ' + escapeClientHtml('build-state-' + String(snapshot.request && snapshot.request.state ? snapshot.request.state : 'queued')) + '">' + escapeClientHtml(localizeRequestStateLabel(snapshot.request && snapshot.request.stateLabel ? snapshot.request.stateLabel : '', snapshot.request && snapshot.request.state ? snapshot.request.state : 'queued')) + '</span>'
      + '</div>'
      + '<p class="build-detail-body">' + escapeClientHtml(t('selectAgentHelp')) + '</p>'
      + '<div class="build-detail-metrics">'
      + renderBuildMetricHtml({ label: t('pipelineLabel'), value: snapshot.pipeline && snapshot.pipeline.stageLabel ? snapshot.pipeline.stageLabel : 'Idle' })
      + renderBuildMetricHtml({ label: t('loopsLabel'), value: String(snapshot.pipeline && typeof snapshot.pipeline.loopCount === 'number' ? snapshot.pipeline.loopCount : 0) })
      + renderBuildMetricHtml({ label: t('sessionPremiumLabel'), value: String(typeof snapshot.sessionPremiumRequests === 'number' ? snapshot.sessionPremiumRequests : 0) })
      + renderBuildMetricHtml({ label: 'Progress', value: String(clampPercent(snapshot.pipeline && snapshot.pipeline.percent)) + '%' })
      + renderBuildMetricHtml({ label: 'Updated', value: formatTimestamp(snapshot.updatedAt || snapshot.pipeline && snapshot.pipeline.updatedAt) })
      + '</div>'
      + '<div class="build-log-list">'
      + '<div class="build-log-line">' + escapeClientHtml(snapshot.pipeline && snapshot.pipeline.detail ? snapshot.pipeline.detail : (currentLanguageId === 'tr' ? 'Sonraki derleme etkinliği burada görünecek.' : 'The next build activity will appear here.')) + '</div>'
      + '<div class="build-log-line">' + escapeClientHtml(snapshot.request && snapshot.request.triggerLabel ? snapshot.request.triggerLabel : (currentLanguageId === 'tr' ? 'ATLAS görevi bir sonraki canlı çalışma zamanı devri için hazır tutuyor.' : 'ATLAS is keeping the mission ready for the next live runtime handoff.')) + '</div>'
      + '</div>'
      + '</div>';
  };

  const renderBuildControlsHtml = (snapshot, sessionId) => {
    const requestState = String(snapshot && snapshot.request && snapshot.request.state ? snapshot.request.state : 'queued');
    const missionSessionId = String(snapshot && snapshot.mission && (snapshot.mission.desktopSessionId || snapshot.mission.sessionId) ? (snapshot.mission.desktopSessionId || snapshot.mission.sessionId) : '').trim();
    const ownsMission = missionSessionId === String(sessionId || '');
    const canStop = ownsMission && requestState === 'running';
    const canContinue = !ownsMission || requestState === 'queued' || requestState === 'paused' || requestState === 'completed' || requestState === 'error';
    const helperCopy = ownsMission
      ? (requestState === 'paused'
          ? t('buildPausedHelp')
          : t('buildActiveHelp'))
      : t('buildResumeHelp');

    return '<section class="build-control-bar" data-role="build-control-host">'
      + '<div class="build-control-copy">'
      + '<p class="eyebrow">' + escapeClientHtml(t('missionControls')) + '</p>'
      + '<p class="support-copy build-control-note" data-role="build-control-feedback">' + escapeClientHtml(helperCopy) + '</p>'
      + '</div>'
      + '<div class="build-control-actions">'
      + '<button class="build-control-button build-control-button-secondary build-control-button-compact" type="button" data-role="runtime-log-button" data-session-id="' + escapeClientHtml(sessionId) + '">' + escapeClientHtml(t('logsLabel')) + '</button>'
      + '<button class="build-control-button" type="button" data-role="build-control-button" data-build-action="resume-build" data-session-id="' + escapeClientHtml(sessionId) + '"' + (canContinue ? '' : ' disabled') + '>' + escapeClientHtml(t('resumeLabel')) + '</button>'
      + '<button class="build-control-button build-control-button-danger" type="button" data-role="build-control-button" data-build-action="stop-build" data-session-id="' + escapeClientHtml(sessionId) + '"' + (canStop ? '' : ' disabled') + '>' + escapeClientHtml(t('stopLabel')) + '</button>'
      + '</div>'
      + '</section>';
  };

  const renderRuntimeLogGroupHtml = (group) => {
    return '<section class="runtime-log-group">'
      + '<div class="runtime-log-group-topline">'
      + '<strong>' + escapeClientHtml(group && group.label ? group.label : t('runtimeLogLabel')) + '</strong>'
      + '<span class="runtime-log-group-meta">' + escapeClientHtml(group && group.source ? group.source : t('stateLogLabel')) + '</span>'
      + '<span class="runtime-log-group-meta">' + escapeClientHtml(formatTimestamp(group && group.updatedAt ? group.updatedAt : null)) + '</span>'
      + '</div>'
      + '<pre class="runtime-log-pre">' + escapeClientHtml(group && group.content ? group.content : t('noRawLogOutputYet')) + '</pre>'
      + '</section>';
  };

  const getRuntimeLogOutput = () => {
    const output = document.querySelector('[data-role="runtime-log-output"]');
    return output instanceof HTMLElement ? output : null;
  };

  const isScrollContainerNearBottom = (element) => {
    return Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 40;
  };

  const syncBuildDetailMarkup = (host, markup) => {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const shouldFollow = isScrollContainerNearBottom(host);
    const previousScrollTop = host.scrollTop;
    const hasChanged = host.innerHTML !== markup;

    if (hasChanged) {
      host.innerHTML = markup;
    }
    if (shouldFollow) {
      host.scrollTop = host.scrollHeight;
      return;
    }
    if (hasChanged) {
      host.scrollTop = Math.min(previousScrollTop, Math.max(0, host.scrollHeight - host.clientHeight));
    }
  };

  const BUILD_LOOP_STAGE_TO_AGENT = {
    jesus_awakening: 'jesus',
    jesus_reading: 'jesus',
    jesus_thinking: 'jesus',
    jesus_decided: 'jesus',
    research_scout_running: 'research_scout',
    research_scout_done: 'research_scout',
    research_synthesis_running: 'research_synthesizer',
    research_synthesis_done: 'research_synthesizer',
    prometheus_starting: 'prometheus',
    prometheus_reading_repo: 'prometheus',
    prometheus_analyzing: 'prometheus',
    prometheus_audit: 'prometheus',
    prometheus_done: 'prometheus',
    athena_reviewing: 'athena',
    athena_approved: 'athena',
    workers_dispatching: 'worker',
    workers_running: 'worker',
    workers_finishing: 'worker',
    cycle_complete: 'done',
  };

  const BUILD_LOOP_AGENT_ORDER = {
    jesus: 0,
    research_scout: 1,
    research_synthesizer: 2,
    prometheus: 3,
    athena: 4,
    worker: 5,
    done: 6,
  };

  const getBuildAgentLoopState = (snapshot, agent) => {
    if (!agent || typeof agent.id !== 'string') {
      return '';
    }

    if (agent.state === 'error') {
      return 'error';
    }

    const stage = String(snapshot && snapshot.pipeline && snapshot.pipeline.stage ? snapshot.pipeline.stage : 'idle');
    const activeLoopAgentId = Object.prototype.hasOwnProperty.call(BUILD_LOOP_STAGE_TO_AGENT, stage)
      ? BUILD_LOOP_STAGE_TO_AGENT[stage]
      : '';
    const activeLoopIndex = typeof BUILD_LOOP_AGENT_ORDER[activeLoopAgentId] === 'number'
      ? BUILD_LOOP_AGENT_ORDER[activeLoopAgentId]
      : -1;
    const agentLoopIndex = typeof BUILD_LOOP_AGENT_ORDER[agent.id] === 'number'
      ? BUILD_LOOP_AGENT_ORDER[agent.id]
      : -1;

    if (agentLoopIndex === -1) {
      return agent.state === 'active' ? 'current' : '';
    }

    if (activeLoopIndex === -1) {
      return '';
    }

    if (stage === 'cycle_complete') {
      return agent.id === 'done' ? 'done' : '';
    }

    if (agentLoopIndex < activeLoopIndex) {
      return 'done';
    }

    if (agentLoopIndex === activeLoopIndex) {
      return 'current';
    }

    return '';
  };

  const syncRuntimeLogOutputMarkup = (markup) => {
    const output = getRuntimeLogOutput();
    if (!(output instanceof HTMLElement)) {
      return;
    }

    const shouldFollow = runtimeLogAutoFollow || isScrollContainerNearBottom(output);
    const distanceFromBottom = Math.max(0, output.scrollHeight - output.scrollTop - output.clientHeight);
    const hasChanged = output.innerHTML !== markup;

    if (hasChanged) {
      output.innerHTML = markup;
    }
    if (shouldFollow) {
      output.scrollTop = output.scrollHeight;
      runtimeLogAutoFollow = true;
      return;
    }
    if (hasChanged) {
      output.scrollTop = Math.max(0, output.scrollHeight - output.clientHeight - distanceFromBottom);
    }
  };

  const setRuntimeLogModalVisibility = (isVisible) => {
    const modal = document.querySelector('[data-role="runtime-log-modal"]');
    if (modal instanceof HTMLElement) {
      modal.hidden = !isVisible;
    }
  };

  const setRepoPickerVisibility = (isVisible) => {
    const modal = document.querySelector('[data-role="repo-picker-modal"]');
    if (modal instanceof HTMLElement) {
      modal.hidden = !isVisible;
    }
  };

  const setGitHubAuthModalVisibility = (isVisible) => {
    const modal = document.querySelector('[data-role="github-auth-modal"]');
    if (modal instanceof HTMLElement) {
      modal.hidden = !isVisible;
    }
  };

  const setProjectDetailsModalVisibility = (isVisible) => {
    const modal = document.querySelector('[data-role="project-details-modal"]');
    if (modal instanceof HTMLElement) {
      modal.hidden = !isVisible;
    }
  };

  const setModelPickerVisibility = (isVisible) => {
    const modal = document.querySelector('[data-role="model-picker-modal"]');
    if (modal instanceof HTMLElement) {
      modal.hidden = !isVisible;
    }
  };

  const syncModelPickerUi = () => {
    const status = document.querySelector('[data-role="model-picker-status"]');
    if (status instanceof HTMLElement) {
      status.textContent = getModelPickerStatusText();
    }
    const listHost = document.querySelector('[data-role="model-picker-list"]');
    if (listHost instanceof HTMLElement) {
      listHost.innerHTML = renderModelPickerOptionsHtml();
    }
  };

  const openModelPicker = () => {
    if (state.authRequired) {
      openGitHubAuthModal();
      return;
    }
    syncModelPickerUi();
    setModelPickerVisibility(true);
  };

  const closeModelPicker = () => {
    setModelPickerVisibility(false);
  };

  const applySelectedCopilotModel = (modelName) => {
    state.selectedCopilotModel = resolveAllowedModelForUsage(modelName, state.copilotUsage) || null;
    writeStoredSelectedCopilotModel(state.selectedCopilotModel);
    syncModelPickerUi();
    syncProjectEntryUi();
  };

  const syncCopilotUsage = (auth, usage) => {
    state.githubAuth = auth || state.githubAuth;
    state.copilotUsage = usage || null;
    state.authRequired = Boolean(state.githubAuth && state.githubAuth.authRequired);
    syncSelectedCopilotModel();

    document.querySelectorAll('[data-role="copilot-usage-host"]').forEach((host) => {
      if (!(host instanceof HTMLElement)) {
        return;
      }
      const compact = host.classList.contains('copilot-usage-host-compact') || host.classList.contains('copilot-usage-host-sidebar');
      host.innerHTML = renderCopilotUsageCardHtml(state.githubAuth, state.copilotUsage, compact);
    });
    syncModelPickerUi();
    syncProjectEntryUi();
  };

  const openGitHubAuthModal = () => {
    setGitHubAuthModalVisibility(true);
    const status = document.querySelector('[data-role="github-auth-status"]');
    if (status instanceof HTMLElement) {
      status.textContent = state.authRequired
        ? 'Atlas needs a GitHub token before it can list repositories, create repos, and resolve the correct Copilot model pool.'
        : 'Update the local GitHub access Atlas should use for repository and Copilot operations.';
    }
    const error = document.querySelector('[data-role="github-auth-error"]');
    if (error instanceof HTMLElement) {
      error.textContent = '';
    }
    const input = document.querySelector('[data-role="github-auth-form"] input[name="githubToken"]');
    if (input instanceof HTMLInputElement) {
      window.requestAnimationFrame(() => input.focus());
    }
  };

  const closeGitHubAuthModal = () => {
    if (state.authRequired) {
      return;
    }
    setGitHubAuthModalVisibility(false);
  };

  const syncProjectEntryUi = () => {
    const preparedProjectDetails = getPreparedProjectDetails();
    const projectContextHost = document.querySelector('[data-role="project-context-row-host"]');
    if (projectContextHost instanceof HTMLElement) {
      projectContextHost.innerHTML = renderInlineProjectButtonHtml(state.repoContext, preparedProjectDetails, getInlineModelPickerNote());
    }

    const introCopy = document.querySelector('[data-role="new-session-intro-copy"]');
    if (introCopy instanceof HTMLElement) {
      introCopy.textContent = getNewSessionIntroCopy(state.repoContext, preparedProjectDetails);
    }

    const composerInput = document.querySelector('[data-role="chat-input"]');
    const composerForm = document.querySelector('[data-role="chat-form"]');
    if (composerInput instanceof HTMLTextAreaElement) {
      composerInput.placeholder = getComposerPlaceholder(
        state.repoContext,
        Boolean(composerForm instanceof HTMLFormElement && composerForm.getAttribute('data-session-id')),
      );
    }
  };

  const openProjectDetailsModal = () => {
    setProjectDetailsModalVisibility(true);
    const status = document.querySelector('[data-role="project-details-status"]');
    const error = document.querySelector('[data-role="project-details-error"]');
    const submitButton = document.querySelector('[data-role="project-details-form"] button[type="submit"]');
    const preparedProjectDetails = getPreparedProjectDetails();
    const projectNameInput = document.querySelector('[data-role="project-details-form"] input[name="projectName"]');
    const projectDescriptionInput = document.querySelector('[data-role="project-details-form"] textarea[name="projectDescription"]');
    const hasQueuedRequest = Boolean(pendingNewProjectRequest);
    if (status instanceof HTMLElement) {
      status.textContent = hasQueuedRequest
        ? t('projectDetailsCreateRepoPrompt')
        : t('projectDetailsSavePrompt');
    }
    if (error instanceof HTMLElement) {
      error.textContent = '';
    }
    if (projectNameInput instanceof HTMLInputElement) {
      projectNameInput.value = preparedProjectDetails ? preparedProjectDetails.projectName : '';
    }
    if (projectDescriptionInput instanceof HTMLTextAreaElement) {
      projectDescriptionInput.value = preparedProjectDetails ? preparedProjectDetails.projectDescription : '';
    }
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.textContent = hasQueuedRequest ? t('createProjectRepo') : t('saveProjectDetails');
    }
    if (projectNameInput instanceof HTMLInputElement) {
      window.requestAnimationFrame(() => projectNameInput.focus());
    }
  };

  const closeProjectDetailsModal = () => {
    setProjectDetailsModalVisibility(false);
    pendingNewProjectRequest = null;
  };

  const refreshGitHubAuthStatus = async () => {
    const response = await fetch('/api/auth/session', {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Atlas could not refresh the GitHub usage state.');
    }
    syncCopilotUsage(payload.auth, payload.copilotUsage || null);
    if (!payload.authRequired) {
      closeGitHubAuthModal();
    }
  };

  const renderCompletedPresentationTarget = (host, target, isUrl) => {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    if (!target) {
      host.innerHTML = '<p>No presentation target was recorded.</p>';
      return;
    }
    if (isUrl) {
      host.innerHTML = '<a class="history-product-link" href="' + escapeClientHtml(target) + '" target="_blank" rel="noreferrer">' + escapeClientHtml(target) + '</a>';
      return;
    }
    host.innerHTML = '<p class="history-mono">' + escapeClientHtml(target) + '</p>';
  };

  const refreshCompletedPresentation = async (projectId, sessionId, trigger) => {
    const card = trigger instanceof HTMLElement
      ? trigger.closest('[data-role="completed-presentation-card"]')
      : null;
    const feedback = card instanceof HTMLElement
      ? card.querySelector('[data-role="completed-presentation-feedback"]')
      : null;
    const targetHost = card instanceof HTMLElement
      ? card.querySelector('[data-role="completed-presentation-target"]')
      : null;
    const summaryHost = document.querySelector('[data-role="completed-presentation-summary"]');
    const actionHost = document.querySelector('[data-role="completed-presentation-action"]');
    const sourceHost = document.querySelector('[data-role="completed-presentation-source"]');
    const originalLabel = trigger instanceof HTMLButtonElement
      ? (trigger.textContent || 'Refresh Open Target')
      : 'Refresh Open Target';

    if (trigger instanceof HTMLButtonElement) {
      trigger.disabled = true;
      trigger.setAttribute('aria-busy', 'true');
      trigger.textContent = 'Presenter AI is thinking...';
    }
    if (feedback instanceof HTMLElement) {
      feedback.textContent = 'Presenter AI is thinking...';
    }

    try {
      const response = await fetch('/api/session/presentation/refresh', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId, sessionId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'ATLAS could not refresh this completed presentation.');
      }

      const presentation = payload.presentation || {};
      renderCompletedPresentationTarget(targetHost, presentation.openTarget || null, presentation.openTargetIsUrl === true);
      if (summaryHost instanceof HTMLElement) {
        summaryHost.textContent = presentation.presenterSummary || 'No presenter summary was recorded.';
      }
      if (actionHost instanceof HTMLElement) {
        const autoStatus = presentation.autoOpenStatus ? (' - auto-open ' + presentation.autoOpenStatus) : '';
        actionHost.textContent = (presentation.action || 'document_only') + autoStatus;
      }
      if (sourceHost instanceof HTMLElement) {
        sourceHost.textContent = presentation.decisionSource || 'No presenter decision source was recorded.';
      }
      if (feedback instanceof HTMLElement) {
        feedback.textContent = payload.message || 'Open Target refreshed.';
      }
    } catch (error) {
      if (feedback instanceof HTMLElement) {
        feedback.textContent = String(error && error.message ? error.message : error) || 'ATLAS could not refresh this completed presentation.';
      }
    } finally {
      if (trigger instanceof HTMLButtonElement) {
        trigger.disabled = false;
        trigger.removeAttribute('aria-busy');
        trigger.textContent = originalLabel;
      }
    }
  };

  const deleteCompletedSessionFiles = async (projectId, sessionId, trigger) => {
    const card = trigger instanceof HTMLElement
      ? trigger.closest('[data-role="completed-session-detail-view"]')
      : null;
    const feedback = card instanceof HTMLElement
      ? card.querySelector('[data-role="completed-workspace-feedback"]')
      : null;
    const pathHost = card instanceof HTMLElement
      ? card.querySelector('[data-role="completed-workspace-path"]')
      : null;
    const originalLabel = trigger instanceof HTMLButtonElement
      ? (trigger.textContent || 'Delete session files from my PC')
      : 'Delete session files from my PC';

    if (!window.confirm('Delete this completed session workspace from this PC? The completed session record will stay available in ATLAS.')) {
      return;
    }

    if (trigger instanceof HTMLButtonElement) {
      trigger.disabled = true;
      trigger.setAttribute('aria-busy', 'true');
      trigger.textContent = 'Deleting session files...';
    }
    if (feedback instanceof HTMLElement) {
      feedback.textContent = 'Deleting the preserved workspace snapshot from this PC...';
    }

    let completed = false;
    try {
      const response = await fetch('/api/session/completed/files/delete', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId, sessionId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'ATLAS could not delete this completed session workspace.');
      }

      completed = true;
      if (pathHost instanceof HTMLElement) {
        pathHost.textContent = payload.workspacePath || 'No workspace path was recorded.';
      }
      if (feedback instanceof HTMLElement) {
        feedback.textContent = payload.message || 'Session files deleted from this PC.';
      }
    } catch (error) {
      if (feedback instanceof HTMLElement) {
        feedback.textContent = String(error && error.message ? error.message : error) || 'ATLAS could not delete this completed session workspace.';
      }
    } finally {
      if (trigger instanceof HTMLButtonElement) {
        trigger.removeAttribute('aria-busy');
        if (completed) {
          trigger.textContent = 'Session files deleted';
          trigger.disabled = true;
        } else {
          trigger.textContent = originalLabel;
          trigger.disabled = false;
        }
      }
    }
  };

  const syncRepoContext = (repoContext) => {
    state.repoContext = repoContext || null;
    if (state.repoContext && state.repoContext.targetRepo) {
      state.pendingProjectDetails = null;
    }
    syncProjectEntryUi();
  };

  const syncRepoPickerList = () => {
    const searchInput = document.querySelector('[data-role="repo-picker-search"]');
    const listHost = document.querySelector('[data-role="repo-picker-list"]');
    const status = document.querySelector('[data-role="repo-picker-status"]');
    if (!(listHost instanceof HTMLElement) || !(status instanceof HTMLElement)) {
      return;
    }

    const query = searchInput instanceof HTMLInputElement ? String(searchInput.value || '').trim().toLowerCase() : '';
    const repositories = Array.isArray(state.availableRepositories) ? state.availableRepositories : [];
    const filteredRepositories = !query
      ? repositories
      : repositories.filter((repo) => {
          const haystack = [repo && repo.name ? repo.name : '', repo && repo.fullName ? repo.fullName : '', repo && repo.description ? repo.description : '']
            .join('\\n')
            .toLowerCase();
          return haystack.includes(query);
        });

    status.textContent = filteredRepositories.length > 0
      ? 'Choose one repository to start existing-project onboarding in the GUI.'
      : 'No GitHub repositories matched the current search.';
    listHost.innerHTML = renderRepositoryListHtml(filteredRepositories, state.repoContext && state.repoContext.targetRepo ? state.repoContext.targetRepo : '');
  };

  const loadRepositoryList = async () => {
    if (state.authRequired) {
      throw new Error('Connect GitHub before opening the repository picker.');
    }
    const status = document.querySelector('[data-role="repo-picker-status"]');
    const listHost = document.querySelector('[data-role="repo-picker-list"]');
    if (status instanceof HTMLElement) {
      status.textContent = 'Atlas is loading your GitHub repositories.';
    }
    if (listHost instanceof HTMLElement) {
      listHost.innerHTML = '<div class="runtime-log-empty">Loading repositories...</div>';
    }

    const response = await fetch('/api/repositories', {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Atlas could not load GitHub repositories.');
    }

    state.availableRepositories = Array.isArray(payload.repositories) ? payload.repositories : [];
    if (Object.prototype.hasOwnProperty.call(payload, 'repoContext')) {
      syncRepoContext(payload.repoContext || null);
    }
    syncRepoPickerList();
  };

  const openRepoPicker = async () => {
    setRepoPickerVisibility(true);
    await loadRepositoryList();
  };

  const closeRepoPicker = () => {
    setRepoPickerVisibility(false);
  };

  const selectRepository = async (repoFullName, triggerButton) => {
    if (!repoFullName) {
      return;
    }

    const status = document.querySelector('[data-role="repo-picker-status"]');
    if (status instanceof HTMLElement) {
      status.textContent = 'Atlas is attaching ' + repoFullName + ' to the next onboarding session.';
    }
    if (triggerButton instanceof HTMLButtonElement) {
      triggerButton.disabled = true;
    }

    try {
      const response = await fetch('/api/repositories/select', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoFullName }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Atlas could not select that repository.');
      }

      syncRepoContext(payload.repoContext || null);
      closeRepoPicker();
      const globalStatus = document.querySelector('[data-role="global-status"]');
      if (globalStatus instanceof HTMLElement) {
        globalStatus.textContent = currentLanguageId === 'tr'
          ? repoFullName + t('repoSelectedSuffix')
          : t('repoSelectedPrefix') + repoFullName + t('repoSelectedSuffix');
      }
    } finally {
      if (triggerButton instanceof HTMLButtonElement) {
        triggerButton.disabled = false;
      }
    }
  };

  const clearRepositoryContext = async () => {
    const response = await fetch('/api/repositories/clear', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Atlas could not clear the repository context.');
    }

    syncRepoContext(null);
    closeRepoPicker();
    const globalStatus = document.querySelector('[data-role="global-status"]');
    if (globalStatus instanceof HTMLElement) {
      globalStatus.textContent = t('repoClearStatus');
    }
    openProjectDetailsModal();
  };

  const setRuntimeLogModalLoading = () => {
    const title = document.querySelector('[data-role="runtime-log-title"]');
    const status = document.querySelector('[data-role="runtime-log-status"]');
    if (title instanceof HTMLElement) {
      title.textContent = t('runtimeLogsTitle');
    }
    if (status instanceof HTMLElement) {
      status.textContent = t('collectingRawLogs');
    }
    runtimeLogAutoFollow = true;
    syncRuntimeLogOutputMarkup('<div class="runtime-log-empty">' + escapeClientHtml(t('loadingRawLogs')) + '</div>');
  };

  const setRuntimeLogModalPayload = (payload) => {
    const title = document.querySelector('[data-role="runtime-log-title"]');
    const status = document.querySelector('[data-role="runtime-log-status"]');
    const groups = Array.isArray(payload && payload.groups) ? payload.groups : [];
    const desktopSessionId = String(payload && payload.sessionId ? payload.sessionId : '').trim();
    const projectSessionId = String(payload && payload.projectSessionId ? payload.projectSessionId : '').trim();
    const primaryGroup = groups[0] || null;
    if (title instanceof HTMLElement) {
      title.textContent = payload && payload.sessionTitle ? payload.sessionTitle + t('runtimeLogsSuffix') : t('runtimeLogsTitle');
    }
    if (status instanceof HTMLElement) {
      status.textContent = groups.length > 0
        ? (t('desktopSessionLabel') + ': ' + (desktopSessionId || t('unknownLabel'))
          + (projectSessionId ? ' • ' + t('buildSessionLabel') + ': ' + projectSessionId : '')
          + ' • ' + t('sourceLabel') + ': ' + (primaryGroup && primaryGroup.source ? primaryGroup.source : t('rawLogSourceLabel')))
        : t('runtimeLogsMissing');
    }
    syncRuntimeLogOutputMarkup(groups.length > 0
      ? groups.map(renderRuntimeLogGroupHtml).join('')
      : '<div class="runtime-log-empty">' + escapeClientHtml(t('noRuntimeLogsYet')) + '</div>');
  };

  const setRuntimeLogModalError = (message) => {
    const status = document.querySelector('[data-role="runtime-log-status"]');
    if (status instanceof HTMLElement) {
      status.textContent = t('runtimeLogsLoadError');
    }
    syncRuntimeLogOutputMarkup('<div class="runtime-log-empty">' + escapeClientHtml(message || t('runtimeLogsLoadError')) + '</div>');
  };

  const stopRuntimeLogPolling = () => {
    if (runtimeLogPollHandle) {
      window.clearInterval(runtimeLogPollHandle);
      runtimeLogPollHandle = null;
    }
  };

  const fetchRuntimeLogs = async (sessionId, options = {}) => {
    if (!sessionId) {
      return null;
    }

    const showLoading = Boolean(options && options.showLoading);
    if (showLoading) {
      setRuntimeLogModalLoading();
    }

    const response = await fetch('/api/runtime/logs?sessionId=' + encodeURIComponent(sessionId), {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || t('runtimeLogsLoadError'));
    }
    if (activeRuntimeLogSessionId === sessionId) {
      setRuntimeLogModalPayload(payload);
    }
    return payload;
  };

  const startRuntimeLogPolling = (sessionId) => {
    stopRuntimeLogPolling();
    if (!sessionId) {
      return;
    }
    runtimeLogPollHandle = window.setInterval(() => {
      fetchRuntimeLogs(sessionId).catch((error) => {
        if (activeRuntimeLogSessionId === sessionId) {
          setRuntimeLogModalError(String(error && error.message ? error.message : error));
        }
      });
    }, 2500);
  };

  const openRuntimeLogModal = async (sessionId, triggerButton) => {
    if (!sessionId) {
      return;
    }
    activeRuntimeLogSessionId = sessionId;
    runtimeLogAutoFollow = true;
    setRuntimeLogModalVisibility(true);
    if (triggerButton instanceof HTMLButtonElement) {
      triggerButton.disabled = true;
    }
    try {
      await fetchRuntimeLogs(sessionId, { showLoading: true });
    } catch (error) {
      setRuntimeLogModalError(String(error && error.message ? error.message : error));
    } finally {
      if (activeRuntimeLogSessionId === sessionId) {
        startRuntimeLogPolling(sessionId);
      }
      if (triggerButton instanceof HTMLButtonElement) {
        triggerButton.disabled = false;
      }
    }
  };

  const closeRuntimeLogModal = () => {
    activeRuntimeLogSessionId = null;
    stopRuntimeLogPolling();
    setRuntimeLogModalVisibility(false);
  };

  const renderBuildAgentDetailHtml = (agent) => {
    const metrics = Array.isArray(agent && agent.metrics) ? agent.metrics : [];
    const logLines = Array.isArray(agent && agent.logLines) ? agent.logLines : [];
    return '<div class="build-detail-copy">'
      + '<div class="build-detail-head">'
      + '<div>'
      + '<p class="eyebrow">Agent detail</p>'
      + '<strong class="build-detail-title">' + escapeClientHtml(agent && agent.label ? agent.label : 'Agent') + '</strong>'
      + '</div>'
      + '<span class="build-state-badge ' + escapeClientHtml('build-state-' + ((agent && agent.state === 'error') ? 'error' : (agent && agent.state === 'done') ? 'completed' : (agent && agent.state === 'active') ? 'running' : 'queued')) + '">' + escapeClientHtml(agent && agent.stateLabel ? agent.stateLabel : 'Standby') + '</span>'
      + '</div>'
      + '<p class="build-detail-body">' + escapeClientHtml(agent && agent.detailBody ? agent.detailBody : 'ATLAS is waiting for the next readable update.') + '</p>'
      + '<div class="build-detail-metrics">'
      + metrics.map(renderBuildMetricHtml).join('')
      + '</div>'
      + '<div class="build-log-list">'
      + (logLines.length > 0
        ? logLines.map((line) => '<div class="build-log-line">' + escapeClientHtml(line) + '</div>').join('')
        : '<div class="build-log-line">No readable log lines have landed for this agent yet.</div>')
      + '</div>'
      + '</div>';
  };

  const renderBuildAgentListHtml = (snapshot) => {
    const agents = Array.isArray(snapshot && snapshot.agents) ? snapshot.agents : [];
    return agents.map((agent, index) => {
      const cardStateClass = 'state-' + String(agent && agent.state ? agent.state : 'idle');
      const loopStateClass = getBuildAgentLoopState(snapshot, agent);
      const isSelected = selectedBuildAgentId && agent && agent.id === selectedBuildAgentId;
      return '<button class="build-agent-card ' + escapeClientHtml(cardStateClass + (loopStateClass ? ' loop-' + loopStateClass : '') + (isSelected ? ' build-agent-card-selected' : '')) + '" type="button" data-role="build-agent-card" data-agent-id="' + escapeClientHtml(agent && agent.id ? agent.id : '') + '">'
        + '<div class="build-agent-topline">'
        + '<span class="build-agent-index">' + escapeClientHtml(String(index + 1).padStart(2, '0')) + '</span>'
        + '<span class="build-agent-state">' + escapeClientHtml(agent && agent.stateLabel ? agent.stateLabel : 'Standby') + '</span>'
        + '</div>'
        + '<strong>' + escapeClientHtml(agent && agent.label ? agent.label : 'Agent') + '</strong>'
        + '<p class="build-agent-summary">' + escapeClientHtml(agent && agent.summary ? agent.summary : 'Waiting for the next readable update.') + '</p>'
        + '<div class="build-agent-meta">'
        + '<span>' + escapeClientHtml(agent && agent.detailTitle ? agent.detailTitle : 'Readable detail') + '</span>'
        + '<span>' + escapeClientHtml(agent && agent.metrics && agent.metrics[0] && agent.metrics[0].value ? agent.metrics[0].value : 'Waiting') + '</span>'
        + '</div>'
        + '</button>';
    }).join('');
  };

  const renderBuildSnapshot = (snapshot) => {
    const buildView = document.querySelector('[data-role="build-view"]');
    if (!(buildView instanceof HTMLElement)) {
      return;
    }

    state.runtimeSnapshot = snapshot || null;
    const selectedSessionId = buildView.getAttribute('data-session-id') || state.focusedSessionId || '';
    const focusedSession = Array.isArray(state.sessions)
      ? state.sessions.find((session) => session && session.id === selectedSessionId)
      : null;
    if (!state.sessionRuntimeStatuses || typeof state.sessionRuntimeStatuses !== 'object') {
      state.sessionRuntimeStatuses = {};
    }
    if (focusedSession) {
      state.sessionRuntimeStatuses[focusedSession.id] = deriveRuntimeStatusFromSnapshot(focusedSession, snapshot || null);
      syncActiveSessionCounter();
      const statusPillHost = document.querySelector('[data-role="conversation-status-pill-host"]');
      if (statusPillHost instanceof HTMLElement) {
        statusPillHost.innerHTML = renderStatusPillHtml(focusedSession);
      }
      const railHost = document.querySelector('[data-role="session-rail-host"]');
      if (railHost instanceof HTMLElement) {
        railHost.innerHTML = renderSessionRailHtml(state.sessions, state.focusedSessionId);
      }
    }
    const missionTitle = buildView.querySelector('[data-role="build-mission-title"]');
    const missionSummary = buildView.querySelector('[data-role="build-mission-summary"]');
    const requestState = buildView.querySelector('[data-role="build-request-state"]');
    const requestCopy = buildView.querySelector('[data-role="build-request-copy"]');
    const stageLabel = buildView.querySelector('[data-role="build-stage-label"]');
    const loopCount = buildView.querySelector('[data-role="build-loop-count"]');
    const sessionPremiumCount = buildView.querySelector('[data-role="build-session-premium-count"]');
    const percentLabel = buildView.querySelector('[data-role="build-percent-label"]');
    const progressFill = buildView.querySelector('[data-role="build-progress-fill"]');
    const stageDetail = buildView.querySelector('[data-role="build-stage-detail"]');
    const controlHost = buildView.querySelector('[data-role="build-control-host"]');
    const agentList = buildView.querySelector('[data-role="build-agent-list"]');
    const agentDetail = buildView.querySelector('[data-role="build-agent-detail"]');

    if (missionTitle instanceof HTMLElement) {
      missionTitle.textContent = snapshot && snapshot.mission && snapshot.mission.title ? snapshot.mission.title : t('waitingForLiveBuildMission');
    }
    if (missionSummary instanceof HTMLElement) {
      missionSummary.textContent = snapshot && snapshot.mission && snapshot.mission.summary ? snapshot.mission.summary : t('nextReadyBuildMission');
    }
    if (requestState instanceof HTMLElement) {
      const requestClass = 'build-state-' + String(snapshot && snapshot.request && snapshot.request.state ? snapshot.request.state : 'queued');
      requestState.className = 'build-state-badge ' + requestClass;
      requestState.textContent = localizeRequestStateLabel(snapshot && snapshot.request && snapshot.request.stateLabel ? snapshot.request.stateLabel : '', snapshot && snapshot.request && snapshot.request.state ? snapshot.request.state : 'queued');
    }
    if (requestCopy instanceof HTMLElement) {
      requestCopy.textContent = snapshot && snapshot.request && snapshot.request.triggerLabel ? snapshot.request.triggerLabel : t('runtimePreparing');
    }
    if (stageLabel instanceof HTMLElement) {
      stageLabel.textContent = snapshot && snapshot.pipeline && snapshot.pipeline.stageLabel ? snapshot.pipeline.stageLabel : t('waitingForRuntime');
    }
    if (loopCount instanceof HTMLElement) {
      loopCount.textContent = String(snapshot && snapshot.pipeline && typeof snapshot.pipeline.loopCount === 'number' ? Math.max(0, snapshot.pipeline.loopCount) : 0);
    }
    if (sessionPremiumCount instanceof HTMLElement) {
      sessionPremiumCount.textContent = String(snapshot && typeof snapshot.sessionPremiumRequests === 'number' ? Math.max(0, snapshot.sessionPremiumRequests) : 0);
    }
    if (percentLabel instanceof HTMLElement) {
      percentLabel.textContent = String(clampPercent(snapshot && snapshot.pipeline && snapshot.pipeline.percent)) + '%';
    }
    if (progressFill instanceof HTMLElement) {
      progressFill.style.width = String(clampPercent(snapshot && snapshot.pipeline && snapshot.pipeline.percent)) + '%';
    }
    if (stageDetail instanceof HTMLElement) {
      stageDetail.textContent = snapshot && snapshot.pipeline && snapshot.pipeline.detail ? snapshot.pipeline.detail : t('runtimeAwaiting');
    }
    if (controlHost instanceof HTMLElement) {
      controlHost.outerHTML = renderBuildControlsHtml(snapshot, selectedSessionId);
    }

    const agents = Array.isArray(snapshot && snapshot.agents) ? snapshot.agents : [];
    if (selectedBuildAgentId && !agents.some((agent) => agent && agent.id === selectedBuildAgentId)) {
      selectedBuildAgentId = null;
      selectedBuildAgentPinned = false;
    }
    if (!selectedBuildAgentPinned) {
      const defaultAgentId = typeof (snapshot && snapshot.defaultAgentId) === 'string' ? snapshot.defaultAgentId : '';
      selectedBuildAgentId = defaultAgentId && agents.some((agent) => agent && agent.id === defaultAgentId)
        ? defaultAgentId
        : null;
    }
    if (agentList instanceof HTMLElement) {
      agentList.innerHTML = renderBuildAgentListHtml(snapshot);
    }
    if (agentDetail instanceof HTMLElement) {
      const selectedAgent = selectedBuildAgentId ? agents.find((agent) => agent && agent.id === selectedBuildAgentId) : null;
      syncBuildDetailMarkup(
        agentDetail,
        selectedAgent ? renderBuildAgentDetailHtml(selectedAgent) : renderBuildOverviewHtml(snapshot),
      );
    }
  };

  const autoResize = (textarea) => {
    textarea.style.height = "0px";
    textarea.style.height = Math.min(textarea.scrollHeight, 156) + "px";
  };

  const renderPendingAttachments = (host, files) => {
    if (!(host instanceof HTMLElement)) return;
    if (!files.length) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }

    host.hidden = false;
    host.innerHTML = files.map((file) => (
      '<div class="pending-attachment-chip">'
      + '<strong>' + escapeClientHtml(file.name) + '</strong>'
      + '<span>' + escapeClientHtml((file.type || 'file') + ' • ' + formatBytes(file.size)) + '</span>'
      + '</div>'
    )).join('');
  };

  const setLoadingOverlay = (isVisible, heading, detail) => {
    const overlay = document.querySelector('[data-role="loading-overlay"]');
    const overlayHeading = document.querySelector('[data-role="loading-overlay-heading"]');
    const overlayDetail = document.querySelector('[data-role="loading-overlay-detail"]');
    if (!(overlay instanceof HTMLElement)) {
      return;
    }
    overlay.hidden = !isVisible;
    if (overlayHeading instanceof HTMLElement) {
      overlayHeading.textContent = heading || 'Atlas is processing your request';
    }
    if (overlayDetail instanceof HTMLElement) {
      overlayDetail.textContent = detail || 'The current session is being updated.';
    }
  };

  const redirectToSession = (sessionId) => {
    const refreshToken = 'refresh=' + Date.now();
    const targetUrl = sessionId
      ? '/?focusSession=' + encodeURIComponent(sessionId) + '&' + refreshToken
      : '/?' + refreshToken;
    if (!sessionId) {
      stopRuntimePolling();
      stopRuntimeLogPolling();
      document.querySelectorAll('.sidebar-new-session[data-action="new-session"]').forEach((button) => {
        if (!(button instanceof HTMLElement)) {
          return;
        }
        button.classList.add('atlas-nav-loading');
        button.setAttribute('aria-busy', 'true');
        if (button instanceof HTMLButtonElement) {
          button.disabled = true;
        }
      });
      setLoadingOverlay(true, t('newSessionTransitionHeading'), t('newSessionTransitionDetail'));
      const statusElement = document.querySelector('[data-role="global-status"]');
      if (statusElement instanceof HTMLElement) {
        statusElement.textContent = t('newSessionTransitionStatus');
      }
      const errorElement = document.querySelector('[data-role="global-error"]');
      if (errorElement instanceof HTMLElement) {
        errorElement.textContent = '';
      }
    }
    window.location.assign(targetUrl);
  };

  const stopRuntimePolling = () => {
    if (runtimePollHandle) {
      window.clearInterval(runtimePollHandle);
      runtimePollHandle = null;
    }
  };

  const fetchRuntimeSnapshotPayload = async (sessionId) => {
    const response = await fetch('/api/runtime/status?sessionId=' + encodeURIComponent(sessionId), {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Atlas could not read the live build status.');
    }

    return payload.snapshot || null;
  };

  const refreshSessionRuntimeStatuses = async (focusedSessionId = null, focusedSnapshot = null) => {
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    if (!state.sessionRuntimeStatuses || typeof state.sessionRuntimeStatuses !== 'object') {
      state.sessionRuntimeStatuses = {};
    }

    await Promise.all(sessions.map(async (session) => {
      if (!session || !session.id) {
        return;
      }
      if (session.status !== 'ready') {
        state.sessionRuntimeStatuses[session.id] = deriveRuntimeStatusFromSnapshot(session, null);
        return;
      }
      const snapshot = session.id === focusedSessionId
        ? focusedSnapshot
        : await fetchRuntimeSnapshotPayload(session.id).catch(() => null);
      state.sessionRuntimeStatuses[session.id] = deriveRuntimeStatusFromSnapshot(session, snapshot || null);
    }));

    syncActiveSessionCounter();
    const railHost = document.querySelector('[data-role="session-rail-host"]');
    if (railHost instanceof HTMLElement) {
      railHost.innerHTML = renderSessionRailHtml(state.sessions, state.focusedSessionId);
    }
    const selectedSession = sessions.find((session) => session && session.id === state.focusedSessionId) || null;
    const statusPillHost = document.querySelector('[data-role="conversation-status-pill-host"]');
    if (selectedSession && statusPillHost instanceof HTMLElement) {
      statusPillHost.innerHTML = renderStatusPillHtml(selectedSession);
    }
  };

  const fetchRuntimeSnapshot = async (sessionId) => {
    if (!sessionId) {
      renderBuildSnapshot(null);
      return null;
    }

    const snapshot = await fetchRuntimeSnapshotPayload(sessionId);
    renderBuildSnapshot(snapshot || null);
    refreshSessionRuntimeStatuses(sessionId, snapshot || null).catch(() => {});
    return snapshot || null;
  };

  const startRuntimePolling = (sessionId) => {
    stopRuntimePolling();
    if (!sessionId) {
      return;
    }
    runtimePollHandle = window.setInterval(() => {
      fetchRuntimeSnapshot(sessionId).catch(() => {});
    }, 2500);
  };

  const syncSelectedSessionMode = (session) => {
    const conversationView = document.querySelector('[data-role="conversation-view"]');
    const buildView = document.querySelector('[data-role="build-view"]');
    const isReady = Boolean(session && session.status === 'ready');
    if (conversationView instanceof HTMLElement) {
      conversationView.hidden = isReady;
    }
    if (buildView instanceof HTMLElement) {
      buildView.hidden = !isReady;
    }
    if (isReady) {
      renderBuildSnapshot(state.runtimeSnapshot);
      startRuntimePolling(session && session.id ? session.id : '');
      return;
    }
    stopRuntimePolling();
  };

  const runtimeLogOutput = getRuntimeLogOutput();
  if (runtimeLogOutput instanceof HTMLElement) {
    runtimeLogOutput.addEventListener('scroll', () => {
      runtimeLogAutoFollow = isScrollContainerNearBottom(runtimeLogOutput);
    });
  }

  document.addEventListener('click', (event) => {
    const themePickerToggle = event.target instanceof Element
      ? event.target.closest('[data-role="theme-picker-toggle"]')
      : null;
    if (themePickerToggle instanceof HTMLElement) {
      event.preventDefault();
      toggleThemePicker();
      return;
    }

    const themeOptionTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="theme-option"]')
      : null;
    if (themeOptionTrigger instanceof HTMLElement) {
      event.preventDefault();
      applyTheme(String(themeOptionTrigger.getAttribute('data-theme-id') || ''));
      closeThemePicker();
      return;
    }

    const languageOptionTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="language-option"]')
      : null;
    if (languageOptionTrigger instanceof HTMLElement) {
      event.preventDefault();
      applyLanguage(String(languageOptionTrigger.getAttribute('data-language-id') || ''));
      closeThemePicker();
      return;
    }

    const themePickerShell = document.querySelector('[data-role="theme-switcher"]');
    if (themePickerShell instanceof HTMLElement && event.target instanceof Node && !themePickerShell.contains(event.target)) {
      closeThemePicker();
    }

    if (event.target instanceof HTMLElement && event.target.matches('[data-role="github-auth-modal"]')) {
      event.preventDefault();
      closeGitHubAuthModal();
      return;
    }

    if (event.target instanceof HTMLElement && event.target.matches('[data-role="project-details-modal"]')) {
      event.preventDefault();
      closeProjectDetailsModal();
      return;
    }

    const authOpenTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="github-auth-open"]')
      : null;
    if (authOpenTrigger instanceof HTMLElement) {
      event.preventDefault();
      openGitHubAuthModal();
      return;
    }

    const authRefreshTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="github-auth-refresh"]')
      : null;
    if (authRefreshTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      authRefreshTrigger.disabled = true;
      refreshGitHubAuthStatus().catch((error) => {
        const status = document.querySelector('[data-role="github-auth-status"]');
        if (status instanceof HTMLElement) {
          status.textContent = String(error && error.message ? error.message : error);
        }
      }).finally(() => {
        authRefreshTrigger.disabled = false;
      });
      return;
    }

    const authCloseTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="github-auth-close"]')
      : null;
    if (authCloseTrigger instanceof HTMLElement) {
      event.preventDefault();
      closeGitHubAuthModal();
      return;
    }

    const projectDetailsCloseTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="project-details-close"]')
      : null;
    if (projectDetailsCloseTrigger instanceof HTMLElement) {
      event.preventDefault();
      closeProjectDetailsModal();
      return;
    }

    if (event.target instanceof HTMLElement && event.target.matches('[data-role="repo-picker-modal"]')) {
      event.preventDefault();
      closeRepoPicker();
      return;
    }

    if (event.target instanceof HTMLElement && event.target.matches('[data-role="model-picker-modal"]')) {
      event.preventDefault();
      closeModelPicker();
      return;
    }

    const repoPickerCloseTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="repo-picker-close"]')
      : null;
    if (repoPickerCloseTrigger instanceof HTMLElement) {
      event.preventDefault();
      closeRepoPicker();
      return;
    }

    const repoPickerOpenTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="repo-picker-open"]')
      : null;
    if (repoPickerOpenTrigger instanceof HTMLElement) {
      event.preventDefault();
      if (state.authRequired) {
        openGitHubAuthModal();
        return;
      }
      openRepoPicker().catch((error) => {
        const status = document.querySelector('[data-role="repo-picker-status"]');
        const listHost = document.querySelector('[data-role="repo-picker-list"]');
        if (status instanceof HTMLElement) {
          status.textContent = 'Atlas could not load your GitHub repositories.';
        }
        if (listHost instanceof HTMLElement) {
          listHost.innerHTML = '<div class="runtime-log-empty">' + escapeClientHtml(String(error && error.message ? error.message : error)) + '</div>';
        }
      });
      return;
    }

    const modelPickerOpenTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="model-picker-open"]')
      : null;
    if (modelPickerOpenTrigger instanceof HTMLElement) {
      event.preventDefault();
      openModelPicker();
      return;
    }

    const modelPickerCloseTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="model-picker-close"]')
      : null;
    if (modelPickerCloseTrigger instanceof HTMLElement) {
      event.preventDefault();
      closeModelPicker();
      return;
    }

    const modelOptionTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="model-option-button"]')
      : null;
    if (modelOptionTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      applySelectedCopilotModel(String(modelOptionTrigger.getAttribute('data-model-value') || '').trim());
      return;
    }

    const repoPickerRefreshTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="repo-picker-refresh"]')
      : null;
    if (repoPickerRefreshTrigger instanceof HTMLElement) {
      event.preventDefault();
      loadRepositoryList().catch((error) => {
        const status = document.querySelector('[data-role="repo-picker-status"]');
        if (status instanceof HTMLElement) {
          status.textContent = String(error && error.message ? error.message : error);
        }
      });
      return;
    }

    const repoSelectTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="repo-select-button"]')
      : null;
    if (repoSelectTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      const repoFullName = String(repoSelectTrigger.getAttribute('data-repo-full-name') || '').trim();
      selectRepository(repoFullName, repoSelectTrigger).catch((error) => {
        const status = document.querySelector('[data-role="repo-picker-status"]');
        if (status instanceof HTMLElement) {
          status.textContent = String(error && error.message ? error.message : error);
        }
      });
      return;
    }

    const repoContextClearTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="repo-context-clear"]')
      : null;
    if (repoContextClearTrigger instanceof HTMLElement) {
      event.preventDefault();
      clearRepositoryContext().catch((error) => {
        const globalError = document.querySelector('[data-role="global-error"]');
        if (globalError instanceof HTMLElement) {
          globalError.textContent = String(error && error.message ? error.message : error);
        }
      });
      return;
    }

    if (event.target instanceof HTMLElement && event.target.matches('[data-role="runtime-log-modal"]')) {
      event.preventDefault();
      closeRuntimeLogModal();
      return;
    }

    const runtimeLogCloseTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="runtime-log-close"]')
      : null;
    if (runtimeLogCloseTrigger instanceof HTMLElement) {
      event.preventDefault();
      closeRuntimeLogModal();
      return;
    }

    const runtimeLogTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="runtime-log-button"]')
      : null;
    if (runtimeLogTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      const sessionId = String(runtimeLogTrigger.getAttribute('data-session-id') || '').trim();
      if (!sessionId || runtimeLogTrigger.disabled) {
        return;
      }
      openRuntimeLogModal(sessionId, runtimeLogTrigger).catch(() => {});
      return;
    }

    const deleteSessionTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="delete-session-button"]')
      : null;
    if (deleteSessionTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      const sessionId = String(deleteSessionTrigger.getAttribute('data-session-id') || '').trim();
      if (!sessionId || deleteSessionTrigger.disabled) {
        return;
      }
      if (!window.confirm(t('deleteProjectConfirm'))) {
        return;
      }
      const feedbackElement = document.querySelector('[data-role="build-control-feedback"]');
      deleteSessionTrigger.disabled = true;
      if (feedbackElement instanceof HTMLElement) {
        feedbackElement.textContent = t('deleteProjectFeedback');
      }
      fetch('/api/session/delete', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'ATLAS could not delete this project.');
        }
        stopRuntimePolling();
        state.sessions = Array.isArray(payload.sessions) ? payload.sessions : state.sessions.filter((session) => session && session.id !== sessionId);
        if (state.sessionRuntimeStatuses && typeof state.sessionRuntimeStatuses === 'object') {
          delete state.sessionRuntimeStatuses[sessionId];
        }
        state.focusedSessionId = null;
        syncActiveSessionCounter();
        redirectToSession(null);
      }).catch((error) => {
        deleteSessionTrigger.disabled = false;
        if (feedbackElement instanceof HTMLElement) {
          feedbackElement.textContent = String(error && error.message ? error.message : error) || 'ATLAS could not delete this project.';
        }
      });
      return;
    }

    const completedPresentationRefreshTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="completed-presentation-refresh"]')
      : null;
    if (completedPresentationRefreshTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      const projectId = String(completedPresentationRefreshTrigger.getAttribute('data-project-id') || '').trim();
      const sessionId = String(completedPresentationRefreshTrigger.getAttribute('data-session-id') || '').trim();
      if (!projectId || !sessionId || completedPresentationRefreshTrigger.disabled) {
        return;
      }
      refreshCompletedPresentation(projectId, sessionId, completedPresentationRefreshTrigger).catch(() => {});
      return;
    }

    const completedSessionFilesDeleteTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="completed-session-files-delete"]')
      : null;
    if (completedSessionFilesDeleteTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      const projectId = String(completedSessionFilesDeleteTrigger.getAttribute('data-project-id') || '').trim();
      const sessionId = String(completedSessionFilesDeleteTrigger.getAttribute('data-session-id') || '').trim();
      if (!projectId || !sessionId || completedSessionFilesDeleteTrigger.disabled) {
        return;
      }
      deleteCompletedSessionFiles(projectId, sessionId, completedSessionFilesDeleteTrigger).catch(() => {});
      return;
    }

    const buildControlTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="build-control-button"]')
      : null;
    if (buildControlTrigger instanceof HTMLButtonElement) {
      event.preventDefault();
      const action = String(buildControlTrigger.getAttribute('data-build-action') || '').trim();
      const sessionId = String(buildControlTrigger.getAttribute('data-session-id') || '').trim();
      if (!action || !sessionId || buildControlTrigger.disabled) {
        return;
      }

      const controlHost = buildControlTrigger.closest('[data-role="build-control-host"]');
      const actionButtons = controlHost instanceof HTMLElement
        ? Array.from(controlHost.querySelectorAll('[data-role="build-control-button"]')).filter((button) => button instanceof HTMLButtonElement)
        : [buildControlTrigger];
      const feedbackElement = document.querySelector('[data-role="build-control-feedback"]');
      const originalFeedback = feedbackElement instanceof HTMLElement ? feedbackElement.textContent : '';
      const originalButtonState = actionButtons.map((button) => ({
        button,
        disabled: button.disabled,
        label: button.textContent || '',
      }));
      const pendingLabel = action === 'resume-build'
        ? t('resumePendingLabel')
        : t('stopPendingLabel');
      actionButtons.forEach((button) => {
        button.disabled = true;
        button.removeAttribute('aria-busy');
        button.classList.remove('build-control-button-loading');
      });
      buildControlTrigger.setAttribute('aria-busy', 'true');
      buildControlTrigger.classList.add('build-control-button-loading');
      buildControlTrigger.textContent = pendingLabel;
      if (feedbackElement instanceof HTMLElement) {
        feedbackElement.textContent = action === 'resume-build'
          ? t('resumeBuildFeedback')
          : t('stopBuildFeedback');
      }

      fetch('/api/lifecycle', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          sessionId,
          returnTo: window.location.pathname + window.location.search,
        }),
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'ATLAS could not update this build mission.');
        }
        selectedBuildAgentId = null;
        selectedBuildAgentPinned = false;
        if (feedbackElement instanceof HTMLElement) {
          feedbackElement.textContent = payload.message || 'ATLAS updated this build mission.';
        }
        await fetchRuntimeSnapshot(sessionId);
      }).catch((error) => {
        if (feedbackElement instanceof HTMLElement) {
          feedbackElement.textContent = String(error && error.message ? error.message : error) || originalFeedback || 'ATLAS could not update this build mission.';
        }
      }).finally(() => {
        window.setTimeout(() => {
          fetchRuntimeSnapshot(sessionId).catch(() => {}).finally(() => {
            originalButtonState.forEach(({ button, disabled, label }) => {
              if (!button.isConnected) {
                return;
              }
              button.disabled = disabled;
              button.textContent = label;
              button.removeAttribute('aria-busy');
              button.classList.remove('build-control-button-loading');
            });
          });
        }, 100);
      });
      return;
    }

    const buildAgentTrigger = event.target instanceof Element
      ? event.target.closest('[data-role="build-agent-card"]')
      : null;
    if (buildAgentTrigger instanceof HTMLElement) {
      event.preventDefault();
      const nextAgentId = buildAgentTrigger.getAttribute('data-agent-id');
      const isSameSelection = selectedBuildAgentId === nextAgentId;
      selectedBuildAgentId = isSameSelection ? null : nextAgentId;
      selectedBuildAgentPinned = !isSameSelection && Boolean(nextAgentId);
      renderBuildSnapshot(state.runtimeSnapshot);
      return;
    }

    const trigger = event.target instanceof Element
      ? event.target.closest('.session-rail-link[data-session-id], [data-action="new-session"]')
      : null;
    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    if (trigger.hasAttribute('data-session-id')) {
      event.preventDefault();
      markSessionRailNavigationLoading(trigger);
      redirectToSession(trigger.getAttribute('data-session-id'));
      return;
    }

    if (!trigger.hasAttribute('data-action')) {
      return;
    }

    event.preventDefault();
    if (Number(state.activeSessionCount || 0) >= Number(state.maxTrackedSessions || 0)) {
      const errorElement = document.querySelector('[data-role="global-error"]');
      if (errorElement instanceof HTMLElement) {
        errorElement.textContent = currentLanguageId === 'tr'
          ? 'ATLAS bu kabukta izin verilen en fazla canlı oturumu zaten izliyor.'
          : 'ATLAS already tracks the maximum number of live sessions in this shell.';
      }
      return;
    }
    redirectToSession(null);
  });

  const form = document.querySelector('[data-role="chat-form"]');
  const input = document.querySelector('[data-role="chat-input"]');
  const statusElement = document.querySelector('[data-role="global-status"]');

  if (form instanceof HTMLFormElement && input instanceof HTMLTextAreaElement) {
    const authForm = document.querySelector('[data-role="github-auth-form"]');
    const projectDetailsForm = document.querySelector('[data-role="project-details-form"]');
    const errorElement = form.querySelector('[data-role="global-error"]');
    const attachmentButton = form.querySelector('[data-role="composer-attach-button"]');
    const attachmentInput = form.querySelector('[data-role="attachment-input"]');
    const pendingAttachmentList = form.querySelector('[data-role="pending-attachment-list"]');
    const conversationThread = document.querySelector('[data-role="conversation-thread"]');
    const initialFocusedSession = Array.isArray(state.sessions)
      ? state.sessions.find((session) => session && session.id === state.focusedSessionId) || null
      : null;

    const setComposerBusy = (isBusy) => {
      input.disabled = isBusy;
      if (attachmentButton instanceof HTMLButtonElement) {
        attachmentButton.disabled = isBusy;
      }
      if (attachmentInput instanceof HTMLInputElement) {
        attachmentInput.disabled = isBusy;
      }
    };

    const clearPendingAttachments = () => {
      if (attachmentInput instanceof HTMLInputElement) {
        attachmentInput.value = '';
      }
      renderPendingAttachments(pendingAttachmentList, []);
    };

    const focusComposer = () => {
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    };

    const scrollThreadToBottom = () => {
      if (conversationThread instanceof HTMLElement) {
        conversationThread.scrollTop = conversationThread.scrollHeight;
      }
    };

    const getComposerSelection = () => {
      if (document.activeElement !== input) {
        return null;
      }
      return {
        start: Number.isFinite(input.selectionStart) ? input.selectionStart : input.value.length,
        end: Number.isFinite(input.selectionEnd) ? input.selectionEnd : input.value.length,
      };
    };

    const restoreComposerSelection = (selection) => {
      if (!selection) {
        return;
      }
      focusComposer();
      try {
        input.setSelectionRange(selection.start, selection.end);
      } catch {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    };

    const isThreadNearBottom = () => {
      if (!(conversationThread instanceof HTMLElement)) {
        return false;
      }
      return Math.abs(conversationThread.scrollHeight - conversationThread.scrollTop - conversationThread.clientHeight) < 56;
    };

    const buildAttachmentSignature = (session) => JSON.stringify({
      attachments: (Array.isArray(session && session.attachments) ? session.attachments : []).map((attachment) => [
        attachment && attachment.id ? attachment.id : '',
        attachment && attachment.originalName ? attachment.originalName : '',
        attachment && attachment.byteSize ? attachment.byteSize : 0,
        attachment && attachment.mediaType ? attachment.mediaType : '',
        attachment && attachment.kind ? attachment.kind : '',
        attachment && attachment.roleHint ? attachment.roleHint : '',
        attachment && attachment.storedRelativePath ? attachment.storedRelativePath : '',
      ]),
      plans: (Array.isArray(session && session.attachmentPlans) ? session.attachmentPlans : []).map((plan) => [
        plan && plan.attachmentId ? plan.attachmentId : '',
        plan && plan.intendedUse ? plan.intendedUse : '',
        plan && plan.placementHint ? plan.placementHint : '',
      ]),
    });

    const syncAssetRail = (session) => {
      const assetPanelHost = document.querySelector('[data-role="asset-panel-host"]');
      if (!(assetPanelHost instanceof HTMLElement)) {
        return;
      }
      const nextSignature = buildAttachmentSignature(session);
      if (assetPanelHost.dataset.signature === nextSignature) {
        return;
      }
      assetPanelHost.dataset.signature = nextSignature;
      assetPanelHost.innerHTML = renderAssetPanelHtml(session);
    };

    const syncConversationThread = (session) => {
      if (!(conversationThread instanceof HTMLElement)) {
        return;
      }

      const messages = Array.isArray(session && session.messages) ? session.messages : [];
      const nextIds = messages.map(getMessageKey);
      const currentIds = Array.from(conversationThread.querySelectorAll('[data-message-id]')).map((node) => String(node.getAttribute('data-message-id') || ''));
      const keepPinnedToBottom = isThreadNearBottom();

      const prefixMatches = currentIds.every((currentId, index) => nextIds[index] === currentId);
      if (!currentIds.length || currentIds.length > nextIds.length || !prefixMatches) {
        conversationThread.innerHTML = messages.map(renderMessageHtml).join('');
        if (keepPinnedToBottom) {
          scrollThreadToBottom();
        }
        return;
      }

      for (let index = currentIds.length; index < messages.length; index += 1) {
        conversationThread.insertAdjacentHTML('beforeend', renderMessageHtml(messages[index]));
      }

      if (keepPinnedToBottom && currentIds.length !== messages.length) {
        scrollThreadToBottom();
      }
    };

    const syncSidebar = (sessions, focusedSessionId) => {
      state.sessions = Array.isArray(sessions) ? sessions : [];
      state.focusedSessionId = focusedSessionId || null;
      if (!state.sessionRuntimeStatuses || typeof state.sessionRuntimeStatuses !== 'object') {
        state.sessionRuntimeStatuses = {};
      }
      state.sessions.forEach((session) => {
        if (session && !state.sessionRuntimeStatuses[session.id]) {
          state.sessionRuntimeStatuses[session.id] = deriveRuntimeStatusFromSnapshot(session, null);
        }
      });
      state.activeSessionCount = countRuntimeActiveSessions();

      const newSessionButton = document.querySelector('.sidebar-new-session');
      if (newSessionButton instanceof HTMLButtonElement) {
        const maxTrackedSessions = Number(state.maxTrackedSessions || 0);
        newSessionButton.disabled = state.activeSessionCount >= maxTrackedSessions;
        newSessionButton.classList.toggle('sidebar-new-session-active', !focusedSessionId);
        const countElement = newSessionButton.querySelector('span');
        if (countElement instanceof HTMLElement) {
          countElement.textContent = state.activeSessionCount + '/' + maxTrackedSessions;
        }
      }

      const sessionCountElement = document.querySelector('.sidebar-rail-section .sidebar-row-count');
      if (sessionCountElement instanceof HTMLElement) {
        sessionCountElement.textContent = String(state.sessions.length);
      }

      const railHost = document.querySelector('[data-role="session-rail-host"]');
      if (railHost instanceof HTMLElement) {
        railHost.innerHTML = renderSessionRailHtml(state.sessions, focusedSessionId);
      }
      syncActiveSessionCounter();
    };

    const syncTrackedSessionView = (session) => {
      const composerSelection = getComposerSelection();
      state.runtimeSnapshot = session && session.status === 'ready' ? state.runtimeSnapshot : null;
      const titleElement = document.querySelector('[data-role="conversation-title"]');
      if (titleElement instanceof HTMLElement) {
        titleElement.textContent = getSessionDisplayTitle(session);
      }

      const summaryElement = document.querySelector('[data-role="conversation-summary"]');
      if (summaryElement instanceof HTMLElement) {
        summaryElement.textContent = session.summary || session.objective || '';
      }

      const repoElement = document.querySelector('[data-role="conversation-repo"]');
      if (repoElement instanceof HTMLElement) {
        const repoSummary = getRepoContextSummary(session.repoContext || null);
        repoElement.textContent = repoSummary;
        repoElement.hidden = !repoSummary;
      }

      const updatedAtElement = document.querySelector('[data-role="conversation-updated-at"]');
      if (updatedAtElement instanceof HTMLElement) {
        updatedAtElement.textContent = formatTimestamp(session.updatedAt);
      }

      const statusPillHost = document.querySelector('[data-role="conversation-status-pill-host"]');
      if (statusPillHost instanceof HTMLElement) {
        statusPillHost.innerHTML = renderStatusPillHtml(session);
      }

      syncAssetRail(session);
      syncConversationThread(session);

      form.setAttribute('data-session-id', session.id);
      state.focusedSessionId = session.id;
      window.history.replaceState({}, '', '/?focusSession=' + encodeURIComponent(session.id));
      syncSelectedSessionMode(session);
      if (session.status !== 'ready') {
        restoreComposerSelection(composerSelection);
      }
    };

    syncLocalizedUi = () => {
      syncStaticTranslations();
      syncLanguagePicker(currentLanguageId);
      syncThemePicker(document.documentElement.dataset.theme || ${JSON.stringify(ATLAS_DEFAULT_THEME)}, currentLanguageId);
      syncProjectEntryUi();
      syncCopilotUsage(state.githubAuth, state.copilotUsage);

      const continuityHost = document.querySelector('[data-role="continuity-card-host"]');
      if (continuityHost instanceof HTMLElement) {
        continuityHost.innerHTML = renderContinuityCardHtml(true);
      }

      const focusedSession = Array.isArray(state.sessions)
        ? state.sessions.find((session) => session && session.id === state.focusedSessionId)
        : null;
      if (focusedSession) {
        syncTrackedSessionView(focusedSession);
      }

      const railHost = document.querySelector('[data-role="session-rail-host"]');
      if (railHost instanceof HTMLElement) {
        railHost.innerHTML = renderSessionRailHtml(state.sessions, state.focusedSessionId);
      }

      const globalStatus = document.querySelector('[data-role="global-status"]');
      if (globalStatus instanceof HTMLElement && !form.getAttribute('data-session-id')) {
        if (Number(state.activeSessionCount || 0) < Number(state.maxTrackedSessions || 0)) {
          globalStatus.textContent = t('globalStatusReady');
        }
      }
    };

    const sendChatRequest = async ({ message, attachments, projectName = '', projectDescription = '' }) => {
      setComposerBusy(true);
      const sessionId = form.getAttribute('data-session-id');
      const hasSessionId = Boolean(sessionId);
      const activeRepoContext = !hasSessionId && state.repoContext && state.repoContext.targetRepo
        ? state.repoContext
        : null;
      const normalizedProjectName = String(projectName || '').trim();
      const normalizedProjectDescription = String(projectDescription || '').trim();

      setLoadingOverlay(
        true,
        hasSessionId
          ? 'Atlas is processing your onboarding answer'
          : (!activeRepoContext
              ? 'Atlas is creating ' + (normalizedProjectName || 'your new project repo')
              : activeRepoContext.repoMode === 'existing'
                ? 'Atlas is loading existing-project onboarding'
                : 'Atlas is opening the new project repo'),
        hasSessionId
          ? (attachments.length > 0
              ? 'The prompt and attached files are being folded into the tracked session.'
              : 'The current prompt is being converted into the next live session state.')
          : (!activeRepoContext
              ? 'Atlas is creating the GitHub repository from the project details you provided before opening the first onboarding session.'
              : 'The first session will use ' + activeRepoContext.targetRepo + ' as its repository context.'),
      );
      if (errorElement instanceof HTMLElement) {
        errorElement.textContent = '';
      }
      if (statusElement instanceof HTMLElement) {
        statusElement.textContent = hasSessionId
          ? (attachments.length > 0
              ? 'Atlas is sending this message and its attached files into the onboarding flow.'
              : 'Atlas is sending this message into the onboarding flow.')
          : (!activeRepoContext
              ? 'Atlas is creating ' + (normalizedProjectName || 'the new GitHub repo') + ' and turning your message into the first onboarding session.'
              : 'Atlas is opening the first onboarding session against ' + activeRepoContext.targetRepo + '.');
      }

      try {
        const requestFormData = new FormData();
        requestFormData.set('message', message);
        if (sessionId) {
          requestFormData.set('sessionId', sessionId);
        }
        if (!hasSessionId) {
          const selectedModel = getSelectedCopilotModel();
          if (selectedModel) {
            requestFormData.set('selectedModel', selectedModel);
          }
        }
        if (!hasSessionId && !activeRepoContext) {
          requestFormData.set('projectName', normalizedProjectName);
          requestFormData.set('projectDescription', normalizedProjectDescription);
        }
        attachments.forEach((file) => {
          requestFormData.append('attachments', file, file.name);
        });

        const response = await fetch('/api/chat/session', {
          method: 'POST',
          body: requestFormData,
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'Atlas could not update the session.');
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'repoContext')) {
          syncRepoContext(payload.repoContext || null);
        }

        const nextSessionId = resolvePreferredAtlasSessionId(
          payload.session && payload.session.id ? payload.session.id : null,
          Array.isArray(payload.sessions) ? payload.sessions : [],
        );
        const submittedToExistingSession = Boolean(form.getAttribute('data-session-id'));

        if (!submittedToExistingSession || !nextSessionId) {
          redirectToSession(nextSessionId);
          return;
        }

        syncSidebar(payload.sessions, nextSessionId);
        syncTrackedSessionView(payload.session);
        input.value = '';
        autoResize(input);
        clearPendingAttachments();
        setComposerBusy(false);
        if (statusElement instanceof HTMLElement) {
          statusElement.textContent = payload.session.status === 'ready'
            ? 'Atlas captured enough context to keep this session ready for delivery.'
            : 'Atlas stored your answer inside the tracked session.';
        }
        if (payload.session.status === 'ready') {
          selectedBuildAgentId = null;
          selectedBuildAgentPinned = false;
          setLoadingOverlay(
            true,
            'Atlas is handing the ready mission into build mode',
            'The right-side surface is switching from onboarding to the live build view.',
          );
          try {
            await fetchRuntimeSnapshot(payload.session.id);
          } finally {
            setLoadingOverlay(false);
          }
          return;
        }

        setLoadingOverlay(false);
        focusComposer();
      } catch (error) {
        setComposerBusy(false);
        setLoadingOverlay(false);
        if (errorElement instanceof HTMLElement) {
          errorElement.textContent = String(error && error.message ? error.message : error);
        }
        if (statusElement instanceof HTMLElement) {
          statusElement.textContent = 'Atlas kept your message in the shell because the handoff failed.';
        }
        focusComposer();
        throw error;
      }
    };

    autoResize(input);
    let storedThemeId = null;
    let storedLanguageId = null;
    state.selectedCopilotModel = readStoredSelectedCopilotModel();
    try {
      storedThemeId = window.localStorage.getItem(themeStorageKey);
    } catch {
      storedThemeId = null;
    }
    try {
      storedLanguageId = window.localStorage.getItem(languageStorageKey);
    } catch {
      storedLanguageId = null;
    }
    syncLanguagePicker(storedLanguageId || document.documentElement.lang || ${JSON.stringify(ATLAS_DEFAULT_LANGUAGE)});
    syncThemePicker(storedThemeId || document.documentElement.dataset.theme || ${JSON.stringify(ATLAS_DEFAULT_THEME)}, currentLanguageId);
    syncCopilotUsage(state.githubAuth, state.copilotUsage);
    if (state.authRequired) {
      openGitHubAuthModal();
    }
    syncRepoContext(state.repoContext || null);
    syncLocalizedUi();
    scrollThreadToBottom();
    if (initialFocusedSession) {
      syncSelectedSessionMode(initialFocusedSession);
      if (initialFocusedSession.status === 'ready') {
        renderBuildSnapshot(state.runtimeSnapshot);
      }
      if (initialFocusedSession.status !== 'ready') {
        focusComposer();
      }
    } else {
      focusComposer();
    }
    input.addEventListener('input', () => autoResize(input));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeThemePicker();
        closeGitHubAuthModal();
        closeRuntimeLogModal();
        closeRepoPicker();
        closeModelPicker();
      }
    });

    document.addEventListener('input', (event) => {
      if (event.target instanceof HTMLInputElement && event.target.matches('[data-role="repo-picker-search"]')) {
        syncRepoPickerList();
      }
    });

    const composerShell = form.querySelector('.composer-entry-shell');
    if (composerShell instanceof HTMLElement) {
      composerShell.addEventListener('pointerdown', (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }
        if (event.target.closest('textarea, button, input[type="file"]')) {
          return;
        }
        window.requestAnimationFrame(() => {
          if (input.disabled) {
            return;
          }
          focusComposer();
        });
      });
    }

    if (attachmentButton instanceof HTMLButtonElement && attachmentInput instanceof HTMLInputElement) {
      attachmentButton.addEventListener('click', (event) => {
        event.preventDefault();
        attachmentInput.click();
      });
      attachmentInput.addEventListener('change', () => {
        renderPendingAttachments(pendingAttachmentList, Array.from(attachmentInput.files || []));
      });
    }

    if (authForm instanceof HTMLFormElement) {
      authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(authForm);
        const authStatusElement = document.querySelector('[data-role="github-auth-status"]');
        const authErrorElement = document.querySelector('[data-role="github-auth-error"]');
        const submitButton = authForm.querySelector('button[type="submit"]');
        if (authStatusElement instanceof HTMLElement) {
          authStatusElement.textContent = 'Atlas is validating the GitHub token and refreshing Copilot usage.';
        }
        if (authErrorElement instanceof HTMLElement) {
          authErrorElement.textContent = '';
        }
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = true;
        }

        try {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accountLogin: String(formData.get('accountLogin') || '').trim(),
              githubToken: String(formData.get('githubToken') || '').trim(),
              githubFinegrainedToken: String(formData.get('githubFinegrainedToken') || '').trim(),
            }),
          });
          const payload = await response.json();
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || 'Atlas could not save the GitHub access.');
          }

          syncCopilotUsage(payload.auth, payload.copilotUsage || null);
          authForm.reset();
          if (authStatusElement instanceof HTMLElement) {
            authStatusElement.textContent = payload.auth?.copilotTokenConfigured
              ? 'GitHub and Copilot access saved. Atlas can now use repository and Copilot APIs.'
              : 'GitHub access saved. Add a Copilot-compatible token before starting a session that needs Copilot execution.';
          }
          if (statusElement instanceof HTMLElement) {
            statusElement.textContent = payload.auth?.copilotTokenConfigured
              ? 'GitHub access is connected. Atlas is ready for repository selection and session creation.'
              : 'GitHub access is connected, but Copilot access is still missing for target-session execution.';
          }
          if (payload.auth?.copilotTokenConfigured) {
            closeGitHubAuthModal();
          }
        } catch (submitError) {
          if (authErrorElement instanceof HTMLElement) {
            authErrorElement.textContent = String(submitError && submitError.message ? submitError.message : submitError);
          }
        } finally {
          if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = false;
          }
        }
      });
    }

    if (projectDetailsForm instanceof HTMLFormElement) {
      projectDetailsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const projectDetailsData = new FormData(projectDetailsForm);
        const projectName = String(projectDetailsData.get('projectName') || '').trim();
        const projectDescription = String(projectDetailsData.get('projectDescription') || '').trim();
        const status = document.querySelector('[data-role="project-details-status"]');
        const error = document.querySelector('[data-role="project-details-error"]');
        const submitButton = projectDetailsForm.querySelector('button[type="submit"]');

        if (!projectName || !projectDescription) {
          if (error instanceof HTMLElement) {
            error.textContent = 'Project name and project description are both required.';
          }
          return;
        }

        if (status instanceof HTMLElement) {
          status.textContent = 'Atlas is creating the GitHub repository from these project details.';
        }
        if (error instanceof HTMLElement) {
          error.textContent = '';
        }
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = true;
        }

        state.pendingProjectDetails = {
          projectName,
          projectDescription,
        };
        syncProjectEntryUi();

        if (!pendingNewProjectRequest) {
          setProjectDetailsModalVisibility(false);
          if (status instanceof HTMLElement) {
            status.textContent = 'Atlas saved these project details for the next new repository.';
          }
          const globalStatus = document.querySelector('[data-role="global-status"]');
          if (globalStatus instanceof HTMLElement) {
            globalStatus.textContent = 'Saved new-project details for ' + projectName + '. Atlas will create the GitHub repository after you send the first request.';
          }
          focusComposer();
          if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = false;
          }
          return;
        }

        const queuedRequest = pendingNewProjectRequest;
        setProjectDetailsModalVisibility(false);

        try {
          await sendChatRequest({
            message: queuedRequest.message,
            attachments: queuedRequest.attachments,
            projectName,
            projectDescription,
          });
          pendingNewProjectRequest = null;
          state.pendingProjectDetails = null;
          syncProjectEntryUi();
          projectDetailsForm.reset();
        } catch (projectError) {
          setProjectDetailsModalVisibility(true);
          if (error instanceof HTMLElement) {
            error.textContent = String(projectError && projectError.message ? projectError.message : projectError);
          }
        } finally {
          if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = false;
          }
        }
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.authRequired) {
        if (errorElement instanceof HTMLElement) {
          errorElement.textContent = 'Connect GitHub before starting a new Atlas session.';
        }
        openGitHubAuthModal();
        return;
      }
      const message = String(input.value || '').trim();
      const selectedFiles = attachmentInput instanceof HTMLInputElement ? Array.from(attachmentInput.files || []) : [];
      if (!message) {
        if (errorElement instanceof HTMLElement) {
          errorElement.textContent = 'Write a concrete message before sending it.';
        }
        focusComposer();
        return;
      }
      const hasSessionId = Boolean(form.getAttribute('data-session-id'));
      const activeRepoContext = !hasSessionId && state.repoContext && state.repoContext.targetRepo
        ? state.repoContext
        : null;
      if (errorElement instanceof HTMLElement) {
        errorElement.textContent = '';
      }

      if (!hasSessionId && !activeRepoContext) {
        const preparedProjectDetails = getPreparedProjectDetails();
        if (preparedProjectDetails) {
          try {
            await sendChatRequest({
              message,
              attachments: selectedFiles,
              projectName: preparedProjectDetails.projectName,
              projectDescription: preparedProjectDetails.projectDescription,
            });
            state.pendingProjectDetails = null;
            syncProjectEntryUi();
          } catch {
          }
          return;
        }

        pendingNewProjectRequest = {
          message,
          attachments: selectedFiles,
        };
        if (statusElement instanceof HTMLElement) {
          statusElement.textContent = 'Atlas needs the project name and description before it can create the new repository.';
        }
        openProjectDetailsModal();
        return;
      }

      try {
        await sendChatRequest({
          message,
          attachments: selectedFiles,
        });
      } catch {
      }
    });
  } else if (state.runtimeSnapshot) {
    renderBuildSnapshot(state.runtimeSnapshot);
  }
})();
</script>`;
}

function renderAtlasAppShell(pageData: AtlasPageData): string {
  const mainPaneMode = resolveMainPaneMode(pageData);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageData.title || "ATLAS")}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f1e8;
      --bg-glow-a: rgba(255, 255, 255, 0.76);
      --bg-glow-b: rgba(196, 169, 138, 0.24);
      --surface-soft: rgba(65, 86, 107, 0.05);
      --surface-strong: rgba(65, 86, 107, 0.09);
      --line: rgba(56, 73, 89, 0.14);
      --line-strong: rgba(42, 60, 77, 0.24);
      --text: #18222c;
      --muted: #697786;
      --muted-strong: #334456;
      --shadow: 0 24px 72px rgba(108, 92, 72, 0.14);
      --active: #1ccf74;
      --complete: #2f7a51;
      --accent: #45657f;
      --accent-soft: rgba(69, 101, 127, 0.09);
      --accent-hover: rgba(69, 101, 127, 0.14);
      --accent-border: rgba(69, 101, 127, 0.18);
      --accent-strong: #27445c;
      --danger-border: rgba(170, 78, 72, 0.24);
      --danger-soft: rgba(170, 78, 72, 0.1);
      --danger-hover: rgba(170, 78, 72, 0.16);
      --danger-strong: #8b3934;
      --loop-current-border: rgba(28, 207, 116, 0.42);
      --loop-current-glow: rgba(28, 207, 116, 0.14);
      --loop-done-border: rgba(54, 128, 82, 0.38);
      --loop-done-glow: rgba(54, 128, 82, 0.12);
      --scroll-thumb: rgba(62, 79, 95, 0.34);
      --scroll-track: rgba(62, 79, 95, 0.08);
      --scrim: rgba(73, 84, 99, 0.22);
      --panel-top: rgba(255, 251, 246, 0.96);
      --panel-bottom: rgba(245, 238, 229, 0.99);
      --panel-strong-top: rgba(252, 246, 239, 0.98);
      --panel-strong-bottom: rgba(239, 231, 221, 0.99);
      --panel-active-top: rgba(238, 231, 222, 0.99);
      --panel-active-bottom: rgba(228, 219, 209, 0.99);
      --panel-input-top: rgba(255, 251, 247, 0.98);
      --panel-input-bottom: rgba(244, 237, 228, 0.99);
      --composer-send-bg: var(--accent-strong);
      --composer-send-color: #ffffff;
      --composer-send-shadow: none;
    }
    :root[data-theme="mist"] {
      --bg: #eff4f8;
      --bg-glow-a: rgba(255, 255, 255, 0.74);
      --bg-glow-b: rgba(158, 187, 212, 0.24);
      --text: #16212b;
      --muted: #667787;
      --muted-strong: #304355;
      --shadow: 0 24px 72px rgba(81, 105, 128, 0.14);
      --accent: #46759b;
      --accent-soft: rgba(70, 117, 155, 0.08);
      --accent-hover: rgba(70, 117, 155, 0.13);
      --accent-border: rgba(70, 117, 155, 0.18);
      --accent-strong: #244c6b;
      --panel-top: rgba(251, 253, 255, 0.96);
      --panel-bottom: rgba(237, 244, 249, 0.99);
      --panel-strong-top: rgba(245, 249, 252, 0.98);
      --panel-strong-bottom: rgba(229, 238, 245, 0.99);
      --panel-active-top: rgba(231, 240, 246, 0.99);
      --panel-active-bottom: rgba(220, 231, 239, 0.99);
      --panel-input-top: rgba(253, 255, 255, 0.98);
      --panel-input-bottom: rgba(236, 243, 249, 0.99);
    }
    :root[data-theme="sage"] {
      --bg: #eef4ed;
      --bg-glow-a: rgba(255, 255, 255, 0.72);
      --bg-glow-b: rgba(160, 187, 162, 0.24);
      --text: #18251d;
      --muted: #67776b;
      --muted-strong: #314438;
      --shadow: 0 24px 72px rgba(86, 108, 90, 0.14);
      --accent: #446d59;
      --accent-soft: rgba(68, 109, 89, 0.08);
      --accent-hover: rgba(68, 109, 89, 0.13);
      --accent-border: rgba(68, 109, 89, 0.18);
      --accent-strong: #294938;
      --panel-top: rgba(250, 253, 248, 0.96);
      --panel-bottom: rgba(236, 244, 233, 0.99);
      --panel-strong-top: rgba(243, 248, 241, 0.98);
      --panel-strong-bottom: rgba(228, 237, 225, 0.99);
      --panel-active-top: rgba(229, 238, 226, 0.99);
      --panel-active-bottom: rgba(218, 229, 215, 0.99);
      --panel-input-top: rgba(251, 254, 249, 0.98);
      --panel-input-bottom: rgba(237, 244, 234, 0.99);
    }
    :root[data-theme="petal"] {
      --bg: #faf0ec;
      --bg-glow-a: rgba(255, 255, 255, 0.74);
      --bg-glow-b: rgba(214, 173, 164, 0.26);
      --text: #241d1d;
      --muted: #7a6968;
      --muted-strong: #4f3f40;
      --shadow: 0 24px 72px rgba(135, 101, 97, 0.14);
      --accent: #866061;
      --accent-soft: rgba(134, 96, 97, 0.08);
      --accent-hover: rgba(134, 96, 97, 0.13);
      --accent-border: rgba(134, 96, 97, 0.18);
      --accent-strong: #644748;
      --panel-top: rgba(255, 248, 245, 0.96);
      --panel-bottom: rgba(248, 235, 231, 0.99);
      --panel-strong-top: rgba(251, 242, 238, 0.98);
      --panel-strong-bottom: rgba(240, 225, 220, 0.99);
      --panel-active-top: rgba(238, 226, 221, 0.99);
      --panel-active-bottom: rgba(229, 214, 210, 0.99);
      --panel-input-top: rgba(255, 249, 246, 0.98);
      --panel-input-bottom: rgba(247, 235, 231, 0.99);
    }
    :root[data-theme="graphite"] {
      color-scheme: dark;
      --bg: #0e1012;
      --bg-glow-a: rgba(255, 255, 255, 0.05);
      --bg-glow-b: rgba(166, 175, 188, 0.12);
      --surface-soft: rgba(255, 255, 255, 0.04);
      --surface-strong: rgba(255, 255, 255, 0.08);
      --line: rgba(228, 233, 240, 0.1);
      --line-strong: rgba(239, 243, 247, 0.18);
      --text: #f4f6f8;
      --muted: #9ca5b1;
      --muted-strong: #d8dde4;
      --shadow: 0 24px 72px rgba(0, 0, 0, 0.34);
      --active: #64d997;
      --complete: #e0e7ee;
      --accent: #d9dfe7;
      --accent-soft: rgba(217, 223, 231, 0.12);
      --accent-hover: rgba(217, 223, 231, 0.18);
      --accent-border: rgba(217, 223, 231, 0.2);
      --accent-strong: #f8fafc;
      --danger-border: rgba(255, 122, 122, 0.34);
      --danger-soft: rgba(255, 122, 122, 0.12);
      --danger-hover: rgba(255, 122, 122, 0.18);
      --danger-strong: #ffd3d3;
      --loop-current-border: rgba(100, 217, 151, 0.42);
      --loop-current-glow: rgba(100, 217, 151, 0.14);
      --loop-done-border: rgba(70, 201, 125, 0.38);
      --loop-done-glow: rgba(70, 201, 125, 0.12);
      --scroll-thumb: rgba(255, 255, 255, 0.24);
      --scroll-track: rgba(255, 255, 255, 0.06);
      --scrim: rgba(5, 5, 5, 0.72);
      --panel-top: rgba(20, 23, 28, 0.97);
      --panel-bottom: rgba(10, 12, 15, 0.99);
      --panel-strong-top: rgba(28, 31, 37, 0.98);
      --panel-strong-bottom: rgba(14, 16, 20, 0.99);
      --panel-active-top: rgba(36, 39, 45, 0.98);
      --panel-active-bottom: rgba(16, 18, 21, 0.99);
      --panel-input-top: rgba(34, 37, 43, 0.98);
      --panel-input-bottom: rgba(20, 23, 27, 0.99);
    }
    :root[data-theme="carbon"] {
      color-scheme: dark;
      --bg: #090a0c;
      --bg-glow-a: rgba(255, 255, 255, 0.035);
      --bg-glow-b: rgba(176, 184, 194, 0.1);
      --surface-soft: rgba(255, 255, 255, 0.04);
      --surface-strong: rgba(255, 255, 255, 0.08);
      --line: rgba(228, 233, 240, 0.1);
      --line-strong: rgba(239, 243, 247, 0.18);
      --text: #f5f7fa;
      --muted: #a3aab4;
      --muted-strong: #d9dfe6;
      --shadow: 0 24px 72px rgba(0, 0, 0, 0.36);
      --active: #64d997;
      --complete: #e1e8ef;
      --accent: #d7dde5;
      --accent-soft: rgba(215, 221, 229, 0.1);
      --accent-hover: rgba(215, 221, 229, 0.16);
      --accent-border: rgba(215, 221, 229, 0.18);
      --accent-strong: #f8fafc;
      --danger-border: rgba(255, 122, 122, 0.34);
      --danger-soft: rgba(255, 122, 122, 0.12);
      --danger-hover: rgba(255, 122, 122, 0.18);
      --danger-strong: #ffd3d3;
      --loop-current-border: rgba(100, 217, 151, 0.42);
      --loop-current-glow: rgba(100, 217, 151, 0.14);
      --loop-done-border: rgba(70, 201, 125, 0.38);
      --loop-done-glow: rgba(70, 201, 125, 0.12);
      --scroll-thumb: rgba(255, 255, 255, 0.24);
      --scroll-track: rgba(255, 255, 255, 0.06);
      --scrim: rgba(5, 5, 5, 0.72);
      --panel-top: rgba(16, 18, 22, 0.97);
      --panel-bottom: rgba(8, 9, 12, 0.99);
      --panel-strong-top: rgba(23, 25, 30, 0.98);
      --panel-strong-bottom: rgba(12, 13, 16, 0.99);
      --panel-active-top: rgba(30, 33, 39, 0.98);
      --panel-active-bottom: rgba(14, 15, 18, 0.99);
      --panel-input-top: rgba(27, 30, 35, 0.98);
      --panel-input-bottom: rgba(18, 20, 24, 0.99);
    }
    :root[data-theme="slate"] {
      color-scheme: dark;
      --bg: #0d1117;
      --bg-glow-a: rgba(204, 217, 236, 0.05);
      --bg-glow-b: rgba(122, 136, 158, 0.14);
      --surface-soft: rgba(255, 255, 255, 0.04);
      --surface-strong: rgba(255, 255, 255, 0.08);
      --line: rgba(228, 233, 240, 0.1);
      --line-strong: rgba(239, 243, 247, 0.18);
      --text: #eef4fb;
      --muted: #95a4b8;
      --muted-strong: #d0dae7;
      --shadow: 0 24px 72px rgba(0, 0, 0, 0.36);
      --active: #64d997;
      --complete: #dce7f2;
      --accent: #d5deea;
      --accent-soft: rgba(213, 222, 234, 0.12);
      --accent-hover: rgba(213, 222, 234, 0.18);
      --accent-border: rgba(213, 222, 234, 0.2);
      --accent-strong: #f3f7fb;
      --danger-border: rgba(255, 122, 122, 0.34);
      --danger-soft: rgba(255, 122, 122, 0.12);
      --danger-hover: rgba(255, 122, 122, 0.18);
      --danger-strong: #ffd3d3;
      --loop-current-border: rgba(100, 217, 151, 0.42);
      --loop-current-glow: rgba(100, 217, 151, 0.14);
      --loop-done-border: rgba(70, 201, 125, 0.38);
      --loop-done-glow: rgba(70, 201, 125, 0.12);
      --scroll-thumb: rgba(255, 255, 255, 0.24);
      --scroll-track: rgba(255, 255, 255, 0.06);
      --scrim: rgba(5, 5, 5, 0.72);
      --panel-top: rgba(18, 24, 32, 0.97);
      --panel-bottom: rgba(9, 13, 18, 0.99);
      --panel-strong-top: rgba(26, 34, 44, 0.98);
      --panel-strong-bottom: rgba(13, 18, 24, 0.99);
      --panel-active-top: rgba(34, 44, 56, 0.98);
      --panel-active-bottom: rgba(16, 22, 29, 0.99);
      --panel-input-top: rgba(31, 39, 49, 0.98);
      --panel-input-bottom: rgba(19, 24, 31, 0.99);
    }
    :root[data-theme="smoke"] {
      color-scheme: dark;
      --bg: #111418;
      --bg-glow-a: rgba(245, 248, 252, 0.04);
      --bg-glow-b: rgba(130, 140, 152, 0.12);
      --surface-soft: rgba(255, 255, 255, 0.04);
      --surface-strong: rgba(255, 255, 255, 0.08);
      --line: rgba(228, 233, 240, 0.1);
      --line-strong: rgba(239, 243, 247, 0.18);
      --text: #f0f3f6;
      --muted: #9aa3ac;
      --muted-strong: #d2d8de;
      --shadow: 0 24px 72px rgba(0, 0, 0, 0.36);
      --active: #64d997;
      --complete: #dde6ee;
      --accent: #d6dde4;
      --accent-soft: rgba(214, 221, 228, 0.12);
      --accent-hover: rgba(214, 221, 228, 0.18);
      --accent-border: rgba(214, 221, 228, 0.2);
      --accent-strong: #f4f7fa;
      --danger-border: rgba(255, 122, 122, 0.34);
      --danger-soft: rgba(255, 122, 122, 0.12);
      --danger-hover: rgba(255, 122, 122, 0.18);
      --danger-strong: #ffd3d3;
      --loop-current-border: rgba(100, 217, 151, 0.42);
      --loop-current-glow: rgba(100, 217, 151, 0.14);
      --loop-done-border: rgba(70, 201, 125, 0.38);
      --loop-done-glow: rgba(70, 201, 125, 0.12);
      --scroll-thumb: rgba(255, 255, 255, 0.24);
      --scroll-track: rgba(255, 255, 255, 0.06);
      --scrim: rgba(5, 5, 5, 0.72);
      --panel-top: rgba(21, 25, 30, 0.97);
      --panel-bottom: rgba(12, 15, 18, 0.99);
      --panel-strong-top: rgba(29, 34, 40, 0.98);
      --panel-strong-bottom: rgba(16, 18, 22, 0.99);
      --panel-active-top: rgba(38, 44, 51, 0.98);
      --panel-active-bottom: rgba(19, 22, 26, 0.99);
      --panel-input-top: rgba(34, 39, 45, 0.98);
      --panel-input-bottom: rgba(22, 25, 29, 0.99);
    }
    :root[data-theme="graphite"],
    :root[data-theme="carbon"],
    :root[data-theme="slate"],
    :root[data-theme="smoke"] {
      --composer-send-bg: linear-gradient(180deg, #f8fafc, #cbd3dd);
      --composer-send-color: #08090d;
      --composer-send-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42), 0 10px 24px rgba(0, 0, 0, 0.18);
    }
    * { box-sizing: border-box; }
    html, body {
      height: 100%;
      min-height: 100%;
      overflow: hidden;
    }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top center, var(--bg-glow-a), transparent 32%),
        radial-gradient(circle at top left, var(--bg-glow-b), transparent 26%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 26%),
        var(--bg);
      color: var(--text);
      font-family: "Aptos", "Segoe UI Variable Text", "Segoe UI", Arial, sans-serif;
      font-size: 14px;
    }
    button, textarea { font: inherit; }
    button { color: inherit; }
    h1, h2, p { margin: 0; }
    main {
      height: 100dvh;
      min-height: 100dvh;
      padding: 22px;
      overflow: hidden;
    }
    .shell {
      display: grid;
      grid-template-columns: minmax(274px, 304px) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      gap: 18px;
      height: calc(100dvh - 44px);
      max-height: calc(100dvh - 44px);
      min-height: 0;
      max-width: 1480px;
      margin: 0 auto;
    }
    .shell-transition .main-shell { animation: shell-shift 260ms ease; }
    @keyframes shell-shift {
      from { transform: translateY(18px); opacity: 0.32; }
      to { transform: translateY(0); opacity: 1; }
    }
    .desktop-sidebar,
    .main-shell,
    .session-rail-link,
    .sidebar-brand,
    .sidebar-new-session,
    .sidebar-history-link,
    .composer-card,
    .message-card {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      box-shadow: var(--shadow);
    }
    .desktop-sidebar {
      height: 100%;
      border-radius: 24px;
      padding: 12px;
      display: grid;
      grid-template-rows: auto auto auto auto minmax(0, 1fr) auto;
      gap: 6px;
      backdrop-filter: blur(18px);
      overflow: hidden;
    }
    .sidebar-brand,
    .sidebar-new-session,
    .sidebar-history-link,
    .session-rail-link {
      width: 100%;
      border-radius: 16px;
      text-align: left;
    }
    .sidebar-brand,
    .sidebar-new-session,
    .sidebar-history-link {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 9px;
      padding: 9px 10px;
      cursor: pointer;
    }
    .sidebar-brand {
      border: 0;
      background: transparent;
      box-shadow: none;
      padding-inline: 4px;
    }
    .sidebar-new-session,
    .sidebar-history-link {
      justify-content: space-between;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
    }
    .sidebar-new-session-active,
    .sidebar-history-link-active,
    .session-rail-link-selected {
      border-color: var(--line-strong);
      background: linear-gradient(180deg, var(--panel-active-top), var(--panel-active-bottom));
    }
    .sidebar-new-session:disabled {
      opacity: 0.52;
      cursor: not-allowed;
    }
    .sidebar-history-link {
      color: inherit;
      text-decoration: none;
    }
    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: block;
      object-fit: contain;
      background: transparent;
    }
    .brand-title {
      font-family: "Bahnschrift", "Aptos Display", "Segoe UI Variable Display", sans-serif;
      font-size: 16px;
      letter-spacing: -0.04em;
    }
    .sidebar-compact-stack {
      display: grid;
      gap: 6px;
      min-height: 0;
    }
    .sidebar-rail-section,
    .session-rail,
    .new-session-shell,
    .conversation-shell,
    .conversation-thread,
    .conversation-header,
    .conversation-header-main,
    .session-rail-header,
    .composer-meta {
      display: grid;
      gap: 10px;
    }
    .section-heading,
    .session-rail-header,
    .conversation-header,
    .conversation-header-side,
    .message-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .section-heading h2,
    .sidebar-row-count,
    .support-copy,
    .session-rail-link p,
    .message-meta,
    .eyebrow {
      color: var(--muted);
    }
    .section-heading h2 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-weight: 600;
    }
    .sidebar-row-count {
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      font-size: 9px;
      letter-spacing: 0.06em;
    }
    .sidebar-rail-section {
      grid-template-rows: auto minmax(0, 1fr);
      align-content: start;
      min-height: 0;
    }
    .session-rail {
      overflow: auto;
      align-content: start;
      justify-content: start;
      justify-items: stretch;
      grid-template-columns: minmax(0, 1fr);
      place-content: start;
      grid-auto-rows: max-content;
      min-height: 0;
      padding-right: 0;
      overscroll-behavior: contain;
    }
    .session-rail-link {
      box-sizing: border-box;
      width: 100%;
      justify-self: stretch;
      min-width: 0;
      border-radius: 14px;
      display: grid;
      gap: 8px;
      padding: 10px 11px;
      cursor: pointer;
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
    }
    .session-rail-link-loading {
      cursor: progress;
      border-color: var(--loop-current-border);
      box-shadow: inset 0 0 0 1px var(--loop-current-border), 0 0 0 4px var(--loop-current-glow);
      animation: atlas-rail-loading 1.15s ease-in-out infinite;
    }
    .atlas-nav-loading {
      cursor: progress;
      box-shadow: inset 0 0 0 1px var(--loop-current-border), 0 0 0 4px var(--loop-current-glow);
      animation: atlas-rail-loading 1.15s ease-in-out infinite;
    }
    @keyframes atlas-rail-loading {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.72; }
    }
    .session-rail-header {
      flex-wrap: nowrap;
      align-items: flex-start;
    }
    .session-rail-header strong {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 12px;
      line-height: 1.25;
      letter-spacing: -0.02em;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .session-rail-header .status-pill {
      flex: 0 0 auto;
    }
    .session-rail-link p {
      width: 100%;
      line-height: 1.38;
      font-size: 11px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .sidebar-empty {
      padding: 12px;
      border-radius: 14px;
      border: 1px dashed var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
    }
    .main-shell {
      height: 100%;
      min-height: 0;
      border-radius: 28px;
      padding: 24px;
      overflow: hidden;
      display: grid;
      backdrop-filter: blur(18px);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
    }
    .main-shell > [data-role="main-host"] {
      min-height: 0;
      height: 100%;
      display: grid;
      grid-template-rows: minmax(0, 1fr);
      overflow: hidden;
    }
    .main-shell > [data-role="main-host"] > * {
      min-height: 0;
    }
    .main-pane,
    .new-session-shell,
    .conversation-shell {
      height: 100%;
      min-height: 0;
    }
    .main-pane {
      position: relative;
      display: grid;
      grid-template-rows: minmax(0, 1fr);
      min-height: 0;
      overflow: hidden;
    }
    .main-pane-start {
      display: grid;
      place-items: center;
      min-height: 0;
      padding: 0;
      overflow: auto;
    }
    .main-pane-history {
      min-height: 0;
      overflow: auto;
      padding-right: 4px;
      scrollbar-gutter: stable;
    }
    .history-shell {
      display: grid;
      gap: 18px;
      align-content: start;
      min-height: 100%;
      width: min(1160px, 100%);
      min-width: 0;
      margin: 0 auto;
      padding-bottom: 28px;
    }
    .history-shell-detail {
      width: min(1040px, 100%);
    }
    .history-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .history-header > div {
      min-width: 0;
      display: grid;
      gap: 4px;
    }
    .history-heading {
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1;
      letter-spacing: -0.05em;
      overflow-wrap: anywhere;
    }
    .history-copy {
      max-width: 860px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .history-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
      gap: 14px;
      min-width: 0;
    }
    .history-list-compact {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .history-card,
    .history-empty,
    .history-detail-card {
      border-radius: 20px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      box-shadow: var(--shadow);
    }
    .history-card {
      display: grid;
      gap: 12px;
      padding: 18px;
      min-width: 0;
      align-content: start;
      color: inherit;
      text-decoration: none;
    }
    .history-list-compact .history-card {
      gap: 8px;
      padding: 16px 18px;
    }
    .history-card-topline,
    .history-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .history-card-title {
      font-size: 20px;
      line-height: 1.1;
      letter-spacing: -0.04em;
      overflow-wrap: anywhere;
    }
    .history-card-summary {
      color: var(--muted-strong);
      line-height: 1.6;
      font-size: 14px;
      overflow-wrap: anywhere;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .history-list-compact .history-card-summary {
      -webkit-line-clamp: 2;
      font-size: 13px;
      line-height: 1.5;
    }
    .history-card-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
      min-width: 0;
    }
    .history-card-meta-compact {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
    }
    .history-card-meta-item {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .history-card-meta-label {
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .history-card-meta-value {
      color: var(--muted-strong);
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .history-status-pill {
      width: fit-content;
    }
    .history-empty {
      padding: 24px;
      display: grid;
      gap: 8px;
    }
    .history-back-link {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      margin-bottom: 12px;
      color: var(--muted-strong);
      text-decoration: none;
      font-size: 12px;
      line-height: 1.45;
    }
    .history-detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      min-width: 0;
      align-items: start;
    }
    .history-detail-card {
      display: grid;
      gap: 14px;
      padding: 18px;
      min-width: 0;
      overflow: hidden;
    }
    .history-detail-card-wide {
      grid-column: 1 / -1;
    }
    .history-detail-list {
      display: grid;
      gap: 10px;
      margin: 0;
      min-width: 0;
    }
    .history-detail-list div {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .history-detail-list dt {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .history-detail-list dd {
      margin: 0;
      color: var(--text);
      font-size: 14px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .history-product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
      gap: 12px;
      min-width: 0;
    }
    .history-product-card {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      min-width: 0;
      overflow: hidden;
    }
    .history-product-card p {
      margin: 0;
      line-height: 1.6;
      color: var(--muted-strong);
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .history-product-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .history-product-link {
      color: var(--accent-strong);
      text-decoration: none;
      line-height: 1.55;
      word-break: break-word;
    }
    .history-mono {
      font-family: "IBM Plex Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .history-unresolved-list {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
      color: var(--muted-strong);
      line-height: 1.6;
    }
    .new-session-shell {
      width: 100%;
      max-width: 1120px;
      margin: 0 auto;
      min-height: 100%;
      max-height: 100%;
      justify-items: center;
      align-content: center;
      gap: 10px;
      padding: 0 2px;
      text-align: center;
    }
    .new-session-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
      align-items: start;
      width: 100%;
    }
    .new-session-primary,
    .new-session-secondary {
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .new-session-primary {
        width: min(1000px, calc(100% - 20px));
      margin: 0 auto;
      padding: 8px 0 0;
      border: 0;
      background: transparent;
      box-shadow: none;
      justify-items: center;
      gap: 18px;
    }
    .new-session-intro {
        width: min(896px, calc(100% - 28px));
      display: grid;
      justify-items: center;
      gap: 10px;
    }
    .new-session-heading {
      font-family: "Bahnschrift", "Aptos Display", "Segoe UI Variable Display", sans-serif;
      font-size: clamp(20px, 2.6vw, 30px);
      line-height: 1.08;
      letter-spacing: -0.045em;
      max-width: none;
      white-space: nowrap;
    }
    .conversation-title {
      font-family: "Bahnschrift", "Aptos Display", "Segoe UI Variable Display", sans-serif;
      font-size: clamp(22px, 2.7vw, 34px);
      line-height: 1.08;
      letter-spacing: -0.05em;
    }
    .conversation-summary {
      max-width: 72ch;
    }
    .intro-copy {
      font-size: 13px;
      line-height: 1.55;
      max-width: 68ch;
      margin: 0;
    }
    .copilot-usage-host {
      width: 100%;
    }
    .copilot-usage-host-compact {
      width: 100%;
    }
    .repo-context-card,
    .copilot-usage-card,
    .workspace-note-card,
    .repo-picker-card,
    .repo-picker-item {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }
    .repo-context-card {
      border-radius: 24px;
      padding: 18px;
      display: grid;
      gap: 12px;
      text-align: left;
    }
    .copilot-usage-card {
      border-radius: 18px;
      padding: 12px;
      display: grid;
      gap: 8px;
      text-align: left;
      border-color: var(--line-strong);
    }
    .copilot-usage-card-compact {
      padding: 9px 10px;
      gap: 6px;
    }
    .copilot-usage-card-compact .copilot-usage-copy {
      font-size: 10px;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .copilot-usage-card-compact .copilot-usage-stat {
      padding: 7px 8px;
    }
    .copilot-usage-card-compact .copilot-usage-stat strong {
      font-size: 11px;
    }
    .copilot-usage-host-sidebar .copilot-usage-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    .copilot-usage-host-sidebar .copilot-usage-topline {
      align-items: flex-start;
      gap: 6px;
    }
    .copilot-usage-host-sidebar .copilot-usage-actions {
      width: 100%;
      gap: 6px;
    }
    .copilot-usage-host-sidebar .build-control-button {
      flex: 1 1 0;
      justify-content: center;
    }
    .repo-context-copy {
      display: grid;
      gap: 8px;
    }
    .copilot-usage-topline,
    .copilot-usage-actions,
    .github-auth-header,
    .github-auth-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .copilot-usage-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
      gap: 8px;
    }
    .copilot-usage-stat {
      display: grid;
      gap: 3px;
      padding: 8px 9px;
      border-radius: 12px;
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      border: 1px solid var(--line);
    }
    .copilot-usage-stat-label {
      color: var(--muted);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .copilot-usage-stat strong {
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
    .copilot-usage-copy {
      line-height: 1.45;
      font-size: 11px;
    }
    .workspace-note-card {
      border-radius: 18px;
      padding: 12px;
      display: grid;
      gap: 8px;
    }
    .workspace-note-card-compact {
      padding: 9px 10px;
      gap: 5px;
    }
    .workspace-note-card-compact .workspace-note-copy {
      font-size: 10.5px;
      line-height: 1.34;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .workspace-note-meta-compact {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .workspace-note-title,
    .copilot-usage-title {
      font-family: "Bahnschrift", "Aptos Display", "Segoe UI Variable Display", sans-serif;
      font-size: 15px;
      line-height: 1.1;
      letter-spacing: -0.04em;
    }
    .workspace-note-copy {
      line-height: 1.48;
      font-size: 12px;
    }
    .workspace-note-meta {
      display: grid;
      gap: 6px;
    }
    .repo-context-title {
      font-family: "Bahnschrift", "Aptos Display", "Segoe UI Variable Display", sans-serif;
      font-size: 22px;
      line-height: 1.1;
      letter-spacing: -0.04em;
    }
    .repo-context-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .conversation-repo {
      max-width: 72ch;
    }
    .repo-picker-modal {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--scrim);
      backdrop-filter: blur(8px);
      z-index: 24;
    }
    .github-auth-modal {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--scrim);
      backdrop-filter: blur(8px);
      z-index: 40;
    }
    .github-auth-modal[hidden] {
      display: none;
    }
    .github-auth-card {
      width: min(560px, 100%);
      border-radius: 24px;
      padding: 20px;
      display: grid;
      gap: 16px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
      box-shadow: var(--shadow);
    }
    .github-auth-form {
      display: grid;
      gap: 12px;
    }
    .github-auth-field {
      display: grid;
      gap: 6px;
      text-align: left;
    }
    .github-auth-field span {
      color: var(--muted);
      font-size: 13px;
    }
    .github-auth-input {
      width: 100%;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-input-top), var(--panel-input-bottom));
      color: var(--text);
      padding: 12px 13px;
      outline: none;
    }
    .github-auth-input:focus {
      border-color: var(--line-strong);
    }
    .project-details-textarea {
      min-height: 118px;
      resize: vertical;
      line-height: 1.5;
      font: inherit;
    }
    .github-auth-note {
      line-height: 1.55;
    }
    .repo-picker-modal[hidden] {
      display: none;
    }
    .repo-picker-card {
      position: relative;
      z-index: 1;
      width: min(760px, 100%);
      max-height: min(72vh, 760px);
      min-height: 0;
      border-radius: 24px;
      padding: 18px;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 14px;
      overflow: hidden;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
      box-shadow: var(--shadow);
    }
    .repo-picker-header,
    .repo-picker-toolbar,
    .repo-picker-toolbar-actions,
    .repo-picker-item-topline,
    .repo-picker-item-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .repo-picker-search-input {
      flex: 1 1 280px;
      min-width: 0;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-input-top), var(--panel-input-bottom));
      color: var(--text);
      padding: 11px 13px;
      outline: none;
    }
    .repo-picker-search-input:focus {
      border-color: var(--line-strong);
    }
    .repo-picker-list {
      min-height: 0;
      overflow: auto;
      display: grid;
      gap: 10px;
      padding-right: 4px;
    }
    .repo-picker-item {
      width: 100%;
      border-radius: 18px;
      padding: 14px 15px;
      text-align: left;
      cursor: pointer;
      display: grid;
      gap: 9px;
    }
    .repo-picker-item-selected {
      border-color: var(--line-strong);
      background: linear-gradient(180deg, var(--panel-active-top), var(--panel-active-bottom));
    }
    .model-picker-status {
      margin: 0;
    }
    .model-picker-list {
      min-height: 0;
      overflow: auto;
      display: grid;
      gap: 10px;
      padding-right: 4px;
    }
    .model-picker-option-active {
      border-color: var(--line-strong);
      background: linear-gradient(180deg, var(--panel-active-top), var(--panel-active-bottom));
    }
    .repo-picker-description {
      line-height: 1.5;
    }
    .conversation-shell {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 14px;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }
    .main-pane-thread {
      height: 100%;
      min-height: 0;
    }
    .session-content,
    .conversation-mode,
    .build-shell,
    .build-layout,
    .build-agent-stack,
    .build-detail-empty,
    .build-detail-copy,
    .build-log-list,
    .build-detail-metrics {
      display: grid;
      gap: 12px;
    }
    .session-content,
    .conversation-mode,
    .build-shell {
      min-height: 0;
    }
    .build-shell {
      grid-template-rows: auto auto auto minmax(0, 1fr);
      height: 100%;
      overflow: hidden;
      align-content: stretch;
    }
    .session-content {
      grid-template-rows: minmax(0, 1fr);
      overflow: auto;
      padding-right: 4px;
      align-content: stretch;
      scrollbar-gutter: stable;
    }
    .conversation-mode {
      grid-template-rows: auto minmax(0, 1fr) auto;
      overflow: hidden;
      align-content: stretch;
    }
    .conversation-mode[hidden],
    .build-shell[hidden],
    .ui-loading-overlay[hidden] {
      display: none;
    }
    .conversation-header {
      align-items: start;
    }
    .conversation-header-side {
      justify-content: end;
      align-items: flex-start;
      gap: 10px;
    }
    .composer-card {
      border-radius: 20px;
      padding: 10px;
      display: grid;
      gap: 9px;
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
    }
    .composer-card-home {
      width: 100%;
      gap: 10px;
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
    }
    .composer-project-row,
    .composer-project-row-copy {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      text-align: left;
    }
    .composer-project-action-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      width: 100%;
    }
    .composer-project-button {
      max-width: min(100%, 320px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .composer-project-note {
      flex: 1 1 360px;
      min-width: 0;
      font-size: 12px;
      line-height: 1.45;
    }
    .composer-model-note {
      flex-basis: 100%;
    }
    .pending-attachment-list,
    .asset-rail,
    .asset-rail-track {
      display: grid;
      gap: 12px;
    }
    .pending-attachment-list[hidden] {
      display: none;
    }
    .pending-attachment-list {
      grid-auto-flow: column;
      grid-auto-columns: minmax(180px, 220px);
      overflow: auto;
      padding-bottom: 2px;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    .pending-attachment-chip,
    .asset-rail-card {
      border-radius: 16px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      padding: 9px 11px;
    }
    .pending-attachment-chip {
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .pending-attachment-chip strong,
    .asset-card-title {
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
    }
    .pending-attachment-chip span,
    .asset-card-meta,
    .asset-card-placement {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }
    .asset-rail {
      gap: 10px;
      min-height: 0;
      overflow: hidden;
    }
    .asset-rail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .asset-rail-track {
      grid-auto-flow: column;
      grid-auto-columns: minmax(220px, 260px);
      overflow: auto;
      padding: 2px 4px 4px 0;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    .asset-rail-card {
      display: grid;
      gap: 6px;
      min-height: 0;
    }
    .asset-card-header,
    .asset-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .asset-card-title {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .asset-rail-copy {
      font-size: 12px;
      line-height: 1.5;
      color: var(--muted-strong);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .asset-card-placement {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .build-hero,
    .build-progress-topline,
    .build-detail-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .build-hero,
    .build-progress-card,
    .build-agent-card,
    .build-detail-card,
    .loading-card {
      border-radius: 20px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
      box-shadow: var(--shadow);
    }
    .build-hero,
    .build-progress-card,
    .build-detail-card {
      padding: 16px 18px;
    }
    .build-progress-meta {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }
    .build-progress-statline {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .build-runtime-stat {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
    }
    .build-runtime-stat-label {
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .build-runtime-stat-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
    }
    .build-mission-copy {
      display: grid;
      gap: 8px;
      max-width: 640px;
    }
    .build-mission-title {
      margin: 0;
      font-size: clamp(20px, 2.6vw, 30px);
      line-height: 1.08;
      letter-spacing: -0.05em;
    }
    .build-mission-summary,
    .build-state-copy,
    .build-progress-detail {
      max-width: 70ch;
    }
    .build-state-card {
      display: grid;
      gap: 8px;
      min-width: min(250px, 100%);
      max-width: 320px;
      justify-items: start;
    }
    .build-state-badge {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .build-state-queued {
      background: rgba(255, 214, 102, 0.14);
      border-color: rgba(255, 214, 102, 0.35);
      color: #ffe093;
    }
    .build-state-running {
      background: rgba(28, 207, 116, 0.16);
      border-color: rgba(28, 207, 116, 0.34);
      color: #8ff0ba;
    }
    .build-state-paused {
      background: rgba(146, 178, 255, 0.16);
      border-color: rgba(146, 178, 255, 0.34);
      color: #b8ccff;
    }
    .build-state-completed {
      background: rgba(120, 206, 255, 0.16);
      border-color: rgba(120, 206, 255, 0.34);
      color: #9adfff;
    }
    .build-state-error {
      background: rgba(255, 122, 122, 0.16);
      border-color: rgba(255, 122, 122, 0.34);
      color: #ffb3b3;
    }
    .build-progress-card {
      gap: 12px;
      display: grid;
    }
    .build-control-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      flex-wrap: wrap;
    }
    .build-control-copy {
      display: grid;
      gap: 6px;
      max-width: 68ch;
    }
    .build-control-note {
      margin: 0;
    }
    .build-control-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    [data-role="build-control-host"] [data-role="delete-session-button"] {
      display: none !important;
    }
    .build-control-button {
      appearance: none;
      border: 1px solid var(--accent-border);
      background: var(--accent-soft);
      color: var(--text);
      border-radius: 999px;
      min-height: 34px;
      padding: 7px 13px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, opacity 140ms ease;
    }
    .build-control-button:hover:not(:disabled) {
      transform: translateY(-1px);
      border-color: var(--line-strong);
      background: var(--accent-hover);
    }
    .build-control-button:disabled {
      opacity: 0.48;
      cursor: not-allowed;
    }
    .build-control-button-secondary {
      border-color: var(--line);
      background: var(--surface-soft);
      color: var(--muted-strong);
    }
    .build-control-button-secondary:hover:not(:disabled) {
      border-color: var(--line-strong);
      background: var(--surface-strong);
    }
    .build-control-button-compact {
      min-height: 32px;
      padding: 7px 12px;
      font-size: 12px;
    }
    .build-control-button-danger {
      border-color: var(--danger-border);
      background: var(--danger-soft);
      color: var(--danger-strong);
    }
    .build-control-button-danger:hover:not(:disabled) {
      border-color: var(--danger-border);
      background: var(--danger-hover);
    }
    .build-progress-copy {
      display: grid;
      gap: 6px;
    }
    .build-progress-stage,
    .build-progress-percent {
      font-size: 18px;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }
    .build-progress-track {
      position: relative;
      height: 12px;
      border-radius: 999px;
      background: var(--surface-strong);
      overflow: hidden;
    }
    .build-progress-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), var(--muted-strong));
      box-shadow: 0 0 24px rgba(216, 221, 228, 0.16);
      transition: width 240ms ease;
    }
    .build-layout {
      min-height: 0;
      grid-template-columns: minmax(216px, 280px) minmax(0, 1fr);
      height: 100%;
      align-items: stretch;
      gap: 10px;
    }
    .build-agent-stack {
      min-height: 0;
      align-content: start;
      overflow: auto;
      padding-right: 4px;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    .build-agent-card {
      width: 100%;
      padding: 12px 14px;
      text-align: left;
      cursor: pointer;
      border: 1px solid var(--line);
      transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      color: var(--text);
    }
    .build-agent-card:hover {
      transform: translateY(-1px);
      border-color: var(--line-strong);
    }
    .build-agent-card-selected {
      background: linear-gradient(180deg, var(--panel-active-top), var(--panel-active-bottom));
    }
    .build-agent-card.state-error {
      border-color: var(--danger-border);
      box-shadow: inset 0 0 0 1px var(--danger-border);
    }
    .build-agent-card.loop-current {
      border-color: var(--loop-current-border);
      box-shadow: inset 0 0 0 1px var(--loop-current-border), 0 0 0 4px var(--loop-current-glow);
      background: linear-gradient(180deg, rgba(28, 207, 116, 0.10), var(--panel-active-bottom));
    }
    .build-agent-card.loop-done {
      border-color: var(--loop-done-border);
      box-shadow: inset 0 0 0 1px var(--loop-done-border);
      background: linear-gradient(180deg, rgba(54, 128, 82, 0.10), var(--panel));
    }
    .build-agent-topline,
    .build-agent-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .build-agent-topline strong {
      font-size: 14px;
      letter-spacing: -0.02em;
    }
    .build-agent-index,
    .build-agent-state {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .build-agent-summary {
      color: var(--muted-strong);
      font-size: 12px;
      line-height: 1.5;
    }
    .build-agent-meta {
      font-size: 11px;
      color: var(--muted);
    }
    .build-detail-card {
      min-height: 0;
      min-width: 0;
      overflow: auto;
    }
    .build-detail-empty,
    .build-detail-copy {
      min-height: 100%;
      align-content: start;
    }
    .build-detail-empty strong,
    .build-detail-title {
      font-size: 20px;
      line-height: 1.1;
      letter-spacing: -0.04em;
    }
    .build-detail-body {
      color: var(--muted-strong);
      font-size: 13px;
      line-height: 1.58;
    }
    .build-detail-metrics {
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    }
    .build-metric-card {
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--surface-soft);
      padding: 10px;
      display: grid;
      gap: 4px;
    }
    .build-metric-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .build-metric-value {
      font-size: 15px;
      line-height: 1.15;
      letter-spacing: -0.03em;
      color: var(--text);
    }
    .build-log-list {
      display: grid;
      gap: 10px;
      padding-right: 0;
    }
    .build-log-line {
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--surface-soft);
      padding: 9px 11px;
      color: var(--muted-strong);
      font-family: "IBM Plex Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .runtime-log-modal {
      position: absolute;
      inset: 0;
      z-index: 9;
      display: grid;
      place-items: center;
      padding: 20px;
      background: var(--scrim);
      backdrop-filter: blur(10px);
    }
    .runtime-log-modal[hidden] {
      display: none;
    }
    .runtime-log-card {
      width: min(980px, 100%);
      max-height: min(78vh, 760px);
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 12px;
      padding: 18px;
      border-radius: 20px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
      box-shadow: var(--shadow);
    }
    .runtime-log-header,
    .runtime-log-group-topline {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .runtime-log-title-group {
      display: grid;
      gap: 6px;
    }
    .runtime-log-title {
      font-size: 20px;
      line-height: 1.1;
      letter-spacing: -0.04em;
    }
    .runtime-log-output {
      min-height: 0;
      overflow: auto;
      display: grid;
      gap: 12px;
      padding-right: 4px;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    .runtime-log-group,
    .runtime-log-empty {
      border-radius: 16px;
      border: 1px solid var(--line);
      background: var(--surface-soft);
      padding: 12px 14px;
    }
    .runtime-log-group {
      display: grid;
      gap: 10px;
    }
    .runtime-log-group-meta,
    .runtime-log-empty {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }
    .runtime-log-pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "IBM Plex Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      color: var(--muted-strong);
    }
    .composer-card-thread {
      position: relative;
      bottom: auto;
    }
    .composer-entry-shell {
      position: relative;
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr) 42px;
      align-items: center;
      gap: 10px;
      border-radius: 18px;
      border: 1px solid var(--line-strong);
      background: linear-gradient(180deg, var(--panel-input-top), var(--panel-input-bottom));
      padding: 10px 12px;
      overflow: visible;
    }
    .composer-card-home .composer-entry-shell {
      grid-template-columns: 32px minmax(0, 1fr) 40px;
      border-color: var(--line-strong);
      background: linear-gradient(180deg, var(--panel-input-top), var(--panel-input-bottom));
      padding: 10px 14px 10px 12px;
    }
    .composer-inline-button,
    .composer-submit-button {
      border: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      align-self: center;
      padding: 0;
      box-sizing: border-box;
      appearance: none;
      line-height: 1;
    }
    .composer-inline-button {
      background: transparent;
      color: var(--muted-strong);
    }
    .composer-attach-button {
      grid-column: 1;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      padding: 0;
      font-family: inherit;
      font-size: 18px;
      line-height: 1;
      font-weight: 500;
    }
    .composer-submit-button {
      grid-column: 3;
      width: 42px;
      height: 42px;
      border-radius: 999px;
      background: var(--composer-send-bg);
      color: var(--composer-send-color);
      box-shadow: var(--composer-send-shadow);
      flex-shrink: 0;
      place-self: center;
      margin: 0;
      transform: none;
    }
    .composer-submit-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      overflow: visible;
    }
    .composer-submit-icon svg {
      display: block;
      width: 14px;
      height: 14px;
    }
    .composer-input {
      grid-column: 2;
      width: 100%;
      min-width: 0;
      min-height: 28px;
      max-height: 132px;
      resize: none;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--text);
      font-size: 14px;
      line-height: 1.45;
      padding: 3px 0;
    }
    .composer-card-home .composer-submit-button {
      width: 40px;
      height: 40px;
    }
    .composer-card-home .composer-input {
      max-height: 112px;
      min-height: 24px;
      padding: 1px 0;
    }
    .chip,
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 24px;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--surface-soft);
      color: var(--muted-strong);
      white-space: nowrap;
      font-size: 11px;
    }
    .status-pill-compact {
      min-height: 24px;
      padding: 4px 10px;
      font-size: 12px;
    }
    .status-pill-active { border-color: rgba(28, 207, 116, 0.28); color: var(--active); }
    .status-pill-complete { border-color: rgba(100, 217, 151, 0.3); }
    .status-pill-attention { border-color: var(--danger-border); }
    .status-pill-idle { border-color: rgba(122, 150, 171, 0.3); }
    .status-pill-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--active);
      box-shadow: 0 0 0 0 rgba(28, 207, 116, 0.24);
      animation: atlas-status-pulse 1.8s ease-in-out infinite;
    }
    .status-pill-complete .status-pill-dot {
      background: var(--complete);
      animation: none;
    }
    .status-pill-idle .status-pill-dot {
      background: rgba(122, 150, 171, 0.9);
      box-shadow: 0 0 0 0.32rem rgba(122, 150, 171, 0.18);
      animation: none;
    }
    .status-pill-attention .status-pill-dot {
      background: #ff8b8b;
      animation: none;
    }
    @keyframes atlas-status-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(28, 207, 116, 0.18); }
      50% { box-shadow: 0 0 0 6px rgba(28, 207, 116, 0.04); }
    }
    .global-status,
    .support-copy,
    .composer-meta {
      line-height: 1.55;
    }
    .composer-meta-home,
    .global-status,
    .composer-error {
      justify-items: start;
      text-align: left;
    }
    .composer-error {
      min-height: 1.4em;
      color: #ffb8b8;
    }
    .conversation-thread {
      min-height: 0;
      height: 100%;
      overflow-x: hidden;
      overflow-y: scroll;
      align-content: start;
      gap: 12px;
      padding-right: 4px;
      overscroll-behavior: contain;
      scrollbar-gutter: stable both-edges;
    }
    .session-rail,
    .pending-attachment-list,
    .asset-rail-track,
    .conversation-thread,
    .build-agent-stack,
    .build-detail-card,
    .runtime-log-output {
      scrollbar-width: thin;
      scrollbar-color: var(--scroll-thumb) var(--scroll-track);
    }
    .session-rail::-webkit-scrollbar,
    .pending-attachment-list::-webkit-scrollbar,
    .asset-rail-track::-webkit-scrollbar,
    .conversation-thread::-webkit-scrollbar,
    .build-agent-stack::-webkit-scrollbar,
    .build-detail-card::-webkit-scrollbar,
    .runtime-log-output::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    .session-rail::-webkit-scrollbar-track,
    .pending-attachment-list::-webkit-scrollbar-track,
    .asset-rail-track::-webkit-scrollbar-track,
    .conversation-thread::-webkit-scrollbar-track,
    .build-agent-stack::-webkit-scrollbar-track,
    .build-detail-card::-webkit-scrollbar-track,
    .runtime-log-output::-webkit-scrollbar-track {
      background: var(--scroll-track);
      border-radius: 999px;
    }
    .session-rail::-webkit-scrollbar-thumb,
    .pending-attachment-list::-webkit-scrollbar-thumb,
    .asset-rail-track::-webkit-scrollbar-thumb,
    .conversation-thread::-webkit-scrollbar-thumb,
    .build-agent-stack::-webkit-scrollbar-thumb,
    .build-detail-card::-webkit-scrollbar-thumb,
    .runtime-log-output::-webkit-scrollbar-thumb {
      background: var(--scroll-thumb);
      border-radius: 999px;
      border: 2px solid rgba(0, 0, 0, 0);
      background-clip: padding-box;
    }
    .composer-card-thread {
      align-self: end;
      position: sticky;
      bottom: 0;
      z-index: 1;
    }
    .ui-loading-overlay {
      position: absolute;
      inset: 0;
      z-index: 8;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(5, 5, 5, 0.72);
      backdrop-filter: blur(10px);
    }
    .loading-card {
      width: min(420px, 100%);
      padding: 24px;
      display: grid;
      gap: 14px;
      justify-items: start;
    }
    .loading-spinner {
      width: 42px;
      height: 42px;
      border-radius: 999px;
      border: 3px solid rgba(255, 255, 255, 0.12);
      border-top-color: #8fdfff;
      border-right-color: #65d9a5;
      animation: atlas-loading-spin 0.9s linear infinite;
    }
    .loading-title {
      font-size: 20px;
      line-height: 1.15;
      letter-spacing: -0.04em;
    }
    .loading-copy {
      max-width: 34ch;
    }
    @keyframes atlas-loading-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .message-row {
      display: flex;
      justify-content: flex-start;
    }
    .message-row-user {
      justify-content: flex-end;
    }
    .message-card {
      width: min(680px, 100%);
      border-radius: 22px;
      padding: 14px 16px;
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
      animation: message-drop 220ms ease;
    }
    .message-card-user {
      background: linear-gradient(180deg, var(--panel-active-top), var(--panel-active-bottom));
      color: var(--text);
    }
    .message-meta {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .message-card-user .message-meta { color: rgba(10, 11, 14, 0.62); }
    .message-body {
      font-size: 14px;
      line-height: 1.55;
      word-break: break-word;
    }
    @keyframes message-drop {
      from { transform: translateY(16px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .eyebrow {
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .theme-switcher {
      position: relative;
      margin-top: 2px;
    }
    .theme-switcher-button {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 11px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
      cursor: pointer;
    }
    .theme-switcher-visuals {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .theme-switcher-copy {
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .theme-switcher-copy strong {
      font-size: 12.5px;
      letter-spacing: -0.02em;
    }
    .language-chip {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      color: var(--muted-strong);
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .theme-switcher-menu {
      position: absolute;
      left: 0;
      right: 0;
      bottom: calc(100% + 8px);
      z-index: 14;
      display: grid;
      gap: 8px;
      max-height: min(60vh, 520px);
      padding: 10px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-strong-top), var(--panel-strong-bottom));
      box-shadow: var(--shadow);
      overflow: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    .theme-switcher-menu[hidden] {
      display: none;
    }
    .theme-switcher-menu-head {
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .settings-section {
      display: grid;
      gap: 8px;
    }
    .settings-section-head {
      display: grid;
      gap: 4px;
      text-align: left;
    }
    .theme-switcher-options {
      display: grid;
      gap: 6px;
    }
    .language-option-grid {
      display: grid;
      gap: 6px;
    }
    .theme-option {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 9px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--surface-soft);
      cursor: pointer;
      text-align: left;
    }
    .theme-option:hover,
    .theme-option-active {
      border-color: var(--line-strong);
      background: var(--surface-strong);
    }
    .theme-option-copy {
      display: grid;
      gap: 3px;
      min-width: 0;
    }
    .theme-option-copy strong {
      font-size: 11.5px;
      line-height: 1.2;
    }
    .theme-option-copy .support-copy {
      font-size: 10.5px;
      line-height: 1.3;
    }
    .language-option-label {
      color: var(--muted-strong);
      max-width: 78px;
      font-size: 11px;
      line-height: 1.3;
      flex-shrink: 0;
      text-align: right;
    }
    .theme-preview {
      display: inline-grid;
      grid-auto-flow: column;
      gap: 3px;
      flex-shrink: 0;
    }
    .theme-preview-swatch {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
    }
    .sidebar-brand:focus-visible,
    .sidebar-new-session:focus-visible,
    .sidebar-history-link:focus-visible,
    .session-rail-link:focus-visible,
    .composer-entry-shell:focus-within,
    .composer-submit-button:focus-visible,
    .composer-attach-button:focus-visible,
    .theme-switcher-button:focus-visible,
    .theme-option:focus-visible {
      outline: 3px solid var(--accent);
      outline-offset: 2px;
    }
    @media (max-height: 860px) and (min-width: 1081px) {
      main {
        padding: 14px;
      }
      .shell {
        gap: 14px;
        height: calc(100vh - 28px);
      }
      .desktop-sidebar {
        padding: 10px;
        gap: 5px;
      }
      .main-shell {
        padding: 18px;
      }
      .new-session-shell {
        gap: 10px;
        padding: 0;
      }
      .new-session-heading {
        font-size: clamp(18px, 2.2vw, 26px);
      }
      .sidebar-brand,
      .sidebar-new-session,
      .sidebar-history-link {
        padding: 8px 9px;
      }
      .brand-mark {
        width: 32px;
        height: 32px;
      }
      .copilot-usage-card-compact,
      .workspace-note-card-compact {
        padding: 8px 9px;
      }
      .session-rail-link {
        padding: 9px 10px;
      }
      .intro-copy {
        font-size: 12px;
        line-height: 1.55;
      }
      .conversation-title {
        font-size: clamp(20px, 2.4vw, 30px);
      }
      .build-hero,
      .build-progress-card,
      .build-detail-card {
        padding: 14px 16px;
      }
      .build-layout {
        grid-template-columns: minmax(208px, 252px) minmax(0, 1fr);
        gap: 8px;
      }
      .build-control-bar {
        padding: 10px 12px;
      }
      .build-log-list {
        gap: 8px;
      }
      .runtime-log-card {
        max-height: min(74vh, 680px);
      }
      .theme-switcher-menu {
        max-height: min(54vh, 420px);
      }
    }
    @media (max-width: 1080px) {
      html, body {
        overflow: auto;
      }
      main {
        padding: 16px;
        height: auto;
        min-height: 100dvh;
        overflow: visible;
      }
      .shell {
        grid-template-columns: 1fr;
        gap: 14px;
        height: auto;
        max-height: none;
        min-height: 0;
      }
      .desktop-sidebar,
      .main-shell {
        height: auto;
        min-height: 0;
      }
      .desktop-sidebar {
        grid-template-columns: minmax(150px, 0.8fr) repeat(2, minmax(150px, 1fr));
        grid-template-rows: auto auto auto;
        align-items: start;
      }
      .sidebar-brand,
      .sidebar-new-session,
      .sidebar-history-link {
        min-height: 58px;
      }
      .sidebar-compact-stack {
        grid-column: 1 / -1;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .sidebar-rail-section,
      .theme-switcher {
        grid-column: 1 / -1;
      }
      .session-rail {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 8px;
        max-height: 240px;
        padding-right: 2px;
      }
      .main-shell {
        min-height: 68vh;
      }
      .main-shell > [data-role="main-host"],
      .main-shell > [data-role="main-host"] > *,
      .main-pane,
      .new-session-shell,
      .conversation-shell {
        height: auto;
      }
      .main-pane,
      .conversation-shell,
      .session-content,
      .conversation-mode,
      .build-shell {
        overflow: visible;
      }
      .main-pane-start {
        min-height: 52vh;
        overflow: visible;
      }
      .session-content {
        padding-right: 0;
      }
      .conversation-thread {
        height: auto;
        min-height: 260px;
        max-height: min(54vh, 520px);
      }
      .build-shell {
        height: auto;
        grid-template-rows: none;
      }
      .build-agent-stack {
        max-height: 280px;
      }
      .build-detail-card {
        max-height: none;
      }
      .new-session-shell {
        min-height: 0;
        max-height: none;
        align-content: center;
        padding: 12px 0;
      }
      .new-session-intro {
        width: 100%;
        justify-items: center;
        text-align: center;
      }
      .new-session-heading {
        white-space: normal;
        max-width: min(22ch, 100%);
        font-size: clamp(22px, 4vw, 32px);
      }
      .repo-picker-card,
      .github-auth-card {
        max-height: calc(100dvh - 48px);
        overflow: auto;
      }
      .composer-project-row,
      .composer-project-row-copy {
        justify-content: center;
        text-align: center;
      }
      .composer-meta-home,
      .global-status,
      .composer-error {
        justify-items: center;
        text-align: center;
      }
      .build-layout {
        grid-template-columns: 1fr;
      }
      .history-detail-grid {
        grid-template-columns: 1fr;
      }
      .history-detail-card-wide {
        grid-column: auto;
      }
    }
    @media (max-width: 720px) {
      main {
        padding: 8px;
      }
      .shell {
        gap: 8px;
      }
      .main-shell,
      .desktop-sidebar {
        border-radius: 20px;
        padding: 12px;
      }
      .desktop-sidebar {
        grid-template-columns: 1fr;
        grid-template-rows: auto;
        gap: 8px;
      }
      .sidebar-brand,
      .sidebar-new-session,
      .sidebar-history-link {
        min-height: auto;
      }
      .sidebar-compact-stack {
        grid-template-columns: 1fr;
      }
      .session-rail {
        grid-template-columns: 1fr;
        max-height: 220px;
      }
      .main-shell {
        min-height: calc(100dvh - 16px);
      }
      .new-session-shell {
        align-content: start;
        justify-items: stretch;
        text-align: left;
        padding: 8px 0;
      }
      .new-session-primary,
      .new-session-intro {
        justify-items: stretch;
        text-align: left;
      }
      .new-session-heading {
        font-size: 26px;
        white-space: normal;
        max-width: 100%;
      }
      .intro-copy {
        max-width: 100%;
      }
      .new-session-grid {
        gap: 14px;
      }
      .conversation-title {
        font-size: clamp(20px, 7vw, 28px);
      }
      .composer-entry-shell {
        grid-template-columns: minmax(0, 1fr) 38px;
        gap: 8px;
        padding: 9px 12px 9px 10px;
      }
      .composer-card-home .composer-entry-shell {
        grid-template-columns: minmax(0, 1fr) 38px;
        padding: 9px 12px 9px 10px;
      }
      .composer-attach-button {
        display: none;
      }
      .composer-input {
        grid-column: 1;
      }
      .composer-submit-button {
        grid-column: 2;
      }
      .composer-project-button {
        width: 100%;
        max-width: 100%;
      }
      .composer-input {
        font-size: 16px;
      }
      .composer-submit-button,
      .composer-card-home .composer-submit-button {
        width: 38px;
        height: 38px;
      }
      .composer-project-row,
      .composer-project-row-copy,
      .composer-meta-home,
      .global-status,
      .composer-error {
        justify-content: flex-start;
        justify-items: start;
        text-align: left;
      }
      .theme-switcher-menu {
        position: static;
        margin-top: 8px;
      }
      .build-control-actions {
        width: 100%;
        align-items: stretch;
      }
      .build-control-button {
        flex: 1 1 140px;
        justify-content: center;
      }
      .build-hero,
      .build-progress-topline,
      .build-detail-head {
        flex-direction: column;
        align-items: flex-start;
      }
      .build-hero,
      .build-progress-card,
      .build-detail-card,
      .loading-card,
      .runtime-log-card {
        padding: 14px;
      }
      .build-progress-meta,
      .build-progress-statline {
        justify-content: flex-start;
        width: 100%;
      }
      .build-runtime-stat {
        flex: 1 1 150px;
      }
      .conversation-thread {
        min-height: 220px;
        max-height: 52vh;
      }
      .pending-attachment-list,
      .asset-rail-track {
        grid-auto-columns: minmax(160px, 85vw);
      }
      .repo-picker-modal,
      .github-auth-modal,
      .ui-loading-overlay {
        padding: 10px;
      }
      .repo-picker-card,
      .github-auth-card,
      .runtime-log-card {
        max-height: calc(100dvh - 20px);
        border-radius: 18px;
      }
      .repo-picker-toolbar-actions,
      .github-auth-actions {
        width: 100%;
        align-items: stretch;
      }
      .repo-picker-toolbar-actions .build-control-button,
      .github-auth-actions .build-control-button {
        width: 100%;
      }
      .build-mission-title,
      .build-detail-empty strong,
      .build-detail-title,
      .runtime-log-title {
        font-size: 18px;
      }
      .conversation-header {
        grid-template-columns: 1fr;
      }
      .history-list,
      .history-product-grid {
        grid-template-columns: 1fr;
      }
      .history-card,
      .history-detail-card,
      .history-empty {
        padding: 16px;
      }
      .history-card-meta {
        grid-template-columns: 1fr;
      }
      .history-heading {
        font-size: clamp(24px, 10vw, 34px);
        line-height: 1.05;
      }
      .conversation-header-side {
        justify-content: flex-start;
      }
      .runtime-log-modal {
        padding: 12px;
      }
      .message-card {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="shell" data-role="atlas-shell" data-main-pane-mode="${escapeHtml(mainPaneMode)}">
      <div data-role="sidebar-host">${renderSidebar(pageData)}</div>
      <section class="main-shell">
        <div data-role="main-host">${renderMainPane(pageData)}</div>
      </section>
    </section>
    ${renderGitHubAuthModal(pageData)}
  </main>
  ${renderAppScript(pageData)}
</body>
</html>`;
}

export function renderAtlasWorkspaceHtml(pageData: AtlasPageData): string {
  return renderAtlasAppShell(pageData);
}

export function renderAtlasHomeHtml(pageData: AtlasPageData): string {
  return renderAtlasWorkspaceHtml(pageData);
}

export function renderAtlasSessionsHtml(pageData: AtlasPageData): string {
  return renderAtlasWorkspaceHtml(pageData);
}
