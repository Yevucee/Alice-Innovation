#!/usr/bin/env bash
# Resume hub portfolio queue after an interrupted run (see /tmp/hub-portfolio-ingest.log).
set -euo pipefail
cd "$(dirname "$0")/.."

mapfile -t ALL_SOURCES < <(npx tsx scripts/hub-portfolio-sources.ts)

# Limit pass not completed for these (SU LaunchLab crashed; Ventures Platform not started).
LIMIT_RESUME=(su-launchlab ventures-platform)

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

echo "Resume hub portfolios — limit tail: ${LIMIT_RESUME[*]}"
for source in "${LIMIT_RESUME[@]}"; do
  ingest_one "${source} limit 80" --source "${source}" --limit 80
done

echo "Full pass for all hub portfolio sources (${#ALL_SOURCES[@]})"
for source in "${ALL_SOURCES[@]}"; do
  ingest_one "${source} full" --source "${source}" --full
done

echo ""
echo "########## link ingested startups to hub organisations ##########"
npm run hubs:discover -- --directories seed-organisations --link-portfolios

echo ""
echo "########## hub portfolio resume complete ##########"
