import assert from "node:assert/strict";
import { test } from "node:test";
import { getPool, getActivePostDeployJob, listPostDeployJobs } from "@alice/database";

test("post_deploy_jobs are seeded in order", async () => {
  const pool = getPool();
  const jobs = await listPostDeployJobs(pool);
  assert.ok(jobs.length >= 4);
  assert.equal(jobs[0].job_key, "scraper_reingest_202510");
  assert.equal(jobs[0].status, "pending");
  const dq = jobs.find((j) => j.job_key === "data_quality_repair_202510");
  assert.ok(dq);
  assert.equal(dq?.sort_order, 4);
  const active = await getActivePostDeployJob(pool);
  assert.equal(active?.job_key, "scraper_reingest_202510");
});
