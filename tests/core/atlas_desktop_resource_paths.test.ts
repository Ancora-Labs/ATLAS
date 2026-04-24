import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  resolveAtlasDesktopResourcePaths,
  resolvePackagedWorkingDirectory,
} from "../../electron/resource_paths.js";

describe("atlas_desktop_resource_paths", () => {
  it("derives preload and onboarding assets from the compiled desktop entrypoint", () => {
    const appRoot = path.join(path.parse(process.cwd()).root, "repo");
    const paths = resolveAtlasDesktopResourcePaths(
      pathToFileURL(path.join(appRoot, ".electron-build", "electron", "main.js")).toString(),
    );

    assert.equal(paths.appRoot, appRoot);
    assert.equal(paths.mainModuleDir, path.join(appRoot, ".electron-build", "electron"));
    assert.equal(paths.preloadPath, path.join(appRoot, ".electron-build", "electron", "preload.js"));
    assert.equal(paths.onboardingHtmlPath, path.join(appRoot, "electron", "renderer", "index.html"));
    assert.equal(paths.onboardingScriptPath, path.join(appRoot, "electron", "renderer", "app.js"));
    assert.equal(paths.onboardingLayoutPath, path.join(appRoot, "electron", "renderer", "layout.js"));
  });

  it("keeps packaged asset resolution anchored to app.asar instead of the process working directory", () => {
    const appRoot = path.join(path.parse(process.cwd()).root, "portable", "ATLAS", "resources", "app.asar");
    const paths = resolveAtlasDesktopResourcePaths(
      pathToFileURL(path.join(appRoot, ".electron-build", "electron", "main.js")).toString(),
    );

    assert.equal(paths.appRoot, appRoot);
    assert.equal(
      paths.preloadPath,
      path.join(appRoot, ".electron-build", "electron", "preload.js"),
    );
    assert.equal(
      paths.onboardingHtmlPath,
      path.join(appRoot, "electron", "renderer", "index.html"),
    );
    assert.equal(
      paths.onboardingScriptPath,
      path.join(appRoot, "electron", "renderer", "app.js"),
    );
    assert.equal(
      paths.onboardingLayoutPath,
      path.join(appRoot, "electron", "renderer", "layout.js"),
    );
    assert.notEqual(
      paths.onboardingHtmlPath,
      path.join(path.parse(process.cwd()).root, "somewhere-else", "electron", "renderer", "index.html"),
    );
  });

  it("uses the packaged executable directory as the deterministic working directory root", () => {
    const packagedRoot = path.join(path.parse(process.cwd()).root, "portable", "ATLAS");
    assert.equal(
      resolvePackagedWorkingDirectory(path.join(packagedRoot, "ATLAS.exe")),
      packagedRoot,
    );
  });
});
