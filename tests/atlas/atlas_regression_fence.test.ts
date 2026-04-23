import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { listAtlasSessions, readAtlasSessionReadModel } from "../../src/atlas/state_bridge.ts";

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-regression-fence-"));
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function writeCanonicalState(
  stateDir: string,
  workerSessions: Record<string, unknown>,
): Promise<void> {
  await writeJson(path.join(stateDir, "pipeline_progress.json"), {
    stage: "workers_running",
    stageLabel: "Workers Running",
    percent: 88,
    detail: "ATLAS is serving the dedicated repo surface.",
    steps: [],
    updatedAt: "2026-04-22T11:30:00.000Z",
    startedAt: "cycle-1",
  });
  await writeJson(path.join(stateDir, "worker_cycle_artifacts.json"), {
    schemaVersion: 1,
    updatedAt: "2026-04-22T11:30:00.000Z",
    latestCycleId: "cycle-1",
    cycles: {
      "cycle-1": {
        cycleId: "cycle-1",
        updatedAt: "2026-04-22T11:30:00.000Z",
        status: "in_progress",
        workerSessions,
        workerActivity: {},
        completedTaskIds: [],
      },
    },
  });
}

describe("atlas regression fence", () => {
  it("keeps the dedicated runtime launcher contract pinned in package.json", async () => {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const launcherPath = path.join(process.cwd(), "ATLAS.cmd");
    const launcher = await fs.readFile(launcherPath, "utf8");

    assert.equal(packageJson.scripts?.["atlas:start"], "node --import tsx src/atlas/server.ts");
    assert.equal(packageJson.scripts?.["atlas:ctl"], "node --import tsx src/atlas/lifecycle.ts");
    assert.match(String(packageJson.scripts?.["atlas:open"] || ""), /atlas:desktop/);
    assert.match(String(packageJson.scripts?.["atlas:desktop"] || ""), /electron/i);
    assert.match(String(packageJson.scripts?.["atlas:desktop:build"] || ""), /tsconfig\.electron\.json/);
    assert.doesNotMatch(String(packageJson.scripts?.["atlas:start"] || ""), /dashboard/i);
    assert.match(launcher, /npm run atlas:ctl -- %ATLAS_ACTION%/);
    assert.match(launcher, /Launching the native ATLAS desktop shell/i);
    assert.doesNotMatch(launcher, /Start-Process|Invoke-WebRequest/);
  });

  it("falls back to open_target_sessions.json, maps legacy BOX stages, and aggregates archived sessions", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      await writeJson(path.join(stateDir, "open_target_sessions.json"), {
        sessions: {
          "integration-worker": {
            role: "integration-worker",
            status: "completed",
            lastTask: "Closed the ATLAS launcher polish",
            lastActiveAt: "2026-04-22T11:00:00.000Z",
            createdPRs: ["https://example.com/pr/atlas-runtime"],
          },
          "quality-worker": {
            role: "quality-worker",
            status: "needs-input",
            lastTask: "Waiting for archive review notes",
            lastActiveAt: "2026-04-22T10:55:00.000Z",
            filesTouched: ["src/atlas/state_bridge.ts"],
          },
        },
      });
      await writeJson(path.join(stateDir, "archive", "2026-04-21", "quality.json"), {
        role: "quality-worker",
        status: "partial",
        lastTask: "Resume archive verification",
        lastActiveAt: "2026-04-21T19:00:00.000Z",
      });
      await fs.mkdir(path.join(stateDir, "archive"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "archive", "broken.json"), "{not-json", "utf8");

      const readModel = await readAtlasSessionReadModel({ stateDir });
      const openSessions = await listAtlasSessions({ stateDir });

      assert.equal(openSessions["integration-worker"]?.status, "done");
      assert.equal(openSessions["integration-worker"]?.statusLabel, "Completed");
      assert.equal(openSessions["quality-worker"]?.status, "blocked");
      assert.equal(openSessions["quality-worker"]?.readinessLabel, "Needs your input");
      assert.equal(openSessions["quality-worker"]?.touchedFileCount, 1);

      assert.equal(Object.keys(readModel.openSessions).length, 2);
      assert.equal(readModel.archivedSessions.length, 1);
      assert.equal(readModel.archivedSessions[0]?.status, "partial");
      assert.equal(readModel.archivedSessions[0]?.readinessLabel, "Ready to continue");
      assert.match(readModel.archivedSessions[0]?.archivePath || "", /archive/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] keeps canonical live state authoritative when fallback files disagree", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      await writeCanonicalState(stateDir, {
        "integration-worker": {
          role: "integration-worker",
          status: "working",
          lastTask: "Serve the dedicated ATLAS runtime",
          lastActiveAt: "2026-04-22T11:30:00.000Z",
        },
      });
      await writeJson(path.join(stateDir, "open_target_sessions.json"), {
        "integration-worker": {
          role: "integration-worker",
          status: "completed",
          lastTask: "Stale fallback data",
          lastActiveAt: "2026-04-22T09:00:00.000Z",
        },
      });

      const readModel = await readAtlasSessionReadModel({ stateDir });

      assert.equal(readModel.openSessions["integration-worker"]?.status, "working");
      assert.equal(readModel.openSessions["integration-worker"]?.statusLabel, "In progress");
      assert.equal(readModel.archivedSessions.length, 0);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
