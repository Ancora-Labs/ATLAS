/**
 * ui_contract/adapter.ts — Surface adapter registry helpers.
 *
 * The interface itself lives in types.ts. This module provides a small,
 * deterministic registry so the loop controller can resolve adapters by
 * (surface, adapterId) without coupling to any specific adapter implementation.
 */

import type { UiSurfaceAdapter } from "./types.js";

export class UiAdapterRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UiAdapterRegistryError";
  }
}

export class UiAdapterRegistry {
  private readonly bySurface = new Map<string, UiSurfaceAdapter>();

  register(adapter: UiSurfaceAdapter): void {
    if (this.bySurface.has(adapter.surface)) {
      throw new UiAdapterRegistryError(`adapter already registered for surface: ${adapter.surface}`);
    }
    this.bySurface.set(adapter.surface, adapter);
  }

  resolve(surface: string): UiSurfaceAdapter {
    const adapter = this.bySurface.get(surface);
    if (!adapter) {
      throw new UiAdapterRegistryError(`no adapter registered for surface: ${surface}`);
    }
    return adapter;
  }

  has(surface: string): boolean {
    return this.bySurface.has(surface);
  }

  list(): ReadonlyArray<UiSurfaceAdapter> {
    return Array.from(this.bySurface.values());
  }
}
