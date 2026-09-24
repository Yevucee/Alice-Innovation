import type { NextRequest } from "next/server";
import { verifySessionToken, sessionCookieName } from "./auth";

export function requireSession(request: NextRequest): boolean {
  const token = request.cookies.get(sessionCookieName())?.value;
  return verifySessionToken(token);
}
