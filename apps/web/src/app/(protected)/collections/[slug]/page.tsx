import Link from "next/link";
import { notFound } from "next/navigation";
import { collectionWithResources } from "@alice/database";
import { CollectionNoteForm } from "@/components/collection-note-form";
import { ResourceCard } from "@/components/resource-card";
import { formatDate } from "@/lib/format";
import { pool } from "@/lib/db";

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await collectionWithResources(pool(), slug);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <Link href="/collections" className="text-sm text-muted hover:text-ink">← Collections</Link>
      <h1 className="mt-4 text-2xl font-medium tracking-tight">{data.collection.title}</h1>
      {data.collection.description ? (
        <p className="mt-2 max-w-2xl text-muted">{data.collection.description}</p>
      ) : null}

      <section className="mt-10 rounded-md border border-line bg-accent-soft/30 p-4">
        <h2 className="text-sm font-medium">Alice notes</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {data.notes.map((note) => (
            <li key={note.id} className="border-b border-line/60 pb-3 last:border-0">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-muted">
                {note.author_label} · {formatDate(note.created_at.toISOString())}
              </p>
            </li>
          ))}
          {data.notes.length === 0 ? (
            <li className="text-muted">No notes yet.</li>
          ) : null}
        </ul>
        <CollectionNoteForm slug={slug} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Resources ({data.resources.length})</h2>
        <div className="mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.resources.map((resource) => (
            <div key={resource.resource_id} className="flex flex-col gap-2">
              <ResourceCard resource={resource} />
              {resource.curator_note ? (
                <p className="px-1 text-xs text-muted italic">{resource.curator_note}</p>
              ) : null}
            </div>
          ))}
        </div>
        {data.resources.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Open any resource and use &quot;Add to collection&quot;, or POST to{" "}
            <code className="text-ink">/api/collections/{slug}/items</code>.
          </p>
        ) : null}
      </section>
    </div>
  );
}
