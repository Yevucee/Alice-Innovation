const ACRONYM = /^(USA|UK|EU|AI|NGO|MIT|CEO|CTO|COO|GDP|USD|EUR|GBP|API|SaaS|IoT|GPS|SMS|HIV|AIDS|COVID|UN|WHO|WTO|IMF|GDP|ID|QR|VR|AR|3D|4G|5G|II|III|IV|VI|VII|VIII|IX|XI|XII)$/i;

/** Convert shouty catalogue titles to title case while preserving known acronyms. */
export function normaliseAllCapsTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length < 4) return trimmed;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) return trimmed;
  const upperRatio = letters.replace(/[^A-Z]/g, "").length / letters.length;
  if (upperRatio < 0.75) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      const bare = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (!bare) return word;
      if (ACRONYM.test(bare)) return word.replace(bare, bare.toUpperCase());
      const lower = bare.toLowerCase();
      const SMALL = new Set(["a", "an", "the", "and", "or", "for", "in", "on", "at", "to", "of", "by"]);
      if (index > 0 && SMALL.has(lower)) {
        return word.replace(bare, lower);
      }
      const cased = lower.charAt(0).toUpperCase() + lower.slice(1);
      return word.replace(bare, cased);
    })
    .join(" ");
}
