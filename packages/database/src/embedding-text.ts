import { contentHash, truncate } from "@alice/shared";
import type { Queryable } from "./pool.js";

const EXTRACTED_CAP = 4000;
const INTERPRETATION_MIN_LEN = 50;

export interface EmbeddingTextInput {
  canonical_title: string;
  source_summary: string;
  extracted_index_text: string;
  primary_country_name?: string | null;
  countries?: string[];
  problems?: string[];
  sectors?: string[];
  technologies?: string[];
  interpretation_problem_statement?: string | null;
}

export function buildEmbeddingText(input: EmbeddingTextInput): string {
  const parts: string[] = [
    input.canonical_title.trim(),
    input.source_summary.trim(),
    truncate(input.extracted_index_text.trim(), EXTRACTED_CAP),
  ];
  const location = [
    input.primary_country_name?.trim() ?? "",
    ...(input.countries ?? []).map((c) => c.trim()).filter(Boolean),
  ].filter(Boolean);
  if (location.length > 0) {
    parts.push(`Location: ${[...new Set(location)].join(", ")}`);
  }
  if (input.problems?.length) {
    parts.push(`Problems: ${input.problems.join(", ")}`);
  }
  if (input.sectors?.length) {
    parts.push(`Sectors: ${input.sectors.join(", ")}`);
  }
  if (input.technologies?.length) {
    parts.push(`Technologies: ${input.technologies.join(", ")}`);
  }
  const problemStatement = input.interpretation_problem_statement?.trim() ?? "";
  if (problemStatement.length >= INTERPRETATION_MIN_LEN) {
    parts.push(`Problem statement: ${problemStatement}`);
  }
  return parts.filter((line) => line.length > 0).join("\n");
}

export function embeddingTextContentHash(text: string): string {
  return contentHash([text]);
}

export interface ResourceEmbeddingRow {
  id: string;
  canonical_title: string;
  source_summary: string;
  extracted_index_text: string;
  primary_country_name: string | null;
  embedding_content_hash: string | null;
  problems: string[];
  sectors: string[];
  technologies: string[];
  countries: string[];
  interpretation_problem_statement: string | null;
}

export async function loadResourcesForEmbedding(
  db: Queryable,
  limit: number,
  offset: number,
): Promise<ResourceEmbeddingRow[]> {
  const rows = await db.query<ResourceEmbeddingRow>(
    `SELECT r.id::text,
            r.canonical_title,
            r.source_summary,
            r.extracted_index_text,
            r.primary_country_name,
            r.embedding_content_hash,
            COALESCE((
              SELECT array_agg(DISTINCT p.name ORDER BY p.name)
              FROM resource_problems rp
              JOIN problems p ON p.id = rp.problem_id
              WHERE rp.resource_id = r.id
            ), '{}') AS problems,
            COALESCE((
              SELECT array_agg(DISTINCT sec.name ORDER BY sec.name)
              FROM resource_sectors rs
              JOIN sectors sec ON sec.id = rs.sector_id
              WHERE rs.resource_id = r.id
            ), '{}') AS sectors,
            COALESCE((
              SELECT array_agg(DISTINCT t.name ORDER BY t.name)
              FROM resource_technologies rt
              JOIN technologies t ON t.id = rt.technology_id
              WHERE rt.resource_id = r.id
            ), '{}') AS technologies,
            COALESCE((
              SELECT array_agg(DISTINCT loc.country_name ORDER BY loc.country_name)
              FROM resource_locations rl
              JOIN locations loc ON loc.id = rl.location_id
              WHERE rl.resource_id = r.id
            ), '{}') AS countries,
            (
              SELECT ri.problem_statement
              FROM resource_interpretations ri
              WHERE ri.resource_id = r.id
              ORDER BY ri.generated_at DESC
              LIMIT 1
            ) AS interpretation_problem_statement
     FROM resources r
     WHERE r.active
     ORDER BY r.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows.rows;
}

export async function loadResourcesForEmbeddingByIds(
  db: Queryable,
  resourceIds: string[],
): Promise<ResourceEmbeddingRow[]> {
  if (resourceIds.length === 0) return [];
  const rows = await db.query<ResourceEmbeddingRow>(
    `SELECT r.id::text,
            r.canonical_title,
            r.source_summary,
            r.extracted_index_text,
            r.primary_country_name,
            r.embedding_content_hash,
            COALESCE((
              SELECT array_agg(DISTINCT p.name ORDER BY p.name)
              FROM resource_problems rp
              JOIN problems p ON p.id = rp.problem_id
              WHERE rp.resource_id = r.id
            ), '{}') AS problems,
            COALESCE((
              SELECT array_agg(DISTINCT sec.name ORDER BY sec.name)
              FROM resource_sectors rs
              JOIN sectors sec ON sec.id = rs.sector_id
              WHERE rs.resource_id = r.id
            ), '{}') AS sectors,
            COALESCE((
              SELECT array_agg(DISTINCT t.name ORDER BY t.name)
              FROM resource_technologies rt
              JOIN technologies t ON t.id = rt.technology_id
              WHERE rt.resource_id = r.id
            ), '{}') AS technologies,
            COALESCE((
              SELECT array_agg(DISTINCT loc.country_name ORDER BY loc.country_name)
              FROM resource_locations rl
              JOIN locations loc ON loc.id = rl.location_id
              WHERE rl.resource_id = r.id
            ), '{}') AS countries,
            (
              SELECT ri.problem_statement
              FROM resource_interpretations ri
              WHERE ri.resource_id = r.id
              ORDER BY ri.generated_at DESC
              LIMIT 1
            ) AS interpretation_problem_statement
     FROM resources r
     WHERE r.active AND r.id = ANY($1::uuid[])
     ORDER BY r.updated_at DESC`,
    [resourceIds],
  );
  return rows.rows;
}

export async function countActiveResources(db: Queryable): Promise<number> {
  const row = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM resources WHERE active",
  );
  return Number(row.rows[0]?.count ?? 0);
}

export async function embeddingCatalogueCoverage(db: Queryable): Promise<{
  active: number;
  with_embedding: number;
  pct: number;
}> {
  const row = await db.query<{ active: string; with_embedding: string }>(
    `SELECT count(*)::text AS active,
            count(*) FILTER (WHERE embedding IS NOT NULL)::text AS with_embedding
     FROM resources WHERE active`,
  );
  const active = Number(row.rows[0]?.active ?? 0);
  const withEmbedding = Number(row.rows[0]?.with_embedding ?? 0);
  const pct = active > 0 ? Math.round((withEmbedding / active) * 1000) / 10 : 0;
  return { active, with_embedding: withEmbedding, pct };
}
