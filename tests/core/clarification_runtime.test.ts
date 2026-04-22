import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createClarificationRuntime,
  type ClarificationPlan,
} from "../../src/core/clarification_runtime.js";

const plan: ClarificationPlan = {
  slots: [
    { key: "goal", question: "What outcome do you want from ATLAS?", summaryLabel: "Goal" },
    { key: "constraints", question: "What constraints should ATLAS respect?", summaryLabel: "Constraints" },
  ],
};

describe("clarification_runtime", () => {
  it("advances one question at a time and ends in pending approval", () => {
    const runtime = createClarificationRuntime(plan);

    const firstQuestion = runtime.getNextQuestion();
    assert.equal(firstQuestion.kind, "question");
    assert.equal(firstQuestion.slotKey, "goal");
    assert.deepEqual(firstQuestion.unansweredSlotKeys, ["goal", "constraints"]);

    const secondQuestion = runtime.submitAnswer(firstQuestion, "Prepare a release plan.");
    assert.equal(secondQuestion.kind, "question");
    assert.equal(secondQuestion.slotKey, "constraints");
    assert.deepEqual(secondQuestion.answeredSlotKeys, ["goal"]);

    const pendingApproval = runtime.submitAnswer(secondQuestion, "Keep changes scoped to src/core.");
    assert.equal(pendingApproval.kind, "pending-approval");
    assert.equal(pendingApproval.requiresConfirmation, true);
    assert.deepEqual(pendingApproval.unresolvedSlots, []);
    assert.deepEqual(
      pendingApproval.summary.map((item) => [item.slotKey, item.answer]),
      [
        ["goal", "Prepare a release plan."],
        ["constraints", "Keep changes scoped to src/core."],
      ],
    );
  });

  it("keeps the active slot unresolved when the answer is blank", () => {
    const runtime = createClarificationRuntime(plan);
    const firstQuestion = runtime.getNextQuestion();
    assert.equal(firstQuestion.kind, "question");

    const nextStep = runtime.submitAnswer(firstQuestion, "   ");
    assert.equal(nextStep.kind, "question");
    assert.equal(nextStep.slotKey, "goal");
    assert.deepEqual(runtime.getState().unresolvedSlots, ["goal", "constraints"]);
  });

  it("rejects answers for stale or non-active questions", () => {
    const runtime = createClarificationRuntime(plan);
    const firstQuestion = runtime.getNextQuestion();
    assert.equal(firstQuestion.kind, "question");
    runtime.submitAnswer(firstQuestion, "Ship a desktop shell.");

    assert.throws(
      () => runtime.submitAnswer(firstQuestion, "A stale retry."),
      /Clarification answer must target the active question/,
    );
  });
});
