import { NextRequest, NextResponse } from "next/server";
import { createIngestRequest } from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";
import { handleAdminIngestRunPost } from "@/lib/admin-ingest-run";
import { railwayIngestConfigured, triggerIngestorDeployment } from "@/lib/railway-ingest";

function adminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

export async function POST(request: NextRequest) {
  const result = await handleAdminIngestRunPost(request, {
    adminEnabled,
    requireSession,
    db: () => pool(),
    createIngestRequest,
    railwayConfigured: railwayIngestConfigured,
    triggerIngestor: triggerIngestorDeployment,
    markRequestFailed: async (db, id, message) => {
      await db.query(
        `UPDATE ingest_requests SET status = 'failed', completed_at = now(), error_message = $2 WHERE id = $1::uuid`,
        [id, message],
      );
    },
  });
  return NextResponse.json(result.body, { status: result.status });
}
