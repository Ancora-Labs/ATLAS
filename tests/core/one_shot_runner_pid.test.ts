import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { readDaemonPid } from "../../src/core/daemon_control.js";
import { withOneShotRunnerPid } from "../../src/core/orchestrator.js";

describe("one-shot runner pid lifecycle", () => {
  it("writes a scoped runner pid for one-shot runs and clears it after success", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-one-shot-runner-success-"));

    try {
      const config = {
        paths: {
          stateDir: tmpDir,
        },
        activeTargetSession: {
          projectId: "target_atlas",
          sessionId: "sess_test_one_shot_success",
        },
      };

      let pidSeenDuringAction = false;
      await withOneShotRunnerPid(config, async () => {
        const pidState = await readDaemonPid(config);
        pidSeenDuringAction = Number(pidState?.pid || 0) === process.pid;
      });

      assert.equal(pidSeenDuringAction, true);
      assert.equal(await readDaemonPid(config), null);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("clears the scoped runner pid after one-shot failures", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-one-shot-runner-failure-"));

    try {
      const config = {
        paths: {
          stateDir: tmpDir,
        },
        activeTargetSession: {
          projectId: "target_atlas",
          sessionId: "sess_test_one_shot_failure",
        },
      };

      await assert.rejects(
        () => withOneShotRunnerPid(config, async () => {
          throw new Error("synthetic one-shot failure");
        }),
        /synthetic one-shot failure/,
      );

      assert.equal(await readDaemonPid(config), null);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
