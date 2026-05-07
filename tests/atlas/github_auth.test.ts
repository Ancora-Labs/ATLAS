import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { resolveAtlasGitHubBootstrap, saveAtlasGitHubAuth } from "../../src/atlas/github_auth.js";

const ENV_KEYS = [
  "BOX_COPILOT_SOURCE_ACCOUNT",
  "BOX_GITHUB_BILLING_SUMMARY_URL",
  "BOX_ROOT_DIR",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "COPILOT_GITHUB_TOKEN",
  "GITHUB_FINEGRADED",
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

describe("atlas github auth bootstrap", () => {
  it("displays the Copilot token account when GitHub and Copilot tokens point at different accounts", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-github-auth-"));
      const stateDir = path.join(repoRoot, "state");
      const originalCwd = process.cwd();
      const originalFetch = globalThis.fetch;

      await fs.writeFile(
        path.join(repoRoot, ".env"),
        "GITHUB_TOKEN=gho_oldaccount\nGITHUB_FINEGRADED=github_pat_dogaccount\n",
        "utf8",
      );
      globalThis.fetch = async (url, init) => {
        const token = String(new Headers(init?.headers).get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (String(url).includes("/copilot_internal/user")) {
          return new Response(JSON.stringify({ quota_snapshots: { premium_interactions: { entitlement: 300, quota_remaining: 299 } } }), { status: 200 });
        }
        if (token === "github_pat_dogaccount") {
          return new Response(JSON.stringify({ login: "dogducaner66-byte" }), { status: 200 });
        }
        if (token === "gho_oldaccount") {
          return new Response(JSON.stringify({ login: "CanerDoqdu" }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: "bad credentials" }), { status: 401 });
      };

      try {
        process.chdir(repoRoot);
        const bootstrap = await resolveAtlasGitHubBootstrap(stateDir);
        assert.equal(bootstrap.auth.accountLogin, "dogducaner66-byte");
        assert.equal(bootstrap.auth.source, "env");
        assert.equal(bootstrap.auth.githubTokenConfigured, true);
        assert.equal(bootstrap.auth.copilotTokenConfigured, true);
      } finally {
        process.chdir(originalCwd);
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("does not treat a classic GitHub repo token as Copilot access when no Copilot token is configured", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-github-auth-classic-only-"));
      const stateDir = path.join(repoRoot, "state");
      const originalCwd = process.cwd();
      const originalFetch = globalThis.fetch;

      await fs.writeFile(
        path.join(repoRoot, ".env"),
        "GITHUB_TOKEN=ghp_classic_only\n",
        "utf8",
      );
      globalThis.fetch = async (_url, init) => {
        const token = String(new Headers(init?.headers).get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (token === "ghp_classic_only") {
          return new Response(JSON.stringify({ login: "CanerDoqdu" }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: "bad credentials" }), { status: 401 });
      };

      try {
        process.chdir(repoRoot);
        const bootstrap = await resolveAtlasGitHubBootstrap(stateDir);
        assert.equal(bootstrap.auth.githubTokenConfigured, true);
        assert.equal(bootstrap.auth.copilotTokenConfigured, false);
      } finally {
        process.chdir(originalCwd);
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("stores a separate Copilot token only when the operator actually provided one", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-github-auth-save-"));
      const stateDir = path.join(repoRoot, "state");
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async (url, init) => {
        const token = String(new Headers(init?.headers).get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (String(url).includes("/copilot_internal/user")) {
          return new Response(JSON.stringify({ quota_snapshots: { premium_interactions: { entitlement: 300, quota_remaining: 300 } } }), { status: 200 });
        }
        if (token === "github_pat_repo_full_access") {
          return new Response(JSON.stringify({ login: "dogducaner66-byte" }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: "bad credentials" }), { status: 401 });
      };

      try {
        const bootstrap = await saveAtlasGitHubAuth(stateDir, {
          accountLogin: "dogducaner66-byte",
          githubToken: "github_pat_repo_full_access",
        });
        const persistedRaw = await fs.readFile(path.join(stateDir, "atlas", "github_auth.json"), "utf8");
        const persisted = JSON.parse(persistedRaw) as { githubToken?: string | null; copilotGithubToken?: string | null; };

        assert.equal(bootstrap.auth.githubTokenConfigured, true);
        assert.equal(bootstrap.auth.copilotTokenConfigured, true);
        assert.equal(persisted.githubToken, "github_pat_repo_full_access");
        assert.equal(persisted.copilotGithubToken ?? null, null);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("rewrites stale repo account metadata when the resolved GitHub login changes", async () => {
    await withIsolatedEnv(async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-github-auth-metadata-"));
      const stateDir = path.join(repoRoot, "state");
      const originalCwd = process.cwd();
      const originalFetch = globalThis.fetch;

      await fs.writeFile(
        path.join(repoRoot, ".env"),
        [
          "GITHUB_TOKEN=github_pat_repo_full_access",
          "BOX_COPILOT_SOURCE_ACCOUNT=CanerDoqdu",
          "BOX_GITHUB_BILLING_SUMMARY_URL=https://api.github.com/users/CanerDoqdu/settings/billing/premium_request/usage",
          "",
        ].join("\n"),
        "utf8",
      );
      globalThis.fetch = async (url, init) => {
        const token = String(new Headers(init?.headers).get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (String(url).includes("/copilot_internal/user")) {
          return new Response(JSON.stringify({ quota_snapshots: { premium_interactions: { entitlement: 300, quota_remaining: 300 } } }), { status: 200 });
        }
        if (token === "github_pat_repo_full_access") {
          return new Response(JSON.stringify({ login: "dogducaner66-byte" }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: "bad credentials" }), { status: 401 });
      };

      try {
        process.chdir(repoRoot);
        const bootstrap = await resolveAtlasGitHubBootstrap(stateDir);
        const envRaw = await fs.readFile(path.join(repoRoot, ".env"), "utf8");

        assert.equal(bootstrap.auth.accountLogin, "dogducaner66-byte");
        assert.match(envRaw, /^BOX_COPILOT_SOURCE_ACCOUNT=dogducaner66-byte$/m);
        assert.match(envRaw, /^BOX_GITHUB_BILLING_SUMMARY_URL=https:\/\/api\.github\.com\/users\/dogducaner66-byte\/settings\/billing\/premium_request\/usage$/m);
      } finally {
        process.chdir(originalCwd);
        globalThis.fetch = originalFetch;
      }
    });
  });
});