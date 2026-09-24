import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { libraryStats } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";
import { searchWithEmbedding } from "@/lib/search";

const bodySchema = z.object({
  query: z.string().max(500).default(""),
  resource_types: z.array(z.string()).optional(),
  problems: z.array(z.string()).optional(),
  sectors: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
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
  const found = await searchWithEmbedding({
    query: input.query,
    resourceTypes: input.resource_types,
    problems: input.problems,
    sectors: input.sectors,
    technologies: input.technologies,
    countries: input.countries,
    sources: input.sources,
    evidenceStages: input.evidence_stages,
    diverse: input.diverse,
    sort: input.sort ?? "relevance",
    limit: input.limit,
    offset: input.offset,
  });
  const stats = await libraryStats(pool());
  return NextResponse.json({
    results: found.results,
    filtered_total: found.filtered_total,
    library_total: stats.canonical_resources ?? 0,
    vector: found.vector,
  });
}
