import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readAtlasClarificationStatus, type AtlasClarificationRunner } from "../../src/atlas/clarification.js";
import {
  continueAtlasDesktopSession,
  deleteAtlasDesktopSession,
  linkAtlasDesktopSessionToProjectSession,
  listAtlasDesktopSessions,
  startAtlasDesktopSession,
} from "../../src/atlas/desktop_sessions.js";
import { buildAtlasPageData } from "../../src/atlas/routes/home.js";
import { writeAtlasBuildRequest } from "../../src/atlas/build_request_state.js";

const repoContext = {
  provider: "github" as const,
  targetRepo: "acme/restaurant-site",
  targetBaseBranch: "main",
  repoMode: "new" as const,
  repoCreatedByAtlas: true,
};

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(value, null, 2));
}

describe("atlas desktop session finalization", () => {
  it("finalizes from the initial clarification packet without a second AI call", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-session-finalize-"));
    const prompts: string[] = [];
    const runner: AtlasClarificationRunner = async ({ prompt }) => {
      prompts.push(prompt);
      return JSON.stringify({
        summary: "Restaurant landing page for launch week.",
        operatorIntentBrief: "Restaurant landing page for launch week with real visual direction.",
        openQuestions: ["Which real hero image should Atlas use?"],
        executionNotes: ["Collect the confirmed visual direction before planning handoff."],
        attachmentPlans: [],
      });
    };

    const session = await startAtlasDesktopSession({
      stateDir,
      repoContext,
      message: "Build a premium restaurant landing page.",
      clarificationCommand: "mock-clarifier",
      clarificationRunner: runner,
    });

    const continued = await continueAtlasDesktopSession({
      stateDir,
      sessionId: session.id,
      message: "Use the real restaurant exterior photo in the hero.",
      clarificationCommand: "mock-clarifier",
      clarificationRunner: runner,
    });

    assert.equal(prompts.length, 1);
    assert.equal(continued.status, "ready");
    assert.deepEqual(continued.openQuestions, []);
    assert.equal(continued.pendingQuestion, null);
    assert.equal(continued.clarificationAnswers.length, 1);
    assert.equal(continued.clarificationAnswers[0]?.question, "Which real hero image should Atlas use?");
    assert.equal(continued.clarificationAnswers[0]?.answer, "Use the real restaurant exterior photo in the hero.");
    assert.match(continued.summary, /launch week/i);
    assert.ok(continued.executionNotes.some((note) => /real restaurant exterior photo in the hero/i.test(note)));

    const status = await readAtlasClarificationStatus(stateDir, session.id);
    assert.equal(status.ready, true);
    assert.equal(status.packet?.openQuestions.length, 0);
    assert.ok((status.packet?.executionNotes || []).some((note) => /real restaurant exterior photo in the hero/i.test(note)));
  });

  it("[NEGATIVE] keeps the session active only across the initial authored question list", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-session-followup-"));
    let callCount = 0;
    const runner: AtlasClarificationRunner = async () => {
      callCount += 1;
      return JSON.stringify({
        summary: "Restaurant landing page for launch week.",
        operatorIntentBrief: "Restaurant landing page for launch week with real visual direction.",
        openQuestions: [
          "Which real hero image should Atlas use?",
          "Should the hero visual stay static or autoplay as video?",
        ],
        executionNotes: ["Collect the confirmed visual direction before planning handoff."],
        attachmentPlans: [],
      });
    };

    const session = await startAtlasDesktopSession({
      stateDir,
      repoContext,
      message: "Build a premium restaurant landing page.",
      clarificationCommand: "mock-clarifier",
      clarificationRunner: runner,
    });

    const continued = await continueAtlasDesktopSession({
      stateDir,
      sessionId: session.id,
      message: "Use the real restaurant exterior photo in the hero.",
      clarificationCommand: "mock-clarifier",
      clarificationRunner: runner,
    });

    assert.equal(continued.status, "active");
    assert.equal(continued.pendingQuestionIndex, 1);
    assert.equal(continued.pendingQuestion, "Should the hero visual stay static or autoplay as video?");
    assert.deepEqual(continued.openQuestions, [
      "Which real hero image should Atlas use?",
      "Should the hero visual stay static or autoplay as video?",
    ]);
    assert.match(continued.messages.at(-1)?.text || "", /autoplay as video/i);

    const finalized = await continueAtlasDesktopSession({
      stateDir,
      sessionId: session.id,
      message: "Keep it static in the first release.",
      clarificationCommand: "mock-clarifier",
      clarificationRunner: runner,
    });

    assert.equal(callCount, 1);
    assert.equal(finalized.status, "ready");
    assert.equal(finalized.pendingQuestionIndex, null);
    assert.equal(finalized.pendingQuestion, null);
    assert.equal(finalized.clarificationAnswers.length, 2);
    assert.ok(finalized.executionNotes.some((note) => /Keep it static in the first release/i.test(note)));
  });

  it("deletes an unfinished ATLAS project from the live rail and runtime registry", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-session-delete-"));
    const runner: AtlasClarificationRunner = async () => JSON.stringify({
      summary: "Restaurant landing page for launch week.",
      operatorIntentBrief: "Restaurant landing page for launch week with real visual direction.",
      openQuestions: ["Which real hero image should Atlas use?"],
      executionNotes: ["Use confirmed visual direction before delivery."],
      attachmentPlans: [],
    });
    const started = await startAtlasDesktopSession({
      stateDir,
      repoContext,
      message: "Build a restaurant landing page.",
      clarificationRunner: runner,
    });
    const session = await continueAtlasDesktopSession({
      stateDir,
      sessionId: started.id,
      message: "Use the provided exterior photo.",
      clarificationRunner: runner,
    });

    await linkAtlasDesktopSessionToProjectSession({
      stateDir,
      sessionId: session.id,
      projectId: "target_restaurant",
      projectSessionId: "sess_delete_me",
      projectWorkspacePath: null,
    });
    await writeJson(path.join(stateDir, "projects", "target_restaurant", "sess_delete_me", "target_session.json"), {
      projectId: "target_restaurant",
      sessionId: "sess_delete_me",
      hints: { notes: [`ATLAS desktop session id: ${session.id}`] },
    });
    await writeJson(path.join(stateDir, "open_target_sessions.json"), [
      { projectId: "target_restaurant", sessionId: "sess_delete_me", atlasDesktopSessionId: session.id },
    ]);
    await writeJson(path.join(stateDir, "active_target_session.json"), {
      projectId: "target_restaurant",
      sessionId: "sess_delete_me",
    });
    await writeJson(path.join(stateDir, "platform", "mode_state.json"), {
      schemaVersion: 1,
      currentMode: "single_target_delivery",
      activeTargetProjectId: "target_restaurant",
      activeTargetSessionId: "sess_delete_me",
      fallbackModeAfterCompletion: "idle",
      singleTargetDeliveryEnabled: true,
      targetSessionStateEnabled: true,
    });
    await writeJson(path.join(stateDir, "session_runners", "target_restaurant_sess_delete_me.pid.json"), {
      pid: 999999,
      startedAt: "2026-05-01T00:00:00.000Z",
      projectId: "target_restaurant",
      sessionId: "sess_delete_me",
      scope: "target-session",
    });
    await writeAtlasBuildRequest(stateDir, {
      sessionId: "atlas-session-stale",
      projectId: "target_restaurant",
      projectSessionId: "sess_delete_me",
      projectWorkspacePath: null,
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: repoContext.targetRepo,
      targetBaseBranch: repoContext.targetBaseBranch,
      repoMode: repoContext.repoMode,
      repoCreatedByAtlas: true,
      requestedAt: session.createdAt,
      updatedAt: session.updatedAt,
      triggerMode: "watching",
      triggerState: "queued",
      triggerLabel: "Queued.",
      runnerPid: null,
      lastError: null,
      planningPrompt: "Build it.",
      appliedAt: null,
    });
    await writeJson(path.join(stateDir, "projects", "target_restaurant", "sess_delete_me", "target_completion.json"), {
      schemaVersion: 1,
      status: "open",
      projectId: "target_restaurant",
      sessionId: "sess_delete_me",
      summary: "Open target completion report must not preserve this session during delete.",
    });

    await deleteAtlasDesktopSession({ stateDir, sessionId: session.id });

    assert.deepEqual(await listAtlasDesktopSessions(stateDir), []);
    await assert.rejects(fs.stat(path.join(stateDir, "projects", "target_restaurant", "sess_delete_me")));
    await assert.rejects(fs.stat(path.join(stateDir, "active_target_session.json")));
    await assert.rejects(fs.stat(path.join(stateDir, "atlas", "active_build.json")));
    await assert.rejects(fs.stat(path.join(stateDir, "session_runners", "target_restaurant_sess_delete_me.pid.json")));
    const openRegistry = JSON.parse(await fs.readFile(path.join(stateDir, "open_target_sessions.json"), "utf8"));
    assert.deepEqual(openRegistry, []);
    const modeState = JSON.parse(await fs.readFile(path.join(stateDir, "platform", "mode_state.json"), "utf8"));
    assert.equal(modeState.activeTargetProjectId, null);
    assert.equal(modeState.activeTargetSessionId, null);

    const pageData = await buildAtlasPageData({ stateDir }, `/?focusSession=${session.id}`);
    assert.equal(pageData.sessions.length, 0);
    assert.equal(pageData.focusedSessionId, null);
  });

  it("removes completed ATLAS projects from the live rail while preserving archived artifacts", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-session-delete-complete-"));
    const runner: AtlasClarificationRunner = async () => JSON.stringify({
      summary: "Restaurant landing page for launch week.",
      operatorIntentBrief: "Restaurant landing page for launch week with real visual direction.",
      openQuestions: ["Which real hero image should Atlas use?"],
      executionNotes: ["Use confirmed visual direction before delivery."],
      attachmentPlans: [],
    });
    const started = await startAtlasDesktopSession({
      stateDir,
      repoContext,
      message: "Build a restaurant landing page.",
      clarificationRunner: runner,
    });
    const session = await continueAtlasDesktopSession({
      stateDir,
      sessionId: started.id,
      message: "Use the provided exterior photo.",
      clarificationRunner: runner,
    });

    await linkAtlasDesktopSessionToProjectSession({
      stateDir,
      sessionId: session.id,
      projectId: "target_restaurant",
      projectSessionId: "sess_completed",
      projectWorkspacePath: path.join(stateDir, "..", ".box-target-workspaces", "box", "targets", "target_restaurant", "sess_completed"),
    });
    await writeJson(path.join(stateDir, "projects", "target_restaurant", "sess_completed", "target_completion.json"), {
      finalStatus: "completed",
    });
    await fs.mkdir(path.join(stateDir, "..", ".box-target-workspaces", "box", "targets", "target_restaurant", "sess_completed"), { recursive: true });

    await deleteAtlasDesktopSession({ stateDir, sessionId: session.id });

    assert.equal((await listAtlasDesktopSessions(stateDir)).length, 0);
    await fs.stat(path.join(stateDir, "projects", "target_restaurant", "sess_completed", "target_completion.json"));
    await fs.stat(path.join(stateDir, "..", ".box-target-workspaces", "box", "targets", "target_restaurant", "sess_completed"));
  });
});