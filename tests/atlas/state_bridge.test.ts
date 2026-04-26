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
  resolveAtlasSessionSnapshotContinuity,
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
    assert.equal(sessions.Athena.workerIdentityLabel, "Athena");
    assert.equal(sessions.Athena.currentStageLabel, "Working");
    assert.equal(sessions.Athena.latestMeaningfulAction, "Validate the regression suite");
    assert.equal(sessions.Athena.pullRequestCount, 1);
    assert.equal(sessions.Athena.touchedFileCount, 2);
    assert.deepEqual(sessions.Athena.pullRequests, ["https://example.com/pr/1"]);
    assert.deepEqual(sessions.Athena.touchedFiles, ["src/atlas/state_bridge.ts", "tests/atlas/state_bridge.test.ts"]);
    assert.equal(sessions.Athena.lastThinking, "reviewing failures");
    assert.equal(sessions.Athena.freshnessState, "stale");
    assert.equal(sessions.Athena.freshnessLabel, "Live update stale");
    assert.match(sessions.Athena.freshnessPolicyDetail, /older than 5 minutes/i);
    assert.equal(sessions.Athena.logStateLabel, "Waiting for live log");
    assert.equal(sessions.Athena.liveStatusTone, "attention");
    assert.equal(sessions.Athena.liveStatusLabel, "Stale");
    assert.equal(sessions.Athena.liveStatusPulse, false);
    assert.match(sessions.Athena.liveStatusAssistiveText, /stale recorded context/);
    assert.equal(sessions.Athena.canArchive, false);
    assert.equal(sessions.Prometheus.statusLabel, "Needs attention");
    assert.equal(sessions.Prometheus.readinessLabel, "Needs your input");
    assert.equal(sessions.Prometheus.needsInput, true);
    assert.equal(sessions.Prometheus.liveStatusTone, "attention");
    assert.equal(sessions.Hermes.statusLabel, "Completed");
    assert.equal(sessions.Hermes.readinessLabel, "Completed");
    assert.equal(sessions.Hermes.isResumable, false);
    assert.equal(sessions.Hermes.liveStatusTone, "complete");
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
    assert.equal(sessions.Athena.latestMeaningfulAction, "Left follow-up notes");
    assert.equal(sessions.Athena.recentActions[0]?.statusLabel, "Ready");

    assert.equal(sessions.Hermes.status, "error");
    assert.equal(sessions.Hermes.readinessLabel, "Needs your input");
    assert.equal(sessions.Hermes.needsInput, true);
    assert.equal(sessions.Hermes.latestMeaningfulAction, "Push failed");
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

  it("flags when a restored focused role no longer exists in the live session snapshot", () => {
    const continuity = resolveAtlasSessionSnapshotContinuity([
      {
        role: "Atlas",
        name: "ATLAS control",
        lane: null,
        status: "idle",
        statusLabel: "Ready",
        readiness: "ready",
        readinessLabel: "Ready to start",
        lastTask: "",
        lastActiveAt: null,
        historyLength: 0,
        lastThinking: "",
        latestMeaningfulAction: "",
        latestMeaningfulActionAt: null,
        recentActions: [],
        resolvedRole: null,
        logicalRole: null,
        workerIdentityLabel: "Atlas",
        currentStage: "idle",
        currentStageLabel: "Idle",
        currentBranch: null,
        pullRequests: [],
        pullRequestCount: 0,
        touchedFiles: [],
        touchedFileCount: 0,
        logExcerpt: [],
        logSource: null,
        logUpdatedAt: null,
        freshnessAt: null,
        freshnessState: "unknown",
        freshnessLabel: "Waiting for live update",
        freshnessPolicyDetail: "ATLAS does not have a current live update timestamp for this session yet.",
        logStateLabel: "Waiting for live log",
        liveStatusTone: "idle",
        liveStatusLabel: "Ready",
        liveStatusAssistiveText: "ATLAS control is ready for the next live update.",
        liveStatusPulse: false,
        needsInput: false,
        isResumable: false,
        isPaused: false,
        canArchive: false,
      },
    ], "quality-worker");

    assert.deepEqual(continuity, {
      hasLiveSessions: true,
      missingFocusedSnapshot: true,
    });
  });

  it("accepts a route-level continuity hint when the restored focus cannot be surfaced safely", () => {
    const continuity = resolveAtlasSessionSnapshotContinuity([], null, true);

    assert.deepEqual(continuity, {
      hasLiveSessions: false,
      missingFocusedSnapshot: true,
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
                workerIdentityLabel: "Quality worker via review lane",
                currentStage: "snapshot_refresh",
                currentStageLabel: "Refreshing snapshot",
                latestMeaningfulAction: "Refreshed the focused session contract",
                latestMeaningfulActionAt: "2026-04-21T11:58:00.000Z",
                pullRequests: [
                  "https://example.com/pr/quality",
                  "https://example.com/pr/quality",
                ],
                touchedFiles: [
                  "src/atlas/state_bridge.ts",
                  "src/atlas/state_bridge.ts",
                ],
                filesChanged: ["tests/atlas/state_bridge.test.ts"],
                logExcerpt: [
                  "[leadership_live]",
                  "snapshot detail refreshed",
                  "focused session context synced",
                ],
                logSource: "worker_cycle_artifacts.json",
                logUpdatedAt: "2026-04-21T11:58:30.000Z",
                freshnessAt: "2026-04-21T11:58:30.000Z",
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
      await fs.writeFile(path.join(stateDir, "live_worker_athena.log"), [
        "[leadership_live]",
        "validated session bridge snapshot",
        "live refresh ready",
      ].join("\n"), "utf8");

      const sessions = await listAtlasSessions({
        stateDir,
        thinkingMap: { Athena: "validating canonical state" },
      });

      assert.equal(sessions.Athena.status, "working");
      assert.equal(sessions.Athena.statusLabel, "In progress");
      assert.equal(sessions.Athena.lastThinking, "validating canonical state");
      assert.equal(sessions.Athena.logExcerpt.at(-1), "live refresh ready");
      assert.equal(sessions.Athena.logSource, "live_worker_athena.log");

      assert.equal(sessions.Hermes.status, "partial");
      assert.equal(sessions.Hermes.readinessLabel, "Ready to continue");
      assert.equal(sessions.Hermes.lane, null);

      assert.equal(sessions.Prometheus.status, "error");
      assert.equal(sessions.Prometheus.needsInput, true);

      assert.equal(sessions["quality-worker"].lane, "quality");
      assert.equal(sessions["quality-worker"].isPaused, true);
      assert.equal(sessions["quality-worker"].canArchive, true);
      assert.equal(sessions["quality-worker"].workerIdentityLabel, "Quality worker via review lane");
      assert.equal(sessions["quality-worker"].currentStageLabel, "Refreshing snapshot");
      assert.equal(sessions["quality-worker"].latestMeaningfulAction, "Refreshed the focused session contract");
      assert.deepEqual(sessions["quality-worker"].pullRequests, ["https://example.com/pr/quality"]);
      assert.deepEqual(sessions["quality-worker"].touchedFiles, [
        "src/atlas/state_bridge.ts",
        "tests/atlas/state_bridge.test.ts",
      ]);
      assert.deepEqual(sessions["quality-worker"].logExcerpt, [
        "snapshot detail refreshed",
        "focused session context synced",
      ]);
      assert.equal(sessions["quality-worker"].logSource, "worker_cycle_artifacts.json");
      assert.equal(sessions["quality-worker"].freshnessAt, "2026-04-21T11:58:30.000Z");
      assert.equal(sessions["quality-worker"].freshnessState, "stale");
      assert.equal(sessions["quality-worker"].freshnessLabel, "Live update stale");

      assert.equal(sessions.Atlas.status, "idle");
      assert.equal(sessions.Atlas.readinessLabel, "Ready to start");
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] ignores legacy worker-session fallbacks when no canonical live session artifacts are available", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(path.join(stateDir, "worker_sessions.json"), JSON.stringify({
        "quality-worker": {
          role: "quality-worker",
          status: "working",
          lastTask: "Legacy worker state should stay hidden",
          lastActiveAt: "2026-04-21T12:00:00.000Z",
        },
      }), "utf8");
      await fs.writeFile(path.join(stateDir, "open_target_sessions.json"), JSON.stringify({
        sessions: {
          "quality-worker": {
            role: "quality-worker",
            status: "working",
            lastTask: "Legacy open session state should stay hidden",
            lastActiveAt: "2026-04-21T12:00:00.000Z",
          },
        },
      }), "utf8");

      const sessions = await listAtlasSessions({ stateDir });

      assert.deepEqual(sessions, {});
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
