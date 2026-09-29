import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { classifyResource } from "../apps/ingestor/src/classifier.js";

loadDotEnv();
process.env.SERVICE_NAME = "alice-ingestor";

function argNumber(flag: string, fallback: number): number {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) return Number(argv[++i]);
  }
  return fallback;
}

async function main(): Promise<void> {
  if (process.env.CLASSIFIER_ENABLED !== "true") {
    console.error("Set CLASSIFIER_ENABLED=true to run batch classification.");
    process.exitCode = 1;
    return;
  }
  const limit = argNumber("--limit", 50);
  const pool = getPool();
  const rows = await pool.query<{
    id: string;
    canonical_title: string;
    source_summary: string;
    extracted_index_text: string;
  }>(
    `SELECT r.id::text, r.canonical_title, r.source_summary, r.extracted_index_text
     FROM resources r
     WHERE r.active = true
       AND NOT EXISTS (
         SELECT 1 FROM resource_interpretations ri
         WHERE ri.resource_id = r.id AND ri.classification_version = 'v1'
       )
     ORDER BY r.updated_at DESC
     LIMIT $1`,
    [limit],
  );
  let done = 0;
  for (const row of rows.rows) {
    await classifyResource(pool, row.id, {
      title: row.canonical_title,
      summary: row.source_summary,
      text: row.extracted_index_text,
    });
    done += 1;
  }
  log("info", "classify_batch_complete", { candidates: rows.rows.length, classified: done });
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "classify_batch_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
