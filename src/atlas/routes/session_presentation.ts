import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { listAtlasCompletedSessions, type AtlasCompletedSessionPresentation } from "../completed_sessions.js";
import { readJson, writeJson } from "../../core/fs_utils.js";
import { rerunCompletedTargetPresentation } from "../../core/target_success_contract.js";
import { getTargetCompletionPath } from "../../core/target_session_state.js";
import { resolveAtlasRuntimeStateDir } from "../runtime_state_root.js";

export interface AtlasSessionPresentationRouteOptions {
  stateDir: string;
}

interface AtlasSessionPresentationPayload {
  projectId?: string;
  sessionId?: string;
}

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parsePayload(body: string): AtlasSessionPresentationPayload {
  try {
    return JSON.parse(body || "{}") as AtlasSessionPresentationPayload;
  } catch (error) {
    throw new Error(`Presentation refresh payload is not valid JSON: ${String((error as Error)?.message || error)}`, { cause: error });
  }
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function parseLocalhostPort(target: string | null): number | null {
  if (!target) return null;
  try {
    const parsed = new URL(target);
    if (!/^localhost$|^127\.0\.0\.1$/i.test(parsed.hostname)) {
      return null;
    }
    const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

function shouldPreferArchivedPresentation(
  completionRecord: Record<string, unknown>,
  archivedPresentation: AtlasCompletedSessionPresentation | null,
): boolean {
  if (!archivedPresentation) return false;
  const currentPresentation = completionRecord.presentation && typeof completionRecord.presentation === "object"
    ? completionRecord.presentation as Record<string, unknown>
    : null;
  const currentDelivery = completionRecord.delivery && typeof completionRecord.delivery === "object"
    ? completionRecord.delivery as Record<string, unknown>
    : null;
  const currentSource = normalizeOptionalString(currentPresentation?.resolutionSource)
    || normalizeOptionalString(currentDelivery?.resolutionSource);
  const archivedSource = normalizeOptionalString(archivedPresentation.resolutionSource);
  if (!currentPresentation && !currentDelivery) return true;
  return currentSource === "fallback_evidence_only" && archivedSource !== "fallback_evidence_only";
}

function buildDeliverySeed(
  completionRecord: Record<string, unknown>,
  archivedPresentation: AtlasCompletedSessionPresentation | null,
): Record<string, unknown> | null {
  if (!shouldPreferArchivedPresentation(completionRecord, archivedPresentation)) {
    const persistedDelivery = (completionRecord.presentation || completionRecord.delivery);
    return persistedDelivery && typeof persistedDelivery === "object"
      ? persistedDelivery as Record<string, unknown>
      : null;
  }

  if (!archivedPresentation) return null;
  const primaryLocation = normalizeOptionalString(archivedPresentation.primaryLocation);
  const openTarget = normalizeOptionalString(archivedPresentation.openTarget);
  const finalTarget = normalizeOptionalString(archivedPresentation.finalTarget)
    || primaryLocation
    || openTarget;
  const executionMode = normalizeOptionalString(archivedPresentation.executionMode)
    || (openTarget && /^https?:\/\//i.test(openTarget) ? "open_url" : "document_only");
  const preferredPort = executionMode === "serve_and_open"
    ? parseLocalhostPort(openTarget)
    : null;
  const staticRoot = executionMode === "serve_and_open" && primaryLocation && !/^https?:\/\//i.test(primaryLocation)
    ? path.dirname(primaryLocation)
    : null;

  return {
    status: normalizeOptionalString(archivedPresentation.status),
    locationType: normalizeOptionalString(archivedPresentation.locationType),
    primaryLocation,
    openTarget,
    userMessage: normalizeOptionalString(archivedPresentation.userMessage),
    thinkingSummary: normalizeOptionalString(archivedPresentation.thinkingSummary),
    resolutionSource: normalizeOptionalString(archivedPresentation.resolutionSource),
    execution: {
      mode: executionMode,
      target: finalTarget,
      staticRoot,
      preferredPort,
    },
  };
}

async function appendCompletedSessionRefreshRecord(
  runtimeStateDir: string,
  record: Record<string, unknown>,
): Promise<void> {
  const archiveDir = path.join(runtimeStateDir, "archive");
  const archiveLogPath = path.join(archiveDir, "completed_with_handoff_sessions.jsonl");
  const archiveRecord = {
    projectId: normalizeOptionalString(record.projectId),
    sessionId: normalizeOptionalString(record.sessionId),
    finalStatus: normalizeOptionalString(record.finalStatus) || normalizeOptionalString(record.status) || "completed",
    repoUrl: normalizeOptionalString(record.repoUrl),
    objective: normalizeOptionalString(record.objective) || normalizeOptionalString(record.objectiveSummary),
    workspacePath: normalizeOptionalString(record.workspacePath),
    archivedAt: new Date().toISOString(),
    completionReason: normalizeOptionalString(record.completionReason) || "target_presentation_refresh",
    completionSummary: normalizeOptionalString(record.completionSummary) || normalizeOptionalString(record.summary),
    unresolvedItems: Array.isArray(record.unresolvedItems) ? record.unresolvedItems : [],
    presentation: record.presentation && typeof record.presentation === "object" ? record.presentation : null,
    presentationAutoOpen: record.presentationAutoOpen && typeof record.presentationAutoOpen === "object"
      ? record.presentationAutoOpen
      : null,
  };

  await fs.mkdir(archiveDir, { recursive: true });
  await fs.appendFile(archiveLogPath, `${JSON.stringify(archiveRecord)}\n`, "utf8");
}

function buildPresentationResponse(record: Record<string, unknown>) {
  const presentation = record.presentation && typeof record.presentation === "object"
    ? record.presentation as Record<string, unknown>
    : null;
  const autoOpen = record.presentationAutoOpen && typeof record.presentationAutoOpen === "object"
    ? record.presentationAutoOpen as Record<string, unknown>
    : null;
  const autoExecution = autoOpen?.execution && typeof autoOpen.execution === "object"
    ? autoOpen.execution as Record<string, unknown>
    : null;
  const execution = presentation?.execution && typeof presentation.execution === "object"
    ? presentation.execution as Record<string, unknown>
    : null;
  const target = normalizeOptionalString(autoExecution?.finalTarget)
    || normalizeOptionalString(presentation?.openTarget)
    || normalizeOptionalString(presentation?.primaryLocation);
  const action = normalizeOptionalString(execution?.mode)
    || normalizeOptionalString(presentation?.locationType)
    || (target ? "open_url" : "document_only");
  const autoOpenStatus = autoOpen
    ? autoOpen.opened === true
      ? "opened"
      : autoOpen.attempted === true
        ? "attempted"
        : "skipped"
    : null;

  return {
    projectId: normalizeOptionalString(record.projectId),
    sessionId: normalizeOptionalString(record.sessionId),
    openTarget: target,
    openTargetIsUrl: /^https?:\/\//i.test(String(target || "")),
    presenterSummary: normalizeOptionalString(presentation?.userMessage)
      || normalizeOptionalString(presentation?.thinkingSummary)
      || normalizeOptionalString(record.completionSummary),
    action,
    decisionSource: normalizeOptionalString(presentation?.resolutionSource),
    autoOpenStatus,
    autoOpenReason: normalizeOptionalString(autoOpen?.reason),
  };
}

export async function handleAtlasSessionPresentationRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AtlasSessionPresentationRouteOptions,
): Promise<void> {
  if (String(req.method || "POST").toUpperCase() !== "POST") {
    writeJsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    const payload = parsePayload(await readRequestBody(req));
    const projectId = normalizeOptionalString(payload.projectId);
    const sessionId = normalizeOptionalString(payload.sessionId);
    if (!projectId || !sessionId) {
      writeJsonResponse(res, 400, { ok: false, error: "Project id and session id are required." });
      return;
    }

    const runtimeStateDir = await resolveAtlasRuntimeStateDir(options.stateDir);
    const completionPath = getTargetCompletionPath(runtimeStateDir, projectId, sessionId);
    const completionRecord = await readJson(completionPath, null);
    if (!completionRecord || typeof completionRecord !== "object") {
      writeJsonResponse(res, 404, { ok: false, error: "Completed session record was not found." });
      return;
    }
    const completedSessions = await listAtlasCompletedSessions(runtimeStateDir);
    const archivedSession = completedSessions.find((record) => record.projectId === projectId && record.sessionId === sessionId) || null;
    const deliverySeed = buildDeliverySeed(completionRecord as Record<string, unknown>, archivedSession?.presentation || null);

    const replay = await rerunCompletedTargetPresentation(
      { paths: { stateDir: runtimeStateDir } },
      {
        projectId,
        sessionId,
        status: normalizeOptionalString((completionRecord as Record<string, unknown>).finalStatus)
          || normalizeOptionalString((completionRecord as Record<string, unknown>).status),
        summary: normalizeOptionalString((completionRecord as Record<string, unknown>).completionSummary)
          || normalizeOptionalString((completionRecord as Record<string, unknown>).summary),
        repoUrl: normalizeOptionalString((completionRecord as Record<string, unknown>).repoUrl),
        workspacePath: normalizeOptionalString((completionRecord as Record<string, unknown>).workspacePath),
        objectiveSummary: normalizeOptionalString((completionRecord as Record<string, unknown>).objective)
          || normalizeOptionalString((completionRecord as Record<string, unknown>).objectiveSummary),
        delivery: deliverySeed,
      },
    );

    const previousPresentation = (completionRecord as Record<string, unknown>).presentation;
    const nextRecord = {
      ...(completionRecord as Record<string, unknown>),
      completionSummary: replay.summary || (completionRecord as Record<string, unknown>).completionSummary || null,
      delivery: replay.delivery,
      presentation: {
        ...(previousPresentation && typeof previousPresentation === "object"
          ? previousPresentation as Record<string, unknown>
          : {}),
        ...(replay.delivery && typeof replay.delivery === "object" ? replay.delivery : {}),
        openTarget: normalizeOptionalString((replay.autoOpen as any)?.execution?.finalTarget)
          || normalizeOptionalString((replay.delivery as any)?.openTarget)
          || normalizeOptionalString((replay.delivery as any)?.primaryLocation),
        userMessage: normalizeOptionalString(replay.summary) || normalizeOptionalString((replay.delivery as any)?.userMessage),
      },
      presentationAutoOpen: replay.autoOpen,
    };

    await writeJson(completionPath, nextRecord);
    await appendCompletedSessionRefreshRecord(runtimeStateDir, nextRecord as Record<string, unknown>);

    writeJsonResponse(res, 200, {
      ok: true,
      message: replay.autoOpen?.opened === true
        ? "Presenter AI finished thinking. Open Target refreshed and launched again for this completed session."
        : "Presenter AI finished thinking. Open Target refreshed for this completed session.",
      presentation: buildPresentationResponse(nextRecord),
    });
  } catch (error) {
    console.error(`[atlas] session presentation refresh failed: ${String((error as Error)?.message || error)}`);
    writeJsonResponse(res, 500, {
      ok: false,
      error: String((error as Error)?.message || error) || "ATLAS could not refresh this completed presentation.",
    });
  }
}