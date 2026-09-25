#!/usr/bin/env bash
# Step 4: widen Springwise discovery and ingest newly enabled catalogue sources.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== springwise (limit 120) ==="
npm run ingest -- --source springwise --limit 120

echo "=== xprize (full competitions index) ==="
npm run ingest -- --source xprize

echo "=== challenge-works (full explore-prizes catalogue) ==="
npm run ingest -- --source challenge-works

echo "=== wipo-green (limit 50; API is slow — raise limit for backfill) ==="
npm run ingest -- --source wipo-green --limit 50

echo "=== done ==="
