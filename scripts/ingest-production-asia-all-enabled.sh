#!/usr/bin/env bash
# Ingest every enabled asia-innovation source (bootstrap limit then optional full).
# Run on Railway alice-mcp via ingest:single-flight. Expect hours for full catalogue.
set -euo pipefail
cd "$(dirname "$0")/.."

LIMIT="${ASIA_INGEST_LIMIT:-80}"
FULL="${ASIA_INGEST_FULL:-1}"

mapfile -t ASIA_SOURCES < <(npx tsx scripts/asia-list-enabled-sources.ts)
echo "Asia enabled sources: ${#ASIA_SOURCES[@]}"

ingest_one() {
  echo ""
  echo "########## $1 ##########"
  npm run ingest -- "${@:2}"
}

for source in "${ASIA_SOURCES[@]}"; do
  ingest_one "${source} bootstrap limit ${LIMIT}" --source "${source}" --limit "${LIMIT}"
done

if [[ "${FULL}" == "1" ]]; then
  for source in "${ASIA_SOURCES[@]}"; do
    ingest_one "${source} full" --source "${source}" --full
  done
fi

echo ""
echo "########## asia all-enabled ingest complete ##########"
