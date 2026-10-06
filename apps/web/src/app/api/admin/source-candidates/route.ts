import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertSourceCandidate, listSourceCandidates } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

function adminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

const createSchema = z.object({
  url: z.string().min(4).max(2000),
  name: z.string().max(200).optional(),
  notes: z.string().max(4000).optional(),
});

export async function GET(request: NextRequest) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "admin_disabled" }, { status: 404 });
  }
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const candidates = await listSourceCandidates(pool(), limit);
  return NextResponse.json({ candidates });
}

export async function POST(request: NextRequest) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "admin_disabled" }, { status: 404 });
  }
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const result = await insertSourceCandidate(pool(), {
      url: parsed.data.url,
      name: parsed.data.name,
      notes: parsed.data.notes,
      suggestedBy: "admin_panel",
    });
    return NextResponse.json({
      id: result.row.id,
      duplicate: result.duplicate,
      candidate: result.row,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Invalid URL") || message.includes("URL is required")) {
      return NextResponse.json({ error: "invalid_url", message }, { status: 400 });
    }
    throw error;
  }
}
