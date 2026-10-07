export interface SourceAccess {
  class: "PUBLIC" | "FREE_ACCOUNT_REQUIRED" | "PAID" | "RESTRICTED" | "UNAVAILABLE";
  status: string;
  robots_checked: boolean;
  terms_checked: boolean;
}

export interface SourceRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  homepage: string;
  collection_url: string | null;
  enabled: boolean;
  status: "ACTIVE" | "PARTIAL" | "METADATA_ONLY" | "MANUAL" | "BLOCKED" | "BROKEN" | "PAUSED";
  resource_types: string[];
  update_class: "DAILY" | "WEEKLY" | "MONTHLY" | "MANUAL";
  adapter: string;
  access: SourceAccess;
  discovery: {
    preferred_method: string;
    sitemap: string | null;
    rss: string | null;
    notes: string;
  };
  limits: {
    requests_per_minute: number;
    concurrency: number;
    /** Overrides INGEST_FIRST_RUN_ITEM_LIMIT for first ingest of this source. */
    first_run_item_limit?: number | null;
    /** Hard cap on items processed every ingest run (phase-2 open-data). */
    max_items_per_run?: number | null;
  };
  /** When set, catalogue overlaps another slug (e.g. j-startup-impact → j-startup). Ingest skips when sibling has items. */
  duplicate_of?: string | null;
  coverage: {
    historical_backfill: string;
    notes: string;
  };
}

export const REQUIRED_SOURCE_FIELDS = [
  "id",
  "name",
  "category",
  "homepage",
  "enabled",
  "status",
  "update_class",
  "adapter",
  "access",
  "discovery",
  "limits",
  "coverage",
] as const;
