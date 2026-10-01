import assert from "node:assert/strict";
import { test } from "node:test";
import { dedupeFusedResourceHits } from "../../packages/database/src/search-dedupe.ts";
import type { Queryable } from "../../packages/database/src/pool.ts";

test("dedupeFusedResourceHits collapses same title and organisation", async () => {
  const db = {
    query: async () => ({
      rows: [
        { id: "a", title: "SOLshare", org: "SOLshare" },
        { id: "b", title: "SOLshare", org: "SOLshare" },
        { id: "c", title: "Other", org: "Acme" },
      ],
    }),
  } as unknown as Queryable;
  const hits = [
    { id: "a", score: 0.1, lists: ["semantic"] },
    { id: "b", score: 0.09, lists: ["semantic"] },
    { id: "c", score: 0.08, lists: ["semantic"] },
  ];
  const deduped = await dedupeFusedResourceHits(db, hits);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, "a");
  assert.equal(deduped[1].id, "c");
});
