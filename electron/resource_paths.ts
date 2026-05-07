import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import { resolvePackagedWorkingDirectory, resolveWindowIconPath } from "./packaged_runtime_paths.js";

export { resolvePackagedWorkingDirectory } from "./packaged_runtime_paths.js";

export interface AtlasDesktopResourcePathOptions {
  mainModuleUrl?: string;
  isPackaged?: boolean;
  exePath?: string;
}

export interface AtlasDesktopResourcePaths {
  appRoot: string;
  mainModuleDir: string;
  preloadPath: string;
  rendererHtmlPath: string;
  rendererScriptPath: string;
  rendererLayoutPath: string;
  onboardingHtmlPath: string;
  windowIconPath: string | null;
}

function resolveAppRoot(mainModuleDir: string): string {
  const marker = `${path.sep}.electron-build${path.sep}`;
  const markerIndex = mainModuleDir.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return mainModuleDir.slice(0, markerIndex);
  }
  return path.resolve(mainModuleDir, "..");
}

function resolveResourcePathOptions(
  options: string | AtlasDesktopResourcePathOptions | undefined,
): Required<AtlasDesktopResourcePathOptions> {
  if (typeof options === "string") {
    return {
      mainModuleUrl: options,
      isPackaged: app.isPackaged,
      exePath: app.isPackaged ? app.getPath("exe") : "",
    };
  }

  return {
    mainModuleUrl: options?.mainModuleUrl || import.meta.url,
    isPackaged: typeof options?.isPackaged === "boolean" ? options.isPackaged : app.isPackaged,
    exePath: options?.exePath || (app.isPackaged ? app.getPath("exe") : ""),
  };
}

export function resolveAtlasDesktopShellCommand(options: {
  isPackaged?: boolean;
  exePath?: string | null;
} = {}): string {
  if (options.isPackaged) {
    const exeName = path.basename(String(options.exePath || "").trim() || "ATLAS.exe");
    return path.normalize(`.${path.sep}${exeName}`);
  }
  return path.normalize(`.${path.sep}ATLAS.cmd`);
}

export function resolveAtlasDesktopResourcePaths(
  options: string | AtlasDesktopResourcePathOptions = import.meta.url,
): AtlasDesktopResourcePaths {
  const resolvedOptions = resolveResourcePathOptions(options);
  if (resolvedOptions.isPackaged && !resolvedOptions.exePath) {
    throw new Error("Packaged ATLAS desktop resource resolution requires an executable path.");
  }

  const mainModulePath = fileURLToPath(resolvedOptions.mainModuleUrl);
  const mainModuleDir = path.dirname(mainModulePath);
  const appRoot = resolveAppRoot(mainModuleDir);
  const packagedRoot = resolvedOptions.isPackaged
    ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(resolvedOptions.exePath))
    : null;
  const preloadFileName = path.extname(mainModulePath) === ".js" ? "preload.js" : "preload.mjs";
  const rendererHtmlPath = path.join(appRoot, "electron", "renderer", "index.html");

  return {
    appRoot,
    mainModuleDir,
    preloadPath: path.join(mainModuleDir, preloadFileName),
    rendererHtmlPath,
    rendererScriptPath: path.join(appRoot, "electron", "renderer", "app.js"),
    rendererLayoutPath: path.join(appRoot, "electron", "renderer", "layout.js"),
    onboardingHtmlPath: rendererHtmlPath,
    windowIconPath: resolveWindowIconPath(appRoot, packagedRoot, process.platform),
  };
}