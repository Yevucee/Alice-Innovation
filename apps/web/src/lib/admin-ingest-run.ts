import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Queryable } from "@alice/database";

export const INGEST_RUN_SCOPES = [
  "asia",
  "africa",
  "europe",
  "south-america",
  "grants",
  "all",
  "failed-only",
] as const;

const bodySchema = z.object({
  scope: z.enum(INGEST_RUN_SCOPES),
});

export type AdminIngestRunDeps = {
  adminEnabled: () => boolean;
  requireSession: (request: NextRequest) => boolean;
  db: () => Queryable;
  createIngestRequest: (
    db: Queryable,
    input: { scope: string; trigger: string },
  ) => Promise<{ id: string } | { error: "rate_limited" | "already_running" }>;
  railwayConfigured: () => boolean;
  triggerIngestor: () => Promise<{ executionId: string | null; serviceInstanceId: string }>;
  markRequestFailed: (db: Queryable, id: string, message: string) => Promise<void>;
};

export async function handleAdminIngestRunPost(
  request: NextRequest,
  deps: AdminIngestRunDeps,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!deps.adminEnabled()) {
    return { status: 404, body: { error: "admin_disabled" } };
  }
  if (!deps.requireSession(request)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return { status: 400, body: { error: "invalid_scope" } };
  }
  const db = deps.db();
  const created = await deps.createIngestRequest(db, {
    scope: parsed.data.scope,
    trigger: "admin-button",
  });
  if ("error" in created) {
    const status = created.error === "rate_limited" ? 429 : 409;
    return {
      status,
      body: {
        error: created.error,
        message: created.error === "already_running"
          ? "An ingest is already running or queued."
          : "Wait 10 minutes before starting the same scope again.",
      },
    };
  }
  if (!deps.railwayConfigured()) {
    await deps.markRequestFailed(db, created.id, "railway_not_configured");
    return { status: 503, body: { error: "railway_not_configured" } };
  }
  try {
    const execution = await deps.triggerIngestor();
    return {
      status: 200,
      body: {
        request_id: created.id,
        scope: parsed.data.scope,
        execution_id: execution.executionId,
        service_instance_id: execution.serviceInstanceId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
      .replace(/Project-Access-Token:\s*[A-Za-z0-9._-]+/gi, "Project-Access-Token: [redacted]");
    await deps.markRequestFailed(db, created.id, safeMessage.slice(0, 500));
    return {
      status: 502,
      body: {
        error: "deploy_failed",
        message: safeMessage,
        railway_message: safeMessage,
      },
    };
  }
}
