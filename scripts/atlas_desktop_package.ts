import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface AtlasDesktopPackageLayout {
  distRoot: string;
  stagingRoot: string;
  stagedAppRoot: string;
  legacyUnpackedRoot: string;
  portableRoot: string;
  portableExePath: string;
}

const ROOT = process.cwd();
const PORTABLE_FOLDER_NAME = "ATLAS";
const PORTABLE_EXE_NAME = "ATLAS.exe";
const STAGING_FOLDER_NAME = ".atlas-builder";
const STAGED_WINDOWS_FOLDER_NAME = "win-unpacked";
const REMOVE_RETRYABLE_CODES = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);
const REMOVE_RETRY_DELAYS_MS = [150, 300, 600];

export function createAtlasDesktopPackageLayout(
  root: string,
  portableFolderName = PORTABLE_FOLDER_NAME,
): AtlasDesktopPackageLayout {
  const normalizedFolderName = portableFolderName.trim();
  if (!normalizedFolderName) {
    throw new Error("ATLAS portable folder name must be a non-empty string.");
  }

  const distRoot = path.join(root, "dist");
  const stagingRoot = path.join(distRoot, STAGING_FOLDER_NAME);
  const stagedAppRoot = path.join(stagingRoot, STAGED_WINDOWS_FOLDER_NAME);
  const portableRoot = path.join(distRoot, normalizedFolderName);
  return {
    distRoot,
    stagingRoot,
    stagedAppRoot,
    legacyUnpackedRoot: path.join(distRoot, STAGED_WINDOWS_FOLDER_NAME),
    portableRoot,
    portableExePath: path.join(portableRoot, PORTABLE_EXE_NAME),
  };
}

function resolveNpmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function quoteWindowsArgument(value: string): string {
  if (!/[\s"&()^<>|]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, "\"\"")}"`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function isRetryableRemoveError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && typeof (error as NodeJS.ErrnoException).code === "string"
    && REMOVE_RETRYABLE_CODES.has((error as NodeJS.ErrnoException).code || ""),
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function removeReleasePath(targetPath: string, label: string): Promise<void> {
  for (let attempt = 0; attempt <= REMOVE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!isRetryableRemoveError(error) || attempt === REMOVE_RETRY_DELAYS_MS.length) {
        throw new Error(
          `[atlas:desktop:package] failed to clear ${label} at ${targetPath}: ${String((error as Error)?.message || error)}`,
        );
      }
      await delay(REMOVE_RETRY_DELAYS_MS[attempt] || 0);
    }
  }
}

async function resolveElectronBuilderCli(root: string): Promise<string> {
  const candidates = [
    path.join(root, "node_modules", "electron-builder", "cli.js"),
    path.join(root, "node_modules", "electron-builder", "out", "cli", "cli.js"),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  throw new Error("electron-builder CLI was not found under node_modules.");
}

export async function resetAtlasDesktopReleaseSurface(layout: AtlasDesktopPackageLayout): Promise<void> {
  await removeReleasePath(layout.stagingRoot, "staging surface");
  await removeReleasePath(layout.legacyUnpackedRoot, "legacy unpacked release surface");
  await removeReleasePath(layout.portableRoot, "portable release surface");
}

export async function publishAtlasDesktopPortableRelease(
  layout: AtlasDesktopPackageLayout,
): Promise<AtlasDesktopPackageLayout> {
  if (!await pathExists(layout.stagedAppRoot)) {
    throw new Error(`electron-builder did not produce the expected folder: ${layout.stagedAppRoot}`);
  }

  try {
    await fs.rename(layout.stagedAppRoot, layout.portableRoot);
  } catch (error) {
    throw new Error(
      `[atlas:desktop:package] failed to promote the staged portable folder to ${layout.portableRoot}: ${String((error as Error)?.message || error)}`,
    );
  }

  await removeReleasePath(layout.stagingRoot, "staging surface");
  await removeReleasePath(layout.legacyUnpackedRoot, "legacy unpacked release surface");

  if (!await pathExists(layout.portableExePath)) {
    throw new Error(`portable ATLAS executable was not created at ${layout.portableExePath}`);
  }

  return layout;
}

async function runCommand(command: string, args: string[], label: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let child;
    try {
      child = process.platform === "win32"
        ? spawn(process.env.ComSpec || "cmd.exe", [
          "/d",
          "/s",
          "/c",
          [command, ...args].map(quoteWindowsArgument).join(" "),
        ], {
          cwd: ROOT,
          stdio: "inherit",
          env: process.env,
        })
        : spawn(command, args, {
          cwd: ROOT,
          stdio: "inherit",
          env: process.env,
        });
    } catch (error) {
      reject(new Error(`[atlas:desktop:package] ${label} failed to start: ${String((error as Error)?.message || error)}`));
      return;
    }

    child.once("error", (error) => {
      reject(new Error(`[atlas:desktop:package] ${label} failed to start: ${String(error.message || error)}`));
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(
        `[atlas:desktop:package] ${label} failed with code ${String(code)}${signal ? ` (signal: ${signal})` : ""}.`,
      ));
    });
  });
}

async function packageAtlasDesktop(): Promise<AtlasDesktopPackageLayout> {
  const layout = createAtlasDesktopPackageLayout(ROOT);
  const electronBuilderCli = await resolveElectronBuilderCli(ROOT);

  await resetAtlasDesktopReleaseSurface(layout);

  await runCommand(resolveNpmCommand(), ["run", "atlas:desktop:build"], "desktop build");
  await runCommand(process.execPath, [
    electronBuilderCli,
    "--dir",
    "--win",
    `--config.directories.output=${layout.stagingRoot}`,
  ], "electron-builder");

  return publishAtlasDesktopPortableRelease(layout);
}

async function main(): Promise<void> {
  try {
    const layout = await packageAtlasDesktop();
    console.log(`[atlas:desktop:package] Portable ATLAS desktop folder is ready at ${layout.portableRoot}`);
  } catch (error) {
    console.error(`[atlas:desktop:package] packaging failed: ${String((error as Error)?.message || error)}`);
    process.exit(1);
  }
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  await main();
}
