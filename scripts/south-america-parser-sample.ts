import { readFileSync } from "node:fs";
import { loadSources } from "@alice/source-registry";
import { loadDotEnv } from "@alice/shared";
import {
  extractFapespAuxilioRefs,
  parseFapespPipeDetail,
  parsePremiosVerdesDetail,
  parsePremiosVerdesListingCard,
  parseUcChileDetail,
  southAmericaAdapters,
} from "../apps/ingestor/src/adapters/south-america-adapters.js";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import type { AdapterContext } from "../apps/ingestor/src/adapters/types.js";
import { IngestQualityDropError } from "../apps/ingestor/src/ingest-quality-drop.js";

loadDotEnv();

const userAgent = process.env.INGESTION_USER_AGENT
  || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);

function fixture(name: string): string {
  return readFileSync(new URL(`../tests/fixtures/south-america/${name}`, import.meta.url), "utf8");
}

async function liveDiscover(sourceId: string): Promise<number> {
  const source = loadSources().find((entry) => entry.id === sourceId);
  if (!source) throw new Error(`missing source ${sourceId}`);
  const adapter = getAdapter(source.adapter);
  if (!adapter) throw new Error(`missing adapter ${source.adapter}`);
  const ctx: AdapterContext = {
    source,
    userAgent,
    timeoutMs,
    limit: null,
    fetchText: (url) => fetchText(url, { userAgent, timeoutMs }),
  };
  const refs = await adapter.discover(ctx);
  return refs.length;
}

function fixtureCounts(): void {
  const fapespList = extractFapespAuxilioRefs(fixture("fapesp-pipe-list.html"));
  const ucCards = fixture("uc-chile-list.html").match(/tecnologia-card/g)?.length ?? 0;
  const premiosCards = parsePremiosVerdesListingCard(fixture("premios-verdes-list.html"));
  const saOnly = premiosCards.filter((card) => {
    const country = card.locationLine.split("·")[0]?.trim();
    return country && !/méxico|mexico/i.test(country);
  });
  console.log("fixture_discover", {
    fapesp_pipe: fapespList.length,
    uc_chile: ucCards,
    premios_verdes_all: premiosCards.length,
    premios_verdes_south_america: saOnly.length,
  });

  const samples = [
    parseFapespPipeDetail({
      url: "https://bv.fapesp.br/pt/auxilios/121386/x/",
      finalUrl: "https://bv.fapesp.br/pt/auxilios/121386/x/",
      status: 200,
      html: fixture("fapesp-pipe-detail.html"),
      etag: null,
      lastModified: null,
      listingOnly: false,
    }),
    parseUcChileDetail({
      url: "https://transferenciaydesarrollo.uc.cl/innovaciones-uc/tecnologias/aeonix-ia-mantenimiento/",
      finalUrl: "https://transferenciaydesarrollo.uc.cl/innovaciones-uc/tecnologias/aeonix-ia-mantenimiento/",
      status: 200,
      html: fixture("uc-chile-detail.html"),
      etag: null,
      lastModified: null,
      listingOnly: false,
    }),
    parsePremiosVerdesDetail({
      url: "https://500-mejores.premiosverdes.org/es/proyecto/reforestadora-comunitaria-andes",
      finalUrl: "https://500-mejores.premiosverdes.org/es/proyecto/reforestadora-comunitaria-andes",
      status: 200,
      html: fixture("premios-verdes-detail.html"),
      etag: null,
      lastModified: null,
      listingOnly: false,
    }),
  ];
  for (const draft of samples) {
    console.log("sample", {
      title: draft.title,
      description: draft.extractedText.slice(0, 200),
      url: draft.canonicalUrl,
    });
  }
}

async function main(): Promise<void> {
  console.log("adapters", southAmericaAdapters.map((adapter) => adapter.id).join(", "));
  fixtureCounts();
  for (const sourceId of ["fapesp-pipe", "premios-verdes-500"]) {
    try {
      const count = await liveDiscover(sourceId);
      console.log("live_discover", sourceId, count);
    } catch (error) {
      console.log("live_discover_failed", sourceId, error instanceof Error ? error.message : String(error));
    }
  }
  try {
    await liveDiscover("uc-chile-technologies");
  } catch (error) {
    console.log("live_discover_failed", "uc-chile-technologies", error instanceof Error ? error.message : String(error));
  }
}

main().catch((error) => {
  if (error instanceof IngestQualityDropError) {
    console.error("quality_drop", error.reasons);
    process.exitCode = 1;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
