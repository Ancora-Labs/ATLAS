import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAtlasDaemonStartArgs } from "../../src/atlas/build_runtime.js";

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
});