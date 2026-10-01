import assert from "node:assert/strict";
import { test } from "node:test";
import { auditDraftShape, summariseReasonCounts } from "../../packages/database/src/quality-audit.ts";

test("audit draft shape aggregates reason counts", () => {
  const rows = [
    {
      entity_type: "resource" as const,
      id: "1",
      title_or_name: "ACCELERATING THE FUTURE",
      source_slug: "demo",
      url: "https://example.com",
      reason_codes: auditDraftShape({
        title: "ACCELERATING THE FUTURE",
        sourceSummary: "tiny",
        extractedText: "tiny",
        organisationName: null,
        personName: null,
        rawMetadata: {},
      }),
      proposed_action: "NEEDS_REVIEW" as const,
    },
    {
      entity_type: "resource" as const,
      id: "2",
      title_or_name: "Legal",
      source_slug: null,
      url: null,
      reason_codes: auditDraftShape({
        title: "Valid long title for testing",
        sourceSummary: "A sufficiently long description of the innovation for quality checks to pass easily here.",
        extractedText: "More body",
        organisationName: "For-profit, including B-Corp or similar models",
        personName: null,
        rawMetadata: {},
      }),
      proposed_action: "NEEDS_REVIEW" as const,
    },
  ];
  const counts = summariseReasonCounts(rows);
  assert.ok((counts.blocklist_title ?? 0) >= 1);
  assert.ok((counts.legal_form_org_name ?? 0) >= 1);
});
