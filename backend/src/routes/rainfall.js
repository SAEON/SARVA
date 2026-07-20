import { Router } from "express";
import pg from "pg";
import { pool as sarvaPool } from "../db/pool.js";

const { Pool } = pg;

export const rainfallRouter = Router();

let loggernetPool;

function isEnabled(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function parseList(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getLoggernetApiBase() {
  return String(process.env.LOGGERNET_API_BASE || "").trim().replace(/\/$/, "");
}

function getLoggernetRawBase() {
  return String(process.env.LOGGERNET_RAW_BASE || "https://lognet.saeon.ac.za").trim();
}

function buildLoggernetRawUrl(params = {}) {
  const rawBase = getLoggernetRawBase();
  if (!rawBase) return null;

  const url = new URL(rawBase);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  url.searchParams.set("format", "json");
  return url;
}

function buildLoggernetApiUrl(path, params = {}) {
  const base = getLoggernetApiBase();
  if (!base) return null;

  const url = new URL(path, `${base}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

function buildConfiguredUrl(value, params = {}) {
  if (!value) return null;
  const url = new URL(value);
  for (const [key, paramValue] of Object.entries(params)) {
    if (paramValue !== undefined && paramValue !== null && paramValue !== "") {
      url.searchParams.set(key, paramValue);
    }
  }
  return url;
}

function getLoggernetConfig() {
  if (process.env.LOGGERNET_DATABASE_URL) {
    return { connectionString: process.env.LOGGERNET_DATABASE_URL };
  }

  if (
    !process.env.LOGGERNET_DB_HOST ||
    !process.env.LOGGERNET_DB_NAME ||
    !process.env.LOGGERNET_DB_USER ||
    !process.env.LOGGERNET_DB_PASSWORD
  ) {
    return null;
  }

  return {
    host: process.env.LOGGERNET_DB_HOST,
    port: Number(process.env.LOGGERNET_DB_PORT || 5432),
    database: process.env.LOGGERNET_DB_NAME,
    user: process.env.LOGGERNET_DB_USER,
    password: process.env.LOGGERNET_DB_PASSWORD,
  };
}

function getLoggernetPool() {
  const config = getLoggernetConfig();
  if (!config) return null;

  if (!loggernetPool) {
    loggernetPool = new Pool({
      ...config,
      max: Number(process.env.LOGGERNET_DB_POOL_MAX || 4),
      connectionTimeoutMillis: Number(process.env.LOGGERNET_DB_CONNECT_TIMEOUT_MS || 5000),
      idleTimeoutMillis: Number(process.env.LOGGERNET_DB_IDLE_TIMEOUT_MS || 30000),
    });
  }

  return loggernetPool;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rainfallRisk(value) {
  const amount = normalizeNumber(value);
  if (amount === null) return "unknown";
  if (amount >= 50) return "very_high";
  if (amount >= 25) return "high";
  if (amount >= 10) return "moderate";
  if (amount > 0) return "low";
  return "minimal";
}

function riskLabel(risk) {
  return {
    very_high: "Very high",
    high: "High",
    moderate: "Moderate",
    low: "Low",
    minimal: "Minimal",
    unknown: "Unknown",
  }[risk] || "Unknown";
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.LOGGERNET_API_TIMEOUT_MS || 12000)
  );
  const headers = {
    accept: "application/json",
    "user-agent": process.env.LOGGERNET_API_USER_AGENT || "Mozilla/5.0 SARVA rainfall risk layer",
  };

  if (process.env.LOGGERNET_API_USERNAME && process.env.LOGGERNET_API_PASSWORD) {
    const token = Buffer.from(
      `${process.env.LOGGERNET_API_USERNAME}:${process.env.LOGGERNET_API_PASSWORD}`
    ).toString("base64");
    headers.authorization = `Basic ${token}`;
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Loggernet API returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Loggernet API returned ${contentType || "non-JSON"} response: ${text.slice(0, 80)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeLocationRow(row) {
  const station = row.display_server_name || row.station || row.server || row.name;
  if (!station) return null;

  return {
    station,
    latitude: normalizeNumber(row.latitude ?? row.lat),
    longitude: normalizeNumber(row.longitude ?? row.lon ?? row.lng),
  };
}

async function fetchLocationRows() {
  const rows = [];
  try {
    const dbRows = await sarvaPool.query(`
      SELECT
        station_name AS station,
        display_name,
        latitude,
        longitude,
        altitude
      FROM sarva.loggernet_station_locations
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
    `);
    rows.push(...dbRows.rows);
  } catch (error) {
    if (error.code !== "42P01") {
      console.warn("LoggerNet station locations could not be loaded from SARVA DB", error.message);
    }
  }

  const locationsUrl =
    buildConfiguredUrl(process.env.LOGGERNET_LOCATIONS_URL) ||
    buildLoggernetApiUrl("/api/summary_table/locations");

  if (locationsUrl) {
    const remoteRows = await fetchJson(locationsUrl).catch(() => []);
    if (Array.isArray(remoteRows)) rows.push(...remoteRows);
  }

  if (process.env.LOGGERNET_LOCATION_OVERRIDES) {
    try {
      const overrides = JSON.parse(process.env.LOGGERNET_LOCATION_OVERRIDES);
      for (const [station, location] of Object.entries(overrides || {})) {
        rows.push({
          station,
          latitude: location.latitude ?? location.lat,
          longitude: location.longitude ?? location.lon ?? location.lng,
        });
      }
    } catch (error) {
      console.warn("LOGGERNET_LOCATION_OVERRIDES is not valid JSON", error.message);
    }
  }

  return rows.map(normalizeLocationRow).filter((row) => row?.station);
}

function locationMapFromRows(locationRows) {
  const locationByStation = new Map();
  for (const row of Array.isArray(locationRows) ? locationRows : []) {
    locationByStation.set(row.station, row);
    if (row.display_name) {
      locationByStation.set(row.display_name, row);
    }
  }
  return locationByStation;
}

function normalizeApiRow(row, locationByStation) {
  const station = row.display_server_name || row.station || row.server || row.name;
  const table = row.display_table_name || row.table || "";
  const field = row.display_field_name || row.field || "";
  const location = locationByStation.get(station) || {};
  const value = normalizeNumber(row.value ?? row.field_value ?? row.rainfall);
  const risk = rainfallRisk(value);

  return {
    station,
    table,
    field,
    timestamp: row.timestamp || row.aggregated_timestamp || row.time || row.date || null,
    value,
    rawValue: row.value ?? row.field_value ?? row.rainfall ?? null,
    latitude: normalizeNumber(row.latitude ?? row.lat ?? location.latitude ?? location.lat),
    longitude: normalizeNumber(row.longitude ?? row.lon ?? row.lng ?? location.longitude ?? location.lon),
    risk,
    riskLabel: riskLabel(risk),
  };
}

function latestByStation(records) {
  const latest = new Map();

  for (const record of records) {
    const key = `${record.station || "unknown"}::${record.table || ""}`;
    const existing = latest.get(key);
    const existingTime = existing?.timestamp ? new Date(existing.timestamp).getTime() : 0;
    const recordTime = record.timestamp ? new Date(record.timestamp).getTime() : 0;

    if (!existing || recordTime >= existingTime) {
      latest.set(key, record);
    }
  }

  return Array.from(latest.values()).sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });
}

function distanceKm(a, b) {
  const radiusKm = 6371;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function idwEstimate(target, stations) {
  const nearest = stations
    .map((station) => ({
      ...station,
      distance: distanceKm(target, station),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);

  const exact = nearest.find((station) => station.distance < 1);
  if (exact) return exact.value;

  let weightedValue = 0;
  let weightTotal = 0;
  for (const station of nearest) {
    const weight = 1 / Math.max(station.distance, 1) ** 2;
    weightedValue += station.value * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? weightedValue / weightTotal : null;
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker())
  );
  return results;
}

function chooseRainfallField(fields, requestedFieldName) {
  const requestedKey = normalizeKey(requestedFieldName);

  return (Array.isArray(fields) ? fields : [])
    .map((field, index) => {
      const key = normalizeKey(field.name);
      const units = normalizeKey(field.units);
      const process = normalizeKey(field.process);
      const exactMatch = key === requestedKey;
      const requestedRainTotalMatch =
        requestedKey === "rain_tot" && key.includes("rain") && key.includes("tot");
      const rainLike = key.includes("rain") || key.includes("precip");
      let score = 0;

      if (!exactMatch && !requestedRainTotalMatch && !rainLike) return { field, index, score };
      if (exactMatch) score += 120;
      if (requestedRainTotalMatch) score += 100;
      if (key.includes(requestedKey) || (key && requestedKey.includes(key))) score += 40;
      if (key.includes("rain")) score += 50;
      if (key.includes("precip")) score += 35;
      if (key.includes("mm") || units === "mm") score += 15;
      if (key.includes("tot") || process === "tot") score += 25;
      if (key.includes("mist")) score -= 50;

      return { field, index, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0];
}

function normalizeRawRow(queryResult, tableSymbol, locationByStation, requestedFieldName) {
  const fields = queryResult?.head?.fields || [];
  const rainfallField = chooseRainfallField(fields, requestedFieldName);
  if (!rainfallField) return null;

  const rows = Array.isArray(queryResult?.data) ? [...queryResult.data] : [];
  rows.sort((a, b) => {
    const timeA = a.time ? new Date(a.time).getTime() : 0;
    const timeB = b.time ? new Date(b.time).getTime() : 0;
    return timeB - timeA;
  });

  const dataRow = rows.find((row) => normalizeNumber(row.vals?.[rainfallField.index]) !== null);
  if (!dataRow) return null;

  const station =
    queryResult.head?.environment?.station_name ||
    tableSymbol.parentName ||
    String(tableSymbol.uri || "").replace(/^Server:/, "").split(".")[0];
  const table = queryResult.head?.environment?.table_name || tableSymbol.name;
  const location = locationByStation.get(station) || {};
  const value = normalizeNumber(dataRow.vals[rainfallField.index]);
  const risk = rainfallRisk(value);
  const history = rows
    .map((row) => ({
      timestamp: row.time || null,
      value: normalizeNumber(row.vals?.[rainfallField.index]),
    }))
    .filter((row) => row.value !== null)
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

  return {
    station,
    table,
    field: rainfallField.field.name,
    timestamp: dataRow.time || null,
    value,
    rawValue: dataRow.vals[rainfallField.index],
    latitude: normalizeNumber(location.latitude ?? location.lat),
    longitude: normalizeNumber(location.longitude ?? location.lon ?? location.lng),
    risk,
    riskLabel: riskLabel(risk),
    history,
  };
}

async function fetchLatestRainfallFromRawApi({ fieldName, tableName, days }) {
  if (!isEnabled(process.env.LOGGERNET_RAW_ENABLED, true)) return null;

  const serverUrl = buildLoggernetRawUrl({ command: "browsesymbols", uri: "Server" });
  if (!serverUrl) return null;

  const serverLimit = Math.max(Number.parseInt(process.env.LOGGERNET_RAW_SERVER_LIMIT || "60", 10), 1);
  const recentRows = Math.max(Number.parseInt(process.env.LOGGERNET_RAW_RECENT_ROWS || "12", 10), 1);
  const concurrency = Math.max(Number.parseInt(process.env.LOGGERNET_RAW_CONCURRENCY || "4", 10), 1);
  const tableCandidates = parseList(process.env.LOGGERNET_RAW_TABLE_NAMES, [tableName, "daily", "public"])
    .map(normalizeKey);

  const [symbols, locationRows] = await Promise.all([fetchJson(serverUrl), fetchLocationRows()]);
  const locationByStation = locationMapFromRows(locationRows);
  const servers = (symbols?.symbols || [])
    .filter((symbol) => symbol.uri && symbol.can_expand !== false && symbol.enabled !== false)
    .slice(0, serverLimit);

  const tableGroups = await mapLimit(servers, concurrency, async (server) => {
    const tableUrl = buildLoggernetRawUrl({ command: "browsesymbols", uri: server.uri });
    const tableSymbols = await fetchJson(tableUrl).catch(() => ({ symbols: [] }));

    return (tableSymbols?.symbols || [])
      .filter((symbol) => symbol.uri && symbol.enabled !== false)
      .filter((symbol) => tableCandidates.includes(normalizeKey(symbol.name)))
      .map((symbol) => ({ ...symbol, parentName: server.name }));
  });

  const tables = tableGroups.flat();
  const records = await mapLimit(tables, concurrency, async (table) => {
    const dataUrl = buildLoggernetRawUrl({
      command: "dataquery",
      uri: table.uri,
      mode: "most-recent",
      p1: recentRows,
    });
    const queryResult = await fetchJson(dataUrl).catch(() => null);
    return queryResult ? normalizeRawRow(queryResult, table, locationByStation, fieldName) : null;
  });

  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const cleanedRecords = latestByStation(
    records
      .filter(Boolean)
      .filter((record) => !record.timestamp || new Date(record.timestamp).getTime() >= cutoffTime)
  );
  const recordsWithCoordinates = cleanedRecords.filter(
    (record) => Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
  ).length;

  return {
    source: "loggernet-raw-api",
    records: cleanedRecords,
    message:
      cleanedRecords.length > 0 && recordsWithCoordinates === 0
        ? "Live LoggerNet rainfall values loaded, but station coordinates are not configured yet."
        : null,
  };
}

async function fetchLatestRainfallFromApi({ fieldName, tableName, days }) {
  const rainfallUrl =
    buildConfiguredUrl(process.env.LOGGERNET_RAINFALL_URL, {
      field_name: fieldName,
      table_name: tableName,
      days,
    }) ||
    buildLoggernetApiUrl("/api/rainfall-data", {
      field_name: fieldName,
      table_name: tableName,
      days,
    });

  if (!rainfallUrl) return null;

  const [rainfallRows, locationRows] = await Promise.all([fetchJson(rainfallUrl), fetchLocationRows()]);

  const locationByStation = locationMapFromRows(locationRows);

  const records = (Array.isArray(rainfallRows) ? rainfallRows : [])
    .map((row) => normalizeApiRow(row, locationByStation))
    .filter((row) => row.station);

  return {
    source: "loggernet-api",
    records: latestByStation(records),
    message: null,
  };
}

async function fetchLatestRainfall({ fieldName, tableName, days }) {
  const rawApiResult = await fetchLatestRainfallFromRawApi({ fieldName, tableName, days });
  if (rawApiResult) return rawApiResult;

  const apiResult = await fetchLatestRainfallFromApi({ fieldName, tableName, days });
  if (apiResult) return apiResult;

  const pool = getLoggernetPool();
  if (!pool) {
    return {
      source: "unconfigured",
      records: [],
      message: "Loggernet API connection is not configured for SARVA.",
    };
  }

  const result = await pool.query(
    `
      WITH latest_rainfall AS (
        SELECT
          s.display_server_name,
          s.display_table_name,
          s.display_field_name,
          s.latitude,
          s.longitude,
          fv.timestamp,
          fv.value,
          ROW_NUMBER() OVER (
            PARTITION BY s.display_server_name, s.display_table_name
            ORDER BY fv.timestamp DESC
          ) AS rn
        FROM summary_table s
        JOIN field_values fv ON s.field_id = fv.field_id
        WHERE LOWER(s.display_field_name) = $1
          AND LOWER(s.display_table_name) = $2
          AND fv.timestamp >= NOW() - ($3::int * INTERVAL '1 day')
      )
      SELECT
        display_server_name,
        display_table_name,
        display_field_name,
        latitude,
        longitude,
        timestamp,
        value
      FROM latest_rainfall
      WHERE rn = 1
      ORDER BY timestamp DESC, display_server_name
    `,
    [fieldName, tableName, days]
  );

  return {
    source: "loggernet",
    records: result.rows.map((row) => {
      const value = normalizeNumber(row.value);
      const risk = rainfallRisk(value);

      return {
        station: row.display_server_name,
        table: row.display_table_name,
        field: row.display_field_name,
        timestamp: row.timestamp,
        value,
        rawValue: row.value,
        latitude: normalizeNumber(row.latitude),
        longitude: normalizeNumber(row.longitude),
        risk,
        riskLabel: riskLabel(risk),
      };
    }),
  };
}

rainfallRouter.get("/rainfall/latest", async (req, res) => {
  const fieldName = String(req.query.field_name || "rain_tot").trim().toLowerCase();
  const tableName = String(req.query.table_name || "daily").trim().toLowerCase();
  const days = Math.min(Math.max(Number.parseInt(req.query.days || "30", 10) || 30, 1), 365);

  try {
    const result = await fetchLatestRainfall({ fieldName, tableName, days });
    res.json({
      status: "ok",
      data: {
        fieldName,
        tableName,
        days,
        source: result.source,
        message: result.message || null,
        count: result.records.length,
        records: result.records,
      },
    });
  } catch (error) {
    console.error("Error fetching rainfall data", error);
    res.status(500).json({ status: "error", message: "Rainfall data could not be loaded." });
  }
});

rainfallRouter.get("/rainfall/municipal-estimates", async (req, res) => {
  const fieldName = String(req.query.field_name || "rain_tot").trim().toLowerCase();
  const tableName = String(req.query.table_name || "daily").trim().toLowerCase();
  const days = Math.min(Math.max(Number.parseInt(req.query.days || "30", 10) || 30, 1), 365);

  try {
    const rainfall = await fetchLatestRainfall({ fieldName, tableName, days });
    const stations = rainfall.records
      .map((record) => ({
        station: record.station,
        value: normalizeNumber(record.value),
        latitude: normalizeNumber(record.latitude),
        longitude: normalizeNumber(record.longitude),
      }))
      .filter(
        (record) =>
          record.value !== null &&
          Number.isFinite(record.latitude) &&
          Number.isFinite(record.longitude)
      );

    if (stations.length === 0) {
      res.json({
        status: "ok",
        data: {
          fieldName,
          tableName,
          days,
          source: rainfall.source,
          count: 0,
          stationCount: 0,
          records: [],
          message: "No located rainfall stations are available for interpolation.",
        },
      });
      return;
    }

    const municipalities = await sarvaPool.query(`
      SELECT
        gid,
        municname,
        map_title,
        province,
        ST_Y(ST_Transform(ST_PointOnSurface(geom), 4326)) AS latitude,
        ST_X(ST_Transform(ST_PointOnSurface(geom), 4326)) AS longitude
      FROM sarva.municipal_boundaries
      WHERE geom IS NOT NULL
    `);

    const records = municipalities.rows.map((municipality) => {
      const target = {
        latitude: normalizeNumber(municipality.latitude),
        longitude: normalizeNumber(municipality.longitude),
      };
      const value =
        target.latitude !== null && target.longitude !== null
          ? idwEstimate(target, stations)
          : null;
      const risk = rainfallRisk(value);

      return {
        gid: municipality.gid,
        municipality: municipality.municname || municipality.map_title,
        province: municipality.province,
        latitude: target.latitude,
        longitude: target.longitude,
        value: value === null ? null : Number(value.toFixed(2)),
        risk,
        riskLabel: riskLabel(risk),
      };
    });

    res.json({
      status: "ok",
      data: {
        fieldName,
        tableName,
        days,
        source: `${rainfall.source}-idw`,
        count: records.length,
        stationCount: stations.length,
        records,
      },
    });
  } catch (error) {
    console.error("Error interpolating municipal rainfall", error);
    res.status(500).json({ status: "error", message: "Municipal rainfall estimates could not be loaded." });
  }
});

rainfallRouter.get("/loggernet/station-locations", async (_req, res) => {
  try {
    const result = await sarvaPool.query(`
      SELECT
        station_name AS "stationName",
        display_name AS "displayName",
        longitude,
        latitude,
        altitude,
        source,
        updated_at AS "updatedAt"
      FROM sarva.loggernet_station_locations
      ORDER BY station_name
    `);

    res.json({
      status: "ok",
      data: {
        count: result.rows.length,
        records: result.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching LoggerNet station locations", error);
    res.status(500).json({ status: "error", message: "LoggerNet station locations could not be loaded." });
  }
});

rainfallRouter.get("/loggernet/field-mappings", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "100", 10) || 100, 1), 500);

  try {
    const values = [];
    let where = "";
    if (search) {
      values.push(`%${search}%`);
      where = `
        WHERE current_server_name ILIKE $1
           OR current_table_name ILIKE $1
           OR current_field_name ILIKE $1
           OR display_server_name ILIKE $1
           OR display_table_name ILIKE $1
           OR display_field_name ILIKE $1
      `;
    }
    values.push(limit);

    const result = await sarvaPool.query(
      `
        SELECT
          current_server_name AS "currentServerName",
          current_table_name AS "currentTableName",
          current_field_name AS "currentFieldName",
          display_server_name AS "displayServerName",
          display_table_name AS "displayTableName",
          display_field_name AS "displayFieldName",
          longitude,
          latitude,
          units,
          multiplier,
          aggregation_type AS "aggregationType",
          include_in_summary AS "includeInSummary",
          source,
          updated_at AS "updatedAt"
        FROM sarva.loggernet_field_mappings
        ${where}
        ORDER BY current_server_name, current_table_name, current_field_name
        LIMIT $${values.length}
      `,
      values
    );

    res.json({
      status: "ok",
      data: {
        count: result.rows.length,
        records: result.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching LoggerNet field mappings", error);
    res.status(500).json({ status: "error", message: "LoggerNet field mappings could not be loaded." });
  }
});

rainfallRouter.get("/loggernet/site-mappings", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "100", 10) || 100, 1), 500);

  try {
    const values = [];
    let where = "";
    if (search) {
      values.push(`%${search}%`);
      where = `
        WHERE station_name ILIKE $1
           OR display_name ILIKE $1
           OR description ILIKE $1
      `;
    }
    values.push(limit);

    const result = await sarvaPool.query(
      `
        SELECT
          station_name AS "stationName",
          display_name AS "displayName",
          longitude,
          latitude,
          altitude,
          description,
          image,
          website_url AS "websiteUrl",
          modal_content AS "modalContent",
          citation,
          doi,
          source,
          updated_at AS "updatedAt"
        FROM sarva.loggernet_site_mappings
        ${where}
        ORDER BY station_name
        LIMIT $${values.length}
      `,
      values
    );

    res.json({
      status: "ok",
      data: {
        count: result.rows.length,
        records: result.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching LoggerNet site mappings", error);
    res.status(500).json({ status: "error", message: "LoggerNet site mappings could not be loaded." });
  }
});

rainfallRouter.get("/rainfall-data", async (req, res) => {
  const fieldName = String(req.query.field_name || "rain_tot").trim().toLowerCase();
  const tableName = String(req.query.table_name || "daily").trim().toLowerCase();
  const days = Math.min(Math.max(Number.parseInt(req.query.days || "30", 10) || 30, 1), 365);

  try {
    const result = await fetchLatestRainfall({ fieldName, tableName, days });
    res.json(result.records);
  } catch (error) {
    console.error("Error fetching rainfall data", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
