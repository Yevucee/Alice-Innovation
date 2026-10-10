import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleAdminIngestRunPost } from "../../apps/web/src/lib/admin-ingest-run.ts";

function postRequest(body: unknown, cookie?: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/ingest-run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function baseDeps(overrides: Partial<Parameters<typeof handleAdminIngestRunPost>[1]> = {}) {
  return {
    adminEnabled: () => true,
    requireSession: () => true,
    db: () => ({ query: async () => ({ rows: [], rowCount: 0 }) }) as never,
    createIngestRequest: async () => ({ id: "req-1" }),
    railwayConfigured: () => true,
    triggerIngestor: async () => ({ executionId: "exec-1", serviceInstanceId: "si-1" }),
    markRequestFailed: async () => {},
    ...overrides,
  };
}

test("handleAdminIngestRunPost returns 404 when admin disabled", async () => {
  const result = await handleAdminIngestRunPost(
    postRequest({ scope: "asia" }),
    baseDeps({ adminEnabled: () => false }),
  );
  assert.equal(result.status, 404);
});

test("handleAdminIngestRunPost returns 401 when unauthenticated", async () => {
  const result = await handleAdminIngestRunPost(
    postRequest({ scope: "asia" }),
    baseDeps({ requireSession: () => false }),
  );
  assert.equal(result.status, 401);
});

test("handleAdminIngestRunPost returns 400 for invalid scope", async () => {
  const result = await handleAdminIngestRunPost(
    postRequest({ scope: "antarctica" }),
    baseDeps(),
  );
  assert.equal(result.status, 400);
});

test("handleAdminIngestRunPost returns 409 when already running", async () => {
  const result = await handleAdminIngestRunPost(
    postRequest({ scope: "asia" }),
    baseDeps({
      createIngestRequest: async () => ({ error: "already_running" }),
    }),
  );
  assert.equal(result.status, 409);
});

test("handleAdminIngestRunPost returns 429 when rate limited", async () => {
  const result = await handleAdminIngestRunPost(
    postRequest({ scope: "asia" }),
    baseDeps({
      createIngestRequest: async () => ({ error: "rate_limited" }),
    }),
  );
  assert.equal(result.status, 429);
});

test("handleAdminIngestRunPost returns 200 on success", async () => {
  const result = await handleAdminIngestRunPost(
    postRequest({ scope: "asia" }),
    baseDeps(),
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.execution_id, "exec-1");
});
