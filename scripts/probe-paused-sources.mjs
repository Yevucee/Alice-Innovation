import { load } from "cheerio";
import { loadSources } from "../packages/source-registry/src/load.ts";

const UA = "Alice-Innovation-Library/1.0 (+https://alice-web-production.up.railway.app)";
const paused = loadSources().filter((s) => s.status === "PAUSED" && !s.collection_url);

async function probe(source) {
  const homepage = source.homepage;
  const result = { id: source.id, homepage, hints: [] };
  try {
    const r = await fetch(homepage, { headers: { "User-Agent": UA }, redirect: "follow" });
    result.status = r.status;
    const html = await r.text();
    const $ = load(html);
    const sitemapLink = $("link[rel='sitemap']").attr("href")
      || html.match(/Sitemap:\s*(\S+)/i)?.[1]
      || null;
    if (sitemapLink) result.hints.push(`sitemap:${sitemapLink}`);
    for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/wp-json/wp/v2/types"]) {
      try {
        const u = new URL(path, homepage);
        const sr = await fetch(u, { headers: { "User-Agent": UA } });
        if (sr.ok) result.hints.push(`ok:${path}(${sr.status})`);
      } catch {
        /* ignore */
      }
    }
    const links = new Map();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      try {
        const u = new URL(href, homepage);
        if (!u.hostname.replace(/^www\./, "").includes(new URL(homepage).hostname.replace(/^www\./, ""))) return;
        const p = u.pathname;
        if (/portfolio|project|innovation|solution|fellow|grantee|winner|case-stud|programme|challenge|explorer|database|catalog/i.test(p)) {
          links.set(p, (links.get(p) || 0) + 1);
        }
      } catch {
        /* ignore */
      }
    });
    result.topPaths = [...links.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, c]) => `${c}:${p}`);
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

for (const source of paused) {
  const p = await probe(source);
  console.log(JSON.stringify(p));
}
