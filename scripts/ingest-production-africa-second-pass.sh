#!/usr/bin/env bash
# Second-pass Africa cohort/catalogue sources (enable via setup:africa-second-pass-enable first).
set -euo pipefail
cd "$(dirname "$0")/.."

SECOND_PASS_SOURCES=(
  su-launchlab
  kenya-climate-innovation-centre
  kosmos-innovation-centre-ghana
  africa-tech-summit-showcase
  mest-africa-challenge
  milken-motsepe-innovation-prize
  global-startup-awards-africa
  flat6labs-africa
  growthafrica
  africarena
  africa-fintech-summit-alpha-expo
)

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

for source in "${SECOND_PASS_SOURCES[@]}"; do
  ingest_one "${source} limit 40" --source "${source}" --limit 40
done

for source in "${SECOND_PASS_SOURCES[@]}"; do
  ingest_one "${source} full" --source "${source}" --full
done

echo ""
echo "########## africa second-pass complete ##########"
