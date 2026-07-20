import { Router } from "express";

export const externalServicesRouter = Router();

const REQUEST_TIMEOUT_MS = 6500;
const PRETORIA = { latitude: -25.7479, longitude: 28.2293 };

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function serviceError(name, source, error) {
  return {
    name,
    source,
    status: "unavailable",
    value: "--",
    detail: error?.name === "AbortError" ? "Request timed out" : error?.message || "Request failed",
  };
}

async function getPretoriaWeather() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(PRETORIA.latitude),
    longitude: String(PRETORIA.longitude),
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
    daily: "precipitation_sum",
    timezone: "Africa/Johannesburg",
    forecast_days: "1",
  });

  try {
    const data = await fetchJson(url);
    const temperature = data.current?.temperature_2m;
    const rain = data.daily?.precipitation_sum?.[0];

    return {
      name: "Pretoria Weather",
      source: "Open-Meteo",
      status: "live",
      value: Number.isFinite(temperature) ? `${Math.round(temperature)}°C` : "--",
      detail: Number.isFinite(rain)
        ? `Today rain forecast: ${rain} mm`
        : "Current weather model data",
      href: "https://open-meteo.com/en/docs",
    };
  } catch (error) {
    return serviceError("Pretoria Weather", "Open-Meteo", error);
  }
}

async function getWorldBankForestArea() {
  const url = "https://api.worldbank.org/v2/country/ZAF/indicator/AG.LND.FRST.ZS?format=json&per_page=1&mrv=1";

  try {
    const data = await fetchJson(url);
    const row = Array.isArray(data) ? data[1]?.[0] : null;
    const value = Number(row?.value);

    return {
      name: "Forest Area",
      source: "World Bank Indicators",
      status: "live",
      value: Number.isFinite(value) ? `${value.toFixed(1)}%` : "--",
      detail: row?.date ? `South Africa, latest available year: ${row.date}` : "South Africa environmental indicator",
      href: "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation",
    };
  } catch (error) {
    return serviceError("Forest Area", "World Bank Indicators", error);
  }
}

async function getGbifOccurrences() {
  const url = "https://api.gbif.org/v1/occurrence/search?country=ZA&limit=0";

  try {
    const data = await fetchJson(url);
    const count = Number(data.count);

    return {
      name: "Biodiversity Records",
      source: "GBIF",
      status: "live",
      value: Number.isFinite(count) ? count.toLocaleString("en-ZA") : "--",
      detail: "Occurrence records indexed for South Africa",
      href: "https://techdocs.gbif.org/en/openapi/v1/occurrence",
    };
  } catch (error) {
    return serviceError("Biodiversity Records", "GBIF", error);
  }
}

async function getEonetEvents() {
  const url = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30";

  try {
    const data = await fetchJson(url);
    const events = Array.isArray(data.events) ? data.events : [];

    return {
      name: "Natural Events",
      source: "NASA EONET",
      status: "live",
      value: events.length.toLocaleString("en-ZA"),
      detail: "Open global natural events from the last 30 days",
      href: "https://eonet.gsfc.nasa.gov/docs/v3",
    };
  } catch (error) {
    return serviceError("Natural Events", "NASA EONET", error);
  }
}

externalServicesRouter.get("/external-services", async (req, res) => {
  const services = await Promise.all([
    getPretoriaWeather(),
    getWorldBankForestArea(),
    getGbifOccurrences(),
    getEonetEvents(),
  ]);

  res.json({
    status: "ok",
    updated_at: new Date().toISOString(),
    data: services,
  });
});
