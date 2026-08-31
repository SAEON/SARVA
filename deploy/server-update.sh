#!/usr/bin/env bash
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

usage() {
  cat <<USAGE
Usage: deploy/server-update.sh [--check-only] [--allow-dirty] [--with-mdb-2026-boundaries]

Fetches origin/\$DEPLOY_BRANCH, shows the pending change summary, then
fast-forwards, builds, migrates, starts the SARVA stack, and runs smoke checks.
Optionally downloads/imports the MDB 2026 boundary preview layers.

Environment:
  DEPLOY_BRANCH   Branch to deploy. Default: main
  COMPOSE_FILE    Compose file to use. Default: docker-compose.yml

Options:
  --check-only    Fetch and compare, but do not pull/build/restart.
  --allow-dirty   Continue even if the working tree has local changes.
  --with-mdb-2026-boundaries
                  Download MDB 2026 district, local municipality and ward
                  GeoJSON files into ./data, import them to PostGIS, and
                  recreate Martin so the new vector tile layers are visible.
USAGE
}

CHECK_ONLY=0
ALLOW_DIRTY=0
WITH_MDB_2026_BOUNDARIES=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --check-only) CHECK_ONLY=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --with-mdb-2026-boundaries) WITH_MDB_2026_BOUNDARIES=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

echo "== SARVA deploy =="
echo "Repo: $(pwd)"
echo "Branch: $BRANCH"
echo "Compose: $COMPOSE_FILE"
echo

if [ "$ALLOW_DIRTY" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has local changes. Commit/stash them, or rerun with --allow-dirty." >&2
  git status --short
  exit 1
fi

git fetch origin "$BRANCH"

echo "== Current status =="
git status --short --branch
echo

echo "== Commits to pull =="
git log --oneline --decorate --max-count=20 "HEAD..origin/$BRANCH" || true
echo

echo "== File summary =="
git diff --stat "HEAD..origin/$BRANCH" || true
echo

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "Check-only mode complete. No files, images, or containers changed."
  exit 0
fi

echo "== Pull =="
git pull --ff-only origin "$BRANCH"

echo "== Build =="
sudo docker compose -f "$COMPOSE_FILE" build backend frontend

echo "== Migrate =="
sudo docker compose -f "$COMPOSE_FILE" run --rm backend npm run migrate

echo "== Start =="
sudo docker compose -f "$COMPOSE_FILE" up -d

if [ "$WITH_MDB_2026_BOUNDARIES" -eq 1 ]; then
  echo "== MDB 2026 boundaries =="
  mkdir -p data/mdb-2026
  sudo docker compose -f "$COMPOSE_FILE" run --rm --volume "$(pwd)/data:/data:rw" backend npm run download:mdb-2026-boundaries
  sudo docker compose -f "$COMPOSE_FILE" run --rm backend npm run import:mdb-2026-boundaries
  sudo docker compose -f "$COMPOSE_FILE" up -d --force-recreate martin frontend
fi

echo "== Containers =="
sudo docker compose -f "$COMPOSE_FILE" ps

echo "== Smoke checks =="
curl --fail --silent --show-error --head http://127.0.0.1:8090/ >/dev/null
curl --fail --silent --show-error http://127.0.0.1:8090/api/health >/dev/null
curl --fail --silent --show-error http://127.0.0.1:8090/api/nav >/dev/null

if [ "$WITH_MDB_2026_BOUNDARIES" -eq 1 ]; then
  curl --fail --silent --show-error --head http://127.0.0.1:8090/mdb-2026-boundaries >/dev/null
  curl --fail --silent --show-error --head http://127.0.0.1:8090/tiles/mdb_2026_wards/7/73/75 >/dev/null
fi

echo "SARVA deploy complete."
