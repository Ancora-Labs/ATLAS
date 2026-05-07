import { contextBridge, ipcRenderer } from "electron";

interface AtlasDesktopBootstrap {
  sessionId: string;
  serverUrl: string;
  targetRepo: string;
  onboardingDraft: string;
  repoContext: {
    provider: "github";
    targetRepo: string;
    targetBaseBranch: string | null;
    repoMode: "existing" | "new";
    repoCreatedByAtlas: boolean;
  } | null;
}

async function submitClarification(objective: string): Promise<{ ok: boolean; packet?: unknown; error?: string }> {
  const bootstrap = await ipcRenderer.invoke("atlas-desktop:get-bootstrap") as AtlasDesktopBootstrap;
  const response = await fetch(new URL("/api/onboarding/clarify", bootstrap.serverUrl).toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ objective }),
  });

  try {
    return await response.json() as { ok: boolean; packet?: unknown; error?: string };
  } catch {
    return {
      ok: false,
      error: "ATLAS returned an invalid clarification response.",
    };
  }
}

contextBridge.exposeInMainWorld("atlasDesktop", {
  getBootstrap(): Promise<AtlasDesktopBootstrap> {
    return ipcRenderer.invoke("atlas-desktop:get-bootstrap");
  },
  submitClarification,
});