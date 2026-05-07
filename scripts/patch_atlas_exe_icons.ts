import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Data, NtExecutable, NtExecutableResource, Resource } from "resedit";

import { resolveAtlasDesktopBuildOutputDir } from "./atlas_desktop_paths.js";

const ICON_GROUP_ID = 101;
const ICON_LANG = 1033;
const ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256] as const;
const VERSION_TRANSLATION = { lang: 1033, codepage: 1200 } as const;

function toPowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function runPowerShell(script: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pwsh", ["-NoProfile", "-Command", script], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`PowerShell icon resize failed with exit code ${code}: ${stderr || stdout}`));
    });
  });
}

async function ensureResizedIcons(sourcePngPath: string, tempDir: string): Promise<string[]> {
  await fs.mkdir(tempDir, { recursive: true });
  const outputPaths = ICON_SIZES.map((size) => path.join(tempDir, `atlas-icon-${size}.png`));
  const sizeList = ICON_SIZES.join(",");

  const script = [
    "Add-Type -AssemblyName System.Drawing",
    `$source = [System.Drawing.Image]::FromFile(${toPowerShellLiteral(sourcePngPath)})`,
    "try {",
    `  $sizes = @(${sizeList})`,
    `  $tempDir = ${toPowerShellLiteral(tempDir)}`,
    "  foreach ($size in $sizes) {",
    "    $bitmap = New-Object System.Drawing.Bitmap $size, $size",
    "    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
    "    try {",
    "      $graphics.Clear([System.Drawing.Color]::Transparent)",
    "      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic",
    "      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality",
    "      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality",
    "      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality",
    "      $graphics.DrawImage($source, 0, 0, $size, $size)",
    "      $outPath = Join-Path $tempDir (\"atlas-icon-\" + $size + \".png\")",
    "      $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)",
    "    } finally {",
    "      $graphics.Dispose()",
    "      $bitmap.Dispose()",
    "    }",
    "  }",
    "} finally {",
    "  $source.Dispose()",
    "}",
  ].join("; ");

  await runPowerShell(script);
  return outputPaths;
}

async function collectExecutableTargets(distDir: string): Promise<string[]> {
  const targets = new Set<string>();
  const unpackedExecutable = path.join(distDir, "win-unpacked", "ATLAS.exe");
  if (await pathExists(unpackedExecutable)) {
    targets.add(unpackedExecutable);
  }

  if (await pathExists(distDir)) {
    const entries = await fs.readdir(distDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /^ATLAS.*\.exe$/i.test(entry.name)) {
        targets.add(path.join(distDir, entry.name));
      }
    }
  }

  return [...targets];
}

async function patchExecutableIcon(executablePath: string, iconPngPaths: readonly string[], repoRoot: string): Promise<void> {
  const executableBuffer = await fs.readFile(executablePath);
  const executable = NtExecutable.from(executableBuffer, { ignoreCert: true });
  const resource = NtExecutableResource.from(executable);
  const icons = await Promise.all(iconPngPaths.map(async (iconPath, index) => {
    const iconBuffer = await fs.readFile(iconPath);
    const size = ICON_SIZES[index];
    return Data.RawIconItem.from(iconBuffer, size, size, 32);
  }));

  const iconGroups = Resource.IconGroupEntry.fromEntries(resource.entries);
  const targetGroups = iconGroups.length > 0
    ? iconGroups.map((group) => ({ id: group.id, lang: group.lang }))
    : [{ id: ICON_GROUP_ID, lang: ICON_LANG }];

  for (const group of targetGroups) {
    Resource.IconGroupEntry.replaceIconsForResource(resource.entries, group.id, group.lang, icons);
  }

  resource.outputResource(executable);
  await fs.writeFile(executablePath, Buffer.from(executable.generate()));
  console.log(`[atlas-icon] patched ${path.relative(repoRoot, executablePath)}`);
}

function parsePackageVersion(version: string): [number, number, number, number] {
  const [major = "0", minor = "0", patch = "0"] = String(version || "0.0.0").split(".");
  return [Number(major) || 0, Number(minor) || 0, Number(patch) || 0, 0];
}

async function patchExecutableVersionInfo(executablePath: string, repoRoot: string, packageVersion: string): Promise<void> {
  const executableBuffer = await fs.readFile(executablePath);
  const executable = NtExecutable.from(executableBuffer, { ignoreCert: true });
  const resource = NtExecutableResource.from(executable);
  const versionList = Resource.VersionInfo.fromEntries(resource.entries);
  const versionInfo = versionList[0] || Resource.VersionInfo.createEmpty();
  const [major, minor, patch, revision] = parsePackageVersion(packageVersion);
  const translations = versionInfo.getAvailableLanguages();
  const translation = translations[0] || VERSION_TRANSLATION;

  versionInfo.setFileVersion(major, minor, patch, revision, translation.lang);
  versionInfo.setProductVersion(major, minor, patch, revision, translation.lang);
  versionInfo.setStringValues(
    translation,
    {
      CompanyName: "Ancora Labs",
      FileDescription: "ATLAS",
      FileVersion: `${major}.${minor}.${patch}.${revision}`,
      InternalName: "ATLAS",
      OriginalFilename: "ATLAS.exe",
      ProductName: "ATLAS",
      ProductVersion: `${major}.${minor}.${patch}.${revision}`,
    },
    true,
  );
  versionInfo.outputToResourceEntries(resource.entries);

  resource.outputResource(executable);
  await fs.writeFile(executablePath, Buffer.from(executable.generate()));
  console.log(`[atlas-icon] version info ${path.relative(repoRoot, executablePath)}`);
}

async function copyPackagedIconAsset(distDir: string, iconPath: string, repoRoot: string): Promise<void> {
  const unpackedDir = path.join(distDir, "win-unpacked");
  if (!await pathExists(unpackedDir) || !await pathExists(iconPath)) {
    return;
  }

  const packagedIconPath = path.join(unpackedDir, path.basename(iconPath));
  await fs.copyFile(iconPath, packagedIconPath);
  console.log(`[atlas-icon] copied ${path.relative(repoRoot, packagedIconPath)}`);
}

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const distDir = resolveAtlasDesktopBuildOutputDir(repoRoot);
  const sourceIconPath = path.join(repoRoot, "atlasimage.png");
  const sourceIcoPath = path.join(repoRoot, "atlas.ico");
  const packageJsonPath = path.join(repoRoot, "package.json");

  if (!await pathExists(sourceIconPath)) {
    throw new Error(`[atlas-icon] source icon not found: ${sourceIconPath}`);
  }

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { version?: string };
  const packageVersion = String(packageJson.version || "0.1.0");

  const executableTargets = await collectExecutableTargets(distDir);
  if (executableTargets.length === 0) {
    console.log("[atlas-icon] no ATLAS executables found; skipping icon patch");
    return;
  }

  const tempDir = path.join(distDir, ".atlas-icon-cache");
  const iconPngPaths = await ensureResizedIcons(sourceIconPath, tempDir);

  try {
    for (const executablePath of executableTargets) {
      await patchExecutableIcon(executablePath, iconPngPaths, repoRoot);
      await patchExecutableVersionInfo(executablePath, repoRoot, packageVersion);
    }
    await copyPackagedIconAsset(distDir, sourceIcoPath, repoRoot);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();