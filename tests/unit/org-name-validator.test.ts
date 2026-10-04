import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isInvalidOrganisationName,
  organisationNameMatchesResourceTitle,
} from "../../packages/shared/src/org-name-validator.ts";

const mitSolve = "MIT Solve";

test("rejects MIT Solve sentence-like registration answers", () => {
  const lifeMaster = "We are currently being endorsed by the Innovation Hub South Africa";
  assert.equal(
    isInvalidOrganisationName(lifeMaster, { resourceTitle: "Life Master", sourceName: mitSolve }),
    true,
  );

  const solution4s = "It is a project for my family team.";
  assert.equal(
    isInvalidOrganisationName(solution4s, { resourceTitle: "Solution 4S", sourceName: mitSolve }),
    true,
  );
});

test("rejects source name but not product-named companies matching title", () => {
  assert.equal(
    isInvalidOrganisationName("MIT Solve", { resourceTitle: "CityScape", sourceName: mitSolve }),
    true,
  );
  assert.equal(isInvalidOrganisationName("SamWise", { resourceTitle: "SamWise", sourceName: mitSolve }), false);
  assert.equal(isInvalidOrganisationName("Energy Mall", { resourceTitle: "Energy Mall", sourceName: mitSolve }), false);
  assert.equal(organisationNameMatchesResourceTitle("SamWise", "SamWise"), true);
});

test("accepts plausible organisation names", () => {
  assert.equal(
    isInvalidOrganisationName("Innovation Hub South Africa", { resourceTitle: "Life Master", sourceName: mitSolve }),
    false,
  );
});
