# Development notices: local review, 23 October 2026

Release branch feature/development-notices, tested locally and prepared for
GitHub publication. Production deployment and browser acceptance are pending.

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
