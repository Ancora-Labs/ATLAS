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

export function resolvePackagedWorkingDirectory(exePath: string): string {
  return path.dirname(exePath);
}

export function resolveAtlasDesktopResourcePaths(mainModuleUrl: string): AtlasDesktopResourcePaths {
  const mainModulePath = fileURLToPath(mainModuleUrl);
  const mainModuleDir = path.dirname(mainModulePath);
  const appRoot = path.resolve(mainModuleDir, "..", "..");
  return {
    appRoot,
    mainModuleDir,
    preloadPath: path.join(mainModuleDir, "preload.js"),
    onboardingHtmlPath: path.join(appRoot, "electron", "renderer", "index.html"),
    onboardingScriptPath: path.join(appRoot, "electron", "renderer", "app.js"),
    onboardingLayoutPath: path.join(appRoot, "electron", "renderer", "layout.js"),
  };
}
