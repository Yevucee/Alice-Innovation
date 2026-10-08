/** Thrown when an item is intentionally not upserted (e.g. thin YC listing below quality gate). */
export class IngestQualityDropError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`quality_drop:${reasons.join(",")}`);
    this.name = "IngestQualityDropError";
    this.reasons = reasons;
  }
}
