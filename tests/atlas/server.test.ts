import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { ATLAS_DEFAULT_PORT, createAtlasServer, startAtlasServer } from "../../src/atlas/server.ts";
import { ATLAS_SNAPSHOT_TOKEN_HEADER } from "../../src/atlas/routes/home.ts";

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-server-"));
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function requestText(
  port: number,
  pathname: string,
  method = "GET",
  headers: Record<string, string> = {},
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method,
      headers,
    }, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += String(chunk);
      });
      res.on("end", () => {
        resolve({
          status: Number(res.statusCode || 0),
          text: raw,
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function requestJson(
  port: number,
  pathname: string,
  payload: unknown,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const rawBody = JSON.stringify(payload);
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(rawBody),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += String(chunk);
      });
      res.on("end", () => {
        resolve({
          status: Number(res.statusCode || 0),
          text: raw,
        });
      });
    });
    req.on("error", reject);
    req.write(rawBody);
    req.end();
  });
}

describe("atlas server", () => {
  let tempRoot = "";
  let stateDir = "";
  let server: http.Server | null = null;
  let port = 0;

  before(async () => {
    tempRoot = await createTempRoot();
    stateDir = path.join(tempRoot, "state");
    await fs.mkdir(stateDir, { recursive: true });

    await fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({
      schemaVersion: 1,
      updatedAt: "2026-04-21T12:00:00.000Z",
      latestCycleId: "cycle-1",
      cycles: {
        "cycle-1": {
          cycleId: "cycle-1",
          updatedAt: "2026-04-21T12:00:00.000Z",
          status: "in_progress",
          workerSessions: {
            Atlas: {
              role: "Atlas",
              status: "idle",
              lastTask: "",
              lastActiveAt: "2026-04-21T11:15:00.000Z",
            },
            "quality-worker": {
              role: "quality-worker",
              status: "working",
              lastTask: "Wire the ATLAS server boundary",
              lastActiveAt: "2026-04-21T12:00:00.000Z",
              workerIdentityLabel: "Server quality worker",
              currentStage: "snapshot_refresh",
              currentStageLabel: "Refreshing snapshot",
              latestMeaningfulAction: "Wired the focused-session contract",
              latestMeaningfulActionAt: "2026-04-21T12:00:30.000Z",
              currentBranch: "feat/server-snapshot",
              createdPRs: ["https://example.com/pr/1"],
              filesTouched: ["src/atlas/server.ts", "src/atlas/routes/sessions.ts"],
              resolvedRole: "quality-worker",
              logicalRole: "quality-worker",
            },
          },
          workerActivity: {
            "quality-worker": [
              {
                at: "2026-04-21T12:00:00.000Z",
                from: "quality-worker",
                status: "working",
                task: "Wired the ATLAS snapshot route",
              },
            ],
          },
          completedTaskIds: [],
        },
      },
    }), "utf8");
    await fs.writeFile(path.join(stateDir, "live_worker_quality-worker.log"), [
      "[leadership_live]",
      "snapshot endpoint ready",
      "focused detail refresh ready",
    ].join("\n"), "utf8");

    await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 85,
      detail: "Serving the ATLAS product shell",
      steps: [],
      updatedAt: "2026-04-21T12:00:00.000Z",
      startedAt: "cycle-1",
    }), "utf8");

    port = await getFreePort();
    server = await startAtlasServer({
      port,
      stateDir,
      targetRepo: "Ancora-Labs/ATLAS",
      hostLabel: "Windows 11 workstation",
      shellCommand: ".\\ATLAS.cmd",
    });
  });

  after(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("defaults the dedicated ATLAS product server to port 8788", () => {
    assert.equal(ATLAS_DEFAULT_PORT, 8788);
  });

  it("honors ATLAS_PORT when no explicit server port is provided", async () => {
    const envPort = await getFreePort();
    const previousPort = process.env.ATLAS_PORT;
    process.env.ATLAS_PORT = String(envPort);

    let envServer: http.Server | null = null;
    try {
      envServer = await startAtlasServer({
        stateDir,
        targetRepo: "Ancora-Labs/Box",
        hostLabel: "Windows 11 workstation",
        shellCommand: ".\\ATLAS.cmd",
      });

      const address = envServer.address();
      assert.ok(address && typeof address === "object");
      assert.equal(address.port, envPort);
    } finally {
      if (previousPort === undefined) {
        delete process.env.ATLAS_PORT;
      } else {
        process.env.ATLAS_PORT = previousPort;
      }
      if (envServer?.listening) {
        await new Promise<void>((resolve) => {
          envServer?.close(() => resolve());
        });
      }
    }
  });

  it("serves the home and sessions routes from the dedicated ATLAS server", async () => {
    const homeResponse = await requestText(port, "/");
    const sessionsResponse = await requestText(port, "/sessions");

    assert.equal(homeResponse.status, 200);
    assert.match(homeResponse.text, /<title>ATLAS Home<\/title>/);
    assert.match(homeResponse.text, /aria-label="ATLAS desktop surface"/);
    assert.match(homeResponse.text, /aria-label="ATLAS session sidebar"/);
    assert.match(homeResponse.text, /aria-label="ATLAS work canvas"/);
    assert.match(homeResponse.text, /What should ATLAS do next\?/);
    assert.match(homeResponse.text, /Focused session detail/);
    assert.match(homeResponse.text, /What should ATLAS do next\?/);
    assert.match(homeResponse.text, /Focused session detail/);
    assert.match(homeResponse.text, /snapshot endpoint ready/);
    assert.match(homeResponse.text, /data-role="product-composer-input"/);
    assert.match(homeResponse.text, /bridge\?\.refreshSnapshot/);
    assert.match(homeResponse.text, /ATLAS snapshot refresh requires the Electron desktop bridge\./);
    assert.doesNotMatch(homeResponse.text, /default browser|localhost page/i);

    assert.equal(sessionsResponse.status, 200);
    assert.match(sessionsResponse.text, /<title>ATLAS Sessions<\/title>/);
    assert.match(sessionsResponse.text, /aria-label="ATLAS desktop surface"/);
    assert.match(sessionsResponse.text, /aria-label="ATLAS desktop sidebar"/);
    assert.match(sessionsResponse.text, /aria-label="ATLAS work canvas"/);
    assert.match(sessionsResponse.text, /Focused session detail/);
    assert.match(sessionsResponse.text, /Readable log excerpt/);
    assert.match(sessionsResponse.text, />ATLAS control</);
    assert.match(sessionsResponse.text, />Quality lane</);
    assert.match(sessionsResponse.text, />2 tracked sessions</);
    assert.match(sessionsResponse.text, />Pause lane</);
    assert.doesNotMatch(sessionsResponse.text, /default browser|localhost page/i);
    assert.doesNotMatch(sessionsResponse.text, /BOX Mission Control/i);
  });

  it("serves a live JSON snapshot that reflects updated session detail and log excerpts", async () => {
    const firstResponse = await requestText(port, "/api/atlas/snapshot?view=sessions&focusRole=quality-worker");
    assert.equal(firstResponse.status, 200);
    const firstPayload = JSON.parse(firstResponse.text) as {
      ok: boolean;
      pageData: {
        pipelineDetail: string;
        sessions: Array<{
          role: string;
          workerIdentityLabel: string;
          currentStageLabel: string;
          latestMeaningfulAction: string;
          latestMeaningfulActionAt: string | null;
          logExcerpt: string[];
          logSource: string | null;
          currentBranch: string | null;
          pullRequests: string[];
          touchedFiles: string[];
          freshnessAt: string | null;
        }>;
      };
    };
    assert.equal(firstPayload.ok, true);
    assert.equal(firstPayload.pageData.sessions[1]?.role, "quality-worker");
    assert.equal(firstPayload.pageData.sessions[1]?.workerIdentityLabel, "Server quality worker");
    assert.equal(firstPayload.pageData.sessions[1]?.currentStageLabel, "Refreshing snapshot");
    assert.equal(firstPayload.pageData.sessions[1]?.currentBranch, "feat/server-snapshot");
    assert.equal(firstPayload.pageData.sessions[1]?.latestMeaningfulAction, "Wired the focused-session contract");
    assert.equal(firstPayload.pageData.sessions[1]?.latestMeaningfulActionAt, "2026-04-21T12:00:30.000Z");
    assert.equal(firstPayload.pageData.sessions[1]?.logExcerpt[0], "snapshot endpoint ready");
    assert.equal(firstPayload.pageData.sessions[1]?.logExcerpt.at(-1), "focused detail refresh ready");
    assert.equal(firstPayload.pageData.sessions[1]?.logSource, "live_worker_quality-worker.log");
    assert.equal(firstPayload.pageData.sessions[1]?.pullRequests[0], "https://example.com/pr/1");
    assert.equal(firstPayload.pageData.sessions[1]?.touchedFiles[0], "src/atlas/server.ts");
    assert.ok(firstPayload.pageData.sessions[1]?.freshnessAt);
    assert.ok(Date.parse(String(firstPayload.pageData.sessions[1]?.freshnessAt || "")) >= Date.parse("2026-04-21T12:00:30.000Z"));

    await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
      stage: "workers_finishing",
      stageLabel: "Workers Finishing",
      percent: 95,
      detail: "Publishing the live refresh contract",
      steps: [],
      updatedAt: "2026-04-21T12:05:00.000Z",
      startedAt: "cycle-1",
    }), "utf8");
    await fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({
      schemaVersion: 1,
      updatedAt: "2026-04-21T12:05:00.000Z",
      latestCycleId: "cycle-1",
      cycles: {
        "cycle-1": {
          cycleId: "cycle-1",
          updatedAt: "2026-04-21T12:05:00.000Z",
          status: "in_progress",
          workerSessions: {
            Atlas: {
              role: "Atlas",
              status: "idle",
              lastTask: "",
              lastActiveAt: "2026-04-21T11:15:00.000Z",
            },
            "quality-worker": {
              role: "quality-worker",
              status: "working",
              lastTask: "Refresh the focused session surface",
              lastActiveAt: "2026-04-21T12:05:00.000Z",
              workerIdentityLabel: "Server quality worker",
              currentStage: "snapshot_refresh",
              currentStageLabel: "Refreshing snapshot",
              latestMeaningfulAction: "Refreshed the focused session surface",
              latestMeaningfulActionAt: "2026-04-21T12:05:30.000Z",
              currentBranch: "feat/live-refresh",
              createdPRs: ["https://example.com/pr/1"],
              filesTouched: ["src/atlas/routes/home.ts", "src/atlas/renderer.ts"],
            },
          },
          workerActivity: {
            "quality-worker": [
              {
                at: "2026-04-21T12:05:00.000Z",
                from: "quality-worker",
                status: "working",
                task: "Refreshed the focused session surface",
              },
            ],
          },
          completedTaskIds: [],
        },
      },
    }), "utf8");
    await fs.writeFile(path.join(stateDir, "live_worker_quality-worker.log"), [
      "[leadership_live]",
      "snapshot endpoint ready",
      "refreshed focused detail and log excerpt",
    ].join("\n"), "utf8");

    const secondResponse = await requestText(port, "/api/atlas/snapshot?view=sessions&focusRole=quality-worker");
    assert.equal(secondResponse.status, 200);
    const secondPayload = JSON.parse(secondResponse.text) as typeof firstPayload;
    assert.equal(secondPayload.pageData.pipelineDetail, "Publishing the live refresh contract");
    assert.equal(secondPayload.pageData.sessions[1]?.currentBranch, "feat/live-refresh");
    assert.equal(secondPayload.pageData.sessions[1]?.latestMeaningfulAction, "Refreshed the focused session surface");
    assert.equal(secondPayload.pageData.sessions[1]?.latestMeaningfulActionAt, "2026-04-21T12:05:30.000Z");
    assert.equal(secondPayload.pageData.sessions[1]?.logExcerpt[0], "snapshot endpoint ready");
    assert.equal(secondPayload.pageData.sessions[1]?.logExcerpt.at(-1), "refreshed focused detail and log excerpt");
    assert.equal(secondPayload.pageData.sessions[1]?.touchedFiles[0], "src/atlas/routes/home.ts");
    assert.ok(Date.parse(String(secondPayload.pageData.sessions[1]?.freshnessAt || "")) >= Date.parse("2026-04-21T12:05:30.000Z"));

    const legacyResponse = await requestText(port, "/api/snapshot?view=sessions&focusRole=quality-worker");
    assert.equal(legacyResponse.status, 200);
  });

  it("rejects desktop snapshot requests without the configured desktop token", async () => {
    const securedPort = await getFreePort();
    const securedServer = await startAtlasServer({
      port: securedPort,
      stateDir,
      targetRepo: "Ancora-Labs/ATLAS",
      desktopSnapshotToken: "desktop-snapshot-token",
    });

    try {
      const blockedResponse = await requestText(securedPort, "/api/atlas/snapshot?view=sessions&focusRole=quality-worker");
      const allowedResponse = await requestText(
        securedPort,
        "/api/atlas/snapshot?view=sessions&focusRole=quality-worker",
        "GET",
        { [ATLAS_SNAPSHOT_TOKEN_HEADER]: "desktop-snapshot-token" },
      );

      assert.equal(blockedResponse.status, 403);
      assert.match(blockedResponse.text, /ATLAS snapshot access denied/);
      assert.equal(allowedResponse.status, 200);
      assert.match(allowedResponse.text, /"ok":true/);
    } finally {
      if (securedServer.listening) {
        await new Promise<void>((resolve) => {
          securedServer.close(() => resolve());
        });
      }
    }
  });

  it("keeps onboarding status session-bound while the home workspace remains available after relaunch", async () => {
    const gatedRoot = await createTempRoot();
    const gatedStateDir = path.join(gatedRoot, "state");
    await fs.mkdir(gatedStateDir, { recursive: true });
    await fs.writeFile(path.join(gatedStateDir, "worker_cycle_artifacts.json"), JSON.stringify({
      schemaVersion: 1,
      updatedAt: "2026-04-21T12:00:00.000Z",
      latestCycleId: "cycle-1",
      cycles: {
        "cycle-1": {
          cycleId: "cycle-1",
          updatedAt: "2026-04-21T12:00:00.000Z",
          status: "in_progress",
          workerSessions: {
            Atlas: {
              role: "Atlas",
              status: "idle",
              lastTask: "Hold the restored desktop focus on the last session surface.",
              lastActiveAt: "2026-04-21T11:15:00.000Z",
            },
          },
          workerActivity: {},
          completedTaskIds: [],
        },
      },
    }), "utf8");
    await fs.writeFile(path.join(gatedStateDir, "pipeline_progress.json"), JSON.stringify({
      stage: "idle",
      stageLabel: "Idle",
      percent: 0,
      detail: "Waiting for onboarding",
      steps: [],
      updatedAt: "2026-04-21T12:00:00.000Z",
      startedAt: "cycle-1",
    }), "utf8");

    const gatedPort = await getFreePort();
    const gatedServer = await startAtlasServer({
      port: gatedPort,
      stateDir: gatedStateDir,
      targetRepo: "Ancora-Labs/ATLAS",
      desktopSessionId: "desktop-session-1",
      clarificationRunner: async () => JSON.stringify({
        summary: "ATLAS should capture one clarification packet before opening the session surface.",
        openQuestions: ["What should the first planning pass optimize for?"],
        executionNotes: ["Persist the packet, then unlock the home surface."],
      }),
    });

    try {
      const blockedHome = await requestText(gatedPort, "/");
      assert.equal(blockedHome.status, 200);
      assert.match(blockedHome.text, /What should ATLAS do next\?/);

      const blockedSessions = await requestText(gatedPort, "/sessions?focusRole=quality-worker");
      assert.equal(blockedSessions.status, 200);
      assert.match(blockedSessions.text, /Focused session detail/);

      const onboardingStatus = await requestText(gatedPort, "/api/onboarding/status");
      assert.equal(onboardingStatus.status, 200);
      assert.match(onboardingStatus.text, /"ready":false/);

      const clarifyResponse = await requestJson(gatedPort, "/api/onboarding/clarify", {
        objective: "Launch ATLAS in a native desktop window with one clarification pass.",
      });
      assert.equal(clarifyResponse.status, 200);
      assert.match(clarifyResponse.text, /"ready":true/);

      const unblockedHome = await requestText(gatedPort, "/");
      assert.equal(unblockedHome.status, 200);
      assert.match(unblockedHome.text, /What should ATLAS do next\?/);
      assert.match(unblockedHome.text, /Focused session detail/);

      const repeatHome = await requestText(gatedPort, "/");
      const repeatOnboardingStatus = await requestText(gatedPort, "/api/onboarding/status");

      assert.equal(repeatHome.status, 200);
      assert.match(repeatHome.text, /data-role="product-composer-input"/);
      assert.doesNotMatch(repeatHome.text, /default browser|localhost page/i);
      assert.equal(repeatOnboardingStatus.status, 200);
      assert.match(repeatOnboardingStatus.text, /"ready":true/);

      const focusedSessions = await requestText(gatedPort, "/sessions?focusRole=atlas");
      assert.equal(focusedSessions.status, 200);
      assert.match(focusedSessions.text, /Focused session detail/);
    } finally {
      if (gatedServer.listening) {
        await new Promise<void>((resolve) => {
          gatedServer.close(() => resolve());
        });
      }
      await fs.rm(gatedRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] keeps onboarding status unready when clarification refresh fails and does not write a packet", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), JSON.stringify({
      schemaVersion: 1,
      updatedAt: "2026-04-25T00:00:00.000Z",
      latestCycleId: "cycle-1",
      cycles: {
        "cycle-1": {
          cycleId: "cycle-1",
          updatedAt: "2026-04-25T00:00:00.000Z",
          status: "in_progress",
          workerSessions: {},
          workerActivity: {},
          completedTaskIds: [],
        },
      },
    }), "utf8");
    await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
      stage: "idle",
      stageLabel: "Idle",
      percent: 0,
      detail: "Waiting for onboarding",
      steps: [],
      updatedAt: "2026-04-25T00:00:00.000Z",
      startedAt: "cycle-1",
    }), "utf8");

    const failedPort = await getFreePort();
    const failedServer = await startAtlasServer({
      port: failedPort,
      stateDir,
      targetRepo: "Ancora-Labs/ATLAS",
      desktopSessionId: "desktop-session-failure",
      clarificationRunner: async () => {
        throw new Error("Clarification provider unavailable.");
      },
    });

    try {
      const clarifyResponse = await requestJson(failedPort, "/api/onboarding/clarify", {
        objective: "Refresh the ATLAS desktop brief after relaunch.",
      });
      const blockedHome = await requestText(failedPort, "/");
      const onboardingStatus = await requestText(failedPort, "/api/onboarding/status");

      assert.equal(clarifyResponse.status, 502);
      assert.match(clarifyResponse.text, /"code":"clarification_invocation_failed"/);
      assert.match(clarifyResponse.text, /Clarification provider unavailable\./);
      assert.equal(blockedHome.status, 200);
      assert.match(blockedHome.text, /Where should we start\?/);
      assert.equal(onboardingStatus.status, 200);
      assert.match(onboardingStatus.text, /"ready":false/);
      await assert.rejects(
        fs.stat(path.join(stateDir, "atlas", "desktop_sessions", "desktop-session-failure", "clarification_packet.json")),
        /ENOENT/,
      );
    } finally {
      if (failedServer.listening) {
        await new Promise<void>((resolve) => {
          failedServer.close(() => resolve());
        });
      }
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("accepts lifecycle API mutations without breaking the dedicated surface contract", async () => {
    const response = await requestJson(port, "/api/lifecycle", {
      action: "pause",
      role: "quality-worker",
      returnTo: "/sessions",
    });

    assert.equal(response.status, 200);
    const payload = JSON.parse(response.text) as { ok: boolean; lane: string; message: string };
    assert.equal(payload.ok, true);
    assert.equal(payload.lane, "quality");
    assert.match(payload.message, /Paused the quality lane/i);
  });

  it("[NEGATIVE] returns a graceful onboarding status payload when the product surface is not bound to a desktop session", async () => {
    const detachedPort = await getFreePort();
    const detachedServer = await startAtlasServer({
      port: detachedPort,
      stateDir,
      targetRepo: "Ancora-Labs/ATLAS",
    });

    try {
      const response = await requestText(detachedPort, "/api/onboarding/status");

      assert.equal(response.status, 200);
      assert.match(response.text, /"ready":false/);
      assert.match(response.text, /"code":"desktop_session_missing"/);
      assert.match(response.text, /"sessionId":null/);
    } finally {
      if (detachedServer.listening) {
        await new Promise<void>((resolve) => {
          detachedServer.close(() => resolve());
        });
      }
    }
  });

  it("[NEGATIVE] returns route-level errors for unsupported methods and unknown paths", async () => {
    const invalidMethodResponse = await requestText(port, "/sessions", "POST");
    const missingRouteResponse = await requestText(port, "/missing");

    assert.equal(invalidMethodResponse.status, 405);
    assert.match(invalidMethodResponse.text, /Method Not Allowed/);

    assert.equal(missingRouteResponse.status, 404);
    assert.match(missingRouteResponse.text, /ATLAS route not found/);
  });

  it("[NEGATIVE] ignores unknown focused session query values without breaking the sessions surface", async () => {
    const response = await requestText(port, "/sessions?focusRole=missing-worker");

    assert.equal(response.status, 200);
    assert.match(response.text, /Focused session detail/);
    assert.match(response.text, /Start the next session while the old focus recovers/);
    assert.match(response.text, /The previous focus is missing its next live snapshot, but you can still write the next outcome here and keep the workspace moving\./);
    assert.match(response.text, />Clear focus</);
    assert.doesNotMatch(response.text, /missing-worker/);
  });

  it("[NEGATIVE] serves the premium desktop shell even when the server starts against sparse state", async () => {
    const tempRoot = await createTempRoot();
    const sparseStateDir = path.join(tempRoot, "state");
    await fs.mkdir(sparseStateDir, { recursive: true });
    const sparsePort = await getFreePort();
    const sparseServer = await startAtlasServer({
      port: sparsePort,
      stateDir: sparseStateDir,
      targetRepo: "Ancora-Labs/ATLAS",
    });

    try {
      const homeResponse = await requestText(sparsePort, "/");
      const sessionsResponse = await requestText(sparsePort, "/sessions");

      assert.equal(homeResponse.status, 200);
      assert.match(homeResponse.text, /No session state is available yet\./);
      assert.match(homeResponse.text, /aria-label="ATLAS desktop surface"/);
      assert.match(homeResponse.text, /data-role="product-composer-input"/);
      assert.equal(sessionsResponse.status, 200);
      assert.match(sessionsResponse.text, /No session state is available yet\./);
      assert.match(sessionsResponse.text, /Focused session detail/);
      assert.doesNotMatch(`${homeResponse.text}\n${sessionsResponse.text}`, /dashboard-card|window-controls|traffic-light/i);
    } finally {
      if (sparseServer.listening) {
        await new Promise<void>((resolve) => {
          sparseServer.close(() => resolve());
        });
      }
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
  it("can create a request handler without mutating dashboard port 8787 behavior", () => {
    const isolatedServer = createAtlasServer({
      stateDir,
      targetRepo: "Ancora-Labs/ATLAS",
      hostLabel: "Windows 11 workstation",
      shellCommand: ".\\ATLAS.cmd",
    });

    assert.equal(isolatedServer.listening, false);
    assert.equal(isolatedServer.address(), null);
  });
});
