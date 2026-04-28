/**
 * ui_contract/types.ts — Shared types for the UI contract / control system slice.
 *
 * Design rule (see docs/ui-contract-system-opus-4.7-handoff.md):
 *   - The SHAPE of these contracts is deterministic and fixed here.
 *   - The CONTENT (which fields matter for which repo, what counts as a
 *     forbidden pattern, which scenarios apply, how evidence is interpreted)
 *     stays adaptive and is decided by AI/workers at runtime.
 *
 * No file in this slice should hardcode design choices for any specific
 * product (e.g. ATLAS). All design intent flows in as data.
 */

// ── Design contract ──────────────────────────────────────────────────────────

/**
 * Machine-readable design contract derived from normalized user intent.
 *
 * `fields` is intentionally an open string→unknown map so the system can
 * generalize across many repositories and surfaces. `requiredFields` and
 * `forbiddenPatterns` carry the deterministic, checkable parts.
 */
export interface UiDesignContract {
  /** Stable id for this contract revision (e.g. "atlas-shell@2026-04-24"). */
  contractId: string;
  /** Schema version — used by parser to reject incompatible shapes. */
  schemaVersion: 1;
  /** Surfaces this contract applies to (e.g. ["web", "electron"]). */
  targetSurfaces: string[];
  /** Open, AI-populated structured intent. Shape is intentionally loose. */
  fields: Record<string, unknown>;
  /** Names of `fields` keys that MUST be present and non-empty. */
  requiredFields: string[];
  /**
   * Patterns the design must NOT exhibit. Each entry is a free-form rule id
   * the judge layer can interpret (e.g. "modal_inside_modal", "low_contrast").
   */
  forbiddenPatterns: string[];
  /** Hard accessibility floor (e.g. "WCAG-AA"). Empty string means unset. */
  accessibilityFloor: string;
}

// ── Scenario matrix ──────────────────────────────────────────────────────────

/**
 * One scenario / fixture the system must inspect before judging a surface.
 * `state` is opaque setup data the adapter knows how to materialize.
 */
export interface UiScenario {
  scenarioId: string;
  /** Free-form label, e.g. "empty", "populated", "error", "narrow". */
  kind: string;
  /** Human-readable description of what this scenario is proving. */
  description: string;
  /** Target surface this scenario applies to. */
  surface: string;
  /** Adapter-specific setup data. Opaque to the loop controller. */
  state: Record<string, unknown>;
}

export interface UiScenarioMatrix {
  matrixId: string;
  schemaVersion: 1;
  scenarios: UiScenario[];
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export type EvidenceClass = "visual" | "structural" | "behavioral" | "accessibility";

/**
 * Surface adapter interface. Each adapter knows how to render or inspect one
 * kind of surface (web/Playwright, Electron, Storybook, mobile emulator, …)
 * and emit raw evidence for a single scenario.
 *
 * Adapters MUST be deterministic for a given (contract, scenario) pair so the
 * verdict layer can be cached and replayed.
 */
export interface UiSurfaceAdapter {
  /** Stable identifier (e.g. "static-dom", "playwright-web"). */
  readonly adapterId: string;
  /** Surface this adapter handles (must match `UiScenario.surface`). */
  readonly surface: string;
  /** Evidence classes this adapter can produce. */
  readonly supports: ReadonlyArray<EvidenceClass>;
  /** Materialize the scenario and emit raw evidence. */
  collect(input: UiAdapterInput): Promise<UiAdapterEvidence>;
}

export interface UiAdapterInput {
  contract: UiDesignContract;
  scenario: UiScenario;
}

export interface UiAdapterEvidence {
  adapterId: string;
  scenarioId: string;
  /** Evidence items keyed by class. Adapters may omit classes they cannot produce. */
  items: Partial<Record<EvidenceClass, UiEvidenceItem[]>>;
  /** Free-form notes. Not interpreted by the loop. */
  notes?: string[];
}

export interface UiEvidenceItem {
  evidenceClass: EvidenceClass;
  /** Short rule id this item speaks to (e.g. "contrast", "dom_landmark"). */
  ruleId: string;
  /** Deterministic boolean signal where possible. */
  pass: boolean;
  /** Free-form details (e.g. measured contrast ratio, missing landmark). */
  detail?: string;
}

// ── Verdict ──────────────────────────────────────────────────────────────────

export type UiVerdictStatus = "pass" | "fail" | "inconclusive";

/**
 * Per-scenario verdict produced by the judge layer.
 *
 * `status` is deterministic given the same evidence; the judge implementation
 * is pluggable (rule-based default or AI-backed).
 */
export interface UiScenarioVerdict {
  scenarioId: string;
  status: UiVerdictStatus;
  /** Rule ids (forbidden patterns or required fields) this scenario violated. */
  violations: string[];
  /** Repair hints addressed to the next implementer pass. */
  repairHints: string[];
}

export interface UiVerdict {
  contractId: string;
  matrixId: string;
  status: UiVerdictStatus;
  scenarios: UiScenarioVerdict[];
  /** ISO timestamp when this verdict was produced. */
  emittedAt: string;
}

// ── Loop control ─────────────────────────────────────────────────────────────

export type UiLoopStopReason =
  | "verdict_pass"
  | "max_attempts"
  | "no_progress"
  | "repair_unavailable"
  | "error";

export interface UiLoopAttempt {
  attempt: number;
  verdict: UiVerdict;
}

export interface UiLoopResult {
  contractId: string;
  matrixId: string;
  attempts: UiLoopAttempt[];
  finalStatus: UiVerdictStatus;
  stopReason: UiLoopStopReason;
}

export interface UiLoopLimits {
  /** Maximum number of implement→judge passes. Must be >= 1. */
  maxAttempts: number;
}
