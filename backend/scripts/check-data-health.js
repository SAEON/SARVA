import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from '../src/db/pool.js';

// Read-only integration check for the local Docker preview; no accounts are changed.
try {
  const admin = await pool.query(`SELECT u.id FROM sarva.app_user u
    JOIN sarva.app_user_role ur ON ur.user_id=u.id JOIN sarva.auth_role r ON r.id=ur.role_id
    WHERE u.is_active AND r.name='admin' LIMIT 1`);
  assert.ok(admin.rowCount, 'A local active administrator is required');
  const encoded = Buffer.from(JSON.stringify({ sub: String(admin.rows[0].id), roles: ['admin'], exp: Math.floor(Date.now()/1000)+60 })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.AUTH_SECRET || process.env.DB_PASSWORD || 'sarva-dev-auth-secret').update(encoded).digest('base64url');
  const url = 'http://127.0.0.1:5050/api/data-health';
  assert.equal((await fetch(url)).status, 403);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${encoded}.${signature}` }, signal: AbortSignal.timeout(25000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(body.data.cards.map(card => card.id), ['database','catalogue','forecast','municipal','boundaries','firms','gdacs']);
  assert.equal(body.data.cards.find(card => card.id === 'database').status, 'healthy');
  for (const card of body.data.cards) {
    assert.ok(card.status && card.summary && card.action);
    assert.ok(Array.isArray(card.facts));
    console.log(`${card.name}: ${card.status}`);
  }
  const text = JSON.stringify(body);
  for (const name of ['FIRMS_MAP_KEY', 'DB_PASSWORD', 'AUTH_SECRET']) {
    const value = process.env[name];
    if (value && value.length > 5) assert.ok(!text.includes(value), `${name} must never appear in the report`);
  }
  console.log('PASS live local health endpoint, active admin checks, seven independent cards, no-store and secret exclusion');
} finally { await pool.end(); }
