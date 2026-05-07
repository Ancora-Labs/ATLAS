import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  listAtlasDesktopSessions,
  startAtlasDesktopSession,
} from "../../src/atlas/desktop_sessions.js";

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(value, null, 2), "utf8");
}

async function buildStateDir(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-session-recovery-"));
  const stateDir = path.join(tempRoot, "state");
  await fs.mkdir(path.join(stateDir, "atlas"), { recursive: true });
  await fs.mkdir(path.join(stateDir, "projects"), { recursive: true });
  return stateDir;
}

describe("atlas desktop runtime session recovery", () => {
  it("preserves an active runtime-backed live row when starting a new session from a stale store", async () => {
    const stateDir = await buildStateDir();
    const projectId = "target_pizza";
    const projectSessionId = "sess_running_pizza";
    const desktopSessionId = "desk_running_pizza";
    const projectDir = path.join(stateDir, "projects", projectId, projectSessionId);

    await writeJson(path.join(stateDir, "atlas", "desktop_sessions.json"), {
      schemaVersion: 2,
      updatedAt: null,
      sessions: [],
    });
    await writeJson(path.join(stateDir, "platform", "mode_state.json"), {
      schemaVersion: 1,
      currentMode: "single_target_delivery",
      activeTargetProjectId: projectId,
      activeTargetSessionId: projectSessionId,
      fallbackModeAfterCompletion: "idle",
      singleTargetDeliveryEnabled: true,
      targetSessionStateEnabled: true,
    });
    await writeJson(path.join(stateDir, "open_target_sessions.json"), []);
    await writeJson(path.join(projectDir, "target_session.json"), {
      schemaVersion: 1,
      currentMode: "single_target_delivery",
      projectId,
      sessionId: projectSessionId,
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
        summary: "Keep the running pizza session visible.",
        desiredOutcome: "pizza hero",
      },
      workspace: {
        path: "C:/tmp/running-pizza",
      },
      hints: {
        notes: [`ATLAS desktop session id: ${desktopSessionId}`],
      },
      intent: {
        operatorIntentBrief: "The active pizza build is still running and must stay in live rows.",
      },
    });
    await writeJson(path.join(projectDir, "target_intent_contract.json"), {
      schemaVersion: 1,
      projectId,
      sessionId: projectSessionId,
      objectiveSummary: "Keep the running pizza session visible.",
      resolvedPacket: {
        sessionId: desktopSessionId,
        summary: "Keep the running pizza session visible.",
        operatorIntentBrief: "The active pizza build is still running and must stay in live rows.",
        executionNotes: ["Preserve this row while opening another session."],
        attachmentPlans: [],
      },
    });

    const newSession = await startAtlasDesktopSession({
      stateDir,
      repoContext: {
        provider: "github",
        targetRepo: "acme/next",
        targetBaseBranch: "main",
        repoMode: "existing",
        repoCreatedByAtlas: false,
      },
      message: "Start a second independent session.",
      clarificationRunner: async () => JSON.stringify({
        summary: "Second session ready.",
        operatorIntentBrief: "Start a second independent session.",
        openQuestions: ["Which audience should the second session target?"],
        executionNotes: ["Keep this session independent from the active pizza build."],
        attachmentPlans: [],
      }),
    });

    const sessions = await listAtlasDesktopSessions(stateDir);
    assert.equal(sessions.length, 2);
    assert.ok(sessions.some((session) => session.id === desktopSessionId));
    assert.ok(sessions.some((session) => session.id === newSession.id));
    assert.equal(sessions.find((session) => session.id === desktopSessionId)?.projectId, projectId);
    assert.equal(sessions.find((session) => session.id === desktopSessionId)?.projectSessionId, projectSessionId);
  });
});