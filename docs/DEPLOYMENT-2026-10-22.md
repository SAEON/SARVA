# SARVA production deployment, 22 October 2026

Latest catalogue update (27 October 2026): production connectivity is fixed and
all 5,096 records refreshed successfully. See the catalogue recovery record below;
it supersedes earlier catalogue connectivity/sync blockers in this historical log.

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

- Checkout `/opt/sarva`; current application release `665d203` (PR #7).
  Initial deployment used `0c2b060` (PR #5).
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

## Preview layout follow-up, 23 October 2026

Release `34db7be` (PR #6) is deployed. Operator confirmed the preview control
is bottom-right, SARVA Login works and DS Lab still works. Rollback/configuration
backup is `~/sarva-backups/before-preview-layout-20261023-152858`; retain its
tagged prior frontend image. Preview credentials and server-specific production
Compose were preserved. See [layout acceptance](PREVIEW-LOGIN-LAYOUT-FIX.md).
Older-image cleanup is complete per operator confirmation on 23 October;
everything is reported working afterwards. The instructed scope was dangling
images older than 24 hours, preserving tagged rollback images and backups. No
prune transcript or reclaimed-space figures were supplied. Catalogue connectivity and final migration/network
acceptance remain separate from this UI fix.

## Development banner and disclaimer deployed, 23 October 2026

Release `665d203` (PR #7) is deployed. The operator confirmed both sites look
good and SARVA dev preview login still works after the frontend update and
preview-gateway refresh. Banner, shared disclaimer including SAEON responsibility
wording, and dynamic header offsets are included. DS Lab's notice/header release
`66f271c` was deployed and accepted first. Both frontends had rollback images
and configuration saved beforehand. No database or preview credential change
was part of the instructed update. Preserve this release's rollback assets;
post-release cleanup is now confirmed in the follow-up below.
See [notices acceptance](DEVELOPMENT-NOTICES.md). Catalogue/network issues remain
separate; actual new image IDs and final terminal transcripts were not supplied.

## Notice-release cleanup confirmed, 23 October 2026

Operator confirmed cleanup completed, all instructed runtime/smoke and SARVA
preview checks passed, and both sites still work. Cleanup instructions were
limited to eligible dangling images older than 24 hours, preserving tagged
rollback images and backup records. No containers or database volumes were
included. No reclaimed-space total or detailed prune transcript was supplied.
See [post-release cleanup record](DEVELOPMENT-NOTICES.md). Catalogue connectivity
and previously pending migration/network items are not closed by this cleanup.


## Analytics audience explorer rollout, 26 October 2026

Operator approved publication, production deployment and subsequent safe image
cleanup. Local acceptance: 30 backend tests, 3 frontend tests, ESLint, Docker
builds, synthetic browser map/device/user tracking checks and existing preview/
DS Lab smoke checks passed. See ANALYTICS-AUDIENCE-EXPLORER.md.

Status: production execution and acceptance pending. Back up database, private
configuration and current backend/frontend images before pulling. Apply migration
057 before starting the new backend/frontend. Preserve preview/compose.production.yml,
preview credentials and trusted proxy CIDRs. Refresh frontend and preview gateway
Nginx resolution after recreation. Check authenticated analytics, preview login,
anonymous API protection and DS Lab before any image deletion. Preserve tagged
rollback images, backups and all container-used images; never prune volumes.


## Catalogue connection fixed and production refresh verified, 27 October 2026

IT supplied a successful HTTPS GraphQL POST using the catalogue's internal address
192.168.117.57. The operator then tested from the running SARVA backend container
on ULWSARVADSL01 using its configured endpoint, normal certificate validation and
the application's Node fetch runtime. HTTP 200 returned
{"data":{"__typename":"Query"}}. The production hostname remains
https://catalogue.saeon.ac.za/graphql; forcing the public IP is not required.

The operator's direct frontend /api/catalogue/status response confirmed:

- Latest sync run ID: 141, status success, no error_message.
- Started: 2026-10-27 11:33:32.684 UTC / 13:33:32.684 SAST.
- Finished: 2026-10-27 11:34:37.239 UTC / 13:34:37.239 SAST.
- total_count = processed_count = cached records = live totalCount = 5,096.
- Cached keywords: 53,487; cached creators: 8,042.
- live.available = true for the configured GraphQL endpoint.

The earlier connection timeout and catalogue refresh blocker are resolved for
SARVA production. A successful complete refresh had already finished, so no
additional manual refresh was necessary. No certificate bypass or forced public-IP
hosts entry was used in this verification. This records supplied production
terminal evidence; it is not an independently executed remote audit and does not
guarantee future scheduled runs or other external data feeds.

DS Lab's own catalogue integration is a separate check and remains pending its
production container/source/status evidence. Do not infer a DS Lab refresh solely
from SARVA's successful run or assume its dataset-only directory must contain all
5,096 catalogue record types.


## Issues and feedback deployed and accepted, 27 October 2026

PR #17 merged as 3ee417f. The operator applied migrations 062–064 and recreated
SARVA backend/frontend after saving the rollback at
/home/marc/sarva-backups/before-feedback-20261027-152120.
Production checks passed: Nginx valid; SARVA home/API 200; anonymous review API
401 and users/analytics APIs 403; DS Lab home 200. Browser acceptance confirms
Issues & feedback, assignment and resolution work, and normal SARVA login and
DS Lab remain working. See [acceptance and rollback details](ISSUES-FEEDBACK-MANAGEMENT.md).
Cleanup of older SARVA backend/frontend rollback tags is authorized but pending;
retain the latest rollback-feedback-20261027-152120 pair and current images.
No DS Lab deployment or host Nginx change was part of this release.
