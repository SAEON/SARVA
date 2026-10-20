import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiUrl } from '../config/api';
import { analyticsId } from '../config/analyticsId.js';

let currentView = null;
function send(body) {
  fetch(apiUrl('/api/analytics/events'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), keepalive: true,
  }).catch(() => {});
}

export default function AnalyticsTracker() {
  const { pathname, key } = useLocation();
  useEffect(() => {
    if (['/analytics', '/data-health'].includes(pathname) || navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
    let view;
    try {
      const now = Date.now();
      // Reuse the view during React StrictMode's development effect replay.
      if (currentView?.key === key && currentView.path === pathname) view = currentView;
      else {
        let sessionId = sessionStorage.getItem('sarva_analytics_session');
        const lastActivity = Number(sessionStorage.getItem('sarva_analytics_last_activity') || 0);
        if (!sessionId || now - lastActivity > 30 * 60000) {
          sessionId = analyticsId();
          sessionStorage.setItem('sarva_analytics_session', sessionId);
        }
        sessionStorage.setItem('sarva_analytics_last_activity', String(now));
        let referrer = '';
        try {
          const source = new URL(document.referrer);
          if (source.origin !== location.origin) referrer = source.origin;
        } catch { /* Direct navigation has no referrer. */ }
        view = { key, path: pathname, sessionId, viewId: analyticsId(), activeMs: 0, scrollDepth: 0, sent: false, referrer };
        currentView = view;
      }
    } catch { return; }
    const base = { path: view.path, sessionId: view.sessionId, viewId: view.viewId };
    if (!view.sent) { send({ ...base, kind: 'page', referrer: view.referrer }); view.sent = true; }
    let lastTick = performance.now();
    let lastInteraction = Date.now();
    let wasVisible = !document.hidden;
    const touch = () => {
      lastInteraction = Date.now();
      try { sessionStorage.setItem('sarva_analytics_last_activity', String(lastInteraction)); } catch { /* Optional storage. */ }
    };
    function sample() {
      const now = performance.now();
      if (wasVisible && Date.now() - lastInteraction < 60000) view.activeMs += Math.min(now - lastTick, 15000);
      lastTick = now;
      wasVisible = !document.hidden;
      const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      view.scrollDepth = Math.max(view.scrollDepth, Math.min(100, Math.round((window.scrollY + window.innerHeight) / Math.max(1,height) * 100)));
    }
    function flush() {
      sample();
      send({ ...base, kind: 'engagement', activeMs: Math.min(86400000, Math.round(view.activeMs)), scrollDepth: view.scrollDepth });
    }
    function click(event) {
      touch();
      if (event.type === 'auxclick' && event.button !== 1) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || anchor.closest('.sarva-auth, form, [data-analytics-ignore]')) return;
      try {
        const url = new URL(anchor.href, location.href);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname === '/analytics') return;
        const targetUrl = `${url.origin}${url.pathname}`;
        const label = (anchor.dataset.analyticsLabel || anchor.getAttribute('aria-label') || anchor.textContent || url.pathname).trim().replace(/\s+/g,' ').slice(0,120);
        const download = anchor.hasAttribute('download') || /\.(pdf|csv|xlsx?|zip|geojson|gpkg|tiff?|nc|docx?|pptx?)$/i.test(url.pathname) || /\bdownload\b/i.test(label);
        send({ ...base, kind: 'click', targetUrl, linkLabel: label, linkType: download ? 'download' : url.origin === location.origin ? 'internal' : 'outbound' });
      } catch { /* Invalid destinations are ignored. */ }
    }
    const timer = window.setInterval(flush, 15000);
    document.addEventListener('click', click, true);
    document.addEventListener('auxclick', click, true);
    document.addEventListener('keydown', touch, { passive: true });
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('scroll', touch, { passive: true });
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.clearInterval(timer);
      document.removeEventListener('click', click, true);
      document.removeEventListener('auxclick', click, true);
      document.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('scroll', touch);
      window.removeEventListener('pagehide', flush);
    };
  }, [pathname, key]);
  return null;
}
