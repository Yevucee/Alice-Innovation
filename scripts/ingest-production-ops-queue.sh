#!/usr/bin/env bash
# Sequential ops queue: Springwise widen, WIPO API sample, then catalogue backfill tails.
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
  echo "gave up waiting for ingest lock: ${label}"
  return 1
}

ingest_when_ready "springwise (limit 120)" --source springwise --limit 120
ingest_when_ready "wipo-green (limit 100)" --source wipo-green --limit 100
ingest_when_ready "oecd-opsi (--full)" --source oecd-opsi --full
ingest_when_ready "global-resilience-partnership (--full)" --source global-resilience-partnership --full

echo "=== ops queue done ==="
