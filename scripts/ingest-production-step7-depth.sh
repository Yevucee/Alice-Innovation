#!/usr/bin/env bash
# Step 7: deepen HundrED (innovations sitemap) and OECD OPSI (WP REST cases).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== hundred (limit 400) ==="
npm run ingest -- --source hundred --limit 400

echo "=== oecd-opsi (limit 400) ==="
npm run ingest -- --source oecd-opsi --limit 400

echo "=== done ==="
