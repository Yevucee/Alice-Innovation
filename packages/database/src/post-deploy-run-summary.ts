export type PostDeployJobStopReason =
  | "not_run"
  | "progress"
  | "done"
  | "budget"
  | "error"
  | "disabled"
  | "no_pending_jobs";

export interface PostDeployJobLastRun {
  started_at: string;
  ended_at: string;
  minutes_used: number;
  steps: number;
  rounds: number;
  offset_before: number | null;
  offset_after: number | null;
  stop_reason: PostDeployJobStopReason;
  session_id: string;
  trigger: string;
}

const OFFSET_KEYS = [
  "offset",
  "restore_offset",
  "dq_offset",
  "review_reason_offset",
  "listing_source_index",
  "page_source_index",
  "global_offset",
] as const;

/** Primary progress cursor for one-line run summaries. */
export function primaryProgressOffset(progress: Record<string, unknown> | null | undefined): number | null {
  if (!progress) return null;
  for (const key of OFFSET_KEYS) {
    const raw = progress[key];
    if (raw == null || raw === "") continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function mergeLastRunIntoProgress(
  progress: Record<string, unknown>,
  lastRun: PostDeployJobLastRun,
): Record<string, unknown> {
  return { ...progress, last_run: lastRun };
}

export function readLastRunFromProgress(progress: Record<string, unknown> | null | undefined): PostDeployJobLastRun | null {
  const raw = progress?.last_run;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.started_at !== "string" || typeof row.ended_at !== "string") return null;
  return {
    started_at: row.started_at,
    ended_at: row.ended_at,
    minutes_used: Number(row.minutes_used ?? 0),
    steps: Number(row.steps ?? 0),
    rounds: Number(row.rounds ?? 0),
    offset_before: row.offset_before == null ? null : Number(row.offset_before),
    offset_after: row.offset_after == null ? null : Number(row.offset_after),
    stop_reason: String(row.stop_reason ?? "progress") as PostDeployJobStopReason,
    session_id: String(row.session_id ?? ""),
    trigger: String(row.trigger ?? ""),
  };
}
