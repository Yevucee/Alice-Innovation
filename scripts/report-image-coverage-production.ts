import { closePool, getPool } from "@alice/database";

const USABLE_IMAGE_SQL =
  "si2.image_url IS NOT NULL AND btrim(si2.image_url) <> '' AND si2.image_url NOT LIKE 'data:%'";

async function main(): Promise<void> {
  const pool = getPool();

  const noImage = await pool.query<{ slug: string; missing: number }>(
    `SELECT s.slug, count(DISTINCT r.id)::int AS missing
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id AND si.active
     JOIN sources s ON s.id = si.source_id
     WHERE r.active
       AND NOT EXISTS (
         SELECT 1 FROM resource_source_links l2
         JOIN source_items si2 ON si2.id = l2.source_item_id AND si2.active
         WHERE l2.resource_id = r.id AND ${USABLE_IMAGE_SQL}
       )
     GROUP BY s.slug
     ORDER BY missing DESC
     LIMIT 15`,
  );

  const total = await pool.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n
     FROM resources r
     WHERE r.active
       AND NOT EXISTS (
         SELECT 1 FROM resource_source_links l2
         JOIN source_items si2 ON si2.id = l2.source_item_id AND si2.active
         WHERE l2.resource_id = r.id AND ${USABLE_IMAGE_SQL}
       )`,
  );

  const usableSi = USABLE_IMAGE_SQL.replace(/si2/g, "si");
  const asiaSlugs = ["j-startup", "wavemaker-partners-portfolio"];
  const asia: Record<string, unknown> = {};
  for (const slug of asiaSlugs) {
    const rows = await pool.query<{
      total_items: number;
      with_image: number;
      created_oct7: number;
      oct7_with_image: number;
    }>(
      `SELECT count(*)::int AS total_items,
              count(*) FILTER (WHERE ${usableSi})::int AS with_image,
              count(*) FILTER (
                WHERE si.created_at >= '2026-10-07'::date AND si.created_at < '2026-10-08'::date
              )::int AS created_oct7,
              count(*) FILTER (
                WHERE si.created_at >= '2026-10-07'::date AND si.created_at < '2026-10-08'::date AND ${usableSi}
              )::int AS oct7_with_image,
              min(si.created_at) AS first_created,
              max(si.created_at) AS last_created
       FROM source_items si
       JOIN sources s ON s.id = si.source_id
       WHERE s.slug = $1 AND si.active`,
      [slug],
    );
    asia[slug] = rows.rows[0];
  }

  console.log(
    JSON.stringify(
      {
        total_active_resources_missing_image: total.rows[0]?.n ?? 0,
        top15_by_source: noImage.rows,
        asia_oct7: asia,
      },
      null,
      2,
    ),
  );
  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
