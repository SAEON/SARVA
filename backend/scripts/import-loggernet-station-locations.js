import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../src/db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPath = path.join(__dirname, "..", "..", "data", "loggernet-station-locations.tsv");

const mappingHeaders = [
  "current_server_name",
  "current_table_name",
  "current_field_name",
  "display_server_name",
  "display_table_name",
  "display_field_name",
  "longitude",
  "latitude",
  "units",
  "multiplier",
  "aggregation_type",
  "include_in_summary",
];

const siteHeaders = [
  "station_name",
  "display_name",
  "longitude",
  "latitude",
  "altitude",
  "description",
  "image",
  "website_url",
  "modal_content",
  "citation",
  "doi",
];

function clean(value) {
  const text = value === undefined || value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}

function parseNumber(value) {
  const text = clean(value);
  if (text === null) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseBoolean(value) {
  const text = clean(value);
  if (text === null) return null;
  return ["1", "true", "yes", "y"].includes(text.toLowerCase());
}

function objectFromHeaders(headers, columns) {
  return Object.fromEntries(headers.map((header, index) => [header, clean(columns[index])]));
}

function parseStationTsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map((header) => header.trim());
  if (!headers.includes("station_name") || !headers.includes("longitude")) return [];

  return lines.slice(1).map((line) => objectFromHeaders(headers, line.split("\t")));
}

function parseUnifiedMappingExport(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  const headerIndex = lines.findIndex((line) => line.startsWith("Current Server Name\t"));
  if (headerIndex === -1) return [];

  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || line.startsWith("Previous") || line.startsWith("© ")) break;
    if (!line.includes("\t")) continue;

    let columns = line.split("\t");
    if (columns[0] === "" && columns.length > mappingHeaders.length) {
      columns = columns.slice(1);
    }
    if (columns.length < mappingHeaders.length) continue;

    rows.push(objectFromHeaders(mappingHeaders, columns));
  }

  return rows.filter((row) => row.current_server_name && row.current_table_name && row.current_field_name);
}

function parseSiteMappingsExport(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const headerIndex = lines.findIndex((line) => line.includes("DOI**"));
  if (headerIndex === -1) return [];

  const rows = [];
  const section = lines.slice(headerIndex + 1);

  for (let index = 0; index + siteHeaders.length <= section.length; index += siteHeaders.length) {
    const columns = section.slice(index, index + siteHeaders.length);
    const row = objectFromHeaders(siteHeaders, columns);
    if (!row.station_name) continue;
    rows.push(row);
  }

  return rows;
}

function stationRowsFromStationTsv(rows) {
  return rows
    .map((row) => ({
      stationName: row.station_name,
      displayName: row.display_name,
      longitude: parseNumber(row.longitude),
      latitude: parseNumber(row.latitude),
      altitude: parseNumber(row.altitude),
      description: row.description,
      source: row.source || "loggernet-site-mapping",
      rawMapping: row,
    }))
    .filter((row) => row.stationName && row.longitude !== null && row.latitude !== null);
}

function stationRowsFromMappings(rows) {
  const stations = new Map();

  for (const row of rows) {
    const longitude = parseNumber(row.longitude);
    const latitude = parseNumber(row.latitude);
    if (longitude === null || latitude === null) continue;

    const stationName = row.current_server_name;
    if (!stationName || stations.has(stationName)) continue;

    stations.set(stationName, {
      stationName,
      displayName: row.display_server_name || stationName,
      longitude,
      latitude,
      altitude: null,
      description: null,
      source: "loggernet-unified-mapping",
      rawMapping: row,
    });
  }

  return Array.from(stations.values());
}

function stationRowsFromSiteMappings(rows) {
  return rows
    .map((row) => ({
      stationName: row.station_name,
      displayName: row.display_name || row.station_name,
      longitude: parseNumber(row.longitude),
      latitude: parseNumber(row.latitude),
      altitude: parseNumber(row.altitude),
      description: row.description,
      source: "loggernet-site-mapping",
      rawMapping: row,
    }))
    .filter((row) => row.stationName && row.longitude !== null && row.latitude !== null);
}

async function upsertFieldMapping(client, row) {
  await client.query(
    `
      INSERT INTO sarva.loggernet_field_mappings
        (
          current_server_name,
          current_table_name,
          current_field_name,
          display_server_name,
          display_table_name,
          display_field_name,
          longitude,
          latitude,
          units,
          multiplier,
          aggregation_type,
          include_in_summary,
          source,
          raw_mapping
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      ON CONFLICT (current_server_name, current_table_name, current_field_name) DO UPDATE SET
        display_server_name = EXCLUDED.display_server_name,
        display_table_name = EXCLUDED.display_table_name,
        display_field_name = EXCLUDED.display_field_name,
        longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude,
        units = EXCLUDED.units,
        multiplier = EXCLUDED.multiplier,
        aggregation_type = EXCLUDED.aggregation_type,
        include_in_summary = EXCLUDED.include_in_summary,
        source = EXCLUDED.source,
        raw_mapping = EXCLUDED.raw_mapping,
        updated_at = now()
    `,
    [
      row.current_server_name,
      row.current_table_name,
      row.current_field_name,
      row.display_server_name,
      row.display_table_name,
      row.display_field_name,
      parseNumber(row.longitude),
      parseNumber(row.latitude),
      row.units,
      parseNumber(row.multiplier),
      row.aggregation_type,
      parseBoolean(row.include_in_summary),
      "loggernet-unified-mapping",
      JSON.stringify(row),
    ]
  );
}

async function upsertSiteMapping(client, row) {
  await client.query(
    `
      INSERT INTO sarva.loggernet_site_mappings
        (
          station_name,
          display_name,
          longitude,
          latitude,
          altitude,
          description,
          image,
          website_url,
          modal_content,
          citation,
          doi,
          source,
          raw_mapping
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      ON CONFLICT (station_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude,
        altitude = EXCLUDED.altitude,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        website_url = EXCLUDED.website_url,
        modal_content = EXCLUDED.modal_content,
        citation = EXCLUDED.citation,
        doi = EXCLUDED.doi,
        source = EXCLUDED.source,
        raw_mapping = EXCLUDED.raw_mapping,
        updated_at = now()
    `,
    [
      row.station_name,
      row.display_name,
      parseNumber(row.longitude),
      parseNumber(row.latitude),
      parseNumber(row.altitude),
      row.description,
      row.image,
      row.website_url,
      row.modal_content,
      row.citation,
      row.doi,
      "loggernet-site-mapping",
      JSON.stringify(row),
    ]
  );
}

async function upsertStationLocation(client, row) {
  await client.query(
    `
      INSERT INTO sarva.loggernet_station_locations
        (station_name, display_name, longitude, latitude, altitude, description, source, raw_mapping)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (station_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude,
        altitude = EXCLUDED.altitude,
        description = EXCLUDED.description,
        source = EXCLUDED.source,
        raw_mapping = EXCLUDED.raw_mapping,
        updated_at = now()
    `,
    [
      row.stationName,
      row.displayName,
      row.longitude,
      row.latitude,
      row.altitude,
      row.description,
      row.source,
      JSON.stringify(row.rawMapping),
    ]
  );
}

async function readInput(filePath) {
  if (filePath === "-") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }

  return fs.readFile(path.resolve(filePath), "utf8");
}

async function run() {
  const filePath = process.argv[2] || defaultPath;
  const text = await readInput(filePath);
  const stationTsvRows = parseStationTsv(text);
  const mappingRows = parseUnifiedMappingExport(text);
  const siteMappingRows = parseSiteMappingsExport(text);
  const stationRows = [
    ...stationRowsFromStationTsv(stationTsvRows),
    ...stationRowsFromMappings(mappingRows),
    ...stationRowsFromSiteMappings(siteMappingRows),
  ];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const row of mappingRows) {
      await upsertFieldMapping(client, row);
    }

    for (const row of siteMappingRows) {
      await upsertSiteMapping(client, row);
    }

    for (const row of stationRows) {
      await upsertStationLocation(client, row);
    }

    await client.query("COMMIT");
    console.log(
      `Imported ${mappingRows.length} field mappings, ${siteMappingRows.length} site mappings and ${stationRows.length} station locations`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(`LoggerNet mapping import failed: ${error.message}`);
  process.exit(1);
});
