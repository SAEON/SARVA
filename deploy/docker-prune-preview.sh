#!/usr/bin/env bash
set -euo pipefail

echo "== Docker disk usage =="
sudo docker system df
echo

echo "== Stopped containers that prune would remove =="
sudo docker container ls -a --filter status=exited
echo

echo "== Dangling images that prune would remove =="
sudo docker image ls --filter dangling=true
echo

echo "== Dangling volumes, shown only for awareness =="
sudo docker volume ls --filter dangling=true
echo

echo "No changes made."
echo "Run deploy/docker-prune.sh --yes to prune stopped containers, dangling images, and build cache."
echo "Volumes are not pruned by that script."
