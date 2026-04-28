/**
 * ui_contract/verdict.ts — Rule-based verdict combiner (deterministic judge).
 *
 * This is the deterministic baseline judge. The architecture allows an
 * AI-backed judge to replace or augment this — they share the
 * `UiVerdict` / `UiScenarioVerdict` shape so consumers (loop controller,
 * worker reports) do not need to care which judge produced the verdict.
 *
 * Rules:
 *   - Any failed evidence item whose ruleId matches a `forbiddenPatterns`
 *     entry → scenario fails with that violation.
 *   - Any failed evidence item not in `forbiddenPatterns` → scenario still
 *     fails (default-strict) but the violation is recorded with the raw rule
 *     id so workers can decide whether to elevate it into the contract.
 *   - A scenario with zero evidence items is `inconclusive`.
 *   - Verdict `status` is `pass` iff every scenario is `pass`; `fail` if any
 *     scenario is `fail`; otherwise `inconclusive`.
 */

import type {
  UiAdapterEvidence,
  UiDesignContract,
  UiScenario,
  UiScenarioMatrix,
  UiScenarioVerdict,
  UiVerdict,
} from "./types.js";

export interface UiVerdictInput {
  contract: UiDesignContract;
  matrix: UiScenarioMatrix;
  evidenceByScenario: ReadonlyMap<string, UiAdapterEvidence>;
  /** Override clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => Date;
}

export function buildRuleBasedVerdict(input: UiVerdictInput): UiVerdict {
  const { contract, matrix, evidenceByScenario } = input;
  const now = input.now ?? (() => new Date());
  const forbidden = new Set(contract.forbiddenPatterns);

  const scenarios: UiScenarioVerdict[] = matrix.scenarios.map((scenario) =>
    judgeScenario(scenario, evidenceByScenario.get(scenario.scenarioId), forbidden),
  );

  const status = combineStatus(scenarios);

  return {
    contractId: contract.contractId,
    matrixId: matrix.matrixId,
    status,
    scenarios,
    emittedAt: now().toISOString(),
  };
}

function judgeScenario(
  scenario: UiScenario,
  evidence: UiAdapterEvidence | undefined,
  forbidden: ReadonlySet<string>,
): UiScenarioVerdict {
  if (!evidence) {
    return {
      scenarioId: scenario.scenarioId,
      status: "inconclusive",
      violations: [],
      repairHints: [`adapter produced no evidence for scenario: ${scenario.scenarioId}`],
    };
  }

  const allItems = Object.values(evidence.items).flatMap((items) => items ?? []);
  if (allItems.length === 0) {
    return {
      scenarioId: scenario.scenarioId,
      status: "inconclusive",
      violations: [],
      repairHints: [`adapter emitted zero evidence items for ${scenario.scenarioId}`],
    };
  }

  const violations: string[] = [];
  const repairHints: string[] = [];
  for (const item of allItems) {
    if (item.pass) continue;
    violations.push(item.ruleId);
    const tag = forbidden.has(item.ruleId) ? "contract" : "discovered";
    repairHints.push(`[${tag}] ${item.ruleId}: ${item.detail ?? "no detail"}`);
  }

  return {
    scenarioId: scenario.scenarioId,
    status: violations.length === 0 ? "pass" : "fail",
    violations,
    repairHints,
  };
}

function combineStatus(scenarios: ReadonlyArray<UiScenarioVerdict>): UiVerdict["status"] {
  if (scenarios.some((s) => s.status === "fail")) return "fail";
  if (scenarios.every((s) => s.status === "pass")) return "pass";
  return "inconclusive";
}
