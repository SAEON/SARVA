# Local analytics

Visit `/analytics` and sign in using an existing SARVA administrator account.
The account menu also links to Analytics for administrators. The summary API
checks the signed login token and the account's current active/admin status.
Registration does not grant analytics access.

The dashboard shows 7, 30 or 90 days of page views, browser-tab sessions,
popular pages, catalogue searches (including zero-result counts), API request
volume, mean response duration and errors. South African dates are used for
daily buckets. API auth/analytics calls are excluded. API paths use route
templates; query strings, raw IP addresses and account IDs are not stored. External
referrer domains and approximate audience locations may be recorded.
Counts include automated traffic and are operational estimates, not audited
unique-user counts. The public page-event endpoint validates paths and applies
a per-address in-memory rate limit; addresses are not persisted.

Coverage panels use existing local tables: catalogue records and download/spatial
metadata completeness, municipal indicator themes and proxy definitions,
distinct municipality/indicator pairs across all periods/scenarios, forecast
dates and elevated risk points (score >=3), and recent catalogue/forecast syncs.
These describe stored evidence, not national completeness or live hazard alerts.
Source and loading timestamps are displayed so stale data is visible.
Unavailable datasets display a warning rather than invented zero values.

## Setup

For this Windows checkout, after applying migrations 055 and 056, run
`powershell -ExecutionPolicy Bypass -File scripts/start-analytics-local.ps1`.
This starts separate local API/frontend containers, reusing the existing Docker
database and login configuration. Open `http://127.0.0.1:5174/analytics`.
The API binds only to `127.0.0.1:5061`; the frontend to `127.0.0.1:5174`.
The existing containers are left running. Stop the preview with
`docker stop sarva-analytics-api sarva-analytics-web`.
Frontend source is mounted live; restart `sarva-analytics-api` after backend edits.

Apply migrations using the normal backend `npm run migrate` workflow, including
`055_local_analytics.sql` and `056_audience_engagement_analytics.sql`, then restart/rebuild the backend and frontend from
this checkout. Existing containers built from another checkout do not receive
these files automatically. No external analytics provider or new credentials
are needed. Page/API recording begins after migration and restart; historical
catalogue searches are available from the existing search-event table.

For a local integration check against the configured Docker development DB:
`node backend/scripts/check-analytics.js`. This applies migrations 055 and 056 and
records it in the migration ledger, then checks current data queries and access
controls using an existing active admin. It does not print credentials or
change user accounts.

Events remain in local PostgreSQL until removed; the dashboard supports 7, 30 or 90 days, or custom periods up to 366 days. Retention can be managed locally with
`DELETE FROM sarva.analytics_event WHERE created_at < now() - interval '90 days';`.
Existing catalogue search history has its own retention policy. Raw search
terms can contain user-entered information and are visible only to admins.

## Production deployment

Apply both migrations 055 and 056 using the normal deployment script before
starting the updated backend. Visit /analytics using an active SARVA admin account.
Anonymous tracking works on the current HTTP intranet address as well as HTTPS.
Privacy signals (Do Not Track or Global Privacy Control) disable browser events.
No new API key is needed. Without explicitly trusted proxy CIDRs, audience
locations will normally show the local/private Docker network; do not enable
trust for arbitrary forwarded headers. Existing catalogue sync connectivity
problems remain separate from analytics deployment.
