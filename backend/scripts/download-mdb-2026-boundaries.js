import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(new URL("../../", import.meta.url).pathname);
const OUTPUT_DIR = process.env.MDB_2026_DATA_DIR || path.join(ROOT_DIR, "data/mdb-2026");
const PAGE_SIZE = Number(process.env.MDB_2026_PAGE_SIZE || 1000);
const TIMEOUT_MS = Number(process.env.MDB_2026_DOWNLOAD_TIMEOUT_MS || 120000);
const SOURCE_PAGE = "https://spatialhub-mdb-sa.opendata.arcgis.com/pages/data-download";

const DATASETS = [
  {
    key: "local_municipalities",
    title: "MDB Local Municipalities 2026",
    itemId: "82c7a6d178454ddcb4dc1ef6bf2a4303",
    fileName: "mdb_2026_local_municipalities.geojson",
    url: "https://services7.arcgis.com/oeoyTUJC8HEeYsRB/arcgis/rest/services/MDB_L_ocal_Municipalities_2026/FeatureServer/0",
  },
  {
    key: "wards",
    title: "MDB Wards 2026",
    itemId: "30b6e281a5074eddbf1a3f82aa00459e",
    fileName: "mdb_2026_wards.geojson",
    url: "https://services7.arcgis.com/oeoyTUJC8HEeYsRB/arcgis/rest/services/MDB_Wards_2026/FeatureServer/0",
  },
  {
    key: "district_municipalities",
    title: "MDB District Municipalities 2026",
    itemId: "ffd2fc85aec74f5594c670e6def67787",
    fileName: "mdb_2026_district_municipalities.geojson",
    url: "https://services7.arcgis.com/oeoyTUJC8HEeYsRB/arcgis/rest/services/MDB_District_Municipalities_2026/FeatureServer/0",
  },
];

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/geo+json, application/json",
        "User-Agent": "SARVA-MDB-2026-boundary-downloader/1.0",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function countFeatures(dataset) {
  const url = new URL(`${dataset.url}/query`);
  url.searchParams.set("f", "json");
  url.searchParams.set("where", "1=1");
  url.searchParams.set("returnCountOnly", "true");
  const payload = await fetchJson(url);
  return Number(payload.count || 0);
}

async function fetchPage(dataset, offset) {
  const url = new URL(`${dataset.url}/query`);
  url.searchParams.set("f", "geojson");
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(PAGE_SIZE));
  const payload = await fetchJson(url);
  if (!Array.isArray(payload.features)) {
    throw new Error(`${dataset.title} returned no GeoJSON features at offset ${offset}`);
  }
  return payload.features;
}

async function downloadDataset(dataset) {
  const count = await countFeatures(dataset);
  const features = [];
  console.log(`Downloading ${dataset.title}: ${count} features`);

  for (let offset = 0; offset < count; offset += PAGE_SIZE) {
    const page = await fetchPage(dataset, offset);
    features.push(...page);
    console.log(`  ${Math.min(features.length, count)} / ${count}`);
    if (page.length === 0) break;
  }

  const collection = { type: "FeatureCollection", features };
  const filePath = path.join(OUTPUT_DIR, dataset.fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(collection)}\n`);

  return {
    key: dataset.key,
    title: dataset.title,
    itemId: dataset.itemId,
    url: dataset.url,
    count,
    featuresDownloaded: features.length,
    file: `data/mdb-2026/${dataset.fileName}`,
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const datasets = [];

  for (const dataset of DATASETS) {
    datasets.push(await downloadDataset(dataset));
  }

  const manifest = {
    downloadedAt: new Date().toISOString(),
    sourcePage: SOURCE_PAGE,
    publisher: "Municipal Demarcation Board",
    note: "MDB metadata says the 2026 Local Municipalities dataset comes into effect on 4 November 2026. MDB licence text permits research, publications and value-added applications with acknowledgement, but prohibits selling the data, commercial appropriation, altering the original dataset and passing it off as MDB product.",
    datasets,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote MDB 2026 downloads and manifest to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
