// Only predefined action codes and non-sensitive identifiers are recorded.
export function trackInteraction(action, subject = null) {
 if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
 window.dispatchEvent(new CustomEvent('sarva-analytics-interaction', { detail: { action, subject } }));
}
