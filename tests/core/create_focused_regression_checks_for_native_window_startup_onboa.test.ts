import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

import {
  AtlasClarificationError,
  createAtlasClarificationPacket,
  getAtlasClarificationPacketPath,
} from "../../src/atlas/clarification.ts";
import {
  buildAtlasDesktopLocationPath,
  parseAtlasDesktopLocationFromUrl,
  readAtlasDesktopState,
  resolveAtlasDesktopStatePath,
  resolveAtlasDesktopStateRoot,
  writeAtlasDesktopState,
} from "../../src/atlas/desktop_state.ts";
import { resolveAtlasDesktopResourcePaths } from "../../electron/resource_paths.ts";
import { restoreAndFocusAtlasWindow } from "../../electron/single_instance.ts";
import { decideAtlasPopupHandling } from "../../electron/window_policy.ts";

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-desktop-regression-"));
}

describe("atlas desktop regression checks", () => {
  it("persists one session-bound clarification packet before the desktop shell can hand off planning", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      const packet = await createAtlasClarificationPacket({
        stateDir,
        sessionId: "desktop-session-1",
        targetRepo: "Ancora-Labs/ATLAS",
        objective: "Launch ATLAS in a native desktop shell and collect one clarification pass first.",
        runner: async () => JSON.stringify({
          summary: "ATLAS should clarify the operator goal before opening the session surface.",
          openQuestions: ["Which delivery outcome should ATLAS optimize for first?"],
          executionNotes: ["Store one clarification packet and then load the native session surface."],
        }),
      });

      const packetPath = getAtlasClarificationPacketPath(stateDir, "desktop-session-1");
      const persisted = JSON.parse(await fs.readFile(packetPath, "utf8")) as { sessionId: string; summary: string };

      assert.equal(packet.sessionId, "desktop-session-1");
      assert.equal(persisted.sessionId, "desktop-session-1");
      assert.match(persisted.summary, /clarify the operator goal/i);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("persists portable desktop state beside the packaged app and restores the last session, draft, surface, focus, and window bounds", async () => {
    const tempRoot = await createTempRoot();
    const portableRoot = path.join(tempRoot, "ATLAS-portable");
    const stateRoot = resolveAtlasDesktopStateRoot({
      isPackaged: true,
      exePath: path.join(portableRoot, "ATLAS.exe"),
      cwd: tempRoot,
    });
    const statePath = resolveAtlasDesktopStatePath(stateRoot);

    try {
      const storedState = await writeAtlasDesktopState(statePath, {
        sessionId: "desktop-session-restore",
        onboardingDraft: "Reopen the desktop shell without losing this draft.",
        productDraft: "Restore the product-side composer draft after a relaunch.",
        productComposerFocused: true,
        windowBounds: {
          x: 120,
          y: 84,
          width: 1420,
          height: 940,
        },
        lastProductSurface: "sessions",
        focusedSessionRole: "quality-worker",
        updatedAt: null,
      });
      const restoredState = await readAtlasDesktopState(statePath);

      assert.equal(stateRoot, portableRoot);
      assert.equal(statePath, path.join(portableRoot, "state", "atlas", "desktop_state.json"));
      assert.equal(restoredState.sessionId, "desktop-session-restore");
      assert.equal(restoredState.onboardingDraft, "Reopen the desktop shell without losing this draft.");
      assert.equal(restoredState.productDraft, "Restore the product-side composer draft after a relaunch.");
      assert.equal(restoredState.productComposerFocused, true);
      assert.deepEqual(restoredState.windowBounds, {
        x: 120,
        y: 84,
        width: 1420,
        height: 940,
      });
      assert.equal(restoredState.lastProductSurface, "sessions");
      assert.equal(restoredState.focusedSessionRole, "quality-worker");
      assert.match(String(storedState.updatedAt), /T/);
      assert.equal(restoredState.updatedAt, storedState.updatedAt);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("builds and parses restorable product locations for home and sessions surfaces", () => {
    assert.equal(buildAtlasDesktopLocationPath({
      surface: "home",
      focusedSessionRole: "quality-worker",
    }), "/?focusRole=quality-worker");
    assert.equal(buildAtlasDesktopLocationPath({
      surface: "sessions",
      focusedSessionRole: "quality-worker",
    }), "/sessions?focusRole=quality-worker");
    assert.deepEqual(
      parseAtlasDesktopLocationFromUrl("http://127.0.0.1:8788/sessions?focusRole=quality-worker"),
      {
        surface: "sessions",
        focusedSessionRole: "quality-worker",
      },
    );
  });

  it("resolves packaged preload and onboarding assets from the bundled desktop entrypoint instead of process.cwd()", async () => {
    const tempRoot = await createTempRoot();
    const originalCwd = process.cwd();
    const packagedAppRoot = path.join(tempRoot, "ATLAS", "resources", "app");
    const bundledMainPath = path.join(packagedAppRoot, ".electron-build", "electron", "main.js");
    const unrelatedWorkingDirectory = path.join(tempRoot, "unrelated-working-directory");

    try {
      await fs.mkdir(unrelatedWorkingDirectory, { recursive: true });
      process.chdir(unrelatedWorkingDirectory);
      const resourcePaths = resolveAtlasDesktopResourcePaths(pathToFileURL(bundledMainPath).toString());

      assert.equal(resourcePaths.appRoot, packagedAppRoot);
      assert.equal(resourcePaths.preloadPath, path.join(packagedAppRoot, ".electron-build", "electron", "preload.js"));
      assert.equal(resourcePaths.onboardingHtmlPath, path.join(packagedAppRoot, "electron", "renderer", "index.html"));
      assert.notEqual(resourcePaths.onboardingHtmlPath, path.join(process.cwd(), "electron", "renderer", "index.html"));
    } finally {
      process.chdir(originalCwd);
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("restores and focuses the existing desktop window when ATLAS receives a second launch", () => {
    let restoreCalls = 0;
    let focusCalls = 0;

    const focused = restoreAndFocusAtlasWindow({
      isDestroyed: () => false,
      isMinimized: () => true,
      restore: () => {
        restoreCalls += 1;
      },
      focus: () => {
        focusCalls += 1;
      },
    });

    assert.equal(focused, true);
    assert.equal(restoreCalls, 1);
    assert.equal(focusCalls, 1);
  });

  it("[NEGATIVE] surfaces AI-call failures without writing a clarification packet", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");
    const packetPath = getAtlasClarificationPacketPath(stateDir, "desktop-session-2");

    try {
      await assert.rejects(() => createAtlasClarificationPacket({
        stateDir,
        sessionId: "desktop-session-2",
        targetRepo: "Ancora-Labs/ATLAS",
        objective: "Fail the clarification request.",
        runner: async () => {
          throw new AtlasClarificationError("Copilot CLI request failed.", 502, "clarification_invocation_failed");
        },
      }), /Copilot CLI request failed/i);

      await assert.rejects(() => fs.readFile(packetPath, "utf8"));
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] falls back to a fresh desktop state when the persisted portable state is invalid", async () => {
    const tempRoot = await createTempRoot();
    const statePath = resolveAtlasDesktopStatePath(tempRoot);

    try {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(statePath, JSON.stringify({
        sessionId: 42,
        onboardingDraft: ["invalid"],
        productDraft: { nope: true },
        productComposerFocused: "yes",
        windowBounds: {
          width: -1,
          height: "tall",
        },
        lastProductSurface: "elsewhere",
        focusedSessionRole: ["invalid"],
      }), "utf8");

      const restoredState = await readAtlasDesktopState(statePath);
      assert.equal(restoredState.sessionId, null);
      assert.equal(restoredState.onboardingDraft, "");
      assert.equal(restoredState.productDraft, "");
      assert.equal(restoredState.productComposerFocused, false);
      assert.equal(restoredState.windowBounds, null);
      assert.equal(restoredState.lastProductSurface, "home");
      assert.equal(restoredState.focusedSessionRole, null);
      assert.equal(restoredState.updatedAt, null);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] does not restore or focus a destroyed desktop window on repeat launch", () => {
    let restoreCalls = 0;
    let focusCalls = 0;

    const focused = restoreAndFocusAtlasWindow({
      isDestroyed: () => true,
      isMinimized: () => true,
      restore: () => {
        restoreCalls += 1;
      },
      focus: () => {
        focusCalls += 1;
      },
    });

    assert.equal(focused, false);
    assert.equal(restoreCalls, 0);
    assert.equal(focusCalls, 0);
  });

  it("contains auth popups inside the desktop shell and blocks unrelated external origins", () => {
    assert.deepEqual(
      decideAtlasPopupHandling("https://login.example.com/oauth/authorize?client_id=test", "http://127.0.0.1:40123"),
      { action: "open-modal-auth", reason: "contained-auth" },
    );
    assert.deepEqual(
      decideAtlasPopupHandling("https://example.com/docs", "http://127.0.0.1:40123"),
      { action: "deny", reason: "external-origin-blocked" },
    );
  });

});
