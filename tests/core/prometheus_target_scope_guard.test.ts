import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildPrometheusWorkflowPrompt,
  detectTargetDeliveryScopeDrift,
  TARGET_PROMETHEUS_STATIC_SECTIONS,
} from "../../src/core/prometheus.js";

describe("prometheus target scope guard", () => {
  it("detects BOX self-improvement packets drifting into target delivery mode", () => {
    const drift = detectTargetDeliveryScopeDrift([
      {
        title: "Split Prometheus identity and artifacts by runtime mode",
        task: "Retire evolution_progress from active planning truth and improve prompt cache lineage.",
        scope: "state/evolution_progress.json",
        target_files: ["state/evolution_progress.json", ".github/agents/prometheus.agent.md"],
        verification: "Inspect prompt_cache_usage telemetry and cycle_analytics state.",
      },
    ]);

    assert.equal(drift.driftedPlanCount, 1);
    assert.deepEqual(drift.driftedPlanTitles, ["Split Prometheus identity and artifacts by runtime mode"]);
    assert.ok(drift.reasons.includes("box_agents"));
    assert.ok(drift.reasons.includes("box_state_files"));
  });

  it("does not flag real target-repo delivery packets", () => {
    const drift = detectTargetDeliveryScopeDrift([
      {
        title: "Build STRIKE SOCIAL hero and reservation flow",
        task: "Implement the landing page hero, menu preview, and booking form confirmation UI.",
        scope: "src/App.tsx",
        target_files: ["src/App.tsx", "src/styles.css"],
        verification: "npm run build",
      },
      {
        title: "Add accessibility and responsive verification notes",
        task: "Document contrast, responsive, and reservation flow checks in the handoff README.",
        scope: "README.md",
        target_files: ["README.md"],
        verification: "npm run build",
      },
    ]);

    assert.equal(drift.driftedPlanCount, 0);
    assert.deepEqual(drift.reasons, []);
  });

  it("keeps target-mode workflow focused on target session artifacts instead of BOX canonical state files", () => {
    const prompt = buildPrometheusWorkflowPrompt(
      {
        platformModeState: { currentMode: "single_target_delivery" },
        activeTargetSession: {
          projectId: "target_bowling",
          sessionId: "sess_20260501113747_1eefbe",
          workspace: { path: "C:/targets/bowling" },
          objective: { summary: "Build the STRIKE SOCIAL site." },
        },
      },
      "C:/repo",
      "C:/state",
    );

    assert.match(prompt, /projects[\\/]target_bowling[\\/]sess_20260501113747_1eefbe[\\/]target_session\.json/i);
    assert.match(prompt, /projects[\\/]target_bowling[\\/]sess_20260501113747_1eefbe[\\/]target_intent_contract\.json/i);
    assert.doesNotMatch(prompt, /worker_cycle_artifacts\.json/i);
    assert.doesNotMatch(prompt, /capacity_scoreboard\.json/i);
  });

  it("forces release-signoff planning when closure staged that next action", () => {
    const prompt = buildPrometheusWorkflowPrompt(
      {
        platformModeState: { currentMode: "single_target_delivery" },
        activeTargetSession: {
          projectId: "target_water",
          sessionId: "sess_release_only",
          workspace: { path: "C:/targets/water" },
          objective: { summary: "Build the water landing page." },
          handoff: { nextAction: "run_release_signoff" },
        },
      },
      "C:/repo",
      "C:/state",
    );

    assert.match(prompt, /Closure focus: the target success contract is open only because release sign-off is missing/i);
    assert.match(prompt, /Plan only a release verification\/sign-off task/i);
    assert.match(prompt, /BOX_STATUS=done/i);
    assert.match(prompt, /BOX_MERGED_SHA|release-checks-passed/i);
  });

  it("adds sequential visual inspection guidance for design-heavy target planning", () => {
    const prompt = buildPrometheusWorkflowPrompt(
      {
        platformModeState: { currentMode: "single_target_delivery" },
        activeTargetSession: {
          projectId: "target_pizza",
          sessionId: "sess_visual_guard",
          workspace: { path: "C:/targets/pizza" },
          objective: { summary: "Plan a premium pizza landing page hero with high-quality photos." },
          intent: {
            scopeIn: ["hero image", "gallery images"],
            successCriteria: ["use premium pizza photography"],
          },
        },
      },
      "C:/repo",
      "C:/state",
    );

    assert.match(prompt, /inspect them strictly one at a time/i);
    assert.match(prompt, /Do not batch multiple screenshots or images into a single visual read/i);
    assert.match(prompt, /Bulk visual inspection is forbidden because it can overload the server/i);
  });

  it("uses a target-delivery plan schema instead of a self-improvement economics schema", () => {
    const prompt = TARGET_PROMETHEUS_STATIC_SECTIONS.targetOutputFormat.content;

    assert.match(prompt, /top-level "plans" array/i);
    assert.match(prompt, /prose-only wave lists are invalid/i);
    assert.match(prompt, /neutral compatibility values capacityDelta=0\.1 and requestROI=1\.0/i);
  });
});