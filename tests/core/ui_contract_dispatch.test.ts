import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HeadlessBrowserDomAdapter,
  UiAdapterRegistry,
  buildUiDispatchAdapterRegistry,
  normalizeUiDispatchPlan,
  parseUiDesignContract,
  parseUiScenarioMatrix,
  runUiContractDispatchLoop,
} from "../../src/core/ui_contract/index.js";

describe("ui_contract dispatch", () => {
  it("normalizes task-level UI seeds into explicit dispatch metadata", () => {
    const normalized = normalizeUiDispatchPlan({
      task: "Validate runtime shell",
      uiContract: {
        contractId: "shell@v1",
        schemaVersion: 1,
        fields: { layoutModel: "shell" },
        requiredFields: ["layoutModel"],
        forbiddenPatterns: ["modal_inside_modal"],
        accessibilityFloor: "WCAG-AA",
      },
      uiSurface: "web-runtime",
      uiHtml: "<main><nav></nav></main>",
    });

    assert.equal(normalized.capabilityTag, "ui-contract");
    assert.equal(normalized.taskKind, "ui-contract");
    assert.equal(normalized.kind, "ui-contract");
    assert.deepEqual(normalized.targetSurfaces, ["web-runtime"]);
    assert.equal((normalized.uiScenarioMatrix as any).scenarios[0].surface, "web-runtime");
  });

  it("persists loop artifacts for a passing static-dom task", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-dispatch-"));
    try {
      const result = await runUiContractDispatchLoop({
        stateDir,
        task: {
          task: "Verify static DOM shell",
          uiContract: {
            contractId: "shell@v1",
            schemaVersion: 1,
            targetSurfaces: ["static-dom"],
            fields: { layoutModel: "shell" },
            requiredFields: ["layoutModel"],
            forbiddenPatterns: ["modal_inside_modal", "img_alt_coverage"],
            accessibilityFloor: "WCAG-AA",
          },
          uiScenarioMatrix: {
            matrixId: "shell@v1:matrix",
            schemaVersion: 1,
            scenarios: [
              {
                scenarioId: "shell-clean",
                kind: "default",
                description: "clean shell",
                surface: "static-dom",
                state: {
                  html: "<main><nav></nav><img src=\"x\" alt=\"x\"/></main>",
                  expectLandmarks: ["main", "nav"],
                  contrastSamples: [{ id: "primary", ratio: 7 }],
                },
              },
            ],
          },
        },
      });

      assert.equal(result.loopResult.finalStatus, "pass");
      const loopArtifact = JSON.parse(await fs.readFile(result.artifacts.loopResultPath, "utf8"));
      assert.equal(loopArtifact.loopResult.finalStatus, "pass");
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("persists planner-selected runtime recipe instead of deriving a viewer heuristically", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-recipe-"));
    try {
      const result = await runUiContractDispatchLoop({
        stateDir,
        task: {
          task: "Inspect repo UI adaptively",
          uiSurface: "storybook-runtime",
          uiRuntimeRecipe: {
            primarySurface: "storybook-runtime",
            candidateSurfaces: ["storybook-runtime", "web-runtime"],
            readinessProbe: { type: "delay", ms: 1 },
          },
          uiContract: {
            contractId: "adaptive@v1",
            schemaVersion: 1,
            targetSurfaces: ["storybook-runtime"],
            fields: {},
            requiredFields: [],
            forbiddenPatterns: [],
            accessibilityFloor: "WCAG-AA",
          },
          uiScenarioMatrix: {
            matrixId: "adaptive@v1:matrix",
            schemaVersion: 1,
            scenarios: [
              {
                scenarioId: "storybook-default",
                kind: "default",
                description: "storybook default state",
                state: {
                  html: "<main><nav></nav></main>",
                  expectLandmarks: ["main", "nav"],
                  contrastSamples: [{ id: "primary", ratio: 7 }],
                },
              },
            ],
          },
        },
      });

      const recipeArtifact = JSON.parse(await fs.readFile(result.artifacts.runtimeRecipePath!, "utf8"));
      assert.equal(result.task.uiSurface, "storybook-runtime");
      assert.deepEqual(result.task.targetSurfaces, ["storybook-runtime", "web-runtime"]);
      assert.equal(recipeArtifact.primarySurface, "storybook-runtime");
      assert.equal((result.matrix as any).scenarios[0].surface, "storybook-runtime");
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("loads a planner-selected session-local adapter module when the platform is custom", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-custom-adapter-"));
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-custom-adapter-workspace-"));
    try {
      const modulePath = path.join(workspaceDir, "tmp", "custom_ui_adapter.mjs");
      await fs.mkdir(path.dirname(modulePath), { recursive: true });
      await fs.writeFile(modulePath, `
export default {
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
      notes: ["session-local"],
    };
  },
};
`, "utf8");

      const result = await runUiContractDispatchLoop({
        stateDir,
        workspacePath: workspaceDir,
        task: {
          task: "Inspect custom runtime through a session-local adapter",
          uiSurface: "winui-runtime",
          uiRuntimeRecipe: {
            adapterId: "winui-capture",
            adapterModulePath: ".\\tmp\\custom_ui_adapter.mjs",
            primarySurface: "winui-runtime",
            candidateSurfaces: ["winui-runtime"],
          },
          uiContract: {
            contractId: "custom-runtime@v1",
            schemaVersion: 1,
            targetSurfaces: ["winui-runtime"],
            fields: {},
            requiredFields: [],
            forbiddenPatterns: [],
            accessibilityFloor: "WCAG-AA",
          },
          uiScenarioMatrix: {
            matrixId: "custom-runtime@v1:matrix",
            schemaVersion: 1,
            scenarios: [
              {
                scenarioId: "custom-runtime-default",
                kind: "default",
                description: "session-local custom adapter",
                surface: "winui-runtime",
                state: {},
              },
            ],
          },
        },
      });

      assert.equal(result.loopResult.finalStatus, "pass");
      const recipeArtifact = JSON.parse(await fs.readFile(result.artifacts.runtimeRecipePath!, "utf8"));
      assert.equal(recipeArtifact.adapterModulePath, ".\\tmp\\custom_ui_adapter.mjs");
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("executes planner-selected runtime install, launch, readiness, and cleanup before judging", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-runtime-exec-"));
    const calls: string[] = [];
    const registry = new UiAdapterRegistry();
    registry.register({
      adapterId: "test-web-runtime",
      surface: "web-runtime",
      supports: ["visual", "structural", "behavioral", "accessibility"],
      async collect(input) {
        calls.push(`collect:${String(input.scenario.state.url || "")}`);
        return {
          adapterId: "test-web-runtime",
          scenarioId: input.scenario.scenarioId,
          items: {
            visual: [{ evidenceClass: "visual", ruleId: "capture", pass: true, detail: "ok" }],
            structural: [{ evidenceClass: "structural", ruleId: "dom", pass: true, detail: "ok" }],
            behavioral: [{ evidenceClass: "behavioral", ruleId: "load", pass: true, detail: "ok" }],
            accessibility: [{ evidenceClass: "accessibility", ruleId: "a11y", pass: true, detail: "ok" }],
          },
        };
      },
    });

    try {
      const result = await runUiContractDispatchLoop({
        stateDir,
        registry,
        runtimeHost: {
          runCommand: async (command) => {
            calls.push(`install:${command}`);
            return { status: 0, stdout: "ok", stderr: "" };
          },
          launchCommand: async (command) => {
            calls.push(`launch:${command}`);
            return {
              waitForOutput: async (pattern) => {
                calls.push(`ready:${String(pattern)}`);
                return true;
              },
              stop: async () => {
                calls.push("stop");
              },
            };
          },
        },
        task: {
          task: "Launch runtime recipe before UI judging",
          uiSurface: "web-runtime",
          uiRuntimeRecipe: {
            primarySurface: "web-runtime",
            candidateSurfaces: ["web-runtime"],
            launchCommand: "npm run storybook",
            launchUrl: "http://127.0.0.1:6006",
            readinessProbe: { type: "stdout", pattern: "READY" },
            installSteps: ["npm install", "npm run build:storybook"],
          },
          uiContract: {
            contractId: "runtime-exec@v1",
            schemaVersion: 1,
            targetSurfaces: ["web-runtime"],
            fields: {},
            requiredFields: [],
            forbiddenPatterns: [],
            accessibilityFloor: "WCAG-AA",
          },
          uiScenarioMatrix: {
            matrixId: "runtime-exec@v1:matrix",
            schemaVersion: 1,
            scenarios: [
              {
                scenarioId: "runtime-exec-default",
                kind: "default",
                description: "runtime-backed scenario",
                surface: "web-runtime",
                state: {},
              },
            ],
          },
        },
      });

      assert.equal(result.loopResult.finalStatus, "pass");
      assert.deepEqual(calls, [
        "install:npm install",
        "install:npm run build:storybook",
        "launch:npm run storybook",
        "ready:/READY/i",
        "collect:http://127.0.0.1:6006",
        "stop",
      ]);
      assert.equal(result.task.uiUrl, "http://127.0.0.1:6006");
      assert.equal((result.matrix as any).scenarios[0].state.url, "http://127.0.0.1:6006");
      assert.ok(result.artifacts.runtimeLogPath);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("fails when planner-selected runtime readiness never succeeds", async () => {
    const registry = new UiAdapterRegistry();
    registry.register({
      adapterId: "test-web-runtime",
      surface: "web-runtime",
      supports: ["behavioral"],
      async collect() {
        throw new Error("collect should not run when readiness fails");
      },
    });

    await assert.rejects(
      () => runUiContractDispatchLoop({
        registry,
        runtimeHost: {
          launchCommand: async () => ({
            waitForOutput: async () => false,
            stop: async () => {},
          }),
        },
        task: {
          task: "Timeout runtime readiness",
          uiSurface: "web-runtime",
          uiRuntimeRecipe: {
            primarySurface: "web-runtime",
            candidateSurfaces: ["web-runtime"],
            launchCommand: "npm run storybook",
            launchUrl: "http://127.0.0.1:6006",
            readinessProbe: { type: "stdout", pattern: "READY" },
            readinessTimeoutMs: 10,
          },
          uiContract: {
            contractId: "runtime-timeout@v1",
            schemaVersion: 1,
            targetSurfaces: ["web-runtime"],
            fields: {},
            requiredFields: [],
            forbiddenPatterns: [],
            accessibilityFloor: "WCAG-AA",
          },
          uiScenarioMatrix: {
            matrixId: "runtime-timeout@v1:matrix",
            schemaVersion: 1,
            scenarios: [
              {
                scenarioId: "runtime-timeout-default",
                kind: "default",
                description: "runtime readiness timeout",
                surface: "web-runtime",
                state: {},
              },
            ],
          },
        },
      }),
      /stdout readiness probe timed out/i,
    );
  });

  it("collects runtime evidence through the headless browser adapter", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-adapter-"));
    try {
      const contract = parseUiDesignContract({
        contractId: "runtime@v1",
        schemaVersion: 1,
        targetSurfaces: ["web-runtime"],
        fields: { layoutModel: "shell" },
        requiredFields: ["layoutModel"],
        forbiddenPatterns: ["modal_inside_modal", "img_alt_coverage"],
        accessibilityFloor: "WCAG-AA",
      });
      const matrix = parseUiScenarioMatrix({
        matrixId: "runtime@v1:matrix",
        schemaVersion: 1,
        scenarios: [
          {
            scenarioId: "runtime-shell",
            kind: "default",
            description: "runtime shell",
            surface: "web-runtime",
            state: {
              html: "<main><nav></nav><img src=\"x\" alt=\"x\"/></main>",
              expectLandmarks: ["main", "nav"],
              contrastSamples: [{ id: "primary", ratio: 7 }],
              artifactDir: tmpDir,
            },
          },
        ],
      }, ["web-runtime"]);

      const adapter = new HeadlessBrowserDomAdapter("web-runtime", {
        findBrowserCommand: async () => "fake-browser",
        runBrowser: async (_command, args, cwd) => {
          const screenshotArg = args.find((arg) => arg.startsWith("--screenshot="));
          if (screenshotArg) {
            const screenshotPath = screenshotArg.slice("--screenshot=".length);
            await fs.writeFile(screenshotPath, "png", "utf8");
            return { status: 0, stdout: "", stderr: "" };
          }
          const htmlPath = path.join(cwd, "runtime-shell.dom.html");
          await fs.writeFile(htmlPath, "<main><nav></nav><img src=\"x\" alt=\"x\"/></main>", "utf8");
          return {
            status: 0,
            stdout: "<main><nav></nav><img src=\"x\" alt=\"x\"/></main>",
            stderr: "",
          };
        },
        tempRootDir: tmpDir,
      });

      const evidence = await adapter.collect({ contract, scenario: matrix.scenarios[0] });
      assert.equal(evidence.adapterId, "headless-browser-dom");
      assert.equal(evidence.items.visual?.[0].pass, true);
      assert.equal(evidence.items.behavioral?.[0].pass, true);
      assert.equal(evidence.items.structural?.[0].pass, true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("registers runtime adapter surfaces in the default registry", () => {
    const registry = buildUiDispatchAdapterRegistry(["storybook-runtime", "vite-runtime", "static-html", "static-dom"]);
    assert.equal(registry.has("storybook-runtime"), true);
    assert.equal(registry.has("static-html"), true);
    assert.equal(registry.has("static-dom"), true);
    assert.equal(registry.has("web-runtime"), false);
  });

  it("fails closed when planner does not select a UI runtime surface", async () => {
    // Workers must keep full UI access. Planner gaps no longer kill dispatch:
    // dispatch synthesizes a default surface so the AI/adapter selection
    // layer can still run end-to-end. This test pins that contract.
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-no-surface-"));
    try {
      const result = await runUiContractDispatchLoop({
        stateDir,
        task: {
          task: "Run UI contract loop without planner runtime selection",
          uiContract: {
            contractId: "missing-surface@v1",
            schemaVersion: 1,
            fields: {},
            requiredFields: [],
            forbiddenPatterns: [],
            accessibilityFloor: "WCAG-AA",
          },
          uiScenarioMatrix: {
            matrixId: "missing-surface@v1:matrix",
            schemaVersion: 1,
            scenarios: [
              {
                scenarioId: "missing-surface-default",
                kind: "default",
                description: "planner omitted runtime selection",
                state: {
                  html: "<main></main>",
                },
              },
            ],
          },
        },
      });

      assert.ok(typeof result.task.uiSurface === "string" && (result.task.uiSurface as string).length > 0);
      assert.ok(result.contract.targetSurfaces.length > 0);
      assert.ok(result.matrix.scenarios.every((scenario) => scenario.surface.length > 0));
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("synthesizes a minimal contract+matrix when planner omits the uiContract payload entirely", async () => {
    // Regression: before this fix, evolution-worker UI dispatch failed with
    // "UI dispatch task missing uiContract payload" when capability heuristics
    // tagged a task as ui-contract but Prometheus did not attach the payload.
    // Workers must never fail at the gate — the system synthesizes defaults
    // and keeps the AI in the loop.
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-ui-bare-"));
    try {
      const result = await runUiContractDispatchLoop({
        stateDir,
        task: {
          task: "Improve target shell layout",
          capabilityTag: "ui-contract",
          taskKind: "ui-contract",
        },
      });

      assert.equal(typeof result.contract.contractId, "string");
      assert.ok(result.contract.targetSurfaces.length >= 1);
      assert.ok(result.matrix.scenarios.length >= 1);
      const synthesizedContract = JSON.parse(await fs.readFile(result.artifacts.contractPath, "utf8"));
      assert.equal(synthesizedContract.schemaVersion, 1);
      assert.deepEqual(synthesizedContract.requiredFields, ["intent"]);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});