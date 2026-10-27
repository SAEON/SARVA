import { visitorIpHash } from '../utils/analyticsVisitor.js';
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { analyticsIdentity, interactionFields } from '../utils/analyticsIdentity.js';
import { analyticsInsights } from './analyticsInsights.js';
import { requireAdmin } from '../utils/authSession.js';
import { pagePattern, sectionFor, audienceFor, cleanLink, cleanReferrer } from '../utils/analyticsAudience.js';

export const analyticsRouter = Router();
analyticsRouter.use(analyticsInsights);
let lastWarning = 0;
export function recordAnalytics(kind, path, sessionId = null, status = null, duration = null) {
  // Recording must never prevent a page or API response from completing.
  pool.query('INSERT INTO sarva.analytics_event (kind,path,session_id,status_code,duration_ms) VALUES ($1,$2,$3,$4,$5)',
    [kind, path, sessionId, status, duration]).catch(() => {
    if (Date.now() - lastWarning > 60000) {
      console.warn('Local analytics recording unavailable; check migration 055.');
      lastWarning = Date.now();
    }
  });
}

export function trackApi(req, res, next) {
  const start = performance.now();
  res.once('finish', () => {
    if (!req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/api/analytics') || req.originalUrl.startsWith('/api/auth') || req.originalUrl.split('?')[0] === '/api/data-health') return;
    // Store route templates, never query strings, credentials or arbitrary URL values.
    const route = req.route?.path;
    if (typeof route === 'string') recordAnalytics('api', `${req.baseUrl || ''}${route}`, null, res.statusCode, Math.round(performance.now() - start));
  });
  next();
}

// Bounded browser events. Identity is server-verified; Raw IPs stay in memory; only a keyed hash is saved for aggregate counts.
const buckets = new Map();
analyticsRouter.post('/analytics/events', async (req, res) => {
  if (req.get('Sec-GPC') === '1' || req.get('DNT') === '1') return res.sendStatus(204);
  const { path, sessionId, viewId, kind = 'page' } = req.body || {};
  const idPattern = /^[a-zA-Z0-9-]{16,64}$/;
  if (typeof path !== 'string' || !pagePattern.test(path) || typeof sessionId !== 'string' || !idPattern.test(sessionId)
    || !['page','click','engagement','interaction'].includes(kind) || typeof viewId !== 'string' || !idPattern.test(viewId)) return res.sendStatus(400);
  const now = Date.now();
  const key = req.socket.remoteAddress || 'local';
  if (buckets.size > 10000) buckets.clear();
  const bucket = buckets.get(key);
  const next = !bucket || now - bucket.start > 60000 ? { start: now, count: 1 } : { ...bucket, count: bucket.count + 1 };
  buckets.set(key, next);
  if (next.count > 600) return res.sendStatus(429);
  try {
    const identity = await analyticsIdentity(req, pool);
    if (kind === 'engagement') {
      const { activeMs, scrollDepth } = req.body;
      if (!Number.isInteger(activeMs) || activeMs < 0 || activeMs > 86400000 || !Number.isInteger(scrollDepth) || scrollDepth < 0 || scrollDepth > 100) return res.sendStatus(400);
      await pool.query(`UPDATE sarva.analytics_event SET duration_ms=greatest(coalesce(duration_ms,0),$1),scroll_depth=greatest(coalesce(scroll_depth,0),$2)
        WHERE kind='page' AND view_id=$3 AND session_id=$4 AND path=$5 AND user_id IS NOT DISTINCT FROM $6::bigint`, [activeMs,scrollDepth,viewId,sessionId,path,identity.userId]);
    } else {
      const audience = audienceFor(req);
      const interaction = kind === 'interaction' ? interactionFields(req.body) : null;
      if (kind === 'interaction' && !interaction) return res.sendStatus(400);
      const target = kind === 'click' ? cleanLink(req.body.targetUrl) : null;
      const linkType = kind === 'click' ? req.body.linkType : null;
      if (kind === 'click' && (!target || !['internal','outbound','download'].includes(linkType))) return res.sendStatus(400);
      const label = kind === 'click' && typeof req.body.linkLabel === 'string' ? req.body.linkLabel.replace(/[\x00-\x1f]/g,'').slice(0,120) : null;
      await pool.query(`INSERT INTO sarva.analytics_event
        (kind,path,session_id,view_id,section,country,region,city,location_source,device,browser,referrer_domain,target_url,link_label,link_type,duration_ms,user_id,audience_type,latitude,longitude,action,subject,visitor_ip_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT DO NOTHING`,
      [kind,path,sessionId,viewId,sectionFor(path),audience.country,audience.region,audience.city,audience.locationSource,audience.device,audience.browser,
        cleanReferrer(req.body.referrer),target,label,linkType,kind === 'page' ? 0 : null,identity.userId,identity.audienceType,audience.latitude,audience.longitude,interaction?.action,interaction?.subject,visitorIpHash(req)]);
    }
    res.sendStatus(202);
  } catch { res.status(503).json({ message: 'Analytics recording unavailable' }); }
});

analyticsRouter.get('/analytics/summary', (req, res, next) => {
  try { requireAdmin(req, res, next); } catch { res.status(403).json({ message: 'Admin access required' }); }
}, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let days = Number(req.query.days || 30);
  let from, to;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
  if (req.query.from || req.query.to) {
    if (!validDate(req.query.from) || !validDate(req.query.to)) return res.status(400).json({ message: 'Use valid start and end dates' });
    from = req.query.from;
    to = req.query.to;
    days = Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
    if (days < 1 || days > 366 || to > today) return res.status(400).json({ message: 'Choose up to 366 days, ending today or earlier' });
  } else {
    if (![7,30,90].includes(days)) return res.status(400).json({ message: 'Choose 7, 30 or 90 days' });
    to = today;
    from = new Date(Date.parse(today)-(days-1)*86400000).toISOString().slice(0,10);
  }
  const range = [`${from}T00:00:00+02:00`,new Date(Date.parse(`${to}T00:00:00+02:00`)+86400000).toISOString()];
  // Recheck current account/role in the database, rather than relying on an old token role.
  try {
    const access = await pool.query(`SELECT 1 FROM sarva.app_user u JOIN sarva.app_user_role ur ON ur.user_id=u.id
      JOIN sarva.auth_role r ON r.id=ur.role_id WHERE u.id=$1 AND u.is_active AND r.name='admin'`, [req.authUser.sub]);
    if (!access.rowCount) return res.status(403).json({ message: 'Admin access required' });
    const queries = {
      usage: [`SELECT count(*) FILTER (WHERE kind='page')::int AS views,
        count(DISTINCT session_id) FILTER (WHERE kind='page')::int AS sessions,
        count(DISTINCT visitor_ip_hash) FILTER (WHERE kind='page')::int AS unique_ips,
        count(*) FILTER (WHERE kind='page' AND visitor_ip_hash IS NULL)::int AS ip_unavailable_views,
        min(created_at) FILTER (WHERE kind='page' AND visitor_ip_hash IS NOT NULL) AS ip_tracking_since,
        count(*) FILTER (WHERE kind='api')::int AS requests,
        count(*) FILTER (WHERE kind='api' AND status_code>=500)::int AS errors,
        count(*) FILTER (WHERE kind='click')::int AS clicks,
        count(*) FILTER (WHERE kind='click' AND link_type='outbound')::int AS outbound,
        count(*) FILTER (WHERE kind='click' AND link_type='download')::int AS downloads,
        round(sum(duration_ms) FILTER (WHERE kind='page')/1000.0) AS active_seconds,
        round(avg(duration_ms) FILTER (WHERE kind='api')) AS latency,
        min(created_at) AS first_event FROM sarva.analytics_event WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`, range],
      daily: [`SELECT to_char(day,'YYYY-MM-DD') AS label, count(e.id)::int AS count
        FROM generate_series(($1::timestamptz AT TIME ZONE 'Africa/Johannesburg')::date,
          ($2::timestamptz AT TIME ZONE 'Africa/Johannesburg')::date-1,interval '1 day') day
        LEFT JOIN sarva.analytics_event e ON (e.created_at AT TIME ZONE 'Africa/Johannesburg')::date=day::date AND e.kind='page'
        GROUP BY day ORDER BY day`, range],
      pages: [`SELECT path AS label,count(*)::int AS count FROM sarva.analytics_event WHERE kind='page'
        AND created_at >= $1::timestamptz AND created_at < $2::timestamptz GROUP BY path ORDER BY count(*) DESC,path LIMIT 10`, range],
      endpoints: [`SELECT path AS label,count(*)::int AS count,round(avg(duration_ms)) AS latency,
        count(*) FILTER (WHERE status_code>=400)::int AS errors FROM sarva.analytics_event WHERE kind='api'
        AND created_at >= $1::timestamptz AND created_at < $2::timestamptz GROUP BY path ORDER BY count(*) DESC,path LIMIT 10`, range],
      searches: [`SELECT count(*)::int AS total,count(*) FILTER (WHERE result_count=0)::int AS empty
        FROM catalogue.search_event WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`, range],
      terms: [`SELECT left(trim(search_text),120) AS label,count(*)::int AS count FROM catalogue.search_event
        WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz AND nullif(trim(search_text),'') IS NOT NULL
        GROUP BY left(trim(search_text),120) ORDER BY count(*) DESC LIMIT 10`, range],
      sections: [`SELECT coalesce(section,'Earlier tracking (unclassified)') AS label,
        count(*) FILTER (WHERE kind='page')::int AS views, count(DISTINCT session_id) FILTER (WHERE kind='page')::int AS sessions,
        count(*) FILTER (WHERE kind='click')::int AS clicks,
        round(avg(duration_ms) FILTER (WHERE kind='page' AND view_id IS NOT NULL)/1000.0) AS avg_seconds,
        round(avg(scroll_depth) FILTER (WHERE kind='page')) AS avg_scroll
        FROM sarva.analytics_event WHERE kind IN ('page','click') AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
        GROUP BY section ORDER BY views DESC,label`, range],
      locations: [`SELECT country,coalesce(region,'Unknown') AS region,coalesce(city,'Unknown') AS city,
        coalesce(location_source,'Earlier tracking (unknown)') AS source,count(*)::int AS views,count(DISTINCT session_id)::int AS sessions
        FROM sarva.analytics_event WHERE kind='page' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
        GROUP BY country,region,city,location_source ORDER BY views DESC,country,region,city LIMIT 100`, range],
      geographySections: [`SELECT country,coalesce(section,'Earlier tracking (unclassified)') AS section,
        count(*)::int AS views,count(DISTINCT session_id)::int AS sessions
        FROM sarva.analytics_event WHERE kind='page' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
        GROUP BY country,section ORDER BY views DESC,country,section LIMIT 100`, range],
      links: [`SELECT path,link_label AS label,target_url AS destination,link_type AS type,count(*)::int AS clicks,count(DISTINCT session_id)::int AS sessions
        FROM sarva.analytics_event WHERE kind='click' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
        GROUP BY path,link_label,target_url,link_type ORDER BY clicks DESC,target_url LIMIT 100`, range],
      referrals: [`SELECT coalesce(referrer_domain,'Direct / internal / unavailable') AS label,count(*)::int AS entries,count(DISTINCT session_id)::int AS sessions
        FROM (SELECT DISTINCT ON (session_id) session_id,referrer_domain FROM sarva.analytics_event
          WHERE kind='page' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz ORDER BY session_id,created_at,id) entry
        GROUP BY referrer_domain ORDER BY entries DESC,label LIMIT 50`, range],
      devices: [`SELECT coalesce(device,'Earlier tracking (unknown)') AS device,coalesce(browser,'Unknown') AS browser,count(*)::int AS views,count(DISTINCT session_id)::int AS sessions
        FROM sarva.analytics_event WHERE kind='page' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
        GROUP BY device,browser ORDER BY views DESC,device,browser`, range],
      journeys: [`SELECT path AS entry,exit_path AS exit,count(*)::int AS sessions FROM
        (SELECT DISTINCT ON (session_id) session_id,path,last_value(path) OVER (PARTITION BY session_id ORDER BY created_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS exit_path
        FROM sarva.analytics_event WHERE kind='page' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz ORDER BY session_id,created_at,id) visits
        GROUP BY path,exit_path ORDER BY sessions DESC,path,exit_path LIMIT 50`, range],
      transitions: [`SELECT path AS origin,next_path AS destination,count(*)::int AS transitions FROM
        (SELECT path,lead(path) OVER (PARTITION BY session_id ORDER BY created_at,id) AS next_path FROM sarva.analytics_event
         WHERE kind='page' AND created_at >= $1::timestamptz AND created_at < $2::timestamptz) steps
        WHERE next_path IS NOT NULL AND next_path<>path GROUP BY path,next_path ORDER BY transitions DESC,path,next_path LIMIT 50`, range],
      catalogue: [`SELECT count(*)::int AS records,count(DISTINCT provider_name)::int AS providers,
        count(*) FILTER (WHERE download_url IS NOT NULL AND download_url<>'')::int AS downloadable,
        count(*) FILTER (WHERE spatial_north IS NOT NULL AND spatial_south IS NOT NULL AND spatial_east IS NOT NULL AND spatial_west IS NOT NULL)::int AS spatial,
        max(updated_at) AS updated FROM catalogue.catalogue_records`, []],
      indicators: [`SELECT d.theme AS label,count(DISTINCT d.key)::int AS indicators,
        count(DISTINCT d.key) FILTER (WHERE d.is_proxy)::int AS proxies,
        count(DISTINCT v.municipality_gid)::int AS municipalities,
        count(DISTINCT (v.municipality_gid,v.indicator_key)) FILTER (WHERE v.municipality_gid IS NOT NULL)::int AS pairs,
        max(v.updated_at) AS updated FROM sarva.municipal_indicator_definition d
        LEFT JOIN sarva.municipal_indicator_value v ON v.indicator_key=d.key GROUP BY d.theme ORDER BY d.theme`, []],
      forecast: [`SELECT forecast_date::text AS label,count(*)::int AS points,
        count(*) FILTER (WHERE risk_score>=3)::int AS elevated,max(created_at) AS updated
        FROM sarva.forecast_risk_points GROUP BY forecast_date ORDER BY forecast_date DESC LIMIT 7`, []],
      syncs: [`SELECT 'Catalogue' AS source,status,started_at,finished_at FROM catalogue.sync_run
        UNION ALL SELECT 'Forecast' AS source,status,started_at,finished_at FROM sarva.forecast_risk_sync_run
        ORDER BY started_at DESC LIMIT 10`, []],
    };
    const data = {}, unavailable = [];
    await Promise.all(Object.entries(queries).map(async ([name, [sql, args]]) => {
      try { data[name] = (await pool.query(sql, args)).rows; }
      catch { data[name] = null; unavailable.push(name); }
    }));
    res.json({ data, unavailable, days, from, to, generatedAt: new Date().toISOString() });
  } catch {
    res.status(503).json({ message: 'Analytics database unavailable' });
  }
});
