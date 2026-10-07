import type { Queryable } from "./pool.js";

export interface AsiaSourceIngestRow {
  slug: string;
  name: string;
  item_count: number;
  items_new_7d: number;
  last_successful_run: Date | null;
  last_run_status: string | null;
  last_run_discovered: number | null;
  last_run_new: number | null;
  last_run_failed: number | null;
  last_error_summary: string | null;
}

export interface AsiaIngestAdminSummary {
  enabled_sources: number;
  per_source: AsiaSourceIngestRow[];
  zero_discover_slugs: string[];
  failed_latest: Array<{ slug: string; name: string; status: string; error_summary: string | null }>;
}

export async function asiaIngestAdminSummary(db: Queryable): Promise<AsiaIngestAdminSummary> {
  const rows = await db.query<{
    slug: string;
    name: string;
    item_count: number;
    items_new_7d: string;
    last_successful_run: Date | null;
    last_run_status: string | null;
    last_run_discovered: number | null;
    last_run_new: number | null;
    last_run_failed: number | null;
    last_error_summary: string | null;
  }>(
    `WITH latest_run AS (
       SELECT DISTINCT ON (ir.source_id)
         ir.source_id,
         ir.status,
         ir.items_discovered,
         ir.items_new,
         ir.items_failed,
         ir.error_summary
       FROM ingestion_runs ir
       ORDER BY ir.source_id, ir.started_at DESC
     )
     SELECT s.slug,
            s.name,
            s.item_count,
            (
              SELECT count(*)::text
              FROM source_items si
              WHERE si.source_id = s.id
                AND si.created_at > now() - interval '7 days'
            ) AS items_new_7d,
            s.last_successful_run,
            lr.status AS last_run_status,
            lr.items_discovered AS last_run_discovered,
            lr.items_new AS last_run_new,
            lr.items_failed AS last_run_failed,
            lr.error_summary AS last_error_summary
     FROM sources s
     LEFT JOIN latest_run lr ON lr.source_id = s.id
     WHERE s.category = 'asia-innovation'
       AND s.enabled = true
     ORDER BY (SELECT count(*) FROM source_items si WHERE si.source_id = s.id AND si.created_at > now() - interval '7 days') DESC,
              s.slug ASC`,
  );

  const per_source: AsiaSourceIngestRow[] = rows.rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    item_count: row.item_count,
    items_new_7d: Number(row.items_new_7d ?? 0),
    last_successful_run: row.last_successful_run,
    last_run_status: row.last_run_status,
    last_run_discovered: row.last_run_discovered,
    last_run_new: row.last_run_new,
    last_run_failed: row.last_run_failed,
    last_error_summary: row.last_error_summary,
  }));

  const zero_discover_slugs = per_source
    .filter((row) => row.last_run_status != null && row.last_run_discovered === 0)
    .map((row) => row.slug);

  const failed_latest = per_source
    .filter((row) => row.last_run_status === "FAILED")
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      status: row.last_run_status ?? "FAILED",
      error_summary: row.last_error_summary,
    }));

  return {
    enabled_sources: per_source.length,
    per_source,
    zero_discover_slugs,
    failed_latest,
  };
}
