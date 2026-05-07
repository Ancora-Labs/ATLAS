import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildAtlasPageData } from "../../src/atlas/routes/home.js";

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(value, null, 2), "utf8");
}

async function buildStateDir(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-home-recovery-"));
  const stateDir = path.join(tempRoot, "state");
  await fs.mkdir(path.join(stateDir, "atlas"), { recursive: true });
  await fs.mkdir(path.join(stateDir, "archive"), { recursive: true });
  await fs.mkdir(path.join(stateDir, "projects"), { recursive: true });
  return stateDir;
}

describe("atlas home route session recovery", () => {
  it("rehydrates a missing live desktop row from an open target session and keeps it out of completed", async () => {
    const stateDir = await buildStateDir();
    const projectId = "target_pizza";
    const sessionId = "sess_20260504210751_84a1c5";
    const desktopSessionId = "440d5eab-bfb4-48fe-ba04-cc142c858fdc";
    const projectDir = path.join(stateDir, "projects", projectId, sessionId);

    await writeJson(path.join(stateDir, "atlas", "desktop_sessions.json"), {
      schemaVersion: 2,
      updatedAt: null,
      sessions: [],
    });
    await writeJson(path.join(stateDir, "platform", "mode_state.json"), {
      schemaVersion: 1,
      currentMode: "single_target_delivery",
      activeTargetProjectId: projectId,
      activeTargetSessionId: sessionId,
    });
    await writeJson(path.join(stateDir, "open_target_sessions.json"), [
      {
        projectId: "target_old",
        sessionId: "sess_old",
        atlasDesktopSessionId: null,
      },
    ]);
    await writeJson(path.join(stateDir, "active_target_session.json"), {
      projectId,
      sessionId,
    });
    await writeJson(path.join(projectDir, "target_session.json"), {
      schemaVersion: 1,
      currentMode: "single_target_delivery",
      projectId,
      sessionId,
      currentStage: "active",
      repo: {
        repoUrl: "https://github.com/acme/pizza.git",
        name: "pizza",
        defaultBranch: "main",
        provider: "github",
        repoFullName: "acme/pizza",
        repoCreatedByBox: true,
      },
      objective: {
        summary: "Design a desktop-first pizza hero.",
        desiredOutcome: "pizza",
      },
      workspace: {
        path: "C:/tmp/pizza",
      },
      lifecycle: {
        updatedAt: "2026-05-05T00:00:00.000Z",
      },
      hints: {
        notes: [`ATLAS desktop session id: ${desktopSessionId}`],
      },
      intent: {
        operatorIntentBrief: "Create a premium pizza hero with real high-quality imagery.",
      },
    });
    await writeJson(path.join(projectDir, "clarification_packet.json"), {
      sessionId: desktopSessionId,
      targetRepo: "acme/pizza",
      repoMode: "new",
      objective: "Design a desktop-first pizza hero.",
      summary: "Design a desktop-first pizza hero.",
      operatorIntentBrief: "Create a premium pizza hero with real high-quality imagery.",
      openQuestions: [],
      executionNotes: ["Use real high-quality pizza imagery."],
      attachments: [],
      attachmentPlans: [],
      provider: "test",
      rawResponse: "",
      createdAt: "2026-05-05T00:00:00.000Z",
    });
    await writeJson(path.join(projectDir, "target_completion.json"), {
      schemaVersion: 1,
      status: "open",
      evaluatedAt: "2026-05-05T00:01:00.000Z",
      projectId,
      sessionId,
      objectiveSummary: "Design a desktop-first pizza hero.",
      summary: "Target success contract remains open.",
      blockers: ["delivery_evidence_missing"],
      pendingHumanInputs: [],
      delivery: {
        status: "documented",
        repoWebUrl: "https://github.com/acme/pizza",
        workspacePath: "C:/tmp/pizza",
      },
    });

    const pageData = await buildAtlasPageData({ stateDir }, `/?focusSession=${desktopSessionId}`);

    assert.equal(pageData.sessions.length, 1);
    assert.equal(pageData.sessions[0]?.id, desktopSessionId);
    assert.equal(pageData.sessions[0]?.projectId, projectId);
    assert.equal(pageData.focusedSessionId, desktopSessionId);
    assert.equal(pageData.completedSessions.some((entry) => entry.sessionId === sessionId), false);

    const sessionStore = JSON.parse(await fs.readFile(path.join(stateDir, "atlas", "desktop_sessions.json"), "utf8"));
    assert.equal(sessionStore.sessions.length, 1);
    assert.equal(sessionStore.sessions[0]?.id, desktopSessionId);
  });

  it("does not archive an existing live row when mode_state still points at it but open target registry is stale", async () => {
    const stateDir = await buildStateDir();
    const projectId = "target_guide";
    const sessionId = "sess_active_guide";
    const desktopSessionId = "desk_active_guide";
    const projectDir = path.join(stateDir, "projects", projectId, sessionId);

    await writeJson(path.join(stateDir, "atlas", "desktop_sessions.json"), {
      schemaVersion: 2,
      updatedAt: null,
      sessions: [
        {
          id: desktopSessionId,
          title: "Guide session",
          objective: "Keep this guide session active.",
          summary: "Keep this guide session active.",
          operatorIntentBrief: "Keep this guide session active.",
          selectedModel: null,
          projectId,
          projectSessionId: sessionId,
          projectWorkspacePath: "C:/tmp/guide",
          projectName: null,
          projectDescription: null,
          repoContext: {
            provider: "github",
            targetRepo: "acme/guide",
            targetBaseBranch: "main",
            repoMode: "existing",
            repoCreatedByAtlas: false,
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
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
      ],
    });
    await writeJson(path.join(stateDir, "platform", "mode_state.json"), {
      schemaVersion: 1,
      currentMode: "single_target_delivery",
      activeTargetProjectId: projectId,
      activeTargetSessionId: sessionId,
      fallbackModeAfterCompletion: "idle",
      singleTargetDeliveryEnabled: true,
      targetSessionStateEnabled: true,
    });
    await writeJson(path.join(stateDir, "open_target_sessions.json"), []);
    await writeJson(path.join(projectDir, "target_completion.json"), {
      schemaVersion: 1,
      status: "completed",
      evaluatedAt: "2026-05-05T00:01:00.000Z",
      projectId,
      sessionId,
      objectiveSummary: "Keep this guide session active.",
      summary: "Stale completed projection that should not archive an active row.",
      blockers: [],
      pendingHumanInputs: [],
      delivery: {
        status: "documented",
        repoWebUrl: "https://github.com/acme/guide",
        workspacePath: "C:/tmp/guide",
      },
    });

    const pageData = await buildAtlasPageData({ stateDir }, `/?focusSession=${desktopSessionId}`);

    assert.equal(pageData.sessions.length, 1);
    assert.equal(pageData.sessions[0]?.id, desktopSessionId);
    assert.equal(pageData.focusedSessionId, desktopSessionId);

    const sessionStore = JSON.parse(await fs.readFile(path.join(stateDir, "atlas", "desktop_sessions.json"), "utf8"));
    assert.equal(sessionStore.sessions.length, 1);
    assert.equal(sessionStore.sessions[0]?.id, desktopSessionId);
  });

  it("does not archive a ready session during the queued build handoff window even if a stale completed projection exists", async () => {
    const stateDir = await buildStateDir();
    const projectId = "target_handoff";
    const sessionId = "sess_handoff";
    const desktopSessionId = "desk_handoff";
    const projectDir = path.join(stateDir, "projects", projectId, sessionId);

    await writeJson(path.join(stateDir, "atlas", "desktop_sessions.json"), {
      schemaVersion: 2,
      updatedAt: null,
      sessions: [
        {
          id: desktopSessionId,
          title: "Queued handoff session",
          objective: "Keep this session visible while the build is being queued.",
          summary: "Keep this session visible while the build is being queued.",
          operatorIntentBrief: "Keep this session visible while the build is being queued.",
          selectedModel: null,
          projectId,
          projectSessionId: sessionId,
          projectWorkspacePath: "C:/tmp/handoff",
          projectName: null,
          projectDescription: null,
          repoContext: {
            provider: "github",
            targetRepo: "acme/handoff",
            targetBaseBranch: "main",
            repoMode: "existing",
            repoCreatedByAtlas: false,
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
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
      ],
    });
    await writeJson(path.join(stateDir, "atlas", "active_build.json"), {
      sessionId: desktopSessionId,
      projectId,
      projectSessionId: sessionId,
      projectWorkspacePath: "C:/tmp/handoff",
      title: "Queued handoff session",
      objective: "Keep this session visible while the build is being queued.",
      summary: "Keep this session visible while the build is being queued.",
      targetRepo: "acme/handoff",
      targetBaseBranch: "main",
      repoMode: "existing",
      repoCreatedByAtlas: false,
      requestedAt: "2026-05-05T00:00:00.000Z",
      updatedAt: "2026-05-05T00:00:01.000Z",
      triggerMode: "watching",
      triggerState: "queued",
      triggerLabel: "Build request queued from the ATLAS desktop session.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build it.",
      appliedAt: null,
    });
    await writeJson(path.join(stateDir, "open_target_sessions.json"), []);
    await writeJson(path.join(projectDir, "target_completion.json"), {
      schemaVersion: 1,
      status: "completed",
      evaluatedAt: "2026-05-05T00:01:00.000Z",
      projectId,
      sessionId,
      objectiveSummary: "Keep this session visible while the build is being queued.",
      summary: "Stale completed projection that should not archive a queued handoff session.",
      blockers: [],
      pendingHumanInputs: [],
      delivery: {
        status: "documented",
        repoWebUrl: "https://github.com/acme/handoff",
        workspacePath: "C:/tmp/handoff",
      },
    });

    const pageData = await buildAtlasPageData({ stateDir }, `/?focusSession=${desktopSessionId}`);

    assert.equal(pageData.sessions.length, 1);
    assert.equal(pageData.sessions[0]?.id, desktopSessionId);
    assert.equal(pageData.focusedSessionId, desktopSessionId);

    const sessionStore = JSON.parse(await fs.readFile(path.join(stateDir, "atlas", "desktop_sessions.json"), "utf8"));
    assert.equal(sessionStore.sessions.length, 1);
    assert.equal(sessionStore.sessions[0]?.id, desktopSessionId);
  });

  it("rehydrates a missing live row from mode_state when open target files are absent", async () => {
    const stateDir = await buildStateDir();
    const projectId = "target_pizza";
    const sessionId = "sess_mode_only";
    const desktopSessionId = "desk_mode_only";
    const projectDir = path.join(stateDir, "projects", projectId, sessionId);

    await writeJson(path.join(stateDir, "atlas", "desktop_sessions.json"), {
      schemaVersion: 2,
      updatedAt: null,
      sessions: [],
    });
    await writeJson(path.join(stateDir, "platform", "mode_state.json"), {
      schemaVersion: 1,
      currentMode: "single_target_delivery",
      activeTargetProjectId: projectId,
      activeTargetSessionId: sessionId,
      fallbackModeAfterCompletion: "idle",
      singleTargetDeliveryEnabled: true,
      targetSessionStateEnabled: true,
    });
    await writeJson(path.join(stateDir, "open_target_sessions.json"), []);
    await writeJson(path.join(projectDir, "target_session.json"), {
      schemaVersion: 1,
      currentMode: "single_target_delivery",
      projectId,
      sessionId,
      currentStage: "active",
      repo: {
        repoUrl: "https://github.com/acme/pizza.git",
        name: "pizza",
        defaultBranch: "main",
        provider: "github",
        repoFullName: "acme/pizza",
        repoCreatedByBox: true,
      },
      objective: {
        summary: "Recover from mode state only.",
        desiredOutcome: "pizza",
      },
      workspace: {
        path: "C:/tmp/pizza-mode-only",
      },
      lifecycle: {
        updatedAt: "2026-05-05T00:00:00.000Z",
      },
      hints: {
        notes: [`ATLAS desktop session id: ${desktopSessionId}`],
      },
      intent: {
        operatorIntentBrief: "Recover the active live row even when only mode_state still points at it.",
      },
    });
    await writeJson(path.join(projectDir, "clarification_packet.json"), {
      sessionId: desktopSessionId,
      targetRepo: "acme/pizza",
      repoMode: "new",
      objective: "Recover from mode state only.",
      summary: "Recover from mode state only.",
      operatorIntentBrief: "Recover the active live row even when only mode_state still points at it.",
      openQuestions: [],
      executionNotes: [],
      attachments: [],
      attachmentPlans: [],
      provider: "test",
      rawResponse: "",
      createdAt: "2026-05-05T00:00:00.000Z",
    });

    const pageData = await buildAtlasPageData({ stateDir }, `/?focusSession=${desktopSessionId}`);

    assert.equal(pageData.sessions.length, 1);
    assert.equal(pageData.sessions[0]?.id, desktopSessionId);
    assert.equal(pageData.focusedSessionId, desktopSessionId);

    const sessionStore = JSON.parse(await fs.readFile(path.join(stateDir, "atlas", "desktop_sessions.json"), "utf8"));
    assert.equal(sessionStore.sessions.length, 1);
    assert.equal(sessionStore.sessions[0]?.id, desktopSessionId);
  });

  it("shows a ready session as stopped when only a stale active target stage remains", async () => {
    const stateDir = await buildStateDir();
    const projectId = "target_pizza";
    const sessionId = "sess_stale_active";
    const desktopSessionId = "desk_stale_active";
    const projectDir = path.join(stateDir, "projects", projectId, sessionId);

    await writeJson(path.join(stateDir, "atlas", "desktop_sessions.json"), {
      schemaVersion: 2,
      updatedAt: null,
      sessions: [
        {
          id: desktopSessionId,
          title: "Pizza shop",
          objective: "Repair the pizza landing page.",
          summary: "Repair the pizza landing page.",
          operatorIntentBrief: "Repair the pizza landing page.",
          selectedModel: null,
          projectId,
          projectSessionId: sessionId,
          projectWorkspacePath: "C:/tmp/pizza",
          projectName: null,
          projectDescription: null,
          repoContext: {
            provider: "github",
            targetRepo: "acme/pizza",
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
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
      ],
    });
    await writeJson(path.join(stateDir, "open_target_sessions.json"), [
      {
        projectId,
        sessionId,
        atlasDesktopSessionId: desktopSessionId,
        currentStage: "active",
      },
    ]);
    await writeJson(path.join(projectDir, "target_session.json"), {
      projectId,
      sessionId,
      currentStage: "active",
      hints: { notes: [`ATLAS desktop session id: ${desktopSessionId}`] },
    });
    await writeJson(path.join(stateDir, "pipeline_progress.json"), {
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 85,
      detail: "Stale worker progress from before desktop shutdown.",
      loopCount: 1,
      startedAt: "2026-05-05T00:00:00.000Z",
      updatedAt: "2026-05-05T00:02:00.000Z",
      completedAt: null,
    });

    const pageData = await buildAtlasPageData({ stateDir }, `/?focusSession=${desktopSessionId}`);

    assert.equal(pageData.sessionRuntimeStatuses?.[desktopSessionId]?.state, "stopped");
    assert.equal(pageData.activeSessionCount, 0);
  });

  it("returns to the blank workspace instead of rendering a completed-session detail when focus is stale", async () => {
    const stateDir = await buildStateDir();
    const desktopSessionId = "desk_live_focus";

    await writeJson(path.join(stateDir, "atlas", "desktop_sessions.json"), {
      schemaVersion: 2,
      updatedAt: null,
      sessions: [
        {
          id: desktopSessionId,
          title: "Live row",
          objective: "Keep the live row selectable.",
          summary: "Keep the live row selectable.",
          operatorIntentBrief: "Keep the live row selectable.",
          selectedModel: null,
          projectId: "target_live_focus",
          projectSessionId: "sess_live_focus",
          projectWorkspacePath: "C:/tmp/live-focus",
          projectName: null,
          projectDescription: null,
          repoContext: {
            provider: "github",
            targetRepo: "acme/live-focus",
            targetBaseBranch: "main",
            repoMode: "existing",
            repoCreatedByAtlas: false,
          },
          status: "active",
          openQuestions: ["Question"],
          executionNotes: [],
          attachments: [],
          attachmentPlans: [],
          clarificationAnswers: [],
          pendingQuestionIndex: 0,
          pendingQuestion: "Question",
          messages: [],
          createdAt: "2026-05-05T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
        },
      ],
    });
    await writeJson(path.join(stateDir, "projects", "target_done", "sess_done", "target_completion.json"), {
      schemaVersion: 1,
      status: "completed",
      evaluatedAt: "2026-05-05T00:01:00.000Z",
      projectId: "target_done",
      sessionId: "sess_done",
      objectiveSummary: "Done session.",
      summary: "Completed session.",
      blockers: [],
      pendingHumanInputs: [],
      delivery: {
        status: "documented",
        repoWebUrl: "https://github.com/acme/done",
        workspacePath: "C:/tmp/done",
      },
    });

    const pageData = await buildAtlasPageData({ stateDir }, "/?focusSession=missing-row");

    assert.equal(pageData.missingFocusedSnapshot, true);
    assert.equal(pageData.focusedSessionId, null);
    assert.equal(pageData.mainPaneMode, "new-session");
    assert.equal(pageData.completedSession, null);
    assert.equal(pageData.sessions.length, 1);
    assert.equal(pageData.sessions[0]?.id, desktopSessionId);
  });
});