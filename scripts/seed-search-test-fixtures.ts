import { closePool, getPool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";
import {
  ensureSearchTestDatabase,
  seedSearchResourceFixtures,
} from "../tests/helpers/search-fixtures.ts";

loadDotEnv();

const pool = getPool();
await ensureSearchTestDatabase(pool);
const ids = await seedSearchResourceFixtures(pool);
console.log(JSON.stringify({ event: "search_fixtures_seeded", ...ids }));
await closePool();
