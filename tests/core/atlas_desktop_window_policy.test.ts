import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAtlasDesktopWindowChromeOptions,
  decideAtlasPopupHandling,
} from "../../electron/window_policy.ts";

describe("atlas_desktop_window_policy", () => {
  it("builds restrained Windows-first shell chrome for the main product window", () => {
    const windowOptions = createAtlasDesktopWindowChromeOptions({
      width: 1480,
      height: 960,
      x: 64,
      y: 48,
    }, "win32");

    assert.equal(windowOptions.width, 1480);
    assert.equal(windowOptions.height, 960);
    assert.equal(windowOptions.x, 64);
    assert.equal(windowOptions.y, 48);
    assert.equal(windowOptions.minWidth, 1120);
    assert.equal(windowOptions.minHeight, 720);
    assert.equal(windowOptions.show, false);
    assert.equal(windowOptions.frame, true);
    assert.equal(windowOptions.autoHideMenuBar, true);
    assert.equal(windowOptions.title, "ATLAS");
    assert.equal(windowOptions.fullscreenable, false);
    assert.equal(windowOptions.backgroundColor, "#0a0f14");
    assert.equal(windowOptions.backgroundMaterial, "mica");
  });

  it("[NEGATIVE] centers unpersisted windows, omits Windows-only material on other platforms, and still blocks external origins", () => {
    const windowOptions = createAtlasDesktopWindowChromeOptions(null, "linux");

    assert.equal(windowOptions.width, 1420);
    assert.equal(windowOptions.height, 920);
    assert.equal(windowOptions.center, true);
    assert.equal("backgroundMaterial" in windowOptions, false);
    assert.deepEqual(
      decideAtlasPopupHandling("https://example.com/docs", "http://127.0.0.1:8788"),
      { action: "deny", reason: "external-origin-blocked" },
    );
  });
});
