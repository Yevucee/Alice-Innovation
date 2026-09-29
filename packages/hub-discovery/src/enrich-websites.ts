import { canonicaliseUrl } from "@alice/shared";
import type { Queryable } from "@alice/database";
import { upsertSourceCandidate, websiteHost } from "@alice/database";

/** Copy websites from name-matched peers (seed, FabLabs) onto AfriLabs-only hub rows. */
export async function enrichInnovationHubWebsitesByNameMatch(db: Queryable): Promise<number> {
  const matches = await db.query<{ id: string; website: string }>(
    `WITH targets AS (
       SELECT o.id, lower(regexp_replace(trim(o.name), '[^a-zA-Z0-9]+', '', 'g')) AS norm
       FROM organisations o
       WHERE o.is_innovation_hub
         AND (o.website IS NULL OR o.website_host IN ('afrilabs.com', 'www.afrilabs.com'))
     ),
     donors AS (
       SELECT DISTINCT ON (lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '', 'g')))
         lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '', 'g')) AS norm,
         website
       FROM organisations
       WHERE website IS NOT NULL
         AND website_host IS NOT NULL
         AND website_host NOT IN ('afrilabs.com', 'www.afrilabs.com')
       ORDER BY lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '', 'g')), updated_at DESC
     )
     SELECT t.id::text, d.website
     FROM targets t
     JOIN donors d ON t.norm = d.norm AND length(t.norm) > 2`,
  );
  let updated = 0;
  for (const match of matches.rows) {
    const host = websiteHost(match.website);
    if (!host) continue;
    const result = await db.query(
      `UPDATE organisations SET website = $2, website_host = $3, updated_at = now()
       WHERE id = $1
         AND NOT EXISTS (
           SELECT 1 FROM organisations o2 WHERE o2.website_host = $3 AND o2.id <> $1::uuid
         )`,
      [match.id, normaliseWebsite(match.website), host],
    );
    updated += result.rowCount ?? 0;
  }
  return updated;
}

export async function refreshSourceCandidateHomepages(db: Queryable): Promise<number> {
  const row = await db.query(
    `UPDATE innovation_source_candidates c
     SET homepage = o.website,
         updated_at = now()
     FROM organisations o
     WHERE c.organisation_id = o.id
       AND o.website IS NOT NULL
       AND (c.homepage IS NULL OR c.homepage LIKE '%afrilabs.com/hub/%')
       AND o.website_host NOT IN ('afrilabs.com', 'www.afrilabs.com')`,
  );
  return row.rowCount ?? 0;
}

function proposedSourceSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
  return base || "hub-candidate";
}

/** Create candidates for hub orgs with external websites that lack a candidate row. */
export async function ensureSourceCandidatesForExternalWebsites(db: Queryable): Promise<number> {
  const rows = await db.query<{ id: string; name: string; website: string }>(
    `SELECT o.id::text, o.name, o.website
     FROM organisations o
     WHERE o.is_innovation_hub
       AND o.website IS NOT NULL
       AND o.website_host IS NOT NULL
       AND o.website_host NOT IN ('afrilabs.com', 'www.afrilabs.com')
       AND NOT EXISTS (
         SELECT 1 FROM innovation_source_candidates c WHERE c.organisation_id = o.id
       )
     LIMIT 500`,
  );
  let created = 0;
  for (const row of rows.rows) {
    try {
      await upsertSourceCandidate(db, {
        organisationId: row.id,
        proposedSlug: proposedSourceSlug(row.name),
        homepage: row.website,
        catalogueCapability: "UNKNOWN",
        verificationNotes: "auto_from_organisation_website",
      });
      created += 1;
    } catch {
      /* slug collision — skip */
    }
  }
  return created;
}

export async function linkCandidatesToExistingSources(db: Queryable): Promise<number> {
  const row = await db.query(
    `UPDATE innovation_source_candidates c
     SET linked_source_slug = s.slug,
         access_status = 'ACTIVE_SOURCE',
         verification_notes = coalesce(c.verification_notes, '') || ';matched_existing_source',
         updated_at = now()
     FROM organisations o
     JOIN sources s ON lower(regexp_replace(s.name, '[^a-zA-Z0-9]+', '', 'g'))
       = lower(regexp_replace(o.name, '[^a-zA-Z0-9]+', '', 'g'))
     WHERE c.organisation_id = o.id
       AND s.enabled = true
       AND c.linked_source_slug IS NULL`,
  );
  return row.rowCount ?? 0;
}

export function normaliseWebsite(url: string): string {
  return canonicaliseUrl(url);
}

export { websiteHost };
