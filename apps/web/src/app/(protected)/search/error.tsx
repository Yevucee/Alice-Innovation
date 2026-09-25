"use client";

import Link from "next/link";

export default function SearchError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-medium">Search could not load</h1>
      <p className="mt-2 text-sm text-muted">Try again, or browse from Discover.</p>
      <div className="mt-6 flex justify-center gap-4 text-sm">
        <button type="button" className="text-accent hover:underline" onClick={reset}>Retry</button>
        <Link href="/" className="text-accent hover:underline">Discover</Link>
        <Link href="/search" className="text-muted hover:text-ink">Search</Link>
      </div>
    </div>
  );
}
