import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import type { AdapterContext } from "../apps/ingestor/src/adapters/types.js";

loadDotEnv();
process.env.SERVICE_NAME = "alice-ingestor";

function argValues(flag: string): string[] {
  const values: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) values.push(argv[++i]);
  }
  return values;
}

function argNumber(flag: string): number {
  const value = argValues(flag)[0];
  const parsed = Number(value ?? "200");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const sourceSlug = argValues("--source")[0];
  if (!sourceSlug) {
    console.error("Usage: tsx scripts/backfill-listing-card-images.ts --source <slug> [--limit N]");
    process.exitCode = 1;
    return;
  }
  const limit = argNumber("--limit");
  const sources = loadSources();
  const source = sources.find((entry) => entry.id === sourceSlug);
  if (!source) {
    console.error(`Unknown source: ${sourceSlug}`);
    process.exitCode = 1;
    return;
  }
  const adapter = getAdapter(source.adapter);
  if (!adapter) {
    console.error(`No adapter for ${source.adapter}`);
    process.exitCode = 1;
    return;
  }

  const pool = getPool();
  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const minInterval = Math.ceil(60000 / Math.max(1, source.limits.requests_per_minute));
  let lastRequest = 0;
  const pacedFetch = async (url: string) => {
    const wait = minInterval - (Date.now() - lastRequest);
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    return fetchText(url, { userAgent, timeoutMs });
  };
  const ctx: AdapterContext = {
    source,
    userAgent,
    timeoutMs,
    limit: null,
    fetchText: pacedFetch,
  };

  const discovered = await adapter.discover(ctx);
  const byExternalId = new Map(
    discovered
      .filter((ref) => ref.externalId)
      .map((ref) => [ref.externalId!, ref]),
  );

  const rows = await pool.query<{ id: string; external_id: string }>(
    `SELECT si.id::text, si.external_id
     FROM source_items si
     JOIN sources s ON s.id = si.source_id
     WHERE s.slug = $1
       AND si.active = true
       AND (si.image_url IS NULL OR btrim(si.image_url) = '' OR si.image_url LIKE 'data:%')
     ORDER BY si.updated_at DESC
     LIMIT $2`,
    [sourceSlug, limit],
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows.rows) {
    const ref = byExternalId.get(row.external_id);
    if (!ref?.listingHtml) {
      skipped += 1;
      continue;
    }
    try {
      const page = await adapter.fetch(ref, ctx);
      const draft = adapter.parse(page);
      const imageUrl = draft.imageUrl?.trim();
      if (!imageUrl || imageUrl.startsWith("data:")) {
        skipped += 1;
        continue;
      }
      await pool.query(
        `UPDATE source_items SET image_url = $2, updated_at = now(), last_fetched_at = now() WHERE id = $1`,
        [row.id, imageUrl],
      );
      updated += 1;
    } catch (error) {
      failed += 1;
      log("warn", "listing_image_backfill_failed", {
        source: sourceSlug,
        external_id: row.external_id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log("info", "listing_image_backfill_complete", {
    source: sourceSlug,
    limit,
    candidates: rows.rows.length,
    discovered: discovered.length,
    updated,
    skipped,
    failed,
  });
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "listing_image_backfill_crashed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
