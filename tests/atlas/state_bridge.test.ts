import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bridgeBoxTargetSessionState,
  getAtlasSessionReadiness,
  getAtlasSessionStatusLabel,
} from "../../src/atlas/state_bridge.ts";

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
    assert.equal(sessions.Athena.pullRequestCount, 1);
    assert.equal(sessions.Athena.touchedFileCount, 2);
    assert.equal(sessions.Athena.lastThinking, "reviewing failures");
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
});
