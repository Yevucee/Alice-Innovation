import { searchLibrary } from "@alice/database";
import { ResourceCard } from "@/components/resource-card";
import { pool } from "@/lib/db";

export default async function SolutionsPage() {
  const { results } = await searchLibrary(
    pool(),
    { query: "", resourceTypes: ["SOLUTION"], limit: 24, offset: 0, sort: "newest" },
    null,
  );
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-medium">Solutions</h1>
      <p className="mt-2 text-sm text-muted">Browse solution-type resources without searching.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((resource) => (
          <ResourceCard key={resource.resource_id} resource={resource} />
        ))}
      </div>
    </div>
  );
}
