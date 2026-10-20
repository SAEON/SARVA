import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import express from 'express';
import { pool } from '../src/db/pool.js';
import { analyticsRouter, trackApi } from '../src/routes/analytics.js';
import { locationFor, cleanLink } from '../src/utils/analyticsAudience.js';

// Local integration check; no passwords or account details are printed.
for (const migration of ['055_local_analytics.sql','056_audience_engagement_analytics.sql']) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sql = await fs.readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO sarva.schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING',[migration]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
const app = express();
app.use(express.json());
app.use(trackApi);
app.use('/api', analyticsRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const sessionId = crypto.randomUUID();
const viewId = crypto.randomUUID();
const post = body => fetch(`${base}/analytics/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/resources',sessionId,viewId,...body})});
function token(sub, roles, expired = false) {
  const encoded = Buffer.from(JSON.stringify({ sub, roles, exp: Math.floor(Date.now()/1000) + (expired ? -60 : 600) })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.AUTH_SECRET || process.env.DB_PASSWORD || 'sarva-dev-auth-secret').update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}
try {
  for (const authorization of ['', 'Bearer malformed', `Bearer ${token('1', ['admin'], true)}`, `Bearer ${token('1', ['viewer'])}`]) {
    assert.equal((await fetch(`${base}/analytics/summary`, { headers: { authorization } })).status, 403);
  }
  const admin = await pool.query(`SELECT u.id FROM sarva.app_user u JOIN sarva.app_user_role ur ON ur.user_id=u.id JOIN sarva.auth_role r ON r.id=ur.role_id WHERE r.name='admin' AND u.is_active LIMIT 1`);
  assert.ok(admin.rowCount, 'An active local administrator is needed for this check');
  const headers = { authorization: `Bearer ${token(String(admin.rows[0].id), ['admin'])}` };
  assert.equal((await fetch(`${base}/analytics/summary?days=999`, { headers })).status, 400);
  assert.equal((await fetch(`${base}/analytics/summary?from=2026-02-30&to=2026-03-01`, { headers })).status, 400);
  assert.equal((await fetch(`${base}/analytics/summary?from=2026-03-01&to=2026-02-01`, { headers })).status, 400);
  assert.equal((await fetch(`${base}/analytics/summary?from=2020-01-01&to=2026-01-01`, { headers })).status, 400);
  assert.equal((await post({kind:'page',country:'ZA',referrer:'https://example.org/private?secret=removed'})).status,202);
  assert.equal((await post({kind:'page'})).status,202);
  assert.equal((await post({kind:'engagement',activeMs:15000,scrollDepth:70})).status,202);
  assert.equal((await post({kind:'engagement',activeMs:10000,scrollDepth:40})).status,202);
  assert.equal((await post({kind:'engagement',activeMs:-1,scrollDepth:110})).status,400);
  assert.equal((await post({kind:'click',targetUrl:`https://example.org/report-${viewId}.pdf?token=removed#secret`,linkType:'download',linkLabel:'Download report'})).status,202);
  assert.equal((await post({kind:'click',targetUrl:'javascript:alert(1)',linkType:'outbound'})).status,400);
  const stored = (await pool.query('SELECT * FROM sarva.analytics_event WHERE session_id=$1 ORDER BY id',[sessionId])).rows;
  assert.equal(stored.length,2);
  assert.equal(stored[0].country,null,'Client-supplied country must not be trusted');
  assert.equal(stored[0].duration_ms,15000);
  assert.equal(stored[0].scroll_depth,70);
  assert.equal(stored[0].referrer_domain,'example.org');
  assert.equal(stored[0].section,'Resources');
  assert.equal(stored[1].target_url,`https://example.org/report-${viewId}.pdf`);
  assert.equal(cleanLink('https://user:pass@example.org/file'),null);
  assert.equal(locationFor('127.0.0.1').locationSource,'local/private network');
  assert.equal(locationFor('::ffff:192.168.1.1').country,undefined);
  assert.equal(locationFor('not-an-ip').locationSource,'unknown');
  const publicLocation = locationFor('8.8.8.8');
  assert.ok(publicLocation.country,'Bundled offline GeoIP data must be readable');
  assert.ok(!('ip' in publicLocation) && !('ll' in publicLocation));
  for (const days of [7, 30, 90]) {
    const response = await fetch(`${base}/analytics/summary?days=${days}`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.deepEqual(body.unavailable, []);
    assert.equal(body.data.daily.length, days);
    assert.ok(body.data.links.some(row => row.destination === `https://example.org/report-${viewId}.pdf`));
    console.log(`PASS ${days}-day analytics: all datasets available`);
  }
  const invalid = await fetch(`${base}/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/search?secret=example', sessionId: crypto.randomUUID() }) });
  assert.equal(invalid.status, 400);
  console.log('PASS anonymous, malformed, expired and non-admin access denied; invalid paths rejected');
  const custom = await fetch(`${base}/analytics/summary?from=2026-01-01&to=2026-01-31`,{headers});
  const customBody = await custom.json();
  assert.equal(customBody.days,31);
  assert.equal(customBody.data.daily.length,31);
  assert.equal(customBody.data.daily[0].label,'2026-01-01');
  assert.equal(customBody.data.daily.at(-1).label,'2026-01-31');
  console.log('PASS click tracking, deduplicated page views, engagement maxima, sanitisation, custom dates and offline GeoIP');
} finally {
  await pool.query('DELETE FROM sarva.analytics_event WHERE session_id=$1',[sessionId]);
  server.close();
  await pool.end();
}
