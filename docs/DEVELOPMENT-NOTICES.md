# Development notices: local review, 23 October 2026

Production release `665d203` (PR #7) is deployed. Operator confirmed the
banner and disclaimer look good and SARVA dev preview login still works.

Adds the requested development/testing banner above navigation and the agreed
SARVA disclaimer including SAEON responsibility wording. Home retains its
existing partner footer; non-home pages now have the same disclaimer in a shared
footer. The fixed header reports its actual height through ResizeObserver and
a CSS variable, reserving enough page/anchor space when the notice wraps.
The preview access control remains portaled to BODY, away from SARVA Login.

Local review URL: http://127.0.0.1:8093/ (isolated Docker candidate). It uses
the previous explicit preview-status visual fixture to render the badge; this
does not test real preview sign-in or change authentication. Existing 5174
essential-variable development and production were left untouched.

Validation: full frontend lint and production Docker builds passed. Browser
verified exact banner/disclaimer text on Home and About. Header height matched
reserved content padding on desktop and 390px mobile; no mobile page overflow.
The fixture control remains a BODY child. Repeat actual preview and SARVA login
acceptance before any later production deployment.

## Rollout and rollback

Save current revision, frontend image ID/tag and private configuration before
updating. This release requires no database migration, API rebuild, database
restart or credential change. Do not prune rollback images until accepted.
Pull the merged SARVA main in /opt/sarva, build frontend only and recreate
frontend with --no-deps --wait. Recreate only preview-gateway using the existing
preview/compose.production.yml so Nginx resolves the new frontend address. Keep
preview-auth, its credentials, host Nginx and DS Lab services unchanged. Verify
preview page 200 and anonymous API 401, then actual preview/SARVA login and
responsive header/footer. Check DS Lab still opens. For rollback use the saved
frontend image with an image-only override, then refresh preview-gateway; do
not reset database contents or preview credentials.

## Production acceptance, 23 October 2026

Both applications were updated on ULWSARVADSL01 (192.168.117.189), one frontend
at a time. Operator saved rollback frontend images and configuration for both
before updating. The exact backup timestamp and new image IDs were not supplied
with this acceptance; use the server's release-backups/before-notices-* records.
Operator followed the frontend-only build/recreation and preview-gateway
refresh procedure, then confirmed both sites look good and SARVA dev preview
login still works. The deployed disclaimer includes the agreed SAEON
responsibility wording. Preview-auth and private credentials were not part of
the instructed restart; DS Lab services and host Nginx were not changed by the
SARVA step. No fresh terminal endpoint transcript was supplied for this step.

No database migration, restore or password reset was required by either release.
Retain the rollback images and backups; no cleanup following these notice
releases has been requested or confirmed. Catalogue connectivity and any
previously pending external-network/data-reconciliation checks remain separate
from this visual acceptance. No new public-route test evidence is claimed.
