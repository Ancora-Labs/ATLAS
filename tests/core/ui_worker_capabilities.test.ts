import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkUiWorkerCapabilities,
  requiredUiWorkerCapabilities,
  UI_WORKER_CAPABILITIES,
} from "../../src/workers/ui_capabilities.js";

describe("UI worker capabilities", () => {
  it("has a stable, non-empty canonical list", () => {
    assert.ok(UI_WORKER_CAPABILITIES.length >= 10);
    const ids = UI_WORKER_CAPABILITIES.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "capability ids must be unique");
  });

  it("flags missing required capabilities", () => {
    const result = checkUiWorkerCapabilities([]);
    assert.equal(result.ok, false);
    assert.deepEqual([...result.missing].sort(), [...requiredUiWorkerCapabilities()].sort());
    assert.deepEqual(result.unknown, []);
  });

  it("passes when every required capability is granted", () => {
    const granted = requiredUiWorkerCapabilities();
    const result = checkUiWorkerCapabilities(granted);
    assert.equal(result.ok, true, `expected ok, got missing=${result.missing.join(",")}`);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.unknown, []);
  });

  it("reports unknown ids without altering ok when required set is satisfied", () => {
    const granted = [...requiredUiWorkerCapabilities(), "fs.write.box-core" as string];
    const result = checkUiWorkerCapabilities(granted);
    assert.equal(result.ok, true);
    assert.deepEqual(result.unknown, ["fs.write.box-core"]);
  });

  it("requiredUiWorkerCapabilities returns only required entries", () => {
    const required = requiredUiWorkerCapabilities();
    const requiredFromList = UI_WORKER_CAPABILITIES.filter((c) => c.required).map((c) => c.id);
    assert.deepEqual([...required].sort(), [...requiredFromList].sort());
  });
});
