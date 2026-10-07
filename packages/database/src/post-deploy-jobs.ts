import type { Queryable } from "./pool.js";

export type PostDeployJobStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface PostDeployJobRow {
  job_key: string;
  description: string;
  status: PostDeployJobStatus;
  sort_order: number;
  progress: Record<string, unknown>;
  result: Record<string, unknown> | null;
  last_error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
}

export async function hasPendingPostDeployJobs(db: Queryable): Promise<boolean> {
  const row = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM post_deploy_jobs WHERE status IN ('pending', 'in_progress')`,
  );
  return Number(row.rows[0]?.count ?? 0) > 0;
}

export async function listPostDeployJobs(db: Queryable): Promise<PostDeployJobRow[]> {
  const rows = await db.query<PostDeployJobRow>(
    `SELECT job_key, description, status, sort_order, progress, result, last_error, started_at, completed_at
     FROM post_deploy_jobs
     ORDER BY sort_order ASC`,
  );
  return rows.rows;
}

/** All jobs that are pending or in_progress, in sort order. */
export async function listActivePostDeployJobs(db: Queryable): Promise<PostDeployJobRow[]> {
  const rows = await db.query<PostDeployJobRow>(
    `SELECT job_key, description, status, sort_order, progress, result, last_error, started_at, completed_at
     FROM post_deploy_jobs
     WHERE status IN ('pending', 'in_progress')
     ORDER BY sort_order ASC`,
  );
  return rows.rows;
}

/** Next job that is pending or in_progress, respecting sort order. */
export async function getActivePostDeployJob(db: Queryable): Promise<PostDeployJobRow | null> {
  const rows = await listActivePostDeployJobs(db);
  return rows[0] ?? null;
}

export async function markPostDeployJobInProgress(
  db: Queryable,
  jobKey: string,
  progress: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `UPDATE post_deploy_jobs
     SET status = 'in_progress',
         progress = $2::jsonb,
         started_at = COALESCE(started_at, now()),
         last_error = NULL,
         updated_at = now()
     WHERE job_key = $1`,
    [jobKey, JSON.stringify(progress)],
  );
}

export async function updatePostDeployJobProgress(
  db: Queryable,
  jobKey: string,
  progress: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `UPDATE post_deploy_jobs
     SET progress = $2::jsonb, updated_at = now()
     WHERE job_key = $1`,
    [jobKey, JSON.stringify(progress)],
  );
}

export async function completePostDeployJob(
  db: Queryable,
  jobKey: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `UPDATE post_deploy_jobs
     SET status = 'completed',
         result = $2::jsonb,
         completed_at = now(),
         updated_at = now()
     WHERE job_key = $1`,
    [jobKey, JSON.stringify(result)],
  );
}

export async function notePostDeployJobError(
  db: Queryable,
  jobKey: string,
  message: string,
  progress: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `UPDATE post_deploy_jobs
     SET last_error = $2,
         progress = $3::jsonb,
         updated_at = now()
     WHERE job_key = $1`,
    [jobKey, message.slice(0, 2000), JSON.stringify(progress)],
  );
}

/** Reset jobs stuck in_progress after a deploy crash so the queue can resume. */
export async function resetStalePostDeployJobs(
  db: Queryable,
  currentProcessStartedAt: Date,
): Promise<number> {
  const result = await db.query<{ job_key: string }>(
    `UPDATE post_deploy_jobs
     SET status = 'pending',
         last_error = COALESCE(
           NULLIF(last_error, ''),
           'Reset to pending after ingestor restart (was in_progress)'
         ),
         updated_at = now()
     WHERE status = 'in_progress'
       AND updated_at < $1
     RETURNING job_key`,
    [currentProcessStartedAt],
  );
  return result.rowCount ?? 0;
}

export async function setPostDeployJobLastRun(
  db: Queryable,
  jobKey: string,
  lastRun: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `UPDATE post_deploy_jobs
     SET progress = jsonb_set(COALESCE(progress, '{}'::jsonb), '{last_run}', $2::jsonb, true),
         updated_at = now()
     WHERE job_key = $1`,
    [jobKey, JSON.stringify(lastRun)],
  );
}
