import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMigrations,
  closePool,
  getPool,
  mergeDuplicateOrganisations,
} from "../../packages/database/src/index.ts";

const databaseUrl = process.env.DATABASE_URL;

test("mergeDuplicateOrganisations merges normalised-name and slug duplicates", { skip: !databaseUrl }, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const a = await pool.query<{ id: string }>(
    `INSERT INTO organisations (name, slug) VALUES ('Acme Solar Ltd', 'acme-solar-ltd') RETURNING id::text`,
  );
  const b = await pool.query<{ id: string }>(
    `INSERT INTO organisations (name, slug) VALUES ('ACME   Solar  Ltd', 'acme-solar-ltd-duplicate') RETURNING id::text`,
  );
  try {
    const result = await mergeDuplicateOrganisations(pool);
    assert.ok(result.removed >= 1);
    const remaining = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM organisations WHERE id = ANY($1::uuid[])`,
      [[a.rows[0].id, b.rows[0].id]],
    );
    assert.equal(Number(remaining.rows[0].count), 1);
  } finally {
    await pool.query("DELETE FROM organisations WHERE id = ANY($1::uuid[])", [[a.rows[0].id, b.rows[0].id]]);
    await closePool();
  }
});
