# Production readiness and handover

Current status, 23 October 2026: deployed on the new production host; local HTTPS checks passed. External access, final data reconciliation and acceptance remain pending. See [production deployment record](DEPLOYMENT-2026-10-22.md).

Preview layout release `34db7be` is deployed: operator confirmed bottom-right
preview controls, working SARVA Login and working DS Lab. See
[acceptance and cleanup status](PREVIEW-LOGIN-LAYOUT-FIX.md). Production image
cleanup is complete per operator confirmation on 23 October, with everything
reported working afterwards. Preserve tagged rollback images and backups; no
reclaimed-space total was supplied.

Development-notice release `665d203` (PR #7) is now deployed. Operator confirmed
both sites look good and SARVA dev login still works. Banners and SAEON footer
disclaimers are accepted, with DS Lab's header fix accepted in release `66f271c`.
See [deployment acceptance](DEVELOPMENT-NOTICES.md). Retain the new rollback
images/backups; no post-notice cleanup has been confirmed.

## Historical preparation notes, 21 October 2026

The dated notes below describe earlier stages; the deployment record above supersedes provisioning and deployment status.

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

## Dependency remediation tested locally, 21 October 2026

Not pushed or deployed. Backend and frontend build stages now use Node 24. Backend geoip-lite is 2.0.3 or compatible later 2.x; Node's built-in watch mode replaces nodemon. Compatible transitive patches are locked. MapLibre is upgraded to 6.15.x with a shared Vite worker configuration and updated imports, following https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/ and the Vite installation instructions. Keep the bundled worker and renderer versions together.

Clean backend and frontend Docker builds passed. npm audit including frontend build/development dependencies reports zero findings for the updated lockfiles at test time. This does not replace container OS scanning or future advisory checks. Backend suite: 22 passing tests, including added GeoIP IPv4/IPv6/private-address and proxy trust-boundary checks. Preview security suite: 7 passing tests. Candidate API health, navigation and catalogue search return 200; anonymous admin endpoints return 403. Local analytics event recording, private-IP classification and authenticated administrator summary passed; the explicit test event was removed.

MapLibre testing caught and corrected its v6 module-worker requirement. Municipal boundaries, choropleth colours, feature selection and selected municipality values were checked in the local browser. Candidate services use loopback ports 5062, 5176 and 8092, without replacing the normal 5174 workspace or 5180 preview gate. The isolated static frontend uses the existing local backend/tile network; the Node 24 candidate API is tested separately on 5062.

Preview configurations, passwords and server deployment remain unchanged. Existing local preview gateway still rejects anonymous pages, APIs, tiles and assets with 401. End-to-end login with the existing preview password could not be repeated because the private local-login note is absent; no password was reset or disclosed. Security tests cover correct/incorrect login, session expiry, origin enforcement, throttling, revocation and permission separation.

Full frontend lint is not clean: 24 errors and 3 warnings, matching the unchanged main baseline under the same installed lint tools. These existing React hook/ref issues require a separate focused cleanup. Final acceptance still includes manual preview sign-in and an image/OS scan before production deployment. No external source's live availability is certified by dependency/unit tests.

## Lint and preview acceptance follow-up, 21 October 2026

Supersedes the earlier open lint/manual-login items above. Full frontend lint now passes with zero errors and zero warnings, both against the mounted candidate and inside its freshly built Node 24 Docker build stage. Production build passed. No lint rules were disabled. Editor forms initialise on record identity, URL-driven state resets are guarded by changed inputs, derived defaults stay derived, and map-layer consumers receive a state-held map instance after load. Request state resets happen when their inputs change rather than through synchronous state-setting effects.

User confirmed that the existing local preview username/password opens SARVA at http://127.0.0.1:5180. The seven preview-security tests passed again. Existing preview configuration and credentials were preserved, and the server was untouched. Municipal search for Cape Town, selected source values, map zoom/colour rendering and URL-driven metric selection were checked on the candidate. This is local acceptance; target-server and OS/image scanning remain separate production checks.

All dependency/lint changes remain local pending the requested GitHub push. Keep the essential-variable feature branch separate.

Final browser checks also confirmed the document URL query (?q=water) populates the search field and returns filtered records, and the municipal planning workspace renders its map without React update-depth/type/reference errors. Full lint and Docker build passed after these refactors. GitHub and the server are unchanged by this follow-up.

## Server update while retaining the internal dev preview

Deploy this reviewed release on the existing development server only; this is not the internet/production cutover. The root host-Nginx route must remain pointed at 127.0.0.1:5180. Do not change it to 8090. Preserve the separate DS Lab locations. Preserve /opt/sarva/.env and /opt/sarva/.local/preview-access/auth; do not run preview-credentials.py set or recreate preview-auth just to update the app. Removing backend/.env from Git does not remove the root Compose .env.

1. SSH as marc@192.168.115.77 and cd /opt/sarva. Check git status and the deployed commit. Inspect preview gateway Compose labels and host-Nginx proxy routes. Verify the existing gateway uses preview/compose.server-internal.yml before applying its command below. Review any server-only changes before pulling.
2. Back up the database with pg_dump -Fc using the running db service's environment. Store root .env, any backend/.env, the private preview-auth directory and the host Nginx configuration in protected backup storage (umask 077). Preserve runtime spatial data and identify the old image IDs. Do not paste secrets into tickets or Git.
3. Once the release PR is merged, use the normal deploy/server-update.sh --check-only then deploy/server-update.sh from a clean main checkout. For an explicitly approved branch deployment before merge, use DEPLOY_BRANCH=chore/production-readiness with both commands and record that branch and commit in the deployment log. A check-only fetch does not deploy the branch.
4. After the app frontend is recreated, refresh only the preview gateway so its Nginx resolves the frontend's new Docker IP:

   sudo docker compose -f preview/compose.server-internal.yml up -d --no-deps --force-recreate preview-gateway
   sudo docker compose -f preview/compose.server-internal.yml exec -T preview-gateway nginx -t

   Leave preview-auth running so its in-memory sessions are not deliberately reset. The existing credential files stay in place. If the active configuration differs, use its actual Compose file rather than switching configurations blindly.
5. Verify the root host proxy still points at 5180, anonymous page requests redirect to the preview login and anonymous API requests fail with 401. Test in a private browser window at http://192.168.115.77, sign in with the existing preview credential, then test SARVA admin login, municipal maps, analytics and data health. Check the frontend 8090 binding is loopback only and backend/Martin/database are not publicly exposed. If a gate check fails, do not bypass it by repointing Nginx at the frontend.
6. Keep previous images and backups until acceptance. Do not run the repository's host-wide container/build-cache prune script automatically on this shared DS Lab host. Review cleanup scope separately after verification; never remove database volumes.

Deployment has not been performed by these instructions. Capture the actual server commit, image IDs, smoke checks and preview-login result after the operator completes them.

## Existing development-server deployment verified, 21 October 2026

Operator deployed release branch chore/production-readiness through 582d7ca to /opt/sarva on ulwdslabsdev01 (192.168.115.77). This is the existing internal development server, not a new production/public-internet cutover. Pre-update backups completed: approximately 99 MB database dump, configuration archive and prior image IDs under the operator's timestamped ~/sarva-backups directory.

App rebuild/start completed; migrations 055 and 056 were already applied. Backend, database and Martin were healthy, and frontend port 8090 was loopback-only. Only preview-gateway was recreated using preview/compose.server-internal.yml; existing preview-auth and credential files were retained. An initial 502 immediately after gateway startup cleared on follow-up: direct frontend API returned 200 and preview gateway returned 401. Operator then confirmed host Nginx also returns 401 anonymously, the existing dev login works and maps work. Analytics and Data Health acceptance after this deployment have not been separately confirmed.

Image cleanup is complete as confirmed by the operator on 21 October 2026; the operator reports everything is still working afterwards. Cleanup was limited to the instructed dangling-image prune for images older than 24 hours. No reclaimed-space total was supplied. No host-wide container/cache/volume cleanup was part of the instructed procedure, and unrelated tagged DS Lab images were left outside its scope.

The initial rollback-tag step stopped before pruning because the previously recorded backend image was already absent. No previous-release rollback image was successfully confirmed or tagged. The subsequent image inventory contained the current SARVA images and no dangling images; the database/configuration backups and recorded prior image IDs remain the documented recovery evidence. A saved image ID is not an image backup. Preserve current images and backup files for any follow-up work.

Status: internal development-server update and cleanup complete, with existing dev preview login and maps confirmed working. This completion does not certify a public production cutover, production credential rotation, historical repository-data remediation or container OS scanning. Analytics and Data Health have not received separate explicit post-deploy acceptance results.
