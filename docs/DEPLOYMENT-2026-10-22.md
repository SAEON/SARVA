# SARVA production deployment, 22 October 2026

## Forecast wording production acceptance 27 October 2026

PR #20 (merge `7abeffb346a46f53d103d4ac0ad02b647dc9b44a`) is deployed and operator-accepted. Main-page highlights, forecast maps/popups, planning context and forecast API metadata identify SARVA outputs as experimental model interpretations, not official warnings. Model-value headlines replace warning-like severity descriptions; notices link to SAWS, explain rainfall/flood and fire-danger limitations, and include ECMWF source/licence information. Numeric model outputs and calculations are unchanged.

The operator confirmed all deployment checks passed, the forecast wording looks good, normal password and passkey login work, and DS Lab still works. Terminal verification included public site/health checks, protected endpoint responses, experimental forecast metadata, homepage highlights and passkeys enabled. Only SARVA backend/frontend were recreated; no migration, forecast refresh or authentication setting changes were needed.

Rollback saved at `/home/marc/sarva-backups/before-forecast-wording-20261027-165810`. Retain current running images and the latest pair `sarva-backend:rollback-forecast-wording-20261027-165810` and `sarva-frontend:rollback-forecast-wording-20261027-165810`. Cleanup of older SARVA rollback tags is **complete**, confirmed by the operator on 27 October 2026. All post-cleanup checks passed; normal SARVA password login, passkey login and DS Lab remain working. Current running images and the latest forecast rollback pair were retained. Preserve database volumes, backup files and DS Lab services/images. Do not restart the retired preview gateway.

This acceptance is based on operator-supplied terminal results and browser confirmation. Scientific validation of the derived indices and any legal approval are separate from this presentation change.

## Latest production acceptance 27 October 2026

The operator confirmed PR #19 (merge `325e3ba271f074deb174f08f597e61a4c1131218`) is deployed. Public municipal outputs exclude synthetic test inputs; missing scores remain null and report insufficient verified data. The public profiler uses the simpler raw-source map and tables, and the downloaded source PDF excludes composite scores and forecasts. The operator confirmed that the simpler view and PDF look correct, normal SARVA password and passkey sign-in both work, and DS Lab still works.

Deployment terminal checks passed: SARVA homepage, health, profiler and account/passkeys returned 200; anonymous passkey listing and review returned 401; anonymous user management and analytics returned 403; DS Lab returned 200; passkeys are enabled; the public municipality profile excludes synthetic inputs and unsupported scores. Only backend/frontend were updated; no migration, seed deletion, volume recreation or authentication setting changes were required.

Rollback backup: `/home/marc/sarva-backups/before-profiler-20261027-163143`, including readable database dump, private configuration, Nginx configuration, commit and rollback-image manifest. Retain `sarva-backend:rollback-profiler-20261027-163143` and `sarva-frontend:rollback-profiler-20261027-163143` alongside the images used by running containers. Cleanup of older SARVA rollback tags is **complete**, confirmed by the operator on 27 October 2026. All post-cleanup checks passed; SARVA password login, passkey login and DS Lab remain working. The latest rollback pair and running images were retained. Keep all database volumes and backup files, and leave DS Lab images and services untouched.

This current acceptance supersedes historical preview-gate and initial access-pending descriptions below. SARVA is publicly served directly through frontend port 8090; do not restart the retired preview gateway. Historical entries remain as the deployment record. Evidence is operator-supplied terminal output and browser acceptance, not an independent production audit.

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
Cleanup of older SARVA backend/frontend rollback tags is complete. The operator
confirmed the latest rollback-feedback-20261027-152120 pair and current images
were retained, Nginx validation passed, SARVA home/API and DS Lab returned 200,
and anonymous issue/users/analytics access remained correctly denied (401/403).
Backup files and database volumes were preserved; build cache was not pruned.
No DS Lab deployment or host Nginx change was part of this release.


## Passkey sign-in deployed and accepted, 27 October 2026

PR #18 merged as 04a731e. Migration 065 applied after the operator saved
/home/marc/sarva-backups/before-passkeys-20261027-155549 and tagged the current
backend/frontend images for rollback. Only SARVA backend/frontend were recreated.
Nginx validation passed, SARVA home/API/account page and DS Lab returned 200,
passkey status was enabled, and protected anonymous requests returned 401/403.
The operator confirmed both live passkey and normal password login work, with
DS Lab still working. Passkey sessions are 30 days; password sessions stay 12
hours. See [passkey acceptance](SARVA-ACCOUNT-PASSKEYS.md).
Older rollback cleanup is authorized but pending. Retain the current images and
the rollback-passkeys-20261027-155549 backend/frontend pair; preserve backups,
DS Lab images and database volumes.
