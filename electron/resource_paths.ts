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

export interface ResolveAtlasDesktopResourcePathsOptions {
  mainModuleUrl: string;
  isPackaged?: boolean;
  exePath?: string;
}

export function resolvePackagedWorkingDirectory(exePath: string): string {
  return path.dirname(exePath);
}

function resolvePackagedAppRoot(exePath: string): string {
  return path.join(resolvePackagedWorkingDirectory(exePath), "resources", "app.asar");
}

export function resolveAtlasDesktopResourcePaths(
  options: ResolveAtlasDesktopResourcePathsOptions,
): AtlasDesktopResourcePaths {
  const mainModulePath = fileURLToPath(options.mainModuleUrl);
  const fallbackMainModuleDir = path.dirname(mainModulePath);
  const packagedExePath = String(options.exePath || "").trim();
  const isPackaged = options.isPackaged === true;

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
