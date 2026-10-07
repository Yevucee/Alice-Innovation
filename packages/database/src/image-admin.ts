import type { Queryable } from "./pool.js";

/** Matches browse/search image usability checks. */
export const USABLE_SOURCE_ITEM_IMAGE_EXISTS_SQL = `
  EXISTS (
    SELECT 1 FROM resource_source_links l_img
    JOIN source_items si_img ON si_img.id = l_img.source_item_id AND si_img.active
    WHERE l_img.resource_id = r.id
      AND si_img.image_url IS NOT NULL
      AND btrim(si_img.image_url) <> ''
      AND si_img.image_url NOT LIKE 'data:%'
  )
`;

export interface ResourcesMissingImageAdminSummary {
  total_active_resources_missing_image: number;
  top_sources: Array<{ slug: string; name: string; missing: number }>;
}

export async function resourcesMissingImageAdminSummary(
  db: Queryable,
  limit = 15,
): Promise<ResourcesMissingImageAdminSummary> {
  const top = await db.query<{ slug: string; name: string; missing: number }>(
    `SELECT s.slug, s.name, count(DISTINCT r.id)::int AS missing
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id AND si.active
     JOIN sources s ON s.id = si.source_id
     WHERE r.active
       AND NOT (${USABLE_SOURCE_ITEM_IMAGE_EXISTS_SQL})
     GROUP BY s.slug, s.name
     ORDER BY missing DESC
     LIMIT $1`,
    [limit],
  );

  const total = await db.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n
     FROM resources r
     WHERE r.active
       AND NOT (${USABLE_SOURCE_ITEM_IMAGE_EXISTS_SQL})`,
  );

  return {
    total_active_resources_missing_image: total.rows[0]?.n ?? 0,
    top_sources: top.rows,
  };
}
