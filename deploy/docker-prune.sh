#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" != "--yes" ]; then
  cat <<USAGE
Usage: deploy/docker-prune.sh --yes

Prunes stopped containers, dangling images, and Docker build cache.
It does not prune volumes, because database data may live there.

Run deploy/docker-prune-preview.sh first to inspect what is taking space.
USAGE
  exit 2
fi

echo "== Before =="
sudo docker system df
echo

echo "== Prune stopped containers =="
sudo docker container prune -f
echo

echo "== Prune dangling images =="
sudo docker image prune -f
echo

echo "== Prune build cache =="
sudo docker builder prune -f
echo

echo "== After =="
sudo docker system df
