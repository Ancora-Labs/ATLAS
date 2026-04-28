import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readWorkspaceFile(relativePath: string) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("worker agent profile contracts", () => {
  it("integration worker profile requires the canonical verification block", async () => {
    const profile = await readWorkspaceFile(".github/agents/integration-worker.agent.md");

    assert.match(profile, /===VERIFICATION_REPORT===/);
    assert.match(profile, /BUILD=<pass\|fail\|n\/a>/);
    assert.match(profile, /TESTS=<pass\|fail\|n\/a>/);
    assert.match(profile, /EDGE_CASES=<pass\|fail\|n\/a>/);
    assert.match(profile, /BOX_STATUS=done \| partial \| blocked \| skipped/);
    assert.match(profile, /do NOT replace the required BUILD\/TESTS\/RESPONSIVE\/API\/EDGE_CASES\/SECURITY fields/i);
  });

  it("integration worker profile does not advertise criterion-only verification examples", async () => {
    const profile = await readWorkspaceFile(".github/agents/integration-worker.agent.md");

    assert.doesNotMatch(profile, /criterion_1:\s*PASS\s*\|/i);
    assert.doesNotMatch(profile, /acceptance criterion 1:\s*PASS\/FAIL/i);
  });
});