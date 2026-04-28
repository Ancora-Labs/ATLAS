/**
 * ui_contract/scenarios.ts — Deterministic parser/normalizer for scenario matrices.
 *
 * The matrix says WHICH states must be inspected. Selecting which scenarios
 * matter for a given product is an AI/upstream decision; this module only
 * validates structure.
 */

import type { UiScenario, UiScenarioMatrix } from "./types.js";

export class UiScenarioParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UiScenarioParseError";
  }
}

export function parseUiScenarioMatrix(raw: unknown, surfaces: ReadonlyArray<string>): UiScenarioMatrix {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UiScenarioParseError("matrix must be a non-array object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1) {
    throw new UiScenarioParseError(`unsupported schemaVersion: ${String(obj.schemaVersion)}`);
  }
  const matrixId = requireNonEmptyString(obj.matrixId, "matrixId");
  const scenariosRaw = obj.scenarios;
  if (!Array.isArray(scenariosRaw) || scenariosRaw.length === 0) {
    throw new UiScenarioParseError("scenarios must be a non-empty array");
  }

  const surfaceSet = new Set(surfaces);
  const seenIds = new Set<string>();
  const scenarios: UiScenario[] = [];
  for (const entry of scenariosRaw) {
    const scenario = parseScenario(entry, surfaceSet);
    if (seenIds.has(scenario.scenarioId)) {
      throw new UiScenarioParseError(`duplicate scenarioId: ${scenario.scenarioId}`);
    }
    seenIds.add(scenario.scenarioId);
    scenarios.push(scenario);
  }

  return { matrixId, schemaVersion: 1, scenarios };
}

function parseScenario(raw: unknown, surfaceSet: Set<string>): UiScenario {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UiScenarioParseError("scenario must be a non-array object");
  }
  const obj = raw as Record<string, unknown>;
  const scenarioId = requireNonEmptyString(obj.scenarioId, "scenarioId");
  const kind = requireNonEmptyString(obj.kind, "kind");
  const description = typeof obj.description === "string" ? obj.description : "";
  const surface = requireNonEmptyString(obj.surface, "surface");
  if (!surfaceSet.has(surface)) {
    throw new UiScenarioParseError(`scenario surface not declared on contract: ${surface}`);
  }
  const state = obj.state && typeof obj.state === "object" && !Array.isArray(obj.state)
    ? { ...(obj.state as Record<string, unknown>) }
    : {};
  return { scenarioId, kind, description, surface, state };
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new UiScenarioParseError(`${field} must be a non-empty string`);
  }
  return value;
}
