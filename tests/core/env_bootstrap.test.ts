import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { bootstrapEnvironment } from "../../src/env_bootstrap.js";

const ENV_KEYS = [
  "BOX_SECRETS_FILE",
  "BOX_GITHUB_BILLING_TOKEN",
  "COPILOT_GITHUB_TOKEN",
  "GH_TOKEN",
  "GITHUB_FINEGRADED",
  "GITHUB_TOKEN",
] as const;

async function withIsolatedEnv(testFn: () => Promise<void>): Promise<void> {
  const previousValues = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    previousValues.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    await testFn();
  } finally {
    for (const key of ENV_KEYS) {
      const previousValue = previousValues.get(key);
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  }
}

describe("env_bootstrap", () => {
  it("reloads managed repo env values when forceReload is requested", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-env-bootstrap-"));
      const envPath = path.join(repoRoot, ".env");

      await fs.writeFile(envPath, "GITHUB_TOKEN=first-token\nGITHUB_FINEGRADED=first-copilot\n", "utf8");
      bootstrapEnvironment({ repoRoot, forceReload: true });

      assert.equal(process.env.GITHUB_TOKEN, "first-token");
      assert.equal(process.env.COPILOT_GITHUB_TOKEN, "first-copilot");

      await fs.writeFile(envPath, "GITHUB_TOKEN=second-token\nGITHUB_FINEGRADED=second-copilot\n", "utf8");
      bootstrapEnvironment({ repoRoot });

      assert.equal(process.env.GITHUB_TOKEN, "first-token");
      assert.equal(process.env.COPILOT_GITHUB_TOKEN, "first-copilot");

      bootstrapEnvironment({ repoRoot, forceReload: true });

      assert.equal(process.env.GITHUB_TOKEN, "second-token");
      assert.equal(process.env.COPILOT_GITHUB_TOKEN, "second-copilot");
    });
  });

  it("does not overwrite explicit shell env values during forceReload", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-env-bootstrap-shell-"));
      const envPath = path.join(repoRoot, ".env");

      process.env.GITHUB_TOKEN = "shell-token";
      process.env.COPILOT_GITHUB_TOKEN = "shell-copilot";
      await fs.writeFile(envPath, "GITHUB_TOKEN=file-token\nGITHUB_FINEGRADED=file-copilot\n", "utf8");

      bootstrapEnvironment({ repoRoot, forceReload: true });

      assert.equal(process.env.GITHUB_TOKEN, "shell-token");
      assert.equal(process.env.COPILOT_GITHUB_TOKEN, "shell-copilot");
    });
  });

  it("lets repo env auth tokens override stale shell tokens when explicitly preferred", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-env-bootstrap-prefer-repo-"));
      const envPath = path.join(repoRoot, ".env");

      process.env.GITHUB_TOKEN = "stale-shell-token";
      process.env.GH_TOKEN = "stale-shell-token";
      process.env.COPILOT_GITHUB_TOKEN = "stale-shell-copilot";
      process.env.GITHUB_FINEGRADED = "stale-shell-copilot";
      await fs.writeFile(envPath, "GITHUB_TOKEN=file-token\nGITHUB_FINEGRADED=file-copilot\n", "utf8");

      bootstrapEnvironment({ repoRoot, forceReload: true, preferRepoEnv: true });

      assert.equal(process.env.GITHUB_TOKEN, "file-token");
      assert.equal(process.env.GH_TOKEN, "file-token");
      assert.equal(process.env.COPILOT_GITHUB_TOKEN, "file-copilot");
      assert.equal(process.env.GITHUB_FINEGRADED, "file-copilot");
    });
  });

  it("promotes an explicit repo fine-grained token over a classic Copilot alias", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-env-bootstrap-explicit-finegrained-"));
      const envPath = path.join(repoRoot, ".env");

      await fs.writeFile(
        envPath,
        "GITHUB_TOKEN=ghp_repo\nCOPILOT_GITHUB_TOKEN=ghp_repo\nGITHUB_FINEGRADED=github_pat_repo_finegrained\n",
        "utf8",
      );

      bootstrapEnvironment({ repoRoot, forceReload: true, preferRepoEnv: true });

      assert.equal(process.env.COPILOT_GITHUB_TOKEN, "github_pat_repo_finegrained");
      assert.equal(process.env.GITHUB_FINEGRADED, "github_pat_repo_finegrained");
    });
  });

  it("keeps the classic PAT on GITHUB_TOKEN while routing the fine-grained PAT only to Copilot env vars", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-env-bootstrap-split-token-contract-"));
      const envPath = path.join(repoRoot, ".env");

      await fs.writeFile(
        envPath,
        "GITHUB_TOKEN=ghp_classic_repo_token\nGITHUB_FINEGRADED=github_pat_finegrained_copilot_token\n",
        "utf8",
      );

      bootstrapEnvironment({ repoRoot, forceReload: true, preferRepoEnv: true });

      assert.equal(process.env.GITHUB_TOKEN, "ghp_classic_repo_token");
      assert.equal(process.env.GH_TOKEN, "ghp_classic_repo_token");
      assert.equal(process.env.GITHUB_FINEGRADED, "github_pat_finegrained_copilot_token");
      assert.equal(process.env.COPILOT_GITHUB_TOKEN, "github_pat_finegrained_copilot_token");
      assert.notEqual(process.env.GITHUB_TOKEN, process.env.GITHUB_FINEGRADED);
    });
  });

  it("derives the Copilot token from GITHUB_TOKEN when the repo token is already Copilot-compatible", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-env-bootstrap-single-token-"));
      const envPath = path.join(repoRoot, ".env");

      await fs.writeFile(envPath, "GITHUB_TOKEN=github_pat_repo_full_access\n", "utf8");

      bootstrapEnvironment({ repoRoot, forceReload: true, preferRepoEnv: true });

      assert.equal(process.env.GITHUB_TOKEN, "github_pat_repo_full_access");
      assert.equal(process.env.COPILOT_GITHUB_TOKEN, "github_pat_repo_full_access");
      assert.equal(process.env.GITHUB_FINEGRADED, "github_pat_repo_full_access");
    });
  });
});