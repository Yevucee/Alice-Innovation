import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { libraryStats } from "@alice/database";
import { log } from "@alice/shared";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";
import { searchFiltersFromWebBody, searchWithEmbedding } from "@/lib/search";

const bodySchema = z.object({
  query: z.string().max(500).default(""),
  resource_types: z.array(z.string()).optional(),
  problems: z.array(z.string()).optional(),
  sectors: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  continents: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  evidence_stages: z.array(z.string()).optional(),
  diverse: z.boolean().optional(),
  sort: z.enum(["relevance", "newest", "maturity"]).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(200).default(0),
});

export async function POST(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const input = parsed.data;
  try {
    const found = await searchWithEmbedding(pool(), searchFiltersFromWebBody(input));
    log("info", "web_search", {
      vector: found.vector,
      relaxed: found.relaxed,
      query_chars: input.query.length,
      results: found.results.length,
    });
    const stats = await libraryStats(pool());
    return NextResponse.json({
      results: found.results,
      filtered_total: found.filtered_total,
      library_total: stats.canonical_resources ?? 0,
      vector: found.vector,
      relaxed: found.relaxed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", "web_search_failed", { query_chars: input.query.length, message });
    return NextResponse.json({ error: "search_failed", message }, { status: 500 });
  }
}
