import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AtlasDesktopSessionRecord } from "../../src/atlas/desktop_sessions.js";
import { buildAtlasPlanningPrompt } from "../../src/atlas/build_request_state.js";
import { persistAtlasTargetHandoffArtifacts } from "../../src/atlas/build_runtime.js";

function buildSession(overrides: Partial<AtlasDesktopSessionRecord> = {}): AtlasDesktopSessionRecord {
  return {
    id: "atlas-session-flex",
    title: "Steakhouse Landing Page",
    objective: "Build a premium steakhouse landing page.",
    summary: "Premium steakhouse landing page with a booking-first flow.",
    operatorIntentBrief: "Build a premium steakhouse landing page with a booking-first flow and preserve the confirmed premium visual direction.",
    projectId: null,
    projectSessionId: null,
    projectWorkspacePath: null,
    projectName: "Steakhouse Landing Page",
    projectDescription: "High-end restaurant site with a booking-first flow.",
    repoContext: {
      provider: "github",
      targetRepo: "acme/steakhouse-site",
      targetBaseBranch: "main",
      repoMode: "existing",
      repoCreatedByAtlas: false,
    },
    status: "ready",
    openQuestions: [],
    executionNotes: ["Honor the premium brand tone and confirmed assets."],
    attachments: [],
    attachmentPlans: [],
    clarificationAnswers: [],
    pendingQuestionIndex: null,
    pendingQuestion: null,
    messages: [
      {
        id: "message-1",
        role: "user",
        text: "Stack umurumda degil, en iyi sistemi istiyorum.",
        createdAt: "2026-04-29T00:00:00.000Z",
      },
    ],
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("atlas intent flexibility carry-over", () => {
  it("preserves explicit stack latitude in the handoff contract and build prompt", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-intent-flex-"));
    const session = buildSession();

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });
    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));
    const planningPrompt = buildAtlasPlanningPrompt({
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      repoMode: session.repoContext?.repoMode || null,
      executionNotes: session.executionNotes,
      messages: session.messages,
      attachmentPlans: session.attachmentPlans,
    });

    assert.match(String(intentContract.clarifiedIntent.implementationFlexibility || ""), /strongest implementation/i);
    assert.match(planningPrompt, /Implementation latitude: Operator explicitly allows best-fit stack and framework choices/i);
  });

  it("defaults broad sessions to the strongest plausible implementation without dropping confirmed constraints", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-intent-generic-"));
    const session = buildSession({
      id: "atlas-session-generic",
      messages: [
        {
          id: "message-1",
          role: "user",
          text: "Build a premium steakhouse landing page with the confirmed assets.",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
      ],
    });

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });
    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));

    assert.match(String(intentContract.clarifiedIntent.implementationFlexibility || ""), /strongest plausible product direction/i);
    assert.match(String(intentContract.clarifiedIntent.implementationFlexibility || ""), /confirmed assets remain authoritative guardrails/i);
  });

  it("carries explicit real-image requirements from raw user messages into the handoff contract and build prompt", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-asset-signal-"));
    const session = buildSession({
      id: "atlas-session-assets",
      summary: "Premium outdoor storefront with product-led visuals.",
      messages: [
        {
          id: "message-1",
          role: "user",
          text: "Urun sayfalarinda internetten gercek urun fotograflari kullan, placeholder cizim kullanma.",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
      ],
    });

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });
    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));
    const planningPrompt = buildAtlasPlanningPrompt({
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      repoMode: session.repoContext?.repoMode || null,
      executionNotes: session.executionNotes,
      messages: session.messages,
      attachmentPlans: session.attachmentPlans,
    });

    assert.match(String(intentContract.clarifiedIntent.assetSourcingPolicy || ""), /real external or operator-confirmed visual assets/i);
    assert.ok(
      (intentContract.clarifiedIntent.assetRequirements || []).some(
        (entry: string) => /real raster or external-source visual assets/i.test(entry),
      ),
    );
    assert.match(planningPrompt, /Asset sourcing policy: Use real external or operator-confirmed visual assets/i);
    assert.match(planningPrompt, /internet-sourced assets when the operator did not provide one/i);
    assert.match(planningPrompt, /Ship real raster or external-source visual assets/i);
    assert.match(planningPrompt, /actively source an internet image, logo, brand mark, texture, or other operator-approved source asset/i);
  });

  it("[NEGATIVE] keeps broad premium storefront missions on the generic asset path until the operator or planner names a concrete source need", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-generic-asset-path-"));
    const session = buildSession({
      id: "atlas-session-generic-assets",
      title: "Pizza Restaurant Launch",
      objective: "Build a premium pizza restaurant landing page with booking-first conversion.",
      summary: "Launch-ready pizza restaurant site with premium hero and menu storytelling.",
      projectName: "Pizza Restaurant Launch",
      projectDescription: "Premium dining launch site with a booking-first flow.",
      executionNotes: ["Keep the first release premium and food-led."],
      messages: [
        {
          id: "message-1",
          role: "user",
          text: "Build a premium pizza restaurant landing page.",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
      ],
    });

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });
    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));
    const planningPrompt = buildAtlasPlanningPrompt({
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      repoMode: session.repoContext?.repoMode || null,
      executionNotes: session.executionNotes,
      messages: session.messages,
      attachmentPlans: session.attachmentPlans,
    });

    assert.deepEqual(intentContract.clarifiedIntent.assetRequirements || [], []);
    assert.doesNotMatch(planningPrompt, /Asset sourcing policy:/i);
    assert.doesNotMatch(planningPrompt, /real raster or external-source visual assets/i);
    assert.match(planningPrompt, /explicitly choose the visual medium and source strategy that best matches a believable shipped product/i);
    assert.match(planningPrompt, /If the needed real or operator-approved source asset is unavailable, disclose that blocker explicitly and keep the source requirement visible/i);
  });

  it("[NEGATIVE] does not force external imagery when the operator explicitly forbids internet images", async () => {
    const runtimeStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-asset-avoidance-"));
    const session = buildSession({
      id: "atlas-session-no-assets",
      messages: [
        {
          id: "message-1",
          role: "user",
          text: "Internetten gorsel kullanma; sadece yerel assetlerle ilerle.",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
      ],
    });

    const written = await persistAtlasTargetHandoffArtifacts(runtimeStateDir, session, {
      projectId: "project-1",
      sessionId: "target-session-1",
    });
    const intentContract = JSON.parse(await fs.readFile(written.intentContractPath, "utf8"));
    const planningPrompt = buildAtlasPlanningPrompt({
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      repoMode: session.repoContext?.repoMode || null,
      executionNotes: session.executionNotes,
      messages: session.messages,
      attachmentPlans: session.attachmentPlans,
    });

    assert.deepEqual(intentContract.clarifiedIntent.assetRequirements, []);
    assert.match(String(intentContract.clarifiedIntent.assetSourcingPolicy || ""), /real-world sources/i);
    assert.doesNotMatch(planningPrompt, /Ship real raster or external-source visual assets/i);
    assert.doesNotMatch(planningPrompt, /actively source an internet image/i);
  });

  it("keeps raw operator wording in the planning prompt instead of relying only on the compressed summary", () => {
    const session = buildSession({
      summary: "Premium outdoor storefront with product-led visuals.",
      messages: [
        {
          id: "message-user-1",
          role: "user",
          text: "Hero ve urun kartlarinda gercek outdoor fotograflar kullan; shape ve ilustrasyon kullanma.",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
        {
          id: "message-agent-1",
          role: "agent",
          text: "I will compress this into a shorter summary.",
          createdAt: "2026-04-29T00:01:00.000Z",
        },
      ],
    });

    const planningPrompt = buildAtlasPlanningPrompt({
      title: session.title,
      objective: session.objective,
      summary: session.summary,
      targetRepo: session.repoContext?.targetRepo || null,
      repoMode: session.repoContext?.repoMode || null,
      executionNotes: session.executionNotes,
      messages: session.messages,
      attachmentPlans: session.attachmentPlans,
    });

    assert.match(planningPrompt, /Operator intent evidence:/i);
    assert.match(planningPrompt, /Hero ve urun kartlarinda gercek outdoor fotograflar kullan/i);
    assert.doesNotMatch(planningPrompt, /I will compress this into a shorter summary/i);
  });
});