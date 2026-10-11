import type { Queryable } from "./pool.js";
import {
  claimPendingIngestRequest,
  type ClaimPendingIngestRequestResult,
  type IngestRequestRow,
} from "./ingest-requests.js";
/** Block manual scope=all without a claim for this long after an admin-button anchor time. */
export const ADMIN_INGEST_GUARD_MS = 90 * 60 * 1000;

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

export type AdminIngestGuardRow = {
  id: string;
  scope: string;
  status: string;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
};

/** Anchor for guard window: completion time if set, else start, else request time. */
export function adminIngestGuardAnchor(row: {
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}): Date {
  return row.completed_at ?? row.started_at ?? row.requested_at;
}

export function isAdminRequestWithinGuardWindow(
  row: {
    requested_at: Date;
    started_at: Date | null;
    completed_at: Date | null;
  },
  nowMs: number,
  guardMs: number = ADMIN_INGEST_GUARD_MS,
): boolean {
  const anchorMs = adminIngestGuardAnchor(row).getTime();
  return nowMs - anchorMs < guardMs;
}

export async function recentAdminIngestRequest(
  db: Queryable,
  withinMs: number = ADMIN_INGEST_GUARD_MS,
): Promise<AdminIngestGuardRow | null> {
  const row = await db.query<AdminIngestGuardRow>(
    `SELECT id::text, scope, status, requested_at, started_at, completed_at
     FROM ingest_requests
     WHERE trigger = 'admin-button'
       AND COALESCE(completed_at, started_at, requested_at)
           > now() - ($1::int * interval '1 millisecond')
     ORDER BY COALESCE(completed_at, started_at, requested_at) DESC
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
          started_at: recent.started_at?.toISOString() ?? null,
          completed_at: recent.completed_at?.toISOString() ?? null,
          guard_anchor_at: adminIngestGuardAnchor(recent).toISOString(),
          guard_ms: ADMIN_INGEST_GUARD_MS,
          env_ingest_scope: input.envIngestScope?.trim() || null,
          explanation:
            "No ingest_requests row to claim and this process would run scope=all (default or INGEST_SCOPE=all). "
            + "A recent Admin ingest request is still inside the post-admin guard window — likely a duplicate Railway start.",
        },
      };
    }
  }

  return { claimed, claimIgnored, skipReason: null, skipDetail: null };
}
