# Automatic frontend updates

Each frontend build emits a unique version.json and embeds the same identifier in its JavaScript. Nginx serves the version endpoint with Cache-Control: no-store. The client checks every minute and when a tab becomes visible. After detecting a different valid version, a visible page reloads automatically after 15 seconds without pointer/keyboard activity. There is no update button.

Form input changes defer reload until restored or removed. Password/file input and busy form markers also defer reload; authentication, passkey and review forms expose busy state. No auth storage is cleared. sessionStorage records the attempted version to prevent repeated refreshes if an intermediate cache serves old code. Failed checks and invalid/non-JSON responses leave the current page alone. If sessionStorage is unavailable, automatic refresh is skipped.

The feature must first be loaded by a normal navigation or one manual refresh; older open pages do not acquire new JavaScript merely because the server was updated. It applies to frontend deployment, not live API-data refresh. Some completed forms that retain changed values may conservatively defer until navigating away.

Validation: four automatic-update tests cover version validation, idle timing, hidden tabs, unfinished input, pending submission, password protection, failed checks, storage preservation and repeat-refresh prevention. Frontend lint, Docker build and four privacy regression tests passed. The local version endpoint returned JSON with no-store; passkeys remained enabled and DS Lab returned 200. Production acceptance pending.

Deploy using frontend build/prepare/switch. Backend, database and DS Lab need no deployment. Confirm version.json matches the active frontend and test an old loaded version against a later staged switch. Retain both slots and rollback images.
