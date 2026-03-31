/**
 * carry_forward_ledger.js — Carry-forward debt tracking (Packet 11)
 *
 * Tracks unresolved postmortem lessons as debt items with owner,
 * due-cycle, and closure evidence. Integrates with Athena plan gates
 * to block acceptance when critical debt exceeds SLA.
 */

import path from "node:path";
import { createHash } from "node:crypto";
import { readJson, writeJson } from "./fs_utils.js";

/**
 * @typedef {object} DebtEntry
 * @property {string} id — unique debt ID
 * @property {string} lesson — the original lesson text
 * @property {string} fingerprint — deterministic SHA-256 fingerprint of the canonical lesson text
 * @property {string} owner — who should fix this
 * @property {number} openedCycle — cycle number when first detected
 * @property {number} dueCycle — cycle number by which it must be closed
 * @property {string} severity — "critical" | "warning"
 * @property {string|null} closedAt — ISO timestamp when closed, null if open
 * @property {string|null} closureEvidence — evidence that it was fixed
 * @property {number} cyclesOpen — how many cycles this has been open
 */

/**
 * Canonical form used for fingerprinting — strips prompt boilerplate phrases
 * so that semantically identical lessons produce the same fingerprint regardless
 * of preamble wording. Mirrors the normalisation in prometheus.ts.
 */
function canonicalize(text: string): string {
  const s = String(text || "").toLowerCase();
  return s
    .replace(/[`'"(){}]|\[|\]/g, " ")
    .replace(/create\s+and\s+complete\s+a\s+task\s+to\s+/g, "")
    .replace(/create\s+a\s+dedicated\s+task\s+to\s+/g, "")
    .replace(/this\s+is\s+now\s+a\s+gate\s*-?\s*blocking\s+item[^.]*\.?/g, "")
    .replace(/athena\s+must\s+(block|reject)[^.]*\.?/g, "")
    .replace(/this\s+fix\s+must\s+ship[^.]*\.?/g, "")
    .replace(/blocking\s+defect[^:]*:\s*/g, "")
    .replace(/\b(five|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\s+consecutive\s+postmortem\s+audit\s+records\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute a deterministic 16-hex-char SHA-256 fingerprint of a lesson/task text.
 * The fingerprint is based on the canonical form so that the same semantic content
 * always maps to the same fingerprint regardless of boilerplate preamble.
 * Returns null if the canonical text is too short to be meaningful.
 *
 * @param {string} text
 * @returns {string|null}
 */
export function computeFingerprint(text: string): string | null {
  const canonical = canonicalize(text);
  if (canonical.length < 5) return null;
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

const LEDGER_FILE = "carry_forward_ledger.json";

/**
 * Load the carry-forward ledger from state.
 *
 * @param {object} config
 * @returns {Promise<DebtEntry[]>}
 */
export async function loadLedger(config) {
  const stateDir = config?.paths?.stateDir || "state";
  const data = await readJson(path.join(stateDir, LEDGER_FILE), { entries: [] });
  return Array.isArray(data.entries) ? data.entries : [];
}

/**
 * Load the carry-forward ledger and its cycle counter from state.
 * The cycleCounter is a persistent integer that is incremented once per
 * orchestration cycle so that debt SLA deadlines stay anchored to a
 * monotonic sequence that is independent of wall-clock timestamps.
 *
 * @param {object} config
 * @returns {Promise<{ entries: DebtEntry[], cycleCounter: number }>}
 */
export async function loadLedgerMeta(config): Promise<{ entries: any[], cycleCounter: number }> {
  const stateDir = config?.paths?.stateDir || "state";
  const data = await readJson(path.join(stateDir, LEDGER_FILE), { entries: [], cycleCounter: 1 });
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const cycleCounter = typeof data.cycleCounter === "number" && data.cycleCounter > 0
    ? data.cycleCounter
    : 1;
  return { entries, cycleCounter };
}

/**
 * Save the ledger to state.
 *
 * @param {object} config
 * @param {DebtEntry[]} entries
 */
export async function saveLedger(config, entries) {
  const stateDir = config?.paths?.stateDir || "state";
  await writeJson(path.join(stateDir, LEDGER_FILE), {
    entries,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Save the ledger with an explicit cycle counter.
 * Use this when advancing the cycle (end-of-cycle accumulation path).
 *
 * @param {object} config
 * @param {DebtEntry[]} entries
 * @param {number} cycleCounter
 */
export async function saveLedgerFull(config, entries, cycleCounter: number) {
  const stateDir = config?.paths?.stateDir || "state";
  await writeJson(path.join(stateDir, LEDGER_FILE), {
    entries,
    cycleCounter,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Add new debt entries from postmortem follow-ups.
 * Deduplicates by normalized lesson text.
 * When a new item matches an existing open entry (same fingerprint), increments
 * `recurrenceCount` on the canonical entry rather than adding a duplicate.
 *
 * @param {DebtEntry[]} ledger — existing entries
 * @param {Array<{ followUpTask: string, workerName?: string, severity?: string }>} newItems
 * @param {number} currentCycle
 * @param {{ slaMaxCycles?: number }} opts
 * @returns {DebtEntry[]} — updated ledger
 */
export function addDebtEntries(ledger, newItems, currentCycle, opts: any = {}) {
  const sla = opts.slaMaxCycles || 3;
  const existing = [...ledger];

  // Build fingerprint → open entry map so we can increment recurrenceCount in-place.
  const openByFingerprint = new Map<string, any>();
  for (const e of existing) {
    if (e.closedAt) continue;
    const fp = e.fingerprint || computeFingerprint(String(e.lesson || ""));
    if (fp && !openByFingerprint.has(fp)) {
      openByFingerprint.set(fp, e);
    }
  }

  for (const item of (newItems || [])) {
    const lesson = String(item.followUpTask || "").trim();
    if (!lesson || lesson.length < 10) continue;
    const fingerprint = computeFingerprint(lesson);
    if (!fingerprint) continue;

    const canonicalEntry = openByFingerprint.get(fingerprint);
    if (canonicalEntry) {
      // Duplicate: bump recurrence count on the existing canonical entry instead
      // of creating a new debt item.
      canonicalEntry.recurrenceCount = (canonicalEntry.recurrenceCount || 1) + 1;
      canonicalEntry.lastRecurredCycle = currentCycle;
      continue;
    }

    const newEntry: any = {
      id: `debt-${currentCycle}-${existing.length}`,
      lesson,
      fingerprint,
      owner: item.workerName || "evolution-worker",
      openedCycle: currentCycle,
      dueCycle: currentCycle + sla,
      severity: item.severity || "warning",
      closedAt: null,
      closureEvidence: null,
      cyclesOpen: 0,
      recurrenceCount: 1,
    };
    existing.push(newEntry);
    openByFingerprint.set(fingerprint, newEntry);
  }

  return existing;
}

/**
 * Increment cycle counters for open entries and flag overdue items.
 * Also identifies entries that are approaching their due cycle (within 1 cycle)
 * as an early-warning tier so callers can escalate before the hard SLA breach.
 *
 * @param {DebtEntry[]} ledger
 * @param {number} currentCycle
 * @returns {{ ledger: DebtEntry[], overdue: DebtEntry[], earlyWarning: DebtEntry[] }}
 */
export function tickCycle(ledger, currentCycle) {
  const overdue = [];
  const earlyWarning = [];
  for (const entry of ledger) {
    if (entry.closedAt) continue;
    entry.cyclesOpen = currentCycle - entry.openedCycle;
    if (currentCycle > entry.dueCycle) {
      overdue.push(entry);
    } else if (currentCycle >= entry.dueCycle - 1) {
      // One cycle before the SLA deadline — surface as early warning.
      earlyWarning.push(entry);
    }
  }
  return { ledger, overdue, earlyWarning };
}

/**
 * Close a debt entry with evidence.
 *
 * @param {DebtEntry[]} ledger
 * @param {string} debtId
 * @param {string} evidence
 * @returns {boolean} — true if found and closed
 */
export function closeDebt(ledger, debtId, evidence) {
  const entry = ledger.find(e => e.id === debtId);
  if (!entry || entry.closedAt) return false;
  entry.closedAt = new Date().toISOString();
  entry.closureEvidence = evidence;
  return true;
}

/**
 * Get all open (unclosed) debt entries.
 *
 * @param {DebtEntry[]} ledger
 * @returns {DebtEntry[]}
 */
export function getOpenDebts(ledger) {
  return ledger.filter(e => !e.closedAt);
}

/**
 * Auto-close open debt entries that have been verified as resolved.
 *
 * A debt entry is considered resolved when a completed worker task has a
 * canonical fingerprint that matches the entry's fingerprint AND the worker
 * supplied non-trivial verification evidence (>= 5 characters).
 *
 * Entries without a matching resolved item remain open and continue to block
 * future cycles via shouldBlockOnDebt. This is intentional: we never close
 * debt speculatively — evidence is required.
 *
 * @param {DebtEntry[]} ledger — carry-forward ledger (mutated in place)
 * @param {Array<{ taskText: string, verificationEvidence: string }>} resolvedItems
 * @returns {number} — count of newly closed entries
 */
export function autoCloseVerifiedDebt(
  ledger: any[],
  resolvedItems: Array<{ taskText: string; verificationEvidence: string }>
): number {
  if (!Array.isArray(resolvedItems) || resolvedItems.length === 0) return 0;

  // Build fingerprint → evidence map for all resolved items with real evidence.
  const resolvedFingerprints = new Map<string, string>();
  for (const item of resolvedItems) {
    const evidence = String(item.verificationEvidence || "").trim();
    if (evidence.length < 5) continue;
    const fingerprint = computeFingerprint(String(item.taskText || ""));
    if (!fingerprint) continue;
    if (!resolvedFingerprints.has(fingerprint)) {
      resolvedFingerprints.set(fingerprint, evidence);
    }
  }

  if (resolvedFingerprints.size === 0) return 0;

  let closedCount = 0;
  for (const entry of ledger) {
    if (entry.closedAt) continue;
    const entryFp = entry.fingerprint || computeFingerprint(String(entry.lesson || ""));
    if (!entryFp) continue;
    const evidence = resolvedFingerprints.get(entryFp);
    if (evidence !== undefined) {
      entry.closedAt = new Date().toISOString();
      entry.closureEvidence = evidence.slice(0, 500);
      closedCount++;
    }
  }

  return closedCount;
}

/**
 * Return open debt entries sorted by priority for operator attention.
 *
 * Sort order (highest priority first):
 *   1. critical + overdue (currentCycle > dueCycle)
 *   2. warning  + overdue
 *   3. critical + approaching-SLA (within 1 cycle of due)
 *   4. warning  + not-yet-overdue
 *
 * Within each tier, entries are sorted by cyclesOpen descending (stalest first).
 *
 * Side-effect: updates `cyclesOpen` on each returned open entry.
 * Closed entries are excluded.
 *
 * @param {DebtEntry[]} ledger
 * @param {number} currentCycle
 * @returns {DebtEntry[]}
 */
export function prioritizeStaleDebts(ledger: any[], currentCycle: number): any[] {
  const open = ledger.filter(e => !e.closedAt);
  for (const entry of open) {
    entry.cyclesOpen = currentCycle - entry.openedCycle;
  }
  return open.sort((a, b) => {
    const aOverdue = currentCycle > a.dueCycle;
    const bOverdue = currentCycle > b.dueCycle;
    const aCritical = a.severity === "critical";
    const bCritical = b.severity === "critical";
    // Priority tiers: critical+overdue=4, warning+overdue=3, critical+pending=2, warning+pending=1
    const aScore = (aCritical ? 2 : 1) + (aOverdue ? 2 : 0);
    const bScore = (bCritical ? 2 : 1) + (bOverdue ? 2 : 0);
    if (aScore !== bScore) return bScore - aScore;
    // Tiebreak: stalest first
    return b.cyclesOpen - a.cyclesOpen;
  });
}

/**
 * Check if critical overdue debt should block plan acceptance.
 * Returns a structured `reasonCode` so callers can react programmatically
 * without parsing the free-form reason string.
 *
 * @param {DebtEntry[]} ledger
 * @param {number} currentCycle
 * @param {{ maxCriticalOverdue?: number }} opts
 * @returns {{ shouldBlock: boolean, reason: string, reasonCode: string|null, overdueCount: number, earlyWarningCount: number }}
 */
export function shouldBlockOnDebt(ledger, currentCycle, opts: any = {}) {
  const maxCritical = opts.maxCriticalOverdue ?? 3;
  const { overdue, earlyWarning } = tickCycle(ledger, currentCycle);
  const criticalOverdue = overdue.filter(e => e.severity === "critical");
  const criticalEarlyWarning = earlyWarning.filter(e => e.severity === "critical");

  if (criticalOverdue.length >= maxCritical) {
    return {
      shouldBlock: true,
      reason: `${criticalOverdue.length} critical debt items overdue (limit: ${maxCritical})`,
      reasonCode: "DEBT_SLA_EXCEEDED",
      overdueCount: criticalOverdue.length,
      earlyWarningCount: criticalEarlyWarning.length,
    };
  }
  return {
    shouldBlock: false,
    reason: criticalEarlyWarning.length > 0
      ? `${criticalEarlyWarning.length} critical debt item(s) approaching SLA deadline`
      : "",
    reasonCode: criticalEarlyWarning.length > 0 ? "DEBT_APPROACHING_SLA" : null,
    overdueCount: criticalOverdue.length,
    earlyWarningCount: criticalEarlyWarning.length,
  };
}



// ── Reviewer Debt Tracking ────────────────────────────────────────────────────

/**
 * Create a carry-forward debt entry if the reviewer false positive rate is
 * persistently high (exceeds threshold AND we have enough known outcomes).
 *
 * Guards:
 *   - knownOutcomes < 5 -> no action (too sparse to be meaningful)
 *   - An open debt with the "reviewer-high-fpr" marker already exists -> no duplicate
 *   - falsePositiveRate <= threshold -> no action
 *
 * @param {DebtEntry[]} ledger - existing carry-forward ledger
 * @param {{ falsePositiveRate: number|null, knownOutcomes: number }} metrics
 * @param {number} currentCycle
 * @param {{ fpRateThreshold?: number, slaMaxCycles?: number }} opts
 * @returns {DebtEntry[]} - updated ledger (new array; original is not mutated)
 */
export function createReviewerDebtIfNeeded(
  ledger: any[],
  metrics: { falsePositiveRate: number | null; knownOutcomes: number },
  currentCycle: number,
  opts: any = {}
): any[] {
  const threshold  = typeof opts.fpRateThreshold === "number" ? opts.fpRateThreshold : 0.3;
  const sla        = typeof opts.slaMaxCycles    === "number" ? opts.slaMaxCycles    : 3;
  const fpr        = metrics?.falsePositiveRate;
  const known      = metrics?.knownOutcomes ?? 0;

  // Require minimum sample before raising debt
  if (fpr === null || fpr === undefined || known < 5 || fpr <= threshold) return [...ledger];

  const existing = [...ledger];
  const alreadyOpen = existing.some(
    e => !e.closedAt && typeof e.lesson === "string" && e.lesson.includes("reviewer-high-fpr")
  );
  if (alreadyOpen) return existing;

  const lesson = `reviewer-high-fpr: Athena approved ${(fpr * 100).toFixed(1)}% of plans that failed ` +
    `(threshold ${(threshold * 100).toFixed(0)}%) — review and tighten plan quality gate`;
  const fingerprint = computeFingerprint(lesson);
  if (!fingerprint) return existing;

  existing.push({
    id:              `debt-reviewer-${currentCycle}`,
    lesson,
    fingerprint,
    owner:           "governance-worker",
    openedCycle:     currentCycle,
    dueCycle:        currentCycle + sla,
    severity:        "critical",
    closedAt:        null,
    closureEvidence: null,
    cyclesOpen:      0,
  });
  return existing;
}

// ── Duplicate clustering and ledger compression ───────────────────────────────

/**
 * Cluster open debt entries by their fingerprint.
 *
 * Returns a Map from fingerprint → array of open entries with that fingerprint,
 * limited to clusters that contain more than one entry (true duplicates).
 * Entries without a fingerprint are ignored (they cannot be deduplicated safely).
 *
 * @param {any[]} ledger
 * @returns {Map<string, any[]>} fingerprint → array of duplicate open entries
 */
export function clusterDuplicateDebts(ledger: any[]): any[][] {
  const map = new Map<string, any[]>();

  for (const entry of (ledger || [])) {
    if (entry.closedAt) continue; // only cluster open entries
    const fp = entry.fingerprint || computeFingerprint(String(entry.lesson || ""));
    if (!fp) continue;

    if (!map.has(fp)) {
      map.set(fp, []);
    }
    map.get(fp)!.push(entry);
  }

  // Remove singletons — only return actual duplicates
  for (const [fp, entries] of map) {
    if (entries.length <= 1) map.delete(fp);
  }

  return Array.from(map.values());
}

/**
 * Compress unresolved debt by collapsing duplicate open entries (same fingerprint)
 * into a single canonical item and retiring the redundant copies.
 *
 * Algorithm:
 *   1. Group open entries by fingerprint.
 *   2. For each group with ≥ 2 open entries:
 *      - Keep the oldest entry (lowest openedCycle, then first insertion order).
 *        The canonical entry is annotated with recurrence metadata:
 *          - `recurrenceCount`   total number of times this lesson has been recorded
 *          - `firstSeenCycle`    the earliest openedCycle in the cluster
 *          - `lastRecurredCycle` the most recent openedCycle in the cluster
 *          - `clusterSize`       synonym for recurrenceCount (operator visibility)
 *          - `clusterFingerprint` stable fingerprint linking all members
 *      - Close the remaining entries with strict retirement evidence that
 *        embeds the canonical ID, canonical lesson text (first 120 chars),
 *        and cluster-fingerprint so entries are fully traceable without
 *        cross-referencing the rest of the ledger.
 *   3. Return the mutated ledger (in-place), a count of retired entries, and
 *      a summary of clusters processed.
 *
 * This operation is idempotent: running twice produces the same result because
 * the redundant entries are already closed after the first run.
 *
 * @param {any[]} ledger — carry-forward ledger (mutated in place)
 * @returns {{ compressedCount: number, clustersProcessed: number, retirementIds: string[] }}
 */
export function compressLedger(ledger: any[]): {
  compressedCount: number;
  clustersProcessed: number;
  retirementIds: string[];
} {
  if (!Array.isArray(ledger) || ledger.length === 0) {
    return { compressedCount: 0, clustersProcessed: 0, retirementIds: [] };
  }

  const clusters = clusterDuplicateDebts(ledger);
  let compressedCount = 0;
  let clustersProcessed = 0;
  const retirementIds: string[] = [];
  const retiredAt = new Date().toISOString();

  for (const entries of clusters) {
    // Sort by openedCycle ascending, then by array index (first insertion wins)
    const sorted = [...entries].sort((a, b) => {
      const cycleDiff = (a.openedCycle || 0) - (b.openedCycle || 0);
      return cycleDiff !== 0 ? cycleDiff : ledger.indexOf(a) - ledger.indexOf(b);
    });

    const canonical = sorted[0];
    const duplicates = sorted.slice(1);
    const fp = canonical.fingerprint || canonical.clusterFingerprint || "";
    const clusterSize = duplicates.length + 1;

    // Recurrence metadata: reflect how many times this lesson has appeared across
    // cycles, and the full cycle range to give operators a recurrence timeline.
    const allCycles = sorted.map(e => e.openedCycle || 0);
    const firstSeenCycle = Math.min(...allCycles);
    const lastRecurredCycle = Math.max(...allCycles);
    // Preserve the highest recurrenceCount already accumulated via addDebtEntries.
    const priorRecurrence = Math.max(...sorted.map(e => e.recurrenceCount || 1));
    const resolvedRecurrenceCount = Math.max(clusterSize, priorRecurrence);

    canonical.clusterSize = clusterSize;
    canonical.clusterFingerprint = fp;
    canonical.recurrenceCount = resolvedRecurrenceCount;
    canonical.firstSeenCycle = firstSeenCycle;
    canonical.lastRecurredCycle = lastRecurredCycle;

    // Strict closure evidence: include canonical lesson text so retired entries
    // are fully traceable without a secondary ledger lookup.
    const canonicalLessonSnippet = String(canonical.lesson || "").slice(0, 120);

    // Retire each duplicate with strict retirement evidence
    for (const dup of duplicates) {
      dup.closedAt = retiredAt;
      dup.closureEvidence = [
        `retired-by-compression:`,
        `canonical-id=${canonical.id}`,
        `cluster-fingerprint=${fp}`,
        `cluster-size=${clusterSize}`,
        `recurrence-count=${resolvedRecurrenceCount}`,
        `first-seen-cycle=${firstSeenCycle}`,
        `last-recurred-cycle=${lastRecurredCycle}`,
        `canonical-lesson="${canonicalLessonSnippet}"`,
      ].join(" ");
      retirementIds.push(dup.id);
      compressedCount++;
    }

    clustersProcessed++;
  }

  return { compressedCount, clustersProcessed, retirementIds };
}
