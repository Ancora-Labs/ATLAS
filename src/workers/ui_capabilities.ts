/**
 * ui_capabilities.ts — Worker capability / access contract for UI work.
 *
 * Per the UI contract / control system handoff: workers that run inside the
 * UI contract loop must have an explicit, machine-checkable list of accesses
 * they are allowed (and required) to use. This module is the single source
 * of truth for that contract so worker bootstrap, dispatch gates, and tests
 * agree on what "UI capable" means.
 *
 * This file declares CAPABILITIES — it does not grant them. Granting is the
 * job of whatever bootstraps a worker process; granting layers must consult
 * `UI_WORKER_CAPABILITIES` and refuse to admit a UI worker that lacks any
 * required entry.
 */

export type UiWorkerCapabilityId =
  /** Read source files in the BOX repo and the target workspace. */
  | "fs.read"
  /** Write source files in the target workspace (NOT the BOX runtime core). */
  | "fs.write.target"
  /** Read runtime/state files (state/, target session manifests). */
  | "state.read"
  /** Create or load deterministic UI fixtures. */
  | "fixtures.read"
  | "fixtures.write"
  /** Run verification commands (build, test, lint, typecheck). */
  | "verify.run"
  /** Launch a target surface (dev server, electron window, etc.). */
  | "surface.launch"
  /** Capture screenshots / pixel evidence. */
  | "evidence.visual.capture"
  /** Capture DOM / structural snapshots. */
  | "evidence.structural.capture"
  /** Capture interaction traces. */
  | "evidence.behavioral.capture"
  /** Capture accessibility audits (axe-style). */
  | "evidence.accessibility.capture"
  /** Invoke an AI judge with the collected evidence. */
  | "judge.invoke"
  /** Write repair patches into the target workspace. */
  | "repair.write"
  /** Execute another bounded loop pass. */
  | "loop.iterate"
  /** Persist verdicts and evidence under a stable, replayable path. */
  | "evidence.persist"
  | "verdict.persist";

export interface UiWorkerCapability {
  id: UiWorkerCapabilityId;
  /** Hard-required for any worker dispatched into the UI contract loop. */
  required: boolean;
  /** Human-readable rationale for audit logs / refusal messages. */
  rationale: string;
}

/**
 * Canonical capability list. Order is meaningful for human review only;
 * consumers must look up by `id`.
 */
export const UI_WORKER_CAPABILITIES: ReadonlyArray<UiWorkerCapability> = Object.freeze([
  { id: "fs.read", required: true, rationale: "Inspect target sources to plan UI changes." },
  { id: "fs.write.target", required: true, rationale: "Write code changes into the target workspace only." },
  { id: "state.read", required: true, rationale: "Read session state and manifests to align with the active target." },
  { id: "fixtures.read", required: true, rationale: "Load deterministic UI scenario fixtures." },
  { id: "fixtures.write", required: false, rationale: "Author new fixtures when scenario coverage is insufficient." },
  { id: "verify.run", required: true, rationale: "Run build/test/lint/typecheck after each repair pass." },
  { id: "surface.launch", required: false, rationale: "Bring a real surface up so adapters can collect evidence." },
  { id: "evidence.visual.capture", required: false, rationale: "Pixel evidence for visual regressions." },
  { id: "evidence.structural.capture", required: true, rationale: "DOM/structural evidence is the deterministic baseline." },
  { id: "evidence.behavioral.capture", required: false, rationale: "Interaction-flow evidence for stateful surfaces." },
  { id: "evidence.accessibility.capture", required: true, rationale: "Accessibility floor enforcement is non-negotiable." },
  { id: "judge.invoke", required: true, rationale: "Evidence must be turned into a verdict before any repair pass." },
  { id: "repair.write", required: true, rationale: "Workers must be able to act on judge feedback." },
  { id: "loop.iterate", required: true, rationale: "Workers must be able to drive the bounded repair loop." },
  { id: "evidence.persist", required: true, rationale: "Evidence must be replayable for postmortem and review." },
  { id: "verdict.persist", required: true, rationale: "Verdicts must be stable artifacts other agents can read." },
]);

export interface UiWorkerCapabilityCheckResult {
  ok: boolean;
  missing: UiWorkerCapabilityId[];
  unknown: string[];
}

/**
 * Check that a granted capability set satisfies the UI worker contract.
 *
 * Returns `ok: true` only when every `required: true` capability is present
 * in `granted`. Unknown ids are reported separately so callers can decide
 * whether to fail-closed or just warn.
 */
export function checkUiWorkerCapabilities(
  granted: ReadonlyArray<string>,
): UiWorkerCapabilityCheckResult {
  const grantedSet = new Set(granted);
  const knownSet = new Set(UI_WORKER_CAPABILITIES.map((c) => c.id));

  const missing = UI_WORKER_CAPABILITIES
    .filter((c) => c.required && !grantedSet.has(c.id))
    .map((c) => c.id);

  const unknown = granted.filter((id) => !knownSet.has(id as UiWorkerCapabilityId));

  return {
    ok: missing.length === 0,
    missing,
    unknown,
  };
}

/**
 * Convenience helper: list every required capability id. Useful for worker
 * bootstrap to materialize the default grant.
 */
export function requiredUiWorkerCapabilities(): ReadonlyArray<UiWorkerCapabilityId> {
  return UI_WORKER_CAPABILITIES.filter((c) => c.required).map((c) => c.id);
}

const UI_TASK_KIND_PATTERN = /^(ui|ui-contract|ui-repair|ui-verification|visual-contract|visual-regression|frontend-ui)$/i;
const UI_TASK_TEXT_PATTERN = /\b(ui[\s-_]?contract|visual[\s-_]?contract|render[\s-_]?judge|render[\s-_]?repair|design[\s-_]?contract|ui[\s-_]?repair|ui[\s-_]?verification)\b/i;

export function taskRequiresUiWorkerCapabilities(task: unknown): boolean {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    return false;
  }

  const record = task as Record<string, unknown>;
  if (record.uiContract || record.uiScenarioMatrix || record.uiSurface) {
    return true;
  }
  if (Array.isArray(record.targetSurfaces) && record.targetSurfaces.length > 0) {
    return true;
  }

  const kinds = [record.kind, record.taskKind, record.capabilityTag, record._capabilityTag]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (kinds.some((value) => UI_TASK_KIND_PATTERN.test(value) || value.startsWith("ui-") || value.startsWith("visual-"))) {
    return true;
  }

  const text = [record.task, record.title, record.summary, record.verification]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  return UI_TASK_TEXT_PATTERN.test(text);
}

export function parseGrantedUiWorkerCapabilities(raw: string | undefined): string[] {
  const text = String(raw || "").trim();
  if (!text) {
    return [];
  }

  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((value) => String(value || "").trim()).filter(Boolean))];
      }
    } catch {
      // Fall through to the comma-separated parser.
    }
  }

  return [...new Set(text.split(",").map((value) => value.trim()).filter(Boolean))];
}
