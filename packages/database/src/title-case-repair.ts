import { convertAllCapsTitleToTitleCase, looksLikeAllCapsTitle } from "@alice/shared";
import type { Queryable } from "./pool.js";
import { auditDraftShape } from "./quality-audit.js";

const BATCH = 200;

export async function runAllCapsTitleRepairBatch(
  db: Queryable,
  offset: number,
): Promise<{
  scanned: number;
  titles_repaired: number;
  cleared_review: number;
  offset: number;
  next_offset: number;
  complete: boolean;
  reembed_resource_ids: string[];
}> {
  const rows = await db.query<{
    id: string;
    title: string;
    source_summary: string;
    extracted_index_text: string;
    review_reason_codes: string[];
  }>(
    `SELECT r.id::text,
            r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            r.review_reason_codes
     FROM resources r
     WHERE r.active
       AND (
         'all_caps_title' = ANY(r.review_reason_codes)
         OR (
           r.review_status = 'NEEDS_REVIEW'
           AND length(regexp_replace(r.canonical_title, '[^A-Za-z]', '', 'g')) > 6
           AND upper(r.canonical_title) = r.canonical_title
           AND r.canonical_title ~ '[A-Z]'
         )
       )
     ORDER BY r.id
     OFFSET $1 LIMIT $2`,
    [offset, BATCH],
  );

  let titles_repaired = 0;
  let cleared_review = 0;
  const reembed_resource_ids: string[] = [];

  for (const row of rows.rows) {
    if (!looksLikeAllCapsTitle(row.title)) continue;
    const fixedTitle = convertAllCapsTitleToTitleCase(row.title);
    if (fixedTitle === row.title) continue;

    const reasons = auditDraftShape({
      title: fixedTitle,
      sourceSummary: row.source_summary,
      extractedText: row.extracted_index_text,
      organisationName: null,
      personName: null,
      rawMetadata: {},
    }).filter((code) => code !== "all_caps_title");

    if (reasons.length === 0) {
      await db.query(
        `UPDATE resources SET
           canonical_title = $2,
           review_status = 'AUTO_INGESTED',
           review_reason_codes = '{}'::text[],
           quality_audit_verified_at = now(),
           embedding_content_hash = NULL,
           updated_at = now()
         WHERE id = $1::uuid`,
        [row.id, fixedTitle],
      );
      cleared_review += 1;
      reembed_resource_ids.push(row.id);
    } else {
      await db.query(
        `UPDATE resources SET
           canonical_title = $2,
           review_reason_codes = $3::text[],
           updated_at = now()
         WHERE id = $1::uuid`,
        [row.id, fixedTitle, reasons],
      );
    }
    titles_repaired += 1;
  }

  const next_offset = offset + rows.rows.length;
  return {
    scanned: rows.rows.length,
    titles_repaired,
    cleared_review,
    offset,
    next_offset,
    complete: rows.rows.length < BATCH,
    reembed_resource_ids,
  };
}
