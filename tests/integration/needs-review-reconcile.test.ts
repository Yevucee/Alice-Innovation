import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMigrations,
  getPool,
  listPostDeployJobs,
} from "@alice/database";

test("post_deploy_jobs include needs_review_reconcile after migration 016", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const jobs = await listPostDeployJobs(pool);
  const keys = jobs.map((j) => j.job_key);
  assert.ok(keys.includes("needs_review_reconcile_202510"));
  assert.ok(keys.includes("asia_catalogue_quality_202510"));
  assert.equal(jobs.find((j) => j.job_key === "scraper_reingest_202510")?.sort_order, 10);
});
