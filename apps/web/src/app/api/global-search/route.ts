import { NextRequest, NextResponse } from "next/server";
import { browseSources, searchOrganisations, searchPeople } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";
import { searchWithEmbedding } from "@/lib/search";

export async function GET(request: NextRequest) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const [resources, people, organisations, sources] = await Promise.all([
    searchWithEmbedding({ query: q, limit: 5, offset: 0 }),
    searchPeople(pool(), { query: q, limit: 4 }),
    searchOrganisations(pool(), { query: q, limit: 4 }),
    browseSources(pool(), {}),
  ]);

  const sourceHits = (sources as Array<{ source_id: string; name: string }>)
    .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.source_id.includes(q.toLowerCase()))
    .slice(0, 4);

  const results = [
    ...resources.results.map((r) => ({
      type: "Resource",
      id: r.resource_id,
      title: r.title,
      subtitle: r.resource_type,
      href: `/resources/${r.resource_id}`,
    })),
    ...(people as Array<{ person_id: string; name: string; role?: string }>).map((p) => ({
      type: "Person",
      id: p.person_id,
      title: p.name,
      subtitle: p.role,
      href: `/people/${p.person_id}`,
    })),
    ...(organisations as Array<{ organisation_id: string; name: string }>).map((o) => ({
      type: "Organisation",
      id: o.organisation_id,
      title: o.name,
      href: `/organisations/${o.organisation_id}`,
    })),
    ...sourceHits.map((s) => ({
      type: "Source",
      id: s.source_id,
      title: s.name,
      href: `/sources/${s.source_id}`,
    })),
  ];

  return NextResponse.json({ results });
}
