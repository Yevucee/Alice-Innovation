import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveIngestScopeAfterClaim,
  shouldGuardManualScopeAll,
} from "../../packages/database/src/ingest-scope-bootstrap.ts";

test("shouldGuardManualScopeAll when manual start would run scope=all without claim", () => {
  assert.equal(
    shouldGuardManualScopeAll({
      scopeArg: undefined,
      claimed: null,
      cronRun: false,
      envIngestScope: undefined,
    }),
    true,
  );
  assert.equal(
    shouldGuardManualScopeAll({
      scopeArg: undefined,
      claimed: null,
      cronRun: false,
      envIngestScope: "all",
    }),
    true,
  );
  assert.equal(
    shouldGuardManualScopeAll({
      scopeArg: undefined,
      claimed: {
        id: "x",
        scope: "asia",
        trigger: "admin-button",
        status: "running",
        requested_at: new Date(),
        started_at: new Date(),
        completed_at: null,
        error_message: null,
        items_new: null,
        duration_ms: null,
      },
      cronRun: false,
      envIngestScope: "all",
    }),
    false,
  );
  assert.equal(
    shouldGuardManualScopeAll({
      scopeArg: undefined,
      claimed: null,
      cronRun: true,
      envIngestScope: undefined,
    }),
    false,
  );
});

test("resolveIngestScopeAfterClaim prefers CLI then claim then env", () => {
  assert.equal(
    resolveIngestScopeAfterClaim({
      scopeArg: "africa",
      envIngestScope: "all",
      claimed: null,
    }),
    "africa",
  );
  assert.equal(
    resolveIngestScopeAfterClaim({
      scopeArg: undefined,
      envIngestScope: "all",
      claimed: {
        id: "x",
        scope: "asia",
        trigger: "admin-button",
        status: "pending",
        requested_at: new Date(),
        started_at: null,
        completed_at: null,
        error_message: null,
        items_new: null,
        duration_ms: null,
      },
    }),
    "asia",
  );
});
