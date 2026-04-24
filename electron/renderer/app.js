import { getDesktopLayoutMode } from "./layout.js";

const bootstrapState = {
  saveTimer: null,
};

const statusEl = document.querySelector("[data-role='status']");
const detailEl = document.querySelector("[data-role='detail']");
const formEl = document.querySelector("[data-role='form']");
const objectiveEl = document.querySelector("[data-role='objective']");
const errorEl = document.querySelector("[data-role='error']");
const repoEl = document.querySelector("[data-role='repo']");
const sessionEl = document.querySelector("[data-role='session']");
const shellEl = document.querySelector("[data-role='shell']");
const openButtonEl = formEl?.querySelector("button");

function setBusy(isBusy) {
  openButtonEl?.toggleAttribute("disabled", isBusy);
  objectiveEl?.toggleAttribute("disabled", isBusy);
}

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

async function persistDraft(value) {
  if (!window.atlasDesktop?.setOnboardingDraft) {
    return;
  }

  try {
    await window.atlasDesktop.setOnboardingDraft(value);
  } catch (error) {
    console.error("[atlas] onboarding draft save failed:", error);
    setStatus(
      "Draft save failed. Keep working locally and retry when the shell is responsive again.",
      String(error?.message || error || ""),
    );
  }
}

function queueDraftSave() {
  if (!objectiveEl) {
    return;
  }

  if (bootstrapState.saveTimer) {
    clearTimeout(bootstrapState.saveTimer);
  }
  bootstrapState.saveTimer = window.setTimeout(() => {
    bootstrapState.saveTimer = null;
    persistDraft(String(objectiveEl.value || ""));
  }, 180);
}

async function bootstrap() {
  if (!window.atlasDesktop?.getBootstrap) {
    throw new Error("ATLAS desktop bridge is unavailable.");
  }

  const bootstrapData = await window.atlasDesktop.getBootstrap();
  if (repoEl) {
    repoEl.textContent = bootstrapData.targetRepo || "Target repo";
  }
  if (sessionEl) {
    sessionEl.textContent = bootstrapData.sessionId;
  }
  if (shellEl) {
    shellEl.textContent = ".\\ATLAS.cmd";
  }
  if (objectiveEl && bootstrapData.onboardingDraft) {
    objectiveEl.value = bootstrapData.onboardingDraft;
  }

  if (bootstrapData.onboardingDraft) {
    setStatus(
      "Restored the saved onboarding draft for this desktop session.",
      "Refine the objective, then store one clarification packet before the workspace opens.",
    );
    return;
  }

  setStatus(
    "Planning stays locked until this desktop session stores one clarification packet.",
    "Describe the delivery outcome in plain English. ATLAS will persist the packet and switch into the desktop workspace.",
  );
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!window.atlasDesktop?.submitClarification || !objectiveEl || !errorEl) {
    throw new Error("ATLAS desktop clarification bridge is unavailable.");
  }

  const objective = String(objectiveEl.value || "").trim();
  errorEl.textContent = "";
  if (!objective) {
    errorEl.textContent = "Describe the outcome you want before opening the workspace.";
    setStatus(
      "The desktop handoff is still blocked.",
      "Add one concrete objective so ATLAS can store the clarification packet.",
    );
    objectiveEl.focus();
    return;
  }

  setBusy(true);
  setStatus(
    "Storing the clarification packet for this desktop session.",
    "The native shell will open the workspace as soon as the packet is recorded.",
  );

  try {
    const result = await window.atlasDesktop.submitClarification(objective);
    if (!result.ok) {
      errorEl.textContent = result.error || "ATLAS could not complete the clarification request.";
      setStatus(
        "The desktop handoff is still blocked.",
        "Review the error, keep the draft, and try again after the provider is available.",
      );
      return;
    }

    setStatus(
      "Clarification stored. Opening the ATLAS workspace in this window.",
      `Session ${result.packet.sessionId} is moving into the live product surface.`,
    );
  } catch (error) {
    console.error("[atlas] onboarding submit failed:", error);
    errorEl.textContent = String(error?.message || error || "ATLAS could not complete the clarification request.");
    setStatus(
      "The desktop handoff is still blocked.",
      "Review the shell logs, then retry the clarification request.",
    );
  } finally {
    setBusy(false);
  }
}

formEl?.addEventListener("submit", (event) => {
  handleSubmit(event).catch((error) => {
    console.error("[atlas] onboarding form handler failed:", error);
    if (errorEl) {
      errorEl.textContent = String(error?.message || error || "ATLAS could not complete the clarification request.");
    }
    setStatus(
      "The desktop handoff is still blocked.",
      "The native shell could not process the onboarding request.",
    );
    setBusy(false);
  });
});

objectiveEl?.addEventListener("input", () => {
  queueDraftSave();
});

window.addEventListener("resize", setLayoutMode);
setLayoutMode();

bootstrap().catch((error) => {
  console.error("[atlas] onboarding bootstrap failed:", error);
  if (errorEl) {
    errorEl.textContent = String(error?.message || error || "ATLAS desktop bootstrap failed.");
  }
  setStatus(
    "The desktop handoff is still blocked.",
    "ATLAS could not read the bootstrap state for this session.",
  );
});
