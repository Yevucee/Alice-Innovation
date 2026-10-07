import type { Queryable } from "./pool.js";
import type { PostDeployJobStatus } from "./post-deploy-jobs.js";
import { readLastRunFromProgress, type PostDeployJobLastRun } from "./post-deploy-run-summary.js";

export interface PostDeployJobAdminRow {
  job_key: string;
  description: string;
  status: PostDeployJobStatus;
  display_status: string;
  updated_at: Date;
  last_error: string | null;
  last_run: PostDeployJobLastRun | null;
  counters: Array<{ key: string; label: string; value: number | string }>;
  skipped: Array<{ key: string; reason: string }>;
}

export interface PostDeployLastRunBudget {
  ingest_started_at: Date | null;
  ingest_completed_at: Date | null;
  activity_started_at: Date | null;
  activity_ended_at: Date | null;
  minutes_used: number | null;
  jobs_touched: number;
  runner_stop_reason: string | null;
  note: string;
}

const COUNTER_KEYS: Array<{ path: string; label: string }> = [
  { path: "totals.scanned", label: "Rows scanned" },
  { path: "totals.updated", label: "Rows updated" },
  { path: "totals.orgs_recovered", label: "Orgs recovered" },
  { path: "totals.not_found", label: "Not found" },
  { path: "totals.skipped_fetch", label: "Skipped fetch" },
  { path: "totals.orgs_restored", label: "Orgs restored" },
  { path: "totals.restore_scanned", label: "Restore scanned" },
  { path: "totals.restore_skipped", label: "Restore skipped" },
  { path: "totals.resources_updated", label: "Resources updated" },
  { path: "totals.reembedded", label: "Re-embedded" },
  { path: "totals.review_reasons_backfilled", label: "Review reasons backfilled" },
  { path: "offset", label: "Batch offset" },
  { path: "restore_offset", label: "Restore offset" },
  { path: "dq_offset", label: "Repair offset" },
  { path: "listing_updated", label: "Listing images updated" },
  { path: "page_backfill_updated", label: "Page images updated" },
  { path: "global_backfill_updated", label: "Global images updated" },
  { path: "totals.scanned", label: "Image backfill scanned" },
  { path: "totals.filled", label: "Image backfill filled" },
  { path: "totals.skipped", label: "Image backfill skipped" },
  { path: "totals.hosts_blocked", label: "Image backfill hosts blocked" },
  { path: "totals.titles_repaired", label: "Titles repaired" },
  { path: "scanned", label: "Scanned" },
  { path: "flagged", label: "Flagged" },
  { path: "updated", label: "Updated" },
];

function readPath(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function mergeState(progress: Record<string, unknown>, result: Record<string, unknown> | null): Record<string, unknown> {
  const totals = {
    ...((progress.totals as Record<string, unknown> | undefined) ?? {}),
    ...((result?.totals as Record<string, unknown> | undefined) ?? {}),
  };
  const mergedTotals = Object.keys(totals).length ? totals : undefined;
  return {
    ...progress,
    ...(result ?? {}),
    ...(mergedTotals ? { totals: mergedTotals } : {}),
  };
}

export function summarisePostDeployJobCounters(input: {
  progress: Record<string, unknown>;
  result: Record<string, unknown> | null;
}): Array<{ key: string; label: string; value: number | string }> {
  const state = mergeState(input.progress ?? {}, input.result);
  const counters: Array<{ key: string; label: string; value: number | string }> = [];
  const seen = new Set<string>();

  for (const spec of COUNTER_KEYS) {
    const raw = readPath(state, spec.path);
    if (raw == null || raw === "") continue;
    if (typeof raw === "object") continue;
    const key = spec.path.replace(/\./g, "_");
    if (seen.has(key)) continue;
    seen.add(key);
    counters.push({ key, label: spec.label, value: typeof raw === "number" ? raw : String(raw) });
  }

  const totals = state.totals as Record<string, unknown> | undefined;
  if (totals) {
    for (const [name, raw] of Object.entries(totals)) {
      if (raw == null || typeof raw === "object") continue;
      const key = `totals_${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const label = name.replace(/_/g, " ");
      counters.push({
        key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        value: typeof raw === "number" ? raw : String(raw),
      });
    }
  }

  if (state.phase != null) {
    counters.push({ key: "phase", label: "Phase", value: String(state.phase) });
  }

  return counters;
}

export function summarisePostDeployJobSkipped(progress: Record<string, unknown>): Array<{ key: string; reason: string }> {
  const skipped: Array<{ key: string; reason: string }> = [];
  const map = progress.skipped_sources;
  if (map && typeof map === "object" && !Array.isArray(map)) {
    for (const [key, reason] of Object.entries(map as Record<string, unknown>)) {
      skipped.push({ key, reason: String(reason) });
    }
  }
  const skipReasons = progress.skip_reasons ?? progress.last_skip_reasons;
  if (skipReasons && typeof skipReasons === "object" && !Array.isArray(skipReasons)) {
    for (const [key, count] of Object.entries(skipReasons as Record<string, unknown>)) {
      skipped.push({ key: `skip:${key}`, reason: `${String(count)} skips` });
    }
  }
  return skipped;
}

function adminStatusLabel(status: PostDeployJobStatus): string {
  if (status === "in_progress") return "in progress";
  if (status === "skipped") return "skipped";
  return status;
}

export async function loadPostDeployJobsAdmin(db: Queryable): Promise<PostDeployJobAdminRow[]> {
  const rows = await db.query<{
    job_key: string;
    description: string;
    status: PostDeployJobStatus;
    progress: Record<string, unknown>;
    result: Record<string, unknown> | null;
    last_error: string | null;
    updated_at: Date;
  }>(
    `SELECT job_key, description, status, progress, result, last_error, updated_at
     FROM post_deploy_jobs
     ORDER BY sort_order ASC`,
  );

  return rows.rows.map((row) => ({
    job_key: row.job_key,
    description: row.description,
    status: row.status,
    display_status: adminStatusLabel(row.status),
    updated_at: row.updated_at,
    last_error: row.last_error,
    last_run: readLastRunFromProgress(row.progress),
    counters: summarisePostDeployJobCounters({ progress: row.progress ?? {}, result: row.result }),
    skipped: summarisePostDeployJobSkipped(row.progress ?? {}),
  }));
}

/** Approximate post-deploy activity during the latest completed ingestion run (read-only). */
export async function postDeployLastRunBudget(db: Queryable): Promise<PostDeployLastRunBudget> {
  const runRow = await db.query<{ started_at: Date; completed_at: Date | null }>(
    `SELECT started_at, completed_at
     FROM ingestion_runs
     WHERE completed_at IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT 1`,
  );
  const ingest = runRow.rows[0];
  if (!ingest?.completed_at) {
    return {
      ingest_started_at: ingest?.started_at ?? null,
      ingest_completed_at: null,
      activity_started_at: null,
      activity_ended_at: null,
      minutes_used: null,
      jobs_touched: 0,
      runner_stop_reason: null,
      note: "No completed ingestion run yet.",
    };
  }

  // Post-deploy runs after ingest; look for job touches in the post-ingest window (not during catalogue crawl).
  const activity = await db.query<{ first_touch: Date | null; last_touch: Date | null; jobs_touched: string }>(
    `SELECT min(updated_at) AS first_touch,
            max(updated_at) AS last_touch,
            count(*)::text AS jobs_touched
     FROM post_deploy_jobs
     WHERE updated_at >= $1::timestamptz
       AND updated_at <= $1::timestamptz + interval '45 minutes'`,
    [ingest.completed_at],
  );
  const touch = activity.rows[0];
  const jobsTouched = Number(touch?.jobs_touched ?? 0);
  const first = touch?.first_touch ?? null;
  const last = touch?.last_touch ?? null;
  let minutesUsed: number | null = null;
  if (first && last && jobsTouched > 0) {
    minutesUsed = Math.round(((last.getTime() - first.getTime()) / 60_000) * 10) / 10;
  }

  const lastRunner = await db.query<{ stop_reason: string | null }>(
    `SELECT progress->'last_run'->>'stop_reason' AS stop_reason
     FROM post_deploy_jobs
     WHERE progress ? 'last_run'
     ORDER BY (progress->'last_run'->>'ended_at')::timestamptz DESC NULLS LAST
     LIMIT 1`,
  );

  const ingestMinutes = Math.round(((ingest.completed_at.getTime() - ingest.started_at.getTime()) / 60_000) * 10) / 10;
  const noPostDeployTouches = jobsTouched === 0;
  const note = noPostDeployTouches
    ? `No post_deploy_jobs.updated_at changes within 45m after the latest ingest finished (${ingestMinutes} min ingest). Post-deploy likely did not run (process ended before post-ingest, POST_DEPLOY_JOBS_ON_INGEST=false, or ingest lock skip). Set POST_DEPLOY_BEFORE_INGEST=true or --post-deploy-first for manual runs.`
    : "Post-deploy activity window starts at ingest completion (jobs run in post-ingest, or first when POST_DEPLOY_BEFORE_INGEST is set).";

  return {
    ingest_started_at: ingest.started_at,
    ingest_completed_at: ingest.completed_at,
    activity_started_at: first,
    activity_ended_at: last,
    minutes_used: minutesUsed,
    jobs_touched: jobsTouched,
    runner_stop_reason: lastRunner.rows[0]?.stop_reason ?? null,
    note,
  };
}

export async function postDeployJobsAdminPanel(db: Queryable): Promise<{
  jobs: PostDeployJobAdminRow[];
  last_run_budget: PostDeployLastRunBudget;
}> {
  const [jobs, last_run_budget] = await Promise.all([
    loadPostDeployJobsAdmin(db),
    postDeployLastRunBudget(db),
  ]);
  return { jobs, last_run_budget };
}
