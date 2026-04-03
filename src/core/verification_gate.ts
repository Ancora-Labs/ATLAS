/**
 * Verification Gate — Contract validator + auto-rework controller
 *
 * After a worker reports "done", this module validates the response
 * against the role's verification profile. If required evidence is
 * missing or failed, it produces a rework instruction for Athena to
 * re-dispatch the worker with specific gap feedback.
 *
 * Anti-loop: max rework attempts are configurable (default 2).
 * After exhausting retries, the task escalates instead of looping.
 */

import { getVerificationProfile } from "./verification_profiles.js";
import {
  validateDispatchCommands,
  type DispatchCommandValidationResult,
} from "./verification_command_registry.js";

// ── Named test proof patterns ─────────────────────────────────────────────────
// Packets whose verification field names a specific test file + description must
// produce matching evidence in the worker output before done closure is accepted.

/**
 * Pattern to parse a named test proof from a packet's verification field.
 *
 * Accepted formats (case-insensitive):
 *   "tests/core/foo.test.ts — test: description text"
 *   "tests/core/foo.test.ts – it: description text"
 *   "tests/core/foo.test.ts"
 *   "tests/providers/bar.test.ts — should return X when Y"
 */
export const NAMED_TEST_PROOF_PATTERN =
  /^(tests\/[^\s—–-]+(?:\.test\.ts|\.test\.js))\s*(?:[—–-]+\s*(?:test:|it:|describe:|should\s)?(.+))?$/i;

/**
 * Gap message emitted when the named test proof required by the packet's
 * verification field is absent from the worker's output.
 */
export const NAMED_TEST_PROOF_GAP =
  "Named test proof missing — the verification field names a specific test file/description that must appear in the worker output before done closure";

/**
 * Check whether a worker's output contains the named test proof specified in
 * a packet's verification field.
 *
 * Returns `matched: false` when the verification text does not follow the named
 * test proof format (e.g., it is just "npm test") — in that case no gap is raised.
 * Returns `matched: true` with `gap: null` when the proof is present.
 * Returns `matched: true` with `gap: <string>` when the proof is missing.
 *
 * @param verificationText — packet's verification field value
 * @param workerOutput — full worker output text
 */
export function checkNamedTestProof(
  verificationText: string,
  workerOutput: string
): { matched: boolean; testFile: string | null; testDesc: string | null; gap: string | null } {
  const text = String(verificationText || "").trim();
  const output = String(workerOutput || "");

  const match = NAMED_TEST_PROOF_PATTERN.exec(text);
  if (!match) {
    return { matched: false, testFile: null, testDesc: null, gap: null };
  }

  const testFile = match[1].trim();
  // Extract just the filename stem for loose matching (handles path prefix differences)
  const filenamePart = testFile.split("/").pop() ?? testFile;
  const testDesc = match[2] ? match[2].trim() : null;

  const fileInOutput = output.includes(testFile) || output.includes(filenamePart);
  if (!fileInOutput) {
    return {
      matched: true,
      testFile,
      testDesc,
      gap: `${NAMED_TEST_PROOF_GAP}: test file "${testFile}" not found in worker output`,
    };
  }

  if (testDesc && !output.includes(testDesc)) {
    return {
      matched: true,
      testFile,
      testDesc,
      gap: `${NAMED_TEST_PROOF_GAP}: test description "${testDesc}" not found in worker output`,
    };
  }

  return { matched: true, testFile, testDesc, gap: null };
}

// ── Post-merge verification artifact patterns (Packet 1) ───────────────────
// Worker output must contain a git SHA and raw npm test stdout block for
// BOX_STATUS=done to be accepted on merge-oriented tasks.

/** Regex matching a 7-40 character hex git SHA in output. */
const GIT_SHA_PATTERN = /\b[0-9a-f]{7,40}\b/i;

/**
 * Regex matching an explicit BOX_MERGED_SHA marker.
 * Workers that include this explicit marker provide stronger evidence than
 * pattern-detected hex strings, since it unambiguously identifies the post-merge
 * commit SHA rather than any incidental hex value in the output.
 */
const BOX_MERGED_SHA_PATTERN = /BOX_MERGED_SHA\s*=\s*([0-9a-f]{7,40})/i;

/**
 * Regex matching an explicit NPM test output block delimited by
 * ===NPM TEST OUTPUT START=== / ===NPM TEST OUTPUT END=== markers.
 * Workers that include this explicit block provide stronger evidence than
 * scattered pattern matches across the full output.
 */
const NPM_TEST_BLOCK_PATTERN = /={3,}\s*NPM TEST OUTPUT\s*(?:START\s*)?={3,}[\s\S]*?={3,}\s*(?:NPM TEST OUTPUT\s*)?(?:END\s*)?={3,}/i;

/** Placeholder literal that must be replaced in verification reports. */
export const POST_MERGE_PLACEHOLDER = "POST_MERGE_TEST_OUTPUT";

/**
 * Template placeholder for the git SHA field inside the post-merge artifact block.
 * Workers must replace this with the actual output of `git rev-parse HEAD`.
 */
export const POST_MERGE_SHA_PLACEHOLDER = "<paste git rev-parse HEAD here>";

/**
 * Template placeholder for the npm test output field inside the post-merge artifact block.
 * Workers must replace this with the actual stdout from `npm test`.
 */
export const POST_MERGE_OUTPUT_PLACEHOLDER = "<paste full raw npm test stdout here>";

/**
 * All known template placeholder literals that constitute unfilled residue.
 * A worker output containing any of these strings has not completed the
 * post-merge artifact template and must be rejected deterministically.
 */
export const ALL_POST_MERGE_PLACEHOLDERS: readonly string[] = Object.freeze([
  POST_MERGE_PLACEHOLDER,
  POST_MERGE_SHA_PLACEHOLDER,
  POST_MERGE_OUTPUT_PLACEHOLDER,
]);

/**
 * Canonical artifact-gate gap reason strings.
 * Shared by worker_runner and evolution_executor so failure reasons are identical
 * regardless of which finalization path triggers the artifact check.
 */
export const ARTIFACT_GAP = Object.freeze({
  UNFILLED_PLACEHOLDER: "POST_MERGE_TEST_OUTPUT placeholder is still unfilled — replace it with actual test output",
  MISSING_SHA:          "Post-merge git SHA missing — run 'git rev-parse HEAD' on merged state and include the SHA",
  MISSING_TEST_OUTPUT:  "Post-merge raw npm test output missing — run 'npm test' on merged state and paste raw stdout",
  DIRTY_TREE:           "Post-merge clean-tree evidence missing — include explicit CLEAN_TREE_STATUS=clean from 'git status --porcelain'",
});

/** Prefix used in taskState.error when the artifact gate fails. */
export const ARTIFACT_GATE_ERROR_PREFIX = "artifact-gate";

/**
 * Machine-readable reason codes for artifact gate gaps.
 * These structured codes complement the human-readable ARTIFACT_GAP messages
 * and can be matched programmatically (e.g., for dashboards, policy filters,
 * or downstream escalation routing).
 */
export const ARTIFACT_GAP_CODE = Object.freeze({
  UNFILLED_PLACEHOLDER: "artifact-gate/unfilled-placeholder",
  MISSING_SHA:          "artifact-gate/missing-sha",
  MISSING_TEST_OUTPUT:  "artifact-gate/missing-test-output",
  DIRTY_TREE:           "artifact-gate/dirty-tree",
  UNKNOWN:              "artifact-gate/unknown",
});

/**
 * Check if worker output contains the required post-merge verification artifact.
 * The artifact is: a git SHA + raw npm test stdout block.
 *
 * Explicit markers are preferred over pattern detection:
 *   - BOX_MERGED_SHA=<sha>  takes precedence over any 7-40 hex string in the output.
 *   - ===NPM TEST OUTPUT START=== ... ===NPM TEST OUTPUT END=== block is preferred over
 *     scattered npm output patterns; falls back to the legacy pattern for compatibility.
 *
 * @param {string} output — full worker output text
 * @returns {{ hasArtifact: boolean, hasSha: boolean, hasTestOutput: boolean, hasUnfilledPlaceholder: boolean, mergedSha: string | null, hasExplicitShaMarker: boolean, hasExplicitTestBlock: boolean }}
 */
export function checkPostMergeArtifact(output) {
  const text = String(output || "");

  // Prefer explicit BOX_MERGED_SHA=<sha> marker; fall back to loose hex detection.
  const explicitShaMatch = BOX_MERGED_SHA_PATTERN.exec(text);
  const hasExplicitShaMarker = explicitShaMatch !== null;
  const mergedSha: string | null = explicitShaMatch ? explicitShaMatch[1] : null;
  const hasSha = hasExplicitShaMarker || GIT_SHA_PATTERN.test(text);

  // Post-merge test evidence is structural: explicit raw block markers are required.
  const hasExplicitTestBlock = NPM_TEST_BLOCK_PATTERN.test(text);
  const hasTestOutput = hasExplicitTestBlock;
  const hasCleanTreeEvidence = /CLEAN_TREE_STATUS\s*=\s*clean\b/i.test(text);

  // Deterministic rejection: any known template placeholder literal means the
  // worker did not fill in the artifact fields.  Check all known residues.
  const hasUnfilledPlaceholder = ALL_POST_MERGE_PLACEHOLDERS.some(p => text.includes(p));

  return {
    hasArtifact: hasSha && hasTestOutput && hasCleanTreeEvidence && !hasUnfilledPlaceholder,
    hasSha,
    hasTestOutput,
    hasCleanTreeEvidence,
    hasUnfilledPlaceholder,
    mergedSha,
    hasExplicitShaMarker,
    hasExplicitTestBlock,
  };
}

/**
 * Extract the merged commit SHA from worker output.
 *
 * Returns the value from the explicit BOX_MERGED_SHA=<sha> marker when present.
 * Falls back to null when the explicit marker is absent (loose SHA detection is
 * intentionally NOT used here — loose detection is for the hasArtifact check only).
 *
 * @param {string} output — full worker output text
 * @returns {string | null} — 7-40 char hex SHA, or null when not explicitly declared
 */
export function extractMergedSha(output: string): string | null {
  const match = BOX_MERGED_SHA_PATTERN.exec(String(output || ""));
  return match ? match[1] : null;
}

/**
 * Canonical artifact gap collector — shared contract used by worker_runner,
 * evolution_executor, and validateWorkerContract so all finalization paths
 * produce identical gap reason strings from a single source of truth.
 *
 * @param {{ hasSha: boolean, hasTestOutput: boolean, hasUnfilledPlaceholder: boolean }} artifact
 *   — result of checkPostMergeArtifact()
 * @returns {string[]} ordered list of gap reason strings (empty when artifact is complete)
 */
export function collectArtifactGaps(artifact: { hasSha: boolean; hasTestOutput: boolean; hasCleanTreeEvidence?: boolean; hasUnfilledPlaceholder: boolean }): string[] {
  const gaps: string[] = [];
  if (artifact.hasUnfilledPlaceholder) gaps.push(ARTIFACT_GAP.UNFILLED_PLACEHOLDER);
  if (!artifact.hasSha)               gaps.push(ARTIFACT_GAP.MISSING_SHA);
  if (!artifact.hasTestOutput)         gaps.push(ARTIFACT_GAP.MISSING_TEST_OUTPUT);
  if (artifact.hasCleanTreeEvidence !== true) gaps.push(ARTIFACT_GAP.DIRTY_TREE);
  return gaps;
}

/** Shape of an artifact gate audit entry written to verification_audit.json. */
export interface ArtifactAuditEntry {
  gateSource: "hard-block" | "rework-queued" | "evolution-gate";
  workerKind: string;
  roleName: string;
  taskId: string | number | null;
  taskSnippet: string | null;
  passed: boolean;
  gaps: string[];
  reasonCodes: string[];
  artifactDetail: {
    hasSha: boolean;
    hasTestOutput: boolean;
    hasCleanTreeEvidence: boolean;
    hasUnfilledPlaceholder: boolean;
    hasExplicitShaMarker: boolean;
    hasExplicitTestBlock: boolean;
    mergedSha: string | null;
  };
  auditedAt: string;
}

/**
 * Build a structured audit entry for an artifact gate check.
 *
 * Centralises audit record construction so worker_runner and evolution_executor
 * emit identical schemas regardless of which finalization path fires the gate.
 * The entry is suitable for appending to verification_audit.json.
 *
 * @param artifact — result of {@link checkPostMergeArtifact}
 * @param gaps     — result of {@link collectArtifactGaps}
 * @param meta     — contextual metadata from the calling finalization path
 * @returns structured {@link ArtifactAuditEntry}
 */
export function buildArtifactAuditEntry(
  artifact: ReturnType<typeof checkPostMergeArtifact>,
  gaps: string[],
  meta: {
    gateSource: "hard-block" | "rework-queued" | "evolution-gate";
    taskId?: string | number | null;
    workerKind?: string;
    roleName?: string;
    taskSnippet?: string;
  }
): ArtifactAuditEntry {
  const reasonCodes = gaps.map(g => {
    if (g === ARTIFACT_GAP.UNFILLED_PLACEHOLDER) return ARTIFACT_GAP_CODE.UNFILLED_PLACEHOLDER;
    if (g === ARTIFACT_GAP.MISSING_SHA)          return ARTIFACT_GAP_CODE.MISSING_SHA;
    if (g === ARTIFACT_GAP.MISSING_TEST_OUTPUT)  return ARTIFACT_GAP_CODE.MISSING_TEST_OUTPUT;
    if (g === ARTIFACT_GAP.DIRTY_TREE)           return ARTIFACT_GAP_CODE.DIRTY_TREE;
    return ARTIFACT_GAP_CODE.UNKNOWN;
  });

  return {
    gateSource: meta.gateSource,
    workerKind: meta.workerKind || "unknown",
    roleName: meta.roleName || "unknown",
    taskId: meta.taskId ?? null,
    taskSnippet: meta.taskSnippet ? String(meta.taskSnippet).slice(0, 100) : null,
    passed: gaps.length === 0,
    gaps,
    reasonCodes,
    artifactDetail: {
      hasSha: artifact.hasSha,
      hasTestOutput: artifact.hasTestOutput,
      hasCleanTreeEvidence: artifact.hasCleanTreeEvidence,
      hasUnfilledPlaceholder: artifact.hasUnfilledPlaceholder,
      hasExplicitShaMarker: artifact.hasExplicitShaMarker,
      hasExplicitTestBlock: artifact.hasExplicitTestBlock,
      mergedSha: artifact.mergedSha ?? null,
    },
    auditedAt: new Date().toISOString(),
  };
}

/**
 * Gates config can upgrade optional evidence fields to required.
 *
 * Mapping:
 *   requireBuild: true        → build "optional"    → "required"
 *   requireTests: true        → tests "optional"    → "required"
 *   requireSecurityScan: true → security "optional" → "required"
 *
 * Exempt fields are never upgraded — exempt means not applicable for the role.
 *
 * Promoted fields are tracked in a `promotedFields` Set on the returned profile.
 * The validation loop uses this to allow `n/a` for globally-promoted fields —
 * the config promotes to catch build failures when a build step exists, but must
 * not produce false completion blocks for tasks where the field is genuinely
 * non-applicable (e.g., test-only tasks where no compilation step runs).
 *
 * @param {object} profile — profile from getVerificationProfile()
 * @param {object} gatesConfig — config.gates from box.config.json
 * @returns {object} — new profile with evidence overrides applied (original is not mutated)
 */
export function applyConfigOverrides(profile, gatesConfig) {
  if (!gatesConfig) return profile;

  const evidence = { ...profile.evidence };

  // Carry forward any already-promoted fields from a prior applyConfigOverrides call.
  const promotedFields = new Set<string>(
    profile.promotedFields instanceof Set ? profile.promotedFields : []
  );

  // Map config gate flags to their corresponding evidence field names
  const fieldMap = {
    requireBuild: "build",
    requireTests: "tests",
    requireSecurityScan: "security"
  };

  for (const [configKey, evidenceField] of Object.entries(fieldMap)) {
    if (gatesConfig[configKey] === true && evidence[evidenceField] === "optional") {
      evidence[evidenceField] = "required";
      promotedFields.add(evidenceField);
    }
  }

  return { ...profile, evidence, promotedFields };
}

/**
 * The canonical set of accepted VERIFICATION_REPORT field values.
 * Workers must use one of these values; anything else is non-canonical.
 */
export const CANONICAL_REPORT_VALUES = Object.freeze(new Set(["pass", "fail", "n/a"]));

/**
 * Normalize a raw VERIFICATION_REPORT field value to its canonical form.
 *
 * Common "pass" synonyms (passing, passed, ok, yes, true) → "pass"
 * Common "fail" synonyms (failing, failed, no, false, error) → "fail"
 * Common "n/a" synonyms (na, not-applicable, skip, skipped, exempt) → "n/a"
 * Already-canonical values are returned unchanged.
 * Truly unknown values are returned as-is so the gate can flag them.
 *
 * @param raw — raw lowercased value string from the report line
 * @returns canonical value string
 */
export function normalizeReportValue(raw: string): string {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "passing" || v === "passed" || v === "ok" || v === "yes" || v === "true") return "pass";
  if (v === "failing" || v === "failed" || v === "no" || v === "false" || v === "error") return "fail";
  if (v === "na" || v === "not-applicable" || v === "skip" || v === "skipped" || v === "exempt") return "n/a";
  return v;
}

/**
 * Parse VERIFICATION_REPORT from worker output.
 * Supports two formats:
 *   1. Inline:     VERIFICATION_REPORT: BUILD=pass; TESTS=pass; ...
 *   2. Block:      ===VERIFICATION_REPORT===\nBUILD=pass\nTESTS=pass\n...===END_VERIFICATION===
 *                  (also accepts ===END_VERIFICATION_REPORT===)
 *
 * Values are normalized via normalizeReportValue before storage so common
 * synonyms (passing/passed/ok → pass) are canonicalized at parse time.
 */
export function parseVerificationReport(output) {
  const text = String(output || "");

  // --- Format 2: block delimiters ---
  const blockMatch = text.match(/===VERIFICATION[_\s]?REPORT===\s*([\s\S]*?)\s*===END[_\s]?VERIFICATION(?:[_\s]?REPORT)?===/i);
  if (blockMatch) {
    const report: Record<string, string> = {};
    const lines = blockMatch[1].split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
    const keyMap = {
      build: "build", tests: "tests", test: "tests",
      responsive: "responsive", responsivematrix: "responsive",
      api: "api", edgecases: "edgeCases", edge_cases: "edgeCases", security: "security"
    };
    for (const line of lines) {
      // Accept "KEY=value", "KEY: value", "criterion_N: PASS|FAIL ..." patterns
      const eqIdx = line.indexOf("=");
      const colonIdx = line.indexOf(":");
      const sepIdx = eqIdx >= 0 && (colonIdx < 0 || eqIdx <= colonIdx) ? eqIdx : colonIdx;
      if (sepIdx < 0) continue;
      const rawKey = line.slice(0, sepIdx).trim().toLowerCase().replace(/[_\s]+/g, "");
      const rawValue = line.slice(sepIdx + 1).trim().toLowerCase().split(/[;\s]/)[0];
      const normalizedKey = keyMap[rawKey];
      if (normalizedKey) {
        report[normalizedKey] = normalizeReportValue(rawValue);
      }
    }
    if (Object.keys(report).length > 0) return report;
  }

  // --- Format 1: inline single-line ---
  const match = text.match(/VERIFICATION_REPORT:\s*([^\n\r]+)/i);
  if (!match) return null;

  const report: Record<string, string> = {};
  const pairs = match[1].split(";").map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const key = pair.slice(0, eqIdx).trim().toLowerCase().replace(/[_\s]+/g, "");
    const rawValue = pair.slice(eqIdx + 1).trim().toLowerCase();
    // Normalize key names
    const keyMap = {
      build: "build",
      tests: "tests",
      test: "tests",
      responsive: "responsive",
      responsivematrix: "responsive",
      api: "api",
      edgecases: "edgeCases",
      edge_cases: "edgeCases",
      security: "security"
    };
    const normalizedKey = keyMap[key];
    if (normalizedKey) {
      report[normalizedKey] = normalizeReportValue(rawValue);
    }
  }
  return report;
}

/**
 * Parse BOX_PR_URL from worker output.
 */
export function parsePrUrl(output) {
  const text = String(output || "");
  const match = text.match(/BOX_PR_URL\s*=\s*(https:\/\/github\.com\/[^\s]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Parse RESPONSIVE_MATRIX from worker output.
 * Expected format: RESPONSIVE_MATRIX: 320x568=pass, 360x640=fail, ...
 */
export function parseResponsiveMatrix(output) {
  const text = String(output || "");
  const match = text.match(/RESPONSIVE_MATRIX:\s*([^\n\r]+)/i);
  if (!match) return null;

  const matrix: Record<string, string> = {};
  const pairs = match[1].split(",").map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const viewport = pair.slice(0, eqIdx).trim();
    const result = pair.slice(eqIdx + 1).trim().toLowerCase();
    if (viewport && result) matrix[viewport] = result;
  }
  return Object.keys(matrix).length > 0 ? matrix : null;
}

/**
 * Task kinds that are non-merge by nature — they do not involve committing
 * or merging code, so the post-merge artifact gate (git SHA + npm test output)
 * does not apply.  Implementation and rework kinds are NOT in this set.
 */
export const NON_MERGE_TASK_KINDS = Object.freeze(new Set([
  "scan",
  "doc",
  "observation",
  "diagnosis",
  "discovery",
  "research",
  "review",
  "audit",
]));

/**
 * Task kinds that are safe to execute even when dispatch strictness is BLOCKED.
 * These tasks do not modify code, so they cannot introduce regressions and
 * are exempt from the post-merge artifact gate (adaptive throttle bypass).
 *
 * DISCOVERY_SAFE_TASK_KINDS is a superset of NON_MERGE_TASK_KINDS — every
 * non-merge task is discovery-safe, but future non-merge kinds that carry
 * deployment risk may be excluded from the discovery-safe bypass while still
 * being excluded from the artifact gate.
 */
export const DISCOVERY_SAFE_TASK_KINDS = Object.freeze(new Set([
  "scan",
  "doc",
  "observation",
  "diagnosis",
  "discovery",
  "research",
  "review",
  "audit",
]));

/**
 * Check whether a task kind qualifies for the discovery-safe bypass.
 *
 * Discovery-safe tasks:
 *   1. Are exempt from the post-merge artifact gate (they don't produce merges).
 *   2. May proceed even when dispatch strictness is BLOCKED (adaptive throttle bypass).
 *
 * @param taskKind — task kind string from the instruction
 * @returns true when the task is discovery-safe (read-only / no-commit)
 */
export function isDiscoverySafeTask(taskKind?: string | null): boolean {
  if (!taskKind) return false;
  return DISCOVERY_SAFE_TASK_KINDS.has(String(taskKind).toLowerCase());
}

/**
 * Determine whether the post-merge artifact gate should run for a given
 * worker kind + task kind combination.
 *
 * Returns false (gate skipped) when:
 *   - The worker role is fully exempt (all evidence fields = "exempt"), OR
 *   - The task kind is a non-merge task (scan, doc, observation, diagnosis,
 *     discovery, research, review, audit).
 *
 * @param {string} workerKind — role kind (e.g. "backend", "scanA")
 * @param {string|null|undefined} taskKind — instruction task kind
 * @returns {boolean} — true when the artifact gate must run
 */
export function isArtifactGateRequired(workerKind: string, taskKind?: string | null): boolean {
  // Exempt roles (scan/doc workers) never need artifacts
  const profile = getVerificationProfile(workerKind);
  const allExempt = Object.values(profile.evidence).every(v => v === "exempt");
  if (allExempt) return false;

  // Non-merge task kinds never produce a git SHA or test output
  if (taskKind && NON_MERGE_TASK_KINDS.has(String(taskKind).toLowerCase())) return false;

  return true;
}

/** Options for {@link validateWorkerContract}. */
export interface ValidateWorkerContractOptions {
  /** Config.gates object to upgrade optional evidence fields to required. */
  gatesConfig?: Record<string, unknown>;
  /**
   * The task kind from the instruction (e.g. "backend", "scan", "doc").
   * Non-merge task kinds (scan, doc, observation, diagnosis) are exempt from
   * the artifact gate even when the worker role is done-capable.
   */
  taskKind?: string | null;
  /**
   * The packet's verification field value (e.g. "tests/core/foo.test.ts — test: desc").
   * When provided and the value follows the named-test-proof format, the gate checks
   * that the specified test file and description appear in the worker output.
   * Packets with non-specific verification text (e.g. "npm test") are not checked.
   */
  verificationText?: string | null;
  /**
   * Pre-computed artifact evidence from a prior checkPostMergeArtifact() call.
   * When provided, the artifact gate reuses this result instead of re-evaluating
   * the output, avoiding a duplicate computation on the same string.
   */
  precomputedArtifact?: ReturnType<typeof checkPostMergeArtifact>;
}

/**
 * Validate a worker's output against its role's verification profile.
 *
 * @param {string} workerKind — the role kind from box.config.json (e.g. "frontend", "backend")
 * @param {object} parsedResponse — output from parseWorkerResponse() in worker_runner.js
 * @param {ValidateWorkerContractOptions} [options] — optional overrides
 * @returns {{ passed: boolean, gaps: string[], evidence: object }}
 */
export function validateWorkerContract(workerKind: string, parsedResponse: Record<string, unknown>, options: ValidateWorkerContractOptions = {}) {
  const baseProfile = getVerificationProfile(workerKind);
  const profile = options.gatesConfig ? applyConfigOverrides(baseProfile, options.gatesConfig) : baseProfile;
  const output = parsedResponse?.fullOutput || parsedResponse?.summary || "";
  const report = parseVerificationReport(output);
  const responsiveMatrix = parseResponsiveMatrix(output);
  const prUrl = parsePrUrl(output);

  const gaps: string[] = [];
  const evidence: Record<string, unknown> = {
    hasReport: !!report,
    report: report || {},
    responsiveMatrix: responsiveMatrix || {},
    prUrl: prUrl || null,
    profile: profile.kind,
    optionalFieldFailures: [] as string[]
  };

  // If worker reported skipped (already-merged), pass immediately
  const status = String(parsedResponse?.status || "done").toLowerCase();
  if (status === "skipped") {
    return { passed: true, gaps: [], evidence, reason: "status=skipped, worker reported task already done" };
  }

  // If worker reported a non-done status, skip verification
  if (status !== "done") {
    return { passed: true, gaps: [], evidence, reason: `status=${status}, verification skipped` };
  }

  // Scan/doc roles are exempt from verification
  const allExempt = Object.values(profile.evidence).every(v => v === "exempt");
  if (allExempt) {
    return { passed: true, gaps: [], evidence, reason: "role exempt from verification" };
  }

  // Roles with at least one required evidence field are "done-capable lanes"
  const hasRequiredFields = Object.values(profile.evidence).some(v => v === "required");

  // ── Post-merge verification artifact gate ───────────────────────────────
  // Done-capable lanes (roles with at least one required evidence field) must
  // include a git SHA + raw test output when reporting done, UNLESS the task
  // kind is a non-merge kind (scan, doc, observation, diagnosis) — those tasks
  // do not produce a merged commit and are exempt from artifact requirements.
  // This gate is NON-BYPASSABLE — no caller option can disable it.
  const requireArtifact = hasRequiredFields
    && isArtifactGateRequired(workerKind, options.taskKind);
  if (requireArtifact) {
    // Reuse a pre-computed artifact object when the caller already evaluated
    // the same output (e.g., the hard-block gate in worker_runner), avoiding
    // a redundant call to checkPostMergeArtifact on the same string.
    const artifact = options.precomputedArtifact ?? checkPostMergeArtifact(output);
    evidence.postMergeArtifact = artifact;
    for (const gap of collectArtifactGaps(artifact)) gaps.push(gap);
  }

  // ── Named test proof gate ────────────────────────────────────────────────
  // When the task packet's verification field names a specific test file and
  // optionally a test description, the worker output must contain that evidence
  // before done closure is accepted.  Generic "npm test" values are not checked.
  if (options.verificationText) {
    const namedProof = checkNamedTestProof(String(options.verificationText), String(output));
    if (namedProof.matched && namedProof.gap) {
      gaps.push(namedProof.gap);
    }
    evidence.namedTestProof = namedProof;
  }

  // No verification report at all — gap for any role with required fields
  if (!report && hasRequiredFields) {
    gaps.push("VERIFICATION_REPORT missing — worker did not provide any verification evidence");
    return { passed: false, gaps, evidence, reason: "no verification report" };
  }

  // ── Profile-aware optional field failure tracking ───────────────────────
  // Optional fields that appear in the report with "fail" are tracked in
  // evidence for false-negative proxy calibration, but do NOT cause a gap.
  if (report) {
    for (const [field, requirement] of Object.entries(profile.evidence)) {
      if (requirement !== "optional") continue;
      if (field === "prUrl") continue;
      if (report[field] === "fail") {
        (evidence.optionalFieldFailures as string[]).push(field);
      }
    }
  }

  // Check each required field (except prUrl — handled separately below)
  for (const [field, requirement] of Object.entries(profile.evidence)) {
    if (requirement !== "required") continue;
    if (field === "prUrl") continue;

    const value = report?.[field];

    // Globally-promoted fields allow n/a — the config promotes to enforce coverage
    // when a build/test step exists, but must not produce false completion blocks
    // for tasks where the field is genuinely non-applicable (e.g., test-only tasks
    // where no compilation step runs, or doc tasks with no test suite to execute).
    const isGloballyPromoted =
      profile.promotedFields instanceof Set && profile.promotedFields.has(field);
    if (isGloballyPromoted && value === "n/a") continue;

    if (!value || value === "n/a") {
      gaps.push(`${field.toUpperCase()} is required but was ${value || "missing"}`);
    } else if (value === "fail") {
      gaps.push(`${field.toUpperCase()} reported as FAIL — worker must fix before done`);
    } else if (!CANONICAL_REPORT_VALUES.has(value)) {
      // Non-canonical value — prevents false negatives from values like "xyz"
      // that slip past the fail/n-a checks.  Workers must use pass/fail/n/a.
      gaps.push(`${field.toUpperCase()} has non-canonical value "${value}" — use pass, fail, or n/a`);
    }
  }

  // Responsive viewport count check for frontend roles
  if (profile.responsiveRequired && responsiveMatrix) {
    const passCount = Object.values(responsiveMatrix).filter(v => v === "pass").length;
    if (passCount < profile.minViewports) {
      gaps.push(`RESPONSIVE: only ${passCount}/${profile.minViewports} viewports passed (need ≥${profile.minViewports})`);
    }
  } else if (profile.responsiveRequired && !responsiveMatrix) {
    gaps.push("RESPONSIVE_MATRIX missing — frontend role must verify responsive viewports");
  }

  // PR URL check — generic for all implementation roles that require it
  if (profile.evidence.prUrl === "required") {
    if (!prUrl) {
      gaps.push("BOX_PR_URL missing — worker must push a branch and open a real GitHub PR. Prose claims of completion are not accepted.");
    }
  }

  return {
    passed: gaps.length === 0,
    gaps,
    evidence,
    reason: gaps.length === 0 ? "all required evidence present and passing" : `${gaps.length} verification gap(s)`
  };
}

/**
 * Build a rework instruction when verification gaps are detected.
 *
 * @param {string} originalTask — the task the worker was originally assigned
 * @param {string[]} gaps — array of gap descriptions
 * @param {number} attempt — current rework attempt number (1-based)
 * @param {number} maxAttempts — maximum rework attempts allowed
 * @returns {object} — instruction object for Athena to re-dispatch
 */
export function buildReworkInstruction(originalTask, gaps, attempt, maxAttempts) {
  const gapList = gaps.map((g, i) => `  ${i + 1}. ${g}`).join("\n");

  const task = `## AUTO-REWORK — VERIFICATION GAPS DETECTED (attempt ${attempt}/${maxAttempts})

Your previous completion was REJECTED by the verification gate because the following evidence was missing or failed:

${gapList}

## WHAT YOU MUST DO

1. Go back to your work and fix each gap listed above.
2. Re-run verification for each gap (build, tests, responsive checks, etc.)
3. Include a complete VERIFICATION_REPORT in your response.
4. Do NOT repeat the same approach if it already failed — try a different strategy.

## ORIGINAL TASK (for reference)
${originalTask}

${attempt >= maxAttempts ? "⚠️ THIS IS YOUR FINAL ATTEMPT. If you cannot resolve all gaps, report BOX_STATUS=blocked with a root-cause analysis of why each gap cannot be resolved." : ""}`;

  return {
    task,
    context: `Rework attempt ${attempt}/${maxAttempts}. Gaps: ${gaps.join("; ")}`,
    isFollowUp: true,
    isRework: true,
    reworkAttempt: attempt,
    maxReworkAttempts: maxAttempts,
    taskKind: "rework"
  };
}

/**
 * Determine if auto-rework should be triggered.
 *
 * @param {object} validationResult — output from validateWorkerContract()
 * @param {number} currentAttempt — how many times this worker has been re-dispatched for this task
 * @param {number} maxAttempts — configurable max rework attempts (default from config)
 * @returns {{ shouldRework: boolean, instruction: object|null, shouldEscalate: boolean }}
 */
export function decideRework(validationResult, originalTask, currentAttempt, maxAttempts = 2) {
  if (validationResult.passed) {
    return { shouldRework: false, instruction: null, shouldEscalate: false };
  }

  const nextAttempt = currentAttempt + 1;

  if (nextAttempt > maxAttempts) {
    // Max retries exhausted — escalate to Athena, don't loop
    return {
      shouldRework: false,
      instruction: null,
      shouldEscalate: true,
      escalationReason: `Worker failed verification ${currentAttempt} times. Gaps: ${validationResult.gaps.join("; ")}`
    };
  }

  const instruction = buildReworkInstruction(
    originalTask,
    validationResult.gaps,
    nextAttempt,
    maxAttempts
  );

  return {
    shouldRework: true,
    instruction,
    shouldEscalate: false
  };
}

// ── Dispatch command gate (Task 3) ────────────────────────────────────────────

/** Re-export for callers that only import from verification_gate. */
export type { DispatchCommandValidationResult };

/**
 * Apply the dispatch command gate to a task plan before worker dispatch begins.
 *
 * Rewrites any non-portable verification commands (shell globs, bash/sh scripts,
 * BOX daemon invocations) to their canonical, cross-platform equivalents and
 * returns both the sanitized task and an audit record of applied rewrites.
 *
 * This gate is intended to be called immediately before a task plan is handed
 * off to worker_runner or evolution_executor — NOT after the worker returns.
 *
 * Usage:
 *   const { task: safeTask, gate } = applyDispatchCommandGate(rawTask);
 *   if (!gate.safe) logger.warn("Rewrote non-portable commands", gate.rewrites);
 *   dispatch(safeTask);
 *
 * @param task — raw task plan object; must have an optional verification_commands array
 * @returns {{ task: object, gate: DispatchCommandValidationResult }}
 */
export function applyDispatchCommandGate(
  task: { verification_commands?: string[] | unknown } & Record<string, unknown>
): { task: typeof task; gate: DispatchCommandValidationResult } {
  const rawCommands = Array.isArray(task?.verification_commands)
    ? (task.verification_commands as string[])
    : [];

  const gate = validateDispatchCommands(rawCommands);

  const sanitizedTask = gate.safe
    ? task
    : { ...task, verification_commands: gate.sanitizedCommands };

  return { task: sanitizedTask, gate };
}
