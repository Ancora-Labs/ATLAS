import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  UiAdapterEvidence,
  UiAdapterInput,
  UiSurfaceAdapter,
} from "../types.js";

type SessionModuleAdapterOptions = {
  adapterId: string;
  modulePath: string;
  exportName?: string;
  workspacePath?: string;
};

type SessionAdapterFactoryContext = {
  adapterId: string;
  modulePath: string;
  surface: string;
  workspacePath?: string;
};

type SessionAdapterCandidate = Partial<UiSurfaceAdapter> & {
  collect?: (input: UiAdapterInput) => Promise<UiAdapterEvidence>;
};

export class SessionModuleAdapter implements UiSurfaceAdapter {
  readonly adapterId: string;
  readonly surface: string;
  readonly supports = ["visual", "structural", "behavioral", "accessibility"] as const;

  private readonly modulePath: string;
  private readonly exportName: string;
  private readonly workspacePath?: string;

  constructor(surface: string, options: SessionModuleAdapterOptions) {
    this.surface = surface;
    this.adapterId = options.adapterId;
    this.modulePath = options.modulePath;
    this.exportName = options.exportName || "";
    this.workspacePath = options.workspacePath;
  }

  async collect(input: UiAdapterInput): Promise<UiAdapterEvidence> {
    const delegate = await this.loadDelegate();
    return delegate.collect(input);
  }

  private async loadDelegate(): Promise<UiSurfaceAdapter> {
    const resolvedModulePath = resolveSessionModulePath(this.modulePath, this.workspacePath);
    const moduleUrl = `${pathToFileURL(resolvedModulePath).href}?box_ui_session_module=${Date.now()}`;
    const loaded = await import(moduleUrl);
    const selectedExport = this.exportName && loaded[this.exportName] !== undefined
      ? loaded[this.exportName]
      : loaded.default ?? loaded.createUiSurfaceAdapter ?? loaded.createAdapter ?? loaded.adapter ?? loaded;
    const candidate = typeof selectedExport === "function"
      ? await selectedExport({
        adapterId: this.adapterId,
        modulePath: resolvedModulePath,
        surface: this.surface,
        workspacePath: this.workspacePath,
      } satisfies SessionAdapterFactoryContext)
      : selectedExport;
    const normalized = normalizeSessionAdapterCandidate(candidate, this.surface, this.adapterId, resolvedModulePath);
    return normalized;
  }
}

function resolveSessionModulePath(modulePath: string, workspacePath?: string): string {
  const trimmed = String(modulePath || "").trim();
  if (!trimmed) {
    throw new Error("SessionModuleAdapter requires a non-empty module path");
  }
  if (path.isAbsolute(trimmed)) {
    return path.resolve(trimmed);
  }
  return path.resolve(workspacePath || process.cwd(), trimmed);
}

function normalizeSessionAdapterCandidate(
  candidate: unknown,
  surface: string,
  adapterId: string,
  resolvedModulePath: string,
): UiSurfaceAdapter {
  if (!candidate || typeof candidate !== "object") {
    throw new Error(`Session adapter module must export an object or factory result: ${resolvedModulePath}`);
  }
  const normalized = candidate as SessionAdapterCandidate;
  if (typeof normalized.collect !== "function") {
    throw new Error(`Session adapter module must provide collect(input): Promise<UiAdapterEvidence>: ${resolvedModulePath}`);
  }
  return {
    adapterId: typeof normalized.adapterId === "string" && normalized.adapterId.trim()
      ? normalized.adapterId.trim()
      : adapterId,
    surface: typeof normalized.surface === "string" && normalized.surface.trim()
      ? normalized.surface.trim()
      : surface,
    supports: Array.isArray(normalized.supports) && normalized.supports.length > 0
      ? normalized.supports
      : ["visual", "structural", "behavioral", "accessibility"],
    collect: normalized.collect.bind(normalized),
  };
}