import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  bridgeBoxTargetSessionState,
  getAtlasSessionReadiness,
  getAtlasSessionStatusLabel,
  listAtlasSessions,
} from "../../src/atlas/state_bridge.ts";

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-state-bridge-"));
}

describe("state_bridge", () => {
  it("maps BOX target-session state into ATLAS session DTOs with product labels", () => {
    const sessions = bridgeBoxTargetSessionState({
      schemaVersion: 1,
      Atlas: {
        role: "Atlas",
        status: "idle",
        lastTask: "",
        lastActiveAt: "2026-04-21T12:00:00.000Z",
      },
      Athena: {
        role: "Athena",
        status: "working",
        lastTask: "Validate the regression suite",
        lastActiveAt: "2026-04-21T12:05:00.000Z",
        createdPRs: ["https://example.com/pr/1"],
        filesTouched: ["src/atlas/state_bridge.ts", "tests/atlas/state_bridge.test.ts"],
      },
      Prometheus: {
        role: "Prometheus",
        status: "blocked",
        lastTask: "Waiting on review notes",
        lastActiveAt: "2026-04-21T11:45:00.000Z",
      },
      Hermes: {
        role: "Hermes",
        status: "done",
        lastTask: "Closed the previous session",
        lastActiveAt: "2026-04-21T11:30:00.000Z",
      },
    }, {
      Athena: "reviewing failures",
    });

    assert.equal(Object.keys(sessions).length, 4);
    assert.equal(sessions.Atlas.statusLabel, "Ready");
    assert.equal(sessions.Atlas.readinessLabel, "Ready to start");
    assert.equal(sessions.Athena.statusLabel, "In progress");
    assert.equal(sessions.Athena.readinessLabel, "In progress");
    assert.equal(sessions.Athena.lane, null);
    assert.equal(sessions.Athena.pullRequestCount, 1);
    assert.equal(sessions.Athena.touchedFileCount, 2);
    assert.equal(sessions.Athena.lastThinking, "reviewing failures");
    assert.equal(sessions.Athena.canArchive, false);
    assert.equal(sessions.Prometheus.statusLabel, "Needs attention");
    assert.equal(sessions.Prometheus.readinessLabel, "Needs your input");
    assert.equal(sessions.Prometheus.needsInput, true);
    assert.equal(sessions.Hermes.statusLabel, "Completed");
    assert.equal(sessions.Hermes.readinessLabel, "Completed");
    assert.equal(sessions.Hermes.isResumable, false);
  });

  it("uses terminal session history to recover stale working states", () => {
    const sessions = bridgeBoxTargetSessionState({
      Athena: {
        role: "Athena",
        status: "working",
        lastTask: "Review completed changes",
        history: [
          { from: "Athena", status: "working", task: "Start review" },
          { from: "integration-worker", status: "partial", task: "Left follow-up notes" },
        ],
      },
      Hermes: {
        role: "Hermes",
        status: "working",
        lastTask: "Apply merge fix",
        activityLog: [
          { from: "Hermes", status: "error", task: "Push failed" },
        ],
      },
    });

    assert.equal(sessions.Athena.status, "partial");
    assert.equal(sessions.Athena.statusLabel, "Ready");
    assert.equal(sessions.Athena.readinessLabel, "Ready to continue");
    assert.equal(sessions.Athena.isResumable, true);

    assert.equal(sessions.Hermes.status, "error");
    assert.equal(sessions.Hermes.readinessLabel, "Needs your input");
    assert.equal(sessions.Hermes.needsInput, true);
  });

  it("[NEGATIVE] ignores invalid entries and falls back to ready labels for unknown statuses", () => {
    const sessions = bridgeBoxTargetSessionState({
      Broken: "nope",
      Atlas: {
        role: "Atlas",
        status: "mystery-state",
        lastTask: "Resume the setup flow",
      },
    });

    assert.deepEqual(Object.keys(sessions), ["Atlas"]);
    assert.equal(sessions.Atlas.status, "idle");
    assert.equal(sessions.Atlas.statusLabel, "Ready");
    assert.equal(sessions.Atlas.readinessLabel, "Ready to continue");

    assert.equal(getAtlasSessionStatusLabel("offline"), "Stopped");
    assert.deepEqual(getAtlasSessionReadiness("idle", ""), {
      readiness: "ready",
      readinessLabel: "Ready to start",
    });
  });

  it("loads canonical target sessions through the dedicated ATLAS adapter", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(path.join(stateDir, "pipeline_progress.json"), JSON.stringify({
        stage: "workers_running",
        stageLabel: "Workers Running",
        percent: 85,
        detail: "Serving the ATLAS product shell",
        steps: [],
        updatedAt: "2026-04-21T12:00:00.000Z",
        startedAt: "cycle-1",
      }), "utf8");
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
              Athena: {
                role: "Athena",
                status: "in_progress",
                lastTask: "Review ATLAS integration",
                lastActiveAt: "2026-04-21T12:00:00.000Z",
              },
              Hermes: {
                role: "Hermes",
                status: "recovered",
                lastTask: "Retry the branch push",
                lastActiveAt: "2026-04-21T11:55:00.000Z",
              },
              Prometheus: {
                role: "Prometheus",
                status: "working",
                lastTask: "Validate canonical state",
                lastActiveAt: "2026-04-21T11:50:00.000Z",
              },
              "quality-worker": {
                role: "quality-worker",
                status: "partial",
                lastTask: "Resume verification handoff",
                lastActiveAt: "2026-04-21T11:57:00.000Z",
              },
              Atlas: {
                role: "Atlas",
                status: 42,
                lastTask: "",
              },
            },
            workerActivity: {
              Prometheus: [
                { from: "Prometheus", status: "failed", task: "Push checks failed" },
              ],
            },
            completedTaskIds: [],
          },
        },
      }), "utf8");
      await fs.writeFile(path.join(stateDir, "medic_paused_lanes.json"), JSON.stringify({
        quality: {
          pausedAt: "2026-04-21T12:01:00.000Z",
          reason: "atlas:test",
        },
      }), "utf8");

      const sessions = await listAtlasSessions({
        stateDir,
        thinkingMap: { Athena: "validating canonical state" },
      });

      assert.equal(sessions.Athena.status, "working");
      assert.equal(sessions.Athena.statusLabel, "In progress");
      assert.equal(sessions.Athena.lastThinking, "validating canonical state");

      assert.equal(sessions.Hermes.status, "partial");
      assert.equal(sessions.Hermes.readinessLabel, "Ready to continue");
      assert.equal(sessions.Hermes.lane, null);

      assert.equal(sessions.Prometheus.status, "error");
      assert.equal(sessions.Prometheus.needsInput, true);

      assert.equal(sessions["quality-worker"].lane, "quality");
      assert.equal(sessions["quality-worker"].isPaused, true);
      assert.equal(sessions["quality-worker"].canArchive, true);

      assert.equal(sessions.Atlas.status, "idle");
      assert.equal(sessions.Atlas.readinessLabel, "Ready to start");
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
