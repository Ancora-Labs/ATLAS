import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSingleTargetResumeDirective, classifySingleTargetAthenaFeedback } from "../../src/core/orchestrator.js";
import { isResearchArtifactAlignedToTargetSession } from "../../src/core/prometheus.js";

describe("single target feedback routing", () => {
  it("routes empty-repo stack uncertainty back into research refresh", () => {
    const category = classifySingleTargetAthenaFeedback({
      reason: {
        code: "LOW_PLAN_QUALITY",
        message: "Need stronger stack and architecture evidence before bootstrap planning",
      },
      corrections: ["Gather framework and hosting evidence for the MVP"],
    }, {
      repoProfile: { repoState: "empty" },
      intent: { repoState: "empty" },
    });

    assert.equal(category, "research");
  });

  it("routes unclear target intent back into clarification", () => {
    const category = classifySingleTargetAthenaFeedback({
      reason: {
        code: "LOW_PLAN_QUALITY",
        message: "User intent is still unclear and scope is ambiguous",
      },
      corrections: ["Clarify primary user and success criteria"],
    }, {
      repoProfile: { repoState: "empty" },
      intent: { repoState: "empty" },
    });

    assert.equal(category, "intent");
  });

  it("routes ui quality-bar downgrade rejections back into research refresh", () => {
    const category = classifySingleTargetAthenaFeedback({
      reason: {
        code: "PATCHED_PLAN_CONTRACT_FAILED",
        message: "Normalized patched plans failed contract re-validation: plan[2] silently downgrades an explicit operator requirement or quality bar into a cheaper substitute.",
      },
      corrections: [
        "plan[2]: do not replace the product shell with a cheaper dashboard-style onboarding page",
      ],
    }, {
      repoProfile: { repoState: "existing" },
      intent: {
        repoState: "existing",
        preferredQualityBar: "Premium Windows desktop product quality with no generic dashboard drift.",
        designDirection: "Preserve a product-owned monochrome desktop shell.",
        scopeOut: ["Generic dark dashboard-card reskins"],
        successCriteria: ["The UI does not degrade into a cheaper substitute."],
      },
    });

    assert.equal(category, "research");
  });

  it("builds a resume directive that bypasses Jesus for pending research refresh handoffs", () => {
    const directive = buildSingleTargetResumeDirective({
      platformModeState: { currentMode: "single_target_delivery" },
      activeTargetSession: {
        projectId: "target_atlas",
        sessionId: "sess_123",
        objective: {
          summary: "Continue the Windows-first ATLAS desktop shell build",
        },
        intent: {
          preferredQualityBar: "Premium monochrome desktop shell",
          designDirection: "No dashboard-card drift",
        },
        feedback: {
          pendingResearchRefresh: true,
          lastAthenaReview: {
            message: "Carry the existing implementation evidence through the patched plan handoff.",
            corrections: ["Preserve implementationEvidence and leverage_rank from the current plan."],
          },
        },
        handoff: {
          nextAction: "run_target_research_refresh",
          carriedContextSummary: "Resume from Athena research refresh.",
        },
      },
    });

    assert.ok(directive);
    assert.equal(directive?.wait, false);
    assert.match(String(directive?.briefForPrometheus || ""), /without restarting from Jesus/i);
    assert.match(String(directive?.briefForPrometheus || ""), /run_target_research_refresh/i);
  });
});

describe("single target research alignment", () => {
  it("accepts aligned artifacts for the active target session", () => {
    assert.equal(isResearchArtifactAlignedToTargetSession({
      targetSession: {
        projectId: "target_restaurant",
        sessionId: "sess_123",
      },
    }, {
      projectId: "target_restaurant",
      sessionId: "sess_123",
    }), true);
  });

  it("rejects mismatched artifacts for the active target session", () => {
    assert.equal(isResearchArtifactAlignedToTargetSession({
      targetSession: {
        projectId: "target_restaurant",
        sessionId: "sess_old",
      },
    }, {
      projectId: "target_restaurant",
      sessionId: "sess_new",
    }), false);
  });
});