import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPromptAssemblyPrompt, resolvePromptTargetRepo } from "../../src/core/prompt_overlay.js";
import { PLATFORM_MODE } from "../../src/core/mode_state.js";

describe("prompt_overlay", () => {
  it("builds a self_dev overlay by default with a clear runtime assembly path", () => {
    const prompt = buildPromptAssemblyPrompt({
      agentName: "prometheus",
      config: {
        selfDev: {
          enabled: true,
          futureModeFlags: {
            singleTargetDelivery: false,
            targetSessionState: false,
          },
        },
        env: {
          targetRepo: "Ancora-Labs/ATLAS",
        },
      },
    });

    assert.ok(prompt.includes("PART 4 PROMPT ASSEMBLY SYSTEM"));
    assert.ok(prompt.includes("BASE CORE BEHAVIOR"));
    assert.ok(prompt.includes("MODE OVERLAY — SELF_DEV"));
    assert.ok(prompt.includes("STAGE OVERLAY — none"));
  });

  it("negative path: falls back to self_dev overlay when single target mode is requested but disabled", () => {
    const prompt = buildPromptAssemblyPrompt({
      agentName: "athena",
      config: {
        selfDev: {
          enabled: true,
          futureModeFlags: {
            singleTargetDelivery: false,
            targetSessionState: false,
          },
        },
        platformModeState: {
          currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
        },
        env: {
          targetRepo: "Ancora-Labs/ATLAS",
        },
      },
      stage: "active",
    });

    assert.ok(prompt.includes("MODE OVERLAY — SELF_DEV"));
    assert.ok(prompt.includes("feature flag is disabled"));
    assert.ok(prompt.includes("STAGE OVERLAY — active"));
  });

  it("activates single-target and stage overlays when mode truth and flags allow it", () => {
    const prompt = buildPromptAssemblyPrompt({
      agentName: "worker",
      config: {
        selfDev: {
          enabled: false,
          futureModeFlags: {
            singleTargetDelivery: true,
            targetSessionState: true,
          },
        },
        platformModeState: {
          currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
        },
        activeTargetSession: {
          projectId: "target_brand_site",
          sessionId: "sess_ui_001",
          currentStage: "onboarding",
          objective: {
            summary: "Build a more premium landing page",
          },
          onboarding: {
            readiness: "partial",
            recommendedNextStage: "shadow",
            readinessScore: 55,
          },
          prerequisites: {
            requiredNow: [],
            requiredLater: [],
            optional: [],
          },
          gates: {
            allowPlanning: true,
            allowShadowExecution: true,
            allowActiveExecution: false,
            quarantine: false,
            quarantineReason: null,
          },
          handoff: {
            requiredHumanInputs: [],
            carriedContextSummary: "UI polish requested.",
          },
          constraints: {
            protectedPaths: ["infra/prod"],
            forbiddenActions: ["force push"],
          },
        },
      },
      stage: "onboarding",
    });

    assert.ok(prompt.includes("MODE OVERLAY — SINGLE_TARGET_DELIVERY"));
    assert.ok(prompt.includes("Operate inside the active target workspace"));
    assert.ok(prompt.includes("If the assigned packet touches UI, UX, landing pages, heroes, visual polish, design systems, or other design-led surfaces"));
    assert.ok(prompt.includes("always inspect carried scout/synthesis evidence and then inspect a narrow set of high-quality current internet design references before implementation"));
    assert.ok(prompt.includes("When the packet already includes design references, treat them as the baseline and still inspect additional current references yourself"));
    assert.ok(prompt.includes("target objective, protected paths, forbidden actions, and completion criteria"));
    assert.ok(prompt.includes("always inspect any provided design references plus carried repo/scout evidence, then inspect current high-quality internet design references before implementation"));
    assert.ok(prompt.includes("Do not skip that design-reference pass because the packet already has a direction"));
    assert.ok(prompt.includes("STAGE OVERLAY — onboarding"));
    assert.ok(prompt.includes("understand and classify the repo before execution begins"));
  });

  it("derives stage and target-session handoff context from the active target session", () => {
    const prompt = buildPromptAssemblyPrompt({
      agentName: "prometheus",
      config: {
        selfDev: {
          enabled: false,
          futureModeFlags: {
            singleTargetDelivery: true,
            targetSessionState: true,
          },
        },
        platformModeState: {
          currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
        },
        activeTargetSession: {
          projectId: "target_portal",
          sessionId: "sess_001",
          currentStage: "shadow",
          repo: {
            repoUrl: "https://github.com/acme/portal",
          },
          objective: {
            summary: "Fix authentication regressions safely",
          },
          onboarding: {
            readiness: "partial",
            recommendedNextStage: "shadow",
            readinessScore: 68,
          },
          prerequisites: {
            requiredNow: [],
            requiredLater: ["vercel_access_token"],
            optional: ["sentry_access_token"],
          },
          gates: {
            allowPlanning: true,
            allowShadowExecution: true,
            allowActiveExecution: false,
            quarantine: false,
            quarantineReason: null,
          },
          handoff: {
            requiredHumanInputs: ["confirm staging URL"],
            carriedContextSummary: "Node auth service with medium confidence baseline.",
          },
          constraints: {
            protectedPaths: ["infra/prod"],
            forbiddenActions: ["force push"],
          },
        },
      },
    });

    assert.ok(prompt.includes("MODE OVERLAY — SINGLE_TARGET_DELIVERY"));
    assert.ok(prompt.includes("STAGE OVERLAY — shadow"));
    assert.ok(prompt.includes("TARGET SESSION CONTRACT"));
    assert.ok(prompt.includes("objective: Fix authentication regressions safely"));
    assert.ok(prompt.includes("allowActiveExecution: false"));
    assert.ok(prompt.includes("requiredLater: vercel_access_token"));
    assert.ok(prompt.includes("optionalPrerequisites: sentry_access_token"));
    assert.ok(prompt.includes("requiredHumanInputs: confirm staging URL"));
    assert.ok(prompt.includes("If allowPlanning=true but allowActiveExecution=false, keep plans shadow-safe"));
  });

  it("adds sequential visual inspection guidance for prometheus on design-heavy target sessions", () => {
    const prompt = buildPromptAssemblyPrompt({
      agentName: "prometheus",
      config: {
        selfDev: {
          enabled: false,
          futureModeFlags: {
            singleTargetDelivery: true,
            targetSessionState: true,
          },
        },
        platformModeState: {
          currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
        },
        activeTargetSession: {
          projectId: "target_pizza",
          sessionId: "sess_visual_001",
          currentStage: "shadow",
          repo: {
            repoUrl: "https://github.com/acme/pizza",
          },
          objective: {
            summary: "Plan a premium pizza hero with high-quality imagery",
          },
          onboarding: {
            readiness: "partial",
            recommendedNextStage: "shadow",
            readinessScore: 64,
          },
          prerequisites: {
            requiredNow: [],
            requiredLater: [],
            optional: [],
          },
          gates: {
            allowPlanning: true,
            allowShadowExecution: true,
            allowActiveExecution: false,
            quarantine: false,
            quarantineReason: null,
          },
          handoff: {
            requiredHumanInputs: [],
            carriedContextSummary: "Need premium pizza imagery planning.",
          },
          intent: {
            scopeIn: ["hero image", "brand storytelling"],
            successCriteria: ["use premium pizza photography"],
          },
          constraints: {
            protectedPaths: [],
            forbiddenActions: [],
          },
        },
      },
    });

    assert.ok(prompt.includes("inspect them strictly one at a time"));
    assert.ok(prompt.includes("never batch multiple visual reads into one pass"));
    assert.ok(prompt.includes("read one artifact, analyze it, write the planning finding, then move to the next artifact"));
  });

  it("resolves the active target repo instead of the BOX repo in single target mode", () => {
    const targetRepo = resolvePromptTargetRepo({
      selfDev: {
        futureModeFlags: {
          singleTargetDelivery: true,
        },
      },
      platformModeState: {
        currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
      },
      env: {
        targetRepo: "Ancora-Labs/ATLAS",
      },
      activeTargetSession: {
        repo: {
          repoUrl: "https://github.com/acme/portal",
        },
      },
    });

    assert.equal(targetRepo, "https://github.com/acme/portal");
  });

  it("injects repo-state and clarification context into target-mode prompts", () => {
    const prompt = buildPromptAssemblyPrompt({
      agentName: "research-scout",
      config: {
        selfDev: {
          enabled: false,
          futureModeFlags: {
            singleTargetDelivery: true,
            targetSessionState: true,
          },
        },
        platformModeState: {
          currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
        },
        activeTargetSession: {
          projectId: "target_restaurant",
          sessionId: "sess_clarify_1",
          currentStage: "awaiting_intent_clarification",
          repo: {
            repoUrl: "https://github.com/acme/restaurant-site",
          },
          objective: {
            summary: "Build a new restaurant website from an empty target repo",
          },
          onboarding: {
            readiness: "clarification_required",
            recommendedNextStage: "awaiting_intent_clarification",
            readinessScore: 58,
          },
          repoProfile: {
            repoState: "empty",
            repoStateReason: "Repository contains only scaffolding.",
            meaningfulEntryPoints: ["README.md"],
            dominantSignals: ["npm"],
            selectedOnboardingAgent: "onboarding-empty-repo",
          },
          clarification: {
            status: "pending",
            mode: "empty_repo",
            selectedAgentSlug: "onboarding-empty-repo",
            pendingQuestions: ["What should BOX build?", "Who is it for?"],
            readyForPlanning: false,
          },
          intent: {
            status: "clarifying",
            summary: "repoState=empty | goal=restaurant website | users=restaurant guests | scope=Homepage, Booking flow | protect=none_specified | success=Optimize for Business conversion",
            planningMode: null,
            productType: "restaurant website",
            targetUsers: ["restaurant guests"],
            mustHaveFlows: ["Homepage", "Booking flow"],
            scopeIn: ["Homepage", "Booking flow"],
            scopeOut: [],
            protectedAreas: [],
            successCriteria: ["Optimize for Business conversion"],
            assumptions: [],
            openQuestions: ["What matters most?"],
          },
          prerequisites: {
            requiredNow: [],
            requiredLater: [],
            optional: [],
          },
          gates: {
            allowPlanning: false,
            allowShadowExecution: false,
            allowActiveExecution: false,
            quarantine: false,
            quarantineReason: null,
          },
          handoff: {
            requiredHumanInputs: ["Respond to onboarding-empty-repo"],
            carriedContextSummary: "Empty repo routed into clarification.",
          },
          constraints: {
            protectedPaths: [],
            forbiddenActions: [],
          },
        },
      },
    });

    assert.ok(prompt.includes("STAGE OVERLAY — awaiting"));
    assert.ok(prompt.includes("repoState: empty"));
    assert.ok(prompt.includes("clarificationAgent: onboarding-empty-repo"));
    assert.ok(prompt.includes("clarificationPendingQuestions: What should BOX build?, Who is it for?"));
    assert.ok(prompt.includes("intentSummary: repoState=empty | goal=restaurant website"));
    assert.ok(prompt.includes("intentOpenQuestions: What matters most?"));
  });

  it("includes the detailed operator intent brief and evidence in the target overlay", () => {
    const prompt = buildPromptAssemblyPrompt({
      agentName: "prometheus",
      config: {
        selfDev: {
          enabled: false,
          futureModeFlags: {
            singleTargetDelivery: true,
            targetSessionState: true,
          },
        },
        platformModeState: {
          currentMode: PLATFORM_MODE.SINGLE_TARGET_DELIVERY,
        },
        activeTargetSession: {
          projectId: "target_brief",
          sessionId: "sess_brief",
          currentStage: "active",
          clarification: {
            readyForPlanning: true,
          },
          intent: {
            status: "ready_for_planning",
            summary: "premium storefront",
            operatorIntentBrief: "Build a premium storefront and keep authentic product imagery rather than generic placeholders.",
            operatorIntentEvidence: ["Do not use fabricated stand-ins."],
          },
          gates: {
            allowPlanning: true,
            allowShadowExecution: false,
            allowActiveExecution: true,
            quarantine: false,
          },
          prerequisites: {
            requiredNow: [],
            requiredLater: [],
            optional: [],
          },
        },
      },
    });

    assert.ok(prompt.includes("intentOperatorIntentBrief: Build a premium storefront and keep authentic product imagery rather than generic placeholders."));
    assert.ok(prompt.includes("intentOperatorIntentEvidence: Do not use fabricated stand-ins."));
  });
});