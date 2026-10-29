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

Cleanup completed with supplied production evidence. Older/duplicate frontend rollback tags were removed without force; sarva-frontend:rollback-bluegreen-20261028-123730 was verified and retained. Both frontend slots and backend remained running; backend rollback images, backup files, DS Lab images and volumes were untouched. Nginx validation passed and SARVA/DS Lab both returned HTTP 200. Final Docker report: 28 images (19 active), image storage 5.718 GB, five volumes all active; build cache 14.61 GB remained unpruned. The resource-order backend rollback remains retained; no new password/passkey browser result is inferred from these HTTP checks.


## Monitoring navigation and Overview accepted, 28 October 2026

PR #43 merged as 1bc09cdddfac1eaaed764b21ba772d75b29d21bb. Updates & Monitoring now expands in place and links update titles to source URLs. The Explore weather-model question was removed, and legacy /overview redirects to /#risk-map without displaying health JSON. The /api/health endpoint remains intact.

The operator prepared on 8090 while live stayed on 8091, then confirmed all working after switch and browser checks, including monitoring expansion/source links, Overview browser redirect, removed Explore question and login/DS Lab checks. Backup: /var/backups/sarva-frontend-bluegreen/20261028-130531; rollback: sarva-frontend:rollback-bluegreen-20261028-130531; candidate: 7ee8f63ad0db6f9d394b7e6ef9a19d895380cbd6dfd08eb2867f15d7a1f786d3. Frontend-only rollout; backend, database and DS Lab were not redeployed.

Cleanup completed, confirmed by operator output. Removed duplicate/older frontend tags rollback-bluegreen-20261028-130506 and rollback-bluegreen-20261028-123730; retained sarva-frontend:rollback-bluegreen-20261028-130531 after verifying it against the previous frontend slot. The supplied cleanup procedure completed its site checks; DS Lab HTTP 200 and retained rollback were explicitly shown in the final excerpt. Backend rollback images, both frontend containers, backup files, database volumes and DS Lab images were untouched. Docker reports 28 images (19 active), image storage 5.718 GB, five volumes all active; build cache 14.62 GB remained unpruned.


## Header search sizing accepted, 28 October 2026

PR #44 merged as bd036165d759a60bc5bcf24fe7cc86e7b9b74ccc. Desktop navigation has its own row so it cannot squeeze the search field; the input fills available space with a fixed-size search button. Mobile search remains full width. Local lint/build and privacy tests passed, and viewport checks at 1536/1024/390 pixels retained typed text.

The replacement frontend was prepared on 8091 while live stayed on 8090 and then switched. Backup: /var/backups/sarva-frontend-bluegreen/20261028-131514; rollback: sarva-frontend:rollback-bluegreen-20261028-131514; candidate: 1d601270611309fa7c2b4e0bebe746a05fb1fec6761b4d27e51e1a16aef4387b. The operator supplied passed switch checks and subsequently confirmed working after the Chrome/Edge browser, search and login test instructions. Backend, database and DS Lab were not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Latest frontend rollback sarva-frontend:rollback-bluegreen-20261028-131514 was verified against the previous frontend slot (image prefix 2c91bf7a9ef3) and retained. Duplicate/older frontend tags rollback-bluegreen-20261028-131455 and rollback-bluegreen-20261028-130531 were removed. The procedure included Nginx and SARVA/DS Lab HTTP checks; no separate terminal output was supplied for this final confirmation. Both frontend slots, backend rollback images, backup files, DS Lab images and database volumes were preserved; build cache was not pruned.


## Navigation alignment accepted, 28 October 2026

PR #45 merged as f6a28b0d54c795f536c7643fd19a6497f7a551ee. Removed the dropdown wrapper bottom-padding offset and applied consistent 42px border-box sizing to top-level items. This aligns plain Home/Explore/Data Health/Analytics links with dropdown buttons. Local lint/build/privacy checks passed; visible desktop link/button positions matched and dropdown interaction was verified.

The operator prepared the replacement on 8090 while live remained on 8091, then confirmed working after the supplied switch and admin browser/navigation/search/login/DS Lab checks. Backup: /var/backups/sarva-frontend-bluegreen/20261028-133457; rollback: sarva-frontend:rollback-bluegreen-20261028-133457; candidate: 806c176c6ab831aa2d91a7d24e049e087b121e616e9253d74ee01bf756f0d615. Frontend CSS only; backend, database and DS Lab were not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Verified and retained sarva-frontend:rollback-bluegreen-20261028-133457 against the previous frontend slot (image prefix eedf38a6d6ee). Removed duplicate/older tags rollback-bluegreen-20261028-133438 and rollback-bluegreen-20261028-131514. The cleanup procedure included Nginx and SARVA/DS Lab HTTP checks; no separate final terminal output was supplied. Both frontend slots, backend rollback images, backup files, DS Lab images and database volumes were preserved; build cache was not pruned.


## POST-only update actions accepted, 28 October 2026

PR #46 deployed POST review/resolution and all remaining update actions, removing backend PATCH routes as requested. The operator confirmed working after backend update and staged frontend switch to 8091. No schema migration or auth configuration change; DS Lab containers were not redeployed. Latest frontend rollback: sarva-frontend:rollback-bluegreen-20261028-134707. Cleanup is complete, confirmed by the operator. Latest rollback pair retained: sarva-frontend:rollback-bluegreen-20261028-134707 and sarva-backend:rollback-post-updates-20261028-154644. Six older/duplicate tags were removed; both frontend slots, backup files, volumes and DS Lab images were retained, and build cache was not pruned. See [POST-only deployment and acceptance](POST-ONLY-UPDATES.md).


## About SARVA homepage image accepted, 28 October 2026

PR #47 merged as ee3e7234530cb092e54a795970c942ced2709758. The homepage About card now uses a responsive image at its natural aspect ratio instead of a fixed-height background crop. Local lint/build/privacy checks passed and browser verification confirmed the full 2500×1112 source loaded proportionally.

The operator prepared on 8090 while live stayed on 8091 and confirmed completion after switch/browser-test instructions. Backup: /var/backups/sarva-frontend-bluegreen/20261028-135643; rollback: sarva-frontend:rollback-bluegreen-20261028-135643; candidate: dde53db2142611189bee6197e7074313dea9050b4e5138f0a5167f45109f946f. No separate final per-check terminal/browser output was supplied. Frontend-only change; backend, database, authentication configuration and DS Lab were not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Verified and retained sarva-frontend:rollback-bluegreen-20261028-135643 against the previous frontend slot (image prefix 44f93b6ce9f8). Removed duplicate/older tags rollback-bluegreen-20261028-135617 and rollback-bluegreen-20261028-134707. The procedure included Nginx and SARVA/DS Lab HTTP checks; no separate final terminal output was supplied. Both frontend slots, backend rollback images, backup files, DS Lab images and database volumes were preserved; build cache was not pruned.


## Homepage bottom columns removed, 28 October 2026

PR #48 merged as 195c87422533d277f9660cdfeee62bbd81798804. Removed the final Updates & Monitoring, Get Involved and About SARVA columns, along with their unused highlight helpers/state. Reports/Data Spotlight now flow into the footer. Risk watch, Community/About destinations, footer disclaimer and partner logos remain.

The operator prepared on 8091 while live stayed on 8090 and confirmed completion after switch/browser-test instructions. Backup: /var/backups/sarva-frontend-bluegreen/20261028-141953; rollback: sarva-frontend:rollback-bluegreen-20261028-141953; candidate: a5a45dcae97b69ad077ecaebdecf169314cf20c860e8d5c306f2531a642fdb9d. No separate per-check final output was supplied. Frontend-only change; backend, database and DS Lab were not redeployed.

Cleanup is pending latest rollback verification/execution. Preserve both frontend slots, newest frontend rollback, backend rollback images, backup files, DS Lab images and database volumes.


## Monthly library link verification installed, 28 October 2026

PR #49 deployed the corrected link checker and Not verified label. Production manual service run checked/updated all 98 active resource/policy links: 49 active, 20 redirected, 11 broken, 18 not verified, no errors. The operator confirmed enabling the monthly timer after successful manual completion. Schedule: first day of each month at 02:00 SAST plus up to 15 minutes jitter. Backend/frontend deployed through the staged workflow; DS Lab was not redeployed. Latest frontend rollback: sarva-frontend:rollback-bluegreen-20261028-143427. Cleanup is complete, confirmed by the operator. Latest rollback pair retained: sarva-frontend:rollback-bluegreen-20261028-143427 and sarva-backend:rollback-library-links-20261028-163104. Seven older/duplicate tags were removed; both frontend slots, backup files, monthly timer and database volumes were retained, with build cache unpruned. See [link-check evidence and operations](LIBRARY-LINK-CHECKS.md).


## Issue assignee and submitter filters accepted, 28 October 2026

PR #50 merged as 983438076bbe26f259668f2750b132de4d3dd2fa. Administrators can filter Issues & feedback by assignee and submitter, combined with search, status, type and pagination. Ordinary users retain access to their own reports only. Local validation included 69 backend tests, the no-PATCH guard, lint and Docker builds. No schema migration was required.

The backend was updated and the frontend prepared on 8091 while live remained on 8090, then switched to 8091. The operator confirmed completion and successful testing. Backup: /var/backups/sarva-frontend-bluegreen/20261028-145740; candidate: 75d65484a53ecddfe6f55c62a8ba8d17f1c3b06ed61fabe03d211598dae03896. SARVA password/passkey login and DS Lab were included in the supplied acceptance checks; no separate final browser output was supplied. DS Lab was not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Retained sarva-frontend:rollback-bluegreen-20261028-145740 (image prefix 9d0439735ca7), verified against the previous frontend slot, and sarva-backend:rollback-review-filters-20261028-165626 (image prefix 7f6574f50ecf). Five older/duplicate rollback tags were removed. The procedure checked retained image IDs, all three SARVA application containers running, Nginx configuration, SARVA/DS Lab HTTP 200 and the monthly library-link timer active. Both frontend slots, backup files, database volumes and DS Lab images were preserved; build cache was not pruned.


## SAEON observations menu accepted, 28 October 2026

PR #51 merged as 107fe15715cc9a103fd345d90aabbcc0e34f0b7d. The Data menu now labels SAEON Observations Monitor correctly and links to https://observationsmonitor.saeon.ac.za/home, with SAEON Observations Database immediately afterwards linking to https://observations.saeon.ac.za/. Existing API-provided navigation and fallback entries are normalized; the homepage monitor label was also corrected. Frontend lint and production build passed locally.

The operator confirmed completion after the supplied switch and browser checks. Live frontend is on 8090; previous slot on 8091 is retained. Backup: /var/backups/sarva-frontend-bluegreen/20261028-151650; candidate: dbda5330b490aea3b585918105696c506c70e808a157416e6aeb05db238cf40f. Frontend-only release; no backend, authentication configuration, database or DS Lab deployment. Password/passkey login and both menu destinations were included in the supplied browser checklist; no separate browser output was supplied.

Cleanup completed, confirmed by the operator after the supplied procedure. Retained sarva-frontend:rollback-bluegreen-20261028-151650 (image prefix 5a36ee3889c1), verified against the previous frontend slot, and existing sarva-backend:rollback-review-filters-20261028-165626 (image prefix 7f6574f50ecf). Removed frontend tags rollback-bluegreen-20261028-151217, rollback-observations-menu-20261028-171153 and rollback-bluegreen-20261028-145740. The procedure verified retained image IDs, SARVA application containers running, Nginx configuration and SARVA/DS Lab HTTP 200. Both frontend slots, backup files and database volumes were preserved; build cache was not pruned.


## Resource download labels accepted, 29 October 2026

PR #52 merged as 09212e67253ba31c1acc12bd659b051f4a9929dd. Homepage resource cards, Resources and Policy pages now use Download PDF for PDF URLs, Download file for recognised document/archive URLs, and Visit source for other destinations. The operator-confirmed Red Book direct download is labelled Download when its URL has no recognised file extension. Labels do not force remote browser download behaviour. Frontend lint/build and four analytics privacy/preferences tests passed locally.

The operator confirmed completion after the supplied switch and browser checklist, including the download labels, password/passkey login and DS Lab. Live frontend is on 8091; the previous slot on 8090 is retained. Backup: /var/backups/sarva-frontend-bluegreen/20261029-104707; candidate: 758e6296a5e01605b76d0cd84a8fc5f2bfc01a4f250fbafb9d8bded7cff81870. No separate final browser output was supplied. Frontend-only release; backend, authentication configuration, database and DS Lab were not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Retained sarva-frontend:rollback-bluegreen-20261029-104707 (image prefix 75b2c1615aad), verified against the previous frontend slot, and existing sarva-backend:rollback-review-filters-20261028-165626 (image prefix 7f6574f50ecf). Removed frontend tags rollback-bluegreen-20261029-104602, rollback-download-labels-20261029-124544 and rollback-bluegreen-20261028-151650. The procedure verified retained image IDs, SARVA application containers running, Nginx configuration and SARVA/DS Lab HTTP 200. Both frontend slots, backup files and database volumes were preserved; build cache was not pruned.


## WEF Nexus, partners and CGCs accepted, 29 October 2026

PR #53 (8a8a530223df307c3d9bf0391eda4d6ec48a660d) deployed the Partners & Collaboration page with WEF+Health Nexus and DS Lab cards, original WEF windmill background and NRF-SAEON/NWO branding. Partners, About and Contact are direct navigation links. WEF runs independently as wef-nexus-production-website-1 on 127.0.0.1:8188, published at https://sarva.saeon.ac.za/wef-nexus/ through /etc/nginx/sarva-wef-location.inc. The source checkout is /opt/WEF_Website, deployed website commit 21a5772bb59faa1b91042c72a43b9608fac43ca9. Public checks verified homepage, 46 files, MIME types and private/missing paths. An initial index mismatch after route installation did not recur; container/local HTTPS/public HTTPS subsequently matched the source. Cause unconfirmed. Initial backup: /home/marc/sarva-backups/before-wef-partners-20261029-133121; Nginx route backup: /var/backups/sarva-before-wef-route-20261029-133706.conf.

The canonical repository for FUTURE WEF DEVELOPMENT is https://github.com/SAEON/WEF-Nexus (private), alongside SAEON/SARVA. Original commit history was preserved; https://github.com/MfopaC/WEF_Website was not changed or transferred. Caroline (MfopaC) has verified write access. The local WEF checkout uses SAEON as origin and the original repository as upstream. Production was initially cloned from MfopaC; switching its origin to SAEON remains pending operator execution. A Git remote change does not require restarting the website. See the WEF repository docs/PRODUCTION-HANDOVER.md.

PR #54 (e57e1cbd5aa220deec18b1cd385f7540de0ac41c) added the internal /partners/centres-for-global-change directory for Sol Plaatje, Free State, Fort Hare, Limpopo and Walter Sisulu universities, with official logos, descriptions and university source links. The group photo and operator-specified passages were removed. University marks appear on the main CGC card and partner/footer rows. Footer wrapping and image sizing prevent NWO and other marks being cropped. Local lint/build, four privacy/preferences tests and browser/logo checks passed.

The operator confirmed completion after the supplied public switch and browser checks for both releases, including SARVA password/passkey login, WEF and DS Lab. No separate final browser output was supplied. Neither release redeployed the backend, database or authentication configuration, and DS Lab was not redeployed. Final frontend rollback backup: /var/backups/sarva-frontend-bluegreen/20261029-121403.

Cleanup completed, confirmed by the operator after the supplied procedure. Verified and retained sarva-frontend:rollback-bluegreen-20261029-121403 (image prefix 429a7da62313) against the previous slot, plus sarva-backend:rollback-review-filters-20261028-165626 (image prefix 7f6574f50ecf). Removed six older/duplicate frontend tags: rollback-bluegreen-20261029-121251, rollback-cgc-20261029-141245, rollback-bluegreen-20261029-113830, rollback-bluegreen-20261029-113936, rollback-wef-partners-20261029-133121 and rollback-bluegreen-20261029-104707. The procedure checked retained IDs, both SARVA slots/backend and WEF running, Nginx configuration, SARVA/partners/CGC/WEF HTTP 200 and DS Lab HTTP success. WEF images, both frontend slots, backend rollback, backup files and database volumes were preserved; build cache was not pruned.


## CGC showcase accepted and cleanup completed, 29 October 2026

PR #55 merged as 976f8f3d88ad175a58e38e5494c06dbba27ff54b. Added the collapsed searchable CGC work collection, file uploads/downloads, private pending submissions, revision history and publication review. CGC users submit their work; CGC admins manage the collection; normal SARVA admins retain full access. Eight verified publisher/repository works are initially published. All mutations use POST.

The operator reported builds and migrations 066–069 completed, backend updated, persistent upload storage verified and the public showcase returning eight published works. Frontend switched from 8091 to 8090; candidate c7568cad319bea1a1089d5ff5cba0932708284090269ae5ea90b75914e61245c. Deployment backup: /home/marc/sarva-backups/before-cgc-showcase-20261029-145037. Frontend deployment backup: /var/backups/sarva-frontend-bluegreen/20261029-125355. The operator confirmed completion after the supplied switch/browser checklist, including CGC submission/review/downloads, role availability, password/passkey login, WEF and DS Lab. No separate per-action browser results were supplied. Authentication configuration was unchanged; DS Lab and WEF were not redeployed.

Cleanup is complete, confirmed by the operator with terminal output. Retained sarva-frontend:rollback-bluegreen-20261029-125355 (image prefix c334b50921b5), verified against the previous frontend slot, and sarva-backend:rollback-cgc-showcase-20261029-145037 (image prefix 3de693cf8856). Removed duplicate/older tags sarva-frontend:rollback-bluegreen-20261029-125216, sarva-frontend:rollback-cgc-showcase-20261029-145037, sarva-frontend:rollback-bluegreen-20261029-121403 and sarva-backend:rollback-review-filters-20261028-165626. The supplied procedure verified retained image IDs, Nginx configuration and SARVA, CGC API/page, health, passkey page, WEF and DS Lab HTTP success. Final inventory: 28 images, 20 containers, six volumes; build cache was not pruned. Both frontend slots, CGC upload storage, database volumes, backup files and WEF images were retained. Future backups must include the cgc_uploads volume alongside the database; never prune upload or database volumes.


## Field Data System menu accepted and cleanup completed, 29 October 2026

PR #56 merged as 4b092c2bea59d986c90f7de7123c8ba88932c137. Maps & Tools now includes Field Data System (https://fds.saeon.ac.za/fds/) and excludes Rainfall Risk Layers and National Climate Change Information System. Both fallback and API-provided menu entries are normalized; the Explore page NCCIS card is unchanged. Frontend build, lint and four privacy/preferences tests passed locally.

The operator prepared the frontend on 8091 while live remained on 8090, then confirmed completion after switch and browser-check instructions. Deployment backup: /var/backups/sarva-frontend-bluegreen/20261029-133315; candidate: d7c6d1341c70f457d26abae09cf59ab2c309ef2a6629504b5c7b5a42c383a9fa. The supplied checks covered SARVA, health, passkey page, protected APIs, public CGC work, WEF and DS Lab; browser acceptance included menu destinations and password/passkey login. No separate final per-check output was supplied. Frontend-only release; backend, authentication configuration, upload storage, WEF and DS Lab were not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Retained sarva-frontend:rollback-bluegreen-20261029-133315 (image prefix 1957bfa6b472), verified against the previous frontend slot, and sarva-backend:rollback-cgc-showcase-20261029-145037 (image prefix 3de693cf8856). Removed duplicate/older frontend tags rollback-bluegreen-20261029-133251 and rollback-bluegreen-20261029-125355. The procedure verified retained image IDs, Nginx configuration and SARVA/DS Lab HTTP 200. Both frontend slots, CGC uploads, database volumes, backups and WEF images were retained; build cache was not pruned.


## Analytics heatmap counts accepted and cleanup completed, 29 October 2026

PR #57 merged as c6c668dd140d8cea4c8d14257110f76ce571363f. Visitor locations now default to a weighted heatmap with page-view count clusters. Selecting a cluster zooms into the area; individual locations retain device details. Counts-only mode and fullscreen viewing are available. Counts represent page views, not unique people; approximate-location and external-basemap notices remain. Frontend production build, lint and four privacy/preferences tests passed locally. Authenticated visual acceptance was deferred to production at the operator's request.

The operator prepared on 8090 while live remained on 8091, then confirmed completion after the supplied switch and browser checklist. Deployment backup: /var/backups/sarva-frontend-bluegreen/20261029-134400; candidate: e60c76c35d634cfdf79cc2398d43a5ee6e1eee748a9d7b56a4ed14bad6d4af92. The checklist covered heatmap/count rendering, cluster expansion, location/device popups, fullscreen and counts-only mode. Supplied HTTP checks covered SARVA, analytics, health, passkey page, protected APIs, public CGC work, WEF and DS Lab. No separate per-action browser or final HTTP output was supplied. Frontend-only release; backend, database, authentication configuration, CGC upload storage, WEF and DS Lab were not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Retained sarva-frontend:rollback-bluegreen-20261029-134400 (image prefix 07307e1e933c), verified against the previous frontend slot, and sarva-backend:rollback-cgc-showcase-20261029-145037 (image prefix 3de693cf8856). Removed duplicate/older frontend tags rollback-bluegreen-20261029-134328 and rollback-bluegreen-20261029-133315. The procedure verified retained IDs, Nginx configuration and SARVA/DS Lab HTTP 200. Both frontend slots, CGC uploads, database volumes, backups and WEF images were preserved; build cache was not pruned.


## Experimental banner refresh action accepted and cleanup completed, 29 October 2026

PR #58 merged as 56756047e93d9b0f81c65b1dbddc608a4cd9d0ae. Added a visible Refresh to see new updates button inside the experimental-release banner, with a notification when a newer valid build version is detected. Automatic refresh remains enabled with existing idle/editing/submission safeguards. The reported live automatic-refresh delay was not independently reproduced or established as fixed. Six update-watcher tests, four privacy/preferences tests, frontend lint and production build passed locally; the operator approved the local placement.

The operator prepared on 8091 while live remained on 8090, then confirmed completion after switch and browser-check instructions. Deployment backup: /var/backups/sarva-frontend-bluegreen/20261029-140154; candidate: 13b38c1f3b8d9ff61f27c873b5697489875cbe22d8f118101a8dcaa2196dc40b. Browser checklist covered button placement, reload retaining sign-in and password/passkey login. Supplied HTTP checks covered SARVA, version.json, health, passkey page, protected APIs, CGC work, WEF and DS Lab. No separate final per-action browser or HTTP results were supplied. Frontend-only release; backend, database, authentication settings, CGC upload storage, WEF and DS Lab were not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Retained sarva-frontend:rollback-bluegreen-20261029-140154 (image prefix c8726155463a), verified against the previous frontend slot, and sarva-backend:rollback-cgc-showcase-20261029-145037 (image prefix 3de693cf8856). Removed duplicate/older frontend tags rollback-bluegreen-20261029-140143 and rollback-bluegreen-20261029-134400. The procedure verified retained image IDs, Nginx configuration and SARVA/DS Lab HTTP 200. Both frontend slots, CGC uploads, database volumes, backups and WEF images were retained; build cache was not pruned.


## High-resolution header logo accepted and cleanup completed, 29 October 2026

PR #59 merged as bc1d4ce802c2b4f90ddd3ce4a37878f31f643bf6. Replaced the header logo with the operator-supplied high-resolution SARVA artwork, enlarged the proportional desktop/mobile treatment and removed the padded circular badge. This addresses reported issue #40. Frontend production build and four privacy/preferences tests passed; the operator approved the revised local appearance.

The operator prepared on 8090 while live remained on 8091, then confirmed completion after switch and browser-check instructions. Deployment backup: /var/backups/sarva-frontend-bluegreen/20261029-140734; candidate: f52ab6fec771f746aa9916dd52f964bc6507ce378233f05e2907564615b365df. Browser checklist covered logo appearance, navigation alignment and password/passkey login. Supplied HTTP checks covered SARVA, health, passkey endpoints, public CGC work, WEF and DS Lab. No separate per-action final browser or HTTP output was supplied. Frontend-only release; backend, database, authentication configuration, upload storage, WEF and DS Lab were not redeployed.

Cleanup completed, confirmed by the operator after the supplied procedure. Retained sarva-frontend:rollback-bluegreen-20261029-140734 (image prefix 94ba2be630b5), verified against the previous frontend slot, and sarva-backend:rollback-cgc-showcase-20261029-145037 (image prefix 3de693cf8856). Removed duplicate/older frontend tags rollback-bluegreen-20261029-140721 and rollback-bluegreen-20261029-140154. The procedure verified retained image IDs, Nginx configuration and SARVA/DS Lab HTTP 200. Both frontend slots, CGC uploads, database volumes, backups and WEF images were preserved; build cache was not pruned.
