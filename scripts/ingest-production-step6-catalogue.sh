#!/usr/bin/env bash
# Step 6: GRP resources (paginated), Zayed impact stories (sitemap), GGF fellow cohort pages.
set -euo pipefail
cd "$(dirname "$0")/.."

for source in global-resilience-partnership zayed-sustainability-prize global-good-fund; do
  echo "=== ${source} (limit 80) ==="
  npm run ingest -- --source "${source}" --limit 80
done

echo "=== done ==="
