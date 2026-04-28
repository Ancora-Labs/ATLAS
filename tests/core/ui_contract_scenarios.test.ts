import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseUiScenarioMatrix,
  UiScenarioParseError,
} from "../../src/core/ui_contract/scenarios.js";

const VALID_MATRIX = {
  matrixId: "demo-matrix@v1",
  schemaVersion: 1,
  scenarios: [
    {
      scenarioId: "empty",
      kind: "empty",
      description: "Empty state",
      surface: "static-dom",
      state: { html: "<main></main>" },
    },
    {
      scenarioId: "populated",
      kind: "populated",
      description: "Populated state",
      surface: "static-dom",
      state: { html: "<main><nav></nav></main>" },
    },
  ],
};

describe("parseUiScenarioMatrix", () => {
  it("accepts a valid matrix when all surfaces are declared", () => {
    const matrix = parseUiScenarioMatrix(VALID_MATRIX, ["static-dom"]);
    assert.equal(matrix.matrixId, "demo-matrix@v1");
    assert.equal(matrix.scenarios.length, 2);
    assert.equal(matrix.scenarios[0].scenarioId, "empty");
  });

  it("rejects unknown surfaces", () => {
    assert.throws(
      () => parseUiScenarioMatrix(VALID_MATRIX, ["other-surface"]),
      /surface not declared/,
    );
  });

  it("rejects duplicate scenarioIds", () => {
    const dup = {
      ...VALID_MATRIX,
      scenarios: [VALID_MATRIX.scenarios[0], VALID_MATRIX.scenarios[0]],
    };
    assert.throws(() => parseUiScenarioMatrix(dup, ["static-dom"]), /duplicate scenarioId/);
  });

  it("rejects empty scenario lists", () => {
    assert.throws(
      () => parseUiScenarioMatrix({ ...VALID_MATRIX, scenarios: [] }, ["static-dom"]),
      UiScenarioParseError,
    );
  });

  it("rejects unsupported schemaVersion", () => {
    assert.throws(
      () => parseUiScenarioMatrix({ ...VALID_MATRIX, schemaVersion: 2 }, ["static-dom"]),
      UiScenarioParseError,
    );
  });
});
