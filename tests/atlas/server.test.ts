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
): Promise<{ status: number; text: string; headers: http.IncomingHttpHeaders }> {
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
          headers: res.headers,
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
): Promise<{ status: number; text: string; headers: http.IncomingHttpHeaders }> {
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
          headers: res.headers,
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

  it("serves the root workspace and redirects compatibility session routes back to it", async () => {
    const homeResponse = await requestText(port, "/");
    const sessionsResponse = await requestText(port, "/sessions");
    const focusedHomeResponse = await requestText(port, "/?focusRole=quality-worker");
    const homeMarkup = homeResponse.text.split("<script>")[0] || homeResponse.text;
    const focusedHomeMarkup = focusedHomeResponse.text.split("<script>")[0] || focusedHomeResponse.text;

    assert.equal(homeResponse.status, 200);
    assert.match(homeMarkup, /<title>ATLAS Workspace<\/title>/);
    assert.match(homeMarkup, /aria-label="ATLAS desktop surface"/);
    assert.match(homeMarkup, /data-main-pane-mode="new-session"/);
    assert.match(homeMarkup, /aria-label="ATLAS desktop sidebar"/);
    assert.match(homeMarkup, /aria-label="ATLAS work canvas"/);
    assert.match(homeMarkup, /Start a new session from a clean workspace/);
    assert.match(homeMarkup, /data-role="new-session-view"/);
    assert.match(homeMarkup, /data-role="session-row-status-light"/);
    assert.match(homeMarkup, /data-role="product-composer-input"/);
    assert.match(homeMarkup, /href="\/\?focusRole=quality-worker"[\s\S]*?data-session-role="quality-worker"/);
    assert.match(homeResponse.text, /bridge\?\.refreshSnapshot/);
    assert.match(homeResponse.text, /ATLAS snapshot refresh requires the Electron desktop bridge\./);
    assert.doesNotMatch(homeResponse.text, /default browser|localhost page/i);

    assert.equal(focusedHomeResponse.status, 200);
    assert.match(focusedHomeMarkup, /data-main-pane-mode="selected-session"/);
    assert.match(focusedHomeMarkup, /data-role="selected-session-view"/);
    assert.match(focusedHomeMarkup, /live-status-attention[\s\S]*?data-role="selected-session-status-light"/);
    assert.match(focusedHomeMarkup, /data-role="selected-session-actions"[\s\S]*?<a class="action-button primary" href="\/">New Session<\/a>/);
    assert.doesNotMatch(focusedHomeMarkup, /data-role="product-composer-input"/);

    assert.equal(sessionsResponse.status, 307);
    assert.equal(sessionsResponse.headers.location, "/");
  });

  it("serves a live JSON snapshot that reflects updated session detail and log excerpts", async () => {
    const firstResponse = await requestText(port, "/api/atlas/snapshot?view=sessions&focusRole=quality-worker");
    assert.equal(firstResponse.status, 200);
    const firstPayload = JSON.parse(firstResponse.text) as {
      ok: boolean;
      pageData: {
        mainPaneMode?: string;
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
    assert.equal(firstPayload.pageData.mainPaneMode, "selected-session");
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

  it("keeps snapshot continuity live-only and clears missing focus instead of serving stale selected detail", async () => {
    const snapshotResponse = await requestText(port, "/api/atlas/snapshot?focusRole=missing-worker");
    assert.equal(snapshotResponse.status, 200);

    const payload = JSON.parse(snapshotResponse.text) as {
      ok: boolean;
      continuitySource: string;
      continuityDetail: string;
      pageData: {
        mainPaneMode?: string;
        focusedSessionRole: string | null;
        missingFocusedSnapshot: boolean;
        continuityStatusLabel: string;
        continuityStatusDetail: string;
        sessions: Array<{ role: string; }>;
      };
    };

    assert.equal(payload.ok, true);
    assert.equal(payload.continuitySource, "live");
    assert.equal(payload.pageData.mainPaneMode, "new-session");
    assert.equal(payload.pageData.focusedSessionRole, null);
    assert.equal(payload.pageData.missingFocusedSnapshot, true);
    assert.equal(payload.pageData.continuityStatusLabel, "Selected detail unavailable");
    assert.match(payload.continuityDetail, /falls back to the blank new-session view instead of showing stale detail/);
    assert.match(payload.pageData.continuityStatusDetail, /falls back to the blank new-session view instead of showing stale detail/);
    assert.equal(payload.pageData.sessions.some((session) => session.role === "missing-worker"), false);
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

  it("keeps the workspace session brief session-bound while the home workspace remains available after relaunch", async () => {
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
        detail: "Waiting for workspace brief",
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
        summary: "ATLAS should capture one workspace brief packet before opening the session surface.",
        openQuestions: ["What should the first planning pass optimize for?"],
        executionNotes: ["Persist the packet, then unlock the home surface."],
      }),
    });

    try {
      const blockedHome = await requestText(gatedPort, "/");
      assert.equal(blockedHome.status, 200);
      assert.match(blockedHome.text, /What should ATLAS do next\?/);

      const blockedSessions = await requestText(gatedPort, "/sessions?focusRole=quality-worker");
      assert.equal(blockedSessions.status, 307);
      assert.equal(blockedSessions.headers.location, "/?focusRole=quality-worker");

      const workspaceBriefStatus = await requestText(gatedPort, "/api/workspace/session-brief");
      assert.equal(workspaceBriefStatus.status, 200);
      assert.match(workspaceBriefStatus.text, /"ready":true/);
      assert.match(workspaceBriefStatus.text, /"started":false/);

      const startResponse = await requestJson(gatedPort, "/api/workspace/session-brief", {
        objective: "Launch ATLAS in a native desktop window with one workspace brief pass.",
      });
      assert.equal(startResponse.status, 200);
      assert.match(startResponse.text, /"ready":true/);
      assert.match(startResponse.text, /"started":true/);

      const unblockedHome = await requestText(gatedPort, "/");
      assert.equal(unblockedHome.status, 200);
      assert.match(unblockedHome.text, /What should ATLAS do next\?/);
      assert.match(unblockedHome.text, /data-role="new-session-view"/);

      const repeatHome = await requestText(gatedPort, "/");
      const repeatWorkspaceBriefStatus = await requestText(gatedPort, "/api/workspace/session-brief");

      assert.equal(repeatHome.status, 200);
      assert.match(repeatHome.text, /data-role="product-composer-input"/);
      assert.doesNotMatch(repeatHome.text, /default browser|localhost page/i);
      assert.equal(repeatWorkspaceBriefStatus.status, 200);
      assert.match(repeatWorkspaceBriefStatus.text, /"ready":true/);
      assert.match(repeatWorkspaceBriefStatus.text, /"started":true/);

      const focusedSessions = await requestText(gatedPort, "/sessions?focusRole=atlas");
      assert.equal(focusedSessions.status, 307);
      assert.equal(focusedSessions.headers.location, "/?focusRole=atlas");
    } finally {
      if (gatedServer.listening) {
        await new Promise<void>((resolve) => {
          gatedServer.close(() => resolve());
        });
      }
      await fs.rm(gatedRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] keeps workspace session brief status ready while rejecting empty session starts and does not write a packet", async () => {
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
      detail: "Waiting for workspace brief",
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
    });

    try {
      const clarifyResponse = await requestJson(failedPort, "/api/workspace/session-brief", {
        objective: "   ",
      });
      const blockedHome = await requestText(failedPort, "/");
      const workspaceBriefStatus = await requestText(failedPort, "/api/workspace/session-brief");

      assert.equal(clarifyResponse.status, 400);
      assert.match(clarifyResponse.text, /"code":"missing_objective"/);
      assert.equal(blockedHome.status, 200);
      assert.match(blockedHome.text, /Where should ATLAS start\?/);
      assert.equal(workspaceBriefStatus.status, 200);
      assert.match(workspaceBriefStatus.text, /"ready":true/);
      assert.match(workspaceBriefStatus.text, /"started":false/);
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
      returnTo: "/",
    });

    assert.equal(response.status, 200);
    const payload = JSON.parse(response.text) as { ok: boolean; lane: string; message: string };
    assert.equal(payload.ok, true);
    assert.equal(payload.lane, "quality");
    assert.match(payload.message, /Paused the quality lane/i);
  });

  it("[NEGATIVE] returns a graceful workspace session brief payload when the product surface is not bound to a desktop session", async () => {
    const detachedPort = await getFreePort();
    const detachedServer = await startAtlasServer({
      port: detachedPort,
      stateDir,
      targetRepo: "Ancora-Labs/ATLAS",
    });

    try {
      const response = await requestText(detachedPort, "/api/workspace/session-brief");

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

  it("[NEGATIVE] redirects unknown focused session compatibility URLs back to the root workspace", async () => {
    const response = await requestText(port, "/sessions?focusRole=missing-worker");

    assert.equal(response.status, 307);
    assert.equal(response.headers.location, "/?focusRole=missing-worker");
  });

  it("[NEGATIVE] keeps the workspace on the blank new-session pane when only legacy session files exist", async () => {
    const tempRoot = await createTempRoot();
    const legacyOnlyStateDir = path.join(tempRoot, "state");
    await fs.mkdir(legacyOnlyStateDir, { recursive: true });
    await fs.writeFile(path.join(legacyOnlyStateDir, "worker_sessions.json"), JSON.stringify({
      "quality-worker": {
        role: "quality-worker",
        status: "working",
        lastTask: "Legacy worker state should stay hidden",
        lastActiveAt: "2026-04-21T12:00:00.000Z",
      },
    }), "utf8");
    await fs.writeFile(path.join(legacyOnlyStateDir, "open_target_sessions.json"), JSON.stringify({
      sessions: {
        "quality-worker": {
          role: "quality-worker",
          status: "working",
          lastTask: "Legacy open session state should stay hidden",
          lastActiveAt: "2026-04-21T12:00:00.000Z",
        },
      },
    }), "utf8");

    const legacyOnlyPort = await getFreePort();
    const legacyOnlyServer = await startAtlasServer({
      port: legacyOnlyPort,
      stateDir: legacyOnlyStateDir,
      targetRepo: "Ancora-Labs/ATLAS",
    });

    try {
      const homeResponse = await requestText(legacyOnlyPort, "/?focusRole=quality-worker");
      const snapshotResponse = await requestText(legacyOnlyPort, "/api/atlas/snapshot?focusRole=quality-worker");
      const homeMarkup = homeResponse.text.split("<script>")[0] || homeResponse.text;

      assert.equal(homeResponse.status, 200);
      assert.match(homeMarkup, /data-main-pane-mode="new-session"/);
      assert.match(homeMarkup, /data-role="new-session-view"/);
      assert.doesNotMatch(homeMarkup, /data-role="selected-session-view"/);

      assert.equal(snapshotResponse.status, 200);
      const payload = JSON.parse(snapshotResponse.text) as {
        ok: boolean;
        continuitySource: string;
        continuityDetail: string;
        pageData: {
          mainPaneMode?: string;
          focusedSessionRole: string | null;
          missingFocusedSnapshot: boolean;
          sessions: Array<{ role: string }>;
        };
      };

      assert.equal(payload.ok, true);
      assert.equal(payload.continuitySource, "live");
      assert.equal(payload.pageData.mainPaneMode, "new-session");
      assert.equal(payload.pageData.focusedSessionRole, null);
      assert.equal(payload.pageData.missingFocusedSnapshot, true);
      assert.deepEqual(payload.pageData.sessions, []);
      assert.match(payload.continuityDetail, /falls back to the blank new-session view instead of showing stale detail/);
    } finally {
      if (legacyOnlyServer.listening) {
        await new Promise<void>((resolve) => {
          legacyOnlyServer.close(() => resolve());
        });
      }
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
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
      assert.equal(sessionsResponse.status, 307);
      assert.equal(sessionsResponse.headers.location, "/");
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
