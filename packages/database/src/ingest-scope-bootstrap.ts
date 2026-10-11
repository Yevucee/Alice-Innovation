import type { Queryable } from "./pool.js";
import {
  claimPendingIngestRequest,
  type ClaimPendingIngestRequestResult,
  type IngestRequestRow,
} from "./ingest-requests.js";
export const ADMIN_INGEST_GUARD_MS = 20 * 60 * 1000;

const INGEST_SCOPE_VALUES = [
  "asia",
  "africa",
  "europe",
  "south-america",
  "grants",
  "all",
  "failed-only",
] as const;

export type IngestScopeValue = (typeof INGEST_SCOPE_VALUES)[number];

function parseIngestScopeValue(raw: string | undefined | null): IngestScopeValue {
  const value = (raw ?? "all").trim().toLowerCase();
  if ((INGEST_SCOPE_VALUES as readonly string[]).includes(value)) {
    return value as IngestScopeValue;
  }
  throw new Error(`Invalid ingest scope: ${raw}`);
}

export function resolveIngestScopeAfterClaim(input: {
  scopeArg: string | undefined;
  envIngestScope: string | undefined;
  claimed: IngestRequestRow | null;
}): IngestScopeValue {
  if (input.scopeArg?.trim()) return parseIngestScopeValue(input.scopeArg);
  if (input.claimed) return parseIngestScopeValue(input.claimed.scope);
  if (input.envIngestScope?.trim()) return parseIngestScopeValue(input.envIngestScope);
  return "all";
}

export type IngestScopeBootstrapInput = {
  scopeArg: string | undefined;
  envIngestScope: string | undefined;
  dryRun: boolean;
  cronRun: boolean;
};

export type IngestScopeBootstrapResult = {
  claimed: IngestRequestRow | null;
  claimIgnored: ClaimPendingIngestRequestResult["ignored"];
  /** When set, ingestor should exit without running (manual guard). */
  skipReason: string | null;
  skipDetail: Record<string, unknown> | null;
};

/** Manual Railway start that would run scope=all without claiming the admin row. */
export function shouldGuardManualScopeAll(input: {
  scopeArg: string | undefined;
  claimed: IngestRequestRow | null;
  cronRun: boolean;
  envIngestScope: string | undefined;
}): boolean {
  if (input.cronRun) return false;
  if (input.scopeArg?.trim()) return false;
  if (input.claimed) return false;
  return resolveIngestScopeAfterClaim(input) === "all";
}

export async function recentAdminIngestRequest(
  db: Queryable,
  withinMs: number = ADMIN_INGEST_GUARD_MS,
): Promise<{
  id: string;
  scope: string;
  status: string;
  requested_at: Date;
  completed_at: Date | null;
} | null> {
  const row = await db.query<{
    id: string;
    scope: string;
    status: string;
    requested_at: Date;
    completed_at: Date | null;
  }>(
    `SELECT id::text, scope, status, requested_at, completed_at
     FROM ingest_requests
     WHERE trigger = 'admin-button'
       AND requested_at > now() - ($1::int * interval '1 millisecond')
     ORDER BY requested_at DESC
     LIMIT 1`,
    [withinMs],
  );
  return row.rows[0] ?? null;
}

export async function bootstrapIngestScopeFromRequest(
  db: Queryable,
  input: IngestScopeBootstrapInput,
): Promise<IngestScopeBootstrapResult> {
  let claimed: IngestRequestRow | null = null;
  let claimIgnored: ClaimPendingIngestRequestResult["ignored"] = [];

  if (!input.dryRun) {
    const claimResult = await claimPendingIngestRequest(db, { cronRun: input.cronRun });
    claimIgnored = claimResult.ignored;
    claimed = claimResult.claimed;
  }

  if (
    shouldGuardManualScopeAll({
      scopeArg: input.scopeArg,
      envIngestScope: input.envIngestScope,
      claimed,
      cronRun: input.cronRun,
    })
  ) {
    const recent = await recentAdminIngestRequest(db);
    if (recent) {
      return {
        claimed,
        claimIgnored,
        skipReason: "unscoped_manual_blocked_recent_admin",
        skipDetail: {
          recent_request_id: recent.id,
          recent_scope: recent.scope,
          recent_status: recent.status,
          requested_at: recent.requested_at.toISOString(),
          guard_ms: ADMIN_INGEST_GUARD_MS,
          explanation:
            "No pending ingest_requests row to claim and INGEST_SCOPE is unset, so this process would run scope=all. "
            + "A recent Admin ingest request exists — likely a duplicate Railway start after the scoped run.",
        },
      };
    }
  }

  return { claimed, claimIgnored, skipReason: null, skipDetail: null };
}
