import Link from "next/link";
import { notFound } from "next/navigation";
import { resourcesForSource, sourceStatus } from "@alice/database";
import { ResourceCard } from "@/components/resource-card";
import { formatDate } from "@/lib/format";
import { pool } from "@/lib/db";

export default async function SourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const status = await sourceStatus(pool(), slug);
  if (!status) notFound();
  const { results, filtered_total } = await resourcesForSource(pool(), slug, 12, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <h1 className="text-3xl font-medium">{slug.replace(/-/g, " ")}</h1>
      <p className="mt-2 text-sm text-muted">
        {Number(status.item_count ?? 0).toLocaleString()} indexed resources · Last update {formatDate(status.last_success as string)}
      </p>
      <Link href={`/search?source=${slug}`} className="mt-4 inline-block text-sm text-accent hover:underline">
        Search within this source
      </Link>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((resource) => (
          <ResourceCard key={resource.resource_id} resource={resource} />
        ))}
      </div>
      {filtered_total > results.length ? (
        <p className="mt-6 text-sm text-muted">{filtered_total - results.length} more resources in this source.</p>
      ) : null}
    </div>
  );
}
