import type { Queryable } from "./pool.js";

export interface SourcePreviewReportRow {
  source_slug: string;
  sample_limit: number;
  dry_run: boolean;
  report: Record<string, unknown>;
  created_at: Date;
}

export async function saveSourcePreviewReport(
  db: Queryable,
  input: { sourceSlug: string; sampleLimit: number; dryRun: boolean; report: Record<string, unknown> },
): Promise<void> {
  await db.query(
    `INSERT INTO source_preview_reports (source_slug, sample_limit, dry_run, report)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [input.sourceSlug, input.sampleLimit, input.dryRun, JSON.stringify(input.report)],
  );
}

export async function latestSourcePreviewReports(
  db: Queryable,
  limit = 8,
): Promise<SourcePreviewReportRow[]> {
  const rows = await db.query<SourcePreviewReportRow>(
    `SELECT source_slug, sample_limit, dry_run, report, created_at
     FROM source_preview_reports
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.rows;
}
