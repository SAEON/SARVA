# SARVA account menu and header fit

Prepared for production on 27 October 2026. Deployment and operator acceptance
are pending. This frontend-only change follows the user administration and
testing tracker release; it does not change roles, credentials or database schema.

The signed-in account menu now includes an identity section, role badges, grouped
Workspace and Administration links, icons, destination descriptions and a separate
sign-out action. Testing & issues is available to signed-in users; administrator
shortcuts retain the existing role-based visibility and server authorization.
Outside clicks dismiss the menu. Escape closes it and returns focus to the trigger.
Narrow menus are positioned within the viewport and scroll when necessary.

At crowded desktop/tablet widths, navigation uses a separate row so it cannot push
the account button off the screen. Browser inspection confirmed the account and
dropdown fit within the desktop viewport. The local user-management shortcut,
Escape dismissal and focus restoration were exercised. Frontend Docker build,
ESLint and all four existing frontend tests passed. No dependencies were added.

## Production sequence

1. Verify /opt/sarva on ulwsarvadsl01, record the current commit, archive available
   production .env and Compose files plus host Nginx configuration, and tag the
   running frontend image for rollback. Preserve preview/compose.production.yml.
2. Pull main using --ff-only, build frontend only, then recreate only frontend
   using --no-deps. No migrations or database restore are required.
3. Check frontend readiness with bounded retries, validate its Nginx configuration,
   and verify public SARVA/API and DS Lab return 200. Anonymous user administration
   must remain 403 and the issue tracker 401. Do not restart the stopped preview
   services or change the host Nginx route directly to port 8090.
4. Operator checks the existing SARVA account sign-in, visible account menu,
   Testing & issues and administrator shortcuts, then DS Lab in the browser.
   A hard refresh may be needed to load the new frontend assets.
5. Record acceptance before cleanup. Retain tagged rollback images and private
   backups. Deployment does not require pruning or any change to DS Lab.

Rollback restores the saved frontend image and recreates frontend only; retain
the existing production environment. Backend/database/account changes from the
previous release are independent of this layout fix.
