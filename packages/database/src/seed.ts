import { createHash } from "node:crypto";
import type { SourceRecord } from "@alice/source-registry";
import { PROBLEMS, SECTORS, TECHNOLOGIES } from "@alice/taxonomy";
import type { Queryable } from "./pool.js";

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function seedTree(
  db: Queryable,
  table: "problems" | "sectors" | "technologies",
  nodes: Array<{ slug: string; name: string; parentSlug?: string }>,
): Promise<void> {
  for (const node of nodes.filter((item) => !item.parentSlug)) {
    await db.query(
      `INSERT INTO ${table} (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`,
      [node.slug, node.name],
    );
  }
  for (const node of nodes.filter((item) => item.parentSlug)) {
    await db.query(
      `INSERT INTO ${table} (slug, name, parent_id)
       VALUES ($1, $2, (SELECT id FROM ${table} WHERE slug = $3))
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id`,
      [node.slug, node.name, node.parentSlug],
    );
  }
}

export async function seedTaxonomy(db: Queryable): Promise<void> {
  await seedTree(db, "problems", PROBLEMS);
  await seedTree(db, "sectors", SECTORS);
  await seedTree(db, "technologies", TECHNOLOGIES);
}

export async function seedSources(db: Queryable, sources: SourceRecord[]): Promise<number> {
  for (const source of sources) {
    await db.query(
      `INSERT INTO sources (
         slug, name, category, description, official_homepage, collection_url, enabled, status,
         access_class, ingestion_policy, adapter_type, update_frequency, requests_per_minute,
         concurrency, discovery_method, discovery_notes, coverage_notes, historical_backfill, notes,
         robots_checked_at, terms_checked_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,
         $9,$10,$11,$12,$13,
         $14,$15,$16,$17,$18,$19,
         $20,$21
       )
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         description = EXCLUDED.description,
         official_homepage = EXCLUDED.official_homepage,
         collection_url = EXCLUDED.collection_url,
         enabled = EXCLUDED.enabled,
         status = EXCLUDED.status,
         access_class = EXCLUDED.access_class,
         ingestion_policy = EXCLUDED.ingestion_policy,
         adapter_type = EXCLUDED.adapter_type,
         update_frequency = EXCLUDED.update_frequency,
         requests_per_minute = EXCLUDED.requests_per_minute,
         concurrency = EXCLUDED.concurrency,
         discovery_method = EXCLUDED.discovery_method,
         discovery_notes = EXCLUDED.discovery_notes,
         coverage_notes = EXCLUDED.coverage_notes,
         historical_backfill = EXCLUDED.historical_backfill,
         notes = EXCLUDED.notes,
         robots_checked_at = COALESCE(sources.robots_checked_at, EXCLUDED.robots_checked_at),
         terms_checked_at = COALESCE(sources.terms_checked_at, EXCLUDED.terms_checked_at),
         updated_at = now()`,
      [
        source.id,
        source.name,
        source.category,
        source.description ?? "",
        source.homepage,
        source.collection_url,
        source.enabled,
        source.status,
        source.access.class,
        source.access.status,
        source.adapter,
        source.update_class,
        source.limits.requests_per_minute,
        source.limits.concurrency,
        source.discovery.preferred_method,
        source.discovery.notes,
        source.coverage.notes,
        source.coverage.historical_backfill,
        `sitemap=${source.discovery.sitemap ?? ""}; rss=${source.discovery.rss ?? ""}`,
        source.access.robots_checked ? new Date() : null,
        source.access.terms_checked ? new Date() : null,
      ],
    );
  }
  return sources.length;
}

export function organisationSlug(name: string): string {
  const base = slug(name) || "organisation";
  const suffix = createHash("sha256").update(name).digest("hex").slice(0, 8);
  return `${base}-${suffix}`;
}
