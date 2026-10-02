import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPool,
  enrichmentInputHash,
  supplementalTextFromPageCache,
  writeEnrichmentPageCache,
  loadEnrichmentCandidates,
} from "@alice/database";

test("loadEnrichmentCandidates retries gap rows after supplemental page cache appears", async () => {
  const pool = getPool();
  const resource = await pool.query<{ id: string; title: string; summary: string; text: string }>(
    `SELECT r.id::text,
            r.canonical_title AS title,
            r.source_summary AS summary,
            r.extracted_index_text AS text
     FROM resources r
     WHERE r.active AND r.review_status <> 'NEEDS_REVIEW'
       AND r.evidence_stage = 'UNKNOWN'
     LIMIT 1`,
  );
  const row = resource.rows[0];
  if (!row) return;

  const ctx = await pool.query<{ url: string }>(
    `SELECT si.canonical_url AS url
     FROM resource_source_links l
     JOIN source_items si ON si.id = l.source_item_id
     WHERE l.resource_id = $1::uuid
     LIMIT 1`,
    [row.id],
  );
  const url = ctx.rows[0]?.url;
  if (!url) return;

  const baseHash = enrichmentInputHash(row.title, row.summary, row.text, "");
  await pool.query(
    `UPDATE resources SET enrichment_input_hash = $2, enrichment_attempted_at = now() WHERE id = $1::uuid`,
    [row.id, baseHash],
  );

  const beforeCache = await loadEnrichmentCandidates(pool, 50, [row.id]);
  assert.ok(beforeCache.some((candidate) => candidate.id === row.id));

  await writeEnrichmentPageCache(pool, url, {
    statusCode: 200,
    extractedText: "This startup deploys solar microgrids across rural Kenya with paying customers and seed funding.",
  });

  const cached = await supplementalTextFromPageCache(pool, row.id);
  assert.ok(cached.supplemental.length > 80);
  const withSupplemental = enrichmentInputHash(row.title, row.summary, row.text, cached.supplemental);
  assert.notEqual(withSupplemental, baseHash);

  const afterCache = await loadEnrichmentCandidates(pool, 50, [row.id]);
  assert.ok(afterCache.some((candidate) => candidate.id === row.id));
});
