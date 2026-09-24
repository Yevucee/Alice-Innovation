import { NextRequest, NextResponse } from "next/server";
import { searchOrganisations } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const results = await searchOrganisations(pool(), { query: q, limit: 40 });
  return NextResponse.json({ results });
}
