import Link from "next/link";
import { notFound } from "next/navigation";
import { findSimilar, getResource } from "@alice/database";
import { ResourceCard } from "@/components/resource-card";
import { formatDate, formatEvidence, formatResourceType, metaLine } from "@/lib/format";
import { pool } from "@/lib/db";

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resource = await getResource(pool(), id);
  if (!resource) notFound();

  const similar = await findSimilar(pool(), id, 6);
  const interpretation = resource.interpretation as Record<string, string> | null;
  const sources = resource.sources as Array<{ name: string; canonical_url: string; last_seen_at: string }>;
  const organisations = resource.organisations as Array<{ name: string; website?: string }>;
  const people = resource.people as Array<{ name: string; role?: string }>;
  const sectors = (resource.sectors as Array<{ name: string }>).map((s) => s.name);
  const technologies = (resource.technologies as Array<{ name: string }>).map((t) => t.name);
  const locations = (resource.locations as Array<{ country_name: string }>).map((l) => l.country_name);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
        {formatResourceType(String(resource.resource_type))}
      </p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">{String(resource.title)}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{String(resource.source_summary)}</p>
      <p className="mt-3 text-sm text-muted">
        {metaLine([...locations.slice(0, 2), ...sectors.slice(0, 2), ...technologies.slice(0, 2), formatEvidence(String(resource.evidence_stage))])}
      </p>

      {resource.image_url ? (
        <div className="mt-8 overflow-hidden rounded-md border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={String(resource.image_url)} alt="" className="w-full object-cover" />
        </div>
      ) : null}

      <div className="mt-10 space-y-8 text-sm leading-relaxed">
        {interpretation?.problem_statement ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">The problem</h2>
            <p className="mt-2">{interpretation.problem_statement}</p>
          </section>
        ) : null}
        {interpretation?.how_it_works ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">How it works</h2>
            <p className="mt-2">{interpretation.how_it_works}</p>
          </section>
        ) : null}
        {interpretation?.why_it_is_interesting ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Why it is interesting</h2>
            <p className="mt-2">{interpretation.why_it_is_interesting}</p>
          </section>
        ) : null}
        {interpretation?.intended_users ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Who it is for</h2>
            <p className="mt-2">{interpretation.intended_users}</p>
          </section>
        ) : null}
        {interpretation?.implementation_requirements ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Implementation</h2>
            <p className="mt-2">{interpretation.implementation_requirements}</p>
          </section>
        ) : null}
        {resource.excerpt ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Source information</h2>
            <p className="mt-2 whitespace-pre-wrap">{String(resource.excerpt)}</p>
          </section>
        ) : null}
      </div>

      {(organisations.length > 0 || people.length > 0) ? (
        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-sm font-medium">People & organisations</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {organisations.map((org) => (
              <li key={org.name}>{org.name}</li>
            ))}
            {people.map((person) => (
              <li key={person.name}>{person.name}{person.role ? ` — ${person.role}` : ""}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {similar.length > 0 ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-sm font-medium">Related ideas</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {similar.map((item) => (
              <ResourceCard key={item.resource_id} resource={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="text-sm font-medium">Sources & provenance</h2>
        <ul className="mt-4 space-y-4 text-sm">
          {sources.map((source) => (
            <li key={source.canonical_url}>
              <p className="font-medium">{source.name}</p>
              <p className="text-muted">Viewed {formatDate(source.last_seen_at)}</p>
              <a href={source.canonical_url} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                Open original ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      {interpretation ? (
        <section className="mt-10 rounded-md bg-accent-soft/50 p-4 text-sm">
          <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">Alice classification</p>
          <p className="mt-2 text-muted">Machine-derived interpretation — verify against source pages.</p>
        </section>
      ) : null}

      <p className="mt-8">
        <Link href="/search" className="text-sm text-muted hover:text-ink">← Back to search</Link>
      </p>
    </article>
  );
}
