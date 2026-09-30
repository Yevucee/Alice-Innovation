import type { Queryable } from "./pool.js";

export async function linkResourceTaxonomy(
  db: Queryable,
  resourceId: string,
  input: { sectors?: string[]; problems?: string[]; technologies?: string[] },
  origin: "SOURCE" | "INTERPRETATION" = "SOURCE",
): Promise<{ sectors: number; problems: number; technologies: number }> {
  let sectors = 0;
  let problems = 0;
  let technologies = 0;

  for (const slug of input.sectors ?? []) {
    const result = await db.query(
      `INSERT INTO resource_sectors (resource_id, sector_id, origin)
       SELECT $1::uuid, id, $3 FROM sectors WHERE slug = $2
       ON CONFLICT (resource_id, sector_id) DO NOTHING`,
      [resourceId, slug, origin],
    );
    sectors += result.rowCount ?? 0;
  }

  for (const slug of input.problems ?? []) {
    const result = await db.query(
      `INSERT INTO resource_problems (resource_id, problem_id, origin)
       SELECT $1::uuid, id, $3 FROM problems WHERE slug = $2
       ON CONFLICT (resource_id, problem_id) DO NOTHING`,
      [resourceId, slug, origin],
    );
    problems += result.rowCount ?? 0;
  }

  for (const slug of input.technologies ?? []) {
    const result = await db.query(
      `INSERT INTO resource_technologies (resource_id, technology_id, origin)
       SELECT $1::uuid, id, $3 FROM technologies WHERE slug = $2
       ON CONFLICT (resource_id, technology_id) DO NOTHING`,
      [resourceId, slug, origin],
    );
    technologies += result.rowCount ?? 0;
  }

  return { sectors, problems, technologies };
}
