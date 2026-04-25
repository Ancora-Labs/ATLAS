import fs from "node:fs/promises";
import http from "node:http";
import { randomUUID } from "node:crypto";

import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";

import { loadConfig } from "../src/config.js";
import {
  AtlasClarificationError,
  createAtlasClarificationPacket,
  type AtlasClarificationPacket,
} from "../src/atlas/clarification.js";
import {
  buildAtlasDesktopLocationPath,
  createAtlasDesktopClarificationHandoffState,
  createDefaultAtlasDesktopState,
  parseAtlasDesktopLocationFromUrl,
  readAtlasDesktopState,
  resolveAtlasDesktopStatePath,
  resolveAtlasDesktopStateRoot,
  type AtlasDesktopBootstrap,
  type AtlasDesktopLocation,
  type AtlasDesktopState,
  type AtlasDesktopWindowBounds,
  writeAtlasDesktopState,
} from "../src/atlas/desktop_state.js";
import {
  ATLAS_SNAPSHOT_PATH,
  type AtlasSnapshotRequestPayload,
  type AtlasSnapshotResponse,
  ATLAS_SNAPSHOT_TOKEN_HEADER,
} from "../src/atlas/routes/home.js";
import { startAtlasServer } from "../src/atlas/server.js";
import {
  resolveAtlasDesktopResourcePaths,
  resolveAtlasDesktopShellCommand,
  resolvePackagedWorkingDirectory,
} from "./resource_paths.js";
import {
  ATLAS_WINDOWS_APP_ID,
  restoreAndFocusAtlasWindow,
} from "./single_instance.js";
import {
  createAtlasAuthPopupOptions,
  createAtlasDesktopWindowChromeOptions,
  decideAtlasPopupHandling,
  isContainedAuthUrl,
} from "./window_policy.js";

interface AtlasDesktopRuntime {
  server: http.Server;
  serverUrl: string;
}

interface AtlasDesktopClarificationSuccess {
  ok: true;
  ready: true;
  packet: AtlasClarificationPacket;
}

interface AtlasDesktopClarificationFailure {
  ok: false;
  error: string;
  code: string;
}

type AtlasDesktopClarificationResult = AtlasDesktopClarificationSuccess | AtlasDesktopClarificationFailure;

let atlasRuntime: AtlasDesktopRuntime | null = null;
let atlasBootstrap: AtlasDesktopBootstrap | null = null;
let mainWindow: BrowserWindow | null = null;
let atlasDesktopState: AtlasDesktopState | null = null;
let atlasDesktopStatePath = "";
const atlasDesktopSnapshotToken = randomUUID();
const atlasDesktopResources = resolveAtlasDesktopResourcePaths({
  mainModuleUrl: import.meta.url,
  isPackaged: app.isPackaged,
  exePath: app.getPath("exe"),
});
const atlasDesktopShellCommand = resolveAtlasDesktopShellCommand({
  isPackaged: app.isPackaged,
  exePath: app.getPath("exe"),
});
const atlasOwnsSingleInstanceLock = wireSingleInstanceLifecycle();

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
  await assertDesktopResourcePath(atlasDesktopResources.onboardingScriptPath, "onboarding renderer");
  await assertDesktopResourcePath(atlasDesktopResources.onboardingLayoutPath, "onboarding layout helper");
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
  patch: Partial<Pick<AtlasDesktopState, "sessionId" | "onboardingDraft" | "productDraft" | "productComposerFocused" | "windowBounds" | "lastProductSurface" | "focusedSessionRole">>,
): Promise<void> {
  if (!atlasDesktopStatePath) {
    throw new Error("ATLAS desktop state path is not initialized.");
  }

  atlasDesktopState = await writeAtlasDesktopState(atlasDesktopStatePath, {
    ...(atlasDesktopState || createDefaultAtlasDesktopState()),
    ...patch,
  });
}

async function updateOnboardingDraft(draft: string): Promise<void> {
  const normalizedDraft = String(draft || "");
  await updateDesktopState({ onboardingDraft: normalizedDraft });
  if (atlasBootstrap) {
    atlasBootstrap = {
      ...atlasBootstrap,
      onboardingDraft: normalizedDraft,
    };
  }
}

async function updateProductDraft(draft: string): Promise<void> {
  await updateDesktopState({ productDraft: String(draft || "") });
}

async function updateProductComposerFocus(focused: boolean): Promise<void> {
  await updateDesktopState({ productComposerFocused: focused === true });
}

async function completeClarificationHandoff(objective: string): Promise<void> {
  await updateDesktopState(createAtlasDesktopClarificationHandoffState(objective));
  if (atlasBootstrap) {
    atlasBootstrap = {
      ...atlasBootstrap,
      onboardingDraft: "",
    };
  }
}

function getPersistedWindowBounds(): AtlasDesktopWindowBounds | null {
  return atlasDesktopState?.windowBounds || null;
}

function getPersistedProductLocation(): AtlasDesktopLocation {
  return {
    surface: atlasDesktopState?.lastProductSurface || "home",
    focusedSessionRole: atlasDesktopState?.focusedSessionRole || null,
  };
}

async function persistProductLocation(currentUrl: string): Promise<void> {
  const location = parseAtlasDesktopLocationFromUrl(currentUrl);
  if (!location) {
    return;
  }

  await updateDesktopState({
    lastProductSurface: location.surface,
    focusedSessionRole: location.focusedSessionRole,
  });
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

function attachProductLocationPersistence(window: BrowserWindow): void {
  const persistCurrentUrl = (currentUrl: string) => {
    persistProductLocation(currentUrl).catch((error) => {
      console.error(`[atlas] failed to persist product location: ${String((error as Error)?.message || error)}`);
    });
  };

  window.webContents.on("did-navigate", (_event, currentUrl) => {
    persistCurrentUrl(currentUrl);
  });
  window.webContents.on("did-navigate-in-page", (_event, currentUrl) => {
    persistCurrentUrl(currentUrl);
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
    shellCommand: atlasDesktopShellCommand,
    desktopSessionId: sessionId,
    desktopSnapshotToken: atlasDesktopSnapshotToken,
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

  await window.loadURL(new URL(buildAtlasDesktopLocationPath(getPersistedProductLocation()), atlasBootstrap.serverUrl).toString());
}

function assertTrustedAtlasSnapshotSender(event: IpcMainInvokeEvent): void {
  if (!atlasBootstrap) {
    throw new Error("ATLAS desktop bootstrap is not available.");
  }

  const requestWindow = BrowserWindow.fromWebContents(event.sender);
  if (!requestWindow || requestWindow !== mainWindow) {
    throw new Error("ATLAS desktop snapshot bridge rejected an untrusted window.");
  }

  const senderUrl = String(event.sender.getURL() || "").trim();
  if (!senderUrl) {
    throw new Error("ATLAS desktop snapshot bridge requires a loaded ATLAS surface.");
  }

  const senderOrigin = new URL(senderUrl).origin;
  const atlasOrigin = new URL(atlasBootstrap.serverUrl).origin;
  if (senderOrigin !== atlasOrigin) {
    throw new Error("ATLAS desktop snapshot bridge rejected a non-ATLAS origin.");
  }
}

function buildAtlasSnapshotUrl(request: AtlasSnapshotRequestPayload = {}): URL {
  if (!atlasBootstrap) {
    throw new Error("ATLAS desktop bootstrap is not available.");
  }

  const snapshotUrl = new URL(ATLAS_SNAPSHOT_PATH, atlasBootstrap.serverUrl);
  snapshotUrl.searchParams.set("view", request.view === "sessions" ? "sessions" : "home");
  const focusRole = String(request.focusRole || "").trim();
  if (focusRole) {
    snapshotUrl.searchParams.set("focusRole", focusRole);
  }
  return snapshotUrl;
}

async function fetchAtlasDesktopSnapshot(
  request: AtlasSnapshotRequestPayload = {},
): Promise<AtlasSnapshotResponse> {
  const snapshotUrl = buildAtlasSnapshotUrl(request);

  try {
    const response = await fetch(snapshotUrl, {
      headers: {
        accept: "application/json",
        [ATLAS_SNAPSHOT_TOKEN_HEADER]: atlasDesktopSnapshotToken,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`ATLAS snapshot request failed with status ${response.status}.`);
    }

    const payload = await response.json() as Partial<AtlasSnapshotResponse> & { ok?: boolean; };
    if (payload.ok !== true || !payload.pageData || typeof payload.snapshotAt !== "string") {
      throw new Error("ATLAS snapshot response was not valid JSON state.");
    }
    return payload as AtlasSnapshotResponse;
  } catch (error) {
    console.error(`[atlas] desktop snapshot refresh failed: ${String((error as Error)?.message || error)}`);
    throw error;
  }
}

function createAuthPopup(parentWindow: BrowserWindow, targetUrl: string): void {
  const popup = new BrowserWindow(createAtlasAuthPopupOptions(parentWindow));
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

async function submitDesktopClarification(
  objective: string,
  requestWindow: BrowserWindow | null,
): Promise<AtlasDesktopClarificationResult> {
  try {
    if (!atlasBootstrap) {
      throw new Error("ATLAS desktop bootstrap is not available.");
    }

    const normalizedObjective = String(objective || "").trim();
    await updateOnboardingDraft(normalizedObjective);
    await updateProductDraft(normalizedObjective);

    const config = await loadConfig();
    const stateDir = String(config.paths?.stateDir || "state");
    const packet = await createAtlasClarificationPacket({
      stateDir,
      sessionId: atlasBootstrap.sessionId,
      targetRepo: atlasBootstrap.targetRepo,
      objective: normalizedObjective,
      command: String(config.copilotCliCommand || "").trim(),
    });

    await completeClarificationHandoff(normalizedObjective);
    if (requestWindow && !requestWindow.isDestroyed()) {
      await loadInitialSurface(requestWindow);
    }

    return {
      ok: true,
      ready: true,
      packet,
    };
  } catch (error) {
    console.error(`[atlas] desktop clarification submit failed: ${String((error as Error)?.message || error)}`);
    const clarificationError = error instanceof AtlasClarificationError
      ? error
      : new AtlasClarificationError(
        String((error as Error)?.message || error),
        500,
        "onboarding_failed",
      );
    return {
      ok: false,
      error: clarificationError.message,
      code: clarificationError.code,
    };
  }
}

async function createMainWindow(): Promise<BrowserWindow> {
  if (!atlasBootstrap) {
    throw new Error("ATLAS desktop bootstrap is not ready.");
  }

  const persistedBounds = getPersistedWindowBounds();
  const window = new BrowserWindow({
    ...createAtlasDesktopWindowChromeOptions(persistedBounds),
    webPreferences: {
      preload: atlasDesktopResources.preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  window.once("ready-to-show", () => {
    if (!window.isDestroyed()) {
      window.show();
    }
  });
  attachWindowStatePersistence(window);
  attachProductLocationPersistence(window);
  attachWindowPolicies(window, atlasBootstrap.serverUrl);
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  await loadInitialSurface(window);
  return window;
}

function wireSingleInstanceLifecycle(): boolean {
  const hasLock = app.requestSingleInstanceLock();
  if (!hasLock) {
    app.quit();
    return false;
  }

  app.on("second-instance", () => {
    if (restoreAndFocusAtlasWindow(mainWindow)) {
      return;
    }
    if (!app.isReady()) {
      return;
    }
    createMainWindow().then((window) => {
      mainWindow = window;
    }).catch((error) => {
      console.error(`[atlas] failed to restore the desktop window after a repeat launch: ${String((error as Error)?.message || error)}`);
    });
  });

  return true;
}

async function bootstrapDesktopApp(): Promise<void> {
  alignPackagedWorkingDirectory();
  await validateDesktopResources();

  await initializeDesktopState();
  atlasRuntime = await startDesktopRuntime();
  mainWindow = await createMainWindow();
}

app.whenReady().then(() => {
  if (!atlasOwnsSingleInstanceLock) {
    return Promise.resolve();
  }

  if (process.platform === "win32") {
    app.setAppUserModelId(ATLAS_WINDOWS_APP_ID);
  }

  ipcMain.handle("atlas-desktop:get-bootstrap", async () => {
    if (!atlasBootstrap) {
      throw new Error("ATLAS desktop bootstrap is not available.");
    }
    return atlasBootstrap;
  });
  ipcMain.handle("atlas-desktop:get-desktop-state", async () => {
    return atlasDesktopState || createDefaultAtlasDesktopState();
  });
  ipcMain.handle("atlas-desktop:get-snapshot", async (event, payload: AtlasSnapshotRequestPayload = {}) => {
    try {
      assertTrustedAtlasSnapshotSender(event);
      return await fetchAtlasDesktopSnapshot(payload);
    } catch (error) {
      console.error(`[atlas] desktop snapshot IPC failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:refresh-snapshot", async (event, payload: AtlasSnapshotRequestPayload = {}) => {
    try {
      assertTrustedAtlasSnapshotSender(event);
      return await fetchAtlasDesktopSnapshot(payload);
    } catch (error) {
      console.error(`[atlas] desktop snapshot refresh IPC failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:set-onboarding-draft", async (_event, payload: { draft?: string } = {}) => {
    try {
      await updateOnboardingDraft(String(payload.draft || ""));
      return { ok: true };
    } catch (error) {
      console.error(`[atlas] onboarding draft update failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:set-product-draft", async (_event, payload: { draft?: string } = {}) => {
    try {
      await updateProductDraft(String(payload.draft || ""));
      return { ok: true };
    } catch (error) {
      console.error(`[atlas] product draft update failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:set-product-composer-focus", async (_event, payload: { focused?: boolean } = {}) => {
    try {
      await updateProductComposerFocus(payload.focused === true);
      return { ok: true };
    } catch (error) {
      console.error(`[atlas] product composer focus update failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:submit-clarification", async (event, payload: { objective?: string } = {}) => {
    try {
      const requestWindow = BrowserWindow.fromWebContents(event.sender);
      return await submitDesktopClarification(String(payload.objective || ""), requestWindow);
    } catch (error) {
      console.error(`[atlas] onboarding IPC submit failed: ${String((error as Error)?.message || error)}`);
      throw error;
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
