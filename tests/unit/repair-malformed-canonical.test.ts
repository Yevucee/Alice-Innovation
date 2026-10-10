import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMigrations,
  getPool,
  loadSourceItemListingStateMap,
  repairMalformedSourceItemCanonicalUrls,
} from "../../packages/database/src/index.ts";
import { tryCanonicaliseUrl } from "@alice/shared";

test("repairMalformedSourceItemCanonicalUrls fixes hub71-style legacy rows", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const source = await pool.query<{ id: string }>(
    "SELECT id::text FROM sources WHERE slug = 'hub71-startup-directory'",
  );
  if (!source.rows[0]) return;

  const externalId = "repair-test-slug";
  await pool.query(
    `INSERT INTO source_items (
       source_id, external_id, canonical_url, original_url, title, source_description,
       content_hash, extracted_text, language, active
     ) VALUES ($1, $2, $3, $3, 'T', 'd', 'h', 't', 'en', true)
     ON CONFLICT (source_id, external_id) DO UPDATE SET canonical_url = EXCLUDED.canonical_url`,
    [source.rows[0].id, externalId, ": https://broken.example/"],
  );

  const repaired = await repairMalformedSourceItemCanonicalUrls(pool, "hub71-startup-directory");
  assert.ok(repaired >= 1);

  const row = await pool.query<{ canonical_url: string }>(
    `SELECT canonical_url FROM source_items si
     JOIN sources s ON s.id = si.source_id
     WHERE s.slug = 'hub71-startup-directory' AND si.external_id = $1`,
    [externalId],
  );
  const fixed = tryCanonicaliseUrl(row.rows[0]?.canonical_url ?? "");
  assert.equal(fixed, `https://www.hub71.com/startups/${externalId}`);

  const map = await loadSourceItemListingStateMap(pool, "hub71-startup-directory");
  assert.ok(map.get(fixed!));
});
