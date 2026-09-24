import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganisation } from "@alice/database";
import { pool } from "@/lib/db";

export default async function OrganisationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrganisation(pool(), id);
  if (!org) notFound();
  const resources = org.resources as Array<{ resource_id: string; canonical_title: string }>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="text-3xl font-medium">{String(org.name)}</h1>
      <p className="mt-2 text-muted">{[org.organisation_type, org.country].filter(Boolean).join(" · ")}</p>
      {org.description ? <p className="mt-6 text-sm leading-relaxed">{String(org.description)}</p> : null}
      {org.website ? (
        <a href={String(org.website)} className="mt-4 inline-block text-sm text-accent hover:underline" target="_blank" rel="noreferrer">
          Website ↗
        </a>
      ) : null}
      <section className="mt-10">
        <h2 className="text-sm font-medium">Solutions & projects ({resources.length})</h2>
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
