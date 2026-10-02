import assert from "node:assert/strict";
import { test } from "node:test";
import { getPool, getActivePostDeployJob, listPostDeployJobs } from "@alice/database";

test("post_deploy_jobs are seeded in order", async () => {
  const pool = getPool();
  const jobs = await listPostDeployJobs(pool);
  assert.ok(jobs.length >= 3);
  assert.equal(jobs[0].job_key, "scraper_reingest_202510");
  assert.equal(jobs[0].status, "pending");
  const active = await getActivePostDeployJob(pool);
  assert.equal(active?.job_key, "scraper_reingest_202510");
});
