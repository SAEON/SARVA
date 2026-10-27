import { browserAnalyticsEnabled } from "./analyticsPrivacy.js";
// Only predefined action codes and non-sensitive identifiers are recorded.
export function trackInteraction(action, subject = null) {
 if(!browserAnalyticsEnabled())return;
 window.dispatchEvent(new CustomEvent('sarva-analytics-interaction', { detail: { action, subject } }));
}
