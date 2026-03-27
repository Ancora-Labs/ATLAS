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
