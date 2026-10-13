import { SOUTH_AMERICA_ADAPTER_IDS } from "./adapters/south-america-quality.js";

const MIT_SOLVE_DROP_REASONS = new Set(["short_description", "truncated_title"]);

const SOUTH_AMERICA_DROP_REASONS = new Set([
  "short_description",
  "truncated_title",
  "blocklist_title",
  "empty_title",
  "listing_excerpt",
]);

/** Thrown when an item is intentionally not upserted (e.g. thin listing below quality gate). */
export class IngestQualityDropError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`quality_drop:${reasons.join(",")}`);
    this.name = "IngestQualityDropError";
    this.reasons = reasons;
  }
}

export function shouldDropIngestAtQualityGate(
  sourceId: string,
  needsReview: boolean,
  reasons: string[],
): boolean {
  if (sourceId === "ycombinator-oss-companies") return needsReview;
  if (sourceId === "mit-solve") return reasons.some((code) => MIT_SOLVE_DROP_REASONS.has(code));
  if (SOUTH_AMERICA_ADAPTER_IDS.has(sourceId)) {
    return reasons.some((code) => SOUTH_AMERICA_DROP_REASONS.has(code));
  }
  return false;
}
