import { contextBridge, ipcRenderer } from "electron";

interface AtlasDesktopBootstrap {
  sessionId: string;
  serverUrl: string;
  targetRepo: string;
}

interface AtlasDesktopPacket {
  summary: string;
  openQuestions: string[];
  executionNotes: string[];
}

contextBridge.exposeInMainWorld("atlasDesktop", {
  getBootstrap(): Promise<AtlasDesktopBootstrap> {
    return ipcRenderer.invoke("atlas-desktop:get-bootstrap");
  },
  submitClarification(objective: string): Promise<{ ok: boolean; packet?: AtlasDesktopPacket; error?: string }> {
    return ipcRenderer.invoke("atlas-desktop:submit-clarification", { objective });
  },
});
