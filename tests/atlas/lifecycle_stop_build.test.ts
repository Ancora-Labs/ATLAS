import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readAtlasBuildRequest, writeAtlasBuildRequest } from "../../src/atlas/build_request_state.js";
import { runAtlasLifecycleAction } from "../../src/atlas/lifecycle.js";
import { clearDaemonPid, isProcessAlive, readDaemonPid, readStopRequest } from "../../src/core/daemon_control.js";

function makeScopedConfig(stateDir: string) {
  return {
    paths: { stateDir },
    targetSessionSelector: {
      projectId: "target_bowling",
      sessionId: "sess_stop_me",
    },
  };
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(value, null, 2));
}

function createDesktopSession(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: sessionId,
    title: "STRIKE SOCIAL",
    objective: "Build the target landing page.",
    summary: "Build the target landing page.",
    operatorIntentBrief: "Build the target landing page.",
    selectedModel: null,
    projectId: "target_bowling",
    projectSessionId: "sess_stop_me",
    projectWorkspacePath: "C:/tmp/target_bowling/sess_stop_me",
    projectName: null,
    projectDescription: null,
    repoContext: {
      provider: "github",
      targetRepo: "CanerDoqdu/bowling",
      targetBaseBranch: "main",
      repoMode: "new",
      repoCreatedByAtlas: true,
    },
    status: "ready",
    openQuestions: [],
    executionNotes: [],
    attachments: [],
    attachmentPlans: [],
    clarificationAnswers: [],
    pendingQuestionIndex: null,
    pendingQuestion: null,
    messages: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

async function writeDesktopSessionStore(stateDir: string, sessions: unknown[]): Promise<void> {
  await writeJson(path.join(stateDir, "atlas", "desktop_sessions.json"), {
    schemaVersion: 2,
    updatedAt: "2026-05-01T00:00:00.000Z",
    sessions,
  });
}

async function startScopedDummyRunner(stateDir: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  await writeJson(path.join(stateDir, "session_runners", "target_bowling_sess_stop_me.pid.json"), {
    pid: child.pid,
    startedAt: "2026-05-01T00:00:00.000Z",
    projectId: "target_bowling",
    sessionId: "sess_stop_me",
    scope: "target-session",
  });
  return child;
}

async function cleanupDummyRunner(child: ChildProcess | null): Promise<void> {
  const pid = Number(child?.pid || 0);
  if (pid > 0 && isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
}

describe("atlas lifecycle stop-build", () => {
  it("writes the stop request to the selected target-session runner scope", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-stop-build-"));
    const scopedConfig = makeScopedConfig(stateDir);
    let child: ChildProcess | null = null;

    try {
      await writeDesktopSessionStore(stateDir, [createDesktopSession("atlas-session-1")]);
      await fs.mkdir(path.join(stateDir, "projects"), { recursive: true });
      await writeAtlasBuildRequest(stateDir, {
        sessionId: "atlas-session-1",
        projectId: "target_bowling",
        projectSessionId: "sess_stop_me",
        projectWorkspacePath: "C:/tmp/target_bowling/sess_stop_me",
        title: "STRIKE SOCIAL",
        objective: "Build the target landing page.",
        summary: "Build the target landing page.",
        targetRepo: "CanerDoqdu/bowling",
        targetBaseBranch: "main",
        repoMode: "new",
        repoCreatedByAtlas: true,
        requestedAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        triggerMode: "daemon",
        triggerState: "running",
        triggerLabel: "Running.",
        runnerPid: null,
        lastError: null,
        planningPrompt: "Build it.",
        appliedAt: "2026-05-01T00:00:00.000Z",
      });
      child = await startScopedDummyRunner(stateDir);
      assert.ok(child.pid);

      const result = await runAtlasLifecycleAction(stateDir, {
        action: "stop-build",
        sessionId: "atlas-session-1",
      });

      const scopedStop = await readStopRequest(scopedConfig);
      const scopedPid = await readDaemonPid(scopedConfig);
      const globalStop = await readStopRequest({ paths: { stateDir } });
      const buildRequest = await readAtlasBuildRequest(stateDir);

      assert.equal(result.ok, true);
      assert.equal(result.scope, "build");
      assert.equal(isProcessAlive(Number(child.pid || 0)), false);
      assert.equal(scopedStop, null);
      assert.equal(scopedPid, null);
      assert.equal(globalStop, null);
      assert.equal(buildRequest?.triggerState, "paused");
      assert.equal(buildRequest?.runnerPid, null);
    } finally {
      await cleanupDummyRunner(child);
      await clearDaemonPid(scopedConfig).catch(() => {});
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] rejects stop-build for a session that does not own the live build", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-stop-build-negative-"));

    try {
      await writeDesktopSessionStore(stateDir, [createDesktopSession("atlas-session-other", {
        projectId: "target_other",
        projectSessionId: "sess_other",
        projectWorkspacePath: null,
        repoContext: {
          provider: "github",
          targetRepo: "CanerDoqdu/other",
          targetBaseBranch: "main",
          repoMode: "new",
          repoCreatedByAtlas: true,
        },
      })]);
      await writeAtlasBuildRequest(stateDir, {
        sessionId: "atlas-session-owner",
        projectId: "target_bowling",
        projectSessionId: "sess_owner",
        projectWorkspacePath: null,
        title: "STRIKE SOCIAL",
        objective: "Build the target landing page.",
        summary: "Build the target landing page.",
        targetRepo: "CanerDoqdu/bowling",
        targetBaseBranch: "main",
        repoMode: "new",
        repoCreatedByAtlas: true,
        requestedAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        triggerMode: "daemon",
        triggerState: "running",
        triggerLabel: "Running.",
        runnerPid: null,
        lastError: null,
        planningPrompt: "Build it.",
        appliedAt: "2026-05-01T00:00:00.000Z",
      });

      await assert.rejects(
        () => runAtlasLifecycleAction(stateDir, {
          action: "stop-build",
          sessionId: "atlas-session-other",
        }),
        /does not own the current live build mission/,
      );

      assert.equal(await readStopRequest({ paths: { stateDir } }), null);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("stops a session-scoped runner when the active build binding carries a stale desktop session id", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-stop-build-stale-binding-"));
    const scopedConfig = makeScopedConfig(stateDir);
    let child: ChildProcess | null = null;

    try {
      await writeDesktopSessionStore(stateDir, [createDesktopSession("atlas-session-current")]);
      await writeJson(path.join(stateDir, "projects", "target_bowling", "sess_stop_me", "target_session.json"), {
        projectId: "target_bowling",
        sessionId: "sess_stop_me",
        repo: {
          repoFullName: "CanerDoqdu/bowling",
          repoUrl: "https://github.com/CanerDoqdu/bowling.git",
        },
      });
      await writeAtlasBuildRequest(stateDir, {
        sessionId: "atlas-session-stale",
        projectId: "target_bowling",
        projectSessionId: "sess_stop_me",
        projectWorkspacePath: "C:/tmp/target_bowling/sess_stop_me",
        title: "STRIKE SOCIAL",
        objective: "Build the target landing page.",
        summary: "Build the target landing page.",
        targetRepo: "CanerDoqdu/bowling",
        targetBaseBranch: "main",
        repoMode: "new",
        repoCreatedByAtlas: true,
        requestedAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        triggerMode: "daemon",
        triggerState: "running",
        triggerLabel: "Running.",
        runnerPid: null,
        lastError: null,
        planningPrompt: "Build it.",
        appliedAt: "2026-05-01T00:00:00.000Z",
      });
      child = await startScopedDummyRunner(stateDir);
      assert.ok(child.pid);

      const result = await runAtlasLifecycleAction(stateDir, {
        action: "stop-build",
        sessionId: "atlas-session-current",
      });

      const scopedStop = await readStopRequest(scopedConfig);
      const scopedPid = await readDaemonPid(scopedConfig);
      const buildRequest = await readAtlasBuildRequest(stateDir);

      assert.equal(result.ok, true);
      assert.equal(isProcessAlive(Number(child.pid || 0)), false);
      assert.equal(scopedStop, null);
      assert.equal(scopedPid, null);
      assert.equal(buildRequest?.sessionId, "atlas-session-current");
      assert.equal(buildRequest?.triggerState, "paused");
    } finally {
      await cleanupDummyRunner(child);
      await clearDaemonPid(scopedConfig).catch(() => {});
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});