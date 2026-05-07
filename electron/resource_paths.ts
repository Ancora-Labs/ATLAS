import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import { resolvePackagedWorkingDirectory, resolveWindowIconPath } from "./packaged_runtime_paths.ts";

export { resolvePackagedWorkingDirectory } from "./packaged_runtime_paths.ts";

export interface AtlasDesktopResourcePaths {
  appRoot: string;
  mainModuleDir: string;
  preloadPath: string;
  onboardingHtmlPath: string;
  windowIconPath: string | null;
}

export function resolveAtlasDesktopResourcePaths(mainModuleUrl: string = import.meta.url): AtlasDesktopResourcePaths {
  const mainModulePath = fileURLToPath(mainModuleUrl);
  const mainModuleDir = path.dirname(mainModulePath);
  const appRoot = path.resolve(mainModuleDir, "..");
  const packagedRoot = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath("exe"));

  return {
    appRoot,
    mainModuleDir,
    preloadPath: path.join(mainModuleDir, "preload.mjs"),
    onboardingHtmlPath: path.join(appRoot, "electron", "renderer", "index.html"),
    windowIconPath: resolveWindowIconPath(appRoot, app.isPackaged ? packagedRoot : null, process.platform),
  };
}