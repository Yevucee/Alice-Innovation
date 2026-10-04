import {
  isInvalidOrganisationName,
  organisationNameMatchesResourceTitle,
} from "@alice/shared";
import type { Queryable } from "./pool.js";
import { resolveOrganisationId } from "./data-repair.js";

const BATCH = 250;

function orgCandidateForTitleRestore(
  title: string,
  sourceSlug: string | null,
  rawMetadata: Record<string, unknown>,
): string | null {
  const rejected = rawMetadata.rejected_organisation_name;
  if (typeof rejected === "string" && rejected.trim()) {
    const name = rejected.trim();
    return organisationNameMatchesResourceTitle(name, title) ? name : null;
  }
  if (sourceSlug === "mit-solve") {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length >= 2) return trimmedTitle;
  }
  return null;
}

export interface RestoreTitleMatchedOrgsBatchResult {
  scanned: number;
  restored: number;
  skipped: number;
  offset: number;
  next_offset: number;
  complete: boolean;
}

/** Re-link organisations removed only because org name matched resource title. */
export async function runRestoreTitleMatchedOrganisationsBatch(
  db: Queryable,
  input: { offset: number },
): Promise<RestoreTitleMatchedOrgsBatchResult> {
  const rows = await db.query<{
    resource_id: string;
    title: string;
    country: string | null;
    source_name: string | null;
    source_slug: string | null;
    source_item_id: string;
    raw_metadata: Record<string, unknown>;
  }>(
    `SELECT DISTINCT ON (r.id)
            r.id::text AS resource_id,
            r.canonical_title AS title,
            r.primary_country_name AS country,
            s.name AS source_name,
            s.slug AS source_slug,
            si.id::text AS source_item_id,
            COALESCE(si.raw_metadata_json, '{}'::jsonb) AS raw_metadata
     FROM resources r
     JOIN resource_source_links rsl ON rsl.resource_id = r.id
     JOIN source_items si ON si.id = rsl.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active
       AND NOT EXISTS (
         SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id
       )
     ORDER BY r.id, si.updated_at DESC NULLS LAST
     OFFSET $1 LIMIT $2`,
    [input.offset, BATCH],
  );

  let restored = 0;
  let skipped = 0;

  for (const row of rows.rows) {
    const meta = row.raw_metadata ?? {};
    const candidate = orgCandidateForTitleRestore(row.title, row.source_slug, meta);
    if (!candidate || !organisationNameMatchesResourceTitle(candidate, row.title)) {
      skipped += 1;
      continue;
    }
    if (isInvalidOrganisationName(candidate, { resourceTitle: row.title, sourceName: row.source_name })) {
      skipped += 1;
      continue;
    }

    const organisationId = await resolveOrganisationId(db, candidate, row.country);
    const linked = await db.query(
      `INSERT INTO resource_organisations (resource_id, organisation_id, relationship, is_primary, source_item_id)
       VALUES ($1::uuid, $2::uuid, 'DEVELOPED_BY', true, $3::uuid)
       ON CONFLICT (resource_id, organisation_id, relationship) DO NOTHING`,
      [row.resource_id, organisationId, row.source_item_id],
    );
    if ((linked.rowCount ?? 0) > 0) {
      restored += 1;
      await db.query(`UPDATE resources SET updated_at = now() WHERE id = $1::uuid`, [row.resource_id]);
    } else {
      skipped += 1;
    }
  }

  const next_offset = input.offset + rows.rows.length;
  return {
    scanned: rows.rows.length,
    restored,
    skipped,
    offset: input.offset,
    next_offset,
    complete: rows.rows.length < BATCH,
  };
}
