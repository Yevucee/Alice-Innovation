#!/usr/bin/env bash
# Ingest startup/portfolio catalogues for first-class hubs (seed YAML linked_portfolio_source).
# Serial only — run via ingest:single-flight or alone. Links resources to hub orgs after ingest.
set -euo pipefail
cd "$(dirname "$0")/.."

mapfile -t HUB_PORTFOLIO_SOURCES < <(npx tsx scripts/hub-portfolio-sources.ts)

if [[ ${#HUB_PORTFOLIO_SOURCES[@]} -eq 0 ]]; then
  echo "No hub portfolio sources found in hub-seed-organisations.yaml"
  exit 1
fi

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

echo "Hub portfolio sources (${#HUB_PORTFOLIO_SOURCES[@]}): ${HUB_PORTFOLIO_SOURCES[*]}"

for source in "${HUB_PORTFOLIO_SOURCES[@]}"; do
  ingest_one "${source} limit 80" --source "${source}" --limit 80
done

for source in "${HUB_PORTFOLIO_SOURCES[@]}"; do
  ingest_one "${source} full" --source "${source}" --full
done

echo ""
echo "########## link ingested startups to hub organisations ##########"
npm run hubs:discover -- --directories seed-organisations --link-portfolios

echo ""
echo "########## hub portfolio queue complete ##########"
