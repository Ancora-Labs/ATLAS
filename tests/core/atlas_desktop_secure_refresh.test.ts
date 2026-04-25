import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  startAtlasServer,
} from "../../src/atlas/server.ts";
import { ATLAS_SNAPSHOT_TOKEN_HEADER } from "../../src/atlas/routes/home.ts";

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-secure-refresh-"));
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

function requestSnapshot(
  port: number,
  headers: Record<string, string> = {},
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: "/api/atlas/snapshot?view=sessions&focusRole=quality-worker",
      method: "GET",
      headers: {
        accept: "application/json",
        ...headers,
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
    req.end();
  });
}

describe("atlas desktop secure refresh", () => {
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
      updatedAt: "2026-04-25T08:00:00.000Z",
      latestCycleId: "cycle-1",
      cycles: {
        "cycle-1": {
          cycleId: "cycle-1",
          updatedAt: "2026-04-25T08:00:00.000Z",
          status: "in_progress",
          workerSessions: {
            "quality-worker": {
              role: "quality-worker",
              status: "working",
              lastTask: "Refresh the desktop session rail",
              lastActiveAt: "2026-04-25T08:00:00.000Z",
              currentBranch: "feat/secure-refresh",
              filesTouched: ["src/atlas/routes/home.ts", "src/atlas/renderer.ts"],
            },
          },
          workerActivity: {
            "quality-worker": [
              {
                at: "2026-04-25T08:00:00.000Z",
                from: "quality-worker",
                status: "working",
                task: "Refresh the desktop session rail",
              },
            ],
          },
          completedTaskIds: [],
        },
      },
    }), "utf8");
    await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
      stage: "workers_running",
      stageLabel: "Workers Running",
      percent: 75,
      detail: "Serving desktop snapshot refreshes",
      steps: [],
      updatedAt: "2026-04-25T08:00:00.000Z",
      startedAt: "cycle-1",
    }), "utf8");
    await fs.writeFile(path.join(stateDir, "live_worker_quality-worker.log"), "secure refresh ready\n", "utf8");

    port = await getFreePort();
    server = await startAtlasServer({
      port,
      stateDir,
      targetRepo: "Ancora-Labs/ATLAS",
      desktopSnapshotToken: "desktop-refresh-token",
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

  it("requires the desktop snapshot token before returning live session JSON", async () => {
    const blockedResponse = await requestSnapshot(port);
    const allowedResponse = await requestSnapshot(port, {
      [ATLAS_SNAPSHOT_TOKEN_HEADER]: "desktop-refresh-token",
    });

    assert.equal(blockedResponse.status, 403);
    assert.match(blockedResponse.text, /ATLAS snapshot access denied/);
    assert.equal(allowedResponse.status, 200);

    const payload = JSON.parse(allowedResponse.text) as {
      ok: boolean;
      pageData: {
        sessions: Array<{ role: string; currentBranch: string | null; logExcerpt: string[] }>;
      };
      snapshotAt: string;
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.pageData.sessions[0]?.role, "quality-worker");
    assert.equal(payload.pageData.sessions[0]?.currentBranch, "feat/secure-refresh");
    assert.equal(payload.pageData.sessions[0]?.logExcerpt[0], "secure refresh ready");
    assert.match(payload.snapshotAt, /^\d{4}-\d{2}-\d{2}T/);
  });
});
