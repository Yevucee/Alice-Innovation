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
  };
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
