import { NextRequest, NextResponse } from "next/server";
import { applyReviewQueueAction, listReviewQueue } from "@alice/database";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

function adminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

export async function GET(request: NextRequest) {
  if (!adminEnabled()) return NextResponse.json({ error: "admin_disabled" }, { status: 404 });
  if (!requireSession(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const limit = Number(params.get("limit") ?? "25");
  const offset = Number(params.get("offset") ?? "0");
  const sourceSlug = params.get("source");
  const reason = params.get("reason");
  const result = await listReviewQueue(pool(), {
    limit: Number.isFinite(limit) ? limit : 25,
    offset: Number.isFinite(offset) ? offset : 0,
    sourceSlug,
    reason,
  });
  return NextResponse.json({
    rows: result.rows.map((row) => ({
      ...row,
      updated_at: row.updated_at.toISOString(),
    })),
    total: result.total,
  });
}

export async function POST(request: NextRequest) {
  if (!adminEnabled()) return NextResponse.json({ error: "admin_disabled" }, { status: 404 });
  if (!requireSession(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json() as { resource_id?: string; action?: string };
  const action = body.action;
  if (!body.resource_id || !action || !["approve", "source_limited", "hide"].includes(action)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const ok = await applyReviewQueueAction(pool(), body.resource_id, action as "approve" | "source_limited" | "hide");
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
