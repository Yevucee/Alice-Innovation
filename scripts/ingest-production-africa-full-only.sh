#!/usr/bin/env bash
# Run only the --full pass for Africa queue sources (after limit pass completed).
set -euo pipefail
cd "$(dirname "$0")/.."

# Slugs: scripts/africa-queue-sources.ts
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
  ingest_one "${source} full" --source "${source}" --full
done

echo ""
echo "########## africa full pass complete ##########"
