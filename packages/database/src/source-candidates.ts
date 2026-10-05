import { canonicaliseUrl } from "@alice/shared";
import type { Queryable } from "./pool.js";

export type SourceCandidateRow = {
  id: string;
  name: string;
  homepage: string | null;
  notes: string;
  suggested_by: string;
  status: string;
  created_at: Date;
};

export function normalizeCandidateUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }
  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  return canonicaliseUrl(withScheme);
}

export function defaultCandidateName(homepage: string, provided?: string | null): string {
  const name = provided?.trim();
  if (name) return name.slice(0, 200);
  try {
    const host = new URL(homepage).hostname.replace(/^www\./i, "");
    return host.slice(0, 200) || "New source";
  } catch {
    return "New source";
  }
}

export async function findSourceCandidateByHomepage(
  db: Queryable,
  homepage: string,
): Promise<SourceCandidateRow | null> {
  const row = await db.query<SourceCandidateRow>(
    `SELECT id::text AS id, name, homepage, notes, suggested_by, status, created_at
     FROM source_candidates
     WHERE homepage = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [homepage],
  );
  return row.rows[0] ?? null;
}

export async function insertSourceCandidate(
  db: Queryable,
  input: {
    url: string;
    name?: string | null;
    notes?: string | null;
    suggestedBy?: string;
  },
): Promise<{ row: SourceCandidateRow; duplicate: boolean }> {
  const homepage = normalizeCandidateUrl(input.url);
  const existing = await findSourceCandidateByHomepage(db, homepage);
  if (existing) {
    return { row: existing, duplicate: true };
  }
  const name = defaultCandidateName(homepage, input.name);
  const notes = (input.notes ?? "").trim().slice(0, 4000);
  const suggestedBy = (input.suggestedBy ?? "admin").slice(0, 120);
  const inserted = await db.query<SourceCandidateRow>(
    `INSERT INTO source_candidates (name, homepage, notes, suggested_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text AS id, name, homepage, notes, suggested_by, status, created_at`,
    [name, homepage, notes, suggestedBy],
  );
  const row = inserted.rows[0];
  if (!row) throw new Error("Failed to record source candidate");
  return { row, duplicate: false };
}

export async function listSourceCandidates(db: Queryable, limit = 20): Promise<SourceCandidateRow[]> {
  const capped = Math.min(Math.max(limit, 1), 100);
  const rows = await db.query<SourceCandidateRow>(
    `SELECT id::text AS id, name, homepage, notes, suggested_by, status, created_at
     FROM source_candidates
     ORDER BY created_at DESC
     LIMIT $1`,
    [capped],
  );
  return rows.rows;
}

export async function countSourceCandidates(db: Queryable): Promise<number> {
  const row = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM source_candidates`);
  return Number(row.rows[0]?.count ?? 0);
}
