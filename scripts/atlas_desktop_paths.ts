import os from "node:os";
import path from "node:path";

export function resolveRepoRoot(): string {
  return process.cwd();
}

export function resolveAtlasReleaseDistDir(repoRoot = resolveRepoRoot()): string {
  return path.join(repoRoot, "dist");
}

export function resolveAtlasDesktopBuildOutputDir(repoRoot = resolveRepoRoot()): string {
  const configuredOutputDir = process.env.ATLAS_DESKTOP_BUILD_DIR?.trim();
  if (configuredOutputDir) {
    return path.isAbsolute(configuredOutputDir)
      ? configuredOutputDir
      : path.resolve(repoRoot, configuredOutputDir);
  }

  return path.join(os.tmpdir(), "atlas-desktop-build", path.basename(repoRoot));
}
