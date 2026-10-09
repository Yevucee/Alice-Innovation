/**
 * Live probes for high-volume open innovation catalogues (Africa/Asia first).
 * Usage: npx tsx scripts/probe-open-volume-candidates.ts
 */
import { auditDraftShape } from "@alice/database";
import { evaluateDraftQuality } from "@alice/shared";
import { buildDraft } from "../apps/ingestor/src/adapters/draft.js";
import { fetchText } from "../apps/ingestor/src/http.js";

const UA = "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";

type Probe = {
  id: string;
  region: string;
  url: string;
  method: string;
  robotsNote: string;
  countEstimate: number | string;
  samples: Array<{ title: string; url: string; summary: string }>;
  gatePassEstimate: string;
  recommend: "enable" | "skip" | "investigate";
  notes: string;
};

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchText(url, { userAgent: UA, timeoutMs: 45000, maxAttempts: 2, ...init });
  return JSON.parse(res.body);
}

function gateCheck(title: string, url: string, summary: string): boolean {
  const draft = buildDraft({
    title,
    url,
    externalId: url,
    summary,
    text: summary,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  });
  return auditDraftShape(draft).length === 0 && !evaluateDraftQuality(draft).needsReview;
}

async function probeKenyaCic(): Promise<Probe> {
  const url = "https://cic.co.ke/wp-json/wp/v2/posts?categories=17&per_page=100&page=1";
  const rows = (await fetchJson(url)) as Array<{ link: string; title: { rendered: string }; excerpt: { rendered: string } }>;
  const samples = rows.slice(0, 10).map((r) => ({
    title: r.title.rendered.replace(/<[^>]+>/g, "").trim(),
    url: r.link,
    summary: r.excerpt.rendered.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
  }));
  const pass = samples.filter((s) => gateCheck(s.title, s.url, s.summary)).length;
  return {
    id: "kenya-cic-innovations-wp",
    region: "africa",
    url,
    method: "WordPress REST JSON",
    robotsNote: "wp-json typically allowed; verify robots on cic.co.ke",
    countEstimate: "100+ (paginate categories=17)",
    samples,
    gatePassEstimate: `${pass}/10 sample`,
    recommend: pass >= 6 ? "investigate" : "skip",
    notes: "News/innovation posts not pure startup directory; volume moderate.",
  };
}

async function probeIndiaStartup(): Promise<Probe> {
  const url = "https://api.startupindia.gov.in/sih/api/noauth/startup/getStartups?size=100&page=0";
  let rows: unknown;
  try {
    rows = await fetchJson(url);
  } catch (e) {
    return {
      id: "startup-india-api",
      region: "asia",
      url,
      method: "public JSON API",
      robotsNote: "n/a",
      countEstimate: "unknown (blocked)",
      samples: [],
      gatePassEstimate: "n/a",
      recommend: "skip",
      notes: `Unreachable from agent: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const list = (rows as { content?: unknown[] }).content ?? [];
  const samples = (list as Array<Record<string, unknown>>).slice(0, 10).map((r) => {
    const title = String(r.startupName ?? r.name ?? "Unknown");
    const summary = String(r.briefDescription ?? r.description ?? title);
    const link = String(r.website ?? r.startupUrl ?? `https://www.startupindia.gov.in/startup/${r.id ?? ""}`);
    return { title, url: link, summary };
  });
  const pass = samples.filter((s) => gateCheck(s.title, s.url, s.summary)).length;
  return {
    id: "startup-india-api",
    region: "asia",
    url,
    method: "public JSON API",
    robotsNote: "government portal; check ToS for bulk use",
    countEstimate: "10k+ registered startups (paginate)",
    samples,
    gatePassEstimate: `${pass}/10 sample`,
    recommend: pass >= 7 ? "enable" : "investigate",
    notes: "High volume if API remains open and stable.",
  };
}

async function probeAfricanDevelopmentBank(): Promise<Probe> {
  const url = "https://projectsportal.afdb.org/dataportal/VProject/list?format=json&limit=100&offset=0";
  try {
    const body = await fetchJson(url);
    const rows = (body as { data?: unknown[] }).data ?? body;
    const list = Array.isArray(rows) ? rows : [];
    const samples = (list as Array<Record<string, unknown>>).slice(0, 10).map((r) => ({
      title: String(r.project_name ?? r.title ?? "Project"),
      url: `https://projectsportal.afdb.org/dataportal/VProject/show/${r.project_id ?? r.id}`,
      summary: String(r.project_description ?? r.sector ?? "").slice(0, 400),
    }));
    const pass = samples.filter((s) => gateCheck(s.title, s.url, s.summary)).length;
    return {
      id: "afdb-projects-portal",
      region: "africa",
      url,
      method: "JSON list API",
      robotsNote: "public portal",
      countEstimate: `${list.length}+ per page (grant/projects — weak innovation fit)`,
      samples,
      gatePassEstimate: `${pass}/10 sample`,
      recommend: "skip",
      notes: "Mostly development finance projects, not startup/solution catalogue.",
    };
  } catch (e) {
    return {
      id: "afdb-projects-portal",
      region: "africa",
      url,
      method: "JSON list API",
      robotsNote: "unknown",
      countEstimate: "unknown",
      samples: [],
      gatePassEstimate: "n/a",
      recommend: "skip",
      notes: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function probeGtiHubSingapore(): Promise<Probe> {
  const sitemap = "https://www.enterprisesg.gov.sg/sitemap.xml";
  try {
    const res = await fetchText(sitemap, { userAgent: UA, timeoutMs: 30000 });
    const locs = [...res.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const startup = locs.filter((u) => /startup|innovation|tech/i.test(u));
    return {
      id: "enterprisesg-sitemap",
      region: "asia",
      url: sitemap,
      method: "sitemap",
      robotsNote: "check enterprisesg robots",
      countEstimate: `${startup.length} innovation-ish URLs of ${locs.length} total`,
      samples: startup.slice(0, 10).map((u) => ({ title: u.split("/").pop() ?? u, url: u, summary: "Government programme page; summary requires HTML fetch." })),
      gatePassEstimate: "defer",
      recommend: "investigate",
      notes: "Sparse direct startup records in sitemap alone.",
    };
  } catch (e) {
    return {
      id: "enterprisesg-sitemap",
      region: "asia",
      url: sitemap,
      method: "sitemap",
      robotsNote: "unknown",
      countEstimate: "unknown",
      samples: [],
      gatePassEstimate: "n/a",
      recommend: "skip",
      notes: `Unreachable: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function probeEurLexInnovation(): Promise<Probe> {
  return {
    id: "cordis-already-enabled",
    region: "europe",
    url: "https://cordis.europa.eu/search/en?format=json&q=contenttype=project",
    method: "already in sources.yaml",
    robotsNote: "enabled",
    countEstimate: "~59k",
    samples: [],
    gatePassEstimate: "~22%",
    recommend: "skip",
    notes: "Already primary EU volume source.",
  };
}

async function probeBrazilStartups(): Promise<Probe> {
  const url = "https://api.crunchbase.com/v4/unsupported";
  return {
    id: "brazil-startupbase",
    region: "south-america",
    url: "https://startupbase.com.br/startups",
    method: "HTML listing (probe listing count via search)",
    robotsNote: "check site ToS",
    countEstimate: "probe via HTML",
    samples: [],
    gatePassEstimate: "pending",
    recommend: "investigate",
    notes: "Placeholder — fetch listing separately",
  };
}

async function probeStartupBaseBr(): Promise<Probe> {
  const url = "https://startupbase.com.br/api/startups?limit=100&page=1";
  try {
    const rows = (await fetchJson(url)) as { data?: Array<Record<string, unknown>>; total?: number };
    const list = rows.data ?? [];
    const samples = list.slice(0, 10).map((r) => ({
      title: String(r.name ?? "Startup"),
      url: String(r.website ?? r.url ?? `https://startupbase.com.br/startup/${r.slug ?? r.id}`),
      summary: String(r.description ?? r.segment ?? "").slice(0, 400),
    }));
    const pass = samples.filter((s) => gateCheck(s.title, s.url, s.summary)).length;
    return {
      id: "startupbase-brazil-api",
      region: "south-america",
      url,
      method: "public JSON API",
      robotsNote: "verify ToS for commercial index use",
      countEstimate: rows.total ?? list.length,
      samples,
      gatePassEstimate: `${pass}/10 sample`,
      recommend: pass >= 6 ? "enable" : "investigate",
      notes: "Brazil startup directory API responded in probe.",
    };
  } catch (e) {
    return {
      id: "startupbase-brazil-api",
      region: "south-america",
      url,
      method: "public JSON API",
      robotsNote: "unknown",
      countEstimate: "unknown",
      samples: [],
      gatePassEstimate: "n/a",
      recommend: "skip",
      notes: `API not available: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function probeTechstarsPortfolio(): Promise<Probe> {
  const url = "https://www.techstars.com/portfolio?format=json";
  try {
    const res = await fetchText("https://www.techstars.com/portfolio", { userAgent: UA, timeoutMs: 30000 });
    const links = [...res.body.matchAll(/href=\"(\/companies\/[^\"]+)\"/g)].map((m) => `https://www.techstars.com${m[1]}`);
    const uniq = [...new Set(links)];
    const samples = uniq.slice(0, 10).map((u) => ({
      title: u.split("/").pop()?.replace(/-/g, " ") ?? u,
      url: u,
      summary: "Techstars portfolio company page; body fetch needed for summary.",
    }));
    return {
      id: "techstars-portfolio-html",
      region: "global",
      url: "https://www.techstars.com/portfolio",
      method: "HTML + embedded links",
      robotsNote: "check robots",
      countEstimate: uniq.length,
      samples,
      gatePassEstimate: "defer",
      recommend: uniq.length >= 1000 ? "investigate" : "skip",
      notes: `Counted ${uniq.length} /companies/ links on first page HTML only (may be JS-rendered).`,
    };
  } catch (e) {
    return {
      id: "techstars-portfolio-html",
      region: "global",
      url: "https://www.techstars.com/portfolio",
      method: "HTML",
      robotsNote: "unknown",
      countEstimate: 0,
      samples: [],
      gatePassEstimate: "n/a",
      recommend: "skip",
      notes: String(e),
    };
  }
}

async function probeUnidoItpo(): Promise<Probe> {
  const url = "https://open.unido.org/api/v1/projects?limit=100&offset=0";
  try {
    const body = await fetchJson(url);
    const list = (body as { results?: unknown[] }).results ?? [];
    const samples = (list as Array<Record<string, unknown>>).slice(0, 10).map((r) => ({
      title: String(r.title ?? r.name ?? "Project"),
      url: String(r.url ?? `https://open.unido.org/projects/${r.id}`),
      summary: String(r.description ?? "").slice(0, 400),
    }));
    const pass = samples.filter((s) => gateCheck(s.title, s.url, s.summary)).length;
    return {
      id: "unido-open-projects",
      region: "global",
      url,
      method: "JSON API",
      robotsNote: "open data",
      countEstimate: (body as { count?: number }).count ?? list.length,
      samples,
      gatePassEstimate: `${pass}/10 sample`,
      recommend: "skip",
      notes: "UNIDO projects are grant/technical assistance, not startup solutions.",
    };
  } catch (e) {
    return {
      id: "unido-open-projects",
      region: "global",
      url,
      method: "JSON API",
      robotsNote: "unknown",
      countEstimate: "unknown",
      samples: [],
      gatePassEstimate: "n/a",
      recommend: "skip",
      notes: String(e),
    };
  }
}

async function main(): Promise<void> {
  const probes = await Promise.all([
    probeKenyaCic(),
    probeIndiaStartup(),
    probeAfricanDevelopmentBank(),
    probeGtiHubSingapore(),
    probeEurLexInnovation(),
    probeStartupBaseBr(),
    probeTechstarsPortfolio(),
    probeUnidoItpo(),
  ]);
  console.log(JSON.stringify(probes, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
