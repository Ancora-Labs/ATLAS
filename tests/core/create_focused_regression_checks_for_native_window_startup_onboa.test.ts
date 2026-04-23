import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  AtlasClarificationError,
  createAtlasClarificationPacket,
  getAtlasClarificationPacketPath,
} from "../../src/atlas/clarification.ts";
import { decideAtlasPopupHandling } from "../../electron/window_policy.ts";
import { getDesktopLayoutMode } from "../../electron/renderer/layout.js";

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

  it("switches the onboarding surface into stacked mode for narrow window widths", () => {
    assert.equal(getDesktopLayoutMode(1440), "split");
    assert.equal(getDesktopLayoutMode(720), "stacked");
    assert.equal(getDesktopLayoutMode(Number.NaN), "stacked");
  });
});
