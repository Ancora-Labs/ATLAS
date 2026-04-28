import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SessionModuleAdapter,
  parseUiDesignContract,
  parseUiScenarioMatrix,
} from "../../src/core/ui_contract/index.js";

describe("ui_contract session module adapter", () => {
  it("loads a session-local adapter module chosen by the runtime recipe", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-session-adapter-"));
    try {
      const modulePath = path.join(workspaceDir, "tmp", "ui_session_adapter.mjs");
      await fs.mkdir(path.dirname(modulePath), { recursive: true });
      await fs.writeFile(modulePath, `
export default {
  adapterId: "winui-capture",
  supports: ["visual", "structural", "behavioral", "accessibility"],
  async collect(input) {
    return {
      adapterId: "winui-capture",
      scenarioId: input.scenario.scenarioId,
      items: {
        visual: [{ evidenceClass: "visual", ruleId: "capture", pass: true, detail: "ok" }],
        structural: [{ evidenceClass: "structural", ruleId: "dom", pass: true, detail: "ok" }],
        behavioral: [{ evidenceClass: "behavioral", ruleId: "load", pass: true, detail: "ok" }],
        accessibility: [{ evidenceClass: "accessibility", ruleId: "a11y", pass: true, detail: "ok" }],
      },
      notes: ["version=1"],
    };
  },
};
`, "utf8");

      const contract = parseUiDesignContract({
        contractId: "session-module@v1",
        schemaVersion: 1,
        targetSurfaces: ["winui-runtime"],
        fields: {},
        requiredFields: [],
        forbiddenPatterns: [],
        accessibilityFloor: "WCAG-AA",
      });
      const matrix = parseUiScenarioMatrix({
        matrixId: "session-module@v1:matrix",
        schemaVersion: 1,
        scenarios: [{
          scenarioId: "winui-default",
          kind: "default",
          description: "custom platform runtime",
          surface: "winui-runtime",
          state: {},
        }],
      }, ["winui-runtime"]);

      const adapter = new SessionModuleAdapter("winui-runtime", {
        adapterId: "winui-capture",
        modulePath: ".\\tmp\\ui_session_adapter.mjs",
        workspacePath: workspaceDir,
      });

      const evidence = await adapter.collect({ contract, scenario: matrix.scenarios[0] });
      assert.equal(evidence.adapterId, "winui-capture");
      assert.equal(evidence.notes?.[0], "version=1");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("reloads the session-local adapter module after the worker updates it", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-session-adapter-reload-"));
    try {
      const modulePath = path.join(workspaceDir, "tmp", "ui_reload_adapter.mjs");
      await fs.mkdir(path.dirname(modulePath), { recursive: true });
      const writeVersion = async (version: string) => {
        await fs.writeFile(modulePath, `
export default {
  async collect(input) {
    return {
      adapterId: "custom-runtime",
      scenarioId: input.scenario.scenarioId,
      items: {
        visual: [{ evidenceClass: "visual", ruleId: "capture", pass: true, detail: "${version}" }],
      },
      notes: ["${version}"],
    };
  },
};
`, "utf8");
      };
      await writeVersion("v1");

      const contract = parseUiDesignContract({
        contractId: "reload@v1",
        schemaVersion: 1,
        targetSurfaces: ["custom-runtime"],
        fields: {},
        requiredFields: [],
        forbiddenPatterns: [],
        accessibilityFloor: "WCAG-AA",
      });
      const matrix = parseUiScenarioMatrix({
        matrixId: "reload@v1:matrix",
        schemaVersion: 1,
        scenarios: [{
          scenarioId: "reload-default",
          kind: "default",
          description: "reload custom adapter",
          surface: "custom-runtime",
          state: {},
        }],
      }, ["custom-runtime"]);

      const adapter = new SessionModuleAdapter("custom-runtime", {
        adapterId: "custom-runtime",
        modulePath: ".\\tmp\\ui_reload_adapter.mjs",
        workspacePath: workspaceDir,
      });

      const first = await adapter.collect({ contract, scenario: matrix.scenarios[0] });
      assert.equal(first.notes?.[0], "v1");

      await writeVersion("v2");
      const second = await adapter.collect({ contract, scenario: matrix.scenarios[0] });
      assert.equal(second.notes?.[0], "v2");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});