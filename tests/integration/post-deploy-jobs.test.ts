import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMigrations,
  getPool,
  listPostDeployJobs,
} from "@alice/database";

const EXPECTED_PREFIX = [
  "org_recovery_from_source_202510",
  "restore_title_matched_orgs_202510",
  "data_quality_repair_202510",
  "cohort_quality_audit_202510",
  "bulk_image_backfill_202510",
] as const;

test("post_deploy_jobs include org recovery first after migration 015", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const jobs = await listPostDeployJobs(pool);
  assert.ok(jobs.length >= 6);
  for (let index = 0; index < EXPECTED_PREFIX.length; index += 1) {
    assert.equal(jobs[index]?.job_key, EXPECTED_PREFIX[index]);
  }
});
