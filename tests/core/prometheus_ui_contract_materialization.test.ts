import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { materializePlannerUiPayload } from "../../src/core/prometheus.js";
import { parseUiDesignContract } from "../../src/core/ui_contract/contract.js";
import { parseUiScenarioMatrix } from "../../src/core/ui_contract/scenarios.js";

describe("prometheus ui-contract materialization", () => {
  it("synthesizes a complete dispatch-valid payload from minimal planner fields", () => {
    const result = materializePlannerUiPayload({
      taskText: "Improve target shell layout",
      taskId: "atlas-shell-layout",
      targetFiles: ["src/ui/shell.tsx"],
      acceptanceCriteria: ["Shell renders nav landmark", "Primary contrast ≥ 4.5"],
    });

    assert.equal(typeof result.uiSurface, "string");
    assert.ok(result.uiSurface.length > 0);
    assert.ok(result.targetSurfaces.includes(result.uiSurface));
    assert.equal(typeof result.uiRuntimeRecipe.primarySurface, "string");
    assert.deepEqual(result.uiRuntimeRecipe.candidateSurfaces, result.targetSurfaces);
    assert.equal(typeof result.uiRuntimeRecipe.adapterId, "string");

    const contract = parseUiDesignContract(result.uiContract);
    assert.ok(contract.targetSurfaces.length > 0);
    assert.ok(contract.requiredFields.includes("intent"));
    const matrix = parseUiScenarioMatrix(result.uiScenarioMatrix, contract.targetSurfaces);
    assert.ok(matrix.scenarios.length >= 1);
    assert.ok(contract.targetSurfaces.includes(matrix.scenarios[0].surface));
  });

  it("preserves explicit planner-supplied contract values and only fills gaps", () => {
    const explicitContract = {
      contractId: "atlas-shell@v3",
      schemaVersion: 1,
      targetSurfaces: ["electron-app"],
      fields: { layoutModel: "shell", brandTokens: "atlas" },
      requiredFields: ["layoutModel", "brandTokens"],
      forbiddenPatterns: ["modal_inside_modal"],
      accessibilityFloor: "WCAG-AAA",
    };

    const result = materializePlannerUiPayload({
      taskText: "Tune Electron shell",
      uiSurface: "electron-app",
      targetSurfaces: ["electron-app"],
      uiContract: explicitContract,
      uiRuntimeRecipe: {
        adapterId: "electron-capture",
        electronBinPath: "node_modules/.bin/electron.cmd",
      },
    });

    assert.equal(result.uiSurface, "electron-app");
    assert.deepEqual(result.uiRuntimeRecipe.adapterId, "electron-capture");
    assert.equal(result.uiRuntimeRecipe.electronBinPath, "node_modules/.bin/electron.cmd");
    assert.equal(result.uiContract.contractId, "atlas-shell@v3");
    assert.deepEqual(result.uiContract.requiredFields, ["layoutModel", "brandTokens"]);
    assert.equal(result.uiContract.accessibilityFloor, "WCAG-AAA");
    assert.equal((result.uiContract.fields as Record<string, unknown>).layoutModel, "shell");
  });

  it("infers electron-capture adapter from electron signals in the task text", () => {
    const result = materializePlannerUiPayload({
      taskText: "Capture Electron BrowserWindow shell screenshot for repair",
      targetFiles: ["src/electron/main.ts"],
    });
    assert.equal(result.uiSurface, "electron-app");
    assert.equal(result.uiRuntimeRecipe.adapterId, "electron-capture");
  });
});
