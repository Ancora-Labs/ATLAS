import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";

import { loadConfig } from "../src/config.js";
import { bootstrapEnvironment } from "../src/env_bootstrap.js";
import { applyAtlasRepoContextToEnv } from "../src/atlas/repository_context.js";
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
import { resolveAtlasRuntimeStateDir } from "../src/atlas/runtime_state_root.js";
import {
  resolveAtlasDesktopResourcePaths,
  resolvePackagedWorkingDirectory,
} from "./resource_paths.js";
import {
  ATLAS_APP_NAME,
  ATLAS_WINDOWS_APP_ID,
  ATLAS_PINNED_SHORTCUT_NAME,
  buildAtlasWindowsAppDetails,
  buildRepairedAtlasShortcutDetails,
  resolveAtlasShortcutExecutableTarget,
  restoreAndFocusAtlasWindow,
  shouldRepairAtlasShortcut,
  shouldRenameAtlasShortcut,
} from "./single_instance.js";
import { decideAtlasPopupHandling, isContainedAuthUrl } from "./window_policy.js";
import { appendBootstrapTrace } from "./bootstrap_trace.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DAEMON_STOP_GRACE_MS = 6000;

type DaemonControlConfig = {
  paths: {
    stateDir: string;
  };
  targetSessionSelector?: {
    projectId?: string | null;
    sessionId?: string | null;
  };
};

interface AtlasDesktopRuntime {
  server: http.Server;
  serverUrl: string;
}

let atlasRuntime: AtlasDesktopRuntime | null = null;
let atlasBootstrap: AtlasDesktopBootstrap | null = null;
let mainWindow: BrowserWindow | null = null;
let atlasDesktopState: AtlasDesktopState | null = null;
let atlasDesktopRoot = "";
let atlasDesktopStatePath = "";
let shutdownInFlight = false;

const atlasDesktopResources = resolveAtlasDesktopResourcePaths(import.meta.url);
const atlasOwnsSingleInstanceLock = wireSingleInstanceLifecycle();

appendBootstrapTrace("main.ts module loaded");
wireProcessTerminationLifecycle();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProcessExit(pid: number, isProcessAlive: (pid: number) => boolean): Promise<void> {
  const deadline = Date.now() + DAEMON_STOP_GRACE_MS;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await delay(100);
  }
}

async function buildDaemonControlConfigs(): Promise<DaemonControlConfig[]> {
  const candidateStateDirs = [
    atlasDesktopRoot ? path.join(atlasDesktopRoot, "state") : null,
    path.join(process.cwd(), "state"),
    path.resolve(__dirname, "..", "state"),
    path.join(path.dirname(app.getPath("exe")), "state"),
  ];
  const resolvedStateDirs: string[] = [];
  for (const dirPath of candidateStateDirs.filter((entry): entry is string => Boolean(entry))) {
    const normalizedDir = path.resolve(dirPath);
    resolvedStateDirs.push(normalizedDir);
    const runtimeStateDir = await resolveAtlasRuntimeStateDir(normalizedDir).catch(() => null);
    if (runtimeStateDir) {
      resolvedStateDirs.push(path.resolve(runtimeStateDir));
    }
  }
  const uniqueStateDirs = [...new Set(resolvedStateDirs)];
  return uniqueStateDirs.map((stateDir) => ({ paths: { stateDir } }));
}

async function stopBoxBackgroundRuntime(): Promise<void> {
  const daemonControl = await import("../src/core/daemon_control.js");
  const buildRequestState = await import("../src/atlas/build_request_state.js");
  const {
    clearStopRequest,
    readDaemonPid,
    requestDaemonStop,
    clearDaemonPid,
    listTargetSessionRunnerStates,
    isProcessAlive,
    killAllDaemonProcesses,
  } = daemonControl;
  const { readAtlasBuildRequest, writeAtlasBuildRequest } = buildRequestState;

  const markAtlasBuildStopped = async (stateDir: string): Promise<void> => {
    const buildRequest = await readAtlasBuildRequest(stateDir).catch(() => null);
    if (!buildRequest || buildRequest.triggerState === "completed" || buildRequest.triggerState === "error") {
      return;
    }
    await writeAtlasBuildRequest(stateDir, {
      ...buildRequest,
      updatedAt: new Date().toISOString(),
      triggerState: "paused",
      triggerLabel: "ATLAS stopped this build mission when the desktop app closed.",
      runnerPid: null,
    }).catch(() => {});
  };

  const stopRuntimeScope = async (config: DaemonControlConfig, pid: number, reason: string): Promise<void> => {
    if (!pid) {
      await clearDaemonPid(config).catch(() => {});
      await clearStopRequest(config).catch(() => {});
      return;
    }

    await requestDaemonStop(config, reason).catch(() => {});
    await waitForProcessExit(pid, isProcessAlive);

    if (isProcessAlive(pid)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Best effort only. killAllDaemonProcesses below handles orphan sweeps.
      }
    }

    await clearDaemonPid(config).catch(() => {});
    await clearStopRequest(config).catch(() => {});
  };

  for (const config of await buildDaemonControlConfigs()) {
    const runnerStates = await listTargetSessionRunnerStates(config).catch(() => []);
    for (const runnerState of runnerStates) {
      const runnerPid = Number(runnerState?.pid || 0);
      const scopedConfig: DaemonControlConfig = {
        ...config,
        targetSessionSelector: {
          projectId: String(runnerState?.projectId || "") || null,
          sessionId: String(runnerState?.sessionId || "") || null,
        },
      };
      await stopRuntimeScope(scopedConfig, runnerPid, "electron-window-closed");
    }

    const daemonState = await readDaemonPid(config).catch(() => null);
    const daemonPid = Number(daemonState?.pid || 0);
    await stopRuntimeScope(config, daemonPid, "electron-window-closed");
    await markAtlasBuildStopped(config.paths.stateDir);
  }

  killAllDaemonProcesses();
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyAtlasStateEntryIfMissing(sourcePath: string, targetPath: string): Promise<void> {
  if (!await pathExists(sourcePath) || await pathExists(targetPath)) {
    return;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const sourceStats = await fs.stat(sourcePath);
  if (sourceStats.isDirectory()) {
    await fs.cp(sourcePath, targetPath, { recursive: true });
    return;
  }

  await fs.copyFile(sourcePath, targetPath);
}

async function migrateLegacyPackagedAtlasState(legacyDesktopRoot: string, persistentDesktopRoot: string): Promise<void> {
  if (!app.isPackaged || legacyDesktopRoot === persistentDesktopRoot) {
    return;
  }

  const legacyAtlasStateDir = path.join(legacyDesktopRoot, "state", "atlas");
  if (!await pathExists(legacyAtlasStateDir)) {
    return;
  }

  const persistentAtlasStateDir = path.join(persistentDesktopRoot, "state", "atlas");
  for (const entryName of [
    "desktop_state.json",
    "desktop_sessions.json",
    "active_build.json",
    "github_auth.json",
    "desktop_sessions",
    "manifests",
  ]) {
    await copyAtlasStateEntryIfMissing(
      path.join(legacyAtlasStateDir, entryName),
      path.join(persistentAtlasStateDir, entryName),
    );
  }
}

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
  appendBootstrapTrace("desktop resources validated");
}

function alignPackagedWorkingDirectory(): void {
  if (!app.isPackaged) {
    return;
  }

  // Pin the packaged app root so the BOX CLI resolver can launch the bundled
  // runtime even when fs.access on the asar archive misbehaves under Electron.
  if (!process.env.BOX_PACKAGED_APP_ROOT && typeof process.resourcesPath === "string" && process.resourcesPath.trim()) {
    process.env.BOX_PACKAGED_APP_ROOT = path.join(process.resourcesPath, "app.asar");
    appendBootstrapTrace(`packaged app root pinned: ${process.env.BOX_PACKAGED_APP_ROOT}`);
  }

  const workingDirectory = resolvePackagedWorkingDirectory(app.getPath("exe"));
  try {
    process.chdir(workingDirectory);
    appendBootstrapTrace(`packaged working directory aligned: ${workingDirectory}`);
  } catch (error) {
    appendBootstrapTrace(`packaged working directory alignment failed: ${workingDirectory}`, error);
    throw new Error(
      `[atlas] failed to align the packaged working directory to ${workingDirectory}: ${String((error as Error)?.message || error)}`,
    );
  }
}

async function repairPinnedAtlasTaskbarShortcuts(): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  const taskbarPinnedDir = path.join(app.getPath("appData"), "Microsoft", "Internet Explorer", "Quick Launch", "User Pinned", "TaskBar");
  const executableCandidate = typeof process.env.PORTABLE_EXECUTABLE_FILE === "string" && process.env.PORTABLE_EXECUTABLE_FILE.trim()
    ? process.env.PORTABLE_EXECUTABLE_FILE.trim()
    : app.getPath("exe");
  const currentExecutablePath = resolveAtlasShortcutExecutableTarget(executableCandidate, app.isPackaged);
  if (!currentExecutablePath) {
    appendBootstrapTrace(`taskbar shortcut repair skipped: non-packaged or non-ATLAS executable (${executableCandidate})`);
    return;
  }

  let entries: string[];
  try {
    entries = await fs.readdir(taskbarPinnedDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(".lnk")) {
      continue;
    }

    const shortcutPath = path.join(taskbarPinnedDir, entry);
    try {
      const details = shell.readShortcutLink(shortcutPath);
      const shouldRepairDetails = shouldRepairAtlasShortcut(details, currentExecutablePath);
      const shouldRenameShortcut = shouldRenameAtlasShortcut(shortcutPath, details);
      if (!shouldRepairDetails && !shouldRenameShortcut) {
        continue;
      }
      const repairedDetails = buildRepairedAtlasShortcutDetails(details, currentExecutablePath);
      shell.writeShortcutLink(shortcutPath, "update", repairedDetails);

      if (shouldRenameShortcut) {
        const repairedShortcutPath = path.join(taskbarPinnedDir, ATLAS_PINNED_SHORTCUT_NAME);
        if (path.resolve(shortcutPath).toLowerCase() !== path.resolve(repairedShortcutPath).toLowerCase()) {
          await fs.rm(repairedShortcutPath, { force: true }).catch(() => {});
          await fs.rename(shortcutPath, repairedShortcutPath);
          appendBootstrapTrace(`taskbar shortcut renamed: ${shortcutPath} -> ${repairedShortcutPath}`);
          continue;
        }
      }

      appendBootstrapTrace(`taskbar shortcut repaired: ${shortcutPath}`);
    } catch (error) {
      appendBootstrapTrace(`taskbar shortcut repair skipped: ${shortcutPath}`, error);
    }
  }
}

async function initializeDesktopState(): Promise<void> {
  const legacyDesktopRoot = path.dirname(app.getPath("exe"));
  atlasDesktopRoot = resolveAtlasDesktopStateRoot({
    isPackaged: app.isPackaged,
    exePath: app.getPath("exe"),
    cwd: process.cwd(),
  });
  await migrateLegacyPackagedAtlasState(legacyDesktopRoot, atlasDesktopRoot);
  atlasDesktopStatePath = resolveAtlasDesktopStatePath(atlasDesktopRoot);
  atlasDesktopState = await readAtlasDesktopState(atlasDesktopStatePath);
  appendBootstrapTrace(`desktop state initialized: ${atlasDesktopStatePath}`);
}

async function updateDesktopState(
  patch: Partial<Pick<AtlasDesktopState, "sessionId" | "onboardingDraft" | "windowBounds" | "repoContext">>,
): Promise<void> {
  if (!atlasDesktopStatePath) {
    throw new Error("ATLAS desktop state path is not initialized.");
  }

  atlasDesktopState = await writeAtlasDesktopState(atlasDesktopStatePath, {
    ...(atlasDesktopState || {
      sessionId: null,
      onboardingDraft: "",
      windowBounds: null,
      repoContext: null,
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
  appendBootstrapTrace("desktop runtime bootstrap start");
  bootstrapEnvironment({ repoRoot: atlasDesktopRoot || process.cwd() });
  const config = await loadConfig({ repoRoot: atlasDesktopRoot || process.cwd() });
  const sessionId = atlasDesktopState?.sessionId || randomUUID();
  const repoContext = atlasDesktopState?.repoContext || null;
  if (repoContext) {
    applyAtlasRepoContextToEnv(repoContext);
  }
  const targetRepo = String(repoContext?.targetRepo || config.env.targetRepo || process.env.TARGET_REPO || "").trim();
  const stateDir = path.join(atlasDesktopRoot || process.cwd(), "state");

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
    repoContext,
  };
  await updateDesktopState({ sessionId });
  appendBootstrapTrace(`desktop runtime listening: ${serverUrl}`);
  return {
    server,
    serverUrl,
  };
}

async function loadInitialSurface(window: BrowserWindow): Promise<void> {
  if (!atlasRuntime || !atlasBootstrap) {
    throw new Error("ATLAS desktop runtime is not initialized.");
  }

  await window.loadURL(new URL("/", atlasBootstrap.serverUrl).toString());
}

function createAuthPopup(parentWindow: BrowserWindow, targetUrl: string): void {
  const popup = new BrowserWindow({
    width: 540,
    height: 720,
    parent: parentWindow,
    modal: true,
    autoHideMenuBar: true,
    title: "ATLAS authentication",
    ...(atlasDesktopResources.windowIconPath ? { icon: atlasDesktopResources.windowIconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  popup.removeMenu();
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
    backgroundColor: "#f6f1e8",
    title: ATLAS_APP_NAME,
    ...(atlasDesktopResources.windowIconPath ? { icon: atlasDesktopResources.windowIconPath } : {}),
    webPreferences: {
      preload: atlasDesktopResources.preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });
  window.removeMenu();

  if (process.platform === "win32") {
    window.setAppDetails(buildAtlasWindowsAppDetails(
      app.getPath("exe"),
      atlasDesktopResources.windowIconPath || null,
    ));
  }

  attachWindowStatePersistence(window);
  attachWindowPolicies(window, atlasBootstrap.serverUrl);
  await loadInitialSurface(window);
  appendBootstrapTrace("main window initial surface loaded");

  if (!app.isPackaged) {
    window.webContents.openDevTools({ mode: "detach" });
  }

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

function wireProcessTerminationLifecycle(): void {
  const requestProcessShutdown = (reason: string, exitCode = 0, error?: unknown) => {
    if (error instanceof Error) {
      appendBootstrapTrace(`process shutdown requested: ${reason}`, error);
    } else {
      appendBootstrapTrace(`process shutdown requested: ${reason}`);
    }

    if (shutdownInFlight) {
      return;
    }

    void shutdownAtlasApp(exitCode);
  };

  process.once("SIGINT", () => {
    requestProcessShutdown("sigint", 0);
  });

  process.once("SIGTERM", () => {
    requestProcessShutdown("sigterm", 0);
  });

  process.once("SIGHUP", () => {
    requestProcessShutdown("sighup", 0);
  });

  process.once("uncaughtException", (error) => {
    console.error(`[atlas] uncaught exception: ${String((error as Error)?.message || error)}`);
    requestProcessShutdown("uncaught-exception", 1, error);
  });

  process.once("unhandledRejection", (reason) => {
    const rejectionError = reason instanceof Error ? reason : new Error(String(reason));
    console.error(`[atlas] unhandled rejection: ${String(rejectionError.message || rejectionError)}`);
    requestProcessShutdown("unhandled-rejection", 1, rejectionError);
  });
}

async function bootstrapDesktopApp(): Promise<void> {
  appendBootstrapTrace("desktop app bootstrap start");
  alignPackagedWorkingDirectory();
  await validateDesktopResources();
  await initializeDesktopState();
  await stopBoxBackgroundRuntime();
  atlasRuntime = await startDesktopRuntime();
  mainWindow = await createMainWindow();
  appendBootstrapTrace("desktop app bootstrap complete");
  setTimeout(() => {
    void repairPinnedAtlasTaskbarShortcuts();
  }, 1000);
}

async function shutdownAtlasApp(exitCode = 0): Promise<void> {
  if (shutdownInFlight) {
    return;
  }
  shutdownInFlight = true;

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      await persistWindowBounds(mainWindow);
    }
    if (atlasRuntime?.server.listening) {
      await new Promise<void>((resolve) => {
        atlasRuntime?.server.close(() => resolve());
      });
    }
    await stopBoxBackgroundRuntime();
  } catch (error) {
    console.error(`[atlas] desktop shutdown failed: ${String((error as Error)?.message || error)}`);
  } finally {
    if (app.isReady()) {
      app.exit(exitCode);
    } else {
      process.exit(exitCode);
    }
  }
}

app.whenReady().then(() => {
  if (!atlasOwnsSingleInstanceLock) {
    appendBootstrapTrace("single instance lock unavailable; skipping bootstrap");
    return Promise.resolve();
  }

  Menu.setApplicationMenu(null);
  appendBootstrapTrace("app.whenReady resolved");
  app.setName(ATLAS_APP_NAME);

  if (process.platform === "win32") {
    app.setAppUserModelId(ATLAS_WINDOWS_APP_ID);
  }

  ipcMain.handle("atlas-desktop:get-bootstrap", async () => {
    if (!atlasBootstrap) {
      throw new Error("ATLAS desktop bootstrap is not available.");
    }
    return atlasBootstrap;
  });

  return bootstrapDesktopApp();
}).catch((error) => {
  appendBootstrapTrace("desktop bootstrap failed", error);
  console.error(`[atlas] desktop bootstrap failed: ${String((error as Error)?.message || error)}`);
  app.exit(1);
});

app.on("before-quit", (event) => {
  if (shutdownInFlight) {
    return;
  }
  event.preventDefault();
  void shutdownAtlasApp();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && atlasOwnsSingleInstanceLock) {
    createMainWindow().then((window) => {
      mainWindow = window;
    }).catch((error) => {
      console.error(`[atlas] failed to recreate the desktop window: ${String((error as Error)?.message || error)}`);
    });
  }
});