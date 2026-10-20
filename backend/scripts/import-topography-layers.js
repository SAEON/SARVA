import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../src/db/pool.js";

const DATA_DIR = process.env.TOPOGRAPHY_DATA_DIR || "/data/topography";
const SOURCE_NAME = process.env.TOPOGRAPHY_SOURCE_NAME || "Processed DEM-derived topography";
const SOURCE_URL = process.env.TOPOGRAPHY_SOURCE_URL || "";
const SOURCE_DATE = process.env.TOPOGRAPHY_SOURCE_DATE || "";
const PROCESSING_NOTE = process.env.TOPOGRAPHY_PROCESSING_NOTE || "Preprocessed to GeoJSON before SARVA import.";
const CONTOUR_INTERVAL_M = Number(process.env.TOPOGRAPHY_CONTOUR_INTERVAL || "20");
const BATCH_SIZE = 250;

const DATASETS = [
  {
    key: "contours",
    table: "topography_contours",
    file: "topography_contours.geojson",
    geometryType: "MULTILINESTRING",
    allowedGeometryTypes: new Set(["LineString", "MultiLineString"]),
    columns: [
      ["elevation_m", "integer", (p) => numberOrNull(p.elevation_m ?? p.elevation ?? p.ELEV ?? p.CONTOUR)],
      ["contour_interval_m", "integer", (p) => numberOrNull(p.contour_interval_m ?? p.interval_m) || CONTOUR_INTERVAL_M],
    ],
  },
  {
    key: "slope zones",
    table: "topography_slope_zones",
    file: "topography_slope_zones.geojson",
    geometryType: "MULTIPOLYGON",
    allowedGeometryTypes: new Set(["Polygon", "MultiPolygon"]),
    columns: [
      ["slope_class", "text", (p) => textOrNull(p.slope_class ?? p.class ?? p.CLASS) || "unspecified"],
      ["slope_min_degrees", "numeric", (p) => numberOrNull(p.slope_min_degrees ?? p.min_degrees ?? p.MIN)],
      ["slope_max_degrees", "numeric", (p) => numberOrNull(p.slope_max_degrees ?? p.max_degrees ?? p.MAX)],
    ],
  },
];

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readGeoJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`Clearing dataset for ${fileName}; file not found in ${DATA_DIR}`);
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(payload.features)) {
    throw new Error(`${fileName} does not contain a FeatureCollection`);
  }
  return payload.features;
}

async function truncateTable(client, dataset) {
  await client.query(`TRUNCATE sarva.${dataset.table} RESTART IDENTITY`);
}

async function insertBatch(client, dataset, features) {
  if (features.length === 0) return;

  const extraColumns = ["source_name", "source_url", "source_date", "processing_note", "geom"];
  const columnNames = [...dataset.columns.map(([name]) => name), ...extraColumns];
  const valueWidth = columnNames.length;
  const params = [];

  const rows = features.map((feature, rowIndex) => {
    const properties = feature.properties || {};
    for (const [, , getter] of dataset.columns) {
      params.push(getter(properties));
    }
    params.push(SOURCE_NAME);
    params.push(SOURCE_URL || null);
    params.push(SOURCE_DATE || null);
    params.push(PROCESSING_NOTE);
    params.push(JSON.stringify(feature.geometry));

    const offset = rowIndex * valueWidth;
    const placeholders = dataset.columns.map((_, index) => `$${offset + index + 1}`);
    const sourceNameIndex = offset + dataset.columns.length + 1;
    const sourceUrlIndex = sourceNameIndex + 1;
    const sourceDateIndex = sourceNameIndex + 2;
    const processingNoteIndex = sourceNameIndex + 3;
    const geometryIndex = sourceNameIndex + 4;
    placeholders.push(`$${sourceNameIndex}`);
    placeholders.push(`$${sourceUrlIndex}`);
    placeholders.push(`$${sourceDateIndex}`);
    placeholders.push(`$${processingNoteIndex}`);
    placeholders.push(`ST_Transform(ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($${geometryIndex})), 4326), 3857)`);
    return `(${placeholders.join(", ")})`;
  });

  await client.query(
    `INSERT INTO sarva.${dataset.table} (${columnNames.join(", ")}) VALUES ${rows.join(", ")}`,
    params
  );
}

async function importDataset(client, dataset) {
  const allFeatures = readGeoJson(dataset.file);
  const features = allFeatures.filter((feature) => dataset.allowedGeometryTypes.has(feature.geometry?.type));
  const skipped = allFeatures.length - features.length;
  await truncateTable(client, dataset);
  if (features.length === 0) {
    console.log(`Loaded 0 rows into sarva.${dataset.table}`);
    return;
  }

  console.log(`Importing ${features.length} ${dataset.key} features into sarva.${dataset.table}`);
  if (skipped > 0) {
    console.log(`Skipped ${skipped} ${dataset.key} features with incompatible geometry types`);
  }
  for (let index = 0; index < features.length; index += BATCH_SIZE) {
    await insertBatch(client, dataset, features.slice(index, index + BATCH_SIZE));
  }
  await client.query(`ANALYZE sarva.${dataset.table}`);
  const count = await client.query(`SELECT count(*)::int AS count FROM sarva.${dataset.table}`);
  console.log(`Loaded ${count.rows[0].count} rows into sarva.${dataset.table}`);
}

async function main() {
  const client = await pool.connect();
  try {
    for (const dataset of DATASETS) {
      await importDataset(client, dataset);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
