const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
]);

/**
 * Canonical form used for exact-URL dedupe.
 * Lowercases the host, drops the fragment and tracking parameters,
 * sorts the remaining query, and strips a trailing slash.
 */
/** Returns null instead of throwing when the input is empty or not a valid absolute URL. */
export function tryCanonicaliseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return canonicaliseUrl(trimmed);
  } catch {
    return null;
  }
}

/** Public page URL for a catalogue item (canonical preferred, then original). */
export function resolveSourceItemPublicUrl(
  canonicalUrl?: string | null,
  originalUrl?: string | null,
): string | null {
  for (const raw of [canonicalUrl, originalUrl]) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const cleaned = trimmed.replace(/^:\s*/, "").trim();
    const canon = tryCanonicaliseUrl(cleaned);
    if (canon) return canon;
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
  }
  return null;
}

export function canonicaliseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Cannot canonicalise an empty URL");
  }
  const url = new URL(trimmed);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  url.search = "";
  for (const [key, value] of kept) {
    url.searchParams.append(key, value);
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}
