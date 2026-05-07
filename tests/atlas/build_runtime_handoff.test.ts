import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AtlasDesktopSessionRecord } from "../../src/atlas/desktop_sessions.js";
import { persistAtlasTargetHandoffArtifacts } from "../../src/atlas/build_runtime.js";

function buildSession(overrides: Partial<AtlasDesktopSessionRecord> = {}): AtlasDesktopSessionRecord {
  return {
    id: "atlas-session-1",
    title: "Steakhouse Landing Page",
    objective: "Build a premium steakhouse landing page.",
    summary: "Premium steakhouse landing page with a real hero image.",
    operatorIntentBrief: "Build a premium steakhouse landing page with a real hero image, booking-first conversion flow, and preserved source visuals.",
    projectId: null,
    projectSessionId: null,
    projectWorkspacePath: null,
    projectName: "Steakhouse Landing Page",
    projectDescription: "High-end restaurant site with booking-first flow.",
    repoContext: {
      provider: "github",
      targetRepo: "acme/steakhouse-site",
      targetBaseBranch: "main",
      repoMode: "new",
      repoCreatedByAtlas: true,
    },
    status: "ready",
    openQuestions: [],
    executionNotes: ["Use the confirmed hero image in the first fold."],
    attachments: [],
    attachmentPlans: [
      {
        attachmentId: "asset-1",
        attachmentName: "hero.jpg",
        storedRelativePath: "atlas/desktop_sessions/demo/attachments/hero.jpg",
        intendedUse: "Use the real steakhouse hero photo in the hero section.",
        placementHint: "Hero section",
        implementationNotes: ["Use the exact operator-provided image file."],
      },
    ],
    clarificationAnswers: [],
    pendingQuestionIndex: null,
    pendingQuestion: null,
    messages: [],
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("atlas build runtime handoff artifacts", () => {
  it("persists ready-for-planning clarification and intent artifacts for the target session", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-handoff-"));
    const session = buildSession();

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });

    const clarificationPacket = JSON.parse(await fs.readFile(written.clarificationPacketPath, "utf8"));
    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));

    assert.equal(clarificationPacket.readyForPlanning, true);
    assert.equal(clarificationPacket.questions.length, 0);
    assert.equal(intentContract.status, "ready_for_planning");
    assert.equal(intentContract.readyForPlanning, true);
    assert.match(String(intentContract.clarifiedIntent.operatorIntentBrief || ""), /booking-first conversion flow/i);
    assert.match(String(intentContract.resolvedPacket.operatorIntentBrief || ""), /preserved source visuals/i);
    assert.match(String(intentContract.clarifiedIntent.assetSourcingPolicy || ""), /operator-confirmed attachments/i);
    assert.ok((intentContract.clarifiedIntent.assetRequirements || []).some((entry: string) => /hero\.jpg/i.test(entry)));
  });

  it("preserves explicit real-image sourcing without inventing attachment-specific file requirements", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-handoff-no-assets-"));
    const session = buildSession({ attachmentPlans: [] });

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });

    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));

    assert.match(String(intentContract.clarifiedIntent.assetSourcingPolicy || ""), /real external or operator-confirmed visual assets/i);
    assert.ok(
      (intentContract.clarifiedIntent.assetRequirements || []).some(
        (entry: string) => /real raster or external-source visual assets/i.test(entry),
      ),
    );
    assert.ok(
      (intentContract.clarifiedIntent.assetRequirements || []).every(
        (entry: string) => !/hero\.jpg/i.test(entry),
      ),
    );
  });

  it("treats internet-sourced logos and textures as real visual asset requirements", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-handoff-logo-assets-"));
    const session = buildSession({
      attachmentPlans: [],
      objective: "Build an OAK & STRIKE bowling lodge landing page.",
      summary: "Source all photography, logos, and wood/texture assets from high-quality royalty-free internet resources.",
      operatorIntentBrief: "The design team should source all photography, logos, and wood/texture assets using high-quality, royalty-free resources from the internet.",
      executionNotes: ["Use commercially licensed images, logos, and premium textures that align with the brand's modern country aesthetic."],
      messages: [
        {
          id: "message-logo-assets",
          role: "user",
          text: "Source all photography, logos, and wood/texture assets using high-quality royalty-free resources from the internet.",
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
    });

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });

    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));
    const requirements = intentContract.clarifiedIntent.assetRequirements || [];

    assert.match(String(intentContract.clarifiedIntent.assetSourcingPolicy || ""), /logos, brand marks, textures/i);
    assert.ok(requirements.some((entry: string) => /photos, logos, brand marks, and textures/i.test(entry)));
    assert.ok(requirements.some((entry: string) => /operator-provided or internet-sourced assets/i.test(entry)));
  });

  it("preserves raw operator intent evidence from user messages and clarification answers", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-handoff-evidence-"));
    const session = buildSession({
      summary: "Premium outdoor storefront with product-led storytelling.",
      executionNotes: ["Keep the first release premium and conversion-focused."],
      clarificationAnswers: [
        {
          question: "What should the product visuals use?",
          answer: "Use real outdoor photography and preserve it as the source visual.",
        },
      ],
      messages: [
        {
          id: "message-user-1",
          role: "user",
          text: "Urun kartlarinda gercek fotograf kullan, yapay shape veya ilustrasyon kullanma.",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
        {
          id: "message-agent-1",
          role: "agent",
          text: "I can summarize this later.",
          createdAt: "2026-04-29T00:01:00.000Z",
        },
      ],
    });

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });

    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));
    const serializedEvidence = JSON.stringify(intentContract.clarifiedIntent.operatorIntentEvidence || []);
    const serializedScope = JSON.stringify(intentContract.clarifiedIntent.scopeIn || []);

    assert.match(serializedEvidence, /Confirmed operator answer: What should the product visuals use: Use real outdoor photography and preserve it as the source visual\./i);
    assert.match(serializedEvidence, /Operator message: Urun kartlarinda gercek fotograf kullan, yapay shape veya ilustrasyon kullanma\./i);
    assert.match(serializedScope, /Operator message:/i);
    assert.doesNotMatch(serializedEvidence, /I can summarize this later/i);
  });
});