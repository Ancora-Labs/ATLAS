import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

const ENV_BOOTSTRAP_STATE = Symbol.for("box.env.bootstrap.state");

type EnvBootstrapState = {
  loadedRepoRoots: Set<string>;
  managedKeysByRepoRoot: Map<string, Set<string>>;
};

const LEGACY_ENV_ALIASES = Object.freeze({
  GITHUB_TOKEN: [
    "GH_TOKEN",
    "canerdogduGITHUB_TOKEN",
    "GITHUB_TOKENPERSONAL",
  ],
  COPILOT_GITHUB_TOKEN: [
    "GITHUB_FINEGRADED",
    "canerdoqdu_FINEGRADED",
    "CanerdoqduFINEGRADED",
    "CanerdoqduFINEGRADEDGENERALANDTRUMP",
    "GITHUBFINEGRADEDPERSONALINTEL",
  ],
  BOX_GITHUB_BILLING_TOKEN: [
    "GITHUBFINEGRADEDPERSONALINTEL",
    "GITHUB_FINEGRADED",
    "COPILOT_GITHUB_TOKEN",
    "GITHUB_TOKENPERSONAL",
    "GITHUB_TOKEN",
  ],
});

const REPO_AUTHORITATIVE_ENV_KEYS = new Set([
  "BOX_GITHUB_BILLING_TOKEN",
  "COPILOT_GITHUB_TOKEN",
  "GH_TOKEN",
  "GITHUB_FINEGRADED",
  "GITHUB_TOKEN",
]);

export const DEFAULT_BOX_SECRETS_FILE = path.join(os.homedir(), ".box", "secrets.env");

function normalizeEnvValue(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function classifyGitHubToken(value: string | null | undefined): "copilot_compatible" | "ghp" | "other" | "none" {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    return "none";
  }
  if (
    normalized.startsWith("github_pat_")
    || normalized.startsWith("gho_")
    || normalized.startsWith("ghu_")
  ) {
    return "copilot_compatible";
  }
  if (normalized.startsWith("ghp_")) {
    return "ghp";
  }
  return "other";
}

function readRepoSecretsFileHint(repoEnvPath: string): string | null {
  if (!fs.existsSync(repoEnvPath)) {
    return null;
  }

  try {
    const parsed = dotenv.parse(fs.readFileSync(repoEnvPath, "utf8"));
    return normalizeEnvValue(parsed.BOX_SECRETS_FILE);
  } catch {
    return null;
  }
}

function loadEnvFile(filePath: string | null, managedKeys?: Set<string>, overrideKeys: ReadonlySet<string> = new Set()): void {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  const parsed = dotenv.parse(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (overrideKeys.has(key) || !normalizeEnvValue(process.env[key])) {
      process.env[key] = value;
      managedKeys?.add(key);
    }
  }
}

function applyCanonicalAlias(
  targetName: string,
  aliases: readonly string[],
  managedKeys?: Set<string>,
  options: { overwrite?: boolean } = {},
): void {
  if (!options.overwrite && normalizeEnvValue(process.env[targetName])) {
    return;
  }

  for (const alias of aliases) {
    const aliasValue = normalizeEnvValue(process.env[alias]);
    if (aliasValue) {
      process.env[targetName] = aliasValue;
      managedKeys?.add(targetName);
      return;
    }
  }
}

export function bootstrapEnvironment(options: { repoRoot?: string; forceReload?: boolean; preferRepoEnv?: boolean } = {}): void {
  const globalScope = globalThis as Record<PropertyKey, unknown>;
  const repoRoot = path.resolve(options.repoRoot || process.env.BOX_ROOT_DIR || process.cwd());
  const bootstrapState = (globalScope[ENV_BOOTSTRAP_STATE] as EnvBootstrapState | undefined) || {
    loadedRepoRoots: new Set<string>(),
    managedKeysByRepoRoot: new Map<string, Set<string>>(),
  };

  if (options.forceReload === true) {
    const managedKeys = bootstrapState.managedKeysByRepoRoot.get(repoRoot);
    if (managedKeys) {
      for (const key of managedKeys) {
        delete process.env[key];
      }
      bootstrapState.managedKeysByRepoRoot.delete(repoRoot);
    }
    bootstrapState.loadedRepoRoots.delete(repoRoot);
  }

  if (bootstrapState.loadedRepoRoots.has(repoRoot)) {
    return;
  }

  globalScope[ENV_BOOTSTRAP_STATE] = bootstrapState;
  const repoEnvPath = path.join(repoRoot, ".env");
  const managedKeys = new Set<string>();
  const configuredSecretsFile = normalizeEnvValue(process.env.BOX_SECRETS_FILE)
    || readRepoSecretsFileHint(repoEnvPath);
  const secretsFilePath = configuredSecretsFile
    ? path.resolve(repoRoot, configuredSecretsFile)
    : DEFAULT_BOX_SECRETS_FILE;

  loadEnvFile(secretsFilePath, managedKeys);
  loadEnvFile(repoEnvPath, managedKeys, options.preferRepoEnv === true ? REPO_AUTHORITATIVE_ENV_KEYS : new Set());

  applyCanonicalAlias("GITHUB_TOKEN", LEGACY_ENV_ALIASES.GITHUB_TOKEN, managedKeys);
  applyCanonicalAlias("COPILOT_GITHUB_TOKEN", LEGACY_ENV_ALIASES.COPILOT_GITHUB_TOKEN, managedKeys, { overwrite: options.preferRepoEnv === true });
  applyCanonicalAlias("BOX_GITHUB_BILLING_TOKEN", LEGACY_ENV_ALIASES.BOX_GITHUB_BILLING_TOKEN, managedKeys);
  applyCanonicalAlias("GH_TOKEN", ["GITHUB_TOKEN"], managedKeys, { overwrite: options.preferRepoEnv === true });

  const finegrainedToken = normalizeEnvValue(process.env.GITHUB_FINEGRADED);
  const githubToken = normalizeEnvValue(process.env.GITHUB_TOKEN);
  const copilotTokenType = classifyGitHubToken(process.env.COPILOT_GITHUB_TOKEN);
  const finegrainedTokenType = classifyGitHubToken(finegrainedToken);
  const githubTokenType = classifyGitHubToken(githubToken);

  if (finegrainedTokenType === "copilot_compatible" && copilotTokenType !== "copilot_compatible") {
    process.env.COPILOT_GITHUB_TOKEN = finegrainedToken as string;
    managedKeys.add("COPILOT_GITHUB_TOKEN");
  } else if (githubTokenType === "copilot_compatible" && copilotTokenType === "none") {
    process.env.COPILOT_GITHUB_TOKEN = githubToken as string;
    managedKeys.add("COPILOT_GITHUB_TOKEN");
  }

  const copilotToken = normalizeEnvValue(process.env.COPILOT_GITHUB_TOKEN);
  const repoLoadedFinegrainedToken = managedKeys.has("GITHUB_FINEGRADED");
  if (copilotToken && !repoLoadedFinegrainedToken && (options.preferRepoEnv === true || !normalizeEnvValue(process.env.GITHUB_FINEGRADED))) {
    process.env.GITHUB_FINEGRADED = copilotToken;
    managedKeys.add("GITHUB_FINEGRADED");
  }

  bootstrapState.managedKeysByRepoRoot.set(repoRoot, managedKeys);
  bootstrapState.loadedRepoRoots.add(repoRoot);
}