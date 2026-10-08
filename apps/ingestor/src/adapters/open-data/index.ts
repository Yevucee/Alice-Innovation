import { createCordisAdapter } from "./cordis.js";
import { createNihReporterAdapter } from "./nih-reporter.js";
import { euInnovationRadarAdapter } from "./eu-innovation-radar.js";
import { nsfAwardsAdapter } from "./nsf-awards.js";
import { ukriGtrProjectsAdapter } from "./ukri-gtr.js";
import { usaspendingSbirAdapter } from "./usaspending-sbir.js";
import { usaspendingSttrAdapter } from "./usaspending-sttr.js";
import { worldBankProjectsAdapter } from "./world-bank.js";
import { ycombinatorOssCompaniesAdapter } from "./ycombinator-oss.js";
import type { SourceAdapter } from "../types.js";

export const openDataAdapters: SourceAdapter[] = [
  createCordisAdapter({
    id: "cordis-eu-research-projects",
    query: "contenttype='project'",
    pageSize: 50,
    maxPagesDefault: 80,
  }),
  createCordisAdapter({
    id: "cordis-eu-research-results",
    query: "contenttype='result'",
    pageSize: 50,
    maxPagesDefault: 80,
  }),
  createCordisAdapter({
    id: "cordis-horizon-europe-projects",
    query: "contenttype='project' AND programme/term='HORIZON'",
    pageSize: 50,
    maxPagesDefault: 80,
  }),
  createCordisAdapter({
    id: "cordis-fp7-projects",
    query: "contenttype='project' AND programme/term='FP7'",
    pageSize: 50,
    maxPagesDefault: 80,
  }),
  createCordisAdapter({
    id: "cordis-horizon-2020-projects",
    query: "contenttype='project' AND programme/term='H2020'",
    pageSize: 50,
    maxPagesDefault: 80,
  }),
  createCordisAdapter({
    id: "cordis-eic-accelerator-projects",
    query: "contenttype='project' AND programme/term='EIC'",
    pageSize: 50,
    maxPagesDefault: 80,
  }),
  createNihReporterAdapter({
    id: "nih-sbir-sttr-portfolio",
    criteria: {
      funding_mechanisms: ["SB", "ST"],
      fiscal_years: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
    },
    pageSize: 100,
    maxPagesDefault: 80,
  }),
  createNihReporterAdapter({
    id: "nih-reporter-innovation-grants",
    criteria: {
      fiscal_years: [2020, 2021, 2022, 2023, 2024, 2025],
      advanced_text_search: { operator: "and", search_field: "all", search_text: "innovation" },
    },
    pageSize: 100,
    maxPagesDefault: 40,
  }),
  nsfAwardsAdapter,
  usaspendingSbirAdapter,
  usaspendingSttrAdapter,
  ukriGtrProjectsAdapter,
  worldBankProjectsAdapter,
  euInnovationRadarAdapter,
  ycombinatorOssCompaniesAdapter,
];
