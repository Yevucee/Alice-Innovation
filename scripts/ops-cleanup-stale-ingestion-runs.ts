import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

const maxAgeHours = Number(process.env.STALE_RUN_MAX_AGE_HOURS || "2");

async function main(): Promise<void> {
  const pool = getPool();
  const closed = await pool.query<{ id: string; slug: string }>(
    `UPDATE ingestion_runs ir
     SET status = 'FAILED',
         completed_at = COALESCE(completed_at, now()),
         error_summary = COALESCE(error_summary, 'Marked failed: stale RUNNING run (ops cleanup)')
     FROM sources s
     WHERE ir.source_id = s.id
       AND ir.status = 'RUNNING'
       AND ir.started_at < now() - ($1::text || ' hours')::interval
     RETURNING ir.id::text, s.slug`,
    [String(maxAgeHours)],
  );
  log("info", "stale_ingestion_runs_closed", { count: closed.rowCount, max_age_hours: maxAgeHours, rows: closed.rows });
  const recentFailures = await pool.query(
    `SELECT s.slug, ir.started_at, ir.error_summary
     FROM ingestion_runs ir
     JOIN sources s ON s.id = ir.source_id
     WHERE ir.status = 'FAILED' AND ir.started_at > now() - interval '7 days'
     ORDER BY ir.started_at DESC
     LIMIT 10`,
  );
  log("info", "recent_failed_runs", { rows: recentFailures.rows });
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "ops_cleanup_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
