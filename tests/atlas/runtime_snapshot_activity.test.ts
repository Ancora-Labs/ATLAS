import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import type { AtlasDesktopSessionRecord } from "../../src/atlas/desktop_sessions.js";
import { buildAtlasRuntimeSnapshot } from "../../src/atlas/build_runtime.js";
import { readAtlasBuildRequest, writeAtlasBuildRequest, type AtlasBuildRequestRecord } from "../../src/atlas/build_request_state.js";

function buildSession(overrides: Partial<AtlasDesktopSessionRecord> = {}): AtlasDesktopSessionRecord {
  return {
    id: "atlas-session-1",
    title: "Outdoor Turkish web site",
    objective: "Plan a premium, mobile-first Turkish outdoor e-commerce website.",
    summary: "Premium outdoor storefront with mobile-first delivery.",
    projectId: "target_outdoor_turkish_web_site",
    projectSessionId: "sess_20260429194707_b7887c",
    projectWorkspacePath: "C:/workspace/target_outdoor_turkish_web_site/sess_20260429194707_b7887c",
    projectName: "Outdoor Turkish web site",
    projectDescription: "Outdoor web site",
    repoContext: {
      provider: "github",
      targetRepo: "dogducaner66-byte/outdoor-turkish-web-site",
      targetBaseBranch: "main",
      repoMode: "existing",
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
    createdAt: "2026-04-30T10:35:00.000Z",
    updatedAt: "2026-04-30T10:40:00.000Z",
    ...overrides,
  };
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(value, null, 2));
}

describe("atlas runtime snapshot activity", () => {
  it("uses the worker lane as the default active agent during worker-stage loops and scopes premium usage to the live request", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-snapshot-"));
    const session = buildSession();
    const requestedAt = "2026-04-30T10:35:00.000Z";

    const buildRequest: AtlasBuildRequestRecord = {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "ATLAS injected the session brief and started the full BOX runtime for this mission.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    };

    await writeAtlasBuildRequest(stateDir, buildRequest);
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 85,
      detail: "Worker lanes are currently running for this session.",
      loopCount: 4,
      updatedAt: "2026-04-30T10:40:00.000Z",
      startedAt: requestedAt,
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "premium_usage_log.json"), [
      {
        worker: "prometheus",
        model: "gpt-5.4",
        taskKind: "implementation",
        startedAt: "2026-04-30T10:34:30.000Z",
        completedAt: "2026-04-30T10:34:59.000Z",
        durationMs: 29000,
        outcome: "done",
      },
      {
        worker: "integration-worker",
        model: "gpt-5.4",
        taskKind: "implementation",
        startedAt: "2026-04-30T10:37:29.292Z",
        completedAt: "2026-04-30T10:54:50.783Z",
        durationMs: 1041491,
        outcome: "done",
      },
    ]);
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      objective: { summary: session.summary },
      repo: { repoFullName: session.repoContext?.targetRepo || null },
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });

    assert.ok(snapshot);
    assert.equal(snapshot?.defaultAgentId, "worker");
    assert.equal(snapshot?.pipeline.loopCount, 4);
    assert.equal(snapshot?.sessionPremiumRequests, 1);
  });

  it("keeps the runtime snapshot readable when pipeline progress is sparse", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-sparse-pipeline-"));
    const session = buildSession();
    const requestedAt = "2026-05-03T10:21:30.381Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "BOX runtime is already active, so ATLAS is now monitoring the live build flow.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      updatedAt: requestedAt,
      detail: "The runtime emitted a partial progress payload before stage metadata landed.",
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });

    assert.ok(snapshot);
    assert.ok(snapshot?.defaultAgentId);
    assert.equal(snapshot?.pipeline.stageLabel, "Idle");
  });

  it("keeps a running request active when pipeline progress already shows a live stage", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-active-pipeline-"));
    const session = buildSession();
    const requestedAt = "2026-05-03T10:21:30.381Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "BOX runtime is already active, so ATLAS is now monitoring the live build flow.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "research_scout_running",
      stageLabel: "Research Scout Running",
      percent: 30,
      detail: "Research Scout is collecting external evidence for this session.",
      loopCount: 0,
      updatedAt: "2026-05-03T10:26:24.324Z",
      startedAt: "2026-05-03T10:21:52.435Z",
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });
    const refreshedBuildRequest = await readAtlasBuildRequest(stateDir);

    assert.equal(snapshot?.request.state, "running");
    assert.equal(snapshot?.pipeline.stage, "research_scout_running");
    assert.equal(refreshedBuildRequest?.triggerState, "running");
  });

  it("reconciles a stale queued request back to running when pipeline progress is active even without a detected daemon pid", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-active-pipeline-queued-"));
    const session = buildSession();
    const requestedAt = "2026-05-03T10:21:30.381Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "queued",
      triggerLabel: "ATLAS is waiting for the live runtime to resume this mission.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "research_scout_running",
      stageLabel: "Research Scout Running",
      percent: 30,
      detail: "Research Scout is collecting external evidence for this session.",
      loopCount: 0,
      updatedAt: "2026-05-03T10:26:24.324Z",
      startedAt: "2026-05-03T10:21:52.435Z",
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });
    const refreshedBuildRequest = await readAtlasBuildRequest(stateDir);

    assert.equal(snapshot?.request.state, "running");
    assert.equal(snapshot?.request.triggerLabel, "BOX pipeline progress is active, so ATLAS is now monitoring the live build flow.");
    assert.equal(refreshedBuildRequest?.triggerState, "running");
  });

  it("reconciles active_build projection to completed when mission artifacts mark the session complete", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-completed-"));
    const session = buildSession();
    const requestedAt = "2026-05-02T10:29:55.139Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "queued",
      triggerLabel: "ATLAS started a BOX runtime bootstrap for this session and is waiting for daemon readiness.",
      runnerPid: 9516,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: null,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "cycle_complete",
      stageLabel: "Cycle Complete",
      percent: 100,
      detail: "All resumed batches completed successfully.",
      loopCount: 3,
      updatedAt: "2026-05-02T10:38:06.778Z",
      startedAt: requestedAt,
      completedAt: "2026-05-02T10:38:06.778Z",
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_completion.json"), {
      currentStage: "completed",
      finalStatus: "completed",
      completionSummary: "Emberline landing page completed and merged.",
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });

    assert.equal(snapshot?.request.state, "completed");
    assert.equal(snapshot?.request.triggerLabel, "Emberline landing page completed and merged.");

    const persistedRequest = await readAtlasBuildRequest(stateDir);
    assert.equal(persistedRequest?.triggerState, "completed");
    assert.equal(persistedRequest?.runnerPid, null);
    assert.equal(persistedRequest?.triggerLabel, "Emberline landing page completed and merged.");
  });

  it("shows Research Scout as the active pipeline stage when artifacts outpace stale Jesus progress", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-research-"));
    const session = buildSession();
    const requestedAt = new Date(Date.now() - 60_000).toISOString();

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "Live mission is running.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "jesus_decided",
      stageLabel: "Jesus Decided",
      percent: 18,
      detail: "Jesus directive was recorded for this session.",
      loopCount: 1,
      updatedAt: requestedAt,
      startedAt: requestedAt,
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      repo: { repoFullName: session.repoContext?.targetRepo || null },
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "jesus_directive.json"), {
      status: "done",
    });
    await fs.writeFile(
      path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "session_progress.log"),
      `[RESEARCH_SCOUT] sourcing real imagery for the active mission\n`,
      "utf8",
    );

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });

    assert.ok(snapshot);
    assert.equal(snapshot?.pipeline.stage, "research_scout_running");
    assert.equal(snapshot?.defaultAgentId, "research_scout");
    assert.equal(snapshot?.agents.find((agent) => agent.id === "jesus")?.state, "done");
  });

  it("counts premium usage records that only expose completedAt", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-premium-completed-"));
    const session = buildSession();
    const requestedAt = "2026-04-30T10:35:00.000Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "Live mission is running.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "prometheus_done",
      stageLabel: "Prometheus Analysis Complete",
      percent: 60,
      detail: "Planning complete.",
      loopCount: 1,
      updatedAt: "2026-04-30T10:40:00.000Z",
      startedAt: requestedAt,
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "premium_usage_log.json"), [
      { worker: "research-scout", completedAt: "2026-04-30T10:36:00.000Z", outcome: "done" },
      { worker: "prometheus", timestamp: "2026-04-30T10:37:00.000Z", outcome: "done" },
    ]);
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });

    assert.equal(snapshot?.sessionPremiumRequests, 2);
  });

  it("reconciles a stale queued build request back to running when the tracked runner is still alive", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-reconcile-running-"));
    const session = buildSession();
    const requestedAt = "2026-05-01T12:54:22.642Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "queued",
      triggerLabel: "Waiting for runtime acknowledgment.",
      runnerPid: process.pid,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 85,
      detail: "Worker lanes are currently running for this session.",
      loopCount: 2,
      updatedAt: requestedAt,
      startedAt: requestedAt,
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      repo: { repoFullName: session.repoContext?.targetRepo || null },
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });
    const refreshedBuildRequest = await readAtlasBuildRequest(stateDir);

    assert.equal(snapshot?.request.state, "running");
    assert.equal(refreshedBuildRequest?.triggerState, "running");
    assert.equal(refreshedBuildRequest?.runnerPid, process.pid);
  });

  it("downgrades stale running projections when only done worker artifacts remain", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-stale-running-"));
    const session = buildSession();
    const requestedAt = "2026-05-02T10:29:55.139Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "BOX runtime is actively processing this build mission.",
      runnerPid: process.pid,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 85,
      detail: "Worker lanes were previously running for this session.",
      loopCount: 3,
      updatedAt: "2026-05-02T10:44:44.993Z",
      startedAt: requestedAt,
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "runtime", "dispatch_checkpoint.json"), {
      status: "complete",
      totalPlans: 2,
      completedPlans: 2,
      updatedAt: "2026-05-02T10:44:45.036Z",
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "runtime", "worker_cycle_artifacts.json"), {
      latestCycleId: "2026-05-02T10:37:50.832Z",
      cycles: {
        "2026-05-02T10:37:50.832Z": {
          status: "dispatching",
          updatedAt: "2026-05-02T10:44:44.993Z",
          workerSessions: {
            "quality-worker": {
              status: "idle",
              lastStatus: "done",
              updatedAt: "2026-05-02T10:38:06.740Z",
            },
          },
        },
      },
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });
    const refreshedBuildRequest = await readAtlasBuildRequest(stateDir);

    assert.equal(snapshot?.request.state, "queued");
    assert.notEqual(snapshot?.pipeline.stage, "workers_running");
    assert.equal(snapshot?.agents.find((agent) => agent.id === "worker")?.state, "done");
    assert.equal(refreshedBuildRequest?.triggerState, "queued");
    assert.equal(refreshedBuildRequest?.runnerPid, null);
  });

  it("counts session-scoped premium usage events from the target session progress log", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-premium-session-log-"));
    const session = buildSession();
    const requestedAt = "2026-05-01T12:54:22.642Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "queued",
      triggerLabel: "Live mission is queued after restart.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "prometheus_analyzing",
      stageLabel: "Prometheus Analyzing",
      percent: 42,
      detail: "Planning resumed after restart.",
      loopCount: 2,
      updatedAt: "2026-05-01T12:56:00.000Z",
      startedAt: "2026-05-01T11:37:55.437Z",
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "premium_usage_log.json"), []);
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });
    await fs.writeFile(
      path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "session_progress.log"),
      [
        "[2026-05-01T11:37:56.481Z] [PREMIUM_USAGE] spent=1 agent=jesus reason=cycle_directive [mode=single_target_delivery projectId=target_bowling sessionId=sess_20260501113747_1eefbe]",
        "[2026-05-01T12:54:25.690Z] [PREMIUM_USAGE] spent=1 agent=jesus reason=cycle_directive [mode=single_target_delivery projectId=target_bowling sessionId=sess_20260501113747_1eefbe]",
        "[2026-05-01T12:56:04.836Z] [PREMIUM_USAGE] spent=2 agent=prometheus reason=primary_planning [mode=single_target_delivery projectId=target_bowling sessionId=sess_20260501113747_1eefbe]",
      ].join("\n"),
      "utf8",
    );

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });

    assert.equal(snapshot?.sessionPremiumRequests, 3);
  });

  it("[NEGATIVE] prefers session-scoped Jesus progress over stale global live logs", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-jesus-session-scope-"));
    const session = buildSession();
    const requestedAt = "2026-05-03T20:38:31.269Z";
    const sessionStateDir = path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session");

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "Live mission is running.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "jesus_reading",
      stageLabel: "Jesus Reading System State",
      percent: 8,
      detail: "Jesus reading system state",
      loopCount: 0,
      updatedAt: "2026-05-03T20:38:41.923Z",
      startedAt: requestedAt,
      completedAt: null,
    });
    await writeJson(path.join(sessionStateDir, "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      repo: { repoFullName: session.repoContext?.targetRepo || null },
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });
    await fs.writeFile(path.join(sessionStateDir, "session_progress.log"), [
      `[2026-05-03T20:38:41.937Z] [JESUS] Jesus awakening — analyzing system state`,
      `[2026-05-03T20:39:12.387Z] [JESUS] AI analysis in progress elapsed=30s tier=T2`,
    ].join("\n"), "utf8");
    await fs.writeFile(path.join(stateDir, "live_worker_jesus.log"), [
      "[leadership_live]",
      "TARGET REPO: https://github.com/CanerDoqdu/restaurant-landing-page-202605021745.git",
      "stale global log from another mission",
    ].join("\n"), "utf8");

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });
    const jesusNode = snapshot?.agents.find((agent) => agent.id === "jesus") || null;

    assert.ok(jesusNode);
    assert.equal(jesusNode?.state, "active");
    assert.equal(jesusNode?.logLines.some((line) => line.includes("analyzing system state")), true);
    assert.equal(jesusNode?.logLines.some((line) => line.includes("restaurant-landing-page-202605021745")), false);
  });

  it("[NEGATIVE] does not attribute premium requests to inactive ready sessions", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-inactive-"));
    const liveSession = buildSession();
    const inactiveSession = buildSession({
      id: "atlas-session-2",
      projectSessionId: "sess_20260430110000_idle",
      updatedAt: "2026-04-30T11:05:00.000Z",
    });

    await writeAtlasBuildRequest(stateDir, {
      sessionId: liveSession.id,
      projectId: liveSession.projectId,
      projectSessionId: liveSession.projectSessionId,
      projectWorkspacePath: liveSession.projectWorkspacePath,
      title: liveSession.title,
      objective: liveSession.objective,
      summary: liveSession.summary,
      targetRepo: liveSession.repoContext?.targetRepo || null,
      targetBaseBranch: liveSession.repoContext?.targetBaseBranch || null,
      repoMode: liveSession.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt: "2026-04-30T10:35:00.000Z",
      updatedAt: "2026-04-30T10:40:00.000Z",
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "Live mission is running.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: "2026-04-30T10:35:00.000Z",
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 85,
      detail: "Worker lanes are currently running for the live mission.",
      loopCount: 2,
      updatedAt: "2026-04-30T10:42:00.000Z",
      startedAt: "2026-04-30T10:35:00.000Z",
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "premium_usage_log.json"), [
      {
        worker: "integration-worker",
        model: "gpt-5.4",
        taskKind: "implementation",
        startedAt: "2026-04-30T10:37:29.292Z",
        completedAt: "2026-04-30T10:54:50.783Z",
        durationMs: 1041491,
        outcome: "done",
      },
    ]);
    await writeJson(path.join(stateDir, "projects", liveSession.projectId || "project", liveSession.projectSessionId || "session", "target_session.json"), {
      projectId: liveSession.projectId,
      sessionId: liveSession.projectSessionId,
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session: inactiveSession });

    assert.ok(snapshot);
    assert.equal(snapshot?.request.state, "queued");
    assert.notEqual(snapshot?.defaultAgentId, "worker");
    assert.equal(snapshot?.sessionPremiumRequests, null);
  });

  it("keeps a non-focused ready session active when its scoped target runner is alive", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-scoped-runner-"));
    const liveSession = buildSession();
    const scopedSession = buildSession({
      id: "atlas-session-scoped",
      projectId: "target_independent",
      projectSessionId: "sess_independent",
      projectWorkspacePath: "C:/workspace/target_independent/sess_independent",
      updatedAt: new Date().toISOString(),
    });

    await writeAtlasBuildRequest(stateDir, {
      sessionId: liveSession.id,
      projectId: liveSession.projectId,
      projectSessionId: liveSession.projectSessionId,
      projectWorkspacePath: liveSession.projectWorkspacePath,
      title: liveSession.title,
      objective: liveSession.objective,
      summary: liveSession.summary,
      targetRepo: liveSession.repoContext?.targetRepo || null,
      targetBaseBranch: liveSession.repoContext?.targetBaseBranch || null,
      repoMode: liveSession.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt: "2026-04-30T10:35:00.000Z",
      updatedAt: "2026-04-30T10:40:00.000Z",
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "Another live mission is running.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: "2026-04-30T10:35:00.000Z",
    });
    await writeJson(path.join(stateDir, "active_target_session.json"), {
      projectId: liveSession.projectId,
      sessionId: liveSession.projectSessionId,
    });
    await writeJson(path.join(stateDir, "session_runners", "target_independent_sess_independent.pid.json"), {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      projectId: scopedSession.projectId,
      sessionId: scopedSession.projectSessionId,
      scope: "target-session",
    });
    await writeJson(path.join(stateDir, "projects", scopedSession.projectId || "project", scopedSession.projectSessionId || "session", "target_session.json"), {
      projectId: scopedSession.projectId,
      sessionId: scopedSession.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${scopedSession.id}`] },
    });
    await fs.writeFile(
      path.join(stateDir, "projects", scopedSession.projectId || "project", scopedSession.projectSessionId || "session", "session_progress.log"),
      `[PREMIUM_USAGE] spent=2 agent=research-scout reason=scoped_runner\n[RESEARCH_SCOUT] collecting independent session evidence\n`,
      "utf8",
    );

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session: scopedSession });

    assert.ok(snapshot);
    assert.equal(snapshot?.request.state, "running");
    assert.equal(snapshot?.request.runnerPid, process.pid);
    assert.equal(snapshot?.pipeline.stage, "research_scout_running");
    assert.equal(snapshot?.defaultAgentId, "research_scout");
    assert.equal(snapshot?.sessionPremiumRequests, 1);
  });

  it("counts premium usage progress lines without summing cumulative spent values", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-session-premium-lines-"));
    const session = buildSession();
    const requestedAt = "2026-05-05T13:09:47.722Z";

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt,
      updatedAt: requestedAt,
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "ATLAS is monitoring a live build mission.",
      runnerPid: process.pid,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: requestedAt,
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 85,
      detail: "Worker lanes are currently running for this session.",
      loopCount: 1,
      updatedAt: requestedAt,
      startedAt: requestedAt,
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });
    await fs.writeFile(
      path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "session_progress.log"),
      [
        `[PREMIUM_USAGE] spent=1 agent=jesus reason=cycle_directive`,
        `[PREMIUM_USAGE] spent=2 agent=research-scout reason=consumption_triggered_refresh`,
        `[PREMIUM_USAGE] spent=3 agent=prometheus reason=primary_planning`,
      ].join("\n"),
      "utf8",
    );

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });

    assert.ok(snapshot);
    assert.equal(snapshot?.sessionPremiumRequests, 3);
  });

  it("[NEGATIVE] does not auto-bind a ready ATLAS session to a same-repo target session on startup without an explicit session link", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-no-heuristic-startup-"));
    const session = buildSession({
      id: "atlas-session-unbound",
      projectId: null,
      projectSessionId: null,
      projectWorkspacePath: null,
      updatedAt: "2026-05-01T07:12:00.000Z",
    });

    await writeJson(path.join(stateDir, "open_target_sessions.json"), [
      {
        projectId: "target_same_repo",
        sessionId: "sess_same_repo",
        repoUrl: "https://github.com/dogducaner66-byte/outdoor-turkish-web-site.git",
        objectiveSummary: session.summary,
        updatedAt: "2026-05-01T07:11:00.000Z",
      },
    ]);
    await writeJson(path.join(stateDir, "active_target_session.json"), {
      projectId: "target_same_repo",
      sessionId: "sess_same_repo",
    });
    await writeJson(path.join(stateDir, "projects", "target_same_repo", "sess_same_repo", "target_session.json"), {
      projectId: "target_same_repo",
      sessionId: "sess_same_repo",
      repo: { repoFullName: session.repoContext?.targetRepo || null },
    });
    await writeJson(path.join(stateDir, "projects", "target_same_repo", "sess_same_repo", "jesus_directive.json"), {
      status: "done",
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "jesus_decided",
      stageLabel: "Jesus Decided",
      percent: 18,
      detail: "Jesus directive was recorded for another mission.",
      loopCount: 1,
      updatedAt: "2026-05-01T07:11:30.000Z",
      startedAt: "2026-05-01T07:11:00.000Z",
      completedAt: null,
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });

    assert.ok(snapshot);
    assert.equal(snapshot?.mission.projectSessionId, null);
    assert.equal(snapshot?.request.state, "queued");
    assert.equal(snapshot?.pipeline.stage, "idle");
  });

  it("[NEGATIVE] does not mark an old linked session active from stale worker artifacts on startup", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-stale-linked-artifacts-"));
    const liveSession = buildSession({ id: "atlas-live-session" });
    const staleSession = buildSession({
      id: "atlas-stale-session",
      projectId: "target_old",
      projectSessionId: "sess_old",
      updatedAt: "2026-05-01T06:00:00.000Z",
    });

    await writeAtlasBuildRequest(stateDir, {
      sessionId: liveSession.id,
      projectId: liveSession.projectId,
      projectSessionId: liveSession.projectSessionId,
      projectWorkspacePath: liveSession.projectWorkspacePath,
      title: liveSession.title,
      objective: liveSession.objective,
      summary: liveSession.summary,
      targetRepo: liveSession.repoContext?.targetRepo || null,
      targetBaseBranch: liveSession.repoContext?.targetBaseBranch || null,
      repoMode: liveSession.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt: "2026-05-01T07:00:00.000Z",
      updatedAt: "2026-05-01T07:05:00.000Z",
      triggerMode: "daemon",
      triggerState: "running",
      triggerLabel: "Live mission is running.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: "2026-05-01T07:00:00.000Z",
    });
    await writeJson(path.join(stateDir, "active_target_session.json"), {
      projectId: liveSession.projectId,
      sessionId: liveSession.projectSessionId,
    });
    await writeJson(path.join(stateDir, "projects", "target_old", "sess_old", "target_session.json"), {
      projectId: "target_old",
      sessionId: "sess_old",
      hints: { notes: [`ATLAS desktop session id: ${staleSession.id}`] },
    });
    await writeJson(path.join(stateDir, "projects", "target_old", "sess_old", "worker_cycle.json"), {
      status: "dispatching",
      activeWorkerCount: 2,
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session: staleSession });

    assert.ok(snapshot);
    assert.equal(snapshot?.request.state, "queued");
    assert.equal(snapshot?.pipeline.stage, "idle");
    assert.equal(snapshot?.pipeline.percent, 0);
    assert.equal(snapshot?.agents.every((agent) => agent.state !== "active"), true);
    assert.equal(snapshot?.sessionPremiumRequests, null);
  });

  it("preserves paused build state when stale pipeline progress remains after the runner stops", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-paused-stale-pipeline-"));
    const session = buildSession();

    await writeAtlasBuildRequest(stateDir, {
      sessionId: session.id,
      projectId: session.projectId,
      projectSessionId: session.projectSessionId,
      projectWorkspacePath: session.projectWorkspacePath,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      targetBaseBranch: session.repoContext?.targetBaseBranch || null,
      repoMode: session.repoContext?.repoMode || null,
      repoCreatedByAtlas: true,
      requestedAt: "2026-05-01T07:00:00.000Z",
      updatedAt: "2026-05-01T07:05:00.000Z",
      triggerMode: "daemon",
      triggerState: "paused",
      triggerLabel: "ATLAS paused this build mission for the selected session.",
      runnerPid: 42424,
      lastError: null,
      planningPrompt: "Build the live target session.",
      appliedAt: "2026-05-01T07:00:00.000Z",
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "workers_dispatching",
      stageLabel: "Dispatching Workers",
      percent: 78,
      detail: "Worker dispatch was recorded for this session.",
      loopCount: 1,
      updatedAt: "2026-05-01T07:04:00.000Z",
      startedAt: "2026-05-01T07:00:00.000Z",
      completedAt: null,
    });
    await writeJson(path.join(stateDir, "active_target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "target_session.json"), {
      projectId: session.projectId,
      sessionId: session.projectSessionId,
      objective: { summary: session.summary },
      repo: { repoFullName: session.repoContext?.targetRepo || null },
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });
    await writeJson(path.join(stateDir, "projects", session.projectId || "project", session.projectSessionId || "session", "worker_cycle.json"), {
      status: "dispatching",
      activeWorkerCount: 1,
    });

    const snapshot = await buildAtlasRuntimeSnapshot({ stateDir, session });
    const persistedRequest = await readAtlasBuildRequest(stateDir);

    assert.ok(snapshot);
    assert.equal(snapshot?.request.state, "paused");
    assert.equal(snapshot?.request.runnerPid, null);
    assert.equal(persistedRequest?.triggerState, "paused");
    assert.equal(persistedRequest?.runnerPid, null);
  });
});