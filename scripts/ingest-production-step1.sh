#!/usr/bin/env bash
# Run on Railway alice-mcp Console (shared production DB + OpenRouter embeddings).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== mit-solve (limit 25) ==="
npm run ingest -- --source mit-solve --limit 25

echo "=== solar-impulse (limit 15) ==="
npm run ingest -- --source solar-impulse --limit 15

echo "=== springwise (limit 15) ==="
npm run ingest -- --source springwise --limit 15

echo "=== done ==="
