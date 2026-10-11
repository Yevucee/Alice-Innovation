import assert from "node:assert/strict";
import test from "node:test";
import type { Queryable } from "../../packages/database/src/pool.ts";
import {
  NEEDS_REVIEW_BULK_FIX_BATCH_SIZE,
  type NeedsReviewBulkFixRow,
  runNeedsReviewBulkFixBatch,
} from "../../packages/database/src/needs-review-bulk-fix.ts";

function makeRow(id: string): NeedsReviewBulkFixRow {
  return {
    id,
    title: "ACME LONG TITLE FOR QUALITY",
    source_summary:
      "Enough body text here to satisfy the minimum length requirement for catalogue ingest quality checks on this row.",
    extracted_index_text:
      "Enough body text here to satisfy the minimum length requirement for catalogue ingest quality checks on this row.",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "test-source",
    source_item_title: null,
    canonical_url: null,
  };
}

function createMockDb(initialIds: string[]): {
  db: Queryable;
  needsReview: Set<string>;
  processed: string[];
} {
  const needsReview = new Set(initialIds);
  const processed: string[] = [];

  const db: Queryable = {
    query: async (sql: string, params?: unknown[]) => {
      const text = sql.replace(/\s+/g, " ");
      if (text.includes("FROM resources r") && text.includes("NEEDS_REVIEW")) {
        const afterId = (params?.[0] as string | null) ?? null;
        const limit = Number(params?.[1] ?? NEEDS_REVIEW_BULK_FIX_BATCH_SIZE);
        const sorted = [...needsReview].sort();
        const page = sorted.filter((id) => !afterId || id > afterId).slice(0, limit);
        return {
          rows: page.map((id) => makeRow(id)),
          rowCount: page.length,
        };
      }
      if (text.includes("UPDATE resources SET") && text.includes("review_status = 'AUTO_INGESTED'")) {
        const id = params?.[0] as string;
        processed.push(id);
        needsReview.delete(id);
        return { rows: [], rowCount: 1 };
      }
      if (text.includes("UPDATE resources SET") && text.includes("SOURCE_LIMITED")) {
        const id = params?.[0] as string;
        processed.push(id);
        needsReview.delete(id);
        return { rows: [], rowCount: 1 };
      }
      if (text.includes("UPDATE resources SET") && text.includes("review_reason_codes")) {
        const id = params?.[0] as string;
        processed.push(id);
        return { rows: [], rowCount: 1 };
      }
      if (text.includes("DELETE FROM resource_organisations")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
  };

  return { db, needsReview, processed };
}

test("apply mode keyset paging processes every row when NEEDS_REVIEW set shrinks", async () => {
  const ids = Array.from({ length: 105 }, (_, i) =>
    `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  );
  const { db, processed } = createMockDb(ids);
  let lastId: string | null = null;
  let batches = 0;
  for (;;) {
    const batch = await runNeedsReviewBulkFixBatch(db, lastId, { dryRun: false });
    batches += 1;
    lastId = batch.next_last_id;
    if (batch.complete) break;
  }
  assert.equal(processed.length, ids.length);
  assert.ok(batches >= 2, "expected multiple batches with batch size 100 and 15 rows");
  assert.deepEqual(new Set(processed), new Set(ids));
});

test("offset-style paging would skip rows in apply mode (regression guard)", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const needsReview = new Set(ids);
  const batchSize = 2;
  let offset = 0;
  const offsetProcessed: string[] = [];
  while (offset < ids.length) {
    const sorted = [...needsReview].sort();
    const page = sorted.slice(offset, offset + batchSize);
    for (const id of page) {
      offsetProcessed.push(id);
      needsReview.delete(id);
    }
    offset += batchSize;
  }
  assert.equal(offsetProcessed.length, 3, "offset paging skips remaining rows when set shrinks");
  assert.notDeepEqual(new Set(offsetProcessed), new Set(ids));
});
