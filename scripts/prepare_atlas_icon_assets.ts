import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Data } from "resedit";

const ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256] as const;

function toPowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
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

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const sourceIconPath = path.join(repoRoot, "atlasimage.png");
  const outputIcoPath = path.join(repoRoot, "atlas.ico");
  const tempDir = path.join(repoRoot, ".atlas-icon-cache");

  const iconPngPaths = await ensureResizedIcons(sourceIconPath, tempDir);

  try {
    const iconFile = new Data.IconFile();
    iconFile.icons = await Promise.all(iconPngPaths.map(async (iconPath, index) => ({
      width: ICON_SIZES[index],
      height: ICON_SIZES[index],
      bitCount: 32,
      data: Data.RawIconItem.from(await fs.readFile(iconPath), ICON_SIZES[index], ICON_SIZES[index], 32),
    })));
    await fs.writeFile(outputIcoPath, Buffer.from(iconFile.generate()));
    console.log(`[atlas-icon] prepared ${path.relative(repoRoot, outputIcoPath)}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();