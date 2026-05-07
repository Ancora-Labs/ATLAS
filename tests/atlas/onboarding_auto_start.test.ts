import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import type { IncomingMessage, ServerResponse } from "node:http";

import { handleAtlasOnboardingRequest } from "../../src/atlas/routes/onboarding.js";
import { listAtlasDesktopSessions, type AtlasDesktopSessionRecord } from "../../src/atlas/desktop_sessions.js";

function createJsonPostRequest(payload: unknown): IncomingMessage {
  const req = Readable.from([JSON.stringify(payload)]) as unknown as IncomingMessage;
  req.method = "POST";
  return req;
}

function createResponseCapture(): {
  res: ServerResponse;
  getBody: () => string;
  getStatusCode: () => number;
} {
  let body = "";
  let statusCode = 200;
  const res = {
    writeHead(code: number) {
      statusCode = code;
      return this;
    },
    end(chunk?: string) {
      body = chunk || "";
      return this;
    },
  } as unknown as ServerResponse;
  return {
    res,
    getBody: () => body,
    getStatusCode: () => statusCode,
  };
}

describe("atlas onboarding auto-start", () => {
  it("promotes native onboarding completion into a ready session and queues the build", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-onboarding-auto-start-"));
    let queuedSession: AtlasDesktopSessionRecord | null = null;
    const { res, getBody, getStatusCode } = createResponseCapture();

    await handleAtlasOnboardingRequest(
      createJsonPostRequest({ objective: "Build a bold Cheetos landing page." }),
      res,
      {
        stateDir,
        sessionId: "desktop-session-1",
        targetRepo: "acme/cheetos-site",
        clarificationCommand: "mock-clarifier",
        clarificationRunner: async () => JSON.stringify({
          summary: "Cheetos landing page ready for delivery.",
          operatorIntentBrief: "Build a bold Cheetos landing page with a product-first visual hierarchy.",
          openQuestions: ["Which flavor should lead the hero?"],
          executionNotes: ["Keep the product pack visible in the first viewport."],
          attachmentPlans: [],
        }),
        queueBuildForSession: async ({ session }) => {
          queuedSession = session;
          return {
            sessionId: session.id,
            triggerState: "queued",
          };
        },
      },
    );

    assert.equal(getStatusCode(), 200);
    const payload = JSON.parse(getBody()) as {
      ok: boolean;
      ready: boolean;
      sessionId: string;
      session: AtlasDesktopSessionRecord;
      buildRequest: { sessionId: string; triggerState: string };
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.ready, true);
    assert.equal(payload.sessionId, "desktop-session-1");
    assert.equal(payload.session.status, "ready");
    assert.equal(payload.buildRequest.sessionId, "desktop-session-1");
    assert.equal(payload.buildRequest.triggerState, "queued");
    assert.equal(queuedSession?.id, "desktop-session-1");
    assert.equal(queuedSession?.status, "ready");
    assert.ok(queuedSession?.executionNotes.some((note) => /Which flavor should lead the hero/i.test(note)));

    const sessions = await listAtlasDesktopSessions(stateDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.id, "desktop-session-1");
    assert.equal(sessions[0]?.status, "ready");
  });

  it("does not queue onboarding when no repository context is available", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-onboarding-no-repo-"));
    let queueCalled = false;
    const { res, getBody, getStatusCode } = createResponseCapture();

    await handleAtlasOnboardingRequest(
      createJsonPostRequest({ objective: "Build a landing page." }),
      res,
      {
        stateDir,
        sessionId: "desktop-session-missing-repo",
        clarificationRunner: async () => JSON.stringify({
          summary: "Landing page ready.",
          operatorIntentBrief: "Build a landing page.",
          openQuestions: ["Which audience should it target?"],
          executionNotes: ["Collect the audience before delivery."],
          attachmentPlans: [],
        }),
        queueBuildForSession: async ({ session }) => {
          queueCalled = true;
          return { sessionId: session.id };
        },
      },
    );

    assert.equal(getStatusCode(), 400);
    const payload = JSON.parse(getBody()) as { ok: boolean; code: string };
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "missing_repo_context");
    assert.equal(queueCalled, false);
  });
});