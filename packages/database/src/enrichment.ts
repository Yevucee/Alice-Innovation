import { contentHash } from "@alice/shared";
import { countryCodeFor, inferCountryFromText } from "@alice/taxonomy";
import type { EnrichmentPayload } from "./enrichment-parse.js";
import { parseEnrichmentPayload, slugFromEnrichmentLabel } from "./enrichment-parse.js";
import type { Queryable } from "./pool.js";
import { linkResourceTaxonomy } from "./taxonomy-links.js";
import { linkResourceCountryLocation } from "./resource-location.js";
import { organisationSlug } from "./seed.js";

export type { EnrichmentPayload };
export {
  parseEnrichmentPayload,
  parseEnrichmentMessageContent,
  slugFromEnrichmentLabel,
} from "./enrichment-parse.js";

export interface EnrichmentCandidate {
  id: string;
  title: string;
  source_summary: string;
  extracted_index_text: string;
  evidence_stage: string;
  primary_country_name: string | null;
  review_status: string;
  enrichment_input_hash: string | null;
}

export type EnrichmentOutcome = "applied" | "no_data" | "failed";

export interface ApplyEnrichmentResult {
  outcome: EnrichmentOutcome;
  changed: boolean;
  fields: string[];
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
            r.review_status,
            r.enrichment_input_hash
     FROM resources r
     WHERE r.active
       AND r.review_status <> 'NEEDS_REVIEW'
       AND r.enrichment_attempted_at IS NULL
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
  return rows.rows.filter((row) => {
    const currentHash = enrichmentInputHash(row.title, row.source_summary, row.extracted_index_text);
    return row.enrichment_input_hash == null || row.enrichment_input_hash !== currentHash;
  });
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
  const raw = row.rows[0]?.payload;
  if (!raw) return null;
  return parseEnrichmentPayload(raw).payload;
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

function enrichPayloadFromEvidence(
  payload: EnrichmentPayload,
  evidence: { title: string; summary: string; text: string },
): EnrichmentPayload {
  if (payload.country?.trim()) return payload;
  const inferred = inferCountryFromText(`${evidence.title}\n${evidence.summary}\n${evidence.text}`);
  if (!inferred.countryName) return payload;
  return {
    ...payload,
    country: inferred.countryName,
    city: payload.city ?? inferred.city ?? undefined,
  };
}

export async function applyEnrichmentToResource(
  db: Queryable,
  resourceId: string,
  payload: EnrichmentPayload,
  evidence?: { title: string; summary: string; text: string },
): Promise<ApplyEnrichmentResult> {
  const merged = evidence ? enrichPayloadFromEvidence(payload, evidence) : payload;
  const fields: string[] = [];
  const country = merged.country?.trim();
  const countryCode = country ? countryCodeFor(country) : null;
  const stage = merged.stage?.trim().toUpperCase().replace(/\s+/g, "_");
  const allowedStages = new Set(["IDEA", "PROTOTYPE", "PILOT", "DEPLOYED", "MULTIPLE_DEPLOYMENTS", "SCALED", "UNKNOWN"]);

  if (country) {
    const updated = await db.query(
      `UPDATE resources SET
         primary_country_name = COALESCE(NULLIF(trim(primary_country_name), ''), $2),
         primary_country_code = COALESCE(primary_country_code, $3),
         updated_at = now()
       WHERE id = $1::uuid
         AND (primary_country_name IS NULL OR trim(primary_country_name) = '')`,
      [resourceId, country, countryCode],
    );
    if ((updated.rowCount ?? 0) > 0) fields.push("country");
    const linked = await linkResourceCountryLocation(db, resourceId, {
      countryName: country,
      countryCode,
      city: merged.city ?? null,
    });
    if (linked) fields.push("location");
  }

  if (stage && stage !== "UNKNOWN" && allowedStages.has(stage)) {
    const updated = await db.query(
      `UPDATE resources SET evidence_stage = $2, updated_at = now()
       WHERE id = $1::uuid AND evidence_stage = 'UNKNOWN'`,
      [resourceId, stage],
    );
    if ((updated.rowCount ?? 0) > 0) fields.push("stage");
  }

  const orgName = merged.organisation_name?.trim();
  if (orgName && !/for-profit|not registered|legal form/i.test(orgName)) {
    const organisationId = await ensureOrganisation(db, orgName, country ?? null);
    const linked = await db.query(
      `INSERT INTO resource_organisations (resource_id, organisation_id, relationship, is_primary)
       VALUES ($1::uuid, $2::uuid, 'DEVELOPED_BY', true)
       ON CONFLICT (resource_id, organisation_id, relationship) DO NOTHING`,
      [resourceId, organisationId],
    );
    if ((linked.rowCount ?? 0) > 0) fields.push("organisation");
  }

  const sectorSlug = merged.sector ? slugFromEnrichmentLabel(merged.sector, "sector") : null;
  const problemSlug = merged.problem ? slugFromEnrichmentLabel(merged.problem, "problem") : null;
  if (sectorSlug || problemSlug) {
    const linked = await linkResourceTaxonomy(
      db,
      resourceId,
      {
        sectors: sectorSlug ? [sectorSlug] : undefined,
        problems: problemSlug ? [problemSlug] : undefined,
      },
      "INTERPRETATION",
    );
    if (linked.sectors > 0) fields.push("sector");
    if (linked.problems > 0) fields.push("problem");
  }

  if (fields.length > 0) {
    await db.query(
      `UPDATE resources SET embedding_content_hash = NULL, updated_at = now() WHERE id = $1::uuid`,
      [resourceId],
    );
  }

  return {
    outcome: fields.length > 0 ? "applied" : "no_data",
    changed: fields.length > 0,
    fields,
  };
}

export async function recordResourceEnrichmentAttempt(
  db: Queryable,
  resourceId: string,
  input: {
    inputHash: string;
    model: string;
    outcome: EnrichmentOutcome;
  },
): Promise<void> {
  await db.query(
    `UPDATE resources SET
       enrichment_input_hash = $2,
       enrichment_attempted_at = now(),
       enrichment_model = $3,
       enrichment_outcome = $4,
       updated_at = now()
     WHERE id = $1::uuid`,
    [resourceId, input.inputHash, input.model, input.outcome],
  );
}

export async function recordEnrichmentRun(
  db: Queryable,
  summary: {
    processed: number;
    attempted: number;
    applied: number;
    no_data: number;
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
       processed, attempted, applied, no_data, enriched, skipped, failed,
       total_tokens, estimated_cost_usd, completed_at, note
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10)`,
    [
      summary.processed,
      summary.attempted,
      summary.applied,
      summary.no_data,
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
  missing_fields: number;
  paused_budget: boolean;
  last_run: Record<string, unknown> | null;
}> {
  const pending = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM resources r
     WHERE r.active
       AND r.review_status <> 'NEEDS_REVIEW'
       AND r.enrichment_attempted_at IS NULL
       AND (
         r.primary_country_name IS NULL OR r.primary_country_name = ''
         OR r.evidence_stage = 'UNKNOWN'
         OR NOT EXISTS (SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id)
       )`,
  );
  const missing = await db.query<{ count: string }>(
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
    `SELECT id::text, completed_at, processed, attempted, applied, no_data, enriched, skipped, failed,
            total_tokens, estimated_cost_usd, note
     FROM enrichment_backfill_runs ORDER BY started_at DESC LIMIT 1`,
  );
  const lastRow = last.rows[0] ?? null;
  const note = lastRow?.note != null ? String(lastRow.note) : "";
  return {
    pending: Number(pending.rows[0]?.count ?? 0),
    missing_fields: Number(missing.rows[0]?.count ?? 0),
    paused_budget: note === "enrichment_paused_budget" || /openrouter limit|insufficient credits|402/i.test(note),
    last_run: lastRow,
  };
}
