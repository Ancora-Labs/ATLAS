import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  checkArchitectureDrift,
  normalizeAliasPath,
  detectDeprecatedTokensInContent,
  DEPRECATED_TOKENS,
  rankStaleRefsAsRemediationCandidates,
  type ArchitectureDriftReport,
} from "../../src/core/architecture_drift.js";

describe("architecture_drift", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-arch-drift-"));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("reports no stale references when all doc-mentioned paths exist", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "src", "core"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "src", "core", "orchestrator.ts"),
      "export {};\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(rootDir, "docs", "architecture.md"),
      "# Arch\n\nMain entry: `src/core/orchestrator.ts`\n",
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.equal(report.staleCount, 0);
    assert.equal(report.presentCount, 1);
    assert.deepEqual(report.staleReferences, []);
    assert.ok(report.scannedDocs.includes("docs/architecture.md"));
  });

  it("detects stale reference when a doc mentions a file that does not exist", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "src", "core"), { recursive: true });

    // Only orchestrator.ts exists; task_queue.ts does not
    await fs.writeFile(
      path.join(rootDir, "src", "core", "orchestrator.ts"),
      "export {};\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(rootDir, "docs", "architecture.md"),
      [
        "# Arch",
        "",
        "Present: `src/core/orchestrator.ts`",
        "Missing: `src/core/task_queue.ts`"
      ].join("\n"),
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.equal(report.staleCount, 1);
    assert.equal(report.presentCount, 1);
    assert.equal(report.staleReferences[0].referencedPath, "src/core/task_queue.ts");
    assert.equal(report.staleReferences[0].docPath, "docs/architecture.md");
    assert.equal(report.staleReferences[0].line, 4);
  });

  it("negative path: ignores absolute and environment paths — no false positives", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });

    // These must NOT be picked up — they are not repo-local prefixes
    await fs.writeFile(
      path.join(rootDir, "docs", "notes.md"),
      [
        "# Notes",
        "",
        "System path: `/etc/hosts`",
        "Home dir: `/home/user/.bashrc`",
        "Windows path: `C:\\Windows\\System32\\cmd.exe`",
        "Relative no-prefix: `lib/utils.ts`"
      ].join("\n"),
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.equal(report.staleCount, 0);
    assert.equal(report.presentCount, 0);
    assert.deepEqual(report.staleReferences, []);
  });

  it("handles multiple docs and aggregates stale refs across all of them", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "src", "core"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "docker"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "src", "core", "policy_engine.ts"),
      "export {};\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(rootDir, "docker", "Dockerfile"),
      "FROM node:20\n",
      "utf8"
    );

    await fs.writeFile(
      path.join(rootDir, "docs", "arch.md"),
      "Core: `src/core/policy_engine.ts` and `src/core/gates.ts`\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(rootDir, "docs", "ops.md"),
      "Docker: `docker/Dockerfile` — missing: `docker/worker.Dockerfile`\n",
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.equal(report.presentCount, 2);
    assert.equal(report.staleCount, 2);

    const stalePaths = report.staleReferences.map((r) => r.referencedPath);
    assert.ok(stalePaths.includes("src/core/gates.ts"));
    assert.ok(stalePaths.includes("docker/worker.Dockerfile"));
  });

  it("returns empty report when docs directory does not exist", async () => {
    // No docs/ directory created
    const report = await checkArchitectureDrift({ rootDir });
    assert.equal(report.staleCount, 0);
    assert.equal(report.presentCount, 0);
    assert.deepEqual(report.scannedDocs, []);
  });

  it("deduplicates repeated mentions of the same path within a doc", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "docs", "arch.md"),
      [
        "# Arch",
        "`src/core/missing.ts` is referenced here.",
        "And again: `src/core/missing.ts` for clarity."
      ].join("\n"),
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    // Same path in same doc should only be counted once
    assert.equal(report.staleCount, 1);
  });
});

describe("architecture_drift — recursive docs traversal (Task 1)", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-arch-drift-rec-"));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("recurses into docs subdirectories and scans nested .md files", async () => {
    await fs.mkdir(path.join(rootDir, "docs", "subdir"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "src", "core"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "src", "core", "orchestrator.ts"),
      "export {};\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(rootDir, "docs", "subdir", "nested.md"),
      "# Nested\n\nSee `src/core/orchestrator.ts`.\n",
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.ok(
      report.scannedDocs.some(d => d.includes("nested.md")),
      "nested doc file must appear in scannedDocs"
    );
    assert.equal(report.presentCount, 1, "nested doc reference must be checked and found present");
    assert.equal(report.staleCount, 0);
  });

  it("detects stale references in deeply nested docs subdirectory", async () => {
    await fs.mkdir(path.join(rootDir, "docs", "a", "b"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "docs", "a", "b", "deep.md"),
      "Ref: `src/core/ghost.ts`\n",
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.equal(report.staleCount, 1, "stale reference in deeply nested doc must be detected");
    assert.equal(report.staleReferences[0].referencedPath, "src/core/ghost.ts");
  });
});

describe("architecture_drift — TS/JS alias normalization (Task 1)", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-arch-drift-alias-"));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("normalizeAliasPath resolves @core/ to src/core/", () => {
    assert.equal(normalizeAliasPath("@core/orchestrator.ts"), "src/core/orchestrator.ts");
  });

  it("normalizeAliasPath resolves @/ to src/", () => {
    assert.equal(normalizeAliasPath("@/config.ts"), "src/config.ts");
  });

  it("normalizeAliasPath resolves @tests/ to tests/", () => {
    assert.equal(normalizeAliasPath("@tests/core/foo.test.ts"), "tests/core/foo.test.ts");
  });

  it("normalizeAliasPath returns null for non-alias paths", () => {
    assert.equal(normalizeAliasPath("src/core/foo.ts"), null);
    assert.equal(normalizeAliasPath("random/path.ts"), null);
  });

  it("detects stale @core/ alias reference in docs and classifies it as stale after normalization", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
    // Do NOT create src/core/ghost.ts — alias ref should be stale
    await fs.mkdir(path.join(rootDir, "src", "core"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "docs", "arch.md"),
      "See `@core/ghost.ts` for the implementation.\n",
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    const staleAliasRef = report.staleReferences.find(r => r.referencedPath === "src/core/ghost.ts");
    assert.ok(staleAliasRef, "alias reference @core/ghost.ts must be normalized to src/core/ghost.ts and classified stale");
  });

  it("resolves @core/ alias reference as present when the real file exists", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "src", "core"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "src", "core", "orchestrator.ts"),
      "export {};\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(rootDir, "docs", "arch.md"),
      "Entry: `@core/orchestrator.ts`\n",
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.equal(report.presentCount, 1, "normalized alias ref must count as present when file exists");
    assert.equal(report.staleCount, 0);
  });
});

describe("architecture_drift — deprecated token detection (Task 5)", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-arch-drift-dep-"));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("DEPRECATED_TOKENS is non-empty and each entry has pattern + hint", () => {
    assert.ok(Array.isArray(DEPRECATED_TOKENS) && DEPRECATED_TOKENS.length > 0,
      "DEPRECATED_TOKENS must be a non-empty array");
    for (const entry of DEPRECATED_TOKENS) {
      assert.ok(entry.pattern instanceof RegExp, "each deprecated token entry must have a RegExp pattern");
      assert.ok(typeof entry.hint === "string" && entry.hint.length > 0,
        "each deprecated token entry must have a non-empty hint string");
    }
  });

  it("detectDeprecatedTokensInContent finds governance_verdict in doc content", () => {
    const content = "The old API used governance_verdict to signal completion.";
    const refs = detectDeprecatedTokensInContent("docs/old.md", content);
    const found = refs.find(r => r.token === "governance_verdict");
    assert.ok(found, "governance_verdict must be detected as deprecated");
    assert.equal(found!.docPath, "docs/old.md");
    assert.ok(found!.hint.length > 0, "hint must be non-empty");
  });

  it("detectDeprecatedTokensInContent finds resume_dispatch as deprecated", () => {
    const content = "Calling resume_dispatch will trigger worker resumption.";
    const refs = detectDeprecatedTokensInContent("docs/resume.md", content);
    const found = refs.find(r => r.token === "resume_dispatch");
    assert.ok(found, "resume_dispatch must be detected as deprecated");
  });

  it("detectDeprecatedTokensInContent returns empty array for clean content", () => {
    const content = "Use runResumeDispatch and GOVERNANCE_GATE_EVALUATED instead.";
    const refs = detectDeprecatedTokensInContent("docs/clean.md", content);
    assert.equal(refs.length, 0, "no deprecated tokens should be found in clean content");
  });

  it("checkArchitectureDrift includes deprecatedTokenCount and deprecatedTokenRefs in report", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "docs", "legacy.md"),
      "Legacy docs reference governance_verdict and resume_dispatch.\n",
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.ok(typeof report.deprecatedTokenCount === "number",
      "report must include deprecatedTokenCount");
    assert.ok(Array.isArray(report.deprecatedTokenRefs),
      "report must include deprecatedTokenRefs array");
    assert.ok(report.deprecatedTokenCount >= 2,
      "must detect at least 2 deprecated tokens in legacy doc");
  });

  it("negative path: clean docs with no deprecated tokens produce zero deprecatedTokenCount", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "docs", "clean.md"),
      "Use evaluatePreDispatchGovernanceGate and GOVERNANCE_GATE_EVALUATED.\n",
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    assert.equal(report.deprecatedTokenCount, 0,
      "clean docs must produce zero deprecated token count");
    assert.deepEqual(report.deprecatedTokenRefs, [],
      "clean docs must produce empty deprecated token refs");
  });

  it("deprecated token refs include line number and docPath", async () => {
    await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });

    await fs.writeFile(
      path.join(rootDir, "docs", "stale.md"),
      [
        "# Old API",
        "",
        "Step 1: call governance_verdict",
        "Step 2: use resumeDispatch"
      ].join("\n"),
      "utf8"
    );

    const report = await checkArchitectureDrift({ rootDir });
    const verdictRef = report.deprecatedTokenRefs.find(r => r.token === "governance_verdict");
    assert.ok(verdictRef, "governance_verdict ref must be in report");
    assert.equal(verdictRef!.line, 3, "line number must be 3 for governance_verdict");
    assert.ok(verdictRef!.docPath.includes("stale.md"), "docPath must reference stale.md");
  });
});

// ── rankStaleRefsAsRemediationCandidates (Task 1 planning bridge) ─────────────

describe("rankStaleRefsAsRemediationCandidates", () => {
  it("returns empty array for empty report", () => {
    const report: ArchitectureDriftReport = {
      scannedDocs: [],
      presentCount: 0,
      staleCount: 0,
      staleReferences: [],
      deprecatedTokenCount: 0,
      deprecatedTokenRefs: [],
    };
    const candidates = rankStaleRefsAsRemediationCandidates(report);
    assert.deepEqual(candidates, []);
  });

  it("assigns high priority to stale src/core/ references", () => {
    const report: ArchitectureDriftReport = {
      scannedDocs: ["docs/arch.md"],
      presentCount: 0,
      staleCount: 1,
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/core/orchestrator.ts", line: 3 }],
      deprecatedTokenCount: 0,
      deprecatedTokenRefs: [],
    };
    const candidates = rankStaleRefsAsRemediationCandidates(report);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].priority, "high");
    assert.equal(candidates[0].type, "stale_ref");
    assert.ok(candidates[0].referencedPath === "src/core/orchestrator.ts");
  });

  it("assigns medium priority to stale src/ (non-core) references", () => {
    const report: ArchitectureDriftReport = {
      scannedDocs: ["docs/arch.md"],
      presentCount: 0,
      staleCount: 1,
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/config.ts", line: 5 }],
      deprecatedTokenCount: 0,
      deprecatedTokenRefs: [],
    };
    const candidates = rankStaleRefsAsRemediationCandidates(report);
    assert.equal(candidates[0].priority, "medium");
  });

  it("assigns low priority to stale docker/scripts/docs references", () => {
    const report: ArchitectureDriftReport = {
      scannedDocs: ["docs/ops.md"],
      presentCount: 0,
      staleCount: 1,
      staleReferences: [{ docPath: "docs/ops.md", referencedPath: "docker/worker.Dockerfile", line: 2 }],
      deprecatedTokenCount: 0,
      deprecatedTokenRefs: [],
    };
    const candidates = rankStaleRefsAsRemediationCandidates(report);
    assert.equal(candidates[0].priority, "low");
  });

  it("assigns medium priority to all deprecated token findings", () => {
    const report: ArchitectureDriftReport = {
      scannedDocs: ["docs/legacy.md"],
      presentCount: 0,
      staleCount: 0,
      staleReferences: [],
      deprecatedTokenCount: 1,
      deprecatedTokenRefs: [{ docPath: "docs/legacy.md", token: "governance_verdict", hint: "use governance_contract", line: 7 }],
    };
    const candidates = rankStaleRefsAsRemediationCandidates(report);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].priority, "medium");
    assert.equal(candidates[0].type, "deprecated_token");
    assert.ok(candidates[0].token === "governance_verdict");
    assert.ok(candidates[0].hint === "use governance_contract");
  });

  it("sorts high before medium before low", () => {
    const report: ArchitectureDriftReport = {
      scannedDocs: ["docs/a.md"],
      presentCount: 0,
      staleCount: 3,
      staleReferences: [
        { docPath: "docs/a.md", referencedPath: "docker/worker.Dockerfile", line: 1 },   // low
        { docPath: "docs/a.md", referencedPath: "src/core/policy_engine.ts", line: 2 },  // high
        { docPath: "docs/a.md", referencedPath: "src/config.ts", line: 3 },              // medium
      ],
      deprecatedTokenCount: 0,
      deprecatedTokenRefs: [],
    };
    const candidates = rankStaleRefsAsRemediationCandidates(report);
    assert.equal(candidates[0].priority, "high");
    assert.equal(candidates[1].priority, "medium");
    assert.equal(candidates[2].priority, "low");
  });

  it("each candidate has suggestedTask, reason, docPath, and line", () => {
    const report: ArchitectureDriftReport = {
      scannedDocs: ["docs/arch.md"],
      presentCount: 0,
      staleCount: 1,
      staleReferences: [{ docPath: "docs/arch.md", referencedPath: "src/core/missing.ts", line: 12 }],
      deprecatedTokenCount: 0,
      deprecatedTokenRefs: [],
    };
    const [c] = rankStaleRefsAsRemediationCandidates(report);
    assert.ok(typeof c.suggestedTask === "string" && c.suggestedTask.length > 0, "suggestedTask must be non-empty");
    assert.ok(typeof c.reason === "string" && c.reason.length > 0, "reason must be non-empty");
    assert.equal(c.docPath, "docs/arch.md");
    assert.equal(c.line, 12);
  });

  it("negative path: interleaves stale refs and deprecated tokens by priority (medium mixed)", () => {
    const report: ArchitectureDriftReport = {
      scannedDocs: ["docs/a.md"],
      presentCount: 0,
      staleCount: 1,
      staleReferences: [
        // low priority
        { docPath: "docs/a.md", referencedPath: "scripts/deploy.sh", line: 1 },
      ],
      deprecatedTokenCount: 1,
      deprecatedTokenRefs: [
        // medium priority — should come before the low ref
        { docPath: "docs/a.md", token: "resume_dispatch", hint: "use runResumeDispatch", line: 4 },
      ],
    };
    const candidates = rankStaleRefsAsRemediationCandidates(report);
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].priority, "medium", "deprecated token (medium) must sort before stale scripts ref (low)");
    assert.equal(candidates[0].type, "deprecated_token");
    assert.equal(candidates[1].priority, "low");
    assert.equal(candidates[1].type, "stale_ref");
  });
});
