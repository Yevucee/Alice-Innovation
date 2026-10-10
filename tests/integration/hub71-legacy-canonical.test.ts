import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicaliseUrl } from "@alice/shared";
import { applyMigrations, getPool, loadSourceItemListingStateMap } from "../../packages/database/src/index.ts";

test("legacy malformed source_items canonical_url throws with pre-#87 listing-state map logic", () => {
  const malformed = ": https://legacy-example.com/";
  let thrown: Error | null = null;
  try {
    canonicaliseUrl(malformed);
  } catch (error) {
    thrown = error as Error;
  }
  assert.ok(thrown);
  assert.match(thrown!.message, /Invalid URL/);
  assert.match(thrown!.stack ?? "", /canonicaliseUrl/);
});

test("loadSourceItemListingStateMap tolerates malformed canonical_url rows", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const source = await pool.query<{ id: string }>(
    "SELECT id::text FROM sources WHERE slug = 'hub71-startup-directory'",
  );
  if (!source.rows[0]) return;
  await pool.query(
    `INSERT INTO source_items (
       source_id, external_id, canonical_url, original_url, title, source_description,
       content_hash, extracted_text, language, active
     ) VALUES ($1, 'legacy-malformed', $2, $2, 'Legacy', 'desc', 'hash', 'text', 'en', true)
     ON CONFLICT (source_id, external_id) DO UPDATE SET canonical_url = EXCLUDED.canonical_url`,
    [source.rows[0].id, ": https://legacy-example.com/"],
  );
  const map = await loadSourceItemListingStateMap(pool, "hub71-startup-directory");
  assert.ok(map.get("legacy-malformed"));
});
