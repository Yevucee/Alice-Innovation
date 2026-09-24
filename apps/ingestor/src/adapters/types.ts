import type { NormalisedDraft } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";

export interface DiscoveredRef {
  url: string;
  externalId?: string;
  listingHtml?: string;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  etag: string | null;
  lastModified: string | null;
  listingOnly: boolean;
}

export interface AdapterContext {
  source: SourceRecord;
  userAgent: string;
  timeoutMs: number;
  limit: number | null;
  fetchText: (url: string) => Promise<{ body: string; finalUrl: string; status: number; etag: string | null; lastModified: string | null }>;
}

export interface SourceAdapter {
  id: string;
  /** True when discover() returns the catalogue, not a partial homepage sample. */
  fullCatalogue: boolean;
  discover(ctx: AdapterContext): Promise<DiscoveredRef[]>;
  fetch(ref: DiscoveredRef, ctx: AdapterContext): Promise<FetchedPage>;
  parse(page: FetchedPage): NormalisedDraft;
}

export class AccessBlockedError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AccessBlockedError";
    this.status = status;
  }
}

export async function defaultFetch(ref: DiscoveredRef, ctx: AdapterContext): Promise<FetchedPage> {
  try {
    const result = await ctx.fetchText(ref.url);
    return {
      url: ref.url,
      finalUrl: result.finalUrl,
      status: result.status,
      html: result.body,
      etag: result.etag,
      lastModified: result.lastModified,
      listingOnly: false,
    };
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 0;
    if ((status === 401 || status === 403) && ref.listingHtml) {
      return {
        url: ref.url,
        finalUrl: ref.url,
        status,
        html: ref.listingHtml,
        etag: null,
        lastModified: null,
        listingOnly: true,
      };
    }
    throw error;
  }
}
