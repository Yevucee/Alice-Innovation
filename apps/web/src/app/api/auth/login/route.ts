import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieHeader, webAuthPassword } from "@/lib/auth";
import { ensureEnv } from "@/lib/db";

ensureEnv();

export async function POST(request: Request) {
  ensureEnv();
  const expected = webAuthPassword();
  if (!expected) {
    return NextResponse.json({ error: "web_auth_not_configured" }, { status: 503 });
  }
  const body = await request.json() as { password?: string };
  const presented = body.password ?? "";
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = createSessionToken();
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": sessionCookieHeader(token),
    },
  });
}
