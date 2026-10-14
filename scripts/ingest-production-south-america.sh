#!/usr/bin/env bash
# South America catalogue ingests (wave 1 + GRIDX + UNC). Run via ingest:south-america:remote.
set -euo pipefail
cd "$(dirname "$0")/.."

export INGEST_SCOPE=south-america
export POST_DEPLOY_JOBS_ON_INGEST=false
export POST_DEPLOY_BEFORE_INGEST=false

SOUTH_AMERICA_SOURCES=(
  fapesp-pipe
  gridx-portfolio
  unc-oferta-tecnologica
  usp-vitrine-portfolio
  cuech-red-proyectos
)

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

for source in "${SOUTH_AMERICA_SOURCES[@]}"; do
  ingest_one "${source} full" --scope south-america --source "${source}" --full || true
done

echo ""
echo "########## south-america queue complete ##########"
