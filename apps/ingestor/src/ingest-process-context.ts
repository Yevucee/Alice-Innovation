/** Railway / process metadata logged on every ingestor start (diagnose duplicate runs). */
export function ingestProcessStartContext(processStartedAt: Date): Record<string, unknown> {
  const railwayCron = process.env.RAILWAY_CRON === "1" || process.env.RAILWAY_CRON === "true";
  return {
    process_started_at: processStartedAt.toISOString(),
    pid: process.pid,
    hostname: process.env.HOSTNAME ?? null,
    railway_cron: railwayCron,
    railway_deployment_id: process.env.RAILWAY_DEPLOYMENT_ID?.trim()
      || process.env.RAILWAY_DEPLOYMENT_INSTANCE_ID?.trim()
      || null,
    railway_replica_id: process.env.RAILWAY_REPLICA_ID?.trim() || null,
    railway_service_id: process.env.RAILWAY_SERVICE_ID?.trim() || null,
    railway_environment_id: process.env.RAILWAY_ENVIRONMENT_ID?.trim() || null,
    railway_project_id: process.env.RAILWAY_PROJECT_ID?.trim() || null,
    ingest_scope_env: process.env.INGEST_SCOPE?.trim() || null,
    ingest_trigger_env: process.env.INGEST_TRIGGER?.trim() || null,
  };
}
