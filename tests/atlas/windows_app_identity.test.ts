import { describe, it } from "node:test";
import assert from "node:assert/strict";
import packageJson from "../../package.json" with { type: "json" };

import {
  ATLAS_APP_NAME,
  ATLAS_PINNED_SHORTCUT_NAME,
  ATLAS_WINDOWS_APP_ID,
  buildAtlasWindowsAppDetails,
  buildRepairedAtlasShortcutDetails,
  resolveAtlasShortcutExecutableTarget,
  shouldRepairAtlasShortcut,
  shouldRenameAtlasShortcut,
} from "../../electron/single_instance.ts";

describe("atlas windows app identity", () => {
  it("keeps the packaged Windows app id aligned with the runtime app user model id", () => {
    assert.equal(ATLAS_WINDOWS_APP_ID, packageJson.build.appId);
    assert.equal(ATLAS_APP_NAME, packageJson.build.productName);
  });

  it("[NEGATIVE] no longer uses the legacy app user model id that caused taskbar duplication", () => {
    assert.notEqual(ATLAS_WINDOWS_APP_ID, "com.ancoralabs.atlas");
  });

  it("repairs pinned ATLAS shortcuts so taskbar launches group into the existing app", () => {
    const shortcut = {
      target: "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\ATLAS.exe",
      appUserModelId: "",
    };
    const portableTarget = "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\ATLAS.exe";

    assert.equal(shouldRepairAtlasShortcut(shortcut, portableTarget), true);
    assert.deepEqual(buildRepairedAtlasShortcutDetails(shortcut, portableTarget), {
      target: portableTarget,
      appUserModelId: ATLAS_WINDOWS_APP_ID,
      description: ATLAS_APP_NAME,
      icon: portableTarget,
      iconIndex: 0,
    });
  });

  it("uses the packaged ATLAS executable as the only valid shortcut repair target", () => {
    assert.equal(
      resolveAtlasShortcutExecutableTarget(
        "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\ATLAS.exe",
        true,
      ),
      "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\ATLAS.exe",
    );
  });

  it("[NEGATIVE] ignores development electron.exe when deciding whether to rewrite pinned shortcuts", () => {
    assert.equal(
      resolveAtlasShortcutExecutableTarget(
        "C:\\Users\\caner\\Desktop\\Box\\node_modules\\electron\\dist\\electron.exe",
        false,
      ),
      null,
    );
  });

  it("[NEGATIVE] ignores non-ATLAS pinned shortcuts", () => {
    assert.equal(shouldRepairAtlasShortcut({ target: "C:\\Windows\\explorer.exe" }, null), false);
  });

  it("renames legacy Electron taskbar shortcut files so hover text shows ATLAS", () => {
    assert.equal(ATLAS_PINNED_SHORTCUT_NAME, "ATLAS.lnk");
    assert.equal(
      shouldRenameAtlasShortcut(
        "C:\\Users\\caner\\AppData\\Roaming\\Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar\\Electron.lnk",
        { target: "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\ATLAS.exe" },
      ),
      true,
    );
  });

  it("publishes ATLAS relaunch metadata to the Windows taskbar for the running window", () => {
    assert.deepEqual(
      buildAtlasWindowsAppDetails(
        "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\ATLAS.exe",
        "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\atlas.ico",
      ),
      {
        appId: ATLAS_WINDOWS_APP_ID,
        appIconPath: "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\atlas.ico",
        appIconIndex: 0,
        relaunchCommand: "C:\\Users\\caner\\Desktop\\Box\\dist\\ATLAS\\ATLAS.exe",
        relaunchDisplayName: ATLAS_APP_NAME,
      },
    );
  });
});