export function profilerMetricFromSearch(search) {
    const metric = new URLSearchParams(search).get("metric");
    return /^indicator:[a-z][a-z0-9_]*$/.test(metric || "") ? metric : "indicator:crime_murder";
}
