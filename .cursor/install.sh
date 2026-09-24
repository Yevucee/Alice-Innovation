#!/usr/bin/env bash
# Idempotent repository bootstrap for the Alice Innovation Library Cloud Agent
# environment. Runs after the repository is checked out. Installs the PostgreSQL
# 16 + pgvector system packages the app requires (a no-op when already present),
# then prepares repository-level dependencies and local configuration.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "[install] Installing PostgreSQL 16 + pgvector system packages"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    postgresql-16 postgresql-16-pgvector postgresql-client-16
else
  echo "[install] PostgreSQL already installed, skipping apt install"
fi

echo "[install] Installing npm dependencies"
npm ci

if [ ! -f .env ]; then
  echo "[install] Creating .env for local development"
  TOKEN="$(openssl rand -hex 24)"
  cat > .env <<EOF
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/alice_innovation
MCP_AUTH_TOKEN=${TOKEN}
AUTH_MODE=token
PORT=8080
ADMIN_PORT=8081
ADMIN_ENABLED=false
EMBEDDING_PROVIDER=openai
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
CLASSIFIER_ENABLED=false
INGESTION_USER_AGENT=AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)
INGESTION_DEFAULT_CONCURRENCY=1
INGESTION_REQUEST_TIMEOUT_MS=20000
LOG_LEVEL=info
SERVICE_NAME=alice
EOF
else
  echo "[install] .env already present, leaving it unchanged"
fi

echo "[install] Done"
