const publicLayers = new Set(["environmental-risk", "fire-risk", "forecast-risk", "heat-risk", "wind-risk"]);

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function visibleHomeForecasts(highlights, now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const part = type => parts.find(item => item.type === type).value;
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    return highlights.filter(item => publicLayers.has(item.mapMode)
        && validDate(item.forecastDate) && item.forecastDate >= today).map(explainHomeForecast);
}

export function formatForecastDate(value, compact = false) {
    if (!validDate(value)) return "Date unavailable";
    return new Intl.DateTimeFormat("en-ZA", {
        timeZone: "Africa/Johannesburg", day: "numeric", month: compact ? "short" : "long", year: "numeric",
    }).format(new Date(`${value}T12:00:00Z`));
}

export function explainHomeForecast(item) {
    if (item.mainWeatherSignal || !["environmental-risk", "fire-risk"].includes(item.mapMode)) return item;
    const match = String(item.value || "").match(/^(\d+(?:\.\d+)?)\/100/);
    const combined = item.mapMode === "environmental-risk";
    return { ...item,
        label: combined ? "Experimental weather screening score" : "Experimental fire-weather score",
        value: match ? `${match[1]} out of 100` : "Score unavailable",
        explainer: combined
            ? "The highest of SARVA's rain, heat, wind and fire-weather scores. 100 is the top of this model scale, not a 100% chance of harm or an official warning."
            : "SARVA combines modelled heat, wind and dryness on a 0–100 scale. Higher values mean a stronger model signal, not a probability of fire or an official fire-danger rating.",
    };
}
