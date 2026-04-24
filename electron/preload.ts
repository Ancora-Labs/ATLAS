import { contextBridge, ipcRenderer } from "electron";

import type { AtlasClarificationPacket } from "../src/atlas/clarification.js";
import type { AtlasDesktopBootstrap } from "../src/atlas/desktop_state.js";

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
  setOnboardingDraft(draft: string): Promise<{ ok: true }> {
    return ipcRenderer.invoke("atlas-desktop:set-onboarding-draft", { draft });
  },
  submitClarification(objective: string): Promise<AtlasDesktopClarificationResult> {
    return ipcRenderer.invoke("atlas-desktop:submit-clarification", { objective });
  },
});
