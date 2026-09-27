#!/usr/bin/env bash
# Step 8: first ingest for newly enabled remaining catalogue sources.
set -euo pipefail
cd "$(dirname "$0")/.."

ingest_when_ready() {
  local label="$1"
  shift
  local attempt=0
  while [ "$attempt" -lt 500 ]; do
    echo "=== ${label} (attempt $((attempt + 1))) ==="
    local log="/tmp/ingest-attempt-${label// /-}.log"
    npm run ingest -- "$@" 2>&1 | tee "$log"
    if ! grep -q '"event":"ingest_skipped"' "$log"; then
      return 0
    fi
    echo "ingest lock held; sleeping 120s..."
    sleep 120
    attempt=$((attempt + 1))
  done
  return 1
}

SOURCES=(
  grand-challenges-canada
  practical-action
  third-derivative
  biomimicry-institute
  ideo-org
  shell-foundation
  climate-kic
  what-design-can-do
  atlas-of-the-future
  ideo-design-kit
)

for source in "${SOURCES[@]}"; do
  ingest_when_ready "${source} (limit 80)" --source "${source}" --limit 80
done

echo "=== step 8 done ==="
