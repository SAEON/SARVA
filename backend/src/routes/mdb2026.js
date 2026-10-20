import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../db/pool.js";

export const mdb2026Router = Router();

function bboxFromRow(row) {
  const values = [row.minx, row.miny, row.maxx, row.maxy].map(Number);
  return values.every(Number.isFinite) ? values : null;
}

function numberOrNull(value, digits = 6) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function rowGeometry(row) {
  return {
    longitude: numberOrNull(row.longitude),
    latitude: numberOrNull(row.latitude),
    bbox: bboxFromRow(row),
  };
}

function tileKey(tile) {
  return [tile.west, tile.south, tile.east, tile.north].map((value) => Number(value).toFixed(6)).join("|");
}

function downloadedTopographyTiles(dataDir) {
  const tileDir = path.join(dataDir, "dem-tiles");
  if (!fs.existsSync(tileDir)) return [];

  return fs.readdirSync(tileDir)
    .map((fileName) => {
      const match = fileName.match(/^[a-z0-9]+_\d+_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)\.tif$/i);
      if (!match) return null;
      const [, west, south, east, north] = match;
      const filePath = path.join(tileDir, fileName);
      return {
        fileName,
        west: Number(west),
        south: Number(south),
        east: Number(east),
        north: Number(north),
        bytes: fs.statSync(filePath).size,
      };
    })
    .filter((tile) => tile && [tile.west, tile.south, tile.east, tile.north].every(Number.isFinite));
}

function expectedTopographyTiles(downloadedTiles) {
  const west = Number(process.env.TOPOGRAPHY_WEST || 16.0);
  const south = Number(process.env.TOPOGRAPHY_SOUTH || -35.0);
  const east = Number(process.env.TOPOGRAPHY_EAST || 33.0);
  const north = Number(process.env.TOPOGRAPHY_NORTH || -22.0);
  const inferredTileSize = downloadedTiles[0] ? Math.abs(downloadedTiles[0].east - downloadedTiles[0].west) : null;
  const tileDegrees = Number(process.env.TOPOGRAPHY_TILE_DEGREES || inferredTileSize || 2);
  const tiles = [];
  const epsilon = 1e-9;

  for (let tileWest = west; tileWest < east - epsilon; tileWest += tileDegrees) {
    for (let tileSouth = south; tileSouth < north - epsilon; tileSouth += tileDegrees) {
      tiles.push({
        west: Number(tileWest.toFixed(6)),
        south: Number(tileSouth.toFixed(6)),
        east: Number(Math.min(tileWest + tileDegrees, east).toFixed(6)),
        north: Number(Math.min(tileSouth + tileDegrees, north).toFixed(6)),
      });
    }
  }
  return { tileDegrees, tiles };
}

function tileIntersectsBbox(tile, bbox) {
  if (!bbox) return false;
  const [minx, miny, maxx, maxy] = bbox;
  return tile.west < maxx && tile.east > minx && tile.south < maxy && tile.north > miny;
}

function tileFeature(tile, downloaded, importedBbox) {
  const isImported = Boolean(downloaded && tileIntersectsBbox(tile, importedBbox));
  return {
    type: "Feature",
    properties: {
      status: isImported ? "imported" : downloaded ? "downloaded" : "missing",
      label: `${tile.west},${tile.south} to ${tile.east},${tile.north}`,
      fileName: downloaded?.fileName || null,
      bytes: downloaded?.bytes || 0,
    },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [tile.west, tile.south],
        [tile.east, tile.south],
        [tile.east, tile.north],
        [tile.west, tile.north],
        [tile.west, tile.south],
      ]],
    },
  };
}

mdb2026Router.get("/mdb-2026/districts", async (_req, res) => {
  try {
    const result = await pool.query(`
      WITH base AS (
        SELECT
          gid,
          COALESCE(NULLIF(map_label, ''), NULLIF(district_n, ''), NULLIF(district, ''), 'District municipality') AS label,
          province,
          district,
          district_n,
          ST_Transform(geom, 4326) AS geom4326
        FROM sarva.mdb_2026_district_municipalities
      )
      SELECT
        gid,
        label,
        province,
        district,
        district_n,
        ST_XMin(ST_Extent(geom4326)) AS minx,
        ST_YMin(ST_Extent(geom4326)) AS miny,
        ST_XMax(ST_Extent(geom4326)) AS maxx,
        ST_YMax(ST_Extent(geom4326)) AS maxy,
        ST_X(ST_PointOnSurface(ST_Collect(geom4326))) AS longitude,
        ST_Y(ST_PointOnSurface(ST_Collect(geom4326))) AS latitude
      FROM base
      GROUP BY gid, label, province, district, district_n
      ORDER BY label
    `);

    res.json({
      status: "ok",
      data: {
        count: result.rows.length,
        records: result.rows.map((row) => ({
          gid: row.gid,
          label: row.label,
          province: row.province,
          district: row.district,
          districtName: row.district_n,
          ...rowGeometry(row),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching MDB 2026 districts", error);
    res.status(500).json({ status: "error", message: "MDB 2026 districts could not be loaded." });
  }
});

mdb2026Router.get("/mdb-2026/municipalities", async (req, res) => {
  const district = String(req.query.district || "").trim();

  try {
    const values = [];
    let where = "";
    if (district) {
      values.push(district);
      where = "WHERE district_n = $1 OR district = $1";
    }

    const result = await pool.query(`
      WITH base AS (
        SELECT
          gid,
          COALESCE(NULLIF(map_title, ''), NULLIF(municname, ''), NULLIF(namecode, ''), 'Municipality') AS label,
          province,
          district,
          district_n,
          cat_b,
          namecode,
          municname,
          ST_Transform(geom, 4326) AS geom4326
        FROM sarva.mdb_2026_local_municipalities
        ${where}
      )
      SELECT
        gid,
        label,
        province,
        district,
        district_n,
        cat_b,
        namecode,
        municname,
        ST_XMin(ST_Extent(geom4326)) AS minx,
        ST_YMin(ST_Extent(geom4326)) AS miny,
        ST_XMax(ST_Extent(geom4326)) AS maxx,
        ST_YMax(ST_Extent(geom4326)) AS maxy,
        ST_X(ST_PointOnSurface(ST_Collect(geom4326))) AS longitude,
        ST_Y(ST_PointOnSurface(ST_Collect(geom4326))) AS latitude
      FROM base
      GROUP BY gid, label, province, district, district_n, cat_b, namecode, municname
      ORDER BY label
    `, values);

    res.json({
      status: "ok",
      data: {
        count: result.rows.length,
        records: result.rows.map((row) => ({
          gid: row.gid,
          label: row.label,
          province: row.province,
          district: row.district,
          districtName: row.district_n,
          code: row.cat_b || row.namecode,
          municipality: row.municname || row.label,
          ...rowGeometry(row),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching MDB 2026 municipalities", error);
    res.status(500).json({ status: "error", message: "MDB 2026 municipalities could not be loaded." });
  }
});

mdb2026Router.get("/mdb-2026/wards", async (req, res) => {
  const district = String(req.query.district || "").trim();
  const municipality = String(req.query.municipality || "").trim();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "600", 10) || 600, 1), 5000);

  try {
    const values = [];
    const clauses = [];
    if (district) {
      values.push(district);
      clauses.push(`(district = $${values.length} OR districtco = $${values.length})`);
    }
    if (municipality) {
      values.push(municipality);
      clauses.push(`(municname = $${values.length} OR municipali = $${values.length} OR cat_b = $${values.length})`);
    }
    values.push(limit);

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await pool.query(`
      WITH base AS (
        SELECT
          gid,
          COALESCE(wardno, (source_properties->>'WardNo')::integer) AS wardno,
          COALESCE(wardid, source_properties->>'WardID') AS wardid,
          COALESCE(wardlink, source_properties->>'WardLink') AS wardlink,
          COALESCE(province, source_properties->>'Province') AS province,
          COALESCE(district, source_properties->>'DISTRICT') AS district,
          COALESCE(districtco, source_properties->>'DISTRICTCO') AS districtco,
          COALESCE(cat_b, source_properties->>'CAT_B') AS cat_b,
          COALESCE(municname, source_properties->>'MUNICNAME') AS municname,
          COALESCE(municipali, source_properties->>'Municipali') AS municipali,
          ST_Transform(geom, 4326) AS geom4326
        FROM sarva.mdb_2026_wards
        ${where}
      )
      SELECT
        gid,
        wardno,
        wardid,
        wardlink,
        province,
        district,
        districtco,
        cat_b,
        municname,
        municipali,
        ST_XMin(ST_Extent(geom4326)) AS minx,
        ST_YMin(ST_Extent(geom4326)) AS miny,
        ST_XMax(ST_Extent(geom4326)) AS maxx,
        ST_YMax(ST_Extent(geom4326)) AS maxy,
        ST_X(ST_PointOnSurface(ST_Collect(geom4326))) AS longitude,
        ST_Y(ST_PointOnSurface(ST_Collect(geom4326))) AS latitude
      FROM base
      GROUP BY gid, wardno, wardid, wardlink, province, district, districtco, cat_b, municname, municipali
      ORDER BY municname, wardno NULLS LAST, wardid
      LIMIT $${values.length}
    `, values);

    res.json({
      status: "ok",
      data: {
        count: result.rows.length,
        records: result.rows.map((row) => ({
          gid: row.gid,
          label: `Ward ${row.wardno || row.wardid || row.wardlink || row.gid}`,
          wardNo: row.wardno,
          wardId: row.wardid,
          province: row.province,
          district: row.district,
          districtName: row.districtco || row.district,
          code: row.cat_b,
          municipality: row.municname || row.municipali,
          ...rowGeometry(row),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching MDB 2026 wards", error);
    res.status(500).json({ status: "error", message: "MDB 2026 wards could not be loaded." });
  }
});

mdb2026Router.get("/topography/status", async (_req, res) => {
  try {
    const result = await pool.query(`
      WITH counts AS (
        SELECT
          (SELECT COUNT(*)::int FROM sarva.topography_contours) AS contour_count,
          (SELECT COUNT(*)::int FROM sarva.topography_slope_zones) AS slope_count
      ),
      topography_extent AS (
        SELECT ST_Transform(ST_SetSRID(ST_Extent(geom)::geometry, 3857), 4326) AS geom
        FROM (
          SELECT geom FROM sarva.topography_contours
          UNION ALL
          SELECT geom FROM sarva.topography_slope_zones
        ) features
      ),
      latest_meta AS (
        SELECT source_name, source_url, source_date, processing_note
        FROM (
          SELECT source_name, source_url, source_date, processing_note FROM sarva.topography_contours
          UNION ALL
          SELECT source_name, source_url, source_date, processing_note FROM sarva.topography_slope_zones
        ) metadata
        WHERE source_name IS NOT NULL
        LIMIT 1
      )
      SELECT
        counts.contour_count,
        counts.slope_count,
        ST_XMin(topography_extent.geom) AS minx,
        ST_YMin(topography_extent.geom) AS miny,
        ST_XMax(topography_extent.geom) AS maxx,
        ST_YMax(topography_extent.geom) AS maxy,
        latest_meta.source_name,
        latest_meta.source_url,
        latest_meta.source_date,
        latest_meta.processing_note
      FROM counts
      CROSS JOIN topography_extent
      LEFT JOIN latest_meta ON true
    `);

    const row = result.rows[0] || {};
    const bbox = bboxFromRow(row);
    res.json({
      status: "ok",
      data: {
        contourCount: Number(row.contour_count || 0),
        slopeCount: Number(row.slope_count || 0),
        bbox,
        source: {
          name: row.source_name || "OpenTopography Global DEM API",
          url: row.source_url || "https://opentopography.org/developers",
          date: row.source_date || null,
          processingNote: row.processing_note || null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching topography status", error);
    res.status(500).json({ status: "error", message: "Topography layer status could not be loaded." });
  }
});

mdb2026Router.get("/topography/grid", async (_req, res) => {
  try {
    const dataDir = process.env.TOPOGRAPHY_DATA_DIR || "/data/topography";
    const downloadedTiles = downloadedTopographyTiles(dataDir);
    const downloadedByKey = new Map(downloadedTiles.map((tile) => [tileKey(tile), tile]));
    const expected = expectedTopographyTiles(downloadedTiles);
    const extentResult = await pool.query(`
      WITH topography_extent AS (
        SELECT ST_Transform(ST_SetSRID(ST_Extent(geom)::geometry, 3857), 4326) AS geom
        FROM (
          SELECT geom FROM sarva.topography_contours
          UNION ALL
          SELECT geom FROM sarva.topography_slope_zones
        ) features
      )
      SELECT
        ST_XMin(geom) AS minx,
        ST_YMin(geom) AS miny,
        ST_XMax(geom) AS maxx,
        ST_YMax(geom) AS maxy
      FROM topography_extent
    `);
    const importedBbox = bboxFromRow(extentResult.rows[0] || {});
    const features = expected.tiles.map((tile) => tileFeature(tile, downloadedByKey.get(tileKey(tile)), importedBbox));
    const importedCount = features.filter((feature) => feature.properties.status === "imported").length;
    const downloadedCount = features.filter((feature) => feature.properties.status === "downloaded").length;
    const missingCount = features.filter((feature) => feature.properties.status === "missing").length;

    res.json({
      status: "ok",
      data: {
        tileDegrees: expected.tileDegrees,
        expectedCount: expected.tiles.length,
        downloadedCount,
        importedCount,
        missingCount,
        geojson: {
          type: "FeatureCollection",
          features,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching topography grid", error);
    res.status(500).json({ status: "error", message: "Topography DEM grid could not be loaded." });
  }
});
