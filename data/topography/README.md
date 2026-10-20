# SARVA Topography Layers

Prepared workspace for DEM-derived topography layers served from PostGIS through Martin vector tiles.

Raw DEM rasters should not be committed to this repository. Keep source rasters in object storage or a local/server data volume, then export compact vector products into this folder for import.

## Expected Import Files

Place these preprocessed WGS84 GeoJSON files in this directory:

- `topography_contours.geojson`
  - Line features.
  - Required property: `elevation_m`.
  - Optional property: `contour_interval_m`.
- `topography_slope_zones.geojson`
  - Polygon features.
  - Required property: `slope_class`.
  - Optional properties: `slope_min_degrees`, `slope_max_degrees`.

## Recommended Products

- 20 m contours for municipal-scale inspection, especially around wards, drainage, roads and settlements.
- Slope zones such as `flat`, `gentle`, `moderate`, `steep`.
- Optional later additions: flow accumulation, local depressions, catchment pour points and terrain wetness proxy.

## Candidate DEM Sources

- NASADEM / SRTM-derived elevation data.
- Copernicus DEM GLO-30, where licence and attribution are suitable.
- OpenTopography-hosted global DEM services for reproducible extraction.

Always keep `source_name`, `source_url`, `source_date` and processing notes with the imported layer.

## Import

The normal once-off workflow is:

```sh
export OPENTOPOGRAPHY_API_KEY="your-key"
docker compose run --rm backend npm run download:topography
docker run --rm \
  --env TOPOGRAPHY_DATA_DIR=/data/topography \
  --volume "$(pwd)/data/topography:/data/topography:rw" \
  --volume "$(pwd)/scripts/process-topography-with-gdal.sh:/process-topography-with-gdal.sh:ro" \
  ghcr.io/osgeo/gdal:ubuntu-full-3.9.2 /process-topography-with-gdal.sh
docker compose run --rm backend npm run import:topography
docker compose up -d --force-recreate martin frontend
```

The downloader stores DEM tiles under `data/topography/dem-tiles/` and writes
`opentopography-dem-download.json`. The processor builds a temporary VRT mosaic
from those tiles before generating contours and slope zones.

On the dev server, the deploy helper wraps those steps:

```sh
cd /opt/sarva
export OPENTOPOGRAPHY_API_KEY="your-key"
deploy/server-update.sh --with-topography
```

Useful processing options:

```sh
export OPENTOPOGRAPHY_DEM_TYPE=NASADEM
export TOPOGRAPHY_WEST=16.0
export TOPOGRAPHY_SOUTH=-35.0
export TOPOGRAPHY_EAST=33.0
export TOPOGRAPHY_NORTH=-22.0
export TOPOGRAPHY_TILE_DEGREES=4
export TOPOGRAPHY_CONTOUR_INTERVAL=20
```

Set optional metadata at import time:

```sh
TOPOGRAPHY_SOURCE_NAME="Copernicus DEM GLO-30 derived contours and slope zones" \
TOPOGRAPHY_SOURCE_URL="https://dataspace.copernicus.eu/" \
TOPOGRAPHY_SOURCE_DATE="2026" \
TOPOGRAPHY_PROCESSING_NOTE="DEM clipped to South Africa, contours generated at 20 m interval, slope classified from degrees." \
docker compose run --rm backend npm run import:topography
```
