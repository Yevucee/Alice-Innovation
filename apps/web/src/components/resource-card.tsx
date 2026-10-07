import Link from "next/link";
import type { CompactResource } from "@alice/database";
import { formatDisplayTitle, formatEvidence, formatResourceType, metaLine } from "@/lib/format";
import { isLegalFormText, sanitizeDisplayTitle } from "@alice/shared/text";
import { translateOnDemandEnabled } from "@/lib/translate-openrouter";
import { ResourceCardSummaryTranslate } from "./resource-card-summary-translate";

const TYPE_ICONS: Record<string, string> = {
  SOLUTION: "◆",
  TECHNOLOGY: "⚙",
  ORGANISATION: "⬡",
  PROJECT: "▣",
  PROGRAMME: "◎",
  CASE_STUDY: "▤",
  RESEARCH: "⌁",
  PERSON: "◉",
  POLICY: "⬢",
};

function typeIcon(resourceType: string): string {
  return TYPE_ICONS[resourceType] ?? "◈";
}

export function ResourceCard({ resource }: { resource: CompactResource }) {
  const translateEnabled = translateOnDemandEnabled();
  const location = resource.countries[0] || resource.continents?.[0];
  const tags = [
    ...resource.sectors.slice(0, 2),
    ...resource.technologies.slice(0, 2),
  ];
  const evidence = formatEvidence(resource.evidence);
  const meta = metaLine([location, ...resource.sectors.slice(0, 1), ...resource.technologies.slice(0, 1)]);
  const title = sanitizeDisplayTitle(formatDisplayTitle(resource.title));
  const orgLabel = resource.primary_organisation && !isLegalFormText(resource.primary_organisation)
    ? resource.primary_organisation
    : resource.source_names[0] ?? null;

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
          <div
            className="flex h-full flex-col items-center justify-center text-accent/50"
            aria-hidden
          >
            <span className="text-3xl leading-none">{typeIcon(resource.resource_type)}</span>
            <span className="mt-1 text-[10px] uppercase tracking-wide text-muted/80">
              {formatResourceType(resource.resource_type)}
            </span>
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
          {title}
        </h3>
        <ResourceCardSummaryTranslate
          resourceId={resource.resource_id}
          title={title}
          summary={resource.short_summary || "\u00a0"}
          translateEnabled={translateEnabled}
        />
        <p className="line-clamp-1 min-h-[1.125rem] shrink-0 text-xs text-muted">
          {meta || "\u00a0"}
        </p>
        <div className="mt-auto flex shrink-0 items-end justify-between gap-2 border-t border-line/60 pt-3 text-xs text-muted">
          <span className="line-clamp-1 min-w-0 flex-1">
            {orgLabel || "\u00a0"}
          </span>
          <span className="shrink-0 text-right">{evidence || "\u00a0"}</span>
        </div>
        <p className="line-clamp-1 min-h-[1rem] shrink-0 text-[11px] text-muted/80">
          {tags.length > 0 ? tags.join(" · ") : "\u00a0"}
        </p>
      </div>
    </Link>
  );
}
