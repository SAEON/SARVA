# SARVA production deployment, 22 October 2026

## Staged frontend and deployment ribbon acceptance 28 October 2026

Operator confirmed the ribbon rollout and all requested checks worked: live switch, notice-on visibility and notice-off disappearance, normal password/passkey login and DS Lab. PR #31 introduced the ribbon (merge 3edac8726ad1e775ad6071fe783adb7d87d31ac1); PR #32 and #33 corrected rollback preservation/recovery. Current release includes PR #28 Explore/menu changes and PR #29 direct Explore link. Acceptance is operator-reported, not an independent production audit.

Active frontend is now blue sarva-frontend on loopback 8090; green sarva-frontend-green on 8091 is retained as previous slot. Host Nginx changed only its SARVA proxy port with validation/graceful reload. The latest prepare record was /var/backups/sarva-frontend-bluegreen/20261028-085912; rollback tag sarva-frontend:rollback-bluegreen-20261028-085912; blue candidate ID e802d46f5c2409e170cbb9b368b2d5d05567bb3335ebfd9f237ae1cc49b2bacd. Consult script status and current config before later operations; slot roles alternate.

Preparation initially failed because the active green container referenced an unavailable image record; Docker tag and commit failed. Both containers and live SARVA stayed running and SARVA/DS Lab returned 200. Root cause of the missing image record was not established. Operator saved and verified /home/marc/sarva-backups/frontend-files-20261028-105317 and built sarva-frontend:rollback-recovered-20261028-105317 (image b18f74ad373d1a8bb861c25149a9edfafbf7058c0c9352f4814e308535648aef) from a known available runtime plus saved live files. Recovery image nginx validation and file-by-file comparison with the active frontend passed. It is a reconstructed static frontend backup, not an original image replica. No Docker daemon restart or production data deletion was performed.

Future frontend releases must use script build, prepare, switch and status rather than directly replacing the active Compose frontend. Build preserves the active image first; the ribbon marker is enabled for build/prepare and cleared afterward, with 45-minute expiry and manual notice-on/off. No fixed staging preview port or separate staging database was installed. Both slots share production backend/data; passkeys must be tested on the public origin. Backend, database, authentication/session settings and DS Lab configuration were unchanged by the rollout.

**Cleanup is on hold.** Retain both frontend containers, the current/previous images, verified recovered rollback image, latest blue-green rollback and all file/config backups. The prior green slot lacks the ribbon; it remains a working-site rollback but will not display the ribbon if restored. Do not use older broad rollback-tag cleanup commands or --remove-orphans. Additional housekeeping and any later slot refresh require a separate verified operation.

## Municipal Planning Workspace removal production acceptance 28 October 2026

PR #27 (merge `14e56f6f10a17c0a1f6af7b8d8c5750276dd9ed8`) is deployed and operator-accepted. The Municipal Planning Workspace is removed from navigation and Explore entry points; its former URL redirects to Explore. Municipal Risk Profiler and the standalone boundary viewer remain available. No municipal data, historical analytics or saved browser drafts were deleted.

The operator confirmed all deployment checks passed, the workspace is gone, password and passkey browser login both work, and DS Lab still works. Deployment verification covered navigation API exclusion, remaining tool routes, site/health/privacy routes, protected anonymous endpoint responses and passkeys enabled. Only SARVA backend/frontend were rebuilt/recreated; no database migration or authentication/session setting change was needed.

Cleanup is **complete**, confirmed by the operator on 28 October 2026. The operator verified the latest before-workspace-removal backup manifest and retained the matching backend/frontend rollback-workspace-removal pair plus current running images while removing older SARVA rollback tags. The exact backup timestamp was not included in the supplied confirmation; use the verified server-side rollback-images.txt manifest for recovery. All post-cleanup checks passed, the workspace remains removed, password and passkey browser login work, and DS Lab still works. Preserve all databases, volumes, backups, build cache and DS Lab images/services. Evidence is operator terminal/browser acceptance, not an independent server audit.

## Compact forecast cards production acceptance 28 October 2026

PR #26 (merge `f5b54b598dcd7272d16e841d1ce28e5c9fbd0915`) is deployed and operator-accepted. Selected location weather outlook is separated from Highest modelled values; places and dates are prominent and the independent locations/dates are explained. Compact layout retains a shared experimental warning and official SAWS link. Visible ECMWF Open Data (IFS 0.25°) source link, copyright and CC BY 4.0 credit remain; individual cards include short ECMWF/SARVA credits, distinguishing the SARVA-derived fire-weather index.

The operator confirmed all deployment checks passed, compact cards and attribution look good, password and passkey browser login both work, and DS Lab still works. Only the SARVA frontend was rebuilt/recreated; backend, forecast calculations, authentication/session settings and DS Lab were unchanged. No migration was needed.

Backup: `/home/marc/sarva-backups/before-compact-forecasts-20261028-084240`. Cleanup is **complete**, verified by operator terminal output on 28 October 2026. The older frontend tag `sarva-frontend:rollback-privacy-simplification-20261028-081412` was removed; `sarva-frontend:rollback-compact-forecasts-20261028-084240` and running images were retained. Latest backend rollback `sarva-backend:rollback-combined-weather-20261027-210825` was outside the removal scope and preserved. Post-cleanup Nginx validation passed; SARVA homepage, health, privacy and passkey page returned 200, anonymous passkey/review endpoints returned 401, anonymous admin/analytics endpoints returned 403, and DS Lab returned 200. Password/passkey browser sign-in and compact cards/ECMWF attribution were accepted before cleanup; no authentication settings changed. Preserve all database volumes, backups, build cache and DS Lab images/services. This is operator-reported production acceptance, not an independent server audit.

## Simplified privacy notice production acceptance 28 October 2026

PR #25 (merge `ca1fdad6f963c3838cb57c01feb71b61ea78758f`) is deployed and operator-accepted. The notice uses short sections with expandable details, retains accurate account/passkey and account-linked analytics disclosures, and adds the SAEON Catalogue general enquiry contact. How we use analytics precedes the collapsed Manage your analytics preference control. Tracking defaults, opt-out behavior and the review-in-progress status are unchanged.

The operator confirmed all deployment checks passed, the privacy notice looks good, password and passkey browser login both work, and DS Lab still works. Only SARVA frontend was rebuilt/recreated. No migration, backend deployment, authentication/session configuration change or DS Lab update was required. The earlier live assignment error was subsequently reported working by the operator; no assignment code fix was included in this release.

Rollback backup: `/home/marc/sarva-backups/before-privacy-simplification-20261028-081412`. Frontend rollback cleanup is **complete**, confirmed by the operator on 28 October 2026. The latest frontend rollback `sarva-frontend:rollback-privacy-simplification-20261028-081412` and current running images were retained. The backend rollback `sarva-backend:rollback-combined-weather-20261027-210825` was outside the removal scope and preserved. The operator confirmed all post-cleanup checks passed and the privacy notice, password login, passkey login and DS Lab remain working. Preserve databases, volumes, backups, build cache and DS Lab images/services. This acceptance is based on operator checks and browser confirmation, not an independent production audit.

## Combined risk weather summary production acceptance 27 October 2026

PR #24 (merge `18e4c27eb565954f5ace97d6ab8f0bf979581475`) is deployed and operator-accepted. The main card is titled Combined risk and shows maximum temperature, daily rainfall and maximum wind speed together for one selected forecast location/date, without a combined numerical score. Forecast date and refresh time are separate. The experimental notice and official SAWS link remain. This supersedes the main-signal-only presentation of PR #23. Internal screening still selects the location; this is not a national summary or a newly validated risk assessment.

Operator terminal output verified Mnquma EC, forecast 27 October 2026: maximum temperature 16.8 °C, rainfall 73.2 mm/day, maximum wind 21.7 km/h, data refreshed 27 October 19:39 SAST. The combined summary and passkeys-enabled checks passed. Nginx validation succeeded; public homepage, health, privacy and passkey page returned 200, anonymous passkey listing returned 401, anonymous administration/analytics returned 403, and DS Lab returned 200. The initial frontend startup connection reset was followed by successful readiness checks.

The operator confirmed the card looks good, both password and passkey browser login work, and DS Lab still works. Only SARVA backend/frontend were updated; no migration or authentication setting changes. Rollback backup: `/home/marc/sarva-backups/before-combined-weather-20261027-210825`. **Cleanup is complete**, confirmed by the operator on 27 October 2026. Older SARVA rollback tags were cleaned up while retaining `sarva-backend:rollback-combined-weather-20261027-210825`, `sarva-frontend:rollback-combined-weather-20261027-210825` and current running images. The operator confirmed all post-cleanup checks passed and the Combined risk card, password login, passkey login and DS Lab remain working. Database volumes, backup files, build cache and DS Lab images/services were outside the cleanup scope and preserved. Do not restart the retired preview gateway. This is operator-reported acceptance, not an independently executed production audit.

## Privacy notice production acceptance 27 October 2026

PR #21 (merge `4ac19d1e6ba2f9693e85d3b99a225c11bfb1033e`) is deployed and operator-accepted. The homepage banner, introduction and footer expose the public /privacy notice and browser analytics choices. Registration, login, passkey setup and feedback also link to the notice. The notice remains explicitly under review; publication does not constitute final legal approval or confirmation of retention rules.

The operator confirmed all deployment checks passed, the privacy notice looks good, normal password and passkey login both work, and DS Lab still works. Checks included public privacy/site/health responses, protected anonymous endpoint responses, passkeys enabled, and DNT/GPC analytics requests returning 204. Only SARVA backend/frontend were updated; no schema migration, authentication setting change or DS Lab update was required.

Rollback backup: `/home/marc/sarva-backups/before-privacy-20261027-173036`. Cleanup of older SARVA rollback tags is **complete**, confirmed by operator terminal output on 27 October 2026. The latest pair `sarva-backend:rollback-privacy-20261027-173036` and `sarva-frontend:rollback-privacy-20261027-173036` and running images were retained. Post-cleanup Nginx validation passed; SARVA homepage, privacy, health and passkey page returned 200, anonymous passkey/review endpoints returned 401, anonymous admin/analytics endpoints returned 403, and DS Lab returned 200. Password and passkey browser login had already been operator-accepted before cleanup. Build cache was not pruned. Preserve all database volumes, backups and DS Lab images/services. Do not restart the retired preview gateway. Acceptance is operator-reported terminal and browser verification, not an independently executed production audit.

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


## Public issue assignment compatibility accepted, 28 October 2026

PRs #34 and #35 hardened assignment error responses and changed the current frontend to POST, preserving the same admin checks, conflict protection, audit history and legacy PATCH route. The operator confirmed assignment now works from a Mac outside VPN after the staged frontend rollout to 8090. The earlier public PATCH response was HTML 403; the precise filtering rule remains unconfirmed. No schema migration or DS Lab changes. Cleanup is pending and both frontend slots plus all recovery images must be retained. See [assignment evidence and acceptance limits](ISSUE-ASSIGNMENT-HARDENING.md).


## Homepage Get Involved links accepted, 28 October 2026

PR #37 merged as 7b8fb22d49dcbd2292c8c9eb395c93b0692e9ec8. Contribute Data now uses the shared Submit Data menu URL, Training & Capacity Building uses the configured DS Lab URL, and Join a Community was removed. Frontend lint, Docker build and privacy regression tests passed locally.

The production replacement was prepared on 8090 while 8091 remained active. Backup: /var/backups/sarva-frontend-bluegreen/20261028-104232; rollback tag: sarva-frontend:rollback-bluegreen-20261028-104232; candidate: 5971577c81d58cc9389e0b28702fb47fda15e06429d69ef394b89882d1d25ae4. The operator subsequently confirmed the live links work after the switch instructions. Backend, database and DS Lab containers were not redeployed.

The operator confirmed completion of the supplied dangling-image cleanup and site-check procedure. Both frontend slots, tagged rollback/recovery images, backups and volumes were retained. No broad image or volume pruning or Docker restart was requested. Password/passkey browser testing was not separately reconfirmed for this frontend-only release.


## Automatic frontend refresh deployed, 28 October 2026

PR #39 is deployed through the staged frontend workflow; the operator confirmed the supplied switch/check procedure completed. Pages with the new watcher can automatically reload a later version when idle, protecting changed forms and busy submissions. Older open pages need one refresh/navigation. Full live automatic-refresh verification remains pending the next version change. See [deployment and rollback details](AUTOMATIC-FRONTEND-UPDATES.md). Latest frontend rollback: sarva-frontend:rollback-bluegreen-20261028-110655. Cleanup is complete; backend, database and DS Lab were not redeployed. The retained SARVA rollback pair is sarva-frontend:rollback-bluegreen-20261028-110655 and sarva-backend:rollback-create-assignment-20261028-122306. Older frontend rollback tags, five unreferenced legacy DS Lab images and three older SARVA backend rollback images were removed after verification. Both frontend slots, backup files, database volumes and DS Lab production/backup images remain. Supplied output confirms Nginx validation and SARVA/DS Lab HTTP 200. Final image storage: 5.713 GB across 27 images; build cache was not pruned.


## Analytics HTTP 400 fix accepted, 28 October 2026

PR #40 is deployed: known Issues & feedback and account paths are accepted by analytics, and the frontend skips unsupported page paths. The operator confirmed the fix works after the staged deployment to 8091. No schema migration or DS Lab deployment. Latest frontend rollback: sarva-frontend:rollback-bluegreen-20261028-114842. Cleanup is complete and the operator confirmed all supplied checks passed, with SARVA and DS Lab still working. Latest rollback pair retained: sarva-frontend:rollback-bluegreen-20261028-114842 and sarva-backend:rollback-analytics-pages-20261028-134606. Both frontend slots, backup files and database volumes were retained; build cache was not pruned. See [analytics validation and acceptance details](ANALYTICS-PAGE-VALIDATION.md).


## Resources newest-first ordering accepted, 28 October 2026

PR #41 merged as 6ae07710233a0879be6b1493ac768bab2fa3da91. Resources requests publication-year descending order; backend sorting treats blank/unknown/invalid year labels as null so they appear last, with ordering applied before pagination. No schema migration or authentication configuration changes.

The operator built backend/frontend, updated the backend, refreshed both frontend proxies, prepared on 8090 and switched from 8091. Backup: /var/backups/sarva-frontend-bluegreen/20261028-122426; rollback: sarva-frontend:rollback-bluegreen-20261028-122426; candidate: 8fdaa5c8af77bf71404d8977a7602caa4f22b337f623fc6924a0963beba70b84. Supplied output confirms Nginx validation; SARVA home/resources/health/version/passkey page and DS Lab HTTP 200; protected anonymous auth/review APIs 401 and users API 403. After browser-test instructions, the operator confirmed all working, including report order, pagination/filters and password/passkey login checks. DS Lab containers were not redeployed.

Cleanup is authorized but pending verification of the pre-release backend rollback and latest frontend rollback. Keep both frontend slots, backup files, database volumes and DS Lab images. Automatic frontend reload across versions was not separately confirmed.


## Community menu and contact deployed, 28 October 2026

PR #42 merged as 78589327b914b791bfec2bd01c2b2152607bf65b. Community now contains only Data Science Lab and Contact SARVA, for API/cached and fallback navigation alike. DS Lab opens the configured lab URL; /contact recommends registration/sign-in then the user icon → Issues & feedback, with datascience@saeon.nrf.ac.za as an alternative contact. Other Community items and duplicate Communities of Practice were removed. The contribution form remains in the Data menu.

The replacement frontend was prepared on 8091 while 8090 remained live, then switched. Backup: /var/backups/sarva-frontend-bluegreen/20261028-123730; rollback: sarva-frontend:rollback-bluegreen-20261028-123730; candidate: 8bffe086ce730d6477dd6ff4cfc167b5cfc96232fbbd57ec540aac56f82cb1a3. The operator supplied successful switch checks, including protected review/users API denial and DS Lab HTTP 200, and subsequently requested resolution/cleanup. No separate password/passkey browser result was provided for this frontend-only change. Backend, database and DS Lab were not redeployed.

Cleanup is authorized but pending verification of the newest rollback image. Keep both frontend slots, the latest frontend and backend rollback images, all backup files, DS Lab images and database volumes. The resource-order release backend rollback must also remain available.
