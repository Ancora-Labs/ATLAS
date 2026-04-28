/**
 * ui_contract/adapters/static_dom_adapter.ts — Minimal real adapter.
 *
 * Produces structural and accessibility evidence from a static DOM-like
 * fixture supplied directly in the scenario `state`. No browser, no DOM
 * library — keeps this slice deterministic, dependency-free, and CI-safe
 * while still exercising the full contract → adapter → evidence path.
 *
 * Scenario state shape this adapter understands:
 *   {
 *     "html":            string,            // raw HTML-ish fixture text
 *     "expectLandmarks": string[],          // tag names that must appear (e.g. ["main", "nav"])
 *     "minContrast":     number,            // optional, AA = 4.5
 *     "contrastSamples": Array<{ id: string, ratio: number }>
 *   }
 *
 * All four evidence classes are emitted so the rule-based judge can reason
 * about every dimension the contract may care about. Visual + behavioral
 * items are deterministic placeholders (`pass: true` with explanatory
 * detail) that real adapters (Playwright, Electron) will later populate.
 */

import type {
  UiAdapterEvidence,
  UiAdapterInput,
  UiEvidenceItem,
  UiSurfaceAdapter,
} from "../types.js";

export class StaticDomAdapter implements UiSurfaceAdapter {
  readonly adapterId = "static-dom";
  readonly surface: string;
  readonly supports = ["visual", "structural", "behavioral", "accessibility"] as const;

  constructor(surface = "static-dom") {
    this.surface = surface;
  }

  async collect(input: UiAdapterInput): Promise<UiAdapterEvidence> {
    const { contract, scenario } = input;
    const state = scenario.state ?? {};
    const html = typeof state.html === "string" ? state.html : "";

    const structural = this.collectStructural(html, state);
    const a11y = this.collectAccessibility(html, state, contract.accessibilityFloor);
    const visual = this.collectVisualPlaceholder();
    const behavioral = this.collectBehavioralPlaceholder();

    return {
      adapterId: this.adapterId,
      scenarioId: scenario.scenarioId,
      items: {
        structural,
        accessibility: a11y,
        visual,
        behavioral,
      },
    };
  }

  private collectStructural(html: string, state: Record<string, unknown>): UiEvidenceItem[] {
    const expectLandmarks = Array.isArray(state.expectLandmarks)
      ? (state.expectLandmarks as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const items: UiEvidenceItem[] = [];

    // Required-landmark presence checks.
    for (const tag of expectLandmarks) {
      const present = hasTag(html, tag);
      items.push({
        evidenceClass: "structural",
        ruleId: `dom_landmark:${tag}`,
        pass: present,
        detail: present ? `<${tag}> present` : `<${tag}> missing`,
      });
    }

    // Generic forbidden structural pattern: nested <dialog> / role="dialog".
    const modalInModal = countOccurrences(html, /<dialog\b|role=["']dialog["']/gi) >= 2
      && /<dialog[\s\S]*<dialog/i.test(html);
    items.push({
      evidenceClass: "structural",
      ruleId: "modal_inside_modal",
      pass: !modalInModal,
      detail: modalInModal ? "nested dialog detected" : "no nested dialog",
    });

    return items;
  }

  private collectAccessibility(
    html: string,
    state: Record<string, unknown>,
    accessibilityFloor: string,
  ): UiEvidenceItem[] {
    const items: UiEvidenceItem[] = [];

    // Image alt attribute coverage.
    const imgs = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
    const imgsMissingAlt = imgs.filter((tag) => !/\balt\s*=/.test(tag));
    items.push({
      evidenceClass: "accessibility",
      ruleId: "img_alt_coverage",
      pass: imgsMissingAlt.length === 0,
      detail: imgsMissingAlt.length === 0
        ? `${imgs.length} <img> tag(s), all have alt`
        : `${imgsMissingAlt.length} <img> tag(s) missing alt`,
    });

    // Optional contrast samples.
    const minContrast = typeof state.minContrast === "number"
      ? state.minContrast
      : accessibilityFloor === "WCAG-AA" ? 4.5 : 0;
    if (minContrast > 0 && Array.isArray(state.contrastSamples)) {
      for (const sample of state.contrastSamples as unknown[]) {
        if (!sample || typeof sample !== "object") continue;
        const s = sample as { id?: unknown; ratio?: unknown };
        if (typeof s.id !== "string" || typeof s.ratio !== "number") continue;
        const pass = s.ratio >= minContrast;
        items.push({
          evidenceClass: "accessibility",
          ruleId: `contrast:${s.id}`,
          pass,
          detail: `ratio=${s.ratio.toFixed(2)} floor=${minContrast.toFixed(2)}`,
        });
      }
    }

    return items;
  }

  private collectVisualPlaceholder(): UiEvidenceItem[] {
    return [
      {
        evidenceClass: "visual",
        ruleId: "visual_capture_available",
        pass: true,
        detail: "static-dom adapter: visual capture deferred to richer adapter",
      },
    ];
  }

  private collectBehavioralPlaceholder(): UiEvidenceItem[] {
    return [
      {
        evidenceClass: "behavioral",
        ruleId: "behavioral_trace_available",
        pass: true,
        detail: "static-dom adapter: behavioral trace deferred to richer adapter",
      },
    ];
  }
}

function hasTag(html: string, tag: string): boolean {
  const safe = tag.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) return false;
  const re = new RegExp(`<${safe}\\b`, "i");
  return re.test(html);
}

function countOccurrences(text: string, re: RegExp): number {
  return Array.from(text.matchAll(re)).length;
}
