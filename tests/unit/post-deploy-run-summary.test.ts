import assert from "node:assert/strict";
import { test } from "node:test";
import {
  primaryProgressOffset,
  readLastRunFromProgress,
} from "../../packages/database/src/post-deploy-run-summary.ts";

test("primaryProgressOffset prefers offset then restore_offset", () => {
  assert.equal(primaryProgressOffset({ offset: 7880, restore_offset: 10 }), 7880);
  assert.equal(primaryProgressOffset({ restore_offset: 42 }), 42);
});

test("readLastRunFromProgress parses stored session", () => {
  const row = readLastRunFromProgress({
    last_run: {
      started_at: "2026-10-05T12:00:00.000Z",
      ended_at: "2026-10-05T12:30:00.000Z",
      minutes_used: 30,
      steps: 12,
      rounds: 4,
      offset_before: 7880,
      offset_after: 8040,
      stop_reason: "budget",
      session_id: "abc",
      trigger: "before_ingest",
    },
  });
  assert.equal(row?.offset_after, 8040);
  assert.equal(row?.stop_reason, "budget");
});
