import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UiAdapterRegistry } from "../../src/core/ui_contract/adapter.js";
import { StaticDomAdapter } from "../../src/core/ui_contract/adapters/static_dom_adapter.js";
import { parseUiDesignContract } from "../../src/core/ui_contract/contract.js";
import { runUiContractLoop } from "../../src/core/ui_contract/loop_controller.js";
import { parseUiScenarioMatrix } from "../../src/core/ui_contract/scenarios.js";

function buildHarness(html: string) {
  const contract = parseUiDesignContract({
    contractId: "demo@v1",
    schemaVersion: 1,
    targetSurfaces: ["static-dom"],
    fields: { layoutModel: "shell" },
    requiredFields: ["layoutModel"],
    forbiddenPatterns: ["img_alt_coverage"],
    accessibilityFloor: "WCAG-AA",
  });
  const state = { html, expectLandmarks: ["main"] };
  const matrix = parseUiScenarioMatrix(
    {
      matrixId: "m@v1",
      schemaVersion: 1,
      scenarios: [
        { scenarioId: "only", kind: "populated", description: "", surface: "static-dom", state },
      ],
    },
    ["static-dom"],
  );
  const registry = new UiAdapterRegistry();
  registry.register(new StaticDomAdapter());
  return { contract, matrix, registry, state };
}

describe("runUiContractLoop", () => {
  it("stops with verdict_pass on a clean fixture", async () => {
    const { contract, matrix, registry } = buildHarness(
      "<main><img src=\"x\" alt=\"x\"/></main>",
    );
    const result = await runUiContractLoop({
      contract,
      matrix,
      registry,
      limits: { maxAttempts: 3 },
    });
    assert.equal(result.stopReason, "verdict_pass");
    assert.equal(result.finalStatus, "pass");
    assert.equal(result.attempts.length, 1);
  });

  it("stops with repair_unavailable when no repair callback is provided", async () => {
    const { contract, matrix, registry } = buildHarness("<div><img src=\"x\"/></div>");
    const result = await runUiContractLoop({
      contract,
      matrix,
      registry,
      limits: { maxAttempts: 3 },
    });
    assert.equal(result.stopReason, "repair_unavailable");
    assert.equal(result.finalStatus, "fail");
    assert.equal(result.attempts.length, 1);
  });

  it("invokes repair, re-renders, and stops with verdict_pass after fix", async () => {
    const { contract, matrix, registry } = buildHarness("<div><img src=\"x\"/></div>");
    let repairCalls = 0;
    const result = await runUiContractLoop({
      contract,
      matrix,
      registry,
      limits: { maxAttempts: 3 },
      repair: async () => {
        repairCalls++;
        // Simulate a worker patching the source. Scenarios are immutable
        // post-parse, so mutate the scenario's own state object — the same
        // reference the adapter will read on the next pass.
        matrix.scenarios[0].state.html = "<main><img src=\"x\" alt=\"ok\"/></main>";
        return true;
      },
    });
    assert.equal(repairCalls, 1);
    assert.equal(result.stopReason, "verdict_pass");
    assert.equal(result.finalStatus, "pass");
    assert.equal(result.attempts.length, 2);
  });

  it("stops with no_progress when repair does not change violations", async () => {
    const { contract, matrix, registry } = buildHarness("<div><img src=\"x\"/></div>");
    let repairCalls = 0;
    const result = await runUiContractLoop({
      contract,
      matrix,
      registry,
      limits: { maxAttempts: 5 },
      repair: async () => {
        repairCalls++;
        return true; // Pretend repair happened, but state never changes.
      },
    });
    assert.equal(result.stopReason, "no_progress");
    assert.equal(result.finalStatus, "fail");
    // 1st attempt records baseline, repair runs, 2nd attempt sees identical
    // violations → no_progress. So attempts.length should be 2 and repairCalls 1.
    assert.equal(result.attempts.length, 2);
    assert.equal(repairCalls, 1);
  });

  it("stops with max_attempts when limit is hit before pass", async () => {
    const { contract, matrix, registry } = buildHarness("<div><img src=\"x\"/></div>");
    let pass = 0;
    const result = await runUiContractLoop({
      contract,
      matrix,
      registry,
      limits: { maxAttempts: 2 },
      repair: async () => {
        pass++;
        // Mutate the scenario's own state every pass to a NEW failing fixture
        // so violations differ each iteration → no_progress is not triggered.
        matrix.scenarios[0].state.html = `<div data-pass="${pass}"><img src="x"/></div>`;
        matrix.scenarios[0].state.expectLandmarks = [`main_${pass}`];
        return true;
      },
    });
    assert.equal(result.stopReason, "max_attempts");
    assert.equal(result.attempts.length, 2);
  });

  it("rejects invalid maxAttempts", async () => {
    const { contract, matrix, registry } = buildHarness("<main></main>");
    await assert.rejects(
      () => runUiContractLoop({ contract, matrix, registry, limits: { maxAttempts: 0 } }),
      /maxAttempts/,
    );
  });
});
