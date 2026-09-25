import type { Queryable } from "./pool.js";

export async function libraryStats(db: Queryable): Promise<Record<string, number>> {
  const row = await db.query<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM resources) AS canonical_resources,
       (SELECT count(*) FROM source_items) AS source_items,
       (SELECT count(*) FROM people) AS people,
       (SELECT count(*) FROM organisations) AS organisations,
       (SELECT count(*) FROM sources WHERE status = 'ACTIVE') AS active_sources,
       (SELECT count(*) FROM source_items WHERE created_at > now() - interval '24 hours') AS items_added_24h,
       (SELECT count(*) FROM source_items WHERE created_at > now() - interval '7 days') AS items_added_7d,
       (SELECT count(*) FROM source_items WHERE updated_at > now() - interval '7 days' AND created_at <= now() - interval '7 days') AS items_updated_7d,
       (SELECT count(*) FROM ingestion_runs WHERE status = 'FAILED' AND started_at > now() - interval '7 days') AS failed_source_runs`,
  );
  const stats: Record<string, number> = {};
  for (const [key, value] of Object.entries(row.rows[0] ?? {})) {
    stats[key] = Number(value);
  }
  return stats;
}

export async function browseSources(
  db: Queryable,
  filters: { category?: string; status?: string; updateFrequency?: string },
): Promise<unknown[]> {
  const rows = await db.query(
    `SELECT slug AS source_id, name, category, status, update_frequency, access_class,
            official_homepage, collection_url, enabled, item_count, coverage_notes,
            last_successful_run, last_attempted_run
     FROM sources
     WHERE ($1::text IS NULL OR category = $1)
       AND ($2::text IS NULL OR status = $2)
       AND ($3::text IS NULL OR update_frequency = $3)
     ORDER BY category, name`,
    [filters.category ?? null, filters.status ?? null, filters.updateFrequency ?? null],
  );
  return rows.rows;
}

export async function sourceStatus(db: Queryable, sourceId: string): Promise<Record<string, unknown> | null> {
  const row = await db.query(
    `SELECT s.slug AS source_id, s.status, s.item_count, s.access_class, s.coverage_notes,
            s.last_attempted_run AS last_attempt, s.last_successful_run AS last_success,
            s.last_item_seen_at AS last_new_item,
            (
              SELECT message FROM ingestion_errors e
              WHERE e.source_id = s.id AND e.resolved = false
              ORDER BY e.last_seen_at DESC LIMIT 1
            ) AS latest_error
     FROM sources s
     WHERE s.slug = $1`,
    [sourceId],
  );
  return (row.rows[0] as Record<string, unknown> | undefined) ?? null;
}

export async function browseCategories(db: Queryable): Promise<Record<string, unknown>> {
  const [sectors, problems, technologies, types, geos] = await Promise.all([
    db.query(`SELECT slug, name, parent_id::text FROM sectors ORDER BY name`),
    db.query(`SELECT slug, name, parent_id::text FROM problems ORDER BY name`),
    db.query(`SELECT slug, name, parent_id::text FROM technologies ORDER BY name`),
    db.query(`SELECT code, label FROM resource_types ORDER BY code`),
    db.query(`SELECT DISTINCT country_name, country_code FROM locations WHERE country_code IS NOT NULL ORDER BY country_name LIMIT 200`),
  ]);
  return {
    sectors: sectors.rows,
    problems: problems.rows,
    technologies: technologies.rows,
    resource_types: types.rows,
    geographies: geos.rows,
  };
}

export async function searchPeople(
  db: Queryable,
  input: { query?: string; country?: string; organisation?: string; limit: number },
): Promise<unknown[]> {
  const rows = await db.query(
    `SELECT p.id::text AS person_id, p.name, p.role, p.country, p.public_profile_url,
            o.name AS organisation,
            COALESCE((
              SELECT json_agg(json_build_object('resource_id', rp.resource_id::text, 'relationship', rp.relationship))
              FROM resource_people rp WHERE rp.person_id = p.id
            ), '[]'::json) AS resources
     FROM people p
     LEFT JOIN organisations o ON o.id = p.organisation_id
     WHERE ($1::text IS NULL OR p.search_vector @@ websearch_to_tsquery('english', $1)
            OR p.name ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR lower(p.country) = lower($2))
       AND ($3::text IS NULL OR o.name ILIKE '%' || $3 || '%')
     ORDER BY p.name
     LIMIT $4`,
    [input.query || null, input.country ?? null, input.organisation ?? null, input.limit],
  );
  return rows.rows;
}

export async function searchOrganisations(
  db: Queryable,
  input: { query?: string; country?: string; organisationType?: string; limit: number },
): Promise<unknown[]> {
  const rows = await db.query(
    `SELECT o.id::text AS organisation_id, o.name, o.organisation_type, o.country, o.website, o.description,
            COALESCE((
              SELECT json_agg(json_build_object('resource_id', ro.resource_id::text, 'relationship', ro.relationship))
              FROM resource_organisations ro WHERE ro.organisation_id = o.id
            ), '[]'::json) AS resources
     FROM organisations o
     WHERE ($1::text IS NULL OR o.search_vector @@ websearch_to_tsquery('english', $1)
            OR o.name ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR lower(o.country) = lower($2))
       AND ($3::text IS NULL OR o.organisation_type = $3)
     ORDER BY o.name
     LIMIT $4`,
    [input.query || null, input.country ?? null, input.organisationType ?? null, input.limit],
  );
  return rows.rows;
}
