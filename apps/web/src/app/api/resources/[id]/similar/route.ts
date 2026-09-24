import { NextRequest, NextResponse } from "next/server";
import { findSimilar } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const results = await findSimilar(pool(), id, 10);
  return NextResponse.json({ results });
}
