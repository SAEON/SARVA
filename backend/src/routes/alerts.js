import { Router } from "express";

export const alertsRouter = Router();

const REQUEST_TIMEOUT_MS = 8500;
const DEFAULT_WINDOW_DAYS = 5;
const SOUTH_AFRICA_BOUNDS = {
  west: 16,
  east: 33.5,
  south: -35.5,
  north: -21.5,
};
const SOUTHERN_AFRICA_PATTERN = /\b(south africa|southern africa|africa|namibia|botswana|lesotho|eswatini|mozambique|zimbabwe|zambia|malawi|angola|madagascar)\b/i;
// Require a concrete environmental topic; generic warnings, crime and emergencies are insufficient.
const HAZARD_PATTERN = /\b(storms?|cyclones?|hurricanes?|typhoons?|tornado(?:es)?|flood(?:s|ing)?|landslides?|mudslides?|veld\s*fire|wildfires?|bushfires?|fire danger|drought|heatwaves?|heat wave|extreme heat|cold front|heavy rain|extreme rain|severe weather|dam levels|water restrictions|water shortage|earthquakes?|volcano|volcanic|tsunami|oil spill|chemical spill)\b/i;
const ENVIRONMENT_PATTERN = /\b(climate change|climate crisis|climate risk|environmental risk|environmental hazard|air quality|water quality|water security|water supply|water services|water scarcity|sanitation|biodiversity|conservation|pollution|adaptation|ecosystems?|deforestation|emissions|global warming|greenhouse gas|habitat loss|land degradation|coastal erosion|sea level rise|food security)\b/i;
const RISK_CONTEXT_PATTERN = /\b(risks?|vulnerab\w*|resilien\w*|adaptation|disaster|hazard|emergency|crisis|impacts?|threat\w*|warning|alert|response|preparedness|recovery|damage|losses|shortage|scarcity|contamination|outbreak|cholera)\b/i;
const POLICY_PATTERN = /\b(policy|legislation|regulation|strategy|framework|plans?|programme)\b/i;
const MAJOR_NEWS_FEEDS = [
  {
    id: "bbc-environment",
    name: "BBC News - Science & Environment",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    sourceUrl: "https://www.bbc.com/news/science_and_environment",
    feedCategory: "Science & Environment",
    scopeHint: "International",
  },
  {
    id: "bbc-world",
    name: "BBC News - World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    sourceUrl: "https://www.bbc.com/news/world",
    feedCategory: "World",
    scopeHint: "International",
  },
  {
    id: "cnn-world",
    name: "CNN World",
    url: "http://rss.cnn.com/rss/edition_world.rss",
    sourceUrl: "https://edition.cnn.com/world",
    feedCategory: "World",
    scopeHint: "International",
  },
  {
    id: "ap-climate",
    name: "Associated Press - Climate and Environment",
    url: "https://apnews.com/hub/climate-and-environment?output=rss",
    sourceUrl: "https://apnews.com/hub/climate-and-environment",
    feedCategory: "Climate and Environment",
    scopeHint: "International",
  },
  {
    id: "guardian-environment",
    name: "The Guardian - Environment",
    url: "https://www.theguardian.com/environment/rss",
    sourceUrl: "https://www.theguardian.com/environment",
    feedCategory: "Environment",
    scopeHint: "International",
  },
  {
    id: "dw-environment",
    name: "DW - Environment",
    url: "https://rss.dw.com/xml/rss-en-environment",
    sourceUrl: "https://www.dw.com/en/environment/s-11798",
    feedCategory: "Environment",
    scopeHint: "International",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    sourceUrl: "https://www.aljazeera.com/",
    feedCategory: "News",
    scopeHint: "International",
  },
  {
    id: "france24-africa",
    name: "France 24 - Africa",
    url: "https://www.france24.com/en/africa/rss",
    sourceUrl: "https://www.france24.com/en/africa/",
    feedCategory: "Africa",
    scopeHint: "Africa",
  },
];

function clampDays(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_WINDOW_DAYS;
  return Math.min(14, Math.max(1, Math.round(number)));
}

function cutoffDate(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function fetchText(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "SARVA public updates monitor",
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url, { accept: "application/json" }));
}

function stripTags(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSummary(value = "", fallback = "", maxLength = 220) {
  const summary = stripTags(value || fallback);
  if (summary.length <= maxLength) return summary;
  return `${summary.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function classificationText(title = "", description = "") {
  return `${title} ${description}`
    .replace(/\bdepartment of forestry,\s*fisheries and the environment\b/gi, " ")
    .replace(/\bforestry,\s*fisheries and the environment\b/gi, " ")
    .replace(/\bdepartment of environment(?:al affairs)?\b/gi, " ")
    .replace(/\bminister of (?:forestry,\s*fisheries and the environment|environment(?:al affairs)?)\b/gi, " ");
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isInWindow(value, days) {
  const date = validDate(value);
  return date ? date >= cutoffDate(days) && date <= new Date(Date.now() + 60 * 60 * 1000) : false;
}

function coordinatesInSouthAfrica(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;
  const [longitude, latitude] = coordinates.map(Number);
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= SOUTH_AFRICA_BOUNDS.west &&
    longitude <= SOUTH_AFRICA_BOUNDS.east &&
    latitude >= SOUTH_AFRICA_BOUNDS.south &&
    latitude <= SOUTH_AFRICA_BOUNDS.north
  );
}

function expandUsgsPlace(place = "") {
  return String(place)
    .replace(/,\s*CA\b/, ", California, United States")
    .replace(/,\s*AK\b/, ", Alaska, United States")
    .replace(/,\s*HI\b/, ", Hawaii, United States")
    .replace(/,\s*NV\b/, ", Nevada, United States")
    .replace(/,\s*OR\b/, ", Oregon, United States")
    .replace(/,\s*WA\b/, ", Washington, United States");
}

function sourceResult(id, name, status, count, error = null) {
  return {
    id,
    name,
    status,
    count,
    ...(error ? { error: error?.name === "AbortError" ? "Request timed out" : error.message } : {}),
  };
}

function xmlTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return stripTags(match?.[1] || "");
}

function xmlLink(item, fallback = "") {
  const link = xmlTag(item, "link");
  if (link) return link;
  const href = item.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  return stripTags(href || fallback);
}

function updateScore(record) {
  const scopeScore = record.scope === "South Africa" ? 600 : record.scope === "Southern Africa" ? 500 : 0;
  const severityScore = record.severity === "high" ? 300 : record.severity === "moderate" ? 180 : 0;
  const category = String(record.category || "").toLowerCase();
  const categoryScore =
    category.includes("hazard") || category.includes("disaster") || category.includes("emergency")
      ? 160
      : category.includes("health") || category.includes("earthquake") || category.includes("fire") || category.includes("flood")
        ? 110
        : 0;
  const date = validDate(record.published_at || record.updated_at);
  const ageHours = date ? Math.max(0, (Date.now() - date.getTime()) / (60 * 60 * 1000)) : 240;
  const recencyScore = Math.max(0, 120 - ageHours);
  return Math.round(scopeScore + severityScore + categoryScore + recencyScore);
}

function updateReason(record) {
  const parts = [];
  if (record.scope === "South Africa") parts.push("South Africa first");
  if (record.scope === "Southern Africa") parts.push("regional relevance");
  if (["high", "moderate"].includes(record.severity)) parts.push(`${record.severity} signal`);
  if (record.category) parts.push(record.category);
  return parts.join(" | ") || "recent source item";
}

export function classifyRiskRelevance(title = "", description = "") {
  const text = classificationText(title, description);
  const hazard = HAZARD_PATTERN.exec(text);
  const environment = ENVIRONMENT_PATTERN.exec(text);
  if (hazard) return { isRelevant: true, category: "Environmental hazard update", severity: "watch", reason: `environmental topic: ${hazard[0].toLowerCase()}` };
  if (environment && (RISK_CONTEXT_PATTERN.test(text) || POLICY_PATTERN.test(text))) {
    return { isRelevant: true, category: POLICY_PATTERN.test(text) ? "Environmental resilience policy" : "Environmental vulnerability and impacts", severity: "watch", reason: `environmental topic: ${environment[0].toLowerCase()}` };
  }
  return { isRelevant: false, category: "General news", severity: "watch", reason: "no explicit environmental hazard or vulnerability context" };
}

function classifyMajorNewsRelevance(title = "", description = "") {
  return classifyRiskRelevance(title, description);
}

function extractRiskTags(title = "", description = "") {
  const text = `${title} ${description}`.toLowerCase();
  const tags = [
    ["wildfire", /\b(wildfire|veld\s*fire|firewave)\b/],
    ["flood", /\b(flood|flash flood|flooding)\b/],
    ["drought", /\bdrought\b/],
    ["heatwave", /\b(heatwave|heat wave|extreme heat)\b/],
    ["storm", /\b(storm|cyclone|hurricane|typhoon|tornado|severe weather)\b/],
    ["heavy rain", /\b(heavy rain|extreme rain)\b/],
    ["earthquake", /\bearthquake\b/],
    ["volcano", /\b(volcano|volcanic)\b/],
    ["outbreak", /\b(outbreak|cholera|measles|malaria|disease)\b/],
    ["water security", /\b(water security|water supply|water shortage|water restrictions|dam levels)\b/],
    ["air quality", /\bair quality\b/],
    ["pollution", /\bpollution\b/],
    ["biodiversity", /\b(biodiversity|conservation|ecosystem)\b/],
    ["climate", /\b(climate change|climate crisis|climate risk|global warming|emissions|greenhouse gas|carbon)\b/],
    ["coastal", /\b(coastal|marine)\b/],
    ["food security", /\bfood security\b/],
  ]
    .filter(([, pattern]) => pattern.test(text))
    .map(([tag]) => tag);

  return [...new Set(tags)].slice(0, 6);
}

function withRiskMetadata(record, relevance = null) {
  return {
    ...record,
    relevance_category: relevance?.category || record.category,
    relevance_reason: relevance?.reason || record.relevance_reason,
  };
}

async function getEonetEvents(days) {
  const source = { id: "eonet", name: "NASA EONET" };
  try {
    const data = await fetchJson("https://eonet.gsfc.nasa.gov/api/v3/events");
    const records = (Array.isArray(data.events) ? data.events : [])
      .flatMap((event) => {
        const geometry = Array.isArray(event.geometry) ? event.geometry.at(-1) : null;
        const publishedAt = geometry?.date || event.closed || null;
        if (!isInWindow(publishedAt, days)) return [];
        const sourceUrl = event.sources?.find((item) => item?.url)?.url;
        const categories = Array.isArray(event.categories)
          ? event.categories.map((category) => category.title).filter(Boolean).join(", ")
          : "Natural event";
        const isLocal = coordinatesInSouthAfrica(geometry?.coordinates);

        return [{
          id: `eonet-${event.id}`,
          title: event.title || "Open natural event",
          summary: `${categories}${isLocal ? " in or near South Africa" : " tracked by NASA EONET"}.`,
          category: categories,
          severity: isLocal ? "moderate" : "watch",
          scope: isLocal ? "South Africa" : "International",
          source: source.name,
          source_url: "https://eonet.gsfc.nasa.gov/",
          event_url: sourceUrl || `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(event.id)}`,
          published_at: publishedAt,
          updated_at: publishedAt,
          validation: "Open NASA natural-events endpoint",
          kind: "update",
        }];
      });

    return { records, source: sourceResult(source.id, source.name, "live", records.length) };
  } catch (error) {
    return { records: [], source: sourceResult(source.id, source.name, "unavailable", 0, error) };
  }
}

async function getUsgsEarthquakes(days) {
  const source = { id: "usgs", name: "USGS significant earthquakes" };
  try {
    const data = await fetchJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson");
    const records = (Array.isArray(data.features) ? data.features : [])
      .flatMap((feature) => {
        const properties = feature.properties || {};
        const publishedAt = properties.time ? new Date(properties.time).toISOString() : null;
        if (!isInWindow(publishedAt, days)) return [];
        const magnitude = Number(properties.mag);
        const place = expandUsgsPlace(properties.place || "location not supplied");
        const title = expandUsgsPlace(properties.title || `Magnitude ${magnitude || ""} earthquake`);

        return [{
          id: `usgs-${feature.id}`,
          title,
          summary: `Magnitude ${Number.isFinite(magnitude) ? magnitude.toFixed(1) : "unknown"} earthquake, ${place}.`,
          category: "Earthquake",
          severity: magnitude >= 6.5 ? "high" : magnitude >= 5 ? "moderate" : "watch",
          scope: coordinatesInSouthAfrica(feature.geometry?.coordinates) ? "South Africa" : "International",
          source: source.name,
          source_url: "https://earthquake.usgs.gov/earthquakes/map/",
          event_url: properties.url || "https://earthquake.usgs.gov/earthquakes/map/",
          published_at: publishedAt,
          updated_at: publishedAt,
          validation: "USGS significant-earthquake feed",
          kind: "update",
        }];
      });

    return { records, source: sourceResult(source.id, source.name, "live", records.length) };
  } catch (error) {
    return { records: [], source: sourceResult(source.id, source.name, "unavailable", 0, error) };
  }
}

async function getGdacsEvents(days) {
  const source = { id: "gdacs", name: "GDACS disaster alerts" };
  try {
    const toDate = new Date().toISOString().slice(0, 10);
    const fromDate = cutoffDate(days).toISOString().slice(0, 10);
    const data = await fetchJson(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromDate=${fromDate}&toDate=${toDate}`);
    const records = (Array.isArray(data.features) ? data.features : [])
      .slice(0, 30)
      .flatMap((feature, index) => {
        const properties = feature.properties || {};
        const publishedAt = validDate(properties.fromdate || properties.todate || properties.date)?.toISOString();
        if (!isInWindow(publishedAt, days)) return [];
        const eventType = properties.eventtype || properties.eventtypeName || "Disaster";
        const country = properties.country || properties.countryname || properties.iso3 || "";
        const alertLevel = String(properties.alertlevel || properties.alertLevel || "").toLowerCase();
        const title = properties.name || properties.title || `${eventType} update${country ? `: ${country}` : ""}`;
        const description = properties.description || properties.htmldescription || properties.population || "";
        const text = `${title} ${description}`;
        const local =
          coordinatesInSouthAfrica(feature.geometry?.coordinates) ||
          /south africa|southern africa|lesotho|eswatini|mozambique|botswana|namibia|zimbabwe|zaf/i.test(`${text} ${country}`);
        const high = alertLevel === "red" || /\bred\b|severe|tropical cyclone|flood|earthquake/i.test(text);
        const eventUrl = properties.url?.report || properties.url?.details || properties.url || "https://www.gdacs.org/";

        return [{
          id: `gdacs-${publishedAt || index}-${title}`.slice(0, 120),
          title,
          summary: compactSummary(description, `${eventType} notice${country ? ` for ${country}` : ""}.`),
          category: eventType,
          severity: high ? "high" : "moderate",
          scope: local ? "Southern Africa" : "International",
          source: source.name,
          source_url: "https://www.gdacs.org/",
          event_url: typeof eventUrl === "string" ? eventUrl : "https://www.gdacs.org/",
          published_at: publishedAt,
          updated_at: publishedAt,
          validation: "GDACS public events API",
          kind: "update",
        }];
      });

    return { records, source: sourceResult(source.id, source.name, "live", records.length) };
  } catch (error) {
    return { records: [], source: sourceResult(source.id, source.name, "unavailable", 0, error) };
  }
}

async function getReliefWebDisasters(days) {
  const source = { id: "reliefweb", name: "ReliefWeb disasters" };
  try {
    const url = new URL("https://api.reliefweb.int/v1/disasters");
    url.search = new URLSearchParams({
      appname: "sarva",
      profile: "list",
      limit: "12",
      preset: "latest",
    });
    const data = await fetchJson(url);
    const records = (Array.isArray(data.data) ? data.data : [])
      .flatMap((row) => {
        const fields = row.fields || {};
        const publishedAt = fields.date?.created || fields.date?.changed || null;
        if (!isInWindow(publishedAt, days)) return [];
        const countries = Array.isArray(fields.country)
          ? fields.country.map((country) => country.name).filter(Boolean).join(", ")
          : "";
        const local = /south africa|lesotho|eswatini|mozambique|botswana|namibia|zimbabwe/i.test(countries);

        return [{
          id: `reliefweb-${row.id}`,
          title: fields.name || "ReliefWeb disaster update",
          summary: countries ? `Disaster update covering ${countries}.` : "Latest humanitarian disaster update.",
          category: fields.type?.[0]?.name || "Disaster update",
          severity: local ? "moderate" : "watch",
          scope: local ? "Southern Africa" : "International",
          source: source.name,
          source_url: "https://reliefweb.int/disasters",
          event_url: fields.url || "https://reliefweb.int/disasters",
          published_at: publishedAt,
          updated_at: fields.date?.changed || publishedAt,
          validation: "ReliefWeb public disasters API",
          kind: "update",
        }];
      });

    return { records, source: sourceResult(source.id, source.name, "live", records.length) };
  } catch (error) {
    return { records: [], source: sourceResult(source.id, source.name, "unavailable", 0, error) };
  }
}

async function getSouthAfricaGovernmentUpdates(days) {
  const feeds = [
    {
      id: "sanews",
      name: "SAnews government updates",
      url: "https://www.sanews.gov.za/rss.xml",
      sourceUrl: "https://www.sanews.gov.za/",
    },
    {
      id: "govza",
      name: "South African Government updates",
      url: "https://www.gov.za/rss.xml",
      sourceUrl: "https://www.gov.za/",
    },
  ];
  const records = [];
  const sourceStatuses = [];

  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed.url, { accept: "application/rss+xml,text/xml" });
      const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0, 40);
      let count = 0;

      for (const match of items) {
        const item = match[0];
        const title = xmlTag(item, "title");
        const description = xmlTag(item, "description");
        const publishedAt = validDate(xmlTag(item, "pubDate") || xmlTag(item, "dc:date"))?.toISOString();
        const link = xmlTag(item, "link") || feed.sourceUrl;
        const relevance = classifyRiskRelevance(title, description);
        if (!title || !isInWindow(publishedAt, days) || !relevance.isRelevant) continue;
        count += 1;
        records.push(withRiskMetadata({
          id: `${feed.id}-${publishedAt || count}-${title}`.slice(0, 120),
          title,
          summary: compactSummary(description, "South African public update."),
          category: relevance.category,
          severity: relevance.severity,
          scope: "South Africa",
          source: feed.name,
          source_url: feed.sourceUrl,
          event_url: link,
          published_at: publishedAt,
          updated_at: publishedAt,
          validation: "South African public RSS feed",
          kind: "update",
        }, relevance));
      }

      sourceStatuses.push(sourceResult(feed.id, feed.name, "live", count));
    } catch (error) {
      sourceStatuses.push(sourceResult(feed.id, feed.name, "unavailable", 0, error));
    }
  }

  return { records, sources: sourceStatuses };
}

async function getMajorNewsRiskUpdates(days) {
  const records = [];
  const sourceStatuses = [];

  await Promise.all(MAJOR_NEWS_FEEDS.map(async (feed) => {
    try {
      const xml = await fetchText(feed.url, { accept: "application/rss+xml,application/atom+xml,text/xml" });
      const items = [
        ...xml.matchAll(/<item[\s\S]*?<\/item>/gi),
        ...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi),
      ].slice(0, 45);
      let count = 0;

      for (const match of items) {
        const item = match[0];
        const title = xmlTag(item, "title");
        const description =
          xmlTag(item, "description") ||
          xmlTag(item, "summary") ||
          xmlTag(item, "content") ||
          xmlTag(item, "content:encoded");
        const publishedAt = validDate(
          xmlTag(item, "pubDate") ||
          xmlTag(item, "published") ||
          xmlTag(item, "updated") ||
          xmlTag(item, "dc:date"),
        )?.toISOString();
        const relevance = classifyMajorNewsRelevance(title, description);
        if (!title || !isInWindow(publishedAt, days) || !relevance.isRelevant) continue;

        const text = `${title} ${description}`;
        const localScope = /south africa/i.test(text)
          ? "South Africa"
          : SOUTHERN_AFRICA_PATTERN.test(text)
            ? "Southern Africa"
            : feed.scopeHint || "International";
        const eventUrl = xmlLink(item, feed.sourceUrl);
        count += 1;
        records.push(withRiskMetadata({
          id: `${feed.id}-${publishedAt || count}-${title}`.slice(0, 120),
          title,
          headline: title,
          url: eventUrl,
          summary: compactSummary(description, "RSS description unavailable; click through to the original article.", 180),
          tags: extractRiskTags(title, description),
          feed_category: feed.feedCategory,
          category: relevance.category,
          severity: relevance.severity,
          scope: localScope,
          source: feed.name,
          source_tier: "major_news",
          source_url: feed.sourceUrl,
          event_url: eventUrl,
          published_at: publishedAt,
          updated_at: validDate(xmlTag(item, "updated"))?.toISOString() || publishedAt,
          validation: "Major public news RSS: headline, direct link, date, short RSS description and tags only",
          kind: "update",
        }, relevance));
      }

      sourceStatuses.push(sourceResult(feed.id, feed.name, "live", count));
    } catch (error) {
      sourceStatuses.push(sourceResult(feed.id, feed.name, "unavailable", 0, error));
    }
  }));

  return { records, sources: sourceStatuses };
}

async function getNicdAlerts(days) {
  const source = { id: "nicd", name: "NICD alerts" };
  try {
    const xml = await fetchText("https://www.nicd.ac.za/category/media/alerts/feed/", {
      accept: "application/rss+xml,text/xml",
    });
    const records = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)]
      .slice(0, 30)
      .flatMap((match, index) => {
        const item = match[0];
        const title = xmlTag(item, "title");
        const description = xmlTag(item, "description") || xmlTag(item, "content:encoded");
        const publishedAt = validDate(xmlTag(item, "pubDate") || xmlTag(item, "dc:date"))?.toISOString();
        if (!title || !isInWindow(publishedAt, days)) return [];
        const text = `${title} ${description}`;
        const relevance = classifyRiskRelevance(title, description);
        if (!relevance.isRelevant) return [];
        const isHazard = /\b(outbreak|alert|warning|cholera|measles|rabies|mpox|malaria|disease|infection)\b/i.test(text);

        return [{
          id: `nicd-${publishedAt || index}-${title}`.slice(0, 120),
          title,
          summary: compactSummary(description, "South African public-health alert."),
          category: isHazard ? "Local health alert" : "Local health update",
          severity: isHazard ? "moderate" : "watch",
          scope: "South Africa",
          source: source.name,
          source_url: "https://www.nicd.ac.za/media/alerts/",
          event_url: xmlTag(item, "link") || "https://www.nicd.ac.za/media/alerts/",
          published_at: publishedAt,
          updated_at: publishedAt,
          validation: "NICD public alerts RSS feed",
          kind: "update",
        }];
      });

    return { records, source: sourceResult(source.id, source.name, "live", records.length) };
  } catch (error) {
    return { records: [], source: sourceResult(source.id, source.name, "unavailable", 0, error) };
  }
}

async function getWhoHealthUpdates(days) {
  const source = { id: "who", name: "WHO health emergency updates" };
  const keywords = /\b(outbreak|emergency|cholera|measles|mpox|ebola|dengue|malaria|pandemic|epidemic|disease|health emergency|humanitarian|flood|disaster)\b/i;

  try {
    const xml = await fetchText("https://www.who.int/rss-feeds/news-english.xml", {
      accept: "application/rss+xml,text/xml",
    });
    const records = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)]
      .slice(0, 40)
      .flatMap((match, index) => {
        const item = match[0];
        const title = xmlTag(item, "title");
        const description = xmlTag(item, "description");
        const publishedAt = validDate(xmlTag(item, "pubDate") || xmlTag(item, "a10:updated"))?.toISOString();
        const text = `${title} ${description}`;
        if (!title || !isInWindow(publishedAt, days)) return [];
        const relevance = classifyRiskRelevance(title, description);
        if (!relevance.isRelevant) return [];
        const link = xmlTag(item, "link") || "https://www.who.int/";

        return [{
          id: `who-${publishedAt || index}-${title}`.slice(0, 120),
          title,
          summary: compactSummary(description, "Global public-health update."),
          category: keywords.test(text) ? "Health emergency" : "Health update",
          severity: /\b(outbreak|emergency|cholera|mpox|ebola|pandemic|epidemic)\b/i.test(text) ? "moderate" : "watch",
          scope: "International",
          source: source.name,
          source_url: "https://www.who.int/",
          event_url: link,
          published_at: publishedAt,
          updated_at: publishedAt,
          validation: "WHO public news RSS filtered for health emergencies",
          kind: "update",
        }];
      });

    return { records, source: sourceResult(source.id, source.name, "live", records.length) };
  } catch (error) {
    return { records: [], source: sourceResult(source.id, source.name, "unavailable", 0, error) };
  }
}

alertsRouter.get("/alerts/recent", async (req, res) => {
  const days = clampDays(req.query.days);
  const results = await Promise.all([
    getSouthAfricaGovernmentUpdates(days),
    getNicdAlerts(days),
    getWhoHealthUpdates(days),
    getMajorNewsRiskUpdates(days),
    getEonetEvents(days),
    getUsgsEarthquakes(days),
    getGdacsEvents(days),
    getReliefWebDisasters(days),
  ]);

  const records = results
    .flatMap((result) => result.records)
    .sort((a, b) => updateScore(b) - updateScore(a))
    .slice(0, 40)
    .map((record) => ({
      ...record,
      relevance_score: updateScore(record),
      relevance_reason: [record.relevance_reason, updateReason(record)].filter(Boolean).join(" | "),
    }));

  res.json({
    status: "ok",
    updated_at: new Date().toISOString(),
    window_days: days,
    count: records.length,
    records,
    sources: results.flatMap((result) => result.sources || result.source),
  });
});
