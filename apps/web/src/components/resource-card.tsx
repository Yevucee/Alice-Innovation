import Link from "next/link";
import type { CompactResource } from "@alice/database";
import { formatEvidence, formatResourceType, metaLine } from "@/lib/format";

function placeholderLabel(resource: CompactResource): string {
  const seed = resource.sectors[0] || resource.resource_type || "Resource";
  return seed.slice(0, 1).toUpperCase();
}

export function ResourceCard({ resource }: { resource: CompactResource }) {
  const location = resource.countries[0] || resource.continents?.[0];
  const tags = [
    ...resource.sectors.slice(0, 2),
    ...resource.technologies.slice(0, 2),
  ];
  const evidence = formatEvidence(resource.evidence);
  const meta = metaLine([location, ...resource.sectors.slice(0, 1), ...resource.technologies.slice(0, 1)]);

  return (
    <Link
      href={`/resources/${resource.resource_id}`}
      className="group flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-line bg-white shadow-card transition hover:border-ink/15"
    >
      <div className="relative aspect-[16/10] shrink-0 bg-accent-soft">
        {resource.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resource.image_url}
            alt=""
            className="h-full w-full object-cover object-center"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-light text-accent/40">
            {placeholderLabel(resource)}
          </div>
        )}
        {resource.review_status === "ALICE_PICK" ? (
          <span className="absolute left-2 top-2 rounded bg-ink px-2 py-0.5 text-[10px] font-medium tracking-wide text-white">
            ALICE PICK
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <p className="shrink-0 text-[11px] font-medium leading-none tracking-wide text-muted uppercase">
          {formatResourceType(resource.resource_type)}
        </p>
        <h3 className="line-clamp-2 min-h-[2.75rem] shrink-0 text-base font-medium leading-snug group-hover:text-accent">
          {resource.title}
        </h3>
        <p className="line-clamp-3 min-h-[4.125rem] shrink-0 text-sm leading-relaxed text-muted">
          {resource.short_summary || "\u00a0"}
        </p>
        <p className="line-clamp-1 min-h-[1.125rem] shrink-0 text-xs text-muted">
          {meta || "\u00a0"}
        </p>
        <div className="mt-auto flex shrink-0 items-end justify-between gap-2 border-t border-line/60 pt-3 text-xs text-muted">
          <span className="line-clamp-1 min-w-0 flex-1">
            {resource.primary_organisation || resource.source_names[0] || "\u00a0"}
          </span>
          <span className="shrink-0 text-right">{evidence}</span>
        </div>
        <p className="line-clamp-1 min-h-[1rem] shrink-0 text-[11px] text-muted/80">
          {tags.length > 0 ? tags.join(" · ") : "\u00a0"}
        </p>
      </div>
    </Link>
  );
}
