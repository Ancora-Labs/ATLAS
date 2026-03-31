import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ALERT_SEVERITY, appendProgress, loadTestsState, updateTaskInTestsState, CACHE_COMPLETION_OUTCOME, appendCacheOutcome } from "../../src/core/state_tracker.js";

describe("state_tracker", () => {
  let stateDir: string;
  let config: any;

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-state-tracker-"));
    config = {
      paths: {
        stateDir,
        progressFile: path.join(stateDir, "progress.txt"),
        testsStateFile: path.join(stateDir, "tests_state.json")
      }
    };
  });

  afterEach(async () => {
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  it("initializes tests state and updates task totals deterministically", async () => {
    const initial = await loadTestsState(config);
    assert.deepEqual(initial.totals, { passed: 0, failed: 0, running: 0, queued: 0 });

    await updateTaskInTestsState(config, { id: 1, title: "T1", kind: "unit" }, "passed", "ok");
    const updated = await loadTestsState(config);
    assert.equal(updated.tests.length, 1);
    assert.equal(updated.totals.passed, 1);
  });

  it("negative path: appendProgress creates file and appends message", async () => {
    await appendProgress(config, "hello world");
    const raw = await fs.readFile(config.paths.progressFile, "utf8");
    assert.ok(raw.includes("hello world"));
    assert.equal(ALERT_SEVERITY.CRITICAL, "critical");
  });
});

// ── CACHE_COMPLETION_OUTCOME enum ────────────────────────────────────────────

describe("CACHE_COMPLETION_OUTCOME enum", () => {
  it("exports all five canonical outcome values as frozen constants", () => {
    assert.equal(CACHE_COMPLETION_OUTCOME.MERGED,   "merged");
    assert.equal(CACHE_COMPLETION_OUTCOME.REOPEN,   "reopen");
    assert.equal(CACHE_COMPLETION_OUTCOME.ROLLBACK, "rollback");
    assert.equal(CACHE_COMPLETION_OUTCOME.TIMEOUT,  "timeout");
    assert.equal(CACHE_COMPLETION_OUTCOME.UNKNOWN,  "unknown");
    assert.ok(Object.isFrozen(CACHE_COMPLETION_OUTCOME), "must be frozen");
  });
});

// ── appendCacheOutcome ────────────────────────────────────────────────────────

describe("appendCacheOutcome — positive path", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-cache-outcome-"));
  });

  afterEach(async () => {
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  it("persists a cache-hit record and returns ok=true", async () => {
    const config = { paths: { stateDir } };
    const result = await appendCacheOutcome(config, {
      correlationId: "corr-001",
      cacheHit: true,
      completionOutcome: CACHE_COMPLETION_OUTCOME.MERGED,
    });
    assert.equal(result.ok, true);
    const file = path.join(stateDir, "cache_outcomes.jsonl");
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw.trim());
    assert.equal(parsed.cacheHit, true);
    assert.equal(parsed.completionOutcome, "merged");
    assert.equal(parsed.correlationId, "corr-001");
  });

  it("persists a cache-miss record and returns ok=true", async () => {
    const config = { paths: { stateDir } };
    const result = await appendCacheOutcome(config, {
      cacheHit: false,
      completionOutcome: CACHE_COMPLETION_OUTCOME.ROLLBACK,
    });
    assert.equal(result.ok, true);
    const file = path.join(stateDir, "cache_outcomes.jsonl");
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw.trim());
    assert.equal(parsed.cacheHit, false);
    assert.equal(parsed.completionOutcome, "rollback");
  });

  it("appends multiple records correctly (newline-separated JSONL)", async () => {
    const config = { paths: { stateDir } };
    await appendCacheOutcome(config, { cacheHit: true,  completionOutcome: "merged" });
    await appendCacheOutcome(config, { cacheHit: false, completionOutcome: "timeout" });
    const file = path.join(stateDir, "cache_outcomes.jsonl");
    const lines = (await fs.readFile(file, "utf8")).trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).completionOutcome, "merged");
    assert.equal(JSON.parse(lines[1]).completionOutcome, "timeout");
  });
});

describe("appendCacheOutcome — negative path", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-cache-outcome-neg-"));
  });

  afterEach(async () => {
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  it("returns ok=false when record is null", async () => {
    const config = { paths: { stateDir } };
    const result = await appendCacheOutcome(config, null as any);
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes("null"));
  });

  it("returns ok=false when cacheHit is not a boolean", async () => {
    const config = { paths: { stateDir } };
    const result = await appendCacheOutcome(config, { cacheHit: "yes" as any, completionOutcome: "merged" });
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes("cacheHit"));
  });

  it("returns ok=false when completionOutcome is an unknown value", async () => {
    const config = { paths: { stateDir } };
    const result = await appendCacheOutcome(config, { cacheHit: true, completionOutcome: "invalid_outcome" as any });
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes("invalid_outcome"));
  });
});

