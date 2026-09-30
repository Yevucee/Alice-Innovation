import { closePool, getPool, linkResourceTaxonomy } from "@alice/database";
import { inferTaxonomyFromText } from "@alice/taxonomy";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

function argNumber(flag: string, fallback: number): number {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) return Number(argv[++i]);
  }
  return fallback;
}

async function main(): Promise<void> {
  const batchSize = argNumber("--batch", 500);
  const pool = getPool();
  let offset = 0;
  let processed = 0;
  let linked = 0;

  while (true) {
    const rows = await pool.query<{ id: string; title: string; summary: string; text: string }>(
      `SELECT id::text, canonical_title AS title, source_summary AS summary, extracted_index_text AS text
       FROM resources
       WHERE active = true
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [batchSize, offset],
    );
    if (rows.rows.length === 0) break;

    for (const row of rows.rows) {
      const taxonomy = inferTaxonomyFromText({
        title: row.title,
        summary: row.summary,
        text: row.text,
      });
      const counts = await linkResourceTaxonomy(pool, row.id, taxonomy);
      linked += counts.sectors + counts.problems + counts.technologies;
      processed += 1;
    }

    offset += rows.rows.length;
    log("info", "backfill_taxonomy_batch", { processed, offset, linked });
    if (rows.rows.length < batchSize) break;
  }

  log("info", "backfill_taxonomy_complete", { processed, linked });
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "backfill_taxonomy_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
