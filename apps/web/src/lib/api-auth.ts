import type { NextRequest } from "next/server";

/** Web UI and API routes are open; MCP remains bearer-protected separately. */
export function requireSession(_request: NextRequest): boolean {
  return true;
}
