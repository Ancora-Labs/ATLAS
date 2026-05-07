export interface AtlasPopupDecision {
  action: "allow-same-origin" | "open-modal-auth" | "deny";
  reason: string;
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/g, "");
}

export function isContainedAuthUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    return pathname.includes("login")
      || pathname.includes("auth")
      || pathname.includes("oauth")
      || search.includes("redirect_uri=")
      || search.includes("client_id=");
  } catch {
    return false;
  }
}

export function decideAtlasPopupHandling(url: string, atlasOrigin: string): AtlasPopupDecision {
  try {
    const parsed = new URL(url);
    const normalizedAtlasOrigin = normalizeOrigin(atlasOrigin);
    if (normalizeOrigin(parsed.origin) === normalizedAtlasOrigin) {
      return {
        action: "allow-same-origin",
        reason: "same-origin",
      };
    }
  } catch {
    return {
      action: "deny",
      reason: "invalid-url",
    };
  }

  if (isContainedAuthUrl(url)) {
    return {
      action: "open-modal-auth",
      reason: "contained-auth",
    };
  }

  return {
    action: "deny",
    reason: "external-origin-blocked",
  };
}
