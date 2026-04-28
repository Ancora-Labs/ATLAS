import { archiveTargetSession, loadActiveTargetSession, TARGET_SESSION_STAGE } from "./target_session_state.js";

export async function archiveActiveSessionForFreshActivation(config: any, options: {
  reason?: string | null;
  completionSummary?: string | null;
} = {}) {
  const activeSession = await loadActiveTargetSession(config);
  if (!activeSession) {
    return null;
  }

  return archiveTargetSession(config, {
    completionStage: TARGET_SESSION_STAGE.COMPLETED,
    completionReason: options.reason || "activate_auto_replaced_existing_session",
    completionSummary: options.completionSummary
      || "Activation opened a fresh target session and automatically archived the previous one.",
  });
}