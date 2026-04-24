import path from "node:path";

import { READ_JSON_REASON, readJsonSafe, writeJson } from "../core/fs_utils.js";

export interface AtlasDesktopWindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface AtlasDesktopState {
  sessionId: string | null;
  onboardingDraft: string;
  windowBounds: AtlasDesktopWindowBounds | null;
  updatedAt: string | null;
}

export interface AtlasDesktopBootstrap {
  sessionId: string;
  serverUrl: string;
  targetRepo: string;
  onboardingDraft: string;
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
    updatedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

function normalizeAtlasDesktopState(value: unknown): AtlasDesktopState | null {
  if (!isRecord(value)) return null;

  const sessionId = typeof value.sessionId === "string" && value.sessionId.trim()
    ? value.sessionId.trim()
    : null;
  const onboardingDraft = typeof value.onboardingDraft === "string"
    ? value.onboardingDraft
    : "";
  const updatedAt = typeof value.updatedAt === "string" && value.updatedAt.trim()
    ? value.updatedAt
    : null;

  return {
    sessionId,
    onboardingDraft,
    windowBounds: normalizeAtlasDesktopWindowBounds(value.windowBounds),
    updatedAt,
  };
}

export function resolveAtlasDesktopStateRoot(options: ResolveAtlasDesktopStateRootOptions): string {
  if (options.isPackaged) {
    return path.dirname(options.exePath);
  }
  return options.cwd;
}

export function resolveAtlasDesktopStatePath(desktopRoot: string): string {
  return path.join(desktopRoot, "state", "atlas", "desktop_state.json");
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
