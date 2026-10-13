import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  extractFapespAuxilioRefs,
  parseFapespPipeDetail,
  parsePremiosVerdesDetail,
  parsePremiosVerdesListingCard,
  parseUcChileDetail,
  southAmericaAdapters,
} from "../../apps/ingestor/src/adapters/south-america-adapters.ts";
import {
  assertDiscoverNonEmpty,
  isListingExcerptDescription,
  isPremiosSouthAmericaCountry,
  meetsSouthAmericaDescriptionGate,
  parseSouthAmericaCountryFromLocation,
  stripFapespTitlePrefix,
  stripPersonalContactHtml,
} from "../../apps/ingestor/src/adapters/south-america-quality.ts";
import { IngestQualityDropError } from "../../apps/ingestor/src/ingest-quality-drop.ts";
import type { FetchedPage } from "../../apps/ingestor/src/adapters/types.ts";

function page(file: string, url: string): FetchedPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    html: readFileSync(new URL(`../fixtures/south-america/${file}`, import.meta.url), "utf8"),
    etag: null,
    lastModified: null,
    listingOnly: false,
  };
}

test("FAPESP title prefix stripping", () => {
  const raw = "Pesquisa e Inovação: Criação e validação de método físico";
  assert.equal(stripFapespTitlePrefix(raw), "Criação e validação de método físico");
});

test("FAPESP list extracts auxilio ids", () => {
  const html = readFileSync(new URL("../fixtures/south-america/fapesp-pipe-list.html", import.meta.url), "utf8");
  const refs = extractFapespAuxilioRefs(html);
  assert.equal(refs.length, 3);
  assert.equal(refs[0].externalId, "121386");
});

test("FAPESP detail parse uses Resumo", () => {
  const draft = parseFapespPipeDetail(page(
    "fapesp-pipe-detail.html",
    "https://bv.fapesp.br/pt/auxilios/121386/criacao-e-validacao-de-metodo-fisico-para-atracao-succao-e-morte-da-mosca-branca-bemisia-tabaci/",
  ));
  assert.match(draft.title, /Mosca Branca/i);
  assert.ok(meetsSouthAmericaDescriptionGate(draft.extractedText));
  assert.equal(draft.externalId, "121386");
});

test("UC Chile excerpt rejection", () => {
  const excerpt = "Resumen corto del proyecto en la tarjeta de listado. […]";
  assert.equal(isListingExcerptDescription(excerpt), true);
  assert.throws(
    () => parseUcChileDetail({
      ...page("uc-chile-detail.html", "https://transferenciaydesarrollo.uc.cl/innovaciones-uc/tecnologias/aeonix-ia-mantenimiento/"),
      html: "<html><body><h1>AEONIX</h1><article><p>Solo un párrafo corto sin suficiente detalle.</p></article></body></html>",
    }),
    (error: unknown) => error instanceof IngestQualityDropError,
  );
});

test("UC Chile detail parse accepts full Spanish description", () => {
  const draft = parseUcChileDetail(page(
    "uc-chile-detail.html",
    "https://transferenciaydesarrollo.uc.cl/innovaciones-uc/tecnologias/aeonix-ia-mantenimiento/",
  ));
  assert.match(draft.title, /AEONIX/i);
  assert.ok(meetsSouthAmericaDescriptionGate(draft.extractedText));
});

test("Premios Verdes country filtering on list cards", () => {
  const html = readFileSync(new URL("../fixtures/south-america/premios-verdes-list.html", import.meta.url), "utf8");
  const cards = parsePremiosVerdesListingCard(html);
  assert.equal(cards.length, 3);
  const chile = cards.find((card) => card.locationLine.includes("Chile"));
  const mexico = cards.find((card) => card.locationLine.includes("México"));
  assert.ok(chile);
  assert.ok(mexico);
  assert.equal(isPremiosSouthAmericaCountry(parseSouthAmericaCountryFromLocation(chile!.locationLine)), true);
  assert.equal(isPremiosSouthAmericaCountry(parseSouthAmericaCountryFromLocation(mexico!.locationLine)), false);
});

test("Premios Verdes contact-field stripping on detail", () => {
  const draft = parsePremiosVerdesDetail(page(
    "premios-verdes-detail.html",
    "https://500-mejores.premiosverdes.org/es/proyecto/reforestadora-comunitaria-andes",
  ));
  assert.match(draft.title, /Reforestadora/i);
  assert.equal(draft.extractedText.includes("maria@example.com"), false);
  assert.equal(draft.extractedText.includes("1234 5678"), false);
  assert.equal(draft.externalId, "2026-reforestadora-comunitaria-andes");
});

test("stripPersonalContactHtml removes mailto blocks", () => {
  const cleaned = stripPersonalContactHtml('<p>Ok</p><a href="mailto:a@b.com">x</a><p>More text here for testing.</p>');
  assert.equal(cleaned.includes("mailto:"), false);
});

test("two-sentence description gate", () => {
  assert.equal(meetsSouthAmericaDescriptionGate("One short line only."), false);
  const ok = "First sentence with enough length to count as a full thought here. "
    + "Second sentence adds the required detail for ingest quality with more than twelve characters.";
  assert.equal(meetsSouthAmericaDescriptionGate(ok), true);
});

test("zero-items discover failure", () => {
  assert.throws(
    () => assertDiscoverNonEmpty("premios-verdes-500", []),
    /south_america_zero_discover/,
  );
});

test("south america adapters registered", () => {
  const ids = southAmericaAdapters.map((adapter) => adapter.id);
  assert.deepEqual(ids.sort(), ["fapesp-pipe", "premios-verdes-500", "uc-chile-technologies"].sort());
});
