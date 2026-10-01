import { applyMigrations, seedSources, seedTaxonomy } from "../../packages/database/src/index.ts";
import type { Queryable } from "../../packages/database/src/pool.ts";
import { loadSources } from "@alice/source-registry";

const SOURCE_SLUG = "mit-solve";

export interface SearchFixtureIds {
  waterFilterId: string;
  solarId: string;
  irrigationId: string;
  browseOnlyId: string;
}

function embeddingVector(seed: number): string {
  const values = Array.from({ length: 1536 }, (_, index) => ((index + seed) % 97) * 0.0001);
  return `[${values.join(",")}]`;
}

export async function ensureSearchTestDatabase(db: Queryable): Promise<void> {
  await applyMigrations(db);
  await seedTaxonomy(db);
  await seedSources(db, loadSources());
}

async function resourceIdForExternalId(db: Queryable, externalId: string): Promise<string | null> {
  const row = await db.query<{ id: string }>(
    `SELECT r.id::text
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE s.slug = $1 AND si.external_id = $2`,
    [SOURCE_SLUG, externalId],
  );
  return row.rows[0]?.id ?? null;
}

async function upsertSearchFixtureResource(
  db: Queryable,
  externalId: string,
  title: string,
  summary: string,
  options: { reviewStatus: string; embeddingSeed: number; technologySlug: string },
): Promise<string> {
  const source = await db.query<{ id: string }>(
    "SELECT id::text FROM sources WHERE slug = $1",
    [SOURCE_SLUG],
  );
  const sourceId = source.rows[0]?.id;
  if (!sourceId) throw new Error(`missing source ${SOURCE_SLUG}`);

  const indexed = `${summary} ${summary} Additional indexed text for search quality browse and semantic retrieval tests.`;
  let resourceId = await resourceIdForExternalId(db, externalId);
  if (!resourceId) {
    const created = await db.query<{ id: string }>(
      `INSERT INTO resources (
         resource_type, canonical_title, source_summary, extracted_index_text,
         evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
         language, primary_country_code, primary_country_name, review_status, embedding
       ) VALUES (
         'SOLUTION', $1, $2, $3,
         'DEPLOYED', 'EDITORIALLY_CURATED', 'GROWING', 'LOW', 'AVAILABLE',
         'en', 'ke', 'Kenya', $4, $5::vector
       )
       RETURNING id::text`,
      [title, summary, indexed, options.reviewStatus, embeddingVector(options.embeddingSeed)],
    );
    resourceId = created.rows[0]!.id;
  } else {
    await db.query(
      `UPDATE resources SET
         canonical_title = $2,
         source_summary = $3,
         extracted_index_text = $4,
         review_status = $5,
         embedding = $6::vector,
         active = true,
         updated_at = now()
       WHERE id = $1::uuid`,
      [resourceId, title, summary, indexed, options.reviewStatus, embeddingVector(options.embeddingSeed)],
    );
  }

  await db.query(
    `INSERT INTO source_items (
       source_id, external_id, canonical_url, original_url, title, source_description,
       content_hash, raw_metadata_json, extracted_text, language, active, resource_id, last_fetched_at
     ) VALUES ($1, $2, $3, $3, $4, $5, $6, '{}'::jsonb, $5, 'en', true, $7::uuid, now())
     ON CONFLICT (source_id, external_id) DO UPDATE SET
       resource_id = EXCLUDED.resource_id,
       title = EXCLUDED.title,
       source_description = EXCLUDED.source_description`,
    [
      sourceId,
      externalId,
      `https://solve.mit.edu/solutions/search-fixture-${externalId}`,
      title,
      summary,
      `fixture-hash-${externalId}`,
      resourceId,
    ],
  );

  await db.query(
    `INSERT INTO resource_source_links (resource_id, source_item_id, relationship)
     SELECT $1::uuid, si.id, 'DESCRIBED_BY'
     FROM source_items si
     WHERE si.source_id = $2::uuid AND si.external_id = $3
     ON CONFLICT (resource_id, source_item_id) DO NOTHING`,
    [resourceId, sourceId, externalId],
  );

  await db.query(
    `INSERT INTO resource_technologies (resource_id, technology_id, origin)
     SELECT $1::uuid, t.id, 'SOURCE' FROM technologies t WHERE t.slug = $2
     ON CONFLICT DO NOTHING`,
    [resourceId, options.technologySlug],
  );

  await db.query(
    `INSERT INTO resource_sectors (resource_id, sector_id, origin)
     SELECT $1::uuid, s.id, 'SOURCE' FROM sectors s WHERE s.slug = 'water'
     ON CONFLICT DO NOTHING`,
    [resourceId],
  );

  const loc = await db.query<{ id: string }>(
    `INSERT INTO locations (country_name, country_code, continent, city)
     VALUES ('Kenya', 'KE', 'Africa', NULL)
     ON CONFLICT (country_name, country_code, city) DO NOTHING
     RETURNING id::text`,
  );
  const locationId = loc.rows[0]?.id ?? (await db.query<{ id: string }>(
    "SELECT id::text FROM locations WHERE country_code = 'KE' AND city IS NULL LIMIT 1",
  )).rows[0]?.id;
  if (locationId) {
    await db.query(
      `INSERT INTO resource_locations (resource_id, location_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT DO NOTHING`,
      [resourceId, locationId],
    );
  }

  return resourceId;
}

export async function seedSearchResourceFixtures(db: Queryable): Promise<SearchFixtureIds> {
  const waterFilterId = await upsertSearchFixtureResource(
    db,
    "fixture-water-filter",
    "Low cost water filtration for rural villages",
    "Affordable ceramic water filter improving safe drinking water for off-grid rural households.",
    { reviewStatus: "REVIEWED", embeddingSeed: 3, technologySlug: "filtration" },
  );
  const solarId = await upsertSearchFixtureResource(
    db,
    "fixture-solar-offgrid",
    "Affordable solar for off-grid rural homes",
    "Low-cost photovoltaic kits for off-grid rural electrification and lighting.",
    { reviewStatus: "REVIEWED", embeddingSeed: 7, technologySlug: "solar" },
  );
  const irrigationId = await upsertSearchFixtureResource(
    db,
    "fixture-drip-irrigation",
    "Drip irrigation for smallholder farmers",
    "Low-pressure drip irrigation helping smallholder farmers grow vegetables with less water.",
    { reviewStatus: "REVIEWED", embeddingSeed: 11, technologySlug: "drip-irrigation" },
  );
  const browseOnlyId = await upsertSearchFixtureResource(
    db,
    "fixture-browse-quality",
    "Community water kiosk programme",
    "Reviewed community water kiosk model with long-form description for quality browse surfaces and homepage lists.",
    { reviewStatus: "ALICE_PICK", embeddingSeed: 13, technologySlug: "filtration" },
  );
  return { waterFilterId, solarId, irrigationId, browseOnlyId };
}
