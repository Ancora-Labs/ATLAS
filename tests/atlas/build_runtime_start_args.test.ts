import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { buildAtlasDaemonStartArgs, resolveRootBoxCliLaunchSpec } from "../../src/atlas/build_runtime.js";

describe("atlas build runtime start args", () => {
  it("includes the target session selector when ATLAS has a bound project session", () => {
    const args = buildAtlasDaemonStartArgs(["--import", "tsx", "src/cli.ts"], {
      sessionId: "sess_20260502090751_7f3760",
      projectId: "target_emberline_club",
    });

    assert.deepEqual(args, [
      "--import",
      "tsx",
      "src/cli.ts",
      "start",
      "--session",
      "sess_20260502090751_7f3760",
      "--project",
      "target_emberline_club",
    ]);
  });

  it("omits selector flags when ATLAS does not yet have a bound target session", () => {
    const args = buildAtlasDaemonStartArgs(["--import", "tsx", "src/cli.ts"], {
      sessionId: null,
      projectId: "target_emberline_club",
    });

    assert.deepEqual(args, ["--import", "tsx", "src/cli.ts", "start"]);
  });

  it("launches the bundled TypeScript CLI from app.asar in extracted portable releases", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-packaged-cli-"));
    const releaseRoot = path.join(tempRoot, "ATLAS-v0.1.2-win-x64");
    const stateDir = path.join(releaseRoot, "state");
    const packagedAppRoot = path.join(releaseRoot, "resources", "app.asar");

    try {
      await fs.mkdir(path.dirname(packagedAppRoot), { recursive: true });
      await fs.writeFile(packagedAppRoot, "asar-placeholder", "utf8");
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(path.join(stateDir, "worker_cycle_artifacts.json"), "{}", "utf8");

      const launchSpec = await resolveRootBoxCliLaunchSpec(stateDir);
      const bundledTsxLoader = path.join(packagedAppRoot, "node_modules", "tsx", "dist", "loader.mjs");
      const bundledCli = path.join(packagedAppRoot, "src", "cli.ts");

      assert.equal(launchSpec.cwd, releaseRoot);
      assert.deepEqual(launchSpec.args, [
        "--import",
        pathToFileURL(bundledTsxLoader).href,
        bundledCli,
      ]);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
