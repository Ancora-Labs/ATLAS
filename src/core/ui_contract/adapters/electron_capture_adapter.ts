/**
 * ui_contract/adapters/electron_capture_adapter.ts
 *
 * Native Electron-window-level UI evidence adapter. For each scenario this
 * adapter spawns the workspace's own Electron binary running a minimal
 * capture main script that:
 *
 *   1. Creates a hidden BrowserWindow at the requested viewport.
 *   2. Loads the scenario URL (or generated file:// from inline html / htmlPath).
 *   3. Waits for did-finish-load + a configurable settle budget.
 *   4. Calls `webContents.capturePage()` and writes the PNG.
 *   5. Calls `webContents.executeJavaScript("document.documentElement.outerHTML")`
 *      and writes the DOM dump.
 *
 * The adapter then reuses the shared structural / accessibility / behavioral
 * heuristics so the verdict layer sees the same evidence shape it gets from
 * the headless-browser adapter — but produced by a real Electron renderer at
 * `BrowserWindow.capturePage()` level, which is what desktop-shell contracts
 * require.
 *
 * The adapter is dependency-injectable for tests via `runElectron` and
 * `findElectronBinary` hooks. In production it locates the workspace's own
 * `node_modules/.bin/electron[.cmd]` so each session uses its own Electron
 * version automatically.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { spawnAsync } from "../../fs_utils.js";
import type {
  UiAdapterEvidence,
  UiAdapterInput,
  UiEvidenceItem,
  UiSurfaceAdapter,
} from "../types.js";

type ElectronRunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type SpawnAsyncResultLike = {
  status?: number;
  stdout?: string;
  stderr?: string;
};

export type ElectronCaptureAdapterOptions = {
  workspacePath?: string;
  electronBinPath?: string;
  findElectronBinary?: (workspacePath: string | undefined) => Promise<string | null>;
  runElectron?: (
    binary: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
    timeoutMs: number,
  ) => Promise<ElectronRunResult>;
  tempRootDir?: string;
  defaultTimeoutMs?: number;
  settleMs?: number;
  /** Optional preload script path baked into the BrowserWindow. */
  preloadPath?: string;
};

const CAPTURE_MAIN_FILENAME = "box-electron-capture-main.cjs";

export class ElectronCaptureAdapter implements UiSurfaceAdapter {
  readonly adapterId = "electron-capture";
  readonly surface: string;
  readonly supports = ["visual", "structural", "behavioral", "accessibility"] as const;

  private readonly workspacePath?: string;
  private readonly electronBinPath?: string;
  private readonly findElectronBinaryImpl: (workspacePath: string | undefined) => Promise<string | null>;
  private readonly runElectronImpl: (
    binary: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
    timeoutMs: number,
  ) => Promise<ElectronRunResult>;
  private readonly tempRootDir: string;
  private readonly defaultTimeoutMs: number;
  private readonly settleMs: number;
  private readonly preloadPath?: string;

  constructor(surface = "electron-capture", options: ElectronCaptureAdapterOptions = {}) {
    this.surface = surface;
    this.workspacePath = options.workspacePath;
    this.electronBinPath = options.electronBinPath;
    this.findElectronBinaryImpl = options.findElectronBinary || findInstalledElectronBinary;
    this.runElectronImpl = options.runElectron || runElectronCommand;
    this.tempRootDir = options.tempRootDir || os.tmpdir();
    this.defaultTimeoutMs = Number.isFinite(Number(options.defaultTimeoutMs))
      && Number(options.defaultTimeoutMs) > 0
      ? Number(options.defaultTimeoutMs)
      : 60_000;
    this.settleMs = Number.isFinite(Number(options.settleMs)) && Number(options.settleMs) >= 0
      ? Number(options.settleMs)
      : 800;
    this.preloadPath = options.preloadPath;
  }

  async collect(input: UiAdapterInput): Promise<UiAdapterEvidence> {
    const { contract, scenario } = input;
    const state = scenario.state ?? {};
    const artifactDir = await this.resolveArtifactDir(state, scenario.scenarioId);
    const targetUrl = await this.resolveTargetUrl(state, artifactDir, scenario.scenarioId);
    const electronBin = this.electronBinPath || await this.findElectronBinaryImpl(this.workspacePath);
    if (!electronBin) {
      throw new Error(
        "ElectronCaptureAdapter could not locate an Electron binary "
          + "(checked workspace node_modules and UI_RUNTIME_ELECTRON_BIN)",
      );
    }

    const viewport = readViewport(state.viewport);
    const screenshotPath = path.join(artifactDir, `${scenario.scenarioId}.png`);
    const domPath = path.join(artifactDir, `${scenario.scenarioId}.dom.html`);
    const captureMainPath = path.join(artifactDir, CAPTURE_MAIN_FILENAME);
    await fs.writeFile(captureMainPath, buildCaptureMainScript(), "utf8");

    const settleMs = readSettleMs(state, this.settleMs);
    const timeoutMs = readTimeoutMs(state, this.defaultTimeoutMs);
    const electronArgs: string[] = [
      captureMainPath,
      `--url=${targetUrl}`,
      `--screenshot=${screenshotPath}`,
      `--dom=${domPath}`,
      `--width=${viewport.width}`,
      `--height=${viewport.height}`,
      `--settle=${settleMs}`,
    ];
    if (this.preloadPath) {
      electronArgs.push(`--preload=${this.preloadPath}`);
    }
    if (process.platform !== "win32") {
      // Linux/macOS sandboxed CI environments need these to capture without DISPLAY tricks.
      electronArgs.push("--no-sandbox", "--disable-gpu");
    }

    const result = await this.runElectronImpl(
      electronBin,
      electronArgs,
      artifactDir,
      buildElectronEnv(),
      timeoutMs,
    );
    if (result.status !== 0) {
      throw new Error(
        `Electron capture failed (status=${result.status}): ${truncateOutput(result.stderr || result.stdout)}`,
      );
    }

    const dom = (await readFileSafe(domPath)) || "";
    const screenshotExists = await pathExists(screenshotPath);
    const structural = collectStructural(dom, state);
    const accessibility = collectAccessibility(dom, state, contract.accessibilityFloor);
    const visual = collectVisualEvidence(screenshotPath, screenshotExists);
    const behavioral = collectBehavioralEvidence(targetUrl, dom);

    return {
      adapterId: this.adapterId,
      scenarioId: scenario.scenarioId,
      items: {
        structural,
        accessibility,
        visual,
        behavioral,
      },
      notes: [
        `electron=${electronBin}`,
        `target=${targetUrl}`,
        `artifact_dir=${artifactDir}`,
        `dom_path=${domPath}`,
        `screenshot_path=${screenshotPath}`,
        `viewport=${viewport.width}x${viewport.height}`,
        `settle_ms=${settleMs}`,
      ],
    };
  }

  private async resolveArtifactDir(state: Record<string, unknown>, scenarioId: string): Promise<string> {
    const stateArtifactDir = typeof state.artifactDir === "string" ? state.artifactDir.trim() : "";
    const artifactDir = stateArtifactDir
      ? path.resolve(stateArtifactDir)
      : await fs.mkdtemp(path.join(this.tempRootDir, `box-electron-${sanitizeFileSegment(scenarioId)}-`));
    await fs.mkdir(artifactDir, { recursive: true });
    return artifactDir;
  }

  private async resolveTargetUrl(
    state: Record<string, unknown>,
    artifactDir: string,
    scenarioId: string,
  ): Promise<string> {
    if (typeof state.url === "string" && state.url.trim()) {
      return state.url.trim();
    }
    if (typeof state.htmlPath === "string" && state.htmlPath.trim()) {
      return pathToFileURL(path.resolve(state.htmlPath.trim())).href;
    }
    if (typeof state.html === "string") {
      const htmlPath = path.join(artifactDir, `${scenarioId}.runtime.html`);
      await fs.writeFile(htmlPath, state.html, "utf8");
      return pathToFileURL(htmlPath).href;
    }
    throw new Error("ElectronCaptureAdapter scenario requires one of state.url, state.htmlPath, or state.html");
  }
}

function buildCaptureMainScript(): string {
  // CommonJS so Electron's main process loads it directly without ESM transform.
  return `// Auto-generated by ElectronCaptureAdapter. Do not edit.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");

function parseArgs(argv) {
  const opts = {};
  for (const arg of argv) {
    const m = /^--([a-zA-Z0-9_-]+)=(.*)$/.exec(arg);
    if (m) opts[m[1]] = m[2];
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const width = parseInt(opts.width || "1440", 10);
const height = parseInt(opts.height || "900", 10);
const settleMs = parseInt(opts.settle || "800", 10);

if (!opts.url || !opts.screenshot || !opts.dom) {
  process.stderr.write("missing --url/--screenshot/--dom argument\\n");
  app.quit();
  process.exit(2);
}

if (app.commandLine && typeof app.commandLine.appendSwitch === "function") {
  // Allow file:// resources to load local images/scripts from the workspace.
  app.commandLine.appendSwitch("allow-file-access-from-files");
}

app.whenReady().then(async () => {
  const webPreferences = {
    contextIsolation: true,
    sandbox: false,
    nodeIntegration: false,
    offscreen: false,
    backgroundThrottling: false,
  };
  if (opts.preload) webPreferences.preload = opts.preload;
  const win = new BrowserWindow({
    show: false,
    width,
    height,
    backgroundColor: "#ffffff",
    webPreferences,
  });

  let exitCode = 0;
  try {
    await win.loadURL(opts.url);
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, settleMs)));
    const image = await win.webContents.capturePage();
    fs.writeFileSync(opts.screenshot, image.toPNG());
    const dom = await win.webContents.executeJavaScript("document.documentElement.outerHTML");
    fs.writeFileSync(opts.dom, String(dom == null ? "" : dom));
    process.stdout.write("CAPTURE_OK\\n");
  } catch (err) {
    process.stderr.write(String((err && err.stack) || err) + "\\n");
    exitCode = 1;
  } finally {
    try { win.destroy(); } catch (_) { /* ignore */ }
    app.quit();
    setTimeout(() => process.exit(exitCode), 25);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
`;
}

async function runElectronCommand(
  binary: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<ElectronRunResult> {
  const result = await spawnAsync(binary, args, {
    cwd,
    env,
    timeoutMs,
  }) as SpawnAsyncResultLike;
  return {
    status: Number(result?.status ?? 1),
    stdout: String(result?.stdout || ""),
    stderr: String(result?.stderr || ""),
  };
}

async function findInstalledElectronBinary(workspacePath: string | undefined): Promise<string | null> {
  const envCandidate = typeof process.env.UI_RUNTIME_ELECTRON_BIN === "string"
    ? process.env.UI_RUNTIME_ELECTRON_BIN.trim()
    : "";
  if (envCandidate) {
    return envCandidate;
  }

  const roots = [workspacePath, process.cwd()].filter((value): value is string => Boolean(value));
  const binNames = process.platform === "win32"
    ? ["electron.cmd", "electron.exe", "electron"]
    : ["electron"];

  for (const root of roots) {
    for (const binName of binNames) {
      const candidate = path.join(root, "node_modules", ".bin", binName);
      if (await pathExists(candidate)) return candidate;
    }
    // Fallback: try the package main of the electron module directly.
    const electronEntry = path.join(root, "node_modules", "electron", "cli.js");
    if (await pathExists(electronEntry)) {
      return process.execPath; // run via node + cli.js (caller will pass cli.js as first arg if needed)
    }
  }

  return null;
}

function buildElectronEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env } as NodeJS.ProcessEnv;
  // Keep Electron quiet; never reuse a developer's running app instance state.
  env.ELECTRON_ENABLE_LOGGING = env.ELECTRON_ENABLE_LOGGING || "0";
  env.ELECTRON_DISABLE_SANDBOX = env.ELECTRON_DISABLE_SANDBOX || "1";
  return env;
}

function readViewport(viewport: unknown): { width: number; height: number } {
  if (!viewport || typeof viewport !== "object") {
    return { width: 1440, height: 900 };
  }
  const normalized = viewport as { width?: unknown; height?: unknown };
  const width = Number.isFinite(Number(normalized.width)) ? Math.max(320, Number(normalized.width)) : 1440;
  const height = Number.isFinite(Number(normalized.height)) ? Math.max(320, Number(normalized.height)) : 900;
  return { width, height };
}

function readSettleMs(state: Record<string, unknown>, fallback: number): number {
  const candidate = Number(state.settleMs);
  return Number.isFinite(candidate) && candidate >= 0 ? candidate : fallback;
}

function readTimeoutMs(state: Record<string, unknown>, fallback: number): number {
  const candidate = Number(state.captureTimeoutMs);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : fallback;
}

function collectStructural(html: string, state: Record<string, unknown>): UiEvidenceItem[] {
  const expectLandmarks = Array.isArray(state.expectLandmarks)
    ? (state.expectLandmarks as unknown[]).filter((value): value is string => typeof value === "string")
    : [];
  const items: UiEvidenceItem[] = [];

  for (const tag of expectLandmarks) {
    const present = hasTag(html, tag);
    items.push({
      evidenceClass: "structural",
      ruleId: `dom_landmark:${tag}`,
      pass: present,
      detail: present ? `<${tag}> present` : `<${tag}> missing`,
    });
  }

  const modalInModal = countOccurrences(html, /<dialog\b|role=["']dialog["']/gi) >= 2
    && /<dialog[\s\S]*<dialog/i.test(html);
  items.push({
    evidenceClass: "structural",
    ruleId: "modal_inside_modal",
    pass: !modalInModal,
    detail: modalInModal ? "nested dialog detected" : "no nested dialog",
  });

  return items;
}

function collectAccessibility(
  html: string,
  state: Record<string, unknown>,
  accessibilityFloor: string,
): UiEvidenceItem[] {
  const items: UiEvidenceItem[] = [];
  const imgs = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((match) => match[0]);
  const imgsMissingAlt = imgs.filter((tag) => !/\balt\s*=/.test(tag));
  items.push({
    evidenceClass: "accessibility",
    ruleId: "img_alt_coverage",
    pass: imgsMissingAlt.length === 0,
    detail: imgsMissingAlt.length === 0
      ? `${imgs.length} <img> tag(s), all have alt`
      : `${imgsMissingAlt.length} <img> tag(s) missing alt`,
  });

  const minContrast = typeof state.minContrast === "number"
    ? state.minContrast
    : accessibilityFloor === "WCAG-AA" ? 4.5 : 0;
  if (minContrast > 0 && Array.isArray(state.contrastSamples)) {
    for (const sample of state.contrastSamples as unknown[]) {
      if (!sample || typeof sample !== "object") continue;
      const normalized = sample as { id?: unknown; ratio?: unknown };
      if (typeof normalized.id !== "string" || typeof normalized.ratio !== "number") continue;
      const pass = normalized.ratio >= minContrast;
      items.push({
        evidenceClass: "accessibility",
        ruleId: `contrast:${normalized.id}`,
        pass,
        detail: `ratio=${normalized.ratio.toFixed(2)} floor=${minContrast.toFixed(2)}`,
      });
    }
  }

  return items;
}

function collectVisualEvidence(screenshotPath: string, screenshotExists: boolean): UiEvidenceItem[] {
  return [
    {
      evidenceClass: "visual",
      ruleId: "visual_capture_available",
      pass: screenshotExists,
      detail: screenshotExists
        ? `electron capturePage() png at ${screenshotPath}`
        : `missing electron screenshot at ${screenshotPath}`,
    },
  ];
}

function collectBehavioralEvidence(targetUrl: string, dom: string): UiEvidenceItem[] {
  return [
    {
      evidenceClass: "behavioral",
      ruleId: "page_load_complete",
      pass: dom.length > 0,
      detail: `target=${targetUrl}`,
    },
  ];
}

function hasTag(html: string, tag: string): boolean {
  const safeTag = tag.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeTag) return false;
  return new RegExp(`<${safeTag}\\b`, "i").test(html);
}

function countOccurrences(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function sanitizeFileSegment(value: string): string {
  const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized || "ui-scenario";
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readFileSafe(targetPath: string): Promise<string | null> {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

function truncateOutput(value: string): string {
  return String(value || "").trim().slice(0, 240) || "unknown-error";
}
