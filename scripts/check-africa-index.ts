import { getPool, closePool } from "../packages/database/src/index.js";
import { resourcesFromAfrica } from "../packages/database/src/browse.js";
import { libraryStats } from "../packages/database/src/stats.js";

async function main() {
  const db = getPool();
  const stats = await libraryStats(db);
  const africa = await resourcesFromAfrica(db, 6);
  const primary = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM resources r
     WHERE r.active AND r.primary_country_code = 'NG'`,
  );
  const loc = await db.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n FROM resources r
     JOIN resource_locations rl ON rl.resource_id = r.id
     JOIN locations loc ON loc.id = rl.location_id
     WHERE r.active AND loc.country_code = 'NG'`,
  );
  const africaSrc = await db.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active AND s.category = 'africa-innovation' AND s.enabled`,
  );
  const runs = await db.query(
    `SELECT s.slug, ir.status, ir.started_at
     FROM ingestion_runs ir
     JOIN sources s ON s.id = ir.source_id
     WHERE s.slug = 'digital-africa' ORDER BY ir.started_at DESC LIMIT 3`,
  );
  console.log(JSON.stringify({
    canonical_resources: stats.canonical_resources,
    fromAfricaSection: africa.length,
    primaryCountryNG: primary.rows[0]?.n,
    locationNG: loc.rows[0]?.n,
    africaInnovationEnabledResources: africaSrc.rows[0]?.n,
    digitalAfricaRuns: runs.rows,
  }, null, 2));
  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
