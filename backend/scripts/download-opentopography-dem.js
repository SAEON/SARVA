import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const DATA_DIR = process.env.TOPOGRAPHY_DATA_DIR || "/data/topography";
const API_KEY = process.env.OPENTOPOGRAPHY_API_KEY || process.env.OT_API_KEY || "";
const DEM_TYPE = process.env.OPENTOPOGRAPHY_DEM_TYPE || "NASADEM";
const WEST = process.env.TOPOGRAPHY_WEST || "16.0";
const SOUTH = process.env.TOPOGRAPHY_SOUTH || "-35.0";
const EAST = process.env.TOPOGRAPHY_EAST || "33.0";
const NORTH = process.env.TOPOGRAPHY_NORTH || "-22.0";
const OUTPUT = process.env.TOPOGRAPHY_DEM_FILE || "south-africa-dem.tif";
const TILE_DEGREES = Number(process.env.TOPOGRAPHY_TILE_DEGREES || "2");

const ENDPOINT = "https://portal.opentopography.org/API/globaldem";

if (!API_KEY) {
  throw new Error("OPENTOPOGRAPHY_API_KEY is required to download DEM data.");
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const tileDir = path.join(DATA_DIR, "dem-tiles");
fs.mkdirSync(tileDir, { recursive: true });

const metadataPath = path.join(DATA_DIR, "opentopography-dem-download.json");

console.log(`Downloading ${DEM_TYPE} DEM from OpenTopography`);
console.log(`Bounds: west=${WEST}, south=${SOUTH}, east=${EAST}, north=${NORTH}`);
console.log(`Tile size: ${TILE_DEGREES} degrees`);

function tileRanges() {
  const west = Number(WEST);
  const south = Number(SOUTH);
  const east = Number(EAST);
  const north = Number(NORTH);
  if (![west, south, east, north, TILE_DEGREES].every(Number.isFinite) || TILE_DEGREES <= 0) {
    throw new Error("Invalid topography bounds or tile size.");
  }

  const tiles = [];
  const epsilon = 1e-9;
  for (let tileWest = west; tileWest < east - epsilon; tileWest += TILE_DEGREES) {
    for (let tileSouth = south; tileSouth < north - epsilon; tileSouth += TILE_DEGREES) {
      tiles.push({
        west: Number(tileWest.toFixed(6)),
        south: Number(tileSouth.toFixed(6)),
        east: Number(Math.min(tileWest + TILE_DEGREES, east).toFixed(6)),
        north: Number(Math.min(tileSouth + TILE_DEGREES, north).toFixed(6)),
      });
    }
  }
  return tiles;
}

async function downloadTile(tile, index) {
  const fileName = `${DEM_TYPE.toLowerCase()}_${String(index + 1).padStart(3, "0")}_${tile.west}_${tile.south}_${tile.east}_${tile.north}.tif`;
  const outputPath = path.join(tileDir, fileName);
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
    console.log(`Skipping existing tile ${index + 1}: ${fileName}`);
    return { ...tile, fileName, bytes: fs.statSync(outputPath).size, skipped: true };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("demtype", DEM_TYPE);
  url.searchParams.set("south", String(tile.south));
  url.searchParams.set("north", String(tile.north));
  url.searchParams.set("west", String(tile.west));
  url.searchParams.set("east", String(tile.east));
  url.searchParams.set("outputFormat", "GTiff");
  url.searchParams.set("API_Key", API_KEY);

  console.log(`Downloading tile ${index + 1}: west=${tile.west}, south=${tile.south}, east=${tile.east}, north=${tile.north}`);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenTopography tile download failed: ${response.status} ${response.statusText}\n${text.slice(0, 600)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json") || contentType.includes("text/")) {
    const text = await response.text();
    throw new Error(`OpenTopography returned text instead of GeoTIFF for tile ${index + 1}:\n${text.slice(0, 600)}`);
  }

  await pipeline(response.body, fs.createWriteStream(outputPath));
  const stats = fs.statSync(outputPath);
  return { ...tile, fileName, bytes: stats.size, skipped: false };
}

const tiles = tileRanges();
const downloaded = [];
for (let index = 0; index < tiles.length; index += 1) {
  downloaded.push(await downloadTile(tiles[index], index));
}

fs.writeFileSync(metadataPath, JSON.stringify({
  source: "OpenTopography Global DEM API",
  endpoint: ENDPOINT,
  demType: DEM_TYPE,
  bounds: {
    west: Number(WEST),
    south: Number(SOUTH),
    east: Number(EAST),
    north: Number(NORTH),
  },
  outputFile: OUTPUT,
  tileDegrees: TILE_DEGREES,
  tileDirectory: "dem-tiles",
  tileCount: downloaded.length,
  tiles: downloaded,
  bytes: downloaded.reduce((total, tile) => total + tile.bytes, 0),
  downloadedAt: new Date().toISOString(),
  sourceUrl: "https://opentopography.org/developers",
}, null, 2));

console.log(`Saved ${downloaded.length} DEM tiles in ${tileDir}`);
console.log(`Saved ${metadataPath}`);
