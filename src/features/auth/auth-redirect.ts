const FALLBACK_REDIRECT = "/";

export function getSafeAuthRedirect(
  value: string | null | undefined,
  fallback = FALLBACK_REDIRECT,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, "http://auth.local");
    const normalizedPath = url.pathname.toLowerCase();

    if (
      url.origin !== "http://auth.local" ||
      normalizedPath === "/login" ||
      normalizedPath.startsWith("/auth/")
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
