/**
 * Estimate un-ingested items for full-catalogue sources (discover cap vs item_count).
 */
import { loadSources } from "@alice/source-registry";
import { loadDotEnv } from "@alice/shared";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import { getPool, closePool } from "@alice/database";
import type { AdapterContext } from "../apps/ingestor/src/adapters/types.js";

loadDotEnv();

const SLUGS = ["atlas-of-the-future", "solar-impulse", "mit-solve"];

function ctxFor(source: ReturnType<typeof loadSources>[number]): AdapterContext {
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 45000);
  return {
    source,
    userAgent,
    timeoutMs,
    limit: null,
    fetchText: (url) => fetchText(url, { userAgent, timeoutMs }),
  };
}

async function main(): Promise<void> {
  const pool = getPool();
  for (const slug of SLUGS) {
    const source = loadSources().find((s) => s.id === slug);
    if (!source) {
      console.log(`${slug}: missing from yaml`);
      continue;
    }
    const adapter = getAdapter(source.adapter);
    const itemRow = await pool.query<{ item_count: number }>(
      "SELECT item_count FROM sources WHERE slug = $1",
      [slug],
    );
    const itemCount = itemRow.rows[0]?.item_count ?? 0;
    if (!adapter) {
      console.log(`${slug}: no adapter; item_count=${itemCount}`);
      continue;
    }
    console.log(`\n## ${slug} (item_count=${itemCount})`);
    const started = Date.now();
    const refs = await adapter.discover(ctxFor(source));
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`discover_total=${refs.length} elapsed_s=${elapsed}`);
    console.log(`estimated_remaining=${Math.max(0, refs.length - itemCount)}`);
    console.log(`targeted_run: INGEST_ONLY_SOURCES=${slug} INGEST_FULL=true`);
  }
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
