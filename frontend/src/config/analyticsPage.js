// Only recognised page paths; no query strings, report IDs or form values.
const pages = /^\/(?:|partners(?:\/centres-for-global-change)?|contact|explore|overview|about|glossary|resources|search|national-policy-and-legislation|municipal-risk-profiler|municipal-planning-workspace|accessibility-workspace|essential-variables|mdb-2026-boundaries|testing|admin\/users|account\/passkeys|themes\/[a-z0-9-]+)$/;
export function isAnalyticsPage(path) {
    return typeof path === 'string' && pages.test(path);
}
