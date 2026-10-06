import { NextRequest, NextResponse } from "next/server";
import { promoteSourceCandidateToIngest } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

function adminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "admin_disabled" }, { status: 404 });
  }
  if (!requireSession(_request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const result = await promoteSourceCandidateToIngest(pool(), id);
    return NextResponse.json({
      source_slug: result.source_slug,
      registry_updated: result.registry_updated,
      candidate: result.row,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("not found")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "promote_failed", message }, { status: 400 });
  }
}
