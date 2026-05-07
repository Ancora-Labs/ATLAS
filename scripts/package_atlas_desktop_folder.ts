import fs from "node:fs/promises";
import path from "node:path";

import { resolveAtlasDesktopBuildOutputDir, resolveAtlasReleaseDistDir, resolveRepoRoot } from "./atlas_desktop_paths.js";

const repoRoot = resolveRepoRoot();
const distDir = resolveAtlasReleaseDistDir(repoRoot);
const buildOutputDir = resolveAtlasDesktopBuildOutputDir(repoRoot);
const unpackedDir = path.join(buildOutputDir, "win-unpacked");
const releaseDir = path.join(distDir, "ATLAS");

async function copyIfExists(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await fs.access(sourcePath);
  } catch {
    return;
  }
  await fs.copyFile(sourcePath, targetPath);
}

async function removeStalePortableExecutables(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(distDir);
  } catch {
    return;
  }

  await Promise.all(entries
    .filter((entry) => /^ATLAS\s+.*\.exe$/i.test(entry))
    .map((entry) => fs.rm(path.join(distDir, entry), { force: true })));
}

async function main(): Promise<void> {
  await fs.access(path.join(unpackedDir, "ATLAS.exe"));
  await fs.rm(releaseDir, { recursive: true, force: true });
  await fs.cp(unpackedDir, releaseDir, { recursive: true });
  await copyIfExists(path.join(repoRoot, "box.config.json"), path.join(releaseDir, "box.config.json"));
  await copyIfExists(path.join(repoRoot, "policy.json"), path.join(releaseDir, "policy.json"));
  await removeStalePortableExecutables();
  console.log(`[atlas] desktop folder package ready: ${releaseDir} (build output: ${buildOutputDir})`);
}

main().catch((error) => {
  console.error(`[atlas] desktop folder package failed: ${String((error as Error)?.message || error)}`);
  process.exitCode = 1;
});