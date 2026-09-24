import { formatDate } from "@/lib/format";

export function SiteFooter({ stats }: { stats?: { sources?: number; resources?: number } }) {
  const line = stats
    ? `${stats.resources?.toLocaleString() ?? "—"} resources · ${stats.sources ?? 61} sources`
    : "Alice Innovation Library";
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted md:px-6">
        <p className="font-medium text-ink">Alice Innovation Library</p>
        <p className="mt-1">{line} · Last library update {formatDate(new Date())}</p>
        <p className="mt-3 text-xs">Internal Alice resource</p>
      </div>
    </footer>
  );
}
