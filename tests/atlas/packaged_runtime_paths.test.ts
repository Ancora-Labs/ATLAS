import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  resolvePackagedWorkingDirectory,
  resolvePackagedWorkingDirectoryWithPortableDir,
  resolveWindowIconPath,
} from "../../electron/packaged_runtime_paths.ts";
import { resolveAtlasDesktopStateRoot } from "../../src/atlas/desktop_state.ts";

describe("packaged ATLAS working directory resolution", () => {
  it("uses the workspace root for dist builds when box.config.json lives above dist", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-packaged-cwd-"));
    const workspaceRoot = path.join(tempRoot, "workspace");
    const exePath = path.join(workspaceRoot, "dist", "win-unpacked", "ATLAS.exe");

    await fs.mkdir(path.dirname(exePath), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, "box.config.json"), "{}", "utf8");
    await fs.writeFile(exePath, "", "utf8");

    assert.equal(resolvePackagedWorkingDirectory(exePath), workspaceRoot);
  });

  it("uses the workspace root for copied portable bundle launches", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-copied-cwd-"));
    const sessionRoot = path.join(tempRoot, "workspace-copy");
    const exePath = path.join(sessionRoot, "dist", "ATLAS", "ATLAS.exe");

    await fs.mkdir(path.dirname(exePath), { recursive: true });
    await fs.writeFile(path.join(sessionRoot, "box.config.json"), "{}", "utf8");
    await fs.writeFile(exePath, "", "utf8");

    assert.equal(resolvePackagedWorkingDirectory(exePath), sessionRoot);
  });

  it("uses the original portable executable directory instead of the temp extraction path", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-portable-cwd-"));
    const workspaceRoot = path.join(tempRoot, "workspace");
    const extractedExePath = path.join(tempRoot, "Temp", "portable-runtime", "ATLAS.exe");
    const portableExecutableDir = path.join(workspaceRoot, "dist");

    await fs.mkdir(path.dirname(extractedExePath), { recursive: true });
    await fs.mkdir(portableExecutableDir, { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, "box.config.json"), "{}", "utf8");
    await fs.writeFile(extractedExePath, "", "utf8");

    assert.equal(
      resolvePackagedWorkingDirectoryWithPortableDir(extractedExePath, portableExecutableDir),
      workspaceRoot,
    );
  });

  it("uses the aligned packaged working directory for desktop state instead of the temp extraction path", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-state-root-"));
    const workspaceRoot = path.join(tempRoot, "workspace");
    const extractedExePath = path.join(tempRoot, "Temp", "portable-runtime", "ATLAS.exe");

    await fs.mkdir(path.dirname(extractedExePath), { recursive: true });
    await fs.mkdir(workspaceRoot, { recursive: true });

    assert.equal(resolveAtlasDesktopStateRoot({
      isPackaged: true,
      exePath: extractedExePath,
      cwd: workspaceRoot,
    }), workspaceRoot);
  });

  it("[NEGATIVE] falls back to the exe directory when no workspace config is present", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-fallback-cwd-"));
    const exeDir = path.join(tempRoot, "portable", "ATLAS");
    const exePath = path.join(exeDir, "ATLAS.exe");

    await fs.mkdir(exeDir, { recursive: true });
    await fs.writeFile(exePath, "", "utf8");

    assert.equal(resolvePackagedWorkingDirectory(exePath), exeDir);
  });

  it("falls back to bundled png assets when the packaged ico file is missing", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-icon-fallback-"));
    const appRoot = path.join(tempRoot, "app");
    const packagedRoot = path.join(tempRoot, "dist", "ATLAS");

    await fs.mkdir(appRoot, { recursive: true });
    await fs.mkdir(packagedRoot, { recursive: true });
    await fs.writeFile(path.join(appRoot, "atlasimage.png"), "", "utf8");

    assert.equal(
      resolveWindowIconPath(appRoot, packagedRoot, "win32"),
      path.join(appRoot, "atlasimage.png"),
    );
  });

  it("prefers the packaged ico asset on Windows so the window icon matches the portable executable", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-icon-packaged-"));
    const appRoot = path.join(tempRoot, "app");
    const packagedRoot = path.join(tempRoot, "dist", "ATLAS");

    await fs.mkdir(appRoot, { recursive: true });
    await fs.mkdir(packagedRoot, { recursive: true });
    await fs.writeFile(path.join(appRoot, "atlasimage.png"), "", "utf8");
    await fs.writeFile(path.join(packagedRoot, "atlas.ico"), "", "utf8");

    assert.equal(
      resolveWindowIconPath(appRoot, packagedRoot, "win32"),
      path.join(packagedRoot, "atlas.ico"),
    );
  });

  it("[NEGATIVE] returns no window icon when neither packaged nor bundled assets exist", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-icon-missing-"));
    const appRoot = path.join(tempRoot, "app");
    const packagedRoot = path.join(tempRoot, "dist", "ATLAS");

    await fs.mkdir(appRoot, { recursive: true });
    await fs.mkdir(packagedRoot, { recursive: true });

    assert.equal(resolveWindowIconPath(appRoot, packagedRoot, "win32"), null);
  });
});