type CliTargetSessionSelectionInput = {
  existingSelectedSession?: unknown;
  keepActiveRequested?: boolean;
  selectRequested?: boolean;
  replaceActiveRequested?: boolean;
  context?: string | null;
};

export function resolveCliTargetSessionSelection(input: CliTargetSessionSelectionInput): boolean {
  const keepActiveRequested = input?.keepActiveRequested === true;
  const forceSelectRequested = input?.selectRequested === true || input?.replaceActiveRequested === true;
  const hasExistingSelectedSession = Boolean(input?.existingSelectedSession);
  const contextLabel = String(input?.context || "target session command").trim() || "target session command";

  if (keepActiveRequested && forceSelectRequested) {
    throw new Error(`${contextLabel} cannot combine --keep-active with --select or --replace-active`);
  }

  if (keepActiveRequested && hasExistingSelectedSession) {
    return false;
  }

  return true;
}