/** Default cap for a source's first successful ingest when no explicit --limit is passed. */
export function firstSourceIngestItemLimit(): number {
  const parsed = Number(process.env.INGEST_FIRST_RUN_ITEM_LIMIT ?? "80");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

export function resolveIngestItemLimit(input: {
  cliLimit: number | null;
  lastSuccessfulRun: Date | null;
}): number | null {
  if (input.cliLimit !== null) return input.cliLimit;
  if (input.lastSuccessfulRun === null) return firstSourceIngestItemLimit();
  return null;
}
