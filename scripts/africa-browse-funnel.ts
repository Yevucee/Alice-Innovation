import { applyMigrations, closePool, countFilteredResources, countNeedsReview, getPool, resourcesFromAfrica } from "../packages/database/src/index.ts";
import { qualityReviewBreakdown } from "../packages/database/src/quality-audit.ts";

const AFRICA_BASE = `
  r.active
  AND EXISTS (
    SELECT 1 FROM resource_source_links l_af
    JOIN source_items si_af ON si_af.id = l_af.source_item_id
    JOIN sources s_af ON s_af.id = si_af.source_id
    WHERE l_af.resource_id = r.id AND s_af.enabled AND s_af.category = 'africa-innovation'
  )
`;

async function count(db: ReturnType<typeof getPool>, extra: string): Promise<number> {
  const row = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM resources r WHERE ${AFRICA_BASE} ${extra}`);
  return Number(row.rows[0]?.n ?? 0);
}

const pool = getPool();
await applyMigrations(pool);

const total = await count(pool, "");
const funnel: Array<{ step: string; remaining: number; removed: number }> = [];
let prev = total;
funnel.push({ step: "Total active africa-innovation resources", remaining: total, removed: 0 });

const steps: Array<{ name: string; sql: string }> = [
  { name: "NEEDS_REVIEW", sql: "AND r.review_status = 'NEEDS_REVIEW'" },
  { name: "SOURCE_LIMITED", sql: "AND r.review_status = 'SOURCE_LIMITED'" },
  { name: "ARCHIVED", sql: "AND r.review_status = 'ARCHIVED'" },
  { name: "ARTICLE type", sql: "AND r.resource_type = 'ARTICLE'" },
  { name: "Summary length < 40", sql: "AND char_length(trim(coalesce(r.source_summary, ''))) < 40" },
  { name: "Body (summary/text) < 80 strict", sql: `AND GREATEST(char_length(trim(coalesce(r.source_summary,''))), char_length(trim(coalesce(r.extracted_index_text,'')))) < 80` },
  { name: "All-caps title (strict browse)", sql: `AND (
      length(regexp_replace(r.canonical_title, '[^A-Za-z]', '', 'g')) > 6
      AND upper(r.canonical_title) = r.canonical_title
      AND r.canonical_title ~ '[A-Z]'
    )` },
  { name: "Primary org is legal-form placeholder", sql: `AND EXISTS (
      SELECT 1 FROM resource_organisations ro_j
      JOIN organisations o_j ON o_j.id = ro_j.organisation_id
      WHERE ro_j.resource_id = r.id AND ro_j.is_primary IS TRUE
        AND o_j.name ~* 'not registered as any organization|for-profit|non-profit|b-corp|legal form'
    )` },
  { name: "Title equals summary", sql: "AND lower(trim(coalesce(r.source_summary,''))) = lower(trim(coalesce(r.canonical_title,'')))" },
  { name: "Pandemic junk phrase", sql: "AND (r.canonical_title ~* 'covid|pandemic|coronavirus' OR r.source_summary ~* 'covid|pandemic|coronavirus')" },
  { name: "Blocklist title", sql: "AND lower(trim(r.canonical_title)) IN ('home','about','contact','portfolio')" },
  { name: "Missing image (informational only)", sql: `AND NOT EXISTS (
      SELECT 1 FROM resource_source_links l
      JOIN source_items si ON si.id = l.source_item_id
      WHERE l.resource_id = r.id AND si.image_url IS NOT NULL AND btrim(si.image_url) <> ''
    )` },
  { name: "Missing organisation link (informational)", sql: `AND NOT EXISTS (
      SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id
    )` },
];

let cumulative = "";
for (const step of steps) {
  cumulative += ` ${step.sql}`;
  const remaining = await count(pool, cumulative);
  funnel.push({ step: step.name, remaining, removed: prev - remaining });
  prev = remaining;
}

const strictBrowse = await countFilteredResources(
  pool,
  { query: "", continents: ["africa"], limit: 8, offset: 0, qualityBrowse: true, qualityBrowseRelaxed: false, diverse: true },
  null,
);
const relaxedBrowse = await countFilteredResources(
  pool,
  { query: "", continents: ["africa"], limit: 8, offset: 0, qualityBrowse: true, qualityBrowseRelaxed: true, diverse: false },
  null,
);
const africaCardsBefore = (await resourcesFromAfrica(pool, 8)).length;

const needsReview = await countNeedsReview(pool);
const breakdown = await qualityReviewBreakdown(pool);

console.log(JSON.stringify({
  funnel,
  strict_quality_browse_total: strictBrowse,
  relaxed_quality_browse_total: relaxedBrowse,
  from_africa_cards_shown: africaCardsBefore,
  needs_review_total: needsReview,
  needs_review_by_reason: breakdown.by_reason,
}, null, 2));

await closePool();
