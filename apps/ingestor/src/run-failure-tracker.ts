import { log } from "@alice/shared";

const BLOCK_STATUSES = new Set([401, 403, 429]);

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Per-run skip policy: block URLs/hosts after repeated failures; block hosts on 401/403/429. */
export class RunFailureTracker {
  private urlFailures = new Map<string, number>();
  private hostFailures = new Map<string, number>();
  private blockedUrls = new Set<string>();
  private blockedHosts = new Set<string>();
  private skipReasons: Record<string, number> = {};

  reset(): void {
    this.urlFailures.clear();
    this.hostFailures.clear();
    this.blockedUrls.clear();
    this.blockedHosts.clear();
    this.skipReasons = {};
  }

  skipReasonsSummary(): Record<string, number> {
    return { ...this.skipReasons };
  }

  private bump(reason: string): void {
    this.skipReasons[reason] = (this.skipReasons[reason] ?? 0) + 1;
  }

  shouldSkipUrl(url: string): string | null {
    if (this.blockedUrls.has(url)) {
      this.bump("url_blocked");
      return "url_blocked";
    }
    const host = hostOf(url);
    if (this.blockedHosts.has(host)) {
      this.bump("host_blocked");
      return `host_blocked:${host}`;
    }
    return null;
  }

  recordFailure(url: string, httpStatus?: number | null): void {
    const host = hostOf(url);
    if (httpStatus != null && BLOCK_STATUSES.has(httpStatus)) {
      if (!this.blockedHosts.has(host)) {
        this.blockedHosts.add(host);
        log("info", "run_failure_host_blocked", { host, http_status: httpStatus, url });
      }
      this.bump(`http_${httpStatus}`);
      return;
    }
    const nextUrl = (this.urlFailures.get(url) ?? 0) + 1;
    this.urlFailures.set(url, nextUrl);
    if (nextUrl >= 2) {
      this.blockedUrls.add(url);
      log("info", "run_failure_url_blocked", { url, failures: nextUrl });
      this.bump("url_failed_twice");
    }
    const nextHost = (this.hostFailures.get(host) ?? 0) + 1;
    this.hostFailures.set(host, nextHost);
    if (nextHost >= 2) {
      this.blockedHosts.add(host);
      log("info", "run_failure_host_blocked", { host, failures: nextHost, url });
      this.bump("host_failed_twice");
    }
  }

  recordSuccess(url: string): void {
    this.urlFailures.delete(url);
    const host = hostOf(url);
    this.hostFailures.delete(host);
  }
}

let activeTracker: RunFailureTracker | null = null;

export function getRunFailureTracker(): RunFailureTracker {
  if (!activeTracker) activeTracker = new RunFailureTracker();
  return activeTracker;
}

export function resetRunFailureTracker(): RunFailureTracker {
  activeTracker = new RunFailureTracker();
  return activeTracker;
}
