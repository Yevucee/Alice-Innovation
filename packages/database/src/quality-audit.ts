import type { NormalisedDraft } from "@alice/shared";
import { evaluateDraftQuality } from "@alice/shared";
import type { Queryable } from "./pool.js";
import { latestQualityReviewBacklogRun } from "./quality-review-backlog.js";

export interface QualityAuditRow {
  entity_type: "resource" | "person" | "organisation";
  id: string;
  title_or_name: string;
  source_slug: string | null;
  url: string | null;
  reason_codes: string[];
  proposed_action: "NEEDS_REVIEW";
}

export interface QualityAuditSummary {
  scanned: number;
  flagged: number;
  reason_counts: Record<string, number>;
  rows: QualityAuditRow[];
}

const LEGAL_FORM_ORG = [
  /for-profit/i,
  /non-profit/i,
  /not registered as any organization/i,
  /not registered as any organisation/i,
  /b-corp/i,
];

function bump(counts: Record<string, number>, code: string): void {
  counts[code] = (counts[code] ?? 0) + 1;
}

export function auditDraftShape(draft: Pick<
  NormalisedDraft,
  "title" | "sourceSummary" | "extractedText" | "organisationName" | "personName" | "rawMetadata"
>): string[] {
  return evaluateDraftQuality({
    ...draft,
    resourceType: "SOLUTION",
    externalId: "audit",
    canonicalUrl: "https://audit.local/item",
    originalUrl: "https://audit.local/item",
    language: "en",
    imageUrl: null,
    publishedAt: null,
    countryName: null,
    countryCode: null,
    continentName: null,
    tags: [],
    evidenceStage: "UNKNOWN",
    evidenceBasis: "UNKNOWN",
    maturityStage: "UNKNOWN",
    costLevel: "UNKNOWN",
    commercialStatus: "UNKNOWN",
    etag: null,
    lastModified: null,
  }).reasons;
}

export async function loadResourcesForQualityAudit(
  db: Queryable,
  resourceIds: string[] | null,
  limit: number | null,
): Promise<Array<{
  id: string;
  title: string;
  source_summary: string;
  extracted_index_text: string;
  review_status: string;
  source_slug: string | null;
  url: string | null;
  raw_metadata: Record<string, unknown>;
  quality_audit_verified_at: Date | null;
}>> {
  const rows = await db.query(
    `SELECT r.id::text,
            r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            r.review_status,
            (
              SELECT s.slug FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              JOIN sources s ON s.id = si.source_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC
              LIMIT 1
            ) AS source_slug,
            (
              SELECT si.canonical_url FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC
              LIMIT 1
            ) AS url,
            COALESCE((
              SELECT si.raw_metadata_json FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC
              LIMIT 1
            ), '{}'::jsonb) AS raw_metadata,
            r.quality_audit_verified_at
     FROM resources r
     WHERE r.active
       AND ($1::uuid[] IS NULL OR r.id = ANY($1::uuid[]))
     ORDER BY r.updated_at DESC
     ${limit == null ? "" : "LIMIT $2"}`,
    limit == null
      ? [resourceIds && resourceIds.length > 0 ? resourceIds : null]
      : [resourceIds && resourceIds.length > 0 ? resourceIds : null, limit],
  );
  return rows.rows as Array<{
    id: string;
    title: string;
    source_summary: string;
    extracted_index_text: string;
    review_status: string;
    source_slug: string | null;
    url: string | null;
    raw_metadata: Record<string, unknown>;
    quality_audit_verified_at: Date | null;
  }>;
}

export async function runQualityAudit(
  db: Queryable,
  input: {
    resourceIds?: string[] | null;
    limit?: number | null;
    dryRun: boolean;
    apply?: boolean;
  },
): Promise<QualityAuditSummary> {
  const limit = input.limit === undefined ? null : input.limit;
  const resources = await loadResourcesForQualityAudit(db, input.resourceIds ?? null, limit);
  const reason_counts: Record<string, number> = {};
  const rows: QualityAuditRow[] = [];

  for (const resource of resources) {
    if (resource.review_status === "NEEDS_REVIEW" || resource.review_status === "ARCHIVED" || resource.review_status === "SOURCE_LIMITED") {
      continue;
    }
    if (resource.quality_audit_verified_at) {
      const verifiedMs = new Date(resource.quality_audit_verified_at).getTime();
      if (verifiedMs > Date.now() - 30 * 24 * 60 * 60 * 1000) {
        continue;
      }
    }
    const reasons = auditDraftShape({
      title: resource.title,
      sourceSummary: resource.source_summary,
      extractedText: resource.extracted_index_text,
      organisationName: null,
      personName: null,
      rawMetadata: resource.raw_metadata ?? {},
    });
    if (reasons.length === 0) continue;
    for (const code of reasons) bump(reason_counts, code);
    rows.push({
      entity_type: "resource",
      id: resource.id,
      title_or_name: resource.title,
      source_slug: resource.source_slug,
      url: resource.url,
      reason_codes: reasons,
      proposed_action: "NEEDS_REVIEW",
    });
  }

  const people = await db.query<{ id: string; name: string }>(
    `SELECT id::text, name FROM people
     WHERE length(trim(name)) < 3 OR name ~* '^[a-z](\\s+[a-z]){0,2}$'
     LIMIT 5000`,
  );
  for (const person of people.rows) {
    bump(reason_counts, "suspicious_person_name");
    rows.push({
      entity_type: "person",
      id: person.id,
      title_or_name: person.name,
      source_slug: null,
      url: null,
      reason_codes: ["suspicious_person_name"],
      proposed_action: "NEEDS_REVIEW",
    });
  }

  const orgs = await db.query<{ id: string; name: string }>(
    `SELECT id::text, name FROM organisations LIMIT 10000`,
  );
  for (const org of orgs.rows) {
    if (!LEGAL_FORM_ORG.some((pattern) => pattern.test(org.name))) continue;
    bump(reason_counts, "legal_form_org_name");
    rows.push({
      entity_type: "organisation",
      id: org.id,
      title_or_name: org.name,
      source_slug: null,
      url: null,
      reason_codes: ["legal_form_org_name"],
      proposed_action: "NEEDS_REVIEW",
    });
  }

  if (input.apply && !input.dryRun) {
    for (const row of rows.filter((entry) => entry.entity_type === "resource")) {
      await db.query(
        `UPDATE resources
         SET review_status = 'NEEDS_REVIEW',
             review_reason_codes = $2::text[],
             updated_at = now()
         WHERE id = $1::uuid
           AND review_status NOT IN ('ARCHIVED', 'ALICE_PICK', 'REVIEWED', 'SOURCE_LIMITED')
           AND (
             review_status <> 'AUTO_INGESTED'
             OR review_reason_codes IS DISTINCT FROM $2::text[]
           )`,
        [row.id, row.reason_codes],
      );
    }
  }

  await db.query(
    `INSERT INTO quality_audit_runs (completed_at, flagged, scanned, dry_run, reason_counts)
     VALUES (now(), $1, $2, $3, $4::jsonb)`,
    [rows.filter((row) => row.entity_type === "resource").length, resources.length, input.dryRun, JSON.stringify(reason_counts)],
  );

  return {
    scanned: resources.length,
    flagged: rows.filter((row) => row.entity_type === "resource").length,
    reason_counts,
    rows,
  };
}

export function summariseReasonCounts(rows: QualityAuditRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const code of row.reason_codes) bump(counts, code);
  }
  return counts;
}

const REVIEW_BACKFILL_BATCH = 250;

export async function backfillReviewReasonCodesBatch(
  db: Queryable,
  input: { offset: number },
): Promise<{ scanned: number; updated: number; offset: number; next_offset: number; complete: boolean }> {
  const rows = await db.query<{
    id: string;
    title: string;
    source_summary: string;
    extracted_index_text: string;
    organisation_name: string | null;
    person_name: string | null;
    raw_metadata: Record<string, unknown>;
  }>(
    `SELECT r.id::text,
            r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            (
              SELECT o.name FROM resource_organisations ro
              JOIN organisations o ON o.id = ro.organisation_id
              WHERE ro.resource_id = r.id AND ro.is_primary IS TRUE
              LIMIT 1
            ) AS organisation_name,
            (
              SELECT p.name FROM resource_people rp
              JOIN people p ON p.id = rp.person_id
              WHERE rp.resource_id = r.id
              ORDER BY p.name
              LIMIT 1
            ) AS person_name,
            COALESCE((
              SELECT si.raw_metadata_json FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.updated_at DESC NULLS LAST
              LIMIT 1
            ), '{}'::jsonb) AS raw_metadata
     FROM resources r
     WHERE r.active
       AND r.review_status = 'NEEDS_REVIEW'
       AND cardinality(r.review_reason_codes) = 0
     ORDER BY r.id
     OFFSET $1 LIMIT $2`,
    [input.offset, REVIEW_BACKFILL_BATCH],
  );

  let updated = 0;
  for (const row of rows.rows) {
    const reasons = auditDraftShape({
      title: row.title,
      sourceSummary: row.source_summary,
      extractedText: row.extracted_index_text,
      organisationName: row.organisation_name,
      personName: row.person_name,
      rawMetadata: row.raw_metadata ?? {},
    });
    if (reasons.length === 0) continue;
    await db.query(
      `UPDATE resources SET review_reason_codes = $2::text[], updated_at = now() WHERE id = $1::uuid`,
      [row.id, reasons],
    );
    updated += 1;
  }

  const next_offset = input.offset + rows.rows.length;
  return {
    scanned: rows.rows.length,
    updated,
    offset: input.offset,
    next_offset,
    complete: rows.rows.length < REVIEW_BACKFILL_BATCH,
  };
}

export async function qualityReviewBreakdown(db: Queryable): Promise<{
  by_source: Array<{ source_slug: string; count: number }>;
  by_reason: Record<string, number>;
}> {
  const rows = await db.query<{
    title: string;
    source_summary: string;
    extracted_index_text: string;
    source_slug: string | null;
    organisation_name: string | null;
    person_name: string | null;
    raw_metadata: Record<string, unknown>;
    review_reason_codes: string[];
  }>(
    `SELECT r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            s.slug AS source_slug,
            r.review_reason_codes,
            (
              SELECT o.name FROM resource_organisations ro
              JOIN organisations o ON o.id = ro.organisation_id
              WHERE ro.resource_id = r.id AND ro.is_primary IS TRUE
              LIMIT 1
            ) AS organisation_name,
            (
              SELECT p.name FROM resource_people rp
              JOIN people p ON p.id = rp.person_id
              WHERE rp.resource_id = r.id
              ORDER BY p.name
              LIMIT 1
            ) AS person_name,
            COALESCE((
              SELECT si.raw_metadata_json FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.updated_at DESC NULLS LAST
              LIMIT 1
            ), '{}'::jsonb) AS raw_metadata
     FROM resources r
     LEFT JOIN resource_source_links rsl ON rsl.resource_id = r.id
     LEFT JOIN source_items si ON si.id = rsl.source_item_id
     LEFT JOIN sources s ON s.id = si.source_id
     WHERE r.active AND r.review_status = 'NEEDS_REVIEW'`,
  );

  const bySource = new Map<string, number>();
  const byReason: Record<string, number> = {};

  for (const row of rows.rows) {
    const slug = row.source_slug ?? "unknown";
    bySource.set(slug, (bySource.get(slug) ?? 0) + 1);

    const reasons =
      row.review_reason_codes?.length > 0
        ? row.review_reason_codes
        : auditDraftShape({
            title: row.title,
            sourceSummary: row.source_summary,
            extractedText: row.extracted_index_text,
            organisationName: row.organisation_name,
            personName: row.person_name,
            rawMetadata: row.raw_metadata ?? {},
          });
    if (reasons.length === 0) {
      bump(byReason, "needs_review");
      continue;
    }
    for (const code of reasons) {
      bump(byReason, code);
    }
  }

  return {
    by_source: [...bySource.entries()]
      .map(([source_slug, count]) => ({ source_slug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    by_reason: byReason,
  };
}

export async function qualityAdminStatus(db: Queryable): Promise<{
  needs_review: number;
  last_run: Record<string, unknown> | null;
  review_breakdown: Awaited<ReturnType<typeof qualityReviewBreakdown>>;
  backlog_run: Awaited<ReturnType<typeof latestQualityReviewBacklogRun>>;
}> {
  const needs = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM resources WHERE active AND review_status = 'NEEDS_REVIEW'`,
  );
  const last = await db.query(
    `SELECT id::text, started_at, completed_at, flagged, scanned, dry_run, reason_counts
     FROM quality_audit_runs ORDER BY started_at DESC LIMIT 1`,
  );
  const review_breakdown = await qualityReviewBreakdown(db);
  const backlog_run = await latestQualityReviewBacklogRun(db);
  return {
    needs_review: Number(needs.rows[0]?.count ?? 0),
    last_run: last.rows[0] ?? null,
    review_breakdown,
    backlog_run,
  };
}
