import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { archiveActiveSessionForFreshActivation } from "../../src/core/activation_flow.js";
import { createTargetSession, loadActiveTargetSession, TARGET_SESSION_STAGE } from "../../src/core/target_session_state.js";

function buildConfig(tempRoot: string, env: Record<string, unknown> = {}) {
  return {
    paths: {
      stateDir: path.join(tempRoot, "state"),
      workspaceDir: path.join(tempRoot, ".box-work"),
    },
    env,
  };
}

function buildManifest(overrides: Record<string, unknown> = {}) {
  return {
    repoUrl: "https://github.com/acme/portal.git",
    objective: {
      summary: "Open a fresh activation session",
      acceptanceCriteria: ["fresh-session", "archived-previous-session"],
    },
    constraints: {
      protectedPaths: [],
      forbiddenActions: [],
    },
    operator: {
      requestedBy: "user",
      approvalMode: "human_required_for_high_risk",
    },
    ...overrides,
  };
}

describe("activation_flow", () => {
  it("archives the active session automatically before a fresh activation starts", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-activation-flow-"));
    const config = buildConfig(tempRoot);
    const firstSession = await createTargetSession(buildManifest(), config);

    const archived = await archiveActiveSessionForFreshActivation(config, {
      reason: "test_auto_archive_for_fresh_activation",
    });

    assert.equal(archived?.sessionId, firstSession.sessionId);
    assert.equal(archived?.currentStage, TARGET_SESSION_STAGE.COMPLETED);
    assert.equal(await loadActiveTargetSession(config), null);

    const secondSession = await createTargetSession(buildManifest({ requestId: "req_target_fresh_activation_002" }), config);
    assert.notEqual(secondSession.sessionId, firstSession.sessionId);
  });

  it("returns null when there is no active session to archive", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-activation-flow-empty-"));
    const config = buildConfig(tempRoot);

    const archived = await archiveActiveSessionForFreshActivation(config);

    assert.equal(archived, null);
  });
});