#!/usr/bin/env bash
# Step 3: finish Drawdown explorer + start checkpointed MIT Solve full catalogue.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== project-drawdown (limit 100 — covers remaining explorer URLs) ==="
npm run ingest -- --source project-drawdown --limit 100

echo "=== mit-solve (--full checkpointed catalogue) ==="
npm run ingest -- --source mit-solve --full

echo "=== done ==="
