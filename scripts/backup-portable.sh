#!/bin/sh
set -eu
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$ROOT_DIR/backups/portable/$STAMP"
umask 077
mkdir -p "$BACKUP_DIR"
cd "$ROOT_DIR"
printf 'Backup folder: %s\n' "$BACKUP_DIR"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=6 --no-owner --no-acl' > "$BACKUP_DIR/sarva.dump"
docker compose exec -T db pg_restore --list < "$BACKUP_DIR/sarva.dump" > "$BACKUP_DIR/database-contents.txt"
printf 'Database export complete. Archiving source and data…\n'
COPYFILE_DISABLE=1 tar --exclude='./backups' --exclude='node_modules' --exclude='.DS_Store' --exclude='./frontend/dist' -czf "$BACKUP_DIR/sarva-project.tar.gz" .
cp docs/WINDOWS_BACKUP_RESTORE.md "$BACKUP_DIR/RESTORE-WINDOWS.md"
{
 printf 'SARVA portable backup\nCreated UTC: %s\n' "$STAMP"
 printf 'Git commit: '; git rev-parse HEAD
 printf '\nWorking tree (included in archive):\n'; git status --short
 printf '\nDocker versions:\n'; docker version --format '{{.Server.Version}}'
 printf '\nServices:\n'; docker compose ps
 printf '\nDatabase: custom-format pg_dump, no ownership or ACLs.\nProject: source, Git history, local configuration and data.\nExcluded: backups, node_modules, frontend/dist, .DS_Store.\nDocker images are rebuilt on Windows; internet required.\nTransient in-memory FIRMS/GDACS caches are not archived.\n'
} > "$BACKUP_DIR/manifest.txt"
(cd "$BACKUP_DIR" && shasum -a 256 sarva.dump sarva-project.tar.gz RESTORE-WINDOWS.md database-contents.txt manifest.txt > SHA256SUMS.txt)
printf 'Backup complete: %s\n' "$BACKUP_DIR"
