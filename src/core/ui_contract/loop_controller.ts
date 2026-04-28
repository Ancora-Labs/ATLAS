/**
 * ui_contract/loop_controller.ts — Bounded render→judge→repair controller.
 *
 * Stop conditions:
 *   - verdict_pass        : verdict.status === "pass"
 *   - max_attempts        : attempts === limits.maxAttempts
 *   - no_progress         : violation set unchanged between two consecutive attempts
 *   - repair_unavailable  : no repair function provided AND first verdict is not pass
 *   - error               : adapter or judge throws
 *
 * The repair function is the AI/worker integration seam. The controller
 * itself does NOT mutate code; it only invokes the repair callback and
 * re-runs the loop. This keeps the loop deterministic for testing.
 */

import { UiAdapterRegistry } from "./adapter.js";
import type {
  UiAdapterEvidence,
  UiDesignContract,
  UiLoopAttempt,
  UiLoopLimits,
  UiLoopResult,
  UiLoopStopReason,
  UiScenarioMatrix,
  UiVerdict,
} from "./types.js";
import { buildRuleBasedVerdict } from "./verdict.js";

export interface UiLoopRepairContext {
  attempt: number;
  verdict: UiVerdict;
}

/**
 * Optional repair callback. Should perform whatever code/state mutation the
 * worker decides is needed for the next pass. Resolves when the workspace
 * is ready for re-collection. Resolving with `false` means "no repair was
 * possible" → the controller stops with `repair_unavailable`.
 */
export type UiLoopRepair = (ctx: UiLoopRepairContext) => Promise<boolean>;

export interface UiLoopRunInput {
  contract: UiDesignContract;
  matrix: UiScenarioMatrix;
  registry: UiAdapterRegistry;
  limits: UiLoopLimits;
  repair?: UiLoopRepair;
  /** Override clock for deterministic tests. */
  now?: () => Date;
}

export async function runUiContractLoop(input: UiLoopRunInput): Promise<UiLoopResult> {
  const { contract, matrix, registry, limits, repair, now } = input;
  if (!Number.isInteger(limits.maxAttempts) || limits.maxAttempts < 1) {
    throw new Error(`limits.maxAttempts must be an integer >= 1, got ${limits.maxAttempts}`);
  }

  const attempts: UiLoopAttempt[] = [];
  let stopReason: UiLoopStopReason = "max_attempts";
  let lastViolationKey = "";

  for (let attempt = 1; attempt <= limits.maxAttempts; attempt++) {
    let verdict: UiVerdict;
    try {
      const evidence = await collectAllEvidence(contract, matrix, registry);
      verdict = buildRuleBasedVerdict({ contract, matrix, evidenceByScenario: evidence, now });
    } catch (err) {
      attempts.push({
        attempt,
        verdict: errorVerdict(contract, matrix, err, now),
      });
      stopReason = "error";
      break;
    }

    attempts.push({ attempt, verdict });

    if (verdict.status === "pass") {
      stopReason = "verdict_pass";
      break;
    }

    if (attempt === limits.maxAttempts) {
      stopReason = "max_attempts";
      break;
    }

    if (!repair) {
      stopReason = "repair_unavailable";
      break;
    }

    const violationKey = serializeViolations(verdict);
    if (attempt > 1 && violationKey === lastViolationKey) {
      stopReason = "no_progress";
      break;
    }
    lastViolationKey = violationKey;

    const didRepair = await repair({ attempt, verdict });
    if (!didRepair) {
      stopReason = "repair_unavailable";
      break;
    }
  }

  const finalVerdict = attempts[attempts.length - 1]?.verdict;
  return {
    contractId: contract.contractId,
    matrixId: matrix.matrixId,
    attempts,
    finalStatus: finalVerdict?.status ?? "inconclusive",
    stopReason,
  };
}

async function collectAllEvidence(
  contract: UiDesignContract,
  matrix: UiScenarioMatrix,
  registry: UiAdapterRegistry,
): Promise<Map<string, UiAdapterEvidence>> {
  const out = new Map<string, UiAdapterEvidence>();
  for (const scenario of matrix.scenarios) {
    const adapter = registry.resolve(scenario.surface);
    const evidence = await adapter.collect({ contract, scenario });
    out.set(scenario.scenarioId, evidence);
  }
  return out;
}

function serializeViolations(verdict: UiVerdict): string {
  return verdict.scenarios
    .map((s) => `${s.scenarioId}:${[...s.violations].sort().join(",")}`)
    .sort()
    .join("|");
}

function errorVerdict(
  contract: UiDesignContract,
  matrix: UiScenarioMatrix,
  err: unknown,
  now?: () => Date,
): UiVerdict {
  const detail = err instanceof Error ? err.message : String(err);
  const clock = now ?? (() => new Date());
  return {
    contractId: contract.contractId,
    matrixId: matrix.matrixId,
    status: "inconclusive",
    scenarios: matrix.scenarios.map((s) => ({
      scenarioId: s.scenarioId,
      status: "inconclusive" as const,
      violations: [],
      repairHints: [`loop_error: ${detail}`],
    })),
    emittedAt: clock().toISOString(),
  };
}
