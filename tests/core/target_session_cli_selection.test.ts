import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveCliTargetSessionSelection } from "../../src/core/target_session_cli_selection.js";

describe("target_session_cli_selection", () => {
  it("selects a newly started session by default even when another session is active", () => {
    const shouldSelect = resolveCliTargetSessionSelection({
      existingSelectedSession: { sessionId: "session_existing" },
      context: "target start",
    });

    assert.equal(shouldSelect, true);
  });

  it("keeps the current active session only when explicitly requested", () => {
    const keepExistingSelection = resolveCliTargetSessionSelection({
      existingSelectedSession: { sessionId: "session_existing" },
      keepActiveRequested: true,
      context: "activate",
    });
    const selectWhenNothingIsActive = resolveCliTargetSessionSelection({
      existingSelectedSession: null,
      keepActiveRequested: true,
      context: "activate",
    });

    assert.equal(keepExistingSelection, false);
    assert.equal(selectWhenNothingIsActive, true);
  });

  it("[NEGATIVE] rejects conflicting session-selection flags", () => {
    assert.throws(
      () => resolveCliTargetSessionSelection({
        existingSelectedSession: { sessionId: "session_existing" },
        keepActiveRequested: true,
        selectRequested: true,
        context: "target start",
      }),
      /target start cannot combine --keep-active with --select or --replace-active/
    );
  });
});