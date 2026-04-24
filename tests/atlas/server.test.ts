import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { ATLAS_DEFAULT_PORT, createAtlasServer, startAtlasServer } from "../../src/atlas/server.ts";

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

function requestText(port: number, pathname: string, method = "GET"): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method,
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
              createdPRs: ["https://example.com/pr/1"],
              filesTouched: ["src/atlas/server.ts", "src/atlas/routes/sessions.ts"],
            },
          },
          workerActivity: {},
          completedTaskIds: [],
        },
      },
    }), "utf8");

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
    assert.match(homeResponse.text, /ATLAS keeps the live delivery state in the desktop window\./);
    assert.match(homeResponse.text, /Ancora-Labs\/ATLAS/);
    assert.match(homeResponse.text, />Stop runtime</);

    assert.equal(sessionsResponse.status, 200);
    assert.match(sessionsResponse.text, /<title>ATLAS Sessions<\/title>/);
    assert.match(sessionsResponse.text, />Tracked sessions</);
    assert.match(sessionsResponse.text, />ATLAS control</);
    assert.match(sessionsResponse.text, />Quality lane</);
    assert.match(sessionsResponse.text, />2 tracked sessions</);
    assert.match(sessionsResponse.text, />Pause lane</);
    assert.doesNotMatch(sessionsResponse.text, /BOX Mission Control/i);
  });

  it("blocks home handoff until the session-bound clarification packet exists and exposes the onboarding API", async () => {
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
          workerSessions: {},
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
      assert.equal(blockedHome.status, 412);
      assert.match(blockedHome.text, /Finish clarification in the ATLAS desktop window/i);

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
      assert.match(unblockedHome.text, /ATLAS keeps the live delivery state in the desktop window\./);
    } finally {
      if (gatedServer.listening) {
        await new Promise<void>((resolve) => {
          gatedServer.close(() => resolve());
        });
      }
      await fs.rm(gatedRoot, { recursive: true, force: true });
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

  it("[NEGATIVE] returns route-level errors for unsupported methods and unknown paths", async () => {
    const invalidMethodResponse = await requestText(port, "/sessions", "POST");
    const missingRouteResponse = await requestText(port, "/missing");

    assert.equal(invalidMethodResponse.status, 405);
    assert.match(invalidMethodResponse.text, /Method Not Allowed/);

    assert.equal(missingRouteResponse.status, 404);
    assert.match(missingRouteResponse.text, /ATLAS route not found/);
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
