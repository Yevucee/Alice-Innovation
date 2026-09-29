import Link from "next/link";
import { listCollections } from "@alice/database";
import { pool } from "@/lib/db";

export default async function CollectionsPage() {
  const collections = await listCollections(pool(), 100);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Collections</h1>
          <p className="mt-2 text-sm text-muted">
            Curated lists with Alice notes — for picks, reading lists, and themed bundles.
          </p>
        </div>
        <Link
          href="/collections/new"
          className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink/30"
        >
          New collection
        </Link>
      </div>
      <ul className="mt-8 space-y-3">
        {collections.map((collection) => (
          <li key={collection.id}>
            <Link
              href={`/collections/${collection.slug}`}
              className="block rounded-md border border-line bg-white p-4 shadow-card hover:border-ink/15"
            >
              <p className="font-medium">{collection.title}</p>
              {collection.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted">{collection.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted">
                {collection.item_count ?? 0} resources
                {collection.is_public ? " · Public" : " · Team"}
              </p>
            </Link>
          </li>
        ))}
        {collections.length === 0 ? (
          <li className="text-sm text-muted">No collections yet. Create one to start curating.</li>
        ) : null}
      </ul>
    </div>
  );
}
