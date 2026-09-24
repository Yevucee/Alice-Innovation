import { NextRequest, NextResponse } from "next/server";
import { getResource } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const resource = await getResource(pool(), id);
  if (!resource) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(resource);
}
