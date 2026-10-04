import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMigrations,
  getPool,
  listPostDeployJobs,
} from "@alice/database";

const EXPECTED_ORDER = [
  "restore_title_matched_orgs_202510",
  "data_quality_repair_202510",
  "cohort_quality_audit_202510",
  "bulk_image_backfill_202510",
  "scraper_reingest_202510",
] as const;

test("post_deploy_jobs run restore first after migration 014", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const jobs = await listPostDeployJobs(pool);
  assert.ok(jobs.length >= 5);
  const keys = jobs.map((j) => j.job_key);
  assert.deepEqual(keys.slice(0, 5), [...EXPECTED_ORDER]);
});
