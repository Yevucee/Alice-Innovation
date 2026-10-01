import { continentForCountryCode } from "@alice/taxonomy";
import type { Queryable } from "./pool.js";

async function ensureLocation(
  db: Queryable,
  name: string,
  code: string | null,
  continent: string | null = null,
  city: string | null = null,
): Promise<string> {
  const found = await db.query<{ id: string }>(
    `SELECT id::text FROM locations
     WHERE country_name = $1 AND country_code IS NOT DISTINCT FROM $2
       AND city IS NOT DISTINCT FROM $3
       AND continent IS NOT DISTINCT FROM $4
     LIMIT 1`,
    [name, code, city, continent],
  );
  if (found.rows[0]) return found.rows[0].id;
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO locations (country_name, country_code, continent, city)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text`,
    [name, code, continent, city],
  );
  return inserted.rows[0].id;
}

export async function linkResourceCountryLocation(
  db: Queryable,
  resourceId: string,
  input: {
    countryName: string;
    countryCode: string | null;
    city?: string | null;
  },
): Promise<boolean> {
  const continent = input.countryCode ? continentForCountryCode(input.countryCode) : null;
  const locationId = await ensureLocation(
    db,
    input.countryName,
    input.countryCode,
    continent,
    input.city?.trim() || null,
  );
  const linked = await db.query(
    `INSERT INTO resource_locations (resource_id, location_id, relationship)
     VALUES ($1::uuid, $2::uuid, 'OPERATES_IN')
     ON CONFLICT (resource_id, location_id, relationship) DO NOTHING`,
    [resourceId, locationId],
  );
  return (linked.rowCount ?? 0) > 0;
}
