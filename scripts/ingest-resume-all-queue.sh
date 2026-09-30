#!/usr/bin/env bash
# Serial production ingest resume: hub portfolios, AfriLabs, MIT Solve full, Africa second-pass.
set -euo pipefail
cd "$(dirname "$0")/.."

ingest_one() {
  local label="$1"
  shift
  echo ""
  echo "########## ${label} ##########"
  npm run ingest -- "$@"
}

echo "========== ingest resume-all started $(date -u +%Y-%m-%dT%H:%M:%SZ) =========="

bash scripts/ingest-hub-portfolios-resume.sh

ingest_one "afrilabs limit 80" --source afrilabs --limit 80
ingest_one "afrilabs full" --source afrilabs --full

ingest_one "mit-solve full" --source mit-solve --full

if [[ -f scripts/ingest-production-africa-second-pass.sh ]]; then
  bash scripts/ingest-production-africa-second-pass.sh
fi

echo ""
echo "========== ingest resume-all complete $(date -u +%Y-%m-%dT%H:%M:%SZ) =========="
