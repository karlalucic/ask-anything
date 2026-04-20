const FALLBACK_REDIRECT = "/";

export function getSafeRedirectPath(value: string | null | undefined): string {
  if (!value) return FALLBACK_REDIRECT;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return FALLBACK_REDIRECT;
  }

  try {
    const url = new URL(decoded, "https://example.local");
    if (url.origin !== "https://example.local") return FALLBACK_REDIRECT;
    if (url.pathname === "/login" || url.pathname.startsWith("/api/auth/")) {
      return FALLBACK_REDIRECT;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return FALLBACK_REDIRECT;
  }
}
