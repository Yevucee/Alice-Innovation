#!/usr/bin/env bash
# First enabled Asia catalogue sources. Run via ingest:single-flight on Railway.
set -euo pipefail
cd "$(dirname "$0")/.."

# Keep in sync with scripts/asia-priority-wave.ts after dry-run enables.
ASIA_SOURCES=(
  j-startup
  wavemaker-partners-portfolio
)

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

for source in "${ASIA_SOURCES[@]}"; do
  ingest_one "${source} bootstrap limit 120" --source "${source}" --limit 120
done

for source in "${ASIA_SOURCES[@]}"; do
  ingest_one "${source} full" --source "${source}" --full
done

echo ""
echo "########## asia wave complete ##########"
