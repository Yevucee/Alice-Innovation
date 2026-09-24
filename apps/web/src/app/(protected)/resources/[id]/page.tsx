import Link from "next/link";
import { notFound } from "next/navigation";
import { diverseApproachesForResource, findSimilar, getResource } from "@alice/database";
import { ResourceCard } from "@/components/resource-card";
import { formatDate, formatEvidence, formatEvidenceBasis, formatResourceType, metaLine } from "@/lib/format";
import { pool } from "@/lib/db";

function classificationTags(interpretation: Record<string, unknown> | null): string[] {
  if (!interpretation) return [];
  const payload = interpretation.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const tags = (payload as { tags?: string[]; sectors?: string[] }).tags
      ?? (payload as { sectors?: string[] }).sectors;
    if (Array.isArray(tags)) return tags.map(String);
  }
  return [];
}

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resource = await getResource(pool(), id);
  if (!resource) notFound();

  const similar = await findSimilar(pool(), id, 4);
  const queryText = `${resource.title} ${resource.source_summary}`.trim().slice(0, 400);
  const diverse = queryText
    ? await diverseApproachesForResource(pool(), id, queryText, 6)
    : [];

  const interpretation = resource.interpretation as Record<string, unknown> | null;
  const sources = resource.sources as Array<{ name: string; canonical_url: string; last_seen_at: string }>;
  const organisations = resource.organisations as Array<{ id: string; name: string; website?: string }>;
  const people = resource.people as Array<{ id: string; name: string; role?: string }>;
  const sectors = resource.sectors as Array<{ slug: string; name: string }>;
  const problems = resource.problems as Array<{ slug: string; name: string }>;
  const technologies = resource.technologies as Array<{ slug: string; name: string }>;
  const locations = (resource.locations as Array<{ country_name: string }>).map((l) => l.country_name);
  const tags = classificationTags(interpretation);
  const isPick = resource.review_status === "ALICE_PICK";

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
          {formatResourceType(String(resource.resource_type))}
        </p>
        {isPick ? (
          <span className="rounded bg-ink px-2 py-0.5 text-[10px] font-medium tracking-wide text-white">
            ALICE PICK
          </span>
        ) : null}
      </div>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">{String(resource.title)}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{String(resource.source_summary)}</p>
      <p className="mt-3 text-sm text-muted">
        {metaLine([
          ...locations.slice(0, 2),
          ...sectors.slice(0, 2).map((s) => s.name),
          ...technologies.slice(0, 2).map((t) => t.name),
          formatEvidence(String(resource.evidence_stage)),
        ])}
      </p>
      <p className="mt-2 text-xs text-muted" title="How we know this maturity level">
        Evidence: {formatEvidenceBasis(String(resource.evidence_basis))}
      </p>

      {problems.length > 0 ? (
        <p className="mt-3 flex flex-wrap gap-2 text-xs">
          {problems.map((problem) => (
            <Link
              key={problem.slug}
              href={`/problems/${problem.slug}`}
              className="rounded-full border border-line px-2.5 py-0.5 text-muted hover:border-ink/30 hover:text-ink"
            >
              {problem.name}
            </Link>
          ))}
        </p>
      ) : null}

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
            <p className="mt-2">{String(interpretation.problem_statement)}</p>
          </section>
        ) : null}
        {interpretation?.how_it_works ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">How it works</h2>
            <p className="mt-2">{String(interpretation.how_it_works)}</p>
          </section>
        ) : null}
        {interpretation?.why_it_is_interesting ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Why it is interesting</h2>
            <p className="mt-2">{String(interpretation.why_it_is_interesting)}</p>
          </section>
        ) : null}
        {interpretation?.intended_users ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Who it is for</h2>
            <p className="mt-2">{String(interpretation.intended_users)}</p>
          </section>
        ) : null}
        {interpretation?.implementation_requirements ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Implementation</h2>
            <p className="mt-2">{String(interpretation.implementation_requirements)}</p>
          </section>
        ) : null}
        {resource.excerpt ? (
          <section>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Source information</h2>
            <p className="mt-2 whitespace-pre-wrap text-muted">{String(resource.excerpt)}</p>
          </section>
        ) : null}
      </div>

      {(organisations.length > 0 || people.length > 0) ? (
        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-sm font-medium">People & organisations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {organisations.map((org) => (
              <li key={org.id}>
                <Link href={`/organisations/${org.id}`} className="text-accent hover:underline">{org.name}</Link>
              </li>
            ))}
            {people.map((person) => (
              <li key={person.id}>
                <Link href={`/people/${person.id}`} className="text-accent hover:underline">
                  {person.name}
                </Link>
                {person.role ? <span className="text-muted"> — {person.role}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {diverse.length > 0 ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-sm font-medium">Different approaches to the same problem</h2>
          <p className="mt-1 text-xs text-muted">Hybrid search with a per-source cap — not mechanism-classified yet.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {diverse.map((item) => (
              <ResourceCard key={item.resource_id} resource={item} />
            ))}
          </div>
        </section>
      ) : null}

      {similar.length > 0 ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-sm font-medium">Related ideas</h2>
          <p className="mt-1 text-xs text-muted">Similar indexed content (requires embeddings).</p>
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

      {(interpretation || tags.length > 0) ? (
        <section className="mt-10 rounded-md border border-line bg-accent-soft/40 p-4 text-sm">
          <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">Alice classification</p>
          {tags.length > 0 ? (
            <p className="mt-2 text-muted">{tags.join(" · ")}</p>
          ) : (
            <p className="mt-2 text-muted">Machine-derived interpretation — verify against source pages.</p>
          )}
        </section>
      ) : null}

      <p className="mt-8">
        <Link href="/search" className="text-sm text-muted hover:text-ink">← Back to search</Link>
      </p>
    </article>
  );
}
