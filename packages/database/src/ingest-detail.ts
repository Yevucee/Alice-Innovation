import { canonicaliseUrl, contentHash } from "@alice/shared";
import type { Queryable } from "./pool.js";

export interface ListingRef {
  url: string;
  externalId?: string;
  listingHtml?: string;
}

export interface SourceItemListingState {
  id: string;
  resource_id: string | null;
  listing_content_hash: string | null;
  last_fetched_at: Date | null;
}

export function listingContentHash(ref: ListingRef): string {
  return contentHash([
    canonicaliseUrl(ref.url),
    ref.externalId?.trim() ?? "",
    ref.listingHtml ?? "",
  ]);
}

export function ingestDetailRefetchDays(): number {
  const parsed = Number(process.env.INGEST_DETAIL_REFETCH_DAYS ?? "7");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 7;
}

export function shouldSkipDetailFetch(
  row: SourceItemListingState | undefined,
  listingHash: string,
  refetchDays: number,
  now = new Date(),
): boolean {
  if (refetchDays <= 0) return false;
  if (!row?.resource_id || !row.last_fetched_at) return false;
  if (row.listing_content_hash == null) return false;
  if (row.listing_content_hash !== listingHash) return false;
  const ageMs = now.getTime() - row.last_fetched_at.getTime();
  return ageMs < refetchDays * 24 * 60 * 60 * 1000;
}

export async function loadSourceItemListingStateMap(
  db: Queryable,
  sourceSlug: string,
): Promise<Map<string, SourceItemListingState>> {
  const rows = await db.query<{
    id: string;
    resource_id: string | null;
    canonical_url: string;
    external_id: string;
    listing_content_hash: string | null;
    last_fetched_at: Date | null;
  }>(
    `SELECT si.id::text,
            si.resource_id::text,
            si.canonical_url,
            si.external_id,
            si.listing_content_hash,
            si.last_fetched_at
     FROM source_items si
     JOIN sources s ON s.id = si.source_id
     WHERE s.slug = $1 AND si.active`,
    [sourceSlug],
  );
  const map = new Map<string, SourceItemListingState>();
  for (const row of rows.rows) {
    const state: SourceItemListingState = {
      id: row.id,
      resource_id: row.resource_id,
      listing_content_hash: row.listing_content_hash,
      last_fetched_at: row.last_fetched_at,
    };
    map.set(canonicaliseUrl(row.canonical_url), state);
    map.set(row.external_id, state);
  }
  return map;
}

export function lookupListingState(
  map: Map<string, SourceItemListingState>,
  ref: ListingRef,
): SourceItemListingState | undefined {
  return map.get(canonicaliseUrl(ref.url)) ?? (ref.externalId ? map.get(ref.externalId) : undefined);
}

export async function touchSourceItemWithoutDetailFetch(
  db: Queryable,
  sourceSlug: string,
  ref: ListingRef,
  runId: string,
  listingHash: string,
): Promise<{ resourceId: string; sourceItemId: string } | null> {
  const updated = await db.query<{ id: string; resource_id: string }>(
    `UPDATE source_items si
     SET last_seen_at = now(),
         miss_count = 0,
         active = true,
         ingestion_run_id = $3::uuid,
         listing_content_hash = $4,
         updated_at = now()
     FROM sources s
     WHERE si.source_id = s.id
       AND s.slug = $1
       AND si.resource_id IS NOT NULL
       AND (
         si.canonical_url = $2
         OR ($5 <> '' AND si.external_id = $5)
       )
     RETURNING si.id::text, si.resource_id::text`,
    [sourceSlug, canonicaliseUrl(ref.url), runId, listingHash, ref.externalId ?? ""],
  );
  const row = updated.rows[0];
  if (!row) return null;
  return { resourceId: row.resource_id, sourceItemId: row.id };
}

export async function markInterruptedIngestionRuns(
  db: Queryable,
  currentProcessStartedAt: Date,
): Promise<number> {
  const result = await db.query<{ id: string }>(
    `UPDATE ingestion_runs
     SET status = 'INTERRUPTED',
         completed_at = COALESCE(completed_at, now()),
         error_summary = COALESCE(
           error_summary,
           'Process ended before run completed (marked INTERRUPTED on new ingestor start)'
         )
     WHERE status = 'RUNNING'
       AND started_at < $1
     RETURNING id::text`,
    [currentProcessStartedAt],
  );
  return result.rowCount ?? 0;
}
