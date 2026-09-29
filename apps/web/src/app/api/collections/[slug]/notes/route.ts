import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addCollectionNote, getCollectionBySlug } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";

const bodySchema = z.object({
  body: z.string().min(1).max(8000),
  author_label: z.string().max(80).optional(),
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
  await addCollectionNote(
    pool(),
    collection.id,
    parsed.data.body,
    parsed.data.author_label ?? "Alice",
  );
  return NextResponse.json({ ok: true });
}
