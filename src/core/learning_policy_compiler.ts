/**
 * learning_policy_compiler.js — Converts postmortem lessons into enforced policy checks.
 *
 * Problem: Postmortem lessons sit as text in JSON files. The same defects recur
 * because lessons are advisory, not enforced.
 *
 * Solution: This compiler extracts actionable patterns from lessons and generates
 * deterministic policy assertions that can be checked before worker dispatch.
 *
 * Integration: called by orchestrator after postmortem, before next cycle start.
 */
import { computeDecayedPolicyEffectiveness } from "./lesson_halflife.js";
import { EQUAL_DIMENSION_SET } from "./plan_contract_validator.js";
import { OPTIMIZATION_INTERVENTION_KIND } from "./model_policy.js";

/**
 * Known lesson patterns that can be compiled into policy checks.
 * Each pattern has a regex to match lessons and a policy assertion to enforce.
 *
 * @type {Array<{ id: string, pattern: RegExp, assertion: string, severity: string }>}
 */
const COMPILABLE_PATTERNS = [
  {
    id: "glob-false-fail",
    pattern: /glob|node --test tests[\\/]\*|wildcard|path.*expansion/i,
    assertion: "Verification must use 'npm test' not 'node --test tests/**'",
    severity: "critical",
    interventionKind: OPTIMIZATION_INTERVENTION_KIND.POLICY_DELTA,
  },
  {
    id: "missing-test",
    pattern: /no\s+test|missing\s+test|untested|test.*coverage/i,
    assertion: "New code must include at least one test file",
    severity: "warning",
    interventionKind: OPTIMIZATION_INTERVENTION_KIND.PROMPT_DELTA,
  },
  {
    id: "lint-failure",
    pattern: /lint|eslint|unused\s+(var|import|export)/i,
    assertion: "Run npm run lint before marking task complete",
    severity: "warning",
    interventionKind: OPTIMIZATION_INTERVENTION_KIND.PROMPT_DELTA,
  },
  {
    id: "import-error",
    pattern: /import.*error|module.*not\s+found|cannot\s+find\s+module/i,
    assertion: "All imports must resolve; verify with node -e 'import(\"./path\")'",
    severity: "critical",
    interventionKind: OPTIMIZATION_INTERVENTION_KIND.ROUTING_DELTA,
  },
  {
    id: "state-corruption",
    pattern: /state.*corrupt|json.*parse|invalid\s+json|malformed/i,
    assertion: "State files must be written atomically with writeJson",
    severity: "critical",
    interventionKind: OPTIMIZATION_INTERVENTION_KIND.POLICY_DELTA,
  },
  {
    id: "syntax-error",
    pattern: /syntax\s*error|unexpected\s+token|parse\s+error/i,
    assertion: "Code must parse without SyntaxError before commit",
    severity: "critical",
    interventionKind: OPTIMIZATION_INTERVENTION_KIND.ROUTING_DELTA,
  },
  {
    id: "hardcoded-path",
    pattern: /hardcoded|absolute\s+path|windows.*path|backslash/i,
    assertion: "Use path.join() for all file paths; no hardcoded separators",
    severity: "warning",
    interventionKind: OPTIMIZATION_INTERVENTION_KIND.PROMPT_DELTA,
  },
  {
    id: "missing-error-handling",
    pattern: /unhandled|uncaught|swallow.*error|silent.*fail/i,
    assertion: "Async operations at system boundaries must have try/catch",
    severity: "warning",
    interventionKind: OPTIMIZATION_INTERVENTION_KIND.PROMPT_DELTA,
  },
];

/**
 * @typedef {object} CompiledPolicy
 * @property {string} id — policy rule ID
 * @property {string} assertion — human-readable policy assertion
 * @property {string} severity — "critical" | "warning"
 * @property {string} sourceLesson — the lesson text that triggered this policy
 * @property {string} detectedAt — ISO timestamp
 */

/**
 * Compile lessons from postmortem history into enforced policy checks.
 *
 * @param {object[]} postmortems — postmortem entries with lessonLearned field
 * @param {{ existingPolicies?: string[] }} opts
 * @returns {CompiledPolicy[]}
 */
export function compileLessonsToPolicies(postmortems, opts: any = {}) {
  if (!Array.isArray(postmortems)) return [];

  const existing = new Set(opts.existingPolicies || []);
  /** @type {CompiledPolicy[]} */
  const policies = [];
  const seen = new Set();

  for (const pm of postmortems) {
    const lesson = String(pm?.lessonLearned || "").trim();
    if (lesson.length < 10) continue;

    for (const template of COMPILABLE_PATTERNS) {
      if (template.pattern.test(lesson) && !seen.has(template.id) && !existing.has(template.id)) {
        seen.add(template.id);
        policies.push({
          id: template.id,
          assertion: template.assertion,
          severity: template.severity,
          sourceLesson: lesson.slice(0, 200),
          detectedAt: pm.reviewedAt || new Date().toISOString(),
          interventionKind: template.interventionKind || OPTIMIZATION_INTERVENTION_KIND.POLICY_DELTA,
          optimizationMode: "impact-attributed-loop",
          upliftSignal: "pending_measurement",
        });
      }
    }
  }

  return policies;
}

/**
 * Validate a plan against compiled policies.
 * Returns violations if the plan conflicts with any active policy.
 *
 * @param {object} plan — plan object
 * @param {CompiledPolicy[]} policies — active compiled policies
 * @returns {{ ok: boolean, violations: Array<{ policyId: string, assertion: string, severity: string }> }}
 */
export function validatePlanAgainstPolicies(plan, policies) {
  if (!plan || !Array.isArray(policies)) return { ok: true, violations: [] };

  const violations = [];
  const verification = String(plan.verification || "").toLowerCase();
  const task = String(plan.task || "").toLowerCase();

  for (const policy of policies) {
    // Check specific known violations
    if (policy.id === "glob-false-fail" && /node\s+--test\s+tests/.test(verification)) {
      violations.push({ policyId: policy.id, assertion: policy.assertion, severity: policy.severity, reasonCode: REASON_CODES.PLAN_VIOLATION });
    }
    if (policy.id === "missing-test" && /implement|create|add/.test(task) && !/test/.test(task) && !/test/.test(verification)) {
      violations.push({ policyId: policy.id, assertion: policy.assertion, severity: policy.severity, reasonCode: REASON_CODES.PLAN_VIOLATION });
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Check if unresolved carry-forward lessons should block plan acceptance (Packet 10/16).
 * Plans are blocked when the same lesson has gone unresolved for more than maxCycles.
 *
 * Enhanced (Packet 16): Also validates that mandatory carry-forward items appear
 * explicitly in the current plan set. Plans missing mandatory items are blocked.
 *
 * @param {object[]} postmortems — postmortem entries with followUpNeeded/followUpTask
 * @param {object[]} currentPlans — current plan set to check against
 * @param {{ maxUnresolvedCycles?: number, mandatoryCarryForward?: string[] }} opts
 * @returns {{ shouldBlock: boolean, reason: string, unresolvedLessons: string[], missingMandatory: string[] }}
 */
export function checkCarryForwardGate(postmortems, currentPlans, opts: any = {}) {
  const maxCycles = opts.maxUnresolvedCycles || 3;
  if (!Array.isArray(postmortems)) return { shouldBlock: false, reason: "", unresolvedLessons: [], missingMandatory: [] };

  // Count how many times each lesson appears unresolved
  const lessonCounts = new Map();
  for (const pm of postmortems) {
    if (!pm.followUpNeeded || !pm.followUpTask) continue;
    const normalized = normalizeKey(pm.followUpTask);
    if (!normalized) continue;
    lessonCounts.set(normalized, (lessonCounts.get(normalized) || 0) + 1);
  }

  // Check if current plans address any of the unresolved lessons
  const planTexts = (currentPlans || []).map(p => normalizeKey(String(p.task || "")));

  const unresolvedLessons = [];
  for (const [lesson, count] of lessonCounts) {
    if (count < maxCycles) continue;
    // Check if current plan addresses this lesson
    const addressed = planTexts.some(pt => pt.includes(lesson.slice(0, 40)) || lesson.includes(pt.slice(0, 40)));
    if (!addressed) {
      unresolvedLessons.push(lesson.slice(0, 100));
    }
  }

  // Packet 16: Validate mandatory carry-forward items
  const mandatory = Array.isArray(opts.mandatoryCarryForward) ? opts.mandatoryCarryForward : [];
  const missingMandatory = [];
  for (const item of mandatory) {
    const normalizedItem = normalizeKey(item);
    const found = planTexts.some(pt => pt.includes(normalizedItem.slice(0, 40)) || normalizedItem.includes(pt.slice(0, 40)));
    if (!found) {
      missingMandatory.push(item.slice(0, 100));
    }
  }

  const shouldBlock = unresolvedLessons.length > 0 || missingMandatory.length > 0;
  const reasons = [];
  if (unresolvedLessons.length > 0) {
    reasons.push(`${unresolvedLessons.length} lesson(s) unresolved for >${maxCycles} cycles and not addressed in current plan`);
  }
  if (missingMandatory.length > 0) {
    reasons.push(`${missingMandatory.length} mandatory carry-forward item(s) missing from plan`);
  }

  return {
    shouldBlock,
    reason: reasons.join("; "),
    reasonCode: unresolvedLessons.length > 0
      ? REASON_CODES.CARRY_FORWARD_UNRESOLVED
      : missingMandatory.length > 0
      ? REASON_CODES.MANDATORY_ITEM_MISSING
      : null,
    unresolvedLessons,
    missingMandatory,
  };
}

function normalizeKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Exported for testing. */
export { COMPILABLE_PATTERNS };

/**
 * Structured reason codes emitted by gate functions so callers can react
 * programmatically without parsing free-form reason strings.
 */
export const REASON_CODES = {
  /** Lesson has recurred enough times to trigger a hard-gate policy block. */
  RECURRENCE_HARD_GATE: "RECURRENCE_HARD_GATE",
  /** Lesson is approaching the hard-gate threshold — early warning issued. */
  EARLY_RECURRENCE_WARNING: "EARLY_RECURRENCE_WARNING",
  /** One or more carry-forward lessons remain unresolved past the cycle limit. */
  CARRY_FORWARD_UNRESOLVED: "CARRY_FORWARD_UNRESOLVED",
  /** A mandatory carry-forward item is absent from the current plan set. */
  MANDATORY_ITEM_MISSING: "MANDATORY_ITEM_MISSING",
  /** A plan field directly violates an active compiled policy. */
  PLAN_VIOLATION: "PLAN_VIOLATION",
} as const;

export type ReasonCode = typeof REASON_CODES[keyof typeof REASON_CODES];

/**
 * Hard-gate: auto-compile unresolved recurrences into enforceable policies (Packet 15).
 *
 * When the same lesson recurs more than `maxRecurrences` times without resolution,
 * this function forcibly compiles it into a policy assertion that blocks future plans
 * matching the same pattern.
 *
 * Early promotion: lessons that recur more than `earlyGateThreshold` times (default:
 * maxRecurrences - 1) are promoted to warning-level policies with a distinct
 * `-early-warning` ID suffix so they enter the gate pipeline before the hard threshold.
 * This gives operators one cycle of advance notice before the hard block fires.
 *
 * All emitted policies carry a `reasonCode` field for programmatic routing by callers.
 *
 * @param {object[]} postmortems — full postmortem history
 * @param {string[]} existingPolicyIds — already-active policy IDs
 * @param {{ maxRecurrences?: number, earlyGateThreshold?: number }} opts
 * @returns {{ newPolicies: CompiledPolicy[], escalations: string[] }}
 */
export function hardGateRecurrenceToPolicies(postmortems, existingPolicyIds = [], opts: any = {}) {
  const maxRecurrences = opts.maxRecurrences || 3;
  // earlyGateThreshold defaults to one below maxRecurrences so promotion is one cycle early.
  const earlyGateThreshold = opts.earlyGateThreshold ?? Math.max(1, maxRecurrences - 1);
  if (!Array.isArray(postmortems)) return { newPolicies: [], escalations: [] };

  const existing = new Set(existingPolicyIds);
  const lessonCounts = new Map();

  // Count lesson occurrences
  for (const pm of postmortems) {
    if (!pm.followUpNeeded) continue;
    const lesson = String(pm.lessonLearned || "").trim();
    if (lesson.length < 10) continue;
    lessonCounts.set(lesson, (lessonCounts.get(lesson) || 0) + 1);
  }

  const newPolicies = [];
  const escalations = [];

  for (const [lesson, count] of lessonCounts) {
    const isHardGate = count >= maxRecurrences;
    const isEarlyWarning = !isHardGate && count >= earlyGateThreshold;
    if (!isHardGate && !isEarlyWarning) continue;

    const reasonCode = isHardGate ? REASON_CODES.RECURRENCE_HARD_GATE : REASON_CODES.EARLY_RECURRENCE_WARNING;

    // Try to compile into a known pattern
    let compiled = false;
    for (const template of COMPILABLE_PATTERNS) {
      if (!template.pattern.test(lesson)) continue;
      // Hard gate uses the canonical ID; early warning uses a distinct suffixed ID so
      // both can coexist in existingPolicyIds without suppressing each other.
      const policyId = isHardGate ? template.id : `${template.id}-early-warning`;
      if (existing.has(policyId)) { compiled = true; break; }
      existing.add(policyId);
      newPolicies.push({
        id: policyId,
        assertion: template.assertion,
        severity: isHardGate ? "critical" : template.severity,
        reasonCode,
        sourceLesson: lesson.slice(0, 200),
        detectedAt: new Date().toISOString(),
        _hardGated: isHardGate,
        _recurrenceCount: count,
      });
      compiled = true;
      break;
    }

    // If no known pattern matches, escalate as a custom rule
    if (!compiled) {
      const baseId = `custom-recurrence-${normalizeKey(lesson).slice(0, 30).replace(/\s/g, "-")}`;
      const customId = isHardGate ? baseId : `${baseId}-early-warning`;
      if (!existing.has(customId)) {
        existing.add(customId);
        newPolicies.push({
          id: customId,
          assertion: `Recurring unresolved: ${lesson.slice(0, 100)}`,
          severity: isHardGate ? "critical" : "warning",
          reasonCode,
          sourceLesson: lesson.slice(0, 200),
          detectedAt: new Date().toISOString(),
          _hardGated: isHardGate,
          _recurrenceCount: count,
        });
        if (isEarlyWarning) {
          escalations.push(`Lesson approaching recurrence threshold (${count}/${maxRecurrences}): ${lesson.slice(0, 80)}`);
        } else {
          escalations.push(`Lesson recurring ${count}x without resolution: ${lesson.slice(0, 80)}`);
        }
      }
    }
  }

  return { newPolicies, escalations };
}

// ── Routing adjustments (Task 9) ──────────────────────────────────────────────

/**
 * @typedef {object} RoutingAdjustment
 * @property {string} policyId — the compiled policy that triggered this adjustment
 * @property {string} modelOverride — model routing override (e.g. "force-sonnet", "block-opus")
 * @property {string} reason — why this routing adjustment was applied
 * @property {"critical"|"warning"} severity — mirrors the triggering policy severity
 */

/**
 * Map from policy ID to the routing adjustment it should trigger.
 * Critical policies (recurring failures) route to safer, more predictable models.
 * Import-related issues block Opus escalation since model complexity is not the problem.
 */
const POLICY_ROUTING_MAP: Record<string, { modelOverride: string; reason: string }> = {
  "glob-false-fail":          { modelOverride: "force-sonnet", reason: "glob failures are tooling issues, not reasoning gaps — Sonnet sufficient" },
  "lint-failure":             { modelOverride: "force-sonnet", reason: "lint failures require precision, not reasoning depth" },
  "hardcoded-path":           { modelOverride: "force-sonnet", reason: "path issues are mechanical — Sonnet sufficient" },
  "import-error":             { modelOverride: "block-opus",   reason: "import errors indicate env/dependency issues, not model capability gaps" },
  "missing-error-handling":   { modelOverride: "force-sonnet", reason: "error handling is a discipline issue, not a reasoning issue" },
  "missing-test":             { modelOverride: "force-sonnet", reason: "test coverage is discipline-driven, not model-driven" },
  "state-corruption":         { modelOverride: "force-sonnet", reason: "state atomicity is a tooling discipline; model change unhelpful" },
  "syntax-error":             { modelOverride: "block-opus",   reason: "syntax errors are never fixed by a more expensive model" },
};

/**
 * Derive routing adjustments from compiled policies.
 *
 * Recurring failure classes adjust model routing to prevent the same model from
 * being used on tasks where it has demonstrated repeated failure.
 *
 * @param {CompiledPolicy[]} policies — active compiled policies (from compileLessonsToPolicies or hardGateRecurrenceToPolicies)
 * @returns {RoutingAdjustment[]}
 */
export function deriveRoutingAdjustments(policies) {
  if (!Array.isArray(policies)) return [];

  const adjustments = [];
  const seen = new Set<string>();

  for (const policy of policies) {
    const id = String(policy?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const mapping = POLICY_ROUTING_MAP[id];
    if (mapping) {
      adjustments.push({
        policyId: id,
        modelOverride: mapping.modelOverride,
        reason: mapping.reason,
        severity: policy.severity || "warning",
      });
    }
    // For hard-gated custom recurrence policies, default to force-sonnet
    else if (id.startsWith("custom-recurrence-") && (policy as any)._hardGated) {
      adjustments.push({
        policyId: id,
        modelOverride: "force-sonnet",
        reason: `Recurring custom failure class: ${policy.assertion?.slice(0, 80) || id}`,
        severity: policy.severity || "warning",
      });
    }
  }

  return adjustments;
}

/**
 * @typedef {object} PromptHardConstraint
 * @property {string} policyId — the compiled policy that triggered this constraint
 * @property {string} constraint — the hard constraint to inject into the worker prompt
 * @property {boolean} blocking — if true, violation of this constraint causes immediate rework
 * @property {"critical"|"warning"} severity — mirrors the triggering policy severity
 */

/**
 * Map from policy ID to the prompt hard constraint it injects.
 * Hard constraints are injected into the worker prompt preamble so the model
 * cannot silently violate them — violation triggers an immediate rework gate.
 */
const POLICY_PROMPT_CONSTRAINT_MAP: Record<string, { constraint: string; blocking: boolean }> = {
  "glob-false-fail":          { constraint: "HARD CONSTRAINT: Use 'npm test' only. Never use 'node --test tests/**' glob patterns.", blocking: true },
  "missing-test":             { constraint: "HARD CONSTRAINT: Every code change must include or update at least one test file.", blocking: true },
  "lint-failure":             { constraint: "HARD CONSTRAINT: Run 'npm run lint' before marking done. Zero new lint errors are required.", blocking: true },
  "import-error":             { constraint: "HARD CONSTRAINT: Verify all imports resolve before committing. Run 'node -e \"import('./path')\"' on new imports.", blocking: true },
  "state-corruption":         { constraint: "HARD CONSTRAINT: All state file writes must use writeJson (atomic write). Never use fs.writeFile directly on JSON state.", blocking: true },
  "syntax-error":             { constraint: "HARD CONSTRAINT: Syntax-check all changed files before commit. No SyntaxError is acceptable.", blocking: true },
  "hardcoded-path":           { constraint: "HARD CONSTRAINT: Use path.join() for all file paths. No hardcoded separators (/ or \\\\).", blocking: false },
  "missing-error-handling":   { constraint: "HARD CONSTRAINT: All async operations at system boundaries must have explicit try/catch with logged errors.", blocking: false },
};

/**
 * Build prompt hard constraints from compiled policies.
 *
 * These constraints are injected into the worker prompt so the model has
 * explicit in-context rules derived from recurring postmortem failure classes.
 *
 * @param {CompiledPolicy[]} policies — active compiled policies
 * @returns {PromptHardConstraint[]}
 */
export function buildPromptHardConstraints(policies) {
  if (!Array.isArray(policies)) return [];

  const constraints = [];
  const seen = new Set<string>();

  for (const policy of policies) {
    const id = String(policy?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const mapping = POLICY_PROMPT_CONSTRAINT_MAP[id];
    if (mapping) {
      constraints.push({
        policyId: id,
        constraint: mapping.constraint,
        blocking: mapping.blocking,
        severity: policy.severity || "warning",
      });
    }
    // For hard-gated custom recurrence policies, generate a generic constraint
    else if (id.startsWith("custom-recurrence-") && (policy as any)._hardGated) {
      constraints.push({
        policyId: id,
        constraint: `HARD CONSTRAINT (recurring): ${policy.assertion?.slice(0, 120) || id}`,
        blocking: policy.severity === "critical",
        severity: policy.severity || "warning",
      });
    }
  }

  return constraints;
}

// ── Closure evidence and retirement criteria ──────────────────────────────────

/**
 * Closure evidence for a compiled policy binding.
 * Records that a recurring lesson was verifiably resolved so the policy
 * can be evaluated for retirement after sufficient clean cycles.
 */
export interface PolicyClosureEvidence {
  /** ID of the compiled policy that was resolved. */
  policyId:   string;
  /** ISO timestamp when closure was recorded. */
  resolvedAt: string;
  /** Who or what provided the closure evidence. */
  resolvedBy: string;
  /** Human-readable description of the evidence. */
  evidence:   string;
  /** Optional cycle identifier (e.g. from pipeline_progress). */
  cycleId?:   string;
}

/** Retirement evaluation result for a single policy binding. */
export interface RetirementEvaluation {
  policyId:            string;
  eligible:            boolean;
  reason:              string;
  closureCount:        number;
  cyclesSinceClosure:  number;
  lastClosedAt:        string | null;
}

/** Minimum number of closure evidence records before retirement is considered. */
export const RETIREMENT_MIN_CLOSURES = 1;

/**
 * Minimum number of postmortem cycles that must pass after the last closure
 * without any recurrence of the lesson before the policy can be retired.
 */
export const RETIREMENT_MIN_CLEAN_CYCLES = 3;

/**
 * Build a PolicyClosureEvidence record for a given policy.
 *
 * @param policyId  — ID of the compiled policy being closed
 * @param evidence  — human-readable description of the resolution evidence
 * @param opts      — optional resolvedBy and cycleId overrides
 */
export function buildPolicyClosureEvidence(
  policyId: string,
  evidence: string,
  opts: { resolvedBy?: string; cycleId?: string } = {},
): PolicyClosureEvidence {
  if (!policyId || !String(policyId).trim()) {
    throw new Error("policyId is required for buildPolicyClosureEvidence");
  }
  return {
    policyId:   String(policyId).trim(),
    resolvedAt: new Date().toISOString(),
    resolvedBy: String(opts.resolvedBy || "manual"),
    evidence:   String(evidence || "").slice(0, 500),
    ...(opts.cycleId ? { cycleId: String(opts.cycleId) } : {}),
  };
}

/**
 * Evaluate whether a compiled policy binding is eligible for retirement.
 *
 * Retirement requires:
 *   1. At least `minClosures` closure evidence records for the policy.
 *   2. No recurrences of the triggering lesson in postmortems after the last closure.
 *   3. At least `minCleanCycles` postmortem cycles after the last closure with no recurrence.
 *
 * @param policyId         — ID of the policy to evaluate
 * @param closureHistory   — all recorded PolicyClosureEvidence entries
 * @param recentPostmortems — postmortem entries (must have `reviewedAt` and `lessonLearned`)
 * @param opts             — { minClosures?, minCleanCycles? }
 */
export function evaluateRetirementEligibility(
  policyId: string,
  closureHistory: PolicyClosureEvidence[],
  recentPostmortems: any[],
  opts: { minClosures?: number; minCleanCycles?: number } = {},
): RetirementEvaluation {
  const minClosures    = opts.minClosures    ?? RETIREMENT_MIN_CLOSURES;
  const minCleanCycles = opts.minCleanCycles ?? RETIREMENT_MIN_CLEAN_CYCLES;

  const policyClosures = Array.isArray(closureHistory)
    ? closureHistory.filter(e => e?.policyId === policyId)
    : [];

  if (policyClosures.length < minClosures) {
    return {
      policyId,
      eligible:           false,
      reason:             `Insufficient closure evidence (${policyClosures.length} < ${minClosures})`,
      closureCount:       policyClosures.length,
      cyclesSinceClosure: 0,
      lastClosedAt:       null,
    };
  }

  // Most-recent closure
  const sorted       = [...policyClosures].sort((a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime());
  const lastClosedAt = sorted[0].resolvedAt;
  const lastClosedMs = new Date(lastClosedAt).getTime();

  // Find the known pattern for this policyId so we can detect recurrences
  const template = COMPILABLE_PATTERNS.find(p => p.id === policyId);

  const pms = Array.isArray(recentPostmortems) ? recentPostmortems : [];

  // Postmortems AFTER the last closure (by reviewedAt; default to include if timestamp missing)
  const pmsAfterClosure = pms.filter(pm => {
    const ts = pm?.reviewedAt ? new Date(pm.reviewedAt).getTime() : Infinity;
    return ts >= lastClosedMs;
  });

  // Postmortems that re-trigger the policy pattern
  const recurrencesAfterClosure = template
    ? pmsAfterClosure.filter(pm => template.pattern.test(String(pm?.lessonLearned || ""))).length
    : 0;

  const cleanCycles = pmsAfterClosure.length - recurrencesAfterClosure;

  if (recurrencesAfterClosure > 0) {
    return {
      policyId,
      eligible:           false,
      reason:             `Policy still triggering — ${recurrencesAfterClosure} recurrence(s) since last closure`,
      closureCount:       policyClosures.length,
      cyclesSinceClosure: cleanCycles,
      lastClosedAt,
    };
  }

  if (cleanCycles < minCleanCycles) {
    return {
      policyId,
      eligible:           false,
      reason:             `Insufficient clean cycles since closure (${cleanCycles} < ${minCleanCycles})`,
      closureCount:       policyClosures.length,
      cyclesSinceClosure: cleanCycles,
      lastClosedAt,
    };
  }

  return {
    policyId,
    eligible:           true,
    reason:             `Policy has ${policyClosures.length} closure(s) and ${cleanCycles} clean cycles — eligible for retirement`,
    closureCount:       policyClosures.length,
    cyclesSinceClosure: cleanCycles,
    lastClosedAt,
  };
}

/**
 * Partition an active policy list into active and retired policies.
 *
 * Each policy is evaluated via evaluateRetirementEligibility. Policies
 * meeting the retirement criteria are moved to the `retired` list with
 * `_retiredAt` and `_retirementReason` metadata attached.
 *
 * @param policies         — active compiled policies
 * @param closureHistory   — all recorded closure evidence
 * @param recentPostmortems — recent postmortems used to detect recurrences
 * @param opts             — { minClosures?, minCleanCycles? }
 */
export function filterRetiredPolicies(
  policies: any[],
  closureHistory: PolicyClosureEvidence[],
  recentPostmortems: any[],
  opts: { minClosures?: number; minCleanCycles?: number } = {},
): { active: any[]; retired: any[] } {
  if (!Array.isArray(policies)) return { active: [], retired: [] };

  const active  = [];
  const retired = [];

  for (const policy of policies) {
    const evaluation = evaluateRetirementEligibility(
      policy?.id,
      closureHistory,
      recentPostmortems,
      opts,
    );
    if (evaluation.eligible) {
      retired.push({
        ...policy,
        _retiredAt:        new Date().toISOString(),
        _retirementReason: evaluation.reason,
      });
    } else {
      active.push(policy);
    }
  }

  return { active, retired };
}

// ── Curriculum-based policy promotion ────────────────────────────────────────

/**
 * Minimum weight threshold for a curriculum item to be promoted to a policy.
 * Mirrors CURRICULUM_PROMOTION_THRESHOLD from lesson_halflife — kept here
 * as an independent constant so learning_policy_compiler has no external deps.
 */
export const CURRICULUM_PROMOTION_THRESHOLD = 0.4;

/**
 * Convert curriculum items (from lesson_halflife.selectCurriculumItems) into
 * compiled policy checks.
 *
 * Each curriculum item that matches a COMPILABLE_PATTERN produces a policy
 * with a "curriculum-" prefix on the ID so it is distinguishable from
 * hard-gate and early-warning policies.  Items without a matching pattern
 * produce a generic "curriculum-custom-" policy.
 *
 * Research-backed items (researchBacked=true) are promoted to "critical" severity
 * so they receive maximum enforcement weight in the dispatch pipeline.
 *
 * @param {Array<{ lesson: string, weight: number, researchBacked: boolean, reviewedAt?: string }>} curriculumItems
 * @param {{ existingPolicyIds?: string[] }} opts
 * @returns {CompiledPolicy[]}
 */
export function compileCurriculumToPolicies(
  curriculumItems: Array<{ lesson: string; weight: number; researchBacked: boolean; reviewedAt?: string }>,
  opts: { existingPolicyIds?: string[] } = {},
): any[] {
  if (!Array.isArray(curriculumItems)) return [];

  const existing = new Set(opts.existingPolicyIds || []);
  const policies: any[] = [];
  const seen = new Set<string>();

  for (const item of curriculumItems) {
    const lesson = String(item?.lesson || "").trim();
    if (lesson.length < 5) continue;

    let compiled = false;
    for (const template of COMPILABLE_PATTERNS) {
      if (!template.pattern.test(lesson)) continue;
      const policyId = `curriculum-${template.id}`;
      if (seen.has(policyId) || existing.has(policyId)) { compiled = true; break; }
      seen.add(policyId);
      existing.add(policyId);
      policies.push({
        id: policyId,
        assertion: template.assertion,
        severity: item.researchBacked ? "critical" : template.severity,
        sourceLesson: lesson.slice(0, 200),
        detectedAt: item.reviewedAt || new Date().toISOString(),
        _curriculumWeight: item.weight,
        _researchBacked: Boolean(item.researchBacked),
        reasonCode: REASON_CODES.RECURRENCE_HARD_GATE,
      });
      compiled = true;
      break;
    }

    if (!compiled) {
      const slug = lesson.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30);
      const policyId = `curriculum-custom-${slug}`;
      if (seen.has(policyId) || existing.has(policyId)) continue;
      seen.add(policyId);
      existing.add(policyId);
      policies.push({
        id: policyId,
        assertion: `Curriculum lesson (weight=${item.weight}): ${lesson.slice(0, 120)}`,
        severity: item.researchBacked ? "critical" : "warning",
        sourceLesson: lesson.slice(0, 200),
        detectedAt: item.reviewedAt || new Date().toISOString(),
        _curriculumWeight: item.weight,
        _researchBacked: Boolean(item.researchBacked),
        reasonCode: REASON_CODES.RECURRENCE_HARD_GATE,
      });
    }
  }

  return policies;
}

export interface PolicyOutcomeDelta {
  policyId: string;
  baseline: number;
  current: number;
  delta: number;
  cycleWindow: number;
}

export interface PolicyImpactEntry {
  policyId: string;
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  improved: boolean;
  measuredAt: string;
  cycleId?: string;
}

export interface PolicyImpactTrend {
  policyId: string;
  totalMeasurements: number;
  improvedCount: number;
  ineffectiveCount: number;
  improvementRate: number;
  lastDelta: number;
  lastMeasuredAt: string | null;
}

export interface PolicyImpactAttribution {
  policyId: string;
  cycleId: string;
  baselineCapacityScore: number;
  currentCapacityScore: number;
  delta: number;
  improved: boolean;
  improvementRate: number;
  inactiveCycles: number;
  halfLifeWeight: number;
  decayedEffectiveness: number;
  shouldRetire: boolean;
}

export function computePolicyOutcomeDelta(
  policyId: string,
  baseline: number,
  current: number,
  cycleWindow = 3,
): PolicyOutcomeDelta {
  const safeBaseline = Number.isFinite(Number(baseline)) ? Number(baseline) : 0;
  const safeCurrent = Number.isFinite(Number(current)) ? Number(current) : 0;
  const delta = Math.round((safeCurrent - safeBaseline) * 1000) / 1000;
  return {
    policyId: String(policyId || "").trim(),
    baseline: safeBaseline,
    current: safeCurrent,
    delta,
    cycleWindow: Math.max(1, Math.floor(Number(cycleWindow) || 1)),
  };
}

export function buildPolicyImpactEntry(
  policyId: string,
  metric: string,
  baseline: number,
  current: number,
  opts: { cycleId?: string; measuredAt?: string; minImprovementDelta?: number } = {},
): PolicyImpactEntry {
  const deltaObj = computePolicyOutcomeDelta(policyId, baseline, current, 1);
  const threshold = Number.isFinite(Number(opts.minImprovementDelta)) ? Number(opts.minImprovementDelta) : 0.01;
  return {
    policyId: deltaObj.policyId,
    metric: String(metric || "capacity_delta"),
    baseline: deltaObj.baseline,
    current: deltaObj.current,
    delta: deltaObj.delta,
    improved: deltaObj.delta >= threshold,
    measuredAt: String(opts.measuredAt || new Date().toISOString()),
    ...(opts.cycleId ? { cycleId: String(opts.cycleId) } : {}),
  };
}

export function computePolicyImpactTrend(
  policyId: string,
  impactEntries: PolicyImpactEntry[],
): PolicyImpactTrend {
  const filtered = Array.isArray(impactEntries)
    ? impactEntries.filter((entry) => String(entry?.policyId || "") === String(policyId || ""))
    : [];
  const totalMeasurements = filtered.length;
  const improvedCount = filtered.filter((entry) => entry.improved === true).length;
  const ineffectiveCount = totalMeasurements - improvedCount;
  const last = totalMeasurements > 0 ? filtered[totalMeasurements - 1] : null;
  return {
    policyId: String(policyId || "").trim(),
    totalMeasurements,
    improvedCount,
    ineffectiveCount,
    improvementRate: totalMeasurements > 0 ? Math.round((improvedCount / totalMeasurements) * 1000) / 1000 : 0,
    lastDelta: Number(last?.delta || 0),
    lastMeasuredAt: last?.measuredAt || null,
  };
}

export function applyPolicyDecay(
  policies: any[],
  deltas: PolicyOutcomeDelta[],
  opts: { minDelta?: number; maxInactiveCycles?: number } = {},
): { active: any[]; retired: any[] } {
  if (!Array.isArray(policies)) return { active: [], retired: [] };
  const minDelta = Number.isFinite(Number(opts.minDelta)) ? Number(opts.minDelta) : 0.01;
  const maxInactiveCycles = Number.isFinite(Number(opts.maxInactiveCycles)) ? Number(opts.maxInactiveCycles) : 3;
  const deltaById = new Map((Array.isArray(deltas) ? deltas : []).map((d) => [d.policyId, d]));
  const active: any[] = [];
  const retired: any[] = [];

  for (const policy of policies) {
    const id = String(policy?.id || "");
    const delta = deltaById.get(id);
    if (!delta) {
      active.push(policy);
      continue;
    }
    const inactiveCycles = Number.isFinite(Number((policy as any)?._inactiveCycles))
      ? Number((policy as any)?._inactiveCycles)
      : 0;
    const improvesCapacity = delta.delta >= minDelta;
    if (improvesCapacity) {
      active.push({ ...policy, _inactiveCycles: 0, _lastDelta: delta.delta });
      continue;
    }
    const nextInactiveCycles = inactiveCycles + 1;
    if (nextInactiveCycles >= maxInactiveCycles) {
      retired.push({
        ...policy,
        _retiredAt: new Date().toISOString(),
        _retirementReason: `No measurable capacity improvement for ${nextInactiveCycles} cycles (delta=${delta.delta})`,
        _lastDelta: delta.delta,
      });
    } else {
      active.push({ ...policy, _inactiveCycles: nextInactiveCycles, _lastDelta: delta.delta });
    }
  }

  return { active, retired };
}

export function applyPolicyHalfLifeRetirement(
  policies: any[],
  impactTrends: PolicyImpactTrend[],
  opts: { halfLifeCycles?: number; minEffectiveness?: number; minInactiveCycles?: number } = {},
): { active: any[]; retired: any[] } {
  if (!Array.isArray(policies)) return { active: [], retired: [] };
  const minEffectiveness = Number.isFinite(Number(opts.minEffectiveness)) ? Number(opts.minEffectiveness) : 0.2;
  const minInactiveCycles = Number.isFinite(Number(opts.minInactiveCycles)) ? Number(opts.minInactiveCycles) : 2;
  const trendByPolicyId = new Map(
    (Array.isArray(impactTrends) ? impactTrends : []).map((trend) => [String(trend?.policyId || ""), trend]),
  );
  const active: any[] = [];
  const retired: any[] = [];

  for (const policy of policies) {
    const policyId = String(policy?.id || "");
    const trend = trendByPolicyId.get(policyId);
    const inactiveCycles = Number.isFinite(Number((policy as any)?._inactiveCycles))
      ? Number((policy as any)._inactiveCycles)
      : 0;
    const improvementRate = Number.isFinite(Number(trend?.improvementRate)) ? Number(trend?.improvementRate) : 0;
    const { halfLifeWeight, decayedEffectiveness } = computeDecayedPolicyEffectiveness(
      improvementRate,
      inactiveCycles,
      { halfLifeCycles: opts.halfLifeCycles },
    );

    if (inactiveCycles >= minInactiveCycles && decayedEffectiveness <= minEffectiveness) {
      retired.push({
        ...policy,
        _retiredAt: new Date().toISOString(),
        _retirementReason: `Policy decayed below effectiveness threshold (${decayedEffectiveness} <= ${minEffectiveness})`,
        _decayedEffectiveness: decayedEffectiveness,
      });
      continue;
    }

    active.push({
      ...policy,
      _halfLifeWeight: halfLifeWeight,
      _decayedEffectiveness: decayedEffectiveness,
    });
  }

  return { active, retired };
}

export function buildPolicyImpactAttribution(
  policy: any,
  trend: PolicyImpactTrend | undefined,
  baselineCapacityScore: number,
  currentCapacityScore: number,
  opts: { cycleId?: string; halfLifeCycles?: number; minEffectiveness?: number; minInactiveCycles?: number; minImprovementDelta?: number } = {},
): PolicyImpactAttribution {
  const policyId = String(policy?.id || "").trim();
  const cycleId = String(opts.cycleId || new Date().toISOString());
  const minImprovementDelta = Number.isFinite(Number(opts.minImprovementDelta)) ? Number(opts.minImprovementDelta) : 0.01;
  const safeBaseline = Number.isFinite(Number(baselineCapacityScore)) ? Number(baselineCapacityScore) : 0;
  const safeCurrent = Number.isFinite(Number(currentCapacityScore)) ? Number(currentCapacityScore) : 0;
  const delta = Math.round((safeCurrent - safeBaseline) * 1000) / 1000;
  const improved = delta >= minImprovementDelta;
  const priorInactiveCycles = Number.isFinite(Number(policy?._inactiveCycles))
    ? Number(policy._inactiveCycles)
    : 0;
  const inactiveCycles = improved ? 0 : priorInactiveCycles + 1;
  const improvementRate = Number.isFinite(Number(trend?.improvementRate))
    ? Number(trend?.improvementRate)
    : 0;
  const { halfLifeWeight, decayedEffectiveness } = computeDecayedPolicyEffectiveness(
    improvementRate,
    inactiveCycles,
    { halfLifeCycles: opts.halfLifeCycles },
  );
  const minEffectiveness = Number.isFinite(Number(opts.minEffectiveness)) ? Number(opts.minEffectiveness) : 0.2;
  const minInactiveCycles = Number.isFinite(Number(opts.minInactiveCycles)) ? Number(opts.minInactiveCycles) : 2;
  const shouldRetire = inactiveCycles >= minInactiveCycles && decayedEffectiveness <= minEffectiveness;

  return {
    policyId,
    cycleId,
    baselineCapacityScore: safeBaseline,
    currentCapacityScore: safeCurrent,
    delta,
    improved,
    improvementRate: Math.round(improvementRate * 1000) / 1000,
    inactiveCycles,
    halfLifeWeight,
    decayedEffectiveness,
    shouldRetire,
  };
}

export const POLICY_MUTATION_EVIDENCE_WINDOW = 3;
export const POLICY_MUTATION_MIN_COMBINED_SCORE = 0.55;

export interface InterventionRubricScore {
  interventionId: string;
  cycleId: string;
  policyId: string;
  dimensionScores: Record<string, number>;
  rubricScore: number;
  outcomeScore: number;
  combinedScore: number;
  scoredAt: string;
}

export interface PolicyMutationDecision {
  policyId: string;
  evidenceCount: number;
  rubricScore: number;
  outcomeScore: number;
  combinedScore: number;
  mutate: boolean;
  reason: string;
}

// ── Low-yield policy family retirement ───────────────────────────────────────

/**
 * Minimum policy impact yield below which a policy is considered low-yield.
 * Yield is measured as the average decayedEffectiveness across impact attribution
 * records for the policy family.
 */
export const LOW_YIELD_IMPACT_THRESHOLD = 0.15 as const;

/**
 * Minimum number of impact attribution records required before a policy can be
 * retired as low-yield. Prevents premature retirement on sparse data.
 */
export const LOW_YIELD_MIN_EVIDENCE_RECORDS = 2 as const;

/**
 * Retire low-yield policy families based on measured impact attribution.
 *
 * A policy is retired as "low-yield" when:
 *   1. There are at least LOW_YIELD_MIN_EVIDENCE_RECORDS attribution records for it.
 *   2. The average decayedEffectiveness across those records is below
 *      LOW_YIELD_IMPACT_THRESHOLD.
 *   3. The policy is NOT in the `protected` set (critical severity policies are
 *      kept until explicitly retired via closure evidence).
 *
 * This is distinct from half-life retirement (which uses cycle inactivity) —
 * low-yield retirement uses actual measured effectiveness scores from the
 * optimizer/attribution pipeline.
 *
 * @param policies         — active compiled policies
 * @param attributionRecords — PolicyImpactAttribution records (from buildPolicyImpactAttribution)
 * @param opts             — { lowYieldThreshold?, minEvidenceRecords?, retireOnlySeverities? }
 * @returns { active, retired } partitioned policy lists
 */
export function retireLowYieldPolicyFamilies(
  policies: any[],
  attributionRecords: PolicyImpactAttribution[],
  opts: {
    lowYieldThreshold?: number;
    minEvidenceRecords?: number;
    retireOnlySeverities?: string[];
  } = {},
): { active: any[]; retired: any[] } {
  if (!Array.isArray(policies)) return { active: [], retired: [] };

  const threshold = Number.isFinite(Number(opts.lowYieldThreshold))
    ? Number(opts.lowYieldThreshold)
    : LOW_YIELD_IMPACT_THRESHOLD;
  const minRecords = Number.isFinite(Number(opts.minEvidenceRecords))
    ? Math.max(1, Math.floor(Number(opts.minEvidenceRecords)))
    : LOW_YIELD_MIN_EVIDENCE_RECORDS;
  const allowedSeverities = Array.isArray(opts.retireOnlySeverities)
    ? new Set(opts.retireOnlySeverities.map((s) => String(s).toLowerCase()))
    : null; // null = retire any severity

  // Build impact attribution index by policyId
  const effectivenessByPolicyId = new Map<string, number[]>();
  for (const record of (Array.isArray(attributionRecords) ? attributionRecords : [])) {
    const id = String(record?.policyId || "").trim();
    if (!id) continue;
    const eff = Number(record?.decayedEffectiveness);
    if (!Number.isFinite(eff)) continue;
    if (!effectivenessByPolicyId.has(id)) effectivenessByPolicyId.set(id, []);
    effectivenessByPolicyId.get(id)!.push(Math.max(0, Math.min(1, eff)));
  }

  const active: any[] = [];
  const retired: any[] = [];

  for (const policy of policies) {
    const policyId = String(policy?.id || "").trim();
    const severity = String(policy?.severity || "warning").toLowerCase();

    // Skip if severity filter is set and doesn't match
    if (allowedSeverities !== null && !allowedSeverities.has(severity)) {
      active.push(policy);
      continue;
    }

    const records = effectivenessByPolicyId.get(policyId);
    if (!records || records.length < minRecords) {
      active.push(policy);
      continue;
    }

    const avgEffectiveness = records.reduce((s, v) => s + v, 0) / records.length;
    if (avgEffectiveness <= threshold) {
      retired.push({
        ...policy,
        _retiredAt: new Date().toISOString(),
        _retirementReason: `Low-yield policy family: avg effectiveness ${Math.round(avgEffectiveness * 1000) / 1000} <= threshold ${threshold} over ${records.length} attribution records`,
        _avgDecayedEffectiveness: Math.round(avgEffectiveness * 1000) / 1000,
        _evidenceRecordCount: records.length,
      });
    } else {
      active.push({
        ...policy,
        _avgDecayedEffectiveness: Math.round(avgEffectiveness * 1000) / 1000,
        _evidenceRecordCount: records.length,
      });
    }
  }

  return { active, retired };
}

export interface PolicyMutationResult {
  routed: ReturnType<typeof deriveRoutingAdjustments>;
  promptConstraints: ReturnType<typeof buildPromptHardConstraints>;
  decisions: PolicyMutationDecision[];
  deferred: Array<{ policyId: string; reason: string }>;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeDimensionScores(input: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const dim of EQUAL_DIMENSION_SET) {
    const v = Number(input?.[dim]);
    out[dim] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  }
  return out;
}

export function buildInterventionRubricScore(
  interventionId: string,
  cycleId: string,
  policyId: string,
  dimensionScores: Record<string, number>,
  outcomeScore: number,
): InterventionRubricScore {
  const normalized = normalizeDimensionScores(dimensionScores);
  const rubricAverage = EQUAL_DIMENSION_SET.reduce((sum, dim) => sum + normalized[dim], 0) / EQUAL_DIMENSION_SET.length;
  const boundedOutcome = Math.max(0, Math.min(1, Number.isFinite(Number(outcomeScore)) ? Number(outcomeScore) : 0));
  const combined = (rubricAverage * 0.6) + (boundedOutcome * 0.4);
  return {
    interventionId: String(interventionId || "").trim(),
    cycleId: String(cycleId || "").trim(),
    policyId: String(policyId || "").trim(),
    dimensionScores: normalized,
    rubricScore: round3(rubricAverage),
    outcomeScore: round3(boundedOutcome),
    combinedScore: round3(combined),
    scoredAt: new Date().toISOString(),
  };
}

export function decidePolicyMutationsFromEvidenceWindow(
  activePolicies: any[],
  scoredInterventions: InterventionRubricScore[],
  opts: { evidenceWindowCycles?: number; minCombinedScore?: number } = {},
): PolicyMutationResult {
  const policies = Array.isArray(activePolicies) ? activePolicies : [];
  const evidence = Array.isArray(scoredInterventions) ? scoredInterventions : [];
  const evidenceWindowCycles = Math.max(1, Math.floor(Number(opts.evidenceWindowCycles ?? POLICY_MUTATION_EVIDENCE_WINDOW)));
  const minCombinedScore = Number.isFinite(Number(opts.minCombinedScore))
    ? Number(opts.minCombinedScore)
    : POLICY_MUTATION_MIN_COMBINED_SCORE;

  const decisions: PolicyMutationDecision[] = [];
  const deferred: Array<{ policyId: string; reason: string }> = [];
  const mutablePolicies: any[] = [];

  for (const policy of policies) {
    const policyId = String(policy?.id || "");
    if (!policyId) continue;
    const forPolicy = evidence
      .filter((entry) => String(entry?.policyId || "") === policyId)
      .slice(-evidenceWindowCycles);
    if (forPolicy.length < evidenceWindowCycles) {
      deferred.push({
        policyId,
        reason: `insufficient_evidence_window:${forPolicy.length}/${evidenceWindowCycles}`,
      });
      decisions.push({
        policyId,
        evidenceCount: forPolicy.length,
        rubricScore: 0,
        outcomeScore: 0,
        combinedScore: 0,
        mutate: false,
        reason: "insufficient_evidence_window",
      });
      continue;
    }
    const rubricScore = round3(forPolicy.reduce((sum, entry) => sum + Number(entry.rubricScore || 0), 0) / forPolicy.length);
    const outcomeScore = round3(forPolicy.reduce((sum, entry) => sum + Number(entry.outcomeScore || 0), 0) / forPolicy.length);
    const combinedScore = round3(forPolicy.reduce((sum, entry) => sum + Number(entry.combinedScore || 0), 0) / forPolicy.length);
    const mutate = combinedScore >= minCombinedScore;
    decisions.push({
      policyId,
      evidenceCount: forPolicy.length,
      rubricScore,
      outcomeScore,
      combinedScore,
      mutate,
      reason: mutate ? "window_passed" : "combined_score_below_threshold",
    });
    if (mutate) mutablePolicies.push(policy);
  }

  return {
    routed: deriveRoutingAdjustments(mutablePolicies),
    promptConstraints: buildPromptHardConstraints(mutablePolicies),
    decisions,
    deferred,
  };
}

