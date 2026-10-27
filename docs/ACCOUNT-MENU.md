# SARVA account menu and header fit

Deployed to production on 27 October 2026; operator accepted the account menu,
normal SARVA login and DS Lab. Post-deployment image cleanup is complete; rollback images are retained. This frontend-only change follows the user administration and
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


## Production acceptance, 27 October 2026

Release: main merge 3335c16 (PR #12). Operator confirmed all instructed checks
passed, the account menu looks good, normal SARVA login works and DS Lab still
works. The instructed checks covered direct frontend readiness, frontend Nginx
validation, public SARVA homepage/API and DS Lab HTTPS. This is operator-reported
acceptance, not an independent remote inspection or a new data-feed test.

Rollback backup confirmed before deployment:
/home/marc/sarva-backups/before-account-menu-20261027-134437
(commit.txt, configuration.tgz and rollback-image.txt). The running frontend
image was tagged before replacement. No database migration or credential change
was required for this menu release. The stopped preview services remain outside
the public request path; host Nginx continues routing SARVA directly to 8090.

Cleanup is authorized but not yet confirmed. The instructed cleanup will verify
saved rollback tag records for both the account-menu and user-administration
releases, prune only dangling images older than 24 hours, then recheck the tags
and both sites. No -a image pruning, volume pruning, container removal or private
backup deletion is included. Record cleanup completion only after operator output.


## Post-deployment cleanup complete, 27 October 2026

Supersedes the pending cleanup status above. Supplied production terminal output
confirms dangling-image pruning with the instructed 24-hour filter completed and
reclaimed 0 B. All three recorded rollback tags were verified after cleanup:

- sarva-frontend:rollback-account-menu-20261027-134437
- sarva-backend:rollback-user-admin-20261027-132424
- sarva-frontend:rollback-user-admin-20261027-132424

Nginx configuration validation passed. Server-local HTTPS checks using the real
hostnames returned SARVA homepage 200, SARVA health API 200, anonymous user
management 403, anonymous tracker 401 and DS Lab homepage 200. The cleanup script
completed successfully. These results complement the prior operator confirmation
that the account menu looks good, normal SARVA login works and DS Lab still works.

Before/after Docker usage figures were unchanged: 38 images (18 active), 9.683 GB
image usage; 18 containers (16 active); five volumes, all active, 1.207 GB; and
10.35 GB build cache. Reclaimable figures do not mean those images or cache were
removed. No broad image, build-cache, container or volume pruning was performed.
Tagged rollback images, database dump and private configuration backups remain
designated for retention. No further cleanup is required for this release.
