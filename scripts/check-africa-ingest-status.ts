import { closePool, getPool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";
import { AFRICA_QUEUE_SOURCE_SLUGS } from "./africa-queue-sources.js";

loadDotEnv();

type Row = {
  slug: string;
  enabled: boolean;
  items: number;
  last_status: string | null;
  last_started: string | null;
  last_error: string | null;
};

async function main(): Promise<void> {
  const pool = getPool();
  const slugs = [...AFRICA_QUEUE_SOURCE_SLUGS];

  const { rows } = await pool.query<Row>(
    `SELECT s.slug,
            s.enabled,
            s.item_count::int AS items,
            ir.status AS last_status,
            ir.started_at::text AS last_started,
            left(ir.error_summary, 120) AS last_error
     FROM sources s
     LEFT JOIN LATERAL (
       SELECT status, started_at, error_summary
       FROM ingestion_runs ir2
       WHERE ir2.source_id = s.id
       ORDER BY ir2.started_at DESC
       LIMIT 1
     ) ir ON true
     WHERE s.slug = ANY($1::text[])
     ORDER BY array_position($1::text[], s.slug)`,
    [slugs],
  );

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const missing = slugs.filter((slug) => !bySlug.has(slug));

  const lines: string[] = [];
  lines.push("| # | Source | Items | Last run | Notes |");
  lines.push("|---|--------|------:|----------|-------|");

  slugs.forEach((slug, i) => {
    const r = bySlug.get(slug);
    if (!r) {
      lines.push(`| ${i + 1} | \`${slug}\` | — | — | missing in DB (run seed) |`);
      return;
    }
    const items = r.items;
    const run = r.last_status ?? "—";
    let note = "";
    if (!r.enabled) note = "disabled in DB";
    else if (items === 0) note = "needs limit 80 + full ingest";
    else note = "has items; confirm latest run is SUCCESS after `--full`";
    if (r.last_error && run === "FAILED") note = r.last_error;
    lines.push(`| ${i + 1} | \`${slug}\` | ${items} | ${run} | ${note} |`);
  });

  console.log("# Africa ingest queue status\n");
  console.log(`Sources: ${slugs.length} | with items > 0: ${rows.filter((r) => r.items > 0).length}`);
  console.log("");
  console.log(lines.join("\n"));
  console.log("");
  console.log("Refresh: `npm run check:africa-ingest:remote`");
  console.log("Homepage strip: `npm run check:africa-index:remote`");
  console.log("Full library gaps: `npm run ops:coverage:remote`");

  if (missing.length) {
    console.error("\nMissing slugs:", missing.join(", "));
    process.exitCode = 1;
  }

  await closePool();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
