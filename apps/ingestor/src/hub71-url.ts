/** Normalize Hub71 listing JSON website fields (null, relative, or malformed ": https://..."). */
export function resolveHub71PublicUrl(website: string | null | undefined, detailUrl: string): string {
  const raw = (website ?? "").trim();
  if (!raw || raw === "-" || raw === "N/A" || raw === "#" || raw === "/") return detailUrl;
  let candidate = raw.replace(/^:\s*/, "");
  if (!/^https?:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate, "https://www.hub71.com").toString();
    } catch {
      return detailUrl;
    }
  }
  try {
    return new URL(candidate).toString();
  } catch {
    return detailUrl;
  }
}
