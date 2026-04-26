import { getDesktopLayoutMode } from "./layout.js";

const statusEl = document.querySelector("[data-role='status']");
const detailEl = document.querySelector("[data-role='detail']");
const errorEl = document.querySelector("[data-role='error']");
const workspaceUrlEl = document.querySelector("[data-role='workspace-url']");

function setLayoutMode() {
  document.body.dataset.layout = getDesktopLayoutMode(window.innerWidth);
}

function setStatus(message, detail = "") {
  if (statusEl) {
    statusEl.textContent = message;
  }
  if (detailEl) {
    detailEl.textContent = detail;
  }
}

function buildWorkspaceUrl(bootstrapData, workspaceState) {
  const workspaceUrl = new URL("/", bootstrapData.serverUrl);
  const focusedSessionRole = String(workspaceState?.focusedSessionRole || "").trim();
  if (focusedSessionRole) {
    workspaceUrl.searchParams.set("focusRole", focusedSessionRole);
  }
  return workspaceUrl.toString();
}

async function bootstrap() {
  if (!window.atlasDesktop?.getBootstrap) {
    throw new Error("ATLAS desktop bridge is unavailable.");
  }

  const bootstrapData = await window.atlasDesktop.getBootstrap();
  const workspaceState = window.atlasDesktop?.getWorkspaceState
    ? await window.atlasDesktop.getWorkspaceState()
    : null;
  const workspaceUrl = buildWorkspaceUrl(bootstrapData, workspaceState);

  if (workspaceUrlEl) {
    workspaceUrlEl.textContent = workspaceUrl;
  }

  setStatus(
    "Opening the ATLAS workspace.",
    "ATLAS restores the current desktop route and keeps the native shell on the same workspace surface.",
  );
  window.location.replace(workspaceUrl);
}

window.addEventListener("resize", setLayoutMode);
setLayoutMode();

bootstrap().catch((error) => {
  console.error("[atlas] workspace bootstrap failed:", error);
  if (errorEl) {
    errorEl.textContent = String(error?.message || error || "ATLAS desktop workspace startup failed.");
  }
  setStatus(
    "Workspace startup failed.",
    "ATLAS could not restore the workspace route from the desktop bridge.",
  );
});
