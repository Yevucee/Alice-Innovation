#!/usr/bin/env bash
# Run a command against production DB + MCP env from a Cloud Agent or laptop.
# Usage: scripts/run-with-production-env.sh npm run check:image-coverage
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${RAILWAY_PROJECT_ID:-59b357e4-b942-4d95-af70-7bfec387e544}"
ENV_NAME="${RAILWAY_ENVIRONMENT:-production}"
# shellcheck source=/dev/null
source "${RAILWAY_HOME:-$HOME/.railway}/env"
DBURL="$(env -u RAILWAY_TOKEN railway run -p "$PROJECT_ID" -e "$ENV_NAME" -s pgvector -- node "$ROOT/scripts/production-tcp-database-url.mjs")"
exec env -u RAILWAY_TOKEN railway run -p "$PROJECT_ID" -e "$ENV_NAME" -s alice-mcp -- env DATABASE_URL="$DBURL" "$@"
