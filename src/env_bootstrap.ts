import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

const ENV_BOOTSTRAP_SENTINEL = Symbol.for("box.env.bootstrap");

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

export const DEFAULT_BOX_SECRETS_FILE = path.join(os.homedir(), ".box", "secrets.env");

function normalizeEnvValue(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
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

function loadEnvFile(filePath: string | null): void {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  dotenv.config({ path: filePath, override: false });
}

function applyCanonicalAlias(targetName: string, aliases: readonly string[]): void {
  if (normalizeEnvValue(process.env[targetName])) {
    return;
  }

  for (const alias of aliases) {
    const aliasValue = normalizeEnvValue(process.env[alias]);
    if (aliasValue) {
      process.env[targetName] = aliasValue;
      return;
    }
  }
}

export function bootstrapEnvironment(options: { repoRoot?: string } = {}): void {
  const globalScope = globalThis as Record<PropertyKey, unknown>;
  if (globalScope[ENV_BOOTSTRAP_SENTINEL]) {
    return;
  }

  const repoRoot = path.resolve(options.repoRoot || process.env.BOX_ROOT_DIR || process.cwd());
  const repoEnvPath = path.join(repoRoot, ".env");
  const configuredSecretsFile = normalizeEnvValue(process.env.BOX_SECRETS_FILE)
    || readRepoSecretsFileHint(repoEnvPath);
  const secretsFilePath = configuredSecretsFile
    ? path.resolve(repoRoot, configuredSecretsFile)
    : DEFAULT_BOX_SECRETS_FILE;

  loadEnvFile(secretsFilePath);
  loadEnvFile(repoEnvPath);

  applyCanonicalAlias("GITHUB_TOKEN", LEGACY_ENV_ALIASES.GITHUB_TOKEN);
  applyCanonicalAlias("COPILOT_GITHUB_TOKEN", LEGACY_ENV_ALIASES.COPILOT_GITHUB_TOKEN);
  applyCanonicalAlias("BOX_GITHUB_BILLING_TOKEN", LEGACY_ENV_ALIASES.BOX_GITHUB_BILLING_TOKEN);
  applyCanonicalAlias("GH_TOKEN", ["GITHUB_TOKEN"]);

  const copilotToken = normalizeEnvValue(process.env.COPILOT_GITHUB_TOKEN);
  if (copilotToken && !normalizeEnvValue(process.env.GITHUB_FINEGRADED)) {
    process.env.GITHUB_FINEGRADED = copilotToken;
  }

  globalScope[ENV_BOOTSTRAP_SENTINEL] = true;
}