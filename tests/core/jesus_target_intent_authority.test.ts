import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { applySingleTargetIntentAuthorityToDirective } from "../../src/core/jesus_supervisor.js";

describe("jesus target intent authority", () => {
  it("uses an objective-backed fallback brief when a selected ATLAS session is active before clarification hydration", () => {
    const config = {
      platformModeState: { currentMode: "single_target_delivery" },
      activeTargetSession: {
        projectId: "target_steakhouse",
        sessionId: "sess_1",
        currentStage: "active",
        clarification: { readyForPlanning: false },
        intent: { status: "pending" },
        objective: {
          summary: "Build a premium steakhouse landing page.",
          desiredOutcome: "Deliver a premium first-release marketing site.",
          acceptanceCriteria: [
            "Create a strong hero section with food visuals and a reservation CTA.",
            "Keep the premium visual direction intact for the first release.",
          ],
        },
        handoff: {
          carriedContextSummary: "Single premium landing page for a steakhouse launch.",
        },
        hints: {
          notes: [
            "Use the operator-provided hero photo when available.",
          ],
        },
        repo: {
          repoUrl: "https://github.com/acme/steakhouse.git",
          localPath: "C:/tmp/steakhouse",
        },
        workspace: {
          path: "C:/tmp/steakhouse",
        },
      },
    };

    const directive = applySingleTargetIntentAuthorityToDirective(config, { priorities: [] });

    assert.equal(directive.intentAuthority?.source, "active_target_session_objective");
    assert.match(String(directive.briefForPrometheus || ""), /ACTIVE TARGET SESSION OBJECTIVE AND MANIFEST NOTES/i);
    assert.match(String(directive.briefForPrometheus || ""), /Acceptance criteria:/i);
    assert.match(String(directive.briefForPrometheus || ""), /real external assets are allowed when needed/i);
    assert.match(String(directive.briefForPrometheus || ""), /preserve the requested visual medium and source strategy as planning constraints/i);
  });

  it("[NEGATIVE] keeps broad premium restaurant objectives off the explicit asset-sourcing guardrail until imagery is actually requested", () => {
    const config = {
      platformModeState: { currentMode: "single_target_delivery" },
      activeTargetSession: {
        projectId: "target_pizza",
        sessionId: "sess_generic_visuals",
        currentStage: "active",
        clarification: { readyForPlanning: false },
        intent: { status: "pending" },
        objective: {
          summary: "Build a premium pizza restaurant landing page with booking-first conversion.",
          desiredOutcome: "Ship a launch-ready dining site with premium hero and menu presentation.",
          acceptanceCriteria: [
            "Make the hero and menu feel premium and food-led.",
            "Keep the launch surface visually credible instead of generic.",
          ],
        },
        handoff: {
          carriedContextSummary: "Premium pizza launch page with strong menu storytelling.",
        },
        hints: {
          notes: ["Keep the launch surface cohesive and booking-first."],
        },
      },
    };

    const directive = applySingleTargetIntentAuthorityToDirective(config, { priorities: [] });

    assert.equal(directive.intentAuthority?.source, "active_target_session_objective");
    assert.doesNotMatch(String(directive.briefForPrometheus || ""), /real external assets are allowed when needed/i);
    assert.match(String(directive.briefForPrometheus || ""), /preserve the requested visual medium and source strategy as planning constraints/i);
  });

  it("[NEGATIVE] skips authority injection when a pending session has no usable objective evidence", () => {
    const config = {
      platformModeState: { currentMode: "single_target_delivery" },
      activeTargetSession: {
        projectId: "target_empty",
        sessionId: "sess_2",
        currentStage: "active",
        clarification: { readyForPlanning: false },
        intent: { status: "pending" },
        objective: {
          summary: "",
          desiredOutcome: "",
          acceptanceCriteria: [],
        },
        handoff: {
          carriedContextSummary: null,
        },
        hints: {
          notes: [],
        },
      },
    };

    const directive = applySingleTargetIntentAuthorityToDirective(config, {
      priorities: [],
      intentAuthority: { source: "stale" },
    });

    assert.equal("intentAuthority" in directive, false);
    assert.equal("briefForPrometheus" in directive, false);
  });
});