import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createIngestRequest } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";
import { railwayIngestConfigured, triggerIngestorDeployment } from "@/lib/railway-ingest";

const SCOPES = [
  "asia",
  "africa",
  "europe",
  "south-america",
  "grants",
  "all",
  "failed-only",
] as const;

function adminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

const bodySchema = z.object({
  scope: z.enum(SCOPES),
});

export async function POST(request: NextRequest) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "admin_disabled" }, { status: 404 });
  }
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }
  const db = pool();
  const created = await createIngestRequest(db, {
    scope: parsed.data.scope,
    trigger: "admin-button",
  });
  if ("error" in created) {
    const status = created.error === "rate_limited" ? 429 : 409;
    return NextResponse.json(
      {
        error: created.error,
        message: created.error === "already_running"
          ? "An ingest is already running or queued."
          : "Wait 10 minutes before starting the same scope again.",
      },
      { status },
    );
  }
  if (!railwayIngestConfigured()) {
    await db.query(
      `UPDATE ingest_requests SET status = 'failed', completed_at = now(), error_message = $2 WHERE id = $1::uuid`,
      [created.id, "railway_not_configured"],
    );
    return NextResponse.json({ error: "railway_not_configured" }, { status: 503 });
  }
  try {
    const deployment = await triggerIngestorDeployment();
    return NextResponse.json({
      request_id: created.id,
      scope: parsed.data.scope,
      deployment_id: deployment.deploymentId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.query(
      `UPDATE ingest_requests SET status = 'failed', completed_at = now(), error_message = $2 WHERE id = $1::uuid`,
      [created.id, message.slice(0, 500)],
    );
    return NextResponse.json({ error: "deploy_failed", message }, { status: 502 });
  }
}
