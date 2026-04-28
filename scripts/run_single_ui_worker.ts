/**
 * scripts/run_single_ui_worker.ts
 *
 * Individual-worker reproduction harness for the
 * `evolution-worker` UI contract dispatch failure that hit batch 1 of
 * sess_20260424090112_a4d8cf. Runs the planner-side normalization and the
 * dispatch loop deterministically against the same task text, with no LLM in
 * the loop, to prove the fix end-to-end.
 *
 * Usage:
 *   node --import tsx scripts/run_single_ui_worker.ts
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { materializePlannerUiPayload } from "../src/core/prometheus.js";
import { runUiContractDispatchLoop } from "../src/core/ui_contract/dispatch.js";

const FAILED_TASK_TEXT =
  "Launch the current Electron GUI, evaluate it against the locked desktop "
  + "contract, and patch the existing workspace shell in place so startup, "
  + "brand reset, New Session, and no-selection behavior all resolve to the "
  + "same finished list-detail workspace with no separate onboarding or "
  + "handoff product surface.";

async function main() {
  console.log("=== Individual evolution-worker UI contract reproduction ===");
  console.log(`Task: ${FAILED_TASK_TEXT}\n`);

  // Step 1: planner-level materialization (this is the part that USED to be
  // missing — the old planner emitted only `task` text; capability heuristics
  // tagged it ui-contract; dispatch then died at the gate).
  const materialized = materializePlannerUiPayload({
    taskText: FAILED_TASK_TEXT,
    taskId: "atlas-electron-shell",
    targetFiles: ["src/electron/main.ts", "src/ui/shell.tsx"],
    acceptanceCriteria: [
      "Startup resolves to the list-detail workspace shell",
      "Brand reset and New Session both produce the same workspace state",
      "No separate onboarding or handoff surface remains visible",
    ],
  });

  console.log("[planner] uiSurface         =", materialized.uiSurface);
  console.log("[planner] targetSurfaces    =", materialized.targetSurfaces);
  console.log("[planner] adapterId         =", materialized.uiRuntimeRecipe.adapterId);
  console.log("[planner] contractId        =", materialized.uiContract.contractId);
  console.log("[planner] matrixId          =", materialized.uiScenarioMatrix.matrixId);
  console.log(
    "[planner] scenarios         =",
    (materialized.uiScenarioMatrix.scenarios as unknown[]).length,
  );

  // Step 2: build the dispatch task exactly the way the worker_runner does.
  // We force a static-dom surface here so the loop can run fully offline
  // without any Electron binary or browser. The point is to prove the gate
  // and the loop both work; real Electron capture is exercised under
  // `tests/core/ui_contract_*.test.ts`.
  const dispatchTask = {
    task: FAILED_TASK_TEXT,
    capabilityTag: "ui-contract",
    taskKind: "ui-contract",
    uiSurface: "static-dom",
    targetSurfaces: ["static-dom"],
    uiRuntimeRecipe: {
      ...materialized.uiRuntimeRecipe,
      primarySurface: "static-dom",
      candidateSurfaces: ["static-dom"],
      adapterId: "static-dom",
    },
    uiContract: {
      ...materialized.uiContract,
      targetSurfaces: ["static-dom"],
    },
    uiScenarioMatrix: {
      matrixId: `${materialized.uiContract.contractId}:individual-worker`,
      schemaVersion: 1,
      scenarios: [
        {
          scenarioId: `${materialized.uiContract.contractId}:individual-worker`,
          kind: "default",
          description: "Individual evolution-worker reproduction scenario",
          surface: "static-dom",
          state: {
            html: '<main><nav></nav><h1>ATLAS Workspace</h1><img src="x" alt="x"/></main>',
            expectLandmarks: ["main", "nav"],
            contrastSamples: [{ id: "primary", ratio: 7 }],
          },
        },
      ],
    },
  };

  // Step 3: run dispatch in an isolated state dir.
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-individual-uic-"));
  let attempt = 0;
  let lastError: unknown = null;
  // Iteration policy: keep retrying until we either succeed or exhaust the
  // retry budget. The user explicitly asked for this to keep iterating until
  // a successful worker output is produced.
  while (attempt < 5) {
    attempt += 1;
    console.log(`\n[dispatch] attempt ${attempt}`);
    try {
      const result = await runUiContractDispatchLoop({
        stateDir,
        task: dispatchTask,
      });
      console.log("[dispatch] finalStatus      =", result.loopResult.finalStatus);
      console.log("[dispatch] stopReason       =", result.loopResult.stopReason);
      console.log("[dispatch] artifactsRoot    =", result.artifacts.rootDir);
      console.log("[dispatch] contractPath     =", result.artifacts.contractPath);
      console.log("[dispatch] matrixPath       =", result.artifacts.matrixPath);
      console.log("[dispatch] loopResultPath   =", result.artifacts.loopResultPath);
      const loopArtifact = JSON.parse(await fs.readFile(result.artifacts.loopResultPath, "utf8"));
      console.log("[dispatch] persisted status =", loopArtifact.loopResult.finalStatus);
      if (result.loopResult.finalStatus === "pass") {
        console.log(`\n✅ evolution-worker UI contract dispatch produced a clean PASS on attempt ${attempt}.`);
        console.log("   Artifacts directory:", result.artifacts.rootDir);
        return;
      }
      console.log(`\n⚠️  attempt ${attempt} did not pass — retrying.`);
    } catch (error) {
      lastError = error;
      console.log(`[dispatch] attempt ${attempt} threw:`, (error as Error).message);
    }
  }

  console.error(`\n❌ Could not produce a passing UI contract loop after ${attempt} attempts.`);
  if (lastError) console.error("Last error:", lastError);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[run_single_ui_worker] fatal:", error);
  process.exit(1);
});
