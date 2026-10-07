/** Default cap for a source's first successful ingest when no explicit --limit is passed. */
export function firstSourceIngestItemLimit(): number {
  const parsed = Number(process.env.INGEST_FIRST_RUN_ITEM_LIMIT ?? "500");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

export function resolveIngestItemLimit(input: {
  cliLimit: number | null;
  lastSuccessfulRun: Date | null;
  perSourceFirstRunLimit?: number | null;
}): number | null {
  if (input.cliLimit !== null) return input.cliLimit;
  if (input.lastSuccessfulRun === null) {
    const perSource = input.perSourceFirstRunLimit;
    if (perSource != null && Number.isFinite(perSource) && perSource > 0) return perSource;
    return firstSourceIngestItemLimit();
  }
  return null;
}
