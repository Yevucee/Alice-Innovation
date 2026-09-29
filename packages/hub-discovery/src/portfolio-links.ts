import type { Queryable } from "@alice/database";

export async function linkPortfolioResourcesToHub(
  db: Queryable,
  sourceSlug: string,
  organisationId: string,
  relationship: string,
): Promise<number> {
  const result = await db.query(
    `INSERT INTO resource_organisations (resource_id, organisation_id, relationship, is_primary)
     SELECT DISTINCT l.resource_id, $2::uuid, $3, false
     FROM resource_source_links l
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE s.slug = $1
     ON CONFLICT (resource_id, organisation_id, relationship) DO NOTHING`,
    [sourceSlug, organisationId, relationship],
  );
  return result.rowCount ?? 0;
}
