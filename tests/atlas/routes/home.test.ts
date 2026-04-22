import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  buildAtlasPageData,
  deriveAtlasHomeReadiness,
  handleAtlasHomeRequest,
} from "../../../src/atlas/routes/home.ts";
import { handleAtlasSessionsRequest } from "../../../src/atlas/routes/sessions.ts";

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-home-route-"));
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

describe("atlas home route", () => {
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
              status: "success",
              lastTask: "Render the ATLAS Home shell",
              lastActiveAt: "2026-04-21T12:00:00.000Z",
              createdPRs: ["https://example.com/pr/1"],
              filesTouched: ["src/atlas/renderer.ts", "src/atlas/routes/home.ts"],
            },
            Prometheus: {
              role: "Prometheus",
              status: "working",
              lastTask: "Waiting for acceptance review",
              lastActiveAt: "2026-04-21T11:45:00.000Z",
            },
            Broken: "skip me",
          },
          workerActivity: {
            Prometheus: [
              { from: "Prometheus", status: "blocked", task: "Waiting for acceptance review" },
            ],
          },
          completedTaskIds: [],
        },
      },
    }), "utf8");

    await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 85,
      detail: "Serving the ATLAS Home surface",
      steps: [],
      updatedAt: "2026-04-21T12:00:00.000Z",
      startedAt: "cycle-1",
    }), "utf8");

    port = await getFreePort();
    server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const routeHandler = url.pathname === "/sessions" ? handleAtlasSessionsRequest : handleAtlasHomeRequest;
      routeHandler(req, res, {
        stateDir,
        targetRepo: "Ancora-Labs/ATLAS",
        hostLabel: "Windows 11 workstation",
        shellCommand: ".\\ATLAS.cmd",
      }).catch((error) => {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end(String((error as Error)?.message || error));
      });
    });

    await new Promise<void>((resolve, reject) => {
      server?.listen(port, "127.0.0.1", () => resolve());
      server?.once("error", reject);
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

  it("builds AtlasPageData from the state bridge with sorted session DTOs", async () => {
    const pageData = await buildAtlasPageData({
      stateDir,
      targetRepo: "Ancora-Labs/ATLAS",
      hostLabel: "Windows 11 workstation",
      shellCommand: ".\\ATLAS.cmd",
    });

    assert.equal(pageData.title, "ATLAS Home");
    assert.equal(pageData.repoLabel, "Ancora-Labs/ATLAS");
    assert.equal(pageData.pipelineStageLabel, "Workers Running");
    assert.deepEqual(pageData.sessions.map((session) => session.name), ["Atlas", "Athena", "Prometheus"]);
    assert.equal(pageData.sessions[1]?.statusLabel, "Completed");
    assert.equal(pageData.sessions[1]?.pullRequestCount, 1);
    assert.equal(pageData.sessions[2]?.readinessLabel, "Needs your input");
    assert.equal(pageData.homePrimaryActionLabel, "Resume session flow");
    assert.equal(pageData.homeReadinessHeading, "Ready to resume");
  });

  it("derives a start state when no worker session can resume", () => {
    assert.deepEqual(deriveAtlasHomeReadiness([
      {
        role: "Hermes",
        name: "Hermes",
        status: "done",
        statusLabel: "Completed",
        readiness: "completed",
        readinessLabel: "Completed",
        lastTask: "Wrapped the last delivery",
        lastActiveAt: "2026-04-21T12:00:00.000Z",
        historyLength: 1,
        lastThinking: "",
        currentBranch: null,
        pullRequestCount: 1,
        touchedFileCount: 2,
        needsInput: false,
        isResumable: false,
      },
    ]), {
      homePrimaryActionLabel: "Open sessions",
      homeReadinessHeading: "Ready to start",
      homeReadinessDetail: "No resumable session is active yet. Open Sessions to begin the next role handoff.",
    });
  });

  it("serves GET / as the ATLAS Home HTML surface", async () => {
    const response = await requestText(port, "/");

    assert.equal(response.status, 200);
    assert.match(response.text, /<title>ATLAS Home<\/title>/);
    assert.match(response.text, /Ancora-Labs\/ATLAS/);
    assert.match(response.text, /Windows 11 workstation/);
    assert.match(response.text, />Resume session flow</);
    assert.match(response.text, /<span>Total sessions<\/span>\s*<strong>3<\/strong>/);
    assert.doesNotMatch(response.text, /dashboard/i);
  });

  it("serves GET /sessions as the ATLAS Sessions HTML surface", async () => {
    const response = await requestText(port, "/sessions");

    assert.equal(response.status, 200);
    assert.match(response.text, /<title>ATLAS Sessions<\/title>/);
    assert.match(response.text, />Worker sessions</);
    assert.match(response.text, />Needs attention · Needs your input</);
    assert.match(response.text, />3 tracked roles</);
  });

  it("[NEGATIVE] rejects non-GET requests on both ATLAS HTML routes", async () => {
    const homeResponse = await requestText(port, "/", "POST");
    const sessionsResponse = await requestText(port, "/sessions", "POST");

    assert.equal(homeResponse.status, 405);
    assert.match(homeResponse.text, /Method Not Allowed/);
    assert.equal(sessionsResponse.status, 405);
    assert.match(sessionsResponse.text, /Method Not Allowed/);
  });
});
