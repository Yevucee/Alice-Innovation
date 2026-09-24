#!/usr/bin/env bash
# Per-boot runtime initialisation for the Alice Innovation Library Cloud Agent
# environment. Starts PostgreSQL, ensures the local role/database exist, then
# applies migrations and seeds reference data. Every step is idempotent so the
# script tolerates restarts and a snapshot that already contains data.
set -euo pipefail

cd "$(dirname "$0")/.."

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

echo "[start] Ready"
