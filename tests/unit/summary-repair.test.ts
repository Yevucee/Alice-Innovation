import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isSlugLikeSummary,
  mergeColonSplitTitle,
  normaliseCountryDisplayName,
  repairSourceSummary,
} from "../../packages/shared/src/summary-repair.ts";
import { truncateAtWordBoundary } from "../../packages/shared/src/text.ts";

test("detects slug-like summaries", () => {
  assert.equal(isSlugLikeSummary("looping-the-loop-seo"), true);
  assert.equal(isSlugLikeSummary("Looping the loop"), false);
});

test("repairs title-as-summary and slug summaries from body", () => {
  const body =
    "Life Master helps communities monitor water quality with low-cost sensors deployed across rural clinics. " +
    "The programme trains local operators and shares open data with health authorities.";

  const life = repairSourceSummary({
    title: "Life Master",
    summary: "Life Master",
    bodyText: body,
  });
  assert.notEqual(life, "Life Master");
  assert.ok(life.includes("water quality"));

  const apolitical = repairSourceSummary({
    title: "Looping the loop",
    summary: "looping-the-loop-seo",
    bodyText:
      "Public servants often revisit the same policy loops. This piece explores how facilitation can break cycles of weak leadership and stalled reform.",
  });
  assert.notEqual(apolitical, "looping-the-loop-seo");
  assert.ok(apolitical.length > 20);

  const cheatSheet = repairSourceSummary({
    title: "The public servants' facilitation cheat sheet",
    summary: "The public servants' facilitation cheat sheet",
    bodyText:
      "A practical guide for facilitators working inside government teams, with prompts for stakeholder mapping and decision checkpoints.",
  });
  assert.notEqual(cheatSheet.toLowerCase(), "the public servants' facilitation cheat sheet");
});

test("mergeColonSplitTitle reattaches short subtitles", () => {
  const merged = mergeColonSplitTitle(
    "The Periphery of Governance:",
    "New public value at the edges. Longer summary text continues here with additional context.",
  );
  assert.equal(merged.title, "The Periphery of Governance: New public value at the edges.");
  assert.ok(merged.summary.includes("Longer summary"));
});

test("truncateAtWordBoundary avoids mid-word cuts", () => {
  const cut = truncateAtWordBoundary("Policy reform needs stronger leadership not weak leadersh", 40);
  assert.ok(!cut.endsWith("leadersh"));
  assert.ok(cut.endsWith("…"));
});

test("normaliseCountryDisplayName fixes Usa", () => {
  assert.equal(normaliseCountryDisplayName("Usa"), "USA");
});
