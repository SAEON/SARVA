# SARVA Backup and Restore

SARVA includes helper scripts for local Docker development backups. These are intended for developer safety before migrations, importer changes or larger UI/data experiments.

## Create a Backup

From the repository root:

```sh
npm run backup:dev
```

The script writes a timestamped backup under:

```text
backups/dev/
```

Each backup contains:

- `sarva.dump`: PostgreSQL/PostGIS custom-format dump.
- `source.tar.gz`: source snapshot excluding `.git`, `node_modules`, build output and backups.
- `manifest.txt`: git status, Docker service state and checksums.

The latest backup is also linked at:

```text
backups/dev/latest
```

The `backups/` directory is ignored by git. The backup workflow is designed for the local Docker development database and source state. It is not a replacement for managed production database backups.

## Restore the Latest Backup

```sh
npm run restore:dev -- latest --yes
```

## Restore a Specific Backup

List available backups:

```sh
ls backups/dev
```

Then restore the selected backup name:

```sh
npm run restore:dev -- <backup-name> --yes
```

Restore intentionally requires `--yes` because it runs `pg_restore --clean --if-exists` against the Docker development database.

After restore, the script restarts:

- `backend`
- `martin`
- `frontend`

## Restore Source Snapshot Manually

The restore script does not overwrite source files. If you need to inspect or manually recover source from a backup:

```sh
mkdir -p /tmp/sarva-source-restore
tar -xzf backups/dev/latest/source.tar.gz -C /tmp/sarva-source-restore
```

Then copy back only the files you actually want to recover.

## Before Risky Work

Create a backup before:

- Running new migrations.
- Rebuilding municipal indicator tables.
- Running bulk import scripts.
- Testing destructive admin workflows.
- Resetting local Docker volumes.

## Fresh Database Reset

To discard local Docker database state entirely:

```sh
docker compose down -v
```

Then rebuild from migrations and imports:

```sh
docker compose up --build -d db
docker compose run --rm backend npm run migrate
docker compose run --rm backend npm run import:glossary
docker compose run --rm backend npm run import:resources
docker compose run --rm backend npm run import:policy
docker compose --profile tools run --rm municipal-importer
docker compose run --rm backend npm run sync:catalogue
docker compose restart martin
```

## Production Note

Production backup and restore should be handled by the hosting environment or managed PostgreSQL service. Confirm retention, encryption, restore testing and access controls with the SAEON infrastructure team.
