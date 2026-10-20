# Data health panel

Open `/data-health` on the local Docker preview at http://127.0.0.1:5174.
The primary navigation and account menu link to it for signed-in administrators.
The API requires a signed admin token and rechecks the account's current active
admin membership. Other roles and anonymous requests receive 403.

The feature is validated locally before deployment. It adds no database tables, no
credentials, and no scheduled jobs. Existing migrations must already be applied.
The implementation is in the Windows checkout mounted by sarva-analytics-api
and sarva-analytics-web. Restart only the preview API after backend edits.

## Checks and interpretation

- Database: a lightweight PostgreSQL query; not a storage or backup audit.
- SAEON catalogue: local record count, latest attempt, latest successful run,
  and a small live GraphQL query to the existing CATALOGUE_GRAPHQL_ENDPOINT.
  Default source: https://catalogue.saeon.ac.za/graphql. This does not import data.
  Failed connectivity is reported separately from cached data availability.
  The configured scheduler enabled/disabled value belongs to this API process.
- ECMWF forecast cache: latest successful `ecmwf-open-data` run and its stored
  points/date range, plus latest attempt. Stale after 26 hours or when its
  forecast window ended before the current South African date. No forecast
  download is started. Source: https://www.ecmwf.int/en/forecasts/datasets/open-data.
- Municipal indicators: stored municipality coverage and non-proxy raw values.
  The stored-update time is not the source observation year. Historical values
  are not marked stale simply because their source period is old. Coverage does
  not imply complete national representation or validated source accuracy.
- Map tiles: database boundary count, publication in the internal Martin
  catalogue, and a non-empty sample vector tile at zoom/x/y 5/18/18. The
  browser/Nginx tile proxy is not exercised by this server-side check.
- NASA FIRMS: presence of FIRMS_MAP_KEY (never its value) and the current
  process's last layer download/attempt, failure flag and cached feature count.
  Source: https://firms.modaps.eosdis.nasa.gov/active_fire/.
- GDACS: equivalent process-local download/cache information, with no API key.
  Source: https://www.gdacs.org/. Both feeds refresh on demand using existing
  map endpoints; the panel never triggers upstream layer downloads. Their cache
  expires after 30 minutes. Zero successful features is not an API failure or
  evidence of zero risk. Cache state resets when the API restarts.

Network requests time out after six seconds each. SQL requests have a six-second
client timeout. Individual checks fail independently. Full results are shared
across concurrent admin requests and cached in memory for up to 30 seconds;
the displayed check timestamp belongs to that snapshot. The page refreshes
manually, and retains its previous snapshot with an explicit warning on errors.
Unknown and unconfigured checks are not reported as healthy. Responses use
Cache-Control: no-store and never return credentials, connection strings or
upstream exception details. No source data is republished or licence changed.
The admin page and its API check are excluded from usage analytics, so inspecting
operations does not add page views or repeated health-check request counts.

## Validation

Run `node --test backend/tests/data-health.test.js` with backend dependencies
available. Tests cover freshness/expiry, configuration versus confirmed feed
availability, empty data, failed/running syncs, cache sharing, admin access,
inactive-admin rejection and safe database error responses. Also run the
frontend production build and lint the changed components. In the local
preview, sign in as an admin, inspect all checks, filter to attention items,
refresh after 30 seconds, and check a narrow/mobile layout. Deployment is a separate step after local validation.

## Local feed configuration and deployment

The preview startup script inherits FIRMS_MAP_KEY from the existing local
sarva-backend container without printing the value. After changing that
container''s environment, recreate the preview using
powershell -ExecutionPolicy Bypass -File scripts/start-analytics-local.ps1 -RecreateApi
(or the equivalent PowerShell invocation from Windows). This affects only
the preview API; the shared database is retained. On-demand feed caches reset
after recreation. Visit /api/fire-detections and /api/disaster-events through
the local preview to load both feeds, then refresh Data Health after its
30-second snapshot cache expires.

For production, preserve the existing server .env and FIRMS_MAP_KEY. Use the
normal deploy/server-update.sh --check-only and deploy/server-update.sh workflow
after merging to main. No new SQL migration or boundary import is required
for Data Health. This release does not transfer local credentials or downloaded
feed caches to production. Verify feed downloads on the server separately;
local success does not establish server network access.
