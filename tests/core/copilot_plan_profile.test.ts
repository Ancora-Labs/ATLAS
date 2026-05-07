import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PRO_SINGLE_MODEL,
  FREE_PLAN_PRIMARY_MODEL,
  PRO_PLUS_ALLOWED_MODELS,
  PRO_PLAN_ALLOWED_MODELS,
  applyCopilotPlanProfile,
  extractCopilotAccountProfile,
  fetchCopilotAccountProfile,
} from "../../src/core/copilot_plan_profile.js";

describe("copilot_plan_profile", () => {
  describe("extractCopilotAccountProfile", () => {
    it("uses an explicit free-plan field when present", () => {
      const profile = extractCopilotAccountProfile({
        plan: "Copilot Free",
        quota_snapshots: {
          premium_interactions: {
            entitlement: 50,
            quota_remaining: 18,
            percent_remaining: 36,
          },
        },
      });

      assert.ok(profile);
      assert.equal(profile?.planTier, "free");
      assert.equal(profile?.planDetectedBy, "field");
      assert.equal(profile?.modelAccess, "free");
      assert.equal(profile?.usedRequests, 32);
      assert.equal(profile?.remainingRequests, 18);
    });

    it("infers a pro+ profile from entitlement when no plan field exists", () => {
      const profile = extractCopilotAccountProfile({
        quota_snapshots: {
          premium_interactions: {
            entitlement: 1500,
            quota_remaining: 1200,
          },
        },
      });

      assert.ok(profile);
      assert.equal(profile?.planTier, "pro_plus");
      assert.equal(profile?.planDetectedBy, "entitlement");
      assert.equal(profile?.planLabel, "Copilot Pro+");
      assert.equal(profile?.modelAccess, "current");
    });

    it("[NEGATIVE] returns null when no usable plan or quota data exists", () => {
      assert.equal(extractCopilotAccountProfile({ hello: "world" }), null);
      assert.equal(extractCopilotAccountProfile(null), null);
    });
  });

  describe("applyCopilotPlanProfile", () => {
    const baseCopilot = {
      defaultModel: "gpt-5.4",
      strongModel: "Claude Sonnet 4.6",
      efficientModel: "GPT-4.1",
      opusModel: "gpt-5.4",
      allowedModels: ["Claude Sonnet 4.6", "gpt-5.4"],
      preferredModelsByTaskKind: {
        planning: ["gpt-5.4", "Claude Sonnet 4.6"],
      },
      preferredModelsByRole: {
        Prometheus: ["gpt-5.4"],
      },
    };

    it("pins free plans to the free-safe model pool", () => {
      const resolved = applyCopilotPlanProfile(baseCopilot, {
        planTier: "free",
        planLabel: "Copilot Free",
        modelAccess: "free",
        planDetectedBy: "field",
        source: "copilot_internal/user",
        rawPlan: "Copilot Free",
        entitlement: 50,
        usedRequests: 3,
        remainingRequests: 47,
        percentRemaining: 94,
      });

      assert.equal(resolved.defaultModel, FREE_PLAN_PRIMARY_MODEL);
      assert.equal(resolved.strongModel, FREE_PLAN_PRIMARY_MODEL);
      assert.equal(resolved.efficientModel, FREE_PLAN_PRIMARY_MODEL);
      assert.equal(resolved.opusModel, FREE_PLAN_PRIMARY_MODEL);
      assert.deepEqual(resolved.preferredModelsByTaskKind, {
        planning: [FREE_PLAN_PRIMARY_MODEL],
      });
      assert.deepEqual(resolved.preferredModelsByRole, {
        Prometheus: [FREE_PLAN_PRIMARY_MODEL],
      });
    });

    it("preserves explicit custom schemas by default on pro plans", () => {
      const resolved = applyCopilotPlanProfile(baseCopilot, {
        planTier: "pro",
        planLabel: "Copilot Pro",
        modelAccess: "current",
        planDetectedBy: "entitlement",
        source: "copilot_internal/user",
        rawPlan: null,
        entitlement: 300,
        usedRequests: 40,
        remainingRequests: 260,
        percentRemaining: 86.67,
      });

      assert.equal(resolved.defaultModel, "gpt-5.4");
      assert.equal(resolved.strongModel, "Claude Sonnet 4.6");
      assert.equal(resolved.efficientModel, "GPT-4.1");
      assert.equal(resolved.opusModel, "gpt-5.4");
      assert.deepEqual(resolved.allowedModels, PRO_PLAN_ALLOWED_MODELS);
      assert.deepEqual(resolved.preferredModelsByTaskKind, {
        planning: ["gpt-5.4", "Claude Sonnet 4.6"],
      });
      assert.deepEqual(resolved.preferredModelsByRole, {
        Prometheus: ["gpt-5.4"],
      });
      assert.equal((resolved.activeModelSelection as any)?.mode, "schema");
      assert.equal((resolved.activeModelSelection as any)?.source, "custom_schema");
      assert.equal((resolved.accountProfile as any)?.planTier, "pro");
    });

    it("still falls back to the plan default when no custom schema is configured", () => {
      const resolved = applyCopilotPlanProfile({
        defaultModel: "GPT-5.3-codex",
        strongModel: "GPT-5.3-codex",
        efficientModel: "GPT-5.3-codex",
        opusModel: "GPT-5.3-codex",
        allowedModels: ["GPT-5.3-codex"],
      }, {
        planTier: "pro",
        planLabel: "Copilot Pro",
        modelAccess: "current",
        planDetectedBy: "entitlement",
        source: "copilot_internal/user",
        rawPlan: null,
        entitlement: 300,
        usedRequests: 40,
        remainingRequests: 260,
        percentRemaining: 86.67,
      });

      assert.equal(resolved.defaultModel, DEFAULT_PRO_SINGLE_MODEL);
      assert.equal((resolved.activeModelSelection as any)?.mode, "single");
      assert.equal((resolved.activeModelSelection as any)?.source, "plan_default");
    });

    it("preserves the existing schema by default for pro+ plans", () => {
      const resolved = applyCopilotPlanProfile(baseCopilot, {
        planTier: "pro_plus",
        planLabel: "Copilot Pro+",
        modelAccess: "current",
        planDetectedBy: "entitlement",
        source: "copilot_internal/user",
        rawPlan: null,
        entitlement: 1500,
        usedRequests: 40,
        remainingRequests: 1460,
        percentRemaining: 97.33,
      });

      assert.equal(resolved.defaultModel, "gpt-5.4");
      assert.equal(resolved.strongModel, "Claude Sonnet 4.6");
      assert.equal(resolved.efficientModel, "GPT-4.1");
      assert.equal(resolved.opusModel, "gpt-5.4");
      assert.deepEqual(resolved.allowedModels, PRO_PLUS_ALLOWED_MODELS);
      assert.deepEqual(resolved.preferredModelsByTaskKind, {
        planning: ["gpt-5.4", "Claude Sonnet 4.6"],
      });
      assert.deepEqual(resolved.preferredModelsByRole, {
        Prometheus: ["gpt-5.4"],
      });
      assert.equal((resolved.accountProfile as any)?.planTier, "pro_plus");
    });
  });

  describe("fetchCopilotAccountProfile", () => {
    it("requests the copilot account endpoint and normalizes the response", async () => {
      const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
      const fakeFetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return {
          ok: true,
          async json() {
            return {
              quota_snapshots: {
                premium_interactions: {
                  entitlement: 300,
                  quota_remaining: 250,
                },
              },
            };
          },
        } as Response;
      };

      const profile = await fetchCopilotAccountProfile("test-token", fakeFetch as typeof fetch);

      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, "https://api.github.com/copilot_internal/user");
      assert.match(String((calls[0]?.init?.headers as Record<string, string>)?.Authorization || ""), /Bearer test-token/);
      assert.equal(profile?.planTier, "pro");
      assert.equal(profile?.remainingRequests, 250);
    });
  });
});