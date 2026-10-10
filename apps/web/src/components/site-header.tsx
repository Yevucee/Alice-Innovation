"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Discover" },
  { href: "/search", label: "Search" },
  { href: "/solutions", label: "Solutions" },
  { href: "/people", label: "People" },
  { href: "/organisations", label: "Organisations" },
  { href: "/sources", label: "Sources" },
  { href: "/collections", label: "Collections" },
];

export function SiteHeader({ statsLine }: { statsLine?: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-canvas/95 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 md:px-6">
        <Link href="/" className="flex shrink-0 flex-col leading-tight">
          <span className="text-[11px] font-semibold tracking-[0.2em] text-muted">ALICE</span>
          <span className="text-sm font-medium">Innovation Library</span>
        </Link>
        <nav className="hidden flex-1 items-center gap-4 text-sm text-muted lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
                ? "text-ink"
                : "hover:text-ink"}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {statsLine ? <span className="hidden text-muted md:inline">{statsLine}</span> : null}
          <button
            type="button"
            className="rounded border border-line px-2.5 py-1 text-muted hover:border-ink/20 hover:text-ink"
            onClick={() => window.dispatchEvent(new CustomEvent("alice:open-search"))}
          >
            <span className="hidden sm:inline">⌘K Search</span>
            <span className="sm:hidden">Search</span>
          </button>
          <Link href="/admin" className="text-xs text-muted hover:text-ink">Admin</Link>
        </div>
      </div>
    </header>
  );
}
