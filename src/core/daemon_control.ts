import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { readJson, writeJson, writeJsonAtomic } from "./fs_utils.js";

// ── State files that must be cleared on shutdown (full reset) ────────────────
const SHUTDOWN_CLEAR_FILES = [
  "jesus_directive.json",
  "prometheus_analysis.json",
  "athena_coordination.json",
  "worker_sessions.json",
  "jesus_escalation.json",
  "daemon.pid.json",
  "daemon.stop.json",
  "daemon.reload.json",
  "leadership_live.txt",
  "leadership_thinking.txt",
  "si_live.log"
];

// Worker state files pattern
const WORKER_STATE_PATTERN = /^worker_[a-z_]+\.json$/;
const DEBUG_WORKER_PATTERN = /^debug_worker_[A-Za-z_]+\.txt$/;
const DEBUG_AGENT_PATTERN = /^debug_agent_[A-Za-z0-9_-]+\.txt$/;

export const MAX_CONCURRENT_TARGET_SESSION_RUNNERS = 3;

function normalizeNullableString(value) {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function resolveConfiguredTargetSessionSelector(config) {
  return {
    projectId: normalizeNullableString(config?.targetSessionSelector?.projectId || process.env.BOX_TARGET_PROJECT_ID),
    sessionId: normalizeNullableString(config?.targetSessionSelector?.sessionId || process.env.BOX_TARGET_SESSION_ID),
  };
}

function sanitizeSessionKeyPart(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function getTargetRunnerControlDir(config) {
  return path.join(config.paths.stateDir, "session_runners");
}

function buildTargetRunnerControlKey(projectId, sessionId) {
  return `${sanitizeSessionKeyPart(projectId, "project")}_${sanitizeSessionKeyPart(sessionId, "session")}`;
}

function targetRunnerPidFile(config, selector) {
  return path.join(getTargetRunnerControlDir(config), `${buildTargetRunnerControlKey(selector.projectId, selector.sessionId)}.pid.json`);
}

function targetRunnerStopFile(config, selector) {
  return path.join(getTargetRunnerControlDir(config), `${buildTargetRunnerControlKey(selector.projectId, selector.sessionId)}.stop.json`);
}

function targetRunnerReloadFile(config, selector) {
  return path.join(getTargetRunnerControlDir(config), `${buildTargetRunnerControlKey(selector.projectId, selector.sessionId)}.reload.json`);
}

function hasTargetRunnerSelector(config) {
  const selector = resolveConfiguredTargetSessionSelector(config);
  return Boolean(selector.sessionId);
}

function getControlScopeFiles(config) {
  const selector = resolveConfiguredTargetSessionSelector(config);
  if (selector.sessionId) {
    return {
      selector,
      pidFile: targetRunnerPidFile(config, selector),
      stopFile: targetRunnerStopFile(config, selector),
      reloadFile: targetRunnerReloadFile(config, selector),
      scope: "target-session",
    };
  }

  return {
    selector: null,
    pidFile: path.join(config.paths.stateDir, "daemon.pid.json"),
    stopFile: path.join(config.paths.stateDir, "daemon.stop.json"),
    reloadFile: path.join(config.paths.stateDir, "daemon.reload.json"),
    scope: "global",
  };
}

async function readControlJson(filePath) {
  return readJson(filePath, null);
}

async function writeScopedPidFile(pidFile, content) {
  try {
    const fh = await fs.open(pidFile, "wx");
    await fh.writeFile(content, "utf8");
    await fh.close();
  } catch (err) {
    if (err.code === "EEXIST") {
      const existing = await readJson(pidFile, null);
      if (existing?.pid && isProcessAlive(existing.pid)) {
        throw new Error(`daemon already running (pid=${existing.pid})`, { cause: err });
      }
      await writeJson(pidFile, JSON.parse(content));
    } else {
      throw err;
    }
  }
}

export async function listTargetSessionRunnerStates(config) {
  const controlDir = getTargetRunnerControlDir(config);
  await fs.mkdir(controlDir, { recursive: true });
  const entries = await fs.readdir(controlDir, { withFileTypes: true }).catch(() => []);
  const pidFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".pid.json"));
  const results = [];
  for (const entry of pidFiles) {
    const filePath = path.join(controlDir, entry.name);
    const state = await readJson(filePath, null);
    if (!state?.pid || !isProcessAlive(state.pid)) {
      await fs.rm(filePath, { force: true }).catch(() => {});
      continue;
    }
    results.push(state);
  }
  return results;
}

export async function countRunningTargetSessionRunners(config) {
  const states = await listTargetSessionRunnerStates(config);
  return states.filter((state) => isProcessAlive(state.pid)).length;
}

function daemonPidFile(config) {
  return getControlScopeFiles(config).pidFile;
}

function daemonStopFile(config) {
  return getControlScopeFiles(config).stopFile;
}

function daemonReloadFile(config) {
  return getControlScopeFiles(config).reloadFile;
}

function globalDaemonPidFile(config) {
  return path.join(config.paths.stateDir, "daemon.pid.json");
}

export async function readDaemonPid(config) {
  return readJson(daemonPidFile(config), null);
}

export async function findDaemonStartConflict(config) {
  const selector = resolveConfiguredTargetSessionSelector(config);

  if (selector.sessionId) {
    const matchingRunner = (await listTargetSessionRunnerStates(config)).find((state) => {
      const stateSessionId = normalizeNullableString(state?.sessionId);
      return stateSessionId === selector.sessionId;
    });
    if (matchingRunner) {
      const matchingPid = Number(matchingRunner.pid || 0);
      return {
        scope: "target-session",
        pid: matchingPid,
        projectId: normalizeNullableString(matchingRunner.projectId) || selector.projectId,
        sessionId: selector.sessionId,
        reason: `target session runner already running pid=${matchingPid} project=${normalizeNullableString(matchingRunner.projectId) || selector.projectId || "unknown"} session=${selector.sessionId || "unknown"}`,
      };
    }

    const globalPidFile = globalDaemonPidFile(config);
    const globalState = await readJson(globalPidFile, null);
    const globalPid = Number(globalState?.pid || 0);
    if (globalPid > 0) {
      if (!isProcessAlive(globalPid)) {
        await fs.rm(globalPidFile, { force: true }).catch(() => {});
      } else {
        return {
          scope: "global",
          pid: globalPid,
          reason: `global daemon already running pid=${globalPid}`,
        };
      }
    }

    return null;
  }

  const targetRunnerStates = await listTargetSessionRunnerStates(config);
  if (targetRunnerStates.length === 0) {
    return null;
  }

  const conflict = targetRunnerStates.find((state) => normalizeNullableString(state?.projectId)) || targetRunnerStates[0];
  return {
    scope: "target-session",
    pid: Number(conflict.pid || 0),
    projectId: normalizeNullableString(conflict.projectId),
    sessionId: normalizeNullableString(conflict.sessionId),
    reason: `target session runner already running pid=${Number(conflict.pid || 0)} project=${normalizeNullableString(conflict.projectId) || "unknown"} session=${normalizeNullableString(conflict.sessionId) || "unknown"}`,
  };
}

export async function writeDaemonPid(config, _pid?: any) {
  const pidFile = daemonPidFile(config);
  const selector = resolveConfiguredTargetSessionSelector(config);
  if (selector.sessionId) {
    await fs.mkdir(getTargetRunnerControlDir(config), { recursive: true });
    const concurrentRunnerCount = await countRunningTargetSessionRunners(config);
    const existingRunnerState = await readJson(pidFile, null);
    const isReplacingCurrentRunner = Boolean(existingRunnerState?.pid && isProcessAlive(existingRunnerState.pid));
    if (!isReplacingCurrentRunner && concurrentRunnerCount >= MAX_CONCURRENT_TARGET_SESSION_RUNNERS) {
      throw new Error(`target session runner limit reached (${MAX_CONCURRENT_TARGET_SESSION_RUNNERS})`);
    }
  }
  const content = JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
    projectId: selector.projectId,
    sessionId: selector.sessionId,
    scope: hasTargetRunnerSelector(config) ? "target-session" : "global",
  });
  await writeScopedPidFile(pidFile, content);
}

export async function clearDaemonPid(config) {
  await fs.rm(daemonPidFile(config), { force: true });
}

export async function readStopRequest(config) {
  return readJson(daemonStopFile(config), null);
}

export async function requestDaemonStop(config, reason = "cli-stop") {
  await writeJsonAtomic(daemonStopFile(config), {
    requestedAt: new Date().toISOString(),
    reason
  });
}

export async function clearStopRequest(config) {
  await fs.rm(daemonStopFile(config), { force: true });
}

export async function readReloadRequest(config) {
  return readJson(daemonReloadFile(config), null);
}

export async function requestDaemonReload(config, reason = "cli-reload") {
  await writeJsonAtomic(daemonReloadFile(config), {
    requestedAt: new Date().toISOString(),
    reason
  });
}

export async function clearReloadRequest(config) {
  await fs.rm(daemonReloadFile(config), { force: true });
}

export function isProcessAlive(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) {
    return false;
  }

  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

export function isDaemonProcess(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) {
    return false;
  }

  try {
    if (process.platform === "win32") {
      const cmd = `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${n}"; if($p){$p.CommandLine}else{''}`;      const output = execSync(`powershell -NoProfile -Command "${cmd}"`, {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
        windowsHide: true
      });
      return /src[\\/]cli\.[jt]s\s+start/i.test(String(output || ""));
    }

    const output = execSync(`ps -p ${n} -o command=`, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      windowsHide: true
    });
    return /src[\\/]cli\.[jt]s\s+start/i.test(String(output || ""));
  } catch {
    return false;
  }
}

// ── Cooperative cancellation contract ────────────────────────────────────────

/**
 * Error thrown by CancellationToken.throwIfCancelled() when the token is
 * cancelled.  Callers that need to distinguish cancellation from other errors
 * can catch this class directly.
 */
export class CancelledError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Operation cancelled: ${reason}`);
    this.name = "CancelledError";
    this.reason = String(reason || "cancelled");
  }
}

/**
 * Cooperative cancellation token for long-running dispatch loops.
 *
 * Create with createCancellationToken() and pass through runSingleCycle /
 * runEvolutionLoop / runWorkerConversation.  At each cooperative checkpoint
 * callers call token.throwIfCancelled() to surface a stop signal that would
 * otherwise only be detected at the top of the next main-loop iteration.
 *
 * Design: intentionally minimal — no AbortController dependency, so existing
 * code paths remain backward-compatible when no token is provided.
 */
export interface CancellationToken {
  /** True once cancel() has been called. Read-only after creation. */
  readonly cancelled: boolean;
  /** Human-readable reason string, or null if not yet cancelled. */
  readonly reason: string | null;
  /**
   * Cancel the token.  Idempotent — repeated calls are no-ops.
   * @param reason — human-readable reason for cancellation
   */
  cancel(reason: string): void;
  /**
   * Throw CancelledError if the token is already cancelled.
   * Use at cooperative checkpoints inside dispatch/evolution loops.
   */
  throwIfCancelled(): void;
}

/**
 * Create a fresh, non-cancelled CancellationToken.
 *
 * @example
 *   const token = createCancellationToken();
 *   // … pass token through the dispatch loop …
 *   token.cancel("stop-requested");  // from the daemon stop-file poller
 *
 * @returns {CancellationToken}
 */
export function createCancellationToken(): CancellationToken {
  let _cancelled = false;
  let _reason: string | null = null;
  return {
    get cancelled() { return _cancelled; },
    get reason()    { return _reason;    },
    cancel(reason: string) {
      if (!_cancelled) {
        _cancelled = true;
        _reason = String(reason || "cancelled");
      }
    },
    throwIfCancelled() {
      if (_cancelled) {
        throw new CancelledError(_reason ?? "cancelled");
      }
    },
  };
}

/**
 * Kill ALL running daemon processes (not just the one in the PID file).
 * Prevents orphan daemons from accumulating when box:off only kills one PID
 * but other instances survive (e.g. child workers kept parent alive).
 * Returns the PIDs that were killed.
 */
export function killAllDaemonProcesses(excludePid?: number): number[] {
  const killed: number[] = [];
  try {
    let pids: number[];
    if (process.platform === "win32") {
      const cmd = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'src[\\\\/]cli\\.[jt]s\\s+start' } | Select-Object -ExpandProperty ProcessId`;
      const output = execSync(`powershell -NoProfile -Command "${cmd}"`, {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
        windowsHide: true,
        timeout: 10_000,
      });
      pids = String(output || "").split(/\r?\n/).map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
    } else {
      const output = execSync("pgrep -f 'src/cli\\.[jt]s start'", {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
        windowsHide: true,
        timeout: 10_000,
      });
      pids = String(output || "").split(/\r?\n/).map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
    }

    for (const pid of pids) {
      if (pid === process.pid) continue;        // never kill self
      if (pid === excludePid) continue;          // caller may want to spare one
      try {
        process.kill(pid, "SIGKILL");
        killed.push(pid);
      } catch { /* already gone */ }
    }
  } catch { /* no matches or command failed — safe to ignore */ }
  return killed;
}

/**
 * Full shutdown — clear all AI state so next start runs a fresh Jesus cycle.
 * This is the "kapat" command: kills daemon, clears leadership/worker state.
 * Progress log and premium usage are preserved for audit.
 */
export async function clearAllAIState(config) {
  const stateDir = config.paths?.stateDir || "state";
  const cleared = [];

  // Remove fixed state files
  for (const file of SHUTDOWN_CLEAR_FILES) {
    try {
      await fs.rm(path.join(stateDir, file), { force: true });
      cleared.push(file);
    } catch { /* already gone */ }
  }

  // Remove per-worker state and debug files
  try {
    const entries = await fs.readdir(stateDir);
    for (const entry of entries) {
      if (WORKER_STATE_PATTERN.test(entry) || DEBUG_WORKER_PATTERN.test(entry) || DEBUG_AGENT_PATTERN.test(entry)) {
        await fs.rm(path.join(stateDir, entry), { force: true });
        cleared.push(entry);
      }
    }
  } catch { /* state dir may not exist */ }

  await fs.rm(getTargetRunnerControlDir(config), { recursive: true, force: true }).catch(() => {});
  cleared.push("session_runners/");

  return cleared;
}
