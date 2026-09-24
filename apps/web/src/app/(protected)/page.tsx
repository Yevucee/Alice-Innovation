import Link from "next/link";
import {
  browseCategories,
  browseSources,
  libraryStats,
  listRecentResources,
  resourcesFromAfrica,
} from "@alice/database";
import { ResourceCard } from "@/components/resource-card";
import { SearchBar } from "@/components/search-bar";
import { pool } from "@/lib/db";

const quickLinks = ["Water", "Agriculture", "Energy", "Climate", "Food", "Cities", "Health", "Africa", "Low-cost solutions"];

const problemLinks = [
  "water-scarcity",
  "food-loss",
  "energy-access",
  "flooding",
  "affordable-housing",
  "healthcare-access",
];

export default async function DiscoverPage() {
  const db = pool();
  const [stats, recent, africa, categories, sources] = await Promise.all([
    libraryStats(db),
    listRecentResources(db, 8),
    resourcesFromAfrica(db, 6),
    browseCategories(db),
    browseSources(db, {}),
  ]);

  const sectorList = (categories.sectors as Array<{ slug: string; name: string }>).slice(0, 9);
  const problemList = (categories.problems as Array<{ slug: string; name: string }>).filter((p) =>
    problemLinks.includes(p.slug),
  );
  const sourceStrip = sources.slice(0, 8);

  const statsLine = `${stats.canonical_resources?.toLocaleString() ?? "0"} resources · 61 sources · ${stats.organisations?.toLocaleString() ?? "0"} organisations · ${stats.people?.toLocaleString() ?? "0"} people`;

  return (
    <div>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 md:px-6 md:py-20 text-center">
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">Alice Innovation Library</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
            Explore practical ideas, technologies, people and approaches being used to solve difficult problems around the world.
          </p>
          <div className="mx-auto mt-8 max-w-2xl text-left">
            <SearchBar large />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-muted">
            {quickLinks.map((label) => (
              <Link key={label} href={`/search?q=${encodeURIComponent(label)}`} className="hover:text-ink underline-offset-4 hover:underline">
                {label}
              </Link>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted">{statsLine}</p>
        </div>
      </section>

      <Section title="Recently added" href="/search?sort=newest">
        <CardGrid resources={recent} empty="Run ingest to populate the library." />
      </Section>

      <Section title="Explore by problem">
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          {problemList.map((problem) => (
            <Link key={problem.slug} href={`/problems/${problem.slug}`} className="text-muted hover:text-ink">
              {problem.name}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Explore by sector">
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          {sectorList.map((sector) => (
            <Link key={sector.slug} href={`/sectors/${sector.slug}`} className="text-muted hover:text-ink">
              {sector.name}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="From Africa">
        <CardGrid resources={africa} empty="No African resources indexed yet." />
      </Section>

      <Section title="Sources">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {sourceStrip.map((source) => (
            <span key={String((source as { source_id: string }).source_id)}>
              {(source as { name: string }).name}
            </span>
          ))}
        </div>
        <Link href="/sources" className="mt-4 inline-block text-sm text-accent hover:underline">
          View all 61 sources →
        </Link>
      </Section>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-medium">{title}</h2>
        {href ? <Link href={href} className="text-sm text-muted hover:text-ink">View all</Link> : null}
      </div>
      {children}
    </section>
  );
}

function CardGrid({ resources, empty }: { resources: import("@alice/database").CompactResource[]; empty: string }) {
  if (resources.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {resources.map((resource) => (
        <ResourceCard key={resource.resource_id} resource={resource} />
      ))}
    </div>
  );
}
