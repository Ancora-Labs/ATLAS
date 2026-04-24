import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";

export interface AtlasWindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface AtlasPopupDecision {
  action: "allow-same-origin" | "open-modal-auth" | "deny";
  reason: string;
}

export function createAtlasDesktopWindowChromeOptions(
  persistedBounds: AtlasWindowBounds | null,
  platform: NodeJS.Platform = process.platform,
): BrowserWindowConstructorOptions {
  return {
    width: persistedBounds?.width || 1420,
    height: persistedBounds?.height || 920,
    ...(persistedBounds && typeof persistedBounds.x === "number" ? { x: persistedBounds.x } : { center: true }),
    ...(persistedBounds && typeof persistedBounds.y === "number" ? { y: persistedBounds.y } : {}),
    minWidth: 1120,
    minHeight: 720,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: "#0a0f14",
    title: "ATLAS",
    maximizable: true,
    fullscreenable: false,
    ...(platform === "win32" ? { backgroundMaterial: "mica" as const } : {}),
  };
}

export function createAtlasAuthPopupOptions(parentWindow: BrowserWindow): BrowserWindowConstructorOptions {
  return {
    width: 540,
    height: 720,
    parent: parentWindow,
    modal: true,
    autoHideMenuBar: true,
    backgroundColor: "#0a0f14",
    title: "ATLAS authentication",
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/g, "");
}

export function isContainedAuthUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    return pathname.includes("login")
      || pathname.includes("auth")
      || pathname.includes("oauth")
      || search.includes("redirect_uri=")
      || search.includes("client_id=");
  } catch {
    return false;
  }
}

export function decideAtlasPopupHandling(url: string, atlasOrigin: string): AtlasPopupDecision {
  try {
    const parsed = new URL(url);
    const normalizedAtlasOrigin = normalizeOrigin(atlasOrigin);
    if (normalizeOrigin(parsed.origin) === normalizedAtlasOrigin) {
      return {
        action: "allow-same-origin",
        reason: "same-origin",
      };
    }
  } catch {
    return {
      action: "deny",
      reason: "invalid-url",
    };
  }

  if (isContainedAuthUrl(url)) {
    return {
      action: "open-modal-auth",
      reason: "contained-auth",
    };
  }

  return {
    action: "deny",
    reason: "external-origin-blocked",
  };
}
