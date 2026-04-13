import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAgentArgs, resolveAgentExecutionProfile, validateAgentContract } from "../../src/core/agent_loader.js";

describe("buildAgentArgs", () => {
  it("keeps existing leadership behavior by default", () => {
    // Leadership calls: no autopilot, no allow-all by default ÔÇö single-prompt mode
    const args = buildAgentArgs({
      agentSlug: "prometheus",
      prompt: "scan the repo",
      model: "GPT-5.3-Codex"
    });

    assert.ok(!args.includes("--autopilot"), "autopilot must be off by default");
    assert.ok(!args.includes("--max-autopilot-continues"), "max-autopilot-continues must be absent by default");
    assert.ok(args.includes("--agent"));
    assert.ok(args.includes("prometheus"));
    assert.ok(args.includes("--model"));
    assert.ok(args.includes("gpt-5.3-codex"));
  });

  it("supports a single-request agent call without autopilot", () => {
    const args = buildAgentArgs({
      agentSlug: "evolution-worker",
      prompt: "read the repo and produce one plan",
      model: "GPT-5.3-Codex",
      allowAll: true,
      autopilot: false,
      noAskUser: true,
      silent: true,
      maxContinues: 40
    });

    assert.ok(args.includes("--allow-all"));
    assert.ok(args.includes("--no-ask-user"));
    assert.ok(args.includes("--silent"));
    assert.ok(!args.includes("--autopilot"));
    assert.ok(!args.includes("--max-autopilot-continues"));
    assert.ok(args.includes("--model"));
    assert.ok(args.includes("gpt-5.3-codex"));
  });

  it("blocks broad allow-all when the agent profile is no_tools", () => {
    const args = buildAgentArgs({
      agentSlug: "prometheus",
      prompt: "read the repo and produce one plan",
      allowAll: true,
      noAskUser: true,
    });

    assert.ok(!args.includes("--allow-all"));
    assert.ok(args.includes("--no-ask-user"));
  });
});

describe("agent execution profiles", () => {
  it("validates explicit critical-agent session controls", () => {
    const result = validateAgentContract("prometheus");
    assert.equal(result.valid, true, `prometheus violations: ${result.violations.join(", ")}`);
    assert.equal(result.fields.boxSessionInputPolicy, "no_tools");
    assert.equal(result.fields.boxHookCoverage, "not_required");
  });

  it("resolves a read-only profile for Athena", () => {
    const profile = resolveAgentExecutionProfile("athena");
    assert.equal(profile.valid, true, `athena violations: ${profile.violations.join(", ")}`);
    assert.equal(profile.sessionInputPolicy, "no_tools");
    assert.equal(profile.hookCoverage, "not_required");
    assert.equal(profile.allowsExecute, false);
  });
});
