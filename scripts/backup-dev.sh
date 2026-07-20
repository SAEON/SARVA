#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups/dev}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
DB_DUMP="$BACKUP_DIR/sarva.dump"
SOURCE_ARCHIVE="$BACKUP_DIR/source.tar.gz"
MANIFEST="$BACKUP_DIR/manifest.txt"

mkdir -p "$BACKUP_DIR"

cd "$ROOT_DIR"

echo "Creating SARVA dev backup in $BACKUP_DIR"
docker compose up -d db >/dev/null

{
  echo "SARVA dev backup"
  echo "created_utc=$STAMP"
  echo "root=$ROOT_DIR"
  echo "database_dump=sarva.dump"
  echo "source_archive=source.tar.gz"
  echo "git_head=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "git_branch=$(git branch --show-current 2>/dev/null || echo unknown)"
  echo
  echo "Git status:"
  git status --short 2>/dev/null || true
  echo
  echo "Docker services:"
  docker compose ps 2>/dev/null || true
  echo
  echo "Database counts:"
  docker compose exec -T db psql \
    -U "${POSTGRES_USER:-sarva}" \
    -d "${POSTGRES_DB:-sarva}" \
    -At \
    -c "select 'glossary=' || count(*) from sarva.glossary_term union all select 'resources=' || count(*) from sarva.resources union all select 'policy=' || count(*) from sarva.national_policy_legislation union all select 'municipalities=' || count(*) from sarva.municipal_boundaries order by 1;" \
    2>/dev/null || true
  docker compose exec -T db psql \
    -U "${POSTGRES_USER:-sarva}" \
    -d "${POSTGRES_DB:-sarva}" \
    -At \
    -c "select 'catalogue_records=' || count(*) from catalogue.catalogue_records union all select 'catalogue_keywords=' || count(*) from catalogue.record_keywords;" \
    2>/dev/null || true
} > "$MANIFEST"

docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-sarva}" \
  -d "${POSTGRES_DB:-sarva}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  > "$DB_DUMP"

tar \
  --exclude ".git" \
  --exclude ".DS_Store" \
  --exclude "backups" \
  --exclude "node_modules" \
  --exclude "backend/node_modules" \
  --exclude "frontend/node_modules" \
  --exclude "frontend/dist" \
  --exclude "dist" \
  --exclude "build" \
  -czf "$SOURCE_ARCHIVE" \
  .

if command -v shasum >/dev/null 2>&1; then
  {
    echo
    echo "Checksums:"
    shasum -a 256 "$DB_DUMP" "$SOURCE_ARCHIVE"
  } >> "$MANIFEST"
fi

ln -sfn "$BACKUP_DIR" "$BACKUP_ROOT/latest"

echo "Backup complete:"
echo "  $BACKUP_DIR"
echo
echo "Restore database with:"
echo "  npm run restore:dev -- $DB_DUMP"
