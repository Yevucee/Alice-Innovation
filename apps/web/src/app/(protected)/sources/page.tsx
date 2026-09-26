import Link from "next/link";
import { browseSources } from "@alice/database";
import { formatDate } from "@/lib/format";
import { pool } from "@/lib/db";

export default async function SourcesPage() {
  const sources = await browseSources(pool(), { ingestableOnly: true });
  const referenceCount = (
    (await browseSources(pool(), { referenceOnly: true })) as unknown[]
  ).length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-medium">Indexed sources</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Alice continuously indexes these innovation, research and solutions ecosystems into search.
        The full 61-source catalogue also lists{" "}
        <Link href="/sources/other-resources" className="text-accent hover:underline">
          {referenceCount} other resources
        </Link>{" "}
        you can browse on the web but we cannot gather automatically yet (blocked sites, no adapter, or
        manual-only data).
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(sources as Array<Record<string, unknown>>).map((source) => (
          <li key={String(source.source_id)} className="rounded-md border border-line p-4">
            <Link href={`/sources/${source.source_id}`} className="font-medium hover:text-accent">
              {String(source.name)}
            </Link>
            <p className="mt-1 text-xs text-muted">{String(source.category)}</p>
            <p className="mt-3 text-sm text-muted">{Number(source.item_count ?? 0).toLocaleString()} indexed resources</p>
            <p className="text-xs text-muted">Last updated: {formatDate(source.last_successful_run as string)}</p>
            <p className="text-xs text-muted">Coverage: {String(source.status)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
