import Link from "next/link";
import { notFound } from "next/navigation";
import {
  diverseApproachesForResource,
  embeddingCatalogueCoverage,
  findSimilar,
  getResource,
} from "@alice/database";
import { AddToCollection } from "@/components/add-to-collection";
import { ResourceCard } from "@/components/resource-card";
import { InlineEnglishResourceDetail } from "@/components/inline-english-translation";
import { inlineTranslationConfigured } from "@/lib/translate-provider";
import { formatDate, formatDisplayTitle, formatEvidence, formatEvidenceBasis, formatResourceType, metaLine, sourceExcerptDuplicatesSummary } from "@/lib/format";
import { isLegalFormText, sanitizeDisplayTitle } from "@alice/shared";
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
  const embeddingCoverage = await embeddingCatalogueCoverage(pool());
  const similarityIndexBuilding = embeddingCoverage.pct < 50;
  const queryText = `${resource.title} ${resource.source_summary}`.trim().slice(0, 400);
  const diverse = queryText
    ? await diverseApproachesForResource(pool(), id, queryText, 6)
    : [];

  const interpretation = resource.interpretation as Record<string, unknown> | null;
  const sources = resource.sources as Array<{ name: string; canonical_url: string; last_seen_at: string }>;
  const organisations = (resource.organisations as Array<{ id: string; name: string; website?: string }>)
    .filter((org) => !isLegalFormText(org.name));
  const people = resource.people as Array<{ id: string; name: string; role?: string }>;
  const sectors = resource.sectors as Array<{ slug: string; name: string }>;
  const problems = resource.problems as Array<{ slug: string; name: string }>;
  const technologies = resource.technologies as Array<{ slug: string; name: string }>;
  const locationRows = resource.locations as Array<{ country_name: string; continent?: string | null }>;
  const continents = [...new Set(locationRows.map((l) => l.continent).filter(Boolean))] as string[];
  const countries = [...new Set(locationRows.map((l) => l.country_name).filter(Boolean))];
  if (countries.length === 0 && resource.country) {
    countries.push(String(resource.country));
  }
  const locationLine = [...continents, ...countries.filter((c) => !continents.includes(c))];
  const tags = classificationTags(interpretation);
  const isPick = resource.review_status === "ALICE_PICK";
  const showSourceInformation = resource.excerpt
    && !sourceExcerptDuplicatesSummary(String(resource.source_summary), String(resource.excerpt));
  const evidenceLabel = formatEvidence(String(resource.evidence_stage));
  const evidenceBasisLabel = formatEvidenceBasis(String(resource.evidence_basis));
  const displayTitle = sanitizeDisplayTitle(formatDisplayTitle(String(resource.title)));
  const displaySummary = String(resource.source_summary);
  const primarySourceUrl = sources[0]?.canonical_url ?? null;
  const translationOriginal = {
    title: displayTitle,
    summary: displaySummary,
    excerpt: showSourceInformation ? String(resource.excerpt) : undefined,
    problem_statement: interpretation?.problem_statement ? String(interpretation.problem_statement) : undefined,
    how_it_works: interpretation?.how_it_works ? String(interpretation.how_it_works) : undefined,
    why_it_is_interesting: interpretation?.why_it_is_interesting
      ? String(interpretation.why_it_is_interesting)
      : undefined,
    intended_users: interpretation?.intended_users ? String(interpretation.intended_users) : undefined,
    implementation_requirements: interpretation?.implementation_requirements
      ? String(interpretation.implementation_requirements)
      : undefined,
  };

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
      <InlineEnglishResourceDetail
        resourceId={id}
        language={resource.language ? String(resource.language) : null}
        original={translationOriginal}
        translateEnabled={inlineTranslationConfigured()}
        sourcePageUrl={primarySourceUrl}
        metaAfterSummary={
          <>
            <p className="mt-3 text-sm text-muted">
              {metaLine([
                ...locationLine.slice(0, 3),
                ...sectors.slice(0, 2).map((s) => s.name),
                ...technologies.slice(0, 2).map((t) => t.name),
                evidenceLabel,
              ])}
            </p>
            {evidenceBasisLabel ? (
              <p className="mt-2 text-xs text-muted" title="How we know this maturity level">
                Evidence: {evidenceBasisLabel}
              </p>
            ) : null}
          </>
        }
      />

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

      {locationLine.length > 0 ? (
        <section className="mt-8 text-sm">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Location</h2>
          <ul className="mt-2 space-y-1 text-muted">
            {locationRows.map((loc, index) => (
              <li key={`${loc.country_name}-${index}`}>
                {[loc.continent, loc.country_name].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AddToCollection resourceId={id} />

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
          <p className="mt-1 text-xs text-muted">Hybrid search with mechanism-level diversity (technology/sector buckets).</p>
          <div className="mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2">
            {diverse.map((item) => (
              <ResourceCard key={item.resource_id} resource={item} />
            ))}
          </div>
        </section>
      ) : null}

      {similar.length > 0 ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-sm font-medium">Related ideas</h2>
          <p className="mt-1 text-xs text-muted">Similar indexed content by meaning.</p>
          <div className="mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2">
            {similar.map((item) => (
              <ResourceCard key={item.resource_id} resource={item} />
            ))}
          </div>
        </section>
      ) : similarityIndexBuilding ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-sm font-medium">Related ideas</h2>
          <p className="mt-1 text-xs text-muted">
            Building similarity index… ({embeddingCoverage.with_embedding.toLocaleString()} of{" "}
            {embeddingCoverage.active.toLocaleString()} resources embedded so far).
          </p>
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
