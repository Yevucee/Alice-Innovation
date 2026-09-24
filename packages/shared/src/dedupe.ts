import { canonicaliseUrl } from "./url.js";
import { normaliseName } from "./text.js";

export interface DedupeCandidate {
  canonicalUrl: string;
  externalId?: string | null;
  title: string;
  organisationName?: string | null;
  countryCode?: string | null;
}

export interface DedupeExisting {
  resourceId: string;
  canonicalUrl: string;
  nearKey: string;
}

export type DedupeDecision =
  | { action: "link"; resourceId: string; reason: "exact_url" }
  | { action: "possible_duplicate"; resourceId: string; reason: "near_title" }
  | { action: "create" };

export function nearDuplicateKey(candidate: Pick<DedupeCandidate, "title" | "organisationName" | "countryCode">): string {
  const title = normaliseName(candidate.title);
  const org = normaliseName(candidate.organisationName ?? "");
  const country = (candidate.countryCode ?? "").trim().toUpperCase();
  return [title, org, country].join("|");
}

/**
 * Exact canonical URL links automatically.
 * The same normalised title, organisation, and country with a different URL
 * is only a review candidate. Semantic similarity is recorded separately.
 */
export function classifyDuplicate(candidate: DedupeCandidate, existing: DedupeExisting[]): DedupeDecision {
  const url = canonicaliseUrl(candidate.canonicalUrl);
  const exact = existing.find((row) => row.canonicalUrl === url);
  if (exact) {
    return { action: "link", resourceId: exact.resourceId, reason: "exact_url" };
  }
  const near = nearDuplicateKey(candidate);
  const titlePart = near.split("|")[0] ?? "";
  if (titlePart.length >= 8) {
    const similar = existing.find((row) => row.nearKey === near && row.canonicalUrl !== url);
    if (similar) {
      return { action: "possible_duplicate", resourceId: similar.resourceId, reason: "near_title" };
    }
  }
  return { action: "create" };
}
