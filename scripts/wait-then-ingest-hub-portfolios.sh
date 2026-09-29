#!/usr/bin/env bash
# Wait until no local ingestor is running, then run hub portfolio queue (production env).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Waiting until no ingestor process is running..."
while pgrep -f 'apps/ingestor/src/index.ts' >/dev/null 2>&1; do
  sleep 120
done

echo "Starting hub portfolio ingest queue at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
bash scripts/ingest-hub-portfolios-queue.sh
