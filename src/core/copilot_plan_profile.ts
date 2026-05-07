export const FREE_PLAN_PRIMARY_MODEL = "GPT-5 mini";
export const FREE_PLAN_ALLOWED_MODELS = Object.freeze([
  "GPT-5 mini",
  "GPT-4.1",
  "Claude Haiku 4.5",
  "Grok Code Fast 1",
  "Raptor mini",
  "Goldeneye"
]);

export const PRO_PLAN_ALLOWED_MODELS = Object.freeze([
  ...FREE_PLAN_ALLOWED_MODELS,
  "GPT-5.1",
  "GPT-5.1 Codex",
  "GPT-5.1 Codex mini",
  "GPT-5.2",
  "GPT-5.2 Codex",
  "GPT-5.3-codex",
  "Claude Sonnet 4.5"
]);

export const PRO_PLUS_ALLOWED_MODELS = Object.freeze([
  ...PRO_PLAN_ALLOWED_MODELS,
  "GPT-5.4",
  "GPT-5.1 Codex Max",
  "Claude Sonnet 4.6",
  "Claude Opus 4.5",
  "Claude Opus 4.6",
  "Gemini 3 Pro Preview"
]);

export const DEFAULT_PRO_SINGLE_MODEL = "GPT-5.3-codex";

export type CopilotPlanTier = "free" | "pro" | "pro_plus" | "business" | "enterprise" | "student" | "unknown";
export type CopilotModelAccess = "free" | "current";

export interface CopilotResolvedModelSelection {
  mode: "schema" | "single";
  model: string | null;
  source: "plan_schema" | "plan_default" | "session_selection" | "custom_schema";
  allowedModels: string[];
}

export interface CopilotAccountProfile {
  planTier: CopilotPlanTier;
  planLabel: string;
  modelAccess: CopilotModelAccess;
  planDetectedBy: "field" | "entitlement" | "unknown";
  source: string;
  rawPlan: string | null;
  entitlement: number | null;
  usedRequests: number | null;
  remainingRequests: number | null;
  percentRemaining: number | null;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeModelName(value: unknown): string {
  return String(value || "").trim();
}

function canonicalizeModelName(value: unknown): string {
  return normalizeModelName(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sameModelName(left: unknown, right: unknown): boolean {
  return canonicalizeModelName(left) === canonicalizeModelName(right);
}

function pickFirstString(values: unknown[]): string | null {
  for (const value of values) {
    const normalizedValue = normalizeModelName(value);
    if (normalizedValue) {
      return normalizedValue;
    }
  }
  return null;
}

function normalizePlanToken(value: unknown): CopilotPlanTier | null {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.includes("enterprise")) {
    return "enterprise";
  }
  if (normalizedValue.includes("business") || normalizedValue.includes("team")) {
    return "business";
  }
  if (normalizedValue.includes("student") || normalizedValue.includes("teacher")) {
    return "student";
  }
  if (normalizedValue.includes("pro+") || normalizedValue.includes("pro plus") || normalizedValue.includes("pro-plus")) {
    return "pro_plus";
  }
  if (/(^|[^a-z])pro($|[^a-z])/.test(normalizedValue)) {
    return "pro";
  }
  if (/(^|[^a-z])free($|[^a-z])/.test(normalizedValue)) {
    return "free";
  }

  return null;
}

function inferPlanTierFromEntitlement(entitlement: number | null): CopilotPlanTier {
  if (entitlement === null) {
    return "unknown";
  }
  if (entitlement <= 0) {
    return "unknown";
  }
  if (entitlement <= 50) {
    return "free";
  }
  if (entitlement >= 1500) {
    return "pro_plus";
  }
  if (entitlement >= 1000) {
    return "enterprise";
  }
  if (entitlement >= 300) {
    return "pro";
  }
  return "unknown";
}

function getPlanLabel(planTier: CopilotPlanTier): string {
  switch (planTier) {
    case "free":
      return "Copilot Free";
    case "pro":
      return "Copilot Pro";
    case "pro_plus":
      return "Copilot Pro+";
    case "business":
      return "Copilot Business";
    case "enterprise":
      return "Copilot Enterprise";
    case "student":
      return "Copilot Student";
    default:
      return "Copilot plan unknown";
  }
}

function clonePreferenceMap(value: unknown): Record<string, string[]> {
  const resolved: Record<string, string[]> = {};
  if (!value || typeof value !== "object") {
    return resolved;
  }
  for (const [key, rawModels] of Object.entries(value as Record<string, unknown>)) {
    const models = Array.isArray(rawModels)
      ? rawModels.map((entry) => normalizeModelName(entry)).filter(Boolean)
      : [normalizeModelName(rawModels)].filter(Boolean);
    if (models.length > 0) {
      resolved[key] = models;
    }
  }
  return resolved;
}

function pinPreferenceMapToModel(value: unknown, modelName: string): Record<string, string[]> {
  const existing = clonePreferenceMap(value);
  const resolved: Record<string, string[]> = {};
  for (const key of Object.keys(existing)) {
    resolved[key] = [modelName];
  }
  return resolved;
}

function _normalizeAllowedModels(value: unknown, fallbackModels: readonly string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallbackModels];
  }

  const normalizedInput = value.map((entry) => normalizeModelName(entry)).filter(Boolean);
  const matched = fallbackModels.filter((allowedModel) => normalizedInput.some((candidate) => sameModelName(candidate, allowedModel)));
  return matched.length > 0 ? matched : [...fallbackModels];
}

function dedupeModels(models: readonly string[]): string[] {
  const resolved: string[] = [];
  for (const model of models) {
    const normalizedModel = normalizeModelName(model);
    if (!normalizedModel || resolved.some((entry) => sameModelName(entry, normalizedModel))) {
      continue;
    }
    resolved.push(normalizedModel);
  }
  return resolved;
}

function collectConfiguredSchemaModels(baseCopilot: Record<string, unknown>): string[] {
  const configuredModels = [
    baseCopilot.defaultModel,
    baseCopilot.strongModel,
    baseCopilot.efficientModel,
    baseCopilot.sonnetModel,
    baseCopilot.opusModel,
  ].map((entry) => normalizeModelName(entry)).filter(Boolean);
  const preferredByTaskKind = Object.values(clonePreferenceMap(baseCopilot.preferredModelsByTaskKind)).flat();
  const preferredByRole = Object.values(clonePreferenceMap(baseCopilot.preferredModelsByRole)).flat();
  return dedupeModels(configuredModels.concat(preferredByTaskKind, preferredByRole));
}

function hasExplicitCustomModelSchema(baseCopilot: Record<string, unknown>): boolean {
  if (Object.keys(clonePreferenceMap(baseCopilot.preferredModelsByTaskKind)).length > 0) {
    return true;
  }
  if (Object.keys(clonePreferenceMap(baseCopilot.preferredModelsByRole)).length > 0) {
    return true;
  }
  return collectConfiguredSchemaModels(baseCopilot).length > 1;
}

function getPlanAllowedModels(planTier: CopilotPlanTier | null | undefined): readonly string[] {
  switch (planTier) {
    case "free":
      return FREE_PLAN_ALLOWED_MODELS;
    case "pro":
    case "student":
      return PRO_PLAN_ALLOWED_MODELS;
    case "pro_plus":
    case "business":
    case "enterprise":
      return PRO_PLUS_ALLOWED_MODELS;
    default:
      return [];
  }
}

export function resolveCopilotAllowedModels(
  accountProfile: CopilotAccountProfile | null,
  fallbackModels: readonly string[] = [],
): string[] {
  const planAllowedModels = getPlanAllowedModels(accountProfile?.planTier);
  if (planAllowedModels.length > 0) {
    return dedupeModels(planAllowedModels);
  }
  return dedupeModels(Array.isArray(fallbackModels) ? fallbackModels : []);
}

export function resolveAllowedCopilotModel(candidate: unknown, allowedModels: readonly string[]): string | null {
  const normalizedCandidate = normalizeModelName(candidate);
  if (!normalizedCandidate) {
    return null;
  }
  return allowedModels.find((allowedModel) => sameModelName(allowedModel, normalizedCandidate)) || null;
}

function resolveFreePrimaryModel(allowedModels: string[]): string {
  const matchedPrimary = allowedModels.find((candidate) => sameModelName(candidate, FREE_PLAN_PRIMARY_MODEL));
  if (matchedPrimary) {
    return matchedPrimary;
  }
  return allowedModels[0] || FREE_PLAN_PRIMARY_MODEL;
}

export function resolveCopilotDefaultSingleModel(
  accountProfile: CopilotAccountProfile | null,
  allowedModels: readonly string[],
): string | null {
  if (!accountProfile) {
    return null;
  }

  if (accountProfile.planTier === "free") {
    return resolveFreePrimaryModel([...allowedModels]);
  }

  if (accountProfile.planTier === "pro" || accountProfile.planTier === "student") {
    return resolveAllowedCopilotModel(DEFAULT_PRO_SINGLE_MODEL, allowedModels)
      || resolveAllowedCopilotModel("GPT-5.2 Codex", allowedModels)
      || normalizeModelName(allowedModels[0]);
  }

  return null;
}

export function pinCopilotConfigToModel(
  baseCopilot: Record<string, unknown>,
  modelName: string,
  allowedModels: readonly string[],
): Record<string, unknown> {
  return {
    ...baseCopilot,
    defaultModel: modelName,
    strongModel: modelName,
    efficientModel: modelName,
    sonnetModel: modelName,
    opusModel: modelName,
    allowedModels: dedupeModels(allowedModels),
    maxMultiplier: 1,
    preferredModelsByTaskKind: pinPreferenceMapToModel(baseCopilot.preferredModelsByTaskKind, modelName),
    preferredModelsByRole: pinPreferenceMapToModel(baseCopilot.preferredModelsByRole, modelName),
  };
}

function cloneWithModelOverride(value: unknown, modelName: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneWithModelOverride(entry, modelName));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const nextRecord: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    nextRecord[key] = key === "model" && typeof entry === "string"
      ? modelName
      : cloneWithModelOverride(entry, modelName);
  }
  return nextRecord;
}

export function applyRoleRegistryModelOverride<T>(roleRegistry: T, modelName: string | null): T {
  if (!modelName) {
    return roleRegistry;
  }
  return cloneWithModelOverride(roleRegistry, modelName) as T;
}

function extractRawPlan(payload: Record<string, any>): string | null {
  const premiumSnapshot = payload?.quota_snapshots?.premium_interactions;
  return pickFirstString([
    payload?.plan,
    payload?.plan_type,
    payload?.planType,
    payload?.copilot_plan,
    payload?.copilotPlan,
    payload?.subscription_plan,
    payload?.subscriptionPlan,
    payload?.billing_plan,
    payload?.billingPlan,
    payload?.sku,
    payload?.user?.plan,
    payload?.user?.copilot_plan,
    payload?.account?.plan,
    payload?.account?.copilot_plan,
    premiumSnapshot?.plan,
    premiumSnapshot?.plan_type,
    premiumSnapshot?.tier,
  ]);
}

export function extractCopilotAccountProfile(payload: unknown, source = "copilot_internal/user"): CopilotAccountProfile | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const normalizedPayload = payload as Record<string, any>;
  const premiumSnapshot = normalizedPayload?.quota_snapshots?.premium_interactions || {};
  const entitlement = toFiniteNumber(
    premiumSnapshot?.entitlement
    ?? premiumSnapshot?.quota
    ?? premiumSnapshot?.limit
  );
  const remainingRequests = toFiniteNumber(
    premiumSnapshot?.quota_remaining
    ?? premiumSnapshot?.remaining
    ?? premiumSnapshot?.remaining_requests
  );
  const usedDirect = toFiniteNumber(
    premiumSnapshot?.used
    ?? premiumSnapshot?.used_requests
    ?? premiumSnapshot?.usedQuantity
  );
  const usedRequests = usedDirect !== null
    ? usedDirect
    : (entitlement !== null && remainingRequests !== null ? Math.max(0, entitlement - remainingRequests) : null);
  const percentRemaining = toFiniteNumber(
    premiumSnapshot?.percent_remaining
    ?? premiumSnapshot?.percentRemaining
  );
  const rawPlan = extractRawPlan(normalizedPayload);
  const explicitPlanTier = normalizePlanToken(rawPlan);
  const inferredPlanTier = inferPlanTierFromEntitlement(entitlement);
  const planTier = explicitPlanTier || inferredPlanTier;
  const planDetectedBy = explicitPlanTier
    ? "field"
    : (inferredPlanTier !== "unknown" ? "entitlement" : "unknown");

  if (planDetectedBy === "unknown" && entitlement === null && remainingRequests === null && usedRequests === null) {
    return null;
  }

  return {
    planTier,
    planLabel: getPlanLabel(planTier),
    modelAccess: planTier === "free" ? "free" : "current",
    planDetectedBy,
    source,
    rawPlan,
    entitlement,
    usedRequests,
    remainingRequests,
    percentRemaining,
  };
}

export function applyCopilotPlanProfile(
  baseCopilot: Record<string, unknown> | null | undefined,
  accountProfile: CopilotAccountProfile | null,
  selectedModel: string | null = null,
): Record<string, unknown> {
  const resolvedBase = baseCopilot && typeof baseCopilot === "object" ? { ...baseCopilot } : {};
  const fallbackAllowedModels = Array.isArray(resolvedBase.allowedModels)
    ? resolvedBase.allowedModels.map((entry) => normalizeModelName(entry)).filter(Boolean)
    : [];
  const allowedModels = resolveCopilotAllowedModels(accountProfile, fallbackAllowedModels);
  if (!accountProfile) {
    return {
      ...resolvedBase,
      allowedModels,
      accountProfile: null,
      activeModelSelection: {
        mode: "schema",
        model: null,
        source: "plan_schema",
        allowedModels,
      } satisfies CopilotResolvedModelSelection,
    };
  }

  const resolvedSelectedModel = resolveAllowedCopilotModel(selectedModel, allowedModels);
  if (resolvedSelectedModel) {
    return {
      ...pinCopilotConfigToModel(resolvedBase, resolvedSelectedModel, allowedModels),
      accountProfile,
      activeModelSelection: {
        mode: "single",
        model: resolvedSelectedModel,
        source: "session_selection",
        allowedModels,
      } satisfies CopilotResolvedModelSelection,
    };
  }

  const preserveConfiguredSchema = accountProfile.planTier !== "free"
    && hasExplicitCustomModelSchema(resolvedBase);
  if (preserveConfiguredSchema) {
    return {
      ...resolvedBase,
      allowedModels,
      accountProfile,
      activeModelSelection: {
        mode: "schema",
        model: null,
        source: "custom_schema",
        allowedModels,
      } satisfies CopilotResolvedModelSelection,
    };
  }

  const defaultSingleModel = resolveCopilotDefaultSingleModel(accountProfile, allowedModels);
  if (defaultSingleModel) {
    return {
      ...pinCopilotConfigToModel(resolvedBase, defaultSingleModel, allowedModels),
      accountProfile,
      activeModelSelection: {
        mode: "single",
        model: defaultSingleModel,
        source: "plan_default",
        allowedModels,
      } satisfies CopilotResolvedModelSelection,
    };
  }

  return {
    ...resolvedBase,
    allowedModels,
    accountProfile,
    activeModelSelection: {
      mode: "schema",
      model: null,
      source: "plan_schema",
      allowedModels,
    } satisfies CopilotResolvedModelSelection,
  };
}

export async function fetchCopilotAccountProfile(
  token: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<CopilotAccountProfile | null> {
  const resolvedToken = String(token || "").trim();
  if (!resolvedToken || typeof fetchImpl !== "function") {
    return null;
  }

  try {
    const response = await fetchImpl("https://api.github.com/copilot_internal/user", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${resolvedToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "BOX/1.0",
      },
    });
    if (!response.ok) {
      return null;
    }
    return extractCopilotAccountProfile(await response.json());
  } catch {
    return null;
  }
}