import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { passwordRecord, verify, sessions, limiter } from './security.mjs';
import { createServer } from './server.mjs';

const password = 'temporary-unit-test-password-only';
const record = passwordRecord('dev', password);
test('passwords are salted and wrong user/password combinations are rejected', () => {
  assert.ok(verify(record, 'dev', password));
  assert.ok(!verify(record, 'other', password));
  assert.ok(!verify(record, 'dev', 'incorrect'));
  assert.ok(!JSON.stringify(record).includes(password));
  assert.notEqual(record.digest, passwordRecord('dev', password).digest);
});
test('expired and revoked sessions fail validation; arbitrary tokens are rejected', () => {
  let now = 0;
  const store = sessions({ ttl: 1000, clock: () => now });
  const token = store.issue();
  assert.ok(store.valid(token));
  assert.ok(!store.valid('forged'));
  store.revoke(token);
  assert.ok(!store.valid(token));
  const next = store.issue();
  now = 1000;
  assert.ok(!store.valid(next));
});
test('login attempts are limited and reset after the window', () => {
  let now = 0;
  const allowed = limiter({ limit: 2, windowMs: 1000, clock: () => now });
  assert.ok(allowed('client'));
  assert.ok(allowed('client'));
  assert.ok(!allowed('client'));
  assert.ok(allowed('another-client'));
  now = 1000;
  assert.ok(allowed('client'));
});
test('unsafe HTTP production origins and missing configuration fail closed', () => {
  assert.throws(() => createServer({ record, origins: ['http://public.example'] }));
  assert.throws(() => createServer({ record, origins: ['http://public.example'], secure: false }));
  assert.throws(() => createServer({ record, origins: [] }));
  assert.throws(() => createServer({ origins: ['https://preview.example'] }));
  assert.throws(() => createServer({ record: { ...record, localOnly: true }, origins: ['https://preview.example'] }));
});

let now = 0;
const server = createServer({ record, origins: ['https://preview.example'], clock: () => now, ttl: 1000 });
server.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(() => new Promise(resolve => server.close(resolve)));
const base = `http://127.0.0.1:${server.address().port}`;
const send = (path, body, headers = {}) => fetch(base + path, { method: 'POST', redirect: 'manual', headers: { origin: 'https://preview.example', 'content-type': 'application/x-www-form-urlencoded', ...headers }, body });
test('HTTP flows preserve secure cookies, origin checks, logout and session expiry', async () => {
  const login = await fetch(base + '/__preview/login');
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.equal(login.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal((await fetch(base + '/__preview/check')).status, 401);
  assert.equal((await send('/__preview/login', new URLSearchParams({ username: 'dev', password }), { origin: 'https://evil.example' })).status, 403);
  assert.equal((await send('/__preview/login', new URLSearchParams({ username: 'dev', password: 'incorrect' }))).status, 401);
  const response = await send('/__preview/login', new URLSearchParams({ username: 'dev', password }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/');
  const rawCookie = response.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Secure']) assert.ok(rawCookie.includes(flag));
  const cookie = rawCookie.split(';')[0];
  const authenticated = path => fetch(base + path, { headers: { cookie } });
  assert.equal((await authenticated('/__preview/check')).status, 204);
  assert.equal((await send('/__preview/logout', '', { cookie, origin: 'https://evil.example' })).status, 403);
  assert.equal((await send('/__preview/logout', '', { cookie })).status, 303);
  assert.equal((await authenticated('/__preview/check')).status, 401);
  const second = await send('/__preview/login', new URLSearchParams({ username: 'dev', password }));
  now = 1000;
  assert.equal((await fetch(base + '/__preview/check', { headers: { cookie: second.headers.get('set-cookie').split(';')[0] } })).status, 401);
});
test('HTTP password attempts are throttled and malformed bodies/origins are refused', async () => {
  assert.equal((await send('/__preview/login', '', { origin: '' })).status, 403);
  assert.equal((await send('/__preview/login', '', { origin: 'null' })).status, 403);
  assert.equal((await send('/__preview/login', '{}', { 'content-type': 'application/json', 'x-real-ip': 'body-test' })).status, 415);
  assert.equal((await send('/__preview/login', 'x'.repeat(2100), { 'x-real-ip': 'body-test' })).status, 413);
  for (let i = 0; i < 10; i++) assert.equal((await send('/__preview/login', 'username=dev&password=wrong', { 'x-real-ip': 'rate-test' })).status, 401);
  const limited = await send('/__preview/login', 'username=dev&password=wrong', { 'x-real-ip': 'rate-test' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '900');
});

test('internal HTTP is limited to the explicitly configured private address', () => {
  const origin = 'http://192.168.115.77';
  const server = createServer({ record, secure: false, origins: [origin], internalOrigin: origin });
  server.close();
  assert.throws(() => createServer({ record, secure: false, origins: ['http://8.8.8.8'], internalOrigin: 'http://8.8.8.8' }));
  assert.throws(() => createServer({ record, secure: false, origins: ['http://192.168.115.78'], internalOrigin: origin }));
  assert.throws(() => createServer({ record: {...record, localOnly: true}, secure: false, origins: [origin], internalOrigin: origin }));
});
