#!/usr/bin/env bash
# One serial production ingest queue. Do not run other ingest tmux jobs alongside this.
set -euo pipefail
cd "$(dirname "$0")/.."

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

# Step 8 — new catalogue sources (limit 80 each)
for source in grand-challenges-canada practical-action third-derivative biomimicry-institute ideo-org shell-foundation climate-kic what-design-can-do atlas-of-the-future ideo-design-kit; do
  ingest_one "${source} limit 80" --source "${source}" --limit 80
done

ingest_one "springwise limit 120" --source springwise --limit 120
ingest_one "wipo-green limit 150" --source wipo-green --limit 150
ingest_one "global-resilience-partnership full" --source global-resilience-partnership --full
ingest_one "oecd-opsi full" --source oecd-opsi --full
ingest_one "hundred full" --source hundred --full

if [[ -f scripts/ingest-production-africa-queue.sh ]]; then
  bash scripts/ingest-production-africa-queue.sh
fi

echo ""
echo "########## single-flight queue complete ##########"
