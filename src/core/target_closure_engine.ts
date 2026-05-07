import path from "node:path";
import { readJson } from "./fs_utils.js";
import { getTargetSessionPath } from "./target_session_state.js";

export const TARGET_CLOSURE_DECISION = Object.freeze({
  CLOSE: "close",
  CONTINUE: "continue",
  BLOCKED: "blocked",
});

const DEFAULT_CONTINUE_THRESHOLD = 0.55;

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function scoreAction(action: any): number {
  const impact = Number(action?.impact || 0);
  const feasibility = Number(action?.feasibility || 0);
  const evidenceConfidence = Number(action?.evidenceConfidence || 0);
  const novelty = Number(action?.novelty || 0);
  const contractRelevance = Number(action?.contractRelevance || 0);
  const repetitionPenalty = Number(action?.repetitionPenalty || 0);
  const uncertaintyPenalty = Number(action?.uncertaintyPenalty || 0);
  return clampScore(
    (impact * 0.3)
    + (feasibility * 0.2)
    + (evidenceConfidence * 0.18)
    + (novelty * 0.12)
    + (contractRelevance * 0.2)
    - (repetitionPenalty * 0.12)
    - (uncertaintyPenalty * 0.1),
  );
}

function buildAction(input: {
  id: string;
  reasonCode: string;
  summary: string;
  source: string;
  impact?: number;
  feasibility?: number;
  evidenceConfidence?: number;
  novelty?: number;
  contractRelevance?: number;
  repetitionPenalty?: number;
  uncertaintyPenalty?: number;
  blocked?: boolean;
}) {
  const action = {
    id: input.id,
    reasonCode: input.reasonCode,
    summary: input.summary,
    source: input.source,
    impact: clampScore(input.impact ?? 0.7),
    feasibility: clampScore(input.feasibility ?? 0.7),
    evidenceConfidence: clampScore(input.evidenceConfidence ?? 0.75),
    novelty: clampScore(input.novelty ?? 0.7),
    contractRelevance: clampScore(input.contractRelevance ?? 0.85),
    repetitionPenalty: clampScore(input.repetitionPenalty ?? 0),
    uncertaintyPenalty: clampScore(input.uncertaintyPenalty ?? 0.1),
    blocked: input.blocked === true,
    expectedValue: 0,
  };
  return {
    ...action,
    expectedValue: scoreAction(action),
  };
}

function uniqueActions(actions: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const action of actions) {
    const key = normalizeString(action?.id || action?.reasonCode || action?.summary);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(action);
  }
  return unique.sort((a, b) => Number(b?.expectedValue || 0) - Number(a?.expectedValue || 0));
}

async function readSessionRuntimeJson(config: any, session: any, fileName: string, fallbackValue: any = null): Promise<any> {
  const stateDir = config?.paths?.stateDir || "state";
  const projectId = normalizeString(session?.projectId);
  const sessionId = normalizeString(session?.sessionId);
  if (projectId && sessionId) {
    const sessionPath = path.join(getTargetSessionPath(stateDir, projectId, sessionId), "runtime", fileName);
    const sessionValue = await readJson(sessionPath, null);
    if (sessionValue && typeof sessionValue === "object") return sessionValue;
  }
  return readJson(path.join(stateDir, fileName), fallbackValue);
}

function isDispatchCheckpointIncomplete(checkpoint: any): boolean {
  if (!checkpoint || typeof checkpoint !== "object") return false;
  const status = normalizeLower(checkpoint?.status);
  const totalPlans = Math.max(0, Math.floor(Number(checkpoint?.totalPlans || 0)));
  const completedPlans = Math.max(0, Math.floor(Number(checkpoint?.completedPlans || 0)));
  if (totalPlans <= 0) return false;
  if (status === "complete" && completedPlans >= totalPlans) return false;
  return completedPlans < totalPlans;
}

function collectContractGapActions(report: any): any[] {
  const blockers = Array.isArray(report?.blockers)
    ? report.blockers.map((entry: unknown) => normalizeLower(entry)).filter(Boolean)
    : [];
  const actions: any[] = [];
  if (blockers.includes("delivery_evidence_missing")) {
    actions.push(buildAction({
      id: "produce_delivery_evidence",
      reasonCode: "delivery_evidence_missing",
      summary: "Produce or locate delivery evidence tied to the active session objective.",
      source: "success_contract.blockers",
      impact: 0.95,
      feasibility: 0.8,
      contractRelevance: 1,
    }));
  }
  if (blockers.includes("release_signoff_missing")) {
    actions.push(buildAction({
      id: "run_release_signoff",
      reasonCode: "release_signoff_missing",
      summary: "Run release verification and emit machine-readable sign-off evidence.",
      source: "success_contract.blockers",
      impact: 0.95,
      feasibility: 0.85,
      contractRelevance: 1,
    }));
  }
  if (blockers.includes("intent_alignment_unverified")) {
    actions.push(buildAction({
      id: "verify_intent_alignment",
      reasonCode: "intent_alignment_unverified",
      summary: "Verify or repair alignment between delivered work and the operator intent contract.",
      source: "success_contract.blockers",
      impact: 0.9,
      feasibility: 0.75,
      contractRelevance: 1,
    }));
  }
  if (blockers.includes("project_readiness_unverified")) {
    actions.push(buildAction({
      id: "finalize_project_readiness",
      reasonCode: "project_readiness_unverified",
      summary: "Refresh or finalize project-readiness evidence before closing best-effort delivery.",
      source: "success_contract.blockers",
      impact: 0.82,
      feasibility: 0.7,
      contractRelevance: 0.95,
    }));
  }
  if (blockers.includes("human_input_pending")) {
    actions.push(buildAction({
      id: "request_required_human_input",
      reasonCode: "human_input_pending",
      summary: "Request the required operator input before further autonomous closure.",
      source: "success_contract.blockers",
      impact: 0.7,
      feasibility: 0.25,
      evidenceConfidence: 0.9,
      contractRelevance: 0.85,
      uncertaintyPenalty: 0.3,
      blocked: true,
    }));
  }
  return actions;
}

function collectDimensionGapActions(report: any): any[] {
  const dimensions = report?.dimensions || {};
  const actions: any[] = [];
  if (normalizeLower(dimensions?.researchSaturation?.status) === "missing") {
    const required = dimensions?.projectReadiness?.evidence?.required === true;
    actions.push(buildAction({
      id: required ? "complete_required_research_readiness" : "optional_research_refresh_low_value",
      reasonCode: required ? "required_research_saturation_missing" : "optional_research_saturation_missing",
      summary: required
        ? "Complete required research/readiness saturation before closure."
        : "Optional research saturation is incomplete but not required by this session contract.",
      source: "success_contract.dimensions.researchSaturation",
      impact: required ? 0.78 : 0.25,
      feasibility: 0.65,
      evidenceConfidence: 0.7,
      novelty: required ? 0.65 : 0.35,
      contractRelevance: required ? 0.9 : 0.25,
      repetitionPenalty: required ? 0.1 : 0.35,
      uncertaintyPenalty: required ? 0.15 : 0.2,
    }));
  }
  if (normalizeLower(dimensions?.evidenceAlignment?.status) === "missing") {
    actions.push(buildAction({
      id: "repair_evidence_alignment",
      reasonCode: "evidence_alignment_missing",
      summary: "Repair stale or cross-session evidence before closure.",
      source: "success_contract.dimensions.evidenceAlignment",
      impact: 0.86,
      feasibility: 0.75,
      contractRelevance: 0.92,
    }));
  }
  return actions;
}

function collectImprovementFrontierActions(report: any): any[] {
  // "Best possible until no credible improvement frontier remains" — when a
  // dimension is technically satisfied but proof is shallow, surface a scored
  // next-action so the orchestrator can decide whether the frontier is worth
  // pursuing rather than auto-closing on minimum-viable evidence.
  const dimensions = report?.dimensions || {};
  const actions: any[] = [];
  const delivery = dimensions?.delivery;
  if (normalizeLower(delivery?.status) === "satisfied") {
    const proof = normalizeLower(delivery?.evidence?.proofStrength);
    if (proof === "weak") {
      actions.push(buildAction({
        id: "harden_delivery_runtime_proof",
        reasonCode: "delivery_proof_weak",
        summary: "Delivery passed on textual evidence only; produce concrete artifact, runtime, or merge proof.",
        source: "success_contract.dimensions.delivery.proofStrength",
        impact: 0.88,
        feasibility: 0.7,
        evidenceConfidence: 0.65,
        novelty: 0.7,
        contractRelevance: 0.95,
      }));
    } else if (proof === "moderate") {
      actions.push(buildAction({
        id: "solidify_delivery_with_merge_proof",
        reasonCode: "delivery_proof_moderate",
        summary: "Delivery has a credible signal but no merged-SHA + verification combo; consider strengthening proof.",
        source: "success_contract.dimensions.delivery.proofStrength",
        impact: 0.45,
        feasibility: 0.55,
        evidenceConfidence: 0.55,
        novelty: 0.4,
        contractRelevance: 0.5,
        repetitionPenalty: 0.25,
        uncertaintyPenalty: 0.2,
      }));
    }
  }
  const release = dimensions?.releaseVerification;
  if (normalizeLower(release?.status) === "satisfied") {
    const proof = normalizeLower(release?.evidence?.proofStrength);
    if (proof === "weak") {
      actions.push(buildAction({
        id: "produce_concrete_release_artifacts",
        reasonCode: "release_proof_weak",
        summary: "Release sign-off passed on weak markers; produce concrete verification artifacts.",
        source: "success_contract.dimensions.releaseVerification.proofStrength",
        impact: 0.82,
        feasibility: 0.75,
        contractRelevance: 0.9,
      }));
    } else if (proof === "moderate") {
      actions.push(buildAction({
        id: "harden_release_artifacts",
        reasonCode: "release_proof_moderate",
        summary: "Release verification is moderate; consider running the full local trust gate (test+lint+build).",
        source: "success_contract.dimensions.releaseVerification.proofStrength",
        impact: 0.4,
        feasibility: 0.6,
        evidenceConfidence: 0.55,
        novelty: 0.35,
        contractRelevance: 0.5,
        repetitionPenalty: 0.3,
        uncertaintyPenalty: 0.2,
      }));
    }
  }
  const intentCore = dimensions?.intentCore;
  if (normalizeLower(intentCore?.status) === "satisfied") {
    const matchStrength = normalizeLower(intentCore?.evidence?.matchStrength);
    if (matchStrength === "weak") {
      actions.push(buildAction({
        id: "deepen_intent_alignment_proof",
        reasonCode: "intent_alignment_proof_weak",
        summary: "Intent overlap with the delivered work is shallow; map each acceptance criterion to concrete evidence.",
        source: "success_contract.dimensions.intentCore.matchStrength",
        impact: 0.78,
        feasibility: 0.7,
        evidenceConfidence: 0.6,
        contractRelevance: 0.9,
      }));
    } else if (matchStrength === "moderate") {
      actions.push(buildAction({
        id: "broaden_intent_alignment_proof",
        reasonCode: "intent_alignment_proof_moderate",
        summary: "Intent alignment is partial; consider mapping remaining must-have flows to delivered artifacts.",
        source: "success_contract.dimensions.intentCore.matchStrength",
        impact: 0.4,
        feasibility: 0.6,
        evidenceConfidence: 0.55,
        contractRelevance: 0.5,
        repetitionPenalty: 0.3,
        uncertaintyPenalty: 0.2,
      }));
    }
  }
  // Runtime / presentation frontier: when the delivery handoff is reduced to a
  // textual fallback with no openable artifact, the user has no credible way to
  // experience the product — that is itself an improvement frontier.
  const deliveryHandoff = report?.delivery;
  if (deliveryHandoff && typeof deliveryHandoff === "object") {
    const resolutionSource = normalizeLower(deliveryHandoff?.resolutionSource);
    const hasOpenTarget = Boolean(normalizeString(deliveryHandoff?.openTarget))
      || Boolean(normalizeString(deliveryHandoff?.primaryLocation));
    const fallbackOnly = resolutionSource.startsWith("fallback_evidence_only");
    if (fallbackOnly && !hasOpenTarget && normalizeLower(delivery?.status) === "satisfied") {
      actions.push(buildAction({
        id: "produce_runtime_or_artifact_proof_for_user",
        reasonCode: "runtime_surface_missing",
        summary: "Delivery is fulfilled on paper but there is no openable runtime/artifact for the operator to verify.",
        source: "success_contract.delivery.resolutionSource",
        impact: 0.85,
        feasibility: 0.6,
        evidenceConfidence: 0.65,
        novelty: 0.6,
        contractRelevance: 0.9,
      }));
    }
  }
  // Project readiness frontier: when readiness is marked not_applicable but the
  // session carries blocking acceptance criteria, surface a low-priority action
  // suggesting we promote readiness evaluation. Required-but-missing is already
  // emitted as a blocker by collectContractGapActions.
  const readiness = dimensions?.projectReadiness;
  if (normalizeLower(readiness?.status) === "not_applicable") {
    const blockingCriteria = Array.isArray(intentCore?.evidence?.blockingAcceptanceCriteria)
      ? intentCore.evidence.blockingAcceptanceCriteria
      : [];
    if (blockingCriteria.length > 0) {
      actions.push(buildAction({
        id: "promote_project_readiness_evaluation",
        reasonCode: "project_readiness_frontier",
        summary: "Session has blocking acceptance criteria but readiness is not_applicable; consider promoting readiness gating.",
        source: "success_contract.dimensions.projectReadiness",
        impact: 0.35,
        feasibility: 0.5,
        evidenceConfidence: 0.5,
        novelty: 0.3,
        contractRelevance: 0.45,
        repetitionPenalty: 0.35,
        uncertaintyPenalty: 0.25,
      }));
    }
  }
  return actions;
}

function hasPendingHumanInputs(report: any): boolean {
  return Array.isArray(report?.pendingHumanInputs) && report.pendingHumanInputs.length > 0;
}

function isContractTerminal(report: any): boolean {
  const status = normalizeLower(report?.status);
  return status === "fulfilled" || status === "fulfilled_with_handoff";
}

export async function evaluateTargetClosure(config: any, session: any, report: any): Promise<any> {
  const evaluatedAt = new Date().toISOString();
  const threshold = Number.isFinite(Number(config?.runtime?.targetClosure?.continueThreshold))
    ? Math.max(0.1, Math.min(0.95, Number(config.runtime.targetClosure.continueThreshold)))
    : DEFAULT_CONTINUE_THRESHOLD;
  const actions = [
    ...collectContractGapActions(report),
    ...collectDimensionGapActions(report),
    ...collectImprovementFrontierActions(report),
  ];

  const checkpoint = await readSessionRuntimeJson(config, session, "dispatch_checkpoint.json", null);
  if (isDispatchCheckpointIncomplete(checkpoint)) {
    const totalPlans = Math.max(0, Math.floor(Number(checkpoint?.totalPlans || 0)));
    const completedPlans = Math.max(0, Math.floor(Number(checkpoint?.completedPlans || 0)));
    actions.push(buildAction({
      id: "resume_remaining_dispatch_batches",
      reasonCode: "dispatch_checkpoint_incomplete",
      summary: `Resume remaining dispatch batches (${completedPlans}/${totalPlans} complete).`,
      source: "runtime.dispatch_checkpoint",
      impact: 1,
      feasibility: 0.9,
      evidenceConfidence: 0.95,
      novelty: 0.85,
      contractRelevance: 1,
    }));
  }

  if (session?.feedback?.pendingResearchRefresh === true) {
    actions.push(buildAction({
      id: "refresh_pending_research",
      reasonCode: "pending_research_refresh",
      summary: "Run the pending target research refresh before closure.",
      source: "target_session.feedback",
      impact: 0.75,
      feasibility: 0.75,
      evidenceConfidence: 0.85,
      contractRelevance: 0.85,
    }));
  }

  const candidateNextActions = uniqueActions(actions);
  const blockedActions = candidateNextActions.filter((action) => action.blocked === true);
  const actionableNextActions = candidateNextActions.filter((action) => action.blocked !== true);
  const bestAction = actionableNextActions[0] || null;
  const terminalContract = isContractTerminal(report);
  const hasHighValueAction = Boolean(bestAction && Number(bestAction.expectedValue || 0) >= threshold);

  let decision: string = TARGET_CLOSURE_DECISION.CONTINUE;
  let reasonCode = "high_value_next_action_available";
  if (!terminalContract && blockedActions.length > 0 && actionableNextActions.length === 0) {
    decision = TARGET_CLOSURE_DECISION.BLOCKED;
    reasonCode = blockedActions[0]?.reasonCode || "blocked_next_action";
  } else if (terminalContract && !hasHighValueAction) {
    decision = TARGET_CLOSURE_DECISION.CLOSE;
    reasonCode = hasPendingHumanInputs(report)
      ? "contract_fulfilled_with_handoff_no_autonomous_action"
      : "contract_fulfilled_no_high_value_action";
  } else if (!terminalContract) {
    reasonCode = bestAction?.reasonCode || "contract_not_fulfilled";
  } else {
    reasonCode = bestAction?.reasonCode || "terminal_contract_but_action_remains";
  }

  return {
    schemaVersion: 1,
    evaluatedAt,
    decision,
    reasonCode,
    contractStatus: normalizeString(report?.status) || null,
    continueThreshold: threshold,
    hasHighValueAction,
    bestNextAction: bestAction,
    candidateNextActions,
    blockedActions,
    summary: decision === TARGET_CLOSURE_DECISION.CLOSE
      ? "Closure approved: contract is satisfied and no high-value autonomous next action remains."
      : decision === TARGET_CLOSURE_DECISION.BLOCKED
        ? "Closure blocked: the remaining next action requires input or an unavailable prerequisite."
        : "Closure deferred: at least one high-value autonomous next action remains.",
  };
}

export function isTargetClosureDecisionTerminal(report: any): boolean {
  const decision = normalizeLower(report?.closure?.decision);
  if (decision) return decision === TARGET_CLOSURE_DECISION.CLOSE;
  return isContractTerminal(report);
}