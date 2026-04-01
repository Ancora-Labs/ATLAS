/**
 * evidence_envelope.ts — Shared evidence contract between evolution executor
 * and Athena postmortem reviewer.
 *
 * Keeping these types in a standalone module avoids the circular import that
 * would result from evolution_executor.ts ↔ athena_reviewer.ts cross-importing.
 */

// ── Verification evidence ──────────────────────────────────────────────────────

/**
 * Slot-level pass/fail evidence derived from local verification command results.
 * "n/a" means the corresponding check was not exercised in this run.
 */
export type VerificationEvidence = {
  build: "pass" | "fail" | "n/a";
  tests: "pass" | "fail" | "n/a";
  lint:  "pass" | "fail" | "n/a";
};

// ── PR checks snapshot ────────────────────────────────────────────────────────

export type PrChecksSnapshot = {
  ok: boolean;
  passed: boolean;
  failed: string[];
  pending: string[];
  total: number;
  error?: string;
};

// ── Canonical evidence envelope ───────────────────────────────────────────────

/**
 * Canonical evidence envelope passed from the evolution executor to Athena's
 * postmortem reviewer.
 *
 * All fields that Athena reads must be declared here.  Adding ad-hoc fields on
 * the caller side is unsafe because Athena's deterministic fast-path gate reads
 * specific keys to decide whether to skip the premium AI call.
 *
 * Fast-path gate conditions (in runAthenaPostmortem):
 *   status === "done"
 *   && verificationPassed === true
 *   && verificationEvidence.build === "pass"
 *   && verificationEvidence.tests === "pass"
 */
export type EvidenceEnvelope = {
  /** Slug name of the worker role (e.g. "evolution-worker"). */
  roleName: string;
  /** BOX_STATUS emitted by the worker: "done" | "partial" | "blocked" | "error". */
  status: string;
  /** PR URL if the worker opened or updated a pull request. */
  prUrl?: string;
  /** Human-readable worker summary, may include a serialised VERIFICATION_REPORT. */
  summary: string;
  /** Files modified by the worker (BOX_FILES_TOUCHED). */
  filesTouched?: string[] | string;
  /** Concatenated stdout of local verification commands (human-readable). */
  verificationOutput?: string;
  /** True iff every non-blocked verification command exited 0. */
  verificationPassed?: boolean;
  /**
   * Slot-level evidence — required for Athena deterministic fast-path.
   * Must be populated by buildVerificationEvidence() before being passed to Athena.
   */
  verificationEvidence: VerificationEvidence;
  /** Remote CI check results read after the worker created/updated its PR. */
  prChecks?: PrChecksSnapshot;
  /** Athena pre-review summary given to the worker before execution. */
  preReviewAssessment?: string | null;
  /** Issues Athena flagged in the pre-review that the worker was asked to address. */
  preReviewIssues?: string[];
};

// ── Envelope structure validation ─────────────────────────────────────────────

const VALID_EVIDENCE_VALUES = new Set(["pass", "fail", "n/a"]);

/**
 * Known template placeholder literals that constitute unfilled post-merge artifact residue.
 * Any of these appearing in envelope string fields indicate the worker did not
 * replace the output template with real content.
 *
 * These must stay in sync with the constants exported from verification_gate.ts.
 * They are intentionally duplicated here (rather than imported) to avoid a
 * circular dependency: evidence_envelope ← verification_gate would form a cycle
 * because verification_gate already imports from evidence_envelope indirectly.
 */
const ENVELOPE_PLACEHOLDER_RESIDUES: readonly string[] = Object.freeze([
  "POST_MERGE_TEST_OUTPUT",
  "<paste git rev-parse HEAD here>",
  "<paste full raw npm test stdout here>",
]);

/**
 * Determine whether a string field in the envelope contains unfilled template
 * placeholder residue that must be rejected before the envelope reaches Athena.
 *
 * @param value — string value of an envelope field
 * @returns true when the value contains a known unfilled placeholder literal
 */
export function envelopeFieldHasPlaceholderResidue(value: string): boolean {
  return ENVELOPE_PLACEHOLDER_RESIDUES.some(p => value.includes(p));
}

/**
 * Validate the structure of an EvidenceEnvelope before it is passed to Athena.
 *
 * Required fields: roleName (string), status (string), summary (string),
 * verificationEvidence (object with build/tests/lint slots).
 * Each evidence slot must be "pass" | "fail" | "n/a".
 *
 * Additionally, the summary field must not contain unfilled post-merge artifact
 * template placeholders — such residue indicates the worker did not complete
 * the required artifact fields before submitting.
 *
 * @param envelope — value to validate (untrusted)
 * @returns { valid: boolean; errors: string[] }
 */
export function validateEvidenceEnvelope(envelope: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!envelope || typeof envelope !== "object") {
    return { valid: false, errors: ["envelope must be a non-null object"] };
  }

  const e = envelope as Record<string, unknown>;

  if (typeof e.roleName !== "string" || e.roleName.trim() === "") {
    errors.push("roleName must be a non-empty string");
  }
  if (typeof e.status !== "string" || e.status.trim() === "") {
    errors.push("status must be a non-empty string");
  }
  if (typeof e.summary !== "string" || e.summary.trim() === "") {
    errors.push("summary must be a non-empty string");
  } else if (envelopeFieldHasPlaceholderResidue(e.summary)) {
    errors.push("summary contains unfilled template placeholder residue — replace placeholder text with actual content");
  }

  const ev = e.verificationEvidence;
  if (!ev || typeof ev !== "object") {
    errors.push("verificationEvidence must be a non-null object");
  } else {
    const evObj = ev as Record<string, unknown>;
    for (const slot of ["build", "tests", "lint"] as const) {
      if (!VALID_EVIDENCE_VALUES.has(evObj[slot] as string)) {
        errors.push(`verificationEvidence.${slot} must be "pass", "fail", or "n/a"; got ${JSON.stringify(evObj[slot])}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Plan dispatch evidence coupling validation ────────────────────────────────

/**
 * Validate that a plan packet has adequate evidence coupling before it enters
 * the dispatch pipeline.
 *
 * A plan must carry at least one non-empty verification command and at least
 * one acceptance criterion so that automated completion signals can be verified
 * after the worker runs.  Plans that fail this check must be blocked at the
 * governance gate, not silently dispatched with unverifiable outcomes.
 *
 * @param plan — plan object as produced by Prometheus normalization (untrusted)
 * @returns { valid: boolean; errors: string[] }
 */
export function validatePlanEvidenceCoupling(plan: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!plan || typeof plan !== "object") {
    return { valid: false, errors: ["plan must be a non-null object"] };
  }

  const p = plan as Record<string, unknown>;

  // verification_commands: must be a non-empty array with ≥1 non-empty string.
  const cmds = p.verification_commands;
  if (!Array.isArray(cmds) || cmds.length === 0) {
    errors.push("plan.verification_commands must be a non-empty array");
  } else {
    const nonEmpty = cmds.filter(c => typeof c === "string" && String(c).trim().length > 0);
    if (nonEmpty.length === 0) {
      errors.push("plan.verification_commands must contain at least one non-empty command string");
    }
  }

  // acceptance_criteria: must be a non-empty string or non-empty array of strings.
  const ac = p.acceptance_criteria;
  const acValid =
    (typeof ac === "string" && ac.trim().length > 0) ||
    (Array.isArray(ac) && ac.length > 0 &&
      ac.some(a => typeof a === "string" && String(a).trim().length > 0));
  if (!acValid) {
    errors.push("plan.acceptance_criteria must be a non-empty string or array");
  }

  return { valid: errors.length === 0, errors };
}

// ── Unambiguous envelope check (deterministic fast-path gate) ─────────────────

/**
 * Check whether an evidence envelope is both structurally complete AND
 * unambiguous enough to allow the deterministic fast-path to skip premium AI
 * review.
 *
 * "Complete" means validateEvidenceEnvelope passes.
 * "Unambiguous" means all of the following hold:
 *   - verificationEvidence.build  === "pass"
 *   - verificationEvidence.tests  === "pass"
 *   - verificationEvidence.lint   is "pass" or "n/a" (not "fail")
 *   - verificationPassed          === true
 *   - status                      === "done"
 *   - No pre-review issues remain unaddressed (preReviewIssues must be absent or empty)
 *
 * If the original plan carries riskLevel="high", this gate always returns
 * unambiguous=false — high-risk plans require full AI review regardless of
 * evidence quality.
 *
 * @param envelope  — EvidenceEnvelope passed from the evolution executor
 * @param opts      — optional { planRiskLevel?: string }
 * @returns {{ unambiguous: boolean; reasons: string[] }}
 */
export function isEnvelopeUnambiguous(
  envelope: unknown,
  opts: { planRiskLevel?: string } = {}
): { unambiguous: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // High-risk plans always require AI review.
  if (opts.planRiskLevel === "high") {
    reasons.push("plan riskLevel=high always requires full AI review");
    return { unambiguous: false, reasons };
  }

  // Structural completeness is required first.
  const structuralCheck = validateEvidenceEnvelope(envelope);
  if (!structuralCheck.valid) {
    reasons.push(...structuralCheck.errors.map(e => `structural: ${e}`));
    return { unambiguous: false, reasons };
  }

  const e = envelope as Record<string, unknown>;
  const ve = e.verificationEvidence as Record<string, unknown> | undefined;

  if (e.status !== "done") {
    reasons.push(`status must be "done", got "${e.status}"`);
  }
  if (e.verificationPassed !== true) {
    reasons.push("verificationPassed must be true");
  }
  if (!ve || ve.build !== "pass") {
    reasons.push(`verificationEvidence.build must be "pass", got "${ve?.build}"`);
  }
  if (!ve || ve.tests !== "pass") {
    reasons.push(`verificationEvidence.tests must be "pass", got "${ve?.tests}"`);
  }
  if (ve && ve.lint === "fail") {
    reasons.push('verificationEvidence.lint must not be "fail"');
  }
  // Pre-review issues that are unfixed make the result ambiguous.
  const preReviewIssues = Array.isArray(e.preReviewIssues) ? e.preReviewIssues : [];
  if (preReviewIssues.length > 0) {
    reasons.push(`preReviewIssues present (${preReviewIssues.length} unfixed) — not unambiguous`);
  }

  return { unambiguous: reasons.length === 0, reasons };
}
