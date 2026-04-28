/**
 * ui_contract/index.ts — Barrel for the UI contract / control system slice.
 *
 * Importers should depend only on this barrel so internal file moves remain
 * non-breaking.
 */

export type {
  EvidenceClass,
  UiAdapterEvidence,
  UiAdapterInput,
  UiDesignContract,
  UiEvidenceItem,
  UiLoopAttempt,
  UiLoopLimits,
  UiLoopResult,
  UiLoopStopReason,
  UiScenario,
  UiScenarioMatrix,
  UiScenarioVerdict,
  UiSurfaceAdapter,
  UiVerdict,
  UiVerdictStatus,
} from "./types.js";

export { parseUiDesignContract, UiContractParseError } from "./contract.js";
export { parseUiScenarioMatrix, UiScenarioParseError } from "./scenarios.js";
export { UiAdapterRegistry, UiAdapterRegistryError } from "./adapter.js";
export { HeadlessBrowserDomAdapter } from "./adapters/headless_browser_dom_adapter.js";
export { StaticDomAdapter } from "./adapters/static_dom_adapter.js";
export { ElectronCaptureAdapter, type ElectronCaptureAdapterOptions } from "./adapters/electron_capture_adapter.js";
export { SessionModuleAdapter } from "./adapters/session_module_adapter.js";
export { buildRuleBasedVerdict } from "./verdict.js";
export {
  runUiContractLoop,
  type UiLoopRepair,
  type UiLoopRepairContext,
  type UiLoopRunInput,
} from "./loop_controller.js";
export {
  buildUiDispatchAdapterRegistry,
  normalizeUiDispatchPlan,
  runUiContractDispatchLoop,
  type UiDispatchAdapterRegistryOptions,
  type UiDispatchArtifacts,
  type UiDispatchRepair,
  type UiDispatchRepairResult,
  type UiDispatchTask,
} from "./dispatch.js";
