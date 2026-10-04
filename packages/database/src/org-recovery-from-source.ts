import { isInvalidOrganisationName, isLegalFormText, sanitiseOrganisationName } from "@alice/shared";
import type { Queryable } from "./pool.js";
import { resolveOrganisationId } from "./data-repair.js";

const BATCH = 40;

export interface OrgRecoveryCandidate {
  resource_id: string;
  title: string;
  country: string | null;
  source_name: string | null;
  source_slug: string;
  source_item_id: string;
  canonical_url: string;
  raw_metadata: Record<string, unknown>;
}

export interface OrgRecoveryBatchResult {
  scanned: number;
  orgs_recovered: number;
  not_found: number;
  skipped_fetch: number;
  offset: number;
  next_offset: number;
  complete: boolean;
}

export async function loadOrgRecoveryCandidates(
  db: Queryable,
  input: { offset: number; sourceSlugs?: string[] | null },
): Promise<OrgRecoveryCandidate[]> {
  const slugs = input.sourceSlugs && input.sourceSlugs.length > 0 ? input.sourceSlugs : null;
  const rows = await db.query<OrgRecoveryCandidate>(
    `SELECT DISTINCT ON (r.id)
            r.id::text AS resource_id,
            r.canonical_title AS title,
            r.primary_country_name AS country,
            s.name AS source_name,
            s.slug AS source_slug,
            si.id::text AS source_item_id,
            si.canonical_url,
            COALESCE(si.raw_metadata_json, '{}'::jsonb) AS raw_metadata
     FROM resources r
     JOIN resource_source_links rsl ON rsl.resource_id = r.id
     JOIN source_items si ON si.id = rsl.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active
       AND r.resource_type <> 'ARTICLE'
       AND NOT EXISTS (SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id)
       AND ($1::text[] IS NULL OR s.slug = ANY($1::text[]))
     ORDER BY r.id,
              CASE WHEN s.slug = 'mit-solve' THEN 0 ELSE 1 END,
              si.updated_at DESC NULLS LAST
     OFFSET $2 LIMIT $3`,
    [slugs, input.offset, BATCH],
  );
  return rows.rows;
}

export function organisationFromStoredMetadata(
  candidate: OrgRecoveryCandidate,
): string | null {
  const meta = candidate.raw_metadata ?? {};
  for (const key of ["ingest_organisation_name", "rejected_organisation_name"] as const) {
    const raw = meta[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const name = sanitiseOrganisationName(raw.trim(), {
      resourceTitle: candidate.title,
      sourceName: candidate.source_name,
    });
    if (name && !isLegalFormText(name)) return name;
  }
  return null;
}

export function acceptRecoveredOrganisationName(
  name: string,
  candidate: OrgRecoveryCandidate,
): boolean {
  const trimmed = name.trim();
  if (!trimmed || isLegalFormText(trimmed)) return false;
  if (isInvalidOrganisationName(trimmed, { resourceTitle: candidate.title, sourceName: candidate.source_name })) {
    return false;
  }
  return true;
}

export async function linkRecoveredOrganisation(
  db: Queryable,
  candidate: OrgRecoveryCandidate,
  orgName: string,
): Promise<boolean> {
  if (!acceptRecoveredOrganisationName(orgName, candidate)) return false;
  const organisationId = await resolveOrganisationId(db, orgName.trim(), candidate.country);
  const linked = await db.query(
    `INSERT INTO resource_organisations (resource_id, organisation_id, relationship, is_primary, source_item_id)
     VALUES ($1::uuid, $2::uuid, 'DEVELOPED_BY', true, $3::uuid)
     ON CONFLICT (resource_id, organisation_id, relationship) DO NOTHING`,
    [candidate.resource_id, organisationId, candidate.source_item_id],
  );
  if ((linked.rowCount ?? 0) === 0) return false;
  await db.query(
    `UPDATE resources SET updated_at = now(), embedding_content_hash = NULL WHERE id = $1::uuid`,
    [candidate.resource_id],
  );
  return true;
}
