# SARVA Dev Backup and Restore

Use this before risky coding, migrations, imports, or layout experiments.

## Create a Backup

```sh
npm run backup:dev
```

This creates:

- `backups/dev/<timestamp>/sarva.dump` - PostgreSQL/PostGIS custom-format dump
- `backups/dev/<timestamp>/source.tar.gz` - source snapshot excluding `.git`, `node_modules`, build output, and backups
- `backups/dev/<timestamp>/manifest.txt` - git status, Docker service state, and checksums

The latest backup is also linked at:

```sh
backups/dev/latest
```

The `backups/` directory is ignored by git.

## Restore the Database

Restore from the latest backup:

```sh
npm run restore:dev -- latest --yes
```

Restore from a specific backup:

```sh
npm run restore:dev -- backups/dev/20260710T130000Z/sarva.dump --yes
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

Then copy only the files you actually want back.

## Notes

- This is for local development safety, not production disaster recovery.
- The database dump includes SARVA app tables, auth users/roles, imported glossary/resources/policy data, and PostGIS spatial tables.
- Code should still be protected with git commits when you reach a stable point.
