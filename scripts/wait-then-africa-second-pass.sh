#!/usr/bin/env bash
# Wait until ingest:resume-all (and any ingestor) finishes, then run Africa second-pass with latest main.
set -euo pipefail
cd "$(dirname "$0")/.."

idle() {
  ! pgrep -f 'ingest-resume-all-queue\.sh' >/dev/null 2>&1 \
    && ! pgrep -f 'ingest-hub-portfolios' >/dev/null 2>&1 \
    && ! pgrep -f 'apps/ingestor/src/index\.ts' >/dev/null 2>&1
}

echo "Waiting for resume-all queue and ingestor to finish..."
while ! idle; do
  echo "  still running $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  sleep 120
done

echo "Resume queue idle. Syncing main and seed..."
git fetch origin main
git checkout main 2>/dev/null || true
git pull origin main

npm run seed

echo "Starting Africa second-pass at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
bash scripts/ingest-production-africa-second-pass.sh

echo "Africa second-pass follow-up complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
