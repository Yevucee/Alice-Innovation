export function ingestSourceLoopMaxMinutes(): number {
  const parsed = Number(process.env.INGEST_SOURCE_LOOP_MAX_MINUTES ?? "60");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export function createIngestSourceLoopBudget(startedAtMs: number): {
  exhausted: () => boolean;
  remainingMs: () => number;
  maxMinutes: () => number;
} {
  const maxMs = ingestSourceLoopMaxMinutes() * 60_000;
  return {
    exhausted: () => Date.now() - startedAtMs >= maxMs,
    remainingMs: () => Math.max(0, maxMs - (Date.now() - startedAtMs)),
    maxMinutes: () => ingestSourceLoopMaxMinutes(),
  };
}
