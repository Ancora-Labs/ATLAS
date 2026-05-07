import fs from "node:fs/promises";
import path from "node:path";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function hasRuntimeArtifacts(stateDir: string): Promise<boolean> {
  const indicators = [
    path.join(stateDir, "projects"),
    path.join(stateDir, "open_target_sessions.json"),
    path.join(stateDir, "worker_cycle_artifacts.json"),
    path.join(stateDir, "progress.txt"),
  ];

  for (const indicator of indicators) {
    if (await pathExists(indicator)) {
      return true;
    }
  }

  return false;
}

export async function resolveAtlasRuntimeStateDir(stateDir: string): Promise<string> {
  const normalizedStateDir = path.resolve(stateDir);
  const runningFromTargetWorkspace = process.cwd().includes(`${path.sep}.box-target-workspaces${path.sep}`);

  if (!runningFromTargetWorkspace && await hasRuntimeArtifacts(normalizedStateDir)) {
    return normalizedStateDir;
  }

  let currentDir = path.resolve(process.cwd());
  for (let index = 0; index < 8; index += 1) {
    const candidate = path.join(currentDir, "Box", "state");
    if (await hasRuntimeArtifacts(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (!parentDir || parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return normalizedStateDir;
}

export function applyAtlasRuntimeStateDirToConfig<T extends { paths?: Record<string, unknown> }>(config: T, stateDir: string): T {
  const runtimeRootDir = path.dirname(stateDir);
  const configuredWorkspaceDir = String(config?.paths?.workspaceDir || ".box-work");
  const runtimeWorkspaceDir = path.join(runtimeRootDir, path.basename(configuredWorkspaceDir));

  return {
    ...config,
    rootDir: runtimeRootDir,
    paths: {
      ...(config.paths || {}),
      stateDir,
      workspaceDir: runtimeWorkspaceDir,
    },
  };
}