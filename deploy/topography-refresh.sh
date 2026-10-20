#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${SARVA_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
LOG_DIR="${TOPOGRAPHY_REFRESH_LOG_DIR:-$REPO_DIR/logs}"
LOCK_FILE="${TOPOGRAPHY_REFRESH_LOCK_FILE:-$REPO_DIR/.topography-refresh.lock}"
GDAL_IMAGE="${TOPOGRAPHY_GDAL_IMAGE:-ghcr.io/osgeo/gdal:ubuntu-full-3.9.2}"

mkdir -p "$LOG_DIR"
cd "$REPO_DIR"

exec >>"$LOG_DIR/topography-refresh.log" 2>&1

echo
echo "== SARVA topography refresh | $(date -Is) =="
echo "Repo: $REPO_DIR"

if ! command -v flock >/dev/null 2>&1; then
  echo "flock is required so only one topography refresh can run at a time." >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another topography refresh is already running. Exiting."
  exit 0
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${OPENTOPOGRAPHY_API_KEY:-}" ]; then
  echo "OPENTOPOGRAPHY_API_KEY is not set. Add it to $REPO_DIR/.env before enabling automation." >&2
  exit 1
fi

mkdir -p data/topography

echo "== Resume OpenTopography DEM download =="
DOWNLOAD_COMPLETE=1
if ! sudo docker run --rm \
  --env OPENTOPOGRAPHY_API_KEY="$OPENTOPOGRAPHY_API_KEY" \
  --env OPENTOPOGRAPHY_DEM_TYPE="${OPENTOPOGRAPHY_DEM_TYPE:-NASADEM}" \
  --env TOPOGRAPHY_WEST="${TOPOGRAPHY_WEST:-16.0}" \
  --env TOPOGRAPHY_SOUTH="${TOPOGRAPHY_SOUTH:--35.0}" \
  --env TOPOGRAPHY_EAST="${TOPOGRAPHY_EAST:-33.0}" \
  --env TOPOGRAPHY_NORTH="${TOPOGRAPHY_NORTH:--22.0}" \
  --env TOPOGRAPHY_TILE_DEGREES="${TOPOGRAPHY_TILE_DEGREES:-2}" \
  --env TOPOGRAPHY_DEM_FILE="${TOPOGRAPHY_DEM_FILE:-south-africa-dem.tif}" \
  --volume "$REPO_DIR/backend:/app:ro" \
  --volume "$REPO_DIR/data:/data:rw" \
  --workdir /app \
  node:22-alpine npm run download:topography; then
  echo "Download did not complete. This is usually the OpenTopography daily request limit; the next scheduled run will resume from existing tiles."
  DOWNLOAD_COMPLETE=0
fi

if [ "$DOWNLOAD_COMPLETE" -eq 0 ] && [ "${TOPOGRAPHY_PROCESS_PARTIAL:-true}" != "true" ]; then
  echo "Partial processing is disabled. Exiting until the next scheduled run."
  exit 0
fi

if ! find data/topography/dem-tiles -maxdepth 1 -type f -name '*.tif' -print -quit | grep -q .; then
  echo "No DEM tiles are available to process yet."
  exit 0
fi

echo "== Process DEM to slope zones and contours =="
sudo docker run --rm \
  --env TOPOGRAPHY_DATA_DIR=/data/topography \
  --env TOPOGRAPHY_DEM_FILE="${TOPOGRAPHY_DEM_FILE:-south-africa-dem.tif}" \
  --env TOPOGRAPHY_CONTOUR_INTERVAL="${TOPOGRAPHY_CONTOUR_INTERVAL:-100}" \
  --env TOPOGRAPHY_CONTOUR_SIMPLIFY="${TOPOGRAPHY_CONTOUR_SIMPLIFY:-0.001}" \
  --env TOPOGRAPHY_INCLUDE_SLOPE="${TOPOGRAPHY_INCLUDE_SLOPE:-false}" \
  --volume "$REPO_DIR/data/topography:/data/topography:rw" \
  --volume "$REPO_DIR/scripts/process-topography-with-gdal.sh:/process-topography-with-gdal.sh:ro" \
  "$GDAL_IMAGE" /process-topography-with-gdal.sh

echo "== Import topography vectors =="
sudo docker compose -f "$COMPOSE_FILE" run --rm -e TOPOGRAPHY_CONTOUR_INTERVAL="${TOPOGRAPHY_CONTOUR_INTERVAL:-100}" backend npm run import:topography

echo "== Restart tile/frontend services =="
sudo docker compose -f "$COMPOSE_FILE" up -d --force-recreate martin frontend

echo "== Smoke checks =="
curl --fail --silent --show-error http://127.0.0.1:8090/api/topography/status
echo
echo "Topography refresh complete."
