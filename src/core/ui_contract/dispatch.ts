import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { taskRequiresUiWorkerCapabilities } from "../../workers/ui_capabilities.js";
import { spawnAsync, writeJson } from "../fs_utils.js";
import { UiAdapterRegistry } from "./adapter.js";
import { parseUiDesignContract } from "./contract.js";
import { runUiContractLoop, type UiLoopRepairContext } from "./loop_controller.js";
import { parseUiScenarioMatrix } from "./scenarios.js";
import { SessionModuleAdapter } from "./adapters/session_module_adapter.js";
import { ElectronCaptureAdapter } from "./adapters/electron_capture_adapter.js";
import { HeadlessBrowserDomAdapter } from "./adapters/headless_browser_dom_adapter.js";
import { StaticDomAdapter } from "./adapters/static_dom_adapter.js";
import type { UiDesignContract, UiLoopLimits, UiScenarioMatrix, UiVerdict } from "./types.js";

export type UiDispatchTask = Record<string, unknown>;

export type UiDispatchArtifacts = {
  rootDir: string;
  contractPath: string;
  matrixPath: string;
  loopResultPath: string;
  runtimeRecipePath: string | null;
  runtimeLogPath: string | null;
};

export type UiDispatchRepairResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  statusCode?: number;
  parsed?: unknown;
};

export type UiDispatchRepair = (input: {
  attempt: number;
  verdict: UiVerdict;
  task: UiDispatchTask;
  contract: UiDesignContract;
  matrix: UiScenarioMatrix;
  artifacts: UiDispatchArtifacts;
}) => Promise<UiDispatchRepairResult>;

type UiRuntimeCommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type SpawnAsyncResultLike = {
  status?: number;
  stdout?: string;
  stderr?: string;
};

type UiRuntimeLaunchHandle = {
  waitForOutput: (pattern: RegExp, timeoutMs: number) => Promise<boolean>;
  stop: () => Promise<void>;
};

export type UiDispatchRuntimeHost = {
  runCommand?: (command: string, cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number) => Promise<UiRuntimeCommandResult>;
  launchCommand?: (command: string, cwd: string, env: NodeJS.ProcessEnv) => Promise<UiRuntimeLaunchHandle>;
  checkHttp?: (url: string) => Promise<{ ok: boolean; status?: number }>;
};

export type UiDispatchAdapterRegistryOptions = {
  /** Optional planner-supplied runtime recipe — used to pick session-specific adapters. */
  runtimeRecipe?: Record<string, unknown> | null;
  /** Workspace root that owns the surface (used to find session-local Electron binaries). */
  workspacePath?: string;
};

export function buildUiDispatchAdapterRegistry(
  targetSurfaces: string[] = [],
  options: UiDispatchAdapterRegistryOptions = {},
): UiAdapterRegistry {
  const registry = new UiAdapterRegistry();
  const surfaces = [...new Set(targetSurfaces.map((value) => String(value || "").trim()).filter(Boolean))];
  const runtimeRecipe = isRecord(options.runtimeRecipe) ? options.runtimeRecipe : null;
  const recipeAdapterId = normalizeNonEmptyString(runtimeRecipe?.adapterId).toLowerCase();
  const recipeAdapterModulePath = firstNonEmptyString([
    runtimeRecipe?.adapterModulePath,
    runtimeRecipe?.adapterPath,
    runtimeRecipe?.modulePath,
  ]);
  const recipePrimarySurface = normalizeNonEmptyString(runtimeRecipe?.primarySurface);
  for (const surface of surfaces) {
    if (!surface || registry.has(surface)) continue;
    if (recipeAdapterModulePath) {
      registry.register(new SessionModuleAdapter(surface, {
        adapterId: recipeAdapterId || "session-module",
        modulePath: recipeAdapterModulePath,
        exportName: firstNonEmptyString([runtimeRecipe?.adapterExport, runtimeRecipe?.exportName]),
        workspacePath: options.workspacePath,
      }));
      continue;
    }
    if (recipeAdapterId) {
      registry.register(resolvePlannerSelectedAdapter(surface, recipeAdapterId, runtimeRecipe, options.workspacePath));
      continue;
    }
    if (surface === "static-dom") {
      registry.register(new StaticDomAdapter("static-dom"));
      continue;
    }
    if (shouldUseElectronAdapter(surface, recipeAdapterId, recipePrimarySurface)) {
      registry.register(new ElectronCaptureAdapter(surface, {
        workspacePath: options.workspacePath,
        electronBinPath: normalizeNonEmptyString(runtimeRecipe?.electronBinPath) || undefined,
        preloadPath: normalizeNonEmptyString(runtimeRecipe?.electronPreloadPath) || undefined,
      }));
      continue;
    }
    registry.register(new HeadlessBrowserDomAdapter(surface));
  }
  return registry;
}

function resolvePlannerSelectedAdapter(
  surface: string,
  recipeAdapterId: string,
  runtimeRecipe: Record<string, unknown> | null,
  workspacePath?: string,
): StaticDomAdapter | ElectronCaptureAdapter | HeadlessBrowserDomAdapter {
  if (recipeAdapterId === "static-dom") {
    return new StaticDomAdapter(surface);
  }
  if (recipeAdapterId === "headless-browser-dom") {
    return new HeadlessBrowserDomAdapter(surface);
  }
  if (recipeAdapterId === "electron-capture") {
    return new ElectronCaptureAdapter(surface, {
      workspacePath,
      electronBinPath: normalizeNonEmptyString(runtimeRecipe?.electronBinPath) || undefined,
      preloadPath: normalizeNonEmptyString(runtimeRecipe?.electronPreloadPath) || undefined,
    });
  }
  throw new Error(`Unsupported planner-selected uiRuntimeRecipe.adapterId: ${recipeAdapterId}`);
}

function shouldUseElectronAdapter(
  surface: string,
  recipeAdapterId: string,
  recipePrimarySurface: string,
): boolean {
  if (recipeAdapterId === "electron-capture") return true;
  const haystack = `${surface} ${recipePrimarySurface}`.toLowerCase();
  if (/\belectron\b/.test(haystack)) return true;
  if (/browserwindow/.test(haystack)) return true;
  return false;
}

export function normalizeUiDispatchPlan(plan: unknown): UiDispatchTask {
  if (!plan || typeof plan !== "object") return (plan || {}) as UiDispatchTask;
  const rawPlan = plan as Record<string, unknown>;
  if (!taskRequiresUiWorkerCapabilities(rawPlan)) {
    return { ...rawPlan };
  }

  const contract = isRecord(rawPlan.uiContract) ? { ...rawPlan.uiContract } : null;
  const runtimeRecipe = normalizeRuntimeRecipe(rawPlan.uiRuntimeRecipe);
  const declaredSurfaces = normalizeStringArray(rawPlan.targetSurfaces);
  const contractSurfaces = normalizeStringArray(contract?.targetSurfaces);
  const recipeSurfaces = runtimeRecipe
    ? [runtimeRecipe.primarySurface, ...runtimeRecipe.candidateSurfaces].filter(Boolean)
    : [];
  const inferredSurfaceCandidate = firstNonEmptyString([
    rawPlan.uiSurface,
    runtimeRecipe?.primarySurface,
    declaredSurfaces[0],
    contractSurfaces[0],
    recipeSurfaces[0],
  ]);
  // Always materialize at least one surface so a synthesized contract can be
  // produced even if the planner omitted every surface field. Workers must
  // never fail at the dispatch gate: the AI decides which adapter to use, and
  // missing context is filled deterministically here so the loop can run.
  const inferredSurface = inferredSurfaceCandidate || "ui";
  const targetSurfaces = [...new Set([
    ...declaredSurfaces,
    ...contractSurfaces,
    ...recipeSurfaces,
    ...normalizeStringArray(inferredSurface ? [inferredSurface] : []),
  ])];
  const effectiveTargetSurfaces = targetSurfaces.length > 0 ? targetSurfaces : [inferredSurface];

  const normalizedContract = contract
    ? {
        ...contract,
        ...(effectiveTargetSurfaces.length > 0 ? { targetSurfaces: effectiveTargetSurfaces } : {}),
      }
    : synthesizeDefaultUiContract(rawPlan, effectiveTargetSurfaces);

  const normalizedScenarioMatrix = normalizeScenarioMatrix(rawPlan, effectiveTargetSurfaces, inferredSurface, normalizedContract)
    || synthesizeDefaultUiScenarioMatrix(rawPlan, effectiveTargetSurfaces, inferredSurface, normalizedContract);

  return {
    ...rawPlan,
    ...(normalizedContract ? { uiContract: normalizedContract } : {}),
    ...(normalizedScenarioMatrix ? { uiScenarioMatrix: normalizedScenarioMatrix } : {}),
    ...(effectiveTargetSurfaces.length > 0 ? { targetSurfaces: effectiveTargetSurfaces } : {}),
    ...(inferredSurface ? { uiSurface: inferredSurface } : {}),
    ...(runtimeRecipe ? { uiRuntimeRecipe: runtimeRecipe } : {}),
    capabilityTag: normalizeNonEmptyString(rawPlan.capabilityTag) || "ui-contract",
    _capabilityTag: normalizeNonEmptyString(rawPlan._capabilityTag)
      || normalizeNonEmptyString(rawPlan.capabilityTag)
      || "ui-contract",
    taskKind: normalizeNonEmptyString(rawPlan.taskKind) || "ui-contract",
    kind: normalizeNonEmptyString(rawPlan.kind) || "ui-contract",
  };
}

/**
 * Build a deterministic minimal `uiContract` when the planner produced a
 * UI-capable task without one. The shape is intentionally generic so any
 * adapter can attach evidence to it; AI-driven repair passes are expected to
 * enrich `fields` in subsequent iterations.
 */
function synthesizeDefaultUiContract(
  plan: Record<string, unknown>,
  targetSurfaces: string[],
): Record<string, unknown> {
  const contractIdSeed = firstNonEmptyString([
    plan.uiContractId,
    plan.contractId,
    plan.taskId,
    plan.title,
    plan.task,
  ]) || "ui-contract";
  const contractId = sanitizeFileSegment(contractIdSeed).slice(0, 96) || "ui-contract";
  const intent = firstNonEmptyString([plan.task, plan.title, plan.summary, plan.verification])
    || "ui-contract task";
  return {
    contractId,
    schemaVersion: 1,
    targetSurfaces,
    fields: { intent },
    requiredFields: ["intent"],
    forbiddenPatterns: [],
    accessibilityFloor: "",
  };
}

/**
 * Build a deterministic minimal `uiScenarioMatrix` when none was supplied.
 * Always produces one "default" scenario bound to the inferred primary
 * surface so the loop has something to dispatch against.
 */
function synthesizeDefaultUiScenarioMatrix(
  plan: Record<string, unknown>,
  targetSurfaces: string[],
  inferredSurface: string,
  contract: Record<string, unknown> | null,
): Record<string, unknown> {
  const surface = inferredSurface || targetSurfaces[0] || "ui";
  const contractId = normalizeNonEmptyString(contract?.contractId) || "ui-contract";
  const description = firstNonEmptyString([plan.task, plan.title, plan.summary])
    || "Default UI contract scenario";
  return {
    matrixId: `${contractId}:default-matrix`,
    schemaVersion: 1,
    scenarios: [
      {
        scenarioId: `${contractId}:default`,
        kind: normalizeNonEmptyString(plan.uiScenarioKind) || "default",
        description,
        surface,
        state: buildTaskLevelScenarioState(plan) || {},
      },
    ],
  };
}

export async function runUiContractDispatchLoop(input: {
  task: unknown;
  stateDir?: string;
  workspacePath?: string;
  limits?: Partial<UiLoopLimits>;
  registry?: UiAdapterRegistry;
  runtimeHost?: UiDispatchRuntimeHost;
  now?: () => Date;
  repair?: UiDispatchRepair;
}): Promise<{
  task: UiDispatchTask;
  contract: UiDesignContract;
  matrix: UiScenarioMatrix;
  loopResult: Awaited<ReturnType<typeof runUiContractLoop>>;
  artifacts: UiDispatchArtifacts;
  repairAttempts: UiDispatchRepairResult[];
}> {
  // Workers must never fail at the dispatch gate due to a missing payload.
  // `normalizeUiDispatchPlan` synthesizes minimal valid `uiContract` and
  // `uiScenarioMatrix` objects when the planner omitted them, so the AI
  // adapter selection + repair loop can still run end-to-end.
  let task = normalizeUiDispatchPlan(input.task);
  if (!isRecord(task.uiContract) || !isRecord(task.uiScenarioMatrix)) {
    // Force normalization even for non-UI-tagged inputs that reached this
    // entry point (defensive — the worker_runner only calls us when the
    // capability tag is `ui-contract`).
    const forced = isRecord(input.task)
      ? { ...(input.task as Record<string, unknown>), capabilityTag: "ui-contract" }
      : { capabilityTag: "ui-contract" };
    task = normalizeUiDispatchPlan(forced);
  }

  const resolvedTask = resolvePlannerSelectedUiTask(task);

  const contract = parseUiDesignContract(resolvedTask.uiContract);
  const matrix = parseUiScenarioMatrix(resolvedTask.uiScenarioMatrix, contract.targetSurfaces);
  const artifacts = await createArtifacts(input.stateDir, resolvedTask, contract, matrix);
  await writeJson(artifacts.contractPath, contract);
  await writeJson(artifacts.matrixPath, matrix);
  if (artifacts.runtimeRecipePath && isRecord(resolvedTask.uiRuntimeRecipe)) {
    await writeJson(artifacts.runtimeRecipePath, resolvedTask.uiRuntimeRecipe);
  }

  const runtimeExecution = await prepareUiRuntimeExecution({
    task: resolvedTask,
    matrix,
    workspacePath: input.workspacePath,
    artifacts,
    runtimeHost: input.runtimeHost,
  });
  const preparedTask = runtimeExecution.task;
  const preparedMatrix = runtimeExecution.matrix;

  for (const scenario of preparedMatrix.scenarios) {
    const scenarioArtifactDir = path.join(artifacts.rootDir, sanitizeFileSegment(scenario.scenarioId));
    await fs.mkdir(scenarioArtifactDir, { recursive: true });
    scenario.state = {
      ...scenario.state,
      artifactDir: typeof scenario.state?.artifactDir === "string" && String(scenario.state.artifactDir).trim()
        ? scenario.state.artifactDir
        : scenarioArtifactDir,
    };
  }

  const registry = input.registry || buildUiDispatchAdapterRegistry(contract.targetSurfaces, {
    runtimeRecipe: isRecord(preparedTask.uiRuntimeRecipe) ? preparedTask.uiRuntimeRecipe : null,
    workspacePath: input.workspacePath,
  });
  const repairAttempts: UiDispatchRepairResult[] = [];
  const maxAttempts = Number.isFinite(Number(input.limits?.maxAttempts)) && Number(input.limits?.maxAttempts) >= 1
    ? Number(input.limits?.maxAttempts)
    : 3;
  let loopResult: Awaited<ReturnType<typeof runUiContractLoop>>;
  try {
    loopResult = await runUiContractLoop({
      contract,
      matrix: preparedMatrix,
      registry,
      limits: {
        maxAttempts,
      },
      now: input.now,
      repair: input.repair
        ? async ({ attempt, verdict }: UiLoopRepairContext) => {
            const repairResult = await input.repair?.({
              attempt,
              verdict,
              task: preparedTask,
              contract,
              matrix: preparedMatrix,
              artifacts,
            });
            const normalized = repairResult || { ok: false };
            repairAttempts.push(normalized);
            return normalized.ok === true;
          }
        : undefined,
    });

    await writeJson(artifacts.loopResultPath, {
      contractId: contract.contractId,
      matrixId: preparedMatrix.matrixId,
      loopResult,
      repairAttempts: repairAttempts.map((entry) => ({
        ok: entry.ok === true,
        statusCode: Number.isFinite(Number(entry.statusCode)) ? Number(entry.statusCode) : null,
        stdoutPreview: String(entry.stdout || "").slice(0, 400),
        stderrPreview: String(entry.stderr || "").slice(0, 400),
      })),
    });
  } finally {
    await runtimeExecution.cleanup();
  }

  return {
    task: preparedTask,
    contract,
    matrix: preparedMatrix,
    loopResult,
    artifacts,
    repairAttempts,
  };
}

function resolvePlannerSelectedUiTask(task: UiDispatchTask): UiDispatchTask {
  const runtimeRecipe = normalizeRuntimeRecipe(task.uiRuntimeRecipe);
  const inferredUiSurface = firstNonEmptyString([
    task.uiSurface,
    runtimeRecipe?.primarySurface,
  ]);
  // Workers must keep full access — never fail the dispatch gate just because
  // the planner left the surface implicit. The AI/heuristic adapter
  // selection layer downstream picks the actual adapter.
  const uiSurface = inferredUiSurface || "ui";
  const targetSurfaces = (() => {
    const merged = [...new Set([
      ...normalizeStringArray(task.targetSurfaces),
      ...normalizeStringArray(runtimeRecipe?.candidateSurfaces),
      ...normalizeStringArray(uiSurface ? [uiSurface] : []),
    ])];
    return merged.length > 0 ? merged : [uiSurface];
  })();

  const contract = isRecord(task.uiContract)
    ? {
        ...task.uiContract,
        targetSurfaces,
      }
    : task.uiContract;
  const matrix = isRecord(task.uiScenarioMatrix)
    ? {
        ...task.uiScenarioMatrix,
        scenarios: Array.isArray(task.uiScenarioMatrix.scenarios)
          ? task.uiScenarioMatrix.scenarios.map((scenario) => {
              if (!scenario || typeof scenario !== "object") return scenario;
              const normalizedScenario = scenario as Record<string, unknown>;
              const currentSurface = normalizeNonEmptyString(normalizedScenario.surface);
              return {
                ...normalizedScenario,
                surface: currentSurface && currentSurface !== "auto"
                  ? currentSurface
                  : uiSurface,
              };
            })
          : [],
      }
    : task.uiScenarioMatrix;

  return {
    ...task,
    uiSurface,
    targetSurfaces,
    ...(runtimeRecipe ? { uiRuntimeRecipe: runtimeRecipe } : {}),
    ...(contract ? { uiContract: contract } : {}),
    ...(matrix ? { uiScenarioMatrix: matrix } : {}),
  };
}

function normalizeScenarioMatrix(
  plan: Record<string, unknown>,
  targetSurfaces: string[],
  inferredSurface: string,
  contract: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (isRecord(plan.uiScenarioMatrix)) {
    const rawMatrix = plan.uiScenarioMatrix;
    const rawScenarios = Array.isArray(rawMatrix.scenarios) ? rawMatrix.scenarios : [];
    return {
      ...rawMatrix,
      scenarios: rawScenarios.map((scenario, index) => {
        if (!scenario || typeof scenario !== "object") return scenario;
        const normalizedScenario = scenario as Record<string, unknown>;
        return {
          ...normalizedScenario,
          surface: normalizeNonEmptyString(normalizedScenario.surface) || targetSurfaces[0] || inferredSurface,
          kind: normalizeNonEmptyString(normalizedScenario.kind) || normalizeNonEmptyString(plan.uiScenarioKind) || "default",
          description: normalizeNonEmptyString(normalizedScenario.description)
            || normalizeNonEmptyString(plan.task)
            || `ui-scenario-${index + 1}`,
        };
      }),
    };
  }

  const synthesizedState = buildTaskLevelScenarioState(plan);
  if (!synthesizedState) return null;
  const contractId = normalizeNonEmptyString(contract?.contractId) || normalizeNonEmptyString(plan.taskId) || "ui-contract";
  return {
    matrixId: `${contractId}:default-matrix`,
    schemaVersion: 1,
    scenarios: [
      {
        scenarioId: `${contractId}:default`,
        kind: normalizeNonEmptyString(plan.uiScenarioKind) || "default",
        description: normalizeNonEmptyString(plan.task) || "UI contract runtime scenario",
        surface: inferredSurface,
        state: synthesizedState,
      },
    ],
  };
}

function buildTaskLevelScenarioState(plan: Record<string, unknown>): Record<string, unknown> | null {
  const state = isRecord(plan.uiState) ? { ...plan.uiState } : {};
  if (typeof plan.uiHtml === "string" && plan.uiHtml.trim()) {
    state.html = plan.uiHtml;
  }
  if (typeof plan.uiHtmlPath === "string" && plan.uiHtmlPath.trim()) {
    state.htmlPath = plan.uiHtmlPath;
  }
  if (typeof plan.uiUrl === "string" && plan.uiUrl.trim()) {
    state.url = plan.uiUrl;
  }

  if (Array.isArray(plan.uiExpectLandmarks) && !Array.isArray(state.expectLandmarks)) {
    state.expectLandmarks = plan.uiExpectLandmarks;
  }
  if (plan.uiViewport && state.viewport === undefined) {
    state.viewport = plan.uiViewport;
  }
  if (plan.uiMinContrast !== undefined && state.minContrast === undefined) {
    state.minContrast = plan.uiMinContrast;
  }
  if (Array.isArray(plan.uiContrastSamples) && !Array.isArray(state.contrastSamples)) {
    state.contrastSamples = plan.uiContrastSamples;
  }
  return Object.keys(state).length > 0 ? state : null;
}

async function createArtifacts(
  stateDir: string | undefined,
  task: UiDispatchTask,
  contract: UiDesignContract,
  matrix: UiScenarioMatrix,
): Promise<UiDispatchArtifacts> {
  const taskKey = sanitizeFileSegment(
    normalizeNonEmptyString(task.taskId)
      || normalizeNonEmptyString(task.task)
      || contract.contractId
      || matrix.matrixId,
  );
  const rootDir = path.join(stateDir || "state", "ui_contract", taskKey);
  await fs.mkdir(rootDir, { recursive: true });
  return {
    rootDir,
    contractPath: path.join(rootDir, "contract.json"),
    matrixPath: path.join(rootDir, "matrix.json"),
    loopResultPath: path.join(rootDir, "loop_result.json"),
    runtimeRecipePath: isRecord(task.uiRuntimeRecipe)
      ? path.join(rootDir, "runtime_recipe.json")
      : null,
    runtimeLogPath: isRecord(task.uiRuntimeRecipe)
      ? path.join(rootDir, "runtime.log")
      : null,
  };
}

async function prepareUiRuntimeExecution(input: {
  task: UiDispatchTask;
  matrix: UiScenarioMatrix;
  workspacePath?: string;
  artifacts: UiDispatchArtifacts;
  runtimeHost?: UiDispatchRuntimeHost;
}): Promise<{
  task: UiDispatchTask;
  matrix: UiScenarioMatrix;
  cleanup: () => Promise<void>;
}> {
  const runtimeRecipe = normalizeRuntimeRecipe(input.task.uiRuntimeRecipe);
  if (!runtimeRecipe) {
    return {
      task: input.task,
      matrix: input.matrix,
      cleanup: async () => {},
    };
  }

  const runtimeLogLines: string[] = [];
  const workingDirectory = resolveRuntimeWorkingDirectory(runtimeRecipe, input.workspacePath);
  const env = resolveRuntimeEnvironment(runtimeRecipe);
  const commandRunner = input.runtimeHost?.runCommand || runUiRuntimeCommand;
  const launcher = input.runtimeHost?.launchCommand || launchUiRuntimeCommand;
  const httpChecker = input.runtimeHost?.checkHttp || probeUiRuntimeHttp;
  let launchHandle: UiRuntimeLaunchHandle | null = null;

  try {
    for (const installStep of normalizeStringArray(runtimeRecipe.installSteps)) {
      runtimeLogLines.push(`[install] ${installStep}`);
      const result = await commandRunner(installStep, workingDirectory, env, resolveRuntimeTimeoutMs(runtimeRecipe, "install"));
      runtimeLogLines.push(`[install:status=${result.status}] stdout=${truncateLog(result.stdout)} stderr=${truncateLog(result.stderr)}`);
      if (Number(result.status ?? 1) !== 0) {
        throw new Error(`UI runtime install step failed: ${installStep}`);
      }
    }

    const launchCommand = normalizeNonEmptyString(runtimeRecipe.launchCommand);
    if (launchCommand) {
      runtimeLogLines.push(`[launch] ${launchCommand}`);
      launchHandle = await launcher(launchCommand, workingDirectory, env);
    }

    await waitForUiRuntimeReadiness(runtimeRecipe, launchHandle, httpChecker, runtimeLogLines);

    const runtimeUrl = firstNonEmptyString([
      runtimeRecipe.launchUrl,
      isRecord(runtimeRecipe.readinessProbe) ? runtimeRecipe.readinessProbe.url : "",
      input.task.uiUrl,
    ]);
    const updatedMatrix = runtimeUrl
      ? injectRuntimeUrlIntoMatrix(input.matrix, runtimeUrl)
      : input.matrix;
    const updatedTask = runtimeUrl
      ? {
          ...input.task,
          uiUrl: normalizeNonEmptyString(input.task.uiUrl) || runtimeUrl,
          uiScenarioMatrix: updatedMatrix,
        }
      : input.task;

    await flushRuntimeLog(input.artifacts.runtimeLogPath, runtimeLogLines);

    return {
      task: updatedTask,
      matrix: updatedMatrix,
      cleanup: async () => {
        if (launchHandle) {
          runtimeLogLines.push("[cleanup] stopping launched UI runtime");
          await launchHandle.stop();
          await flushRuntimeLog(input.artifacts.runtimeLogPath, runtimeLogLines);
        }
      },
    };
  } catch (error) {
    runtimeLogLines.push(`[error] ${String(error instanceof Error ? error.message : error)}`);
    await flushRuntimeLog(input.artifacts.runtimeLogPath, runtimeLogLines);
    if (launchHandle) {
      await launchHandle.stop().catch(() => {});
    }
    throw error;
  }
}

async function waitForUiRuntimeReadiness(
  runtimeRecipe: { [key: string]: unknown },
  launchHandle: UiRuntimeLaunchHandle | null,
  httpChecker: (url: string) => Promise<{ ok: boolean; status?: number }>,
  runtimeLogLines: string[],
): Promise<void> {
  const readinessProbe = isRecord(runtimeRecipe.readinessProbe) ? runtimeRecipe.readinessProbe : null;
  const probeType = normalizeNonEmptyString(readinessProbe?.type).toLowerCase();
  const timeoutMs = resolveRuntimeTimeoutMs(runtimeRecipe, "ready");

  if (!probeType) {
    if (launchHandle) {
      runtimeLogLines.push(`[ready] no readiness probe provided; waiting default ${timeoutMs}ms grace`);
      await waitMs(Math.min(timeoutMs, 1500));
    }
    return;
  }

  if (probeType === "stdout") {
    if (!launchHandle) {
      throw new Error("UI runtime readinessProbe.type=stdout requires launchCommand");
    }
    const pattern = buildRuntimeProbePattern(readinessProbe);
    runtimeLogLines.push(`[ready:stdout] waiting for ${pattern}`);
    const ready = await launchHandle.waitForOutput(pattern, timeoutMs);
    if (!ready) {
      throw new Error(`UI runtime stdout readiness probe timed out: ${pattern}`);
    }
    runtimeLogLines.push("[ready:stdout] matched");
    return;
  }

  if (probeType === "http") {
    const probeUrl = firstNonEmptyString([readinessProbe?.url, runtimeRecipe.launchUrl]);
    if (!probeUrl) {
      throw new Error("UI runtime readinessProbe.type=http requires readinessProbe.url or launchUrl");
    }
    runtimeLogLines.push(`[ready:http] polling ${probeUrl}`);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const response = await httpChecker(probeUrl).catch(() => ({ ok: false }));
      if (response.ok) {
          const status = "status" in response ? response.status : undefined;
          runtimeLogLines.push(`[ready:http] ok status=${String(status || "unknown")}`);
        return;
      }
      await waitMs(250);
    }
    throw new Error(`UI runtime HTTP readiness probe timed out: ${probeUrl}`);
  }

  if (probeType === "delay") {
    const delayMs = Number(readinessProbe?.ms);
    const boundedDelay = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 1000;
    runtimeLogLines.push(`[ready:delay] waiting ${boundedDelay}ms`);
    await waitMs(Math.min(timeoutMs, boundedDelay));
    return;
  }

  throw new Error(`Unsupported UI runtime readinessProbe.type: ${probeType}`);
}

function injectRuntimeUrlIntoMatrix(matrix: UiScenarioMatrix, runtimeUrl: string): UiScenarioMatrix {
  return {
    ...matrix,
    scenarios: matrix.scenarios.map((scenario) => {
      const state = isRecord(scenario.state) ? scenario.state : {};
      if (normalizeNonEmptyString(state.url) || normalizeNonEmptyString(state.htmlPath) || normalizeNonEmptyString(state.html)) {
        return scenario;
      }
      return {
        ...scenario,
        state: {
          ...state,
          url: runtimeUrl,
        },
      };
    }),
  };
}

function resolveRuntimeWorkingDirectory(runtimeRecipe: { [key: string]: unknown }, workspacePath?: string): string {
  const recipeDir = firstNonEmptyString([
    runtimeRecipe.workingDirectory,
    runtimeRecipe.cwd,
  ]);
  if (recipeDir) {
    return path.resolve(recipeDir);
  }
  if (normalizeNonEmptyString(workspacePath)) {
    return path.resolve(normalizeNonEmptyString(workspacePath));
  }
  return process.cwd();
}

function resolveRuntimeEnvironment(runtimeRecipe: { [key: string]: unknown }): NodeJS.ProcessEnv {
  const envPatch = isRecord(runtimeRecipe.env) ? runtimeRecipe.env : {};
  const env = { ...process.env } as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(envPatch)) {
    env[String(key)] = String(value ?? "");
  }
  return env;
}

function resolveRuntimeTimeoutMs(runtimeRecipe: { [key: string]: unknown }, phase: "install" | "ready"): number {
  const phaseTimeout = Number(phase === "install" ? runtimeRecipe.installTimeoutMs : runtimeRecipe.readinessTimeoutMs);
  if (Number.isFinite(phaseTimeout) && phaseTimeout > 0) return phaseTimeout;
  const sharedTimeout = Number(runtimeRecipe.timeoutMs);
  if (Number.isFinite(sharedTimeout) && sharedTimeout > 0) return sharedTimeout;
  return phase === "install" ? 10 * 60 * 1000 : 30 * 1000;
}

async function runUiRuntimeCommand(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<UiRuntimeCommandResult> {
  const shellCommand = resolveShellCommand(command);
  const result = await spawnAsync(shellCommand.command, shellCommand.args, {
    cwd,
    env,
    timeoutMs,
  }) as SpawnAsyncResultLike;
  return {
    status: Number(result?.status ?? 1),
    stdout: String(result?.stdout || ""),
    stderr: String(result?.stderr || ""),
  };
}

async function launchUiRuntimeCommand(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<UiRuntimeLaunchHandle> {
  const shellCommand = resolveShellCommand(command);
  const child = spawn(shellCommand.command, shellCommand.args, {
    cwd,
    env,
    windowsHide: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdoutBuffer = "";
  let stderrBuffer = "";
  child.stdout?.on("data", (chunk) => {
    stdoutBuffer += String(chunk || "");
    if (stdoutBuffer.length > 8192) stdoutBuffer = stdoutBuffer.slice(-8192);
  });
  child.stderr?.on("data", (chunk) => {
    stderrBuffer += String(chunk || "");
    if (stderrBuffer.length > 8192) stderrBuffer = stderrBuffer.slice(-8192);
  });

  return {
    waitForOutput: async (pattern: RegExp, timeoutMs: number) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() <= deadline) {
        if (pattern.test(`${stdoutBuffer}\n${stderrBuffer}`)) {
          return true;
        }
        if (child.exitCode !== null) {
          return false;
        }
        await waitMs(100);
      }
      return false;
    },
    stop: async () => {
      if (child.exitCode !== null) return;
      if (process.platform === "win32") {
        await spawnAsync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          cwd,
          env,
          timeoutMs: 5000,
        }).catch(() => {});
        return;
      }
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        try { child.kill("SIGKILL"); } catch { /* ignore */ }
      }
    },
  };
}

async function probeUiRuntimeHttp(url: string): Promise<{ ok: boolean; status?: number }> {
  const response = await fetch(url);
  return {
    ok: response.ok,
    status: response.status,
  };
}

function resolveShellCommand(command: string): { command: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command],
    };
  }
  return {
    command: "sh",
    args: ["-lc", command],
  };
}

function buildRuntimeProbePattern(probe: Record<string, unknown>): RegExp {
  const rawPattern = normalizeNonEmptyString(probe.pattern);
  if (!rawPattern) {
    throw new Error("UI runtime readinessProbe.type=stdout requires readinessProbe.pattern");
  }
  const flags = normalizeNonEmptyString(probe.flags) || "i";
  return new RegExp(rawPattern, flags);
}

async function flushRuntimeLog(runtimeLogPath: string | null, lines: string[]): Promise<void> {
  if (!runtimeLogPath) return;
  await fs.writeFile(runtimeLogPath, `${lines.join("\n")}\n`, "utf8");
}

function truncateLog(value: string): string {
  return String(value || "").trim().slice(0, 240);
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRuntimeRecipe(value: unknown): {
  primarySurface?: string;
  candidateSurfaces: string[];
  [key: string]: unknown;
} | null {
  if (!isRecord(value)) return null;
  const primarySurface = firstNonEmptyString([
    value.primarySurface,
    value.uiSurface,
  ]);
  const adapterModulePath = firstNonEmptyString([
    value.adapterModulePath,
    value.adapterPath,
    value.modulePath,
  ]);
  const candidateSurfaces = [...new Set([
    ...normalizeStringArray(value.candidateSurfaces),
    ...normalizeStringArray(value.targetSurfaces),
    ...normalizeStringArray(primarySurface ? [primarySurface] : []),
  ])];
  return {
    ...value,
    ...(primarySurface ? { primarySurface } : {}),
    ...(adapterModulePath ? { adapterModulePath } : {}),
    candidateSurfaces,
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
}

function firstNonEmptyString(values: unknown[]): string {
  return values.map(normalizeNonEmptyString).find(Boolean) || "";
}

function normalizeNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeFileSegment(value: string): string {
  const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  // Clip aggressively so the resulting path stays under the Windows MAX_PATH
  // ceiling once nested artifact directories are appended.
  const clipped = normalized.slice(0, 64);
  return clipped || "ui-dispatch";
}