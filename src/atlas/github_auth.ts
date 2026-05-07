import path from "node:path";
import fs from "node:fs/promises";

import { loadConfig } from "../config.js";
import { READ_JSON_REASON, readJsonSafe, writeJson } from "../core/fs_utils.js";
import { fetchCopilotAccountProfile, type CopilotAccountProfile } from "../core/copilot_plan_profile.js";
import { bootstrapEnvironment } from "../env_bootstrap.js";

type AtlasResolvedCopilotUsage = CopilotAccountProfile & {
  currentSelectionMode?: "schema" | "single";
  currentSelectionSource?: "plan_schema" | "plan_default" | "session_selection" | "custom_schema";
  currentSelectionModel?: string | null;
};

export interface AtlasGitHubAuthState {
  accountLogin: string | null;
  githubToken: string | null;
  copilotGithubToken: string | null;
  updatedAt: string | null;
}

export interface AtlasGitHubAuthSummary {
  accountLogin: string | null;
  githubTokenConfigured: boolean;
  copilotTokenConfigured: boolean;
  authRequired: boolean;
  source: "env" | "state" | "mixed" | "none";
}

export interface AtlasGitHubBootstrap {
  auth: AtlasGitHubAuthSummary;
  copilotUsage: AtlasResolvedCopilotUsage | null;
  authRequired: boolean;
}

export interface SaveAtlasGitHubAuthPayload {
  accountLogin?: string;
  githubToken?: string;
  githubFinegrainedToken?: string;
  copilotGithubToken?: string;
}

interface AtlasGitHubAuthStateRecord extends AtlasGitHubAuthState {
  schemaVersion: number;
}

const ATLAS_GITHUB_AUTH_SCHEMA_VERSION = 1;

function createDefaultAuthState(): AtlasGitHubAuthState {
  return {
    accountLogin: null,
    githubToken: null,
    copilotGithubToken: null,
    updatedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildGitHubBillingSummaryUrl(accountLogin: string): string {
  return `https://api.github.com/users/${accountLogin}/settings/billing/premium_request/usage`;
}

async function syncAtlasAccountMetadataEnv(accountLogin: string | null): Promise<void> {
  const resolvedAccountLogin = normalizeOptionalString(accountLogin);
  if (!resolvedAccountLogin) {
    return;
  }

  const billingUrl = buildGitHubBillingSummaryUrl(resolvedAccountLogin);
  process.env.BOX_COPILOT_SOURCE_ACCOUNT = resolvedAccountLogin;
  process.env.BOX_GITHUB_BILLING_SUMMARY_URL = billingUrl;

  const repoRoot = path.resolve(process.env.BOX_ROOT_DIR || process.cwd());
  const envPath = path.join(repoRoot, ".env");
  let raw = "";
  try {
    raw = await fs.readFile(envPath, "utf8");
  } catch (error) {
    const code = String((error as NodeJS.ErrnoException)?.code || "").trim().toUpperCase();
    if (code !== "ENOENT") {
      throw error;
    }
  }

  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw ? raw.split(/\r?\n/) : [];
  let sawAccountLine = false;
  let sawBillingLine = false;

  const nextLines = lines.map((line) => {
    if (/^BOX_COPILOT_SOURCE_ACCOUNT\s*=/.test(line)) {
      sawAccountLine = true;
      return `BOX_COPILOT_SOURCE_ACCOUNT=${resolvedAccountLogin}`;
    }
    if (/^BOX_GITHUB_BILLING_SUMMARY_URL\s*=/.test(line)) {
      sawBillingLine = true;
      return `BOX_GITHUB_BILLING_SUMMARY_URL=${billingUrl}`;
    }
    return line;
  });

  if (!sawAccountLine) {
    nextLines.push(`BOX_COPILOT_SOURCE_ACCOUNT=${resolvedAccountLogin}`);
  }
  if (!sawBillingLine) {
    nextLines.push(`BOX_GITHUB_BILLING_SUMMARY_URL=${billingUrl}`);
  }

  while (nextLines.length > 0 && nextLines[nextLines.length - 1] === "") {
    nextLines.pop();
  }

  const nextRaw = `${nextLines.join(newline)}${newline}`;
  if (nextRaw !== raw) {
    await fs.writeFile(envPath, nextRaw, "utf8");
  }
}

function resolveSupportedCopilotToken(...values: unknown[]): string | null {
  for (const value of values) {
    const token = normalizeOptionalString(value);
    if (!token) {
      continue;
    }
    if (token.startsWith("github_pat_") || token.startsWith("gho_") || token.startsWith("ghu_")) {
      return token;
    }
  }
  return null;
}

function resolveAtlasGitHubAuthStatePath(stateDir: string): string {
  return path.join(stateDir, "atlas", "github_auth.json");
}

function normalizeAtlasGitHubAuthState(value: unknown): AtlasGitHubAuthState | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    accountLogin: normalizeOptionalString(value.accountLogin),
    githubToken: normalizeOptionalString(value.githubToken),
    copilotGithubToken: normalizeOptionalString(value.copilotGithubToken),
    updatedAt: normalizeOptionalString(value.updatedAt),
  };
}

function resolveEffectiveAuthState(persistedState: AtlasGitHubAuthState): { authState: AtlasGitHubAuthState; source: AtlasGitHubAuthSummary["source"]; } {
  bootstrapEnvironment({ forceReload: true, preferRepoEnv: true });
  const envGitHubToken = normalizeOptionalString(process.env.GITHUB_TOKEN)
    || normalizeOptionalString(process.env.GH_TOKEN);
  const envCopilotToken = resolveSupportedCopilotToken(
    process.env.COPILOT_GITHUB_TOKEN,
    process.env.GITHUB_FINEGRADED,
  );
  const persistedGitHubToken = normalizeOptionalString(persistedState.githubToken);
  const persistedCopilotToken = resolveSupportedCopilotToken(persistedState.copilotGithubToken);

  const githubToken = envGitHubToken || persistedGitHubToken;
  const copilotGithubToken = resolveSupportedCopilotToken(
    envCopilotToken,
    persistedCopilotToken,
    githubToken,
  );
  const hasEnvToken = Boolean(envGitHubToken || envCopilotToken);
  const hasPersistedToken = Boolean(persistedGitHubToken || persistedCopilotToken);
  const source = hasEnvToken && hasPersistedToken
    ? "mixed"
    : hasEnvToken
      ? "env"
      : hasPersistedToken
        ? "state"
        : "none";

  return {
    authState: {
      accountLogin: normalizeOptionalString(persistedState.accountLogin),
      githubToken,
      copilotGithubToken,
      updatedAt: persistedState.updatedAt,
    },
    source,
  };
}

function buildAuthSummary(authState: AtlasGitHubAuthState, source: AtlasGitHubAuthSummary["source"]): AtlasGitHubAuthSummary {
  const githubTokenConfigured = Boolean(authState.githubToken);
  const copilotTokenConfigured = Boolean(resolveSupportedCopilotToken(authState.copilotGithubToken, authState.githubToken));
  return {
    accountLogin: authState.accountLogin,
    githubTokenConfigured,
    copilotTokenConfigured,
    authRequired: !githubTokenConfigured,
    source,
  };
}

function buildGitHubHeaders(token: string): Headers {
  const headers = new Headers();
  headers.set("accept", "application/vnd.github+json");
  headers.set("authorization", `Bearer ${token}`);
  headers.set("user-agent", "ATLAS-Desktop");
  headers.set("x-github-api-version", "2022-11-28");
  return headers;
}

function normalizeModelSelectionMode(value: unknown): "schema" | "single" | null {
  return value === "single" || value === "schema" ? value : null;
}

function normalizeModelSelectionSource(
  value: unknown,
): "plan_schema" | "plan_default" | "session_selection" | "custom_schema" | null {
  return value === "plan_schema"
    || value === "plan_default"
    || value === "session_selection"
    || value === "custom_schema"
    ? value
    : null;
}

async function enrichCopilotUsageSnapshot(copilotUsage: CopilotAccountProfile | null): Promise<AtlasResolvedCopilotUsage | null> {
  if (!copilotUsage) {
    return null;
  }

  try {
    const config = await loadConfig();
    const envMetadata = (config.env || {}) as Record<string, unknown>;
    return {
      ...copilotUsage,
      currentSelectionMode: normalizeModelSelectionMode(envMetadata.copilotModelSelectionMode) || "schema",
      currentSelectionSource: normalizeModelSelectionSource(envMetadata.copilotModelSelectionSource) || "plan_schema",
      currentSelectionModel: normalizeOptionalString(envMetadata.copilotEffectiveModel),
    };
  } catch {
    return copilotUsage;
  }
}

async function fetchGitHubViewerLogin(token: string | null): Promise<string | null> {
  const resolvedToken = normalizeOptionalString(token);
  if (!resolvedToken) {
    return null;
  }

  const response = await fetch("https://api.github.com/user", {
    method: "GET",
    headers: buildGitHubHeaders(resolvedToken),
  });

  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(rawError.trim() || "GitHub token could not be validated.");
  }

  const payload = await response.json() as { login?: string };
  return normalizeOptionalString(payload.login);
}

async function fetchPreferredGitHubViewerLogin(authState: AtlasGitHubAuthState): Promise<string | null> {
  const checkedTokens = new Set<string>();
  for (const token of [authState.copilotGithubToken, authState.githubToken]) {
    const resolvedToken = normalizeOptionalString(token);
    if (!resolvedToken || checkedTokens.has(resolvedToken)) {
      continue;
    }
    checkedTokens.add(resolvedToken);
    const login = await fetchGitHubViewerLogin(resolvedToken);
    if (login) {
      return login;
    }
  }
  return null;
}

export function applyAtlasGitHubAuthToEnv(authState: AtlasGitHubAuthState): void {
  const githubToken = normalizeOptionalString(authState.githubToken);
  const copilotGithubToken = resolveSupportedCopilotToken(authState.copilotGithubToken, githubToken);

  if (githubToken) {
    process.env.GITHUB_TOKEN = githubToken;
    process.env.GH_TOKEN = githubToken;
  }
  if (copilotGithubToken) {
    process.env.COPILOT_GITHUB_TOKEN = copilotGithubToken;
    process.env.GITHUB_FINEGRADED = copilotGithubToken;
  } else {
    delete process.env.COPILOT_GITHUB_TOKEN;
    delete process.env.GITHUB_FINEGRADED;
  }
}

export async function readAtlasGitHubAuthState(stateDir: string): Promise<AtlasGitHubAuthState> {
  const statePath = resolveAtlasGitHubAuthStatePath(stateDir);
  const stateResult = await readJsonSafe(statePath);
  if (!stateResult.ok) {
    if (stateResult.reason === READ_JSON_REASON.INVALID) {
      console.error(`[atlas] failed to read GitHub auth state: ${String(stateResult.error?.message || stateResult.error)}`);
    }
    return createDefaultAuthState();
  }

  const normalizedState = normalizeAtlasGitHubAuthState(stateResult.data);
  if (normalizedState) {
    return normalizedState;
  }

  console.error(`[atlas] invalid GitHub auth payload: ${statePath}`);
  return createDefaultAuthState();
}

export async function hydrateAtlasGitHubAuthFromState(stateDir: string): Promise<AtlasGitHubAuthState> {
  const persistedState = await readAtlasGitHubAuthState(stateDir);
  const { authState } = resolveEffectiveAuthState(persistedState);
  applyAtlasGitHubAuthToEnv(authState);
  return authState;
}

export async function resolveAtlasGitHubBootstrap(stateDir: string): Promise<AtlasGitHubBootstrap> {
  const persistedState = await readAtlasGitHubAuthState(stateDir);
  const { authState, source } = resolveEffectiveAuthState(persistedState);
  applyAtlasGitHubAuthToEnv(authState);

  let accountLogin = authState.accountLogin;
  let copilotUsage: AtlasResolvedCopilotUsage | null;

  if (authState.copilotGithubToken || authState.githubToken) {
    try {
      accountLogin = await fetchPreferredGitHubViewerLogin(authState);
    } catch {
      accountLogin = authState.accountLogin;
    }
  }

  try {
    await syncAtlasAccountMetadataEnv(accountLogin);
  } catch (error) {
    console.error(`[atlas] failed to sync GitHub account metadata into .env: ${String((error as Error)?.message || error)}`);
  }

  try {
    copilotUsage = await enrichCopilotUsageSnapshot(
      await fetchCopilotAccountProfile(authState.copilotGithubToken || authState.githubToken),
    );
  } catch {
    copilotUsage = null;
  }

  const summary = buildAuthSummary({
    ...authState,
    accountLogin,
  }, source);

  return {
    auth: summary,
    copilotUsage,
    authRequired: summary.authRequired,
  };
}

export async function saveAtlasGitHubAuth(stateDir: string, payload: SaveAtlasGitHubAuthPayload): Promise<AtlasGitHubBootstrap> {
  const githubToken = normalizeOptionalString(payload.githubToken);
  const rawCopilotToken = normalizeOptionalString(payload.githubFinegrainedToken)
    || normalizeOptionalString(payload.copilotGithubToken);

  if (!githubToken) {
    throw new Error("Enter the GitHub repo token before continuing.");
  }
  if (rawCopilotToken && !resolveSupportedCopilotToken(rawCopilotToken)) {
    throw new Error("Copilot token must be a Copilot-compatible token (github_pat_, gho_, or ghu_).");
  }

  const effectiveCopilotToken = resolveSupportedCopilotToken(rawCopilotToken, githubToken);
  const persistedCopilotToken = rawCopilotToken && rawCopilotToken !== githubToken
    ? rawCopilotToken
    : null;

  let accountLogin = await fetchPreferredGitHubViewerLogin({
    accountLogin: normalizeOptionalString(payload.accountLogin),
    githubToken,
    copilotGithubToken: effectiveCopilotToken,
    updatedAt: null,
  });
  if (!accountLogin) {
    accountLogin = normalizeOptionalString(payload.accountLogin);
  }
  if (!accountLogin) {
    throw new Error("GitHub token validation succeeded but the account login could not be resolved.");
  }

  const persistedState: AtlasGitHubAuthStateRecord = {
    schemaVersion: ATLAS_GITHUB_AUTH_SCHEMA_VERSION,
    accountLogin,
    githubToken,
    copilotGithubToken: persistedCopilotToken,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(resolveAtlasGitHubAuthStatePath(stateDir), persistedState);
  try {
    await syncAtlasAccountMetadataEnv(accountLogin);
  } catch (error) {
    console.error(`[atlas] failed to sync GitHub account metadata into .env: ${String((error as Error)?.message || error)}`);
  }
  applyAtlasGitHubAuthToEnv(persistedState);

  let copilotUsage: AtlasResolvedCopilotUsage | null;
  try {
    copilotUsage = await enrichCopilotUsageSnapshot(
      await fetchCopilotAccountProfile(resolveSupportedCopilotToken(persistedState.copilotGithubToken, persistedState.githubToken)),
    );
  } catch {
    copilotUsage = null;
  }

  const { authState } = resolveEffectiveAuthState(persistedState);
  const auth = buildAuthSummary(authState, "state");
  return {
    auth,
    copilotUsage,
    authRequired: auth.authRequired,
  };
}