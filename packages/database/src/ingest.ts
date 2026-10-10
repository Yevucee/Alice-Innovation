import { contentHash, truncate, tryCanonicaliseUrl } from "@alice/shared";
import type { NormalisedDraft } from "@alice/shared";
import type pg from "pg";
import { organisationSlug } from "./seed.js";
import type { Queryable } from "./pool.js";

export interface UpsertResult {
  outcome: "unchanged" | "created" | "updated";
  resourceId: string;
  sourceItemId: string;
  contentHash: string;
  /** Resource already existed from another source (same canonical URL). */
  reusedResourceFromOtherSource?: boolean;
}

export interface UpsertDraftOptions {
  reviewStatus?: "AUTO_INGESTED" | "NEEDS_REVIEW";
  skipOrgPersonLinks?: boolean;
  qualityReasons?: string[];
  listingContentHash?: string;
}

const EXTRACT_LIMIT = 1500;

/** Ignore cache-busting query params when deciding if card image changed. */
function normalizeImageUrlForCompare(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  try {
    const url = new URL(trimmed);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return trimmed;
  }
}

function indexText(draft: NormalisedDraft): string {
  return truncate(
    [draft.extractedText, draft.tags.join(" "), draft.organisationName ?? "", draft.countryName ?? ""].join(" "),
    EXTRACT_LIMIT,
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

async function ensurePerson(db: Queryable, name: string, organisationId: string | null): Promise<string> {
  const slug = organisationSlug(name);
  const row = await db.query<{ id: string }>(
    `INSERT INTO people (name, slug, organisation_id, professional_summary)
     VALUES ($1, $2, $3, '')
     ON CONFLICT (slug) DO UPDATE SET organisation_id = COALESCE(people.organisation_id, EXCLUDED.organisation_id)
     RETURNING id::text`,
    [name, slug, organisationId],
  );
  return row.rows[0].id;
}

async function ensureLocation(
  db: Queryable,
  name: string,
  code: string | null,
  continent: string | null = null,
): Promise<string> {
  const found = await db.query<{ id: string }>(
    `SELECT id::text FROM locations
     WHERE country_name = $1 AND country_code IS NOT DISTINCT FROM $2 AND city IS NULL
       AND continent IS NOT DISTINCT FROM $3
     LIMIT 1`,
    [name, code, continent],
  );
  if (found.rows[0]) return found.rows[0].id;
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO locations (country_name, country_code, continent) VALUES ($1, $2, $3) RETURNING id::text`,
    [name, code, continent],
  );
  return inserted.rows[0].id;
}

export async function upsertDraft(
  db: pg.Pool,
  sourceSlug: string,
  draft: NormalisedDraft,
  runId: string,
  options: UpsertDraftOptions = {},
): Promise<UpsertResult> {
  const reviewStatus = options.reviewStatus ?? "AUTO_INGESTED";
  const skipOrgPersonLinks = options.skipOrgPersonLinks === true;
  const listingContentHash = options.listingContentHash ?? null;
  const reviewReasonCodes = reviewStatus === "NEEDS_REVIEW" ? (options.qualityReasons ?? []) : [];
  const metadata = {
    ...draft.rawMetadata,
    ...(options.qualityReasons?.length ? { quality_reasons: options.qualityReasons } : {}),
  };
  const draftWithMeta = { ...draft, rawMetadata: metadata };
  const hash = contentHash([draftWithMeta.title, draftWithMeta.sourceSummary, draftWithMeta.extractedText]);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const source = await client.query<{ id: string }>("SELECT id::text FROM sources WHERE slug = $1", [sourceSlug]);
    if (!source.rows[0]) throw new Error(`Source ${sourceSlug} is not seeded`);
    const sourceId = source.rows[0].id;

    const existing = await client.query<{
      id: string;
      resource_id: string | null;
      content_hash: string;
      image_url: string | null;
    }>(
      `SELECT id::text, resource_id::text, content_hash, image_url
       FROM source_items
       WHERE source_id = $1 AND (external_id = $2 OR canonical_url = $3)
       LIMIT 1`,
      [sourceId, draftWithMeta.externalId, draftWithMeta.canonicalUrl],
    );

    if (existing.rows[0] && existing.rows[0].content_hash === hash && existing.rows[0].resource_id) {
      const row = existing.rows[0];
      const incomingImage = draft.imageUrl?.trim() || null;
      const priorImage = row.image_url?.trim() || null;
      await client.query(
        `UPDATE source_items
         SET last_seen_at = now(), last_fetched_at = now(), miss_count = 0, active = true,
             ingestion_run_id = $2, http_etag = COALESCE($3, http_etag),
             http_last_modified = COALESCE($4, http_last_modified),
             listing_content_hash = COALESCE($6, listing_content_hash),
             image_url = CASE
               WHEN $5::text IS NOT NULL AND btrim($5::text) <> '' AND left(btrim($5::text), 5) <> 'data:'
                 THEN btrim($5::text)
               WHEN image_url LIKE 'data:%' THEN NULL
               ELSE image_url
             END,
             updated_at = now()
         WHERE id = $1`,
        [row.id, runId, draft.etag, draft.lastModified, incomingImage, listingContentHash],
      );
      await client.query("COMMIT");
      const resourceId = row.resource_id as string;
      return {
        outcome: "unchanged",
        resourceId,
        sourceItemId: row.id,
        contentHash: hash,
        reusedResourceFromOtherSource: false,
      };
    }

    const sameUrl = await client.query<{ resource_id: string }>(
      `SELECT resource_id::text FROM source_items
       WHERE canonical_url = $1 AND resource_id IS NOT NULL
       LIMIT 1`,
      [draftWithMeta.canonicalUrl],
    );

    const reusedResourceFromOtherSource = Boolean(
      sameUrl.rows[0]?.resource_id && !existing.rows[0]?.resource_id,
    );
    let resourceId = sameUrl.rows[0]?.resource_id ?? existing.rows[0]?.resource_id ?? null;
    let createdResource = false;
    const summary = truncate(draftWithMeta.sourceSummary, 500);
    const indexed = indexText(draftWithMeta);

    if (!resourceId) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO resources (
           resource_type, canonical_title, source_summary, extracted_index_text,
           evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
           language, primary_country_code, primary_country_name, review_status, review_reason_codes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id::text`,
        [
          draftWithMeta.resourceType,
          truncate(draftWithMeta.title, 300),
          summary,
          indexed,
          draftWithMeta.evidenceStage,
          draftWithMeta.evidenceBasis,
          draftWithMeta.maturityStage || "UNKNOWN",
          draftWithMeta.costLevel || "UNKNOWN",
          draftWithMeta.commercialStatus || "UNKNOWN",
          draftWithMeta.language || "en",
          draftWithMeta.countryCode,
          draftWithMeta.countryName,
          reviewStatus,
          reviewReasonCodes,
        ],
      );
      resourceId = created.rows[0].id;
      createdResource = true;
    } else {
      await client.query(
        `UPDATE resources SET
           canonical_title = $2,
           source_summary = $3,
           extracted_index_text = $4,
           evidence_stage = CASE WHEN $5 = 'UNKNOWN' THEN evidence_stage ELSE $5 END,
           evidence_basis = CASE WHEN $6 = 'UNKNOWN' THEN evidence_basis ELSE $6 END,
           maturity_stage = CASE WHEN $7 = 'UNKNOWN' THEN maturity_stage ELSE $7 END,
           primary_country_code = COALESCE($8, primary_country_code),
           primary_country_name = COALESCE($9, primary_country_name),
           review_status = CASE
             WHEN $10 = 'NEEDS_REVIEW' THEN 'NEEDS_REVIEW'
             WHEN $10 = 'AUTO_INGESTED' AND cardinality($11::text[]) = 0 THEN 'AUTO_INGESTED'
             ELSE review_status
           END,
           review_reason_codes = CASE
             WHEN $10 = 'NEEDS_REVIEW' AND cardinality($11::text[]) > 0 THEN $11
             ELSE review_reason_codes
           END,
           active = true,
           updated_at = now()
         WHERE id = $1`,
        [
          resourceId,
          truncate(draftWithMeta.title, 300),
          summary,
          indexed,
          draftWithMeta.evidenceStage,
          draftWithMeta.evidenceBasis,
          draftWithMeta.maturityStage || "UNKNOWN",
          draftWithMeta.countryCode,
          draftWithMeta.countryName,
          reviewStatus,
          reviewReasonCodes,
        ],
      );
    }

    const item = await client.query<{ id: string }>(
      `INSERT INTO source_items (
         source_id, external_id, canonical_url, original_url, title, source_description,
         published_at, content_hash, listing_content_hash, http_etag, http_last_modified, raw_metadata_json,
         extracted_text, language, image_url, active, miss_count, ingestion_run_id, resource_id, last_fetched_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,
         $7,$8,$9,$10,$11,$12::jsonb,
         $13,$14,$15,true,0,$16,$17,now()
       )
       ON CONFLICT (source_id, external_id) DO UPDATE SET
         canonical_url = EXCLUDED.canonical_url,
         original_url = EXCLUDED.original_url,
         title = EXCLUDED.title,
         source_description = EXCLUDED.source_description,
         published_at = COALESCE(EXCLUDED.published_at, source_items.published_at),
         content_hash = EXCLUDED.content_hash,
         listing_content_hash = COALESCE(EXCLUDED.listing_content_hash, source_items.listing_content_hash),
         http_etag = EXCLUDED.http_etag,
         http_last_modified = EXCLUDED.http_last_modified,
         raw_metadata_json = EXCLUDED.raw_metadata_json,
         extracted_text = EXCLUDED.extracted_text,
         image_url = CASE
           WHEN EXCLUDED.image_url IS NOT NULL AND btrim(EXCLUDED.image_url) <> '' AND left(btrim(EXCLUDED.image_url), 5) <> 'data:'
             THEN btrim(EXCLUDED.image_url)
           WHEN source_items.image_url LIKE 'data:%' THEN NULL
           ELSE source_items.image_url
         END,
         active = true,
         miss_count = 0,
         last_seen_at = now(),
         last_fetched_at = now(),
         ingestion_run_id = EXCLUDED.ingestion_run_id,
         resource_id = EXCLUDED.resource_id,
         updated_at = now()
       RETURNING id::text`,
      [
        sourceId,
        draftWithMeta.externalId,
        draftWithMeta.canonicalUrl,
        draftWithMeta.originalUrl,
        truncate(draftWithMeta.title, 300),
        summary,
        draftWithMeta.publishedAt,
        hash,
        listingContentHash,
        draftWithMeta.etag,
        draftWithMeta.lastModified,
        JSON.stringify(metadata),
        truncate(draftWithMeta.extractedText, EXTRACT_LIMIT),
        draftWithMeta.language || "en",
        draftWithMeta.imageUrl,
        runId,
        resourceId,
      ],
    );
    const sourceItemId = item.rows[0].id;

    await client.query(
      `INSERT INTO resource_source_links (resource_id, source_item_id, relationship, confidence)
       VALUES ($1, $2, 'DESCRIBED_BY', 'EXACT')
       ON CONFLICT (resource_id, source_item_id) DO NOTHING`,
      [resourceId, sourceItemId],
    );

    if (!skipOrgPersonLinks && draftWithMeta.organisationName) {
      const organisationId = await ensureOrganisation(client, draftWithMeta.organisationName, draftWithMeta.countryName);
      await client.query(
        `INSERT INTO resource_organisations (resource_id, organisation_id, relationship, is_primary, source_item_id)
         VALUES ($1, $2, 'DEVELOPED_BY', true, $3)
         ON CONFLICT (resource_id, organisation_id, relationship) DO NOTHING`,
        [resourceId, organisationId, sourceItemId],
      );
      if (draftWithMeta.personName) {
        const personId = await ensurePerson(client, draftWithMeta.personName, organisationId);
        await client.query(
          `INSERT INTO resource_people (resource_id, person_id, relationship, source_item_id)
           VALUES ($1, $2, 'ASSOCIATED_WITH', $3)
           ON CONFLICT (resource_id, person_id, relationship) DO NOTHING`,
          [resourceId, personId, sourceItemId],
        );
      }
    } else if (!skipOrgPersonLinks && draftWithMeta.personName) {
      const personId = await ensurePerson(client, draftWithMeta.personName, null);
      await client.query(
        `INSERT INTO resource_people (resource_id, person_id, relationship, source_item_id)
         VALUES ($1, $2, 'ASSOCIATED_WITH', $3)
         ON CONFLICT (resource_id, person_id, relationship) DO NOTHING`,
        [resourceId, personId, sourceItemId],
      );
    }

    const locationLabel = draftWithMeta.countryName
      ?? (draftWithMeta.continentName && draftWithMeta.continentName !== "Global" ? draftWithMeta.continentName : null);
    if (locationLabel) {
      const locationId = await ensureLocation(
        client,
        locationLabel,
        draftWithMeta.countryCode,
        draftWithMeta.continentName ?? null,
      );
      await client.query(
        `INSERT INTO resource_locations (resource_id, location_id, relationship, source_item_id)
         VALUES ($1, $2, 'MENTIONED_IN', $3)
         ON CONFLICT (resource_id, location_id, relationship) DO NOTHING`,
        [resourceId, locationId, sourceItemId],
      );
    }

    if (createdResource) {
      const near = await client.query<{ id: string }>(
        `SELECT id::text FROM resources
         WHERE id <> $1
           AND lower(canonical_title) = lower($2)
           AND COALESCE(primary_country_code, '') = COALESCE($3, '')
         LIMIT 1`,
        [resourceId, draftWithMeta.title, draftWithMeta.countryCode],
      );
      if (near.rows[0] && draft.title.trim().length >= 8) {
        await client.query(
          `INSERT INTO duplicate_candidates (resource_id, other_resource_id, reason)
           VALUES ($1, $2, 'near_title')
           ON CONFLICT (resource_id, other_resource_id, reason) DO NOTHING`,
          [resourceId, near.rows[0].id],
        );
      }
    }

    await client.query(
      `UPDATE sources SET item_count = (
         SELECT count(*) FROM source_items WHERE source_id = $1 AND active
       ), last_item_seen_at = now(), updated_at = now() WHERE id = $1`,
      [sourceId],
    );

    await client.query("COMMIT");
    return {
      outcome: createdResource ? "created" : "updated",
      resourceId,
      sourceItemId,
      contentHash: hash,
      reusedResourceFromOtherSource,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveEmbedding(
  db: Queryable,
  resourceId: string,
  embedding: number[],
  model: string,
  version: string,
  contentHashValue: string,
): Promise<void> {
  if (embedding.length !== 1536) {
    throw new Error(`Embedding length ${embedding.length} does not match vector(1536)`);
  }
  await db.query(
    `UPDATE resources SET
       embedding = $2::vector,
       embedding_model = $3,
       embedding_version = $4,
       embedding_content_hash = $5,
       embedded_at = now(),
       updated_at = now()
     WHERE id = $1 AND (embedding_content_hash IS DISTINCT FROM $5)`,
    [resourceId, `[${embedding.join(",")}]`, model, version, contentHashValue],
  );
}

export async function noteSemanticDuplicate(db: Queryable, resourceId: string): Promise<number> {
  const result = await db.query(
    `INSERT INTO duplicate_candidates (resource_id, other_resource_id, reason)
     SELECT $1, other.id, 'semantic'
     FROM resources other
     WHERE other.id <> $1
       AND other.embedding IS NOT NULL
       AND (SELECT embedding FROM resources WHERE id = $1) IS NOT NULL
       AND other.embedding <=> (SELECT embedding FROM resources WHERE id = $1) < 0.08
     ON CONFLICT (resource_id, other_resource_id, reason) DO NOTHING`,
    [resourceId],
  );
  return result.rowCount ?? 0;
}

export async function confirmDisappearances(db: Queryable, sourceSlug: string, seenUrls: string[]): Promise<number> {
  const result = await db.query(
    `UPDATE source_items si
     SET miss_count = si.miss_count + 1,
         active = CASE WHEN si.miss_count + 1 >= 2 THEN false ELSE si.active END,
         updated_at = now()
     FROM sources s
     WHERE si.source_id = s.id
       AND s.slug = $1
       AND NOT (si.canonical_url = ANY($2::text[]))
       AND si.active`,
    [sourceSlug, seenUrls],
  );
  return result.rowCount ?? 0;
}

export async function readCheckpoint(db: Queryable, sourceSlug: string): Promise<string> {
  const row = await db.query<{ cursor: string }>(
    `SELECT c.cursor FROM backfill_checkpoints c
     JOIN sources s ON s.id = c.source_id
     WHERE s.slug = $1`,
    [sourceSlug],
  );
  return row.rows[0]?.cursor ?? "";
}

export async function writeCheckpoint(db: Queryable, sourceSlug: string, cursor: string): Promise<void> {
  await db.query(
    `INSERT INTO backfill_checkpoints (source_id, cursor)
     SELECT id, $2 FROM sources WHERE slug = $1
     ON CONFLICT (source_id) DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = now()`,
    [sourceSlug, cursor],
  );
}

/** Canonical URLs already stored for a source (active items). */
export async function loadActiveCanonicalUrlsForSource(
  db: Queryable,
  sourceSlug: string,
): Promise<Set<string>> {
  const rows = await db.query<{ canonical_url: string }>(
    `SELECT DISTINCT si.canonical_url
     FROM source_items si
     JOIN sources s ON s.id = si.source_id
     WHERE s.slug = $1 AND si.active`,
    [sourceSlug],
  );
  const keys = new Set<string>();
  for (const row of rows.rows) {
    const canonical = tryCanonicaliseUrl(row.canonical_url);
    if (canonical) keys.add(canonical);
    keys.add(row.canonical_url);
  }
  return keys;
}
