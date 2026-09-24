export const RESOURCE_TYPES = [
  "SOLUTION",
  "TECHNOLOGY",
  "PROJECT",
  "PERSON",
  "ORGANISATION",
  "CASE_STUDY",
  "METHOD",
  "RESEARCH",
  "TOOL",
  "PROGRAMME",
] as const;

export const EVIDENCE_STAGES = [
  "UNKNOWN",
  "IDEA",
  "PROTOTYPE",
  "PILOT",
  "DEPLOYED",
  "MULTIPLE_DEPLOYMENTS",
  "SCALED",
] as const;

export const EVIDENCE_BASES = [
  "UNKNOWN",
  "SELF_REPORTED",
  "EDITORIALLY_CURATED",
  "PROGRAMME_SELECTED",
  "FUNDER_SELECTED",
  "INDEPENDENT_ASSESSMENT",
  "ACADEMIC_OR_RESEARCH",
  "PRIMARY_DOCUMENTATION",
] as const;

export const REVIEW_STATUSES = ["AUTO_INGESTED", "REVIEWED", "ALICE_PICK", "ARCHIVED"] as const;

export const SOURCE_STATUSES = [
  "ACTIVE",
  "PARTIAL",
  "METADATA_ONLY",
  "MANUAL",
  "BLOCKED",
  "BROKEN",
  "PAUSED",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type EvidenceStage = (typeof EVIDENCE_STAGES)[number];
export type EvidenceBasis = (typeof EVIDENCE_BASES)[number];

export interface NormalisedDraft {
  resourceType: ResourceType;
  title: string;
  sourceSummary: string;
  extractedText: string;
  externalId: string;
  canonicalUrl: string;
  originalUrl: string;
  language: string;
  imageUrl: string | null;
  publishedAt: string | null;
  organisationName: string | null;
  personName: string | null;
  countryName: string | null;
  countryCode: string | null;
  tags: string[];
  evidenceStage: EvidenceStage;
  evidenceBasis: EvidenceBasis;
  maturityStage: string;
  costLevel: string;
  commercialStatus: string;
  rawMetadata: Record<string, unknown>;
  etag: string | null;
  lastModified: string | null;
}

export function asEvidenceStage(value: string | undefined): EvidenceStage {
  const upper = (value ?? "UNKNOWN").toUpperCase();
  return (EVIDENCE_STAGES as readonly string[]).includes(upper) ? (upper as EvidenceStage) : "UNKNOWN";
}

export function asEvidenceBasis(value: string | undefined): EvidenceBasis {
  const upper = (value ?? "UNKNOWN").toUpperCase();
  return (EVIDENCE_BASES as readonly string[]).includes(upper) ? (upper as EvidenceBasis) : "UNKNOWN";
}

export function asResourceType(value: string | undefined, fallback: ResourceType = "SOLUTION"): ResourceType {
  const upper = (value ?? fallback).toUpperCase();
  return (RESOURCE_TYPES as readonly string[]).includes(upper) ? (upper as ResourceType) : fallback;
}
