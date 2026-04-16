import { appendProgress } from "./state_tracker.js";
import { readJson, writeJson } from "./fs_utils.js";
import {
  loadActiveTargetSession,
  saveActiveTargetSession,
  TARGET_INTENT_STATUS,
  TARGET_SESSION_STAGE,
} from "./target_session_state.js";

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

function getCurrentPendingQuestion(contract: any) {
  const openQuestions = Array.isArray(contract?.openQuestions) ? contract.openQuestions : [];
  return openQuestions.find((question) => getQuestionStatus(question) === "pending") || null;
}

function normalizeSelectedOptions(input: unknown) {
  if (Array.isArray(input)) {
    return uniqueStrings(input.map((entry) => String(entry || "").trim()));
  }
  const text = String(input || "").trim();
  if (!text) return [];
  return uniqueStrings(text.split(/[|,]/).map((entry) => entry.trim()));
}

function isNegativeNoneResponse(text: string) {
  return /^(none|no|nothing|n-a|n\/a|yok|gerek yok)$/i.test(text.trim());
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

function buildAgentQuestionTurn(question: any) {
  return {
    actor: "agent",
    kind: "question",
    questionId: String(question?.id || "").trim() || null,
    title: String(question?.title || "").trim() || null,
    prompt: String(question?.prompt || "").trim() || null,
    options: Array.isArray(question?.options) ? question.options : [],
    askedAt: new Date().toISOString(),
  };
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
  const mergedValues = uniqueStrings([...selectedOptions, ...(answerText ? [answerText] : [])]);

  switch (questionId) {
    case "product_goal":
      clarifiedIntent.productType = selectedOptions[0] || answerText || clarifiedIntent.productType || session?.objective?.summary || null;
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
      clarifiedIntent.preferredQualityBar = selectedOptions[0] || answerText || clarifiedIntent.preferredQualityBar || null;
      if (clarifiedIntent.preferredQualityBar) {
        clarifiedIntent.successCriteria = uniqueStrings([
          ...clarifiedIntent.successCriteria,
          `Optimize for ${clarifiedIntent.preferredQualityBar}`,
        ]);
      }
      break;
    case "repo_purpose_confirmation":
      clarifiedIntent.productType = selectedOptions[0] || answerText || clarifiedIntent.productType || null;
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

function computeMissingIntentFields(contract: any, session: any) {
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
    .some((question: any) => String(question?.id || "").trim() === "protected_areas" && getQuestionStatus(question) === "answered");

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
  const sourceQuestionId = String(question?.id || "follow_up").trim() || "follow_up";
  const existingQuestions = Array.isArray(contract?.openQuestions) ? contract.openQuestions : [];
  const followUpIndex = existingQuestions.filter((entry) => String(entry?.id || "").startsWith(`follow_up_${sourceQuestionId}`)).length + 1;
  const followUpQuestion = {
    id: `follow_up_${sourceQuestionId}_${followUpIndex}`,
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

  transcript = {
    ...transcript,
    turns: [
      ...(Array.isArray(transcript?.turns) ? transcript.turns : []),
      {
        actor: answeredBy,
        kind: "answer",
        questionId,
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
    clarifiedIntent: updateClarifiedIntent(intentContract, questionId, answerText, selectedOptions, session),
    updatedAt: new Date().toISOString(),
  };

  const needsFollowUp = inferAnswerNeedsFollowUp(targetQuestion, answerText, selectedOptions);
  let followUpQuestion = null;
  if (needsFollowUp) {
    const followUpResult = appendFollowUpQuestion(intentContract, targetQuestion, String(session.repoProfile?.repoState || intentContract.repoState || "unknown"));
    intentContract = followUpResult.contract;
    followUpQuestion = followUpResult.followUpQuestion;
  }

  const missingFields = computeMissingIntentFields(intentContract, session);
  const nextQuestion = followUpQuestion || getCurrentPendingQuestion(intentContract);
  const readyForPlanning = !followUpQuestion && missingFields.length === 0 && !nextQuestion;
  const nextIntentStatus = readyForPlanning ? TARGET_INTENT_STATUS.READY_FOR_PLANNING : TARGET_INTENT_STATUS.CLARIFYING;
  intentContract = {
    ...intentContract,
    status: readyForPlanning ? "ready_for_planning" : "clarifying",
    readyForPlanning,
    planningMode: readyForPlanning ? "shadow" : null,
    summary: buildIntentSummary(intentContract, session),
    missingFields,
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
  const nextStage = readyForPlanning ? TARGET_SESSION_STAGE.SHADOW : TARGET_SESSION_STAGE.AWAITING_INTENT_CLARIFICATION;
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
      pendingQuestions: (Array.isArray(intentContract?.openQuestions) ? intentContract.openQuestions : [])
        .filter((question: any) => getQuestionStatus(question) !== "answered")
        .map((question: any) => String(question?.title || question?.prompt || question?.id || "").trim())
        .filter(Boolean),
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
          allowShadowExecution: true,
          allowActiveExecution: false,
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
      requiredHumanInputs,
      lastAction: `clarification_answered:${questionId}`,
      nextAction: readyForPlanning ? "run_shadow_planning" : "await_clarification_response",
    },
    lifecycle: {
      ...session.lifecycle,
      updatedAt: new Date().toISOString(),
    },
    warnings: [],
  };

  await persistClarificationArtifacts(updatedSession, transcript, intentContract);
  const persistedSession = await saveActiveTargetSession(config, updatedSession);
  await appendProgress(
    config,
    readyForPlanning
      ? `[CLARIFICATION] completed session=${persistedSession.sessionId} planningMode=shadow intentSummary=${persistedSession.intent?.summary || "none"}`
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