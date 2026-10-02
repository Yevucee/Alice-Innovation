import type { Queryable } from "./pool.js";

export interface ResourceEnrichmentContext {
  resource_id: string;
  source_slug: string | null;
  source_url: string | null;
  org_name: string | null;
  org_country: string | null;
  org_website: string | null;
  raw_metadata: Record<string, unknown>;
}

export async function loadResourceEnrichmentContext(
  db: Queryable,
  resourceId: string,
): Promise<ResourceEnrichmentContext | null> {
  const row = await db.query<{
    resource_id: string;
    source_slug: string | null;
    source_url: string | null;
    org_name: string | null;
    org_country: string | null;
    org_website: string | null;
    raw_metadata: Record<string, unknown>;
  }>(
    `SELECT r.id::text AS resource_id,
            s.slug AS source_slug,
            si.canonical_url AS source_url,
            o.name AS org_name,
            o.country AS org_country,
            o.website AS org_website,
            COALESCE(si.raw_metadata_json, '{}'::jsonb) AS raw_metadata
     FROM resources r
     LEFT JOIN resource_source_links rsl ON rsl.resource_id = r.id
     LEFT JOIN source_items si ON si.id = rsl.source_item_id
     LEFT JOIN sources s ON s.id = si.source_id
     LEFT JOIN resource_organisations ro ON ro.resource_id = r.id AND ro.is_primary IS TRUE
     LEFT JOIN organisations o ON o.id = ro.organisation_id
     WHERE r.id = $1::uuid
     ORDER BY si.updated_at DESC NULLS LAST
     LIMIT 1`,
    [resourceId],
  );
  return row.rows[0] ?? null;
}

export async function readEnrichmentPageCache(
  db: Queryable,
  url: string,
): Promise<{ extracted_text: string; fetched_at: Date } | null> {
  const row = await db.query<{ extracted_text: string; fetched_at: Date }>(
    `SELECT extracted_text, fetched_at FROM enrichment_page_cache WHERE url = $1`,
    [url],
  );
  return row.rows[0] ?? null;
}

export async function writeEnrichmentPageCache(
  db: Queryable,
  url: string,
  input: { statusCode: number; extractedText: string },
): Promise<void> {
  await db.query(
    `INSERT INTO enrichment_page_cache (url, status_code, extracted_text, fetched_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (url) DO UPDATE SET
       status_code = EXCLUDED.status_code,
       extracted_text = EXCLUDED.extracted_text,
       fetched_at = now()`,
    [url, input.statusCode, input.extractedText],
  );
}
