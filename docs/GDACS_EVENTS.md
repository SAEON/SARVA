# GDACS regional disaster events

The home map exposes Regional disaster events in the Regional disaster reports category.
The server proxies the public GDACS events-by-area API for 10–55°E, 40–10°S, covering southern Africa and nearby islands. No API key is required.

`GET /api/disaster-events?days=7|30` returns validated point GeoJSON. The upstream query covers 30 days; the seven-day view filters by event end date, so long-running episodes can appear. Event episodes are deduplicated by type, event ID and episode ID. Cache refresh is on demand every 30 minutes in backend memory. This version does not persist a historical archive or show event extent polygons.

Markers use GDACS Green, Orange and Red alert levels, with grey for unknown values. These are source alert classifications, not SARVA scores or SAWS weather warnings. Popups link to GDACS event reports and show source dates. No events is distinct from an unavailable feed. Coverage is selective and does not imply the absence of disasters.

Source and API documentation: https://www.gdacs.org/gdacsapi/swagger/index.html

Verification: `node --test backend/tests/disaster-events.test.js`; `npm --prefix frontend run build`.
