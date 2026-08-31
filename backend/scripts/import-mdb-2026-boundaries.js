import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../src/db/pool.js";

const DATA_DIR = process.env.MDB_2026_DATA_DIR || "/data/mdb-2026";
const SOURCE_URL = "https://spatialhub-mdb-sa.opendata.arcgis.com/pages/data-download";
const EFFECTIVE_DATE = "2026-11-04";
const BATCH_SIZE = 150;

const DATASETS = [
  {
    key: "district",
    file: "mdb_2026_district_municipalities.geojson",
    table: "mdb_2026_district_municipalities",
    columns: [
      ["source_fid", "integer", (p) => numberOrNull(p.FID)],
      ["province", "text", (p) => textOrNull(p.PROVINCE)],
      ["category", "text", (p) => textOrNull(p.CATEGORY)],
      ["district", "text", (p) => textOrNull(p.DISTRICT)],
      ["district_n", "text", (p) => textOrNull(p.DISTRICT_N)],
      ["map_label", "text", (p) => textOrNull(p.MAP_LABEL)],
      ["category_n", "text", (p) => textOrNull(p.CATEGORY_N)],
      ["effective_date", "date", (p) => arcDate(p.Date) || EFFECTIVE_DATE],
    ],
  },
  {
    key: "local",
    file: "mdb_2026_local_municipalities.geojson",
    table: "mdb_2026_local_municipalities",
    columns: [
      ["source_fid", "integer", (p) => numberOrNull(p.FID)],
      ["province", "text", (p) => textOrNull(p.PROVINCE)],
      ["category", "text", (p) => textOrNull(p.CATEGORY)],
      ["cat2", "text", (p) => textOrNull(p.CAT2)],
      ["cat_b", "text", (p) => textOrNull(p.CAT_B)],
      ["municname", "text", (p) => textOrNull(p.MUNICNAME)],
      ["namecode", "text", (p) => textOrNull(p.NAMECODE)],
      ["map_title", "text", (p) => textOrNull(p.MAP_TITLE)],
      ["district", "text", (p) => textOrNull(p.DISTRICT)],
      ["district_n", "text", (p) => textOrNull(p.DISTRICT_N)],
      ["effective_date", "date", (p) => arcDate(p.Date) || EFFECTIVE_DATE],
    ],
  },
  {
    key: "ward",
    file: "mdb_2026_wards.geojson",
    table: "mdb_2026_wards",
    columns: [
      ["source_fid", "integer", (p) => numberOrNull(p.FID)],
      ["province", "text", (p) => textOrNull(p.PROVINCE)],
      ["municipali", "text", (p) => textOrNull(p.MUNICIPALI)],
      ["cat_b", "text", (p) => textOrNull(p.CAT_B)],
      ["wardid", "text", (p) => textOrNull(p.WARDID)],
      ["wardlink", "text", (p) => textOrNull(p.WARDLINK)],
      ["municname", "text", (p) => textOrNull(p.MUNICNAME)],
      ["district", "text", (p) => textOrNull(p.DISTRICT)],
      ["districtco", "text", (p) => textOrNull(p.DISTRICTCO)],
      ["wardno", "integer", (p) => numberOrNull(p.WARDNO)],
      ["effective_date", "date", (p) => arcDate(p.Date) || EFFECTIVE_DATE],
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

function arcDate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return new Date(number).toISOString().slice(0, 10);
}

function readGeoJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(payload.features)) {
    throw new Error(`${fileName} does not contain a FeatureCollection`);
  }
  return payload.features;
}

async function recreateTable(client, dataset) {
  const columns = dataset.columns
    .map(([name, type]) => `${name} ${type}`)
    .join(",\n        ");

  await client.query(`DROP TABLE IF EXISTS sarva.${dataset.table} CASCADE`);
  await client.query(`
    CREATE TABLE sarva.${dataset.table} (
      gid serial PRIMARY KEY,
      ${columns},
      source_name text NOT NULL DEFAULT 'Municipal Demarcation Board ${dataset.file.replace(".geojson", "")}',
      source_url text NOT NULL DEFAULT '${SOURCE_URL}',
      source_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
      geom geometry(MULTIPOLYGON, 3857) NOT NULL
    )
  `);
}

async function insertBatch(client, dataset, features) {
  if (features.length === 0) return;

  const valueWidth = dataset.columns.length + 2;
  const columnNames = [
    ...dataset.columns.map(([name]) => name),
    "source_properties",
    "geom",
  ];
  const params = [];
  const rows = features.map((feature, rowIndex) => {
    const properties = feature.properties || {};
    for (const [, , getter] of dataset.columns) {
      params.push(getter(properties));
    }
    params.push(JSON.stringify(properties));
    params.push(JSON.stringify(feature.geometry));

    const offset = rowIndex * valueWidth;
    const placeholders = dataset.columns.map((_, index) => `$${offset + index + 1}`);
    const propertiesIndex = offset + dataset.columns.length + 1;
    const geometryIndex = offset + dataset.columns.length + 2;
    placeholders.push(`$${propertiesIndex}::jsonb`);
    placeholders.push(`ST_Transform(ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($${geometryIndex})), 4326), 3857)`);
    return `(${placeholders.join(", ")})`;
  });

  await client.query(
    `INSERT INTO sarva.${dataset.table} (${columnNames.join(", ")}) VALUES ${rows.join(", ")}`,
    params
  );
}

async function importDataset(client, dataset) {
  const features = readGeoJson(dataset.file);
  console.log(`Importing ${features.length} ${dataset.key} features into sarva.${dataset.table}`);

  await recreateTable(client, dataset);

  for (let index = 0; index < features.length; index += BATCH_SIZE) {
    await insertBatch(client, dataset, features.slice(index, index + BATCH_SIZE));
  }

  await client.query(`CREATE INDEX idx_${dataset.table}_geom ON sarva.${dataset.table} USING GIST (geom)`);
  await client.query(`CREATE INDEX idx_${dataset.table}_source_fid ON sarva.${dataset.table} (source_fid)`);
  if (dataset.columns.some(([name]) => name === "cat_b")) {
    await client.query(`CREATE INDEX idx_${dataset.table}_cat_b ON sarva.${dataset.table} (cat_b)`);
  }
  if (dataset.columns.some(([name]) => name === "wardno")) {
    await client.query(`CREATE INDEX idx_${dataset.table}_wardno ON sarva.${dataset.table} (wardno)`);
  }
  await client.query(`ANALYZE sarva.${dataset.table}`);

  const count = await client.query(`SELECT count(*)::int AS count FROM sarva.${dataset.table}`);
  console.log(`Loaded ${count.rows[0].count} rows into sarva.${dataset.table}`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS sarva");
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
