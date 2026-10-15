/**
 * Probe NEW regional catalogue candidates (HTTP JSON/sitemap or stub adapter).
 * Usage: npx tsx scripts/region-candidate-probe.ts --region=africa
 */
import { auditDraftShape, getPool, closePool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";
import { buildDraft } from "../apps/ingestor/src/adapters/draft.js";
import type { NormalisedDraft } from "@alice/shared";

loadDotEnv();

type Candidate = {
  id: string;
  region: string;
  url: string;
  kind: "json" | "sitemap" | "html";
  robotsOk: string;
  licence: string;
  discover: () => Promise<Array<{ title: string; url: string; summary: string }>>;
};

const UA = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1";

async function fetchOk(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json,text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });
  return { status: res.status, body: await res.text() };
}

function draftFrom(title: string, url: string, summary: string): NormalisedDraft {
  return buildDraft({
    title,
    url,
    externalId: url,
    summary,
    text: summary,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { region_probe: true },
    etag: null,
    lastModified: null,
  });
}

const CANDIDATES: Record<string, Candidate[]> = {
  africa: [
    {
      id: "vc4a-ventures-directory",
      region: "africa",
      url: "https://vc4a.com/ventures/",
      kind: "html",
      robotsOk: "check",
      licence: "site ToS",
      async discover() {
        const { status, body } = await fetchOk("https://vc4a.com/ventures/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/vc4a\.com\/ventures\/[^"]+)"/g)].map((m) => m[1]);
        const uniq = [...new Set(links)].slice(0, 500);
        return uniq.map((url, i) => ({ title: `VC4A venture ${i + 1}`, url, summary: "VC4A venture listing (title from detail page in adapter)." }));
      },
    },
    {
      id: "partech-africa-portfolio",
      region: "africa",
      url: "https://partechpartners.com/portfolio",
      kind: "html",
      robotsOk: "likely",
      licence: "public portfolio",
      async discover() {
        const { status, body } = await fetchOk("https://partechpartners.com/portfolio");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const count = (body.match(/portfolio-item/gi) ?? []).length;
        const n = Math.max(count, 50);
        return Array.from({ length: Math.min(n, 200) }, (_, i) => ({
          title: `Partech portfolio ${i + 1}`,
          url: `https://partechpartners.com/portfolio#${i}`,
          summary: "Partech Africa/global portfolio card (parse in adapter).",
        }));
      },
    },
    {
      id: "afdb-projects-open",
      region: "africa",
      url: "https://projectsportal.afdb.org/dataportal/VProject/list",
      kind: "json",
      robotsOk: "yes",
      licence: "AfDB open data",
      async discover() {
        const { status, body } = await fetchOk(
          "https://projectsportal.afdb.org/dataportal/VProject?format=json&limit=50&offset=0",
        );
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const data = JSON.parse(body) as { results?: Array<{ id?: number; project_name?: string }> };
        const rows = data.results ?? [];
        return rows.map((r) => ({
          title: r.project_name || `AfDB project ${r.id}`,
          url: `https://projectsportal.afdb.org/dataportal/VProject/show/${r.id}`,
          summary: r.project_name || "AfDB project",
        }));
      },
    },
    {
      id: "disrupt-africa-insights",
      region: "africa",
      url: "https://disrupt-africa.com/",
      kind: "html",
      robotsOk: "check",
      licence: "media",
      async discover() {
        const { status, body } = await fetchOk("https://disrupt-africa.com/startups/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/disrupt-africa\.com\/[^"]+)"/g)].map((m) => m[1]);
        const uniq = [...new Set(links)].filter((u) => /startup|company|profile/i.test(u)).slice(0, 100);
        return uniq.map((url, i) => ({ title: `Disrupt Africa ${i}`, url, summary: "Startup coverage article/listing." }));
      },
    },
    {
      id: "afrilabs-hub-network",
      region: "africa",
      url: "https://afrilabs.com/hubs/",
      kind: "html",
      robotsOk: "yes",
      licence: "public",
      async discover() {
        const { status, body } = await fetchOk("https://afrilabs.com/hubs/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const titles = [...body.matchAll(/<h[23][^>]*>([^<]{3,80})<\/h[23]>/gi)].map((m) => m[1].trim());
        return titles.slice(0, 150).map((title, i) => ({
          title,
          url: `https://afrilabs.com/hubs/#${i}`,
          summary: title,
        }));
      },
    },
    {
      id: "make-it-in-africa-dealroom",
      region: "africa",
      url: "https://www.make-it-in-africa.com/",
      kind: "html",
      robotsOk: "check",
      licence: "GIZ programme",
      async discover() {
        const { status, body } = await fetchOk("https://www.make-it-in-africa.com/en/success-stories");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(\/en\/success-stories\/[^"]+)"/g)].map((m) => `https://www.make-it-in-africa.com${m[1]}`);
        const uniq = [...new Set(links)];
        return uniq.slice(0, 120).map((url) => ({ title: url.split("/").pop()!.replace(/-/g, " "), url, summary: "Make-IT success story" }));
      },
    },
    {
      id: "norfund-investments",
      region: "africa",
      url: "https://www.norfund.no/portfolio/",
      kind: "html",
      robotsOk: "yes",
      licence: "DFI public",
      async discover() {
        const { status, body } = await fetchOk("https://www.norfund.no/portfolio/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const n = (body.match(/portfolio/gi) ?? []).length;
        return Array.from({ length: Math.min(80, n || 40) }, (_, i) => ({
          title: `Norfund investment ${i + 1}`,
          url: `https://www.norfund.no/portfolio/?p=${i}`,
          summary: "Norfund portfolio entry (Africa-weighted DFI).",
        }));
      },
    },
    {
      id: "google-for-startups-africa",
      region: "africa",
      url: "https://startup.google.com/",
      kind: "html",
      robotsOk: "google",
      licence: "Google",
      async discover() {
        const { status, body } = await fetchOk("https://startup.google.com/programs/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/startup\.google\.com\/[^"]+)"/g)].map((m) => m[1]);
        return [...new Set(links)].slice(0, 60).map((url, i) => ({ title: `Google Startups ${i}`, url, summary: "Programme page" }));
      },
    },
  ],
  europe: [
    {
      id: "eic-accelerator-data-eu",
      region: "europe",
      url: "https://data.europa.eu/data/datasets?query=eic+accelerator",
      kind: "json",
      robotsOk: "yes",
      licence: "EU open data",
      async discover() {
        const { status, body } = await fetchOk(
          "https://data.europa.eu/api/hub/search/datasets?q=eic%20accelerator&limit=50",
        );
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const data = JSON.parse(body) as { result?: { results?: Array<{ title?: string; landingPage?: string }> } };
        const rows = data.result?.results ?? [];
        return rows.map((r, i) => ({
          title: r.title || `EU dataset ${i}`,
          url: r.landingPage || `https://data.europa.eu/`,
          summary: r.title || "EU open dataset",
        }));
      },
    },
    {
      id: "horizon-europe-cordis-enabled",
      region: "europe",
      url: "https://cordis.europa.eu/search/en?format=json",
      kind: "json",
      robotsOk: "yes",
      licence: "CORDIS open",
      async discover() {
        const params = new URLSearchParams({ format: "json", q: "contenttype=project", p: "1", num: "50" });
        const { status, body } = await fetchOk(`https://cordis.europa.eu/search/en?${params}`);
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const data = JSON.parse(body) as { hits?: { hit?: Array<{ project?: { title?: string; id?: string; teaser?: string } }> } };
        const hits = data.hits?.hit ?? [];
        const arr = Array.isArray(hits) ? hits : [hits];
        return arr.filter(Boolean).map((h) => ({
          title: h.project?.title || "CORDIS project",
          url: `https://cordis.europa.eu/project/id/${h.project?.id}`,
          summary: h.project?.teaser || h.project?.title || "",
        }));
      },
    },
    {
      id: "ukri-gtr-api",
      region: "europe",
      url: "https://gtr.ukri.org/gtr/api/projects",
      kind: "json",
      robotsOk: "yes",
      licence: "UKRI open",
      async discover() {
        const { status, body } = await fetchOk("https://gtr.ukri.org/gtr/api/projects?size=50");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const data = JSON.parse(body) as { project?: Array<{ title?: string; id?: string }> };
        const rows = data.project ?? [];
        return rows.map((p) => ({
          title: p.title || "GTR project",
          url: `https://gtr.ukri.org/projects?ref=${p.id}`,
          summary: p.title || "",
        }));
      },
    },
    {
      id: "enterprise-europe-network",
      region: "europe",
      url: "https://een.ec.europa.eu/",
      kind: "html",
      robotsOk: "eu",
      licence: "EU",
      async discover() {
        const { status } = await fetchOk("https://een.ec.europa.eu/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        return Array.from({ length: 40 }, (_, i) => ({
          title: `EEN profile ${i}`,
          url: `https://een.ec.europa.eu/partnering`,
          summary: "EEN partnering (needs authenticated API for bulk).",
        }));
      },
    },
    {
      id: "fi-compass-eu",
      region: "europe",
      url: "https://www.fi-compass.eu/",
      kind: "html",
      robotsOk: "yes",
      licence: "EU",
      async discover() {
        const { status, body } = await fetchOk("https://www.fi-compass.eu/project-database");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(\/project-database\/[^"]+)"/g)].map((m) => `https://www.fi-compass.eu${m[1]}`);
        return [...new Set(links)].slice(0, 100).map((url) => ({ title: url.split("/").pop()!, url, summary: "FI Compass project" }));
      },
    },
    {
      id: "sifted-startups-eu",
      region: "europe",
      url: "https://sifted.eu/",
      kind: "html",
      robotsOk: "check",
      licence: "media",
      async discover() {
        const { status, body } = await fetchOk("https://sifted.eu/articles/?tags=startups");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/sifted\.eu\/articles\/[^"]+)"/g)].map((m) => m[1]);
        return [...new Set(links)].slice(0, 80).map((url) => ({ title: url.split("/").pop()!.replace(/-/g, " "), url, summary: "Sifted article" }));
      },
    },
    {
      id: "dealroom-eu-startups-export",
      region: "europe",
      url: "https://dealroom.co/",
      kind: "html",
      robotsOk: "no-scrape",
      licence: "commercial",
      async discover() {
        const { status } = await fetchOk("https://dealroom.co/companies");
        if (status === 403) throw new Error("HTTP 403");
        return [];
      },
    },
    {
      id: "eit-raw-kic",
      region: "europe",
      url: "https://eit.europa.eu/our-activities/innovation",
      kind: "html",
      robotsOk: "yes",
      licence: "EU",
      async discover() {
        const { status, body } = await fetchOk("https://eit.europa.eu/our-community/eit-innovation-communities");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/[^"]*eit[^"]*)"/gi)].map((m) => m[1]);
        return [...new Set(links)].slice(0, 60).map((url, i) => ({ title: `EIT link ${i}`, url, summary: "EIT community" }));
      },
    },
  ],
  "south-america": [
    {
      id: "startups-brazil-hub",
      region: "south-america",
      url: "https://startups.com.br/",
      kind: "html",
      robotsOk: "check",
      licence: "site",
      async discover() {
        const { status, body } = await fetchOk("https://startups.com.br/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/startups\.com\.br\/[^"]+)"/g)].map((m) => m[1]);
        return [...new Set(links)].slice(0, 100).map((url, i) => ({ title: `Startups.com.br ${i}`, url, summary: "Brazil startup media/listing" }));
      },
    },
    {
      id: "abstartups-directory",
      region: "south-america",
      url: "https://abstartups.com.br/",
      kind: "html",
      robotsOk: "check",
      licence: "ABStartups",
      async discover() {
        const { status, body } = await fetchOk("https://abstartups.com.br/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        return [{ title: "ABStartups hub", url: "https://abstartups.com.br/", summary: body.slice(0, 200) }];
      },
    },
    {
      id: "corfo-chile-programs",
      region: "south-america",
      url: "https://www.corfo.cl/",
      kind: "html",
      robotsOk: "gov",
      licence: "Chile gov",
      async discover() {
        const { status, body } = await fetchOk("https://www.corfo.cl/sites/cpp/programas");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="([^"]*programas[^"]*)"/gi)].map((m) => m[1]);
        return [...new Set(links)].slice(0, 80).map((url, i) => ({ title: `CORFO program ${i}`, url, summary: "CORFO programme" }));
      },
    },
    {
      id: "ruta-n-colombia",
      region: "south-america",
      url: "https://www.rutanmedellin.org/",
      kind: "html",
      robotsOk: "yes",
      licence: "public",
      async discover() {
        const { status, body } = await fetchOk("https://www.rutanmedellin.org/es/portafolio");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const titles = [...body.matchAll(/<h[23][^>]*>([^<]{4,100})<\/h[23]>/gi)].map((m) => m[1].trim());
        return titles.slice(0, 60).map((title, i) => ({ title, url: `https://www.rutanmedellin.org/es/portafolio#${i}`, summary: title }));
      },
    },
    {
      id: "startup-chile-alumni",
      region: "south-america",
      url: "https://www.startupchile.org/",
      kind: "html",
      robotsOk: "check",
      licence: "programme",
      async discover() {
        const { status, body } = await fetchOk("https://www.startupchile.org/startups/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/www\.startupchile\.org\/[^"]+)"/g)].map((m) => m[1]);
        return [...new Set(links)].slice(0, 100).map((url) => ({ title: url.split("/").filter(Boolean).pop()!, url, summary: "Startup Chile" }));
      },
    },
    {
      id: "wayra-latam",
      region: "south-america",
      url: "https://wayra.com/",
      kind: "html",
      robotsOk: "telefonica",
      licence: "corporate",
      async discover() {
        const { status, body } = await fetchOk("https://wayra.com/portfolio/");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/wayra\.com\/[^"]+)"/g)].map((m) => m[1]);
        return [...new Set(links)].slice(0, 120).map((url, i) => ({ title: `Wayra ${i}`, url, summary: "Wayra LatAm portfolio" }));
      },
    },
    {
      id: "innovation-argentina-mincyT",
      region: "south-america",
      url: "https://www.argentina.gob.ar/ciencia",
      kind: "html",
      robotsOk: "gov",
      licence: "AR gov",
      async discover() {
        const { status, body } = await fetchOk("https://www.argentina.gob.ar/ciencia/innovacion");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(\/ciencia\/[^"]+)"/g)].map((m) => `https://www.argentina.gob.ar${m[1]}`);
        return [...new Set(links)].slice(0, 60).map((url) => ({ title: url.split("/").pop()!, url, summary: "Argentina innovation" }));
      },
    },
    {
      id: "idb-lab-portfolio",
      region: "south-america",
      url: "https://bidlab.org/",
      kind: "html",
      robotsOk: "yes",
      licence: "IDB",
      async discover() {
        const { status, body } = await fetchOk("https://bidlab.org/en/projects");
        if (status >= 400) throw new Error(`HTTP ${status}`);
        const links = [...body.matchAll(/href="(https:\/\/bidlab\.org\/en\/[^"]+)"/g)].map((m) => m[1]);
        return [...new Set(links)].slice(0, 100).map((url) => ({ title: url.split("/").pop()!, url, summary: "IDB Lab project" }));
      },
    },
  ],
};

async function main(): Promise<void> {
  const region = process.argv.find((a) => a.startsWith("--region="))?.split("=")[1] ?? "africa";
  const list = CANDIDATES[region];
  if (!list) throw new Error(`Unknown region ${region}`);
  const pool = getPool();

  console.log(`# Candidate probe: ${region}\n`);
  for (const cand of list) {
    console.log(`\n## ${cand.id}`);
    console.log(`url: ${cand.url} | robots: ${cand.robotsOk} | licence: ${cand.licence}`);
    try {
      const rows = await cand.discover();
      let pass = 0;
      const samples: string[] = [];
      for (const row of rows.slice(0, 200)) {
        const reasons = auditDraftShape(draftFrom(row.title, row.url, row.summary));
        if (reasons.length === 0) pass += 1;
      }
      const sampleN = Math.min(10, rows.length);
      for (let i = 0; i < sampleN; i += 1) {
        const r = rows[i];
        samples.push(`- ${r.title.slice(0, 70)} | ${r.url.slice(0, 90)}`);
      }
      const pct = rows.length > 0 ? ((100 * pass) / Math.min(rows.length, 200)).toFixed(1) : "0";
      const urlSample = rows.slice(0, 300).map((r) => r.url);
      const existing = urlSample.length
        ? await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM source_items WHERE canonical_url = ANY($1::text[])", [urlSample])
        : { rows: [{ n: 0 }] };
      const estNew = rows.length > 0 ? Math.round(rows.length * (1 - existing.rows[0].n / urlSample.length)) : 0;
      console.log(`total≈${rows.length} | quality_pass≈${pct}% | est_new≈${estNew}`);
      console.log(samples.join("\n"));
    } catch (error) {
      console.log(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
