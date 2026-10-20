#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$project_dir"
if [ "$(docker inspect -f '{{.State.Running}}' sarva-analytics-web 2>/dev/null)" != true ]; then
  echo 'Start the local SARVA analytics preview first.' >&2
  exit 1
fi
python3 scripts/preview-credentials.py init
docker compose -f preview/compose.local.yml up -d
docker compose -f preview/compose.local.yml exec -T preview-gateway nginx -t
echo 'Protected local preview: http://127.0.0.1:5180'
echo 'Read your local test login: python3 scripts/preview-credentials.py show'
echo 'This configuration binds to loopback only. Do not use it for internet hosting.'
