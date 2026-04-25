import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { ATLAS_WINDOWS_APP_ID } from "../../electron/single_instance.ts";
import {
  createAtlasDesktopPackageLayout,
  publishAtlasDesktopPortableRelease,
  resetAtlasDesktopReleaseSurface,
} from "../../scripts/atlas_desktop_package.ts";
import { listAtlasSessions, readAtlasSessionReadModel } from "../../src/atlas/state_bridge.ts";

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atlas-regression-fence-"));
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function writeCanonicalState(
  stateDir: string,
  workerSessions: Record<string, unknown>,
): Promise<void> {
  await writeJson(path.join(stateDir, "pipeline_progress.json"), {
    stage: "workers_running",
    stageLabel: "Workers Running",
    percent: 88,
    detail: "ATLAS is serving the dedicated repo surface.",
    steps: [],
    updatedAt: "2026-04-22T11:30:00.000Z",
    startedAt: "cycle-1",
  });
  await writeJson(path.join(stateDir, "worker_cycle_artifacts.json"), {
    schemaVersion: 1,
    updatedAt: "2026-04-22T11:30:00.000Z",
    latestCycleId: "cycle-1",
    cycles: {
      "cycle-1": {
        cycleId: "cycle-1",
        updatedAt: "2026-04-22T11:30:00.000Z",
        status: "in_progress",
        workerSessions,
        workerActivity: {},
        completedTaskIds: [],
      },
    },
  });
}

describe("atlas regression fence", () => {
  it("keeps the dedicated runtime launcher contract pinned in package.json", async () => {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
      build?: {
        appId?: string;
        productName?: string;
        files?: string[];
        extraFiles?: string[];
        win?: {
          target?: string[];
          executableName?: string;
          signAndEditExecutable?: boolean;
        };
      };
    };
    const launcherPath = path.join(process.cwd(), "ATLAS.cmd");
    const launcher = await fs.readFile(launcherPath, "utf8");
    const desktopMain = await fs.readFile(path.join(process.cwd(), "electron", "main.ts"), "utf8");
    const preloadSource = await fs.readFile(path.join(process.cwd(), "electron", "preload.ts"), "utf8");
    const onboardingHtml = await fs.readFile(path.join(process.cwd(), "electron", "renderer", "index.html"), "utf8");
    const rendererSource = await fs.readFile(path.join(process.cwd(), "src", "atlas", "renderer.ts"), "utf8");
    const layout = createAtlasDesktopPackageLayout(path.join("C:", "ATLAS Release Root"));

    assert.equal(packageJson.scripts?.["atlas:start"], "node --import tsx src/atlas/server.ts");
    assert.equal(packageJson.scripts?.["atlas:ctl"], "node --import tsx src/atlas/lifecycle.ts");
    assert.match(String(packageJson.scripts?.["atlas:open"] || ""), /atlas:desktop/);
    assert.match(String(packageJson.scripts?.["atlas:desktop"] || ""), /electron/i);
    assert.match(String(packageJson.scripts?.["atlas:desktop:build"] || ""), /tsconfig\.electron\.json/);
    assert.match(String(packageJson.scripts?.["atlas:desktop:package"] || ""), /scripts\/atlas_desktop_package\.ts/i);
    assert.doesNotMatch(String(packageJson.scripts?.["atlas:start"] || ""), /dashboard/i);
    assert.equal(packageJson.build?.appId, ATLAS_WINDOWS_APP_ID);
    assert.equal(packageJson.build?.productName, "ATLAS");
    assert.ok(packageJson.build?.files?.includes(".electron-build/**/*"));
    assert.ok(packageJson.build?.files?.includes("electron/renderer/**/*"));
    assert.ok(packageJson.build?.extraFiles?.includes("box.config.json"));
    assert.ok(packageJson.build?.win?.target?.includes("dir"));
    assert.equal(packageJson.build?.win?.executableName, "ATLAS");
    assert.equal(packageJson.build?.win?.signAndEditExecutable, false);
    assert.equal(layout.portableRoot, path.join("C:", "ATLAS Release Root", "dist", "ATLAS"));
    assert.equal(layout.portableExePath, path.join("C:", "ATLAS Release Root", "dist", "ATLAS", "ATLAS.exe"));
    assert.equal(layout.stagedAppRoot, path.join("C:", "ATLAS Release Root", "dist", ".atlas-builder", "win-unpacked"));
    assert.equal(layout.legacyUnpackedRoot, path.join("C:", "ATLAS Release Root", "dist", "win-unpacked"));
    assert.match(launcher, /npm run atlas:ctl -- %ATLAS_ACTION%/);
    assert.match(launcher, /Launching the native ATLAS desktop shell/i);
    assert.match(launcher, /Packaging the portable Windows desktop folder/i);
    assert.doesNotMatch(launcher, /Start-Process|Invoke-WebRequest/);
    assert.match(onboardingHtml, /Native Windows title bar/);
    assert.match(onboardingHtml, /Workspace handoff/);
    assert.doesNotMatch(onboardingHtml, /dashboard-card|window-controls|traffic-light/i);
    assert.match(rendererSource, /aria-label="ATLAS desktop surface"/);
    assert.match(rendererSource, /aria-label="ATLAS desktop sidebar"/);
    assert.match(rendererSource, /aria-label="ATLAS work canvas"/);
    assert.match(rendererSource, /aria-label="Desktop composer"/);
    assert.match(rendererSource, /data-role="new-session-view"/);
    assert.match(rendererSource, /data-role="selected-session-view"/);
    assert.match(rendererSource, /Latest worker output/);
    assert.match(rendererSource, /bridge\?\.refreshSnapshot/);
    assert.match(rendererSource, /ATLAS snapshot refresh requires the Electron desktop bridge\./);
    assert.doesNotMatch(rendererSource, /dashboard-card|hero-panel|metric-card|window-controls|traffic-light/i);
    assert.match(preloadSource, /refreshSnapshot\(request: AtlasSnapshotRequestPayload = \{\}\)/);
    assert.match(preloadSource, /atlas-desktop:refresh-snapshot/);
    assert.match(preloadSource, /getSnapshot\(request: AtlasSnapshotRequestPayload = \{\}\)/);
    assert.match(preloadSource, /atlas-desktop:get-snapshot/);
    assert.match(desktopMain, /requestSingleInstanceLock\(\)/);
    assert.match(desktopMain, /app\.on\("second-instance"/);
    assert.match(desktopMain, /restoreAndFocusAtlasWindow\(mainWindow\)/);
    assert.match(desktopMain, /setAppUserModelId\(ATLAS_WINDOWS_APP_ID\)/);
    assert.match(desktopMain, /isPackaged:\s*app\.isPackaged/);
    assert.match(desktopMain, /exePath:\s*app\.getPath\("exe"\)/);
    assert.match(desktopMain, /atlasDesktopResources\.rendererHtmlPath/);
    assert.match(desktopMain, /buildAtlasDesktopLocationPath\(getPersistedProductLocation\(\)\)/);
    assert.match(desktopMain, /window\.loadURL\(new URL\(buildAtlasDesktopLocationPath\(getPersistedProductLocation\(\)\), atlasBootstrap\.serverUrl\)\.toString\(\)\)/);
    assert.match(desktopMain, /ipcMain\.handle\("atlas-desktop:get-snapshot"/);
    assert.match(desktopMain, /ipcMain\.handle\("atlas-desktop:refresh-snapshot"/);
    assert.match(desktopMain, /ATLAS_SNAPSHOT_TOKEN_HEADER/);
    assert.match(desktopMain, /ATLAS_SNAPSHOT_PATH/);
    assert.match(desktopMain, /rejected an untrusted window/);
  });

  it("[NEGATIVE] rejects empty portable folder names so the release folder cannot lose the root ATLAS.exe contract", () => {
    assert.throws(
      () => createAtlasDesktopPackageLayout(path.join("C:", "ATLAS Release Root"), "   "),
      /non-empty string/i,
    );
  });

  it("keeps dist\\ATLAS as the only Windows handoff surface after packaging", async () => {
    const tempRoot = await createTempRoot();
    const layout = createAtlasDesktopPackageLayout(tempRoot);

    try {
      await fs.mkdir(layout.portableRoot, { recursive: true });
      await fs.writeFile(layout.portableExePath, "stale-portable", "utf8");
      await fs.mkdir(layout.stagingRoot, { recursive: true });
      await fs.writeFile(path.join(layout.stagingRoot, "stale.txt"), "staging", "utf8");
      await fs.mkdir(layout.legacyUnpackedRoot, { recursive: true });
      await fs.writeFile(path.join(layout.legacyUnpackedRoot, "ATLAS.exe"), "legacy", "utf8");

      await resetAtlasDesktopReleaseSurface(layout);
      await fs.mkdir(layout.stagedAppRoot, { recursive: true });
      await fs.writeFile(path.join(layout.stagedAppRoot, "ATLAS.exe"), "fresh-portable", "utf8");
      await publishAtlasDesktopPortableRelease(layout);

      const portableStats = await fs.stat(layout.portableExePath);

      assert.ok(portableStats.isFile());
      await assert.rejects(fs.stat(layout.stagingRoot), /ENOENT/);
      await assert.rejects(fs.stat(layout.legacyUnpackedRoot), /ENOENT/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] rejects publishing when electron-builder does not leave a staged ATLAS.exe surface to promote", async () => {
    const tempRoot = await createTempRoot();
    const layout = createAtlasDesktopPackageLayout(tempRoot);

    try {
      await assert.rejects(
        publishAtlasDesktopPortableRelease(layout),
        /did not produce the expected folder/i,
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("falls back to open_target_sessions.json, maps legacy BOX stages, and aggregates archived sessions", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      await writeJson(path.join(stateDir, "open_target_sessions.json"), {
        sessions: {
          "integration-worker": {
            role: "integration-worker",
            status: "completed",
            lastTask: "Closed the ATLAS launcher polish",
            lastActiveAt: "2026-04-22T11:00:00.000Z",
            createdPRs: ["https://example.com/pr/atlas-runtime"],
          },
          "quality-worker": {
            role: "quality-worker",
            status: "needs-input",
            lastTask: "Waiting for archive review notes",
            lastActiveAt: "2026-04-22T10:55:00.000Z",
            workerIdentityLabel: "Quality archive worker",
            currentStage: "archive_review",
            currentStageLabel: "Reviewing archive notes",
            latestMeaningfulAction: "Queued the archive follow-up",
            latestMeaningfulActionAt: "2026-04-22T10:56:00.000Z",
            pullRequests: ["https://example.com/pr/archive"],
            filesTouched: ["src/atlas/state_bridge.ts"],
            touchedFiles: ["src/atlas/state_bridge.ts", "tests/atlas/atlas_regression_fence.test.ts"],
            logExcerpt: ["[leadership_live]", "archive follow-up queued"],
            logSource: "open_target_sessions.json",
            logUpdatedAt: "2026-04-22T10:56:30.000Z",
            freshnessAt: "2026-04-22T10:56:30.000Z",
          },
        },
      });
      await writeJson(path.join(stateDir, "archive", "2026-04-21", "quality.json"), {
        role: "quality-worker",
        status: "partial",
        lastTask: "Resume archive verification",
        lastActiveAt: "2026-04-21T19:00:00.000Z",
      });
      await fs.mkdir(path.join(stateDir, "archive"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "archive", "broken.json"), "{not-json", "utf8");

      const readModel = await readAtlasSessionReadModel({ stateDir });
      const openSessions = await listAtlasSessions({ stateDir });

      assert.equal(openSessions["integration-worker"]?.status, "done");
      assert.equal(openSessions["integration-worker"]?.statusLabel, "Completed");
      assert.equal(openSessions["quality-worker"]?.status, "blocked");
      assert.equal(openSessions["quality-worker"]?.workerIdentityLabel, "Quality archive worker");
      assert.equal(openSessions["quality-worker"]?.currentStageLabel, "Reviewing archive notes");
      assert.equal(openSessions["quality-worker"]?.latestMeaningfulAction, "Queued the archive follow-up");
      assert.equal(openSessions["quality-worker"]?.readinessLabel, "Needs your input");
      assert.equal(openSessions["quality-worker"]?.touchedFileCount, 2);
      assert.deepEqual(openSessions["quality-worker"]?.pullRequests, ["https://example.com/pr/archive"]);
      assert.deepEqual(openSessions["quality-worker"]?.logExcerpt, ["archive follow-up queued"]);
      assert.equal(openSessions["quality-worker"]?.freshnessAt, "2026-04-22T10:56:30.000Z");

      assert.equal(Object.keys(readModel.openSessions).length, 2);
      assert.equal(readModel.archivedSessions.length, 1);
      assert.equal(readModel.archivedSessions[0]?.status, "partial");
      assert.equal(readModel.archivedSessions[0]?.readinessLabel, "Ready to continue");
      assert.match(readModel.archivedSessions[0]?.archivePath || "", /archive/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("[NEGATIVE] keeps canonical live state authoritative when fallback files disagree", async () => {
    const tempRoot = await createTempRoot();
    const stateDir = path.join(tempRoot, "state");

    try {
      await writeCanonicalState(stateDir, {
        "integration-worker": {
          role: "integration-worker",
          status: "working",
          lastTask: "Serve the dedicated ATLAS runtime",
          lastActiveAt: "2026-04-22T11:30:00.000Z",
        },
      });
      await writeJson(path.join(stateDir, "open_target_sessions.json"), {
        "integration-worker": {
          role: "integration-worker",
          status: "completed",
          lastTask: "Stale fallback data",
          lastActiveAt: "2026-04-22T09:00:00.000Z",
        },
      });

      const readModel = await readAtlasSessionReadModel({ stateDir });

      assert.equal(readModel.openSessions["integration-worker"]?.status, "working");
      assert.equal(readModel.openSessions["integration-worker"]?.statusLabel, "In progress");
      assert.equal(readModel.archivedSessions.length, 0);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
