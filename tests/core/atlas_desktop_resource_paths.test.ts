import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  resolveAtlasDesktopResourcePaths,
  resolvePackagedWorkingDirectory,
} from "../../electron/resource_paths.js";

describe("atlas_desktop_resource_paths", () => {
  it("derives preload and onboarding assets from the compiled desktop entrypoint", () => {
    const paths = resolveAtlasDesktopResourcePaths("file:///C:/repo/.electron-build/electron/main.js");

    assert.equal(paths.appRoot, path.join("C:", "repo"));
    assert.equal(paths.mainModuleDir, path.join("C:", "repo", ".electron-build", "electron"));
    assert.equal(paths.preloadPath, path.join("C:", "repo", ".electron-build", "electron", "preload.js"));
    assert.equal(paths.onboardingHtmlPath, path.join("C:", "repo", "electron", "renderer", "index.html"));
  });

  it("keeps packaged asset resolution anchored to app.asar instead of the process working directory", () => {
    const paths = resolveAtlasDesktopResourcePaths(
      "file:///C:/portable/ATLAS/resources/app.asar/.electron-build/electron/main.js",
    );

    assert.equal(paths.appRoot, path.join("C:", "portable", "ATLAS", "resources", "app.asar"));
    assert.equal(
      paths.preloadPath,
      path.join("C:", "portable", "ATLAS", "resources", "app.asar", ".electron-build", "electron", "preload.js"),
    );
    assert.equal(
      paths.onboardingHtmlPath,
      path.join("C:", "portable", "ATLAS", "resources", "app.asar", "electron", "renderer", "index.html"),
    );
    assert.notEqual(paths.onboardingHtmlPath, path.join("C:", "somewhere-else", "electron", "renderer", "index.html"));
  });

  it("uses the packaged executable directory as the deterministic working directory root", () => {
    assert.equal(
      resolvePackagedWorkingDirectory(path.join("C:", "portable", "ATLAS", "ATLAS.exe")),
      path.join("C:", "portable", "ATLAS"),
    );
  });
});
