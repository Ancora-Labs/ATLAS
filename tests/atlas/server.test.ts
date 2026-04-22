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
            Athena: {
              role: "Athena",
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

  it("serves the home and sessions routes from the dedicated ATLAS server", async () => {
    const homeResponse = await requestText(port, "/");
    const sessionsResponse = await requestText(port, "/sessions");

    assert.equal(homeResponse.status, 200);
    assert.match(homeResponse.text, /<title>ATLAS Home<\/title>/);
    assert.match(homeResponse.text, /ATLAS Desktop Session Control/);
    assert.match(homeResponse.text, /Ancora-Labs\/ATLAS/);

    assert.equal(sessionsResponse.status, 200);
    assert.match(sessionsResponse.text, />Worker sessions</);
    assert.match(sessionsResponse.text, />Athena</);
    assert.match(sessionsResponse.text, />2 tracked roles</);
    assert.doesNotMatch(sessionsResponse.text, /BOX Mission Control/i);
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
