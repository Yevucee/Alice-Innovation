import { contentHash } from "@alice/shared";
import { countryCodeFor, inferCountryFromText, AFRICA_SOURCE_GEO_DEFAULTS } from "@alice/taxonomy";
import type { EnrichmentPayload } from "./enrichment-parse.js";
import { parseEnrichmentPayload, resolveEnrichmentProblemSlug, resolveEnrichmentSectorSlug } from "./enrichment-parse.js";
import type { Queryable } from "./pool.js";
import { supplementalTextFromPageCache } from "./enrichment-context.js";
import { linkResourceTaxonomy } from "./taxonomy-links.js";
import { linkResourceCountryLocation } from "./resource-location.js";
import { isLegalFormOrganisationName, resolveOrganisationId } from "./data-repair.js";
import { loadResourceEnrichmentContext, type ResourceEnrichmentContext } from "./enrichment-context.js";
import { inferStageFromText, stageFromAdapterMetadata } from "./enrichment-stage.js";

export type { EnrichmentPayload };
export {
  parseEnrichmentPayload,
  parseEnrichmentMessageContent,
  slugFromEnrichmentLabel,
  resolveEnrichmentSectorSlug,
  resolveEnrichmentProblemSlug,
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
       AND (
         r.primary_country_name IS NULL OR trim(r.primary_country_name) = ''
         OR r.evidence_stage = 'UNKNOWN'
         OR (
           r.enrichment_attempted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id
           )
         )
       )
       AND ($2::uuid[] IS NULL OR r.id = ANY($2::uuid[]))
     ORDER BY
       (CASE WHEN r.primary_country_name IS NULL OR trim(r.primary_country_name) = '' THEN 0 ELSE 1 END),
       (CASE WHEN r.evidence_stage = 'UNKNOWN' THEN 0 ELSE 1 END),
       r.enrichment_attempted_at NULLS FIRST,
       r.updated_at DESC
     LIMIT $1`,
    [Math.max(limit * 4, limit), resourceIds && resourceIds.length > 0 ? resourceIds : null],
  );

  const selected: EnrichmentCandidate[] = [];
  for (const row of rows.rows) {
    if (selected.length >= limit) break;
    const missingCountry = !row.primary_country_name?.trim();
    const missingStage = row.evidence_stage === "UNKNOWN";
    const missingGap = missingCountry || missingStage;

    const cached = await supplementalTextFromPageCache(db, row.id);
    const expectedHash = enrichmentInputHash(
      row.title,
      row.source_summary,
      row.extracted_index_text,
      cached.supplemental,
    );

    if (missingGap) {
      if (row.enrichment_input_hash === expectedHash && cached.hasCachedPages) continue;
      selected.push(row);
      continue;
    }

    const baseHash = enrichmentInputHash(row.title, row.source_summary, row.extracted_index_text);
    if (row.enrichment_input_hash == null || row.enrichment_input_hash !== baseHash) {
      selected.push(row);
    }
  }
  return selected;
}

export function enrichmentInputHash(
  title: string,
  summary: string,
  text: string,
  supplementalText = "",
): string {
  return contentHash([title, summary, text.slice(0, 1500), supplementalText.slice(0, 8000)]);
}

export async function readEnrichmentCache(
  db: Queryable,
  hash: string,
): Promise<{ hit: boolean; payload: EnrichmentPayload }> {
  const row = await db.query<{ payload: EnrichmentPayload }>(
    `SELECT payload FROM resource_enrichment_cache WHERE content_hash = $1`,
    [hash],
  );
  if (!row.rows[0]) return { hit: false, payload: {} };
  const parsed = parseEnrichmentPayload(row.rows[0].payload);
  return { hit: true, payload: parsed.payload ?? {} };
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
  if (isLegalFormOrganisationName(name)) {
    throw new Error("legal_form_org_name");
  }
  return resolveOrganisationId(db, name, country);
}

function enrichPayloadFromEvidence(
  payload: EnrichmentPayload,
  evidence: { title: string; summary: string; text: string; supplementalText?: string },
  context?: ResourceEnrichmentContext | null,
): EnrichmentPayload {
  let merged = { ...payload };
  const haystack = [
    evidence.title,
    evidence.summary,
    evidence.text,
    evidence.supplementalText ?? "",
    context?.org_country ?? "",
    context?.raw_metadata?.headquarters ?? "",
  ].join("\n");

  if (!merged.country?.trim() && context?.org_country?.trim()) {
    merged = { ...merged, country: context.org_country.trim() };
  }
  if (!merged.country?.trim()) {
    const fromPhone = inferCountryFromPhone(haystack);
    if (fromPhone) merged = { ...merged, country: fromPhone };
  }
  if (!merged.country?.trim() && context?.source_slug) {
    const geoDefault = AFRICA_SOURCE_GEO_DEFAULTS[context.source_slug];
    if (geoDefault?.countryName) {
      merged = { ...merged, country: geoDefault.countryName };
    }
  }
  if (!merged.country?.trim()) {
    const inferred = inferCountryFromText(haystack);
    if (inferred.countryName) {
      merged = {
        ...merged,
        country: inferred.countryName,
        city: merged.city ?? inferred.city ?? undefined,
      };
    }
  }

  if (!merged.stage?.trim() || merged.stage.toUpperCase() === "UNKNOWN") {
    const fromMeta = stageFromAdapterMetadata(context?.source_slug ?? null, context?.raw_metadata);
    if (fromMeta && fromMeta !== "UNKNOWN") {
      merged = { ...merged, stage: fromMeta };
    } else {
      const fromText = inferStageFromText(haystack);
      if (fromText) merged = { ...merged, stage: fromText };
    }
  }

  return merged;
}

const PHONE_DIAL_TO_COUNTRY: Record<string, string> = {
  "254": "Kenya",
  "255": "Tanzania",
  "256": "Uganda",
  "234": "Nigeria",
  "233": "Ghana",
  "27": "South Africa",
  "20": "Egypt",
  "212": "Morocco",
  "251": "Ethiopia",
  "250": "Rwanda",
  "221": "Senegal",
  "225": "Côte d'Ivoire",
};

function inferCountryFromPhone(text: string): string | null {
  const match = text.match(/(?:tel:|phone:|call\s)?\+(\d{1,3})[\s.-]?\d/);
  if (!match) return null;
  const dial = match[1];
  return PHONE_DIAL_TO_COUNTRY[dial] ?? null;
}

export async function applyEnrichmentToResource(
  db: Queryable,
  resourceId: string,
  payload: EnrichmentPayload,
  evidence?: { title: string; summary: string; text: string; supplementalText?: string },
): Promise<ApplyEnrichmentResult> {
  const context = await loadResourceEnrichmentContext(db, resourceId);
  const merged = evidence ? enrichPayloadFromEvidence(payload, evidence, context) : payload;
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
  if (orgName && !isLegalFormOrganisationName(orgName)) {
    try {
      const organisationId = await ensureOrganisation(db, orgName, country ?? null);
      const linked = await db.query(
        `INSERT INTO resource_organisations (resource_id, organisation_id, relationship, is_primary)
         VALUES ($1::uuid, $2::uuid, 'DEVELOPED_BY', true)
         ON CONFLICT (resource_id, organisation_id, relationship) DO NOTHING`,
        [resourceId, organisationId],
      );
      if ((linked.rowCount ?? 0) > 0) fields.push("organisation");
    } catch {
      /* skip legal-form org names */
    }
  }

  const sectorSlug = evidence && merged.sector
    ? resolveEnrichmentSectorSlug(merged.sector, evidence)
    : null;
  const problemSlug = evidence && merged.problem
    ? resolveEnrichmentProblemSlug(merged.problem, evidence)
    : null;
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
    supplemental_pages_fetched?: number;
    country_applied?: number;
    stage_applied?: number;
    note?: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO enrichment_backfill_runs (
       processed, attempted, applied, no_data, enriched, skipped, failed,
       total_tokens, estimated_cost_usd, supplemental_pages_fetched, country_applied, stage_applied,
       completed_at, note
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)`,
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
      summary.supplemental_pages_fetched ?? 0,
      summary.country_applied ?? 0,
      summary.stage_applied ?? 0,
      summary.note ?? null,
    ],
  );
}

export async function enrichmentAdminStatus(db: Queryable): Promise<{
  pending: number;
  missing_country: number;
  missing_stage: number;
  missing_org: number;
  paused_budget: boolean;
  last_run: Record<string, unknown> | null;
}> {
  const base = `FROM resources r WHERE r.active AND r.review_status <> 'NEEDS_REVIEW'`;
  const pending = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count ${base} AND r.enrichment_attempted_at IS NULL
     AND (
       r.primary_country_name IS NULL OR r.primary_country_name = ''
       OR r.evidence_stage = 'UNKNOWN'
       OR NOT EXISTS (SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id)
     )`,
  );
  const missingCountry = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count ${base}
     AND (r.primary_country_name IS NULL OR r.primary_country_name = '')`,
  );
  const missingStage = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count ${base} AND r.evidence_stage = 'UNKNOWN'`,
  );
  const missingOrg = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count ${base}
     AND NOT EXISTS (SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id)`,
  );
  const last = await db.query(
    `SELECT id::text, completed_at, processed, attempted, applied, no_data, enriched, skipped, failed,
            total_tokens, estimated_cost_usd, supplemental_pages_fetched, country_applied, stage_applied, note
     FROM enrichment_backfill_runs ORDER BY started_at DESC LIMIT 1`,
  );
  const lastRow = last.rows[0] ?? null;
  const note = lastRow?.note != null ? String(lastRow.note) : "";
  return {
    pending: Number(pending.rows[0]?.count ?? 0),
    missing_country: Number(missingCountry.rows[0]?.count ?? 0),
    missing_stage: Number(missingStage.rows[0]?.count ?? 0),
    missing_org: Number(missingOrg.rows[0]?.count ?? 0),
    paused_budget: note === "enrichment_paused_budget" || /openrouter limit|insufficient credits|402/i.test(note),
    last_run: lastRow,
  };
}
