import { NextRequest, NextResponse } from "next/server";
import { browseCategories } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await browseCategories(pool()));
}
