import path from "node:path";

export const POSTMORTEM_LIFECYCLE_STATE = Object.freeze({
  CONTINUING: "continuing",
  CLOSED: "closed",
  UNVERIFIED_COMPLETION_CLAIM: "unverified_completion_claim",
} as const);

export type PostmortemLifecycleEvidenceEnvelope = {
  schemaVersion: 1;
  source: "athena_postmortem";
  task: string;
  taskIdentity: string;
  continuationFamilyKey: string;
  lifecycleState: typeof POSTMORTEM_LIFECYCLE_STATE[keyof typeof POSTMORTEM_LIFECYCLE_STATE];
  advisoryOnly: boolean;
  verified: boolean;
  implementationEvidence: string[];
  verification: {
    verificationPassed: boolean | null;
    doneWorkerWithVerificationReportEvidence: boolean;
    doneWorkerWithCleanTreeStatusEvidence: boolean;
    replayClosureSatisfied: boolean;
    closureBoundaryViolation: boolean;
  };
  emittedAt: string;
};

const PLAN_FAMILY_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "when", "then", "than", "while",
  "under", "over", "onto", "after", "before", "across", "only", "does", "not", "are",
  "is", "was", "were", "have", "has", "had", "will", "would", "should", "could", "must", "can",
  "your", "their", "them", "they", "each", "same", "keep", "more", "less", "very",
  "plan", "task", "worker", "route", "routing",
]);

export function normalizePlanIdentity(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlanFamilySegment(value: unknown): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && !PLAN_FAMILY_STOP_WORDS.has(part));
}

function extractPlanFamilyFileTokens(targetFiles: unknown): string[] {
  if (!Array.isArray(targetFiles)) return [];
  const tokens: string[] = [];
  for (const file of targetFiles) {
    const base = path.basename(String(file || "")).replace(/\.[^.]+$/, "");
    tokens.push(...normalizePlanFamilySegment(base));
  }
  return Array.from(new Set(tokens)).sort().slice(0, 4);
}

export function derivePlanContinuationFamilyKey(source: any): string {
  const explicitKey = String(
    source?.continuationFamilyKey
      || source?.familyKey
      || source?._familyKey
      || "",
  ).trim();
  if (explicitKey) return explicitKey.toLowerCase();

  const textTokens = Array.from(new Set([
    ...normalizePlanFamilySegment(source?.scope),
    ...normalizePlanFamilySegment(source?.title),
    ...normalizePlanFamilySegment(source?.task),
    ...normalizePlanFamilySegment(source?.task_id),
  ])).slice(0, 6);
  const fileTokens = extractPlanFamilyFileTokens(source?.targetFiles ?? source?.target_files);
  return [...fileTokens, ...textTokens].slice(0, 8).join(":");
}

export function extractImplementationEvidencePaths(evidence: unknown): string[] {
  const values = Array.isArray(evidence)
    ? evidence
    : typeof evidence === "string"
      ? [evidence]
      : [];
  return values
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/(?:src|tests|scripts|docs)\/[A-Za-z0-9_./-]+/);
      return match ? match[0].replace(/[),.;:]+$/, "") : "";
    })
    .filter(Boolean);
}