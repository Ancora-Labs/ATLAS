/**
 * plan_contract_validator.js — Contract-first plan validation (Packet 2)
 *
 * Every plan emitted by Prometheus must pass this validator before persistence.
 * Invalid plans are tagged with violation details but still included (Athena
 * makes the final accept/reject decision).
 *
 * Required fields: task, role, wave, verification
 * Recommended fields: dependencies, filesInScope, acceptance_criteria
 */

import { checkForbiddenCommands } from "./verification_command_registry.js";

/**
 * Canonical deterministic violation code taxonomy.
 *
 * Used by both the pre-normalization generation-boundary gate
 * (checkPacketCompleteness in prometheus.ts) and the post-normalization
 * contract validator (validatePlanContract below).  Having a single source of
 * truth means log messages, rejection metadata, and filtering logic all
 * reference the same well-known codes rather than free-form field-name strings.
 *
 * Pre-normalization codes (shared with UNRECOVERABLE_PACKET_REASONS):
 *   NO_TASK_IDENTITY, MISSING_CAPACITY_DELTA, INVALID_CAPACITY_DELTA,
 *   MISSING_REQUEST_ROI, INVALID_REQUEST_ROI, MISSING_VERIFICATION_COUPLING
 *
 * Post-normalization contract codes:
 *   TASK_TOO_SHORT, MISSING_ROLE, INVALID_WAVE,
 *   MISSING_VERIFICATION, NON_SPECIFIC_VERIFICATION, FORBIDDEN_COMMAND,
 *   MISSING_ACCEPTANCE_CRITERIA, MISSING_DEPENDENCIES
 */
export const PACKET_VIOLATION_CODE = Object.freeze({
  // ── Identity ──────────────────────────────────────────────────────────────
  /** All identity fields (task/title/task_id/id) are absent. */
  NO_TASK_IDENTITY:              "no_task_identity",
  /** task field is present but too short (< 5 chars after normalization). */
  TASK_TOO_SHORT:                "task_too_short",
  /** role field is absent or empty. */
  MISSING_ROLE:                  "missing_role",

  // ── Wave ──────────────────────────────────────────────────────────────────
  /** wave is not a positive finite integer. */
  INVALID_WAVE:                  "invalid_wave",

  // ── Verification ─────────────────────────────────────────────────────────
  /** verification field is absent or blank. */
  MISSING_VERIFICATION:          "missing_verification",
  /** verification value is a bare CLI command with no test file reference. */
  NON_SPECIFIC_VERIFICATION:     "non_specific_verification",
  /** verification value or verification_commands entry contains a forbidden glob or shell pattern. */
  FORBIDDEN_COMMAND:             "forbidden_command",
  /** verification_commands is absent, empty, or contains only blank entries. */
  MISSING_VERIFICATION_COUPLING: "missing_verification_coupling",

  // ── Acceptance criteria ──────────────────────────────────────────────────
  /** acceptance_criteria is absent or empty — no measurable completion signal. */
  MISSING_ACCEPTANCE_CRITERIA:   "missing_acceptance_criteria",
  /** dependencies field is absent or not an array. */
  MISSING_DEPENDENCIES:          "missing_dependencies",

  // ── Decomposition / size ──────────────────────────────────────────────────
  /**
   * Task has too many acceptance criteria or files in scope — it is an oversized
   * compound task that must be decomposed into smaller work items.
   */
  TASK_TOO_LARGE:                "task_too_large",
  /**
   * Task description is too generic/vague — it does not specify a concrete
   * artifact, system component, or measurable outcome.
   */
  TASK_AMBIGUOUS:                "task_ambiguous",
  /**
   * Packet is too thin to admit dispatch after densification pass.
   * Thin packets must either be auto-bundled or rejected with explicit reasons.
   */
  THIN_PACKET_REJECTED:          "thin_packet_rejected",

  // ── Scoring fields (shared with generation-boundary gate) ────────────────
  /** capacityDelta is absent. */
  MISSING_CAPACITY_DELTA:        "missing_capacity_delta",
  /** capacityDelta is present but not a finite number ∈ [-1.0, 1.0]. */
  INVALID_CAPACITY_DELTA:        "invalid_capacity_delta",
  /** requestROI is absent. */
  MISSING_REQUEST_ROI:           "missing_request_roi",
  /** requestROI is present but not a positive finite number. */
  INVALID_REQUEST_ROI:           "invalid_request_roi",
});

/**
 * Verification values that are non-specific: bare CLI commands with no test file
 * reference or observable assertion description.
 * Per the Prometheus output format, `verification` MUST be a specific test file
 * path + expected test description, not a generic command invocation.
 */
export const NON_SPECIFIC_VERIFICATION_PATTERNS = [
  /^npm\s+test\s*$/i,
  /^npm\s+run\s+test\s*$/i,
  /^npm\s+run\s+tests\s*$/i,
  /^node\s+--test\s*$/i,
  /^npx\s+[a-z][\w-]*\s*$/i,
  /^run\s+tests?\s*$/i,
  /^tests?\s+pass\s*$/i,
];

/**
 * Maximum number of acceptance criteria a single plan task may declare.
 * Plans exceeding this threshold are oversized compound tasks that should be
 * decomposed into smaller, independently-verifiable work items.
 */
export const MAX_ACCEPTANCE_CRITERIA_PER_TASK = 10;

/**
 * Maximum number of files a single plan task may declare in its scope
 * (filesInScope or target_files). Plans with broader file coverage are
 * oversized compound tasks.
 */
export const MAX_FILES_IN_SCOPE_PER_TASK = 30;

/**
 * Regex patterns matching ambiguous, underspecified task descriptions.
 * A description is ambiguous when it contains only generic action/noun
 * vocabulary without specifying a concrete artifact, system component, or
 * measurable outcome.
 */
export const AMBIGUOUS_TASK_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /^fix\s*(bugs?|issues?|things?|stuff|it|that|this|them)?\s*$/i,
  /^update\s*(code|system|things?|stuff|it|that|this|them)?\s*$/i,
  /^improve\s*(system|code|things?|stuff|it|performance|quality)?\s*$/i,
  /^refactor\s*(code|things?|stuff|it|that|this|them)?\s*$/i,
  /^clean\s*up\s*(code|things?|stuff|it|that|this|them)?\s*$/i,
  /^misc(ellaneous)?\s*(changes?|updates?|fixes?)?\s*$/i,
  /^general\s*(cleanup|refactor|update|fix|improvement|changes?)?\s*$/i,
  /^various\s*(updates?|changes?|fixes?|improvements?)?\s*$/i,
  /^add\s+tests?\s*$/i,
  /^write\s+tests?\s*$/i,
]);

/**
 * Minimum length for an exclusion justification to be considered cycle-specific.
 * Shared with mandatoryTaskCoverage validation in Prometheus.
 */
export const MANDATORY_EXCLUSION_JUSTIFICATION_MIN_LENGTH = 12;

/** Canonical 10 planning dimensions used by Prometheus/critic leverage scoring. */
export const EQUAL_DIMENSION_SET = Object.freeze([
  "architecture",
  "speed",
  "task-quality",
  "prompt-quality",
  "parser-quality",
  "worker-specialization",
  "model-task-fit",
  "learning-loop",
  "cost-efficiency",
  "security",
]);

const DIMENSION_ALIAS_TO_CANONICAL = Object.freeze({
  architecture: "architecture",
  speed: "speed",
  quality: "task-quality",
  "task quality": "task-quality",
  "task-quality": "task-quality",
  prompts: "prompt-quality",
  prompt: "prompt-quality",
  "prompt quality": "prompt-quality",
  "prompt-quality": "prompt-quality",
  parser: "parser-quality",
  normalization: "parser-quality",
  "parser quality": "parser-quality",
  "parser-quality": "parser-quality",
  worker: "worker-specialization",
  workers: "worker-specialization",
  "worker specialization": "worker-specialization",
  "worker-specialization": "worker-specialization",
  routing: "model-task-fit",
  "model-task fit": "model-task-fit",
  "model-task-fit": "model-task-fit",
  learning: "learning-loop",
  "learning loop": "learning-loop",
  "learning-loop": "learning-loop",
  roi: "cost-efficiency",
  cost: "cost-efficiency",
  "cost efficiency": "cost-efficiency",
  "cost-efficiency": "cost-efficiency",
  security: "security",
}) as Readonly<Record<string, string>>;

/**
 * Determine whether a task description is ambiguous/underspecified.
 * Returns true when the description matches a known generic-vocabulary pattern.
 *
 * @param {string} value - the plan's `task` field
 * @returns {boolean} true when the task is ambiguous
 */
export function isAmbiguousTask(value: string): boolean {
  if (!value || !String(value).trim()) return true;
  const v = String(value).trim();
  return AMBIGUOUS_TASK_PATTERNS.some(pattern => pattern.test(v));
}

/**
 * Validate that an exclusion justification is concrete enough for cycle-specific
 * auditing (not just a generic placeholder).
 *
 * @param {string} value - mandatoryTaskCoverage exclusion justification
 * @returns {boolean} true when justification is non-empty and sufficiently specific
 */
export function isCycleSpecificExclusionJustification(value: string): boolean {
  return String(value || "").trim().length >= MANDATORY_EXCLUSION_JUSTIFICATION_MIN_LENGTH;
}

export function normalizeLeverageRank(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const canonical: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const normalized = String(raw || "").toLowerCase().replace(/[_]+/g, "-").replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const directKey = normalized.replace(/\s+/g, "-");
    const mapped = DIMENSION_ALIAS_TO_CANONICAL[normalized] || DIMENSION_ALIAS_TO_CANONICAL[directKey];
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    canonical.push(mapped);
  }
  return canonical;
}

/**
 * Determine whether a `verification` field value is non-specific.
 * A value is non-specific when it contains no test file reference (`.test.ts`,
 * `.test.js`, `.spec.ts`, etc.) and no test description separator (`— test:`)
 * and matches a known bare CLI command pattern.
 *
 * @param {string} value - the plan's `verification` field
 * @returns {boolean} true when non-specific (should be rejected)
 */
export function isNonSpecificVerification(value: string): boolean {
  if (!value || !String(value).trim()) return true;
  const v = String(value).trim();
  // Specific: references a test file by extension
  if (/\.(test|spec)\.(ts|js|tsx|jsx)/i.test(v)) return false;
  // Specific: references a tests/ directory path
  if (/\/tests?\/[^\s]/.test(v)) return false;
  // Specific: contains a description separator used by the output format
  if (/[—\-–]\s*test[:\s]/i.test(v)) return false;
  // Non-specific: matches a known bare CLI command (no file argument)
  return /^(npm|node|npx)\s/i.test(v) || /^run\s+(test|check)/i.test(v);
}

/**
 * Plan contract violation severity levels.
 * @enum {string}
 */
export const PLAN_VIOLATION_SEVERITY = Object.freeze({
  CRITICAL: "critical",
  WARNING: "warning",
});

/**
 * A single contract violation emitted by validatePlanContract.
 * `code` is a deterministic value from PACKET_VIOLATION_CODE and is the
 * canonical identifier for machine consumption; `message` is human-readable.
 */
export interface PlanViolation {
  field: string;
  message: string;
  severity: string;
  code: string;
}

/**
 * Validate a single plan against the contract schema.
 *
 * @param {object} plan
 * @returns {{ valid: boolean, violations: PlanViolation[] }}
 */
export function validatePlanContract(plan): { valid: boolean; violations: PlanViolation[] } {
  if (!plan || typeof plan !== "object") {
    return {
      valid: false,
      violations: [{
        field: "plan",
        message: "Plan is null or not an object",
        severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
        code: PACKET_VIOLATION_CODE.NO_TASK_IDENTITY,
      }],
    };
  }

  const violations: PlanViolation[] = [];

  if (plan._thinPacketRejected === true) {
    violations.push({
      field: "packetDensity",
      message: String(plan._thinPacketReason || "Thin packet rejected by dispatch admission contract"),
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.THIN_PACKET_REJECTED,
    });
  }

  // Required fields
  if (!plan.task || String(plan.task).trim().length < 5) {
    violations.push({
      field: "task",
      message: "Task must be a non-empty string (≥5 chars)",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.TASK_TOO_SHORT,
    });
  } else if (isAmbiguousTask(String(plan.task))) {
    // Only flag ambiguity when the task passes the length check (avoids duplicate errors).
    violations.push({
      field: "task",
      message: `Task description is too generic/ambiguous: "${String(plan.task).trim().slice(0, 80)}". ` +
        "Specify a concrete artifact, system component, or measurable outcome.",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.TASK_AMBIGUOUS,
    });
  }

  if (!plan.role || String(plan.role).trim().length === 0) {
    violations.push({
      field: "role",
      message: "Role must be specified",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.MISSING_ROLE,
    });
  }

  const wave = Number(plan.wave);
  if (!Number.isFinite(wave) || wave < 1) {
    violations.push({
      field: "wave",
      message: `Wave must be a positive integer, got: ${plan.wave}`,
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.INVALID_WAVE,
    });
  }

  if (!plan.verification || String(plan.verification).trim().length === 0) {
    violations.push({
      field: "verification",
      message: "Verification command must be specified",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.MISSING_VERIFICATION,
    });
  } else if (isNonSpecificVerification(String(plan.verification))) {
    violations.push({
      field: "verification",
      message: `Verification target is non-specific: "${String(plan.verification).trim()}". ` +
        "Must reference a specific test file (e.g. tests/core/foo.test.ts — test: expected description). " +
        "Generic commands like 'npm test' alone are rejected.",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.NON_SPECIFIC_VERIFICATION,
    });
  }

  // Recommended fields
  if (!Array.isArray(plan.dependencies)) {
    violations.push({
      field: "dependencies",
      message: "Dependencies should be an array",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.MISSING_DEPENDENCIES,
    });
  }

  if (!Array.isArray(plan.acceptance_criteria) || plan.acceptance_criteria.length === 0) {
    violations.push({
      field: "acceptance_criteria",
      message: "Acceptance criteria must be a non-empty array — plans without measurable AC are rejected",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.MISSING_ACCEPTANCE_CRITERIA,
    });
  } else if (plan.acceptance_criteria.length > MAX_ACCEPTANCE_CRITERIA_PER_TASK) {
    // Oversized AC list — the task is compound and must be decomposed.
    violations.push({
      field: "acceptance_criteria",
      message: `Task has ${plan.acceptance_criteria.length} acceptance criteria (max ${MAX_ACCEPTANCE_CRITERIA_PER_TASK}). ` +
        "Oversized tasks must be decomposed into smaller, independently-verifiable work items.",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.TASK_TOO_LARGE,
    });
  }

  // Decomposition cap: files-in-scope ceiling.
  const inScopeFiles: unknown[] | null = Array.isArray(plan.filesInScope)
    ? plan.filesInScope
    : Array.isArray(plan.target_files)
      ? plan.target_files
      : null;
  if (inScopeFiles !== null && inScopeFiles.length > MAX_FILES_IN_SCOPE_PER_TASK) {
    violations.push({
      field: "filesInScope",
      message: `Task declares ${inScopeFiles.length} files in scope (max ${MAX_FILES_IN_SCOPE_PER_TASK}). ` +
        "Tasks with broad file coverage are oversized — decompose into focused work items.",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.TASK_TOO_LARGE,
    });
  }

  // Measurable capacity delta — expected change in system capacity if plan succeeds.
  // Mandatory field: finite number ∈ [-1.0, 1.0]. Plans without a valid capacityDelta
  // are rejected — they cannot be ranked or compared against budget constraints.
  if (!("capacityDelta" in plan)) {
    violations.push({
      field: "capacityDelta",
      message: "capacityDelta is missing — plans must declare the expected measurable change in system capacity (number ∈ [-1.0, 1.0])",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.MISSING_CAPACITY_DELTA,
    });
  } else {
    const cd = Number(plan.capacityDelta);
    if (!Number.isFinite(cd) || cd < -1 || cd > 1) {
      violations.push({
        field: "capacityDelta",
        message: `capacityDelta must be a finite number ∈ [-1.0, 1.0]; got: ${plan.capacityDelta}`,
        severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
        code: PACKET_VIOLATION_CODE.INVALID_CAPACITY_DELTA,
      });
    }
  }

  // Request ROI — expected return-on-investment for the premium request consumed.
  // Mandatory field: positive finite number (dimensionless gain ratio). Plans without
  // a valid requestROI are rejected — they cannot be ranked by cost-effectiveness.
  if (!("requestROI" in plan)) {
    violations.push({
      field: "requestROI",
      message: "requestROI is missing — plans must declare the expected return-on-investment for the premium request consumed (positive finite number)",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.MISSING_REQUEST_ROI,
    });
  } else {
    const roi = Number(plan.requestROI);
    if (!Number.isFinite(roi) || roi <= 0) {
      violations.push({
        field: "requestROI",
        message: `requestROI must be a positive finite number; got: ${plan.requestROI}`,
        severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
        code: PACKET_VIOLATION_CODE.INVALID_REQUEST_ROI,
      });
    }
  }

  // Forbidden verification command gate (Packet 5) — uses centralized registry.
  // Check all command-bearing fields: verification (string) and
  // verification_commands (array) so Windows false-fails can't slip through
  // a non-primary command field.
  const commandsToCheck: Array<{ field: string; value: string }> = [
    { field: "verification", value: String(plan.verification || "") },
  ];

  if (Array.isArray(plan.verification_commands)) {
    plan.verification_commands.forEach((cmd: unknown, idx: number) => {
      commandsToCheck.push({ field: `verification_commands[${idx}]`, value: String(cmd || "") });
    });
  }

  for (const { field, value } of commandsToCheck) {
    const forbidden = checkForbiddenCommands(value);
    if (forbidden.forbidden) {
      for (const v of forbidden.violations) {
        violations.push({
          field,
          message: `Forbidden command: ${v.reason}`,
          severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
          code: PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND,
        });
      }
    }
  }

  const criticalCount = violations.filter(v => v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL).length;
  return { valid: criticalCount === 0, violations };
}
/**
 * Validate all plans in a batch and compute aggregate pass rate.
 *
 * @param {object[]} plans
 * @returns {{ passRate: number, totalPlans: number, validCount: number, invalidCount: number, results: Array<{ planIndex: number, task: string, valid: boolean, violations: object[] }> }}
 */
export function validateAllPlans(plans) {
  if (!Array.isArray(plans) || plans.length === 0) {
    return { passRate: 1.0, totalPlans: 0, validCount: 0, invalidCount: 0, results: [] };
  }

  const results = plans.map((plan, i) => {
    const r = validatePlanContract(plan);
    return {
      planIndex: i,
      task: String(plan?.task || "").slice(0, 80),
      valid: r.valid,
      violations: r.violations,
    };
  });

  const validCount = results.filter(r => r.valid).length;
  const invalidCount = results.length - validCount;
  const passRate = Math.round((validCount / results.length) * 100) / 100;

  return { passRate, totalPlans: results.length, validCount, invalidCount, results };
}

// ── Quarantine gate ───────────────────────────────────────────────────────────

/**
 * Confidence threshold below which a packet is considered quarantined.
 * Mirrors the value exported by prometheus.ts so both modules share the same gate.
 */
export const QUARANTINE_CONFIDENCE_THRESHOLD = 0.5 as const;

/**
 * Determine whether a plan packet should be quarantined from dispatch.
 *
 * A packet is quarantined when:
 *   1. It carries `_quarantined: true` (explicitly set by quarantineLowConfidencePackets), or
 *   2. It has a `_provenance.confidence` value that is strictly below QUARANTINE_CONFIDENCE_THRESHOLD.
 *
 * Packets without provenance metadata pass through (backward compatible).
 *
 * @param packet — any plan object
 * @returns true when the packet must not be dispatched
 */
export function isPacketQuarantined(packet: any): boolean {
  if (!packet || typeof packet !== "object") return false;
  if (packet._quarantined === true) return true;
  if (typeof packet._provenance?.confidence === "number") {
    return packet._provenance.confidence < QUARANTINE_CONFIDENCE_THRESHOLD;
  }
  return false;
}
