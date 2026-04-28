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

type BrowserRunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type SpawnAsyncResultLike = {
  status?: number;
  stdout?: string;
  stderr?: string;
};

type HeadlessBrowserDomAdapterOptions = {
  findBrowserCommand?: () => Promise<string | null>;
  runBrowser?: (command: string, args: string[], cwd: string) => Promise<BrowserRunResult>;
  tempRootDir?: string;
};

export class HeadlessBrowserDomAdapter implements UiSurfaceAdapter {
  readonly adapterId = "headless-browser-dom";
  readonly surface: string;
  readonly supports = ["visual", "structural", "behavioral", "accessibility"] as const;

  private readonly findBrowserCommandImpl: () => Promise<string | null>;
  private readonly runBrowserImpl: (command: string, args: string[], cwd: string) => Promise<BrowserRunResult>;
  private readonly tempRootDir: string;

  constructor(surface = "headless-browser-dom", options: HeadlessBrowserDomAdapterOptions = {}) {
    this.surface = surface;
    this.findBrowserCommandImpl = options.findBrowserCommand || findInstalledBrowserCommand;
    this.runBrowserImpl = options.runBrowser || runBrowserCommand;
    this.tempRootDir = options.tempRootDir || os.tmpdir();
  }

  async collect(input: UiAdapterInput): Promise<UiAdapterEvidence> {
    const { contract, scenario } = input;
    const state = scenario.state ?? {};
    const artifactDir = await this.resolveArtifactDir(state, scenario.scenarioId);
    const targetUrl = await this.resolveTargetUrl(state, artifactDir, scenario.scenarioId);
    const browserCommand = await this.findBrowserCommandImpl();
    if (!browserCommand) {
      throw new Error("No Chromium-compatible browser found for headless UI evidence capture");
    }

    const viewport = readViewport(state.viewport);
    const screenshotPath = path.join(artifactDir, `${scenario.scenarioId}.png`);
    const domPath = path.join(artifactDir, `${scenario.scenarioId}.dom.html`);
    const screenshotResult = await this.runBrowserImpl(
      browserCommand,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        `--window-size=${viewport.width},${viewport.height}`,
        `--virtual-time-budget=${readVirtualTimeBudget(state)}`,
        `--screenshot=${screenshotPath}`,
        targetUrl,
      ],
      artifactDir,
    );
    if (screenshotResult.status !== 0) {
      throw new Error(`Headless browser screenshot failed: ${truncateOutput(screenshotResult.stderr || screenshotResult.stdout)}`);
    }

    const domResult = await this.runBrowserImpl(
      browserCommand,
      [
        "--headless=new",
        "--disable-gpu",
        `--window-size=${viewport.width},${viewport.height}`,
        `--virtual-time-budget=${readVirtualTimeBudget(state)}`,
        "--dump-dom",
        targetUrl,
      ],
      artifactDir,
    );
    if (domResult.status !== 0) {
      throw new Error(`Headless browser DOM dump failed: ${truncateOutput(domResult.stderr || domResult.stdout)}`);
    }

    const dom = String(domResult.stdout || "").trim();
    await fs.writeFile(domPath, dom, "utf8");
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
        `browser=${browserCommand}`,
        `target=${targetUrl}`,
        `artifact_dir=${artifactDir}`,
        `dom_path=${domPath}`,
        `screenshot_path=${screenshotPath}`,
      ],
    };
  }

  private async resolveArtifactDir(state: Record<string, unknown>, scenarioId: string): Promise<string> {
    const stateArtifactDir = typeof state.artifactDir === "string" ? state.artifactDir.trim() : "";
    const artifactDir = stateArtifactDir
      ? path.resolve(stateArtifactDir)
      : await fs.mkdtemp(path.join(this.tempRootDir, `box-ui-${sanitizeFileSegment(scenarioId)}-`));
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
    throw new Error("UI runtime scenario requires one of state.url, state.htmlPath, or state.html");
  }
}

async function runBrowserCommand(command: string, args: string[], cwd: string): Promise<BrowserRunResult> {
  const result = await spawnAsync(command, args, {
    cwd,
    env: process.env,
  }) as SpawnAsyncResultLike;
  return {
    status: Number(result?.status ?? 1),
    stdout: String(result?.stdout || ""),
    stderr: String(result?.stderr || ""),
  };
}

async function findInstalledBrowserCommand(): Promise<string | null> {
  const envCandidate = typeof process.env.UI_RUNTIME_BROWSER_BIN === "string"
    ? process.env.UI_RUNTIME_BROWSER_BIN.trim()
    : "";
  if (envCandidate) {
    const absoluteExists = await pathExists(envCandidate);
    if (absoluteExists) return envCandidate;
    return envCandidate;
  }

  const candidates = process.platform === "win32"
    ? ["msedge.exe", "chrome.exe", "chromium.exe", "msedge", "chrome", "chromium"]
    : ["microsoft-edge", "google-chrome", "chromium", "chromium-browser"];
  const locator = process.platform === "win32" ? "where" : "which";

  for (const candidate of candidates) {
    const result = await spawnAsync(locator, [candidate], {
      cwd: process.cwd(),
      env: process.env,
    }) as SpawnAsyncResultLike;
    if (Number(result?.status ?? 1) !== 0) continue;
    const firstLine = String(result?.stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (firstLine) return firstLine;
  }
  return null;
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
      detail: screenshotExists ? screenshotPath : `missing screenshot at ${screenshotPath}`,
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

function readViewport(viewport: unknown): { width: number; height: number } {
  if (!viewport || typeof viewport !== "object") {
    return { width: 1440, height: 900 };
  }
  const normalized = viewport as { width?: unknown; height?: unknown };
  const width = Number.isFinite(Number(normalized.width)) ? Math.max(320, Number(normalized.width)) : 1440;
  const height = Number.isFinite(Number(normalized.height)) ? Math.max(320, Number(normalized.height)) : 900;
  return { width, height };
}

function readVirtualTimeBudget(state: Record<string, unknown>): number {
  const rawBudget = Number(state.virtualTimeBudgetMs);
  return Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : 1200;
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

function truncateOutput(value: string): string {
  return String(value || "").trim().slice(0, 240) || "unknown-error";
}