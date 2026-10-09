import type { Queryable } from "./pool.js";

export type MitSolveBackfillAdminSummary = {
  catalogue_size: number | null;
  ingested_total: number;
  pending_estimate: number | null;
  last_run_new: number | null;
  last_run_at: string | null;
  avg_new_per_night: number | null;
  estimated_nights_remaining: number | null;
  note: string | null;
};

export async function mitSolveBackfillAdminSummary(db: Queryable): Promise<MitSolveBackfillAdminSummary | null> {
  const sourceRow = await db.query<{ id: string; item_count: number }>(
    `SELECT id::text, item_count FROM sources WHERE slug = 'mit-solve'`,
  );
  const sourceId = sourceRow.rows[0]?.id;
  if (!sourceId) return null;

  const ingested = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM source_items WHERE source_id = $1::uuid AND active`,
    [sourceId],
  );
  const ingestedTotal = ingested.rows[0]?.n ?? 0;

  const discoverRow = await db.query<{
    items_discovered: number | null;
    pipeline_stats: { dropped_existing?: number } | null;
    started_at: Date;
  }>(
    `SELECT ir.items_discovered, ir.pipeline_stats, ir.started_at
     FROM ingestion_runs ir
     WHERE ir.source_id = $1::uuid
       AND ir.status IN ('SUCCESS', 'PARTIAL_SUCCESS')
       AND ir.items_discovered IS NOT NULL
     ORDER BY ir.started_at DESC
     LIMIT 1`,
    [sourceId],
  );

  const catalogueSize = discoverRow.rows[0]?.items_discovered ?? null;
  const pendingEstimate = catalogueSize != null ? Math.max(0, catalogueSize - ingestedTotal) : null;

  const lastRun = await db.query<{ items_new: number | null; started_at: Date }>(
    `SELECT items_new, started_at
     FROM ingestion_runs
     WHERE source_id = $1::uuid AND status IN ('SUCCESS', 'PARTIAL_SUCCESS')
     ORDER BY started_at DESC
     LIMIT 1`,
    [sourceId],
  );

  const recentNew = await db.query<{ items_new: number | null }>(
    `SELECT items_new
     FROM ingestion_runs
     WHERE source_id = $1::uuid
       AND status IN ('SUCCESS', 'PARTIAL_SUCCESS')
       AND started_at > now() - interval '14 days'
       AND coalesce(items_new, 0) > 0
     ORDER BY started_at DESC
     LIMIT 7`,
    [sourceId],
  );

  const newValues = recentNew.rows.map((r) => Number(r.items_new ?? 0)).filter((n) => n > 0);
  const avgNew = newValues.length > 0
    ? Math.round(newValues.reduce((a, b) => a + b, 0) / newValues.length)
    : null;

  const pace = avgNew ?? (lastRun.rows[0]?.items_new != null ? Number(lastRun.rows[0].items_new) : null);
  const estimatedNights = pendingEstimate != null && pace != null && pace > 0
    ? Math.ceil(pendingEstimate / Math.min(1000, pace))
    : null;

  let note: string | null = null;
  if (catalogueSize == null) {
    note = "No successful ingest run with discover count yet; pending unknown until first DAILY run.";
  } else if (pendingEstimate === 0) {
    note = "Pending ~0 — consider reverting mit-solve update_class to WEEKLY.";
  }

  return {
    catalogue_size: catalogueSize,
    ingested_total: ingestedTotal,
    pending_estimate: pendingEstimate,
    last_run_new: lastRun.rows[0]?.items_new ?? null,
    last_run_at: lastRun.rows[0]?.started_at?.toISOString() ?? null,
    avg_new_per_night: avgNew,
    estimated_nights_remaining: estimatedNights,
    note,
  };
}

export type SourceCatalogueIngestAdminRow = {
  slug: string;
  item_count: number;
  last_discovered: number | null;
  last_new: number | null;
  last_run_at: string | null;
  gap_estimate: number | null;
};

export async function sourceCatalogueIngestAdminRows(
  db: Queryable,
  slugs: string[],
): Promise<SourceCatalogueIngestAdminRow[]> {
  const rows = await db.query<{
    slug: string;
    item_count: number;
    items_discovered: number | null;
    items_new: number | null;
    started_at: Date | null;
  }>(
    `SELECT s.slug, s.item_count,
            ir.items_discovered, ir.items_new, ir.started_at
     FROM sources s
     LEFT JOIN LATERAL (
       SELECT items_discovered, items_new, started_at
       FROM ingestion_runs
       WHERE source_id = s.id AND status IN ('SUCCESS', 'PARTIAL_SUCCESS')
       ORDER BY started_at DESC LIMIT 1
     ) ir ON true
     WHERE s.slug = ANY($1::text[])
     ORDER BY s.slug`,
    [slugs],
  );
  return rows.rows.map((row) => {
    const gap = row.items_discovered != null ? Math.max(0, row.items_discovered - row.item_count) : null;
    return {
      slug: row.slug,
      item_count: row.item_count,
      last_discovered: row.items_discovered,
      last_new: row.items_new,
      last_run_at: row.started_at?.toISOString() ?? null,
      gap_estimate: gap,
    };
  });
}
