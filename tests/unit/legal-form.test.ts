import assert from "node:assert/strict";
import test from "node:test";
import { isLegalFormText, isQualityBrowsePandemicJunk, sanitizeDisplayTitle } from "../../packages/shared/src/legal-form.ts";

test("isLegalFormText catches MIT Solve registration answers", () => {
  assert.equal(isLegalFormText("Not registered as any organization"), true);
  assert.equal(isLegalFormText("Hybrid of for-profit and nonprofit"), true);
  assert.equal(isLegalFormText("Other, including part of a larger organization (please explain below)"), true);
  assert.equal(isLegalFormText("For-Profit"), true);
  assert.equal(isLegalFormText("N/A"), true);
  assert.equal(isLegalFormText("Acme Solar Ltd"), false);
});

test("sanitizeDisplayTitle strips markdown hash prefix", () => {
  assert.equal(sanitizeDisplayTitle("# EduTesting advisory and tracking tools"), "EduTesting advisory and tracking tools");
});

test("isQualityBrowsePandemicJunk flags COVID-era listing titles", () => {
  assert.equal(
    isQualityBrowsePandemicJunk(
      "Tele Health COVID - 19 Response Solution",
      "Tele Health COVID - 19 Response Solution",
    ),
    true,
  );
  assert.equal(
    isQualityBrowsePandemicJunk("Zilo Green Energy", "Solar subscription for households."),
    false,
  );
});
