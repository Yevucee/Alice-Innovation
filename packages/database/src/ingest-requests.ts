import type { Queryable } from "./pool.js";

export const INGEST_LOCK_KEY = 84261001;

export type IngestRequestStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface IngestRequestRow {
  id: string;
  scope: string;
  trigger: string;
  status: IngestRequestStatus;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  items_new: number | null;
  duration_ms: number | null;
}

export async function tryIngestAdvisoryLock(db: Queryable): Promise<boolean> {
  const row = await db.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1) AS locked",
    [INGEST_LOCK_KEY],
  );
  return Boolean(row.rows[0]?.locked);
}

export async function releaseIngestAdvisoryLock(db: Queryable): Promise<void> {
  await db.query("SELECT pg_advisory_unlock($1)", [INGEST_LOCK_KEY]);
}

export async function isIngestLockHeld(db: Queryable): Promise<boolean> {
  const row = await db.query<{ held: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_locks
       WHERE locktype = 'advisory'
         AND classid = 0
         AND objid = $1
         AND granted
     ) AS held`,
    [INGEST_LOCK_KEY],
  );
  return Boolean(row.rows[0]?.held);
}

const RATE_LIMIT_MS = 10 * 60 * 1000;

export async function createIngestRequest(
  db: Queryable,
  input: { scope: string; trigger: string },
): Promise<{ id: string } | { error: "rate_limited" | "already_running" }> {
  if (await isIngestLockHeld(db)) {
    return { error: "already_running" };
  }
  const recent = await db.query<{ id: string }>(
    `SELECT id::text FROM ingest_requests
     WHERE scope = $1
       AND requested_at > now() - ($2::int * interval '1 millisecond')
     LIMIT 1`,
    [input.scope, RATE_LIMIT_MS],
  );
  if (recent.rows[0]) {
    return { error: "rate_limited" };
  }
  const pending = await db.query<{ id: string }>(
    `SELECT id::text FROM ingest_requests
     WHERE status IN ('pending', 'running')
     LIMIT 1`,
  );
  if (pending.rows[0]) {
    return { error: "already_running" };
  }
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO ingest_requests (scope, trigger, status)
     VALUES ($1, $2, 'pending')
     RETURNING id::text`,
    [input.scope, input.trigger],
  );
  return { id: inserted.rows[0].id };
}

export async function claimPendingIngestRequest(db: Queryable): Promise<IngestRequestRow | null> {
  const row = await db.query<IngestRequestRow>(
    `UPDATE ingest_requests
     SET status = 'running', started_at = now()
     WHERE id = (
       SELECT id FROM ingest_requests
       WHERE status = 'pending'
       ORDER BY requested_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id::text AS id, scope, trigger, status, requested_at, started_at, completed_at,
               error_message, items_new, duration_ms`,
  );
  return row.rows[0] ?? null;
}

export async function completeIngestRequest(
  db: Queryable,
  id: string,
  input: {
    status: "completed" | "failed" | "cancelled";
    errorMessage?: string | null;
    itemsNew?: number;
    durationMs?: number;
  },
): Promise<void> {
  await db.query(
    `UPDATE ingest_requests
     SET status = $2,
         completed_at = now(),
         error_message = $3,
         items_new = COALESCE($4, items_new),
         duration_ms = COALESCE($5, duration_ms)
     WHERE id = $1::uuid`,
    [id, input.status, input.errorMessage ?? null, input.itemsNew ?? null, input.durationMs ?? null],
  );
}

export interface IngestScopeStatusRow {
  scope: string;
  status: "idle" | "running" | "pending";
  started_at: Date | null;
  last_result: string | null;
  last_items_new: number | null;
  last_duration_ms: number | null;
  last_requested_at: Date | null;
}

export async function ingestScopeAdminStatus(
  db: Queryable,
  scopes: readonly string[],
): Promise<{ lock_held: boolean; scopes: IngestScopeStatusRow[] }> {
  const lockHeld = await isIngestLockHeld(db);
  const rows = await db.query<{
    scope: string;
    status: string;
    started_at: Date | null;
    completed_at: Date | null;
    error_message: string | null;
    items_new: number | null;
    duration_ms: number | null;
    requested_at: Date;
  }>(
    `SELECT DISTINCT ON (scope)
       scope,
       status,
       started_at,
       completed_at,
       error_message,
       items_new,
       duration_ms,
       requested_at
     FROM ingest_requests
     WHERE scope = ANY($1::text[])
     ORDER BY scope, requested_at DESC`,
    [scopes],
  );
  const byScope = new Map(rows.rows.map((row) => [row.scope, row]));
  const scopesOut: IngestScopeStatusRow[] = scopes.map((scope) => {
    const row = byScope.get(scope);
    if (!row) {
      return {
        scope,
        status: lockHeld ? "running" : "idle",
        started_at: null,
        last_result: null,
        last_items_new: null,
        last_duration_ms: null,
        last_requested_at: null,
      };
    }
    let status: IngestScopeStatusRow["status"] = "idle";
    if (row.status === "pending") status = "pending";
    else if (row.status === "running" || lockHeld) status = "running";
    return {
      scope,
      status,
      started_at: row.started_at,
      last_result: row.error_message ?? (row.status === "completed" ? "completed" : row.status),
      last_items_new: row.items_new,
      last_duration_ms: row.duration_ms,
      last_requested_at: row.requested_at,
    };
  });
  return { lock_held: lockHeld, scopes: scopesOut };
}
