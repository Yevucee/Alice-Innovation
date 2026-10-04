import {
  isInvalidOrganisationName,
  isSlugLikeSummary,
  mergeColonSplitTitle,
  normaliseCountryDisplayName,
  repairSourceSummary,
  summaryEqualsTitle,
  truncateAtWordBoundary,
} from "@alice/shared";
import type { Queryable } from "./pool.js";

export interface DataQualityRepairCounts {
  scanned: number;
  orgs_rejected: number;
  org_links_removed: number;
  orphan_orgs_deleted: number;
  summaries_repaired: number;
  titles_repaired: number;
  resources_retyped: number;
  countries_normalised: number;
  resources_updated: number;
  reembed_resource_ids: string[];
}

export interface DataQualityRepairBatchResult extends DataQualityRepairCounts {
  offset: number;
  next_offset: number;
  complete: boolean;
}

const BATCH = 250;

async function deleteOrphanOrganisations(db: Queryable): Promise<number> {
  const deleted = await db.query<{ id: string }>(
    `DELETE FROM organisations o
     WHERE NOT EXISTS (SELECT 1 FROM resource_organisations ro WHERE ro.organisation_id = o.id)
       AND NOT EXISTS (SELECT 1 FROM people p WHERE p.organisation_id = o.id)
     RETURNING o.id::text`,
  );
  return deleted.rowCount ?? 0;
}

export async function retypeApoliticalArticles(db: Queryable): Promise<number> {
  const updated = await db.query(
    `UPDATE resources r
     SET resource_type = 'ARTICLE',
         updated_at = now(),
         embedding_content_hash = NULL
     FROM resource_source_links rsl
     JOIN source_items si ON si.id = rsl.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE rsl.resource_id = r.id
       AND s.slug = 'apolitical'
       AND r.resource_type = 'CASE_STUDY'
       AND r.active`,
  );
  return updated.rowCount ?? 0;
}

export async function runDataQualityRepairBatch(
  db: Queryable,
  input: { offset: number; retypeApoliticalDone?: boolean },
): Promise<DataQualityRepairBatchResult> {
  const counts: DataQualityRepairCounts = {
    scanned: 0,
    orgs_rejected: 0,
    org_links_removed: 0,
    orphan_orgs_deleted: 0,
    summaries_repaired: 0,
    titles_repaired: 0,
    resources_retyped: 0,
    countries_normalised: 0,
    resources_updated: 0,
    reembed_resource_ids: [],
  };

  if (!input.retypeApoliticalDone) {
    counts.resources_retyped = await retypeApoliticalArticles(db);
  }

  const rows = await db.query<{
    id: string;
    title: string;
    source_summary: string;
    extracted_index_text: string;
    primary_country_name: string | null;
    source_name: string | null;
    org_name: string | null;
  }>(
    `SELECT DISTINCT ON (r.id)
            r.id::text,
            r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            r.primary_country_name,
            s.name AS source_name,
            (
              SELECT o.name FROM resource_organisations ro
              JOIN organisations o ON o.id = ro.organisation_id
              WHERE ro.resource_id = r.id AND ro.is_primary IS TRUE
              LIMIT 1
            ) AS org_name
     FROM resources r
     LEFT JOIN resource_source_links rsl ON rsl.resource_id = r.id
     LEFT JOIN source_items si ON si.id = rsl.source_item_id
     LEFT JOIN sources s ON s.id = si.source_id
     WHERE r.active
       AND r.resource_type <> 'ARTICLE'
     ORDER BY r.id, si.updated_at DESC NULLS LAST
     OFFSET $1 LIMIT $2`,
    [input.offset, BATCH],
  );

  if (rows.rows.length === 0) {
    counts.orphan_orgs_deleted = await deleteOrphanOrganisations(db);
    return {
      ...counts,
      offset: input.offset,
      next_offset: input.offset,
      complete: true,
    };
  }

  for (const row of rows.rows) {
    counts.scanned += 1;
    let title = row.title;
    let summary = row.source_summary;
    let changed = false;

    const colon = mergeColonSplitTitle(title, summary);
    if (colon.title !== title || colon.summary !== summary) {
      title = colon.title;
      summary = colon.summary;
      counts.titles_repaired += 1;
      changed = true;
    }

    const repairedSummary = repairSourceSummary({
      title,
      summary,
      bodyText: row.extracted_index_text,
    });
    if (repairedSummary !== row.source_summary) {
      summary = repairedSummary;
      counts.summaries_repaired += 1;
      changed = true;
    }

    const countryNorm = normaliseCountryDisplayName(row.primary_country_name);
    if (countryNorm !== row.primary_country_name) {
      counts.countries_normalised += 1;
      changed = true;
    }

    if (row.org_name && isInvalidOrganisationName(row.org_name, { resourceTitle: title, sourceName: row.source_name })) {
      await db.query(
        `DELETE FROM resource_organisations ro
         USING organisations o
         WHERE ro.organisation_id = o.id AND ro.resource_id = $1::uuid AND o.name = $2`,
        [row.id, row.org_name],
      );
      counts.orgs_rejected += 1;
      counts.org_links_removed += 1;
      changed = true;
    }

    if (changed) {
      const newTitle = truncateAtWordBoundary(title, 300);
      const newSummary = truncateAtWordBoundary(summary, 500);
      await db.query(
        `UPDATE resources
         SET canonical_title = $2,
             source_summary = $3,
             primary_country_name = COALESCE($4, primary_country_name),
             embedding_content_hash = NULL,
             updated_at = now()
         WHERE id = $1::uuid`,
        [row.id, newTitle, newSummary, countryNorm],
      );
      counts.resources_updated += 1;
      counts.reembed_resource_ids.push(row.id);
    }
  }

  counts.orphan_orgs_deleted = await deleteOrphanOrganisations(db);

  const next_offset = input.offset + rows.rows.length;
  return {
    ...counts,
    offset: input.offset,
    next_offset,
    complete: rows.rows.length < BATCH,
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
    source_name: string | null;
    source_slug: string | null;
    org_name: string | null;
  }>(
    `SELECT r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            s.name AS source_name,
            s.slug AS source_slug,
            (
              SELECT o.name FROM resource_organisations ro
              JOIN organisations o ON o.id = ro.organisation_id
              WHERE ro.resource_id = r.id AND ro.is_primary IS TRUE
              LIMIT 1
            ) AS org_name
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

    const reasons: string[] = [];
    if (row.org_name && isInvalidOrganisationName(row.org_name, { resourceTitle: row.title, sourceName: row.source_name })) {
      reasons.push("invalid_org_name");
    }
    if (summaryEqualsTitle(row.title, row.source_summary)) {
      reasons.push("summary_equals_title");
    }
    if (isSlugLikeSummary(row.source_summary)) {
      reasons.push("slug_summary");
    }
    if (reasons.length === 0) reasons.push("needs_review");
    for (const code of reasons) {
      byReason[code] = (byReason[code] ?? 0) + 1;
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
