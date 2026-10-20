# Analytics release and deployment

## Source and local preview

The maintained checkout is `C:\Users\Marc\Documents\SAEON\SAEON_GitHub\sarva`.
In WSL this is `/mnt/c/Users/Marc/Documents/SAEON/SAEON_GitHub/sarva`.
The original Docker stack uses `/home/private/sarva`, so rebuilding there does
not include edits made in the Windows checkout. The local analytics preview
mounts the Windows checkout: http://localhost:5174/analytics. Its backend is
`sarva-analytics-api`. It shares the original local development database.

Read CONTRIBUTING.md before making changes. Work on a feature branch, stage
source files explicitly, and exclude `.env`, credentials, database dumps,
`node_modules`, build output, `.DS_Store` and `._*` metadata.

## Verification

Build the frontend and lint the changed source using its ESLint configuration.
Run `backend/scripts/check-analytics.js` only against the local development DB;
it applies idempotent migrations 055 and 056 and verifies access and queries.
Sign in with an active SARVA administrator at /analytics; the Analytics link
appears in the primary navigation. Anonymous and non-admin accounts have no
access to the report. Honour Do Not Track and Global Privacy Control.

The analytics database starts collecting new page/API events after deployment;
it does not reconstruct historical page traffic. Existing catalogue searches
remain available. Local/private IP addresses have no inferred geographic
location. Review explicit proxy trust configuration before enabling public
visitor geography; never trust arbitrary forwarded headers.

## GitHub and server release

1. Push the feature branch and review its diff against current origin/main.
2. Merge the reviewed feature into main through GitHub.
3. Connect using `ssh marc@192.168.115.77` and `cd /opt/sarva`.
4. Check `git status --short`. Preserve any intentional server-local changes;
   do not use --allow-dirty to skip an unexplained difference.
5. Make a database backup before the migration:

```bash
set -o pipefail
mkdir -p backups/releases
backup_file="backups/releases/before-analytics-$(date +%Y%m%d-%H%M%S).dump"
sudo docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"
test -s "$backup_file"
```

Stop if the backup fails. Then preview and deploy:

```bash
bash deploy/server-update.sh --check-only
bash deploy/server-update.sh
```

The update script pulls main, builds backend/frontend, applies migrations and
starts services. This release needs migrations 055 and 056, no new analytics
API key, and no boundary/topography reimport flags. Retain the existing server
.env, including FIRMS_MAP_KEY. Do not copy the local database or .env to live.

## Verify on the server

```bash
sudo docker compose ps
curl -fsS http://127.0.0.1:8090/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8090/api/analytics/summary
curl -fsSI http://127.0.0.1/ | grep -i cache-control
```

An unauthenticated summary request must return 403. HTML should return
Cache-Control: no-cache through the host Nginx. Open the live site, visit a
public page, then sign in as an admin and check /analytics. Verify counters,
municipal map layers and the CSV export. Browser privacy signals can suppress
client events. The host Nginx proxy remains pointed at 127.0.0.1:8090.

Catalogue sync connectivity is separate: the last diagnosed connection from
192.168.115.77 to catalogue.saeon.ac.za:443 timed out before TLS. Analytics
can display cached catalogue coverage without a successful current sync.

Do not prune until deployment and browser verification succeed. If cleanup is
needed, inspect with `bash deploy/docker-prune-preview.sh` before running
`bash deploy/docker-prune.sh --yes`. Never remove database volumes for a release.
