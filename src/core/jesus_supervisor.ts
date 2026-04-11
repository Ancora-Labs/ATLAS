/**
 * Jesus — CEO AI Supervisor
 *
 * Jesus activates ONCE at system startup.
 * He reads everything: GitHub state, worker sessions, last coordination, last Prometheus analysis.
 * He calls the AI agent with NO restrictions — free thinking, full analysis.
 *
 * His output:
 *   - A comprehensive directive for Prometheus including his full reasoning
 *   - Optional: request Prometheus for a fresh deep repo scan
 *   - Optional: wait if there is genuinely nothing to do
 *
 * Escalations come back to Jesus via state/jesus_escalation.json.
 * Jesus writes his directive to state/jesus_directive.json for dashboard visibility.
 */

import path from "node:path";
import { appendFileSync } from "node:fs";
import { readJson, readJsonSafe, writeJson, spawnAsync, buildIncrementalSignatureIndex } from "./fs_utils.js";
import { appendProgress, appendAlert, ALERT_SEVERITY, loadCapabilityExecutionSummary } from "./state_tracker.js";
import { getRoleRegistry } from "./role_registry.js";
import { buildAgentArgs, parseAgentOutput, logAgentThinking } from "./agent_loader.js";
import { chatLog, emitEvent, warn } from "./logger.js";
import {
  validateLeadershipContract,
  LEADERSHIP_CONTRACT_TYPE,
  TRUST_BOUNDARY_ERROR,
} from "./trust_boundary.js";
import { getRecentCapacity, computeTrend } from "./capacity_scoreboard.js";
import {
  buildExpectedOutcome,
  computeCalibrationRecord,
  appendCalibrationHistory,
} from "./jesus_calibration.js";
import { buildSpanEvent, EVENTS, EVENT_DOMAIN, JESUS_SOFT_TIMEOUT_POLICY_CONTRACT, SPAN_CONTRACT } from "./event_schema.js";
import { computeQueueViability } from "./pipeline_progress.js";
import { resolveJesusFallbackModel, ROUTING_REASON } from "./model_policy.js";

// ── CI system-learning debt detection ────────────────────────────────────────

/**
 * Returns true when any health finding describes CI-breaking debt in a
 * system-learning context. Used to set ciFastlaneRequired on the directive
 * so Prometheus generates a wave-1 CI-fix packet without waiting for the next
 * health audit cycle.
 */
export function hasCiSystemLearningDebt(findings: unknown[]): boolean {
  if (!Array.isArray(findings)) return false;
  const CI_DEBT_PATTERN = /\bci[-_\s]?(?:broken|break|fail(?:ed|ing)?|fix|repair)\b/i;
  return findings.some((f: any) => {
    if (!f || typeof f !== "object") return false;
    if (f.ciFastlaneRequired === true) return true;
    const severity = String(f.severity || "").trim().toLowerCase();
    if (severity !== "critical" && severity !== "warning") return false;
    const area = String(f.area || "").trim().toLowerCase();
    // Freshness gate: system-learning findings annotated with a live CI-success signal
    // reference past failures that have already been resolved.  Suppress them so stale
    // lesson debt does not force an unnecessary wave-1 CI-fix fastlane.
    if (
      area === "system-learning" &&
      String(f.latestMainCiConclusion || "").trim().toLowerCase() === "success"
    ) return false;
    const text = `${String(f.finding || "")} ${String(f.remediation || "")}`;
    return (
      area === "ci"
      || f.capabilityNeeded === "ci-fix"
      || (area === "system-learning" && CI_DEBT_PATTERN.test(text))
      || CI_DEBT_PATTERN.test(text)
    );
  });
}

// ── Span contract emitter ─────────────────────────────────────────────────────

/** Canonical agent identifier for Jesus in span events. */
export const JESUS_AGENT_ID = "jesus";
export const JESUS_WARNING_CODE = Object.freeze({
  DECISION_LATENCY_WARNING: "JESUS_DECISION_LATENCY_WARNING",
  LATENCY_ESCALATION: "JESUS_LATENCY_ESCALATION",
  LATENCY_FALLBACK_ACTIVATED: "JESUS_LATENCY_FALLBACK_ACTIVATED",
});

export function formatJesusTierEscalationMessage(
  previousTier: { label?: string; timeoutMs?: number; model?: string },
  nextTier: { label?: string; timeoutMs?: number; model?: string },
  routingReason: string,
): string {
  const previousLabel = String(previousTier?.label || "T?");
  const nextLabel = String(nextTier?.label || "T?");
  const previousTimeoutSec = Math.floor(Math.max(0, Number(previousTier?.timeoutMs || 0)) / 1000);
  const nextTimeoutSec = Math.floor(Math.max(0, Number(nextTier?.timeoutMs || 0)) / 1000);
  const nextModel = String(nextTier?.model || "unknown");
  const isFallbackActivation = routingReason === ROUTING_REASON.JESUS_LATENCY_FALLBACK;
  if (isFallbackActivation) {
    return `[JESUS] ${previousLabel} reached its ${previousTimeoutSec}s tier budget — activating ${nextLabel} (timeout=${nextTimeoutSec}s model=${nextModel} reason=${routingReason})`;
  }
  return `[JESUS] ${previousLabel} timed out after ${previousTimeoutSec}s — escalating to ${nextLabel} (timeout=${nextTimeoutSec}s model=${nextModel} reason=${routingReason})`;
}

export function shouldWarnJesusDecisionLatency(elapsedMs: number, warningThresholdMs: number): boolean {
  const safeElapsedMs = Number.isFinite(elapsedMs) ? Number(elapsedMs) : 0;
  const safeThresholdMs = Number.isFinite(warningThresholdMs) ? Number(warningThresholdMs) : 900_000;
  return safeElapsedMs >= Math.max(1, safeThresholdMs);
}

export function hasReachedJesusSoftTimeout(elapsedMs: number, softTimeoutMs: number): boolean {
  const safeElapsedMs = Number.isFinite(elapsedMs) ? Number(elapsedMs) : 0;
  const safeSoftTimeoutMs = Number.isFinite(softTimeoutMs) ? Number(softTimeoutMs) : 600_000;
  return safeElapsedMs >= Math.max(1, safeSoftTimeoutMs);
}

/**
 * Build a PLANNING_STAGE_TRANSITION span event for Jesus.
 * Conforms to SPAN_CONTRACT: stamps spanId, parentSpanId, traceId, agentId.
 *
 * @param correlationId — non-empty cycle trace ID
 * @param stageFrom     — stage being left (one of ORCHESTRATION_LOOP_STEPS)
 * @param stageTo       — stage being entered
 * @param opts          — optional parentSpanId, durationMs
 * @returns validated event envelope
 */
export function emitJesusSpanTransition(
  correlationId: string,
  stageFrom: string,
  stageTo: string,
  opts: { parentSpanId?: string | null; durationMs?: number | null } = {},
) {
  return buildSpanEvent(
    EVENTS.PLANNING_STAGE_TRANSITION,
    EVENT_DOMAIN.PLANNING,
    correlationId,
    { agentId: JESUS_AGENT_ID, parentSpanId: opts.parentSpanId ?? null },
    {
      [SPAN_CONTRACT.stageTransition.taskId]:     null,
      [SPAN_CONTRACT.stageTransition.stageFrom]:  stageFrom,
      [SPAN_CONTRACT.stageTransition.stageTo]:    stageTo,
      [SPAN_CONTRACT.stageTransition.durationMs]: opts.durationMs ?? null,
    },
  );
}

async function _callCopilotAgent(command, agentSlug, contextPrompt) {
  const args = buildAgentArgs({ agentSlug, prompt: contextPrompt, allowAll: true, noAskUser: true });
  const result: any = await spawnAsync(command, args, {
    env: process.env,
    timeoutMs: 180_000,
    // Kill CLI immediately when output is complete — avoids hanging in
    // interactive 'continue?' mode that Copilot CLI enters after long outputs.
    earlyExitMarker: "===END===",
  });
  const stdout = result.stdout;
  const stderr = result.stderr;
  if (result.status !== 0) {
    return { ok: false, raw: stdout || stderr, parsed: null, thinking: "", error: `exited ${result.status}` };
  }
  return parseAgentOutput(stdout || stderr);
}

function liveLogPath(stateDir: string): string {
  return path.join(stateDir, "live_worker_jesus.log");
}

function appendLiveLogSync(stateDir: string, text: string): void {
  try {
    appendFileSync(liveLogPath(stateDir), text, "utf8");
  } catch { /* best-effort */ }
}

function appendPromptPreviewSync(stateDir: string, promptText: string): void {
  const prompt = String(promptText || "").trim();
  if (!prompt) return;
  appendLiveLogSync(
    stateDir,
    [
      "",
      "[jesus_runtime_prompt_start]",
      prompt,
      "[jesus_runtime_prompt_end]",
      ""
    ].join("\n")
  );
}

// ── Hierarchical System Health Audit ─────────────────────────────────────────
// Jesus runs this audit on every cycle. It checks for structural problems that
// workers and Athena might have missed. When gaps are found, they're injected
// into the Jesus directive as specific remediation items AND fed to the self-
// improvement system as capability gaps.


/**
 * Load capability-gap source evidence using an incremental per-file hash cache.
 * Only re-reads files whose content has changed since the last call, reducing
 * decision latency from O(N×fileSize) full concatenation to O(changed×fileSize).
 *
 * Returns a Set<string> of all lowercase signature strings found across the
 * source tree — same semantics as the old string index but without allocating
 * a giant concatenated string on every cycle.
 */
async function loadSourceEvidenceIndex(repoRoot: string): Promise<Set<string>> {
  const srcDir = path.join(repoRoot, "src");
  const allSignatures = Object.values(CAPABILITY_SOURCE_SIGNATURES).flat();
  try {
    return await buildIncrementalSignatureIndex(srcDir, allSignatures);
  } catch {
    return new Set<string>();
  }
}

/**
 * Deterministic capability signature registry.
 * Each entry maps a known capability ID to an exhaustive list of source-level
 * identifiers that MUST ALL be present for the capability to be considered
 * implemented.  Only capabilities with explicit entries in this registry can
 * be downgraded — all others stay at their original severity so they remain
 * actionable.  Heuristic substring / proposedFix / gapText matching has been
 * removed because it produced false-positives that suppressed real findings.
 */
const CAPABILITY_SOURCE_SIGNATURES: Readonly<Record<string, string[]>> = Object.freeze({
  "dispatch-block-reason-reporting":      ["dispatchblockreason", "dispatch blocked"],
  "jesus-findings-to-plan-requirements":  ["mandatory_tasks", "buildmandatorytaskspromptsection", "extractmandatoryhealthauditfindings"],
  "athena-gate-pre-check":                ["gateblockrisk"],
  "athena-gate-feasibility-check":        ["gateblockrisk"],
  "prometheus-plan-structural-lint":      ["validateallplans", "plan_contract_validator"],
  "pre-athena-plan-structural-validation":["validateallplans", "plan_contract_validator"],
  "prometheus-token-budget-floor":        ["invalid_token_budget", "minimum token budgets", "token floor"],
  "ci-failure-log-injection":             ["hydratedispatchcontextwithcievidence", "ci failure evidence", "injectcifailurecontextifmissing"],
  "packet-granularity-governor":          ["max_actionable_steps_per_packet", "autosplitpacket"],
  "output-fidelity-gate":                 ["detectprocessthoughtmarkers", "output-fidelity-gate"],
  "specialization-admission-control":     ["specialization_admission", "laneadmissiongate"],
});

/**
 * Return true only when ALL required source signatures for a known capability
 * are found in the signature index Set AND the capability has a recent execution
 * trace proving it was invoked in the active runtime path.
 *
 * Both gates must pass for a finding to be downgraded:
 *   1. Source-presence gate  — all declared signatures exist in source files.
 *   2. Execution-trace gate  — capability ID appears in the recent trace log,
 *      meaning it was actually called during a previous cycle (not just compiled).
 *
 * Unknown capabilities (not in the registry) always return false so their
 * findings remain actionable.
 */
function isCapabilityGapVerifiedPresentAndExecuted(
  sourceIndex: Set<string>,
  executionTraces: Set<string>,
  gap: { capability?: unknown },
): boolean {
  if (!sourceIndex || sourceIndex.size === 0) return false;
  const capability = String(gap?.capability || "").trim().toLowerCase();
  const signatures = CAPABILITY_SOURCE_SIGNATURES[capability];
  if (!signatures || signatures.length === 0) return false;
  const sourcePresent = signatures.every((sig) => sourceIndex.has(sig));
  const executionPresent = executionTraces.has(capability);
  return sourcePresent && executionPresent;
}

export async function runSystemHealthAudit(config, githubState, AthenaCoordination, sessions) {
  const findings = [];

  // 1. CI Health — is main branch green?
  if (githubState.latestMainCi) {
    if (githubState.latestMainCi.conclusion !== "success") {
      findings.push({
        area: "ci",
        severity: "critical",
        finding: `CI on ${githubState.latestMainCi.branch} is ${githubState.latestMainCi.conclusion} (commit ${githubState.latestMainCi.commit})`,
        remediation: "Dispatch a worker to fix CI immediately — broken main blocks all progress",
        capabilityNeeded: "ci-fix"
      });
    }
  } else {
    findings.push({
      area: "ci",
      severity: "warning",
      finding: "No CI runs found on default branch — CI may not be configured",
      remediation: "Set up GitHub Actions CI workflow if missing",
      capabilityNeeded: "ci-setup"
    });
  }

  // 2. Failed CI runs on open PR branches
  if (githubState.failedCiRuns.length > 0) {
    const latestMainSuccessful = githubState?.latestMainCi?.conclusion === "success";
    const latestMainUpdatedAt = githubState?.latestMainCi?.updatedAt
      ? new Date(githubState.latestMainCi.updatedAt).getTime()
      : Number.NaN;
    const latestMainHeadSha = String(githubState?.latestMainCi?.headSha || "");

    for (const run of githubState.failedCiRuns) {
      if (latestMainSuccessful) {
        const runUpdatedAt = run?.updatedAt ? new Date(run.updatedAt).getTime() : Number.NaN;
        const preHead = Boolean(latestMainHeadSha && run?.headSha && run.headSha !== latestMainHeadSha);
        const supersededByLatestMain =
          Number.isFinite(runUpdatedAt) &&
          Number.isFinite(latestMainUpdatedAt) &&
          runUpdatedAt <= latestMainUpdatedAt;
        if (preHead || supersededByLatestMain) {
          continue;
        }
      }

      findings.push({
        area: "ci",
        severity: "warning",
        finding: `Failed CI: ${run.name} on branch ${run.branch} (${run.commit})`,
        remediation: `Fix CI failure on ${run.branch} — this blocks PR merge`,
        capabilityNeeded: "ci-fix"
      });
    }
  }

  // 3. Stale PRs — open PRs that might be abandoned or forgotten
  if (githubState.pullRequests.length > 0) {
    const stalePRs = githubState.pullRequests.filter(p => !p.draft);
    if (stalePRs.length > 3) {
      findings.push({
        area: "github-hygiene",
        severity: "warning",
        finding: `${stalePRs.length} open non-draft PRs — possible stale or duplicate PRs`,
        remediation: "Review open PRs: close duplicates, merge ready ones, or update stale ones",
        capabilityNeeded: "pr-management"
      });
    }
  }

  // 4. Worker session health — detect stuck or errored workers
  const workerIssues = [];
  for (const [role, session] of Object.entries(sessions) as any[]) {
    if (session?.status === "error") {
      workerIssues.push(`${role}: errored`);
    }
    if (session?.status === "working") {
      const lastActive = session.lastActiveAt
        ? new Date(session.lastActiveAt).getTime()
        : session.startedAt
          ? new Date(session.startedAt).getTime()
          : null;
      // Only report stuck when we have a meaningful timestamp; skip if neither
      // lastActiveAt nor startedAt is present to avoid Infinity false positives.
      if (lastActive === null) continue;
      const minutesSinceActive = (Date.now() - lastActive) / 60000;
      if (minutesSinceActive > 60) {
        workerIssues.push(`${role}: stuck working for ${minutesSinceActive.toFixed(0)}m`);
      }
    }
  }
  if (workerIssues.length > 0) {
    findings.push({
      area: "worker-health",
      severity: "warning",
      finding: `Worker issues detected: ${workerIssues.join("; ")}`,
      remediation: "Reset stuck workers, investigate error causes",
      capabilityNeeded: "worker-recovery"
    });
  }

  // 5. Athena coordination gaps — did Athena complete all planned waves?
  const completedTasks = Array.isArray(AthenaCoordination?.completedTasks)
    ? AthenaCoordination.completedTasks : [];
  const executionWaves = Array.isArray(AthenaCoordination?.executionStrategy?.waves)
    ? AthenaCoordination.executionStrategy.waves : [];
  if (executionWaves.length > 0) {
    const completedTaskSet = new Set<string>(completedTasks.map(t => String(t).trim()));
    const incompleteWaves = executionWaves.filter(w => {
      const waveTasks = Array.isArray(w?.tasks) ? w.tasks : null;
      // Only flag a wave as incomplete when it has an explicit tasks list
      // and at least one task in that list is not yet in completedTasks.
      // Without an explicit tasks list, we cannot determine incompleteness
      // from task IDs alone — skip to avoid substring-match false positives.
      if (waveTasks === null || waveTasks.length === 0) return false;
      return !waveTasks.every(t => completedTaskSet.has(String(t).trim()));
    });
    if (incompleteWaves.length > 0) {
      findings.push({
        area: "execution-gaps",
        severity: "warning",
        finding: `${incompleteWaves.length} wave(s) not yet completed: ${incompleteWaves.map(w => w.id).join(", ")}`,
        remediation: "Continue execution of incomplete waves in next Athena cycle",
        capabilityNeeded: "wave-continuation"
      });
    }
  }

  // 6. Knowledge memory — check if self-improvement detected critical issues
  try {
    const stateDir = config.paths?.stateDir || "state";
    const km = await readJson(path.join(stateDir, "knowledge_memory.json"), {});
    // Support v1 (flat .lessons) and v2 (partitioned .working.lessons + .episodic.lessons)
    const workingLessons  = Array.isArray(km.working?.lessons)  ? km.working.lessons  : [];
    const episodicLessons = Array.isArray(km.episodic?.lessons) ? km.episodic.lessons : [];
    const flatLessons     = Array.isArray(km.lessons)           ? km.lessons          : [];
    const allLessons = km.schemaVersion >= 2
      ? [...workingLessons, ...episodicLessons]
      : flatLessons;
    const criticalLessons = allLessons.filter(l => l.severity === "critical").slice(-3);
    const capGaps = Array.isArray(km.capabilityGaps) ? km.capabilityGaps.slice(-5) : [];
    const sourceIndex = await loadSourceEvidenceIndex(process.cwd());
    const capabilityExecutionSummary = await loadCapabilityExecutionSummary(config);
    const executionTraces = new Set(capabilityExecutionSummary.observedCapabilities);

    if (criticalLessons.length > 0) {
      // Annotate with the live CI conclusion so hasCiSystemLearningDebt (and downstream
      // consumers) can distinguish stale CI-break debt from active failures.
      const liveMainCiConclusion = String(githubState?.latestMainCi?.conclusion || "").trim().toLowerCase();
      findings.push({
        area: "system-learning",
        severity: "warning",
        finding: `Self-improvement flagged ${criticalLessons.length} critical lesson(s): ${criticalLessons.map(l => l.lesson).join("; ").slice(0, 300)}`,
        remediation: "Address critical lessons in next cycle planning",
        capabilityNeeded: "system-improvement",
        ...(liveMainCiConclusion ? { latestMainCiConclusion: liveMainCiConclusion } : {}),
      });
    }

    if (capGaps.length > 0) {
      for (const gap of capGaps.slice(0, 3)) {
        const originalSeverity = String(gap?.severity || "warning").toLowerCase();
        const verifiedPresent = isCapabilityGapVerifiedPresentAndExecuted(sourceIndex, executionTraces, gap);
        const shouldDowngrade =
          verifiedPresent && (originalSeverity === "critical" || originalSeverity === "warning");
        findings.push({
          area: "capability-gap",
          severity: shouldDowngrade ? "info" : (gap.severity || "warning"),
          finding: `Missing capability: ${gap.gap}`,
          remediation: gap.proposedFix || "Add missing capability to system",
          capabilityNeeded: gap.capability || "unknown",
          ...(shouldDowngrade ? { note: "verified_present_in_source_and_executed" } : {})
        });
      }
    }
  } catch { /* knowledge memory not available — no-op */ }

  return findings;
}

function formatHealthAuditFindings(findings) {
  if (findings.length === 0) return "  No structural issues detected — system is healthy.";

  return findings.map((f, i) => {
    const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "🟢";
    return `  ${i + 1}. ${icon} [${f.area}] ${f.finding}\n     → ${f.remediation}`;
  }).join("\n");
}

// ── GitHub Intelligence ──────────────────────────────────────────────────────

async function fetchGitHubState(config) {
  const token = config?.env?.githubToken;
  const repo = config?.env?.targetRepo;
  if (!token || !repo) return { issues: [], pullRequests: [], repoInfo: null };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "BOX/1.0"
  };

  async function ghGet(url) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  const base = `https://api.github.com/repos/${repo}`;
  const [issues, prs, repoInfo, recentRuns, mergedPrs] = await Promise.all([
    ghGet(`${base}/issues?state=open&per_page=20&sort=updated`),
    ghGet(`${base}/pulls?state=open&per_page=20&sort=updated`),
    ghGet(base),
    ghGet(`${base}/actions/runs?per_page=15`),
    ghGet(`${base}/pulls?state=closed&sort=updated&direction=desc&per_page=10`)
  ]);

  const defaultBranch = (repoInfo as any)?.default_branch || "main";
  const allRuns = Array.isArray((recentRuns as any)?.workflow_runs) ? (recentRuns as any).workflow_runs : [];

  // Latest completed run on default branch — the real CI health signal
  const mainRuns = allRuns.filter(r => r.head_branch === defaultBranch && r.status === "completed");
  const latestMainRun = mainRuns[0] || null;

  // Only count failures from the last 24 hours on branches with open PRs or the default branch
  const cutoff = Date.now() - 86400000;
  const openPrBranches = new Set(
    (Array.isArray(prs) ? prs : []).map(p => p.head?.ref).filter(Boolean)
  );
  openPrBranches.add(defaultBranch);
  const recentFailures = allRuns
    .filter(r => r.conclusion === "failure" &&
      new Date(r.updated_at).getTime() > cutoff &&
      openPrBranches.has(r.head_branch))
    .slice(0, 5);

  return {
    issues: Array.isArray(issues) ? issues.slice(0, 15).map(i => ({ number: i.number, title: i.title, labels: i.labels?.map(l => l.name) || [], state: i.state })) : [],
    pullRequests: Array.isArray(prs) ? prs.slice(0, 10).map(p => ({ number: p.number, title: p.title, state: p.state, draft: p.draft })) : [],
    repoInfo: repoInfo ? { name: (repoInfo as any).name, defaultBranch: (repoInfo as any).default_branch, openIssuesCount: (repoInfo as any).open_issues_count } : null,
    latestMainCi: latestMainRun ? {
      runId: latestMainRun.id,
      conclusion: latestMainRun.conclusion,
      branch: latestMainRun.head_branch,
      headSha: latestMainRun.head_sha,
      commit: latestMainRun.head_sha?.slice(0, 7),
      updatedAt: latestMainRun.updated_at,
      htmlUrl: latestMainRun.html_url
    } : null,
    failedCiRuns: recentFailures.map(r => ({
      runId: r.id,
      name: r.name,
      branch: r.head_branch,
      headSha: r.head_sha,
      commit: r.head_sha?.slice(0, 7),
      conclusion: r.conclusion,
      updatedAt: r.updated_at,
      htmlUrl: r.html_url
    })),
    recentlyMergedPrs: Array.isArray(mergedPrs)
      ? mergedPrs.filter(p => p.merged_at).slice(0, 10).map(p => ({
          number: p.number,
          title: p.title,
          mergedAt: p.merged_at
        }))
      : []
  };
}

// ── Directive Payload Validation ─────────────────────────────────────────────

/**
 * Required string fields in a valid Jesus directive payload.
 * These fields must be present and non-empty for the directive to be actionable.
 */
const REQUIRED_DIRECTIVE_STRING_FIELDS = ["decision", "systemHealth", "briefForPrometheus"] as const;

/**
 * Required boolean fields in a valid Jesus directive payload.
 */
const REQUIRED_DIRECTIVE_BOOLEAN_FIELDS = ["wakeAthena", "callPrometheus"] as const;

/**
 * Valid health state values that produce measurable expectedOutcome forecasts.
 * "unknown" is permitted only as a transient system state, not as a stable forecast.
 */
const MEASURABLE_HEALTH_STATES = new Set(["good", "degraded", "critical", "unknown"]);

/**
 * Valid decision type values that produce meaningful calibration predictions.
 */
const VALID_DECISION_TYPES = new Set(["tactical", "strategic", "emergency", "wait"]);

/**
 * Validate that a directive payload has all required fields and that the
 * `expectedOutcome` block contains measurable (non-null, non-degenerate) values.
 *
 * "Fail-close" semantics:
 *   - If required fields are missing or have wrong types, `valid: false` is returned.
 *   - Callers should degrade to a safe fallback directive instead of writing an
 *     incomplete payload to disk.
 *
 * @param directive - The assembled directive object (post AI-parse, pre-write).
 * @param expectedOutcome - The expectedOutcome block attached to the directive.
 * @returns {{ valid: boolean, gaps: string[], hasMeasurableOutcome: boolean }}
 */

/**
 * Strip operational tool traces and free-form internal reasoning from a directive
 * text field before persistence.  Prevents tool_call lines, thinking blocks, and
 * role prefixes from leaking into jesus_directive.json and polluting downstream
 * planning context for Prometheus.
 *
 * Exported for testing.
 */
export function sanitizeDirectiveFieldForPersistence(text: string): string {
  const raw = String(text || "");
  // Remove <thinking>...</thinking> blocks (potentially multiline).
  const noThinking = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  const lines = noThinking.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const norm = line.trim();
    if (!norm) return false;
    if (/^(tool_call|tool_result|function_call|assistant:|system:|user:)/i.test(norm)) return false;
    if (/^copilot>/i.test(norm)) return false;
    if (/^\[?(synthesizer_start|synthesizer_end|research_synthesizer_live)\]/i.test(norm)) return false;
    return true;
  });
  return filtered.join("\n").trim();
}

export function validateDirectivePayload(
  directive: Record<string, unknown>,
  expectedOutcome: Record<string, unknown>
): { valid: boolean; gaps: string[]; hasMeasurableOutcome: boolean } {
  const gaps: string[] = [];

  // Check required string fields
  for (const field of REQUIRED_DIRECTIVE_STRING_FIELDS) {
    const value = directive[field];
    if (value === null || value === undefined || String(value).trim() === "") {
      gaps.push(`directive.${field} is required but missing or empty`);
    }
  }

  // Check required boolean fields
  for (const field of REQUIRED_DIRECTIVE_BOOLEAN_FIELDS) {
    if (typeof directive[field] !== "boolean") {
      gaps.push(`directive.${field} must be a boolean (got ${typeof directive[field]})`);
    }
  }

  // Validate decision type is a recognised value
  const decision = String(directive.decision || "").toLowerCase();
  if (decision && !VALID_DECISION_TYPES.has(decision)) {
    gaps.push(`directive.decision "${decision}" is not a valid decision type (expected: tactical|strategic|emergency|wait)`);
  }

  // Validate expectedOutcome has measurable fields
  const hasMeasurableOutcome = validateExpectedOutcomeMeasurable(expectedOutcome);
  if (!hasMeasurableOutcome) {
    gaps.push("expectedOutcome is missing required measurable fields — calibration will be unreliable");
  }

  return { valid: gaps.length === 0, gaps, hasMeasurableOutcome };
}

/**
 * Check whether an expectedOutcome block has all required measurable fields.
 *
 * Measurable means: all 6 fields are present and non-null, with concrete values
 * that can be compared against realized outcomes for calibration scoring.
 */
export function validateExpectedOutcomeMeasurable(expectedOutcome: Record<string, unknown>): boolean {
  if (!expectedOutcome || typeof expectedOutcome !== "object") return false;

  const requiredFields = [
    "expectedSystemHealthAfter",
    "expectedNextDecision",
    "expectedAthenaActivated",
    "expectedPrometheusRan",
    "expectedWorkItemCount",
    "forecastConfidence",
  ];

  for (const field of requiredFields) {
    const value = expectedOutcome[field];
    if (value === null || value === undefined) return false;
  }

  // Verify health and decision fields are concrete (in known valid sets)
  const healthAfter = String(expectedOutcome.expectedSystemHealthAfter || "");
  const nextDecision = String(expectedOutcome.expectedNextDecision || "");

  if (!MEASURABLE_HEALTH_STATES.has(healthAfter)) return false;
  if (!VALID_DECISION_TYPES.has(nextDecision)) return false;
  if (typeof expectedOutcome.expectedAthenaActivated !== "boolean") return false;
  if (typeof expectedOutcome.expectedPrometheusRan !== "boolean") return false;
  if (typeof expectedOutcome.expectedWorkItemCount !== "number") return false;

  return true;
}

// ── Main Jesus Cycle ─────────────────────────────────────────────────────────

/**
 * Build the capacity delta report for the Jesus directive (Packet 13).
 * Identifies top bottlenecks, projected gains, and commanded interventions.
 *
 * @param {object} d — parsed AI decision
 * @param {object[]} healthFindings — from health audit
 * @param {object} kpis — parser confidence, plan count, etc.
 * @returns {{ topBottlenecks: Array, projectedGains: Array, commandedInterventions: Array }}
 */
function buildCapacityDeltaReport(d, healthFindings, kpis) {
  const topBottlenecks = [];
  const projectedGains = [];
  const commandedInterventions = [];

  // Extract bottlenecks from health findings
  const criticalFindings = (healthFindings || []).filter(f => f.severity === "critical");
  const warningFindings = (healthFindings || []).filter(f => f.severity === "warning");

  for (const f of criticalFindings.slice(0, 3)) {
    topBottlenecks.push({
      area: f.area,
      severity: f.severity,
      description: f.finding,
    });
    commandedInterventions.push({
      action: f.remediation,
      priority: "immediate",
      capability: f.capabilityNeeded,
    });
  }

  for (const f of warningFindings.slice(0, 2)) {
    topBottlenecks.push({
      area: f.area,
      severity: f.severity,
      description: f.finding,
    });
  }

  // Add capacity KPI-based insights
  if (kpis.parserConfidence !== "n/a" && Number(kpis.parserConfidence) < 0.5) {
    topBottlenecks.push({
      area: "parser-reliability",
      severity: "warning",
      description: `Parser confidence is ${kpis.parserConfidence} — plan quality may be degraded`,
    });
    projectedGains.push({
      improvement: "parser-reliability",
      estimatedGain: "20-40% reduction in plan retry churn",
    });
  }

  if (kpis.planCount === 0) {
    topBottlenecks.push({
      area: "planning-void",
      severity: "critical",
      description: "Prometheus produced zero plans — system cannot evolve",
    });
  }

  // Extract priorities from Jesus decision if available
  const priorities = Array.isArray(d?.priorities) ? d.priorities : [];
  for (const p of priorities.slice(0, 3)) {
    const text = typeof p === "string" ? p : p?.description || "";
    if (text) {
      projectedGains.push({
        improvement: text.slice(0, 100),
        estimatedGain: "capacity increase per Jesus priority",
      });
    }
  }

  return { topBottlenecks, projectedGains, commandedInterventions };
}

export async function runJesusCycle(config) {
  const stateDir = config.paths?.stateDir || "state";
  const registry = getRoleRegistry(config);
  const jesusName = registry?.ceoSupervisor?.name || "Jesus";
  const jesusModel = registry?.ceoSupervisor?.model || "Claude Sonnet 4.6";
  const command = config.env?.copilotCliCommand || "copilot";

  await appendProgress(config, `[JESUS] ${jesusName} awakening — analyzing system state`);
  chatLog(stateDir, jesusName, "Awakening — reading system state...");
  chatLog(stateDir, jesusName, "[LIVE] loading state snapshots (directive, coordination, prometheus, github, sessions)");

  // Read all state (no budget)
  const [
    lastDirective,
    AthenaCoordination,
    prometheusAnalysis,
    githubState,
    sessions
  ] = await Promise.all([
    readJson(path.join(stateDir, "jesus_directive.json"), {}),
    readJson(path.join(stateDir, "athena_coordination.json"), {}),
    readJson(path.join(stateDir, "prometheus_analysis.json"), {}),
    fetchGitHubState(config),
    readJson(path.join(stateDir, "worker_sessions.json"), {})
  ]);

  chatLog(
    stateDir,
    jesusName,
    `[LIVE] state loaded issues=${githubState.issues.length} prs=${githubState.pullRequests.length} failedCI=${githubState.failedCiRuns.length} activeSessions=${Object.keys(sessions).filter(k => sessions[k]?.status === "working").length}`
  );

  // ── Hierarchical Health Audit — detect what lower layers missed ──────────
  chatLog(stateDir, jesusName, "[LIVE] running hierarchical health audit");
  const healthFindings = await runSystemHealthAudit(config, githubState, AthenaCoordination, sessions);
  chatLog(stateDir, jesusName, `[LIVE] health audit complete findings=${healthFindings.length}`);

  // Always persist the findings file so Prometheus can perform freshness-aware
  // normalization.  Include latestMainCiConclusion and latestMainCiUpdatedAt so
  // the normalization layer can detect when a previously-stale CI-break finding
  // has been superseded by a healthy CI run.
  {
    const healthFindingsPayload: Record<string, unknown> = {
      findings: healthFindings,
      auditedAt: new Date().toISOString(),
      latestMainCiConclusion: githubState.latestMainCi?.conclusion ?? null,
      latestMainCiUpdatedAt: githubState.latestMainCi?.updatedAt ?? null,
    };

    if (healthFindings.length > 0) {
      const criticalCount = healthFindings.filter(f => f.severity === "critical").length;
      await appendProgress(config, `[JESUS][AUDIT] ${healthFindings.length} finding(s) — ${criticalCount} critical`);
      chatLog(stateDir, jesusName, `Health audit: ${healthFindings.length} findings (${criticalCount} critical)`);

      // Persist capability execution status alongside findings so self-improvement
      // can distinguish "code present in source" from "actually invoked at runtime".
      const capabilityExecutionSummary = await loadCapabilityExecutionSummary(config);
      const tracedCapabilities = new Set(capabilityExecutionSummary.observedCapabilities);
      const capabilityInvocationStatus = Object.keys(CAPABILITY_SOURCE_SIGNATURES).map(id => ({
        capability: id,
        status: tracedCapabilities.has(id) ? "invoked" : "absent",
        lastInvokedAt: capabilityExecutionSummary.lastInvokedAtByCapability[id] ?? null,
      }));
      healthFindingsPayload.capabilityExecutionSummary = capabilityExecutionSummary;
      healthFindingsPayload.capabilityExecutionTraces = capabilityExecutionSummary.recentTraces;
      healthFindingsPayload.capabilityInvocationStatus = capabilityInvocationStatus;
    }

    await writeJson(path.join(stateDir, "health_audit_findings.json"), healthFindingsPayload);
  }

  // ── Strategic Calibration — compare previous directive expectations vs reality ──
  // This runs every cycle (before AI call) to build a feedback loop on decision quality.
  const activeSessions = Object.keys(sessions).filter(k => sessions[k]?.status === "working").length;
  const lastCycleAt = lastDirective?.decidedAt ? new Date(lastDirective.decidedAt).toLocaleString() : "never";
  const prometheusLastRunAt = prometheusAnalysis?.analyzedAt ? new Date(prometheusAnalysis.analyzedAt).toLocaleString() : "never";

  // Cost guard: skip the AI call if GitHub state hasn't changed and last directive is fresh
  const now = Date.now();
  const lastDecisionMs = lastDirective?.decidedAt ? new Date(lastDirective.decidedAt).getTime() : 0;
  const minutesSinceLast = (now - lastDecisionMs) / 60000;
  const ghFingerprint = [
    githubState.issues.map(i => i.number).join(","),
    githubState.pullRequests.map(p => p.number).join(","),
    githubState.failedCiRuns.length,
    githubState.latestMainCi?.conclusion || ""
  ].join("|");

  // Reuse directive if: (a) state unchanged + workers busy, OR (b) directive is very fresh with pending work
  const hasPendingWork = Array.isArray(lastDirective?.workItems) && lastDirective.workItems.length > 0;
  const isFreshDirective = minutesSinceLast < 2 && hasPendingWork && lastDirective?.wakeAthena;
  const directiveFreshnessMins = Number(config.runtime?.jesusDirectiveFreshnessMinutes) || 30;
  if (
    (minutesSinceLast < directiveFreshnessMins && lastDirective?.decision && lastDirective?.githubStateHash === ghFingerprint && activeSessions > 0) ||
    isFreshDirective
  ) {
    await appendProgress(config, `[JESUS] State unchanged (${minutesSinceLast.toFixed(1)}m ago) — reusing last directive (AI call skipped)`);
    chatLog(stateDir, jesusName, `State unchanged — reusing last directive (saved AI call)`);
    return lastDirective;
  }

  // Calibrate previous directive's expected outcome against realized current state.
  // We do this AFTER the fresh-directive check so we only calibrate on real new cycles.
  chatLog(stateDir, jesusName, "[LIVE] calibration start (expected vs realized)");
  try {
    const calibrationHealthFindings = await runSystemHealthAudit(config, githubState, AthenaCoordination, sessions);
    const criticalCount = calibrationHealthFindings.filter(f => f.severity === "critical").length;
    const warningCount = calibrationHealthFindings.filter(f => f.severity === "warning").length;
    let realizedHealth = "good";
    if (criticalCount > 0) realizedHealth = "critical";
    else if (warningCount > 0) realizedHealth = "degraded";

    const prevPrometheusAt = lastDirective?.decidedAt
      ? new Date(lastDirective.decidedAt).getTime() : 0;
    const prometheusRanAfter = prometheusAnalysis?.analyzedAt
      ? new Date(prometheusAnalysis.analyzedAt).getTime() > prevPrometheusAt
      : false;
    const athenaCoordinationAt = AthenaCoordination?.updatedAt || AthenaCoordination?.coordinatedAt;
    const athenaActivatedAfter = athenaCoordinationAt
      ? new Date(athenaCoordinationAt).getTime() > prevPrometheusAt
      : false;

    const calibRec = computeCalibrationRecord(lastDirective, {
      systemHealth: realizedHealth,
      decision: "tactical", // placeholder; actual decision determined after AI call this cycle
      athenaActivated: athenaActivatedAfter,
      prometheusRan: prometheusRanAfter,
      workItemCount: Array.isArray(AthenaCoordination?.completedTasks)
        ? AthenaCoordination.completedTasks.length : 0,
    });

    if (calibRec) {
      await appendCalibrationHistory(stateDir, calibRec);
      await appendProgress(config,
        `[JESUS][CALIBRATION] score=${calibRec.scores.overall}/100 healthMatch=${calibRec.scores.healthMatch} decisionMatch=${calibRec.scores.decisionMatch}`
      );
    }
  } catch { /* calibration is non-critical — never block the main cycle */ }
  chatLog(stateDir, jesusName, "[LIVE] calibration complete");

  const prometheusAgeHours = prometheusAnalysis?.analyzedAt
    ? (now - new Date(prometheusAnalysis.analyzedAt).getTime()) / 3600000
    : Infinity;

  const workersList = Object.entries(registry?.workers || {})
    .map(([kind, w]) => `  - ${(w as any).name} (${kind}): ${(w as any).model}`)
    .join("\n");

  // English system state context — persona and output format are in jesus.agent.md
  // ── Capacity KPIs for strategic decisions ──────────────────────────────────
  const parserConfidence = prometheusAnalysis?.parserConfidence ?? "n/a";
  const planCount = Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans.length : 0;
  const optimizerStatus = prometheusAnalysis?.interventionOptimizer?.status || "n/a";
  const budgetUsed = prometheusAnalysis?.interventionOptimizer?.totalBudgetUsed ?? "n/a";
  const budgetLimit = prometheusAnalysis?.interventionOptimizer?.totalBudgetLimit ?? "n/a";

  // ── Capacity trends from scoreboard ────────────────────────────────────────
  let capacityTrendBlock = "";
  try {
    const recentEntries = await getRecentCapacity(config, 10);
    if (recentEntries.length >= 3) {
      const confTrend = computeTrend(recentEntries, "parserConfidence");
      const planTrend = computeTrend(recentEntries, "planCount");
      const budgetTrend = computeTrend(recentEntries, "budgetUsed");
      const workerTrend = computeTrend(recentEntries, "workersDone");
      capacityTrendBlock = `\n**Capacity Trends (last ${recentEntries.length} cycles):**
  Parser confidence trend: ${confTrend}
  Plan count trend: ${planTrend}
  Budget usage trend: ${budgetTrend}
  Worker completion trend: ${workerTrend}`;
    }
  } catch { /* non-critical */ }

  const contextPrompt = `TARGET REPO: ${config.env?.targetRepo || "unknown"}

## CURRENT SYSTEM STATE

**Active Worker Sessions:** ${activeSessions}
**Last Cycle:** ${lastCycleAt}
**Prometheus Last Analysis:** ${prometheusLastRunAt}${prometheusAgeHours < 6 ? ` (${prometheusAgeHours.toFixed(1)}h ago — FRESH, only set callPrometheus=true if health is critical)` : ""}

**GitHub State — ${config.env?.targetRepo}:**
Open Issues (${githubState.issues.length}):
${githubState.issues.length > 0
  ? githubState.issues.map(i => `  #${i.number}: ${i.title} [${i.labels.join(", ") || "no labels"}]`).join("\n")
  : "  No open issues"}

Open PRs (${githubState.pullRequests.length}):
${githubState.pullRequests.length > 0
  ? githubState.pullRequests.map(p => `  #${p.number}: ${p.title} [${p.draft ? "draft" : "open"}]`).join("\n")
  : "  No open PRs"}

**Latest CI on default branch (${githubState.latestMainCi?.branch || "main"}):**
${githubState.latestMainCi
  ? `  ${githubState.latestMainCi.conclusion} (${githubState.latestMainCi.commit}) [${githubState.latestMainCi.updatedAt}]`
  : "  No CI runs found"}

**Recent CI Failures (last 24h): ${githubState.failedCiRuns.length}**
${githubState.failedCiRuns.length > 0
  ? githubState.failedCiRuns.map(r => `  ${r.name} on ${r.branch} (${r.commit}) — ${r.conclusion} [${r.updatedAt}]`).join("\n")
  : "  No recent failures"}

**Recently Merged PRs (${githubState.recentlyMergedPrs.length}):**
${githubState.recentlyMergedPrs.length > 0
  ? githubState.recentlyMergedPrs.map(p => `  #${p.number}: ${p.title} [merged ${p.mergedAt}]`).join("\n")
  : "  No recently merged PRs"}

**Last Coordination:**
${AthenaCoordination?.summary ? `  ${AthenaCoordination.summary}` : "  No previous coordination"}
${AthenaCoordination?.completedTasks ? `  Completed tasks: ${AthenaCoordination.completedTasks}` : ""}

**Prometheus's Last Analysis:**
${prometheusAnalysis?.projectHealth ? `  Health: ${prometheusAnalysis.projectHealth}` : "  No analysis available"}
${prometheusAnalysis?.keyFindings ? `  Key findings: ${prometheusAnalysis.keyFindings}` : ""}
${prometheusAnalysis?.projectClassification ? `  Project type: ${prometheusAnalysis.projectClassification.type} (${prometheusAnalysis.projectClassification.confidence})` : ""}

**Capacity KPIs (use for strategic decisions):**
  Parser confidence: ${parserConfidence}
  Plans produced: ${planCount}
  Optimizer: status=${optimizerStatus} budget=${budgetUsed}/${budgetLimit}
  Prometheus age: ${prometheusAgeHours < Infinity ? `${prometheusAgeHours.toFixed(1)}h` : "never"}
${capacityTrendBlock}

**Hierarchical System Health Audit (detected by YOU — issues workers/Athena may have missed):**
${formatHealthAuditFindings(healthFindings)}
${healthFindings.filter(f => f.severity === "critical").length > 0 ? "\n⚠️ CRITICAL FINDINGS ABOVE — these MUST be addressed. Workers and Athena missed them." : ""}
${healthFindings.filter(f => f.area === "capability-gap").length > 0 ? "\n⚠️ CAPABILITY GAPS DETECTED — the system is missing abilities that caused failures. Consider requesting Prometheus to plan fixes." : ""}

**Available Workers:**
${workersList}`;

  appendPromptPreviewSync(stateDir, contextPrompt);
  chatLog(stateDir, jesusName, `Calling Copilot CLI (agent=jesus, allowAll=true)...`);

  const jesusTimeoutMs = Math.max(60_000, Number(config?.runtime?.jesusTimeoutMs || 1_800_000));
  const jesusDecisionLatencyWarningMs = Math.max(
    30_000,
    Number(config?.runtime?.jesusDecisionLatencyWarningMs ?? config?.slo?.thresholds?.decisionLatencyMs ?? 900_000),
  );
  // Latency-aware tiered routing: T1 (fast) → T2 (normal) → T3 (full+fallback).
  // maxRetries=1 means 2 attempts, maxRetries=2 means all 3 tiers.
  const tier1Ms = Math.max(30_000, Math.min(Number(config?.runtime?.jesusLatencyTier1Ms ?? 60_000), jesusTimeoutMs));
  const tier2Ms = Math.max(tier1Ms + 1, Math.min(Number(config?.runtime?.jesusLatencyTier2Ms ?? 600_000), jesusTimeoutMs));
  const disableTier1 = config?.runtime?.jesusDisableTier1 === true;
  const jesusSoftTimeoutMs = Math.max(
    disableTier1 ? tier2Ms : tier1Ms,
    Math.min(Number(config?.runtime?.jesusSoftTimeoutMs ?? tier2Ms), jesusTimeoutMs),
  );
  const maxRetries = Math.max(0, Math.min(Number(config?.runtime?.jesusMaxRetries ?? 1), 2));
  const fallbackModel = resolveJesusFallbackModel(config);

  // Build tier list: each tier has its own timeout and model.
  // T3 uses the fallback model (may be the same as jesusModel when no override is set).
  const allTiers = [
    { timeoutMs: tier1Ms, model: jesusModel, label: "T1" },
    { timeoutMs: tier2Ms, model: jesusModel, label: "T2" },
    { timeoutMs: jesusTimeoutMs, model: fallbackModel, label: "T3" },
  ];
  const candidateTiers = disableTier1 ? allTiers.filter((tier) => tier.label !== "T1") : allTiers;
  const tiers = candidateTiers.slice(0, Math.min(maxRetries + 1, candidateTiers.length))
    .map((tier) => ({
      ...tier,
      // Every fallback-model tier is soft-timeout gated so activation semantics
      // stay deterministic: no fallback call before the cutoff is reached.
      softTimeoutGated: tier.model !== jesusModel,
    }));
  if (!tiers.some((tier) => tier.model !== jesusModel) && fallbackModel !== jesusModel) {
    // Keep the existing T1/T2 retry profile, but guarantee a deterministic
    // fallback path once the soft-timeout threshold has been crossed.
    tiers.push({ timeoutMs: jesusTimeoutMs, model: fallbackModel, label: "T3", softTimeoutGated: true });
  }

  let rawResult: any;
  let finalTierLabel = tiers[0]?.label || (disableTier1 ? "T2" : "T1");
  let finalTierModel = tiers[0]?.model || jesusModel;
  const aiCallStartedAt = Date.now();
  const latencyWarningCorrelationId = `jesus-latency-${aiCallStartedAt}`;
  const heartbeatIntervalMs = Math.max(30_000, Number(config?.runtime?.jesusHeartbeatIntervalMs || 30_000));
  const heartbeatTimer = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - aiCallStartedAt) / 1000);
    chatLog(stateDir, jesusName, `[LIVE] AI analysis in progress elapsed=${elapsedSec}s`);
  }, heartbeatIntervalMs);

  chatLog(stateDir, jesusName, "Calling AI for strategic analysis...");
  appendLiveLogSync(stateDir, `\n[copilot_stream_start] ${new Date().toISOString().replace("T", " ").slice(0, 19)}\n`);

  try {
    for (let ti = 0; ti < tiers.length; ti++) {
      const tier = tiers[ti];
      const isEscalation = ti > 0;

      if (tier.softTimeoutGated) {
        const elapsedMsBeforeFallback = Date.now() - aiCallStartedAt;
        if (!hasReachedJesusSoftTimeout(elapsedMsBeforeFallback, jesusSoftTimeoutMs)) {
          // Soft-timeout threshold not yet crossed — skip this fallback tier (cutoff).
          // Emit a deterministic analytics event so the cutoff decision is observable.
          emitEvent(EVENTS.POLICY_JESUS_SOFT_TIMEOUT_CUTOFF, EVENT_DOMAIN.POLICY, latencyWarningCorrelationId, {
            source: "jesus_supervisor",
            tier: tier.label,
            softTimeoutMs: jesusSoftTimeoutMs,
            elapsedMsAtCutoff: elapsedMsBeforeFallback,
            softTimeoutReached: JESUS_SOFT_TIMEOUT_POLICY_CONTRACT.softTimeoutCutoff.softTimeoutReached,
            baseModel: jesusModel,
            fallbackModel: tier.model,
            hardTimeoutMs: jesusTimeoutMs,
          });
          chatLog(stateDir, jesusName,
            `[LIVE] tier=${tier.label} soft-timeout cutoff: elapsed=${elapsedMsBeforeFallback}ms < softTimeoutMs=${jesusSoftTimeoutMs}ms — fallback skipped`
          );
          rawResult = { status: -1, stdout: "", stderr: "soft-timeout cutoff not reached", timedOut: false };
          finalTierLabel = tier.label;
          finalTierModel = tier.model;
          break;
        }
      }

      if (isEscalation) {
        const prevTier = tiers[ti - 1];
        const elapsedMsAtEscalation = Date.now() - aiCallStartedAt;
        const softTimeoutReached = tier.model !== jesusModel
          ? true
          : hasReachedJesusSoftTimeout(elapsedMsAtEscalation, jesusSoftTimeoutMs);
        const routingReason = tier.model !== jesusModel ? ROUTING_REASON.JESUS_LATENCY_FALLBACK : "JESUS_LATENCY_ESCALATION";
        await appendProgress(config, formatJesusTierEscalationMessage(prevTier, tier, routingReason));
        chatLog(
          stateDir,
          jesusName,
          tier.model !== jesusModel
            ? `[LIVE] tier=${prevTier.label} reached tier budget — activating ${tier.label}`
            : `[LIVE] tier=${prevTier.label} timed out — escalating to ${tier.label}`
        );
        emitEvent(EVENTS.ORCHESTRATION_ALERT_EMITTED, EVENT_DOMAIN.ORCHESTRATION, latencyWarningCorrelationId, {
          severity: "warning",
          source: "jesus_supervisor",
          warningCode: tier.model !== jesusModel
            ? JESUS_WARNING_CODE.LATENCY_FALLBACK_ACTIVATED
            : JESUS_WARNING_CODE.LATENCY_ESCALATION,
          fromTier: prevTier.label,
          toTier: tier.label,
          fromTimeoutMs: prevTier.timeoutMs,
          toTimeoutMs: tier.timeoutMs,
          softTimeoutMs: jesusSoftTimeoutMs,
          elapsedMsAtEscalation,
          softTimeoutReached,
          baseModel: jesusModel,
          selectedModel: tier.model,
          routingReason,
        });
        if (tier.model !== jesusModel) {
          emitEvent(EVENTS.POLICY_JESUS_FALLBACK_ACTIVATED, EVENT_DOMAIN.POLICY, latencyWarningCorrelationId, {
            source: "jesus_supervisor",
            baseModel: jesusModel,
            fallbackModel: tier.model,
            fromTier: prevTier.label,
            toTier: tier.label,
            softTimeoutMs: jesusSoftTimeoutMs,
            elapsedMsAtActivation: elapsedMsAtEscalation,
            softTimeoutReached: JESUS_SOFT_TIMEOUT_POLICY_CONTRACT.fallbackActivated.softTimeoutReached,
            hardTimeoutMs: jesusTimeoutMs,
            routingReason,
          });
          warn(
            `[jesus_supervisor] fallback model activated after latency escalation: baseModel=${jesusModel} fallbackModel=${tier.model} tier=${tier.label} softTimeoutReached=${softTimeoutReached}`
          );
        }
      }

      chatLog(stateDir, jesusName, `[LIVE] invoking agent=jesus tier=${tier.label} model=${tier.model} timeout=${Math.floor(tier.timeoutMs / 1000)}s`);
      const args = buildAgentArgs({ agentSlug: "jesus", prompt: contextPrompt, allowAll: true, noAskUser: true, model: tier.model !== jesusModel ? tier.model : undefined });

      let tierResult: any;
      try {
        tierResult = await spawnAsync(command, args, {
          env: process.env,
          timeoutMs: tier.timeoutMs,
          // Kill CLI immediately when output is complete — avoids hanging in
          // interactive 'continue?' mode that Copilot CLI enters after long outputs.
          earlyExitMarker: "===END===",
          onStdout(chunk) {
            appendLiveLogSync(stateDir, chunk.toString("utf8"));
          },
          onStderr(chunk) {
            appendLiveLogSync(stateDir, chunk.toString("utf8"));
          },
        });
      } catch (spawnErr) {
        // spawnAsync should not throw — treat as failure and proceed to next tier if available
        tierResult = { status: -1, stdout: "", stderr: String((spawnErr as any)?.message || spawnErr), timedOut: false };
      }

      // If this tier timed out and there is a next tier available, escalate
      if (tierResult?.timedOut && ti < tiers.length - 1) {
        continue;
      }

      rawResult = tierResult;
      finalTierLabel = tier.label;
      finalTierModel = tier.model;
      break;
    }
  } finally {
    clearInterval(heartbeatTimer);
  }

  appendLiveLogSync(stateDir, `\n[copilot_stream_end] ${new Date().toISOString().replace("T", " ").slice(0, 19)} exit=${rawResult?.status}\n`);

  const elapsedSec = Math.floor((Date.now() - aiCallStartedAt) / 1000);
  const elapsedMs = Date.now() - aiCallStartedAt;
  chatLog(stateDir, jesusName, `[LIVE] AI call completed elapsed=${elapsedSec}s ok=${Boolean(rawResult?.status === 0)}`);
  if (shouldWarnJesusDecisionLatency(elapsedMs, jesusDecisionLatencyWarningMs)) {
    const warningMessage =
      `[JESUS][LATENCY_WARNING] decision latency ${elapsedMs}ms exceeded warning threshold ${jesusDecisionLatencyWarningMs}ms (tier=${finalTierLabel} model=${finalTierModel})`;
    await appendProgress(config, warningMessage);
    warn(`[jesus_supervisor] ${warningMessage}`);
    try {
      await appendAlert(config, {
        severity: ALERT_SEVERITY.MEDIUM,
        source: "jesus_supervisor",
        title: "Jesus decision latency warning threshold exceeded",
        message: warningMessage,
        correlationId: latencyWarningCorrelationId,
      });
    } catch { /* non-fatal */ }
    emitEvent(EVENTS.ORCHESTRATION_ALERT_EMITTED, EVENT_DOMAIN.ORCHESTRATION, latencyWarningCorrelationId, {
      severity: "warning",
      source: "jesus_supervisor",
      warningCode: JESUS_WARNING_CODE.DECISION_LATENCY_WARNING,
      latencyMs: elapsedMs,
      warningThresholdMs: jesusDecisionLatencyWarningMs,
      timeoutMs: jesusTimeoutMs,
      tier: finalTierLabel,
      model: finalTierModel,
      usedFallbackModel: finalTierModel !== jesusModel,
    });
  }

  const rawOut = String(rawResult?.stdout || rawResult?.stderr || "");
  const finalTierTimeoutMs = Math.max(1, Number(tiers.find((tier) => tier.label === finalTierLabel)?.timeoutMs || jesusTimeoutMs));
  const aiResult = rawResult?.status === 0
    ? parseAgentOutput(rawOut)
    : { ok: false, raw: rawOut, parsed: null, thinking: "", error: rawResult?.timedOut ? `timed out after ${Math.floor(finalTierTimeoutMs / 1000)}s` : `exited ${rawResult?.status}` };

  if (!aiResult.ok || !aiResult.parsed) {
    await appendProgress(config, `[JESUS] AI call failed — ${(aiResult as any).error || "no JSON"}`);
    chatLog(stateDir, jesusName, `AI failed: ${(aiResult as any).error || "no JSON"}`);
    const needsPrometheus = prometheusAgeHours > 6;
    return {
      wait: false,
      wakeAthena: true,
      callPrometheus: needsPrometheus,
      prometheusReason: needsPrometheus ? "AI call failed and no recent Prometheus analysis — must scan" : undefined,
      decision: "tactical",
      systemHealth: "unknown",
      thinking: "",
      fullOutput: (aiResult as any).raw || "",
      briefForPrometheus: `Check GitHub issues and activate appropriate workers. Target repo: ${config.env?.targetRepo}`,
      priorities: [],
      workerSuggestions: []
    };
  }

  logAgentThinking(stateDir, jesusName, aiResult.thinking);

  // ── Trust boundary validation ────────────────────────────────────────────
  const tbMode = config?.runtime?.trustBoundaryMode === "warn" ? "warn" : "enforce";
  const trustCheck = validateLeadershipContract(
    LEADERSHIP_CONTRACT_TYPE.SUPERVISOR, aiResult.parsed, { mode: tbMode }
  );
  if (!trustCheck.ok && tbMode === "enforce") {
    const tbErrors = trustCheck.errors.map(e => `${e.payloadPath}: ${e.message}`).join(" | ");
    await appendProgress(config, `[JESUS][TRUST_BOUNDARY] Supervisor output failed contract validation — class=${TRUST_BOUNDARY_ERROR} reasonCode=${trustCheck.reasonCode} errors=${tbErrors}`);
    try {
      await appendAlert(config, {
        severity: ALERT_SEVERITY.CRITICAL,
        source: "jesus_supervisor",
        title: "Supervisor output failed trust-boundary validation",
        message: `class=${TRUST_BOUNDARY_ERROR} reasonCode=${trustCheck.reasonCode} errors=${tbErrors}`
      });
    } catch { /* non-fatal */ }
    // Degrade to safe fallback directive; never silently pass invalid output
    const needsPrometheus = prometheusAgeHours > 6;
    return {
      wait: false,
      wakeAthena: true,
      callPrometheus: needsPrometheus,
      prometheusReason: needsPrometheus ? "Trust-boundary violation in supervisor output and no recent Prometheus analysis" : undefined,
      decision: "tactical",
      systemHealth: "unknown",
      thinking: aiResult.thinking,
      fullOutput: (aiResult as any).raw || "",
      briefForPrometheus: `Check GitHub issues and activate appropriate workers. Target repo: ${config.env?.targetRepo}`,
      priorities: [],
      workerSuggestions: [],
      _trustBoundaryViolation: true,
      _trustBoundaryErrors: tbErrors
    };
  }
  if (trustCheck.errors.length > 0 && tbMode === "warn") {
    const tbErrors = trustCheck.errors.map(e => `${e.payloadPath}: ${e.message}`).join(" | ");
    await appendProgress(config, `[JESUS][TRUST_BOUNDARY][WARN] Contract violations (warn mode, not blocking): ${tbErrors}`);
  }

  const d = aiResult.parsed;

  // Safety net: force callPrometheus=true when no valid Prometheus analysis exists.
  // Queue-viability gate: if there are viable pending plans in the queue, suppress the
  // age-based replan so existing approved work is executed before an expensive replan.
  if (!d.callPrometheus && prometheusAgeHours > 6) {
    try {
      const queueViability = await computeQueueViability(config);
      if (queueViability.viable) {
        // Valid pending work exists — skip the age-based replan, let orchestrator execute
        await appendProgress(config,
          `[JESUS] Age-based replan suppressed — queue has ${queueViability.pendingCount}/${queueViability.totalCount} viable pending plan(s) (reason=${queueViability.reason} completionRate=${queueViability.completionRate ?? "n/a"})`
        );
      } else {
        d.callPrometheus = true;
        d.prometheusReason = (d.prometheusReason || "") + " [OVERRIDE: no recent Prometheus analysis and no viable queued plans — forced callPrometheus=true]";
        await appendProgress(config, `[JESUS] callPrometheus overridden to true — Prometheus analysis is ${prometheusAgeHours === Infinity ? "missing" : prometheusAgeHours.toFixed(1) + "h old"}, queueViability=${queueViability.reason}`);
      }
    } catch {
      // Fall back to age-only override on any error
      d.callPrometheus = true;
      d.prometheusReason = (d.prometheusReason || "") + " [OVERRIDE: no recent Prometheus analysis — forced callPrometheus=true]";
      await appendProgress(config, `[JESUS] callPrometheus overridden to true — Prometheus analysis is ${prometheusAgeHours === Infinity ? "missing" : prometheusAgeHours.toFixed(1) + "h old"}`);
    }
  }

  // ── Safety net: force replanning if Athena rejected the previous plan ──────
  // If the last plan was rejected and we're about to skip replanning, that's wrong.
  // Athena rejection = mandatory replan, regardless of Prometheus freshness.
  if (!d.callPrometheus) {
    try {
      const athenaRejection = await readJsonSafe(path.join(stateDir, "athena_plan_rejection.json"));
      const hasRejectedPlan = Boolean(
        athenaRejection?.ok &&
        athenaRejection.data &&
        typeof athenaRejection.data === "object" &&
        athenaRejection.data.rejectedAt
      );
      if (hasRejectedPlan) {
        d.callPrometheus = true;
        d.prometheusReason = (d.prometheusReason || "") + " [OVERRIDE: Athena rejected previous plan — forced callPrometheus=true for replan]";
        await appendProgress(config, `[JESUS] callPrometheus overridden to true — Athena rejection detected, mandatory replan`);
      }
    } catch { /* non-fatal: if athena_plan_rejection doesn't exist or is malformed, continue */ }
  }

  chatLog(stateDir, jesusName,
    `Decision: ${d.decision || "?"} | Health: ${d.systemHealth || "?"} | callPrometheus: ${d.callPrometheus} | wakeAthena: ${d.wakeAthena}`
  );
  await appendProgress(config,
    `[JESUS] decision=${d.decision} health=${d.systemHealth} callPrometheus=${d.callPrometheus} wakeAthena=${d.wakeAthena}`
  );

  // ── Capacity Delta Report (Packet 13) ──────────────────────────────────
  // Extract top bottlenecks and projected gains from Jesus's analysis.
  const capacityDelta = buildCapacityDeltaReport(d, healthFindings, {
    parserConfidence, planCount, optimizerStatus, budgetUsed, budgetLimit
  });

  const expectedOutcome = buildExpectedOutcome(d);

  // ── Directive payload validation — fail-close on incomplete payloads ────
  // After the AI output passes the trust boundary, validate the assembled
  // directive has all required fields and a measurable expectedOutcome.
  // If validation fails, degrade to a safe fallback rather than writing an
  // incomplete payload to disk.
  const payloadValidation = validateDirectivePayload(
    d as Record<string, unknown>,
    expectedOutcome as unknown as Record<string, unknown>
  );
  if (!payloadValidation.valid) {
    const gapList = payloadValidation.gaps.join(" | ");
    await appendProgress(config,
      `[JESUS][PAYLOAD_GATE] Directive payload incomplete — fail-closing. Gaps: ${gapList}`
    );
    try {
      await appendAlert(config, {
        severity: ALERT_SEVERITY.CRITICAL,
        source: "jesus_supervisor",
        title: "Directive payload failed validation — safe fallback returned",
        message: gapList
      });
    } catch { /* non-fatal */ }
    const needsPrometheus = prometheusAgeHours > 6;
    return {
      wait: false,
      wakeAthena: true,
      callPrometheus: needsPrometheus,
      prometheusReason: needsPrometheus
        ? "Directive payload incomplete and no recent Prometheus analysis" : undefined,
      decision: "tactical",
      systemHealth: "unknown",
      thinking: aiResult.thinking,
      fullOutput: (aiResult as any).raw || "",
      briefForPrometheus: `Check GitHub issues and activate appropriate workers. Target repo: ${config.env?.targetRepo}`,
      priorities: [],
      workerSuggestions: [],
      _directivePayloadGaps: payloadValidation.gaps,
    };
  }

  const ciFastlaneRequired = hasCiSystemLearningDebt(healthFindings);

  const directive = {
    ...d,
    briefForPrometheus: sanitizeDirectiveFieldForPersistence(String((d as any).briefForPrometheus || "")),
    thinking: aiResult.thinking,
    fullOutput: (aiResult as any).raw || "",
    decidedAt: new Date().toISOString(),
    model: jesusModel,
    repo: config.env?.targetRepo,
    githubStateHash: ghFingerprint,
    githubCiContext: {
      latestMainCi: githubState.latestMainCi || null,
      failedCiRuns: Array.isArray(githubState.failedCiRuns) ? githubState.failedCiRuns : []
    },
    capacityDelta,
    expectedOutcome,
    ciFastlaneRequired,
  };

  if (ciFastlaneRequired) {
    await appendProgress(config,
      `[JESUS] CI system-learning debt detected — ciFastlaneRequired=true set on directive; Prometheus will generate wave-1 CI-fix fastlane packet`
    );
  }

  await writeJson(path.join(stateDir, "jesus_directive.json"), directive);

  return directive;
}

// ── Per-cycle Jesus outcome ledger ─────────────────────────────────────────────
//
// Written at the end of every complete orchestration cycle.  The ledger feeds
// into planning context on the next cycle so the supervisor can reason about
// recent strategy-to-outcome closure rates.

/** Schema version for jesus_outcome_ledger.jsonl entries. */
export const JESUS_OUTCOME_LEDGER_SCHEMA_VERSION = 1;

/**
 * Per-cycle Jesus strategy-to-outcome closure record.
 * Emitted at the end of every completed cycle in the orchestrator.
 */
export interface JesusDecisionOutcome {
  schemaVersion: number;
  /**
   * Stable hash of the Jesus directive for this cycle.
   * Matches directive.githubStateHash so records can be correlated with
   * the directive that drove them.
   */
  directiveHash: string;
  recordedAt: string;
  /** Number of plans generated by Prometheus this cycle. */
  plansGenerated: number;
  /** Number of worker batches that completed successfully this cycle. */
  plansExecuted: number;
  /**
   * Budget consumed by the optimizer (totalBudgetUsed), or null when the
   * optimizer did not run or its result is unavailable.
   */
  budgetDelta: number | null;
  /**
   * CI outcome from the latest main-branch run visible to Jesus, or null
   * when unknown.  Derived from jesusDirective.githubCiContext.latestMainCi.conclusion.
   */
  ciOutcome: string | null;
}

/**
 * Build a JesusDecisionOutcome record from cycle-level inputs.
 *
 * Pure function — no I/O.  Call appendJesusOutcomeLedger() to persist.
 *
 * @param opts.directiveHash  - stable hash from the Jesus directive
 * @param opts.plansGenerated - Prometheus plan count
 * @param opts.plansExecuted  - completed worker count
 * @param opts.budgetDelta    - optimizer totalBudgetUsed (optional)
 * @param opts.ciOutcome      - latest CI conclusion string (optional)
 */
export function buildJesusDecisionOutcome(opts: {
  directiveHash: string;
  plansGenerated: number;
  plansExecuted: number;
  budgetDelta?: number | null;
  ciOutcome?: string | null;
}): JesusDecisionOutcome {
  return {
    schemaVersion: JESUS_OUTCOME_LEDGER_SCHEMA_VERSION,
    directiveHash: String(opts.directiveHash || ""),
    recordedAt: new Date().toISOString(),
    plansGenerated: Math.max(0, Math.floor(Number(opts.plansGenerated) || 0)),
    plansExecuted: Math.max(0, Math.floor(Number(opts.plansExecuted) || 0)),
    budgetDelta: typeof opts.budgetDelta === "number" && Number.isFinite(opts.budgetDelta)
      ? opts.budgetDelta
      : null,
    ciOutcome: opts.ciOutcome ? String(opts.ciOutcome) : null,
  };
}

/**
 * Append a JesusDecisionOutcome record to state/jesus_outcome_ledger.jsonl.
 *
 * Uses appendFileSync for atomic per-line writes.
 * Never throws — all errors are silently swallowed to prevent blocking orchestration.
 *
 * @param stateDir - path to the state directory
 * @param outcome  - the record to persist
 */
export async function appendJesusOutcomeLedger(
  stateDir: string,
  outcome: JesusDecisionOutcome,
): Promise<void> {
  try {
    const filePath = path.join(stateDir, "jesus_outcome_ledger.jsonl");
    const entry = JSON.stringify(outcome) + "\n";
    appendFileSync(filePath, entry, "utf8");
  } catch (err) {
    // Fail-open: ledger write is non-fatal but must be observable.
    warn(`[jesus_supervisor] appendJesusOutcomeLedger write failed (degraded): ${String((err as any)?.message || err)}`);
  }
}

