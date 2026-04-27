import fs from "node:fs/promises";
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";

import { loadConfig } from "../src/config.js";
import {
  AtlasClarificationError,
  createAtlasSessionStartPacket,
  getAtlasClarificationAttachmentDirectory,
  type AtlasClarificationPacket,
} from "../src/atlas/clarification.js";
import {
  buildAtlasDesktopLocationPath,
  createAtlasDesktopSessionStartHandoffState,
  createDefaultAtlasDesktopState,
  parseAtlasDesktopLocationFromUrl,
  readAtlasDesktopState,
  resolveAtlasDesktopStatePath,
  resolveAtlasDesktopStateRoot,
  type AtlasDesktopAttachment,
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
  await assertDesktopResourcePath(atlasDesktopResources.rendererHtmlPath, "desktop renderer shell");
  await assertDesktopResourcePath(atlasDesktopResources.rendererScriptPath, "desktop renderer bootstrap");
  await assertDesktopResourcePath(atlasDesktopResources.rendererLayoutPath, "desktop renderer layout helper");
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
  patch: Partial<Pick<AtlasDesktopState, "sessionId" | "workspaceDraft" | "workspaceAttachments" | "workspaceComposerFocused" | "windowBounds" | "focusedSessionRole">>,
): Promise<void> {
  if (!atlasDesktopStatePath) {
    throw new Error("ATLAS desktop state path is not initialized.");
  }

  atlasDesktopState = await writeAtlasDesktopState(atlasDesktopStatePath, {
    ...(atlasDesktopState || createDefaultAtlasDesktopState()),
    ...patch,
  });
}

async function updateWorkspaceDraft(draft: string): Promise<void> {
  const normalizedDraft = String(draft || "");
  await updateDesktopState({ workspaceDraft: normalizedDraft });
  if (atlasBootstrap) {
    atlasBootstrap = {
      ...atlasBootstrap,
      workspaceDraft: normalizedDraft,
    };
  }
}

async function updateWorkspaceComposerFocus(focused: boolean): Promise<void> {
  await updateDesktopState({ workspaceComposerFocused: focused === true });
}

async function updateWorkspaceAttachments(attachments: AtlasDesktopAttachment[]): Promise<AtlasDesktopAttachment[]> {
  await updateDesktopState({ workspaceAttachments: attachments });
  return atlasDesktopState?.workspaceAttachments || attachments;
}

async function completeWorkspaceSessionStart(objective: string): Promise<void> {
  await updateDesktopState(createAtlasDesktopSessionStartHandoffState(objective));
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeAttachmentFileName(value: string): string {
  const normalized = String(value || "").trim().replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-");
  return normalized || "attachment";
}

async function resolveUniqueAttachmentPath(directoryPath: string, fileName: string): Promise<string> {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension) || "attachment";
  let candidatePath = path.join(directoryPath, fileName);
  let suffix = 1;
  while (await pathExists(candidatePath)) {
    candidatePath = path.join(directoryPath, `${baseName}-${String(suffix)}${extension}`);
    suffix += 1;
  }
  return candidatePath;
}

async function pickWorkspaceAttachments(requestWindow: BrowserWindow | null): Promise<AtlasDesktopAttachment[]> {
  if (!atlasBootstrap) {
    throw new Error("ATLAS desktop bootstrap is not available.");
  }

  const hostWindow = requestWindow && !requestWindow.isDestroyed()
    ? requestWindow
    : mainWindow;
  if (!hostWindow || hostWindow.isDestroyed()) {
    throw new Error("ATLAS desktop attachment picker requires an active window.");
  }

  const fileSelection = await dialog.showOpenDialog(hostWindow, {
    title: "Add files to the next Atlas session",
    buttonLabel: "Attach files",
    properties: ["openFile", "multiSelections"],
  });
  if (fileSelection.canceled || fileSelection.filePaths.length === 0) {
    return atlasDesktopState?.workspaceAttachments || [];
  }

  const config = await loadConfig();
  const stateDir = String(config.paths?.stateDir || "state");
  const attachmentDirectory = getAtlasClarificationAttachmentDirectory(stateDir, atlasBootstrap.sessionId);
  await fs.mkdir(attachmentDirectory, { recursive: true });

  const existingAttachments = atlasDesktopState?.workspaceAttachments || [];
  const existingSourcePaths = new Set(existingAttachments.map((attachment) => path.normalize(attachment.sourcePath).toLowerCase()));
  const nextAttachments = [...existingAttachments];

  for (const sourcePath of fileSelection.filePaths) {
    const normalizedSourcePath = path.normalize(String(sourcePath || "").trim());
    if (!normalizedSourcePath || existingSourcePaths.has(normalizedSourcePath.toLowerCase())) {
      continue;
    }

    const stats = await fs.stat(normalizedSourcePath);
    if (!stats.isFile()) {
      continue;
    }

    const safeFileName = sanitizeAttachmentFileName(path.basename(normalizedSourcePath));
    const storedPath = await resolveUniqueAttachmentPath(attachmentDirectory, safeFileName);
    await fs.copyFile(normalizedSourcePath, storedPath);
    nextAttachments.push({
      id: randomUUID(),
      name: path.basename(storedPath),
      sourcePath: normalizedSourcePath,
      storedPath,
      sizeBytes: stats.size,
      addedAt: new Date().toISOString(),
    });
    existingSourcePaths.add(normalizedSourcePath.toLowerCase());
  }

  return updateWorkspaceAttachments(nextAttachments);
}

async function removeWorkspaceAttachment(attachmentId: string): Promise<AtlasDesktopAttachment[]> {
  const normalizedAttachmentId = String(attachmentId || "").trim();
  const existingAttachments = atlasDesktopState?.workspaceAttachments || [];
  if (!normalizedAttachmentId) {
    return existingAttachments;
  }

  const attachmentToRemove = existingAttachments.find((attachment) => attachment.id === normalizedAttachmentId) || null;
  if (attachmentToRemove?.storedPath) {
    try {
      await fs.rm(attachmentToRemove.storedPath, { force: true });
    } catch (error) {
      console.error(`[atlas] failed to remove the stored attachment ${attachmentToRemove.storedPath}: ${String((error as Error)?.message || error)}`);
    }
  }

  return updateWorkspaceAttachments(existingAttachments.filter((attachment) => attachment.id !== normalizedAttachmentId));
}

function getPersistedWindowBounds(): AtlasDesktopWindowBounds | null {
  return atlasDesktopState?.windowBounds || null;
}

function getPersistedProductLocation(): AtlasDesktopLocation {
  return {
    surface: "workspace",
    focusedSessionRole: atlasDesktopState?.focusedSessionRole || null,
  };
}

async function persistProductLocation(currentUrl: string): Promise<void> {
  const location = parseAtlasDesktopLocationFromUrl(currentUrl);
  if (!location) {
    return;
  }

  await updateDesktopState({
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
    workspaceDraft: atlasDesktopState?.workspaceDraft || "",
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

function notifyRendererWindowVisible(window: BrowserWindow): void {
  try {
    if (window.isDestroyed()) {
      return;
    }
    window.webContents.send("atlas-desktop:window-visible");
  } catch (error) {
    console.error(`[atlas] failed to notify the renderer about desktop visibility: ${String((error as Error)?.message || error)}`);
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

async function startDesktopSession(
  objective: string,
  requestWindow: BrowserWindow | null,
): Promise<AtlasDesktopClarificationResult> {
  try {
    if (!atlasBootstrap) {
      throw new Error("ATLAS desktop bootstrap is not available.");
    }

    const normalizedObjective = String(objective || "").trim();
    await updateWorkspaceDraft(normalizedObjective);

    const config = await loadConfig();
    const stateDir = String(config.paths?.stateDir || "state");
    const packet = await createAtlasSessionStartPacket({
      stateDir,
      sessionId: atlasBootstrap.sessionId,
      targetRepo: atlasBootstrap.targetRepo,
      objective: normalizedObjective,
      attachments: atlasDesktopState?.workspaceAttachments || [],
    });

    await completeWorkspaceSessionStart(normalizedObjective);
    if (requestWindow && !requestWindow.isDestroyed()) {
      await loadInitialSurface(requestWindow);
    }

    return {
      ok: true,
      ready: true,
      packet,
    };
  } catch (error) {
    console.error(`[atlas] desktop session start failed: ${String((error as Error)?.message || error)}`);
    const clarificationError = error instanceof AtlasClarificationError
      ? error
      : new AtlasClarificationError(
        String((error as Error)?.message || error),
        500,
        "workspace_session_brief_failed",
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
    icon: atlasDesktopResources.appIconPath,
    webPreferences: {
      preload: atlasDesktopResources.preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });
  window.removeMenu();

  window.once("ready-to-show", () => {
    if (!window.isDestroyed()) {
      window.show();
      notifyRendererWindowVisible(window);
    }
  });
  attachWindowStatePersistence(window);
  attachProductLocationPersistence(window);
  attachWindowPolicies(window, atlasBootstrap.serverUrl);
  window.on("show", () => {
    notifyRendererWindowVisible(window);
  });
  window.on("restore", () => {
    notifyRendererWindowVisible(window);
  });
  window.on("focus", () => {
    notifyRendererWindowVisible(window);
  });
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
  ipcMain.handle("atlas-desktop:get-workspace-state", async () => {
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
  ipcMain.handle("atlas-desktop:set-workspace-draft", async (_event, payload: { draft?: string } = {}) => {
    try {
      await updateWorkspaceDraft(String(payload.draft || ""));
      return { ok: true };
    } catch (error) {
      console.error(`[atlas] workspace draft update failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:set-workspace-composer-focus", async (_event, payload: { focused?: boolean } = {}) => {
    try {
      await updateWorkspaceComposerFocus(payload.focused === true);
      return { ok: true };
    } catch (error) {
      console.error(`[atlas] workspace composer focus update failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:pick-workspace-attachments", async (event) => {
    try {
      const requestWindow = BrowserWindow.fromWebContents(event.sender);
      const attachments = await pickWorkspaceAttachments(requestWindow);
      return { ok: true, attachments };
    } catch (error) {
      console.error(`[atlas] workspace attachment picker failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:remove-workspace-attachment", async (_event, payload: { attachmentId?: string } = {}) => {
    try {
      const attachments = await removeWorkspaceAttachment(String(payload.attachmentId || ""));
      return { ok: true, attachments };
    } catch (error) {
      console.error(`[atlas] workspace attachment removal failed: ${String((error as Error)?.message || error)}`);
      throw error;
    }
  });
  ipcMain.handle("atlas-desktop:start-session", async (event, payload: { objective?: string } = {}) => {
    try {
      const requestWindow = BrowserWindow.fromWebContents(event.sender);
      return await startDesktopSession(String(payload.objective || ""), requestWindow);
    } catch (error) {
      console.error(`[atlas] desktop start session IPC failed: ${String((error as Error)?.message || error)}`);
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
