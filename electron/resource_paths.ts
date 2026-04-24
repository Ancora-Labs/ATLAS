import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AtlasDesktopResourcePaths {
  appRoot: string;
  mainModuleDir: string;
  preloadPath: string;
  onboardingHtmlPath: string;
  onboardingScriptPath: string;
  onboardingLayoutPath: string;
}

export interface ResolveAtlasDesktopShellCommandOptions {
  isPackaged?: boolean;
  exePath?: string;
}

export interface ResolveAtlasDesktopResourcePathsOptions {
  mainModuleUrl: string;
  isPackaged?: boolean;
  exePath?: string;
}

const ATLAS_DESKTOP_EXECUTABLE_NAME = "ATLAS.exe";
const ATLAS_DESKTOP_DEVELOPMENT_LAUNCHER = "ATLAS.cmd";

function normalizeResolveAtlasDesktopResourcePathsOptions(
  options: ResolveAtlasDesktopResourcePathsOptions | string,
): ResolveAtlasDesktopResourcePathsOptions {
  if (typeof options === "string") {
    return { mainModuleUrl: options };
  }
  return options;
}

export function resolvePackagedWorkingDirectory(exePath: string): string {
  return path.dirname(exePath);
}

function formatAtlasDesktopShellCommand(fileName: string): string {
  return path.normalize(`.${path.sep}${fileName}`);
}

export function resolveAtlasDesktopShellCommand(
  options: ResolveAtlasDesktopShellCommandOptions = {},
): string {
  if (options.isPackaged === true) {
    return formatAtlasDesktopShellCommand(
      path.basename(String(options.exePath || "").trim() || ATLAS_DESKTOP_EXECUTABLE_NAME),
    );
  }

  return formatAtlasDesktopShellCommand(ATLAS_DESKTOP_DEVELOPMENT_LAUNCHER);
}

function resolvePackagedAppRoot(exePath: string): string {
  return path.join(resolvePackagedWorkingDirectory(exePath), "resources", "app.asar");
}

export function resolveAtlasDesktopResourcePaths(
  options: ResolveAtlasDesktopResourcePathsOptions | string,
): AtlasDesktopResourcePaths {
  const normalizedOptions = normalizeResolveAtlasDesktopResourcePathsOptions(options);
  const mainModulePath = fileURLToPath(normalizedOptions.mainModuleUrl);
  const fallbackMainModuleDir = path.dirname(mainModulePath);
  const packagedExePath = String(normalizedOptions.exePath || "").trim();
  const isPackaged = normalizedOptions.isPackaged === true;

  if (isPackaged && !packagedExePath) {
    throw new Error("ATLAS packaged resource resolution requires the executable path.");
  }

  const appRoot = isPackaged
    ? resolvePackagedAppRoot(packagedExePath)
    : path.resolve(fallbackMainModuleDir, "..", "..");
  const mainModuleDir = isPackaged
    ? path.join(appRoot, ".electron-build", "electron")
    : fallbackMainModuleDir;

  return {
    appRoot,
    mainModuleDir,
    preloadPath: path.join(mainModuleDir, "preload.js"),
    onboardingHtmlPath: path.join(appRoot, "electron", "renderer", "index.html"),
    onboardingScriptPath: path.join(appRoot, "electron", "renderer", "app.js"),
    onboardingLayoutPath: path.join(appRoot, "electron", "renderer", "layout.js"),
  };
}
