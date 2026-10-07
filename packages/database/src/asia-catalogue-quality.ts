import { cleanJStartupSummary } from "@alice/shared";
import type { Queryable } from "./pool.js";

const HKUST_SOURCE_SLUGS = ["hkust-entrepreneurship-center", "hkust-innovation"] as const;

export async function quarantineAsiaCatalogueJunkBatch(
  db: Queryable,
  limit: number,
): Promise<{ quarantined: number; resource_ids: string[] }> {
  const rows = await db.query<{ id: string }>(
    `SELECT DISTINCT r.id::text
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.review_status <> 'NEEDS_REVIEW'
       AND (
         s.slug = ANY($2::text[])
         OR lower(s.slug) LIKE '%payspot%'
         OR lower(si.canonical_url) LIKE '%payspot%'
         OR lower(r.source_summary) LIKE '%casino%'
           AND lower(si.canonical_url) LIKE '%author%'
       )
     LIMIT $1`,
    [limit, HKUST_SOURCE_SLUGS],
  );
  const ids = rows.rows.map((row) => row.id);
  if (ids.length === 0) return { quarantined: 0, resource_ids: [] };

  await db.query(
    `UPDATE resources
     SET review_status = 'NEEDS_REVIEW',
         review_reason_codes = (
           SELECT array_agg(DISTINCT code)
           FROM unnest(
             COALESCE(review_reason_codes, '{}'::text[])
             || ARRAY['catalogue_junk_quarantine', 'asia_html_catalogue']
           ) AS code
         ),
         updated_at = now()
     WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return { quarantined: ids.length, resource_ids: ids };
}

export async function cleanJStartupResourceSummariesBatch(
  db: Queryable,
  limit: number,
): Promise<{ cleaned: number; cleared_sensors_only: number }> {
  const rows = await db.query<{ id: string; source_summary: string }>(
    `SELECT DISTINCT ON (r.id) r.id::text, r.source_summary
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE s.slug IN ('j-startup', 'j-startup-impact')
       AND (
         r.source_summary ~* 'sample text'
         OR r.source_summary ~* 'corporate number'
         OR r.source_summary ~* 'startups list'
       )
     ORDER BY r.id
     LIMIT $1`,
    [limit],
  );

  let cleaned = 0;
  for (const row of rows.rows) {
    const next = cleanJStartupSummary(row.source_summary);
    if (!next || next === row.source_summary) continue;
    await db.query(
      `UPDATE resources SET source_summary = $2, updated_at = now() WHERE id = $1::uuid`,
      [row.id, next],
    );
    cleaned += 1;
  }

  const sensors = await db.query<{ resource_id: string }>(
    `SELECT r.id::text AS resource_id
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE s.slug IN ('j-startup', 'j-startup-impact')
       AND (
         SELECT count(*) FROM resource_sectors rs WHERE rs.resource_id = r.id
       ) = 1
       AND EXISTS (
         SELECT 1 FROM resource_sectors rs
         JOIN sectors sec ON sec.id = rs.sector_id
         WHERE rs.resource_id = r.id AND lower(sec.name) = 'sensors'
       )
     LIMIT $1`,
    [limit],
  );
  const sensorIds = sensors.rows.map((row) => row.resource_id);
  if (sensorIds.length > 0) {
    await db.query(
      `DELETE FROM resource_sectors rs
       USING sectors sec
       WHERE rs.sector_id = sec.id
         AND lower(sec.name) = 'sensors'
         AND rs.resource_id = ANY($1::uuid[])`,
      [sensorIds],
    );
  }

  return { cleaned, cleared_sensors_only: sensorIds.length };
}
