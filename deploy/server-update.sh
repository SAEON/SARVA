#!/usr/bin/env bash
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

usage() {
  cat <<USAGE
Usage: deploy/server-update.sh [--check-only] [--allow-dirty] [--with-mdb-2026-boundaries] [--with-topography]

Fetches origin/\$DEPLOY_BRANCH, shows the pending change summary, then
fast-forwards, builds, migrates, starts the SARVA stack, and runs smoke checks.
Optionally downloads/imports the MDB 2026 boundary preview layers.
Optionally downloads/processes/imports DEM-derived topography layers.

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
  --with-topography
                  Download a DEM from OpenTopography, process it into
                  contours and slope zones with GDAL, import those vectors
                  to PostGIS, and recreate Martin/frontend.
                  Requires OPENTOPOGRAPHY_API_KEY.
USAGE
}

CHECK_ONLY=0
ALLOW_DIRTY=0
WITH_MDB_2026_BOUNDARIES=0
WITH_TOPOGRAPHY=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --check-only) CHECK_ONLY=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --with-mdb-2026-boundaries) WITH_MDB_2026_BOUNDARIES=1 ;;
    --with-topography) WITH_TOPOGRAPHY=1 ;;
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
  sudo docker run --rm --volume "$(pwd)/backend:/app:ro" --volume "$(pwd)/data:/data:rw" --workdir /app node:22-alpine npm run download:mdb-2026-boundaries
  sudo docker compose -f "$COMPOSE_FILE" run --rm backend npm run import:mdb-2026-boundaries
  sudo docker compose -f "$COMPOSE_FILE" up -d --force-recreate martin frontend
fi

if [ "$WITH_TOPOGRAPHY" -eq 1 ]; then
  if [ -z "${OPENTOPOGRAPHY_API_KEY:-}" ]; then
    echo "OPENTOPOGRAPHY_API_KEY is required for --with-topography." >&2
    exit 1
  fi
  echo "== Topography =="
  mkdir -p data/topography
  sudo docker run --rm \
    --env OPENTOPOGRAPHY_API_KEY="$OPENTOPOGRAPHY_API_KEY" \
    --env OPENTOPOGRAPHY_DEM_TYPE="${OPENTOPOGRAPHY_DEM_TYPE:-NASADEM}" \
    --env TOPOGRAPHY_WEST="${TOPOGRAPHY_WEST:-16.0}" \
    --env TOPOGRAPHY_SOUTH="${TOPOGRAPHY_SOUTH:--35.0}" \
    --env TOPOGRAPHY_EAST="${TOPOGRAPHY_EAST:-33.0}" \
    --env TOPOGRAPHY_NORTH="${TOPOGRAPHY_NORTH:--22.0}" \
    --env TOPOGRAPHY_TILE_DEGREES="${TOPOGRAPHY_TILE_DEGREES:-2}" \
    --env TOPOGRAPHY_DEM_FILE="${TOPOGRAPHY_DEM_FILE:-south-africa-dem.tif}" \
    --volume "$(pwd)/backend:/app:ro" \
    --volume "$(pwd)/data:/data:rw" \
    --workdir /app \
    node:22-alpine npm run download:topography
  sudo docker run --rm \
    --env TOPOGRAPHY_DATA_DIR=/data/topography \
    --env TOPOGRAPHY_DEM_FILE="${TOPOGRAPHY_DEM_FILE:-south-africa-dem.tif}" \
    --env TOPOGRAPHY_CONTOUR_INTERVAL="${TOPOGRAPHY_CONTOUR_INTERVAL:-100}" \
    --env TOPOGRAPHY_CONTOUR_SIMPLIFY="${TOPOGRAPHY_CONTOUR_SIMPLIFY:-0.001}" \
    --env TOPOGRAPHY_INCLUDE_SLOPE="${TOPOGRAPHY_INCLUDE_SLOPE:-false}" \
    --volume "$(pwd)/data/topography:/data/topography:rw" \
    --volume "$(pwd)/scripts/process-topography-with-gdal.sh:/process-topography-with-gdal.sh:ro" \
    ghcr.io/osgeo/gdal:ubuntu-full-3.9.2 /process-topography-with-gdal.sh
  sudo docker compose -f "$COMPOSE_FILE" run --rm -e TOPOGRAPHY_CONTOUR_INTERVAL="${TOPOGRAPHY_CONTOUR_INTERVAL:-100}" backend npm run import:topography
  sudo docker compose -f "$COMPOSE_FILE" up -d --force-recreate martin frontend
fi

echo "== Containers =="
sudo docker compose -f "$COMPOSE_FILE" ps

echo "== Smoke checks =="
retry_curl() {
  local url="$1"
  local method="${2:-GET}"
  local attempts="${3:-20}"

  for attempt in $(seq 1 "$attempts"); do
    if [ "$method" = "HEAD" ]; then
      if curl --fail --silent --show-error --head "$url" >/dev/null; then
        return 0
      fi
    else
      if curl --fail --silent --show-error "$url" >/dev/null; then
        return 0
      fi
    fi

    if [ "$attempt" -lt "$attempts" ]; then
      sleep 2
    fi
  done

  echo "Smoke check failed after ${attempts} attempts: $url" >&2
  return 1
}

retry_curl http://127.0.0.1:8090/ HEAD
retry_curl http://127.0.0.1:8090/api/health GET
retry_curl http://127.0.0.1:8090/api/nav GET

if [ "$WITH_MDB_2026_BOUNDARIES" -eq 1 ]; then
  retry_curl http://127.0.0.1:8090/mdb-2026-boundaries HEAD
  retry_curl http://127.0.0.1:8090/tiles/mdb_2026_wards/7/73/75 HEAD
fi

if [ "$WITH_TOPOGRAPHY" -eq 1 ]; then
  retry_curl http://127.0.0.1:8090/tiles/topography_contours/7/73/79 HEAD
  retry_curl http://127.0.0.1:8090/tiles/topography_slope_zones/7/73/79 HEAD
fi

echo "SARVA deploy complete."
