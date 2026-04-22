export interface ClarificationSlot {
  key: string;
  question: string;
  summaryLabel: string;
  required?: boolean;
}

export interface ClarificationPlan {
  slots: readonly ClarificationSlot[];
  answers?: Readonly<Record<string, string>>;
}

export interface ClarificationSummaryItem {
  slotKey: string;
  summaryLabel: string;
  question: string;
  answer: string;
}

export interface ClarificationQuestion {
  kind: "question";
  slotKey: string;
  prompt: string;
  summaryLabel: string;
  unansweredSlotKeys: readonly string[];
  answeredSlotKeys: readonly string[];
  stepNumber: number;
  totalSteps: number;
}

export interface ClarificationPendingApproval {
  kind: "pending-approval";
  unresolvedSlots: readonly string[];
  summary: readonly ClarificationSummaryItem[];
  requiresConfirmation: true;
}

export type ClarificationStep = ClarificationQuestion | ClarificationPendingApproval;

export interface ClarificationRuntimeState {
  answers: Readonly<Record<string, string>>;
  unresolvedSlots: readonly string[];
  answeredSlotKeys: readonly string[];
}

function normalizeAnswer(value: unknown): string {
  return String(value ?? "").trim();
}

function cloneAnswers(answers: Map<string, string>): Record<string, string> {
  return Object.fromEntries(answers.entries());
}

function isRequiredSlot(slot: ClarificationSlot): boolean {
  return slot.required !== false;
}

function validatePlan(plan: ClarificationPlan): void {
  if (!Array.isArray(plan.slots) || plan.slots.length === 0) {
    throw new Error("Clarification plan requires at least one slot.");
  }

  const seenKeys = new Set<string>();
  for (const slot of plan.slots) {
    const key = String(slot?.key ?? "").trim();
    const question = String(slot?.question ?? "").trim();
    const summaryLabel = String(slot?.summaryLabel ?? "").trim();

    if (!key) {
      throw new Error("Clarification slot key is required.");
    }

    if (seenKeys.has(key)) {
      throw new Error(`Clarification slot key must be unique: ${key}`);
    }
    seenKeys.add(key);

    if (!question) {
      throw new Error(`Clarification slot question is required for ${key}.`);
    }

    if (!summaryLabel) {
      throw new Error(`Clarification slot summaryLabel is required for ${key}.`);
    }
  }
}

export class ClarificationRuntime {
  private readonly slots: readonly ClarificationSlot[];
  private readonly answers: Map<string, string>;

  constructor(plan: ClarificationPlan) {
    validatePlan(plan);
    this.slots = [...plan.slots];
    this.answers = new Map<string, string>();

    const initialAnswers = plan.answers ?? {};
    for (const slot of this.slots) {
      const normalized = normalizeAnswer(initialAnswers[slot.key]);
      if (normalized) {
        this.answers.set(slot.key, normalized);
      }
    }
  }

  getState(): ClarificationRuntimeState {
    const unresolvedSlots = this.slots
      .filter((slot) => isRequiredSlot(slot) && !this.answers.has(slot.key))
      .map((slot) => slot.key);

    const answeredSlotKeys = this.slots
      .map((slot) => slot.key)
      .filter((slotKey) => this.answers.has(slotKey));

    return {
      answers: cloneAnswers(this.answers),
      unresolvedSlots,
      answeredSlotKeys,
    };
  }

  getNextQuestion(): ClarificationStep {
    const state = this.getState();
    const nextSlot = this.slots.find((slot) => isRequiredSlot(slot) && !this.answers.has(slot.key));

    if (!nextSlot) {
      return {
        kind: "pending-approval",
        unresolvedSlots: state.unresolvedSlots,
        summary: this.slots
          .filter((slot) => this.answers.has(slot.key))
          .map((slot) => ({
            slotKey: slot.key,
            summaryLabel: slot.summaryLabel,
            question: slot.question,
            answer: this.answers.get(slot.key) ?? "",
          })),
        requiresConfirmation: true,
      };
    }

    return {
      kind: "question",
      slotKey: nextSlot.key,
      prompt: nextSlot.question,
      summaryLabel: nextSlot.summaryLabel,
      unansweredSlotKeys: state.unresolvedSlots,
      answeredSlotKeys: state.answeredSlotKeys,
      stepNumber: state.answeredSlotKeys.length + 1,
      totalSteps: this.slots.filter((slot) => isRequiredSlot(slot)).length,
    };
  }

  submitAnswer(question: ClarificationQuestion, answer: string): ClarificationStep {
    const activeQuestion = this.getNextQuestion();
    if (activeQuestion.kind !== "question") {
      throw new Error("Clarification plan is already awaiting approval.");
    }

    if (question.slotKey !== activeQuestion.slotKey) {
      throw new Error(
        `Clarification answer must target the active question. Expected ${activeQuestion.slotKey}, received ${question.slotKey}.`,
      );
    }

    const normalized = normalizeAnswer(answer);
    if (normalized) {
      this.answers.set(question.slotKey, normalized);
    } else {
      this.answers.delete(question.slotKey);
    }

    return this.getNextQuestion();
  }
}

export function createClarificationRuntime(plan: ClarificationPlan): ClarificationRuntime {
  return new ClarificationRuntime(plan);
}
