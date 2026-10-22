# SARVA production deployment, 22 October 2026

Status: deployed on the new production host and locally verified over HTTPS;
external access and final acceptance remain pending. Evidence below is from
operator-supplied terminal output, not an independently executed server audit.

Production host: `ULWSARVADSL01` (`ulwsarvadsl01.saeon.ac.za`), internal
IP `192.168.117.189`, external IP `196.24.60.87`. DNS for both
`sarva.saeon.ac.za` and `ds-lab.saeon.ac.za` resolves to the external IP.
Host Nginx loads `/etc/nginx/conf.d/*.conf` from `/etc/nginx/nginx.conf`.
Separate hostname configurations terminate TLS using certificates under
`/opt/certificates/<hostname>/`; both certificates expire 9 May 2027.

**Waiting on Sephy / IT:** external TCP 443 connections time out despite
successful local HTTPS tests, Nginx listening on all IPv4 interfaces and
the host public firewall zone allowing HTTPS. Check upstream firewall,
NAT/forwarding and return routing between `196.24.60.87` and
`192.168.117.189`. Permit TCP 80 for HTTPS redirects as well. The precise
network fault has not been established; external access is not accepted yet.

The production server cannot SSH directly to the development server;
backups were transferred through local WSL. GitHub SSH ports 22/443 failed;
Git HTTPS works using the operator's GitHub CLI authentication. No tokens,
passwords or private keys belong in this handover or Git.

## Deployed configuration and data

- Checkout `/opt/sarva`, reviewed main commit `0c2b060` (PR #5 merged).
- Compose application project `sarva`; database volume `sarva_sarva_db_data`.
- Development backup `~/sarva-backups/production-transfer-20261022-113122`
  contains a readable custom-format database dump and configuration/data archive.
  Production transfer is under `~/sarva-transfer/production-transfer-20261022-113122`.
- Restored database with no ownership/ACL restoration, one transaction and
  exit-on-error. Runtime spatial data copied from the archive. Migrations passed.
- Root-owned private `/opt/sarva/.env` contains fresh database password and
  AUTH_SECRET; existing external API settings retained. Frontend DS Lab link is
  `https://ds-lab.saeon.ac.za/ds-lab/`.
- Backend, frontend and forecast worker images built sequentially on production.
  Backend, database and Martin report healthy; frontend and preview services run.
- Loopback only: backend 5060, frontend 8090, database 5440, Martin 3010,
  preview gateway 5180. Do not expose these as public authentication bypasses.
- New server file `preview/compose.production.yml` runs project
  `sarva-preview-access`, connected to `sarva_default`. HTTPS-only allowed origin
  is `https://sarva.saeon.ac.za`; PREVIEW_LOCAL_HTTP is false. A new full-length
  preview password was entered interactively; its hash is private under
  `.local/preview-access/auth`. Internal HTTP compose is not the production entry.
- `/etc/nginx/conf.d/sarva.conf` redirects HTTP to HTTPS and proxies HTTPS
  through `127.0.0.1:5180`, preserving the preview gate.

## Verified and pending

Nginx syntax passed. Local HTTPS tests with hostname resolution overridden to
loopback and normal certificate validation returned login 200 and anonymous API
401. Direct frontend API returned 200. These checks do not certify public login.

Forecast worker started, running with zero restarts. Logs are buffered. At
10:21 UTC on 22 October the latest database success was 08:46 UTC (10:46 SAST),
which may be restored development history. The five-hour schedule should next
check around 13:46 UTC / 15:46 SAST. A fresh production success is still required.

Remaining: resolve external access with IT; verify HTTPS preview sign-in/logout,
SARVA user/admin login, municipal maps/tiles, catalogue connectivity/sync, FIRMS,
GDACS, forecasts, analytics and Data Health from production. Recheck forwarded
scheme handling across host Nginx, preview and frontend proxies, plus scan the
actual production images. Review timers, backups and restore ownership. Final
write-freeze/data reconciliation is pending; production and development writes
are not automatically synchronized. Do not blindly overwrite post-restore writes.

Retain development server, source backups and old WordPress site until accepted
switchover. Do not prune volumes or declare migration complete. Keep essential
variable feature work outside this release. Server-only preview/host-Nginx files
are described here; they have not yet been incorporated as reusable source
configuration by this documentation update.
