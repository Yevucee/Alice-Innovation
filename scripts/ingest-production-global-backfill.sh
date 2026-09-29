#!/usr/bin/env bash
# Global catalogue depth (no Africa queue). Run when no other ingest holds the lock.
set -euo pipefail
cd "$(dirname "$0")/.."

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

for source in grand-challenges-canada practical-action third-derivative biomimicry-institute ideo-org shell-foundation climate-kic what-design-can-do ideo-design-kit; do
  ingest_one "${source} limit 80" --source "${source}" --limit 80
done

ingest_one "founders-factory-africa full" --source founders-factory-africa --full
ingest_one "atlas-of-the-future limit 80" --source atlas-of-the-future --limit 80
ingest_one "springwise limit 120" --source springwise --limit 120
ingest_one "wipo-green limit 200" --source wipo-green --limit 200
ingest_one "global-resilience-partnership full" --source global-resilience-partnership --full
ingest_one "oecd-opsi full" --source oecd-opsi --full
ingest_one "hundred full" --source hundred --full
ingest_one "xprize limit 80" --source xprize --limit 80
ingest_one "eit-food limit 80" --source eit-food --limit 80
ingest_one "elrha limit 80" --source elrha --limit 80
ingest_one "nesta limit 80" --source nesta --limit 80
ingest_one "seedstars full" --source seedstars --full

echo ""
echo "########## global backfill complete ##########"
