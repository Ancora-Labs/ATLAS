import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluatePrometheusTopologyAdmission,
  normalizePrometheusParsedOutput,
} from "../../src/core/prometheus.js";

describe("prometheus target-delivery topology normalization", () => {
  it("recovers dispatch lanes from target-domain packets that omit worker metadata", () => {
    const parsed = normalizePrometheusParsedOutput({
      plans: [
        {
          taskId: "strike-social-ui",
          wave: 1,
          goal: "Build the STRIKE SOCIAL landing page hero, menu preview, ambience gallery, and events content.",
          root_cause: "The target repo has no shipped product surface yet.",
          target_files: ["src/App.tsx", "src/styles.css"],
          acceptance_criteria: ["Hero, menu, gallery, reservation, events, and social proof sections are visible."],
          verification: "npm run build",
        },
        {
          taskId: "strike-social-booking",
          wave: 1,
          goal: "Wire the simple booking form submit flow with date, time, players, contact info, and confirmation state.",
          root_cause: "The operator requested simple booking instead of a provider integration.",
          target_files: ["src/App.tsx"],
          acceptance_criteria: ["Submitting the reservation form shows a deterministic confirmation state."],
          verification: "npm run build",
        },
        {
          taskId: "strike-social-proof",
          wave: 2,
          goal: "Run accessibility, responsive, and contrast verification for the final landing page handoff.",
          root_cause: "The final product must prove visual quality across desktop and mobile.",
          target_files: ["README.md"],
          acceptance_criteria: ["Verification notes cover responsive layout, contrast, and booking flow behavior."],
          verification: "npm run build",
        },
      ],
    });

    const laneSet = new Set(parsed.plans.map((plan: any) => plan.capabilityLane));
    const admission = evaluatePrometheusTopologyAdmission(parsed.plans, { minLanes: 2 });

    assert.equal(admission.admitted, true);
    assert.ok(laneSet.has("implementation"));
    assert.ok(laneSet.has("integration"));
    assert.ok(laneSet.has("quality"));
    assert.equal(parsed.plans.find((plan: any) => plan.task_id === "strike-social-booking")?.role, "integration-worker");
  });

  it("[NEGATIVE] still rejects same-lane target packets when no separable lane signal exists", () => {
    const parsed = normalizePrometheusParsedOutput({
      plans: [
        {
          taskId: "copy-a",
          wave: 1,
          goal: "Update homepage marketing copy.",
          root_cause: "The target copy is incomplete.",
          target_files: ["src/App.tsx"],
          verification: "npm run build",
        },
        {
          taskId: "copy-b",
          wave: 1,
          goal: "Update homepage section labels.",
          root_cause: "The target labels are incomplete.",
          target_files: ["src/App.tsx"],
          verification: "npm run build",
        },
      ],
    });

    const admission = evaluatePrometheusTopologyAdmission(parsed.plans, { minLanes: 2 });

    assert.equal(admission.admitted, false);
    assert.equal(admission.laneCount, 1);
    assert.match(admission.reason, /worker_topology_insufficient/);
  });
});