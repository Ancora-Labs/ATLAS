export interface AtlasIntentSignalMessageInput {
  role?: string | null;
  text?: string | null;
}

export interface AtlasIntentSignalInput {
  objective?: string | null;
  summary?: string | null;
  executionNotes?: string[] | null;
  messages?: AtlasIntentSignalMessageInput[] | null;
}

export interface AtlasDerivedAssetSignals {
  assetSourcingPolicy: string | null;
  assetRequirements: string[];
}

function normalizeIntentEvidenceLine(value: string): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > 280 ? `${normalized.slice(0, 277).trimEnd()}...` : normalized;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function buildSignalCorpus(input: AtlasIntentSignalInput): string[] {
  const messageTexts = Array.isArray(input.messages)
    ? input.messages
        .filter((message) => String(message?.role || "").trim().toLowerCase() === "user")
        .map((message) => normalizeOptionalString(message?.text))
        .filter((value): value is string => Boolean(value))
    : [];

  return [
    normalizeOptionalString(input.objective),
    normalizeOptionalString(input.summary),
    ...normalizeStringList(input.executionNotes),
    ...messageTexts,
  ];
}

function hasExplicitImplementationLatitude(input: AtlasIntentSignalInput): boolean {
  const patterns = [
    /stack\s+(does not|doesn't)\s+matter/i,
    /framework\s+(does not|doesn't)\s+matter/i,
    /tech(?:nology)?\s+stack\s+(is\s+)?(flexible|open|optional)/i,
    /stack\s+umurumda\s+degil/i,
    /teknoloji\s+yigini\s+umurumda\s+degil/i,
  ];

  return buildSignalCorpus(input).some((entry) => patterns.some((pattern) => pattern.test(entry)));
}

function hasBestPossibleQualitySignal(input: AtlasIntentSignalInput): boolean {
  const patterns = [
    /best\s+possible\s+(system|implementation|stack|architecture)/i,
    /use\s+the\s+best\s+(system|stack|architecture)/i,
    /prefer\s+the\s+best\s+(system|implementation)/i,
    /en\s+iyi\s+sistemi\s+istiyorum/i,
    /en\s+iyi\s+sistem/i,
  ];

  return buildSignalCorpus(input).some((entry) => patterns.some((pattern) => pattern.test(entry)));
}

export function deriveAtlasOperatorIntentEvidence(input: AtlasIntentSignalInput): string[] {
  const messageTexts = Array.isArray(input.messages)
    ? input.messages
        .filter((message) => String(message?.role || "").trim().toLowerCase() === "user")
        .map((message) => normalizeOptionalString(message?.text))
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeIntentEvidenceLine(value))
        .filter(Boolean)
    : [];

  return [...new Set(messageTexts)].slice(-6);
}

function hasMatchingIntentSignal(input: AtlasIntentSignalInput, patterns: readonly RegExp[]): boolean {
  return buildSignalCorpus(input).some((entry) => patterns.some((pattern) => pattern.test(entry)));
}

const EXPLICIT_REAL_ASSET_REQUIREMENT_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /\b(?:use|include|need|needs|want|allow|ship|required?)\b[\s\S]{0,50}\b(?:images?\s+from\s+the\s+internet|internet\s+images?|external\s+images?|stock\s+(?:images?|photos?)|real\s+(?:images?|photos?|photography)|authentic\s+(?:imagery|images)|real\s+product\s+photography)\b/i,
  /\b(?:use|include|need|needs|want|allow|ship|replace|required?)\b[\s\S]{0,60}\b(?:hero\s+image|hero\s+photo|gallery\s+images?|product\s+photos?|restaurant\s+photos?|menu\s+photos?|venue\s+photos?|images?|photos?|photography|imagery)\b/i,
  /\b(?:use|include|need|needs|want|allow|ship|source|required?)\b[\s\S]{0,80}\b(?:logos?|brand\s+marks?|brand\s+assets?|wood\s*\/\s*texture\s+assets?|textures?)\b[\s\S]{0,80}\b(?:internet|external|source\s+originals?|royalty-free|commercially\s+licensed|lawfully\s+usable)\b/i,
  /\b(?:logos?|brand\s+marks?|brand\s+assets?|wood\s*\/\s*texture\s+assets?|textures?)\b[\s\S]{0,80}\b(?:internet|external|source\s+originals?|royalty-free|commercially\s+licensed|lawfully\s+usable)\b/i,
  /\b(?:internetten|harici|dis\s+kaynak)\b[\s\S]{0,60}\b(?:gorsel\w*|resim\w*|foto\w*)\b/i,
  /\b(?:ger(?:c|\u00e7)ek|otantik)\b[\s\S]{0,30}\b(?:gorsel\w*|resim\w*|foto\w*)\b/i,
  /\b(?:gorsel\w*|resim\w*|foto\w*)\b[\s\S]{0,30}\b(?:kullan|olsun|ekle|istiyorum|gerekiyor)\b/i,
  /\bdo\s+not\b[\s\S]{0,40}\b(?:placeholder(?:s)?|generic\s+illustration)\b/i,
]);

const EXPLICIT_EXTERNAL_ASSET_AVOIDANCE_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /\b(?:do\s+not|avoid|no)\b[\s\S]{0,40}\b(?:stock\s+(?:images?|photos?)|external\s+images?|internet\s+images?)\b/i,
  /\b(?:internetten|harici|dis\s+kaynak)\b[\s\S]{0,20}\b(?:gorsel\w*|resim\w*|foto\w*)\b[\s\S]{0,20}\b(?:kullanma|istemiyorum|olmasin)\b/i,
]);

export function deriveAtlasAssetSignals(input: AtlasIntentSignalInput): AtlasDerivedAssetSignals {
  if (hasMatchingIntentSignal(input, EXPLICIT_EXTERNAL_ASSET_AVOIDANCE_PATTERNS)) {
    return {
      assetSourcingPolicy: null,
      assetRequirements: [],
    };
  }

  const hasExplicitRealAssetNeed = hasMatchingIntentSignal(input, EXPLICIT_REAL_ASSET_REQUIREMENT_PATTERNS);

  if (!hasExplicitRealAssetNeed) {
    return {
      assetSourcingPolicy: null,
      assetRequirements: [],
    };
  }

  return {
    assetSourcingPolicy: "Use real external or operator-confirmed visual assets when the requested outcome depends on imagery, logos, brand marks, textures, or other source-required visuals, preferring internet-sourced assets when the operator did not provide one and not narrowing this to stock-image sourcing by default.",
    assetRequirements: [
      "Ship real raster or external-source visual assets on the surfaces the operator explicitly asked to illustrate or brand, including photos, logos, brand marks, and textures; prefer operator-provided or internet-sourced assets.",
      "If asset rights, availability, network, or operator constraints block a requested real visual source, disclose the blocker explicitly and keep the source requirement visible.",
    ],
  };
}

export function deriveAtlasImplementationFlexibility(input: AtlasIntentSignalInput): string {
  if (hasExplicitImplementationLatitude(input) || hasBestPossibleQualitySignal(input)) {
    return "Operator explicitly allows best-fit stack and framework choices, and prefers the strongest implementation that satisfies the clarified mission over preserving a specific stack.";
  }

  return "Best-fit implementation is allowed, and broad briefs should be resolved toward the strongest plausible product direction instead of a generic starter; the ATLAS session summary, execution notes, and confirmed assets remain authoritative guardrails.";
}