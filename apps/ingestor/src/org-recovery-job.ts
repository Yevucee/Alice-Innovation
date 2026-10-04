import {
  loadOrgRecoveryCandidates,
  linkRecoveredOrganisation,
  organisationFromStoredMetadata,
  acceptRecoveredOrganisationName,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import { log } from "@alice/shared";
import { extractMitSolveOrganisationFromHtml } from "./mit-solve-org.js";
import { fetchText, HttpStatusError } from "./http.js";
import type { RunFailureTracker } from "./run-failure-tracker.js";

export async function runOrgRecoveryFromSourceBatch(
  db: Queryable,
  input: {
    offset: number;
    sourceSlugs?: string[] | null;
    tracker: RunFailureTracker;
    userAgent: string;
    timeoutMs: number;
    minIntervalMs: number;
  },
): Promise<{
  orgs_recovered: number;
  not_found: number;
  skipped_fetch: number;
  scanned: number;
  next_offset: number;
  complete: boolean;
  reembed_resource_ids: string[];
}> {
  const candidates = await loadOrgRecoveryCandidates(db, {
    offset: input.offset,
    sourceSlugs: input.sourceSlugs ?? ["mit-solve"],
  });
  let orgs_recovered = 0;
  let not_found = 0;
  let skipped_fetch = 0;
  const reembed_resource_ids: string[] = [];
  let lastRequest = 0;

  for (const candidate of candidates) {
    let orgName = organisationFromStoredMetadata(candidate);

    if (!orgName && candidate.source_slug === "mit-solve") {
      const skip = input.tracker.shouldSkipUrl(candidate.canonical_url);
      if (skip) {
        skipped_fetch += 1;
        not_found += 1;
        continue;
      }
      const wait = input.minIntervalMs - (Date.now() - lastRequest);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      try {
        const page = await fetchText(candidate.canonical_url, {
          userAgent: input.userAgent,
          timeoutMs: input.timeoutMs,
          maxAttempts: 1,
        });
        input.tracker.recordSuccess(candidate.canonical_url);
        const extracted = extractMitSolveOrganisationFromHtml(page.body);
        if (extracted && acceptRecoveredOrganisationName(extracted, candidate)) {
          orgName = extracted.trim();
        }
      } catch (error) {
        const status = error instanceof HttpStatusError ? error.status : null;
        input.tracker.recordFailure(candidate.canonical_url, status);
        skipped_fetch += 1;
        not_found += 1;
        continue;
      }
    }

    if (!orgName) {
      not_found += 1;
      continue;
    }

    const linked = await linkRecoveredOrganisation(db, candidate, orgName);
    if (linked) {
      orgs_recovered += 1;
      reembed_resource_ids.push(candidate.resource_id);
    } else {
      not_found += 1;
    }
  }

  const next_offset = input.offset + candidates.length;
  log("info", "org_recovery_from_source_batch", {
    orgs_recovered,
    not_found,
    skipped_fetch,
    scanned: candidates.length,
    offset: input.offset,
  });

  return {
    orgs_recovered,
    not_found,
    skipped_fetch,
    scanned: candidates.length,
    next_offset,
    complete: candidates.length === 0,
    reembed_resource_ids,
  };
}
