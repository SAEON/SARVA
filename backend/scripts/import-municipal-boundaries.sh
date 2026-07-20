#!/bin/sh
set -eu

if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

if [ -f "src/.env" ]; then
  set -a
  . ./src/.env
  set +a
fi

DEFAULT_SHAPEFILE="../data/municipal-boundaries/MDB_Local_Municipal_Boundary_2018.shp"
if [ -f "/data/municipal-boundaries/MDB_Local_Municipal_Boundary_2018.shp" ]; then
  DEFAULT_SHAPEFILE="/data/municipal-boundaries/MDB_Local_Municipal_Boundary_2018.shp"
fi

SHAPEFILE="${MUNICIPAL_SHAPEFILE:-$DEFAULT_SHAPEFILE}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-sarva}"
DB_USER="${DB_USER:-sarva}"

if { [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; } && [ "$DB_PORT" = "5432" ]; then
  echo "Refusing to use local PostgreSQL on port 5432. Use Docker's exposed database port 5433 from the host, or DB_HOST=db inside Docker." >&2
  exit 1
fi

if [ ! -f "$SHAPEFILE" ]; then
  echo "Municipal shapefile not found: $SHAPEFILE" >&2
  exit 1
fi

command -v shp2pgsql >/dev/null 2>&1 || {
  echo "shp2pgsql is required to import municipal boundaries." >&2
  exit 1
}

command -v psql >/dev/null 2>&1 || {
  echo "psql is required to import municipal boundaries." >&2
  exit 1
}

echo "Importing municipal boundaries from $SHAPEFILE"

PGPASSWORD="${DB_PASSWORD:-}" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "DROP TABLE IF EXISTS sarva.municipal_boundaries CASCADE;"

shp2pgsql \
  -c \
  -I \
  -s 3857 \
  -W UTF-8 \
  -g geom \
  "$SHAPEFILE" \
  sarva.municipal_boundaries \
  | PGPASSWORD="${DB_PASSWORD:-}" psql \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -v ON_ERROR_STOP=1

PGPASSWORD="${DB_PASSWORD:-}" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "COMMENT ON TABLE sarva.municipal_boundaries IS 'MDB Local Municipal Boundary 2018 imported from SARVA data/municipal-boundaries shapefile.';"

PGPASSWORD="${DB_PASSWORD:-}" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) AS municipal_boundary_count FROM sarva.municipal_boundaries;"
