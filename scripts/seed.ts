import { closePool, getPool, seedSources, seedTaxonomy } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { loadSources } from "@alice/source-registry";

loadDotEnv();

const pool = getPool();
await seedTaxonomy(pool);
const count = await seedSources(pool, loadSources());
log("info", "seed_complete", { sources: count });
await closePool();
