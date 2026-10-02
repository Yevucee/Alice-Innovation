import assert from "node:assert/strict";
import { test } from "node:test";
import { getPool } from "@alice/database";
import { loadSourceItemsMissingImages } from "../../apps/ingestor/src/image-backfill.ts";

test("loadSourceItemsMissingImages returns rows without thumbnails", async () => {
  const pool = getPool();
  const rows = await loadSourceItemsMissingImages(pool, { limit: 5 });
  assert.ok(Array.isArray(rows));
  for (const row of rows) {
    assert.ok(row.id);
    assert.ok(row.canonical_url.startsWith("http"));
    assert.ok(row.source_slug.length > 0);
  }
});
