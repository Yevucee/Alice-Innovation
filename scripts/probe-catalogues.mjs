import { load } from "cheerio";

const UA = "Alice-Innovation-Library/1.0 (+https://alice-web-production.up.railway.app)";

const sites = [
  { id: "earthshot", url: "https://earthshotprize.org/winners-finalists/" },
  { id: "hundred", url: "https://hundred.org/en/innovations" },
  { id: "opsi", url: "https://oecd-opsi.org/case_type/opsi/" },
  { id: "skoll", url: "https://skoll.org/community/awardees/" },
  { id: "echoing", url: "https://echoinggreen.org/fellowship/issues/" },
  { id: "elevate", url: "https://elevateprize.org/winners/" },
  { id: "audacious", url: "https://www.audaciousproject.org/grantees" },
  { id: "zayed", url: "https://zayedsustainabilityprize.com/en/winners" },
  { id: "holcim", url: "https://www.holcimfoundation.org/awards" },
  { id: "nesta", url: "https://www.nesta.org.uk/project/" },
  { id: "eit", url: "https://www.eitfood.eu/innovation" },
  { id: "imagine", url: "https://www.imagineh2o.org/" },
];

for (const { id, url } of sites) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    const html = await r.text();
    const $ = load(html);
    const links = new Set();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!href.startsWith("http") && !href.startsWith("/")) return;
      try {
        const u = new URL(href, url);
        if (u.hostname.includes("earthshot") && u.pathname.split("/").length > 3) links.add(u.pathname);
        if (id === "hundred" && u.hostname.includes("hundred.org") && u.pathname.includes("/innovations/")) links.add(u.toString());
        if (id === "opsi" && u.hostname.includes("oecd-opsi") && u.pathname.includes("/")) links.add(u.pathname);
        if (id === "skoll" && u.hostname.includes("skoll.org") && /awardee|community/.test(u.pathname)) links.add(u.pathname);
        if (id === "elevate" && u.hostname.includes("elevateprize") && u.pathname.length > 10) links.add(u.pathname);
        if (id === "audacious" && u.hostname.includes("audaciousproject") && u.pathname.includes("/grantees/")) links.add(u.pathname);
      } catch {
        /* ignore */
      }
    });
    console.log(id, r.status, "len", html.length, "sample links", [...links].slice(0, 5));
  } catch (e) {
    console.log(id, "ERR", e.message);
  }
}
