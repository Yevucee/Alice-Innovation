import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addResourceToCollection, getCollectionBySlug } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

const bodySchema = z.object({
  resource_id: z.string().uuid(),
  curator_note: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await context.params;
  const collection = await getCollectionBySlug(pool(), slug);
  if (!collection) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  await addResourceToCollection(
    pool(),
    collection.id,
    parsed.data.resource_id,
    parsed.data.curator_note ?? "",
  );
  return NextResponse.json({ ok: true });
}
