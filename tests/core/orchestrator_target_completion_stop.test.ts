import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  prepareTargetSessionForCycle,
  resolveProjectCompletionEligibility,
  shouldRunProjectCompletionForCycle,
} from "../../src/core/orchestrator.js";
import { loadPlatformModeState, PLATFORM_MODE, updatePlatformModeState } from "../../src/core/mode_state.js";
import { TARGET_SUCCESS_CONTRACT_STATUS } from "../../src/core/target_success_contract.js";
import {
  archiveTargetSession,
  createTargetSession,
  getTargetCompletionPath,
  loadActiveTargetSession,
  TARGET_SESSION_STAGE,
  transitionActiveTargetSession,
} from "../../src/core/target_session_state.js";

function buildConfig(tempRoot: string) {
  const rootDir = path.join(tempRoot, "box-root");
  return {
    rootDir,
    paths: {
      stateDir: path.join(rootDir, "state"),
      workspaceDir: path.join(rootDir, ".box-work"),
      progressFile: path.join(rootDir, "state", "progress.txt"),
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

function buildManifest() {
  return {
    mode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
    requestId: "req_target_stop_001",
    target: {
      repoUrl: "https://github.com/acme/portal.git",
      defaultBranch: "main",
      provider: "github",
    },
    objective: {
      summary: "Ship the target and stop orchestration once it is complete",
      desiredOutcome: "Target repo is delivered and handed off",
      acceptanceCriteria: ["single_target_project_readiness"],
    },
    operator: {
      requestedBy: "user",
      approvalMode: "human_required_for_high_risk",
    },
  };
}

describe("orchestrator target completion stop", () => {
  it("does not finalize a single-target project while the success contract is open", () => {
    const config = {
      platformModeState: { currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY },
      activeTargetSession: { projectId: "target_current", sessionId: "sess_open" },
    };

    assert.equal(shouldRunProjectCompletionForCycle(config, {
      status: TARGET_SUCCESS_CONTRACT_STATUS.OPEN,
      blockers: ["intent_alignment_unverified"],
    }), false);
    assert.equal(shouldRunProjectCompletionForCycle(config, {
      status: TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED,
      blockers: [],
    }), true);
    assert.equal(shouldRunProjectCompletionForCycle(config, {
      projectId: "target_previous",
      sessionId: "sess_previous",
      status: TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED,
      blockers: [],
    }), false);

    assert.equal(resolveProjectCompletionEligibility(
      config,
      {
        projectId: "target_current",
        sessionId: "sess_open",
        status: TARGET_SUCCESS_CONTRACT_STATUS.OPEN,
        blockers: ["intent_alignment_unverified"],
      },
      {
        projectId: "target_current",
        sessionId: "sess_open",
        status: TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED,
        blockers: [],
      },
    ), false);

    assert.equal(resolveProjectCompletionEligibility(
      config,
      {
        projectId: "target_current",
        sessionId: "sess_open",
        status: TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED,
        blockers: [],
      },
      {
        projectId: "target_current",
        sessionId: "sess_open",
        status: TARGET_SUCCESS_CONTRACT_STATUS.OPEN,
        blockers: ["intent_alignment_unverified"],
      },
    ), true);
  });

  it("archives a completed target session and tells the daemon loop to stop", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-orch-target-stop-"));
    const config = buildConfig(tempRoot);
    const session = await createTargetSession(buildManifest(), config);

    await transitionActiveTargetSession(config, {
      nextStage: TARGET_SESSION_STAGE.COMPLETED,
      actor: "test",
      reason: "target_delivery_handoff_presented",
      handoff: {
        carriedContextSummary: "Delivered target is ready for presentation.",
        requiredHumanInputs: [],
      },
    });

    const result = await prepareTargetSessionForCycle(config);
    const modeState = await loadPlatformModeState(config);
    const activeSession = await loadActiveTargetSession(config);
    const completionPath = getTargetCompletionPath(config.paths.stateDir, session.projectId, session.sessionId);

    assert.equal(result.action, "stop");
    assert.match(String(result.message || ""), /archived completed target session/);
    assert.equal(modeState.currentMode, PLATFORM_MODE.IDLE);
    assert.equal(activeSession, null);
    await assert.doesNotReject(() => fs.access(completionPath));
  });

  it("keeps an active target session eligible for continued orchestration", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-orch-target-stop-"));
    const config = buildConfig(tempRoot);

    await createTargetSession(buildManifest(), config);
    await transitionActiveTargetSession(config, {
      nextStage: TARGET_SESSION_STAGE.ACTIVE,
      actor: "test",
      reason: "planning_ready",
    });

    const result = await prepareTargetSessionForCycle(config);

    assert.equal(result.action, "continue");
  });

  it("stops immediately after restart when the latest target handoff is already completed", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-orch-target-stop-"));
    const config = buildConfig(tempRoot);
    const session = await createTargetSession(buildManifest(), config);

    await transitionActiveTargetSession(config, {
      nextStage: TARGET_SESSION_STAGE.COMPLETED,
      actor: "test",
      reason: "target_delivery_handoff_presented",
      handoff: {
        carriedContextSummary: "Delivered target is ready for presentation.",
        requiredHumanInputs: [],
      },
    });
    await archiveTargetSession(config, {
      completionStage: TARGET_SESSION_STAGE.COMPLETED,
      completionReason: "target_delivery_completed:test",
      completionSummary: "Delivered target is ready for presentation.",
    });

    await fs.writeFile(
      path.join(config.paths.stateDir, "last_target_delivery_handoff.json"),
      JSON.stringify({
        projectId: session.projectId,
        sessionId: session.sessionId,
        summary: "Delivered target is ready for presentation.",
        delivery: {
          userMessage: "Delivered target is ready for presentation.",
          status: "documented",
        },
      }),
      "utf8",
    );

    const result = await prepareTargetSessionForCycle(config);

    assert.equal(result.action, "stop");
    assert.match(String(result.message || ""), /terminal target handoff already completed/);
  });

  it("treats idle with no active target session as a fully stopped ready state", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-orch-target-stop-"));
    const config = buildConfig(tempRoot);

    await updatePlatformModeState(config, {
      currentMode: PLATFORM_MODE.IDLE,
      activeTargetSessionId: null,
      activeTargetProjectId: null,
      fallbackModeAfterCompletion: PLATFORM_MODE.IDLE,
      reason: "test_idle_ready_state",
    }, null);

    const result = await prepareTargetSessionForCycle(config);
    const activeSession = await loadActiveTargetSession(config);
    const modeState = await loadPlatformModeState(config);

    assert.equal(result.action, "stop");
    assert.match(String(result.message || ""), /ready for next target session/);
    assert.equal(modeState.currentMode, PLATFORM_MODE.IDLE);
    assert.equal(activeSession, null);
  });
});