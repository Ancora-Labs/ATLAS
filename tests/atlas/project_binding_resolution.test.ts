import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AtlasDesktopSessionRecord } from "../../src/atlas/desktop_sessions.js";
import { resolveAtlasProjectBindingForSession } from "../../src/atlas/build_runtime.js";

function buildSession(overrides: Partial<AtlasDesktopSessionRecord> = {}): AtlasDesktopSessionRecord {
  return {
    id: "atlas-session-1",
    title: "Steakhouse Landing Page",
    objective: "Build a premium steakhouse landing page.",
    summary: "Premium steakhouse landing page with booking-first flow.",
    projectId: null,
    projectSessionId: null,
    projectWorkspacePath: null,
    projectName: "Steakhouse Landing Page",
    projectDescription: "High-end restaurant site with a booking-first flow.",
    repoContext: {
      provider: "github",
      targetRepo: "acme/steakhouse-site",
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
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:05:00.000Z",
    ...overrides,
  };
}

async function writeTargetSession(stateDir: string, projectId: string, sessionId: string): Promise<void> {
  const sessionDir = path.join(stateDir, "projects", projectId, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(path.join(sessionDir, "target_session.json"), JSON.stringify({
    projectId,
    sessionId,
    repo: {
      repoFullName: "acme/steakhouse-site",
      repoUrl: "https://github.com/acme/steakhouse-site.git",
    },
  }), "utf8");
}

describe("atlas project binding resolution", () => {
  it("prefers the exact ATLAS desktop session binding when multiple repo matches exist", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-binding-"));
    const session = buildSession();

    await writeTargetSession(stateDir, "project-wrong", "sess_wrong");
    await writeTargetSession(stateDir, "project-right", "sess_right");
    await fs.writeFile(path.join(stateDir, "open_target_sessions.json"), JSON.stringify([
      {
        projectId: "project-wrong",
        sessionId: "sess_wrong",
        repoUrl: "https://github.com/acme/steakhouse-site.git",
        objectiveSummary: "Premium steakhouse landing page with booking-first flow.",
        updatedAt: "2026-04-29T12:08:00.000Z",
      },
      {
        projectId: "project-right",
        sessionId: "sess_right",
        repoUrl: "https://github.com/acme/steakhouse-site.git",
        objectiveSummary: "Premium steakhouse landing page with booking-first flow.",
        updatedAt: "2026-04-29T12:01:00.000Z",
        atlasDesktopSessionId: session.id,
      },
    ]), "utf8");

    const resolved = await resolveAtlasProjectBindingForSession(stateDir, session, null);

    assert.equal(resolved?.projectId, "project-right");
    assert.equal(resolved?.projectSessionId, "sess_right");
  });

  it("[NEGATIVE] falls back to repo and timing heuristics when no exact ATLAS desktop session marker exists", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-binding-fallback-"));
    const session = buildSession();

    await writeTargetSession(stateDir, "project-newer", "sess_newer");
    await writeTargetSession(stateDir, "project-other", "sess_other");
    await fs.writeFile(path.join(stateDir, "open_target_sessions.json"), JSON.stringify([
      {
        projectId: "project-other",
        sessionId: "sess_other",
        repoUrl: "https://github.com/acme/steakhouse-site.git",
        objectiveSummary: "Premium steakhouse landing page with booking-first flow.",
        updatedAt: "2026-04-29T12:01:00.000Z",
        atlasDesktopSessionId: "atlas-session-other",
      },
      {
        projectId: "project-newer",
        sessionId: "sess_newer",
        repoUrl: "https://github.com/acme/steakhouse-site.git",
        objectiveSummary: "Premium steakhouse landing page with booking-first flow.",
        updatedAt: "2026-04-29T12:09:00.000Z",
      },
    ]), "utf8");

    const resolved = await resolveAtlasProjectBindingForSession(stateDir, session, null);

    assert.equal(resolved?.projectId, "project-newer");
    assert.equal(resolved?.projectSessionId, "sess_newer");
  });

  it("uses the active target session binding when the open-session registry no longer carries the mission", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-binding-active-target-"));
    const session = buildSession();

    await writeTargetSession(stateDir, "project-active", "sess_active");
    await fs.writeFile(path.join(stateDir, "projects", "project-active", "sess_active", "target_session.json"), JSON.stringify({
      projectId: "project-active",
      sessionId: "sess_active",
      repo: {
        repoFullName: "acme/steakhouse-site",
        repoUrl: "https://github.com/acme/steakhouse-site.git",
      },
      hints: {
        notes: [`ATLAS desktop session id: ${session.id}`],
      },
    }), "utf8");
    await fs.writeFile(path.join(stateDir, "active_target_session.json"), JSON.stringify({
      projectId: "project-active",
      sessionId: "sess_active",
      workspace: {
        path: "C:/workspace/project-active/sess_active",
      },
      lifecycle: {
        updatedAt: "2026-04-29T12:07:00.000Z",
      },
    }), "utf8");
    await fs.writeFile(path.join(stateDir, "open_target_sessions.json"), JSON.stringify([]), "utf8");

    const resolved = await resolveAtlasProjectBindingForSession(stateDir, session, null, {
      allowHeuristicMatch: false,
    });

    assert.equal(resolved?.projectId, "project-active");
    assert.equal(resolved?.projectSessionId, "sess_active");
  });
});