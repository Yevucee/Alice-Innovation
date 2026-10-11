import Link from "next/link";
import { ReviewQueuePanel } from "@/components/review-queue-panel";

export default function AdminReviewQueuePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <p className="text-xs text-muted">
        <Link href="/admin" className="underline">← Admin</Link>
      </p>
      <h1 className="mt-2 text-xl font-medium">Quality review queue</h1>
      <p className="mt-1 text-sm text-muted">
        Paged NEEDS_REVIEW items. Bulk auto-fix runs via post-deploy job{" "}
        <code className="text-ink">needs_review_bulk_fix_202510</code> after Samuel dry-runs{" "}
        <code className="text-ink">scripts/needs-review-bulk-fix.ts</code>.
      </p>
      <section className="mt-6 rounded border border-line bg-white p-4">
        <ReviewQueuePanel />
      </section>
    </div>
  );
}
