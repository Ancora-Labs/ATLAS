import { spawn } from "node:child_process";

import { resolveAtlasDesktopBuildOutputDir, resolveRepoRoot } from "./atlas_desktop_paths.js";

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: resolveRepoRoot(),
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function main(): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const buildOutputDir = resolveAtlasDesktopBuildOutputDir(repoRoot);
  const env = {
    ...process.env,
    ATLAS_DESKTOP_BUILD_DIR: buildOutputDir,
  };

  console.log(`[atlas] building desktop package via temp output: ${buildOutputDir}`);
  await runCommand("node", ["--import", "tsx", "scripts/prepare_atlas_icon_assets.ts"], env);
  await runCommand("npx", ["electron-builder", "--dir", `-c.directories.output=${buildOutputDir}`], env);
  await runCommand("node", ["--import", "tsx", "scripts/patch_atlas_exe_icons.ts"], env);
}

main().catch((error) => {
  console.error(`[atlas] desktop build failed: ${String((error as Error)?.message || error)}`);
  process.exitCode = 1;
});