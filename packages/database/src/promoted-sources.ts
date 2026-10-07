import type { SourceRecord } from "@alice/source-registry";
import type { Queryable } from "./pool.js";

export type PromotedCatalogueConfigRow = {
  source_slug: string;
  site_origin: string;
  collection_url: string;
  path_pattern: string;
  candidate_id: string | null;
};

function slugifyHostPart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Detail-page path pattern when collection_url is the listing page (not its parent). */
export function inferCataloguePathPatternFromCollectionUrl(collectionUrl: string): string {
  const url = new URL(collectionUrl);
  const path = url.pathname.replace(/\/$/, "");
  if (!path || path === "/") {
    return "^/[^/]+/[^/]+/?$";
  }
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^${escaped}/[^/]+/?$`;
}

export function inferPromotedCatalogueConfig(homepage: string): {
  siteOrigin: string;
  collectionUrl: string;
  pathPattern: string;
  officialHomepage: string;
} {
  const url = new URL(homepage);
  const siteOrigin = `${url.protocol}//${url.hostname}`;
  const segments = url.pathname.split("/").filter(Boolean);
  const officialHomepage = siteOrigin.endsWith("/") ? siteOrigin : `${siteOrigin}/`;

  if (segments.length >= 2) {
    const prefix = segments.slice(0, -1).join("/");
    const collectionPath = `/${prefix}/`;
    return {
      siteOrigin,
      officialHomepage,
      collectionUrl: new URL(collectionPath, siteOrigin).toString().replace(/\/$/, "") || siteOrigin,
      pathPattern: `^/${prefix}/[^/]+/?$`,
    };
  }
  if (segments.length === 1) {
    return {
      siteOrigin,
      officialHomepage,
      collectionUrl: homepage.replace(/\/$/, ""),
      pathPattern: `^/${segments[0]}/[^/]+/?$`,
    };
  }
  return {
    siteOrigin,
    officialHomepage,
    collectionUrl: officialHomepage.replace(/\/$/, ""),
    pathPattern: "^/[^/]+/[^/]+/?$",
  };
}

export async function uniquePromotedSourceSlug(db: Queryable, homepage: string, preferredName?: string | null): Promise<string> {
  const host = slugifyHostPart(new URL(homepage).hostname.replace(/^www\./i, ""));
  const namePart = preferredName ? slugifyHostPart(preferredName).slice(0, 24) : "";
  let base = namePart ? `${host}-${namePart}` : host;
  if (!base) base = "promoted-source";
  let candidate = base.slice(0, 60);
  let n = 0;
  while (true) {
    const row = await db.query<{ slug: string }>(`SELECT slug FROM sources WHERE slug = $1`, [candidate]);
    if (row.rows.length === 0) return candidate;
    n += 1;
    candidate = `${base.slice(0, 52)}-${n}`;
  }
}

export function buildPromotedSourceRecord(
  slug: string,
  name: string,
  config: ReturnType<typeof inferPromotedCatalogueConfig>,
  notes: string,
): SourceRecord {
  const description =
    "PARTIAL: added from admin source idea; html-catalogue discovery from pasted URL (verify listing paths).";
  return {
    id: slug,
    name,
    category: "general-innovation",
    description,
    homepage: config.officialHomepage,
    collection_url: config.collectionUrl,
    enabled: true,
    status: "PARTIAL",
    resource_types: ["SOLUTION", "PROJECT"],
    update_class: "WEEKLY",
    adapter: slug,
    access: {
      class: "PUBLIC",
      status: "UNVERIFIED_COLLECTION",
      robots_checked: false,
      terms_checked: false,
    },
    discovery: {
      preferred_method: "html",
      sitemap: null,
      rss: null,
      notes: notes || "Promoted from admin source_candidates.",
    },
    limits: { requests_per_minute: 12, concurrency: 1 },
    coverage: {
      historical_backfill: "not-attempted",
      notes: description,
    },
  };
}

export async function loadPromotedCatalogueConfigs(db: Queryable): Promise<PromotedCatalogueConfigRow[]> {
  const rows = await db.query<PromotedCatalogueConfigRow>(
    `SELECT source_slug, site_origin, collection_url, path_pattern, candidate_id::text AS candidate_id
     FROM promoted_source_catalogue_configs
     ORDER BY created_at ASC`,
  );
  return rows.rows;
}

export async function loadPromotedSourceRecords(db: Queryable): Promise<SourceRecord[]> {
  const rows = await db.query<{
    slug: string;
    name: string;
    notes: string;
    homepage: string;
    collection_url: string | null;
    site_origin: string;
    cfg_collection: string;
    path_pattern: string;
  }>(
    `SELECT s.slug, s.name, s.notes, s.official_homepage AS homepage, s.collection_url,
            c.site_origin, c.collection_url AS cfg_collection, c.path_pattern
     FROM promoted_source_catalogue_configs c
     JOIN sources s ON s.slug = c.source_slug
     WHERE s.enabled = true`,
  );
  return rows.rows.map((row) =>
    buildPromotedSourceRecord(
      row.slug,
      row.name,
      {
        siteOrigin: row.site_origin,
        officialHomepage: row.homepage,
        collectionUrl: row.collection_url || row.cfg_collection,
        pathPattern: row.path_pattern,
      },
      row.notes,
    ),
  );
}

export async function upsertPromotedSourceInDb(
  db: Queryable,
  input: {
    slug: string;
    name: string;
    record: SourceRecord;
    config: ReturnType<typeof inferPromotedCatalogueConfig>;
    candidateId: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO sources (
       slug, name, category, description, official_homepage, collection_url, enabled, status,
       access_class, ingestion_policy, adapter_type, update_frequency, requests_per_minute,
       concurrency, discovery_method, discovery_notes, coverage_notes, historical_backfill, notes
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,
       $9,'',$10,$11,$12,
       $13,$14,$15,$16,$17,$18
     )
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       official_homepage = EXCLUDED.official_homepage,
       collection_url = EXCLUDED.collection_url,
       enabled = EXCLUDED.enabled,
       status = EXCLUDED.status,
       adapter_type = EXCLUDED.adapter_type,
       discovery_notes = EXCLUDED.discovery_notes,
       coverage_notes = EXCLUDED.coverage_notes,
       notes = EXCLUDED.notes,
       updated_at = now()`,
    [
      input.slug,
      input.name,
      input.record.category,
      input.record.description,
      input.record.homepage,
      input.record.collection_url,
      input.record.enabled,
      input.record.status,
      input.record.access.class,
      input.record.adapter,
      input.record.update_class,
      input.record.limits.requests_per_minute,
      input.record.limits.concurrency,
      input.record.discovery.preferred_method,
      input.record.discovery.notes,
      input.record.coverage.notes,
      input.record.coverage.historical_backfill,
      [input.record.discovery.notes, input.record.coverage.notes].filter(Boolean).join(" ").slice(0, 4000),
    ],
  );
  await db.query(
    `INSERT INTO promoted_source_catalogue_configs (source_slug, site_origin, collection_url, path_pattern, candidate_id)
     VALUES ($1, $2, $3, $4, $5::uuid)
     ON CONFLICT (source_slug) DO UPDATE SET
       site_origin = EXCLUDED.site_origin,
       collection_url = EXCLUDED.collection_url,
       path_pattern = EXCLUDED.path_pattern,
       candidate_id = COALESCE(promoted_source_catalogue_configs.candidate_id, EXCLUDED.candidate_id)`,
    [input.slug, input.config.siteOrigin, input.config.collectionUrl, input.config.pathPattern, input.candidateId],
  );
}
