#!/usr/bin/env bash
# One-off / post-deploy: populate source_items.image_url for card thumbnails.
# Run in Railway **alice-mcp** shell (private DATABASE_URL + EMBEDDING_*).
# Safe to re-run; unchanged text still picks up og:image when the fast path runs.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== image coverage (before) ==="
npm run check:image-coverage

echo "=== project-drawdown (limit 30) ==="
npm run ingest -- --source project-drawdown --limit 30

echo "=== mit-solve (limit 40) ==="
npm run ingest -- --source mit-solve --limit 40

echo "=== solar-impulse (limit 120) ==="
npm run ingest -- --source solar-impulse --limit 120

echo "=== springwise (limit 25) ==="
npm run ingest -- --source springwise --limit 25

echo "=== image coverage (after) ==="
npm run check:image-coverage

echo "=== done ==="
