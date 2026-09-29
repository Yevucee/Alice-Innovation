#!/usr/bin/env bash
# Wait for Startgate (or any ingestor) to exit, then run global backfill.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Waiting until no ingestor process is running..."
while pgrep -f 'apps/ingestor/src/index.ts' >/dev/null 2>&1; do
  sleep 90
done

echo "Starting global backfill at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
bash scripts/ingest-production-global-backfill.sh

echo "Starting Africa second-pass ingest at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
bash scripts/ingest-production-africa-second-pass.sh

echo "Backfilling Africa country tags from metadata..."
npx tsx scripts/backfill-africa-country-from-metadata.ts
