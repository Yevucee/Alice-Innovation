import { getPool, closePool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";

loadDotEnv();

const pool = getPool();

const runs = await pool.query(`
  SELECT s.slug,
         ir.status,
         ir.started_at,
         ir.completed_at,
         ir.items_discovered,
         ir.items_fetched,
         ir.items_new,
         ir.items_updated,
         ir.items_unchanged,
         ir.items_failed,
         ir.error_summary
  FROM ingestion_runs ir
  JOIN sources s ON s.id = ir.source_id
  WHERE ir.started_at > now() - interval '36 hours'
  ORDER BY ir.started_at DESC
  LIMIT 80
`);

const running = await pool.query(`
  SELECT s.slug, ir.started_at, ir.status
  FROM ingestion_runs ir
  JOIN sources s ON s.id = ir.source_id
  WHERE ir.status = 'RUNNING'
  ORDER BY ir.started_at
`);

const lock = await pool.query(`
  SELECT pid, granted, classid, objid
  FROM pg_locks
  WHERE locktype = 'advisory' AND objid = 84261001
`);

const counts = await pool.query(`
  SELECT s.slug, s.enabled, s.status AS source_status,
         count(r.id)::int AS resources,
         count(r.id) FILTER (WHERE si.image_url IS NOT NULL AND si.image_url <> '')::int AS with_image
  FROM sources s
  LEFT JOIN source_items si ON si.source_id = s.id
  LEFT JOIN resources r ON r.id = si.resource_id
  WHERE s.slug IN (
    'springwise','xprize','challenge-works','wipo-green',
    'mit-solve','project-drawdown','solar-impulse'
  )
  GROUP BY s.slug, s.enabled, s.status
  ORDER BY s.slug
`);

const cronWindow = await pool.query(`
  SELECT s.slug, ir.status, ir.started_at, ir.completed_at,
         ir.items_new, ir.items_updated, ir.error_summary
  FROM ingestion_runs ir
  JOIN sources s ON s.id = ir.source_id
  WHERE ir.started_at >= '2026-09-26 03:30:00+00'
    AND ir.started_at < '2026-09-26 05:30:00+00'
  ORDER BY ir.started_at
`);

console.log(JSON.stringify({
  advisory_lock: lock.rows,
  running_runs: running.rows,
  resource_counts: counts.rows,
  cron_04utc_window: cronWindow.rows,
  recent_runs: runs.rows,
}, null, 2));

await closePool();
