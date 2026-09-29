import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCollection, listCollections } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  is_public: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ collections: await listCollections(pool(), 100) });
}

export async function POST(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const collection = await createCollection(pool(), parsed.data);
  return NextResponse.json({ slug: collection.slug, id: collection.id });
}
