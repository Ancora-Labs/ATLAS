import path from "node:path";

import { READ_JSON_REASON, readJsonSafe, writeJson } from "../core/fs_utils.js";

export interface AtlasDesktopWindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export type AtlasDesktopRepoMode = "existing" | "new";

export interface AtlasDesktopRepoContext {
  provider: "github";
  targetRepo: string;
  targetBaseBranch: string | null;
  repoMode: AtlasDesktopRepoMode;
  repoCreatedByAtlas: boolean;
}

export interface AtlasDesktopState {
  sessionId: string | null;
  onboardingDraft: string;
  windowBounds: AtlasDesktopWindowBounds | null;
  repoContext: AtlasDesktopRepoContext | null;
  updatedAt: string | null;
}

export interface AtlasDesktopBootstrap {
  sessionId: string;
  serverUrl: string;
  targetRepo: string;
  onboardingDraft: string;
  repoContext: AtlasDesktopRepoContext | null;
}

interface AtlasDesktopStateRecord extends AtlasDesktopState {
  schemaVersion: number;
}

export interface ResolveAtlasDesktopStateRootOptions {
  isPackaged: boolean;
  exePath: string;
  cwd: string;
}

const ATLAS_DESKTOP_STATE_SCHEMA_VERSION = 1;

function createDefaultAtlasDesktopState(): AtlasDesktopState {
  return {
    sessionId: null,
    onboardingDraft: "",
    windowBounds: null,
    repoContext: null,
    updatedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeAtlasDesktopWindowBounds(value: unknown): AtlasDesktopWindowBounds | null {
  if (!isRecord(value)) return null;

  const width = normalizeOptionalNumber(value.width);
  const height = normalizeOptionalNumber(value.height);
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    return null;
  }

  const x = normalizeOptionalNumber(value.x);
  const y = normalizeOptionalNumber(value.y);
  return {
    width,
    height,
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
  };
}

export function normalizeAtlasDesktopRepoContext(value: unknown): AtlasDesktopRepoContext | null {
  if (!isRecord(value)) {
    return null;
  }

  const targetRepo = normalizeOptionalString(value.targetRepo);
  const provider = normalizeOptionalString(value.provider);
  const repoMode = normalizeOptionalString(value.repoMode);
  if (!targetRepo || provider !== "github" || (repoMode !== "existing" && repoMode !== "new")) {
    return null;
  }

  return {
    provider,
    targetRepo,
    targetBaseBranch: normalizeOptionalString(value.targetBaseBranch),
    repoMode,
    repoCreatedByAtlas: value.repoCreatedByAtlas === true,
  };
}

function normalizeAtlasDesktopState(value: unknown): AtlasDesktopState | null {
  if (!isRecord(value)) return null;

  const sessionId = normalizeOptionalString(value.sessionId);
  const onboardingDraft = typeof value.onboardingDraft === "string" ? value.onboardingDraft : "";
  const updatedAt = normalizeOptionalString(value.updatedAt);

  return {
    sessionId,
    onboardingDraft,
    windowBounds: normalizeAtlasDesktopWindowBounds(value.windowBounds),
    repoContext: normalizeAtlasDesktopRepoContext(value.repoContext),
    updatedAt,
  };
}

export function resolveAtlasDesktopStateRoot(options: ResolveAtlasDesktopStateRootOptions): string {
  if (options.isPackaged) {
    return path.resolve(options.cwd);
  }
  return options.cwd;
}

export function resolveAtlasDesktopStatePath(desktopRoot: string): string {
  return path.join(desktopRoot, "state", "atlas", "desktop_state.json");
}

export function resolveAtlasDesktopStatePathFromStateDir(stateDir: string): string {
  return path.join(stateDir, "atlas", "desktop_state.json");
}

export async function readAtlasDesktopState(statePath: string): Promise<AtlasDesktopState> {
  const stateResult = await readJsonSafe(statePath);
  if (!stateResult.ok) {
    if (stateResult.reason === READ_JSON_REASON.INVALID) {
      console.error(`[atlas] failed to read desktop state: ${String(stateResult.error?.message || stateResult.error)}`);
    }
    return createDefaultAtlasDesktopState();
  }

  const normalizedState = normalizeAtlasDesktopState(stateResult.data);
  if (normalizedState) {
    return normalizedState;
  }

  console.error(`[atlas] invalid desktop state payload: ${statePath}`);
  return createDefaultAtlasDesktopState();
}

export async function writeAtlasDesktopState(
  statePath: string,
  state: AtlasDesktopState,
): Promise<AtlasDesktopState> {
  const normalizedState = normalizeAtlasDesktopState(state) || createDefaultAtlasDesktopState();
  const persistedState: AtlasDesktopStateRecord = {
    schemaVersion: ATLAS_DESKTOP_STATE_SCHEMA_VERSION,
    ...normalizedState,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(statePath, persistedState);
  return persistedState;
}
