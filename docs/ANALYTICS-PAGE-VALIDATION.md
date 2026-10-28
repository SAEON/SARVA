# Analytics page-validation fix (local)

The production logs showed POST /api/analytics/events returning 400 every 15 seconds from /testing. Reproduced locally with a valid page event for /testing: HTTP 400 Bad Request. The frontend tracked every path except analytics, data health and privacy, while the backend page allowlist predated /testing, /admin/users and /account/passkeys. Engagement events reused the rejected path.

Add exactly those three canonical page paths to the backend allowlist and give them section labels: Issues & feedback, User administration, Passkey account settings. The frontend now emits only recognised page paths, avoiding repeated rejected events on unsupported routes. Query strings, arbitrary report/user IDs and form contents are not permitted as page paths. No change to optional analytics preferences, GPC/DNT, authentication verification, IP hashing or admin report access. This records page/engagement activity on these pages, not report text, passwords or passkey values.

Local tests: 55 isolated backend tests passed, including anonymous and signed-in page/engagement acceptance and persisted section/duration values for all three new paths; unknown/private paths remain rejected. Six frontend page/privacy tests and lint passed. No schema migration. Production deployment is recorded below.

## Production acceptance, 28 October 2026

PR #40 merged as e014bfdb2627eba1103d64f729ab51c7209bc591. The operator built both images, updated the backend, refreshed Nginx in both frontend slots and prepared the replacement on 8091 while live stayed on 8090. Backup: /var/backups/sarva-frontend-bluegreen/20261028-114842; frontend rollback: sarva-frontend:rollback-bluegreen-20261028-114842; candidate: 0b280160dbca3df37fb03ea41d13dc4df9ca2a60af891b04cde6091b8742da8a.

After the switch/check and browser-test instructions, the operator confirmed the analytics fix is working on production. No raw browser/network output or separate password/passkey browser confirmation was supplied for this acceptance; do not infer historical missing events were recovered. DS Lab was not redeployed. Full automatic frontend reload acceptance was not separately confirmed.

Cleanup is pending. Verify and retain the new frontend rollback and the backend rollback saved before this release; preserve both frontend slots, DS Lab images, backup files and volumes.
