import fs from "node:fs";
import path from "node:path";

function hasBoxConfig(dirPath: string): boolean {
  try {
    return fs.statSync(path.join(dirPath, "box.config.json")).isFile();
  } catch {
    return false;
  }
}

function firstExistingPath(candidatePaths: string[]): string | null {
  for (const candidatePath of candidatePaths) {
    try {
      if (fs.statSync(candidatePath).isFile()) {
        return candidatePath;
      }
    } catch {
      // Keep probing fallbacks.
    }
  }
  return null;
}

function deriveWorkspaceCandidates(baseDir: string): string[] {
  const normalizedDir = path.resolve(baseDir);
  const directParent = path.dirname(normalizedDir);
  return [
    path.basename(normalizedDir).toLowerCase() === "dist" ? directParent : null,
    path.basename(directParent).toLowerCase() === "dist" ? path.dirname(directParent) : null,
    normalizedDir,
  ].filter((candidate): candidate is string => Boolean(candidate));
}

export function resolvePackagedWorkingDirectory(exePath: string): string {
  return resolvePackagedWorkingDirectoryWithPortableDir(exePath, process.env.PORTABLE_EXECUTABLE_DIR || null);
}

export function resolvePackagedWorkingDirectoryWithPortableDir(
  exePath: string,
  portableExecutableDir: string | null,
): string {
  const extractedExeDir = path.dirname(path.resolve(exePath));
  const preferredExeDir = portableExecutableDir
    ? path.resolve(portableExecutableDir)
    : extractedExeDir;
  const candidateRoots = [preferredExeDir, extractedExeDir]
    .flatMap((candidateDir) => deriveWorkspaceCandidates(candidateDir))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate, index, allCandidates) => allCandidates.indexOf(candidate) === index);

  for (const candidateRoot of candidateRoots) {
    if (hasBoxConfig(candidateRoot)) {
      return candidateRoot;
    }
  }

  return preferredExeDir;
}

export function resolveWindowIconPath(appRoot: string, packagedRoot: string | null | undefined, platform: NodeJS.Platform): string | null {
  const packagedIconCandidates = platform === "win32" && packagedRoot
    ? [path.join(packagedRoot, "atlas.ico"), path.join(packagedRoot, "atlasimage.png"), path.join(packagedRoot, "atlas.png"), path.join(packagedRoot, "atlaslogoii.png")]
    : [];
  const bundledIconCandidates = [
    path.join(appRoot, "atlas.ico"),
    path.join(appRoot, "atlasimage.png"),
    path.join(appRoot, "atlas.png"),
    path.join(appRoot, "atlaslogoii.png"),
    path.join(appRoot, "Frame 5.png"),
  ];

  return firstExistingPath([...packagedIconCandidates, ...bundledIconCandidates]);
}