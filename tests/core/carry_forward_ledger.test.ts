import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  addDebtEntries,
  tickCycle,
  closeDebt,
  getOpenDebts,
  shouldBlockOnDebt,
  computeFingerprint,
  loadLedgerMeta,
  saveLedgerFull,
  autoCloseVerifiedDebt,
  prioritizeStaleDebts,
} from "../../src/core/carry_forward_ledger.js";

describe("carry_forward_ledger", () => {
  describe("addDebtEntries", () => {
    it("adds valid debt entries to empty ledger", () => {
      const result = addDebtEntries([], [
        { followUpTask: "Fix flaky test in worker runner module", workerName: "evolution-worker", severity: "critical" },
      ], 5);
      assert.equal(result.length, 1);
      assert.equal(result[0].lesson, "Fix flaky test in worker runner module");
      assert.equal(result[0].owner, "evolution-worker");
      assert.equal(result[0].openedCycle, 5);
      assert.equal(result[0].dueCycle, 8); // default SLA = 3
      assert.equal(result[0].severity, "critical");
      assert.equal(result[0].closedAt, null);
      // fingerprint is stamped and deterministic
      assert.ok(typeof result[0].fingerprint === "string" && result[0].fingerprint.length === 16);
      assert.equal(result[0].fingerprint, computeFingerprint("Fix flaky test in worker runner module"));
    });

    it("deduplicates by deterministic fingerprint", () => {
      const existing = [{
        id: "debt-1-0",
        lesson: "Fix flaky test",
        fingerprint: computeFingerprint("Fix flaky test"),
        owner: "w",
        openedCycle: 1,
        dueCycle: 4,
        severity: "warning",
        closedAt: null,
        closureEvidence: null,
        cyclesOpen: 0,
      }];
      const result = addDebtEntries(existing, [
        { followUpTask: "Fix flaky test" }, // identical canonical form → same fingerprint
      ], 2);
      assert.equal(result.length, 1); // no duplicate added
    });

    it("deduplicates legacy entries without fingerprint field by computing on-the-fly", () => {
      const existing = [{
        id: "debt-1-0",
        lesson: "Fix flaky test",
        // no fingerprint field — simulates a pre-upgrade ledger entry
        owner: "w",
        openedCycle: 1,
        dueCycle: 4,
        severity: "warning",
        closedAt: null,
        closureEvidence: null,
        cyclesOpen: 0,
      }];
      const result = addDebtEntries(existing, [
        { followUpTask: "Fix flaky test" },
      ], 2);
      assert.equal(result.length, 1);
    });

    it("ignores items with short lesson text", () => {
      const result = addDebtEntries([], [
        { followUpTask: "short" },
      ], 1);
      assert.equal(result.length, 0);
    });

    it("respects custom SLA", () => {
      const result = addDebtEntries([], [
        { followUpTask: "A sufficiently long lesson text for testing", severity: "warning" },
      ], 10, { slaMaxCycles: 5 });
      assert.equal(result[0].dueCycle, 15);
    });
  });

  describe("tickCycle", () => {
    it("increments cyclesOpen and detects overdue", () => {
      const ledger = [{
        id: "debt-1-0",
        lesson: "Old unresolved lesson",
        owner: "w",
        openedCycle: 1,
        dueCycle: 3,
        severity: "critical",
        closedAt: null,
        closureEvidence: null,
        cyclesOpen: 0,
      }];
      const { overdue } = tickCycle(ledger, 5);
      assert.equal(ledger[0].cyclesOpen, 4);
      assert.equal(overdue.length, 1);
    });

    it("skips closed entries", () => {
      const ledger = [{
        id: "debt-1-0",
        lesson: "Closed lesson",
        owner: "w",
        openedCycle: 1,
        dueCycle: 3,
        severity: "critical",
        closedAt: "2025-01-01T00:00:00Z",
        closureEvidence: "fixed",
        cyclesOpen: 0,
      }];
      const { overdue } = tickCycle(ledger, 5);
      assert.equal(overdue.length, 0);
      assert.equal(ledger[0].cyclesOpen, 0); // unchanged
    });
  });

  describe("closeDebt", () => {
    it("closes an open entry", () => {
      const ledger = [{
        id: "debt-1-0",
        lesson: "Lesson",
        owner: "w",
        openedCycle: 1,
        dueCycle: 4,
        severity: "warning",
        closedAt: null,
        closureEvidence: null,
        cyclesOpen: 2,
      }];
      const result = closeDebt(ledger, "debt-1-0", "PR #123 merged");
      assert.equal(result, true);
      assert.ok(ledger[0].closedAt);
      assert.equal(ledger[0].closureEvidence, "PR #123 merged");
    });

    it("returns false for unknown id", () => {
      assert.equal(closeDebt([], "nonexistent", "evidence"), false);
    });

    it("returns false for already-closed entry", () => {
      const ledger = [{
        id: "debt-1-0",
        lesson: "Lesson",
        owner: "w",
        openedCycle: 1,
        dueCycle: 4,
        severity: "warning",
        closedAt: "2025-01-01",
        closureEvidence: "fixed",
        cyclesOpen: 0,
      }];
      assert.equal(closeDebt(ledger, "debt-1-0", "new evidence"), false);
    });
  });

  describe("getOpenDebts", () => {
    it("returns only unclosed entries", () => {
      const ledger = [
        { id: "d1", closedAt: null },
        { id: "d2", closedAt: "2025-01-01" },
        { id: "d3", closedAt: null },
      ];
      const open = getOpenDebts(ledger);
      assert.equal(open.length, 2);
      assert.deepEqual(open.map(e => e.id), ["d1", "d3"]);
    });
  });

  describe("shouldBlockOnDebt", () => {
    it("blocks when critical overdue count exceeds threshold", () => {
      const ledger = [
        { id: "d1", lesson: "A", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
        { id: "d2", lesson: "B", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
        { id: "d3", lesson: "C", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
      ];
      const result = shouldBlockOnDebt(ledger, 10, { maxCriticalOverdue: 3 });
      assert.equal(result.shouldBlock, true);
      assert.equal(result.overdueCount, 3);
    });

    it("does not block when under threshold", () => {
      const ledger = [
        { id: "d1", lesson: "A", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
        { id: "d2", lesson: "B", openedCycle: 1, dueCycle: 2, severity: "warning", closedAt: null, cyclesOpen: 0 },
      ];
      const result = shouldBlockOnDebt(ledger, 10, { maxCriticalOverdue: 3 });
      assert.equal(result.shouldBlock, false);
    });

    it("does not block with empty ledger", () => {
      const result = shouldBlockOnDebt([], 10);
      assert.equal(result.shouldBlock, false);
      assert.equal(result.overdueCount, 0);
    });
  });

  describe("computeFingerprint", () => {
    it("returns a 16-character hex string", () => {
      const fp = computeFingerprint("Fix the validation harness in worker runner");
      assert.ok(typeof fp === "string");
      assert.equal(fp.length, 16);
      assert.match(fp, /^[0-9a-f]{16}$/);
    });

    it("is deterministic — same input always produces same fingerprint", () => {
      const text = "Upgrade evaluation stack to reduce flakiness";
      assert.equal(computeFingerprint(text), computeFingerprint(text));
    });

    it("strips boilerplate before hashing — noise-equivalent texts share a fingerprint", () => {
      const withNoise = "Create and complete a task to fix the verification harness";
      const canonical = "fix the verification harness";
      assert.equal(computeFingerprint(withNoise), computeFingerprint(canonical));
    });

    it("distinguishes semantically different texts", () => {
      assert.notEqual(
        computeFingerprint("Fix flaky test in worker runner"),
        computeFingerprint("Add circuit breaker for model calls")
      );
    });

    it("returns null for text that is too short after canonicalization", () => {
      assert.equal(computeFingerprint(""), null);
      assert.equal(computeFingerprint("  "), null);
    });
  });
});

// ── loadLedgerMeta / saveLedgerFull — persistence layer ──────────────────────

describe("loadLedgerMeta / saveLedgerFull", () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-cfl-meta-"));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function cfg() {
    return { paths: { stateDir: tmpDir } };
  }

  it("defaults cycleCounter to 1 when ledger file does not exist", async () => {
    const { entries, cycleCounter } = await loadLedgerMeta(cfg());
    assert.deepEqual(entries, []);
    assert.equal(cycleCounter, 1);
  });

  it("saveLedgerFull persists entries and cycleCounter; loadLedgerMeta reads them back", async () => {
    const entry = {
      id: "debt-1-0",
      lesson: "Fix the validation harness",
      fingerprint: computeFingerprint("Fix the validation harness"),
      owner: "evolution-worker",
      openedCycle: 1,
      dueCycle: 4,
      severity: "critical",
      closedAt: null,
      closureEvidence: null,
      cyclesOpen: 0,
    };
    await saveLedgerFull(cfg(), [entry], 7);

    const { entries, cycleCounter } = await loadLedgerMeta(cfg());
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, "debt-1-0");
    assert.equal(cycleCounter, 7);
  });

  it("loadLedgerMeta falls back to cycleCounter=1 when field is missing from file", async () => {
    const filePath = path.join(tmpDir, "carry_forward_ledger.json");
    await fs.writeFile(filePath, JSON.stringify({ entries: [] }), "utf8");

    const { cycleCounter } = await loadLedgerMeta(cfg());
    assert.equal(cycleCounter, 1);
  });

  it("loadLedgerMeta falls back to cycleCounter=1 when field is zero or negative", async () => {
    const filePath = path.join(tmpDir, "carry_forward_ledger.json");
    await fs.writeFile(filePath, JSON.stringify({ entries: [], cycleCounter: 0 }), "utf8");

    const { cycleCounter } = await loadLedgerMeta(cfg());
    assert.equal(cycleCounter, 1);
  });
});

// ── autoCloseVerifiedDebt ─────────────────────────────────────────────────────

describe("autoCloseVerifiedDebt", () => {
  function makeEntry(lesson: string, id = "debt-1-0"): any {
    return {
      id,
      lesson,
      fingerprint: computeFingerprint(lesson),
      owner: "evolution-worker",
      openedCycle: 1,
      dueCycle: 4,
      severity: "critical",
      closedAt: null,
      closureEvidence: null,
      cyclesOpen: 0,
    };
  }

  it("closes a matching open entry when evidence is provided", () => {
    const lesson = "Fix flaky worker runner test suite reliability issue";
    const ledger = [makeEntry(lesson)];
    const count = autoCloseVerifiedDebt(ledger, [
      { taskText: lesson, verificationEvidence: "All tests pass — PR #99 merged" },
    ]);
    assert.equal(count, 1, "One entry must be closed");
    assert.ok(ledger[0].closedAt, "closedAt must be set");
    assert.equal(ledger[0].closureEvidence, "All tests pass — PR #99 merged");
  });

  it("does NOT close an entry when evidence is missing or too short", () => {
    const lesson = "Fix broken governance canary breach detection path";
    const ledger = [makeEntry(lesson)];

    // No evidence
    let count = autoCloseVerifiedDebt(ledger, [{ taskText: lesson, verificationEvidence: "" }]);
    assert.equal(count, 0, "Must not close with empty evidence");

    // Evidence too short (< 5 chars)
    count = autoCloseVerifiedDebt(ledger, [{ taskText: lesson, verificationEvidence: "ok" }]);
    assert.equal(count, 0, "Must not close with trivially short evidence");

    assert.equal(ledger[0].closedAt, null, "Entry must remain open");
  });

  it("does NOT close an entry when task text does not fingerprint-match the lesson", () => {
    const ledger = [makeEntry("Fix the orchestrator dispatch retry logic")];
    const count = autoCloseVerifiedDebt(ledger, [
      { taskText: "Completely unrelated task about documentation", verificationEvidence: "Done — PR #77 merged" },
    ]);
    assert.equal(count, 0, "Non-matching task must not close any entry");
    assert.equal(ledger[0].closedAt, null);
  });

  it("does NOT re-close an already-closed entry", () => {
    const lesson = "Fix the carry-forward SLA accounting cycle counter bug";
    const ledger = [makeEntry(lesson)];
    // Close first time
    autoCloseVerifiedDebt(ledger, [{ taskText: lesson, verificationEvidence: "PR #1 merged" }]);
    assert.ok(ledger[0].closedAt);
    // Try again with different evidence
    const count2 = autoCloseVerifiedDebt(ledger, [
      { taskText: lesson, verificationEvidence: "PR #2 merged (second attempt)" },
    ]);
    assert.equal(count2, 0, "Already-closed entry must not be re-closed");
  });

  it("closes only matching entries in a mixed ledger", () => {
    const resolvedLesson = "Fix the worker batch planner wave ordering contract";
    const unresolvedLesson = "Resolve the governance freeze gate risk-level evaluation gap";
    const ledger = [
      makeEntry(resolvedLesson, "debt-1-0"),
      makeEntry(unresolvedLesson, "debt-1-1"),
    ];

    const count = autoCloseVerifiedDebt(ledger, [
      { taskText: resolvedLesson, verificationEvidence: "Tests pass, PR merged" },
    ]);

    assert.equal(count, 1, "Exactly one entry must be closed");
    assert.ok(ledger[0].closedAt, "First entry must be closed");
    assert.equal(ledger[1].closedAt, null, "Second entry must remain open");
  });

  it("returns 0 for empty resolvedItems", () => {
    const ledger = [makeEntry("Fix something critical in the pipeline")];
    assert.equal(autoCloseVerifiedDebt(ledger, []), 0);
    assert.equal(ledger[0].closedAt, null);
  });

  it("returns 0 for empty ledger", () => {
    const count = autoCloseVerifiedDebt([], [
      { taskText: "Fix something", verificationEvidence: "Done — tests pass" },
    ]);
    assert.equal(count, 0);
  });

  it("negative path: unresolved critical debt item remains blocking after partial close", () => {
    const resolvedLesson = "Fix the worker runner retry loop transient error handling";
    const blockingLesson = "Fix governance canary breach detection false negative path";
    const ledger = [
      makeEntry(resolvedLesson, "debt-r"),
      { ...makeEntry(blockingLesson, "debt-b"), severity: "critical" },
      { ...makeEntry("Another critical issue", "debt-c"), severity: "critical", fingerprint: computeFingerprint("Another critical issue") },
    ];

    autoCloseVerifiedDebt(ledger, [
      { taskText: resolvedLesson, verificationEvidence: "PR #100 merged — tests pass" },
    ]);

    // Resolved entry is now closed; the critical ones are still open
    const shouldBlock = ledger
      .filter(e => !e.closedAt && e.severity === "critical")
      .length >= 2;
    assert.equal(shouldBlock, true, "Unresolved critical debt must still block after partial close");
  });
});

// ── tickCycle early warning tier ─────────────────────────────────────────────

describe("tickCycle — early warning", () => {
  it("includes entries one cycle before their due date in earlyWarning", () => {
    const ledger = [{
      id: "debt-1-0",
      lesson: "Approaching deadline",
      owner: "w",
      openedCycle: 1,
      dueCycle: 6,
      severity: "critical",
      closedAt: null,
      closureEvidence: null,
      cyclesOpen: 0,
    }];
    // currentCycle=5, dueCycle=6 → within one cycle of deadline → earlyWarning
    const { overdue, earlyWarning } = tickCycle(ledger, 5);
    assert.equal(overdue.length, 0, "not yet overdue");
    assert.equal(earlyWarning.length, 1, "must surface as early warning");
  });

  it("does not include entries with more than one cycle remaining in earlyWarning", () => {
    const ledger = [{
      id: "debt-1-0",
      lesson: "Not yet close to deadline",
      owner: "w",
      openedCycle: 1,
      dueCycle: 10,
      severity: "warning",
      closedAt: null,
      closureEvidence: null,
      cyclesOpen: 0,
    }];
    const { earlyWarning } = tickCycle(ledger, 5);
    assert.equal(earlyWarning.length, 0);
  });

  it("already-overdue entries appear in overdue, not earlyWarning", () => {
    const ledger = [{
      id: "debt-1-0",
      lesson: "Already overdue lesson",
      owner: "w",
      openedCycle: 1,
      dueCycle: 3,
      severity: "critical",
      closedAt: null,
      closureEvidence: null,
      cyclesOpen: 0,
    }];
    const { overdue, earlyWarning } = tickCycle(ledger, 7);
    assert.equal(overdue.length, 1);
    assert.equal(earlyWarning.length, 0);
  });

  it("closed entries do not appear in earlyWarning", () => {
    const ledger = [{
      id: "debt-1-0",
      lesson: "Closed lesson",
      owner: "w",
      openedCycle: 1,
      dueCycle: 6,
      severity: "critical",
      closedAt: "2025-01-01T00:00:00Z",
      closureEvidence: "fixed",
      cyclesOpen: 0,
    }];
    const { earlyWarning } = tickCycle(ledger, 5);
    assert.equal(earlyWarning.length, 0);
  });
});

// ── shouldBlockOnDebt — reason codes + early warning ─────────────────────────

describe("shouldBlockOnDebt — reason codes and early warning", () => {
  it("returns reasonCode=DEBT_SLA_EXCEEDED when blocking", () => {
    const ledger = [
      { id: "d1", lesson: "A", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
      { id: "d2", lesson: "B", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
      { id: "d3", lesson: "C", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
    ];
    const result = shouldBlockOnDebt(ledger, 10, { maxCriticalOverdue: 3 });
    assert.equal(result.shouldBlock, true);
    assert.equal(result.reasonCode, "DEBT_SLA_EXCEEDED");
  });

  it("returns reasonCode=DEBT_APPROACHING_SLA when a critical entry is one cycle from due", () => {
    const ledger = [{
      id: "d1",
      lesson: "Critical item about to breach SLA",
      openedCycle: 1,
      dueCycle: 6,
      severity: "critical",
      closedAt: null,
      cyclesOpen: 0,
    }];
    // currentCycle=5, dueCycle=6 → earlyWarning fires
    const result = shouldBlockOnDebt(ledger, 5, { maxCriticalOverdue: 3 });
    assert.equal(result.shouldBlock, false, "early warning must not hard-block");
    assert.equal(result.reasonCode, "DEBT_APPROACHING_SLA");
    assert.equal(result.earlyWarningCount, 1);
  });

  it("returns reasonCode=null and earlyWarningCount=0 when no issues", () => {
    const result = shouldBlockOnDebt([], 10);
    assert.equal(result.shouldBlock, false);
    assert.equal(result.reasonCode, null);
    assert.equal(result.earlyWarningCount, 0);
  });

  it("earlyWarningCount is exposed alongside overdueCount when blocking", () => {
    const ledger = [
      { id: "d1", lesson: "A", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
      { id: "d2", lesson: "B", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
      { id: "d3", lesson: "C", openedCycle: 1, dueCycle: 2, severity: "critical", closedAt: null, cyclesOpen: 0 },
    ];
    const result = shouldBlockOnDebt(ledger, 10, { maxCriticalOverdue: 3 });
    assert.ok(typeof result.earlyWarningCount === "number", "earlyWarningCount must always be present");
    assert.ok(typeof result.overdueCount === "number", "overdueCount must always be present");
  });

  it("negative: warning-severity early warning items do not set DEBT_APPROACHING_SLA", () => {
    const ledger = [{
      id: "d1",
      lesson: "Warning item approaching SLA",
      openedCycle: 1,
      dueCycle: 6,
      severity: "warning",
      closedAt: null,
      cyclesOpen: 0,
    }];
    const result = shouldBlockOnDebt(ledger, 5, { maxCriticalOverdue: 3 });
    assert.equal(result.shouldBlock, false);
    assert.equal(result.reasonCode, null, "warning-severity items must not set reasonCode");
    assert.equal(result.earlyWarningCount, 0, "earlyWarningCount counts only critical items");
  });
});

// ── prioritizeStaleDebts ──────────────────────────────────────────────────────

describe("prioritizeStaleDebts", () => {
  function makeDebt(opts: Partial<{
    id: string; lesson: string; severity: string;
    openedCycle: number; dueCycle: number; closedAt: string | null;
  }> = {}) {
    return {
      id:          opts.id          ?? "debt-1",
      lesson:      opts.lesson      ?? "Fix something important in the pipeline",
      severity:    opts.severity    ?? "warning",
      owner:       "evolution-worker",
      openedCycle: opts.openedCycle ?? 1,
      dueCycle:    opts.dueCycle    ?? 10,
      closedAt:    opts.closedAt    ?? null,
      closureEvidence: null,
      cyclesOpen:  0,
    };
  }

  it("returns empty array for empty ledger", () => {
    assert.deepEqual(prioritizeStaleDebts([], 5), []);
  });

  it("excludes closed entries", () => {
    const ledger = [
      makeDebt({ id: "d1", closedAt: "2025-01-01T00:00:00Z" }),
      makeDebt({ id: "d2" }),
    ];
    const result = prioritizeStaleDebts(ledger, 5);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "d2");
  });

  it("places critical+overdue first (highest priority)", () => {
    const ledger = [
      makeDebt({ id: "low",  severity: "warning",  openedCycle: 1, dueCycle: 10 }),
      makeDebt({ id: "high", severity: "critical", openedCycle: 1, dueCycle: 2  }), // overdue at cycle 5
    ];
    const result = prioritizeStaleDebts(ledger, 5);
    assert.equal(result[0].id, "high", "critical+overdue must be first");
    assert.equal(result[1].id, "low");
  });

  it("places warning+overdue above critical+pending", () => {
    const ledger = [
      makeDebt({ id: "crit-pending",  severity: "critical", openedCycle: 1, dueCycle: 10 }),
      makeDebt({ id: "warn-overdue",  severity: "warning",  openedCycle: 1, dueCycle: 2  }), // overdue
    ];
    const result = prioritizeStaleDebts(ledger, 5);
    assert.equal(result[0].id, "warn-overdue", "warning+overdue outranks critical+pending");
    assert.equal(result[1].id, "crit-pending");
  });

  it("sorts by cyclesOpen descending within same priority tier", () => {
    const ledger = [
      makeDebt({ id: "newer", severity: "critical", openedCycle: 4, dueCycle: 2 }), // overdue, cyclesOpen=1
      makeDebt({ id: "older", severity: "critical", openedCycle: 1, dueCycle: 2 }), // overdue, cyclesOpen=4
    ];
    const result = prioritizeStaleDebts(ledger, 5);
    assert.equal(result[0].id, "older", "stalest (most cycles open) must come first in same tier");
    assert.equal(result[1].id, "newer");
  });

  it("updates cyclesOpen on returned entries", () => {
    const ledger = [makeDebt({ openedCycle: 1 })];
    const result = prioritizeStaleDebts(ledger, 7);
    assert.equal(result[0].cyclesOpen, 6);
  });

  it("does not update cyclesOpen on closed entries (they are excluded)", () => {
    const closed = makeDebt({ closedAt: "2025-01-01T00:00:00Z", openedCycle: 1 });
    prioritizeStaleDebts([closed], 7);
    assert.equal(closed.cyclesOpen, 0, "cyclesOpen on closed entry must not be modified");
  });

  it("full priority ordering: critical+overdue > warning+overdue > critical+pending > warning+pending", () => {
    const ledger = [
      makeDebt({ id: "wp",  severity: "warning",  openedCycle: 1, dueCycle: 10 }),
      makeDebt({ id: "wo",  severity: "warning",  openedCycle: 1, dueCycle: 2  }), // overdue
      makeDebt({ id: "cp",  severity: "critical", openedCycle: 1, dueCycle: 10 }),
      makeDebt({ id: "co",  severity: "critical", openedCycle: 1, dueCycle: 2  }), // overdue
    ];
    const result = prioritizeStaleDebts(ledger, 5);
    assert.equal(result[0].id, "co", "1st: critical+overdue");
    assert.equal(result[1].id, "wo", "2nd: warning+overdue");
    assert.equal(result[2].id, "cp", "3rd: critical+pending");
    assert.equal(result[3].id, "wp", "4th: warning+pending");
  });

  it("negative path: all-closed ledger returns empty array", () => {
    const ledger = [
      makeDebt({ id: "d1", closedAt: "2025-01-01T00:00:00Z", severity: "critical" }),
      makeDebt({ id: "d2", closedAt: "2025-01-02T00:00:00Z", severity: "critical" }),
    ];
    const result = prioritizeStaleDebts(ledger, 10);
    assert.deepEqual(result, [], "closed entries must not appear in prioritized output");
  });
});
