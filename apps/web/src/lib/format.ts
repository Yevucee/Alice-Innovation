const EVIDENCE_BASIS_LABELS: Record<string, string> = {
  SELF_REPORTED: "Self-reported",
  EDITORIALLY_CURATED: "Editorially curated",
  PROGRAMME_SELECTED: "Programme selected",
  FUNDER_SELECTED: "Funder selected",
  INDEPENDENT_ASSESSMENT: "Independent assessment",
  ACADEMIC_OR_RESEARCH: "Research-backed",
  PRIMARY_DOCUMENTATION: "Primary documentation",
  UNKNOWN: "Unknown",
};

export function formatEvidence(stage: string): string | null {
  if (!stage || stage === "UNKNOWN") return null;
  return stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatEvidenceBasis(basis: string): string | null {
  if (!basis || basis === "UNKNOWN") return null;
  return EVIDENCE_BASIS_LABELS[basis] ?? formatEvidence(basis);
}

export function formatResourceType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDisplayTitle(title: string): string {
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 4) {
    const upperRatio = letters.replace(/[^A-Z]/g, "").length / letters.length;
    if (upperRatio > 0.75) {
      return title.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    }
  }
  return title;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function metaLine(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}

export function normaliseComparableText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** True when excerpt repeats the summary (exact or shared long prefix). */
export function sourceExcerptDuplicatesSummary(summary: string, excerpt: string): boolean {
  const a = normaliseComparableText(summary);
  const b = normaliseComparableText(excerpt);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 40 && b.startsWith(a)) return true;
  if (b.length >= 40 && a.startsWith(b)) return true;
  const prefixLen = Math.min(120, a.length, b.length);
  if (prefixLen >= 80 && a.slice(0, prefixLen) === b.slice(0, prefixLen)) return true;
  if (a.length >= 80 && b.startsWith(a.slice(0, 80))) return true;
  if (b.length >= 80 && a.startsWith(b.slice(0, 80))) return true;
  return false;
}
