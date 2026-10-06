import { NextRequest, NextResponse } from "next/server";
import { randomQualityBrowseResource } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const excludeRaw = request.nextUrl.searchParams.get("exclude");
  const excludeIds = excludeRaw
    ? excludeRaw.split(",").map((v) => v.trim()).filter((v) => UUID_RE.test(v)).slice(0, 20)
    : [];
  try {
    const resource = await randomQualityBrowseResource(pool(), excludeIds);
    if (!resource) {
      return NextResponse.json({ error: "no_resources" }, { status: 404 });
    }
    return NextResponse.json({ resource });
  } catch {
    return NextResponse.json({ error: "random_failed" }, { status: 500 });
  }
}
