import type { ImageBackfillSummary } from "./image-backfill.js";

export type ImageBackfillTotals = {
  scanned: number;
  filled: number;
  skipped: number;
  failed: number;
  hosts_blocked: number;
};

export function emptyImageBackfillTotals(): ImageBackfillTotals {
  return { scanned: 0, filled: 0, skipped: 0, failed: 0, hosts_blocked: 0 };
}

export function bumpImageBackfillTotals(
  totals: ImageBackfillTotals,
  summary: ImageBackfillSummary,
  extra?: { hosts_blocked?: number },
): ImageBackfillTotals {
  return {
    scanned: totals.scanned + summary.candidates,
    filled: totals.filled + summary.updated,
    skipped: totals.skipped + summary.skipped,
    failed: totals.failed + summary.failed,
    hosts_blocked: totals.hosts_blocked + (extra?.hosts_blocked ?? 0),
  };
}

export function imageBackfillStallStepLimit(): number {
  const parsed = Number(process.env.POST_DEPLOY_IMAGE_BACKFILL_STALL_STEPS ?? "5");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export function postDeployJobMaxMinutesPerJob(): number {
  const parsed = Number(process.env.POST_DEPLOY_JOB_MAX_MINUTES ?? "15");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

export function readImageBackfillTotals(progress: Record<string, unknown>): ImageBackfillTotals {
  const raw = progress.totals as Partial<ImageBackfillTotals> | undefined;
  return {
    scanned: Number(raw?.scanned ?? 0),
    filled: Number(raw?.filled ?? 0),
    skipped: Number(raw?.skipped ?? 0),
    failed: Number(raw?.failed ?? 0),
    hosts_blocked: Number(raw?.hosts_blocked ?? 0),
  };
}

export function imageBackfillProgressFingerprint(progress: Record<string, unknown>): string {
  return [
    progress.listing_source_index ?? 0,
    progress.page_source_index ?? 0,
    progress.global_offset ?? 0,
    readImageBackfillTotals(progress).filled,
  ].join(":");
}

export function applyImageBackfillStallGuard(
  progress: Record<string, unknown>,
  madeProgress: boolean,
): { progress: Record<string, unknown>; stalled: boolean } {
  const prev = Number(progress.consecutive_stall_steps ?? 0);
  const consecutive = madeProgress ? 0 : prev + 1;
  const limit = imageBackfillStallStepLimit();
  const stalled = consecutive >= limit;
  return {
    progress: {
      ...progress,
      consecutive_stall_steps: consecutive,
      ...(stalled ? { stall_paused_at: new Date().toISOString(), stall_reason: "no_progress" } : {}),
    },
    stalled,
  };
}
