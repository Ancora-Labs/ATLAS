/**
 * Shared utilities for reviewer providers.
 * Keep this module pure — no side effects, no imports from provider files.
 */

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function tryExtractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
