#!/usr/bin/env bash
# Step 2: grow catalogues for sources already in production (beyond step-1 sample limits).
# Run on alice-mcp shell or via scripts/run-with-production-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== mit-solve (limit 150) ==="
npm run ingest -- --source mit-solve --limit 150

echo "=== springwise (limit 40) ==="
npm run ingest -- --source springwise --limit 40

echo "=== project-drawdown (limit 50) ==="
npm run ingest -- --source project-drawdown --limit 50

echo "=== done ==="
