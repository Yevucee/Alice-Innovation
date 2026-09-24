import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerson } from "@alice/database";
import { pool } from "@/lib/db";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getPerson(pool(), id);
  if (!person) notFound();
  const resources = person.resources as Array<{ resource_id: string; canonical_title: string; resource_type: string }>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="text-3xl font-medium">{String(person.name)}</h1>
      <p className="mt-2 text-muted">{[person.role, person.organisation_name, person.country].filter(Boolean).join(" · ")}</p>
      {person.professional_summary ? (
        <p className="mt-6 text-sm leading-relaxed">{String(person.professional_summary)}</p>
      ) : null}
      <section className="mt-10">
        <h2 className="text-sm font-medium">Associated resources</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {resources.map((resource) => (
            <li key={resource.resource_id}>
              <Link href={`/resources/${resource.resource_id}`} className="hover:text-accent">
                {resource.canonical_title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
