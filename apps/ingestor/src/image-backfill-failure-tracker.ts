/** Per-run skips for image backfill: never block an entire host (403 on one URL should not stop others). */
export class ImageBackfillFailureTracker {
  private failedUrls = new Set<string>();
  private skipReasons: Record<string, number> = {};

  shouldSkipUrl(url: string): string | null {
    if (this.failedUrls.has(url)) {
      this.skipReasons.url_failed = (this.skipReasons.url_failed ?? 0) + 1;
      return "url_failed";
    }
    return null;
  }

  recordFailure(url: string, _httpStatus?: number | null): void {
    this.failedUrls.add(url);
  }

  recordSuccess(url: string): void {
    this.failedUrls.delete(url);
  }

  skipReasonsSummary(): Record<string, number> {
    return { ...this.skipReasons };
  }
}

let imageBackfillTracker: ImageBackfillFailureTracker | null = null;

export function getImageBackfillFailureTracker(): ImageBackfillFailureTracker {
  if (!imageBackfillTracker) imageBackfillTracker = new ImageBackfillFailureTracker();
  return imageBackfillTracker;
}

export function resetImageBackfillFailureTracker(): ImageBackfillFailureTracker {
  imageBackfillTracker = new ImageBackfillFailureTracker();
  return imageBackfillTracker;
}
