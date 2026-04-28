import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { StaticDomAdapter } from "../../src/core/ui_contract/adapters/static_dom_adapter.js";
import { parseUiDesignContract } from "../../src/core/ui_contract/contract.js";
import { parseUiScenarioMatrix } from "../../src/core/ui_contract/scenarios.js";
import { buildRuleBasedVerdict } from "../../src/core/ui_contract/verdict.js";
import type { UiAdapterEvidence } from "../../src/core/ui_contract/types.js";

function makeContract() {
  return parseUiDesignContract({
    contractId: "demo@v1",
    schemaVersion: 1,
    targetSurfaces: ["static-dom"],
    fields: { layoutModel: "shell" },
    requiredFields: ["layoutModel"],
    forbiddenPatterns: ["modal_inside_modal", "img_alt_coverage"],
    accessibilityFloor: "WCAG-AA",
  });
}

function makeMatrix(scenarios: Array<Record<string, unknown>>) {
  return parseUiScenarioMatrix(
    {
      matrixId: "m@v1",
      schemaVersion: 1,
      scenarios,
    },
    ["static-dom"],
  );
}

describe("StaticDomAdapter + rule-based verdict", () => {
  it("passes a clean fixture", async () => {
    const contract = makeContract();
    const matrix = makeMatrix([
      {
        scenarioId: "clean",
        kind: "populated",
        surface: "static-dom",
        description: "clean",
        state: {
          html: "<main><nav></nav><img src=\"x\" alt=\"x\"/></main>",
          expectLandmarks: ["main", "nav"],
          contrastSamples: [{ id: "primary", ratio: 7.0 }],
        },
      },
    ]);

    const adapter = new StaticDomAdapter();
    const evidenceMap = new Map<string, UiAdapterEvidence>();
    for (const scenario of matrix.scenarios) {
      evidenceMap.set(scenario.scenarioId, await adapter.collect({ contract, scenario }));
    }

    const verdict = buildRuleBasedVerdict({
      contract,
      matrix,
      evidenceByScenario: evidenceMap,
      now: () => new Date("2026-04-24T00:00:00.000Z"),
    });

    assert.equal(verdict.status, "pass");
    assert.equal(verdict.scenarios[0].status, "pass");
    assert.equal(verdict.emittedAt, "2026-04-24T00:00:00.000Z");
  });

  it("fails fixtures missing landmarks and alt text", async () => {
    const contract = makeContract();
    const matrix = makeMatrix([
      {
        scenarioId: "broken",
        kind: "populated",
        surface: "static-dom",
        description: "broken",
        state: {
          html: "<div><img src=\"x\"/></div>",
          expectLandmarks: ["main"],
        },
      },
    ]);

    const adapter = new StaticDomAdapter();
    const evidenceMap = new Map<string, UiAdapterEvidence>();
    for (const scenario of matrix.scenarios) {
      evidenceMap.set(scenario.scenarioId, await adapter.collect({ contract, scenario }));
    }

    const verdict = buildRuleBasedVerdict({
      contract,
      matrix,
      evidenceByScenario: evidenceMap,
    });

    assert.equal(verdict.status, "fail");
    const scenario = verdict.scenarios[0];
    assert.equal(scenario.status, "fail");
    assert.ok(scenario.violations.includes("dom_landmark:main"), "expected landmark violation");
    assert.ok(scenario.violations.includes("img_alt_coverage"), "expected alt-text violation");
    // img_alt_coverage is in forbiddenPatterns → should be tagged [contract] in repair hints.
    assert.ok(
      scenario.repairHints.some((h) => h.startsWith("[contract] img_alt_coverage")),
      "alt-coverage hint should be tagged [contract]",
    );
    // dom_landmark is NOT in forbiddenPatterns → should be tagged [discovered].
    assert.ok(
      scenario.repairHints.some((h) => h.startsWith("[discovered] dom_landmark:main")),
      "missing-landmark hint should be tagged [discovered]",
    );
  });

  it("returns inconclusive when adapter emits no evidence", () => {
    const contract = makeContract();
    const matrix = makeMatrix([
      {
        scenarioId: "missing",
        kind: "populated",
        surface: "static-dom",
        description: "missing",
        state: { html: "<main></main>", expectLandmarks: [] },
      },
    ]);

    const verdict = buildRuleBasedVerdict({
      contract,
      matrix,
      evidenceByScenario: new Map(),
    });

    assert.equal(verdict.status, "inconclusive");
    assert.equal(verdict.scenarios[0].status, "inconclusive");
  });
});
