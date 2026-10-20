import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { freshness, syncState, onDemand, createHealthCache } from '../src/services/dataHealth.js';
import { createDataHealthRouter } from '../src/routes/dataHealth.js';

const now = Date.parse('2026-10-20T12:00:00Z');
const fresh = { finished_at: '2026-10-20T09:00:00Z' };
test('sync health distinguishes stale data, failed attempts, empty and running states', () => {
  assert.equal(freshness(null, now), 'unknown');
  assert.equal(freshness('2026-10-18T09:00:00Z', now), 'stale');
  assert.equal(syncState({ count: 20, lastSuccess: fresh, latest: { status: 'success' }, now }).status, 'healthy');
  assert.equal(syncState({ count: 20, lastSuccess: fresh, latest: { status: 'failed' }, now }).status, 'attention');
  assert.equal(syncState({ count: 20, lastSuccess: fresh, latest: { status: 'running' }, now }).status, 'syncing');
  assert.equal(syncState({ count: 0, lastSuccess: fresh, now }).status, 'empty');
  assert.equal(syncState({ count: 20, lastSuccess: null, now }).status, 'unknown');
  assert.equal(syncState({ count: 20, lastSuccess: fresh, now, expired: true }).status, 'stale');
});
test('on-demand status never treats configuration or no request as proof of availability', () => {
  assert.equal(onDemand({ configured: false }, now, 'Configure key').status, 'unconfigured');
  assert.equal(onDemand({ configured: true }, now).status, 'unknown');
  assert.equal(onDemand({ configured: true, failed: true }, now).status, 'attention');
  assert.equal(onDemand({ configured: true, updatedAt: '2026-10-20T11:50:00Z', count: 0 }, now).status, 'healthy');
  assert.equal(onDemand({ configured: true, updatedAt: fresh.finished_at }, now).status, 'stale');
});
test('health checks are shared across concurrent calls and repeated after the cache expires', async () => {
  let calls = 0, time = 0;
  const get = createHealthCache(async () => ({ version: ++calls }), () => time);
  const results = await Promise.all([get(), get(), get()]);
  assert.equal(calls, 1);
  assert.equal(results[2].version, 1);
  time = 29999;
  assert.equal((await get()).version, 1);
  time = 30001;
  assert.equal((await get()).version, 2);
});

const app = express();
let activeAdmin = true, databaseUp = true, collections = 0;
app.use('/api', createDataHealthRouter({ database: { query: async () => {
  if (!databaseUp) throw Error('sensitive internal connection information');
  return { rowCount: activeAdmin ? 1 : 0 };
} }, getHealth: async () => { collections++; return { cards: [] }; } }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(() => new Promise(resolve => server.close(resolve)));
function token(roles, expired = false) {
  const encoded = Buffer.from(JSON.stringify({ sub: '1', roles, exp: Math.floor(Date.now()/1000) + (expired ? -60 : 600) })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.AUTH_SECRET || process.env.DB_PASSWORD || 'sarva-dev-auth-secret').update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}
const request = authorization => fetch(`http://127.0.0.1:${server.address().port}/api/data-health`, { headers: { authorization } });
test('health endpoint requires a signed token and current active admin membership', async () => {
  for (const auth of ['', 'Bearer malformed', `Bearer ${token(['viewer'])}`, `Bearer ${token(['admin'], true)}`]) assert.equal((await request(auth)).status, 403);
  assert.equal(collections, 0);
  const auth = `Bearer ${token(['admin'])}`;
  activeAdmin = false;
  assert.equal((await request(auth)).status, 403);
  activeAdmin = true;
  const response = await request(auth);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(collections, 1);
  databaseUp = false;
  const unavailable = await request(auth);
  assert.equal(unavailable.status, 503);
  assert.ok(!(await unavailable.text()).includes('sensitive'));
});
