#!/usr/bin/env bash
set -eu

DATA_DIR="${TOPOGRAPHY_DATA_DIR:-data/topography}"
DEM_FILE="${TOPOGRAPHY_DEM_FILE:-south-africa-dem.tif}"
CONTOUR_INTERVAL="${TOPOGRAPHY_CONTOUR_INTERVAL:-20}"
CONTOUR_SIMPLIFY="${TOPOGRAPHY_CONTOUR_SIMPLIFY:-}"
TOPOGRAPHY_INCLUDE_SLOPE="${TOPOGRAPHY_INCLUDE_SLOPE:-true}"
DEM_PATH="$DATA_DIR/$DEM_FILE"
WORK_DIR="$DATA_DIR/work"
TILE_DIR="$DATA_DIR/dem-tiles"

if ! command -v gdalinfo >/dev/null 2>&1; then
  echo "GDAL tools are required. Run this script inside an OSGeo/GDAL container." >&2
  exit 1
fi

if [ ! -f "$DEM_PATH" ]; then
  if find "$TILE_DIR" -name '*.tif' -print -quit >/dev/null 2>&1; then
    echo "Building DEM mosaic from $TILE_DIR"
    mkdir -p "$WORK_DIR"
    find "$TILE_DIR" -name '*.tif' | sort > "$WORK_DIR/dem-tile-list.txt"
    gdalbuildvrt -input_file_list "$WORK_DIR/dem-tile-list.txt" "$WORK_DIR/south-africa-dem.vrt"
    DEM_PATH="$WORK_DIR/south-africa-dem.vrt"
  else
    echo "DEM not found: $DEM_PATH and no DEM tiles found in $TILE_DIR" >&2
    exit 1
  fi
fi

mkdir -p "$WORK_DIR"

SLOPE_TIF="$WORK_DIR/slope_degrees.tif"
SLOPE_CLASSES_TIF="$WORK_DIR/slope_classes.tif"
CONTOURS_GPKG="$WORK_DIR/topography_contours.gpkg"
SLOPE_GPKG="$WORK_DIR/topography_slope_zones.gpkg"

echo "== DEM info =="
gdalinfo "$DEM_PATH" | sed -n '1,24p'

echo "== Contours =="
rm -f "$CONTOURS_GPKG" "$DATA_DIR/topography_contours.geojson"
gdal_contour -a elevation_m -i "$CONTOUR_INTERVAL" -f GPKG -nln contours "$DEM_PATH" "$CONTOURS_GPKG"
SIMPLIFY_ARGS=()
if [ -n "$CONTOUR_SIMPLIFY" ]; then
  SIMPLIFY_ARGS=(-simplify "$CONTOUR_SIMPLIFY")
fi
ogr2ogr -f GeoJSON "$DATA_DIR/topography_contours.geojson" "$CONTOURS_GPKG" contours \
  -t_srs EPSG:4326 \
  "${SIMPLIFY_ARGS[@]}" \
  -lco RFC7946=YES

if [ "$TOPOGRAPHY_INCLUDE_SLOPE" != "true" ]; then
  echo "== Slope =="
  echo "Skipping slope polygonization because TOPOGRAPHY_INCLUDE_SLOPE is not true."
  rm -f "$DATA_DIR/topography_slope_zones.geojson"
  echo "Wrote:"
  ls -lh "$DATA_DIR/topography_contours.geojson"
  exit 0
fi

echo "== Slope =="
gdaldem slope "$DEM_PATH" "$SLOPE_TIF" -of GTiff -compute_edges

python3 - <<'PY'
from osgeo import gdal
import numpy as np
import os

data_dir = os.environ.get("TOPOGRAPHY_DATA_DIR", "data/topography")
src_path = os.path.join(data_dir, "work", "slope_degrees.tif")
dst_path = os.path.join(data_dir, "work", "slope_classes.tif")

src = gdal.Open(src_path)
band = src.GetRasterBand(1)
arr = band.ReadAsArray()
nodata = band.GetNoDataValue()
classes = np.zeros(arr.shape, dtype=np.uint8)
valid = np.isfinite(arr)
if nodata is not None:
    valid &= arr != nodata

classes[(valid) & (arr < 2)] = 1
classes[(valid) & (arr >= 2) & (arr < 5)] = 2
classes[(valid) & (arr >= 5) & (arr < 15)] = 3
classes[(valid) & (arr >= 15)] = 4

driver = gdal.GetDriverByName("GTiff")
dst = driver.Create(dst_path, src.RasterXSize, src.RasterYSize, 1, gdal.GDT_Byte, ["COMPRESS=LZW"])
dst.SetGeoTransform(src.GetGeoTransform())
dst.SetProjection(src.GetProjection())
out = dst.GetRasterBand(1)
out.WriteArray(classes)
out.SetNoDataValue(0)
out.FlushCache()
dst.FlushCache()
PY

rm -f "$SLOPE_GPKG"
rm -f "$DATA_DIR/topography_slope_zones.geojson"
gdal_polygonize.py "$SLOPE_CLASSES_TIF" -f GPKG "$SLOPE_GPKG" slope_zones DN
ogr2ogr -f GeoJSON "$DATA_DIR/topography_slope_zones.geojson" "$SLOPE_GPKG" slope_zones \
  -t_srs EPSG:4326 \
  -sql "SELECT CASE DN WHEN 1 THEN 'flat' WHEN 2 THEN 'gentle' WHEN 3 THEN 'moderate' WHEN 4 THEN 'steep' ELSE 'unspecified' END AS slope_class, CASE DN WHEN 1 THEN 0 WHEN 2 THEN 2 WHEN 3 THEN 5 WHEN 4 THEN 15 ELSE NULL END AS slope_min_degrees, CASE DN WHEN 1 THEN 2 WHEN 2 THEN 5 WHEN 3 THEN 15 ELSE NULL END AS slope_max_degrees, geom FROM slope_zones WHERE DN > 0" \
  -dialect SQLite \
  -lco RFC7946=YES

echo "Wrote:"
ls -lh "$DATA_DIR/topography_contours.geojson" "$DATA_DIR/topography_slope_zones.geojson"
