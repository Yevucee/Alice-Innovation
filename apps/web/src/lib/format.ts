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

export function formatEvidence(stage: string): string {
  return stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatEvidenceBasis(basis: string): string {
  return EVIDENCE_BASIS_LABELS[basis] ?? formatEvidence(basis);
}

export function formatResourceType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function metaLine(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}
