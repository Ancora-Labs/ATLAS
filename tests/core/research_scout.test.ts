import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTargetIntentResearchSection, buildTargetResearchSessionStamp } from "../../src/core/research_scout.js";

describe("research_scout target intent context", () => {
  it("formats the clarified target intent for scout prompt injection", () => {
    const sectionText = buildTargetIntentResearchSection({
      intent: {
        status: "ready_for_planning",
        summary: "repoState=existing | goal=restaurant admin panel | users=staff | scope=booking dashboard | protect=payments | success=booking flow works end-to-end",
        planningMode: "shadow",
        productType: "restaurant admin panel",
        targetUsers: ["staff"],
        mustHaveFlows: ["booking dashboard"],
        scopeIn: ["booking dashboard"],
        scopeOut: ["payment redesign"],
        protectedAreas: ["payments"],
        successCriteria: ["booking flow works end-to-end"],
        openQuestions: [],
      },
    });

    assert.ok(sectionText.includes("## TARGET INTENT CONTRACT"));
    assert.ok(sectionText.includes("Intent status: ready_for_planning"));
    assert.ok(sectionText.includes("Planning mode: shadow"));
    assert.ok(sectionText.includes("Protected areas: payments"));
    assert.ok(sectionText.includes("Success criteria: booking flow works end-to-end"));
  });

  it("stamps empty-repo sessions as discovery research", () => {
    const stamp = buildTargetResearchSessionStamp({
      projectId: "target_restaurant",
      sessionId: "sess_123",
      currentStage: "shadow",
      intent: {
        status: "ready_for_planning",
        repoState: "empty",
        planningMode: "shadow",
      },
    });

    assert.deepEqual(stamp, {
      projectId: "target_restaurant",
      sessionId: "sess_123",
      currentStage: "shadow",
      repoState: "empty",
      intentStatus: "ready_for_planning",
      planningMode: "shadow",
      researchMode: "empty_repo_discovery",
    });
  });
});