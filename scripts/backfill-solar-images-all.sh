#!/usr/bin/env bash
# Re-fetch solar-impulse canonical URLs until no new image_url values are written.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BATCH="${BATCH_SIZE:-100}"
RUNNER=(bash scripts/run-with-production-env.sh)

echo "Solar image backfill loop (batch size ${BATCH})"
while true; do
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  LOG="$(mktemp)"
  "${RUNNER[@]}" npm run backfill:images-from-db -- --source solar-impulse --limit "$BATCH" 2>&1 | tee "$LOG"
  UPDATED="$(rg -o '"updated":[0-9]+' "$LOG" | tail -1 | sed 's/.*://' || echo 0)"
  rm -f "$LOG"
  "${RUNNER[@]}" npm run check:image-coverage 2>&1 | rg '"event":"image_coverage"' || true
  if [ "${UPDATED:-0}" = "0" ]; then
    echo "Done: no rows updated in last batch."
    break
  fi
done
