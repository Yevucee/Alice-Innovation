import { CommandPalette } from "@/components/command-palette";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pool } from "@/lib/db";
import { libraryStats } from "@alice/database";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let statsLine: string | undefined;
  let footerStats: { resources?: number; sources?: number } | undefined;
  try {
    const stats = await libraryStats(pool());
    statsLine = `${stats.canonical_resources?.toLocaleString() ?? "0"} resources`;
    footerStats = { resources: stats.canonical_resources, sources: stats.enabled_sources };
  } catch {
    statsLine = undefined;
  }

  return (
    <>
      <SiteHeader statsLine={statsLine} />
      <main className="min-h-[70vh]">{children}</main>
      <SiteFooter stats={footerStats} />
      <CommandPalette />
    </>
  );
}
