import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getActiveTargetSessionPath, loadPlatformModeState, PLATFORM_MODE } from "../../src/core/mode_state.js";
import {
  archiveTargetSession,
  createTargetSession,
  getTargetCompletionPath,
  getTargetIntakeManifestPath,
  getTargetIntentContractPath,
  getOpenTargetSessionsPath,
  getTargetWorkspaceRootPath,
  getTargetSessionPath,
  getTargetWorkspacePath,
  getLegacyTargetWorkspacePath,
  listOpenTargetSessions,
  loadActiveTargetSession,
  saveActiveTargetSession,
  loadTargetSession,
  selectActiveTargetSession,
  TARGET_SESSION_STAGE,
  transitionActiveTargetSession,
  validateTargetIntakeManifest,
} from "../../src/core/target_session_state.js";

function buildConfig(tempRoot: string) {
  const rootDir = path.join(tempRoot, "box-root");
  return {
    rootDir,
    paths: {
      stateDir: path.join(rootDir, "state"),
      workspaceDir: path.join(rootDir, ".box-work"),
    },
    selfDev: {
      futureModeFlags: {
        singleTargetDelivery: true,
        targetSessionState: true,
        targetWorkspaceLifecycle: true,
      },
    },
  };
}

function buildManifest(overrides: Record<string, unknown> = {}) {
  return {
    mode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
    requestId: "req_target_001",
    target: {
      repoUrl: "https://github.com/acme/portal.git",
      defaultBranch: "main",
      provider: "github",
    },
    objective: {
      summary: "Stabilize target intake and readiness flow",
      desiredOutcome: "Target repo becomes ready for guarded delivery",
      acceptanceCriteria: ["ready", "isolated"],
    },
    constraints: {
      protectedPaths: ["infra/prod"],
      forbiddenActions: ["force push"],
    },
    operator: {
      requestedBy: "user",
      approvalMode: "human_required_for_high_risk",
    },
    notes: ["keep self_dev isolated"],
    ...overrides,
  };
}

function createBareRemoteRepo(tempRoot: string) {
  const remoteRepo = path.join(tempRoot, "remote-origin.git");
  const seedRepo = path.join(tempRoot, "seed-repo");

  execFileSync("git", ["init", "--bare", remoteRepo], { stdio: "pipe" });
  execFileSync("git", ["init", "-b", "main", seedRepo], { stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "BOX Test"], { cwd: seedRepo, stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "box@example.com"], { cwd: seedRepo, stdio: "pipe" });
  execFileSync("git", ["remote", "add", "origin", remoteRepo], { cwd: seedRepo, stdio: "pipe" });
  execFileSync("git", ["add", "."], { cwd: seedRepo, stdio: "pipe" });

  return {
    remoteRepo,
    seedRepo,
  };
}

describe("target_session_state", () => {
  it("creates a fresh isolated target session with active pointer, state folder, and workspace", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const session = await createTargetSession(buildManifest(), config);
    const modeState = await loadPlatformModeState(config);

    const sessionDir = getTargetSessionPath(config.paths.stateDir, session.projectId, session.sessionId);
    const intakePath = getTargetIntakeManifestPath(config.paths.stateDir, session.projectId, session.sessionId);
    const workspacePath = getTargetWorkspacePath(config.paths.workspaceDir, session.projectId, session.sessionId);
    const activePath = getActiveTargetSessionPath(config.paths.stateDir);
    const targetWorkspaceRoot = getTargetWorkspaceRootPath(config.paths.workspaceDir, config.rootDir);

    assert.equal(session.currentMode, PLATFORM_MODE.SINGLE_TARGET_DELIVERY);
    assert.equal(session.currentStage, TARGET_SESSION_STAGE.ONBOARDING);
    assert.equal(session.gates.allowPlanning, false);
    assert.equal(session.workspace.prepared, false);
    assert.equal(session.repo.provider, "github");
    assert.equal(modeState.currentMode, PLATFORM_MODE.SINGLE_TARGET_DELIVERY);
    assert.equal(modeState.activeTargetSessionId, session.sessionId);
    assert.equal(modeState.activeTargetProjectId, session.projectId);
    assert.notEqual(workspacePath, process.cwd());
    assert.ok(workspacePath.startsWith(targetWorkspaceRoot));
    assert.ok(!workspacePath.startsWith(config.rootDir));
    await assert.doesNotReject(() => fs.access(sessionDir));
    await assert.doesNotReject(() => fs.access(intakePath));
    await assert.doesNotReject(() => fs.access(activePath));
    await assert.doesNotReject(() => fs.access(workspacePath));
  });

  it("prepares an isolated workspace from a local target path when source material already exists", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const localRepo = path.join(tempRoot, "source-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "package.json"), JSON.stringify({ name: "portal" }, null, 2));

    const session = await createTargetSession(buildManifest({ target: {
      repoUrl: "https://github.com/acme/portal.git",
      defaultBranch: "main",
      provider: "github",
      localPathHint: localRepo,
    } }), config);

    assert.equal(session.workspace.prepared, true);
    await assert.doesNotReject(() => fs.access(path.join(session.workspace.path, ".git")));
    await assert.doesNotReject(() => fs.access(path.join(session.workspace.path, "package.json")));
    assert.notEqual(session.workspace.path, localRepo);
  });

  it("bootstraps a remote repo URL into the isolated target workspace", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const { remoteRepo, seedRepo } = createBareRemoteRepo(tempRoot);
    await fs.writeFile(path.join(seedRepo, "package.json"), JSON.stringify({
      name: "remote-portal",
      scripts: {
        build: "npm run build",
      },
    }, null, 2));
    execFileSync("git", ["add", "."], { cwd: seedRepo, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "seed remote repo"], { cwd: seedRepo, stdio: "pipe" });
    execFileSync("git", ["push", "-u", "origin", "main"], { cwd: seedRepo, stdio: "pipe" });

    const session = await createTargetSession(buildManifest({
      target: {
        repoUrl: remoteRepo,
        defaultBranch: "main",
        provider: "unknown",
      },
    }), config);

    assert.equal(session.workspace.prepared, true);
    assert.equal(session.workspace.bootstrap.strategy, "git_clone");
    assert.equal(session.workspace.bootstrap.status, "ready");
    await assert.doesNotReject(() => fs.access(path.join(session.workspace.path, ".git")));
    await assert.doesNotReject(() => fs.access(path.join(session.workspace.path, "package.json")));
    assert.equal(session.repo.localPath, session.workspace.path);
  });

  it("keeps the selected active session intact while opening a second session for a different repo", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const firstSession = await createTargetSession(buildManifest(), config);

    const secondSession = await createTargetSession(buildManifest({ target: {
        repoUrl: "https://github.com/acme/second.git",
        defaultBranch: "main",
        provider: "github",
      } }), config);

    const selectedSession = await loadActiveTargetSession(config);
    const openSessions = await listOpenTargetSessions(config);
    const registry = JSON.parse(await fs.readFile(getOpenTargetSessionsPath(config.paths.stateDir), "utf8"));

    assert.equal(selectedSession?.sessionId, firstSession.sessionId);
    assert.equal(secondSession.sessionId !== firstSession.sessionId, true);
    assert.equal(openSessions.length, 2);
    assert.equal(registry.length, 2);
  });

  it("rejects opening the same repo while that repo already has an active session", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    await createTargetSession(buildManifest(), config);

    await assert.rejects(
      () => createTargetSession(buildManifest({ requestId: "req_target_same_repo_002" }), config),
      /Active target session for this repo already exists/
    );
  });

  it("selects a different open session without archiving the previous one", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const firstSession = await createTargetSession(buildManifest(), config);
    const secondSession = await createTargetSession(buildManifest({
      target: {
        repoUrl: "https://github.com/acme/second.git",
        defaultBranch: "main",
        provider: "github",
      },
    }), config);

    const selectedSession = await selectActiveTargetSession(config, { sessionId: secondSession.sessionId, projectId: secondSession.projectId });
    const reloadedSelectedSession = await loadActiveTargetSession(config);
    const loadedSecondSession = await loadTargetSession(config, { sessionId: secondSession.sessionId, projectId: secondSession.projectId });
    const openSessions = await listOpenTargetSessions(config);

    assert.equal(selectedSession.sessionId, secondSession.sessionId);
    assert.equal(reloadedSelectedSession?.sessionId, secondSession.sessionId);
    assert.equal(loadedSecondSession?.sessionId, secondSession.sessionId);
    assert.equal(openSessions.some((session) => session.sessionId === firstSession.sessionId), true);
    assert.equal(openSessions.some((session) => session.sessionId === secondSession.sessionId), true);
  });

  it("loads and archives a bound session without replacing the globally selected session", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const firstSession = await createTargetSession(buildManifest(), config);
    const secondSession = await createTargetSession(buildManifest({
      target: {
        repoUrl: "https://github.com/acme/bound.git",
        defaultBranch: "main",
        provider: "github",
      },
    }), config);

    const boundConfig = {
      ...config,
      targetSessionSelector: {
        sessionId: secondSession.sessionId,
        projectId: secondSession.projectId,
      },
    };

    const boundLoadedSession = await loadActiveTargetSession(boundConfig);
    assert.equal(boundLoadedSession?.sessionId, secondSession.sessionId);

    await saveActiveTargetSession(boundConfig, {
      ...boundLoadedSession,
      handoff: {
        ...boundLoadedSession.handoff,
        lastAction: "bound-update",
      },
    });

    const selectedSession = await loadActiveTargetSession(config);
    assert.equal(selectedSession?.sessionId, firstSession.sessionId);

    const archived = await archiveTargetSession(boundConfig, {
      completionStage: TARGET_SESSION_STAGE.COMPLETED,
      completionReason: "bound_session_closed",
    });
    const reloadedSelectedSession = await loadActiveTargetSession(config);
    const openSessions = await listOpenTargetSessions(config);

    assert.equal(archived.sessionId, secondSession.sessionId);
    assert.equal(reloadedSelectedSession?.sessionId, firstSession.sessionId);
    assert.equal(openSessions.some((session) => session.sessionId === secondSession.sessionId), false);
  });

  it("normalizes modern intake manifests and rejects non-target modes", async () => {
    const normalizedManifest = validateTargetIntakeManifest(buildManifest());

    assert.equal(normalizedManifest.mode, PLATFORM_MODE.SINGLE_TARGET_DELIVERY);
    assert.equal(normalizedManifest.target.repoUrl, "https://github.com/acme/portal.git");
    assert.equal(normalizedManifest.target.provider, "github");
    assert.equal(normalizedManifest.objective.desiredOutcome, "Target repo becomes ready for guarded delivery");

    assert.throws(
      () => validateTargetIntakeManifest(buildManifest({ mode: PLATFORM_MODE.SELF_DEV })),
      /single_target_delivery/
    );
  });

  it("normalizes malformed active session files back to isolated workspace truth", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const activePath = getActiveTargetSessionPath(config.paths.stateDir);
    await fs.mkdir(config.paths.stateDir, { recursive: true });
    await fs.writeFile(activePath, JSON.stringify({
      projectId: "target_portal",
      sessionId: "sess_manual",
      currentMode: "self_dev",
      currentStage: "bad_stage",
      workspace: { path: path.join(tempRoot, "wrong-root") },
      objective: { summary: "Keep session safe" },
    }, null, 2));

    const session = await loadActiveTargetSession(config);

    assert.ok(session);
    assert.equal(session?.currentMode, PLATFORM_MODE.SINGLE_TARGET_DELIVERY);
    assert.equal(session?.currentStage, TARGET_SESSION_STAGE.ONBOARDING);
    assert.equal(
      session?.workspace.path,
      getTargetWorkspacePath(config.paths.workspaceDir, "target_portal", "sess_manual", config.rootDir)
    );
    assert.ok(Array.isArray(session?.warnings));
    assert.ok(session?.warnings.some((entry: string) => entry.includes("normalized")));
  });

  it("treats archived active-session snapshots as closed and removes them from open tracking", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const activePath = getActiveTargetSessionPath(config.paths.stateDir);
    const stateDir = config.paths.stateDir;
    const workspacePath = getTargetWorkspacePath(config.paths.workspaceDir, "target_portal", "sess_archived", config.rootDir);

    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(activePath, JSON.stringify({
      projectId: "target_portal",
      sessionId: "sess_archived",
      currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
      currentStage: TARGET_SESSION_STAGE.ACTIVE,
      repo: {
        repoUrl: "https://github.com/acme/portal.git",
      },
      workspace: {
        path: workspacePath,
      },
      objective: { summary: "Resume the same session" },
      lifecycle: {
        openedAt: "2026-04-24T09:01:12.000Z",
        updatedAt: "2026-04-25T12:34:36.000Z",
        closedAt: "2026-04-25T12:34:36.000Z",
        archivedAt: "2026-04-25T12:34:36.000Z",
        status: "open",
        completionReason: "fresh_session_opened_by_mistake",
      },
      handoff: {
        lastAction: "session_archived",
        nextAction: "await_next_target",
      },
    }, null, 2));
    await fs.writeFile(getOpenTargetSessionsPath(stateDir), JSON.stringify([
      {
        projectId: "target_portal",
        sessionId: "sess_archived",
        currentStage: TARGET_SESSION_STAGE.ACTIVE,
        repoUrl: "https://github.com/acme/portal.git",
        objectiveSummary: "Resume the same session",
        workspacePath,
        updatedAt: "2026-04-25T12:34:36.000Z",
      },
    ], null, 2));

    const session = await loadActiveTargetSession(config);
    const openSessions = await listOpenTargetSessions(config);

    assert.equal(session, null);
    assert.equal(openSessions.length, 0);
    await assert.rejects(() => fs.access(activePath));
  });

  it("migrates legacy in-repo target workspaces to the external isolated workspace root", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const activePath = getActiveTargetSessionPath(config.paths.stateDir);
    const legacyWorkspacePath = getLegacyTargetWorkspacePath(config.paths.workspaceDir, "target_portal", "sess_legacy");
    const externalWorkspacePath = getTargetWorkspacePath(config.paths.workspaceDir, "target_portal", "sess_legacy", config.rootDir);

    await fs.mkdir(path.dirname(activePath), { recursive: true });
    await fs.mkdir(legacyWorkspacePath, { recursive: true });
    await fs.writeFile(path.join(legacyWorkspacePath, "index.html"), "legacy workspace", "utf8");
    await fs.writeFile(activePath, JSON.stringify({
      projectId: "target_portal",
      sessionId: "sess_legacy",
      currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
      currentStage: TARGET_SESSION_STAGE.SHADOW,
      repo: {
        repoUrl: "https://github.com/acme/portal.git",
        localPath: legacyWorkspacePath,
      },
      workspace: {
        path: legacyWorkspacePath,
        prepared: true,
      },
      objective: { summary: "Migrate legacy workspace" },
      gates: {
        allowPlanning: true,
        allowShadowExecution: true,
        allowActiveExecution: false,
      },
    }, null, 2));

    const session = await loadActiveTargetSession(config);

    assert.equal(session?.workspace.path, externalWorkspacePath);
    assert.equal(session?.repo.localPath, externalWorkspacePath);
    await assert.doesNotReject(() => fs.access(path.join(externalWorkspacePath, "index.html")));
    await assert.rejects(() => fs.access(legacyWorkspacePath));
  });

  it("archives a completed session, writes completion state, and cleans the workspace", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const session = await createTargetSession(buildManifest(), config);
    const workspacePath = session.workspace.path;
    const archived = await archiveTargetSession(config, {
      completionStage: TARGET_SESSION_STAGE.COMPLETED,
      completionReason: "Target onboarding finished and session closed",
    });
    const modeState = await loadPlatformModeState(config);

    const completionPath = getTargetCompletionPath(config.paths.stateDir, session.projectId, session.sessionId);
    const activePath = getActiveTargetSessionPath(config.paths.stateDir);
    const completionRecord = JSON.parse(await fs.readFile(completionPath, "utf8"));

    assert.equal(archived.currentStage, TARGET_SESSION_STAGE.COMPLETED);
    assert.equal(modeState.currentMode, PLATFORM_MODE.IDLE);
    assert.equal(modeState.activeTargetSessionId, null);
    assert.equal(modeState.activeTargetProjectId, null);
    assert.equal(completionRecord.finalStatus, TARGET_SESSION_STAGE.COMPLETED);
    assert.equal(completionRecord.completionSummary, "Target repo becomes ready for guarded delivery");
    await assert.doesNotReject(() => fs.access(completionPath));
    await assert.rejects(() => fs.access(activePath));
    await assert.rejects(() => fs.access(workspacePath));
  });

  it("returns cleanly to self_dev after target archive and allows a new target session to open", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);

    const firstSession = await createTargetSession(buildManifest({
      requestId: "req_target_transition_001",
      target: {
        repoUrl: "https://github.com/acme/portal.git",
        defaultBranch: "main",
        provider: "github",
      },
    }), config);

    let modeState = await loadPlatformModeState(config);
    assert.equal(modeState.currentMode, PLATFORM_MODE.SINGLE_TARGET_DELIVERY);
    assert.equal(modeState.activeTargetSessionId, firstSession.sessionId);
    assert.equal(modeState.fallbackModeAfterCompletion, PLATFORM_MODE.IDLE);

    const archived = await archiveTargetSession(config, {
      completionStage: TARGET_SESSION_STAGE.COMPLETED,
      completionReason: "transition regression closeout",
    });

    assert.equal(archived.currentStage, TARGET_SESSION_STAGE.COMPLETED);

    modeState = await loadPlatformModeState(config);
    const activeSessionAfterArchive = await loadActiveTargetSession(config);
    assert.equal(modeState.currentMode, PLATFORM_MODE.IDLE);
    assert.equal(modeState.activeTargetSessionId, null);
    assert.equal(modeState.activeTargetProjectId, null);
    assert.equal(activeSessionAfterArchive, null);

    const secondSession = await createTargetSession(buildManifest({
      requestId: "req_target_transition_002",
      target: {
        repoUrl: "https://github.com/acme/second-portal.git",
        defaultBranch: "main",
        provider: "github",
      },
      objective: {
        summary: "Open a second target after self_dev fallback",
        desiredOutcome: "Mode and pointer reset cleanly between sessions",
        acceptanceCriteria: ["mode reset", "new session opens"],
      },
    }), config);

    modeState = await loadPlatformModeState(config);
    assert.equal(modeState.currentMode, PLATFORM_MODE.SINGLE_TARGET_DELIVERY);
    assert.equal(modeState.activeTargetSessionId, secondSession.sessionId);
    assert.notEqual(secondSession.sessionId, firstSession.sessionId);
    assert.notEqual(secondSession.projectId, "");
  });

  it("clears stale singleton target artifacts before opening a new target session", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const stateDir = config.paths.stateDir;

    await createTargetSession(buildManifest({
      requestId: "req_target_cleanup_001",
    }), config);

    await archiveTargetSession(config, {
      completionStage: TARGET_SESSION_STAGE.COMPLETED,
      completionReason: "cleanup boundary regression",
    });

    await fs.mkdir(stateDir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(stateDir, "approved_plan_set.json"), JSON.stringify({ stale: true }), "utf8"),
      fs.writeFile(path.join(stateDir, "athena_plan_review.json"), JSON.stringify({ stale: true }), "utf8"),
      fs.writeFile(path.join(stateDir, "dispatch_checkpoint.json"), JSON.stringify({ stale: true }), "utf8"),
      fs.writeFile(path.join(stateDir, "last_target_delivery_handoff.json"), JSON.stringify({ stale: true }), "utf8"),
      fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({ stale: true }), "utf8"),
      fs.writeFile(path.join(stateDir, "prometheus_analysis.json"), JSON.stringify({ stale: true }), "utf8"),
      fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({ stale: true }), "utf8"),
      fs.writeFile(path.join(stateDir, "worker_sessions.json"), JSON.stringify({ stale: true }), "utf8"),
      fs.writeFile(path.join(stateDir, "debug_worker_evolution-worker.txt"), "stale worker evidence", "utf8"),
    ]);

    await createTargetSession(buildManifest({
      requestId: "req_target_cleanup_002",
      target: {
        repoUrl: "https://github.com/acme/second-cleanup.git",
        defaultBranch: "main",
        provider: "github",
      },
    }), config);

    await Promise.all([
      assert.rejects(() => fs.access(path.join(stateDir, "approved_plan_set.json"))),
      assert.rejects(() => fs.access(path.join(stateDir, "athena_plan_review.json"))),
      assert.rejects(() => fs.access(path.join(stateDir, "dispatch_checkpoint.json"))),
      assert.rejects(() => fs.access(path.join(stateDir, "last_target_delivery_handoff.json"))),
      assert.rejects(() => fs.access(path.join(stateDir, "pipeline_progress.json"))),
      assert.rejects(() => fs.access(path.join(stateDir, "prometheus_analysis.json"))),
      assert.rejects(() => fs.access(path.join(stateDir, "worker_cycle_artifacts.json"))),
      assert.rejects(() => fs.access(path.join(stateDir, "worker_sessions.json"))),
      assert.rejects(() => fs.access(path.join(stateDir, "debug_worker_evolution-worker.txt"))),
    ]);
  });

  it("allows a fresh session on the same repo after the earlier session is completed", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);

    const firstSession = await createTargetSession(buildManifest({
      requestId: "req_target_same_repo_completed_001",
    }), config);

    await archiveTargetSession(config, {
      completionStage: TARGET_SESSION_STAGE.COMPLETED_WITH_HANDOFF,
      completionReason: "same_repo_reopen_regression",
      completionSummary: "First session completed and should remain only as archive history.",
    });

    const reopenedSession = await createTargetSession(buildManifest({
      requestId: "req_target_same_repo_completed_002",
    }), config);

    assert.notEqual(reopenedSession.sessionId, firstSession.sessionId);
    assert.equal(reopenedSession.projectId, firstSession.projectId);
    assert.equal(reopenedSession.currentStage, TARGET_SESSION_STAGE.ONBOARDING);
  });

  it("preserves richer session intent fields when canonical contract style fields are empty", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const session = await createTargetSession(buildManifest(), config);
    const intentContractPath = getTargetIntentContractPath(config.paths.stateDir, session.projectId, session.sessionId);

    const enrichedSession = await saveActiveTargetSession(config, {
      ...session,
      clarification: {
        ...session.clarification,
        status: "completed",
        readyForPlanning: true,
        intentContractPath,
        completedAt: "2026-04-24T10:00:00.000Z",
      },
      intent: {
        ...session.intent,
        status: "ready_for_planning",
        summary: "Session intent carries the richer desktop UI contract.",
        planningMode: "active",
        scopeOut: ["generic dark dashboard grid"],
        protectedAreas: ["premium monochrome product identity"],
        preferredQualityBar: "Premium, original monochrome desktop workspace",
        designDirection: "Avoid older dashboard resemblance and AI knockoff drift",
        successCriteria: ["UI stays product-owned and non-derivative"],
        updatedAt: "2026-04-24T10:00:00.000Z",
      },
      lifecycle: {
        ...session.lifecycle,
        updatedAt: "2026-04-24T10:00:00.000Z",
      },
    });

    await fs.writeFile(intentContractPath, JSON.stringify({
      schemaVersion: 1,
      projectId: session.projectId,
      sessionId: session.sessionId,
      status: "ready_for_planning",
      readyForPlanning: true,
      planningMode: "active",
      summary: "Contract refreshed after onboarding.",
      clarifiedIntent: {
        productType: "Windows-first Electron desktop app",
        targetUsers: [],
        mustHaveFlows: [],
        scopeIn: [],
        scopeOut: [],
        protectedAreas: [],
        preferredQualityBar: null,
        designDirection: null,
        deploymentExpectations: [],
        successCriteria: [],
      },
      assumptions: [],
      openQuestions: [],
      updatedAt: "2026-04-24T11:00:00.000Z",
      createdAt: "2026-04-24T09:00:00.000Z",
    }, null, 2));

    const reloaded = await loadActiveTargetSession(config);

    assert.equal(reloaded?.intent.summary, "Contract refreshed after onboarding.");
    assert.deepEqual(reloaded?.intent.scopeOut, enrichedSession.intent.scopeOut);
    assert.deepEqual(reloaded?.intent.protectedAreas, enrichedSession.intent.protectedAreas);
    assert.equal(reloaded?.intent.preferredQualityBar, enrichedSession.intent.preferredQualityBar);
    assert.equal(reloaded?.intent.designDirection, enrichedSession.intent.designDirection);
    assert.deepEqual(reloaded?.intent.successCriteria, enrichedSession.intent.successCriteria);
  });

  it("transitions an active target session with stage-specific gates and preserved human inputs", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    await createTargetSession(buildManifest(), config);

    const transitioned = await transitionActiveTargetSession(config, {
      nextStage: TARGET_SESSION_STAGE.QUARANTINED,
      actor: "test",
      reason: "manual review required",
      handoff: {
        requiredHumanInputs: ["review quarantine decision"],
      },
    });

    assert.equal(transitioned.currentStage, TARGET_SESSION_STAGE.QUARANTINED);
    assert.equal(transitioned.gates.allowPlanning, false);
    assert.equal(transitioned.gates.allowActiveExecution, false);
    assert.equal(transitioned.gates.quarantine, true);
    assert.equal(transitioned.lifecycle.status, "quarantined");
    assert.deepEqual(transitioned.handoff.requiredHumanInputs, ["review quarantine decision"]);
    assert.equal(transitioned.handoff.nextAction, "await_human_review");
  });

  it("persists single-target feedback metadata across active session reloads", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const created = await createTargetSession(buildManifest(), config);

    await fs.writeFile(
      getActiveTargetSessionPath(config.paths.stateDir),
      JSON.stringify({
        ...created,
        feedback: {
          pendingResearchRefresh: true,
          pendingIntentClarification: false,
          lastAthenaReview: {
            status: "rejected",
            category: "research",
            code: "LOW_PLAN_QUALITY",
            message: "Need better stack evidence",
            corrections: ["Bring stack evidence"],
            updatedAt: "2026-04-16T00:00:00.000Z",
          },
        },
      }, null, 2),
      "utf8",
    );

    const loaded = await loadActiveTargetSession(config);
    assert.equal(loaded?.feedback?.pendingResearchRefresh, true);
    assert.equal(loaded?.feedback?.lastAthenaReview?.category, "research");
    assert.deepEqual(loaded?.feedback?.lastAthenaReview?.corrections, ["Bring stack evidence"]);
  });

  it("hydrates stale active session snapshots from the canonical target intent contract", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    const created = await createTargetSession(buildManifest(), config);

    const staleSnapshot = {
      ...created,
      currentStage: TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION,
      clarification: {
        ...created.clarification,
        status: "pending",
        readyForPlanning: false,
        pendingQuestions: ["Old question"],
      },
      intent: {
        ...created.intent,
        status: "pending",
        summary: null,
        planningMode: null,
        scopeIn: [],
        successCriteria: [],
        updatedAt: "2026-04-22T11:13:28.134Z",
      },
      lifecycle: {
        ...created.lifecycle,
        updatedAt: "2026-04-22T11:13:28.134Z",
      },
    };

    await fs.writeFile(getActiveTargetSessionPath(config.paths.stateDir), JSON.stringify(staleSnapshot, null, 2), "utf8");
    await fs.writeFile(path.join(getTargetSessionPath(config.paths.stateDir, created.projectId, created.sessionId), "target_session.json"), JSON.stringify(staleSnapshot, null, 2), "utf8");
    await fs.writeFile(
      getTargetIntentContractPath(config.paths.stateDir, created.projectId, created.sessionId),
      JSON.stringify({
        schemaVersion: 1,
        projectId: created.projectId,
        sessionId: created.sessionId,
        status: "ready_for_planning",
        readyForPlanning: true,
        planningMode: "active",
        summary: "repoState=existing | goal=Dedicated desktop-style ATLAS shell | scope=Native-feeling control surface",
        updatedAt: "2026-04-22T11:27:11.715Z",
        clarifiedIntent: {
          productType: "Dedicated desktop-style ATLAS shell",
          targetUsers: ["Internal operators"],
          mustHaveFlows: ["Launch separate shell"],
          scopeIn: ["Native-feeling control surface"],
          scopeOut: ["Dashboard reuse"],
          protectedAreas: ["src/dashboard/**"],
          preferredQualityBar: null,
          designDirection: "Calm and focused",
          deploymentExpectations: [],
          successCriteria: ["No browser-tab downgrade"],
        },
        assumptions: [],
        openQuestions: [],
      }, null, 2),
      "utf8",
    );

    const loaded = await loadActiveTargetSession(config);

    assert.equal(loaded?.currentStage, TARGET_SESSION_STAGE.ACTIVE);
    assert.equal(loaded?.clarification?.readyForPlanning, true);
    assert.equal(loaded?.gates?.allowPlanning, true);
    assert.equal(loaded?.gates?.allowActiveExecution, true);
    assert.equal(loaded?.intent?.planningMode, "active");
    assert.match(String(loaded?.intent?.summary || ""), /Dedicated desktop-style ATLAS shell/i);
    assert.deepEqual(loaded?.intent?.scopeIn, ["Native-feeling control surface"]);
    assert.ok(loaded?.warnings?.some((entry: string) => entry.includes("hydrated_from_target_intent_contract")));
  });

  it("active stage gates do not keep shadow execution enabled", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-session-"));
    const config = buildConfig(tempRoot);
    await createTargetSession(buildManifest(), config);

    const transitioned = await transitionActiveTargetSession(config, {
      nextStage: TARGET_SESSION_STAGE.ACTIVE,
      actor: "test",
      reason: "simple_request",
    });

    assert.equal(transitioned.currentStage, TARGET_SESSION_STAGE.ACTIVE);
    assert.equal(transitioned.gates.allowPlanning, true);
    assert.equal(transitioned.gates.allowShadowExecution, false);
    assert.equal(transitioned.gates.allowActiveExecution, true);
  });
});