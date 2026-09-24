#!/usr/bin/env bash
# Shared, idempotent helpers for the Alice Innovation Library Cloud Agent
# environment. Sourced by install.sh and start.sh.

ensure_postgres_installed() {
  if ! command -v pg_ctlcluster >/dev/null 2>&1; then
    echo "[env] Installing PostgreSQL 16 + pgvector system packages"
    sudo apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
      postgresql-16 postgresql-16-pgvector postgresql-client-16
  fi
}

ensure_node_modules() {
  if [ ! -d node_modules ]; then
    echo "[env] node_modules missing, running npm ci"
    npm ci
  fi
}

ensure_env_file() {
  if [ -f .env ]; then
    return 0
  fi
  echo "[env] Creating .env for local development"
  local token
  token="$(openssl rand -hex 24)"
  cat > .env <<EOF
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/alice_innovation
MCP_AUTH_TOKEN=${token}
AUTH_MODE=token
PORT=8080
ADMIN_PORT=8081
ADMIN_ENABLED=false
WEB_PORT=3000
WEB_SESSION_SECRET=${token}
WEB_AUTH_PASSWORD=${token}
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
}
