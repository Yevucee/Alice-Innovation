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
