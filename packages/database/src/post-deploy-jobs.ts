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

export async function listPostDeployJobs(db: Queryable): Promise<PostDeployJobRow[]> {
  const rows = await db.query<PostDeployJobRow>(
    `SELECT job_key, description, status, sort_order, progress, result, last_error, started_at, completed_at
     FROM post_deploy_jobs
     ORDER BY sort_order ASC`,
  );
  return rows.rows;
}

/** Next job that is pending or in_progress, respecting sort order. */
export async function getActivePostDeployJob(db: Queryable): Promise<PostDeployJobRow | null> {
  const rows = await db.query<PostDeployJobRow>(
    `SELECT job_key, description, status, sort_order, progress, result, last_error, started_at, completed_at
     FROM post_deploy_jobs
     WHERE status IN ('pending', 'in_progress')
     ORDER BY sort_order ASC
     LIMIT 1`,
  );
  return rows.rows[0] ?? null;
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
