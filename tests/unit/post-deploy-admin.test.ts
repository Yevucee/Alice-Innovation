import assert from "node:assert/strict";
import { test } from "node:test";
import {
  summarisePostDeployJobCounters,
  summarisePostDeployJobSkipped,
} from "../../packages/database/src/post-deploy-admin.ts";

test("summarisePostDeployJobCounters merges totals from progress and result", () => {
  const counters = summarisePostDeployJobCounters({
    progress: {
      phase: "mit-solve",
      offset: 400,
      totals: { orgs_recovered: 12, not_found: 88, skipped_fetch: 3 },
    },
    result: null,
  });
  assert.ok(counters.some((row) => row.key === "totals_orgs_recovered" && row.value === 12));
  assert.ok(counters.some((row) => row.key === "phase" && row.value === "mit-solve"));
});

test("summarisePostDeployJobSkipped reads skipped_sources map", () => {
  const skipped = summarisePostDeployJobSkipped({
    skipped_sources: { "norrsken-100": "ingest_failed_2" },
  });
  assert.deepEqual(skipped, [{ key: "norrsken-100", reason: "ingest_failed_2" }]);
});
