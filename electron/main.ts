import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { app, BrowserWindow, ipcMain } from "electron";

import { loadConfig } from "../src/config.js";
import {
  createAtlasClarificationPacket,
  readAtlasClarificationStatus,
} from "../src/atlas/clarification.js";
import { startAtlasServer } from "../src/atlas/server.js";
import { decideAtlasPopupHandling, isContainedAuthUrl } from "./window_policy.js";

interface AtlasDesktopBootstrap {
  sessionId: string;
  serverUrl: string;
  targetRepo: string;
}

interface AtlasDesktopRuntime {
  server: http.Server;
  serverUrl: string;
}

let atlasRuntime: AtlasDesktopRuntime | null = null;
let atlasBootstrap: AtlasDesktopBootstrap | null = null;
let mainWindow: BrowserWindow | null = null;

function resolvePreloadPath(): string {
  return path.join(process.cwd(), ".electron-build", "electron", "preload.js");
}

function resolveOnboardingHtmlPath(): string {
  return path.join(process.cwd(), "electron", "renderer", "index.html");
}

async function startDesktopRuntime(): Promise<AtlasDesktopRuntime> {
  const config = await loadConfig();
  const sessionId = randomUUID();
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
  };
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

  await window.loadFile(resolveOnboardingHtmlPath());
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

  const window = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 980,
    minHeight: 680,
    autoHideMenuBar: true,
    backgroundColor: "#0a1017",
    title: "ATLAS Desktop",
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  attachWindowPolicies(window, atlasBootstrap.serverUrl);
  await loadInitialSurface(window);
  return window;
}

async function bootstrapDesktopApp(): Promise<void> {
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

  ipcMain.handle("atlas-desktop:submit-clarification", async (_event, payload: { objective?: string }) => {
    if (!atlasBootstrap || !mainWindow) {
      return { ok: false, error: "ATLAS desktop window is not ready." };
    }

    try {
      const config = await loadConfig();
      const packet = await createAtlasClarificationPacket({
        stateDir: String(config.paths?.stateDir || "state"),
        sessionId: atlasBootstrap.sessionId,
        targetRepo: atlasBootstrap.targetRepo,
        objective: String(payload?.objective || "").trim(),
      });
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
  if (!atlasRuntime?.server.listening) return;
  await new Promise<void>((resolve) => {
    atlasRuntime?.server.close(() => resolve());
  });
});
