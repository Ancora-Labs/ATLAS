import { appendProgress } from "./state_tracker.js";
import { readJson, spawnAsync, writeJson } from "./fs_utils.js";
import { agentFileExists, appendAgentLiveLog, appendAgentLiveLogDetail, buildAgentArgs, parseAgentOutput, writeAgentDebugFile } from "./agent_loader.js";
import { requestDaemonReload } from "./daemon_control.js";
import {
  loadActiveTargetSession,
  saveActiveTargetSession,
  TARGET_INTENT_STATUS,
  TARGET_SESSION_STAGE,
} from "./target_session_state.js";

const MODE_APPROVAL_SEMANTIC_SLOT = "mode_approval";

function getTemporaryDefaultDeliveryMode() {
  return "active";
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeNumber(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildQuestionMap(contract: any) {
  const map = new Map<string, any>();
  for (const question of Array.isArray(contract?.openQuestions) ? contract.openQuestions : []) {
    const questionId = String(question?.id || "").trim();
    if (questionId) {
      map.set(questionId, question);
    }
  }
  return map;
}

function getQuestionStatus(question: any) {
  return String(question?.status || "pending").trim().toLowerCase() || "pending";
}

function resolveSemanticQuestionId(question: any, fallbackQuestionId: string | null = null) {
  const semanticId = String(
    question?.semanticSlot
    || question?.sourceQuestionId
    || fallbackQuestionId
    || question?.id
    || "",
  ).trim();
  return semanticId || String(fallbackQuestionId || question?.id || "question").trim() || "question";
}

function getCurrentPendingQuestion(contract: any) {
  const openQuestions = Array.isArray(contract?.openQuestions) ? contract.openQuestions : [];
  return openQuestions.find((question) => getQuestionStatus(question) === "pending") || null;
}

function countQuestionsByPrefix(contract: any, prefix: string) {
  return (Array.isArray(contract?.openQuestions) ? contract.openQuestions : [])
    .filter((question) => String(question?.id || "").trim().startsWith(prefix))
    .length;
}

function normalizeSelectedOptions(input: unknown) {
  if (Array.isArray(input)) {
    return uniqueStrings(input.map((entry) => String(entry || "").trim()));
  }
  const text = String(input || "").trim();
  if (!text) return [];
  return uniqueStrings(text.split(/[|,]/).map((entry) => entry.trim()));
}

function questionRequiresAnswer(question: any) {
  return question?.required !== false;
}

function isNegativeNoneResponse(text: string) {
  return /^(none|no|nothing|n-a|n\/a|yok|gerek yok)$/i.test(text.trim());
}

function isOtherSelection(value: string) {
  return /^(other|custom|something else|başka|diger|diğer)(\b|\s|$)/i.test(String(value || "").trim());
}

function prunePlaceholderSelections(selectedOptions: string[], answerText: string) {
  if (!String(answerText || "").trim()) {
    return selectedOptions;
  }
  return selectedOptions.filter((option) => !isOtherSelection(option));
}

function buildFollowUpPrompt(questionId: string, repoState: string) {
  const repoLabel = repoState === "existing" ? "existing repo" : "target";
  switch (questionId) {
    case "product_goal":
      return "Be concrete: what exact product or website should BOX build, and what should the first release include?";
    case "target_users":
      return "Who are the primary users, and what do they need first from the initial release?";
    case "must_have_flows":
      return "List the exact pages or flows that must exist in v1.";
    case "quality_bar":
      return "Choose the main priority in plain terms so planning can optimize for the right tradeoff.";
    case "repo_purpose_confirmation":
      return `Describe what the ${repoLabel} already does today in one concrete sentence.`;
    case "requested_change":
      return `Describe the exact change BOX should make in the ${repoLabel}, not just the general area.`;
    case "protected_areas":
      return "List the flows, business rules, or surfaces that must stay safe. If there are none, say none explicitly.";
    case "success_signal":
      return "State the concrete success signal BOX should optimize for. Example: booking flow works end-to-end, auth remains stable, tests stay green.";
    default:
      return "Add more concrete detail so planning can proceed without guessing.";
  }
}

function inferAnswerNeedsFollowUp(question: any, answerText: string, selectedOptions: string[]) {
  const answerMode = String(question?.answerMode || "").trim();
  const choseOther = selectedOptions.some((option) => isOtherSelection(option));
  if (isNegativeNoneResponse(answerText)) {
    return false;
  }
  if (choseOther && answerText.length < 8) {
    return true;
  }
  if ((answerMode === "single_select" || answerMode === "multi_select") && selectedOptions.length === 0 && answerText.length === 0) {
    return true;
  }
  if (answerMode === "multi_select" && selectedOptions.length === 0 && answerText.length < 8) {
    return true;
  }
  if (answerMode === "hybrid" && selectedOptions.length === 0 && answerText.length < 12) {
    return true;
  }
  if (String(question?.id || "").startsWith("follow_up_") && answerText.length < 12 && selectedOptions.length === 0) {
    return true;
  }
  return false;
}

function normalizeAuthoredFollowUpQuestion(rawQuestion: any, fallbackSemanticSlot: string, sourceQuestion: any, index: number) {
  if (!rawQuestion || typeof rawQuestion !== "object") return null;
  const title = String(rawQuestion?.title || sourceQuestion?.title || "Follow-up").trim();
  const prompt = String(rawQuestion?.prompt || "").trim();
  if (!title || !prompt) return null;
  const semanticSlot = normalizeNullableString(rawQuestion?.semanticSlot)
    || fallbackSemanticSlot
    || resolveSemanticQuestionId(sourceQuestion);
  return {
    ...rawQuestion,
    id: String(rawQuestion?.id || `follow_up_${resolveSemanticQuestionId(sourceQuestion)}_${index + 1}`).trim(),
    semanticSlot,
    title,
    prompt,
    answerMode: ["hybrid", "single_select", "multi_select"].includes(String(rawQuestion?.answerMode || "").trim().toLowerCase())
      ? String(rawQuestion.answerMode).trim().toLowerCase()
      : "hybrid",
    options: Array.isArray(rawQuestion?.options)
      ? uniqueStrings(rawQuestion.options.map((entry: unknown) => String(entry || "").trim()))
      : Array.isArray(sourceQuestion?.options)
        ? uniqueStrings(sourceQuestion.options.map((entry: unknown) => String(entry || "").trim()))
        : [],
    status: "pending",
    askedAt: new Date().toISOString(),
    sourceQuestionId: normalizeNullableString(rawQuestion?.sourceQuestionId)
      || normalizeNullableString(sourceQuestion?.id)
      || null,
  };
}

function resolveAuthoredFollowUpQuestion(question: any, answerText: string, selectedOptions: string[]) {
  const rawFollowUps = Array.isArray(question?.followUps)
    ? question.followUps
    : question?.followUp
      ? [question.followUp]
      : [];
  if (rawFollowUps.length === 0) {
    return null;
  }

  const normalizedAnswerText = String(answerText || "").trim();
  const normalizedSelections = uniqueStrings(selectedOptions.map((entry) => String(entry || "").trim()));
  const selectedLower = normalizedSelections.map((entry) => entry.toLowerCase());
  const choseOther = normalizedSelections.some((option) => isOtherSelection(option));

  for (let index = 0; index < rawFollowUps.length; index += 1) {
    const rawFollowUp = rawFollowUps[index];
    const minAnswerLength = normalizeNumber(rawFollowUp?.minAnswerLength, null);
    const triggerOnEmpty = rawFollowUp?.triggerOnEmpty === true;
    const triggerOnOtherWithoutText = rawFollowUp?.triggerOnOtherWithoutText !== false;
    const requireTextWhenOptionsSelected = normalizeStringArray(rawFollowUp?.requireTextWhenOptionsSelected).map((entry) => entry.toLowerCase());
    const whenSelectedOptionsAny = normalizeStringArray(rawFollowUp?.whenSelectedOptionsAny).map((entry) => entry.toLowerCase());
    const whenSelectedOptionsAll = normalizeStringArray(rawFollowUp?.whenSelectedOptionsAll).map((entry) => entry.toLowerCase());
    const triggeredByEmpty = triggerOnEmpty && !normalizedAnswerText && normalizedSelections.length === 0;
    const triggeredByOther = triggerOnOtherWithoutText && choseOther && normalizedAnswerText.length < 8;
    const triggeredByLength = minAnswerLength != null && normalizedAnswerText.length > 0 && normalizedAnswerText.length < minAnswerLength;
    const triggeredBySelectedAny = whenSelectedOptionsAny.length > 0 && whenSelectedOptionsAny.some((entry) => selectedLower.includes(entry));
    const triggeredBySelectedAll = whenSelectedOptionsAll.length > 0 && whenSelectedOptionsAll.every((entry) => selectedLower.includes(entry));
    const triggeredByRequiredText = requireTextWhenOptionsSelected.length > 0
      && requireTextWhenOptionsSelected.some((entry) => selectedLower.includes(entry))
      && normalizedAnswerText.length < 8;
    const hasExplicitTriggers = triggerOnEmpty || minAnswerLength != null || requireTextWhenOptionsSelected.length > 0 || whenSelectedOptionsAny.length > 0 || whenSelectedOptionsAll.length > 0 || rawFollowUp?.triggerOnOtherWithoutText != null;
    const shouldTrigger = triggeredByEmpty
      || triggeredByOther
      || triggeredByLength
      || triggeredBySelectedAny
      || triggeredBySelectedAll
      || triggeredByRequiredText
      || (!hasExplicitTriggers && inferAnswerNeedsFollowUp(question, normalizedAnswerText, normalizedSelections));

    if (!shouldTrigger) {
      continue;
    }

    return normalizeAuthoredFollowUpQuestion(rawFollowUp, resolveSemanticQuestionId(question), question, index);
  }

  return null;
}

function buildAgentQuestionTurn(question: any) {
  return {
    actor: "agent",
    kind: "question",
    questionId: String(question?.id || "").trim() || null,
    semanticSlot: resolveSemanticQuestionId(question),
    title: String(question?.title || "").trim() || null,
    prompt: String(question?.prompt || "").trim() || null,
    options: Array.isArray(question?.options) ? question.options : [],
    askedAt: new Date().toISOString(),
  };
}

function buildAgentGuidanceTurn(input: {
  decision: any;
  understanding?: string | null;
  prompt?: string | null;
}) {
  return {
    actor: "agent",
    kind: "guidance",
    decision: input.decision || null,
    understanding: normalizeNullableString(input.understanding),
    prompt: normalizeNullableString(input.prompt),
    recordedAt: new Date().toISOString(),
  };
}

function getLatestAgentGuidance(transcript: any) {
  const turns = Array.isArray(transcript?.turns) ? transcript.turns : [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.actor === "agent" && turn?.kind === "guidance") {
      return turn;
    }
  }
  return null;
}

function ensureQuestionAsked(transcript: any, question: any) {
  const questionId = String(question?.id || "").trim();
  if (!questionId) {
    return { transcript, changed: false };
  }
  const turns = Array.isArray(transcript?.turns) ? transcript.turns : [];
  const alreadyAsked = turns.some((turn) => turn?.actor === "agent" && turn?.kind === "question" && String(turn?.questionId || "").trim() === questionId);
  if (alreadyAsked) {
    return { transcript: { ...transcript, turns }, changed: false };
  }
  return {
    changed: true,
    transcript: {
      ...transcript,
      turns: [...turns, buildAgentQuestionTurn(question)],
      activeQuestionId: questionId,
      updatedAt: new Date().toISOString(),
    },
  };
}

function ensureQuestionEntry(contract: any, question: any) {
  const existingMap = buildQuestionMap(contract);
  const questionId = String(question?.id || "").trim();
  if (!questionId || existingMap.has(questionId)) {
    return contract;
  }
  return {
    ...contract,
    openQuestions: [
      ...(Array.isArray(contract?.openQuestions) ? contract.openQuestions : []),
      {
        ...question,
        id: questionId,
        semanticSlot: resolveSemanticQuestionId(question, questionId),
        status: "pending",
        answerText: null,
        selectedOptions: [],
        answeredAt: null,
      },
    ],
  };
}

function updateClarifiedIntent(contract: any, questionId: string, answerText: string, selectedOptions: string[], session: any) {
  const clarifiedIntent = {
    ...(contract?.clarifiedIntent && typeof contract.clarifiedIntent === "object" ? contract.clarifiedIntent : {}),
    targetUsers: normalizeStringArray(contract?.clarifiedIntent?.targetUsers),
    mustHaveFlows: normalizeStringArray(contract?.clarifiedIntent?.mustHaveFlows),
    scopeIn: normalizeStringArray(contract?.clarifiedIntent?.scopeIn),
    scopeOut: normalizeStringArray(contract?.clarifiedIntent?.scopeOut),
    protectedAreas: normalizeStringArray(contract?.clarifiedIntent?.protectedAreas),
    deploymentExpectations: normalizeStringArray(contract?.clarifiedIntent?.deploymentExpectations),
    successCriteria: normalizeStringArray(contract?.clarifiedIntent?.successCriteria),
  };
  const semanticSelections = prunePlaceholderSelections(selectedOptions, answerText);
  const primarySelection = semanticSelections[0] || null;
  const mergedValues = uniqueStrings([...semanticSelections, ...(answerText ? [answerText] : [])]);

  switch (questionId) {
    case "product_goal":
      clarifiedIntent.productType = primarySelection || answerText || clarifiedIntent.productType || session?.objective?.summary || null;
      clarifiedIntent.scopeIn = uniqueStrings([...clarifiedIntent.scopeIn, ...mergedValues]);
      break;
    case "target_users":
      clarifiedIntent.targetUsers = uniqueStrings([...clarifiedIntent.targetUsers, ...mergedValues]);
      break;
    case "must_have_flows":
      clarifiedIntent.mustHaveFlows = uniqueStrings([...clarifiedIntent.mustHaveFlows, ...mergedValues]);
      clarifiedIntent.scopeIn = uniqueStrings([...clarifiedIntent.scopeIn, ...mergedValues]);
      break;
    case "quality_bar":
      clarifiedIntent.preferredQualityBar = primarySelection || answerText || clarifiedIntent.preferredQualityBar || null;
      if (clarifiedIntent.preferredQualityBar) {
        clarifiedIntent.successCriteria = uniqueStrings([
          ...clarifiedIntent.successCriteria,
          `Optimize for ${clarifiedIntent.preferredQualityBar}`,
        ]);
      }
      break;
    case "repo_purpose_confirmation":
      clarifiedIntent.productType = primarySelection || answerText || clarifiedIntent.productType || null;
      break;
    case "requested_change":
      clarifiedIntent.scopeIn = uniqueStrings([...clarifiedIntent.scopeIn, ...mergedValues]);
      break;
    case "protected_areas":
      clarifiedIntent.protectedAreas = isNegativeNoneResponse(answerText)
        ? []
        : uniqueStrings([...clarifiedIntent.protectedAreas, ...mergedValues]);
      break;
    case "success_signal":
      clarifiedIntent.successCriteria = uniqueStrings([...clarifiedIntent.successCriteria, ...mergedValues]);
      break;
    case MODE_APPROVAL_SEMANTIC_SLOT:
      break;
    default:
      if (questionId.startsWith("follow_up_product_goal")) {
        clarifiedIntent.productType = answerText || clarifiedIntent.productType || session?.objective?.summary || null;
        clarifiedIntent.scopeIn = uniqueStrings([...clarifiedIntent.scopeIn, ...mergedValues]);
      } else if (questionId.startsWith("follow_up_target_users")) {
        clarifiedIntent.targetUsers = uniqueStrings([...clarifiedIntent.targetUsers, ...mergedValues]);
      } else if (questionId.startsWith("follow_up_must_have_flows")) {
        clarifiedIntent.mustHaveFlows = uniqueStrings([...clarifiedIntent.mustHaveFlows, ...mergedValues]);
        clarifiedIntent.scopeIn = uniqueStrings([...clarifiedIntent.scopeIn, ...mergedValues]);
      } else if (questionId.startsWith("follow_up_quality_bar")) {
        clarifiedIntent.preferredQualityBar = answerText || selectedOptions[0] || clarifiedIntent.preferredQualityBar || null;
      } else if (questionId.startsWith("follow_up_requested_change")) {
        clarifiedIntent.scopeIn = uniqueStrings([...clarifiedIntent.scopeIn, ...mergedValues]);
      } else if (questionId.startsWith("follow_up_protected_areas")) {
        clarifiedIntent.protectedAreas = isNegativeNoneResponse(answerText)
          ? []
          : uniqueStrings([...clarifiedIntent.protectedAreas, ...mergedValues]);
      } else if (questionId.startsWith("follow_up_success_signal")) {
        clarifiedIntent.successCriteria = uniqueStrings([...clarifiedIntent.successCriteria, ...mergedValues]);
      }
      break;
  }

  return clarifiedIntent;
}

function buildModeApprovalQuestion(contract: any, decision: any) {
  const questionIndex = countQuestionsByPrefix(contract, "mode_approval_") + 1;
  const proposedMode = getTemporaryDefaultDeliveryMode();
  const understanding = normalizeNullableString(decision?.understanding);
  const rationale = normalizeNullableString(decision?.rationale);
  const promptParts = [];
  if (understanding) {
    promptParts.push(`Here is my current understanding: ${understanding}`);
  }
  promptParts.push(`I recommend opening in ${proposedMode} mode.`);
  if (rationale) {
    promptParts.push(`Reason: ${rationale}`);
  }
  promptParts.push("Approve this mode and continue, or tell me not yet so I can ask one more targeted question.");
  return {
    id: `mode_approval_${questionIndex}`,
    semanticSlot: MODE_APPROVAL_SEMANTIC_SLOT,
    title: "Mode confirmation",
    prompt: promptParts.join(" "),
    answerMode: "single_select",
    options: [
      `Approve ${proposedMode} and continue`,
      "Not yet, ask one more question",
    ],
    status: "pending",
    askedAt: new Date().toISOString(),
    sourceQuestionId: MODE_APPROVAL_SEMANTIC_SLOT,
  };
}

function isAffirmativeModeApproval(answerText: string, selectedOptions: string[]) {
  const values = [answerText, ...selectedOptions]
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);
  return values.some((entry) => /^(approve|yes|continue|ok|tamam|onay)/i.test(entry));
}

function isRejectedModeApproval(answerText: string, selectedOptions: string[]) {
  const values = [answerText, ...selectedOptions]
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);
  return values.some((entry) => /(not yet|ask one more|more question|hayir|hayır|no|reject|not now)/i.test(entry));
}

function normalizeTurnQuestion(rawQuestion: any, fallbackSemanticSlot = "requested_change") {
  if (!rawQuestion || typeof rawQuestion !== "object") return null;
  const id = String(rawQuestion?.id || "").trim();
  const title = String(rawQuestion?.title || "").trim();
  const prompt = String(rawQuestion?.prompt || "").trim();
  if (!id || !title || !prompt) return null;
  const answerMode = String(rawQuestion?.answerMode || "hybrid").trim().toLowerCase();
  const normalizedAnswerMode = ["hybrid", "single_select", "multi_select"].includes(answerMode)
    ? answerMode
    : "hybrid";
  return {
    id,
    semanticSlot: normalizeNullableString(rawQuestion?.semanticSlot) || fallbackSemanticSlot,
    title,
    prompt,
    answerMode: normalizedAnswerMode,
    options: Array.isArray(rawQuestion?.options)
      ? uniqueStrings(rawQuestion.options.map((entry: unknown) => String(entry || "").trim()))
      : [],
    status: "pending",
    askedAt: new Date().toISOString(),
    sourceQuestionId: normalizeNullableString(rawQuestion?.sourceQuestionId) || null,
  };
}

function normalizeClarificationTurnDecision(rawDecision: any, selectedAgentSlug: string | null) {
  if (!rawDecision || typeof rawDecision !== "object") return null;
  const rawOutcome = String(rawDecision?.outcome || rawDecision?.action || rawDecision?.status || "").trim().toLowerCase();
  const outcome = rawOutcome === "ready" || rawOutcome === "ready_for_confirmation"
    ? "ready_to_confirm"
    : rawOutcome;
  if (!["ask_more", "ready_to_confirm"].includes(outcome)) {
    return null;
  }

  const proposedMode = String(rawDecision?.proposedMode || rawDecision?.recommendation || rawDecision?.mode || "").trim().toLowerCase();
  const normalizedMode = proposedMode === "direct_active"
    ? "active"
    : proposedMode === "shadow_required"
      ? "shadow"
      : proposedMode;
  const nextQuestion = normalizeTurnQuestion(
    rawDecision?.nextQuestion,
    normalizeNullableString(rawDecision?.nextQuestion?.semanticSlot) || "requested_change",
  );

  if (outcome === "ask_more" && !nextQuestion) {
    return null;
  }
  if (outcome === "ready_to_confirm" && !["active", "shadow"].includes(normalizedMode)) {
    return null;
  }

  return {
    source: normalizeNullableString(rawDecision?.source) || selectedAgentSlug || "clarification_agent",
    outcome,
    understanding: normalizeNullableString(rawDecision?.understanding) || normalizeNullableString(rawDecision?.summary),
    rationale: normalizeNullableString(rawDecision?.rationale) || normalizeNullableString(rawDecision?.reason),
    confidence: normalizeNullableString(rawDecision?.confidence),
    proposedMode: outcome === "ready_to_confirm" ? normalizedMode : null,
    nextQuestion,
    decidedAt: new Date().toISOString(),
  };
}

function resolveMockClarificationTurnDecision(mockText: string | null, questionId: string) {
  if (!mockText) return null;
  try {
    const parsed = JSON.parse(mockText);
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.decisions)) {
        const matched = parsed.decisions.find((entry: any) => String(entry?.questionId || "").trim() === questionId)
          || parsed.decisions.find((entry: any) => String(entry?.questionId || "").trim() === "*");
        return matched?.decision || matched || null;
      }
      if (parsed.byQuestionId && typeof parsed.byQuestionId === "object") {
        return parsed.byQuestionId[questionId] || parsed.byQuestionId["*"] || null;
      }
      if (parsed.decision) {
        return parsed.decision;
      }
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function computeMissingIntentFields(contract: any, session: any) {
  const openQuestions = Array.isArray(contract?.openQuestions) ? contract.openQuestions : [];
  const requiredSemanticSlots = uniqueStrings(normalizeStringArray(contract?.requiredSemanticSlots));
  if (requiredSemanticSlots.length > 0) {
    const answeredRequiredSlots = new Set(
      openQuestions
        .filter((question) => questionRequiresAnswer(question) && getQuestionStatus(question) === "answered")
        .map((question) => resolveSemanticQuestionId(question))
        .filter(Boolean),
    );
    return requiredSemanticSlots.filter((slot) => !answeredRequiredSlots.has(slot));
  }

  const clarifiedIntent = contract?.clarifiedIntent || {};
  const repoState = String(contract?.repoState || session?.repoProfile?.repoState || "unknown").trim();
  const missing: string[] = [];

  const productType = normalizeNullableString(clarifiedIntent.productType);
  const targetUsers = normalizeStringArray(clarifiedIntent.targetUsers);
  const mustHaveFlows = normalizeStringArray(clarifiedIntent.mustHaveFlows);
  const scopeIn = normalizeStringArray(clarifiedIntent.scopeIn);
  const protectedAreas = normalizeStringArray(clarifiedIntent.protectedAreas);
  const successCriteria = normalizeStringArray(clarifiedIntent.successCriteria);
  const preferredQualityBar = normalizeNullableString(clarifiedIntent.preferredQualityBar);
  const protectedAreasAnswered = (Array.isArray(contract?.openQuestions) ? contract.openQuestions : [])
    .some((question: any) => resolveSemanticQuestionId(question) === "protected_areas" && getQuestionStatus(question) === "answered");

  if (!productType && !normalizeNullableString(session?.objective?.summary)) missing.push("product_type");
  if (targetUsers.length === 0) missing.push("target_users");
  if (repoState === "empty") {
    if (mustHaveFlows.length === 0) missing.push("must_have_flows");
    if (!preferredQualityBar && successCriteria.length === 0) missing.push("quality_bar_or_success_criteria");
  } else {
    if (scopeIn.length === 0) missing.push("requested_change");
    if (protectedAreas.length === 0 && !protectedAreasAnswered) {
      missing.push("protected_areas");
    }
    if (successCriteria.length === 0) missing.push("success_criteria");
  }
  return missing;
}

function buildIntentSummary(contract: any, session: any) {
  const clarifiedIntent = contract?.clarifiedIntent || {};
  const scopeIn = normalizeStringArray(clarifiedIntent.scopeIn);
  const targetUsers = normalizeStringArray(clarifiedIntent.targetUsers);
  const mustHaveFlows = normalizeStringArray(clarifiedIntent.mustHaveFlows);
  const protectedAreas = normalizeStringArray(clarifiedIntent.protectedAreas);
  const successCriteria = normalizeStringArray(clarifiedIntent.successCriteria);
  const productType = normalizeNullableString(clarifiedIntent.productType) || normalizeNullableString(session?.objective?.summary) || "target delivery";
  const repoState = normalizeNullableString(contract?.repoState) || normalizeNullableString(session?.repoProfile?.repoState) || "unknown";

  return [
    `repoState=${repoState}`,
    `goal=${productType}`,
    `users=${targetUsers.join(", ") || "unspecified"}`,
    `scope=${scopeIn.join(", ") || mustHaveFlows.join(", ") || "unspecified"}`,
    `protect=${protectedAreas.join(", ") || "none_specified"}`,
    `success=${successCriteria.join(", ") || "optimize for safe planning handoff"}`,
  ].join(" | ");
}

function buildResolvedIntentPacket(packet: any, transcript: any, contract: any, session: any) {
  const answeredQuestions = (Array.isArray(transcript?.turns) ? transcript.turns : [])
    .filter((turn) => turn?.actor !== "agent" && turn?.kind === "answer")
    .map((turn) => ({
      questionId: String(turn?.questionId || "").trim() || null,
      semanticSlot: String(turn?.semanticSlot || "").trim() || null,
      answerText: normalizeNullableString(turn?.answerText),
      selectedOptions: normalizeStringArray(turn?.selectedOptions),
      answeredAt: normalizeNullableString(turn?.answeredAt),
    }));

  return {
    schemaVersion: 1,
    projectId: session?.projectId || null,
    sessionId: session?.sessionId || null,
    repoState: normalizeNullableString(contract?.repoState) || normalizeNullableString(packet?.repoState) || normalizeNullableString(session?.repoProfile?.repoState),
    selectedAgentSlug: normalizeNullableString(contract?.selectedAgentSlug) || normalizeNullableString(packet?.selectedAgentSlug),
    objectiveSummary: normalizeNullableString(contract?.objectiveSummary) || normalizeNullableString(session?.objective?.summary),
    desiredOutcome: normalizeNullableString(contract?.desiredOutcome) || normalizeNullableString(session?.objective?.desiredOutcome),
    summary: buildIntentSummary(contract, session),
    readyForPlanning: contract?.readyForPlanning === true,
    planningMode: normalizeNullableString(contract?.planningMode),
    clarifiedIntent: contract?.clarifiedIntent || {},
    answeredQuestions,
    requiredSemanticSlots: uniqueStrings(normalizeStringArray(contract?.requiredSemanticSlots)),
    assumptions: normalizeStringArray(contract?.assumptions),
    deliveryModeDecision: contract?.deliveryModeDecision || null,
    authoredPacket: packet || null,
    authoredUnderstanding: contract?.authoredUnderstanding || packet?.understanding || null,
    generatedAt: new Date().toISOString(),
  };
}

function resolveAgentAuthoredDeliveryModeDecision(contract: any) {
  const forcedMode = getTemporaryDefaultDeliveryMode();
  const decision = contract?.deliveryModeDecision;
  if (!decision || typeof decision !== "object") {
    return {
      eligible: forcedMode === "active",
      planningMode: forcedMode,
      recommendedNextStage: TARGET_SESSION_STAGE.ACTIVE,
      reason: "temporary_forced_active_default",
    };
  }

  const rawRecommendation = String(
    decision?.recommendation
    ?? decision?.planningMode
    ?? decision?.recommendedNextStage
    ?? "",
  ).trim().toLowerCase();

  if (!rawRecommendation) return null;

  const normalizedRecommendation = forcedMode;

  return {
    eligible: true,
    planningMode: normalizedRecommendation,
    recommendedNextStage: TARGET_SESSION_STAGE.ACTIVE,
    reason: `temporary_forced_active_default source=${String(decision?.source || contract?.selectedAgentSlug || "agent").trim() || "agent"} original=${rawRecommendation || "none"}`,
  };
}

function normalizeAgentDeliveryModeDecision(rawDecision: any, selectedAgentSlug: string | null) {
  const forcedMode = getTemporaryDefaultDeliveryMode();
  if (!rawDecision || typeof rawDecision !== "object") return null;
  const recommendation = String(
    rawDecision?.recommendation
    ?? rawDecision?.planningMode
    ?? rawDecision?.mode
    ?? rawDecision?.recommendedNextStage
    ?? "",
  ).trim().toLowerCase();
  if (!recommendation) return null;

  const normalizedRecommendation = forcedMode;

  const rationale = normalizeNullableString(rawDecision?.rationale)
    || normalizeNullableString(rawDecision?.reason)
    || normalizeNullableString(rawDecision?.notes);

  return {
    source: normalizeNullableString(rawDecision?.source) || selectedAgentSlug || "clarification_agent",
    recommendation: normalizedRecommendation,
    rationale,
    confidence: normalizeNullableString(rawDecision?.confidence),
    decidedAt: new Date().toISOString(),
  };
}

async function requestClarificationDeliveryModeDecision(config: any, session: any, packet: any, transcript: any, intentContract: any) {
  const selectedAgentSlug = normalizeNullableString(session?.clarification?.selectedAgentSlug)
    || normalizeNullableString(packet?.selectedAgentSlug)
    || normalizeNullableString(intentContract?.selectedAgentSlug);
  if (!selectedAgentSlug) {
    return null;
  }

  const mockedDecision = normalizeNullableString(config?.env?.mockClarificationDeliveryModeDecision);
  if (mockedDecision) {
    return normalizeAgentDeliveryModeDecision({
      recommendation: mockedDecision,
      rationale: normalizeNullableString(config?.env?.mockClarificationDeliveryModeRationale) || `Mock clarification agent selected ${mockedDecision}.`,
      confidence: normalizeNullableString(config?.env?.mockClarificationDeliveryModeConfidence) || "high",
      source: normalizeNullableString(config?.env?.mockClarificationDeliveryModeSource) || selectedAgentSlug,
    }, selectedAgentSlug);
  }

  const command = String(config?.env?.copilotCliCommand || "copilot").trim() || "copilot";
  const model = config?.roleRegistry?.targetOnboarding?.model || "Claude Sonnet 4.6";
  const prompt = `You are BOX's selected target onboarding clarification agent.
You already own this clarification session.

Task:
- Read the repo context, clarified intent, and transcript.
- Decide whether BOX should open in \"active\" or \"shadow\" immediately after clarification.

Rules:
- Use the actual user request complexity and operational risk.
- Do not use generic scoring language.
- Output strict JSON only inside markers.

Context:
${JSON.stringify({
    projectId: session?.projectId || null,
    sessionId: session?.sessionId || null,
    repoState: intentContract?.repoState || packet?.repoState || session?.repoProfile?.repoState || null,
    repoProfile: session?.repoProfile || null,
    clarificationPacket: packet || null,
    clarifiedIntent: intentContract?.clarifiedIntent || {},
    summary: intentContract?.summary || null,
    transcriptTurns: Array.isArray(transcript?.turns) ? transcript.turns : [],
  }, null, 2)}

===DECISION===
{
  "decision": {
    "recommendation": "active|shadow",
    "rationale": "string",
    "confidence": "high|medium|low"
  }
}
===END===`;

  const args = buildAgentArgs({
    agentSlug: agentFileExists(selectedAgentSlug) ? selectedAgentSlug : undefined,
    prompt,
    model,
    allowAll: false,
    noAskUser: true,
    autopilot: false,
    silent: true,
  });
  appendAgentLiveLog(config, {
    agentSlug: selectedAgentSlug,
    session,
    contextLabel: "clarification_delivery_mode",
    status: "starting",
    message: `repoState=${String(intentContract?.repoState || packet?.repoState || session?.repoProfile?.repoState || "unknown")}`,
  });
  appendAgentLiveLogDetail(config, {
    agentSlug: selectedAgentSlug,
    session,
    contextLabel: "clarification_delivery_mode",
    stage: "prompt",
    title: "Prompt",
    content: prompt,
  });
  const result: any = await spawnAsync(command, args, {
    env: { ...process.env, ...(config?.env || {}) },
    timeoutMs: 120000,
  });
  const stdout = String(result?.stdout || "");
  const stderr = String(result?.stderr || "");
  appendAgentLiveLog(config, {
    agentSlug: selectedAgentSlug,
    session,
    contextLabel: "clarification_delivery_mode",
    status: Number(result?.status ?? 1) === 0 ? "completed" : "failed",
    message: `repoState=${String(intentContract?.repoState || packet?.repoState || session?.repoProfile?.repoState || "unknown")} stdout=${stdout.trim() ? "present" : "empty"} stderr=${stderr.trim() ? "present" : "empty"}`,
  });
  appendAgentLiveLogDetail(config, {
    agentSlug: selectedAgentSlug,
    session,
    contextLabel: "clarification_delivery_mode",
    stage: "result",
    title: "Raw Output",
    content: [
      `STATUS: ${String(result?.status ?? "unknown")}`,
      "",
      "STDOUT:",
      stdout,
      "",
      "STDERR:",
      stderr,
    ].join("\n"),
  });
  writeAgentDebugFile(config, {
    agentSlug: selectedAgentSlug,
    prompt,
    result,
    session,
    contextLabel: "clarification_delivery_mode",
    metadata: {
      repoState: intentContract?.repoState || packet?.repoState || session?.repoProfile?.repoState || null,
    },
  });
  if (Number(result?.status ?? 1) !== 0 || (!stdout.trim() && !stderr.trim())) {
    await appendProgress(
      config,
      `[CLARIFICATION][WARN] delivery mode agent failed agent=${selectedAgentSlug} status=${String(result?.status ?? "unknown")} error=${String(stderr || stdout || result?.error || "empty_output").slice(0, 160)}`,
      { projectId: session?.projectId, sessionId: session?.sessionId },
    );
    return null;
  }

  const parsed = parseAgentOutput(stdout || stderr);
  appendAgentLiveLog(config, {
    agentSlug: selectedAgentSlug,
    session,
    contextLabel: "clarification_delivery_mode",
    status: parsed?.ok ? "parsed" : "unparsed",
    message: [
      parsed?.thinking ? `thinking=${String(parsed.thinking).replace(/\s+/g, " ").slice(0, 400)}` : "thinking=none",
      `recommendation=${String(parsed?.parsed?.decision?.recommendation || "none")}`,
      `confidence=${String(parsed?.parsed?.decision?.confidence || "none")}`,
    ].join(" | "),
  });
  appendAgentLiveLogDetail(config, {
    agentSlug: selectedAgentSlug,
    session,
    contextLabel: "clarification_delivery_mode",
    stage: "parsed",
    title: "Parsed Decision",
    content: JSON.stringify(parsed, null, 2),
  });
  writeAgentDebugFile(config, {
    agentSlug: selectedAgentSlug,
    prompt,
    result,
    parsed,
    session,
    contextLabel: "clarification_delivery_mode",
    metadata: {
      repoState: intentContract?.repoState || packet?.repoState || session?.repoProfile?.repoState || null,
    },
  });
  const normalizedDecision = normalizeAgentDeliveryModeDecision(parsed?.parsed?.decision, selectedAgentSlug);
  if (!normalizedDecision) {
    await appendProgress(
      config,
      `[CLARIFICATION][WARN] delivery mode agent returned no valid decision agent=${selectedAgentSlug}`,
      { projectId: session?.projectId, sessionId: session?.sessionId },
    );
    return null;
  }

  return normalizedDecision;
}

async function requestClarificationTurnDecision(config: any, session: any, packet: any, transcript: any, intentContract: any, input: {
  answeredQuestion: any;
  answerText: string;
  selectedOptions: string[];
}) {
  const selectedAgentSlug = normalizeNullableString(session?.clarification?.selectedAgentSlug)
    || normalizeNullableString(packet?.selectedAgentSlug)
    || normalizeNullableString(intentContract?.selectedAgentSlug);
  if (!selectedAgentSlug) {
    return null;
  }

  const answeredQuestionId = String(input?.answeredQuestion?.id || "").trim();
  const mockedDecision = normalizeClarificationTurnDecision(
    resolveMockClarificationTurnDecision(normalizeNullableString(config?.env?.mockClarificationTurnDecisions), answeredQuestionId),
    selectedAgentSlug,
  );
  if (mockedDecision) {
    return mockedDecision;
  }

  const command = String(config?.env?.copilotCliCommand || "").trim();
  if (!command) {
    return null;
  }

  const model = config?.roleRegistry?.targetOnboarding?.model || "Claude Sonnet 4.6";
  const prompt = `You are BOX's selected onboarding clarification agent.
You are conducting one guided onboarding conversation for a single target session.

Task:
- Read the current repo context, clarified intent, transcript, and the user's latest answer.
- Decide whether you need exactly one more question or whether intent is now clear enough to ask for final approval on mode selection.
- Do not ask multiple questions at once.
- Stop asking questions as soon as the user's intent is clear enough for planning.
- If intent is clear, propose either "shadow" or "active" and provide a concise rationale.

Rules:
- Keep the next question highly targeted and dependent on the latest answer.
- Do not restart the conversation.
- Do not ask the user to repeat the selected repository identity or repo URL/name.
- Do not re-ask what the repo is unless the user's latest answer conflicts with the observed repo context.
- Prefer product-language over internal jargon.
- If the user just rejected a mode proposal, ask one focused follow-up instead of repeating the same proposal.
- Output strict JSON only inside markers.

Context:
${JSON.stringify({
    projectId: session?.projectId || null,
    sessionId: session?.sessionId || null,
    repoState: intentContract?.repoState || packet?.repoState || session?.repoProfile?.repoState || null,
    objectiveSummary: session?.objective?.summary || null,
    desiredOutcome: session?.objective?.desiredOutcome || null,
    clarifiedIntent: intentContract?.clarifiedIntent || {},
    currentSummary: intentContract?.summary || null,
    lastAgentGuidance: intentContract?.lastAgentGuidance || null,
    answeredQuestion: input?.answeredQuestion || null,
    latestAnswer: {
      answerText: input?.answerText || null,
      selectedOptions: input?.selectedOptions || [],
    },
    transcriptTurns: Array.isArray(transcript?.turns) ? transcript.turns : [],
  }, null, 2)}

===DECISION===
{
  "decision": {
    "outcome": "ask_more|ready_to_confirm",
    "understanding": "string",
    "rationale": "string",
    "confidence": "high|medium|low",
    "proposedMode": "shadow|active",
    "nextQuestion": {
      "id": "machine_readable_id",
      "semanticSlot": "canonical_slot_name",
      "title": "short title",
      "prompt": "single direct question",
      "answerMode": "hybrid|single_select|multi_select",
      "options": ["Option A", "Option B", "Other"]
    }
  }
}
===END===`;

  const args = buildAgentArgs({
    agentSlug: agentFileExists(selectedAgentSlug) ? selectedAgentSlug : undefined,
    prompt,
    model,
    allowAll: false,
    noAskUser: true,
    autopilot: false,
    silent: true,
  });

  try {
    appendAgentLiveLog(config, {
      agentSlug: selectedAgentSlug,
      session,
      contextLabel: "clarification_turn",
      status: "starting",
      message: `answeredQuestion=${answeredQuestionId || "unknown"}`,
    });
    const result: any = await spawnAsync(command, args, {
      env: { ...process.env, ...(config?.env || {}) },
      timeoutMs: 120000,
    });
    const stdout = String(result?.stdout || "");
    const stderr = String(result?.stderr || "");
    const rawOutput = [stdout, stderr].filter(Boolean).join("\n");
    writeAgentDebugFile(config, {
      agentSlug: selectedAgentSlug,
      prompt,
      result,
      session,
      contextLabel: "clarification_turn",
      metadata: {
        answeredQuestionId,
      },
    });
    appendAgentLiveLogDetail(config, {
      agentSlug: selectedAgentSlug,
      session,
      contextLabel: "clarification_turn",
      stage: "result",
      title: `clarification turn [exit=${String(result?.status ?? "unknown")}]`,
      content: rawOutput || "(no output)",
    });
    if (Number(result?.status ?? 1) !== 0 || (!stdout.trim() && !stderr.trim())) {
      return null;
    }
    const parsed = parseAgentOutput(stdout || stderr);
    return normalizeClarificationTurnDecision(parsed?.parsed?.decision, selectedAgentSlug);
  } catch {
    return null;
  }
}

function buildSessionIntent(contract: any, session: any, status: string) {
  const clarifiedIntent = contract?.clarifiedIntent || {};
  const openQuestions = (Array.isArray(contract?.openQuestions) ? contract.openQuestions : [])
    .filter((question) => getQuestionStatus(question) !== "answered")
    .map((question) => String(question?.title || question?.prompt || question?.id || "").trim())
    .filter(Boolean);

  return {
    status,
    summary: buildIntentSummary(contract, session),
    repoState: normalizeNullableString(contract?.repoState) || normalizeNullableString(session?.repoProfile?.repoState) || "unknown",
    planningMode: contract?.planningMode || null,
    productType: normalizeNullableString(clarifiedIntent.productType),
    targetUsers: normalizeStringArray(clarifiedIntent.targetUsers),
    mustHaveFlows: normalizeStringArray(clarifiedIntent.mustHaveFlows),
    scopeIn: normalizeStringArray(clarifiedIntent.scopeIn),
    scopeOut: normalizeStringArray(clarifiedIntent.scopeOut),
    protectedAreas: normalizeStringArray(clarifiedIntent.protectedAreas),
    preferredQualityBar: normalizeNullableString(clarifiedIntent.preferredQualityBar),
    designDirection: normalizeNullableString(clarifiedIntent.designDirection),
    deploymentExpectations: normalizeStringArray(clarifiedIntent.deploymentExpectations),
    successCriteria: normalizeStringArray(clarifiedIntent.successCriteria),
    assumptions: normalizeStringArray(contract?.assumptions),
    openQuestions,
    sourceIntentContractPath: normalizeNullableString(session?.clarification?.intentContractPath),
    updatedAt: new Date().toISOString(),
  };
}

function markQuestionAnswered(contract: any, questionId: string, answerText: string, selectedOptions: string[]) {
  return {
    ...contract,
    openQuestions: (Array.isArray(contract?.openQuestions) ? contract.openQuestions : []).map((question: any) => {
      const currentId = String(question?.id || "").trim();
      if (currentId !== questionId) return question;
      return {
        ...question,
        status: "answered",
        answerText: answerText || null,
        selectedOptions,
        answeredAt: new Date().toISOString(),
      };
    }),
  };
}

function appendFollowUpQuestion(contract: any, question: any, repoState: string) {
  const sourceQuestionId = resolveSemanticQuestionId(question, "follow_up");
  const existingQuestions = Array.isArray(contract?.openQuestions) ? contract.openQuestions : [];
  const followUpIndex = existingQuestions.filter((entry) => String(entry?.id || "").startsWith(`follow_up_${sourceQuestionId}`)).length + 1;
  const followUpQuestion = {
    id: `follow_up_${sourceQuestionId}_${followUpIndex}`,
    semanticSlot: sourceQuestionId,
    title: `Follow-up for ${String(question?.title || sourceQuestionId).trim()}`,
    prompt: buildFollowUpPrompt(sourceQuestionId, repoState),
    answerMode: "hybrid",
    options: Array.isArray(question?.options) ? question.options : [],
    status: "pending",
    askedAt: new Date().toISOString(),
    sourceQuestionId,
  };
  return {
    contract: ensureQuestionEntry(contract, followUpQuestion),
    followUpQuestion,
  };
}

async function loadClarificationArtifacts(session: any) {
  const packet = await readJson(session?.clarification?.packetPath, null);
  const transcript = await readJson(session?.clarification?.transcriptPath, null);
  const intentContract = await readJson(session?.clarification?.intentContractPath, null);
  if (!packet || !transcript || !intentContract) {
    throw new Error("Clarification artifacts are missing for the active target session");
  }
  return { packet, transcript, intentContract };
}

async function persistClarificationArtifacts(session: any, transcript: any, intentContract: any) {
  await Promise.all([
    writeJson(session.clarification.transcriptPath, transcript),
    writeJson(session.clarification.intentContractPath, intentContract),
  ]);
}

function buildClarificationPromptView(session: any, packet: any, transcript: any, intentContract: any, currentQuestion: any) {
  return {
    session,
    packet,
    transcript,
    intentContract,
    currentQuestion,
    latestAgentGuidance: intentContract?.lastAgentGuidance || getLatestAgentGuidance(transcript),
    intentSummary: buildSessionIntent(intentContract, session, intentContract?.readyForPlanning === true ? TARGET_INTENT_STATUS.READY_FOR_PLANNING : TARGET_INTENT_STATUS.CLARIFYING),
  };
}

export async function getTargetClarificationRuntimeState(config: any, options: { persistPrompt?: boolean } = {}) {
  const session = await loadActiveTargetSession(config);
  if (!session) {
    throw new Error("No active target session loaded");
  }
  if (session.currentStage !== TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION && session.currentStage !== TARGET_SESSION_STAGE.SHADOW) {
    throw new Error(`Clarification runtime is only available during clarification/shadow stages (current=${session.currentStage})`);
  }

  const { packet, transcript, intentContract } = await loadClarificationArtifacts(session);
  const currentQuestion = getCurrentPendingQuestion(intentContract);
  if (!currentQuestion || options.persistPrompt === false) {
    return buildClarificationPromptView(session, packet, transcript, intentContract, currentQuestion);
  }

  const promptPersist = ensureQuestionAsked(transcript, currentQuestion);
  if (promptPersist.changed) {
    await writeJson(session.clarification.transcriptPath, promptPersist.transcript);
  }
  return buildClarificationPromptView(session, packet, promptPersist.transcript, intentContract, currentQuestion);
}

export async function submitTargetClarificationAnswer(config: any, input: {
  answerText?: string | null;
  selectedOptions?: string[] | string | null;
  questionId?: string | null;
  answeredBy?: string | null;
}) {
  const runtime = await getTargetClarificationRuntimeState(config, { persistPrompt: true });
  const session = runtime.session;
  let transcript = runtime.transcript;
  let intentContract = runtime.intentContract;
  const answerText = String(input?.answerText || "").trim();
  const selectedOptions = normalizeSelectedOptions(input?.selectedOptions);
  const questionId = String(input?.questionId || runtime.currentQuestion?.id || "").trim();
  const answeredBy = normalizeNullableString(input?.answeredBy) || "user";

  if (!questionId) {
    throw new Error("No pending clarification question is available to answer");
  }
  if (!answerText && selectedOptions.length === 0) {
    throw new Error("Clarification answer requires text or selected options");
  }

  const questionMap = buildQuestionMap(intentContract);
  const targetQuestion = questionMap.get(questionId);
  if (!targetQuestion) {
    throw new Error(`Unknown clarification question: ${questionId}`);
  }
  if (getQuestionStatus(targetQuestion) === "answered") {
    throw new Error(`Clarification question already answered: ${questionId}`);
  }

  const semanticQuestionId = resolveSemanticQuestionId(targetQuestion, questionId);

  transcript = {
    ...transcript,
    turns: [
      ...(Array.isArray(transcript?.turns) ? transcript.turns : []),
      {
        actor: answeredBy,
        kind: "answer",
        questionId,
        semanticSlot: semanticQuestionId,
        answerText: answerText || null,
        selectedOptions,
        answeredAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  intentContract = markQuestionAnswered(intentContract, questionId, answerText, selectedOptions);
  intentContract = {
    ...intentContract,
    clarifiedIntent: updateClarifiedIntent(intentContract, semanticQuestionId, answerText, selectedOptions, session),
    updatedAt: new Date().toISOString(),
  };

  let nextQuestion = null;
  let followUpQuestion = null;
  let missingFields: string[] = [];
  let readyForPlanning = false;
  let agentDeliveryModeDecision = null;

  if (semanticQuestionId === MODE_APPROVAL_SEMANTIC_SLOT && isAffirmativeModeApproval(answerText, selectedOptions)) {
    readyForPlanning = true;
  } else {
    if (semanticQuestionId === MODE_APPROVAL_SEMANTIC_SLOT && isRejectedModeApproval(answerText, selectedOptions)) {
      intentContract = {
        ...intentContract,
        deliveryModeDecision: null,
        updatedAt: new Date().toISOString(),
      };
    }

    // Target onboarding is single-call by design: the agent generates one intake packet,
    // then runtime progresses deterministically from the user's answers.
    const agentTurnDecision = null;

    if (agentTurnDecision) {
      transcript = {
        ...transcript,
        turns: [
          ...(Array.isArray(transcript?.turns) ? transcript.turns : []),
          buildAgentGuidanceTurn({
            decision: agentTurnDecision,
            understanding: agentTurnDecision.understanding,
            prompt: agentTurnDecision.outcome === "ask_more"
              ? agentTurnDecision.nextQuestion?.prompt || null
              : agentTurnDecision.rationale || null,
          }),
        ],
        updatedAt: new Date().toISOString(),
      };
      intentContract = {
        ...intentContract,
        lastAgentGuidance: agentTurnDecision,
        updatedAt: new Date().toISOString(),
      };

      if (agentTurnDecision.outcome === "ask_more" && agentTurnDecision.nextQuestion) {
        intentContract = ensureQuestionEntry(intentContract, agentTurnDecision.nextQuestion);
        nextQuestion = getCurrentPendingQuestion(intentContract);
      } else if (agentTurnDecision.outcome === "ready_to_confirm" && agentTurnDecision.proposedMode) {
        agentDeliveryModeDecision = normalizeAgentDeliveryModeDecision({
          recommendation: agentTurnDecision.proposedMode,
          rationale: agentTurnDecision.rationale,
          confidence: agentTurnDecision.confidence,
          source: agentTurnDecision.source,
        }, session?.clarification?.selectedAgentSlug || runtime.packet?.selectedAgentSlug || null);
        if (agentDeliveryModeDecision) {
          intentContract = {
            ...intentContract,
            deliveryModeDecision: agentDeliveryModeDecision,
            updatedAt: new Date().toISOString(),
          };
          const approvalQuestion = buildModeApprovalQuestion(intentContract, {
            recommendation: agentDeliveryModeDecision.recommendation,
            understanding: agentTurnDecision.understanding,
            rationale: agentDeliveryModeDecision.rationale,
          });
          intentContract = ensureQuestionEntry(intentContract, approvalQuestion);
          nextQuestion = getCurrentPendingQuestion(intentContract);
        }
      }
    }

    if (!agentTurnDecision || (!nextQuestion && !agentDeliveryModeDecision)) {
      const authoredFollowUp = resolveAuthoredFollowUpQuestion(targetQuestion, answerText, selectedOptions);
      if (authoredFollowUp) {
        intentContract = ensureQuestionEntry(intentContract, authoredFollowUp);
        followUpQuestion = authoredFollowUp;
      } else {
        const needsFollowUp = inferAnswerNeedsFollowUp(targetQuestion, answerText, selectedOptions);
        if (needsFollowUp) {
        const followUpResult = appendFollowUpQuestion(intentContract, targetQuestion, String(session.repoProfile?.repoState || intentContract.repoState || "unknown"));
        intentContract = followUpResult.contract;
        followUpQuestion = followUpResult.followUpQuestion;
        }
      }

      missingFields = computeMissingIntentFields(intentContract, session);
      nextQuestion = followUpQuestion || getCurrentPendingQuestion(intentContract);
      readyForPlanning = !followUpQuestion && missingFields.length === 0 && !nextQuestion;
      agentDeliveryModeDecision = null;
    }
  }

  if (agentDeliveryModeDecision) {
    intentContract = {
      ...intentContract,
      deliveryModeDecision: agentDeliveryModeDecision,
      updatedAt: new Date().toISOString(),
    };
  }
  const deliveryModeDecision = readyForPlanning
    ? resolveAgentAuthoredDeliveryModeDecision(intentContract)
    : null;
  const nextIntentStatus = readyForPlanning ? TARGET_INTENT_STATUS.READY_FOR_PLANNING : TARGET_INTENT_STATUS.CLARIFYING;
  const resolvedPacketContract = {
    ...intentContract,
    status: readyForPlanning ? "ready_for_planning" : "clarifying",
    readyForPlanning,
    planningMode: readyForPlanning ? deliveryModeDecision?.planningMode || getTemporaryDefaultDeliveryMode() : null,
    summary: buildIntentSummary(intentContract, session),
    missingFields,
  };
  intentContract = {
    ...resolvedPacketContract,
    resolvedPacket: buildResolvedIntentPacket(runtime.packet, transcript, resolvedPacketContract, session),
    updatedAt: new Date().toISOString(),
  };

  if (readyForPlanning) {
    transcript = {
      ...transcript,
      status: "ready_for_planning",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else if (nextQuestion) {
    const promptPersist = ensureQuestionAsked(transcript, nextQuestion);
    transcript = promptPersist.transcript;
    transcript.status = "awaiting_user_response";
  }

  const requiredHumanInputs = readyForPlanning
    ? normalizeStringArray(session.handoff?.requiredHumanInputs).filter((entry) => !/clarify the target intent|launch_onboarding/i.test(entry))
    : [String(nextQuestion?.prompt || nextQuestion?.title || `Respond to ${session.clarification?.selectedAgentSlug || "onboarding"}`).trim()];
  const nextStage = readyForPlanning
    ? deliveryModeDecision?.recommendedNextStage || TARGET_SESSION_STAGE.SHADOW
    : TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION;
  const pendingQuestionTitles = (Array.isArray(intentContract?.openQuestions) ? intentContract.openQuestions : [])
    .filter((question: any) => getQuestionStatus(question) !== "answered")
    .map((question: any) => String(question?.title || question?.prompt || question?.id || "").trim())
    .filter(Boolean);

  const updatedSession = {
    ...session,
    currentStage: nextStage,
    onboarding: {
      ...session.onboarding,
      recommendedNextStage: nextStage,
    },
    clarification: {
      ...session.clarification,
      status: readyForPlanning ? "completed" : "pending",
      pendingQuestions: readyForPlanning ? [] : pendingQuestionTitles,
      questionCount: Array.isArray(intentContract?.openQuestions) ? intentContract.openQuestions.length : 0,
      loopCount: Number(session.clarification?.loopCount || 0) + 1,
      readyForPlanning,
      lastAnsweredAt: new Date().toISOString(),
      lastAskedAt: readyForPlanning ? session.clarification?.lastAskedAt || new Date().toISOString() : transcript?.updatedAt || new Date().toISOString(),
      completedAt: readyForPlanning ? new Date().toISOString() : null,
    },
    intent: buildSessionIntent(intentContract, session, nextIntentStatus),
    prerequisites: {
      ...session.prerequisites,
      blockedReason: readyForPlanning ? null : String(nextQuestion?.prompt || nextQuestion?.title || session.prerequisites?.blockedReason || "Waiting for clarification response").trim(),
      awaitingHumanInput: !readyForPlanning,
    },
    gates: readyForPlanning
      ? {
          ...session.gates,
          allowPlanning: true,
          allowShadowExecution: nextStage === TARGET_SESSION_STAGE.SHADOW,
          allowActiveExecution: nextStage === TARGET_SESSION_STAGE.ACTIVE,
          quarantine: false,
          quarantineReason: null,
        }
      : {
          ...session.gates,
          allowPlanning: false,
          allowShadowExecution: false,
          allowActiveExecution: false,
        },
    handoff: {
      ...session.handoff,
      carriedContextSummary: buildIntentSummary(intentContract, session),
      requiredHumanInputs: readyForPlanning ? [] : requiredHumanInputs,
      lastAction: `clarification_answered:${questionId}`,
      nextAction: readyForPlanning
        ? nextStage === TARGET_SESSION_STAGE.ACTIVE
          ? "run_active_planning"
          : "run_shadow_planning"
        : "await_clarification_response",
    },
    lifecycle: {
      ...session.lifecycle,
      updatedAt: new Date().toISOString(),
    },
    warnings: [],
  };

  await persistClarificationArtifacts(updatedSession, transcript, intentContract);
  const persistedSession = await saveActiveTargetSession(config, updatedSession);
  await requestDaemonReload(config, readyForPlanning ? "clarification-completed" : "clarification-updated");
  await appendProgress(
    config,
    readyForPlanning
      ? `[CLARIFICATION] completed session=${persistedSession.sessionId} planningMode=${persistedSession.intent?.planningMode || getTemporaryDefaultDeliveryMode()} nextStage=${persistedSession.currentStage} intentSummary=${persistedSession.intent?.summary || "none"}`
      : `[CLARIFICATION] answered question=${questionId} nextQuestion=${String(nextQuestion?.id || "none")} followUp=${followUpQuestion ? followUpQuestion.id : "none"}`,
    {
      projectId: persistedSession.projectId,
      sessionId: persistedSession.sessionId,
    },
  );

  return {
    session: persistedSession,
    transcript,
    intentContract,
    currentQuestion: nextQuestion,
    readyForPlanning,
  };
}