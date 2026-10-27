export const ANALYTICS_PREF_KEY = "sarva_optional_analytics";
export const ANALYTICS_PREF_CHANGED = "sarva-analytics-preference-changed";
export function analyticsPrivacySignal(scope = globalThis) {
 return Boolean(scope.navigator?.globalPrivacyControl || scope.navigator?.doNotTrack === "1");
}
export function browserAnalyticsEnabled(scope = globalThis) {
 if (analyticsPrivacySignal(scope)) return false;
 try { return scope.localStorage.getItem(ANALYTICS_PREF_KEY) !== "off"; } catch { return false; }
}
export function setBrowserAnalytics(enabled, scope = globalThis) {
 try {
  scope.localStorage.setItem(ANALYTICS_PREF_KEY, enabled ? "on" : "off");
  if (!enabled) {
   scope.sessionStorage.removeItem("sarva_analytics_session");
   scope.sessionStorage.removeItem("sarva_analytics_last_activity");
  }
  scope.dispatchEvent(new scope.Event(ANALYTICS_PREF_CHANGED));
  return true;
 } catch { return false; }
}
