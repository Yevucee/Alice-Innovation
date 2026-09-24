import { browseCategories, resourcesForTaxonomy } from "@alice/database";
import { ResourceCard } from "@/components/resource-card";
import { pool } from "@/lib/db";

export default async function SectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await browseCategories(pool());
  const sector = (categories.sectors as Array<{ slug: string; name: string }>).find((s) => s.slug === slug);
  const { results, filtered_total } = await resourcesForTaxonomy(pool(), "sector", slug, 24, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-medium">{sector?.name ?? slug.replace(/-/g, " ")}</h1>
      <p className="mt-2 text-sm text-muted">{filtered_total.toLocaleString()} resources</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((resource) => (
          <ResourceCard key={resource.resource_id} resource={resource} />
        ))}
      </div>
    </div>
  );
}
