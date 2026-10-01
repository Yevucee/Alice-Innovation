import { inferTaxonomyFromText } from "@alice/taxonomy";
import { normaliseName } from "@alice/shared";
import type { Queryable } from "./pool.js";
import { organisationSlug } from "./seed.js";

const LEGAL_FORM_ORG = /for-profit|non-profit|not registered as any organization|not registered as any organisation|b-corp|legal form|not applicable|hybrid of for-profit/i;

export function isLegalFormOrganisationName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return LEGAL_FORM_ORG.test(name);
}

export function isJunkPersonName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = name.trim();
  if (n.length < 3) return true;
  if (/^[a-z](\s+[a-z]){0,2}$/i.test(n)) return true;
  return false;
}

export function normaliseOrganisationNameKey(name: string): string {
  return normaliseName(name);
}

export async function loadResourceIdsNeedingReembed(db: Queryable, limit = 20_000): Promise<string[]> {
  const rows = await db.query<{ id: string }>(
    `SELECT r.id::text
     FROM resources r
     WHERE r.active
       AND r.embedding IS NOT NULL
       AND r.embedding_content_hash IS NULL
     ORDER BY r.enrichment_attempted_at DESC NULLS LAST, r.updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.rows.map((row) => row.id);
}

export async function invalidateStaleEnrichmentEmbeddings(db: Queryable): Promise<number> {
  const result = await db.query(
    `UPDATE resources SET embedding_content_hash = NULL, updated_at = now()
     WHERE active AND enrichment_outcome = 'applied' AND embedding IS NOT NULL
       AND embedding_content_hash IS NOT NULL`,
  );
  return result.rowCount ?? 0;
}

export async function correctMisassignedWaterSectorTags(db: Queryable): Promise<number> {
  const rows = await db.query<{ id: string; title: string; summary: string; text: string }>(
    `SELECT r.id::text, r.canonical_title AS title, r.source_summary AS summary, r.extracted_index_text AS text
     FROM resource_sectors rs
     JOIN sectors s ON s.id = rs.sector_id
     JOIN resources r ON r.id = rs.resource_id
     WHERE s.slug = 'water' AND rs.origin = 'INTERPRETATION' AND r.active`,
  );
  let removed = 0;
  for (const row of rows.rows) {
    const inferred = inferTaxonomyFromText({ title: row.title, summary: row.summary, text: row.text });
    if (inferred.sectors.includes("water")) continue;
    const del = await db.query(
      `DELETE FROM resource_sectors rs
       USING sectors s
       WHERE rs.sector_id = s.id AND s.slug = 'water'
         AND rs.resource_id = $1::uuid AND rs.origin = 'INTERPRETATION'`,
      [row.id],
    );
    removed += del.rowCount ?? 0;
    if ((del.rowCount ?? 0) > 0) {
      await db.query(
        `UPDATE resources SET embedding_content_hash = NULL, updated_at = now() WHERE id = $1::uuid`,
        [row.id],
      );
    }
  }
  return removed;
}

export async function mergeDuplicateOrganisations(db: Queryable): Promise<{ groups: number; removed: number }> {
  const groups = await db.query<{ norm: string; ids: string[] }>(
    `SELECT lower(trim(name)) AS norm, array_agg(id::text ORDER BY created_at, id) AS ids
     FROM organisations
     GROUP BY lower(trim(name))
     HAVING count(*) > 1`,
  );
  let removed = 0;
  for (const group of groups.rows) {
    const [canonical, ...duplicates] = group.ids;
    if (!canonical || duplicates.length === 0) continue;
    for (const duplicateId of duplicates) {
      await db.query(
        `UPDATE resource_organisations SET organisation_id = $1::uuid
         WHERE organisation_id = $2::uuid
           AND NOT EXISTS (
             SELECT 1 FROM resource_organisations existing
             WHERE existing.resource_id = resource_organisations.resource_id
               AND existing.organisation_id = $1::uuid
               AND existing.relationship = resource_organisations.relationship
           )`,
        [canonical, duplicateId],
      );
      await db.query(`DELETE FROM resource_organisations WHERE organisation_id = $2::uuid`, [canonical, duplicateId]);
      await db.query(
        `UPDATE people SET organisation_id = $1::uuid WHERE organisation_id = $2::uuid`,
        [canonical, duplicateId],
      );
      const del = await db.query(`DELETE FROM organisations WHERE id = $1::uuid`, [duplicateId]);
      removed += del.rowCount ?? 0;
    }
  }
  return { groups: groups.rows.length, removed };
}

export async function repairLegalFormOrganisationLinks(db: Queryable): Promise<{ orgs_removed: number; people_cleared: number }> {
  const junkOrgs = await db.query<{ id: string }>(
    `SELECT id::text FROM organisations
     WHERE name ~* 'for-profit|not registered as any organization|not registered as any organisation|b-corp|legal form|not applicable|hybrid of for-profit'`,
  );
  let people_cleared = 0;
  for (const org of junkOrgs.rows) {
    const cleared = await db.query(
      `UPDATE people SET organisation_id = NULL, updated_at = now() WHERE organisation_id = $1::uuid`,
      [org.id],
    );
    people_cleared += cleared.rowCount ?? 0;
    await db.query(`DELETE FROM resource_organisations WHERE organisation_id = $1::uuid`, [org.id]);
    await db.query(`DELETE FROM organisations WHERE id = $1::uuid`, [org.id]);
  }
  return { orgs_removed: junkOrgs.rows.length, people_cleared };
}

export async function resolveOrganisationId(
  db: Queryable,
  name: string,
  country: string | null,
): Promise<string> {
  const trimmed = name.trim();
  const slug = organisationSlug(trimmed);
  const existing = await db.query<{ id: string }>(
    `SELECT id::text FROM organisations
     WHERE slug = $1 OR lower(trim(name)) = lower(trim($2))
     ORDER BY created_at ASC
     LIMIT 1`,
    [slug, trimmed],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const row = await db.query<{ id: string }>(
    `INSERT INTO organisations (name, slug, country)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET country = COALESCE(organisations.country, EXCLUDED.country), updated_at = now()
     RETURNING id::text`,
    [trimmed, slug, country],
  );
  return row.rows[0].id;
}
