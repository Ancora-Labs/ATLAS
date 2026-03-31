import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scanProject, computeScanNoveltySignal } from "../../src/core/project_scanner.js";

describe("project_scanner", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "box-scan-"));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("derives commands and repository signals from package.json", async () => {
    await fs.mkdir(path.join(rootDir, "src"), { recursive: true });
    await fs.writeFile(path.join(rootDir, "src", "app.ts"), "export const x = 1;\n", "utf8");
    await fs.writeFile(path.join(rootDir, "README.md"), "# test\n", "utf8");
    await fs.writeFile(path.join(rootDir, "package.json"), JSON.stringify({
      name: "sample-box",
      scripts: { build: "tsc", test: "node --test", lint: "eslint ." },
      dependencies: { react: "1.0.0" },
      devDependencies: { typescript: "5.0.0" }
    }), "utf8");

    const result = await scanProject({ rootDir });
    assert.equal(result.hasPackageJson, true);
    assert.equal(result.packageName, "sample-box");
    assert.equal(result.commands.build, "npm run build");
    assert.ok(result.frameworks.includes("react"));
    assert.ok(result.frameworks.includes("typescript"));
    assert.ok(result.repositorySignals.srcFileCount >= 1);
  });

  it("negative path: falls back to defaults when package.json is invalid", async () => {
    await fs.writeFile(path.join(rootDir, "package.json"), "{ invalid", "utf8");
    const result = await scanProject({ rootDir });
    assert.equal(result.hasPackageJson, false);
    assert.equal(result.commands.install, "npm ci");
    assert.equal(result.commands.build, null);
  });
});

describe("computeScanNoveltySignal", () => {
  it("returns low signal when all current domains were already known", () => {
    const result = computeScanNoveltySignal(["backend", "quality"], ["backend", "quality", "devops"]);
    assert.equal(result.noveltySignal, "low");
    assert.deepEqual(result.newDomains, []);
  });

  it("returns medium signal when one new domain is discovered", () => {
    const result = computeScanNoveltySignal(["backend", "quality", "devops"], ["backend", "quality"]);
    assert.equal(result.noveltySignal, "medium");
    assert.deepEqual(result.newDomains, ["devops"]);
  });

  it("returns high signal when more than half the current domains are new", () => {
    const result = computeScanNoveltySignal(["devops", "security", "backend"], ["backend"]);
    assert.equal(result.noveltySignal, "high");
    assert.ok(result.newDomains.includes("devops"));
    assert.ok(result.newDomains.includes("security"));
  });

  it("returns high signal when all current domains are new (first run against empty baseline)", () => {
    const result = computeScanNoveltySignal(["backend", "quality"], []);
    assert.equal(result.noveltySignal, "high");
    assert.deepEqual(result.newDomains, ["backend", "quality"]);
  });

  it("returns low signal for empty currentDomains", () => {
    const result = computeScanNoveltySignal([], ["backend"]);
    assert.equal(result.noveltySignal, "low");
    assert.deepEqual(result.newDomains, []);
  });

  it("negative path: handles null/undefined inputs gracefully", () => {
    const result = computeScanNoveltySignal(null as any, null as any);
    assert.equal(result.noveltySignal, "low");
    assert.deepEqual(result.newDomains, []);
  });
});

