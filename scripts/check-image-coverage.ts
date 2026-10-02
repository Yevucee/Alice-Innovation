import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

async function coverageSnapshot() {
  const pool = getPool();
  const totals = await pool.query<{ total: number; with_image: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE image_url IS NOT NULL AND btrim(image_url) <> '' AND left(btrim(image_url), 5) <> 'data:')::int AS with_image
     FROM source_items
     WHERE active = true`,
  );
  const resources = await pool.query<{ total: number; with_image: number }>(
    `SELECT count(DISTINCT r.id)::int AS total,
            count(DISTINCT r.id) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM resource_source_links l
                JOIN source_items si ON si.id = l.source_item_id
                WHERE l.resource_id = r.id
                  AND si.image_url IS NOT NULL
                  AND btrim(si.image_url) <> ''
                  AND left(btrim(si.image_url), 5) <> 'data:'
              )
            )::int AS with_image
     FROM resources r
     WHERE r.active`,
  );
  return { items: totals.rows[0], resources: resources.rows[0] };
}

async function main(): Promise<void> {
  const pool = getPool();
  const snapshot = await coverageSnapshot();
  const itemPct = snapshot.items.total > 0
    ? Math.round((snapshot.items.with_image / snapshot.items.total) * 100)
    : 0;
  const resourcePct = snapshot.resources.total > 0
    ? Math.round((snapshot.resources.with_image / snapshot.resources.total) * 100)
    : 0;
  log("info", "image_coverage", {
    source_items_total: snapshot.items.total,
    source_items_with_image: snapshot.items.with_image,
    source_items_percent: itemPct,
    resources_total: snapshot.resources.total,
    resources_with_image: snapshot.resources.with_image,
    resources_percent: resourcePct,
  });

  const bySource = await pool.query<{ slug: string; total: number; with_image: number }>(
    `SELECT s.slug,
            count(*)::int AS total,
            count(*) FILTER (
              WHERE si.image_url IS NOT NULL AND btrim(si.image_url) <> '' AND left(btrim(si.image_url), 5) <> 'data:'
            )::int AS with_image
     FROM source_items si
     JOIN sources s ON s.id = si.source_id
     WHERE si.active = true
     GROUP BY s.slug
     ORDER BY s.slug`,
  );
  for (const source of bySource.rows) {
    log("info", "image_coverage_by_source", source);
  }
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "image_coverage_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
