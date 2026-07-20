#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP_ARG="${1:-}"
CONFIRM="${2:-}"

if [ -z "$BACKUP_ARG" ]; then
  echo "Usage:"
  echo "  npm run restore:dev -- backups/dev/<timestamp>/sarva.dump --yes"
  echo "  npm run restore:dev -- latest --yes"
  exit 2
fi

if [ "$BACKUP_ARG" = "latest" ]; then
  BACKUP_ARG="$ROOT_DIR/backups/dev/latest/sarva.dump"
fi

case "$BACKUP_ARG" in
  /*) DB_DUMP="$BACKUP_ARG" ;;
  *) DB_DUMP="$ROOT_DIR/$BACKUP_ARG" ;;
esac

if [ ! -f "$DB_DUMP" ]; then
  echo "Backup dump not found: $DB_DUMP"
  exit 2
fi

if [ "$CONFIRM" != "--yes" ] && [ "${SARVA_RESTORE_CONFIRM:-}" != "yes" ]; then
  echo "This will restore the Docker development database from:"
  echo "  $DB_DUMP"
  echo
  echo "It will drop database objects included in the dump before recreating them."
  echo "Run again with --yes to continue:"
  echo "  npm run restore:dev -- $BACKUP_ARG --yes"
  exit 2
fi

cd "$ROOT_DIR"

echo "Restoring SARVA dev database from $DB_DUMP"
docker compose up -d db >/dev/null

docker compose exec -T db pg_restore \
  -U "${POSTGRES_USER:-sarva}" \
  -d "${POSTGRES_DB:-sarva}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  < "$DB_DUMP"

echo "Database restore complete."
echo "Starting dependent services..."
docker compose up -d backend martin frontend >/dev/null
echo "Restore finished."
