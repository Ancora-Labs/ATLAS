import { contextBridge, ipcRenderer } from "electron";

import type { AtlasClarificationPacket } from "../src/atlas/clarification.js";
import type { AtlasDesktopBootstrap, AtlasDesktopState } from "../src/atlas/desktop_state.js";
import type {
  AtlasSnapshotRequestPayload,
  AtlasSnapshotResponse,
} from "../src/atlas/routes/home.js";

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

async function invokeAtlasDesktop<T>(channel: string, payload?: unknown): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, payload);
  } catch (error) {
    console.error(`[atlas] preload bridge invoke failed for ${channel}:`, error);
    throw error;
  }
}

contextBridge.exposeInMainWorld("atlasDesktop", {
  getBootstrap(): Promise<AtlasDesktopBootstrap> {
    return invokeAtlasDesktop<AtlasDesktopBootstrap>("atlas-desktop:get-bootstrap");
  },
  getWorkspaceState(): Promise<AtlasDesktopState> {
    return invokeAtlasDesktop<AtlasDesktopState>("atlas-desktop:get-workspace-state");
  },
  refreshSnapshot(request: AtlasSnapshotRequestPayload = {}): Promise<AtlasSnapshotResponse> {
    return invokeAtlasDesktop<AtlasSnapshotResponse>("atlas-desktop:refresh-snapshot", request);
  },
  getSnapshot(request: AtlasSnapshotRequestPayload = {}): Promise<AtlasSnapshotResponse> {
    return invokeAtlasDesktop<AtlasSnapshotResponse>("atlas-desktop:get-snapshot", request);
  },
  setWorkspaceDraft(draft: string): Promise<{ ok: true }> {
    return invokeAtlasDesktop<{ ok: true }>("atlas-desktop:set-workspace-draft", { draft });
  },
  setWorkspaceComposerFocus(focused: boolean): Promise<{ ok: true }> {
    return invokeAtlasDesktop<{ ok: true }>("atlas-desktop:set-workspace-composer-focus", { focused });
  },
  startSession(objective: string): Promise<AtlasDesktopClarificationResult> {
    return invokeAtlasDesktop<AtlasDesktopClarificationResult>("atlas-desktop:start-session", { objective });
  },
});
