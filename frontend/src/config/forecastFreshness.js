export function isExpiredForecast(forecastDate, now = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(forecastDate || "")) return false;
    const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Johannesburg",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
    return forecastDate < today;
}
