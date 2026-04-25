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

contextBridge.exposeInMainWorld("atlasDesktop", {
  getBootstrap(): Promise<AtlasDesktopBootstrap> {
    return ipcRenderer.invoke("atlas-desktop:get-bootstrap");
  },
  getDesktopState(): Promise<AtlasDesktopState> {
    return ipcRenderer.invoke("atlas-desktop:get-desktop-state");
  },
  refreshSnapshot(request: AtlasSnapshotRequestPayload = {}): Promise<AtlasSnapshotResponse> {
    return ipcRenderer.invoke("atlas-desktop:refresh-snapshot", request);
  },
  getSnapshot(request: AtlasSnapshotRequestPayload = {}): Promise<AtlasSnapshotResponse> {
    return ipcRenderer.invoke("atlas-desktop:get-snapshot", request);
  },
  setOnboardingDraft(draft: string): Promise<{ ok: true }> {
    return ipcRenderer.invoke("atlas-desktop:set-onboarding-draft", { draft });
  },
  setProductDraft(draft: string): Promise<{ ok: true }> {
    return ipcRenderer.invoke("atlas-desktop:set-product-draft", { draft });
  },
  setProductComposerFocus(focused: boolean): Promise<{ ok: true }> {
    return ipcRenderer.invoke("atlas-desktop:set-product-composer-focus", { focused });
  },
  submitClarification(objective: string): Promise<AtlasDesktopClarificationResult> {
    return ipcRenderer.invoke("atlas-desktop:submit-clarification", { objective });
  },
});
