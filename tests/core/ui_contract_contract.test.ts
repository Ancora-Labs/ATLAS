import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseUiDesignContract,
  UiContractParseError,
} from "../../src/core/ui_contract/contract.js";

const VALID_CONTRACT = {
  contractId: "demo@v1",
  schemaVersion: 1,
  targetSurfaces: ["static-dom"],
  fields: {
    layoutModel: "shell+pane",
    density: "comfortable",
  },
  requiredFields: ["layoutModel"],
  forbiddenPatterns: ["modal_inside_modal"],
  accessibilityFloor: "WCAG-AA",
};

describe("parseUiDesignContract", () => {
  it("accepts and normalizes a valid contract", () => {
    const contract = parseUiDesignContract(VALID_CONTRACT);
    assert.equal(contract.contractId, "demo@v1");
    assert.equal(contract.schemaVersion, 1);
    assert.deepEqual(contract.targetSurfaces, ["static-dom"]);
    assert.deepEqual(contract.requiredFields, ["layoutModel"]);
    assert.deepEqual(contract.forbiddenPatterns, ["modal_inside_modal"]);
    assert.equal(contract.accessibilityFloor, "WCAG-AA");
    assert.equal(contract.fields.layoutModel, "shell+pane");
  });

  it("dedupes string arrays defensively", () => {
    const contract = parseUiDesignContract({
      ...VALID_CONTRACT,
      targetSurfaces: ["static-dom", "static-dom"],
      forbiddenPatterns: ["a", "a", "b"],
    });
    assert.deepEqual(contract.targetSurfaces, ["static-dom"]);
    assert.deepEqual(contract.forbiddenPatterns, ["a", "b"]);
  });

  it("rejects unsupported schemaVersion", () => {
    assert.throws(
      () => parseUiDesignContract({ ...VALID_CONTRACT, schemaVersion: 2 }),
      UiContractParseError,
    );
  });

  it("rejects when targetSurfaces is empty", () => {
    assert.throws(
      () => parseUiDesignContract({ ...VALID_CONTRACT, targetSurfaces: [] }),
      /at least one surface/,
    );
  });

  it("rejects requiredFields entry not present in fields", () => {
    assert.throws(
      () => parseUiDesignContract({ ...VALID_CONTRACT, requiredFields: ["missing"] }),
      /missing from fields/,
    );
  });

  it("rejects requiredFields entry with empty value", () => {
    assert.throws(
      () => parseUiDesignContract({
        ...VALID_CONTRACT,
        fields: { layoutModel: "" },
        requiredFields: ["layoutModel"],
      }),
      /empty value/,
    );
  });

  it("rejects non-object root", () => {
    assert.throws(() => parseUiDesignContract(null), UiContractParseError);
    assert.throws(() => parseUiDesignContract([]), UiContractParseError);
  });
});
