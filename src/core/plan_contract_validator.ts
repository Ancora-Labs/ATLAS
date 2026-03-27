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
 * Validate a single plan against the contract schema.
 *
 * @param {object} plan
 * @returns {{ valid: boolean, violations: Array<{ field: string, message: string, severity: string }> }}
 */
export function validatePlanContract(plan) {
  if (!plan || typeof plan !== "object") {
    return { valid: false, violations: [{ field: "plan", message: "Plan is null or not an object", severity: PLAN_VIOLATION_SEVERITY.CRITICAL }] };
  }

  const violations = [];

  // Required fields
  if (!plan.task || String(plan.task).trim().length < 5) {
    violations.push({ field: "task", message: "Task must be a non-empty string (≥5 chars)", severity: PLAN_VIOLATION_SEVERITY.CRITICAL });
  }

  if (!plan.role || String(plan.role).trim().length === 0) {
    violations.push({ field: "role", message: "Role must be specified", severity: PLAN_VIOLATION_SEVERITY.CRITICAL });
  }

  const wave = Number(plan.wave);
  if (!Number.isFinite(wave) || wave < 1) {
    violations.push({ field: "wave", message: `Wave must be a positive integer, got: ${plan.wave}`, severity: PLAN_VIOLATION_SEVERITY.WARNING });
  }

  if (!plan.verification || String(plan.verification).trim().length === 0) {
    violations.push({ field: "verification", message: "Verification command must be specified", severity: PLAN_VIOLATION_SEVERITY.WARNING });
  } else if (isNonSpecificVerification(String(plan.verification))) {
    violations.push({
      field: "verification",
      message: `Verification target is non-specific: "${String(plan.verification).trim()}". ` +
        "Must reference a specific test file (e.g. tests/core/foo.test.ts — test: expected description). " +
        "Generic commands like 'npm test' alone are rejected.",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
    });
  }

  // Recommended fields
  if (!Array.isArray(plan.dependencies)) {
    violations.push({ field: "dependencies", message: "Dependencies should be an array", severity: PLAN_VIOLATION_SEVERITY.WARNING });
  }

  if (!Array.isArray(plan.acceptance_criteria) || plan.acceptance_criteria.length === 0) {
    violations.push({ field: "acceptance_criteria", message: "Acceptance criteria must be a non-empty array — plans without measurable AC are rejected", severity: PLAN_VIOLATION_SEVERITY.CRITICAL });
  }

  // Measurable capacity delta — expected change in system capacity if plan succeeds.
  // Mandatory field: finite number ∈ [-1.0, 1.0]. Plans without a valid capacityDelta
  // are rejected — they cannot be ranked or compared against budget constraints.
  if (!("capacityDelta" in plan)) {
    violations.push({
      field: "capacityDelta",
      message: "capacityDelta is missing — plans must declare the expected measurable change in system capacity (number ∈ [-1.0, 1.0])",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL
    });
  } else {
    const cd = Number(plan.capacityDelta);
    if (!Number.isFinite(cd) || cd < -1 || cd > 1) {
      violations.push({
        field: "capacityDelta",
        message: `capacityDelta must be a finite number ∈ [-1.0, 1.0]; got: ${plan.capacityDelta}`,
        severity: PLAN_VIOLATION_SEVERITY.CRITICAL
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
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL
    });
  } else {
    const roi = Number(plan.requestROI);
    if (!Number.isFinite(roi) || roi <= 0) {
      violations.push({
        field: "requestROI",
        message: `requestROI must be a positive finite number; got: ${plan.requestROI}`,
        severity: PLAN_VIOLATION_SEVERITY.CRITICAL
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
        violations.push({ field, message: `Forbidden command: ${v.reason}`, severity: PLAN_VIOLATION_SEVERITY.CRITICAL });
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
