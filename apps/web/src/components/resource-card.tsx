import Link from "next/link";
import type { CompactResource } from "@alice/database";
import { formatEvidence, formatResourceType, metaLine } from "@/lib/format";

function placeholderLabel(resource: CompactResource): string {
  const seed = resource.sectors[0] || resource.resource_type || "Resource";
  return seed.slice(0, 1).toUpperCase();
}

export function ResourceCard({ resource }: { resource: CompactResource }) {
  const location = resource.countries[0];
  const tags = [
    ...resource.sectors.slice(0, 2),
    ...resource.technologies.slice(0, 2),
  ];
  const evidence = formatEvidence(resource.evidence);

  return (
    <Link
      href={`/resources/${resource.resource_id}`}
      className="group flex flex-col overflow-hidden rounded-md border border-line bg-white shadow-card transition hover:border-ink/15"
    >
      <div className="relative aspect-[16/10] bg-accent-soft">
        {resource.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resource.image_url}
            alt=""
            className="h-full w-full object-cover"
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
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
          {formatResourceType(resource.resource_type)}
        </p>
        <h3 className="text-base font-medium leading-snug group-hover:text-accent">{resource.title}</h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted">{resource.short_summary}</p>
        <p className="mt-auto text-xs text-muted">
          {metaLine([location, ...resource.sectors.slice(0, 1), ...resource.technologies.slice(0, 1)])}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted">
          <span>{resource.primary_organisation || resource.source_names[0]}</span>
          <span>{evidence}</span>
        </div>
        {tags.length > 0 ? (
          <p className="text-[11px] text-muted/80">{tags.join(" · ")}</p>
        ) : null}
      </div>
    </Link>
  );
}
