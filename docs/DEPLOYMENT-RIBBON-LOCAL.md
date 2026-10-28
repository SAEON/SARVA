# Deployment ribbon local review

Deployed and operator-accepted on production 28 October 2026 following PR #31 and recovery fixes #32/#33. Operator confirmed the live switch, ribbon on/off, password/passkey login and DS Lab checks worked. Blue on 8090 is active; previous green on 8091 and all rollback backups are retained. Cleanup is on hold.

Ribbon: Update in progress — SARVA is being updated. You can continue browsing; please save any work.

The shared header polls /public/deployment-status.json every 15 seconds and on returning to the tab. Missing, failed, invalid, future or expired markers hide the ribbon. The marker is limited to 45 minutes and contains only active/startedAt/expiresAt, not internal deployment state or credentials. The existing fixed-header ResizeObserver reserves space when the ribbon appears/disappears. Experimental warning remains separate.

Blue-green workflow adds build, notice-on and notice-off actions. Build and prepare enable the marker; build/prepare failure clears it. Switch and rollback clear it afterward. Use `sudo python3 scripts/deploy-frontend-bluegreen.py build` instead of an unmarked manual build for subsequent frontend deployments. A cancelled process may leave the marker until expiry; notice-off clears it manually. The marker is an atomic JSON file written through Docker exec into the running sarva-backend public directory, shared by both frontend slots. Backend replacement does not preserve the marker; missing status hides the ribbon. No backend source, database, authentication/session or DS Lab configuration is changed.

The first production deployment introducing this component cannot display a ribbon on the old frontend that lacks the component. Once adopted, both frontend slots must contain the component for future deployments to display it throughout a switch/rollback. This is a status notice, not a guarantee that all operations are interruption-free. Restarts/rebuilds outside this workflow do not automatically set the marker.

Validation: marker expiry/active-state frontend test, seven blue-green switch/recovery tests, lint and frontend Docker build passed. Local browser verified visibility above the header and automatic clearing without page reload. Local DS Lab returned 200 and passkeys remained enabled. Production browser/ribbon checks are now operator-confirmed; see DEPLOYMENT-2026-10-22.md for recovery and retained backup details.
