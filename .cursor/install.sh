#!/usr/bin/env bash
# Idempotent repository bootstrap for the Alice Innovation Library Cloud Agent
# environment. Runs once after the repository is checked out. Ensures the
# PostgreSQL 16 + pgvector system packages the app requires are present, installs
# npm dependencies, and prepares local configuration.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=.cursor/common.sh
source ./.cursor/common.sh

ensure_postgres_installed

echo "[install] Installing npm dependencies"
npm ci

ensure_env_file

echo "[install] Done"
