# SARVA audience explorer — local candidate, 26 October 2026

Status: locally accepted and approved for GitHub publication and production rollout on 26 October 2026. Deployment and post-deployment cleanup are pending operator execution. Existing production
SARVA preview and DS Lab stacks are untouched.

## Features
- Approximate visitor map over an OpenStreetMap basemap; sized circles and
  heatmap, with device mix and page-view totals in circle popups.
- Date range follows the existing reporting period. Device, country, section,
  audience and selected-account filters affect the new explorer only; original
  reports remain date-only and are labelled accordingly.
- Device × location × audience table and filtered CSV export; unknown/private
  visits are counted separately and never assigned invented coordinates.
- Administrator-only signed-in account summary and latest activity; select a
  user to drill into their activity. Account ID/display name are visible to
  administrators; no email, credentials or raw IP is included in these reports.
- Browser events include page views, existing link/download clicks and typed
  map-layer, municipality, header catalogue-search, catalogue-link, resource-link
  and library content create/edit/link-review actions. These are usage events,
  not comprehensive audit records or proof of completed downloads. Not every
  form, administrative operation or search-filter change is instrumented.

## Identity and privacy
Backend verifies the signed SARVA bearer token AND current active database
account/role. Client-supplied user IDs/roles are ignored. Preview login alone
does not identify a person. Browser privacy flags suppress new client events.
Only allowlisted actions and bounded non-sensitive identifiers are accepted;
search text, form values, URL queries and raw IPs are not added to the event.
GeoIP is looked up in memory and coordinates rounded to whole degrees before
storage (roughly 100 km in latitude). Tiles are fetched from OpenStreetMap;
analytics/user data are not transmitted to that tile service. Historical events
retain legacy classification; no location or identity backfill is attempted.

## Local review
Candidate URL: http://127.0.0.1:8094/analytics
Synthetic database/network/volume: sarva-analytics-test / sarva-analytics-test-db.
API container sarva-analytics-api-test uses loopback 5064; frontend
sarva-analytics-web-test uses loopback 8094. All example users and traffic are
fabricated. Demo credentials are private under .local/analytics/credentials.json
and are never committed. This synthetic candidate has no imported catalogue,
municipal boundaries, forecast data or Martin service: it tests analytics, not
the completeness of those other datasets. A localhost placeholder for Martin
allows the standard frontend proxy config to start; its tiles are unavailable.

## Deployment prerequisites (not executed)
Back up the application database and current images; review account attribution
and retention with the administrator before rollout. Migration
057_analytics_map_activity.sql adds nullable account FK, coarse grid, action,
subject and audience classification. Apply it before starting the new backend;
it preserves historical rows. Build/recreate backend/frontend only and refresh
proxy address resolution as needed. Retain production preview compose/auth files
and the existing trusted-proxy CIDRs; do not trust arbitrary forwarded headers.
No DS Lab changes required. Rollback app images remain possible while leaving
additive columns in place; do not drop analytics rows to roll back.

## Validation
Backend integration suite runs only against synthetic test DB with
SARVA_ANALYTICS_TEST=synthetic-only. Includes anonymous/non-admin access denial,
forged account/role rejection, expired/malformed tokens, live role revocation,
GeoIP rounding, filter validation, safe engagement attribution and report scope.
Frontend map aggregation tests cover unknown/invalid points and device totals.
Browser checks cover real synthetic admin login, filter counts, map popup,
heatmap and signed-in activity. Local build/lint and existing stack smoke checks
must pass before publication.


Local acceptance completed:
- 30 backend tests passed, including synthetic PostgreSQL integration tests.
- Frontend production-style build and ESLint passed; 3 frontend aggregation/
  privacy tests passed.
- Browser: synthetic administrator login, mobile filter (28 seeded page views),
  marker device popup, heatmap, account drill-down and live signed-in header
  search verified. Search action appeared against the correct synthetic account.
- Existing local SARVA preview login 200 / protected API 401; all DS Lab smoke
  checks including legacy redirects passed. No existing containers recreated.
- Candidate has a prominent synthetic-data notice via VITE_ANALYTICS_DEMO=true;
  build argument defaults false for normal builds.

Review in the already signed-in in-app browser tab. Existing local SARVA accounts
are not copied into this test database. The private synthetic demo account is
for this isolated candidate only. GitHub publication is part of the approved rollout; production deployment and
cleanup must be confirmed separately before marking this release deployed.
