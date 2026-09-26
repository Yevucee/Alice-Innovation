import Link from "next/link";
import { browseSources } from "@alice/database";
import { pool } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  BLOCKED: "Blocked",
  PAUSED: "Not ingested yet",
  MANUAL: "Manual only",
  BROKEN: "Broken",
  METADATA_ONLY: "Metadata only",
  PARTIAL: "Partial",
  ACTIVE: "Active",
};

function statusExplanation(status: string): string {
  switch (status) {
    case "BLOCKED":
      return "The public site blocks automated access (for example a bot wall). We do not bypass it.";
    case "PAUSED":
      return "Listed in the catalogue; an adapter is not built or not enabled yet.";
    case "MANUAL":
      return "Updates are manual or need a partner export, not a scheduled crawl.";
    case "BROKEN":
      return "The collection URL or site structure failed verification.";
    case "METADATA_ONLY":
      return "Only high-level metadata is appropriate; full records are not published.";
    default:
      return "Not indexed into search automatically.";
  }
}

export default async function OtherResourcesPage() {
  const ingestable = (await browseSources(pool(), { ingestableOnly: true })) as unknown[];
  const sources = (await browseSources(pool(), { referenceOnly: true })) as Array<
    Record<string, unknown>
  >;
  const catalogueTotal = ingestable.length + sources.length;
  const blocked = sources.filter((s) => s.status === "BLOCKED");
  const paused = sources.filter((s) => s.status === "PAUSED");
  const other = sources.filter((s) => !["BLOCKED", "PAUSED"].includes(String(s.status)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <p className="text-sm text-muted">
        <Link href="/sources" className="text-accent hover:underline">Sources</Link>
        {" / "}Other resources
      </p>
      <h1 className="mt-4 text-2xl font-medium">Other resources</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Alice maintains a {catalogueTotal}-source catalogue. These {sources.length} ecosystems are{" "}
        <strong className="font-medium text-ink">not</strong> in library search yet. They are worth
        visiting directly for research and partnerships. We only add automatic ingestion when public
        access, robots.txt, and an adapter allow it — never by bypassing login, paywalls, or bot checks.
      </p>

      {blocked.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Blocked automatic access</h2>
          <p className="mt-1 text-sm text-muted">
            These sites are in scope but currently return bot walls or similar blocks to our ingestor.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {blocked.map((source) => (
              <ReferenceCard key={String(source.source_id)} source={source} />
            ))}
          </ul>
        </section>
      ) : null}

      {paused.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-medium">On the roadmap</h2>
          <p className="mt-1 text-sm text-muted">
            Verified homepages; adapters not implemented or not enabled yet.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paused.map((source) => (
              <ReferenceCard key={String(source.source_id)} source={source} />
            ))}
          </ul>
        </section>
      ) : null}

      {other.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-medium">Other catalogue entries</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {other.map((source) => (
              <ReferenceCard key={String(source.source_id)} source={source} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReferenceCard({ source }: { source: Record<string, unknown> }) {
  const status = String(source.status);
  const homepage = String(source.official_homepage ?? "");
  const notes = String(source.coverage_notes || source.description || "").trim();
  const discovery = String(source.discovery_notes ?? "").trim();

  return (
    <li className="list-none rounded-md border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">
          {homepage ? (
            <a href={homepage} className="hover:text-accent" target="_blank" rel="noopener noreferrer">
              {String(source.name)}
            </a>
          ) : (
            String(source.name)
          )}
        </h3>
        <span className="text-xs text-muted">{STATUS_LABEL[status] ?? status}</span>
      </div>
      <p className="mt-2 text-xs text-muted">{statusExplanation(status)}</p>
      {notes ? <p className="mt-2 text-sm text-muted line-clamp-3">{notes}</p> : null}
      {!notes && discovery ? (
        <p className="mt-2 text-sm text-muted line-clamp-3">{discovery}</p>
      ) : null}
      <Link
        href={`/sources/${source.source_id}`}
        className="mt-3 inline-block text-xs text-accent hover:underline"
      >
        Catalogue entry
      </Link>
    </li>
  );
}
