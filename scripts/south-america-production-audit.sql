-- Read-only production audit (South America + ingest_requests). Run via psql on pgvector.

-- Latest run per South America source (last 7 days)
SELECT s.slug,
       ir.status,
       ir.completed_at,
       ir.duration_ms,
       ir.error_summary,
       ir.pipeline_stats
FROM sources s
JOIN LATERAL (
  SELECT status, completed_at, duration_ms, error_summary, pipeline_stats
  FROM ingestion_runs
  WHERE source_id = s.id
  ORDER BY started_at DESC NULLS LAST, completed_at DESC NULLS LAST
  LIMIT 1
) ir ON true
WHERE s.slug IN (
  'fapesp-pipe',
  'gridx-portfolio',
  'unc-oferta-tecnologica',
  'usp-vitrine-portfolio',
  'cuech-red-proyectos',
  'uc-chile-technologies',
  'premios-verdes-500'
)
ORDER BY s.slug;

-- Runs on 14 Oct 2026 UTC (adjust window if needed)
SELECT s.slug,
       ir.status,
       ir.started_at,
       ir.completed_at,
       ir.error_summary,
       ir.pipeline_stats
FROM ingestion_runs ir
JOIN sources s ON s.id = ir.source_id
WHERE ir.started_at >= '2026-10-14'::date
  AND ir.started_at < '2026-10-15'::date
  AND s.slug IN (
    'fapesp-pipe',
    'gridx-portfolio',
    'unc-oferta-tecnologica',
    'usp-vitrine-portfolio',
    'cuech-red-proyectos',
    'uc-chile-technologies',
    'premios-verdes-500'
  )
ORDER BY ir.started_at;

-- ingest_requests (stuck / recent) — do not UPDATE from this file
SELECT id,
       scope,
       trigger,
       status,
       requested_at,
       started_at,
       completed_at,
       error_message
FROM ingest_requests
ORDER BY requested_at DESC
LIMIT 30;

-- Failed ingestion_runs in last 24 hours, by source
SELECT s.slug,
       COUNT(*) AS failed_runs,
       MAX(ir.completed_at) AS last_failed_at,
       (array_agg(ir.error_summary ORDER BY ir.completed_at DESC))[1] AS last_error
FROM ingestion_runs ir
JOIN sources s ON s.id = ir.source_id
WHERE ir.status = 'FAILED'
  AND ir.completed_at > now() - interval '24 hours'
GROUP BY s.slug
ORDER BY failed_runs DESC, s.slug;
