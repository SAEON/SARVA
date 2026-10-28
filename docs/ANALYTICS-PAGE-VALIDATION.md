# Analytics page-validation fix (local)

The production logs showed POST /api/analytics/events returning 400 every 15 seconds from /testing. Reproduced locally with a valid page event for /testing: HTTP 400 Bad Request. The frontend tracked every path except analytics, data health and privacy, while the backend page allowlist predated /testing, /admin/users and /account/passkeys. Engagement events reused the rejected path.

Add exactly those three canonical page paths to the backend allowlist and give them section labels: Issues & feedback, User administration, Passkey account settings. The frontend now emits only recognised page paths, avoiding repeated rejected events on unsupported routes. Query strings, arbitrary report/user IDs and form contents are not permitted as page paths. No change to optional analytics preferences, GPC/DNT, authentication verification, IP hashing or admin report access. This records page/engagement activity on these pages, not report text, passwords or passkey values.

Local tests: 55 isolated backend tests passed, including anonymous and signed-in page/engagement acceptance and persisted section/duration values for all three new paths; unknown/private paths remain rejected. Six frontend page/privacy tests and lint passed. Production remains unchanged. No schema migration.
