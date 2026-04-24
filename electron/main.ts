import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { app, BrowserWindow, ipcMain } from "electron";

import { loadConfig } from "../src/config.js";
import {
  createAtlasClarificationPacket,
  readAtlasClarificationStatus,
} from "../src/atlas/clarification.js";
import {
  readAtlasDesktopState,
  resolveAtlasDesktopStatePath,
  resolveAtlasDesktopStateRoot,
  type AtlasDesktopBootstrap,
  type AtlasDesktopState,
  type AtlasDesktopWindowBounds,
  writeAtlasDesktopState,
} from "../src/atlas/desktop_state.js";
import { startAtlasServer } from "../src/atlas/server.js";
import {
  resolveAtlasDesktopResourcePaths,
  resolvePackagedWorkingDirectory,
} from "./resource_paths.js";
import { decideAtlasPopupHandling, isContainedAuthUrl } from "./window_policy.js";

interface AtlasDesktopRuntime {
  server: http.Server;
  serverUrl: string;
}

let atlasRuntime: AtlasDesktopRuntime | null = null;
let atlasBootstrap: AtlasDesktopBootstrap | null = null;
let mainWindow: BrowserWindow | null = null;
let atlasDesktopState: AtlasDesktopState | null = null;
let atlasDesktopStatePath = "";
const atlasDesktopResources = resolveAtlasDesktopResourcePaths(import.meta.url);

async function assertDesktopResourcePath(resourcePath: string, label: string): Promise<void> {
  try {
    await fs.access(resourcePath);
  } catch (error) {
    throw new Error(
      `[atlas] desktop ${label} was not found at ${resourcePath}: ${String((error as Error)?.message || error)}`,
    );
  }
}

async function validateDesktopResources(): Promise<void> {
  await assertDesktopResourcePath(atlasDesktopResources.preloadPath, "preload script");
  await assertDesktopResourcePath(atlasDesktopResources.onboardingHtmlPath, "onboarding shell");
}

function alignPackagedWorkingDirectory(): void {
  if (!app.isPackaged) {
    return;
  }

  const workingDirectory = resolvePackagedWorkingDirectory(app.getPath("exe"));
  try {
    process.chdir(workingDirectory);
  } catch (error) {
    throw new Error(
      `[atlas] failed to align the packaged working directory to ${workingDirectory}: ${String((error as Error)?.message || error)}`,
    );
  }
}

async function initializeDesktopState(): Promise<void> {
  atlasDesktopStatePath = resolveAtlasDesktopStatePath(resolveAtlasDesktopStateRoot({
    isPackaged: app.isPackaged,
    exePath: app.getPath("exe"),
    cwd: process.cwd(),
  }));
  atlasDesktopState = await readAtlasDesktopState(atlasDesktopStatePath);
}

async function updateDesktopState(
  patch: Partial<Pick<AtlasDesktopState, "sessionId" | "onboardingDraft" | "windowBounds">>,
): Promise<void> {
  if (!atlasDesktopStatePath) {
    throw new Error("ATLAS desktop state path is not initialized.");
  }

  atlasDesktopState = await writeAtlasDesktopState(atlasDesktopStatePath, {
    ...(atlasDesktopState || {
      sessionId: null,
      onboardingDraft: "",
      windowBounds: null,
      updatedAt: null,
    }),
    ...patch,
  });
}

function getPersistedWindowBounds(): AtlasDesktopWindowBounds | null {
  return atlasDesktopState?.windowBounds || null;
}

async function persistWindowBounds(window: BrowserWindow): Promise<void> {
  if (window.isDestroyed() || window.isMinimized()) {
    return;
  }

  const bounds = window.getNormalBounds();
  await updateDesktopState({
    windowBounds: {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
    },
  });
}

function attachWindowStatePersistence(window: BrowserWindow): void {
  let persistTimer: NodeJS.Timeout | null = null;
  const queuePersist = () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistWindowBounds(window).catch((error) => {
        console.error(`[atlas] failed to persist window bounds: ${String((error as Error)?.message || error)}`);
      });
    }, 180);
  };
  const flushPersist = () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    persistWindowBounds(window).catch((error) => {
      console.error(`[atlas] failed to persist window bounds: ${String((error as Error)?.message || error)}`);
    });
  };

  window.on("move", queuePersist);
  window.on("resize", queuePersist);
  window.on("close", flushPersist);
  window.on("closed", () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
  });
}

async function startDesktopRuntime(): Promise<AtlasDesktopRuntime> {
  const config = await loadConfig();
  const sessionId = atlasDesktopState?.sessionId || randomUUID();
  const targetRepo = String(config.targetRepo || process.env.TARGET_REPO || "").trim();
  const stateDir = String(config.paths?.stateDir || "state");

  const server = await startAtlasServer({
    port: 0,
    stateDir,
    targetRepo,
    hostLabel: "ATLAS Desktop",
    shellCommand: ".\\ATLAS.cmd",
    desktopSessionId: sessionId,
  });
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : 0;
  const serverUrl = `http://127.0.0.1:${String(port)}`;
  atlasBootstrap = {
    sessionId,
    serverUrl,
    targetRepo,
    onboardingDraft: atlasDesktopState?.onboardingDraft || "",
  };
  await updateDesktopState({ sessionId });
  return {
    server,
    serverUrl,
  };
}

async function loadInitialSurface(window: BrowserWindow): Promise<void> {
  if (!atlasRuntime || !atlasBootstrap) {
    throw new Error("ATLAS desktop runtime is not initialized.");
  }

  const config = await loadConfig();
  const stateDir = String(config.paths?.stateDir || "state");
  const status = await readAtlasClarificationStatus(stateDir, atlasBootstrap.sessionId);
  if (status.ready) {
    await window.loadURL(new URL("/", atlasBootstrap.serverUrl).toString());
    return;
  }

  await window.loadFile(atlasDesktopResources.onboardingHtmlPath);
}

function createAuthPopup(parentWindow: BrowserWindow, targetUrl: string): void {
  const popup = new BrowserWindow({
    width: 540,
    height: 720,
    parent: parentWindow,
    modal: true,
    autoHideMenuBar: true,
    title: "ATLAS authentication",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  popup.loadURL(targetUrl).catch((error) => {
    console.error(`[atlas] auth popup load failed: ${String((error as Error)?.message || error)}`);
  });
}

function attachWindowPolicies(window: BrowserWindow, atlasOrigin: string): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideAtlasPopupHandling(url, atlasOrigin);
    if (decision.action === "open-modal-auth") {
      setImmediate(() => createAuthPopup(window, url));
      return { action: "deny" };
    }
    if (decision.action === "allow-same-origin") {
      return { action: "allow" };
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const currentUrl = window.webContents.getURL();
    const currentProtocol = currentUrl ? new URL(currentUrl).protocol : "file:";
    if (currentProtocol === "file:" && url.startsWith("file:")) {
      return;
    }

    const decision = decideAtlasPopupHandling(url, atlasOrigin);
    if (decision.action === "allow-same-origin") {
      return;
    }
    if (decision.action === "open-modal-auth" && isContainedAuthUrl(url)) {
      event.preventDefault();
      createAuthPopup(window, url);
      return;
    }
    event.preventDefault();
  });
}

async function createMainWindow(): Promise<BrowserWindow> {
  if (!atlasBootstrap) {
    throw new Error("ATLAS desktop bootstrap is not ready.");
  }

  const persistedBounds = getPersistedWindowBounds();
  const window = new BrowserWindow({
    width: persistedBounds?.width || 1440,
    height: persistedBounds?.height || 980,
    ...(persistedBounds && typeof persistedBounds.x === "number" ? { x: persistedBounds.x } : {}),
    ...(persistedBounds && typeof persistedBounds.y === "number" ? { y: persistedBounds.y } : {}),
    minWidth: 980,
    minHeight: 680,
    autoHideMenuBar: true,
    backgroundColor: "#0a1017",
    title: "ATLAS Desktop",
    webPreferences: {
      preload: atlasDesktopResources.preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  attachWindowStatePersistence(window);
  attachWindowPolicies(window, atlasBootstrap.serverUrl);
  await loadInitialSurface(window);
  return window;
}

async function bootstrapDesktopApp(): Promise<void> {
  alignPackagedWorkingDirectory();
  await validateDesktopResources();

  await initializeDesktopState();
  atlasRuntime = await startDesktopRuntime();
  mainWindow = await createMainWindow();
}

app.whenReady().then(() => {
  ipcMain.handle("atlas-desktop:get-bootstrap", async () => {
    if (!atlasBootstrap) {
      throw new Error("ATLAS desktop bootstrap is not available.");
    }
    return atlasBootstrap;
  });

  ipcMain.handle("atlas-desktop:save-onboarding-draft", async (_event, payload: { objective?: string }) => {
    try {
      await updateDesktopState({
        onboardingDraft: typeof payload?.objective === "string" ? payload.objective : "",
      });
      if (atlasBootstrap) {
        atlasBootstrap = {
          ...atlasBootstrap,
          onboardingDraft: atlasDesktopState?.onboardingDraft || "",
        };
      }
      return { ok: true };
    } catch (error) {
      console.error(`[atlas] failed to persist onboarding draft: ${String((error as Error)?.message || error)}`);
      return {
        ok: false,
        error: String((error as Error)?.message || error),
      };
    }
  });

  ipcMain.handle("atlas-desktop:submit-clarification", async (_event, payload: { objective?: string }) => {
    if (!atlasBootstrap || !mainWindow) {
      return { ok: false, error: "ATLAS desktop window is not ready." };
    }

    try {
      const objective = typeof payload?.objective === "string" ? payload.objective : "";
      await updateDesktopState({
        sessionId: atlasBootstrap.sessionId,
        onboardingDraft: objective,
      });
      const config = await loadConfig();
      const packet = await createAtlasClarificationPacket({
        stateDir: String(config.paths?.stateDir || "state"),
        sessionId: atlasBootstrap.sessionId,
        targetRepo: atlasBootstrap.targetRepo,
        objective: objective.trim(),
      });
      await updateDesktopState({ onboardingDraft: "" });
      atlasBootstrap = {
        ...atlasBootstrap,
        onboardingDraft: "",
      };
      await mainWindow.loadURL(new URL("/", atlasBootstrap.serverUrl).toString());
      return { ok: true, packet };
    } catch (error) {
      console.error(`[atlas] desktop onboarding failed: ${String((error as Error)?.message || error)}`);
      return {
        ok: false,
        error: String((error as Error)?.message || error),
      };
    }
  });

  return bootstrapDesktopApp();
}).catch((error) => {
  console.error(`[atlas] desktop bootstrap failed: ${String((error as Error)?.message || error)}`);
  app.exit(1);
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      await persistWindowBounds(mainWindow);
    }
    if (!atlasRuntime?.server.listening) return;
    await new Promise<void>((resolve) => {
      atlasRuntime?.server.close(() => resolve());
    });
  } catch (error) {
    console.error(`[atlas] desktop shutdown failed: ${String((error as Error)?.message || error)}`);
  }
});
