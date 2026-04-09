#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
docker compose -p fluxfiles-dev -f docker-compose.dev.yml --env-file .env.dev down --remove-orphans
