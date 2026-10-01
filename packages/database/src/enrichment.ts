import { contentHash } from "@alice/shared";
import type { Queryable } from "./pool.js";
import { organisationSlug } from "./seed.js";

export interface EnrichmentPayload {
  country?: string;
  city?: string;
  stage?: string;
  problem?: string;
  sector?: string;
  organisation_name?: string;
}

export interface EnrichmentCandidate {
  id: string;
  title: string;
  source_summary: string;
  extracted_index_text: string;
  evidence_stage: string;
  primary_country_name: string | null;
  review_status: string;
}

export async function loadEnrichmentCandidates(
  db: Queryable,
  limit: number,
  resourceIds?: string[] | null,
): Promise<EnrichmentCandidate[]> {
  const rows = await db.query<EnrichmentCandidate>(
    `SELECT r.id::text,
            r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            r.evidence_stage,
            r.primary_country_name,
            r.review_status
     FROM resources r
     WHERE r.active
       AND r.review_status <> 'NEEDS_REVIEW'
       AND (
         r.primary_country_name IS NULL OR r.primary_country_name = ''
         OR r.evidence_stage = 'UNKNOWN'
         OR NOT EXISTS (
           SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id
         )
       )
       AND ($2::uuid[] IS NULL OR r.id = ANY($2::uuid[]))
     ORDER BY r.updated_at DESC
     LIMIT $1`,
    [limit, resourceIds && resourceIds.length > 0 ? resourceIds : null],
  );
  return rows.rows;
}

export function enrichmentInputHash(title: string, summary: string, text: string): string {
  return contentHash([title, summary, text.slice(0, 1500)]);
}

export async function readEnrichmentCache(
  db: Queryable,
  hash: string,
): Promise<EnrichmentPayload | null> {
  const row = await db.query<{ payload: EnrichmentPayload }>(
    `SELECT payload FROM resource_enrichment_cache WHERE content_hash = $1`,
    [hash],
  );
  return row.rows[0]?.payload ?? null;
}

export async function writeEnrichmentCache(
  db: Queryable,
  hash: string,
  model: string,
  payload: EnrichmentPayload,
): Promise<void> {
  await db.query(
    `INSERT INTO resource_enrichment_cache (content_hash, model, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (content_hash) DO UPDATE SET model = EXCLUDED.model, payload = EXCLUDED.payload`,
    [hash, model, JSON.stringify(payload)],
  );
}

async function ensureOrganisation(db: Queryable, name: string, country: string | null): Promise<string> {
  const slug = organisationSlug(name);
  const row = await db.query<{ id: string }>(
    `INSERT INTO organisations (name, slug, country)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET country = COALESCE(organisations.country, EXCLUDED.country), updated_at = now()
     RETURNING id::text`,
    [name, slug, country],
  );
  return row.rows[0].id;
}

export async function applyEnrichmentToResource(
  db: Queryable,
  resourceId: string,
  payload: EnrichmentPayload,
): Promise<boolean> {
  let changed = false;
  const country = payload.country?.trim();
  const stage = payload.stage?.trim().toUpperCase().replace(/\s+/g, "_");
  const allowedStages = new Set(["IDEA", "PROTOTYPE", "PILOT", "DEPLOYED", "MULTIPLE_DEPLOYMENTS", "SCALED", "UNKNOWN"]);

  if (country && country.toUpperCase() !== "UNKNOWN") {
    await db.query(
      `UPDATE resources SET
         primary_country_name = COALESCE(primary_country_name, $2),
         updated_at = now()
       WHERE id = $1`,
      [resourceId, country],
    );
    changed = true;
  }

  if (stage && stage !== "UNKNOWN" && allowedStages.has(stage)) {
    await db.query(
      `UPDATE resources SET evidence_stage = $2, updated_at = now()
       WHERE id = $1 AND evidence_stage = 'UNKNOWN'`,
      [resourceId, stage],
    );
    changed = true;
  }

  const orgName = payload.organisation_name?.trim();
  if (orgName && orgName.toUpperCase() !== "UNKNOWN" && !/for-profit|not registered|legal form/i.test(orgName)) {
    const organisationId = await ensureOrganisation(db, orgName, country ?? null);
    await db.query(
      `INSERT INTO resource_organisations (resource_id, organisation_id, relationship, is_primary)
       VALUES ($1, $2, 'DEVELOPED_BY', true)
       ON CONFLICT (resource_id, organisation_id, relationship) DO NOTHING`,
      [resourceId, organisationId],
    );
    changed = true;
  }

  if (changed) {
    await db.query(
      `UPDATE resources SET embedding_content_hash = NULL, updated_at = now() WHERE id = $1::uuid`,
      [resourceId],
    );
  }

  return changed;
}

export async function recordEnrichmentRun(
  db: Queryable,
  summary: {
    processed: number;
    enriched: number;
    skipped: number;
    failed: number;
    total_tokens: number;
    estimated_cost_usd: number;
    note?: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO enrichment_backfill_runs (
       processed, enriched, skipped, failed, total_tokens, estimated_cost_usd, completed_at, note
     ) VALUES ($1, $2, $3, $4, $5, $6, now(), $7)`,
    [
      summary.processed,
      summary.enriched,
      summary.skipped,
      summary.failed,
      summary.total_tokens,
      summary.estimated_cost_usd,
      summary.note ?? null,
    ],
  );
}

export async function enrichmentAdminStatus(db: Queryable): Promise<{
  pending: number;
  paused_budget: boolean;
  last_run: Record<string, unknown> | null;
}> {
  const pending = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM resources r
     WHERE r.active
       AND r.review_status <> 'NEEDS_REVIEW'
       AND (
         r.primary_country_name IS NULL OR r.primary_country_name = ''
         OR r.evidence_stage = 'UNKNOWN'
         OR NOT EXISTS (SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id)
       )`,
  );
  const last = await db.query(
    `SELECT id::text, completed_at, processed, enriched, skipped, failed, total_tokens, estimated_cost_usd, note
     FROM enrichment_backfill_runs ORDER BY started_at DESC LIMIT 1`,
  );
  const lastRow = last.rows[0] ?? null;
  const note = lastRow?.note != null ? String(lastRow.note) : "";
  return {
    pending: Number(pending.rows[0]?.count ?? 0),
    paused_budget: note === "enrichment_paused_budget" || /openrouter limit|insufficient credits|402/i.test(note),
    last_run: lastRow,
  };
}
