import Link from "next/link";
import { notFound } from "next/navigation";
import { browseSources, resourcesForSource, sourceStatus } from "@alice/database";
import { ResourceCard } from "@/components/resource-card";
import { formatDate } from "@/lib/format";
import { pool } from "@/lib/db";

export default async function SourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const status = await sourceStatus(pool(), slug);
  if (!status) notFound();
  const { results, filtered_total } = await resourcesForSource(pool(), slug, 12, 0);
  const catalogue = await browseSources(pool(), {});
  const catalogueRow = (catalogue as Array<Record<string, unknown>>).find((s) => s.source_id === slug);
  const displayName = String(catalogueRow?.name ?? slug);
  const homepage = catalogueRow?.official_homepage ? String(catalogueRow.official_homepage) : null;

  const notIngested = ["BLOCKED", "PAUSED", "MANUAL", "BROKEN", "METADATA_ONLY"].includes(
    String(status.status),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <p className="text-sm text-muted">
        <Link href="/sources" className="text-accent hover:underline">Sources</Link>
        {notIngested ? (
          <>
            {" / "}
            <Link href="/sources/other-resources" className="text-accent hover:underline">
              Other resources
            </Link>
          </>
        ) : null}
      </p>
      <h1 className="mt-4 text-3xl font-medium">{displayName}</h1>
      <p className="mt-1 text-sm text-muted">{slug}</p>
      {notIngested ? (
        <p className="mt-3 max-w-2xl rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted">
          This catalogue entry is not indexed automatically. See{" "}
          <Link href="/sources/other-resources" className="text-accent hover:underline">
            other resources
          </Link>{" "}
          for sites to visit directly while adapters or access are pending.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">
        Status: {String(status.status)} ·{" "}
        {Number(status.item_count ?? 0).toLocaleString()} indexed resources · Last update{" "}
        {formatDate(status.last_success as string)}
      </p>
      {homepage ? (
        <a
          href={homepage}
          className="mt-2 inline-block text-sm text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit official site
        </a>
      ) : null}
      {!notIngested ? (
        <Link href={`/search?source=${slug}`} className="mt-4 inline-block text-sm text-accent hover:underline">
          Search within this source
        </Link>
      ) : null}
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
