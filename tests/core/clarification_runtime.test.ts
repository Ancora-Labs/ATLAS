import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTargetSession, TARGET_INTENT_STATUS, TARGET_SESSION_STAGE } from "../../src/core/target_session_state.js";
import { runTargetOnboarding } from "../../src/core/onboarding_runner.js";
import { getTargetClarificationRuntimeState, submitTargetClarificationAnswer } from "../../src/core/clarification_runtime.js";

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
      summary: "Clarify the target before planning",
      acceptanceCriteria: ["clarified", "planning-ready"],
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

describe("clarification_runtime", () => {
  it("records transcript turns and promotes empty-repo clarification into shadow planning", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-clarification-"));
    const localRepo = path.join(tempRoot, "empty-target-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "README.md"), "# Empty target\n");

    const config = buildConfig(tempRoot, { githubToken: "token" });
    const session = await createTargetSession(buildManifest({ localPath: localRepo }), config);
    await runTargetOnboarding(config, session);

    const initialRuntime = await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    assert.equal(initialRuntime.currentQuestion.id, "product_goal");

    await submitTargetClarificationAnswer(config, {
      answerText: "Business website for a fish restaurant with menu and booking pages",
    });
    await submitTargetClarificationAnswer(config, {
      answerText: "Restaurant guests and staff who manage reservations",
      selectedOptions: ["Restaurant guests"],
    });
    await submitTargetClarificationAnswer(config, {
      selectedOptions: ["Homepage", "Booking flow", "Content management"],
      answerText: "Homepage, booking flow, and content editing must exist in v1",
    });
    const finalResult = await submitTargetClarificationAnswer(config, {
      selectedOptions: ["Business conversion"],
    });

    assert.equal(finalResult.readyForPlanning, true);
    assert.equal(finalResult.session.currentStage, TARGET_SESSION_STAGE.SHADOW);
    assert.equal(finalResult.session.clarification.status, "completed");
    assert.equal(finalResult.session.intent.status, TARGET_INTENT_STATUS.READY_FOR_PLANNING);
    assert.equal(finalResult.session.gates.allowPlanning, true);
    assert.equal(finalResult.session.gates.allowShadowExecution, true);
    assert.equal(finalResult.session.gates.allowActiveExecution, false);
    assert.match(String(finalResult.session.intent.summary || ""), /fish restaurant/i);
    assert.ok(Array.isArray(finalResult.transcript.turns));
    assert.ok(finalResult.transcript.turns.length >= 8);
  });

  it("asks an immediate follow-up when a clarification answer is too vague", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-clarification-"));
    const localRepo = path.join(tempRoot, "existing-target-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.mkdir(path.join(localRepo, "src"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "src", "index.ts"), "export const ready = true;\n");
    await fs.writeFile(path.join(localRepo, "package.json"), JSON.stringify({ name: "target-repo" }, null, 2));

    const config = buildConfig(tempRoot, { githubToken: "token" });
    const session = await createTargetSession(buildManifest({ localPath: localRepo }), config);
    await runTargetOnboarding(config, session);

    const initialRuntime = await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    assert.equal(initialRuntime.currentQuestion.id, "repo_purpose_confirmation");

    const result = await submitTargetClarificationAnswer(config, {
      answerText: "site",
      questionId: "repo_purpose_confirmation",
    });

    assert.equal(result.readyForPlanning, false);
    assert.equal(result.session.currentStage, TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION);
    assert.equal(String(result.currentQuestion?.id || "").startsWith("follow_up_repo_purpose_confirmation_"), true);
    assert.ok(result.session.intent.openQuestions.some((entry: string) => entry.includes("Follow-up for")));
  });
});