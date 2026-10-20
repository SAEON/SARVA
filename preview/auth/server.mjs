import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sessions, limiter, verify } from './security.mjs';

const page = await readFile(new URL('./login.html', import.meta.url), 'utf8');
const style = await readFile(new URL('./login.css', import.meta.url));
const logo = await readFile(new URL('./branding/logo.png', import.meta.url));
const hero = await readFile(new URL('./branding/hero.jpg', import.meta.url));

export function createServer({ record, origins, secure = true, ttl = 7200000, clock = Date.now } = {}) {
  if (!record || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{128}$/.test(record.digest) || !record.username) throw Error('A valid preview credential file is required.');
  if (record.localOnly && secure) throw Error('Local short-password credentials cannot be used for an internet preview.');
  if (!origins?.length || origins.some(value => new URL(value).origin !== value)) throw Error('Configure explicit preview origins.');
  if (secure && origins.some(value => !value.startsWith('https://'))) throw Error('HTTPS is required unless local HTTP mode is explicitly enabled.');
  if (!secure && origins.some(value => !['localhost','127.0.0.1','[::1]'].includes(new URL(value).hostname))) throw Error('Local HTTP mode permits only loopback origins.');
  const store = sessions({ ttl, clock }), allowAttempt = limiter({ clock });
  const cookieName = secure ? '__Host-sarva_preview' : 'sarva_preview_local';
  function cookie(value, maxAge) { return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`; }
  function session(req) {
    const match = String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='));
    return match ? match.slice(cookieName.length + 1) : '';
  }
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    const path = new URL(req.url, 'http://preview.internal').pathname;
    const respond = (code, body, type = 'text/html; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type }); res.end(body); };
    const redirect = target => { res.writeHead(303, { Location: target }); res.end(); };
    const current = session(req), authenticated = store.valid(current);
    const readMethod = ['GET', 'HEAD'].includes(req.method);
    if (req.method === 'GET' && path === '/__preview/check') { res.writeHead(authenticated ? 204 : 401); return res.end(); }
    if (readMethod && path === '/__preview/status') return respond(200, JSON.stringify({ enabled: true, authenticated }), 'application/json');
    if (readMethod && path === '/__preview/logo.png') return respond(200, logo, 'image/png');
    if (readMethod && path === '/__preview/hero.jpg') return respond(200, hero, 'image/jpeg');
    if (readMethod && path === '/__preview/login.css') return respond(200, style, 'text/css; charset=utf-8');
    if (readMethod && path === '/__preview/login') {
      if (authenticated) return respond(200, page.replace('<!-- FORM -->', '<div class="active-note">Your preview session is active.</div><a class="primary" href="/">Continue to SARVA <span aria-hidden="true">→</span></a><form method="post" action="/__preview/logout"><button class="secondary" type="submit">End preview session</button></form>'));
      return respond(200, page.replace('<!-- FORM -->', form()));
    }
    if (req.method !== 'POST' || !['/__preview/login','/__preview/logout'].includes(path)) return respond(404, 'Not found', 'text/plain');
    if (!origins.includes(req.headers.origin)) return respond(403, 'Request origin not allowed.', 'text/plain');
    if (path === '/__preview/logout') {
      store.revoke(current);
      res.setHeader('Set-Cookie', cookie('', 0));
      return redirect('/__preview/login');
    }
    if (!allowAttempt(req.headers['x-real-ip'] || req.socket.remoteAddress)) {
      res.setHeader('Retry-After', '900');
      return respond(429, page.replace('<!-- FORM -->', form('Too many attempts. Please wait 15 minutes before trying again.')));
    }
    if (!String(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) return respond(415, 'Use the login form.', 'text/plain');
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 2048) return respond(413, 'Login request too large.', 'text/plain');
      }
      const fields = new URLSearchParams(body);
      if (!verify(record, fields.get('username'), fields.get('password'))) return respond(401, page.replace('<!-- FORM -->', form('The username or password is incorrect.')));
      store.revoke(current);
      res.setHeader('Set-Cookie', cookie(store.issue(), Math.floor(ttl / 1000)));
      return redirect('/');
    } catch { return respond(400, page.replace('<!-- FORM -->', form('The login request could not be read. Please try again.'))); }
  });
}

function form(error = '') {
  return `${error ? `<p class="error" role="alert">${error}</p>` : ''}<form method="post" action="/__preview/login"><label for="username">Dev username</label><input id="username" name="username" required autocomplete="username" maxlength="64" autofocus><label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="current-password" maxlength="256"><button class="primary" type="submit">Enter preview <span aria-hidden="true">→</span></button></form>`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const record = JSON.parse(await readFile(process.env.PREVIEW_CREDENTIAL_FILE || '/run/preview/credentials.json', 'utf8'));
    const ttlMinutes = Number(process.env.PREVIEW_SESSION_MINUTES || 120);
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 1440) throw Error('Use a session duration of 5–1440 minutes.');
    const server = createServer({ record, secure: process.env.PREVIEW_LOCAL_HTTP !== 'true', origins: (process.env.PREVIEW_ALLOWED_ORIGINS || '').split(',').filter(Boolean), ttl: ttlMinutes * 60000 });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    server.listen(8080, '0.0.0.0', () => console.log('Preview authentication service listening on port 8080.'));
  } catch { console.error('Preview authentication could not start. Check its credential file, origins and HTTPS/local mode.'); process.exitCode = 1; }
}
