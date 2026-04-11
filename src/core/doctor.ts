import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { info, warn } from "./logger.js";
import { validateCriticalAgentContracts } from "./agent_loader.js";

function check(command) {
  try {
    execSync(command, { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run preflight capability checks before a cycle starts.
 * Returns a structured result so the orchestrator can decide whether to proceed.
 *
 * @param {object} config
 * @returns {Promise<{ ok: boolean, checks: Record<string, boolean>, warnings: string[] }>}
 */
export async function runDoctor(config) {
  const warnings = [];
  const stateDir = config?.paths?.stateDir || "state";

  const checks = {
    node: check("node --version"),
    docker: check("docker --version"),
    githubToken: Boolean(config.env?.githubToken),
    targetRepo: Boolean(config.env?.targetRepo),
    stateDir: existsSync(stateDir),
    copilotCli: check(`${config.env?.copilotCliCommand || "copilot"} --version`),
    gitAvailable: check("git --version"),
    agentContracts: true, // initialised optimistic; set below
  };

  // ── Agent contract validation ──────────────────────────────────────────────
  // Validate prometheus and athena have required frontmatter fields.
  // Non-fatal at doctor level: the governance gate enforces the hard block.
  try {
    const agentValidation = validateCriticalAgentContracts();
    checks.agentContracts = agentValidation.allValid;
    if (!agentValidation.allValid) {
      const details = agentValidation.violations
        .map(v => `${v.slug}: [${v.violations.join(", ")}]`)
        .join("; ");
      warnings.push(`Agent contract violations detected: ${details}`);
    }
  } catch (err) {
    checks.agentContracts = false;
    warnings.push(`Agent contract check failed: ${String((err as Error)?.message || err)}`);
  }

  info("doctor checks", checks);

  if (!checks.githubToken || !checks.targetRepo) {
    warnings.push("GitHub integration not ready: set GITHUB_TOKEN and TARGET_REPO in .env");
  }
  if (!checks.stateDir) {
    warnings.push(`State directory "${stateDir}" does not exist`);
  }
  if (!checks.copilotCli) {
    warnings.push("Copilot CLI not found — AI agent calls will fail");
  }
  if (!checks.gitAvailable) {
    warnings.push("Git not available — source control operations will fail");
  }

  for (const w of warnings) warn(w);

  // agentContracts is a critical check: the governance gate hard-blocks dispatch
  // when agent frontmatter is invalid, so include it in the ok gate so that the
  // preflight report accurately surfaces the violation before the gate fires.
  const ok = checks.node && checks.githubToken && checks.targetRepo && checks.stateDir && checks.agentContracts;
  return { ok, checks, warnings };
}
