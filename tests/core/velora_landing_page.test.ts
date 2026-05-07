import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const indexPath = path.join(rootDir, "index.html");
const stylesPath = path.join(rootDir, "styles.css");
const scriptPath = path.join(rootDir, "script.js");

describe("velora landing page", () => {
  it("does not ship the retired root landing page files anymore", async () => {
    const fileChecks = await Promise.allSettled([
      fs.access(indexPath),
      fs.access(stylesPath),
      fs.access(scriptPath),
    ]);

    for (const result of fileChecks) {
      assert.equal(result.status, "rejected");
    }
  });

  it("keeps the desktop shell as the primary shipped surface instead of the retired static site", async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    assert.equal(
      packageJson.scripts?.["atlas:desktop:package"],
      "npm run atlas:desktop:build && node --import tsx scripts/package_atlas_desktop_folder.ts",
    );
  });
});
