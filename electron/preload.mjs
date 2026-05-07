import { contextBridge, ipcRenderer } from "electron";

async function submitClarification(objective) {
  const bootstrap = await ipcRenderer.invoke("atlas-desktop:get-bootstrap");
  const response = await fetch(new URL("/api/onboarding/clarify", bootstrap.serverUrl).toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ objective }),
  });

  try {
    return await response.json();
  } catch {
    return {
      ok: false,
      error: "ATLAS returned an invalid clarification response.",
    };
  }
}

contextBridge.exposeInMainWorld("atlasDesktop", {
  getBootstrap: () => ipcRenderer.invoke("atlas-desktop:get-bootstrap"),
  submitClarification,
});
