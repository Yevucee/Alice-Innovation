import type { Queryable } from "./pool.js";
import type { CompactResource, SearchFilters } from "./search.js";
import { searchLibrary } from "./search.js";

export async function listRecentResources(db: Queryable, limit: number): Promise<CompactResource[]> {
  const found = await searchLibrary(db, { query: "", limit, offset: 0, sort: "newest" }, null);
  return found.results;
}

export async function resourcesForTaxonomy(
  db: Queryable,
  kind: "sector" | "problem",
  slug: string,
  limit: number,
  offset: number,
): Promise<{ results: CompactResource[]; filtered_total: number }> {
  const filters: SearchFilters = {
    query: "",
    limit,
    offset,
    sectors: kind === "sector" ? [slug] : undefined,
    problems: kind === "problem" ? [slug] : undefined,
    sort: "newest",
  };
  const found = await searchLibrary(db, filters, null);
  return { results: found.results, filtered_total: found.filtered_total };
}

export async function resourcesForSource(
  db: Queryable,
  sourceSlug: string,
  limit: number,
  offset: number,
): Promise<{ results: CompactResource[]; filtered_total: number }> {
  const found = await searchLibrary(
    db,
    { query: "", sources: [sourceSlug], limit, offset, sort: "newest" },
    null,
  );
  return { results: found.results, filtered_total: found.filtered_total };
}

export async function resourcesFromAfrica(db: Queryable, limit: number): Promise<CompactResource[]> {
  const africanCodes = [
    "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG",
    "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML",
    "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD",
    "TZ", "TG", "TN", "UG", "ZM", "ZW",
  ];
  const found = await searchLibrary(
    db,
    { query: "", countries: africanCodes.map((c) => c.toLowerCase()), limit, offset: 0, diverse: true },
    null,
  );
  return found.results;
}

export async function getPerson(db: Queryable, personId: string): Promise<Record<string, unknown> | null> {
  const row = await db.query(
    `SELECT p.id::text, p.name, p.role, p.country, p.public_profile_url, p.professional_summary,
            o.id::text AS organisation_id, o.name AS organisation_name
     FROM people p
     LEFT JOIN organisations o ON o.id = p.organisation_id
     WHERE p.id = $1`,
    [personId],
  );
  if (!row.rows[0]) return null;
  const resources = await db.query(
    `SELECT r.id::text AS resource_id, r.canonical_title, r.resource_type, rp.relationship
     FROM resource_people rp
     JOIN resources r ON r.id = rp.resource_id
     WHERE rp.person_id = $1 AND r.active
     ORDER BY r.canonical_title`,
    [personId],
  );
  return { ...row.rows[0], resources: resources.rows };
}

export async function diverseApproachesForResource(
  db: Queryable,
  resourceId: string,
  queryText: string,
  limit: number,
): Promise<CompactResource[]> {
  const found = await searchLibrary(
    db,
    { query: queryText, diverse: true, limit: limit + 2, offset: 0 },
    null,
  );
  return found.results.filter((row) => row.resource_id !== resourceId).slice(0, limit);
}

export async function listRecentIngestionRuns(db: Queryable, limit: number): Promise<unknown[]> {
  const rows = await db.query(
    `SELECT ir.id::text AS run_id, ir.status, ir.started_at, ir.completed_at,
            ir.items_new, ir.items_updated, ir.items_failed, s.slug AS source_id, s.name AS source_name
     FROM ingestion_runs ir
     LEFT JOIN sources s ON s.id = ir.source_id
     ORDER BY ir.started_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.rows;
}

export async function getOrganisation(db: Queryable, organisationId: string): Promise<Record<string, unknown> | null> {
  const row = await db.query(
    `SELECT id::text, name, organisation_type, country, website, description
     FROM organisations WHERE id = $1`,
    [organisationId],
  );
  if (!row.rows[0]) return null;
  const resources = await db.query(
    `SELECT r.id::text AS resource_id, r.canonical_title, r.resource_type, ro.relationship
     FROM resource_organisations ro
     JOIN resources r ON r.id = ro.resource_id
     WHERE ro.organisation_id = $1 AND r.active
     ORDER BY r.canonical_title`,
    [organisationId],
  );
  const people = await db.query(
    `SELECT id::text, name, role FROM people WHERE organisation_id = $1 ORDER BY name`,
    [organisationId],
  );
  return { ...row.rows[0], resources: resources.rows, people: people.rows };
}
