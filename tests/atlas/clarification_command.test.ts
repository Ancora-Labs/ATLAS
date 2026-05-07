import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ATLAS_CLARIFICATION_RATE_LIMIT_FALLBACK_MODEL,
  buildAtlasClarificationCommandEnv,
  resolveSupportedCopilotCliToken,
} from "../../src/atlas/clarification.js";

describe("atlas clarification command", () => {
  it("passes repo env tokens into the Copilot CLI subprocess environment", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-clarification-env-repo-"));
    const originalCwd = process.cwd();
    const previousGithubToken = process.env.GITHUB_TOKEN;
    const previousCopilotToken = process.env.COPILOT_GITHUB_TOKEN;
    const previousGhToken = process.env.GH_TOKEN;
    const previousFinegrainedToken = process.env.GITHUB_FINEGRADED;

    process.env.GITHUB_TOKEN = "gho_staleshelltoken";
    process.env.COPILOT_GITHUB_TOKEN = "gho_staleshellcopilot";
    process.env.GH_TOKEN = "gho_staleshelltoken";
    process.env.GITHUB_FINEGRADED = "gho_staleshellcopilot";
    await fs.writeFile(path.join(repoRoot, ".env"), "GITHUB_TOKEN=gho_repogithubtoken\nGITHUB_FINEGRADED=github_pat_repocopilottoken\n", "utf8");

    try {
      process.chdir(repoRoot);
      const commandEnv = buildAtlasClarificationCommandEnv();
      assert.equal(commandEnv.GITHUB_TOKEN, "gho_repogithubtoken");
      assert.equal(commandEnv.GH_TOKEN, "gho_repogithubtoken");
      assert.equal(commandEnv.COPILOT_GITHUB_TOKEN, "github_pat_repocopilottoken");
      assert.equal(commandEnv.GITHUB_FINEGRADED, "github_pat_repocopilottoken");
    } finally {
      process.chdir(originalCwd);
      if (previousGithubToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previousGithubToken;
      if (previousCopilotToken === undefined) delete process.env.COPILOT_GITHUB_TOKEN;
      else process.env.COPILOT_GITHUB_TOKEN = previousCopilotToken;
      if (previousGhToken === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = previousGhToken;
      if (previousFinegrainedToken === undefined) delete process.env.GITHUB_FINEGRADED;
      else process.env.GITHUB_FINEGRADED = previousFinegrainedToken;
    }
  });

  it("exposes the safe fallback model used when Copilot reports a model rate limit", () => {
    assert.equal(ATLAS_CLARIFICATION_RATE_LIMIT_FALLBACK_MODEL, "gpt-5-mini");
  });

  it("removes classic PATs from the Copilot CLI environment instead of letting them trigger stale stored auth fallback", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-clarification-classic-repo-"));
    const originalCwd = process.cwd();
    const previousGithubToken = process.env.GITHUB_TOKEN;
    const previousCopilotToken = process.env.COPILOT_GITHUB_TOKEN;
    const previousGhToken = process.env.GH_TOKEN;

    process.env.GITHUB_TOKEN = "ghp_staleshelltoken";
    process.env.COPILOT_GITHUB_TOKEN = "ghp_staleshellcopilot";
    process.env.GH_TOKEN = "ghp_staleshelltoken";
    await fs.writeFile(path.join(repoRoot, ".env"), "GITHUB_TOKEN=ghp_repogithubtoken\nGITHUB_FINEGRADED=ghp_repocopilottoken\n", "utf8");

    try {
      process.chdir(repoRoot);
      const commandEnv = buildAtlasClarificationCommandEnv();
      assert.equal(commandEnv.GITHUB_TOKEN, undefined);
      assert.equal(commandEnv.GH_TOKEN, undefined);
      assert.equal(commandEnv.COPILOT_GITHUB_TOKEN, undefined);
    } finally {
      process.chdir(originalCwd);
      if (previousGithubToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previousGithubToken;
      if (previousCopilotToken === undefined) delete process.env.COPILOT_GITHUB_TOKEN;
      else process.env.COPILOT_GITHUB_TOKEN = previousCopilotToken;
      if (previousGhToken === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = previousGhToken;
    }
  });

  it("falls back to the fine-grained Copilot token when classic PAT env values are present first", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-clarification-finegrained-repo-"));
    const originalCwd = process.cwd();
    const previousGithubToken = process.env.GITHUB_TOKEN;
    const previousCopilotToken = process.env.COPILOT_GITHUB_TOKEN;
    const previousGhToken = process.env.GH_TOKEN;
    const previousFinegrainedToken = process.env.GITHUB_FINEGRADED;

    process.env.GITHUB_TOKEN = "ghp_staleshelltoken";
    process.env.COPILOT_GITHUB_TOKEN = "ghp_staleshellcopilot";
    process.env.GH_TOKEN = "ghp_staleshelltoken";
    process.env.GITHUB_FINEGRADED = "github_pat_shellcopilot";
    await fs.writeFile(path.join(repoRoot, ".env"), "GITHUB_TOKEN=ghp_repogithubtoken\nGITHUB_FINEGRADED=github_pat_repocopilottoken\n", "utf8");

    try {
      process.chdir(repoRoot);
      const commandEnv = buildAtlasClarificationCommandEnv();
      assert.equal(commandEnv.GITHUB_TOKEN, "github_pat_repocopilottoken");
      assert.equal(commandEnv.GH_TOKEN, "github_pat_repocopilottoken");
      assert.equal(commandEnv.COPILOT_GITHUB_TOKEN, "github_pat_repocopilottoken");
      assert.equal(commandEnv.GITHUB_FINEGRADED, "github_pat_repocopilottoken");
    } finally {
      process.chdir(originalCwd);
      if (previousGithubToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previousGithubToken;
      if (previousCopilotToken === undefined) delete process.env.COPILOT_GITHUB_TOKEN;
      else process.env.COPILOT_GITHUB_TOKEN = previousCopilotToken;
      if (previousGhToken === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = previousGhToken;
      if (previousFinegrainedToken === undefined) delete process.env.GITHUB_FINEGRADED;
      else process.env.GITHUB_FINEGRADED = previousFinegrainedToken;
    }
  });

  it("accepts only Copilot CLI supported token types", () => {
    assert.equal(resolveSupportedCopilotCliToken("github_pat_example"), "github_pat_example");
    assert.equal(resolveSupportedCopilotCliToken("gho_example"), "gho_example");
    assert.equal(resolveSupportedCopilotCliToken("ghu_example"), "ghu_example");
    assert.equal(resolveSupportedCopilotCliToken("ghp_example"), null);
    assert.equal(resolveSupportedCopilotCliToken(""), null);
  });
});