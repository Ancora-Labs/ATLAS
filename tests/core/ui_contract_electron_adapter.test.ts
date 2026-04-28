import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ElectronCaptureAdapter,
  buildUiDispatchAdapterRegistry,
  parseUiDesignContract,
  parseUiScenarioMatrix,
} from "../../src/core/ui_contract/index.js";

describe("ui_contract electron capture adapter", () => {
  it("collects evidence from a faked Electron capture run", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-electron-adapter-"));
    try {
      const contract = parseUiDesignContract({
        contractId: "atlas-shell@v1",
        schemaVersion: 1,
        targetSurfaces: ["electron-renderer"],
        fields: { layoutModel: "two-pane" },
        requiredFields: ["layoutModel"],
        forbiddenPatterns: ["modal_inside_modal"],
        accessibilityFloor: "WCAG-AA",
      });
      const matrix = parseUiScenarioMatrix({
        matrixId: "atlas-shell@v1:matrix",
        schemaVersion: 1,
        scenarios: [
          {
            scenarioId: "shell-blank",
            kind: "default",
            description: "blank shell",
            surface: "electron-renderer",
            state: {
              html: "<main><nav></nav><img src=\"x\" alt=\"x\"/></main>",
              expectLandmarks: ["main", "nav"],
              contrastSamples: [{ id: "primary", ratio: 7 }],
              artifactDir: tmpDir,
            },
          },
        ],
      }, ["electron-renderer"]);

      const adapter = new ElectronCaptureAdapter("electron-renderer", {
        findElectronBinary: async () => "fake-electron",
        runElectron: async (_binary, args, _cwd) => {
          const screenshotArg = args.find((a) => a.startsWith("--screenshot="));
          const domArg = args.find((a) => a.startsWith("--dom="));
          assert.ok(screenshotArg, "screenshot arg present");
          assert.ok(domArg, "dom arg present");
          const screenshotPath = screenshotArg!.slice("--screenshot=".length);
          const domPath = domArg!.slice("--dom=".length);
          await fs.writeFile(screenshotPath, "png-bytes");
          await fs.writeFile(
            domPath,
            "<main><nav></nav><img src=\"x\" alt=\"x\"/></main>",
            "utf8",
          );
          return { status: 0, stdout: "CAPTURE_OK\n", stderr: "" };
        },
        tempRootDir: tmpDir,
      });

      const evidence = await adapter.collect({ contract, scenario: matrix.scenarios[0] });
      assert.equal(evidence.adapterId, "electron-capture");
      assert.equal(evidence.items.visual?.[0].pass, true);
      assert.equal(evidence.items.behavioral?.[0].pass, true);
      assert.equal(evidence.items.structural?.find((i) => i.ruleId === "dom_landmark:main")?.pass, true);
      assert.equal(evidence.items.structural?.find((i) => i.ruleId === "dom_landmark:nav")?.pass, true);
      assert.equal(
        evidence.items.accessibility?.find((i) => i.ruleId === "img_alt_coverage")?.pass,
        true,
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("fails when the Electron binary cannot be located", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-electron-missing-"));
    try {
      const contract = parseUiDesignContract({
        contractId: "missing@v1",
        schemaVersion: 1,
        targetSurfaces: ["electron-renderer"],
        fields: {},
        requiredFields: [],
        forbiddenPatterns: [],
        accessibilityFloor: "WCAG-AA",
      });
      const matrix = parseUiScenarioMatrix({
        matrixId: "missing@v1:matrix",
        schemaVersion: 1,
        scenarios: [
          {
            scenarioId: "no-binary",
            kind: "default",
            description: "no electron available",
            surface: "electron-renderer",
            state: {
              html: "<main></main>",
              artifactDir: tmpDir,
            },
          },
        ],
      }, ["electron-renderer"]);

      const adapter = new ElectronCaptureAdapter("electron-renderer", {
        findElectronBinary: async () => null,
      });

      await assert.rejects(
        () => adapter.collect({ contract, scenario: matrix.scenarios[0] }),
        /could not locate an Electron binary/i,
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("registers the electron adapter when the runtime recipe selects it", () => {
    const registry = buildUiDispatchAdapterRegistry(["atlas-electron-renderer"], {
      runtimeRecipe: {
        primarySurface: "atlas-electron-renderer",
        candidateSurfaces: ["atlas-electron-renderer"],
      },
    });
    assert.equal(registry.has("atlas-electron-renderer"), true);
    const adapter = registry.resolve("atlas-electron-renderer");
    assert.equal(adapter.adapterId, "electron-capture");
  });

  it("registers the electron adapter when adapterId is explicit", () => {
    const registry = buildUiDispatchAdapterRegistry(["custom-renderer"], {
      runtimeRecipe: { adapterId: "electron-capture" },
    });
    const adapter = registry.resolve("custom-renderer");
    assert.equal(adapter.adapterId, "electron-capture");
  });

  it("uses explicit headless adapter selection for non-electron surfaces", () => {
    const registry = buildUiDispatchAdapterRegistry(["custom-renderer"], {
      runtimeRecipe: { adapterId: "headless-browser-dom" },
    });
    const adapter = registry.resolve("custom-renderer");
    assert.equal(adapter.adapterId, "headless-browser-dom");
  });

  it("fails closed for unknown planner-selected adapter ids", () => {
    assert.throws(
      () => buildUiDispatchAdapterRegistry(["custom-renderer"], {
        runtimeRecipe: { adapterId: "winui-capture" },
      }),
      /unsupported planner-selected uiruntimerecipe\.adapterid: winui-capture/i,
    );
  });

  it("falls back to headless adapter when no electron hint is present", () => {
    const registry = buildUiDispatchAdapterRegistry(["web-runtime"]);
    const adapter = registry.resolve("web-runtime");
    assert.equal(adapter.adapterId, "headless-browser-dom");
  });
});
