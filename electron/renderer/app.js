import { getDesktopLayoutMode } from "./layout.js";

const statusEl = document.querySelector("[data-role='status']");
const formEl = document.querySelector("[data-role='form']");
const objectiveEl = document.querySelector("[data-role='objective']");
const errorEl = document.querySelector("[data-role='error']");
const repoEl = document.querySelector("[data-role='repo']");
const sessionEl = document.querySelector("[data-role='session']");
const shellEl = document.querySelector("[data-role='shell']");

function setBusy(isBusy) {
  if (!formEl) return;
  formEl.querySelector("button")?.toggleAttribute("disabled", isBusy);
  if (objectiveEl) {
    objectiveEl.toggleAttribute("disabled", isBusy);
  }
}

function updateLayout() {
  document.body.dataset.layout = getDesktopLayoutMode(window.innerWidth);
}

async function bootstrap() {
  if (!window.atlasDesktop) {
    return;
  }

  const bootstrapData = await window.atlasDesktop.getBootstrap();
  if (repoEl) repoEl.textContent = bootstrapData.targetRepo || "Target repo";
  if (sessionEl) sessionEl.textContent = bootstrapData.sessionId;
  if (shellEl) shellEl.textContent = ".\\ATLAS.cmd";
  if (statusEl) {
    statusEl.textContent = "Planning remains locked until this desktop session stores one clarification packet.";
  }
}

formEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!window.atlasDesktop || !objectiveEl || !errorEl || !statusEl) {
    return;
  }

  const objective = String(objectiveEl.value || "").trim();
  errorEl.textContent = "";
  statusEl.textContent = "Requesting one clarification pass from the configured AI provider...";

  setBusy(true);
  const result = await window.atlasDesktop.submitClarification(objective);
  setBusy(false);

  if (!result.ok) {
    errorEl.textContent = result.error || "ATLAS could not complete the clarification request.";
    statusEl.textContent = "The desktop handoff is still blocked. Fix the clarification error and try again.";
    return;
  }

  statusEl.textContent = "Clarification stored. ATLAS is opening the planning surface inside the desktop window.";
});

window.addEventListener("resize", updateLayout);
updateLayout();
bootstrap().catch((error) => {
  if (errorEl) {
    errorEl.textContent = String(error?.message || error);
  }
});
