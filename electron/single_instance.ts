import path from "node:path";

export const ATLAS_APP_NAME = "ATLAS";
export const ATLAS_WINDOWS_APP_ID = "com.ancora.atlas";
export const ATLAS_PINNED_SHORTCUT_NAME = "ATLAS.lnk";

export interface AtlasWindowsAppDetails {
  appId: string;
  appIconPath?: string;
  appIconIndex?: number;
  relaunchCommand?: string;
  relaunchDisplayName?: string;
}

export interface AtlasWindowsShortcutDetails {
  appUserModelId?: string;
  args?: string;
  cwd?: string;
  description?: string;
  icon?: string;
  iconIndex?: number;
  target: string;
}

function normalizePathForComparison(value: string | null | undefined): string {
  return path.resolve(String(value || "")).toLowerCase();
}

function isAtlasExecutablePath(value: string | null | undefined): boolean {
  const basename = path.basename(String(value || "")).toLowerCase();
  return /^atlas.*\.exe$/.test(basename);
}

export function resolveAtlasShortcutExecutableTarget(
  executablePath: string | null | undefined,
  isPackaged: boolean,
): string | null {
  if (!isPackaged || !isAtlasExecutablePath(executablePath)) {
    return null;
  }

  return path.resolve(String(executablePath));
}

export function shouldRepairAtlasShortcut(
  details: AtlasWindowsShortcutDetails,
  portableExecutablePath: string | null,
): boolean {
  if (!isAtlasExecutablePath(details.target)) {
    return false;
  }

  if (details.appUserModelId !== ATLAS_WINDOWS_APP_ID) {
    return true;
  }

  return Boolean(
    portableExecutablePath
    && normalizePathForComparison(details.target) !== normalizePathForComparison(portableExecutablePath),
  );
}

export function buildRepairedAtlasShortcutDetails(
  details: AtlasWindowsShortcutDetails,
  portableExecutablePath: string | null,
): AtlasWindowsShortcutDetails {
  const target = portableExecutablePath || details.target;
  return {
    ...details,
    target,
    appUserModelId: ATLAS_WINDOWS_APP_ID,
    description: ATLAS_APP_NAME,
    icon: target,
    iconIndex: 0,
  };
}

export function shouldRenameAtlasShortcut(shortcutPath: string, details: AtlasWindowsShortcutDetails): boolean {
  if (!isAtlasExecutablePath(details.target)) {
    return false;
  }

  return path.basename(shortcutPath).toLowerCase() !== ATLAS_PINNED_SHORTCUT_NAME.toLowerCase();
}

export function buildAtlasWindowsAppDetails(
  executablePath: string,
  iconPath: string | null,
): AtlasWindowsAppDetails {
  return {
    appId: ATLAS_WINDOWS_APP_ID,
    appIconPath: iconPath || executablePath,
    appIconIndex: 0,
    relaunchCommand: executablePath,
    relaunchDisplayName: ATLAS_APP_NAME,
  };
}

export interface AtlasFocusableWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  focus(): void;
}

export function restoreAndFocusAtlasWindow(window: AtlasFocusableWindow | null): boolean {
  if (!window || window.isDestroyed()) {
    return false;
  }

  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
  return true;
}
