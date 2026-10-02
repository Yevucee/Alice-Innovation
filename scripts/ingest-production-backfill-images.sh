#!/usr/bin/env bash
# One-off / post-deploy: populate source_items.image_url for card thumbnails.
# Run in Railway **alice-mcp** shell (private DATABASE_URL + EMBEDDING_*).
# Safe to re-run; unchanged text still picks up og:image when the fast path runs.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== image coverage (before) ==="
npm run check:image-coverage

echo "=== backfill catalogue pages (validate HEAD, limit 40 each) ==="
npm run backfill:images-from-db -- --source project-drawdown --limit 40 --validate
npm run backfill:images-from-db -- --source mit-solve --limit 40 --validate

echo "=== targeted re-ingest (limits) ==="
npm run ingest -- --source project-drawdown --limit 30
npm run ingest -- --source mit-solve --limit 40
npm run ingest -- --source solar-impulse --limit 120
npm run ingest -- --source springwise --limit 25

echo "=== listing-card backfill (norrsken / injini samples) ==="
npm run backfill:listing-card-images -- --source norrsken-100 --limit 40
npm run backfill:listing-card-images -- --source injini-african-edtech-map --limit 40

echo "=== image coverage (after) ==="
npm run check:image-coverage

echo "=== done ==="
