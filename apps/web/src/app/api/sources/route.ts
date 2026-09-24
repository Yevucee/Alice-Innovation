import { NextRequest, NextResponse } from "next/server";
import { browseSources } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sources = await browseSources(pool(), {});
  return NextResponse.json({
    sources: (sources as Array<Record<string, unknown>>).map((row) => ({
      id: row.source_id,
      name: row.name,
      status: row.status,
      category: row.category,
      item_count: row.item_count,
    })),
  });
}
