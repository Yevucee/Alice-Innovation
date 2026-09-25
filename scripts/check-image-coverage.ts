import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

async function main(): Promise<void> {
  const pool = getPool();
  const totals = await pool.query<{ total: number; with_image: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE image_url IS NOT NULL AND btrim(image_url) <> '')::int AS with_image
     FROM source_items`,
  );
  const bySource = await pool.query<{ slug: string; total: number; with_image: number }>(
    `SELECT s.slug,
            count(*)::int AS total,
            count(*) FILTER (WHERE si.image_url IS NOT NULL AND btrim(si.image_url) <> '')::int AS with_image
     FROM source_items si
     JOIN sources s ON s.id = si.source_id
     GROUP BY s.slug
     ORDER BY s.slug`,
  );
  const row = totals.rows[0];
  const pct = row.total > 0 ? Math.round((row.with_image / row.total) * 100) : 0;
  log("info", "image_coverage", { total: row.total, with_image: row.with_image, percent: pct });
  for (const source of bySource.rows) {
    log("info", "image_coverage_by_source", source);
  }
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "image_coverage_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
