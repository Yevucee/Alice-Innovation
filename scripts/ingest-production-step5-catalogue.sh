#!/usr/bin/env bash
# Step 5: ingest newly enabled HTML catalogue sources (shared adapter).
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCES=(
  earthshot-prize
  hundred
  oecd-opsi
  skoll
  echoing-green
  elevate-prize
  audacious-project
  holcim-foundation
  mulago
  draper-richards-kaplan
  elrha
  eit-food
  nesta
  apolitical
)

for source in "${SOURCES[@]}"; do
  echo "=== ${source} (limit 80) ==="
  npm run ingest -- --source "${source}" --limit 80
done

echo "=== done ==="
