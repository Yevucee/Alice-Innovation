import { normaliseName } from "@alice/shared";
import type { FusedHit } from "@alice/shared";
import type { Queryable } from "./pool.js";

export async function dedupeFusedResourceHits(
  db: Queryable,
  hits: FusedHit[],
): Promise<FusedHit[]> {
  if (hits.length <= 1) return hits;
  const rows = await db.query<{ id: string; title: string; org: string | null }>(
    `SELECT r.id::text AS id,
            r.canonical_title AS title,
            (
              SELECT o.name FROM resource_organisations ro
              JOIN organisations o ON o.id = ro.organisation_id
              WHERE ro.resource_id = r.id
              ORDER BY ro.is_primary DESC, o.name
              LIMIT 1
            ) AS org
     FROM resources r
     WHERE r.id = ANY($1::uuid[])`,
    [hits.map((hit) => hit.id)],
  );
  const meta = new Map(rows.rows.map((row) => [row.id, row]));
  const seenIds = new Set<string>();
  const seenTitleOrg = new Set<string>();
  const kept: FusedHit[] = [];
  for (const hit of hits) {
    if (seenIds.has(hit.id)) continue;
    const row = meta.get(hit.id);
    if (!row) continue;
    const titleOrgKey = `${normaliseName(row.title)}|${normaliseName(row.org ?? "")}`;
    if (titleOrgKey !== "|" && seenTitleOrg.has(titleOrgKey)) continue;
    seenIds.add(hit.id);
    if (titleOrgKey !== "|") seenTitleOrg.add(titleOrgKey);
    kept.push(hit);
  }
  return kept;
}
