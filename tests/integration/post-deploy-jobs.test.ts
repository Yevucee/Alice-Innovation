import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMigrations,
  getPool,
  listActivePostDeployJobs,
  listPostDeployJobs,
} from "@alice/database";

const EXPECTED_ORDER = [
  "data_quality_repair_202510",
  "cohort_quality_audit_202510",
  "bulk_image_backfill_202510",
  "scraper_reingest_202510",
] as const;

test("post_deploy_jobs run data quality first after migration 013", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const jobs = await listPostDeployJobs(pool);
  assert.ok(jobs.length >= 4);
  const keys = jobs.map((j) => j.job_key);
  assert.deepEqual(keys.slice(0, 4), [...EXPECTED_ORDER]);
  for (let index = 0; index < EXPECTED_ORDER.length; index += 1) {
    assert.equal(jobs[index]?.sort_order, index + 1);
  }
  const active = await listActivePostDeployJobs(pool);
  if (active.length > 0) {
    const earliest = jobs.find((j) => j.status === "pending" || j.status === "in_progress");
    assert.equal(active[0]?.job_key, earliest?.job_key);
  }
});
