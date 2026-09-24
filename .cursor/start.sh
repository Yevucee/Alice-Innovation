#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=.cursor/common.sh
source ./.cursor/common.sh

ensure_postgres_installed
ensure_node_modules
ensure_env_file

echo "[start] Starting PostgreSQL 16 cluster"
sudo pg_ctlcluster 16 main start 2>/dev/null || true

echo "[start] Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
pg_isready -h 127.0.0.1 -p 5432

echo "[start] Ensuring local role and database exist"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='alice_innovation'" \
  | grep -q 1 || sudo -u postgres createdb alice_innovation

echo "[start] Applying migrations"
npm run migrate

echo "[start] Seeding reference data"
npm run seed

echo "[start] Ready — optional sample ingest:"
echo "  npm run ingest -- --source project-drawdown --limit 5"
echo "[start] Web UI password is in .env (WEB_AUTH_PASSWORD, same as MCP_AUTH_TOKEN when auto-generated)"
