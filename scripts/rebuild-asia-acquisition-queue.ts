/**
 * Canonical Asia acquisition queue (seq 1–77) from product spec Oct 2026.
 * Regenerates `config/asia-acquisition-queue.json` acquisition section.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Entry = {
  id: string;
  seq: number;
  batch: string;
  name: string;
  homepage: string | null;
  collection_url: string | null;
  priority_first: boolean;
  duplicate_of: string | null;
  notes: string;
};

const PRIORITY = new Set([
  "birac-technology-portal",
  "ccamp",
  "sginnovate-portfolio",
  "open-innovation-network-singapore",
  "findit-taiwan",
  "j-startup",
  "dcamp-startup-directory",
  "seoul-bio-hub",
  "hkstp-company-directory",
  "startup-thailand-ecosystem",
  "startup-bangladesh-portfolio",
  "astana-hub-company-network",
  "hub71-startup-directory",
  "kaust-scalex-portfolio",
  "adb-ventures-portfolio",
]);

function row(
  seq: number,
  batch: string,
  id: string,
  name: string,
  homepage: string | null,
  collection_url: string | null,
  duplicate_of: string | null = null,
  notes = "",
): Entry {
  return {
    id,
    seq,
    batch,
    name,
    homepage,
    collection_url,
    priority_first: PRIORITY.has(id),
    duplicate_of,
    notes,
  };
}

/** seq 1–77 — official names from acquisition spec; URLs are audit starting points. */
const acquisition: Entry[] = [
  // Batch 1 India
  row(1, "india", "birac-technology-portal", "BIRAC Technology Portal", "https://www.birac.nic.in/", "https://www.birac.nic.in/"),
  row(2, "india", "startup-india-showcase", "Startup India Showcase", "https://www.startupindia.gov.in/", "https://www.startupindia.gov.in/content/sih/en/startup-directory.html"),
  row(3, "india", "national-startup-awards-india", "National Startup Awards India", "https://www.startupindia.gov.in/", "https://www.startupindia.gov.in/content/sih/en/startup-india-awards/winners.html"),
  row(4, "india", "ccamp", "C-CAMP", "https://www.ccamp.res.in/", "https://www.ccamp.res.in/"),
  row(5, "india", "atal-innovation-mission", "Atal Innovation Mission", "https://aim.gov.in/", "https://aim.gov.in/"),
  row(6, "india", "atal-incubation-centres", "Atal Incubation Centres", "https://aim.gov.in/", "https://aim.gov.in/atal-incubation-centres.php", null, "Same programme family as AIM; separate listing surface."),
  row(7, "india", "birac-bionest", "BIRAC BioNEST", "https://www.birac.nic.in/", "https://www.birac.nic.in/bionest.php", null, "BioNEST incubator network under BIRAC."),
  // Batch 2 Singapore
  row(8, "singapore", "startup-sg", "Startup SG", "https://www.startupsg.gov.sg/", "https://www.startupsg.gov.sg/"),
  row(9, "singapore", "sginnovate-portfolio", "SGInnovate Portfolio", "https://www.sginnovate.com/", "https://www.sginnovate.com/our-portfolio"),
  row(10, "singapore", "open-innovation-network-singapore", "Singapore Open Innovation Network", "https://www.openinnovationnetwork.gov.sg/", "https://www.openinnovationnetwork.gov.sg/"),
  row(11, "singapore", "switch-slingshot", "SWITCH SLINGSHOT", "https://www.switchsg.com/", "https://www.switchsg.com/slingshot"),
  row(12, "singapore", "ipi-singapore-innovation-marketplace", "IPI Singapore Innovation Marketplace", "https://www.ipi-singapore.org/", "https://www.ipi-singapore.org/"),
  row(13, "singapore", "the-liveability-challenge", "The Liveability Challenge", "https://www.theliveabilitychallenge.org/", "https://www.theliveabilitychallenge.org/"),
  row(14, "singapore", "nus-enterprise", "NUS Enterprise", "https://enterprise.nus.edu.sg/", "https://enterprise.nus.edu.sg/"),
  row(15, "singapore", "ntuitive", "NTUitive", "https://www.ntuitive.sg/", "https://www.ntuitive.sg/our-startups"),
  // Batch 3 Taiwan
  row(16, "taiwan", "findit-taiwan", "FINDIT Taiwan", "https://findit.org.tw/", "https://findit.org.tw/"),
  row(17, "taiwan", "startup-terrace-taiwan", "Startup Terrace Taiwan", "https://startupterrace.tw/", "https://startupterrace.tw/"),
  row(18, "taiwan", "startup-terrace-kaohsiung", "Startup Terrace Kaohsiung / Asia New Bay Area", "https://startupterrace.tw/", "https://startupterrace.tw/", "startup-terrace-taiwan", "Kaohsiung / ANBA listing on Startup Terrace."),
  // Batch 4 Japan
  row(19, "japan", "j-startup", "J-Startup", "https://www.j-startup.go.jp/en/", "https://www.j-startup.go.jp/en/"),
  row(20, "japan", "j-startup-impact", "J-Startup Impact", "https://www.j-startup.go.jp/en/", "https://www.j-startup.go.jp/en/", "j-startup", "Ingest Impact designation separately from core J-Startup list."),
  // Batch 5 South Korea
  row(21, "south-korea", "seoul-startup-plus", "Seoul Startup Plus", "https://www.seoulstartuphub.com/", "https://www.seoulstartuphub.com/"),
  row(22, "south-korea", "dcamp-startup-directory", "D.CAMP Startup Directory", "https://dcamp.kr/", "https://dcamp.kr/"),
  row(23, "south-korea", "seoul-bio-hub", "Seoul Bio Hub", "https://www.seoulbiohub.or.kr/", "https://www.seoulbiohub.or.kr/"),
  row(24, "south-korea", "k-startup-grand-challenge", "K-Startup Grand Challenge", "https://www.k-startupgc.org/", "https://www.k-startupgc.org/"),
  row(25, "south-korea", "kised", "KISED", "https://www.kised.or.kr/", "https://www.kised.or.kr/"),
  // Batch 6 Hong Kong
  row(26, "hong-kong", "hkstp-company-directory", "Hong Kong Science and Technology Parks Company Directory", "https://www.hkstp.org/", "https://www.hkstp.org/en/directory"),
  row(27, "hong-kong", "hkstp-elite-portfolio", "HKSTP Elite Portfolio", "https://www.hkstp.org/", "https://www.hkstp.org/en/elite"),
  row(28, "hong-kong", "cyberport", "Cyberport", "https://www.cyberport.hk/", "https://www.cyberport.hk/"),
  row(29, "hong-kong", "cyberport-incubation-programme", "Cyberport Incubation Programme", "https://www.cyberport.hk/", "https://www.cyberport.hk/en/about_cyberport/cyberport_incubation_programme"),
  row(30, "hong-kong", "hkust-entrepreneurship-center", "HKUST Entrepreneurship / Technology Commercialisation", "https://ec.hkust.edu.hk/", "https://ec.hkust.edu.hk/"),
  // Batch 7 Thailand
  row(31, "thailand", "startup-thailand-ecosystem", "Startup Thailand Ecosystem", "https://startupthailand.org/", "https://startupthailand.org/"),
  row(32, "thailand", "nia-thailand", "National Innovation Agency Thailand", "https://www.nia.or.th/", "https://www.nia.or.th/"),
  row(33, "thailand", "nia-innovation-catalogue", "NIA Innovation Product / Innovation Catalogue", "https://www.nia.or.th/", null, null, "Locate current public product catalogue during audit."),
  // Batch 8 Malaysia
  row(34, "malaysia", "mystartup-malaysia", "MYStartup Malaysia", "https://mystartup.my/", "https://mystartup.my/"),
  row(35, "malaysia", "mystartup-startup-directory", "MYStartup Startup Directory", "https://mystartup.my/", "https://mystartup.my/directory"),
  row(36, "malaysia", "cradle-fund", "Cradle Fund", "https://www.cradle.com.my/", "https://www.cradle.com.my/"),
  row(37, "malaysia", "cradle-seed-ventures", "Cradle Seed Ventures", "https://www.cradle.com.my/", null, null, "Verify current portfolio route from Cradle site during audit."),
  // Batch 9 Indonesia
  row(38, "indonesia", "startup-studio-indonesia", "Startup Studio Indonesia", "https://startupstudio.id/", "https://startupstudio.id/"),
  row(39, "indonesia", "1000-startup-digital", "1000 Startup Digital", "https://1000startupdigital.id/", "https://1000startupdigital.id/"),
  row(40, "indonesia", "climate-impact-innovations-challenge", "Climate Impact Innovations Challenge", "https://climateimpact.id/", "https://climateimpact.id/"),
  row(41, "indonesia", "indigo-indonesia", "Indigo", "https://indigo.id/", "https://indigo.id/"),
  // Batch 10 Vietnam
  row(42, "vietnam", "startup-wheel", "Startup Wheel", "https://startupwheel.vn/", "https://startupwheel.vn/"),
  row(43, "vietnam", "techfest-vietnam", "TECHFEST Vietnam", "https://techfest.vn/", "https://techfest.vn/"),
  row(44, "vietnam", "vietnam-nic", "Vietnam National Innovation Center", "https://nic.gov.vn/", "https://nic.gov.vn/"),
  // Batch 11 Philippines
  row(45, "philippines", "startup-philippines", "Startup Philippines", "https://startup.gov.ph/", "https://startup.gov.ph/"),
  row(46, "philippines", "startup-philippines-directory", "Startup Philippines Startup Directory", "https://startup.gov.ph/", "https://startup.gov.ph/startups"),
  // Batch 12 Bangladesh
  row(47, "bangladesh", "startup-bangladesh", "Startup Bangladesh", "https://startupbangladesh.gov.bd/", "https://startupbangladesh.gov.bd/en"),
  row(48, "bangladesh", "startup-bangladesh-portfolio", "Startup Bangladesh Portfolio", "https://startupbangladesh.gov.bd/", "https://startupbangladesh.gov.bd/en"),
  // Batch 13 Pakistan
  row(49, "pakistan", "ignite-pakistan", "Ignite National Technology Fund", "https://ignite.org.pk/", "https://ignite.org.pk/"),
  row(50, "pakistan", "pakistan-national-incubation-centres", "Pakistan National Incubation Centres", "https://ignite.org.pk/", null, null, "Discover individual NICs through Ignite; may become multiple hub sources."),
  // Batch 14 Sri Lanka
  row(51, "sri-lanka", "startup-sri-lanka", "Startup Sri Lanka", "https://www.startupsl.lk/", "https://www.startupsl.lk/"),
  // Batch 15 Kazakhstan and Central Asia
  row(52, "central-asia", "astana-hub", "Astana Hub", "https://astanahub.com/", "https://astanahub.com/"),
  row(53, "central-asia", "astana-hub-startup-programmes", "Astana Hub Startup Programmes", "https://astanahub.com/", "https://astanahub.com/en/programs"),
  row(54, "central-asia", "astana-hub-company-network", "Astana Hub Company Network", "https://astanahub.com/", "https://astanahub.com/en/startup/"),
  // Batch 16 UAE
  row(55, "uae", "hub71", "Hub71", "https://www.hub71.com/", "https://www.hub71.com/"),
  row(56, "uae", "hub71-startup-directory", "Hub71 Startup Directory", "https://www.hub71.com/", "https://www.hub71.com/startups"),
  row(57, "uae", "sheraa", "Sheraa", "https://sheraa.ae/", "https://sheraa.ae/"),
  row(58, "uae", "in5-dubai", "in5 Dubai", "https://infive.ae/", "https://infive.ae/"),
  // Batch 17 Saudi Arabia
  row(59, "saudi-arabia", "kaust-innovation", "KAUST Innovation", "https://innovation.kaust.edu.sa/", "https://innovation.kaust.edu.sa/"),
  row(60, "saudi-arabia", "kaust-innovation-ventures", "KAUST Innovation Ventures", "https://innovation.kaust.edu.sa/", "https://innovation.kaust.edu.sa/ventures"),
  row(61, "saudi-arabia", "kaust-taqadam", "KAUST Entrepreneurship Programmes / TAQADAM", "https://entrepreneurship.kaust.edu.sa/", "https://entrepreneurship.kaust.edu.sa/"),
  row(62, "saudi-arabia", "kaust-scalex-portfolio", "KAUST ScaleX Portfolio", "https://entrepreneurship.kaust.edu.sa/", "https://entrepreneurship.kaust.edu.sa/portfolio/scalex"),
  row(63, "saudi-arabia", "kaust-entrepreneurial-spinouts", "KAUST entrepreneurial spinouts", "https://innovation.kaust.edu.sa/", "https://innovation.kaust.edu.sa/spinouts"),
  // Batch 18 China
  row(64, "china", "china-innovation-entrepreneurship-competition", "China Innovation & Entrepreneurship Competition", "https://www.cxcyds.com/", "https://www.cxcyds.com/"),
  row(65, "china", "startup-in-shanghai", "Startup in Shanghai / Shanghai Innovation Competition", "https://www.shanghai.gov.cn/", null, null, "Use official Shanghai Government and competition pages discovered during audit."),
  row(66, "china", "china-college-students-innovation-competition", "China International College Students Innovation Competition", "https://www.moe.gov.cn/", null, null, "Use official Ministry of Education competition/result pages during audit."),
  row(67, "china", "hicool", "HICOOL Global Entrepreneur Summit & Entrepreneurship Competition", "https://www.hicool.com/", "https://www.hicool.com/"),
  // Batch 19 Pan-Asian / regional
  row(68, "pan-asian", "adb-ventures-portfolio", "ADB Ventures", "https://www.adb.org/", "https://www.adb.org/what-we-do/private-sector/adb-ventures/impact"),
  row(69, "pan-asian", "circulate-capital", "Circulate Capital", "https://www.circulatecapital.com/", "https://www.circulatecapital.com/our-portfolio"),
  row(70, "pan-asian", "accelerating-asia", "Accelerating Asia", "https://www.acceleratingasia.com/", "https://www.acceleratingasia.com/portfolio"),
  row(71, "pan-asian", "iterative", "Iterative", "https://www.iterative.vc/", "https://www.iterative.vc/"),
  row(72, "pan-asian", "iterative-demo-day", "Iterative Demo Day / companies", "https://www.iterative.vc/", "https://www.iterative.vc/companies"),
  row(73, "pan-asian", "appworks-accelerator", "AppWorks Accelerator", "https://appworks.tw/", "https://appworks.tw/companies"),
  row(74, "pan-asian", "wavemaker-impact-portfolio", "Wavemaker Impact", "https://wavemakerimpact.com/", "https://wavemakerimpact.com/portfolio"),
  row(75, "pan-asian", "wavemaker-partners-portfolio", "Wavemaker Partners / Ventures", "https://wavemaker.vc/", "https://wavemaker.vc/portfolio"),
  row(76, "pan-asian", "thinkzone-ventures", "ThinkZone Ventures", "https://thinkzone.vc/", "https://thinkzone.vc/portfolio"),
  row(77, "pan-asian", "insignia-ventures-partners", "Insignia Ventures Partners", "https://www.insignia.vc/", "https://www.insignia.vc/portfolio"),
];

if (acquisition.length !== 77) {
  throw new Error(`Expected 77 acquisition rows, got ${acquisition.length}`);
}

const path = join(process.cwd(), "config/asia-acquisition-queue.json");
const existing = JSON.parse(readFileSync(path, "utf8")) as {
  blocked: Entry[];
  university: Entry[];
  acquisition: Entry[];
};

const out = {
  blocked: existing.blocked,
  university: existing.university,
  acquisition,
};

writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${acquisition.length} acquisition entries to ${path}`);
