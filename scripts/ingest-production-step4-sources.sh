#!/usr/bin/env bash
# Step 4: widen Springwise discovery and ingest newly enabled catalogue sources.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== springwise (limit 120) ==="
npm run ingest -- --source springwise --limit 120

echo "=== xprize (full competitions index) ==="
npm run ingest -- --source xprize

echo "=== done ==="
