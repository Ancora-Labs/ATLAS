import { taskRequiresUiWorkerCapabilities } from "../workers/ui_capabilities.js";

export const NON_UI_BATCH_AFFINITY_KEY = "__non_ui__";

type UiBatchIdentity = {
  isUiTask: boolean;
  canBatchWithUiPeers: boolean;
  affinityKey: string;
  targetSurfaces: string[];
  continuationFamilyKey: string | null;
};

type UiBatchCompatibility = {
  containsUi: boolean;
  isCompatible: boolean;
  reasonCode: string | null;
  affinityKey: string | null;
  targetSurfaces: string[];
  continuationFamilyKey: string | null;
  uiPlanCount: number;
  nonUiPlanCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNonEmptyString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeStringArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of values) {
    const text = normalizeNonEmptyString(entry).toLowerCase();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

function extractUiTargetSurfaces(record: Record<string, unknown>): string[] {
  const uiContract = isRecord(record.uiContract) ? record.uiContract : null;
  const uiRuntimeRecipe = isRecord(record.uiRuntimeRecipe) ? record.uiRuntimeRecipe : null;
  return [...new Set([
    ...normalizeStringArray(record.uiSurface),
    ...normalizeStringArray(record.targetSurfaces),
    ...normalizeStringArray(uiContract?.targetSurfaces),
    ...normalizeStringArray(uiRuntimeRecipe?.primarySurface),
    ...normalizeStringArray(uiRuntimeRecipe?.candidateSurfaces),
  ])].sort();
}

function extractContinuationFamilyKey(record: Record<string, unknown>): string | null {
  const uiContract = isRecord(record.uiContract) ? record.uiContract : null;
  const uiRuntimeRecipe = isRecord(record.uiRuntimeRecipe) ? record.uiRuntimeRecipe : null;
  const familyKey = normalizeNonEmptyString(record.continuationFamilyKey)
    || normalizeNonEmptyString(uiContract?.continuationFamilyKey)
    || normalizeNonEmptyString(uiRuntimeRecipe?.continuationFamilyKey);
  return familyKey || null;
}

function buildFallbackPlanKey(record: Record<string, unknown>, fallbackKey?: string): string {
  const explicit = normalizeNonEmptyString(fallbackKey);
  if (explicit) return explicit;
  return normalizeNonEmptyString(record.task_id)
    || normalizeNonEmptyString(record.taskId)
    || normalizeNonEmptyString(record.id)
    || normalizeNonEmptyString(record.title)
    || normalizeNonEmptyString(record.task)
    || "ui-singleton";
}

export function resolveUiBatchIdentity(plan: unknown, fallbackKey?: string): UiBatchIdentity {
  if (!isRecord(plan) || !taskRequiresUiWorkerCapabilities(plan)) {
    return {
      isUiTask: false,
      canBatchWithUiPeers: false,
      affinityKey: NON_UI_BATCH_AFFINITY_KEY,
      targetSurfaces: [],
      continuationFamilyKey: null,
    };
  }

  const targetSurfaces = extractUiTargetSurfaces(plan);
  const continuationFamilyKey = extractContinuationFamilyKey(plan);
  const singletonKey = buildFallbackPlanKey(plan, fallbackKey);
  if (targetSurfaces.length === 0 || !continuationFamilyKey) {
    return {
      isUiTask: true,
      canBatchWithUiPeers: false,
      affinityKey: `__ui_singleton__:${singletonKey}`,
      targetSurfaces,
      continuationFamilyKey,
    };
  }

  return {
    isUiTask: true,
    canBatchWithUiPeers: true,
    affinityKey: `ui:${targetSurfaces.join("|")}::${continuationFamilyKey.toLowerCase()}`,
    targetSurfaces,
    continuationFamilyKey,
  };
}

export function analyzeUiBatchCompatibility(plans: unknown[] = []): UiBatchCompatibility {
  const identities = (Array.isArray(plans) ? plans : []).map((plan, index) =>
    resolveUiBatchIdentity(plan, `plan-${index + 1}`)
  );
  const uiIdentities = identities.filter((identity) => identity.isUiTask);
  if (uiIdentities.length === 0) {
    return {
      containsUi: false,
      isCompatible: true,
      reasonCode: null,
      affinityKey: null,
      targetSurfaces: [],
      continuationFamilyKey: null,
      uiPlanCount: 0,
      nonUiPlanCount: identities.length,
    };
  }

  if (uiIdentities.length !== identities.length) {
    return {
      containsUi: true,
      isCompatible: false,
      reasonCode: "mixed_ui_non_ui",
      affinityKey: null,
      targetSurfaces: [],
      continuationFamilyKey: null,
      uiPlanCount: uiIdentities.length,
      nonUiPlanCount: identities.length - uiIdentities.length,
    };
  }

  const distinctAffinityKeys = [...new Set(uiIdentities.map((identity) => identity.affinityKey))];
  if (distinctAffinityKeys.length > 1) {
    return {
      containsUi: true,
      isCompatible: false,
      reasonCode: "ui_surface_or_family_mismatch",
      affinityKey: null,
      targetSurfaces: [],
      continuationFamilyKey: null,
      uiPlanCount: uiIdentities.length,
      nonUiPlanCount: 0,
    };
  }

  const first = uiIdentities[0];
  if (uiIdentities.length > 1 && !first.canBatchWithUiPeers) {
    return {
      containsUi: true,
      isCompatible: false,
      reasonCode: "ui_missing_surface_or_family",
      affinityKey: null,
      targetSurfaces: first.targetSurfaces,
      continuationFamilyKey: first.continuationFamilyKey,
      uiPlanCount: uiIdentities.length,
      nonUiPlanCount: 0,
    };
  }

  return {
    containsUi: true,
    isCompatible: true,
    reasonCode: null,
    affinityKey: first.affinityKey,
    targetSurfaces: first.targetSurfaces,
    continuationFamilyKey: first.continuationFamilyKey,
    uiPlanCount: uiIdentities.length,
    nonUiPlanCount: 0,
  };
}

function pickFirstObject(plans: unknown[], field: string): Record<string, unknown> | null {
  for (const plan of Array.isArray(plans) ? plans : []) {
    if (!isRecord(plan)) continue;
    const value = plan[field];
    if (isRecord(value)) return { ...value };
  }
  return null;
}

export function buildUiDispatchMetadataFromPlans(plans: unknown[] = []): Record<string, unknown> | null {
  const analysis = analyzeUiBatchCompatibility(plans);
  if (!analysis.containsUi || !analysis.isCompatible) return null;

  const firstUiPlan = (Array.isArray(plans) ? plans : []).find(
    (plan) => isRecord(plan) && taskRequiresUiWorkerCapabilities(plan)
  );
  if (!isRecord(firstUiPlan)) return null;

  const capabilityTag = normalizeNonEmptyString(firstUiPlan.capabilityTag)
    || normalizeNonEmptyString(firstUiPlan._capabilityTag)
    || "ui-contract";
  const taskKind = normalizeNonEmptyString(firstUiPlan.taskKind)
    || normalizeNonEmptyString(firstUiPlan.kind)
    || "ui-contract";

  return {
    capabilityTag,
    _capabilityTag: normalizeNonEmptyString(firstUiPlan._capabilityTag) || capabilityTag,
    taskKind,
    kind: normalizeNonEmptyString(firstUiPlan.kind) || taskKind,
    continuationFamilyKey: analysis.continuationFamilyKey,
    targetSurfaces: analysis.targetSurfaces,
    uiSurface: normalizeNonEmptyString(firstUiPlan.uiSurface) || analysis.targetSurfaces[0] || undefined,
    ...(pickFirstObject(plans, "uiContract") ? { uiContract: pickFirstObject(plans, "uiContract") } : {}),
    ...(pickFirstObject(plans, "uiScenarioMatrix") ? { uiScenarioMatrix: pickFirstObject(plans, "uiScenarioMatrix") } : {}),
    ...(pickFirstObject(plans, "uiRuntimeRecipe") ? { uiRuntimeRecipe: pickFirstObject(plans, "uiRuntimeRecipe") } : {}),
  };
}