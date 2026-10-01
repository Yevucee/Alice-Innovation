#!/usr/bin/env bash
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-postgresql://alice:alice@localhost:5432/alice_test}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found; install PostgreSQL 16 for integration tests" >&2
  exit 1
fi

if ! sudo pg_ctlcluster 16 main status >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start >/dev/null 2>&1 || sudo service postgresql start >/dev/null 2>&1 || true
fi

if ! psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL' || true
DO $$ BEGIN CREATE USER alice WITH PASSWORD 'alice' CREATEDB; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SELECT 'CREATE DATABASE alice_test OWNER alice' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'alice_test')\gexec
SQL
  psql "postgresql://alice:alice@localhost:5432/postgres" -c "CREATE DATABASE alice_test OWNER alice;" 2>/dev/null || true
  psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null
fi

cd "$(dirname "$0")/.."
npm run migrate --silent
npm run seed --silent
tsx scripts/seed-search-test-fixtures.ts
