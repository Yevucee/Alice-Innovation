import type { SourceRecord } from "@alice/source-registry";
import type { Queryable } from "@alice/database";

/** Allowed ingest scope values (env `INGEST_SCOPE` / CLI `--scope`). */
export const INGEST_SCOPE_VALUES = [
  "asia",
  "africa",
  "europe",
  "south-america",
  "grants",
  "all",
  "failed-only",
] as const;

export type IngestScope = (typeof INGEST_SCOPE_VALUES)[number];

export const INGEST_SCOPE_RUN_ORDER: IngestScope[] = [
  "asia",
  "africa",
  "europe",
  "south-america",
  "grants",
];

const EUROPE_SOURCE_ID_PREFIXES = [
  "cordis-",
  "eu-innovation-radar",
  "ukri-gtr-",
];

/** Explicit South America catalogue slugs (expand as sources are enabled). */
export const SOUTH_AMERICA_SOURCE_IDS = new Set<string>([
  // No enabled South America catalogues in sources.yaml yet (Oct 2026).
]);

const GRANT_CATEGORIES = new Set([
  "general-innovation",
  "agriculture-water-development",
  "climate-energy-nature",
  "people-innovators",
  "major-backed-ideas",
  "education-government-design",
  "solutions-journalism",
]);

export function parseIngestScope(raw: string | undefined | null): IngestScope {
  const value = (raw ?? "all").trim().toLowerCase();
  if ((INGEST_SCOPE_VALUES as readonly string[]).includes(value)) {
    return value as IngestScope;
  }
  throw new Error(`Invalid ingest scope: ${raw}`);
}

export function ingestScopeMaxMinutes(): number {
  const parsed = Number(process.env.INGEST_SCOPE_MAX_MINUTES ?? "90");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
}

function isEuropeSource(source: SourceRecord): boolean {
  if (EUROPE_SOURCE_ID_PREFIXES.some((prefix) => source.id.startsWith(prefix))) return true;
  if (source.adapter.startsWith("cordis-")) return true;
  if (source.adapter === "eu-innovation-radar" || source.adapter.startsWith("ukri-gtr")) return true;
  return false;
}

/**
 * Primary scope for a source (excluding `all` / `failed-only`).
 * Regional categories win over grant bucket; EU open-data slugs map to europe.
 */
export function primaryIngestScopeForSource(source: SourceRecord): IngestScope | "unmapped" {
  if (source.category === "asia-innovation") return "asia";
  if (source.category === "africa-innovation") return "africa";
  if (SOUTH_AMERICA_SOURCE_IDS.has(source.id)) return "south-america";
  if (isEuropeSource(source)) return "europe";
  if (GRANT_CATEGORIES.has(source.category)) return "grants";
  return "unmapped";
}

export function listUnmappedSourceIds(sources: SourceRecord[]): string[] {
  return sources
    .filter((source) => primaryIngestScopeForSource(source) === "unmapped")
    .map((source) => source.id)
    .sort();
}

export function sourceMatchesScope(source: SourceRecord, scope: IngestScope): boolean {
  if (scope === "all" || scope === "failed-only") return true;
  const primary = primaryIngestScopeForSource(source);
  if (primary === "unmapped") return scope === "grants";
  return primary === scope;
}

export function sortSourcesForIngestScope(sources: SourceRecord[], scope: IngestScope): SourceRecord[] {
  if (scope !== "all") return [...sources];
  const orderIndex = new Map(INGEST_SCOPE_RUN_ORDER.map((s, i) => [s, i]));
  return [...sources].sort((a, b) => {
    const sa = primaryIngestScopeForSource(a);
    const sb = primaryIngestScopeForSource(b);
    const ia = orderIndex.get(sa === "unmapped" ? "grants" : sa) ?? 99;
    const ib = orderIndex.get(sb === "unmapped" ? "grants" : sb) ?? 99;
    if (ia !== ib) return ia - ib;
    return a.id.localeCompare(b.id);
  });
}

export async function loadFailedOnlySourceSlugs(db: Queryable): Promise<Set<string>> {
  const result = await db.query<{ slug: string }>(
    `WITH latest AS (
       SELECT DISTINCT ON (ir.source_id)
         s.slug,
         ir.status,
         ir.items_failed
       FROM ingestion_runs ir
       JOIN sources s ON s.id = ir.source_id
       ORDER BY ir.source_id, ir.started_at DESC
     )
     SELECT slug FROM latest
     WHERE status = 'FAILED'
        OR (status = 'PARTIAL_SUCCESS' AND COALESCE(items_failed, 0) > 0)`,
  );
  return new Set(result.rows.map((row) => row.slug));
}

export function filterSourcesByScope(
  sources: SourceRecord[],
  scope: IngestScope,
  failedSlugs: Set<string>,
): SourceRecord[] {
  let filtered = sources.filter((source) => source.enabled && sourceMatchesScope(source, scope));
  if (scope === "failed-only") {
    filtered = filtered.filter((source) => failedSlugs.has(source.id));
  }
  return sortSourcesForIngestScope(filtered, scope === "failed-only" ? "all" : scope);
}

export type IngestTrigger = "admin-button" | "cron" | "manual";

export function resolveIngestTrigger(): IngestTrigger {
  const explicit = process.env.INGEST_TRIGGER?.trim().toLowerCase();
  if (explicit === "admin-button" || explicit === "cron" || explicit === "manual") {
    return explicit;
  }
  if (process.env.RAILWAY_CRON === "1" || process.env.RAILWAY_CRON === "true") {
    return "cron";
  }
  return "manual";
}

export function prefixRunOutcome(
  scope: IngestScope,
  trigger: IngestTrigger,
  outcome: string,
): string {
  return `scope=${scope};trigger=${trigger};${outcome}`;
}
