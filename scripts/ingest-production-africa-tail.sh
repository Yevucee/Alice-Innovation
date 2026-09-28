#!/usr/bin/env bash
# Finish Africa queue after a failed mid-script run (ATF fix + last full passes).
set -euo pipefail
cd "$(dirname "$0")/.."

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

ingest_one "africa-tech-festival-startup-hub full" --source africa-tech-festival-startup-hub --full
ingest_one "norrsken-accelerator full" --source norrsken-accelerator --full
ingest_one "norrsken-100 full" --source norrsken-100 --full
ingest_one "startgate-um6p full" --source startgate-um6p --full

echo ""
echo "########## africa tail complete ##########"
