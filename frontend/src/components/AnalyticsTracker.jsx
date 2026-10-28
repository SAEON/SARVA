import { isAnalyticsPage } from "../config/analyticsPage.js";
import { browserAnalyticsEnabled, ANALYTICS_PREF_KEY, ANALYTICS_PREF_CHANGED } from "../config/analyticsPrivacy.js";
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiUrl } from '../config/api';
import { analyticsId } from '../config/analyticsId.js';
import { AUTH_TOKEN_KEY, AUTH_CHANGED_EVENT } from '../hooks/useCurrentUser';

let currentView = null;
function currentToken() {try{return localStorage.getItem(AUTH_TOKEN_KEY);}catch{return null;}}
function authHeaders(token) {return token ? {Authorization:'Bearer '+token}:{};}
function send(body, token=currentToken()) {
  if (!browserAnalyticsEnabled()) return;
  fetch(apiUrl('/api/analytics/events'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body), keepalive: true,
  }).catch(() => {});
}

export default function AnalyticsTracker() {
  const { pathname, key } = useLocation();
  const [authRevision,setAuthRevision]=useState(0);
  useEffect(()=>{const changed=event=>{if(event.type==='storage'&&event.key!==AUTH_TOKEN_KEY&&event.key!==ANALYTICS_PREF_KEY)return;currentView=null;setAuthRevision(n=>n+1);};window.addEventListener(ANALYTICS_PREF_CHANGED,changed);window.addEventListener(AUTH_CHANGED_EVENT,changed);window.addEventListener('storage',changed);return()=>{window.removeEventListener(ANALYTICS_PREF_CHANGED,changed);window.removeEventListener(AUTH_CHANGED_EVENT,changed);window.removeEventListener('storage',changed);};},[]);
  useEffect(() => {
    if (!isAnalyticsPage(pathname) || !browserAnalyticsEnabled()) return;
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
        view = { key, path: pathname, sessionId, viewId: analyticsId(), authToken: currentToken(), activeMs: 0, scrollDepth: 0, sent: false, referrer };
        currentView = view;
      }
    } catch { return; }
    const base = { path: view.path, sessionId: view.sessionId, viewId: view.viewId };
    if (!view.sent) { send({ ...base, kind: 'page', referrer: view.referrer },view.authToken); view.sent = true; }
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
      send({ ...base, kind: 'engagement', activeMs: Math.min(86400000, Math.round(view.activeMs)), scrollDepth: view.scrollDepth },view.authToken);
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
        const action = url.hostname === 'catalogue.saeon.ac.za' && /^\/records?\//.test(url.pathname) ? 'catalogue_record' : pathname === '/resources' || pathname === '/national-policy-and-legislation' ? 'resource_open' : null;
        if(action) send({...base,kind:'interaction',action},view.authToken);
        const label = (anchor.dataset.analyticsLabel || anchor.getAttribute('aria-label') || anchor.textContent || url.pathname).trim().replace(/\s+/g,' ').slice(0,120);
        const download = anchor.hasAttribute('download') || /\.(pdf|csv|xlsx?|zip|geojson|gpkg|tiff?|nc|docx?|pptx?)$/i.test(url.pathname) || /\bdownload\b/i.test(label);
        send({ ...base, kind: 'click', targetUrl, linkLabel: label, linkType: download ? 'download' : url.origin === location.origin ? 'internal' : 'outbound' },view.authToken);
      } catch { /* Invalid destinations are ignored. */ }
    }
    function interaction(event) {
      if (!event.detail || !['map_layer','municipality','catalogue_search','catalogue_record','resource_open','content_create','content_edit','content_review'].includes(event.detail.action)) return;
      touch(); send({...base,kind:'interaction',action:event.detail.action,subject:event.detail.subject},view.authToken);
    }
    const timer = window.setInterval(flush, 15000);
    window.addEventListener('sarva-analytics-interaction', interaction);
    document.addEventListener('click', click, true);
    document.addEventListener('auxclick', click, true);
    document.addEventListener('keydown', touch, { passive: true });
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('scroll', touch, { passive: true });
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.clearInterval(timer);
      window.removeEventListener('sarva-analytics-interaction', interaction);
      document.removeEventListener('click', click, true);
      document.removeEventListener('auxclick', click, true);
      document.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('scroll', touch);
      window.removeEventListener('pagehide', flush);
    };
  }, [pathname, key, authRevision]);
  return null;
}
