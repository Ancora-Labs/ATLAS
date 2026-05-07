/**
 * Self-Development Guard
 *
 * Part 1 protection wall for BOX self_dev mode.
 *
 * This module defines the contract that must stay stable while later
 * single_target_delivery work is still disabled. The contract is config-backed
 * so runtime, tests, and worker prompts all read the same self_dev truth.
 */

import path from "node:path";
import { PLATFORM_MODE } from "./mode_state.js";

const DEFAULT_CRITICAL_FILES = Object.freeze([
  "src/core/orchestrator.ts",
  "src/core/self_dev_guard.ts",
  "src/core/daemon_control.ts",
  "src/core/policy_engine.ts",
  "src/cli.ts",
  ".env",
  ".env.sandbox",
  "policy.json",
]);

const DEFAULT_PROTECTED_PREFIXES = Object.freeze([
  "state/",
  ".git/",
  "node_modules/",
  ".next/",
]);

const DEFAULT_CAUTION_FILES = Object.freeze([
  "src/core/self_improvement.ts",
  "src/core/athena_reviewer.ts",
  "src/core/jesus_supervisor.ts",
  "src/core/prometheus.ts",
  "box.config.json",
  "package.json",
]);

const DEFAULT_FORBIDDEN_BRANCH_TARGETS = Object.freeze([
  "main",
  "master",
]);

export const DEFAULT_SELF_DEV_FUTURE_MODE_FLAGS = Object.freeze({
  singleTargetDelivery: false,
  targetSessionState: false,
  targetPromptOverlay: false,
  targetWorkspaceLifecycle: false,
});

function uniqueStringList(values, fallback) {
  const source = Array.isArray(values) && values.length > 0 ? values : fallback;
  const seen = new Set();
  const result = [];
  for (const value of source) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized.replace(/\\/g, "/"));
  }
  return result;
}

function normalizeFutureModeFlags(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    singleTargetDelivery: raw.singleTargetDelivery === true,
    targetSessionState: raw.targetSessionState === true,
    targetPromptOverlay: raw.targetPromptOverlay === true,
    targetWorkspaceLifecycle: raw.targetWorkspaceLifecycle === true,
  };
}

function normalizeBranchTargets(values) {
  return uniqueStringList(values, DEFAULT_FORBIDDEN_BRANCH_TARGETS).map((value) => value.toLowerCase());
}

function matchesPath(file, candidate) {
  const normalizedFile = String(file || "").replace(/\\/g, "/").toLowerCase();
  const normalizedCandidate = String(candidate || "").replace(/\\/g, "/").toLowerCase();
  return normalizedFile === normalizedCandidate || normalizedFile.endsWith(`/${normalizedCandidate}`);
}

export function getSelfDevProtectionContract(config) {
  const selfDev = config?.selfDev && typeof config.selfDev === "object" ? config.selfDev : {};
  return {
    enabled: isSelfDevMode(config),
    recoveryTag: String(selfDev.recoveryTag || RECOVERY_TAG),
    maxFilesPerPr: Number(selfDev.maxFilesPerPr || 8),
    branchPrefix: String(selfDev.branchPrefix || "box/selfdev-"),
    mandatoryGates: uniqueStringList(selfDev.mandatoryGates, ["lint", "test"]),
    forbiddenBranchTargets: normalizeBranchTargets(selfDev.forbiddenBranchTargets),
    criticalFiles: uniqueStringList(selfDev.criticalFiles, DEFAULT_CRITICAL_FILES),
    cautionFiles: uniqueStringList(selfDev.cautionFiles, DEFAULT_CAUTION_FILES),
    protectedPrefixes: uniqueStringList(selfDev.protectedPrefixes, DEFAULT_PROTECTED_PREFIXES),
    futureModeFlags: {
      ...DEFAULT_SELF_DEV_FUTURE_MODE_FLAGS,
      ...normalizeFutureModeFlags(selfDev.futureModeFlags),
    },
  };
}

export function summarizeSelfDevProtectionContract(config) {
  const contract = getSelfDevProtectionContract(config);
  const disabledFlags = Object.entries(contract.futureModeFlags)
    .filter(([, enabled]) => enabled !== true)
    .map(([flag]) => flag)
    .join(", ");
  return [
    `protectedFiles=${contract.criticalFiles.length}`,
    `protectedPrefixes=${contract.protectedPrefixes.length}`,
    `maxFilesPerPr=${contract.maxFilesPerPr}`,
    `forbiddenBranches=${contract.forbiddenBranchTargets.join(",") || "none"}`,
    `futureFlagsOff=${disabledFlags || "none"}`,
  ].join(" | ");
}

function normalizePathForComparison(value) {
  return String(value || "").replace(/\\/g, "/");
}

function isSingleTargetRuntime(config) {
  const requestedMode = String(
    config?.platformModeState?.currentMode
    || config?.activeTargetSession?.currentMode
    || ""
  ).trim().toLowerCase();
  return requestedMode === PLATFORM_MODE.SINGLE_TARGET_DELIVERY;
}

function resolveBoxScopedChangedFiles(changedFiles, config) {
  if (!isSingleTargetRuntime(config)) {
    return Array.isArray(changedFiles) ? changedFiles : [];
  }

  const boxRoot = String(config?.rootDir || "").trim();
  const executionRoot = String(config?.activeTargetSession?.workspace?.path || "").trim();
  if (!boxRoot) {
    return [];
  }

  const normalizedBoxRoot = normalizePathForComparison(path.resolve(boxRoot)).toLowerCase();
  const result = [];

  for (const changedFile of Array.isArray(changedFiles) ? changedFiles : []) {
    const rawPath = String(changedFile || "").trim();
    if (!rawPath) continue;

    const resolvedPath = path.isAbsolute(rawPath)
      ? path.resolve(rawPath)
      : executionRoot
        ? path.resolve(executionRoot, rawPath)
        : null;
    if (!resolvedPath) continue;

    const normalizedResolvedPath = normalizePathForComparison(resolvedPath).toLowerCase();
    if (normalizedResolvedPath === normalizedBoxRoot || normalizedResolvedPath.startsWith(`${normalizedBoxRoot}/`)) {
      result.push(normalizePathForComparison(path.relative(boxRoot, resolvedPath)));
    }
  }

  return result;
}

export function evaluateSelfDevProtectionBoundary(input, config) {
  const contract = getSelfDevProtectionContract(config);
  const changedFiles = resolveBoxScopedChangedFiles(input?.changedFiles, config);
  const branchName = input?.branchName != null ? String(input.branchName) : null;
  const changedFilesCount = input?.changedFilesCount != null
    ? Number(input.changedFilesCount)
    : changedFiles.length;
  const targetRuntime = isSingleTargetRuntime(config);

  const fileValidation = validateFileChanges(changedFiles, config);
  const prSizeValidation = !targetRuntime && Number.isFinite(changedFilesCount)
    ? validatePrSize(changedFilesCount, config)
    : { allowed: true, reason: "" };
  const branchValidation = !targetRuntime && branchName
    ? validateBranch(branchName, config)
    : { allowed: true, reason: "" };

  const blocked = [...fileValidation.blocked];
  if (!prSizeValidation.allowed && prSizeValidation.reason) blocked.push(prSizeValidation.reason);
  if (!branchValidation.allowed && branchValidation.reason) blocked.push(branchValidation.reason);

  return {
    active: targetRuntime ? changedFiles.length > 0 : contract.enabled,
    allowed: blocked.length === 0,
    blocked,
    warnings: [...fileValidation.warnings],
    contract,
  };
}

// ── Self-dev detection ───────────────────────────────────────────────────────

/**
 * Detect if BOX is targeting its own repository.
 * Checks both config and ENV to be safe.
 */
export function isSelfDevMode(config) {
  if (isSingleTargetRuntime(config)) {
    return false;
  }

  const targetRepo = String(config?.env?.targetRepo || process.env.TARGET_REPO || "").toLowerCase();
  const selfRepoMarkers = [
    "box-orchestrator",
    "box/box",
    "/box",
  ];
  // Explicit flag in config
  if (config?.selfDev?.enabled === true) return true;
  // Check if target repo name indicates self
  return selfRepoMarkers.some(m => targetRepo.endsWith(m) || targetRepo.includes("box-orchestrator"));
}

// ── File change validation ───────────────────────────────────────────────────

/**
 * Validate a list of changed file paths against self-dev rules.
 * Returns { allowed: boolean, blocked: string[], warnings: string[] }
 */
export function validateFileChanges(changedFiles, config) {
  const contract = getSelfDevProtectionContract(config);
  const blocked = [];
  const warnings = [];

  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, "/").toLowerCase();

    // Check critical files (absolute block)
    for (const critical of contract.criticalFiles) {
      if (matchesPath(normalized, critical)) {
        blocked.push(`BLOCKED: ${file} is a critical system file — cannot modify during self-dev`);
      }
    }

    // Check critical prefixes
    for (const prefix of contract.protectedPrefixes) {
      if (normalized.startsWith(prefix) || normalized.includes("/" + prefix)) {
        blocked.push(`BLOCKED: ${file} is under protected prefix ${prefix}`);
      }
    }

    // Check caution files (warn only)
    for (const caution of contract.cautionFiles) {
      if (matchesPath(normalized, caution)) {
        warnings.push(`CAUTION: ${file} is a sensitive system file — review carefully`);
      }
    }
  }

  return {
    allowed: blocked.length === 0,
    blocked,
    warnings,
  };
}

// ── PR size guard ────────────────────────────────────────────────────────────

/**
 * Check if the number of changed files exceeds the self-dev limit.
 */
export function validatePrSize(changedFilesCount, config) {
  const contract = getSelfDevProtectionContract(config);
  const maxFiles = Number(contract.maxFilesPerPr || 8);
  if (changedFilesCount > maxFiles) {
    return {
      allowed: false,
      reason: `Self-dev PR too large: ${changedFilesCount} files changed (max ${maxFiles}). Break into smaller PRs.`,
    };
  }
  return { allowed: true, reason: "" };
}

// ── Branch guard ─────────────────────────────────────────────────────────────

/**
 * Ensure work is on a branch, never directly on main/master.
 */
export function validateBranch(branchName, config) {
  const contract = getSelfDevProtectionContract(config);
  const name = String(branchName || "").trim().toLowerCase();
  if (!name || contract.forbiddenBranchTargets.includes(name)) {
    return {
      allowed: false,
      reason: `Self-dev mode requires a feature branch. Current: "${branchName || "(none)"}". Use box/selfdev-* prefix.`,
    };
  }
  return { allowed: true, reason: "" };
}

// ── Gate enforcement ─────────────────────────────────────────────────────────

/**
 * Return the gate overrides for self-dev mode.
 * These are stricter than normal — lint and tests are mandatory.
 */
export function getSelfDevGateOverrides() {
  return {
    requireBuild: true,
    requireTests: true,
    requireLint: true,
    requireSecurityScan: true,
    minCoveragePercent: 0, // don't block on coverage, but lint+test must pass
  };
}

// ── Worker context injection ─────────────────────────────────────────────────

/**
 * Returns extra context to inject into worker prompts during self-dev.
 * This tells workers what they CAN and CANNOT do.
 */
export function getSelfDevWorkerContext(config) {
  const contract = getSelfDevProtectionContract(config);
  const disabledFlags = Object.entries(contract.futureModeFlags)
    .filter(([, enabled]) => enabled !== true)
    .map(([flag]) => flag);
  return [
    "## SELF-DEVELOPMENT MODE ACTIVE",
    "You are modifying the BOX system itself. Follow these rules strictly:",
    "",
    "### FORBIDDEN (will be rejected):",
    `- Do NOT modify these files: ${contract.criticalFiles.join(", ")}`,
    `- Do NOT touch files under: ${contract.protectedPrefixes.join(", ")}`,
    "- Do NOT delete any existing files",
    "- Do NOT add force-push, --no-verify, or skip-test flags",
    "- Do NOT modify the self-dev guard itself",
    `- Do NOT target these branches directly: ${contract.forbiddenBranchTargets.join(", ")}`,
    "",
    "### REQUIRED:",
    "- All changes must pass lint AND tests",
    `- Keep PRs small (max ${contract.maxFilesPerPr} files changed)`,
    "- Each PR should do ONE thing",
    "- Add tests for any new functionality",
    "- Use existing code patterns (ESM, readJson/writeJson, appendProgress)",
    "",
    "### CAUTION (allowed but review carefully):",
    `- ${contract.cautionFiles.join(", ")}`,
    "- Changes to these files affect core behavior — be precise",
    "",
    "### PART 1 BOUNDARY:",
    `- Future single-target work remains disabled: ${disabledFlags.join(", ") || "none"}`,
    "- Do NOT introduce delivery-mode behavior in this task",
    "",
    "### RECOVERY:",
    `- Recovery tag: ${contract.recoveryTag}`,
    "- If something breaks: Copilot fixes first, then rollback to tag if needed",
  ].join("\n");
}

// ── Recovery info ────────────────────────────────────────────────────────────

export const RECOVERY_TAG = "box/recovery-v0.1.0-pre-selfdev";

/**
 * Get recovery instructions for the current self-dev session.
 */
export function getRecoveryInstructions() {
  return {
    tag: RECOVERY_TAG,
    rollbackCommand: `git checkout ${RECOVERY_TAG} -- .`,
    hardResetCommand: `git reset --hard ${RECOVERY_TAG}`,
    note: "Try Copilot fix first. Hard reset is last resort — loses all self-dev work.",
  };
}
