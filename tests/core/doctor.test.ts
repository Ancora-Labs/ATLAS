import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runDoctor } from "../../src/core/doctor.js";

describe("doctor", () => {
  let originalTargetRepo: string | undefined;

  beforeEach(() => {
    originalTargetRepo = process.env.TARGET_REPO;
  });

  afterEach(async () => {
    if (originalTargetRepo === undefined) {
      delete process.env.TARGET_REPO;
    } else {
      process.env.TARGET_REPO = originalTargetRepo;
    }
  });

  it("returns checks object and warning list", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-doctor-"));
    const result = await runDoctor({
      paths: { stateDir: tmpDir },
      env: { githubToken: "x", targetRepo: "CanerDoqdu/Box", copilotCliCommand: "node" }
    });
    assert.equal(typeof result.ok, "boolean");
    assert.equal(typeof result.checks.node, "boolean");
    assert.ok(Array.isArray(result.warnings));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("negative path: emits integration warning when github token or target repo missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-doctor-"));
    const result = await runDoctor({
      paths: { stateDir: tmpDir },
      env: { githubToken: "", targetRepo: "", copilotCliCommand: "node" }
    });
    assert.equal(result.ok, false);
    assert.ok(result.warnings.some((w: string) => w.includes("GitHub integration not ready")));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("includes agentContracts in the checks object", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-doctor-"));
    const result = await runDoctor({
      paths: { stateDir: tmpDir },
      env: { githubToken: "x", targetRepo: "CanerDoqdu/Box", copilotCliCommand: "node" }
    });
    assert.ok("agentContracts" in result.checks, "checks must include agentContracts field");
    assert.equal(typeof result.checks.agentContracts, "boolean");
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("negative path: ok=false when agentContracts check fails", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-doctor-"));
    // ok is a composite of all critical checks — if agentContracts is false,
    // ok must also be false regardless of other check states.
    const result = await runDoctor({
      paths: { stateDir: tmpDir },
      env: { githubToken: "x", targetRepo: "CanerDoqdu/Box", copilotCliCommand: "node" }
    });
    // The check result itself is boolean; we verify the invariant:
    // ok === (node && githubToken && targetRepo && stateDir && agentContracts)
    const expectedOk = result.checks.node
      && result.checks.githubToken
      && result.checks.targetRepo
      && result.checks.stateDir
      && result.checks.agentContracts;
    assert.equal(result.ok, expectedOk, "ok must be false when any critical check fails including agentContracts");
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

