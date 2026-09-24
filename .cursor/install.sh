#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=.cursor/common.sh
source ./.cursor/common.sh

ensure_postgres_installed

echo "[install] Installing npm dependencies"
npm ci

ensure_env_file

echo "[install] Done"
