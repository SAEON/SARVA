# Automatic frontend updates

Each frontend build emits a unique version.json and embeds the same identifier in its JavaScript. Nginx serves the version endpoint with Cache-Control: no-store. The client checks every minute and when a tab becomes visible. After detecting a different valid version, a visible page reloads automatically after 15 seconds without pointer/keyboard activity. There is no update button.

Form input changes defer reload until restored or removed. Password/file input and busy form markers also defer reload; authentication, passkey and review forms expose busy state. No auth storage is cleared. sessionStorage records the attempted version to prevent repeated refreshes if an intermediate cache serves old code. Failed checks and invalid/non-JSON responses leave the current page alone. If sessionStorage is unavailable, automatic refresh is skipped.

The feature must first be loaded by a normal navigation or one manual refresh; older open pages do not acquire new JavaScript merely because the server was updated. It applies to frontend deployment, not live API-data refresh. Some completed forms that retain changed values may conservatively defer until navigating away.

Validation: four automatic-update tests cover version validation, idle timing, hidden tabs, unfinished input, pending submission, password protection, failed checks, storage preservation and repeat-refresh prevention. Frontend lint, Docker build and four privacy regression tests passed. The local version endpoint returned JSON with no-store; passkeys remained enabled and DS Lab returned 200. Production deployment is recorded below; live automatic-reload verification awaits a later version change.

Deploy using frontend build/prepare/switch. Backend, database and DS Lab need no deployment. Confirm version.json matches the active frontend and test an old loaded version against a later staged switch. Retain both slots and rollback images.

## Production deployment, 28 October 2026

PR #39 merged as 557ba8a7cc83d4f6f070e60ba2d56d8bc8fcb216. The replacement frontend was prepared on 8090 while live remained on 8091. Backup: /var/backups/sarva-frontend-bluegreen/20261028-110655; rollback tag: sarva-frontend:rollback-bluegreen-20261028-110655; candidate: 100a073d727509939e16277af07cecdf954569159cf7c2cb02118ecb103af538. The operator confirmed completion of the supplied switch and site/version-check procedure. Backend, database and DS Lab were not redeployed.

Automatic refresh is deployed. A single manual refresh/navigation is required for older open tabs to load the watcher. End-to-end live automatic reload remains pending a subsequent frontend version change. New password/passkey browser acceptance was requested but not separately reported for this release.

Cleanup completed on 28 October 2026, based on supplied production output. The latest frontend rollback was verified against the previous frontend slot before older frontend rollback tags were removed. Five unused legacy ulwazi-datascience-lab images and three older SARVA backend rollback images were then removed after validating that no containers referenced them. No force removal, container restart, volume deletion or build-cache pruning was used.

Retained SARVA rollback pair:

- sarva-frontend:rollback-bluegreen-20261028-110655 (verified image sha256:2f3dcc20b41145d8a2358db3c689614ee6c28fa0a8e50b5f248e53791bb4a00f).
- sarva-backend:rollback-create-assignment-20261028-122306.

Both frontend slots, current service images, DS Lab production/backup images, database volumes and backup files remain retained. Nginx validation passed; SARVA and DS Lab homepages each returned HTTP 200. Final Docker report: 27 images, 19 active; image storage 5.713 GB with 830.4 MB reclaimable; 19 containers, 17 active; five volumes, all active. Build cache remained 14.55 GB, with 12.45 GB reported reclaimable. Password/passkey browser sign-in was not separately reconfirmed in this cleanup output. Live automatic-reload verification still awaits the next frontend version change.
