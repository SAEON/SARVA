import geoip from 'geoip-lite';
import { isIP } from 'node:net';

export const pagePattern = /^\/(?:|explore|overview|about|glossary|resources|search|national-policy-and-legislation|municipal-risk-profiler|municipal-planning-workspace|accessibility-workspace|essential-variables|mdb-2026-boundaries|themes\/[a-z0-9-]+)$/;
export function sectionFor(path) {
  if (path === '/') return 'Home';
  if (path.startsWith('/themes/')) return 'Environmental themes';
  return ({ '/explore':'Explore', '/overview':'Overview', '/about':'About', '/glossary':'Glossary', '/resources':'Resources', '/search':'Catalogue search',
    '/national-policy-and-legislation':'Policy & legislation', '/municipal-risk-profiler':'Municipal risk profiler',
    '/municipal-planning-workspace':'Municipal planning workspace', '/mdb-2026-boundaries':'Municipal boundaries' })[path] || 'Other';
}

export function locationFor(ip) {
  const address = String(ip || '').replace(/^::ffff:/, '');
  if (!isIP(address)) return { locationSource: 'unknown' };
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(address) || /^(::1$|::$|f[cd]|fe[89ab])/i.test(address)) return { locationSource: 'local/private network' };
  const result = geoip.lookup(address);
  if (!result?.country) return { locationSource: 'unknown' };
  return { country: result.country, region: result.region || null, city: result.city || null, latitude: Number.isFinite(result.ll?.[0]) ? Math.round(result.ll[0]) : null, longitude: Number.isFinite(result.ll?.[1]) ? Math.round(result.ll[1]) : null, locationSource: 'approximate IP location' };
}

export function audienceFor(req) {
  const ua = req.get('user-agent') || '';
  const device = /bot|crawler|spider|headless/i.test(ua) ? 'Automated' : /ipad|tablet/i.test(ua) ? 'Tablet' : /mobile|android|iphone/i.test(ua) ? 'Mobile' : ua ? 'Desktop' : 'Unknown';
  const browser = /edg\//i.test(ua) ? 'Edge' : /firefox\//i.test(ua) ? 'Firefox' : /chrome|chromium|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Other';
  return { ...locationFor(req.ip || req.socket.remoteAddress), device, browser };
}

export function cleanLink(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return `${url.origin}${url.pathname}`.slice(0, 1000);
  } catch { return null; }
}

export function cleanReferrer(value) {
  if (!value) return null;
  const url = cleanLink(value);
  return url ? new URL(url).hostname : null;
}
