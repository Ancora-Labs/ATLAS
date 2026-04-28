/**
 * ui_contract/contract.ts — Deterministic parser/normalizer for design contracts.
 *
 * Only structural validation lives here. Field semantics (which fields matter
 * for a given repo, what counts as a forbidden pattern) are decided upstream
 * by AI-driven intent normalization and passed in as data.
 */

import type { UiDesignContract } from "./types.js";

export class UiContractParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UiContractParseError";
  }
}

/**
 * Parse and normalize a raw design-contract object into a `UiDesignContract`.
 * Throws `UiContractParseError` on structural problems.
 *
 * Normalization rules:
 *   - All array fields are deduped and frozen-by-copy (defensive).
 *   - `requiredFields` entries that do not exist in `fields` are rejected.
 *   - Every `requiredFields` entry must map to a non-empty value in `fields`.
 */
export function parseUiDesignContract(raw: unknown): UiDesignContract {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UiContractParseError("contract must be a non-array object");
  }
  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    throw new UiContractParseError(`unsupported schemaVersion: ${String(obj.schemaVersion)}`);
  }

  const contractId = requireNonEmptyString(obj.contractId, "contractId");
  const accessibilityFloor = typeof obj.accessibilityFloor === "string"
    ? obj.accessibilityFloor
    : "";

  const targetSurfaces = uniqueStringArray(obj.targetSurfaces, "targetSurfaces");
  if (targetSurfaces.length === 0) {
    throw new UiContractParseError("targetSurfaces must contain at least one surface");
  }

  const fields = requireFieldsObject(obj.fields);
  const requiredFields = uniqueStringArray(obj.requiredFields, "requiredFields");
  for (const key of requiredFields) {
    if (!(key in fields)) {
      throw new UiContractParseError(`requiredFields entry missing from fields: ${key}`);
    }
    if (isEmptyValue(fields[key])) {
      throw new UiContractParseError(`requiredFields entry has empty value: ${key}`);
    }
  }

  const forbiddenPatterns = uniqueStringArray(obj.forbiddenPatterns, "forbiddenPatterns");

  return {
    contractId,
    schemaVersion: 1,
    targetSurfaces,
    fields,
    requiredFields,
    forbiddenPatterns,
    accessibilityFloor,
  };
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new UiContractParseError(`${field} must be a non-empty string`);
  }
  return value;
}

function uniqueStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new UiContractParseError(`${field} must be an array`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new UiContractParseError(`${field} entries must be non-empty strings`);
    }
    if (!seen.has(entry)) {
      seen.add(entry);
      out.push(entry);
    }
  }
  return out;
}

function requireFieldsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UiContractParseError("fields must be a non-array object");
  }
  return { ...(value as Record<string, unknown>) };
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}
