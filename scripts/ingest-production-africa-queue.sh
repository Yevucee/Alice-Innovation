#!/usr/bin/env bash
# Serial Africa catalogue ingests. Run only via ingest:single-flight or alone.
set -euo pipefail
cd "$(dirname "$0")/.."

AFRICA_SOURCES=(
  digital-africa
  ghana-climate-innovation-centre
  ventures-platform
  founders-factory-africa
  baobab-network
  injini-african-edtech-map
  ihub-future-of-learning
  oceanhub-africa
  cchub-syndicate
  seedstars-africa
  africa-tech-festival-startup-hub
  norrsken-accelerator
  norrsken-100
  startgate-um6p
)

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

for source in "${AFRICA_SOURCES[@]}"; do
  ingest_one "${source} limit 80" --source "${source}" --limit 80
done

for source in "${AFRICA_SOURCES[@]}"; do
  ingest_one "${source} full" --source "${source}" --full
done

echo ""
echo "########## africa queue complete ##########"
