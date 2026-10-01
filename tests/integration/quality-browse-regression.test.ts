import assert from "node:assert/strict";
import test from "node:test";
import { listRecentResources } from "../../packages/database/src/browse.ts";
import { getPool, closePool } from "../../packages/database/src/index.ts";
import { ensureSearchTestDatabase } from "../helpers/search-fixtures.ts";

const databaseUrl = process.env.DATABASE_URL;

const JUNK_TITLES = [
  "Tele Health COVID - 19 Response Solution",
  "3D Printer + AMBU bag = pseudoVentilator",
  "Towards a Safer Reopening of the economy",
  "Water to households affected by Covid-19",
  "Continuous humidified hot air mouth/nose",
];

test("Recently added qualityBrowse excludes COVID-era junk titles", { skip: !databaseUrl }, async () => {
  const pool = getPool();
  await ensureSearchTestDatabase(pool);
  const source = await pool.query<{ id: string }>("SELECT id::text FROM sources WHERE slug = 'mit-solve' LIMIT 1");
  const sourceId = source.rows[0]?.id;
  assert.ok(sourceId);

  const inserted: string[] = [];
  for (const [index, title] of JUNK_TITLES.entries()) {
    const row = await pool.query<{ id: string }>(
      `INSERT INTO resources (
         resource_type, canonical_title, source_summary, extracted_index_text,
         evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
         language, active, review_status, created_at
       ) VALUES (
         'SOLUTION', $1, $2, $3,
         'PILOT', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'en', true, 'AUTO_INGESTED', now() - ($4 || ' minutes')::interval
       ) RETURNING id::text`,
      [
        title,
        title,
        `${title}. Additional body text describing the programme in enough detail for quality filters to apply consistently across browse surfaces.`,
        String(index),
      ],
    );
    inserted.push(row.rows[0].id);
  }

  try {
    const recent = await listRecentResources(pool, 40);
    const titles = recent.map((row) => row.title);
    for (const junk of JUNK_TITLES) {
      assert.equal(
        titles.some((title) => title.includes("COVID") || title.includes("Covid") || title === junk),
        false,
        `expected junk absent: ${junk}`,
      );
    }
  } finally {
    for (const id of inserted) {
      await pool.query("DELETE FROM resources WHERE id = $1::uuid", [id]);
    }
    await closePool();
  }
});
