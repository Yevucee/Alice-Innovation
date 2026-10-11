import assert from "node:assert/strict";
import test from "node:test";
import type { Queryable } from "../../packages/database/src/pool.ts";
import {
  formatNeedsReviewBulkFixSummary,
  initialNeedsReviewBulkFixProgress,
  prepareNeedsReviewBulkFixProgress,
  requeueNeedsReviewBulkFixJobIfModeChanged,
  NEEDS_REVIEW_BULK_FIX_JOB_KEY,
} from "../../packages/database/src/needs-review-bulk-fix.ts";

test("prepareNeedsReviewBulkFixProgress resets cursor when mode changes", () => {
  const stale = {
    mode: "dry_run",
    last_id: "00000000-0000-4000-8000-000000000099",
    offset: 500,
    totals: { cleared: 99, scanned: 100 },
    complete: true,
  };
  const { progress, modeReset, previousMode } = prepareNeedsReviewBulkFixProgress(stale, "apply_all");
  assert.equal(modeReset, true);
  assert.equal(previousMode, "dry_run");
  assert.equal(progress.mode, "apply_all");
  assert.equal(progress.last_id, null);
  assert.equal((progress.totals as { cleared: number }).cleared, 0);
  assert.equal(progress.mode_reset_from, "dry_run");
});

test("formatNeedsReviewBulkFixSummary shows run_mode and restarted_from", () => {
  const text = formatNeedsReviewBulkFixSummary({
    mode: "apply_all",
    mode_reset_from: "dry_run",
    totals: { cleared: 1, scanned: 1 },
    by_source: {},
    samples: [],
  });
  assert.match(text, /run_mode=apply_all/);
  assert.match(text, /restarted_from=dry_run/);
});

test("requeueNeedsReviewBulkFixJobIfModeChanged reopens completed job when APPLY toggled", async () => {
  const prev = process.env.NEEDS_REVIEW_BULK_FIX_APPLY;
  process.env.NEEDS_REVIEW_BULK_FIX_APPLY = "true";
  let status = "completed";
  let progress: Record<string, unknown> = { mode: "dry_run", last_id: "x", complete: true };
  let result: Record<string, unknown> | null = { mode: "dry_run" };

  const db = {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT status, progress, result")) {
        return {
          rows: [{ status, progress, result }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE post_deploy_jobs") && sql.includes("status = 'pending'")) {
        status = "pending";
        progress = JSON.parse(params?.[1] as string) as Record<string, unknown>;
        result = null;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as Queryable;

  const out = await requeueNeedsReviewBulkFixJobIfModeChanged(db);
  assert.equal(out.requeued, true);
  assert.equal(out.previous_mode, "dry_run");
  assert.equal(out.current_mode, "apply_all");
  assert.equal(status, "pending");
  assert.equal(progress.mode, "apply_all");
  assert.equal(progress.last_id, null);
  assert.equal(progress.mode_reset_from, "dry_run");
  assert.equal(result, null);

  if (prev === undefined) delete process.env.NEEDS_REVIEW_BULK_FIX_APPLY;
  else process.env.NEEDS_REVIEW_BULK_FIX_APPLY = prev;
});

test("initialNeedsReviewBulkFixProgress uses keyset cursor not offset", () => {
  const p = initialNeedsReviewBulkFixProgress("dry_run");
  assert.equal(p.last_id, null);
  assert.equal(p.mode, "dry_run");
  assert.ok(!("offset" in p));
});
