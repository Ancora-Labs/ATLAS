import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { listAtlasCompletedSessions } from "../../src/atlas/completed_sessions.js";

async function buildStateDir(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-completed-sessions-"));
  const stateDir = path.join(tempRoot, "state");
  await fs.mkdir(path.join(stateDir, "archive"), { recursive: true });
  await fs.mkdir(path.join(stateDir, "projects"), { recursive: true });
  return stateDir;
}

describe("atlas completed sessions", () => {
  it("normalizes presenter handoff details from completed session archives", async () => {
    const stateDir = await buildStateDir();
    await fs.writeFile(path.join(stateDir, "archive", "completed_sessions.jsonl"), `${JSON.stringify({
      projectId: "target_site",
      sessionId: "sess_presented",
      finalStatus: "completed",
      repoUrl: "https://github.com/acme/site",
      completionSummary: "Finished site is ready.",
      archivedAt: "2026-05-01T12:00:00.000Z",
      presentation: {
        status: "ready",
        locationType: "local_static_site",
        openTarget: "http://127.0.0.1:4173",
        userMessage: "Open the finished site preview.",
        resolutionSource: "ai",
        execution: { mode: "serve_and_open", target: "http://127.0.0.1:4173" },
      },
      presentationAutoOpen: {
        attempted: true,
        opened: false,
        reason: "auto_open_disabled",
        execution: { finalTarget: "http://127.0.0.1:4173" },
      },
    })}\n`, "utf8");

    const sessions = await listAtlasCompletedSessions(stateDir);
    const session = sessions.find((entry) => entry.sessionId === "sess_presented");

    assert.equal(session?.presentation?.userMessage, "Open the finished site preview.");
    assert.equal(session?.presentation?.executionMode, "serve_and_open");
    assert.equal(session?.presentation?.finalTarget, "http://127.0.0.1:4173");
    assert.equal(session?.presentation?.autoOpenStatus, "attempted");
  });

  it("shows an archive fallback presentation target for older completed records", async () => {
    const stateDir = await buildStateDir();
    await fs.writeFile(path.join(stateDir, "archive", "completed_sessions.jsonl"), `${JSON.stringify({
      projectId: "target_legacy",
      sessionId: "sess_legacy",
      finalStatus: "completed",
      repoUrl: "https://github.com/acme/legacy-site",
      completionSummary: "Legacy completed archive.",
      archivedAt: "2026-05-01T12:00:00.000Z",
    })}\n`, "utf8");

    const sessions = await listAtlasCompletedSessions(stateDir);
    const session = sessions.find((entry) => entry.sessionId === "sess_legacy");

    assert.equal(session?.presentation?.resolutionSource, "completion_archive_fallback");
    assert.equal(session?.presentation?.openTarget, "https://github.com/acme/legacy-site");
    assert.equal(session?.presentation?.executionMode, "open_url");
  });

  it("does not project still-open target completion records into completed sessions", async () => {
    const stateDir = await buildStateDir();
    const projectDir = path.join(stateDir, "projects", "target_live", "sess_live");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, "target_completion.json"), JSON.stringify({
      schemaVersion: 1,
      status: "open",
      evaluatedAt: "2026-05-05T00:00:00.000Z",
      projectId: "target_live",
      sessionId: "sess_live",
      objectiveSummary: "Still running target.",
      summary: "Target success contract remains open.",
      blockers: ["delivery_evidence_missing"],
      pendingHumanInputs: [],
      delivery: {
        status: "documented",
        repoWebUrl: "https://github.com/acme/live-target",
        workspacePath: "C:/tmp/live-target",
        userMessage: "Still running.",
      },
    }), "utf8");

    const sessions = await listAtlasCompletedSessions(stateDir);

    assert.equal(sessions.some((entry) => entry.sessionId === "sess_live"), false);
  });
});
