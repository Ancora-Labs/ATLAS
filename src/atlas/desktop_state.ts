import path from "node:path";

import { READ_JSON_REASON, readJsonSafe, writeJson } from "../core/fs_utils.js";

export interface AtlasDesktopWindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export type AtlasDesktopProductSurface = "home" | "sessions";

export interface AtlasDesktopLocation {
  surface: AtlasDesktopProductSurface;
  focusedSessionRole: string | null;
}

export interface AtlasDesktopState {
  sessionId: string | null;
  onboardingDraft: string;
  productDraft: string;
  productComposerFocused: boolean;
  windowBounds: AtlasDesktopWindowBounds | null;
  lastProductSurface: AtlasDesktopProductSurface;
  focusedSessionRole: string | null;
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

const ATLAS_DESKTOP_STATE_SCHEMA_VERSION = 3;

export function createDefaultAtlasDesktopState(): AtlasDesktopState {
  return {
    sessionId: null,
    onboardingDraft: "",
    productDraft: "",
    productComposerFocused: false,
    windowBounds: null,
    lastProductSurface: "home",
    focusedSessionRole: null,
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

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

export function normalizeAtlasDesktopProductSurface(value: unknown): AtlasDesktopProductSurface {
  return value === "sessions" ? "sessions" : "home";
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

export function normalizeAtlasDesktopLocation(value: unknown): AtlasDesktopLocation {
  if (!isRecord(value)) {
    return {
      surface: "home",
      focusedSessionRole: null,
    };
  }

  return {
    surface: normalizeAtlasDesktopProductSurface(value.surface),
    focusedSessionRole: normalizeOptionalString(value.focusedSessionRole),
  };
}

export function buildAtlasDesktopLocationPath(location: Partial<AtlasDesktopLocation> = {}): string {
  const normalizedLocation = normalizeAtlasDesktopLocation({
    surface: location.surface,
    focusedSessionRole: location.focusedSessionRole,
  });
  const params = new URLSearchParams();
  if (normalizedLocation.focusedSessionRole) {
    params.set("focusRole", normalizedLocation.focusedSessionRole);
  }

  const pathname = normalizedLocation.surface === "sessions" ? "/sessions" : "/";
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function parseAtlasDesktopLocationFromUrl(input: string | URL): AtlasDesktopLocation | null {
  try {
    const parsedUrl = input instanceof URL
      ? input
      : new URL(String(input || "/"), "http://127.0.0.1");
    const surface = parsedUrl.pathname === "/"
      ? "home"
      : (parsedUrl.pathname === "/sessions" ? "sessions" : null);
    if (!surface) {
      return null;
    }

    return {
      surface,
      focusedSessionRole: normalizeOptionalString(parsedUrl.searchParams.get("focusRole")),
    };
  } catch {
    return null;
  }
}

function normalizeAtlasDesktopState(value: unknown): AtlasDesktopState | null {
  if (!isRecord(value)) return null;

  const sessionId = normalizeOptionalString(value.sessionId);
  const onboardingDraft = typeof value.onboardingDraft === "string"
    ? value.onboardingDraft
    : "";
  const productDraft = typeof value.productDraft === "string"
    ? value.productDraft
    : "";
  const updatedAt = normalizeOptionalString(value.updatedAt);

  return {
    sessionId,
    onboardingDraft,
    productDraft,
    productComposerFocused: normalizeBoolean(value.productComposerFocused),
    windowBounds: normalizeAtlasDesktopWindowBounds(value.windowBounds),
    lastProductSurface: normalizeAtlasDesktopProductSurface(value.lastProductSurface),
    focusedSessionRole: normalizeOptionalString(value.focusedSessionRole),
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
