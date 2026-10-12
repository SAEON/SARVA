# SARVA portable backup — Windows restore

Keep this backup private: the project archive contains `.env` files, API keys, passwords and Git history. Copy the entire timestamped backup folder to the external drive. Use exFAT or NTFS; FAT32 cannot hold files over 4 GB. Safely eject the drive after copying. Retain the original Mac installation until the restore is verified.

## Requirements

Install Docker Desktop for Windows using its WSL2 Linux-container backend. Start Docker Desktop. Internet is required to obtain/build the Linux images and use live external data services. Node.js is only required if you want the Vite development server; the normal Docker frontend does not require it.

## Restore into a new, empty installation

Open PowerShell. Replace the paths below with your drive and chosen destination. Avoid a OneDrive folder.

```powershell
$backup = 'E:\SARVA-backup\TIMESTAMP'
$project = 'C:\SARVA'
New-Item -ItemType Directory -Force $project
Get-FileHash "$backup\sarva.dump", "$backup\sarva-project.tar.gz" -Algorithm SHA256
# Compare the hashes with SHA256SUMS.txt before continuing.
tar -xzf "$backup\sarva-project.tar.gz" -C $project
Set-Location $project
docker compose up -d db
docker compose exec -T db sh -c 'until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do sleep 2; done'
docker cp "$backup\sarva.dump" sarva-db:/tmp/sarva.dump
```

The next command replaces the contents of the NEW destination SARVA database. Do not run it against an existing installation you want to keep. Docker's initial database setup may already have created tables; `--clean --if-exists` removes matching objects before restoring.

```powershell
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --exit-on-error /tmp/sarva.dump'
docker compose exec -T db rm /tmp/sarva.dump
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://127.0.0.1:5060/api/health
Start-Process http://127.0.0.1:8090/
```

Expect API health `status: ok` and `db: true`. Verify municipal map layers, catalogue/resources, local data and map tile rendering. Configuration may override the default ports; check the restored `.env` privately. Update any Mac-specific absolute paths for Windows. The forecast worker resumes refreshing forecasts when started.

For frontend development, install Node.js, then run `npm ci` and `npm run dev -- --host 127.0.0.1` from `frontend`; open http://127.0.0.1:5173/. Do not copy Mac node_modules to Windows: dependencies were intentionally excluded and must be installed or built there.

## What is preserved

- Entire current project, including uncommitted/ignored source and local `data`, `.env` configuration and `.git` history.
- A consistent PostgreSQL/PostGIS logical export of the SARVA database at backup time, with schema and table data.
- Database contents listing, service/commit manifest and SHA-256 checksums.

Docker images, node_modules and generated frontend build output are rebuilt. Other applications' databases, external services, files outside this project and transient in-memory FIRMS/GDACS caches are not included. This is a SARVA application backup, not a complete computer backup. A Windows restore must be verified on the destination machine.

## Recommended: restore from Ubuntu under WSL2

Install Ubuntu under WSL2, then enable Docker Desktop → Settings → Resources → WSL Integration for Ubuntu. In the Ubuntu terminal, `docker version` should show both client and server. Use Docker Desktop's engine; a second Docker daemon inside Ubuntu is unnecessary.

Keep the extracted project on WSL's Linux filesystem (`~/sarva`) for better bind-mount and npm performance. Windows drive E: is normally accessible as `/mnt/e`. Replace TIMESTAMP and the drive path below.

```bash
backup='/mnt/e/SARVA-backup/TIMESTAMP'
cd "$backup"
sha256sum -c SHA256SUMS.txt
mkdir -p ~/sarva
# Use a fresh empty destination.
tar -xzf "$backup/sarva-project.tar.gz" -C ~/sarva
cd ~/sarva
chmod 600 .env 2>/dev/null || true
docker compose up -d db
docker compose exec -T db sh -c 'until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do sleep 2; done'
docker cp "$backup/sarva.dump" sarva-db:/tmp/sarva.dump
# Replaces matching database objects: only run against the NEW destination instance.
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --exit-on-error /tmp/sarva.dump'
docker compose exec -T db rm /tmp/sarva.dump
docker compose up -d --build
docker compose ps
curl -f http://127.0.0.1:5060/api/health
```

Open http://localhost:8090/ in your Windows browser. Docker Desktop normally publishes these ports to Windows localhost. To edit files, use VS Code's WSL extension or access `\\wsl.localhost\Ubuntu\home\YOUR_USER\sarva` in Explorer. If developing with Vite, install Node.js inside WSL and run the npm commands inside WSL too; do not mix Windows and Linux node_modules.
