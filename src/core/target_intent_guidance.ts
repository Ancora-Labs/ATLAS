function normalizeGuidanceField(value: unknown): string {
  return String(value || "").trim();
}

export function buildStrongestPlausibleFallbackGuidance(input: {
  preferredQualityBar?: unknown;
  implementationFlexibility?: unknown;
}): string[] {
  const preferredQualityBar = normalizeGuidanceField(input?.preferredQualityBar);
  const implementationFlexibility = normalizeGuidanceField(input?.implementationFlexibility);

  if (preferredQualityBar && implementationFlexibility) {
    return [];
  }

  return [
    "Fallback ambition policy: if the target contract leaves the quality bar or implementation latitude unspecified, resolve broad briefs toward the strongest plausible outcome that still fits the stated product class, locked scope, repo direction, and explicit constraints.",
    "Reference fidelity policy: when the operator provides a concrete reference site, screenshot set, or named external design target, treat that reference as the primary design authority for layout, section order, spacing rhythm, component geometry, CTA placement, media treatment, and breakpoint behavior rather than substituting a generic in-house scheme.",
    "Exemplar sourcing policy: when the task includes product-facing UI and the operator did not provide a concrete reference, source and inspect at least one external visual exemplar before implementation; do not begin from internal design priors or reusable scaffolding alone.",
    "Visual evidence policy: HTML extraction, text scraping, headings, navigation labels, and component decomposition are supporting evidence only; they cannot replace direct visual inspection of a reference or externally sourced exemplar.",
    "Sequential image policy: for UI/image research, inspect screenshots and source images one at a time and record the finding for each image before obtaining the next one.",
    "Anti-generic fallback policy: do not reinterpret a requested UI into a safer, more generic, more basic, or more template-like design direction just because the brief is broad; if external sourcing and reference usage are allowed, inspect concrete external examples and anchor the implementation to those examples instead of your own default design priors.",
    "Research-first UI policy: HTML extraction, text scraping, headings, or component decomposition are supporting evidence only; they cannot replace direct visual exemplar inspection for a design-fidelity task.",
    "Deviation policy: if a requested reference detail cannot be carried forward because of an explicit technical, rights, or scope blocker, preserve the rest of the reference-specific direction and state the exact blocker plainly; do not use that blocker as permission to dilute the whole surface into a generic alternative.",
    "Quality saturation policy: do not treat build/test success alone as proof that a product-facing surface is finished; completion requires browser-visible evidence, responsive checks, source asset integrity, and a concise statement that no high-impact in-scope improvement remains unattempted.",
    "Visual medium policy: when the brief includes product-facing UI or marketing surfaces, explicitly choose the medium and source strategy that a credible shipped product would use for each key surface instead of leaving visuals underspecified.",
    "Use operator assets, real photography, screenshots, logos, brand marks, textures, internet-sourced imagery, or existing branded assets deliberately; preserve the selected medium and source as a delivery requirement.",
    "When the brief calls for a real visual asset and external sourcing is allowed, actively source an internet image, logo, brand mark, texture, or other source asset that matches the requested subject instead of fabricating artwork, and do not narrow this to stock-image sourcing by default.",
    "If the required real or operator-approved source asset is unavailable, surface the blocker explicitly and keep the source requirement visible.",
    "Safety boundary: this fallback is advisory only. Do not widen scope, override explicit stack constraints, or bypass clarification or readiness gates while applying it.",
  ];
}