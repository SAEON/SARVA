# Production readiness and handover

Prepared 21 October 2026. Status: preparation only; no production deployment completed.

IT has confirmed that 192.168.115.77 is a development address and cannot be used for the requested external mapping. No deployment SOP or production destination has been supplied. Confirm the production host, DNS name, TLS certificate, deployment owner, network access and backup/restore responsibilities with IT before cutover.

## Release scope

Base this release on reviewed GitHub main. Keep feature/essential-variable-review separate until its UI and administration workflow have been accepted. Local uncommitted development is not part of this release.

This cleanup removes backend/.env and sarva-local.dump from the current tracked tree. They remain in earlier Git history. Treat any credentials in historical environment files as exposed and rotate them. Assess the historical database dump for sensitive data with the repository owner; removing historical objects requires a separately coordinated history cleanup. Do not copy development credentials into production.

## Required before deployment

- Supply unique database credentials, AUTH_SECRET and external API keys using protected server configuration. The Compose file has development fallbacks; explicitly configure production values. Changing POSTGRES_PASSWORD alone does not change an existing database role password.
- Back up the database and required runtime data, including downloaded spatial data, and verify a restore in an isolated environment. Git alone is not a content/data backup.
- Retain loopback bindings for the frontend, backend, database and Martin. Expose only the approved host reverse proxy over HTTPS. If the preview gate is required, proxy SARVA through it and verify direct access cannot bypass it. Keep DS Lab routing under separate ownership/configuration review.
- Preserve external API configuration (including FIRMS), catalogue connectivity, forecast worker settings, timers and spatial imports. Test from the production network. Earlier development catalogue sync failed connecting to 192.168.117.57:443; this requires a connectivity check, not just a longer application timeout.
- Build from the approved commit using Dockerfiles and lockfiles. Do not deploy development Vite containers or source bind mounts. Capture commit and image IDs and scan built images with the organisation's approved tooling.

## Deployment and acceptance

After IT supplies the target and the approved release is merged, use deploy/server-update.sh --check-only, review its output, then run the update script from the clean checkout. First deployment also requires database restoration/imports described in DOCKER_DEPLOYMENT.md; the update script does not migrate the old host's data automatically. Record a database backup before running migrations. Reverting an image does not undo a migration.

Verify through the final hostname: preview login if enabled, regular login and administrator access, catalogue search and sync status, municipal profiles and vector tiles, FIRMS, GDACS, forecast freshness, analytics and data health. Confirm scheduled jobs and backups. Preserve logs and identify any degraded external sources explicitly.

Record the deployed commit, image IDs, migration state, backup reference, verification results and rollback owner. Retain the previous release images until acceptance. Only then use deploy/docker-prune-preview.sh and the scoped prune procedure; never prune database volumes or other applications on the shared server.

## Pending evidence

Production host and hostname, TLS, credentials rotation, historical dump assessment, image scan, backup restore test, runtime checks and cutover approval are not yet verified. Docker became available after Docker Desktop was started; see the follow-up audit below. This document is a checklist, not a claim of production readiness.

## Local runtime follow-up, 21 October 2026

Docker Desktop is reachable. Recreating Martin and the local preview gateway refreshed stale Docker Desktop file mounts; the source files already existed. Restarted the local analytics API/web and frontend. HTTP 200 verified at ports 5174 (data health page), 5061 and 8090 (API health), 8090/tiles/catalog, and 5180/__preview/login. Database, backend and Martin are healthy. No database volumes were removed and no server was changed.

The older local stack is based in /home/private/sarva, whereas the review frontend/API use the Windows Git checkout. It is not a production-candidate image validation. The older local backend reports development AUTH_SECRET and database password defaults (values not copied into this report). FIRMS is configured. Its frontend binds 8090 on all interfaces; the reviewed main Compose source uses loopback. Runtime drift must be checked on the target server separately.

Backend lockfile audit of this release branch reported 7 production dependency findings: 1 critical, 2 high, 3 moderate and 1 low. Affected packages: proxy-addr, path-to-regexp, ip-address, geoip-lite, qs, sprintf-js and body-parser. npm proposes a direct geoip-lite version change for part of the chain; do not use an unreviewed forced downgrade. Resolve dependencies, test analytics/IP handling and API routes, then repeat the audit and build fresh release images. This is an npm advisory audit, not an operating-system/image scan or proof of exploitability.
