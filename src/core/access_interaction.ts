function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((entry) => String(entry || "").trim()).filter(Boolean))];
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

export function shouldEnableInteractiveAccessResolution(config: any): boolean {
  return (
    String(config?.platformModeState?.currentMode || "").trim().toLowerCase() === "single_target_delivery"
    && Boolean(config?.activeTargetSession?.sessionId)
  );
}

function summarizeKnownAccessNeeds(activeTargetSession: any) {
  return {
    requiredNow: normalizeStringArray(activeTargetSession?.prerequisites?.requiredNow),
    requiredLater: normalizeStringArray(activeTargetSession?.prerequisites?.requiredLater),
    optional: normalizeStringArray(activeTargetSession?.prerequisites?.optional),
  };
}

export function buildInteractiveAccessPromptSection(input: {
  actor: "prometheus" | "worker" | "onboarding";
  activeTargetSession?: any;
  task?: string | null;
  acceptanceCriteria?: unknown;
}): string {
  const actor = String(input?.actor || "worker").trim().toLowerCase();
  const activeTargetSession = input?.activeTargetSession;
  const accessNeeds = summarizeKnownAccessNeeds(activeTargetSession);
  const acceptanceCriteria = normalizeStringArray(input?.acceptanceCriteria);
  const task = normalizeNullableString(input?.task);

  const parts: string[] = [];
  parts.push("## INTERACTIVE ACCESS RESOLUTION");
  parts.push("If external service access is required, do NOT end this run and do NOT defer to a later call by default.");
  parts.push("Stay inside the current agent call, explain the missing access, tell the operator the exact setup step, wait for the operator to complete it, verify the fix, and then continue in the same call.");
  parts.push("Reason from repo evidence and feature scope, not from a small hardcoded vendor list.");
  parts.push("Inspect any relevant external-system shape, including databases, deployment platforms, auth providers, billing/webhook systems, monitoring systems, storage/caches/queues, private registries, cloud control surfaces, and custom internal services.");

  if (task) {
    parts.push(`Current task focus: ${task}`);
  }
  if (acceptanceCriteria.length > 0) {
    parts.push(`Acceptance criteria to consider when inferring access needs: ${acceptanceCriteria.join(" | ")}`);
  }

  if (accessNeeds.requiredNow.length > 0 || accessNeeds.requiredLater.length > 0 || accessNeeds.optional.length > 0) {
    parts.push("Known access notes from the current target session:");
    parts.push(`- requiredNow: ${accessNeeds.requiredNow.join(", ") || "none"}`);
    parts.push(`- requiredLater: ${accessNeeds.requiredLater.join(", ") || "none"}`);
    parts.push(`- optional: ${accessNeeds.optional.join(", ") || "none"}`);
  }

  parts.push("When access is missing, explicitly state:");
  parts.push("1. What exact service or access class is missing.");
  parts.push("2. Why the current task or planning step needs it.");
  parts.push("3. The preferred setup path.");
  parts.push("4. An alternative setup path if available.");
  parts.push("5. The exact command, env var, file, or placement step.");
  parts.push("6. That the operator should reply with `done` after completing the step.");
  parts.push("7. That you will run a short non-destructive verification and continue immediately if it passes.");

  if (actor === "prometheus") {
    parts.push("As Prometheus, you are the primary early detector before planning, but not the final authority. Catch likely access needs early, and continue planning after verification.");
  } else if (actor === "worker") {
    parts.push("As a worker, you are the runtime fallback detector. If planning missed an access requirement, recover it here in-call and then continue implementation.");
  } else {
    parts.push("As the onboarding layer, sweep project-wide access readiness first and resolve operator-fixable issues in-call before moving deeper into delivery setup.");
  }

  return parts.join("\n");
}