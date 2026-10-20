import { pool } from '../db/pool.js';
import { fireHealthSnapshot } from '../routes/fireDetections.js';
import { disasterHealthSnapshot } from '../routes/disasterEvents.js';

const HOUR = 3600000;
export function freshness(timestamp, now = Date.now(), hours = 26) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return 'unknown';
  return now - time > hours * HOUR ? 'stale' : 'healthy';
}

export function syncState({ count, lastSuccess, latest, now = Date.now(), expired = false }) {
  if (!count) return { status: 'empty', summary: 'No stored data is available.' };
  if (expired || freshness(lastSuccess?.finished_at, now) === 'stale') {
    return { status: 'stale', summary: expired ? 'The stored forecast window has expired.' : 'The last successful refresh is older than 26 hours.' };
  }
  if (latest?.status === 'failed') return { status: 'attention', summary: 'The latest refresh failed; stored data remains available.' };
  if (latest?.status === 'running') return { status: 'syncing', summary: 'A refresh is recorded as running. Check its start time if it appears stuck.' };
  if (!lastSuccess?.finished_at) return { status: 'unknown', summary: 'Stored data exists, but no successful refresh time is recorded.' };
  return { status: 'healthy', summary: 'Stored data was refreshed within the last 26 hours.' };
}

const query = async (text, values = []) => (await pool.query({ text, values, query_timeout: 6000 })).rows;
const fact = (label, value) => ({ label, value: value ?? 'Not recorded' });
const number = value => Number(value || 0).toLocaleString('en-ZA');

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error('Service did not return a successful response');
  return response.json();
}

export async function collectDataHealth() {
  const checkedAt = new Date().toISOString();
  const now = Date.parse(checkedAt);
  const today = new Date(now + 2 * HOUR).toISOString().slice(0, 10);
  const check = async (base, work) => {
    try { return { ...base, checkedAt, ...await work() }; }
    catch { return { ...base, checkedAt, status: 'unavailable', summary: 'This check could not be completed.', facts: [], action: 'Check the service logs and database migrations. Other checks remain available.' }; }
  };
  const cards = await Promise.all([
    check({ id: 'database', name: 'Database', category: 'Platform' }, async () => {
      await query('SELECT 1 AS ok');
      return { status: 'healthy', summary: 'The API can query PostgreSQL.', facts: [fact('Scope', 'Connectivity only; not a backup or storage-capacity check')], action: 'Continue scheduled backups and database maintenance.' };
    }),
    check({ id: 'catalogue', name: 'SAEON catalogue', category: 'Data feed', href: '/search' }, async () => {
      const [stats, runs, successes] = await Promise.all([
        query('SELECT count(*)::int AS count FROM catalogue.catalogue_records'),
        query('SELECT status, started_at, finished_at FROM catalogue.sync_run ORDER BY started_at DESC LIMIT 1'),
        query("SELECT finished_at FROM catalogue.sync_run WHERE status='success' ORDER BY finished_at DESC NULLS LAST LIMIT 1"),
      ]);
      const count = stats[0].count, latest = runs[0], success = successes[0];
      let upstream = false;
      try {
        const payload = await jsonFetch(process.env.CATALOGUE_GRAPHQL_ENDPOINT || 'https://catalogue.saeon.ac.za/graphql', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ catalogue { search(size: 1) { totalCount } } }' }),
        });
        upstream = !payload.errors && Number.isFinite(payload.data?.catalogue?.search?.totalCount);
      } catch { /* Cached records are still checked independently. */ }
      const state = syncState({ count, lastSuccess: success, latest, now });
      if (!upstream && ['healthy', 'syncing', 'unknown'].includes(state.status)) state.status = 'attention';
      return { ...state, summary: `${state.summary}${upstream ? '' : ' The live catalogue did not respond successfully within this check.'}`,
        lastSuccessAt: success?.finished_at, lastAttemptAt: latest?.started_at,
        facts: [fact('Stored records', number(count)), fact('Latest sync', latest?.status || 'Never recorded'), fact('Live GraphQL request', upstream ? 'Responding' : 'Unavailable / timed out'), fact('Scheduled sync', process.env.CATALOGUE_SYNC_ENABLED === 'false' ? 'Disabled in this API container' : 'Enabled in this API container')],
        action: !upstream ? 'Check connectivity to the catalogue on HTTPS port 443. Cached search can still work.' : 'If stale or failed, inspect backend logs before running sync:catalogue. This panel does not start a sync.' };
    }),
    check({ id: 'forecast', name: 'ECMWF forecast cache', category: 'Data feed', href: '/#risk-map' }, async () => {
      const runs = await query("SELECT status, started_at, finished_at FROM sarva.forecast_risk_sync_run WHERE source='ecmwf-open-data' ORDER BY started_at DESC LIMIT 1");
      const successes = await query("SELECT id, finished_at FROM sarva.forecast_risk_sync_run WHERE source='ecmwf-open-data' AND status='success' ORDER BY finished_at DESC NULLS LAST LIMIT 1");
      const success = successes[0];
      const stats = await query("SELECT count(*)::int AS count, min(forecast_date)::text AS first, max(forecast_date)::text AS last FROM sarva.forecast_risk_points WHERE source='ecmwf-open-data' AND sync_run_id=$1", [success?.id || null]);
      const row = stats[0];
      return { ...syncState({ count: row.count, lastSuccess: success, latest: runs[0], now, expired: Boolean(row.last && row.last < today) }),
        lastSuccessAt: success?.finished_at, lastAttemptAt: runs[0]?.started_at,
        facts: [fact('Latest successful run · stored points', number(row.count)), fact('Forecast dates', row.first ? `${row.first} to ${row.last}` : 'No forecast window'), fact('Latest sync', runs[0]?.status || 'Never recorded')],
        action: 'Check forecast-risk-worker logs if the run is stale or failed. These are screening forecasts, not official warnings.' };
    }),
    check({ id: 'municipal', name: 'Municipal indicators', category: 'Stored evidence', href: '/municipal-risk-profiler' }, async () => {
      const [row] = await query(`SELECT count(*)::int AS count, count(DISTINCT v.municipality_gid)::int AS municipalities,
        count(*) FILTER (WHERE v.raw_value IS NOT NULL AND v.confidence IS DISTINCT FROM 'proxy' AND NOT d.is_proxy)::int AS raw,
        max(v.updated_at) AS updated FROM sarva.municipal_indicator_value v JOIN sarva.municipal_indicator_definition d ON d.key=v.indicator_key`);
      return { status: row.raw ? 'healthy' : row.count ? 'attention' : 'empty', summary: row.raw ? 'Imported raw values are stored. Coverage varies by indicator and municipality.' : 'No usable raw indicator values were found.',
        dataUpdatedAt: row.updated, facts: [fact('Stored values · all periods', number(row.count)), fact('Non-proxy raw values', number(row.raw)), fact('Municipalities represented', number(row.municipalities))],
        action: 'Review source years in the profiler. Historical indicators are not marked stale simply because their source year is old.' };
    }),
    check({ id: 'boundaries', name: 'Municipal map tiles', category: 'Map service', href: '/municipal-risk-profiler' }, async () => {
      const [row] = await query('SELECT count(*)::int AS count FROM sarva.municipal_boundaries');
      let published = false, tile = false;
      try {
        const catalogue = await jsonFetch('http://martin:3000/catalog');
        published = Boolean(catalogue.tiles?.municipal_boundaries);
        if (published) {
          const response = await fetch('http://martin:3000/municipal_boundaries/5/18/18', { signal: AbortSignal.timeout(6000) });
          tile = response.ok && (await response.arrayBuffer()).byteLength > 0;
        }
      } catch { /* Report storage and tile availability separately. */ }
      return { status: !row.count ? 'empty' : tile ? 'healthy' : 'unavailable', summary: tile ? 'Martin serves a non-empty sample boundary tile.' : row.count ? 'Boundaries exist, but the sample tile could not be served.' : 'No boundary records are stored.',
        facts: [fact('Stored boundaries', number(row.count)), fact('Published by Martin', published ? 'Yes' : 'Not confirmed'), fact('Sample vector tile', tile ? 'Available' : 'Unavailable')],
        action: row.count ? 'If unavailable, inspect Martin logs and its configuration mount. This check uses the internal tile service, not the browser proxy.' : 'Inspect the boundary import and migration history before importing data.' };
    }),
    check({ id: 'firms', name: 'NASA FIRMS fire detections', category: 'On-demand feed', href: '/#risk-map' }, async () => {
      const snapshot = fireHealthSnapshot();
      return onDemand(snapshot, now, 'FIRMS_MAP_KEY must be configured in the API environment. Never paste it into this panel.');
    }),
    check({ id: 'gdacs', name: 'GDACS regional events', category: 'On-demand feed', href: '/#risk-map' }, async () => onDemand(disasterHealthSnapshot(), now)),
  ]);
  const counts = Object.fromEntries(['healthy', 'attention', 'stale', 'unavailable', 'unconfigured', 'unknown', 'syncing', 'empty'].map(status => [status, cards.filter(card => card.status === status).length]));
  return { checkedAt, cacheSeconds: 30, counts, cards };
}

export function onDemand(snapshot, now, missingKeyAction) {
  const base = { lastSuccessAt: snapshot.updatedAt, lastAttemptAt: snapshot.lastAttemptAt,
    facts: [fact('Configuration', snapshot.configured ? 'Present; validity is checked when the layer loads' : 'Missing'), fact('Cached features', snapshot.count == null ? 'Not loaded in this API process' : number(snapshot.count)), fact('Refresh policy', 'On demand; cache expires after 30 minutes')] };
  if (!snapshot.configured) return { ...base, status: 'unconfigured', summary: 'This feed is missing required configuration.', action: missingKeyAction };
  if (snapshot.failed) return { ...base, status: 'attention', summary: 'The latest layer refresh failed.', action: 'Open the layer to retry, then check API connectivity and configuration if it fails again.' };
  if (!snapshot.updatedAt) return { ...base, status: 'unknown', summary: 'Not checked yet in this API process. Configuration alone does not confirm availability.', action: 'Open the layer on the map to request data, then refresh this panel. No upstream download is triggered here.' };
  return { ...base, status: freshness(snapshot.updatedAt, now, 0.5), summary: 'The last layer download is recorded; an empty successful response can mean no matching events.', action: 'Open the map layer to refresh an expired cache. Counts describe the cached response, not current hazard severity.' };
}

export function createHealthCache(collect = collectDataHealth, clock = Date.now) {
  let cached, pending;
  return async () => {
    if (cached && clock() - cached.at < 30000) return cached.data;
    if (!pending) pending = collect().then(data => { cached = { at: clock(), data }; return data; }).finally(() => { pending = null; });
    return pending;
  };
}
