#!/usr/bin/env bash
# Full catalogue backfill (checkpointed) for sitemap / WP REST sources after step 7 samples.
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCES=(
  hundred
  oecd-opsi
  global-resilience-partnership
)

for source in "${SOURCES[@]}"; do
  echo "=== ${source} (--full) ==="
  npm run ingest -- --source "${source}" --full
done

echo "=== catalogue backfill done ==="
