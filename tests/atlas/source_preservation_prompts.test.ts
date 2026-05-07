import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { AtlasSessionAttachment } from "../../src/atlas/attachments.js";
import { buildAtlasPlanningPrompt } from "../../src/atlas/build_request_state.js";
import {
  buildAtlasClarificationPrompt,
  createAtlasFallbackAttachmentPlan,
} from "../../src/atlas/clarification.js";

function buildAttachment(overrides: Partial<AtlasSessionAttachment> = {}): AtlasSessionAttachment {
  return {
    id: "attachment-1",
    originalName: "frame-5.png",
    storedName: "frame-5-asset.png",
    storedRelativePath: "atlas/desktop_sessions/demo/attachments/frame-5-asset.png",
    mediaType: "image/png",
    byteSize: 1024,
    kind: "image",
    sha256: "abc123",
    roleHint: "User-supplied visual asset.",
    textPreview: null,
    createdAt: "2026-04-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("atlas source preservation prompts", () => {
  it("preserves exact image assets across clarification and planning handoff", () => {
    const imageAttachment = buildAttachment();
    const fallbackPlan = createAtlasFallbackAttachmentPlan(imageAttachment);
    const clarificationPrompt = buildAtlasClarificationPrompt(
      "acme/restaurant-site",
      "Use the real restaurant hero photo from the operator instead of a fake illustration.",
      [imageAttachment],
      "new",
    );
    const planningPrompt = buildAtlasPlanningPrompt({
      title: "Restaurant site",
      objective: "Use the real restaurant hero photo from the operator instead of a fake illustration.",
      targetRepo: "acme/restaurant-site",
      repoMode: "new",
      attachmentPlans: [fallbackPlan],
    });

    assert.match(fallbackPlan.intendedUse, /exact operator-supplied image file/i);
    assert.ok(fallbackPlan.implementationNotes.some((note) => /Preserve this exact operator-supplied image file/i.test(note)));
    assert.doesNotMatch(clarificationPrompt, /desktop-native software delivery shell/i);
    assert.match(clarificationPrompt, /do not ask about desktop shells, Electron, frontend stacks/i);
    assert.match(clarificationPrompt, /preserve real visual sources as direct build requirements/i);
    assert.match(clarificationPrompt, /do not write executionNotes or operatorIntentBrief text that says to hold work until written permission, original assets, or exact-source rights are provided/i);
    assert.match(clarificationPrompt, /source non-infringing replacement assets that match the requested feel, subject, or brand constraints/i);
    assert.match(planningPrompt, /Preserve operator-supplied or explicitly requested real visuals as source requirements/i);
    assert.match(planningPrompt, /explicitly choose the visual medium and source strategy that best matches a believable shipped product/i);
    assert.match(planningPrompt, /actively source an internet image, logo, brand mark, texture, or other operator-approved source asset/i);
    assert.match(planningPrompt, /If the needed real or operator-approved source asset is unavailable, disclose that blocker explicitly and keep the source requirement visible/i);
  });

  it("[NEGATIVE] does not instruct a hard stop when replacement assets are allowed", () => {
    const clarificationPrompt = buildAtlasClarificationPrompt(
      "acme/restaurant-site",
      "Recreate the same restaurant landing page feel. We do not have permission for the original assets, so use similar internet-sourced replacement assets instead.",
      [],
      "new",
    );

    assert.match(clarificationPrompt, /do not convert that into a stop-work instruction/i);
    assert.match(clarificationPrompt, /ask a clarifying question instead of emitting a hard stop only when it is still unclear whether replacement assets are acceptable/i);
    assert.doesNotMatch(
      clarificationPrompt,
      /hold work until the operator supplies the source url\/screenshots and either original assets or written permission for reuse/i,
    );
  });

  it("[NEGATIVE] keeps non-image attachments on the generic preservation path", () => {
    const textAttachment = buildAttachment({
      originalName: "brief.md",
      storedName: "brief.md",
      storedRelativePath: "atlas/desktop_sessions/demo/attachments/brief.md",
      mediaType: "text/markdown",
      kind: "text",
      roleHint: "Source content file. Pull copy from this attachment.",
      textPreview: "Chef-owned steakhouse homepage copy.",
    });

    const fallbackPlan = createAtlasFallbackAttachmentPlan(textAttachment);

    assert.doesNotMatch(fallbackPlan.intendedUse, /stock assets|unsupported visual source/i);
    assert.ok(fallbackPlan.implementationNotes.every((note) => !/stock assets|unsupported visual source/i.test(note)));
  });
});