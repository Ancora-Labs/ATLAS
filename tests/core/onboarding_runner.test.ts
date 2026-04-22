import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runOnboarding } from "../../src/core/onboarding_runner.js";
import type { ClarificationPlan } from "../../src/core/clarification_runtime.js";

const onboardingPlan: ClarificationPlan = {
  slots: [
    { key: "goal", question: "What should ATLAS help you do?", summaryLabel: "Goal" },
    { key: "scope", question: "Which scope should stay protected?", summaryLabel: "Scope" },
  ],
};

describe("onboarding_runner", () => {
  it("uses one initialization call and waits for explicit confirm", async () => {
    let initializeCount = 0;
    const askedQuestions: string[] = [];
    let summaryCount = 0;

    const result = await runOnboarding({
      async initializePlan() {
        initializeCount += 1;
        return onboardingPlan;
      },
      async askQuestion(view) {
        askedQuestions.push(view.question.slotKey);
        if (view.question.slotKey === "goal") {
          return { kind: "answer", answer: "Prepare the onboarding shell." } as const;
        }
        return { kind: "answer", answer: "Keep src/dashboard untouched." } as const;
      },
      async renderSummary(summary) {
        summaryCount += 1;
        assert.equal(summary.kind, "pending-approval");
        return { kind: "confirm" } as const;
      },
    });

    assert.equal(initializeCount, 1);
    assert.deepEqual(askedQuestions, ["goal", "scope"]);
    assert.equal(summaryCount, 1);
    assert.equal(result.status, "confirmed");
    assert.deepEqual(result.answers, {
      goal: "Prepare the onboarding shell.",
      scope: "Keep src/dashboard untouched.",
    });
  });

  it("supports back navigation from the final summary without a second initialization call", async () => {
    let initializeCount = 0;
    const questionSequence: string[] = [];
    let summaryCount = 0;

    const result = await runOnboarding({
      async initializePlan() {
        initializeCount += 1;
        return onboardingPlan;
      },
      async askQuestion(view) {
        questionSequence.push(`${view.question.slotKey}:${view.canGoBack ? "back" : "start"}`);
        if (view.question.slotKey === "goal") {
          return { kind: "answer", answer: "Collect a single active question." } as const;
        }
        if (summaryCount === 0) {
          return { kind: "answer", answer: "Keep docs and core changes separate." } as const;
        }
        return { kind: "answer", answer: "Keep protected dashboard paths unchanged." } as const;
      },
      async renderSummary() {
        summaryCount += 1;
        if (summaryCount === 1) {
          return { kind: "back" } as const;
        }
        return { kind: "confirm" } as const;
      },
    });

    assert.equal(initializeCount, 1);
    assert.deepEqual(questionSequence, [
      "goal:start",
      "scope:back",
      "scope:back",
    ]);
    assert.equal(summaryCount, 2);
    assert.equal(result.answers.scope, "Keep protected dashboard paths unchanged.");
  });

  it("logs and rethrows initialization failures", async () => {
    const errors: string[] = [];

    await assert.rejects(
      () => runOnboarding({
        async initializePlan() {
          throw new Error("premium init unavailable");
        },
        async askQuestion() {
          return { kind: "back" } as const;
        },
        async renderSummary() {
          return { kind: "confirm" } as const;
        },
        logger: {
          error(message) {
            errors.push(message);
          },
        },
      }),
      /premium init unavailable/,
    );

    assert.deepEqual(errors, ["[onboarding_runner] initializePlan failed"]);
  });

  it("reuses precomputed answers and only asks unresolved questions", async () => {
    const result = await runOnboarding({
      async initializePlan() {
        return {
          slots: onboardingPlan.slots,
          answers: {
            goal: "Start from the premium initialization summary.",
          },
        };
      },
      async askQuestion(view) {
        assert.equal(view.question.slotKey, "scope");
        assert.equal(view.canGoBack, true);
        return { kind: "answer", answer: "Keep protected paths immutable." } as const;
      },
      async renderSummary(summary) {
        assert.deepEqual(
          summary.summary.map((item) => item.slotKey),
          ["goal", "scope"],
        );
        return { kind: "confirm" } as const;
      },
    });

    assert.deepEqual(result.answers, {
      goal: "Start from the premium initialization summary.",
      scope: "Keep protected paths immutable.",
    });
  });
});
