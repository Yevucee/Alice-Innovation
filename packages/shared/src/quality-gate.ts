import type { NormalisedDraft } from "./domain.js";
import { normaliseName } from "./text.js";

export interface QualityGateResult {
  needsReview: boolean;
  reasons: string[];
  skipOrgPersonLinks: boolean;
}

const BLOCKLIST_TITLES = new Set([
  "home",
  "about",
  "contact",
  "portfolio",
  "privacy",
  "terms",
  "cookies",
  "login",
  "sign in",
  "search",
  "menu",
  "accelerating the future",
  "bitpanda websit",
]);

const LEGAL_FORM_ORG_PATTERNS = [
  /for-profit/i,
  /non-profit/i,
  /not registered as any organization/i,
  /not registered as any organisation/i,
  /b-corp/i,
  /legal form/i,
  /sole proprietorship/i,
  /public benefit/i,
];

const MIN_BODY_CHARS = 80;

function letterRatioUpper(title: string): number {
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) return 0;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length;
}

function uniqueBodyLength(draft: NormalisedDraft): number {
  const summary = draft.sourceSummary.trim();
  const body = draft.extractedText.trim();
  if (body && body !== summary) {
    return Math.max(summary.length, body.length);
  }
  return summary.length;
}

function looksLikeBoilerplateCohortTitle(title: string): boolean {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (trimmed.length < 3) return true;
  if (/^(home|about|contact|menu|search|privacy|terms|subscribe|read more|share|portfolio|insights|news|blog)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

function looksTruncatedTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 4) return true;
  const last = trimmed.split(/\s+/).pop() ?? "";
  if (last.length <= 3 && !/[.!?]$/.test(trimmed) && trimmed.length < 25) return true;
  if (/websit$/i.test(trimmed)) return true;
  return false;
}

function suspiciousPersonName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = name.trim();
  if (n.length < 3) return true;
  if (/^[a-z](\s+[a-z]){0,2}$/i.test(n)) return true;
  return false;
}

function suspiciousOrgName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return LEGAL_FORM_ORG_PATTERNS.some((pattern) => pattern.test(name));
}

/** Conservative ingest-time quality gate. Flags rows for review; does not drop data. */
export function evaluateDraftQuality(draft: NormalisedDraft): QualityGateResult {
  const reasons: string[] = [];
  const titleNorm = normaliseName(draft.title);
  const titleKey = titleNorm.toLowerCase();

  if (uniqueBodyLength(draft) < MIN_BODY_CHARS) {
    reasons.push("short_description");
  }
  if (BLOCKLIST_TITLES.has(titleKey) || BLOCKLIST_TITLES.has(draft.title.trim().toLowerCase())) {
    reasons.push("blocklist_title");
  }
  if (letterRatioUpper(draft.title) > 0.75 && draft.title.trim().length > 6) {
    reasons.push("all_caps_title");
  }
  if (looksTruncatedTitle(draft.title)) {
    reasons.push("truncated_title");
  }
  if (suspiciousPersonName(draft.personName)) {
    reasons.push("suspicious_person_name");
  }
  if (suspiciousOrgName(draft.organisationName)) {
    reasons.push("legal_form_org_name");
  }
  const qualityReasons = draft.rawMetadata?.quality_reasons;
  if (Array.isArray(qualityReasons) && qualityReasons.includes("invalid_org_name")) {
    reasons.push("invalid_org_name");
  }
  if (draft.rawMetadata?.cohort_source === true || draft.rawMetadata?.listing_only === true) {
    if (uniqueBodyLength(draft) < MIN_BODY_CHARS) {
      reasons.push("listing_only_thin");
    }
  }
  if (draft.rawMetadata?.cohort_source === true) {
    const summary = draft.sourceSummary.trim();
    const title = draft.title.trim();
    if (summary && title && summary === title) {
      reasons.push("cohort_title_equals_summary");
    }
    if (BLOCKLIST_TITLES.has(titleKey) || looksLikeBoilerplateCohortTitle(title)) {
      reasons.push("cohort_boilerplate_title");
    }
  }

  const needsReview = reasons.length > 0;
  const invalidOrg = reasons.includes("invalid_org_name") || reasons.includes("legal_form_org_name");
  return {
    needsReview,
    reasons,
    skipOrgPersonLinks: needsReview || suspiciousPersonName(draft.personName) || invalidOrg,
  };
}
