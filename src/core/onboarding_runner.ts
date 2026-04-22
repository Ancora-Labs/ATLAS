import {
  createClarificationRuntime,
  type ClarificationPendingApproval,
  type ClarificationPlan,
  type ClarificationQuestion,
} from "./clarification_runtime.js";

export interface OnboardingLogger {
  error(message: string, error?: unknown): void;
}

export interface OnboardingQuestionView {
  question: ClarificationQuestion;
  canGoBack: boolean;
}

export type OnboardingQuestionResponse =
  | { kind: "answer"; answer: string }
  | { kind: "back" };

export type OnboardingSummaryResponse =
  | { kind: "confirm" }
  | { kind: "back" };

export interface RunOnboardingOptions {
  initializePlan: () => Promise<ClarificationPlan>;
  askQuestion: (view: OnboardingQuestionView) => Promise<OnboardingQuestionResponse>;
  renderSummary: (summary: ClarificationPendingApproval) => Promise<OnboardingSummaryResponse>;
  logger?: OnboardingLogger;
}

export interface OnboardingResult {
  status: "confirmed";
  answers: Readonly<Record<string, string>>;
  summary: ClarificationPendingApproval["summary"];
}

function defaultLogger(): OnboardingLogger {
  return {
    error(message: string, error?: unknown) {
      if (error === undefined) {
        console.error(message);
        return;
      }
      console.error(message, error);
    },
  };
}

async function invokeBoundary<T>(
  label: string,
  operation: () => Promise<T>,
  logger: OnboardingLogger,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`[onboarding_runner] ${label} failed`, error);
    throw error;
  }
}

function removeLastAnswer(
  answers: Readonly<Record<string, string>>,
  history: string[],
): Record<string, string> {
  if (history.length === 0) {
    return { ...answers };
  }

  const updatedAnswers = { ...answers };
  const lastSlotKey = history.pop();
  if (lastSlotKey) {
    delete updatedAnswers[lastSlotKey];
  }
  return updatedAnswers;
}

export async function runOnboarding(options: RunOnboardingOptions): Promise<OnboardingResult> {
  const logger = options.logger ?? defaultLogger();
  const plan = await invokeBoundary("initializePlan", options.initializePlan, logger);

  let answers: Record<string, string> = Object.fromEntries(
    plan.slots
      .map((slot) => {
        const answer = String(plan.answers?.[slot.key] ?? "").trim();
        return answer ? [slot.key, answer] : null;
      })
      .filter((entry): entry is [string, string] => entry !== null),
  );
  const history = plan.slots
    .map((slot) => slot.key)
    .filter((slotKey) => Boolean(answers[slotKey]));

  while (true) {
    const runtime = createClarificationRuntime({
      slots: plan.slots,
      answers,
    });
    const step = runtime.getNextQuestion();

    if (step.kind === "question") {
      const response = await invokeBoundary(
        "askQuestion",
        () => options.askQuestion({ question: step, canGoBack: history.length > 0 }),
        logger,
      );

      if (response.kind === "back") {
        answers = removeLastAnswer(answers, history);
        continue;
      }

      const nextStep = runtime.submitAnswer(step, response.answer);
      const nextState = runtime.getState();
      answers = { ...nextState.answers };

      if (answers[step.slotKey]) {
        const previousIndex = history.indexOf(step.slotKey);
        if (previousIndex >= 0) {
          history.splice(previousIndex, 1);
        }
        history.push(step.slotKey);
      }

      if (nextStep.kind === "pending-approval") {
        const summaryResponse = await invokeBoundary(
          "renderSummary",
          () => options.renderSummary(nextStep),
          logger,
        );

        if (summaryResponse.kind === "confirm") {
          return {
            status: "confirmed",
            answers,
            summary: nextStep.summary,
          };
        }

        answers = removeLastAnswer(answers, history);
      }

      continue;
    }

    const summaryResponse = await invokeBoundary(
      "renderSummary",
      () => options.renderSummary(step),
      logger,
    );

    if (summaryResponse.kind === "confirm") {
      return {
        status: "confirmed",
        answers: runtime.getState().answers,
        summary: step.summary,
      };
    }

    answers = removeLastAnswer(runtime.getState().answers, history);
  }
}
