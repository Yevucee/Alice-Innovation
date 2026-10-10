import { NextRequest, NextResponse } from "next/server";
import { ingestScopeAdminStatus } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

const SCOPES = [
  "asia",
  "africa",
  "europe",
  "south-america",
  "grants",
  "all",
  "failed-only",
];

function adminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

export async function GET(request: NextRequest) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "admin_disabled" }, { status: 404 });
  }
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const status = await ingestScopeAdminStatus(pool(), SCOPES);
  return NextResponse.json(status);
}
