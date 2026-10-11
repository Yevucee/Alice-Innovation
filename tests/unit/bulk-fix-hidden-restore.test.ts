import assert from "node:assert/strict";
import test from "node:test";
import type { Queryable } from "../../packages/database/src/pool.ts";
import { hideNeedsReviewResource } from "../../packages/database/src/needs-review-bulk-fix.ts";
import { restoreBulkFixHiddenResource } from "../../packages/database/src/bulk-fix-hidden-restore.ts";
import { JUNK_GENERIC_TITLE } from "../../packages/database/src/needs-review-bulk-fix-junk.ts";

test("hideNeedsReviewResource appends junk codes to existing review_reason_codes", async () => {
  let codes = ["truncated_title"];

  const db = {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes("ARCHIVED") && sql.includes("array_cat")) {
        const appended = params?.[1] as string[];
        codes = [...new Set([...codes, ...appended])];
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as Queryable;

  await hideNeedsReviewResource(db, "00000000-0000-4000-8000-000000000001", [JUNK_GENERIC_TITLE]);
  assert.deepEqual(codes.sort(), ["junk_generic_title", "truncated_title"].sort());
});

test("restoreBulkFixHiddenResource returns true when a row is updated", async () => {
  const db = {
    query: async () => ({ rows: [], rowCount: 1 }),
  } as unknown as Queryable;
  assert.equal(await restoreBulkFixHiddenResource(db, "00000000-0000-4000-8000-000000000001"), true);
});
