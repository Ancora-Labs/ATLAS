import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  evaluateTargetSuccessContract,
  isTargetSuccessContractTerminal,
  performTargetDeliveryHandoff,
  TARGET_SUCCESS_CONTRACT_STATUS,
} from "../../src/core/target_success_contract.js";

function buildConfig(tempRoot: string) {
  const rootDir = path.join(tempRoot, "box-root");
  return {
    rootDir,
    paths: {
      stateDir: path.join(rootDir, "state"),
      workspaceDir: path.join(rootDir, ".box-work"),
    },
    platformModeState: {
      currentMode: "single_target_delivery",
    },
  };
}

function buildSession() {
  return {
    projectId: "target_testrepoforsingletargetmode",
    sessionId: "sess_test_001",
    objective: {
      summary: "i want simple to do list app",
      acceptanceCriteria: ["clarified", "planning-ready"],
    },
    intent: {
      summary: "goal=simple to-do list app | success=Fast MVP, simple clean UI, add complete delete task flow first",
      scopeIn: ["i want simple to-do list app", "has to be a completed, working project"],
      mustHaveFlows: ["has to be a completed, working project"],
      preferredQualityBar: "Fast MVP, simple clean UI, add complete delete task flow first",
    },
    handoff: {
      requiredHumanInputs: ["Choose the main priority so BOX can optimize the first build correctly."],
      carriedContextSummary: "Target delivery is active.",
    },
  };
}

describe("target_success_contract", () => {
  let tempRoot: string;
  let config: any;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-target-success-"));
    config = buildConfig(tempRoot);
    await fs.mkdir(config.paths.stateDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("marks the target fulfilled when delivery and final sign-off evidence exist", async () => {
    const workspacePath = path.join(tempRoot, "delivered-workspace");
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_evolution-worker.txt"), [
      "BOX_STATUS=skipped",
      "BOX_SKIP_REASON=already-merged",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_EXPECTED_OUTCOME=simple static to-do list app delivered in the target repository with browser-openable assets and verification coverage",
      "BOX_ACTUAL_OUTCOME=the app was already merged on main, and current main passes build, lint, and targeted todo app tests without further edits",
    ].join("\n"), "utf8");
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_quality-worker.txt"), [
      "DELIVERED: To-do list app is live on main. Open index.html in any browser. No build step. Session ready to close.",
      "BOX_STATUS=skipped",
      "BOX_SKIP_REASON=already-merged-on-main",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_EXPECTED_OUTCOME=Verify the live GitHub main branch has the simple to-do list app and only sign off if all six release checks pass.",
      "BOX_ACTUAL_OUTCOME=Verified live main already contains the simple to-do list app and all six release checks passed without requiring new changes.",
    ].join("\n"), "utf8");

    const report = await evaluateTargetSuccessContract(config, {
      ...buildSession(),
      workspace: { path: workspacePath },
    });
    assert.equal(report.status, TARGET_SUCCESS_CONTRACT_STATUS.FULFILLED);
    assert.equal(report.pendingHumanInputs.length, 0);
    assert.equal(isTargetSuccessContractTerminal(report), true);
    assert.equal(report.delivery.locationType, "workspace");
    assert.equal(report.delivery.workspacePath, workspacePath);
    assert.equal(report.delivery.autoOpenEligible, false);
  });

  it("keeps the contract open when final release sign-off evidence is missing", async () => {
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_evolution-worker.txt"), [
      "BOX_STATUS=done",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_ACTUAL_OUTCOME=the app was already merged on main, and current main passes build, lint, and targeted todo app tests without further edits",
    ].join("\n"), "utf8");

    const report = await evaluateTargetSuccessContract(config, buildSession());
    assert.equal(report.status, TARGET_SUCCESS_CONTRACT_STATUS.OPEN);
    assert.ok(report.blockers.includes("release_signoff_missing"));
    assert.equal(isTargetSuccessContractTerminal(report), false);
  });

  it("records delivery handoff and uses the presenter-selected local target", async () => {
    const workspacePath = path.join(tempRoot, "delivered-workspace");
    await fs.mkdir(workspacePath, { recursive: true });
    const indexPath = path.join(workspacePath, "index.html");
    await fs.writeFile(indexPath, "<html><body>todo</body></html>", "utf8");
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_evolution-worker.txt"), [
      "BOX_STATUS=skipped",
      "BOX_SKIP_REASON=already-merged",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_ACTUAL_OUTCOME=the app was already merged on main, and current main passes build, lint, and targeted todo app tests without further edits",
    ].join("\n"), "utf8");
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_quality-worker.txt"), [
      "DELIVERED: To-do list app is live on main. Open index.html in any browser. No build step. Session ready to close.",
      "BOX_STATUS=skipped",
      "BOX_SKIP_REASON=already-merged-on-main",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_ACTUAL_OUTCOME=Verified live main already contains the simple to-do list app and all six release checks passed without requiring new changes.",
    ].join("\n"), "utf8");
    const report = await evaluateTargetSuccessContract(config, {
      ...buildSession(),
      workspace: { path: workspacePath },
    });

    const targets: string[] = [];
    const handoff = await performTargetDeliveryHandoff(config, report, {
      resolvePresentation: async () => ({
        status: "ready_to_open",
        locationType: "local_path",
        primaryLocation: indexPath,
        openTarget: indexPath,
        preserveWorkspace: true,
        instructions: [`Open ${indexPath}.`],
        userMessage: "Product ready in the local workspace.",
      }),
      openTarget: async (target: string) => {
        targets.push(target);
        return { attempted: true, opened: true, reason: null };
      },
    });

    assert.deepEqual(targets, [indexPath]);
    assert.equal(handoff.autoOpen.opened, true);
    assert.equal(handoff.delivery.primaryLocation, indexPath);
    assert.equal(handoff.delivery.preserveWorkspace, true);
  });

  it("falls back to a documented workspace when the presenter does not provide a runnable target", async () => {
    const workspacePath = path.join(tempRoot, "delivered-workspace");
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_evolution-worker.txt"), [
      "BOX_STATUS=skipped",
      "BOX_SKIP_REASON=already-merged",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_ACTUAL_OUTCOME=the app was already merged on main, and current main passes build, lint, and targeted todo app tests without further edits",
    ].join("\n"), "utf8");
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_quality-worker.txt"), [
      "DELIVERED: To-do list app is live on main. Open index.html in any browser. No build step. Session ready to close.",
      "BOX_STATUS=skipped",
      "BOX_SKIP_REASON=already-merged-on-main",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_ACTUAL_OUTCOME=Verified live main already contains the simple to-do list app and all six release checks passed without requiring new changes.",
    ].join("\n"), "utf8");

    const report = await evaluateTargetSuccessContract(config, {
      ...buildSession(),
      workspace: { path: workspacePath },
    });

    const handoff = await performTargetDeliveryHandoff(config, report, {
      resolvePresentation: async () => ({
        status: "documented",
        locationType: "workspace",
        primaryLocation: workspacePath,
        openTarget: null,
        preserveWorkspace: false,
        instructions: [`Inspect workspace at ${workspacePath}.`],
        userMessage: "Workspace preserved only for manual inspection is not required.",
      }),
    });

    assert.equal(handoff.delivery.locationType, "workspace");
    assert.equal(handoff.delivery.autoOpenEligible, false);
    assert.equal(handoff.autoOpen.attempted, false);
  });

  it("uses an explicit deployed preview URL as the conservative fallback", async () => {
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_evolution-worker.txt"), [
      "BOX_STATUS=skipped",
      "BOX_SKIP_REASON=already-merged",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_ACTUAL_OUTCOME=the simple to-do list app delivery is already merged and verified on main",
    ].join("\n"), "utf8");
    await fs.writeFile(path.join(config.paths.stateDir, "debug_worker_quality-worker.txt"), [
      "DELIVERED: Simple to-do list app is live at https://acme-demo.vercel.app and ready to use.",
      "BOX_STATUS=skipped",
      "BOX_SKIP_REASON=already-merged-on-main",
      "BOX_MERGED_SHA=8ac7ee06035bb0273801dcb4baa4c72d090b6460",
      "BOX_ACTUAL_OUTCOME=Verified the simple to-do list app release checks passed and preview is available at https://acme-demo.vercel.app .",
    ].join("\n"), "utf8");

    const report = await evaluateTargetSuccessContract(config, {
      ...buildSession(),
      workspace: { path: path.join(tempRoot, "missing-workspace") },
    });

    const handoff = await performTargetDeliveryHandoff(config, report, {
      resolvePresentation: async () => {
        throw new Error("agent unavailable");
      },
    });

    assert.equal(handoff.delivery.locationType, "url");
    assert.equal(handoff.delivery.autoOpenEligible, true);
    assert.equal(handoff.delivery.openTarget, "https://acme-demo.vercel.app");
  });
});