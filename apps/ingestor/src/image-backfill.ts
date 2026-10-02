import type { Queryable } from "@alice/database";
import { log } from "@alice/shared";
import { fetchText } from "./http.js";
import { resolveValidatedPageImageUrl } from "./image-validate.js";
import { isUsableImageUrl, resolvePageImageUrl } from "./adapters/draft.js";

export interface ImageBackfillRow {
  id: string;
  canonical_url: string;
  source_slug: string;
}

export async function loadSourceItemsMissingImages(
  db: Queryable,
  input: { resourceIds?: string[] | null; sourceSlug?: string | null; limit: number },
): Promise<ImageBackfillRow[]> {
  const resourceIds = input.resourceIds && input.resourceIds.length > 0 ? input.resourceIds : null;
  const result = await db.query<ImageBackfillRow>(
    `SELECT si.id::text,
            si.canonical_url,
            s.slug AS source_slug
     FROM source_items si
     JOIN sources s ON s.id = si.source_id
     WHERE si.active = true
       AND (si.image_url IS NULL OR btrim(si.image_url) = '' OR si.image_url LIKE 'data:%')
       AND ($1::uuid[] IS NULL OR si.resource_id = ANY($1::uuid[]))
       AND ($2::text IS NULL OR s.slug = $2::text)
     ORDER BY si.updated_at DESC
     LIMIT $3`,
    [resourceIds, input.sourceSlug ?? null, input.limit],
  );
  return result.rows;
}

export async function applyImageUrlToSourceItem(db: Queryable, sourceItemId: string, imageUrl: string): Promise<void> {
  await db.query(
    `UPDATE source_items
     SET image_url = $2, updated_at = now(), last_fetched_at = now()
     WHERE id = $1::uuid`,
    [sourceItemId, imageUrl],
  );
}

export interface ImageBackfillSummary {
  candidates: number;
  updated: number;
  skipped: number;
  failed: number;
}

export async function backfillSourceItemImages(
  db: Queryable,
  rows: ImageBackfillRow[],
  options: {
    userAgent: string;
    timeoutMs: number;
    validateRemote?: boolean;
    minIntervalMs?: number;
  },
): Promise<ImageBackfillSummary> {
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let lastRequest = 0;
  const minInterval = options.minIntervalMs ?? 0;

  for (const row of rows) {
    try {
      const wait = minInterval - (Date.now() - lastRequest);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();

      const page = await fetchText(row.canonical_url, {
        userAgent: options.userAgent,
        timeoutMs: options.timeoutMs,
      });
      let imageUrl: string | null;
      if (options.validateRemote) {
        imageUrl = await resolveValidatedPageImageUrl(page.body, page.finalUrl || row.canonical_url, {
          userAgent: options.userAgent,
          timeoutMs: options.timeoutMs,
        });
      } else {
        imageUrl = resolvePageImageUrl(page.body, page.finalUrl || row.canonical_url);
        if (!isUsableImageUrl(imageUrl)) imageUrl = null;
      }
      if (!imageUrl) {
        skipped += 1;
        continue;
      }
      await applyImageUrlToSourceItem(db, row.id, imageUrl);
      updated += 1;
    } catch (error) {
      failed += 1;
      log("warn", "image_backfill_item_failed", {
        source: row.source_slug,
        url: row.canonical_url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { candidates: rows.length, updated, skipped, failed };
}

export function imageBackfillMaxPerRun(): number {
  const parsed = Number(process.env.IMAGE_BACKFILL_MAX_PER_RUN ?? "150");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 150;
}

export function imageBackfillOnIngestEnabled(): boolean {
  const raw = process.env.IMAGE_BACKFILL_ON_INGEST;
  if (raw == null || raw === "") return true;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

export async function runPostIngestImageBackfill(
  db: Queryable,
  touchedResourceIds: string[],
): Promise<ImageBackfillSummary | null> {
  if (!imageBackfillOnIngestEnabled()) return null;
  if (touchedResourceIds.length === 0) return null;

  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const limit = imageBackfillMaxPerRun();
  const rows = await loadSourceItemsMissingImages(db, { resourceIds: touchedResourceIds, limit });
  if (rows.length === 0) {
    return { candidates: 0, updated: 0, skipped: 0, failed: 0 };
  }

  const summary = await backfillSourceItemImages(db, rows, {
    userAgent,
    timeoutMs,
    validateRemote: true,
    minIntervalMs: 600,
  });
  log("info", "post_ingest_image_backfill", { ...summary });
  return summary;
}
