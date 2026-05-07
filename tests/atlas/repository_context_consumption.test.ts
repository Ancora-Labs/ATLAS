import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  consumeAtlasDesktopRepoContext,
  readAtlasDesktopRepoContext,
  resolveAtlasRepoContextForNewSession,
} from "../../src/atlas/repository_context.js";
import { writeAtlasDesktopState } from "../../src/atlas/desktop_state.js";

async function writeDesktopState(stateDir: string, repoContext: Record<string, unknown> | null): Promise<void> {
  await writeAtlasDesktopState(path.join(stateDir, "atlas", "desktop_state.json"), {
    sessionId: null,
    onboardingDraft: "",
    windowBounds: null,
    repoContext,
    updatedAt: "2026-04-29T00:00:00.000Z",
  });
}

describe("atlas repository context consumption", () => {
  it("prefers explicit new-project details over a stale desktop repo selection", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-repo-context-"));
    await writeDesktopState(stateDir, {
      provider: "github",
      targetRepo: "acme/stale-existing-repo",
      targetBaseBranch: "main",
      repoMode: "existing",
      repoCreatedByAtlas: false,
    });

    const originalFetch = globalThis.fetch;
    const originalGitHubToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";
    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          full_name: "acme/fresh-restaurant-launch",
          name: "fresh-restaurant-launch",
          default_branch: "main",
          private: true,
          size: 1,
        };
      },
    }) as Response;

    try {
      const repoContext = await resolveAtlasRepoContextForNewSession(
        stateDir,
        "Build a premium restaurant landing page.",
        {
          projectName: "Fresh Restaurant Launch",
          projectDescription: "Premium launch site for a new restaurant.",
        },
      );

      assert.equal(repoContext.targetRepo, "acme/fresh-restaurant-launch");
      assert.equal(repoContext.repoMode, "new");
      assert.equal(repoContext.repoCreatedByAtlas, true);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalGitHubToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = originalGitHubToken;
      }
    }
  });

  it("consumes the desktop repo selection after a session starts so it cannot leak into the next one", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-repo-consume-"));
    await writeDesktopState(stateDir, {
      provider: "github",
      targetRepo: "acme/selected-once",
      targetBaseBranch: "main",
      repoMode: "existing",
      repoCreatedByAtlas: false,
    });

    assert.equal((await readAtlasDesktopRepoContext(stateDir))?.targetRepo, "acme/selected-once");

    await consumeAtlasDesktopRepoContext(stateDir);

    assert.equal(await readAtlasDesktopRepoContext(stateDir), null);
  });
});