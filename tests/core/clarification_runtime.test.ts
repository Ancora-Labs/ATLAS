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
  it("records transcript turns and promotes empty-repo clarification into active planning after one intake pass", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-clarification-"));
    const localRepo = path.join(tempRoot, "empty-target-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "README.md"), "# Empty target\n");

    const config = buildConfig(tempRoot, {
      githubToken: "token",
      copilotCliCommand: "__missing_copilot_binary__",
    });
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
    await submitTargetClarificationAnswer(config, {
      selectedOptions: ["Business conversion"],
    });
    const finalResult = await submitTargetClarificationAnswer(config, {
      questionId: "design_direction",
      answerText: "Clean and professional with strong food photography and a polished booking-first feel.",
      selectedOptions: ["Clean and professional"],
    });

    assert.equal(finalResult.readyForPlanning, true);
    assert.equal(finalResult.session.currentStage, TARGET_SESSION_STAGE.ACTIVE);
    assert.equal(finalResult.session.clarification.status, "completed");
    assert.equal(finalResult.session.intent.status, TARGET_INTENT_STATUS.READY_FOR_PLANNING);
    assert.equal(finalResult.session.gates.allowPlanning, true);
    assert.equal(finalResult.session.gates.allowShadowExecution, false);
    assert.equal(finalResult.session.gates.allowActiveExecution, true);
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

    const config = buildConfig(tempRoot, {
      githubToken: "token",
      copilotCliCommand: "__missing_copilot_binary__",
    });
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

  it("asks for custom detail when Other is selected without any explanation", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-clarification-other-"));
    const localRepo = path.join(tempRoot, "empty-target-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "README.md"), "# Empty target\n");

    const config = buildConfig(tempRoot, {
      githubToken: "token",
      copilotCliCommand: "__missing_copilot_binary__",
    });
    const session = await createTargetSession(buildManifest({ localPath: localRepo }), config);
    await runTargetOnboarding(config, session);

    await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    const result = await submitTargetClarificationAnswer(config, {
      questionId: "product_goal",
      selectedOptions: ["Other"],
    });

    assert.equal(result.readyForPlanning, false);
    assert.equal(result.session.currentStage, TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION);
    assert.equal(String(result.currentQuestion?.id || "").startsWith("follow_up_product_goal_"), true);
  });

  it("completes existing-repo intake directly from the initial question set without extra AI mode routing", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-clarification-simple-"));
    const localRepo = path.join(tempRoot, "existing-simple-target-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.mkdir(path.join(localRepo, "src"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "index.html"), "<main>Home</main>\n");
    await fs.writeFile(path.join(localRepo, "style.css"), "body { margin: 0; }\n");
    await fs.writeFile(path.join(localRepo, "package.json"), JSON.stringify({ name: "simple-target" }, null, 2));

    const config = buildConfig(tempRoot, {
      githubToken: "token",
      copilotCliCommand: "__missing_copilot_binary__",
    });
    const session = await createTargetSession(buildManifest({ localPath: localRepo }), config);
    await runTargetOnboarding(config, session);

    await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    await submitTargetClarificationAnswer(config, {
      questionId: "repo_purpose_confirmation",
      answerText: "Marketing site for a local business",
      selectedOptions: ["Marketing site"],
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "target_users",
      answerText: "Customers browsing the homepage",
      selectedOptions: ["Customers"],
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "requested_change",
      answerText: "Refresh the homepage hero copy and CTA styling only.",
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "protected_areas",
      answerText: "none",
    });
    const finalResult = await submitTargetClarificationAnswer(config, {
      questionId: "success_signal",
      answerText: "Homepage still renders correctly and tests stay green.",
    });

    assert.equal(finalResult.readyForPlanning, true);
    assert.equal(finalResult.session.currentStage, TARGET_SESSION_STAGE.ACTIVE);
    assert.equal(finalResult.session.intent.planningMode, "active");
    assert.equal(finalResult.session.gates.allowPlanning, true);
    assert.equal(finalResult.session.gates.allowShadowExecution, false);
    assert.equal(finalResult.session.gates.allowActiveExecution, true);
    assert.equal(finalResult.session.handoff.nextAction, "run_active_planning");
  });

  it("ignores per-answer AI turn decisions and completes from the initial intake packet only", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-clarification-single-call-"));
    const localRepo = path.join(tempRoot, "existing-single-call-target-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "index.html"), "<main>Home</main>\n");
    await fs.writeFile(path.join(localRepo, "style.css"), "body { margin: 0; }\n");
    await fs.writeFile(path.join(localRepo, "package.json"), JSON.stringify({ name: "single-call-target" }, null, 2));

    const config = buildConfig(tempRoot, {
      githubToken: "token",
      mockClarificationTurnDecisions: JSON.stringify({
        byQuestionId: {
          success_signal: {
            outcome: "ready_to_confirm",
            understanding: "This should never be used because intake is single-call only.",
            rationale: "obsolete per-answer routing",
            confidence: "high",
            proposedMode: "shadow",
          },
        },
      }),
    });
    const session = await createTargetSession(buildManifest({ localPath: localRepo }), config);
    await runTargetOnboarding(config, session);

    await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    await submitTargetClarificationAnswer(config, {
      questionId: "repo_purpose_confirmation",
      answerText: "Marketing site for a local business",
      selectedOptions: ["Marketing site"],
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "target_users",
      answerText: "Customers browsing the homepage",
      selectedOptions: ["Customers"],
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "requested_change",
      answerText: "Refresh the homepage hero copy and CTA styling only.",
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "protected_areas",
      answerText: "none",
    });

    const finalResult = await submitTargetClarificationAnswer(config, {
      questionId: "success_signal",
      answerText: "Homepage still renders correctly and tests stay green.",
    });

    assert.equal(finalResult.readyForPlanning, true);
    assert.equal(finalResult.session.currentStage, TARGET_SESSION_STAGE.ACTIVE);
    assert.equal(finalResult.session.intent.planningMode, "active");
    assert.equal(finalResult.session.gates.allowPlanning, true);
    assert.equal(finalResult.session.gates.allowShadowExecution, false);
    assert.equal(finalResult.session.gates.allowActiveExecution, true);
    assert.equal(finalResult.intentContract.deliveryModeDecision ?? null, null);
  });

  it("opens directly in active mode after the initial intake questions for existing repos", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-clarification-agent-active-"));
    const localRepo = path.join(tempRoot, "existing-agent-active-target-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "index.html"), "<main>Portal</main>\n");
    await fs.writeFile(path.join(localRepo, "style.css"), "body { color: #111; }\n");
    await fs.writeFile(path.join(localRepo, "package.json"), JSON.stringify({ name: "agent-active-target" }, null, 2));

    const config = buildConfig(tempRoot, {
      githubToken: "token",
    });
    const session = await createTargetSession(buildManifest({ localPath: localRepo }), config);
    await runTargetOnboarding(config, session);

    await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    await submitTargetClarificationAnswer(config, {
      questionId: "repo_purpose_confirmation",
      answerText: "SaaS app with multiple admin workflows",
      selectedOptions: ["SaaS app"],
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "target_users",
      answerText: "Admins and staff",
      selectedOptions: ["Admins/staff"],
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "requested_change",
      answerText: "Add dashboard analytics and admin filters for internal operations.",
    });
    await submitTargetClarificationAnswer(config, {
      questionId: "protected_areas",
      answerText: "none",
    });
    const finalResult = await submitTargetClarificationAnswer(config, {
      questionId: "success_signal",
      answerText: "Admins can use the new dashboard without regressions.",
    });

    assert.equal(finalResult.readyForPlanning, true);
    assert.equal(finalResult.session.currentStage, TARGET_SESSION_STAGE.ACTIVE);
    assert.equal(finalResult.session.intent.planningMode, "active");
    assert.equal(finalResult.session.gates.allowPlanning, true);
    assert.equal(finalResult.session.gates.allowShadowExecution, false);
    assert.equal(finalResult.session.gates.allowActiveExecution, true);
    assert.equal(finalResult.intentContract.deliveryModeDecision ?? null, null);
  });

  it("uses authored follow-up flow from the initial packet and preserves the final resolved packet", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-clarification-authored-flow-"));
    const localRepo = path.join(tempRoot, "authored-flow-target-repo");
    await fs.mkdir(path.join(localRepo, ".git"), { recursive: true });
    await fs.writeFile(path.join(localRepo, "README.md"), "# Empty target\n");

    const config = buildConfig(tempRoot, {
      githubToken: "token",
      mockTargetOnboardingClarificationPacket: JSON.stringify({
        openingPrompt: "Tell ATLAS what you want to build.",
        understanding: {
          likelyIntent: "A non-trivial product request needs a precise v1 definition.",
        },
        requiredSemanticSlots: ["product_goal", "target_users"],
        packetBlueprint: {
          preserve: ["summary", "users", "constraints"],
        },
        questions: [
          {
            id: "product_goal",
            semanticSlot: "product_goal",
            title: "What should BOX build?",
            prompt: "Describe the product in one sentence.",
            answerMode: "hybrid",
            options: ["CLI tool", "Backend service", "Other"],
            followUps: [
              {
                id: "product_goal_follow_up_detail",
                semanticSlot: "product_goal",
                title: "What exactly should it do first?",
                prompt: "Make it concrete: what should the very first usable version actually do?",
                answerMode: "hybrid",
                minAnswerLength: 12,
              },
            ],
          },
          {
            id: "target_users",
            semanticSlot: "target_users",
            title: "Who is it for?",
            prompt: "Who will use it first?",
            answerMode: "hybrid",
            options: ["Operators", "Customers", "Other"],
          },
        ],
      }),
    });
    const session = await createTargetSession(buildManifest({ localPath: localRepo }), config);
    await runTargetOnboarding(config, session);

    const initialRuntime = await getTargetClarificationRuntimeState(config, { persistPrompt: true });
    assert.equal(initialRuntime.currentQuestion.id, "product_goal");

    const followUpResult = await submitTargetClarificationAnswer(config, {
      questionId: "product_goal",
      answerText: "tool",
    });

    assert.equal(followUpResult.readyForPlanning, false);
    assert.equal(followUpResult.currentQuestion?.id, "product_goal_follow_up_detail");
    assert.equal(followUpResult.currentQuestion?.prompt, "Make it concrete: what should the very first usable version actually do?");

    await submitTargetClarificationAnswer(config, {
      questionId: "product_goal_follow_up_detail",
      answerText: "A release helper that versions packages and publishes release notes.",
    });
    const finalResult = await submitTargetClarificationAnswer(config, {
      questionId: "target_users",
      answerText: "Internal operators who prepare releases.",
      selectedOptions: ["Operators"],
    });

    assert.equal(finalResult.readyForPlanning, true);
    assert.equal(finalResult.intentContract.resolvedPacket.authoredPacket.packetBlueprint.preserve[0], "summary");
    assert.equal(finalResult.intentContract.resolvedPacket.authoredUnderstanding.likelyIntent, "A non-trivial product request needs a precise v1 definition.");
    assert.equal(finalResult.intentContract.resolvedPacket.answeredQuestions.length, 3);
  });

});