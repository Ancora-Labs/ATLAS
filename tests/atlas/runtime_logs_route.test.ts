import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { IncomingMessage, ServerResponse } from "node:http";

import { handleAtlasRuntimeLogsRequest } from "../../src/atlas/routes/runtime_logs.js";
import { startAtlasDesktopSession } from "../../src/atlas/desktop_sessions.js";

const repoContext = {
  provider: "github" as const,
  targetRepo: "acme/restaurant-site",
  targetBaseBranch: "main",
  repoMode: "new" as const,
  repoCreatedByAtlas: true,
};

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

async function createReadyDesktopSession(stateDir: string) {
  return startAtlasDesktopSession({
    stateDir,
    repoContext,
    message: "Build a premium restaurant landing page.",
    clarificationCommand: "mock-clarifier",
    clarificationRunner: async () => JSON.stringify({
      summary: "Restaurant landing page ready for planning.",
      operatorIntentBrief: "Build a premium restaurant landing page and preserve the operator-approved hero direction before planning.",
      openQuestions: ["Which hero direction should ATLAS keep?"],
      executionNotes: ["Capture the operator-approved hero direction before planning."],
      attachmentPlans: [],
    }),
  });
}

describe("atlas runtime logs route", () => {
  it("does not fall back to the global runtime stream when a specific session is requested", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-logs-"));
    const session = await createReadyDesktopSession(stateDir);
    await fs.writeFile(path.join(stateDir, "live_agents.log"), "global runtime line\n", "utf8");

    const { res, getBody, getStatusCode } = createResponseCapture();
    await handleAtlasRuntimeLogsRequest(
      {
        method: "GET",
        url: `/api/runtime/logs?sessionId=${encodeURIComponent(session.id)}`,
      } as IncomingMessage,
      res,
      { stateDir },
    );

    assert.equal(getStatusCode(), 200);
    const payload = JSON.parse(getBody()) as {
      ok: boolean;
      sessionId: string | null;
      groups: Array<{ label: string; content: string }>;
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.sessionId, session.id);
    assert.deepEqual(payload.groups, []);
  });

  it("keeps the global runtime fallback only for the unfocused live runtime view", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-runtime-global-"));
    await fs.writeFile(path.join(stateDir, "live_agents.log"), "global runtime line\n", "utf8");

    const { res, getBody, getStatusCode } = createResponseCapture();
    await handleAtlasRuntimeLogsRequest(
      {
        method: "GET",
        url: "/api/runtime/logs",
      } as IncomingMessage,
      res,
      { stateDir },
    );

    assert.equal(getStatusCode(), 200);
    const payload = JSON.parse(getBody()) as {
      ok: boolean;
      groups: Array<{ label: string; content: string }>;
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.groups.length, 1);
    assert.equal(payload.groups[0]?.label, "Runtime stream");
    assert.match(payload.groups[0]?.content || "", /global runtime line/i);
  });
});