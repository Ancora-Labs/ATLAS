import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { getDesktopLayoutMode } from "../../electron/renderer/layout.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

describe("atlas_desktop_onboarding_shell", () => {
  it("keeps the onboarding contract pinned across the renderer and desktop bridge surfaces", async () => {
    const html = await fs.readFile(path.join(ROOT, "electron", "renderer", "index.html"), "utf8");
    const appScript = await fs.readFile(path.join(ROOT, "electron", "renderer", "app.js"), "utf8");
    const preload = await fs.readFile(path.join(ROOT, "electron", "preload.ts"), "utf8");
    const mainProcess = await fs.readFile(path.join(ROOT, "electron", "main.ts"), "utf8");

    assert.match(html, /Native Windows title bar/);
    assert.match(html, /Objective composer/);
    assert.match(html, /Store clarification and open ATLAS/);
    assert.match(html, /data-role="detail"/);
    assert.doesNotMatch(html, /window-controls|Run clarification and open ATLAS/);

    assert.match(appScript, /setOnboardingDraft/);
    assert.match(appScript, /queueDraftSave/);
    assert.match(appScript, /Restored the saved onboarding draft/);
    assert.match(appScript, /Clarification stored\. Opening the ATLAS workspace/);

    assert.match(preload, /setOnboardingDraft/);
    assert.match(preload, /atlas-desktop:set-onboarding-draft/);
    assert.match(preload, /atlas-desktop:submit-clarification/);

    assert.match(mainProcess, /createAtlasDesktopWindowChromeOptions/);
    assert.match(mainProcess, /createAtlasAuthPopupOptions/);
    assert.match(mainProcess, /atlas-desktop:set-onboarding-draft/);
    assert.match(mainProcess, /atlas-desktop:submit-clarification/);
  });

  it("[NEGATIVE] keeps narrow viewports stacked until the workspace has room for the rail plus composer layout", () => {
    assert.equal(getDesktopLayoutMode(Number.NaN), "stacked");
    assert.equal(getDesktopLayoutMode(1099), "stacked");
    assert.equal(getDesktopLayoutMode(1100), "split");
  });
});
